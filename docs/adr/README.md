# Architecture Decision Records

This directory holds the ratified architecture decisions for Armored Archer. Each ADR captures **why** a particular choice was made, not just what the code does — the code is in `backend/src/modules/`, `autoloads/`, and `scenes/`; the rationale is here.

ADRs follow the MADR-flavored format used in ADR-0004: `Status`, `Date`, `Issue`, `Context`, `Decision`, `Consequences`. Cross-references to other ADRs are explicit and live in the ADR text, not in this index.

## Index

| ADR | Title | Status | Date | Issue(s) |
|-----|-------|--------|------|----------|
| [0001](./0001-prd-living-promises-governance.md) | PRD is a living promises document, not frozen MVP scope | Accepted | ratified 2026-08 | — |
| [0002](./0002-server-declared-match-settlement.md) | Match settlement is server-declared only | Accepted | 2026-08 | — |
| [0003](./0003-hybrid-duel-model.md) | Duels are hybrid: async matchmaking, live short-session combat | Accepted | 2026-08 | — |
| [0004](./0004-decommission-legacy-duel-rpcs.md) | Decommission legacy correspondence duel RPCs | Accepted | 2026-08-17 | #903 |
| [0005](./0005-combat-authority-boundary.md) | Combat authority boundary | Accepted | 2026-08-18 | #1153, #1087, consolidating #1068, #1076, #1078 |
| [0006](./0006-admin-gate-allowlist-policy.md) | Admin-gate allowlist policy | Accepted | 2026-08-18 | #1153, #1075, #1155, #1077 |

## Adding a new ADR

1. Pick the next number (`0007` after this batch lands).
2. Filename: `NNNN-kebab-case-title.md`.
3. Use the ADR-0004 format. The minimum is `Status`, `Context`, `Decision`, `Consequences`; `Date`, `Issue`, `Supersedes`, and `Related ADRs` should also be present.
4. Add a row to the table above.
5. Cross-reference any ADR you supersede or rely on.
6. Ratified vocabulary lives in [`CONTEXT.md`](../../CONTEXT.md); use its terms verbatim and respect its `_Avoid_` anti-terms.

## Authority

Per AGENTS.md §"Architecture Notes": PvP/combat decisions are recorded as ADRs in `docs/adr/`. Per ADR-0001, when an ADR contradicts an earlier PRD or runbook statement, the ADR wins and the earlier document is amended.
