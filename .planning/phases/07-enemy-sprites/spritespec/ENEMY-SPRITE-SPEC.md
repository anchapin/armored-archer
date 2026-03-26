# Phase 07: Enemy Sprite Specification

## Overview

This document defines the pixel art specifications for all enemy types in the game. Each enemy has unique visual characteristics based on its type and behavior.

---

## 1. General Specifications

| Property | Value |
|----------|-------|
| **Canvas Size** | 32x32 pixels per frame (standard), 64x64 for bosses |
| **Pixel Scale** | 1:1 (no scaling) |
| **Color Palette** | 16-color max per enemy (indexed) |
| **Animation FPS** | Variable per enemy type |
| **File Format** | PNG with transparency |

---

## 2. Enemy Types

### 2.1 Basic Enemies (8 types)

#### 2.1.1 Melee Enemy (Goblin)
- **Size:** 32x32
- **Behavior:** Basic close-combat attacker
- **Animations:** idle, walk, attack, hit, death
- **Total Sprites:** 60 (5 states × 4 directions × 3 avg frames)

**Visual Design:**
- Small green-skinned humanoid
- Pointed ears
- Carries simple club/mace
- Tattered cloth wrappings
- Glowing yellow eyes

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Skin | #4A7C3F |
| 1 | Skin Shadow | #2D4A28 |
| 2 | Cloth | #6B5344 |
| 3 | Cloth Dark | #4A3A2E |
| 4 | Eyes | #FFD700 |
| 5 | Club Wood | #8B6914 |
| 6 | Outline | #1A1A1A |

---

#### 2.1.2 Ranged Enemy (Skeleton Archer)
- **Size:** 32x32
- **Behavior:** Ranged attacks from distance
- **Animations:** idle, walk, attack, hit, death
- **Total Sprites:** 60

**Visual Design:**
- Skeletal humanoid (bones visible)
- Bow in hand
- Torn shroud wrapping
- Glowing blue eye sockets
- Arrow quiver on back

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Bone | #E8E8D0 |
| 1 | Bone Shadow | #B8B8A0 |
| 2 | Shroud | #505050 |
| 3 | Shroud Dark | #303030 |
| 4 | Eye Glow | #4488FF |
| 5 | Bow Wood | #8B5A2B |
| 6 | Outline | #1A1A1A |

---

#### 2.1.3 Speed Enemy (Shadow Runner)
- **Size:** 32x32
- **Behavior:** Fast movement, low health
- **Animations:** idle, walk, attack, hit, death
- **Total Sprites:** 60

**Visual Design:**
- Dark shadowy figure
- Wispy trail effect (optional)
- Red glowing eyes
- Bladed claws
- Hooded/draped cloak

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Shadow | #2A2A35 |
| 1 | Shadow Dark | #151520 |
| 2 | Cloak | #1A1A25 |
| 3 | Eyes | #FF2222 |
| 4 | Claws | #888890 |
| 5 | Trail | #2A2A3540 |
| 6 | Outline | #0A0A0F |

---

#### 2.1.4 Swarmer Enemy (Rat Swarm)
- **Size:** 24x24 (smaller than standard)
- **Behavior:** Spawns in groups, surrounds player
- **Animations:** idle, walk, attack, hit, death
- **Total Sprites:** 50

**Visual Design:**
- Rat creature
- Long tail
- Pointed snout
- Red beady eyes
- Quick, scuttling motion

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Fur | #8B7355 |
| 1 | Fur Shadow | #5C4D3A |
| 2 | Belly | #C4A882 |
| 3 | Eyes | #FF0000 |
| 4 | Ears | #6B5344 |
| 5 | Tail | #5C4D3A |
| 6 | Outline | #1A1A1A |

---

#### 2.1.5 Brute Enemy (Orc Warrior)
- **Size:** 40x40 (larger)
- **Behavior:** High health, slow, heavy attacks
- **Animations:** idle, walk, attack, hit, death
- **Total Sprites:** 70

