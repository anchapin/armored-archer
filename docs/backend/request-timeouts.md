# Request Timeouts and Cancellation (issue #1348)

Per-dependency timeout inventory for the HighLatency runbook
(`docs/runbooks/HighLatency.md`, postmortem PD-2026-04-12 action item A3).
Values below are the currently configured values, reviewed and approved by
the project owner on Oct 16, 2026 (issue #1348).

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
`logout()` additionally cancels any in-flight async RPC dispatch and clears
the fire-and-forget queue, so no request signed with the old session can
dispatch after teardown (issue #1348).

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
- Cancellation at session teardown: `test/suites/autoloads/test_network_manager.gd::test_logout_cancels_pending_async_rpcs`.
- RevenueCat timeout pin: `backend/src/modules/__tests__/store.test.ts` ("should pass the 5s timeout to nk.httpRequest for RevenueCat calls").
- 401-storm and recovery deadlock behaviour: `test/suites/autoloads/test_network_manager_401_storm.gd`.
- Hung-request behaviour under load: `backend/tests/load/scenarios/hung_request.js`
  (nightly via `load-test.yml`) fires the CI-only `diag_hang_probe` fixture
  (10s server-side hang) with a 3s client timeout, then asserts a normal RPC
  still succeeds - client timeout wins, no pile-up.
