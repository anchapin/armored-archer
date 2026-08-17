# Schema Test Config — Why A Dedicated `jest.schema.config.js`?

## TL;DR
`npm run test:schema` used to be a **vacuous pass**. The script pointed
jest at `tests/integration/schema.test.ts`, but the main `jest.config.js`
restricted `roots` to `<rootDir>/src` and enabled `passWithNoTests: true`.
Jest matched zero tests and exited green, giving CI a false sense of
schema coverage.

This issue was filed as [#893](https://github.com/anchapin/armored-archer/issues/893)
during the [#858](https://github.com/anchapin/armored-archer/issues/858)
wave-orchestration session (PR #889, 2026-08-16).

## The Three Jest Configs

The backend now uses **three** jest configs side-by-side, each scoped to a
single concern:

| Config                          | Roots                                | Triggered by                          | Requires                              |
|---------------------------------|--------------------------------------|---------------------------------------|---------------------------------------|
| `jest.config.js`                | `<rootDir>/src`                      | `npm test`, `npm run test:watch`, …   | Nothing (unit tests)                  |
| `jest.integration.config.js`    | `<rootDir>/src`, `<rootDir>/tests`   | `npm run test:integration`            | Nakama + Postgres                     |
| `jest.schema.config.js`         | `<rootDir>/src`, `<rootDir>/tests`   | `npm run test:schema`                 | Postgres only                         |

Wider `roots` would risk pulling in build artifacts, mocks, or test
helpers that are not intended to be exercised by every test command — so
each command keeps its own narrowly-scoped config rather than the main
config being widened.

## Why `test:schema` Got Its Own Config

- **Different runtime prerequisites.** `tests/integration/schema.test.ts`
  only needs Postgres. The other tests in `tests/integration/` need a
  running Nakama server. Sharing `jest.integration.config.js` would drag
  Nakama into a job that previously needed only a database container —
  which would have broken the CI job (Postgres-only) that calls
  `test:schema`.
- **No `passWithNoTests`.** Both `jest.integration.config.js` and the
  new `jest.schema.config.js` deliberately omit `passWithNoTests: true`.
  The main `jest.config.js` keeps `passWithNoTests: true` for backward
  compatibility with the existing unit-test suite — changing that flag
  globally would risk masking unrelated regressions and is intentionally
  out of scope for this fix.
- **Tighter `testMatch`.** `testMatch` is scoped to
  `tests/integration/schema.test.ts` so unrelated tests never sneak
  in if someone adds new files alongside it.

## How To Run Locally

The CI flow that runs `npm run test:schema` looks like:

1. Bring up Postgres on `localhost:5432` (or override the port via
   `TEST_DB_PORT`; CI uses 5437 to avoid clashing with the local dev
   stack on 5433).
2. Apply migrations from `backend/data/*.sql`.
3. Run `npm run test:schema`.

Local example:

```bash
cd backend
TEST_DB_HOST=localhost TEST_DB_PORT=5433 \
  TEST_DB_USER=postgres TEST_DB_PASSWORD=localdbpassword \
  TEST_DB_NAME=nakama npm run test:schema
```

## How To Verify The Fix Has Teeth

```bash
cd backend
# 1. Sanity: schema test actually runs and reports a non-zero count.
TEST_DB_HOST=localhost TEST_DB_PORT=5433 \
  TEST_DB_USER=postgres TEST_DB_PASSWORD=localdbpassword \
  TEST_DB_NAME=nakama npm run test:schema -- --listTests
# Expected: backend/tests/integration/schema.test.ts

# 2. Introduce drift: rename a table in a migration.
sed -i 's/CREATE TABLE player_stats/CREATE TABLE player_stats_broken/' \
  data/001_create_player_stats.sql

# 3. Test must now FAIL with a non-zero exit code.
TEST_DB_HOST=localhost TEST_DB_PORT=5433 \
  TEST_DB_USER=postgres TEST_DB_PASSWORD=localdbpassword \
  TEST_DB_NAME=nakama npm run test:schema
echo "exit=$?"
# Expected: exit=1, with at least one "player_stats" assertion failing.

# 4. Revert.
git checkout -- data/001_create_player_stats.sql
```

## See Also

- Issue #893 — original report
- `backend/DATABASE_SCHEMA.md` — schema documentation
- `.github/workflows/ci.yml` — `schema-validation` job (Postgres-only,
  no Nakama)