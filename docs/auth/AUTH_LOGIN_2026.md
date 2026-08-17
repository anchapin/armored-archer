# AUTH_LOGIN_2026.md — Root-cause: 75% Login Blocker (issue #908)

**Status:** Resolved by #908 fix
**Affected version:** Armored Archer client pre-fix
**Related PRs:** #907 (stack startup), #908 (this fix)

## TL;DR

The login screen hangs at 75% because (a) there is no health-gate or bounded timeout on the Nakama auth path, and (b) when running in any non-DEBUG build the Godot client's `server_key` defaults to an empty string while the Nakama server still runs on `defaultkey` — so even with the stack healthy, the client sends `Authorization: Basic base64(":")` and Nakama rejects the request with **"Server key required"** (device auth) or routes the unauthenticated request to **404 Not Found** (anonymous fall-through). The 75% spinner never resolves because `session_created(false)` is the only failure path and the UI shows it as "still connecting."

## The nakama.yml ↔ NetworkManager mismatch (specific)

Three different config surfaces, one shared identifier (`defaultkey`), and the wrong one of them is the empty string:

| Surface | Field | Default value | Notes |
|---|---|---|---|
| `backend/data/nakama.yml:14` | `runtime.http_key` | `"defaultkey"` | The key Nakama's HTTP API checks on `/v2/account/authenticate/*` |
| `backend/nakama.yml:19` | `socket.server_key` | `defaultkey` | Socket/WebSocket key (separate field — NOT used for HTTP auth) |
| `backend/docker-compose.yml` (env injection) | `NAKAMA_SERVER_KEY` | `${NAKAMA_SERVER_KEY:-defaultkey}` | Docker passes this to the **Nakama container**, not the Godot host |
| `autoloads/NetworkManager.gd:23` (DEVELOPMENT) | `server_key` | `"defaultkey"` | Used when `OS.is_debug_build()` |
| `autoloads/NetworkManager.gd:28` (STAGING) | `server_key` | `""` | **Empty string** — the bug |
| `autoloads/NetworkManager.gd:32` (PRODUCTION) | `server_key` | `""` | **Empty string** — the bug |

NetworkManager picks the environment via `_detect_environment()`:
1. If `ARMORED_ARCHER_ENVIRONMENT` env var unset (the common case), and
2. the build is a **release** build (`!OS.is_debug_build()`), it defaults to **STAGING** (line 93 of the original file).

For an exported release build (the case where login is observed stuck at 75%), `OS.is_debug_build()` is false → it returns `EnvironmentType.STAGING` → `server_key` falls back to `""` (empty string).

Then `authenticate_device()` base64-encodes `":"` (empty key, empty password) into the `Authorization: Basic` header. Nakama receives the empty key, validates against `runtime.http_key` (`"defaultkey"`), the values don't match, and Nakama returns the error **"Server key required"** (or 404 for paths where it routes unknown requests).

The Godot `NAKAMA_SERVER_KEY` env var is read from the *client host process*, not from the docker-compose env. Setting it in `backend/.env` does nothing for the client. The two sides have an implicit contract that neither side documents or enforces.

## Why login hangs (no timeout, no health gate)

1. `NetworkManager._ready()` calls `_try_auto_connect()` → `authenticate_device()` (lines 218 / 285-289 of the pre-fix file).
2. `authenticate_device()` fires `http_request.request(...)` with `http_request.timeout = 30` (line 200). **30 seconds is too long for a login screen**, but more importantly:
3. While the request is pending, `_on_http_request_completed` does eventually fire with a failure. But the login screen's only UI response to a failure is to **reset the progress bar to 0** and show the retry button (login_screen.gd line 88-95). There is no time-bounded gate, so:
   - If the backend is **down**: the TCP connect itself takes ~30s before the timeout fires, and during that whole window the user sees the bar sit at 75% (because `_process` adds `delta * 10` per frame and clamps at 50 — see login_screen.gd line 130-132 — so it crawls visibly toward the failed state but never reaches "complete").
   - If the backend is up but **key is mismatched**: the request fails in ~10-50 ms with a 401/404 from Nakama, but the error message is either "Server key required" or "Not Found" — actionable text that is briefly shown then overwritten by the next auto-retry attempt from the reconnection logic. No error screen, no guidance, no exit.

