---
phase: gilded-quest
plan: 02
type: execute
wave: 2
depends_on:
  - 01
files_modified:
  - res://themes/styleboxes/panel_card.tres
  - res://themes/styleboxes/panel_surface.tres
  - res://themes/styleboxes/panel_modal.tres
  - res://shaders/ui/glassmorphism.gdshader
  - res://themes/gilded_quest_theme.tres
autonomous: true
requirements:
  - UI-04
  - UI-05
  - UI-06
must_haves:
  truths:
    - "Layouts use tonal color shifts instead of 1px borders"
    - "Modals display frosted glass effect with backdrop blur"
    - "Cards support asymmetric element placement with intentional overlap"
  artifacts:
    - path: "res://themes/styleboxes/panel_surface.tres"
      provides: "No-line surface container"
    - path: "res://shaders/ui/glassmorphism.gdshader"
      provides: "Glassmorphism shader for modals"
    - path: "res://themes/styleboxes/card_asymmetric.tres"
      provides: "Card style supporting asymmetry"
  key_links:
    - from: "Modal panels"
      to: "res://shaders/ui/glassmorphism.gdshader"
      via: "material_override property"
      pattern: "$Panel.material_override = shader"
---

<objective>
Create UI Advanced: No-line layout system, glassmorphism for modals, and card components with intentional asymmetry.
</objective>

<execution_context>
@/home/alex/.config/opencode/get-shit-done/workflows/execute-plan.md
@/home/alex/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/gilded-quest-01/01-SUMMARY.md
@.planning/phases/gilded-quest-research/RESEARCH.md

# Design System Reference
- No 1px borders - use tonal layering for depth
- Surface hierarchy: surface -> surface_container -> surface_container_low -> surface_container_lowest
- Ghost border: outline_variant at 15% opacity for empty slots only
- Modals: xl corner radius (3rem = 48px), glass effect with backdrop blur
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create No-Line Layout StyleBoxFlats</name>
  <files>res://themes/styleboxes/panel_card.tres, res://themes/styleboxes/panel_surface.tres</files>
  <action>
Create StyleBoxFlat resources for no-line layout:
- panel_surface: bg_color surface_container (#f6f3eb), corner_radius 16px, no border
- panel_card: bg_color surface_container_lowest (#ffffff), corner_radius 16px, shadow on_surface at 6%, shadow_size 12, shadow_offset (0, 2)
- Use tonal color shifts (surface_container inside surface) for "carved" effect

Add to Theme resource under Panel styles.
  </action>
  <verify>
Panel nodes show tonal layering instead of borders
</verify>
  <done>Layout system uses volume not borders</done>
</task>

<task type="auto">
  <name>Task 2: Create glassmorphism shader for modals</name>
  <files>res://shaders/ui/glassmorphism.gdshader</files>
  <action>
Create glassmorphism shader with:
- uniform sampler2D screen_texture: hint_screen_texture, filter_linear_mipmap
- uniform float blur_amount: hint_range(0.0, 10.0) = 3.0
- uniform vec4 glass_color: source_color with 80% opacity
- uniform float corner_radius: 48px (xl)
- Use fragment() to sample screen behind with blur, mix with glass_color
- Add rounded rect mask to match xl corner radius

Create panel_modal StyleBoxFlat with bg_color surface_container_lowest at 80% opacity, corner_radius 48px.
  </action>
  <verify>
Modal panels show frosted glass effect with parchment bleeding through
</verify>
  <done>Glassmorphism shader implemented for modal overlays</done>
</task>

<task type="auto">
<name>Task 3: Create card components with intentional asymmetry</name>
  <files>res://themes/styleboxes/card_asymmetric.tres</files>
  <action>
Create card StyleBoxFlat that supports asymmetric layout:
- base StyleBoxFlat with surface_container_lowest, corner_radius 16px
- Document pattern for asymmetric icon placement (slight overlap top-left)
- Use spacing tokens (8/12/16/20/24) for visual breathing room

Create example Card scene showing asymmetric layout with icon overlap.
  </action>
  <verify>
Card components show intentional asymmetry in layout
</verify>
  <done>Cards support asymmetric design pattern</done>
</task>

</tasks>

<verification>
[ ] Panel layouts use tonal shifts, no 1px borders
[ ] Modals show glassmorphism with backdrop blur
[ ] Cards support asymmetric element placement
</verification>

<success_criteria>
UI-04 (No-Line Layout), UI-05 (Glassmorphism), UI-06 (Cards) all implemented
</success_criteria>

<output>
After completion, create `.planning/phases/gilded-quest-02/02-SUMMARY.md`
</output>