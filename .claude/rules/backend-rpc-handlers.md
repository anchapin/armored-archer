---
description: Backend RPC and handler rules — synchronous handlers, valibot validation, server authority
paths:
  - "backend/src/modules/**"
  - "backend/src/**/*.ts"
---

# Backend RPC / handler rules (Nakama, TypeScript)

> **Extraction, not new policy.** Every rule below is a quote or a summary of a
> statement that already exists in [`AGENTS.md`](../../AGENTS.md) (the source of
> truth) or in an ADR/CONTEXT.md entry linked from it. Nothing here adds a new
> coding standard. If this file and `AGENTS.md` ever disagree, `AGENTS.md` wins
> and this file is the one that must be fixed.

## 1. RPC handlers must be synchronous

> **AGENTS.md:165** — "**RPC handlers must be synchronous.** The Nakama JS
> runtime (goja) has no microtask queue, so an `async` handler returns a
> Promise Nakama rejects ("returned a non-string result") or that never
> settles. No outbound HTTP or promise-based Redis on an RPC path either. See
> [`docs/adr/0008-nakama-js-runtime-sync-handler-invariant.md`](../../docs/adr/0008-nakama-js-runtime-sync-handler-invariant.md)
> before adding or wrapping any RPC."

- Do not mark an RPC entry point `async`; do not `await` inside it, and do not
  return a Promise to Nakama.
- Read ADR-0008 before adding or wrapping **any** RPC
  ([`docs/adr/0008-nakama-js-runtime-sync-handler-invariant.md`](../../docs/adr/0008-nakama-js-runtime-sync-handler-invariant.md)).
- `backend/src/utils/eslint-rules/` flags `async` handlers (ADR-0008, "the
  enforcement" note) — `npm run lint` fails on a violating handler.

## 2. Validate every input with `valibot`

> **AGENTS.md:139** — "`\"strict\": true`; interfaces for data structures, enums
> for fixed sets; validate input with **`valibot`** (canonical — see
> `backend/src/modules/validation.ts`). `zod` is a legacy holdover in
> `xp_manager.ts`; don't introduce new `zod` imports."

- Canonical validation module: `backend/src/modules/validation.ts`.
- Do not introduce new `zod` imports; `zod` survives only as a legacy holdover
  in `xp_manager.ts`.

## 3. The server is authoritative — never trust client input

> **AGENTS.md:141** — "Server-authoritative: never trust client input; combat
> results and loot are computed server-side from stored stats."

> **CONTEXT.md §Authority → Server Authority** — "The principle that all combat
> results, loot rolls, and match outcomes are computed from server-stored
> stats. Client-reported values are, at most, sync hints."

- Client-reported values are sync hints at most; re-derive every result
  server-side from stored stats.
- Supporting ADRs (read the relevant one before touching combat-authority or
  settlement code — **AGENTS.md:164**):
  [ADR-0002](../../docs/adr/0002-server-declared-match-settlement.md),
  [ADR-0005](../../docs/adr/0005-combat-authority-boundary.md),
  [ADR-0007](../../docs/adr/0007-ratify-combat-authority-boundary.md).
- Use the CONTEXT.md vocabulary verbatim (**AGENTS.md:46**): "Server
  Authority", "Match Settlement". `_Avoid_` anti-terms (e.g. "server-side
  validation" for the principle) must not be introduced as if they were the
  ratified term.
- `RPC_MAP.md` is the authoritative per-RPC reference — update it whenever
  RPCs change (**AGENTS.md:45**).

## 4. Code-style rules that apply to handlers

> **AGENTS.md:139-142** — "`\"strict\": true`; interfaces for data structures,
> enums for fixed sets"; "ESM `import` syntax. Tests must match `*.test.ts`";
> "`async/await` with try/catch around DB ops; log via winston; never leak
> internals in client-facing errors."

- Strict TypeScript, interfaces for data shapes, enums for fixed sets.
- ESM `import` syntax only.
- `async/await` is allowed for **non-RPC-path** DB work, wrapped in
  try/catch, logged via winston; client-facing errors must not leak internals.
- The Nakama bundle has a size budget enforced by `make bundle-size-check`
  (**AGENTS.md:166**).
