---
description: Godot UI scenes and scripts — no game-state ownership, SafeArea handling, design tokens
paths:
  - "scenes/ui/**"
  - "scenes/ui/components/**"
---

# Godot UI scenes & scripts

> **Extraction, not new policy.** Every rule below quotes or summarises a
> statement that already exists in [`AGENTS.md`](../../AGENTS.md) (source of
> truth), in an ADR it links to, or in a companion document `AGENTS.md`
> explicitly points at. Nothing here adds a new coding standard. If this file
> and `AGENTS.md` disagree, `AGENTS.md` wins.

## 1. UI scripts do not own game state

> **ADR-0009 — "Combat state ownership boundary"**
> ([`docs/adr/0009-combat-state-ownership-boundary.md`](../../docs/adr/0009-combat-state-ownership-boundary.md)):
> "New **live-session presentation** state goes in CombatSyncManager; new
> **RPC-result echo** state goes in CombatManager. **No third combat-state
> holder.**" / "Neither manager may add a field the other owns. Shared concepts
> stay per-path mirrors; they are never synced between the two managers." /
> "A consumer binds to the holder for the path it lives on: live-duel HUD
> elements bind to CombatSyncManager; flows that need server-confirmed state
> after an action read CombatManager."

- A UI scene/script is a **consumer**: bind to the existing holder
  (`CombatSyncManager`, `CombatManager`, `GameManager`, …) instead of keeping
  your own copy of health, turn flag, or match state.
- Do not introduce a new state holder in `scenes/ui/`; if the ownership of a
  field is ambiguous, the change stops and ADR-0009 is amended first
  (ADR-0009, boundary rule 3).
- The server remains the single source of truth for every combat value
> ([ADR-0002](../../docs/adr/0002-server-declared-match-settlement.md),
> [ADR-0005](../../docs/adr/0005-combat-authority-boundary.md)); read the
  relevant ADR before touching duel, settlement or combat-authority code
  (**AGENTS.md:164**).

## 2. Talk to other modules through signals

> **AGENTS.md:132** — "Prefer signals over direct node calls for cross-module
> communication."

> **AGENTS.md:133** — "Safety: `get_node_or_null()`, `has_method()` before
> calling unknown nodes, `push_error()`/`push_warning()`, `queue_free()` for
> cleanup."

## 3. Safe-area handling goes through `SafeAreaManager`

> **AI_INTEGRATION.md:47** — "Apply SafeAreaManager for safe area handling."
> (`AI_INTEGRATION.md` is the workflow/tooling companion that **AGENTS.md:181**
> points at: "Workflow and tooling: `AI_INTEGRATION.md`".)

- Route safe-area insets through the `SafeAreaManager` autoload instead of
  hard-coding notch/status-bar offsets per scene.
- Layout rules from the same source: "Use appropriate anchors", "Use
  containers (VBoxContainer, HBoxContainer) for layout", "Ensure touch targets
  are minimum 48x48 dp" (AI_INTEGRATION.md:44-48).

## 4. Design tokens and base components, not hard-coded values

> **CLAUDE.md:91-102** — "The project has a design system for UI components
> located in `scenes/ui/components/`" (`base_button.gd`, `base_container.gd`,
> `base_label.gd`, `base_panel.gd`, `base_progress_bar.gd`, `base_icon.gd`,
> `loading_indicator.gd`, `theme_toggle.gd`); "Design tokens are defined in
> `autoloads/ArcherDesignTokens.gd` and include spacing, colors, typography,
> and other UI constants." (`CLAUDE.md` is the companion guide AGENTS.md:181
> points at: "Companion guide: `CLAUDE.md` (autoload map, design system,
> tooling notes)".)

> **AI_INTEGRATION.md:40-42** — "Use ArcherDesignTokens autoload for all
> colors, spacing, typography"; "Reference existing components in
> `scenes/ui/components/` for patterns"; "Support both dark/light themes using
> ArcherDesignTokens helper functions".

- Colours, spacing and typography come from `ArcherDesignTokens`
  (autoload) / the theme; do not hard-code literals in a scene script.
- Prefer the existing `scenes/ui/components/` base components over a new
  bespoke widget.

## 5. GDScript style that applies to UI scripts

> **AGENTS.md:128-131** — "`snake_case` functions/variables, `PascalCase`
> files/scenes/classes, `UPPER_SNAKE_CASE` constants, `_` prefix for privates,
> past-tense signal names"; "Explicit type hints everywhere in production code";
> "`@export` for Inspector-tunable values, `@onready` to cache node refs,
> `const X = preload(...)` for scene preloads".

> **AGENTS.md:43** — "`*.uid` files next to `.gd`/`.tscn` are Godot-generated —
> never hand-edit."
