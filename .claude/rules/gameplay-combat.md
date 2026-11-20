---
description: Gameplay and combat code — data-driven values, ObjectPool usage, delta-time behaviour
paths:
  - "autoloads/**"
  - "scenes/enemies/**"
  - "scenes/player/**"
  - "scenes/main.gd"
  - "data/campaigns.json"
---

# Gameplay & combat code (Godot client)

> **Extraction, not new policy.** Every rule below quotes or summarises a
> statement that already exists in [`AGENTS.md`](../../AGENTS.md) (source of
> truth), in an ADR it links to, or in an existing implementation pattern the
> links point at. Nothing here adds a new coding standard. If this file and
> `AGENTS.md` disagree, `AGENTS.md` wins.

## 1. Gameplay values are data-driven

> **AGENTS.md:131** — "`@export` for Inspector-tunable values, `@onready` to
> cache node refs, `const X = preload(...)` for scene preloads."

> **AGENTS.md:135** — "Constants shared by 3+ files go in `autoloads/const.gd`.
> Start new scripts from `script_templates/`."

- Tunables belong in exported inspector fields or in the shared constant module
  (`autoloads/const.gd`), not in scattered literals inside behaviour code.
- Stage/enemy tuning is data, not code: `data/campaigns.json` carries the
  stage definition (`"enemy": {"health": 30, "attack": 8, "defense": 2,
  "speed": 10}` for stage `1_1`), and the gameplay code reads it — the offline
  stage harness asserts this contract ("active enemy differs from
  configured1_1 archetype/stats", `test/smoke/smoke_stage.gd`).
- The server-side counterpart of the same rule is ratified in
  [ADR-0007](../../docs/adr/0007-ratify-combat-authority-boundary.md): "The
  canonical home for combat/damage-math constants is
  `backend/src/modules/combat_constants.ts`" — one place, changed through that
  artefact.

## 2. Pool frequently spawned objects

> **AGENTS.md:134** — "Pool frequently spawned objects (arrows, popups) via the
> `ObjectPool` autoload; add cleanup timers to projectiles."

> **AGENTS.md:133** — "Safety: … `queue_free()` for cleanup."

- Arrows, damage popups and other high-frequency spawns come from the
  `ObjectPool` autoload (`CLAUDE.md`: "`ObjectPool` | Object pooling for
  performance"), not from `instantiate()` at the call site.
- Projectiles get a cleanup timer so a pooled instance cannot leak.

## 3. Time-based behaviour is driven by the frame delta

- The existing gameplay implementation passes the engine delta into the
  physics callback and scales motion with it — e.g.
  `func _physics_process(delta: float) -> void:` in
  `scenes/enemies/scout_enemy.gd`, `scenes/enemies/brute_enemy.gd`,
  `scenes/enemies/tank_enemy.gd`, … and `autoloads/EnemyAIManager.gd`. Keep
  that pattern: time-based behaviour scales with `delta`, it is not counted in
  frames.
- Delta-driven behaviour is what makes a run reproducible: the offline demo
  harness runs with `--fixed-fps 60` (see
  [`docs/dev-offline-demo-seeded-replay.md`](../../docs/dev-offline-demo-seeded-replay.md)),
  so a fixed delta plus a pinned RNG seed yields the same run twice — which is
  the precondition for the before/after replay diff of a gameplay change.

## 4. Combat results are server-authoritative

> **AGENTS.md:141** — "Server-authoritative: never trust client input; combat
> results and loot are computed server-side from stored stats."

> **CONTEXT.md §Authority → Server Authority** — "The principle that all combat
> results, loot rolls, and match outcomes are computed from server-stored
> stats. Client-reported values are, at most, sync hints."

> **AGENTS.md:164** — read the relevant ADR "before touching duel, settlement,
> combat-authority, or admin-gate code":
> [ADR-0005](../../docs/adr/0005-combat-authority-boundary.md) (broad
> combat/reward boundary) and
> [ADR-0007](../../docs/adr/0007-ratify-combat-authority-boundary.md)
> (damage-math constants layer).

- The client submits action intents; the server computes and returns every
  result value (ADR-0005). Client-side code must not assert a combat outcome
  or a reward.
- Use the CONTEXT.md vocabulary verbatim (**AGENTS.md:46**) — e.g. "Server
  Authority", "Match Settlement", "Difficulty Modifier"; respect the
  `_Avoid_` anti-terms.

## 5. GDScript style that applies to gameplay code

> **AGENTS.md:128-130** — "`snake_case` functions/variables, `PascalCase`
> files/scenes/classes, `UPPER_SNAKE_CASE` constants, `_` prefix for privates,
> past-tense signal names"; "Organize with `# --- Section Name ---` dividers;
> comment a method's purpose above it"; "Explicit type hints everywhere in
> production code".
