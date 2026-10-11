# SQL error audit (#1462)

First slice: all 13 executable SQL call sites in `gear_db.ts` now use a
synchronous wrapper. A driver exception logs a fixed operation identifier and
increments Nakama's native `db_errors_total{op}` counter before being rethrown.
The wrapper does not log SQL, parameters, user IDs or driver error text.
Metrics failures do not replace the original database failure.

Existing behavior is preserved: write helpers already return `success: false`
on SQL exceptions, and `rpcGenerateGear` already returns `DATABASE_ERROR` for a
failed insert. A regression test exercises that RPC through the real database
helper and verifies the error log and native metric. Read helpers still return
their existing empty/default fallback, now with an observable failure.

This does not finish #1462. Remaining direct SQL users at the audit snapshot:
analytics, cleanup_test_user, combat_system, match_replay, matchmaker,
notification_scheduler, notifications, notifications_rpc, player_rpc,
season_system, test_cleanup, and storage-helpers. Some already log and return
errors. Each requires a separate call-site review before changing semantics.
Read fallback removal and end-to-end RPC identifiers are also not delivered in
this slice. No database schema, migration or transaction changes.

The native metric API is documented by the official runtime interface pinned
for this repository's Nakama version:
https://github.com/heroiclabs/nakama-common/blob/v1.31.0/index.d.ts

Second slice: matchmaker's paged history/admin queries and match details use the
same observer. Those RPCs already return failure on SQL exceptions. The observer
now accepts their fixed RPC IDs and native logger; metrics carry both `op` and
`rpc` tags. No authorization, query filters, pagination or response changes.
Other modules and gear read-fallback semantics remain outstanding.

Third slice: analytics summary's durable event read now uses the SQL observer
with its fixed RPC ID and native logger. A SQL failure still returns the existing
failed summary response, never a successful empty summary. The catch no longer
logs driver error text. Regression tests verify the RPC failure, fixed error log
and one native metric, including when the metric API fails. Date bounds, event
filters, query limit and successful responses are unchanged. This does not cover
other modules or change gear read-fallback semantics.

Player-report enrichment audit: the match-detail lookup is optional and already
returns the report without details on a SQL failure. It now records a fixed
operation/RPC error log and native metric before that fallback. The prior warning
with driver text and match ID is removed. Tests preserve successful enrichment,
report fallback, and metric-failure behavior. Authorization and report ownership
are unchanged. This deliberately does not convert optional-detail failures into
a failed reports RPC or claim that the broader read-fallback issue is finished.

Draft for owner review: season-end recovery fails closed when the sentinel owner
SQL query, storage read or JSON parsing fails, or when the opening sentinel
cannot persist. A local five-player crash/retry probe on main 7fe9ab91 showed
that a failed SQL owner lookup was treated as absent state: a new generation
credited an already-completed player's coins from 8500 to 17000 and gems from
600 to 1200. This is a reproduced unit-level path, not evidence of a live
incident. The regression now requires a failed RPC and unchanged player balances
and sentinel token; reverting the production fix makes that regression fail.

This draft does not make the whole reward operation transactional. Per-player
completion-marker read failures, failures after a currency write but before its
marker, concurrent invocations, and captured-player-list drift still need
separate review. No reward amount, auth, schema, migration or transaction change.
Do not mark the draft ready or merge it without Alex's review.
### Notification control plane (Stage 1)

The seven notification RPC names stay unchanged. Their handlers now return strings synchronously per ADR-0008, using `notification_persistence.ts` and `notification_templates.ts`, with no Firebase Admin or timer import on this path. SQL failures propagate through `observedSqlQuery` with fixed RPC/operation labels and safe error responses; logs omit raw driver text and private parameters. Authenticated user IDs scope all reads and writes, including deletion and cancellation. Absent and foreign token/notification rows have identical unsuccessful responses. Registration rejects cross-user takeover of a globally unique device token atomically, without changing foreign metadata. Same-owner refresh remains allowed. An email-code verified transfer flow is follow-up scope and is not implemented here.

Preference reads use an atomic upsert; updates create defaults when needed and return success only after a row is persisted. Timezone names are checked against PostgreSQL's catalog, quiet-hour syntax and timestamp calendar values are validated, and input uses typed schemas. Persistence ceilings are 65,536 payload characters, 4,096 token/title/body/identifier characters, 128 app-version/timezone characters. These are protective database/RPC limits, not FCM delivery limits. Existing external/mobile consumers were not located in the repository, so compatibility still needs observation.

Scheduling success means a durable pending row with `notificationId`, not a sent push. Status preserves `{firebaseEnabled, registeredDevices}` but reports `firebaseEnabled:false`: Stage 1 does not initialize a transport or claim worker health. The legacy async Firebase/scheduler modules remain unchanged and outside the RPC dependency graph. Quiet-hour dispatch, fail-closed preference checks during dispatch, durable claims/retries, per-token outcomes, provider acceptance versus delivered acknowledgements, old pending-row cutover and worker deployment belong to Stage 2 and are not enabled here. No schema migration is included.
