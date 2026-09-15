# ADR-0006: Admin-gate allowlist policy

**Status:** Accepted (amended 2026-09-15 by issue #1172: canonical id format tightened from the permissive `[a-zA-Z0-9-]{1,128}` to strict UUID v4)
**Date:** 2026-08-18 (original), 2026-09-15 (amendment)
**Issue:** #1153 (filing), #1075 (guard), #1155 (hardening), #1077 (audit trail), #1172 (strict UUID v4)
**Supersedes:** none
**Related ADRs:** [ADR-0005](./0005-combat-authority-boundary.md) (no functional overlap; cross-referenced because both are server-authority contracts)
**Cross-references:** `backend/src/modules/admin_auth.ts`; `RPC_MAP.md` §"Admin Authorization"; `backend/.env.example`; AGENTS.md §"Testing Guidelines" (fail-closed); `docs/SECRETS_MANAGEMENT.md`, `docs/SECRETS_ROTATION.md`

## Context

Every privileged RPC — the `admin_*` season tools, the rollout-flag mutators, `metrics` / `n_plus_one_report`, the `deployment_*` family, the `error_insights_*` family, and the QA replay endpoints — must answer one question for every call: **is the caller allowed to invoke this?** The answer is "yes, iff the caller's Nakama user id is on a server-side allowlist."

Issue #1075 introduced the guard; issue #1155 hardened it after a review found two gaps:

1. **TOCTOU on `process.env.ADMIN_USER_IDS`** — the original parser re-read the env var on every call, so a hot-reload, a test fixture, or a stray `process.env.ADMIN_USER_IDS = …` mutation could flip the gate between requests without any operator action.
2. **No format validation, no case normalization** — `ABC-123` in the env and `abc-123` from `ctx.userId` would silently never match; the deployment would appear authorized but every call would be rejected. Whitespace, embedded commas, and other operator typos were accepted without complaint.

PR #1155 (commit `bc5ebe0b`, merged into `main`) closed both gaps. This ADR ratifies the resulting policy as the canonical contract for admin authorization in Armored Archer, so future contributors do not re-invent either the mechanism or the rationale. The same PR also introduced two reload hooks — `resetAdminAllowlistCache()` (test-only) and `reloadAdminAllowlist()` (operator-facing, future use) — that are part of the contract.

## Decision

Admin authorization in Armored Archer is a **fail-closed, env-driven, parse-once allowlist** with explicit format validation and audit logging. It is the only authorization mechanism for the `admin_*` RPC families enumerated in `RPC_MAP.md` §"Admin Authorization" — there is no second gate, no role/group fallback, and no client-side bypass.

### Policy

1. **Allowlist source of truth:** the `ADMIN_USER_IDS` environment variable. The variable holds a comma-separated list of canonical Nakama user ids in strict UUID v4 form (e.g. `00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000002`). The full list is **never** logged; the count and a SHA-256 prefix of each id are logged once at first parse for rotation auditability.

2. **Canonical user-id format:** strict UUID v4 (RFC 4122) — `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`. The version nibble must be `4` and the variant nibble must be `8`, `9`, `a`, or `b`; uppercase hex is accepted and normalized to lowercase. Anything else — other UUID versions, the dashless 32-hex form, whitespace, embedded punctuation, or over-long strings — is rejected. (Amendment #1172: the original ratification allowed the permissive `[a-zA-Z0-9-]{1,128}`, which silently accepted typo'd admin ids; the hardening spec from #1075 called for strict v4.)

3. **Parse-once semantics:** the allowlist is resolved on the first call to `getAdminUserIds()` and frozen. Subsequent calls return the same frozen `ReadonlySet<string>` until the cache is explicitly invalidated. This is the TOCTOU fix from #1155 — a stray `process.env.ADMIN_USER_IDS = …` mutation between requests cannot flip the gate.

4. **Case normalization:** every entry is lowercased before being added to the set, and every lookup normalizes `ctx.userId` to lowercase. `00000000-0000-4000-8000-00000000000A` in the env matches `00000000-0000-4000-8000-00000000000a` from `ctx.userId`.

5. **Fail-fast on malformed entries:** any entry that fails the canonical-format regex causes `parseAndValidate()` to throw. The process is expected to crash on startup rather than run with a silently-broken gate. The error message identifies the offending entry by its raw value.

6. **Fail-closed on empty allowlist:** an unset, blank, or all-whitespace `ADMIN_USER_IDS` resolves to an empty `Set`. Every admin RPC then rejects every caller. The empty-allowlist case is logged once at INFO level so operators can confirm the deployed posture without printing the raw ids.

7. **Server-key invocations are never admin:** the Nakama server key is embedded in client binaries and is therefore public. Calls with no `ctx.userId` (server-key invocations) are never treated as admin — `isAdminUser()` returns `false` for any missing or empty `userId`.

8. **Audit logging:** every rejection writes an `admin_rpc_access_denied` audit entry against the caller via `logAudit()` (which never throws — a broken audit sink cannot turn into an availability issue). The same event is also emitted through the runtime logger and the winston application logger.

9. **Handler-wrapper, not registration-branch guard:** the gate is implemented by `withAdminGuard(rpcId, handler)` and applied at the RPC's *registration site inside the owning module*. It is not implemented as an `index.ts` if/else around `initializer.registerRpc`. This guarantees no conditional registration path can skip the guard — see `withAdminGuard` call sites in `matchmaker.ts`, `season_admin.ts`, `metrics.ts`, `deployment_observability.ts`, `progressive_rollout.ts`, `error_insight_pipeline.ts`.

10. **Reload contract:**
    - `resetAdminAllowlistCache()` — invalidates the cache so the next `getAdminUserIds()` call re-parses the env. **Production code must not call this.** It exists for tests that mutate `process.env.ADMIN_USER_IDS` between cases.
    - `reloadAdminAllowlist()` — explicit, audited mid-flight rotation. Re-reads and validates the env, replaces the cached set atomically, returns the new count. On a malformed env, the existing cache is **left intact** and the error surfaces to the caller — a broken rotation does not disable the gate.

### Why allowlist (not role/group)

The product does not yet have a server-managed roles / groups surface for admin operations, and adding one is out of scope for #1075 / #1155. An env-driven allowlist is:

- **Auditable** at deploy time — the deployed allowlist fingerprints are in the startup log; rotating is a config change with a deploy, not a database mutation.
- **Independent of game-data writes** — no risk of a bug in the player-role code path flipping admin access.
- **Recoverable** — a hot-fix to flip the allowlist is a single env-var change and a server restart, not a database rollback.

The intended migration path is to a Nakama group/role once the group-management surface exists, at which point this ADR is superseded. Until then, allowlist is the only mechanism, and "everyone who is admin" is exactly the set of ids in `ADMIN_USER_IDS` at process start.

### Why fail-closed

Fail-closed means: an unset, blank, or misconfigured allowlist rejects every caller, and the process refuses to run with a malformed entry. The alternative — fail-open or silently-truncate — turns an operator typo into a security incident. The cost of fail-closed is that a missing `ADMIN_USER_IDS` will block legitimate admin calls; that cost is paid loudly at startup (process crashes on a malformed entry; empty-allowlist logged at INFO) rather than silently at runtime.

## Consequences

### Positive

- A single document answers "how do I add or remove an admin?" and "what does the guard do when the env is wrong?".
- The TOCTOU surface is closed by parse-once + frozen Set; this is test-covered (`backend/src/modules/__tests__/admin_auth.test.ts`).
- Case normalization removes the silent-brick class of deploy errors.
- The audit trail — `admin_rpc_access_denied` against the caller — is the canonical source of truth for "who tried to call admin RPCs and was rejected", per #1077.
- `RPC_MAP.md` §"Admin Authorization" and `backend/.env.example` (`ADMIN_USER_IDS=`, with a commented UUID v4 example) cross-reference this ADR as the single canonical contract.

### Negative / costs

- Operators cannot rotate the allowlist mid-flight without a server restart by default. `reloadAdminAllowlist()` exists for the rare incident-response case but is not wired to any RPC; using it requires code change, not just a config push.
- A malformed entry crashes the process on startup. This is intentional (fail-fast) but it means a config-typo deploy is an outage until the typo is fixed and the process restarts. Documented in `docs/SECRETS_ROTATION.md` and the runbooks.

### Followups queued (not part of this decision)

- Add a short rotation runbook entry to `docs/SECRETS_ROTATION.md` describing how to verify the deployed allowlist from the startup log (count + fingerprints), and what to do if `reloadAdminAllowlist()` is ever wired to an RPC.
- When Nakama group/role support is added, supersede this ADR with one that documents the migration path (group membership replaces the env-driven set, with a feature-flagged transition window).
- `RPC_MAP.md` §"Admin Authorization" should grow a one-line cross-reference to this ADR (already mentioned in the commit message for #1153).
