# Path-scoped agent rules

These files are **extractions** of standards that already exist in the
repository's [AGENTS.md](../../AGENTS.md) (plus the ADRs and
[CONTEXT.md](../../CONTEXT.md) entries that AGENTS.md links to), split so that
an agent working on a given path sees only the standards that apply to it.

**`AGENTS.md` remains the single source of truth.** Nothing in this directory
introduces a new coding standard; every rule quotes or summarises an existing
`AGENTS.md` / ADR / `CONTEXT.md` statement and links back to it. When
`AGENTS.md` changes, the matching rule file must be updated in the same
change. If a rule file and `AGENTS.md` ever disagree, `AGENTS.md` wins.

## Why this directory (location evidence)

The repository's agent tooling demonstrably uses the `.claude/` configuration
root:

- `.claude/` already exists and holds the Claude Code skill packages this repo
  ships — `.claude/skills/godot-task/SKILL.md`, `.claude/skills/godogen/…`,
  `.claude/skills/gitnexus/…` — documented in
  [`.claude/skills/README.md`](skills/README.md) ("This directory contains the
  godogen AI game generation skills … godot-task … godogen").
- `AGENTS.md:181` names the agent-tooling directories of this repo: "Repo
  skills: `.agents/skills/godot-development` (plus `godot-task`/`godogen` in
  `.claude/skills/`)."
- `CONTRIBUTING.md:93` draws the same line: "Repo-local skills:
  `.agents/skills/<name>/SKILL.md` (e.g. `godot-development`). Claude-specific
  skills (mostly tool helpers): `.claude/skills/<name>/SKILL.md`."
- A repository-wide search found **no** other agent-tooling rules root: no
  `.cursor/`, no `.mdc` files, no `opencode`/`codex`/`aider`/`gemini`
  configuration, and no `.github/` rules directory (CI only reads
  `AGENTS.md`, via `make agents-md-check`).

So the path-scoped rule files live in `.claude/rules/`, the rules directory of
the one agent-tooling configuration root this repository demonstrably uses.
`.agents/skills/` stays the home of the repo-local *skill* packages; it is not
a rules loader.

## File format

Each rule file starts with a YAML front-matter block that scopes it to paths
(globs relative to the repository root):

```markdown
---
description: <one-line summary>
paths:
  - "backend/src/modules/**"
---
```

## Rule index

| File | Applies to | Main sources |
|------|------------|--------------|
| [`backend-rpc-handlers.md`](backend-rpc-handlers.md) | `backend/src/**` | AGENTS.md §TypeScript Code Style, §Architecture Notes; ADR-0002/0005/0007/0008; CONTEXT.md §Authority |
| [`backend-data-migrations.md`](backend-data-migrations.md) | `backend/data/**` | AGENTS.md §Database, §AI Agent-Assisted Development; `docs/db/MIGRATIONS.md` |
| [`godot-ui-scenes.md`](godot-ui-scenes.md) | `scenes/ui/**` | AGENTS.md §GDScript Code Style; ADR-0009; `CLAUDE.md` §Design System; `AI_INTEGRATION.md` |
| [`gameplay-combat.md`](gameplay-combat.md) | `autoloads/**`, `scenes/enemies/**`, `scenes/player/**`, `scenes/main.gd`, `data/campaigns.json` | AGENTS.md §GDScript Code Style, §Architecture Notes; ADR-0005/0007; CONTEXT.md §Authority |
| [`tests.md`](tests.md) | `test/**`, `backend/src/**/__tests__/**`, `backend/tests/**` | AGENTS.md §Testing Guidelines; `.gutconfig.json`; `test/suites/README.md` |
