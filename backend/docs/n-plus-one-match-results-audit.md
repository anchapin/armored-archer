# Match-Results Read Path: N+1 Audit (issue #1349)

Relates to postmortem PD-2026-04-12, Action Item A4, and
`backend/docs/N_PLUS_ONE_DETECTION.md` (detection capability).

## Scope and method

Audit of every SQL call site reachable from the match-results read path
(`match_results` table and the RPCs that serve match outcome data):
`backend/src/modules/player_rpc.ts`, `matchmaker.ts`, `match_replay.ts`,
`combat_system.ts`. Method: manual review of every
`observedSqlQuery`/`nk.sqlQuery` call site in those modules plus a run of the
static detector (`npm run detect-n-plus-one`, 252 files, 0 findings).

The static detector did NOT flag the hotspot below: it does not know the
`observedSqlQuery` wrapper, only direct driver calls. Wrapper-aware review is
required for this codebase.

## Findings

### 1. FIXED - `rpcGetPlayerReports` match-details enrichment (player_rpc.ts)

Reports were enriched with match details inside `reports.map(...)`: one
`SELECT ... FROM match_results WHERE match_id = $1` per report. N reports -> N
queries, exactly the pool-pressure amplifier from the 2026-04-12 incident.

Fix: collect the distinct match IDs, run a single parameterized
`WHERE match_id IN ($1, ..., $N)` query, index the rows by match_id, and join
in memory. Query count per request: O(N) -> O(1) (zero queries when no report
carries a match_id).

### 2. Not hotspots - other reviewed sites

- `match_replay.ts` (5 sites), `matchmaker.ts` (3 sites), `combat_system.ts`
  (1 site): all single-shot queries outside iteration - no N+1.
- In-loop query sites in `notification_scheduler.ts`,
  `notification_persistence.ts`, `notifications.ts`, `test_cleanup.ts`,
  `cleanup_test_user.ts`, `gear_db.ts` exist but are NOT on the match-results
  read path; they are out of scope for A4 and noted here for a future audit.

## Regression coverage

`backend/src/modules/__tests__/player_rpc.test.ts`:
"fetches match details for multiple reports in a single batched query (#1349)"
asserts exactly one `sqlQuery` call for 3 reports with match IDs plus one
without, with per-report details intact. The pre-existing error-path tests
(failed lookup, metrics failure) pass unchanged.
