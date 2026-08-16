# Armored Archer Visual Improvement Task List

**Date:** April 29, 2026  
**Reviewer:** Alex Chapin  
**Status:** Ready for Implementation

---

## Executive Summary

This document outlines a comprehensive list of visual improvements needed to elevate the game's aesthetic quality. The game has a solid foundation with the Gilded Quest dark obsidian theme (#0e0e0e) and golden "Loot Glow" accents (#ffac54), but needs polish in several key areas.

---

## 1. PARTICLE & VISUAL EFFECTS IMPROVEMENTS

### High Priority
- [ ] **Arrow Trail Enhancement**
  - Current: Uses basic icon.svg texture
  - Improvement: Create custom arrow trail particle with golden/glowing effect
  - Path: `assets/particles/arrow_trail.tscn`

- [ ] **Hit Effect Visual Polish**
  - Current: Basic circle particles with orange color
  - Improvement: Add multiple particle textures (metal spark, wood chip), screen flash effect
  - Path: `assets/particles/hit_effect.tscn`

- [ ] **Crit Effect Creation**
  - Current: Exists but needs polish
  - Improvement: Golden spark particles with screen shake, damage number pop

- [ ] **Charge Effect Enhancement**
  - Current: Basic particle effect
  - Improvement: Bow draw charge visual, screen vignette effect

### Medium Priority
- [ ] **Death Effect Variety**
  - Add different death effects for different enemy types (goblin vs brute vs boss)

- [ ] **Environmental Particles**
  - Add floating dust particles in arena
  - Add ambient glow particles near loot drops

---

## 2. UI ANIMATION & TRANSITION ENHANCEMENTS

### High Priority
- [ ] **Main Menu Character Preview Animation**
  - Current: Static emoji archer (🏹)
  - Improvements:
    - Animated idle pose rotation when not interacting
    - Hover animation on buttons
    - Button press scale animation (currently missing tactile feedback)

- [ ] **Menu Transitions**
  - Add fade/slide transitions between menus
  - Implement loading state animations

- [ ] **Damage Number Popups**
  - Current: Basic damage popup
  - Improvements:
    - Crit numbers with golden color and larger size
    - Miss numbers with gray and italic
    - Heal numbers with green

### Medium Priority
- [ ] **Progress Bar Animations**
  - Smooth health bar value changes
  - Glow pulse when health is low

- [ ] **Button Hover Effects**
  - Subtle scale up on hover
  - Glow intensity increase

---

## 3. VIRTUAL JOYSTICK VISUAL DESIGN

### High Priority
- [ ] **Joystick Visual Redesign**
  - Current: Basic white ColorRect circles
  - Improvements:
    - Circular base with metallic texture
    - Thumb with gradient and subtle glow
    - Directional arrow indicator when aiming
    - Opacity adjustment based on input

- [ ] **Aiming Visual Feedback**
  - Add aiming arc visualization
  - Trajectory prediction line

---

## 4. BACKGROUND & ENVIRONMENT VISUALS

