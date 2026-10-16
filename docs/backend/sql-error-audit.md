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
notifications_rpc, player_rpc,
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

Scheduling success means a durable pending row with `notificationId`, not a sent push. Status preserves `{firebaseEnabled, registeredDevices}` but reports `firebaseEnabled:false`: Stage 1 does not initialize a transport or claim worker health. The legacy async Firebase/scheduler modules were removed when Firebase was decommissioned; push delivery remains unimplemented. Quiet-hour dispatch, fail-closed preference checks during dispatch, durable claims/retries, per-token outcomes, provider acceptance versus delivered acknowledgements, old pending-row cutover and worker deployment belong to Stage 2 and are not enabled here. No schema migration is included.

### Inventory read failure contract

`get_inventory` now supplies a strict read context to the existing gear database
helpers. SQL exceptions in gear, loadout or modifier-pool reads produce a
`DATABASE_ERROR` RPC response, never a successful empty inventory. Each failed
query records one safe error log and one native `db_errors_total{op,rpc}` metric.
A genuinely absent inventory remains successful. The RPC reads modifier pools
once instead of twice. Other callers retain their prior fallback semantics;
reward, equip, combat, optional enrichment and replay behavior are not changed.
This is another slice of #1462, not its completion. No schema change.

### PvP match owner lookup

The shared `readPvpMatch` SQL owner lookup now records safe errors and native
`db_errors_total{op,rpc}` metrics for submit-combat-action, get-match-state,
player-disconnect, accept-match and complete-match. The owner query, participant
checks and creator-owned storage reads are unchanged. SQL exceptions still
produce the existing unsuccessful/not-found RPC response, not an empty success;
this slice makes that failed lookup observable rather than changing the error
contract. Tests verify fixed tags, no private driver/parameter logging, no extra
storage read after failure, and the get-match-state RPC failure response. Metric
API failure does not change the failed lookup. Other SQL users and gear fallback
semantics remain outside this slice; #1462 is not complete.

### Combat match-result persistence

The match-results insert now uses the SQL observer with fixed operation and
calling RPC tags for health-zero settlement, timeout auto-forfeit and player
disconnect. Those paths already return `PERSIST_FAILED` and withhold completion
notifications when persistence fails; that client contract is unchanged. The
helper now returns a fixed failure reason instead of driver text, so downstream
logs and audit records do not copy private database details. Regression coverage
checks the existing failed response and audit alongside native metrics and safe
logging, including an unavailable metrics API. No query, settlement sequencing,
reward, participant-check, schema or transaction change is included. Remaining
SQL users and broader read fallback semantics still need review for #1462.

### Campaign-progress boss read

`get_campaign_progress` now opts into a strict boss-defeat read. A SQL exception
produces the existing `INTERNAL_ERROR` RPC response instead of a successful
empty `bosses_defeated` array. The SQL observer records fixed operation/RPC tags
and one native metric; the RPC catch no longer logs driver text. Actual empty
boss rows remain successful, and the SQL query, storage read, stage/chapter
calculation and authentication are unchanged. Other callers of the shared boss
helper keep their prior fallback until reviewed separately. Cleanup and legacy
notification modules, plus other gear-read callers, remain outside this slice.

### Test cleanup hardening (owner-approved scope)

`cleanup_test_user` is gated by the existing exact
`TEST_FIXTURE_RPCS_ENABLED=true` test-bundle opt-in at both registration routes
and in the handler. It must never be enabled for a real deployment. An
authenticated caller can clean their own user only; a cross-user request needs
the existing server-side admin allowlist. Missing caller identity, empty or
broken allowlists and disabled opt-in fail closed before deletes.

Cleanup now uses synchronous Nakama host calls, not fire-and-forget promises.
Success means all existing storage and SQL deletes completed and reports
`async:false`. Any delete failure returns `cleanup_failed`; other deletes are
still attempted, so a failed response can mean partial cleanup, not rollback.
SQL failures record fixed RPC/operation logs and native metrics without driver
text. The target collections/tables and queries are unchanged. No migration,
new flag, allowlist/config change, deployment or other endpoint change is part
of this patch. The unused legacy `test_cleanup.ts` remains outside this slice.

### Unlocked-modifier read contract

