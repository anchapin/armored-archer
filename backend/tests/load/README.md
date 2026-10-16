# Load Tests (k6)

k6 scenarios against the Nakama backend, run nightly by
`.github/workflows/load-test.yml` and on PRs that touch these files or the
workflow itself.

## Scenarios

| Scenario         | RPC(s)                                   | Default load |
| ---------------- | ---------------------------------------- | ------------ |
| `smoke`          | `health_check`                           | 2 VU / 30s   |
| `player_stats`   | `get_player_stats`                       | 20 VU / 30s  |
| `leaderboard`    | `get_leaderboard`                        | 20 VU / 30s  |
| `mixed_workload` | stats 50% / leaderboard 30% / health 20% | 30 VU / 60s  |

Thresholds: p95 < 100ms and error rate < 1% per scenario, gated by
`parse-load-test-results.js`. VU counts and durations are overridable with
`K6_VUS` / `K6_DURATION` per scenario run in the workflow; raise them to 2x
observed peak once real traffic data exists (track via #1351).

## Environment

Scenarios run against the same service containers used by backend integration
tests (Postgres + CockroachDB + Nakama with the game bundle built from the PR
code). There is no staging environment today (#1354 / #1357 are parked); if
one is stood up later, point `NAKAMA_BASE_URL` at it instead.

## Auth and seeded data

Auth mirrors the verified runtime flow:

1. `POST /v2/account/authenticate/device` with HTTP Basic auth
   (`server key` as username, empty password).
2. RPC calls `POST /v2/rpc/armored_archer/<id>` with a Bearer session token.
3. RPC payloads are JSON-encoded twice (the body is a JSON string containing
   the JSON payload).

Player stats live in Nakama **storage** (collection `player_stats`), not the
legacy SQL table. The workflow seeds three device-linked users plus matching
storage rows so `get_player_stats` exercises the real read path:

- users `00000000-0000-4000-8000-00000000000{1,2,3}`
- device ids `k6-loadtest-device-{1,2,3}` (linked in `user_device`)
- storage rows with default stats
  (`level 1, xp 0, stats {attack:10, defense:10, dodge:10, crit_rate:5}`)

## Running locally

Bring up the backend the same way CI does (see the `backend-integration-test`
job in `ci.yml`), then:

```bash
export NAKAMA_BASE_URL=http://localhost:7350
cd backend
export NAKAMA_SERVER_KEY=ci-test-server-key-do-not-use-in-production
k6 run --summary-export=smoke-results.json tests/load/scenarios/smoke.js
node tests/load/parse-load-test-results.js
```

`parse-load-test-results.js` reads `player-stats-results.json`,
`leaderboard-results.json`, and `mixed-workload-results.json`.
