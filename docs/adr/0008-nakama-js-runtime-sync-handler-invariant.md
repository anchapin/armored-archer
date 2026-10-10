# ADR-0008: Nakama JS runtime (goja) constraints govern sync RPC handlers

**Status:** Accepted
**Date:** 2026-09-28
**Issue:** #1421 (filing); follow-up tracked separately
**Supersedes:** none
**Related ADRs:** [ADR-0003](./0003-hybrid-duel-model.md), [ADR-0004](./0004-decommission-legacy-duel-rpcs.md), [ADR-0005](./0005-combat-authority-boundary.md)
**Cross-references:** `backend/src/index.ts` (RPC wrappers), `backend/src/utils/rateLimiter.ts`, `backend/src/modules/metrics.ts`, `backend/src/modules/store.ts`, `backend/src/utils/storage-helpers.ts`, `docs/ci/issue-1390-reproduction.md`, `docs/ci/issue-1392-reproduction.md`, `docs/ci/issue-1394-reproduction.md`

## Context

Armored Archer runs its entire backend inside the **Nakama JS runtime**, which embeds the
**goja** JavaScript engine. goja is not Node. It has no microtask queue, no libuv event
loop, and only a partial standard-library surface. Three properties of that runtime
constrain how every RPC handler in `backend/src` may be written:

1. **No microtask queue → async RPC handlers are unsupported.** A registered handler must
   return a `string`. If it returns a `Promise`, Nakama rejects the call with
   `"RPC <name> returned a non-string result; async handlers are unsupported"`. A promise
   *never settles* because nothing drains the microtask queue, so the RPC hangs rather than
   erroring cleanly. This is enforced defensively at the two registration seams:
   `createRateLimitedRpcHandler` (`backend/src/utils/rateLimiter.ts#createRateLimitedRpcHandler`) and the metrics
   wrapper (`backend/src/modules/metrics.ts#wrapRpcWithMetrics`), both of which throw on a non-string
   result.
2. **No async I/O of any kind.** Because nothing drives `await`, the runtime also cannot
   perform outbound HTTP (`fetch`, RevenueCat verification/refund/history calls) or
   promise-based Redis (`ioredis`). Code paths that need them are unreachable in production
   and are retained only as dead branches for a future sync-HTTP layer. The authoritative
   substitute is **durable Nakama storage**, which is synchronous — see `processRefund`
   (`backend/src/modules/store.ts#processRefund`), whose durable storage markers make the refund path
   fully sync.
3. **`crypto` is a stub.** goja's `crypto.createHash().digest('hex')` silently returns the
   **empty string**. Code that depends on it produces empty hashes with no error; because
   every value then shares a hash, uniqueness checks see every subsequent value as a
   duplicate. `sha256Hex` (`backend/src/modules/store.ts#sha256Hex`) therefore uses a
   deterministic FNV-1a-style fallback in the sync runtime. This fallback is mandatory - without it
   every receipt after the first fails as `Duplicate receipt detected`.

A fourth, separate constraint governs storage values: goja's `storageWrite` accepts **plain
objects** and JSON-marshals internally, whereas passing a raw string panics with
`expects 'value' value to be an object`. `backend/src/utils/storage-helpers.ts` is the
single sanctioned adapter for this.

### Why this ADR exists

All of the above were cited as **issue #1135** in **43 comments across 19 files** — 38 in
`backend/src` (16 files) and 5 in `docs/ci/` (3 cluster reproductions). That was wrong
twice over. #1135 is a **closed** issue titled *"Performance: rpcStageComplete 12-15
sequential storage RTTs post-#1069 — measure + batch"*. It concerns stage-completion
latency and unrelated sync-HTTP prerequisites; it says nothing about goja. Because the
pointer aimed at a closed, unrelated issue, any contributor touching the sync-handler path
would reasonably conclude the constraint no longer applied and reintroduce an `async`
handler.

The cost was already realised: PRs #1312 and #1317 were both written against `await`
inside sync RPC handlers, were unmergeable on arrival, and had to be closed. The same
misattribution spanned three cluster reproductions
(`docs/ci/issue-1390|1392|1394-reproduction.md`).

Seven further `#1135` references are **plausibly correct** and deliberately left untouched —
the `rpcStageComplete` RTT-budget tests (`backend/tests/integration/performance_smoke.test.ts`),
the build-time env snapshot and latency-measurement notes
(`backend/scripts/transpile-bundle.js`), the BigInt pattern in
`backend/scripts/validate-nakama-bundle.js`, and the `--socket.server_key` note in
`backend/docker-compose.yml`.