`get_unlocked_modifiers` now supplies a strict read context for modifier pools,
defeated-boss IDs and each boss's defeat count. Any SQL exception returns
`DATABASE_ERROR`, not a successful empty pool list or zero count. Fixed
RPC/operation error logs and one native metric identify the failed query
without driver details. Actual empty results and context-free helper callers'
prior fallback remain unchanged. The query sequence, user scope, validation
and successful response shape are unchanged; no write, reward, auth, schema or
transaction change. Other gear-read paths and legacy modules remain outside
this slice; #1462 is not complete.

### Equip/unequip SQL failure contract

`equip_gear` and `unequip_gear` use strict SQL contexts for their initial reads,
item verification, existing loadout mutation and readback. A SQL exception returns
safe `DATABASE_ERROR` with fixed RPC/operation logs and a native metric, not a
successful empty loadout or a misleading item/slot absence. Context-free helper
callers keep their prior result/fallback behavior. Actual missing item/slot and
type mismatch responses, queries, ownership checks, validation, successful data
and non-SQL audit sequence are unchanged. SQL failures no longer copy driver
text into a failed-write audit, and readback failure no longer records success.

A readback failure after a successful mutation can mean the loadout already
changed. This patch does not add rollback or atomicity, and does not retry a
write. It withholds success and fabricated loadout data. No reward, combat,
authentication, schema or deployment changes. Other gear readers and legacy
modules remain outside this slice; #1462 remains open.

### Manual modifier unlock

`unlock_modifier_pool` supplies strict SQL context for the existing unlock check,
insert and pool readback. Each SQL error logs fixed RPC/operation labels and one
native metric, then returns the existing safe `INTERNAL_ERROR` failure. Readback
errors no longer report successful empty pools. Failure audit records contain a
fixed reason, not driver text. The other boss/enemy unlock helper callers retain
their prior behavior. Queries, validation, ownership scope, successful response,
already-unlocked handling and manual unlock reason are unchanged.

A readback failure after insertion can mean the pool is already unlocked. This
slice does not add rollback, atomicity or write retries. No auth, reward policy,
schema or deployment changes. Other gear callers and legacy modules still need
review; #1462 remains open.

### Manual gear generation

`generate_gear` supplies strict SQL context to its initial modifier-pool read,
gear insert and full inventory readback. SQL errors return safe `DATABASE_ERROR`
and fixed failure-audit text rather than success with empty inventory or gear
rolled against a failed pool read. Each failed query records fixed RPC/operation
logs and one native metric. Context-free insert helper callers retain their
existing failure result. Queries, generation/drop policy, successful response,
validation and user scope are unchanged.

Readback failure can follow an already completed gear insert. This is not a
rollback, transaction or write retry, and a failed response does not prove no
gear was added. Other reward/combat/boss callers and legacy modules remain
outside this slice; #1462 is still open.

### Stage-completion inventory read

The normal `stage_complete` reward path supplies strict SQL context to its
inventory read (gear, loadout and modifier pools) before loot insertion and XP.
A SQL failure returns the existing safe `INTERNAL_ERROR` rather than completing
against an empty fallback inventory. Fixed RPC/operation logs and one native
metric identify the failed query; the stage catch and failure audit no longer
copy private exception text. Successful rewards, queries, user scope and the
claim-first sequence are unchanged. Context-free inventory callers, including
combat, keep their previous fallback for separate review.

A failure can follow the existing claim and best-of stage-completion writes.
The claim remains consumed, so an immediate replay is rejected; this patch adds
no rollback, transaction or write retry. Boss/modifier writes, boss verification,
no-improvement pool reads and other gear paths remain separate follow-up scope.

### Stage-completion boss record SQL

The stage reward path passes strict RPC context through `recordBossDefeat` to
`recordBossDefeatInDB`. Failure of the existing defeat-count SELECT or boss
upsert now stops completion through the safe stage error handler rather than
returning a zero-count result and continuing rewards. The SQL observer emits
fixed operation/RPC diagnostics and one native counter. Context-free helper
callers keep the previous result contract; successful first/repeat defeats and
modifier/XP processing are unchanged.

The claim and best-of completion writes precede the boss SQL and stay consumed
on failure. There is no write retry or rollback. An upsert error does not prove
that no database write occurred. Pool unlock failures, empty upsert returns,
boss verification reads and enemy unlocks remain separate audit scope.

### Stage-completion modifier pool writes and boss audit read