**Visual Design:**
- Large muscular orc
- tusks/jagged teeth
- War paint on face
- Large two-handed weapon
- Thick leather armor

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Skin | #5A7C4A |
| 1 | Skin Shadow | #3A5030 |
| 2 | Armor | #4A4A4A |
| 3 | Armor Dark | #2A2A2A |
| 4 | War Paint | #CC3333 |
| 5 | Tusks | #E8D8C0 |
| 6 | Weapon | #666666 |
| 7 | Outline | #1A1A1A |

---

#### 2.1.6 Scout Enemy (Elven Scout)
- **Size:** 32x32
- **Behavior:** Fast, low health, retreats
- **Animations:** idle, walk, attack, hit, death
- **Total Sprites:** 60

**Visual Design:**
- Lean elven hunter
- Green/brown camouflaged cloak
- Dual daggers
- Hood up
- Alert expression

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Skin | #D4A574 |
| 1 | Skin Shadow | #B4855A |
| 2 | Cloak | #4A6B3A |
| 3 | Cloak Dark | #2A4A20 |
| 4 | Hair | #2A1A0A |
| 5 | Daggers | #888890 |
| 6 | Outline | #1A1A1A |

---

#### 2.1.7 Guardian Enemy (Golem)
- **Size:** 48x48 (larger)
- **Behavior:** Very high health, slow, protects others
- **Animations:** idle, walk, attack, hit, death
- **Total Sprites:** 70

**Visual Design:**
- Stone golem construction
- Cracks and moss details
- Glowing core (color varies)
- Large fists
- Geometric patterns

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Stone | #7A7A70 |
| 1 | Stone Shadow | #5A5A50 |
| 2 | Moss | #4A6B3A |
| 3 | Core | #44AAFF (varies by type) |
| 4 | Cracks | #3A3A35 |
| 5 | Highlight | #9A9A90 |
| 6 | Outline | #2A2A25 |

---

#### 2.1.8 Tank Enemy (Armored Troll)
- **Size:** 48x48
- **Behavior:** Highest health, very slow, armored
- **Animations:** idle, walk, attack, hit, death
- **Total Sprites:** 70

**Visual Design:**
- Large troll with heavy armor
- Metal plates bolted on
- Chain binding
- Club with metal spikes
- Glowing eyes through helmet

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Skin | #6B5B4B |
| 1 | Skin Shadow | #4B3B2B |
| 2 | Armor Metal | #5A5A60 |
| 3 | Armor Rust | #6B4A3A |
| 4 | Chains | #3A3A40 |
| 5 | Spikes | #707070 |
| 6 | Eye Glow | #FF6600 |
| 7 | Outline | #1A1A1A |

---

#### 2.1.9 Necromancer Enemy
- **Size:** 32x32
- **Behavior:** Summons minions, casts spells
- **Animations:** idle, walk, attack, hit, death
- **Total Sprites:** 60

**Visual Design:**
- Robed dark mage
- Skull-like face
- Glowing magic (green/purple)
- Staff with orb
- Floating/hovering motion

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Robe | #2A2A35 |
| 1 | Robe Dark | #1A1A25 |
| 2 | Skin | #D4D4C0 |
| 3 | Magic | #88FF44 (varies) |
| 4 | Staff | #5A4A3A |
| 5 | Orb | #AA44FF |
| 6 | Outline | #0A0A0F |

---

### 2.2 Boss Enemies (6 types)

#### 2.2.1 Boss Basic (Human Warlord)
- **Size:** 64x64
- **Behavior:** Standard boss patterns
- **Animations:** idle, walk, attack, special, hit, death
- **Total Sprites:** 90

**Visual Design:**
- Large armored human commander
- Cape/tabard with insignia
- Sword and shield
- Helmet with plume
- Royal bearing

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Armor | #606070 |
| 1 | Armor Shadow | #404050 |
| 2 | Cape | #882222 |
| 3 | Cape Dark | #661111 |
| 4 | Skin | #D4A574 |
| 5 | Helmet | #808090 |
| 6 | Plume | #CC3333 |
| 7 | Insignia | #FFD700 |
| 8 | Outline | #1A1A1A |

---

#### 2.2.2 Boss Fire (Fire Elemental)
- **Size:** 64x64
- **Behavior:** Fire attacks, fire aura
- **Animations:** idle, walk, attack, special, hit, death
- **Total Sprites:** 90

