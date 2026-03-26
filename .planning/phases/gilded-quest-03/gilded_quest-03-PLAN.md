---
phase: gilded_quest
plan: 03
type: execute
wave: 3
depends_on:
  - 02
files_modified:
  - res://particles/combat_hit.tres
  - res://particles/arrow_trail.tres
  - res://particles/enemy_death.tres
  - res://shaders/ui/hero_moment.gdshader
  - res://scenes/effects/hero_moment.tscn
autonomous: true
requirements:
  - GAME-01
  - GAME-02
must_haves:
  truths:
    - "Combat triggers gold/orange particle effects on hits"
    - "Level-up and reward screens display hero moment glow"
    - "Particle effects run at 60fps without frame drops"
  artifacts:
    - path: "res://particles/combat_hit.tres"
      provides: "Hit impact particles"
    - path: "res://particles/arrow_trail.tres"
      provides: "Arrow trail particles"
    - path: "res://particles/enemy_death.tres"
      provides: "Enemy death explosion"
    - path: "res://shaders/ui/hero_moment.gdshader"
      provides: "Screen-space glow shader"
  key_links:
    - from: "CombatManager"
      to: "res://particles/combat_hit.tres"
      via: "add_child() at hit location"
      pattern: "instantiate.*combat_hit"
    - from: "LevelUp signal"
      to: "res://scenes/effects/hero_moment.tscn"
      via: "play() method"
      pattern: "hero_moment.play()"
---

<objective>
Create Gameplay Effects: GPU-accelerated combat particles and hero moment screen effects.
</objective>

<execution_context>
@/home/alex/.config/opencode/get-shit-done/workflows/execute-plan.md
@/home/alex/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/gilded-quest-02/02-SUMMARY.md
@.planning/phases/gilded-quest-research/RESEARCH.md

# Design System Reference
- Combat particles: Gold (#ffd700) for heroic, orange (#ff8c00), fade to red (#ff4500)
- Hero moments: Level-up, reward screens with screen-space glow
- Use GPUParticles2D for GPU acceleration
</context>

<tasks>

<task type="auto">
<name>Task 1: Create combat particle effect presets</name>
<files>res://particles/combat_hit.tres, res://particles/arrow_trail.tres, res://particles/enemy_death.tres</files>
  <action>
Create GPUParticles2D with ParticleProcessMaterial presets:
- combat_hit: emission_shape sphere (radius 10), direction spread 180, velocity 100-200, gravity -200, scale 0.5-1.5, color gradient gold->orange->fade, amount 32, lifetime 0.5s, explosiveness 0.9
- arrow_trail: emission_shape ring, velocity 50-80, direction opposite to movement, scale 0.3-0.8, color gold at 60% opacity, amount 16
- enemy_death: emission_shape sphere (radius 20), velocity 150-250, spread 360, color gradient gold->emerald->fade, amount 64, lifetime 0.8s

Save as reusable .tres resources.
  </action>
  <verify>
Particle effects play correctly in game scenes with proper colors
</verify>
  <done>Combat particle presets ready for gameplay integration</done>
</task>

<task type="auto">
<name>Task 2: Create hero moment screen effects</name>
<files>res://shaders/ui/hero_moment.gdshader, res://scenes/effects/hero_moment.tscn</files>
  <action>
Create screen-space glow shader for hero moments:
- shader_type canvas_item
- uniform sampler2D screen_texture: hint_screen_texture
- uniform float glow_intensity: hint_range(0.0, 2.0) = 0.5
- uniform vec4 glow_color: source_color = gold (#ffd700)
- Apply additive glow to bright areas

Create hero_moment scene with fullscreen ColorRect using shader, triggered on:
- Level-up events
- Reward/reveal screens
- Victory moments

Shader should pulse gently (sin wave on intensity).
  </action>
  <verify>
Screen glow appears on level-up/reward without performance issues
</verify>
  <done>Hero moment effects integrated with game events</done>
</task>

</tasks>

<verification>
[ ] Combat particles show gold/orange colors, proper timing
[ ] Hero moments trigger on level-up and rewards
[ ] Effects run at 60fps on target devices
</verification>

<success_criteria>
GAME-01 (Combat Particles), GAME-02 (Hero Moments) implemented
</success_criteria>

<output>
After completion, create `.planning/phases/gilded-quest-03/03-SUMMARY.md`
</output>