The strict stage context also covers boss/enemy modifier unlock checks and
inserts, plus the boss audit's all-pools read. SQL failure stops the reward path
through the safe stage error rather than being ignored or recorded as successful
boss progress. Context-free boss helper callers retain their previous fallback.
Successful unlocks and reward calculations are unchanged.

Claim, best-of completion and boss-record writes can already have happened; for
the boss audit read failure, a pool insert can also already be complete. They
are not rolled back, and immediate replay remains rejected by the consumed
claim. No retries or transaction are added. Boss verification, empty upsert
returns, no-improvement pool reads and combat paths remain separate audit scope.

### No-improvement stage replay pool read

The no-improvement response reads modifier pools with strict stage RPC context
before recording a successful terminal outcome. SQL failure uses the existing
safe stage error/audit, fixed SQL diagnostics and native metric rather than an
empty-success pool list. Real empty/nonempty rows preserve the no-loot/no-XP
success response. The claim is already written and stays consumed on failure;
immediate retry remains rejected. No completion update, reward, rollback or
write retry is added. Boss verification and other gear callers remain separate.

### Stage boss verification read

The existing boss-verification query carries strict stage RPC context. SQL
failure stops the remaining XP/success response through the safe stage error,
with fixed diagnostics and a native counter, rather than consulting the
fallback after an empty-on-error result. Successful empty/nonempty query results
preserve the existing verification decisions and boss-count fallback.

This read is late in the existing sequence. Claim, best-of, boss and pool writes
can be complete; loot can already have been inserted and boss audit/analytics
can already have run. This is not a rollback or a claim that no reward was
written. XP is not written after this failure and immediate retry remains
rejected. No query reorder, write retry or verification-policy change is added.

### Combat initialization inventory reads

New combat-state initialization passes the calling RPC's strict SQL context to
both players' inventory reads. `get_match_state` and `submit_combat_action`
return a safe `DATABASE_ERROR` if initialization fails, before action processing
or state writes, rather than using empty-on-error gear bonuses. SQL observer
logs/counters carry fixed operation and RPC labels. Existing persisted match
states still bypass fresh inventory reads, and empty inventories remain valid.
No damage formula, participant gate, reward, settlement or query scope changes.

### Stage loot insert exhaustion (owner-approved gameplay decision)

Stage loot keeps the existing three insert attempts. Each thrown SQL attempt
logs/meters fixed stage RPC/operation tags; warnings and failure audits no longer
copy driver text. Exhausted attempts, including missing returned item IDs, now
fail completion through the safe stage handler instead of reporting successful
stage/XP with a loot error. Successful retry and reward behavior are unchanged.

Earlier claim, best-of, boss and pool writes can remain. The claim rejects an
immediate retry, and the retained best-of record can make a later non-improving
retry a no-loot/no-XP success. This makes failure visible, not recoverable or
transactional: no claim clearing, rollback, reconciliation or new retry is added.

### Replay terminal catch diagnostics

Replay RPCs already fail safely with SQL operation/RPC logs and native metrics.
Their shared terminal catch now logs only its fixed failure message instead of
copying driver error text and caller ID after the safe observer. Tests inspect
all catch/observer log arguments, not just the observer subset, across all five
handlers and unavailable native metrics. No query, response, admin gate or
replay behavior changes.

### Context-free gear read catch diagnostics

Six legacy gear read helpers retain their existing empty/null/zero/false
fallbacks when called without strict RPC context. Their secondary catch logs
now use fixed text only, rather than copying driver errors after the SQL
observer already emitted safe diagnostics. Strict-context callers still
rethrow. Each query failure still attempts one native operation-tagged counter,
even if metrics are unavailable. Queries, scope, return values and rewards do
not change. Legacy async notification/cleanup paths and empty boss-upsert
semantics remain separate review scope; #1462 is not finished.

### Unconfirmed boss upsert result (owner-approved stage failure)

A strict stage boss upsert must return a row with a defeat count. An empty
RETURNING result or missing/null count now enters the existing safe stage
failure instead of reporting a guessed boss count and granting unlocks/XP.
A fixed diagnostic identifies the failed confirmation; it is not a thrown SQL
exception and does not increment the SQL-driver error counter. Successful
first/repeat defeat processing and legacy context-free helpers are unchanged.