**Visual Design:**
- Floating flame entity
- Core of white/yellow fire
- Orange/red outer flames
- Ember particles rising
- No solid form (wavy)

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Core | #FFFFAA |
| 1 | Inner Fire | #FFAA00 |
| 2 | Outer Fire | #FF4400 |
| 3 | Smoke | #44220020 |
| 4 | Embers | #FF6600 |
| 5 | Glow | #FF880040 |
| 6 | Outline | #331100 |

---

#### 2.2.3 Boss Ice (Ice Giant)
- **Size:** 64x64
- **Behavior:** Ice attacks, slows player
- **Animations:** idle, walk, attack, special, hit, death
- **Total Sprites:** 90

**Visual Design:**
- Large crystalline humanoid
- Blue/cyan ice body
- Fractured ice armor
- Frozen expression
- Jagged ice spikes

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Ice Light | #AAEEFF |
| 1 | Ice Mid | #66CCFF |
| 2 | Ice Dark | #3399DD |
| 3 | Crystal | #EEFFFF |
| 4 | Frost | #88BBEE |
| 5 | Eyes | #0066AA |
| 6 | Outline | #1A3344 |

---

#### 2.2.4 Boss Earth (Stone Titan)
- **Size:** 64x64
- **Behavior:** Heavy attacks, creates obstacles
- **Animations:** idle, walk, attack, special, hit, death
- **Total Sprites:** 90

**Visual Design:**
- Massive rock golem
- Earth/rock texture
- Boulder fists
- Moss and grass details
- Small trees growing from back

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Rock Light | #8B7D6B |
| 1 | Rock Mid | #6B5D4B |
| 2 | Rock Dark | #4B3D2B |
| 3 | Moss | #4A6B3A |
| 4 | Grass | #5A7B4A |
| 5 | Eyes | #FFAA00 |
| 6 | Outline | #2A2A1A |

---

#### 2.2.5 Boss Wind (Storm Serpent)
- **Size:** 64x64 (elongated)
- **Behavior:** Fast, teleports, wind attacks
- **Animations:** idle, walk, attack, special, hit, death
- **Total Sprites:** 90

**Visual Design:**
- Serpent/dragon form
- Coiling pose
- Lightning crackles around
- Glowing eyes
- Swirling wind effect

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Scale Light | #AADDFF |
| 1 | Scale Mid | #6699CC |
| 2 | Scale Dark | #446699 |
| 3 | Lightning | #FFFF44 |
| 4 | Wind | #FFFFFF40 |
| 5 | Eyes | #FF4444 |
| 6 | Outline | #223344 |

---

#### 2.2.6 Boss Electric (Thunder Lord)
- **Size:** 64x64
- **Behavior:** Lightning attacks, electric field
- **Animations:** idle, walk, attack, special, hit, death
- **Total Sprites:** 90

**Visual Design:**
- Floating robed figure
- Crackling electricity
- Electric aura
- Staff with lightning orb
- Hood obscuring face

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Robe | #333344 |
| 1 | Robe Dark | #222233 |
| 2 | Lightning | #FFFF00 |
| 3 | Electric | #FFDD00 |
| 4 | Aura | #FFFF0040 |
| 5 | Staff | #5A5A6A |
| 6 | Orb | #AAEEFF |
| 7 | Outline | #111122 |

---

## 3. Animation Specifications

### 3.1 Standard Enemy Animations

| Animation | Frames | FPS | Loop | Description |
|-----------|--------|-----|------|-------------|
| idle | 4-6 | 6-8 | Yes | Breathing/alert pose |
| walk | 4-6 | 10-12 | Yes | Movement cycle |
| attack | 5-8 | 8-10 | No | Attack action |
| hit | 2-4 | 10-12 | No | Damage reaction |
| death | 5-8 | 6-8 | No | Die and collapse |

### 3.2 Boss-Specific Animations

