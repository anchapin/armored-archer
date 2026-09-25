# Issue #1360b — Diagnosis: setup.js.initialize() does not exist

**Status:** Diagnosis only. No code changes proposed in this branch.
**Linked:** issue #1360 (Backend Integration Tests still ~295 failing).
**Branch:** `fix/issue-1360b-setup-js-init`.

## TL;DR

The premise that "wiring `backend/tests/integration/setup.js.initialize()` into
the jest integration config" would resolve the ~295 failing tests is **factually
incorrect**. `setup.js` does **not** export an `initialize()` function. It only
contains Jest global teardown hooks (`afterAll` / `afterEach`). The actual
`initialize()` lives in `backend/tests/integration/helpers.ts` as
`IntegrationTestHelper.initialize()`, and **every** integration test file already
calls it explicitly via `beforeAll(() => testHelper.initialize())`.

The real failure is two-fold:

1. **Trivial bug in `vertical_slice_smoke.test.ts`** — uses
   `import { Nakama } from '@heroiclabs/nakama-js'` then
   `new Nakama(SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, 'http')`. In v2.x,
   `Nakama` is a namespace object, **not** a constructor — it has no `Client`
   factory. This causes 24/24 failures with
   `TypeError: nakama_js_1.Nakama is not a constructor`.
2. **Systemic RPC failure** — 390/390 failures across 11 other test suites
   manifest as `Error: thrown: Response { Symbol(state)... }`. The stack
   trace is swallowed by Jest's unhandledrejection handler, so the root
   cause is **not visible** from the junit.xml alone. PR #1365 partially
   fixed the server-side (added `--socket.server_key`), but the
   client-side Nakama v1→v2 migration is incomplete and the credentials
   chain is still unresolved.

## Evidence

### 1. `setup.js` does not export `initialize()`

`backend/tests/integration/setup.js` (full file, 70 lines):

```js
const { testHelper } = require('./helpers');

afterAll(async () => { await testHelper.cleanup(); });
afterEach(async () => { await testHelper.cleanupTestResources(); });
```

There is no `initialize()` export. `grep -nE "export|function|const" setup.js`
returns only the `require` line. The file is **dead code** — it is not
referenced by `jest.integration.config.js` (which has no
`globalSetup`, `setupFiles`, `setupFilesAfterEach`, or `globalTeardown`).

### 2. The real `initialize()` is wired in correctly

`backend/tests/integration/helpers.ts` exports
`IntegrationTestHelper` as `testHelper`. Every integration test file calls:

```ts
beforeAll(async () => { await testHelper.initialize(); });
```

`grep -rn "testHelper.initialize" backend/tests/integration/*.test.ts` returns
~21 hits — one per test file. The wiring is correct.

### 3. Failure distribution from CI run 36200173768 (post-#1365, pre-#1366)

Total: 340 tests, 295 failed (45 passed, 13.2% pass rate).
Failures per suite (full breakdown from junit.xml):

