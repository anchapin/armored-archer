# Request Timeouts and Cancellation (issue #1348)

Per-dependency timeout inventory for the HighLatency runbook
(`docs/runbooks/HighLatency.md`, postmortem PD-2026-04-12 action item A3).
Values below are the currently configured values; per the issue they are
documented pending review.

## Client (Godot) -> Nakama

| Concern | Value | Source |
| --- | --- | --- |
| HTTP request nodes (auth/session, RPC, probe) | 30 s | `autoloads/NetworkManager.gd` `_make_http_request_node` (`node.timeout = 30`) |
| RPC call outer timeout (per-call, caller-overridable) | 30 s default | `autoloads/NetworkManager.gd` `send_rpc(rpc_id, payload, timeout = 30.0)` |
| Generic request timeout constant | 10 s | `autoloads/const.gd` `REQUEST_TIMEOUT` |
| Bounded auth flow (outer timer, raises `auth_blocked`) | 12 s | `autoloads/const.gd` `MAX_AUTH_DURATION_SEC` (issue #908) |
| Health-gate probe | 4 s | `autoloads/const.gd` `HEALTH_CHECK_TIMEOUT_SEC` (issue #908) |

Cancellation: each concern has a dedicated HTTPRequest node (issue #1108) and
in-flight requests are cancelled via `cancel_request()` before replacement
(auth probe, session isolation paths).

## Nakama runtime -> RevenueCat REST

| Concern | Value | Source |
| --- | --- | --- |
| Receipt verification / refund API calls | 5 s | `backend/src/modules/store.ts` `REVENUECAT_HTTP_TIMEOUT_MS = 5000`, passed to `nk.httpRequest(...)` |

`nk.httpRequest` is synchronous in the goja runtime (the Go host performs the
request), so the timeout is enforced host-side per call. See #1423.

## Nakama runtime -> Postgres

No explicit `statement_timeout` is configured; queries run with the driver and
server defaults. If A5 (#1350, pool tuning) lands, consider adding a
`statement_timeout` so client timeouts (above) always fire before queries
stack up behind an exhausted pool - that ordering is what A3's acceptance
criterion asks to be verified.

## Verification status

- Client RPC timeout behaviour: `test/suites/autoloads/test_network_manager.gd::test_send_rpc_timeout`.
- Cancellation before replacement: `test/suites/autoloads/test_network_manager_rpc_session_isolation.gd`.
- 401-storm and recovery deadlock behaviour: `test/suites/autoloads/test_network_manager_401_storm.gd`.
- Hung-request behaviour under load: NOT covered - the load-test workflow is
  currently disabled and its scenario files are absent from main (#1347).
  This is the remaining acceptance gap for A3.