| Animation | Frames | FPS | Loop | Description |
|-----------|--------|-----|------|-------------|
| idle | 6-8 | 6-8 | Yes | Dominant pose |
| walk | 6-8 | 8-10 | Yes | Heavy movement |
| attack | 8-12 | 8-10 | No | Multi-hit attack |
| special | 10-15 | 8-12 | No | Special ability |
| hit | 3-5 | 10-12 | No | Stagger |
| death | 10-15 | 6-8 | No | Dramatic death |

---

## 4. Enemy Type Summary Table

| Enemy Type | Size | States | Frames/State | Total Sprites |
|------------|------|--------|--------------|---------------|
| Melee (Goblin) | 32x32 | 5 | 3 | 60 |
| Ranged (Skeleton) | 32x32 | 5 | 3 | 60 |
| Speed (Shadow) | 32x32 | 5 | 3 | 60 |
| Swarmer (Rat) | 24x24 | 5 | 2 | 50 |
| Brute (Orc) | 40x40 | 5 | 4 | 80 |
| Scout (Elf) | 32x32 | 5 | 3 | 60 |
| Guardian (Golem) | 48x48 | 5 | 4 | 80 |
| Tank (Troll) | 48x48 | 5 | 4 | 80 |
| Necromancer | 32x32 | 5 | 3 | 60 |
| Boss Basic | 64x64 | 6 | 5 | 120 |
| Boss Fire | 64x64 | 6 | 5 | 120 |
| Boss Ice | 64x64 | 6 | 5 | 120 |
| Boss Earth | 64x64 | 6 | 5 | 120 |
| Boss Wind | 64x64 | 6 | 5 | 120 |
| Boss Electric | 64x64 | 6 | 5 | 120 |

---

## 5. Sprite Naming Convention

```
{enemy_type}_{animation_state}_{direction}_{frame}.png
```

**Examples:**
- `melee_idle_down_0.png`
- `ranged_attack_right_3.png`
- `boss_fire_special_up_5.png`

---

## 6. Direction Mapping

| Direction | Usage |
|-----------|-------|
| `down` | Enemy facing toward camera |
| `up` | Enemy facing away from camera |
| `left` | Enemy facing left |
| `right` | Enemy facing right |

**Note:** Some enemies (like Golem, Fire Elemental) may only need 1-direction sprites due to symmetry. Use 4-direction for humanoid enemies.

---

## 7. Deliverables Checklist

- [ ] Melee enemy sprites (60 files)
- [ ] Ranged enemy sprites (60 files)
- [ ] Speed enemy sprites (60 files)
- [ ] Swarmer enemy sprites (50 files)
- [ ] Brute enemy sprites (80 files)
- [ ] Scout enemy sprites (60 files)
- [ ] Guardian enemy sprites (80 files)
- [ ] Tank enemy sprites (80 files)
- [ ] Necromancer sprites (60 files)
- [ ] Boss Basic sprites (120 files)
- [ ] Boss Fire sprites (120 files)
- [ ] Boss Ice sprites (120 files)
- [ ] Boss Earth sprites (120 files)
- [ ] Boss Wind sprites (120 files)
- [ ] Boss Electric sprites (120 files)
- [ ] All SpriteFrames resources configured

---

## 8. File Output Location

```
assets/sprites/enemies/
├── melee/
│   ├── melee_idle_*.png
│   ├── melee_walk_*.png
│   ├── melee_attack_*.png
│   ├── melee_hit_*.png
│   └── melee_death_*.png
├── ranged/
├── speed/
├── swarmer/
├── brute/
├── scout/
├── guardian/
├── tank/
├── necromancer/
├── boss_basic/
├── boss_fire/
├── boss_ice/
├── boss_earth/
├── boss_wind/
├── boss_electric/
└── enemy_sprites.tres
```

---

## 9. Technical Requirements

### Import Settings (Godot)
- **Import Mode:** Lossless (VRAM Compression: disabled)
- **Filter:** Nearest (never Linear)
- **Mipmaps:** Disabled
- **Repeat:** Disabled
- **HDR:** Disabled (except boss special effects)

### Common SpriteFrames Configuration
```gdscript
# EnemyAnimationMixin handles shared animation logic
# Each enemy type extends with unique sprites
```

---

*Specification Version: 1.0*
*Last Updated: 2026-03-24*