### High Priority
- [ ] **Main Menu Background**
  - Current: Solid dark gray (#050505)
  - Improvements:
    - Subtle animated gradient
    - Floating particle effects
    - Subtle vignette effect

- [ ] **Gameplay Arena Background**
  - Current: Basic ColorRect visual in spawner
  - Improvements:
    - Tileable ground texture
    - Background elements (distant mountains, trees)
    - Dynamic lighting effects

- [ ] **World Environment**
  - Current: Basic environment with glow
  - Improvements:
    - Custom environment with proper lighting
    - Ambient occlusion for depth

---

## 5. GEAR & INVENTORY VISUAL STYLING

### High Priority
- [ ] **Rarity-Based Visual Styling**
  - Common: Gray/brown border
  - Rare: Blue accent bar
  - Epic: Purple accent + glow
  - Legendary: Gold gradient + particle effect

- [ ] **Gear Slot Visual Polish**
  - Current: Basic button in loadout
  - Improvements:
    - 3D-style equipment slots
    - Item silhouette previews
    - Durability indicator bars

- [ ] **Gear Comparison Panel**
  - Add visual indicators for stat changes (green up, red down)
  - Better spacing and typography

---

## 6. HEALTH BAR & UI PANEL REDESIGN

### High Priority
- [ ] **Health Bar Theming**
  - Current: Basic ProgressBar with no theme
  - Improvements:
    - Gradient fill (green to red)
    - Metallic frame background
    - Glow effect for low health
    - Rarity-based styling for boss health bars

- [ ] **Panel Container Styling**
  - Current: Basic panel with no visual polish
  - Improvements:
    - Metallic plate appearance per Gilded Quest theme
    - Subtle inner shadow for depth
    - Corner radius consistency (4px per spec)

---

## 7. ENEMY VISUAL VARIETY

### High Priority
- [ ] **Enemy Sprite Enhancement**
  - Current: Uses placeholder texture
  - Improvements:
    - Use existing goblin/brute sprites properly
    - Directional animations (idle, walk, attack, hit, death)
    - Enemy type color coding (health bar colors)

- [ ] **Boss Visual Polish**
  - Add unique boss sprites
  - Boss-specific health bar (thicker, different color)
  - Boss intro animation

---

## 8. BUTTON & INTERACTIVE ELEMENT POLISH

### High Priority
- [ ] **Tactile Press Animation**
  - Current: Scale defined in theme but not implemented
  - Improvement: Add scale 0.96 on press with smooth tween

- [ ] **Button Glow Effects**
  - Current: Ambient glow defined in button style
  - Improvement: Animate glow intensity on hover

- [ ] **Loading Indicator**
  - Current: Basic "Loading..." text
  - Improvement: Animated spinner or progress dots

---

## 9. GAME STATE VISUAL FEEDBACK

### High Priority
- [ ] **Screen Shake Implementation**
  - Current: Screen shake scene exists but not utilized
  - Improvement: Shake on player hit, enemy death, special abilities

- [ ] **Damage Overlay**
  - Current: Basic damage overlay scene
  - Improvement: Red vignette when taking damage

- [ ] **Victory/Game Over Screens**
  - Add particle effects
  - Animate result labels
  - Decorative border elements

---

## 10. TYPOGRAPHY & FONT IMPROVEMENTS

### High Priority
- [ ] **Font Consistency**
  - Current: Mix of default fonts
  - Improvement: Apply Plus Jakarta Sans consistently
  - Proper sizing hierarchy (display, title, body, label)

- [ ] **Text Shadow & Outline**
  - Add consistent text shadows for readability
  - Title text outline for main menu

---

## 11. COLOR PALETTE & THEME CONSISTENCY

### High Priority
- [ ] **Theme Application Audit**
  - Ensure all UI elements use Gilded Quest theme colors
  - Apply surface hierarchy correctly (surface, container, variant)
  - Remove any hardcoded colors that don't match theme

- [ ] **Accent Color Usage**
  - Golden (#ffac54) for primary actions
  - Green (#7ef839) for positive/uncommon
  - Orange-red (#ff7351) for negative/epic

---

## 12. PROGRESSIVE VISUAL REVEAL SYSTEM

### Medium Priority
- [ ] **Tutorial Overlay**
  - Animated hand pointer for controls
  - Highlight interactive elements

- [ ] **Unlock Animations**
  - Particle burst when new gear unlocked
  - Chest opening animation for rewards

- [ ] **Level Up Effects**
  - Screen flash and upward particles
  - Stat increase number animations

---

## Priority Matrix

| Priority | Task Count | Estimated Time |
|----------|------------|----------------|
| High | 18 | 12-16 hours |
| Medium | 9 | 6-8 hours |
| Low | 4 | 2-3 hours |
| **Total** | **31** | **20-27 hours** |

---

## Recommended Implementation Order

1. **Phase 1: Core Visual Feedback** (4-6 hours)
   - Particle effects enhancement
   - Screen shake and damage feedback
   - Health bar redesign

2. **Phase 2: UI Polish** (4-5 hours)
   - Button animations and tactile feedback
   - Menu transitions
   - Virtual joystick redesign

3. **Phase 3: Enemy & Environment** (5-7 hours)
   - Enemy sprite implementation
   - Background and environment visuals
   - Boss visual distinction

4. **Phase 4: Gear & Inventory** (3-4 hours)
   - Rarity styling for gear
   - Loadout slot polish
   - Comparison panel enhancement

5. **Phase 5: Advanced Polish** (4-5 hours)
   - Typography improvements
   - Theme consistency audit
   - Progressive visual reveals