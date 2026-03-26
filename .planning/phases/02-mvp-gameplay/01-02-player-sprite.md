# Phase 1.2: Player Sprite & Colors

**Priority**: P0 - Critical
**Estimated Effort**: 2-4 hours
**Status**: 📋 Pending

---

## Problem

The player character is currently a grey/white box that's hard to see and distinguish from the environment.

---

## Objectives

1. Replace player grey box with visible sprite
2. Ensure player is clearly distinguishable from enemies
3. Add visual feedback for player state (health, movement)

---

## Tasks

### Task 1.2.1: Audit Current Player Sprite

**File**: `scenes/player.tscn`, `scenes/player/player.gd`

**Steps**:
1. Open player scene in Godot
2. Identify sprite node (Sprite2D, ColorRect, etc.)
3. Note current appearance
4. Check existing sprite assets in `assets/sprites/character_body.tres`
5. Screenshot current state

---

### Task 1.2.2: Choose Player Visual

**Option A: Use Existing Sprite Asset** (Recommended)

Project already has `assets/sprites/character_body.tres`

```gdscript
# In player scene
@onready var sprite: Sprite2D = $Sprite2D

func _ready() -> void:
    # Load existing sprite
    var sprite_resource = load("res://assets/sprites/character_body.tres")
    if sprite_resource:
        sprite.texture = sprite_resource
    else:
        # Fallback to colored rectangle
        modulate = Color("#3498DB")  # Blue player
```

**Option B: Simple Colored Shape** (Fallback)

If sprite import fails:
```gdscript
# Use ColorRect with distinct color
@onready var player_sprite: ColorRect = $PlayerSprite

func _ready() -> void:
    player_sprite.color = Color("#3498DB")  # Bright blue
    # Add outline for visibility
    modulate = Color("#2980B9")  # Darker blue border
```

**Color Choices**:
- **Blue** (#3498DB) - Friendly, distinct from typical enemy reds
- **Green** (#27AE60) - Nature-themed for archer
- **Purple** (#9B59B6) - Magical/mystical archer

---

### Task 1.2.3: Add Player Outline/Glow

For better visibility:

```gdscript
# Add outline effect
@onready var sprite: Sprite2D = $Sprite2D
@onready var outline: Sprite2D = $Sprite2D/Outline

func _ready() -> void:
    outline.modulate = Color("#1A5276")  # Dark blue outline
    outline.position = Vector2.ZERO
    # Or use Godot's built-in outline in shader
```

**Alternative**: Use Godot's `outline` property in Sprite2D:
```gdscript
sprite.outline_mode = Sprite2D.OUTLINE_MODE_ALWAYS
sprite.outline_color = Color("#000000")
sprite.outline_size = 2
```

---

### Task 1.2.4: Add Player Health Indicator

Visual feedback for player health:

```gdscript
# Flash red when damaged
func take_damage(amount: int) -> void:
    health -= amount
    # Flash effect
    var tween = create_tween()
    tween.tween_property(self, "modulate", Color("#FF0000"), 0.1)
    tween.tween_property(self, "modulate", Color.WHITE, 0.3)
```

---

### Task 1.2.5: Verify Player Visibility

**Test Checklist**:
- [ ] Player is instantly recognizable
- [ ] Player stands out from background
- [ ] Player is distinct from enemies
- [ ] Player movement is clear
- [ ] Damage feedback is visible

---

## Success Criteria

- [ ] Player has distinct visual appearance (not grey box)
- [ ] Player is visible against all backgrounds
- [ ] Player is distinguishable from enemies
- [ ] Health/damage feedback is visible
- [ ] Looks intentional, polished

---

## Files to Modify

| File | Changes |
|------|---------|
| `scenes/player.tscn` | Sprite node update |
| `scenes/player/player.gd` | Visual feedback code |
| `assets/sprites/` | Use character_body.tres |

---

## Testing

1. **Launch game** with player in scene
2. **Move player** around entire play area
3. **Verify** visibility in all positions
4. **Test** damage feedback
5. **Screenshot** for documentation

---

## Timebox

**Maximum Time**: 4 hours

If not complete:
- Use simple colored shape with outline
- Document sprite import issues
- Move forward, fix sprites later

---

## Next Phase

After player sprite is complete:
→ Move to **Phase 1.3: Enemy Sprites & Colors**

---

**Status**: 📋 **READY TO START**
**Human Checkpoint**: Required before starting
