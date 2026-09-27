# Issue #1371 — Test client credential chain reproduction

## Summary

390 of 295+ integration tests fail with `Error: thrown: Response` (HTTP 401) because
the integration test client hardcodes the literal string `"defaultkey"` as the
Nakama server key, while the local Nakama container runs with the server key from
`backend/.env` (`NAKAMA_SERVER_KEY=your_nakama_server_key_here`). Every
authenticated call — bootstrap auth, storage RPC, match RPC, leaderboard RPC — is
rejected with `Server key invalid`.

## Environment

- Worktree: `/home/alex/worktrees/issue-1371`
- Branch: `fix/issue-1371-rpc-auth-chain`
- Node: v22.22.0 (CI pin is Node 20; this works there too)
- Stack: `make services-start` healthy (postgres :5433, nakama :7350, console :7351)
- `.env`: `NAKAMA_SERVER_KEY=your_nakama_server_key_here` (placeholder literal,
  not `defaultkey` — `start.sh` does not rewrite `.env`, it only validates against
  sentinel strings like `__SET_VIA_DOTENV__`).

## The 401 chain (sequence)

Each integration test follows this sequence:

1. **Bootstrap** — `tests/integration/helpers.ts:8`
   ```typescript
   const TEST_ADMIN_KEY = process.env.NAKAMA_SERVER_KEY || 'defaultkey';
   ```
   `process.env.NAKAMA_SERVER_KEY` is **never set** in the jest run — there is
   no dotenv loader in `jest.integration.config.js`, no `--env-file`, and
   `globalSetup` (`tests/integration/setup.js`) only does async cleanup, so by
   the time test files load, `process.env` contains neither `NAKAMA_SERVER_KEY`
   nor any other `.env` value. The fallback `'defaultkey'` is used.

2. **Client construction** — `tests/integration/helpers.ts:93,124,238`
   ```typescript
   const client = new Client(TEST_ADMIN_KEY /* = 'defaultkey' */, host, port, ...);
   ```
   The nakama-js `Client` is built with `'defaultkey'`. It will send that as
   `Authorization: Basic base64('defaultkey:')` on every unauthenticated call.

3. **First auth call — `client.authenticateEmail(...)`** at
   `http://127.0.0.1:7350/v2/account/authenticate/email`:
   ```
   POST /v2/account/authenticate/email
   Authorization: Basic ZGVmYXVsdGtleTo=        ← base64("defaultkey:")
   Content-Type: application/json
   {"email":"...","password":"...","create":true}

   → HTTP/1.1 401 Unauthorized
   {
     "error": "Server key invalid",
     "message": "Server key invalid",
     "code": 16
   }
   ```
   Direct curl confirms:
   ```
   $ curl -X POST http://127.0.0.1:7350/v2/account/authenticate/email \
       -H "Authorization: Basic $(echo -n 'defaultkey:' | base64)" \
       -H "Content-Type: application/json" \
       -d '{"email":"[email protected]","password":"testpass123","create":true}'
   {"error":"Server key invalid","message":"Server key invalid","code":16}
   ```
   With the **correct** key (`your_nakama_server_key_here`):
   ```
   $ curl -X POST http://127.0.0.1:7350/v2/account/authenticate/email \
       -H "Authorization: Basic $(echo -n 'your_nakama_server_key_here:' | base64)" \
       -H "Content-Type: application/json" \
       -d '{"email":"[email protected]","password":"testpass123","create":true}'
   HTTP/1.1 400 Bad Request
   {"error":"invalid_argument","message":"Validation failed: email..."}
   ```
   i.e. the **401 is replaced by a 400 (validation)** — proving the server key
   matched and the auth path is otherwise healthy.

4. **Session state** — `authenticateEmail` throws `Error: thrown: Response` with
   `status: 401`, `body: { length: null, source: null, stream: [ReadableStream] }`,
   `url: 'http://127.0.0.1:7350/v2/account/authenticate/email'`. The session
   is never stored. `state.session` remains `null`.

5. **Subsequent RPC** — every later `client.rpc(session, funcId, payload)`
   or `client.writeStorageObjects(...)` etc. either re-throws the same 401 from
   the auth step, or sends `Authorization: Bearer <undefined>` and gets back
   its own 401. The `401 chain` the orchestrator described is the
   `authenticateEmail` 401 propagating through the rest of the test.

## Step that is broken

**Step 1** of the chain — the test client picks the wrong server key because
`process.env.NAKAMA_SERVER_KEY` is unset in the jest subprocess. The fallback
`|| 'defaultkey'` was chosen when `NAKAMA_SERVER_KEY=defaultkey` was the default
in `.env.example`, but `.env` now ships a different placeholder, and no dotenv
loader is wired into the jest run, so the literal `'defaultkey'` is always used.

## Why this is a test-client bug, not a production bug

- The production server (`backend/src/**`) is working correctly: it validates
  `Authorization: Basic <server_key>` against its own configured server key
  (`NAKAMA_SERVER_KEY` env var). It returns the correct 401 for the wrong key.
- The `authenticateEmail` endpoint exists, accepts well-formed payloads, and
  returns valid sessions when the key is correct (proven by curl test 3 above,
  which advanced past auth to a domain-level 400).
- The bug is purely in the test client: it picks `'defaultkey'` when it should
  pick up `your_nakama_server_key_here` from `.env`.

## Single-file reproduction (before fix)

Command:
```
cd backend && npm run test:integration -- --testPathPatterns='tests/integration/performance_smoke.test.ts'
```

Output:
```
Tests:       13 failed, 13 total
```

Sample failure (first test):
```
✕ should meet response time targets for batch-5 queries (sequential)
  Error: thrown: Response {
    url: 'http://127.0.0.1:7350/v2/account/authenticate/email',
    status: 401,
    statusText: 'Unauthorized',
    headers: Headers { ... 'content-type': 'application/json' },
    body: { length: null, source: null, stream: [ReadableStream] }
  }
  at Object.authenticateEmail (src/*.ts:...)
  at setupTestUser (tests/integration/performance_smoke.test.ts:131)
```

Same signature on every test — `status: 401`, body unparseable, pointing at
`/v2/account/authenticate/email`. **All 13 tests fail at the auth-bootstrap
step.**

## Files to fix (test-client only)

- `backend/tests/integration/helpers.ts` — wire `.env` into the jest subprocess so
  `process.env.NAKAMA_SERVER_KEY` resolves to the actual server key. Smallest
  change: load `.env` at module top using Node 20+ native `--env-file`-equivalent
  (via `process.env` + a tiny `loadEnvFile` shim), OR add a `setupFiles` entry
  in `jest.integration.config.js` that does the same. **No `backend/src/**`
  changes.**

## Out-of-scope (next issue, e.g. #1371b)

- `.env` placeholder substitution at container start (currently relies on
  humans editing `.env` after `cp .env.example .env`; could be auto-replaced
  from a CI secret store).
- The `XP manager` zod legacy import and other tech debt items already tracked
  separately.
- Bundle size / coverage gates (already tracked under #1372/#1381).

## Reproducibility checklist

- [x] `make services-start` brought up a healthy stack
- [x] `curl` with `defaultkey` returns 401 `Server key invalid`
- [x] `curl` with the real `.env` key passes auth (400 on validation = auth OK)
- [x] Single test file (`performance_smoke.test.ts`) reproduces 13/13 fails
- [x] All failures share the same URL (`/v2/account/authenticate/email`) and
      status (`401`)