Earlier claim and best-of completion writes remain consumed. No subsequent
pool unlock, loot or XP runs, no rollback is added, and lack of a returned row
does not prove a database write did not commit. Recovery/reconciliation remains
deferred in #1558. This does not close the remaining #1462 audit.

### Context-free gear write error values

Legacy gear write helper failures now carry fixed error values, not raw driver
text. Failed insert, loadout verification/update, unequip, boss record and pool
unlock keep their unsuccessful result shape and existing fallback flags/counts.
Strict active RPC callers still rethrow through their existing safe handlers.
The SQL observer still records one operation-tagged counter attempt and safe
log per failed query, including metric outages. Queries, scope, retries and
successful writes are unchanged. No legacy module is enabled or registered.

### Legacy notification scheduler SQL diagnostics

The four SQL sites in the legacy async scheduler use the synchronous host-call
observer for fixed operation-tagged logs and native counter attempts. Secondary
catch logs contain fixed text, not SQL/provider exceptions or caller/event IDs.
The module stays async, keeps its existing resolved-void failure fallback, and
remains outside the active RPC dependency graph. No scheduler is started, no
notification is sent by this change, and no Stage 2 dispatch or auth is added.
The observer covers real synchronous Nakama SQL throws, not a future async
SQL provider. Legacy notifications and obsolete test cleanup remain separate.

### Legacy notification read diagnostics

The device-token read, preference read/default insert and pending-notification
read now use the synchronous host SQL observer. Fixed secondary diagnostics
exclude driver text and user IDs. Empty-array/null fallbacks and default
preference creation are unchanged, as is the legacy default-true behavior of
`shouldSendNotification` after a null preference result. The observer covers
synchronous Nakama host throws, not future async SQL providers. This module
remains outside the active RPC graph; no Firebase, dispatch or scheduler is
enabled. Seven legacy notification writes and obsolete test cleanup remain.

### Legacy notification write diagnostics

The remaining seven SQL write sites now use the synchronous host observer and
fixed secondary error logs. Five existing failure results keep `success: false`
with fixed operation text instead of driver text. History and sent-status
helpers retain their existing resolved-void failure fallback. Queries,
parameters, retries, success results and async behavior are unchanged. Existing
provider error-message columns remain unchanged; their stored values are not
logged by these SQL catches. No notification dispatch or registration is added,
and the module remains outside the active RPC graph. Obsolete test cleanup
remains separate. This slice does not close the broader audit.

### Obsolete test-cleanup diagnostics

The unreferenced `test_cleanup.ts` module now observes synchronous SQL host
throws using fixed operation/RPC tags. SQL/storage secondary failure logs omit
driver text. Its existing async/delete scope/continue-on-error/success fallback
are deliberately unchanged. It remains outside the entry-point dependency
graph and is not registered or enabled by this slice. This is not the guarded,
synchronous active `cleanup_test_user` handler and must not replace it. Future
async SQL providers are not covered by the observer. The legacy success result
still does not prove all deletes succeeded. No authorization or registration
change is included, and the broader audit remains open.

### Match-query terminal catch diagnostics

History, details and admin-query RPCs already fail on SQL exceptions with
operation/RPC metrics. Their terminal catches now log fixed text only, rather
than copying driver text, caller IDs and filters after the observer. Count and
page failure tests inspect all error/warning arguments, including metric outages.
Query text, parameters, response shapes, pagination and admin gates are unchanged.
The broader audit remains open; direct SQL observation alone does not establish
that every caller's failure semantics or all post-write recovery is finished.

### Direct runtime SQL regression guard

A TypeScript syntax-tree test scans runtime source, excluding tests, mocks and
declarations. Direct statically named `sqlQuery`, `sqlExec` and obsolete `dbQuery`
calls are rejected outside the shared observer; its one direct `sqlQuery` is
pinned. Dot, string-literal bracket and optional calls are covered. Comments,
strings and method declarations are not calls. This is not alias/data-flow
analysis or a proof against computed/dynamic API access. No workflow, required
check, production code or threshold changes are included.

At this snapshot all direct production SQL calls pass through the observer.
That does not close #1462: context-free legacy fallbacks, optional report
enrichment, and late-write/recovery limitations remain documented above.
Recovery in #1558 remains deferred. A green scanner is not proof that every
caller returns a failed RPC or that earlier writes have been rolled back.
