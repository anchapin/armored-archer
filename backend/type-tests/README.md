# Nakama method-name contract (#1463)

The normal `npm run typecheck` checks the runtime method subset and the shared
mock's exact keys, then compiles negative fixtures. No network is needed in CI.

`src/types/nakama-api-methods.ts` records the `Nakama` interface's method names
from Heroic Labs nakama-common v1.31.0. Nakama v3.21.1, currently pinned by
`backend/docker-compose.yml`, depends on that version:

- https://github.com/heroiclabs/nakama/blob/v3.21.1/go.mod
- https://github.com/heroiclabs/nakama-common/blob/v1.31.0/index.d.ts

When upgrading the server, read its go.mod and regenerate the method-name union
from the matching official interface:

```sh
cd backend
node scripts/generate-nakama-methods.cjs /path/to/official/index.d.ts
```

The generator reads the TypeScript AST, deduplicates and sorts all method names.
Review that diff and the source/version comment together with the Compose image pin.
Do not add a local method to the official union to silence a type error.

This is a method-name gate, not full signature parity. Existing return-value and
parameter adapters remain, including legacy leaderboard array fixtures. Real
Nakama integration tests remain necessary for signatures and runtime behavior.
