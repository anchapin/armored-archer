# Phase 1.3: Enemy Sprites & Colors

**Priority**: P0 - Critical
**Estimated Effort**: 3-5 hours
**Status**: 📋 Pending

---

## Problem

Enemies are currently grey boxes that are hard to see, distinguish, or identify by type.

---

## Objectives

1. Replace enemy grey boxes with visible sprites
2. Make enemy types visually distinct (basic, wind, boss)
3. Ensure enemies are visible against background

---

## Tasks

### Task 1.3.1: Audit Current Enemy Sprites

**Files**: 
- `scenes/enemies/enemy.tscn`
- `scenes/enemies/bosses/boss_*.tscn`
- `assets/sprites/enemy.tres`, `boss_*.tres`

**Steps**:
1. Open enemy scenes in Godot
2. Identify all enemy types
3. Check existing sprite assets
4. Document current appearance
5. Screenshot for before/after

---

### Task 1.3.2: Define Enemy Visual Types

**Enemy Type 1: Basic Enemy**
- **Role**: Melee rusher, common spawn
- **Color**: Red/Orange (#E74C3C or #D35400)
- **Sprite**: `assets/sprites/enemy.tres`
- **Visual Cue**: Aggressive, barbarian theme

**Enemy Type 2: Wind Enemy**
- **Role**: Ranged attacker, special abilities
- **Color**: Blue/Cyan (#3498DB or #1ABC9C)
- **Sprite**: `assets/sprites/boss_wind.tres`
- **Visual Cue**: Magical, ranged theme

**Enemy Type 3: Boss**
- **Role**: Chapter finale, high HP
- **Color**: Purple/Dark (#8E44AD or #2C3E50)
- **Sprite**: `assets/sprites/boss_basic.tres`
- **Visual Cue**: Larger, more imposing

---

### Task 1.3.3: Implement Basic Enemy Sprite

```gdscript
# In enemy scene or script
@onready var sprite: Sprite2D = $Sprite2D

func _ready() -> void:
    # Load enemy sprite
    var enemy_sprite = load("res://assets/sprites/enemy.tres")
    if enemy_sprite:
        sprite.texture = enemy_sprite
        sprite.modulate = Color("#E74C3C")  # Red tint
    else:
        # Fallback: colored rectangle
        modulate = Color("#E74C3C")
    
    # Add outline for visibility
    sprite.outline_mode = Sprite2D.OUTLINE_MODE_ALWAYS
    sprite.outline_color = Color("#000000")
    sprite.outline_size = 2
```

---

### Task 1.3.4: Implement Wind Enemy Sprite

```gdscript
# In wind enemy scene
@onready var sprite: Sprite2D = $Sprite2D

func _ready() -> void:
    var wind_sprite = load("res://assets/sprites/boss_wind.tres")
    if wind_sprite:
        sprite.texture = wind_sprite
        sprite.modulate = Color("#3498DB")  # Blue tint
    else:
        modulate = Color("#3498DB")
    
    # Different outline color for variety
    sprite.outline_color = Color("#1ABC9C")  # Cyan outline
```

---

### Task 1.3.5: Implement Boss Sprite

```gdscript
# In boss scene
@onready var sprite: Sprite2D = $Sprite2D
@onready var boss_health_bar: ProgressBar = $BossHealthBar

func _ready() -> void:
    var boss_sprite = load("res://assets/sprites/boss_basic.tres")
    if boss_sprite:
        sprite.texture = boss_sprite
        sprite.modulate = Color("#8E44AD")  # Purple tint
    else:
        modulate = Color("#8E44AD")
    
    # Boss should be larger
    sprite.scale = Vector2(1.5, 1.5)
    
    # Ensure boss health bar is visible
    boss_health_bar.visible = true
```

---

### Task 1.3.6: Add Enemy Damage Feedback

```gdscript
# Flash white when hit
func take_damage(amount: int) -> void:
    health -= amount
    # Flash effect
    var tween = create_tween()
    tween.tween_property(self, "modulate", Color.WHITE, 0.05)
    tween.tween_property(self, "modulate", original_color, 0.2)
    
    # Optional: knockback effect
    if has_node("Knockback"):
        apply_knockback()
```

---

### Task 1.3.7: Verify Enemy Visibility

**Test Checklist**:
- [ ] All enemy types are instantly recognizable
- [ ] Enemy types are visually distinct from each other
- [ ] Enemies are visible against background
- [ ] Boss is clearly more imposing than regular enemies
- [ ] Damage feedback is visible

---

## Success Criteria

- [ ] All enemies have distinct visual appearance
- [ ] Enemy types are easily distinguishable
- [ ] Enemies are visible in all lighting/positions
- [ ] Boss feels "boss-like" (larger, more imposing)
- [ ] Damage feedback is clear

---

## Files to Modify

| File | Changes |
|------|---------|
| `scenes/enemies/enemy.tscn` | Basic enemy sprite |
| `scenes/enemies/enemy.gd` | Damage feedback |
| `scenes/enemies/bosses/*.tscn` | Boss sprites |
| `scenes/enemies/bosses/*.gd` | Boss visual effects |

---

## Testing

1. **Spawn each enemy type** in game
2. **Verify** visibility against game background
3. **Test** damage feedback on each type
4. **Compare** enemy types side-by-side
5. **Screenshot** for documentation

---

## Timebox

**Maximum Time**: 5 hours

If not complete:
- Use colored rectangles with distinct colors
- Focus on basic enemy first, bosses later
- Document sprite issues for future fix

---

## Next Phase

After enemy sprites are complete:
→ Move to **Phase 1.4: Arrow Projectile Visuals**

---

**Status**: 📋 **READY TO START**
**Human Checkpoint**: Required before starting
