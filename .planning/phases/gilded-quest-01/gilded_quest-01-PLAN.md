---
phase: gilded-quest
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - res://themes/gilded_quest_theme.tres
  - res://themes/styleboxes/button_normal.tres
  - res://themes/styleboxes/button_hover.tres
  - res://themes/styleboxes/button_pressed.tres
  - res://fonts/Plus_Jakarta_Sans.ttf
  - res://fonts/Be_Vietnam_Pro.ttf
  - res://themes/label_settings/display_large.tres
  - res://themes/label_settings/headline.tres
  - res://themes/label_settings/title.tres
  - res://themes/label_settings/body.tres
autonomous: true
requirements:
  - UI-01
  - UI-02
  - UI-03
must_haves:
  truths:
    - "Theme resource with all Gilded Quest color tokens exists and is applied to project"
    - "Custom fonts (Plus Jakarta Sans, Be Vietnam Pro) render correctly in all UI text"
    - "Buttons show correct normal/hover/pressed states with bubbly tactile appearance"
  artifacts:
    - path: "res://themes/gilded_quest_theme.tres"
      provides: "Central theme with color tokens"
    - path: "res://fonts/"
      provides: "Imported custom fonts"
    - path: "res://themes/label_settings/"
      provides: "Typography scale resources"
    - path: "res://themes/styleboxes/button_normal.tres"
      provides: "Button state styles"
  key_links:
    - from: "res://themes/gilded_quest_theme.tres"
      to: "Project Settings"
      via: "Theme property"
      pattern: "Window.Theme: Custom"
    - from: "Label nodes"
      to: "res://themes/label_settings/"
      via: "label_settings property"
      pattern: "$Label.label_settings = resource"
---

<objective>
Create UI Foundation: Theme resources, typography system, and button components following Gilded Quest design system.
</objective>

<execution_context>
@/home/alex/.config/opencode/get-shit-done/workflows/execute-plan.md
@/home/alex/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/gilded-quest-research/RESEARCH.md

# Design System Reference
- Palette: Royal Blue (#0060ce), Gold, Emerald on warm parchment (#fdffda)
- Fonts: Plus Jakarta Sans (display), Be Vietnam Pro (body)
- Key rules: No 1px borders, tonal layering, glassmorphism, bubbly buttons
- Corner radius: min DEFAULT (1rem = 16px), md (1.5rem = 24px), lg (2rem = 32px)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Theme resource with color tokens</name>
  <files>res://themes/gilded_quest_theme.tres</files>
  <action>
Create Theme resource with all Gilded Quest color tokens:
- surface: #fdffda (warm parchment)
- surface_container: #f6f3eb
- surface_container_low: #fcf9f1
- surface_container_lowest: #ffffff
- surface_container_high: #f0eee5
- primary: #0060ce (Royal Blue)
- primary_container: #6e9fff
- on_surface: #383833
- outline_variant: #bbb9b3
- secondary: Gold (#ffd700)
- tertiary: Emerald (#50c878)

Set as default theme in Project Settings.
  </action>
  <verify>
Check Project Settings -> General -> Display -> Window -> Theme: Custom (gilded_quest_theme.tres)
</verify>
  <done>Theme resource created and applied to project</done>
</task>

<task type="auto">
  <name>Task 2: Import fonts and create LabelSettings</name>
  <files>res://fonts/Plus_Jakarta_Sans.ttf, res://fonts/Be_Vietnam_Pro.ttf, res://themes/label_settings/display_large.tres, res://themes/label_settings/headline.tres, res://themes/label_settings/title.tres, res://themes/label_settings/body.tres</files>
  <action>
1. Download and import Plus Jakarta Sans and Be Vietnam Pro (OFL license)
2. Set Project Settings -> Rendering -> Textures -> Default Texture Filter = Linear
3. Create LabelSettings resources:
   - display_large: 56px (3.5rem), Plus Jakarta Sans, on_surface, outline_size 2, outline_color primary
   - headline: 28px (1.75rem), Plus Jakarta Sans, on_surface
   - title: 22px (1.375rem), Plus Jakarta Sans, on_surface
   - body: 16px (1rem), Be Vietnam Pro, on_surface
   - body_small: 14px (0.875rem), Be Vietnam Pro, on_surface
  </action>
  <verify>
Project Settings -> Rendering -> Textures shows Linear filter; LabelSettings resources exist in res://themes/label_settings/
</verify>
  <done>Fonts imported and LabelSettings created for all type scales</done>
</task>

<task type="auto">
  <name>Task 3: Create Button StyleBoxFlat components</name>
  <files>res://themes/styleboxes/button_normal.tres, res://themes/styleboxes/button_hover.tres, res://themes/styleboxes/button_pressed.tres</files>
  <action>
Create StyleBoxFlat resources for button states:
- button_normal: bg_color primary (#0060ce), corner_radius 24px (lg), shadow_color on_surface at 6%, shadow_size 20, shadow_offset (0, 4)
- button_hover: bg_color primary_container (#6e9fff), same corner radius and shadow
- button_pressed: bg_color primary, corner_radius 24px, no shadow (simulates press)
- Apply to Theme resource Button styles

Note: Inner-bottom shadow (bubbly effect) requires layered approach - create second StyleBoxFlat with primary_dim at bottom 4px as overlay.
  </action>
  <verify>
Button nodes in any scene show correct colors on normal/hover/press states
</verify>
  <done>All button states styled with bubbly tactile appearance</done>
</task>

</tasks>

<verification>
[ ] Theme resource loads in editor without errors
[ ] All 5 LabelSettings render correctly with custom fonts
[ ] Buttons show correct states: normal blue, hover lighter, pressed no shadow
</verification>

<success_criteria>
UI-01 (Theme Foundation), UI-02 (Typography), UI-03 (Buttons) all implemented
</success_criteria>

<output>
After completion, create `.planning/phases/gilded-quest-01/01-SUMMARY.md`
</output>