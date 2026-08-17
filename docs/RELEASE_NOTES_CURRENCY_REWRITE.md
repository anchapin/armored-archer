# Currency rewrite release notes & deploy runbook (issue #904, item 4)

**Scope:** Coordinated cutover for the gold→coins currency rename (#866,
PR #886) and the underlying ledger unification (#860, PR #880).

**Read this before:** rolling out a client build that depends on the new
currency schema, or rolling back a server that has already written
coins-only records.

---

## TL;DR

- **Old client + new server = 0 coins display.** This is acceptable
  during the rollout window.
- **No rollback after coins-only writes.** Once the new server has
  written `coins` to `player_currency` records, rolling back the server
  to the pre-#866 build reads those records as `gold: undefined` and
  reports 0 coins to the old client. **Roll forward instead** (see
  recovery plan below).
- **Coordinated client + server deploy is the canonical pattern.** Both
  must be at the matching version before cutting over.

---

## Coordinated cutover checklist

Run these in order. Do not skip the freeze step.

1. **Freeze new client deploys.** No client build that talks to the new
   server lands while the server is mid-rollout. (Old client + new
   server = 0 coins, which is recoverable. New client + old server = the
   client reads `gold` keys the old server never writes, also 0 coins,
   also recoverable, but harder to diagnose.)
2. **Confirm both at the matching version.** Tag both builds with the
   same release version (`vX.Y.Z-currency`).
3. **Stage the server.** Deploy PR #886 to a staging environment and
   run the `spend_gems` integration test from
   `backend/tests/integration/spend_gems.test.ts` (see item 3 of #904).
4. **Stage the client.** Push the matching client build to a small
   internal cohort (e.g. 1% canary) and watch the `get_currency` RPC
   error rate + the 0-balance alert.
5. **Cutover in lockstep.** Roll server to production, then within the
   same maintenance window push the client canary to 100%. If either
   step fails, halt and consult the rollback section below — but
   remember: **once the new server has written `coins`, there is no
   safe server-side rollback.**

## Forward-only recovery plan (no rollback)

If something goes wrong after the new server has written `coins` to
`player_currency` records:

1. **Do NOT roll back the server.** Rolling back reads `gold:
   undefined` and the player sees 0 coins. The data is not lost — it
   is just under a key the old server does not read.
2. **Patch forward.** Ship a hotfix that teaches the *previous* server
   build to read both `gold` and `coins` (the same dual-read migration
   that already lives in the new build). Or, if the failure is in a
   downstream system (matching, season rewards), ship a fix in the new
   build chain.
3. **If the new server is the broken one and a forward patch will take
   more than ~30 minutes,** freeze the client and run a one-shot
   data-fix SQL: copy `coins` → `gold` on the affected accounts. This
   is a one-time read-only restoration; the new server will re-normalise
   the record on next write.
4. **Audit.** After recovery, run `verify_currency_ledger` (in
   `backend/scripts/`) against the affected window to confirm zero
   players have a non-zero `coins` and a zero `gold` that the rollback
   would have lost. Expected: 0 rows.

## Client-side display expectations during the window

| Client version | Server version | Player sees           |
| -------------- | -------------- | --------------------- |
| Old (pre-#866) | Old (pre-#886) | Normal (gold display) |
| Old (pre-#866) | New (#886+)    | **0 coins** (acceptable — old client reads `gold`, new server writes `coins` only) |
| New (#866+)    | Old (pre-#886) | **0 coins** (new client reads `coins`, old server still writes `gold`) |
| New (#866+)    | New (#886+)    | Normal (coins display) |

The 0-coin display is the canary signal: if you see it in production
for more than the rollout window, the coordinated cutover has failed —
re-check both build versions.

## Why no rollback-forward

The pre-#866 server reads the `gold` field on `player_currency`. The
post-#886 server writes only the `coins` field (with a lazy dual-read
that migrates `gold → coins` on first read). After the lazy migration
runs, the `gold` field is gone from the record. Rolling the server
back to pre-#886 means it reads `gold: undefined` and reports 0 to the
client. The data is not destroyed — it lives under `coins` — but the
old server cannot see it. A forward patch (or a one-shot SQL copy) is
the only path back to a clean state.

## Related artifacts

- `docs/decisions/RESPEC_DEBIT_2026.md` — respec debit confirmation
  (issue #904, item 1)
- `backend/src/modules/currency.ts` — `PLAYER_CURRENCY_COLLECTION`,
  `getCurrency`, `setCurrency` (the dual-read migration lives here)
- `backend/tests/integration/spend_gems.test.ts` — live-stack
  integration test (issue #904, item 3)
- PR #886 — server-side rename
- PR #880 — ledger unification (parent of #886)
- ADR-0001 — PRD amendment governance (decision-doc format)
