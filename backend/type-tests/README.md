# Nakama method-name contract (#1463)

The normal `npm run typecheck` checks the runtime method subset and the shared
partial mock's supported keys, then compiles negative fixtures. No network is needed in CI.

`src/types/nakama-api-methods.ts` records the `Nakama` interface's method names
from Heroic Labs nakama-common v1.31.0. Nakama v3.21.1, currently pinned by
`backend/docker-compose.yml`, depends on that version:

- https://github.com/heroiclabs/nakama/blob/v3.21.1/go.mod
- https://github.com/heroiclabs/nakama-common/blob/v1.31.0/index.d.ts

When upgrading the server, read its go.mod and regenerate the method-name union
from the matching official interface's TypeScript AST: collect each method name,
deduplicate and sort, then replace the union. Review that diff and its
source/version comment together with the Compose image pin.
Do not add a local method to the official union to silence a type error.

This is a method-name gate, not full signature or complete mock API parity.
The shared mock intentionally implements only the APIs its tests need. Existing return-value and
parameter adapters remain, including legacy leaderboard array fixtures. Real
Nakama integration tests remain necessary for signatures and runtime behavior.