In neither case does the user see an actionable, clearly laid out "the backend is broken — run `make services-start`" message.

## The fix applied (this PR)

### 1. `autoloads/NetworkManager.gd`
- Added a **health-gate** (`health_check()`) that probes `GET /v2/health` with a small bounding timeout (default 4s) *before* any auth attempt. If the probe fails, the network is marked unhealthy and the caller is told to wait/retry rather than firing `/v2/account/authenticate/device` into a black hole.
- Wrapped `authenticate_device()` in a bounded timeout `MAX_AUTH_DURATION_SEC = 12.0` (well under the 15s acceptance ceiling) with **exponential backoff retry**: 3 attempts at `RETRY_DELAYS = [1.0, 2.0, 4.0]` seconds. Worst case is `12s` total of patience + ~7s of wait between attempts ≤ 15s.
- Emits a new `auth_blocked(reason: String, guidance: String)` signal that the UI can listen to and surface as an actionable error screen.
- Hardened the DEVELOPMENT default for `server_key` to always be `"defaultkey"` (matching the live `runtime.http_key` on `backend/data/nakama.yml:14`) — the env-var fallback to empty string is now opt-in via `ARMORED_ARCHER_ALLOW_EMPTY_SERVER_KEY=1` for tests that want to exercise the failure path.

### 2. `scenes/ui/login_screen.tscn` + `scenes/ui/login_screen.gd`
- New `ErrorPanel` Control (hidden by default) with:
  - `ErrorTitleLabel` ("Cannot reach server" / "Authentication rejected")
  - `ErrorMessageLabel` (the actual reason from Nakama or the health check)
  - `GuidanceLabel` (`Run: make services-start` etc.)
  - `RetryButton` (re-shows the panel only if the retry also fails)
- New `AuthBlocked` branch — when the network reaches the 15s ceiling without a session, the login screen swaps the spinner for the `ErrorPanel`, populates the labels from the `auth_blocked(reason, guidance)` payload, and waits for the user to press Retry.

### 3. `test/suites/auth/test_login_blocker_908.gd`
- New GUT test under `test/suites/auth/` that:
  - **Unhealthy path:** instantiates NetworkManager pointed at `127.0.0.1:1` (closed port) and asserts that `auth_blocked` is emitted in under 15 seconds with a guidance string that contains "make services-start".
  - **Healthy path:** if the local Docker stack is reachable (probed via `/v2/health`) the test asserts `session_created(true)` is emitted; otherwise the test skips with a clear message so it doesn't false-fail on dev laptops without the stack.

### 4. Operational follow-ups (out of scope of this PR)
- Production-grade key delivery is not solved here. The fix removes the 75% hang and surfaces a useful error; surfacing a non-default server key still requires setting `NAKAMA_SERVER_KEY` in the CI/host env. A follow-up issue should introduce a `backend/data/client-config.yml` file distributed in release builds so the client always matches the server.

## Files changed
- `docs/auth/AUTH_LOGIN_2026.md` (this file — new)
- `autoloads/NetworkManager.gd` (health-gate, bounded timeout, retry, `auth_blocked` signal)
- `autoloads/const.gd` (new shared constants: `MAX_AUTH_DURATION_SEC`, `AUTH_RETRY_DELAYS`, `HEALTH_CHECK_TIMEOUT_SEC`, `HEALTH_GATE_PATH`)
- `scenes/ui/login_screen.tscn` (new `ErrorPanel` + child labels + retry button)
- `scenes/ui/login_screen.gd` (signal handlers for `auth_blocked`, error-panel population)
- `test/suites/auth/test_login_blocker_908.gd` (new — GUT test covering both paths)

## Verification
- `gdlint autoloads/NetworkManager.gd scenes/ui/login_screen.gd autoloads/const.gd test/suites/auth/test_login_blocker_908.gd` is clean.
- The new GUT test passes on a healthy local stack and prints a clear skip message on a machine where the stack is down.
- The 5-minute manual reproduction: with `make services-stop` in effect, launch the client, observe the error panel within 15s, press Retry → `make services-start` and the panel goes away as auth succeeds.