One further reference, `.github/docker-compose.yml#js_entrypoint` (`Config file (issue #1135 /
fix/ci-infrastructure)`), concerns CI `js_entrypoint` wiring — a third topic that is
neither a goja constraint nor plausibly the RTT issue. It is **out of scope here** and was
left alone; it most likely refers to a PR rather than the issue, and resolving it requires
confirming which, which is a separate question from this ADR.

## Decision

**The goja runtime constraints above are the governing invariant for every RPC handler in
`backend/src`, and this ADR is their single source of truth.** Code comments cite this ADR
(`ADR-0008`), not a transient issue number.

Concretely:

- **Every registered RPC handler returns `string`, synchronously.** A handler needing
  external I/O must be redesigned around durable storage, not made `async`. Marking a
  handler `async` is a defect even when the `async` keyword carries no `await` — the
  wrapper's return type alone breaks the contract (this is the exact bug in the
  `rpcValidatePurchaseWrapper` cluster-4 note at `backend/src/index.ts#rpcValidatePurchaseWrapper`).
- **Wrapper functions stay sync even when the wrapped module function is sync.** The
  `async` keyword is inherited by the return value, not merely by the body.
- **No outbound HTTP or promise-based Redis on an RPC path.** Unreachable branches are kept
  behind an explicit short-circuit with a logged reason and a returned error/empty result of
  the correct shape, so callers degrade predictably. The representative sites, each carrying
  an `ADR-0008` comment: the Redis receipt fast-path (`store.ts#isReceiptAlreadyUsed`), the no-API-key
  receipt short-circuit (`store.ts#validateWithRevenueCat`), refund listing (`store.ts#rpcCheckRefunds`), subscription
  listing (`store.ts#rpcCheckSubscriptions`), restore-purchases history (`store.ts#rpcRestorePurchases`), and the webhook
  `SETNX` lock (`store.ts#rpcRevenueCatWebhook`).
- **Hash receipts via `sha256Hex`**, never `crypto.createHash` directly.
- **Write storage values through `backend/src/utils/storage-helpers.ts`**, passing objects,
  never raw JSON strings.

## Consequences

**Positive.** A contributor who greps for `goja` or `ADR-0008` reaches the constraints
directly, instead of a closed perf issue. The invariant is now discoverable from any one of
the ~40 call sites, and its *consequences* (why Redis fast-paths, RevenueCat verification,
refund listing and subscription listing are stubs) are explained rather than merely asserted.

**Negative / accepted.** Several production capabilities are knowingly degraded because the
runtime cannot express them: live RevenueCat server-side receipt verification, external
refund/subscription listing, and cross-instance Redis locks. Receipt uniqueness rests on
the `sha256Hex` fallback rather than a hard HMAC, and webhook idempotency rests on durable
storage dedup rather than `SETNX`. A **sync** HTTP and Redis layer is the only thing that
restores them; that work is tracked as a follow-up issue and is not attempted here. Until it
lands, do not treat those branches as live.

**Neutral.** PRs #1312 and #1317 stay closed — their approach is invalid under this
invariant, not merely unfinished. Re-open only against a sync-I/O design.

## Verification

The invariant is enforced mechanically at the registration seams, so a regression surfaces
as a thrown error rather than a hung RPC:

- `npm run lint` — `backend/src/utils/eslint-rules/` flags `async` handlers at the
  registration seams; the custom `n-plus-one-detection` rule and the bundle validator
  (`backend/scripts/validate-nakama-bundle.js`) are the adjacent gates.
- `npm test -- rateLimiter` and `npm test -- metrics` — assert that a non-string (async)
  handler result is rejected with a clear error.
- `npm run bundle:validate` — catches runtime-invalid constructs at build time.

## Amendment (2026-10-03, #1423 / #1416)

Constraint 2 overstated the limit on outbound HTTP. `fetch` is unavailable, but
`nk.httpRequest(url, method, headers?, body?, timeout?, insecure?)` is a
**synchronous** host call in the JS runtime (see nakama-common `index.d.ts`): it
returns `{code, body, headers}` directly with no Promise, so it satisfies the
sync-handler invariant. RevenueCat receipt validation, refund checks,
subscription checks and purchase restore now use it (`revenueCatRequest` in
`backend/src/modules/store.ts`). Receipt validation fails closed when no
RevenueCat key is configured or the call errors. Promise-based Redis (`ioredis`)
remains unreachable, as stated above.
