---
phase: gilded_quest
plan: 04
type: execute
wave: 4
depends_on:
  - 03
files_modified:
  - res://assets/sprites/characters/
  - res://assets/backgrounds/
autonomous: true
requirements:
  - GAME-03
  - GAME-04
must_haves:
  truths:
    - "Character sprites use Gilded Quest color palette (royal blue, gold, emerald)"
    - "Backgrounds render with warm parchment base and proper depth layers"
    - "All visual assets properly referenced in game scenes"
  artifacts:
    - path: "res://assets/sprites/characters/"
      provides: "Updated character sprites"
    - path: "res://assets/backgrounds/"
      provides: "Atmospheric background images"
  key_links:
    - from: "Character scenes"
      to: "res://assets/sprites/characters/"
      via: "Sprite2D texture property"
      pattern: "texture = load(...)"
    - from: "Background nodes"
      to: "res://assets/backgrounds/"
      via: "Sprite2D texture property"
      pattern: "texture = load(...)"
---

<objective>
Create Visual Assets: Update character sprites and atmospheric backgrounds to match Gilded Quest aesthetic.
</objective>

<execution_context>
@/home/alex/.config/opencode/get-shit-done/workflows/execute-plan.md
@/home/alex/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/gilded-quest-03/03-SUMMARY.md

# Design System Reference
- Palette: Royal Blue (#0060ce), Gold, Emerald on warm parchment (#fdffda)
- Aesthetic: "Tactile Heroism" - warm, editorial, celebratory
- Backgrounds: Warm parchment base with depth through tonal layers
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Update character sprites for Gilded Quest aesthetic</name>
  <files>res://assets/sprites/characters/</files>
  <behavior>
- Sprites use warm color palette (parchment tones, royal blue accents)
- Hero character has gold/emerald highlights for legendary feel
- Consistent style across all character sprites
- Proper file format (WebP for compression) with appropriate settings
  </behavior>
  <action>
Update character sprites:
- Review existing sprite files in res://assets/sprites/characters/
- Apply color grading to match Gilded Quest palette (royal blue, gold, emerald)
- Add subtle paper/parchment texture overlay for tactile feel
- Ensure hero character has gold accent details
- Export as WebP with lossless or high quality
- Update sprite references in relevant scenes
  </action>
  <verify>
ls -la res://assets/sprites/characters/*.webp (or .png)
</verify>
  <done>Character sprites updated to Gilded Quest aesthetic</done>
</task>

<task type="auto">
  <name>Task 2: Create atmospheric backgrounds</name>
  <files>res://assets/backgrounds/</files>
  <action>
Create/update background assets:
- Main menu background: warm parchment base (#fdffda) with layered depth
- Gameplay backgrounds: Use surface hierarchy for depth (surface, surface_container, surface_container_low)
- Add subtle vignette effect at edges
- Backgrounds should support parallax if applicable
- Export as optimized WebP

Create background presets:
- main_menu: Full parchment with decorative border elements
- gameplay_forest: Green/tan earth tones with depth layers
- gameplay_arena: Neutral with warm lighting
  </action>
  <verify>
Backgrounds render correctly in all scenes with warm palette
</verify>
  <done>Atmospheric backgrounds created for all game scenes</done>
</task>

</tasks>

<verification>
[ ] Character sprites use Gilded Quest color palette
[ ] Backgrounds use warm parchment base with proper depth
[ ] All assets properly referenced in scenes
</verification>

<success_criteria>
GAME-03 (Character Sprites), GAME-04 (Backgrounds) implemented
</success_criteria>

<output>
After completion, create `.planning/phases/gilded-quest-04/04-SUMMARY.md`
</output>