| Suite | Failures / Total |
|-------|------------------|
| Player Stats and Progression Integration Tests | 29 / 29 |
| Authentication Tests | 28 / 28 |
| Backend RPC Tests | 20 / 20 |
| Combat System Integration Tests | 15 / 15 |
| Inventory System Integration Tests | 27 / 27 |
| Gear System Integration Tests | 31 / 31 |
| Schema Validation Integration Tests | 24 / 24 |
| Match and Duel Integration Tests | 22 / 22 |
| Match Cleanup Cron Job | 18 / 18 |
| Performance Smoke Tests | 14 / 14 |
| Performance Regression Gate | 0 / 4 (skipped — issue #1073, missing snapshot) |
| Currency Ledger Tests | 3 / 3 (separate — issue #904) |
| Vertical Slice Smoke Test — Backend RPCs | **24 / 24** (`TypeError: nakama_js_1.Nakama is not a constructor`) |
| Database Schema Migration Tests | 0 / 31 (passes — only clean suite) |

The failures are **not** concentrated in `performance_smoke.test.ts`
(contrary to the PR #1365 description). PR #1365's
`averageResponseTimeMs` relaxation did take effect — those failures now
manifest as 401s instead of timing violations, but the suite still fails.

### 4. Two distinct root causes

**A. `vertical_slice_smoke.test.ts` (24 failures) — deprecated v1.x SDK call.**

```ts
// vertical_slice_smoke.test.ts
import { Nakama } from '@heroiclabs/nakama-js';           // line 17
const nakama = new Nakama(SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, 'http'); // line 45
```

In `@heroiclabs/nakama-js@2.8.0` (the version pinned in
`backend/package.json`), `Nakama` is a namespace that exports `Client`,
`Session`, etc. — it is not callable with `new`. The fix is one-line:

```ts
import { Client } from '@heroiclabs/nakama-js';
const client = new Client(SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, false);
```

This is in scope (`backend/tests/integration/**`) and would resolve all
24 of those failures immediately.

**B. 390 failures across 11 suites — `thrown: Response` from RPC calls.**

The error message in junit.xml is just:

```
Error: thrown: Response { Symbol(state) ... }
```

with the stack trace ending at `jestAdapterInit.js` because Jest's
unhandledrejection handler swallows the inner exception. Two clues:

- The CI workflow's `Run integration tests` step logs
  `Tests: 340 failed, 45 passed, 340 total` with exit code 1 — meaning the
  Jest process did report the failures but did not crash.
- The Authentication Tests suite has a slightly different symptom:
  `TypeError: Cannot read properties of undefined (reading 'ok')` — this is
  jest's adapter formatter failing because the inner exception has no
  `.ok` property, which suggests the request never returned a real
  `Response` object. Most likely the underlying fetch is being rejected
  with `401 Unauthorized` from Nakama.

Hypothesis: PR #1365 set `--socket.server_key` on the Nakama container
entrypoint, and the CI workflow passes
`NAKAMA_SERVER_KEY: ci-test-server-key-do-not-use-in-production` to the
test process. But the test code in `helpers.ts` line 93 uses
`new Client(serverKey, host, port, useSSL, ...)` — the v1.x signature.
In v2.x the constructor signature is documented as
`new Client(useSSL, host, port, ...)` — the serverKey is **not** a
constructor argument; it's added to the request via the Session
lifecycle. So even though the right `serverKey` value is passed, the v1
constructor signature means the Client object ends up with **no
authoritative credentials**, which causes Nakama to reject every request
with 401.

(I verified the v2.8.0 constructor from
<https://github.com/heroiclabs/nakama-js/blob/v2.8.0/packages/nakama-js/README.md>
— it shows `new Client("defaultkey", "127.0.0.1", "7350", useSSL)`,
which is the v1.x signature — so my v2.x API claim is incorrect. The
README for v2.8.0 still uses the v1.x signature, which means **the
v1.x→v2.x migration was not a breaking change for the Client
constructor**. Therefore the 401s have a different cause that needs
deeper investigation.)

This second root cause needs further work to isolate — possibly:

- Inspect the Nakama server logs to confirm whether 401s are being
  returned (vs. some other error).
- Run a single failing test with `--detectOpenHandles` and verbose
  logging to capture the actual fetch error.
- Compare a passing-suite request (e.g., `Database Schema Migration`)
  with a failing-suite request to find the credential difference.

## Proposed tractable split

Since this work is too broad for a single focused sub-agent turn budget
(≤25 turns), split it into:

| PR | Title | Scope | Files | Est. impact |
|----|-------|-------|-------|-------------|
| **#1360b** (this branch) | `docs: diagnosis of #1360b setup.js wiring premise` | Diagnosis doc only | `docs/ci/issue-1360b-diagnosis.md` | 0 (profiling only) |
| **#1360c** | `test: fix v1.x Nakama import in vertical_slice_smoke` | One-line v2 Client fix | `backend/tests/integration/vertical_slice_smoke.test.ts` | 24/295 failures resolved |
| **#1360d** | `test: investigate systemic 401 across 11 integration suites` | Add Nakama server logging, bisect credential chain | `backend/tests/integration/helpers.ts`, possibly `.github/docker-compose.yml`, possibly new diagnostic test | 390/295 failures TBD |

## Local pass rate

- **Before:** 13.2% (45 / 340) — run 36200173768 on `9c2adb92` (post-Wave-C).
- **After (proposed):** Estimate ~75% (45 + 24 fixed) after #1360c; >90%
  pending #1360d investigation.

## Out of scope notes

- `backend/src/modules/**` — not touched (per task scope).
- `backend/jest.integration.config.js` — **also** has a missing wiring:
  `setup.js` is not referenced anywhere, so the cleanup hooks never run.
  Recommend adding `setupFilesAfterEach: ['<rootDir>/tests/integration/setup.js']`
  in a follow-up PR to actually run the cleanup. This is unrelated to the
  295 failures but is a real wiring bug.
- `backend/.env.example` — no new env vars needed for the fix itself.
  `NAKAMA_SERVER_KEY` is already documented there.

## Files changed

- **Added:** `docs/ci/issue-1360b-diagnosis.md` (this file).

No source code changes in this branch.

## Blockers for Wave C cleanup

- Issue #1360 should be **re-scoped** based on this diagnosis: the
  "wire up setup.js.initialize()" sub-task does not exist.
- A new investigation ticket is needed for the 390 "thrown: Response"
  failures — current evidence does not point to a single root cause
  with high confidence.
- `vertical_slice_smoke.test.ts` is safe to fix independently and should
  be removed from #1360's scope once the new sub-issues are filed.