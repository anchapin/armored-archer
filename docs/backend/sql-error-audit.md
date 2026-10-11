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
