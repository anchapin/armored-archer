# Phase 1.4: Arrow Projectile Visuals

**Priority**: P0 - Critical
**Estimated Effort**: 1-2 hours
**Status**: 📋 Pending

---

## Problem

Arrows are currently invisible or hard to see, making combat feedback unclear.

---

## Objectives

1. Make arrows clearly visible when flying
2. Add visual trail or effect for arrow flight
3. Ensure arrow impacts are visible

---

## Tasks

### Task 1.4.1: Audit Current Arrow

**Files**: 
- `scenes/arrow.tscn`
- `assets/sprites/arrow.tres`
- `scripts/arrow.gd` (or similar)

**Steps**:
1. Open arrow scene in Godot
2. Check if sprite exists
3. Test arrow visibility in-game
4. Document current state
5. Screenshot for before/after

---

### Task 1.4.2: Implement Arrow Sprite

```gdscript
# In arrow scene or script
@onready var sprite: Sprite2D = $Sprite2D

func _ready() -> void:
    # Load arrow sprite
    var arrow_texture = load("res://assets/sprites/arrow.tres")
    if arrow_texture:
        sprite.texture = arrow_texture
    else:
        # Fallback: simple arrow shape
        # Create via Godot editor or use ColorRect
        modulate = Color("#8B4513")  # Brown wood
    
    # Rotate to match flight direction
    rotation = velocity.angle()
```

**Color Options**:
- **Wood**: #8B4513 (brown)
- **Fire**: #E74C3C (red with glow)
- **Ice**: #3498DB (blue with trail)
- **Normal**: #95A5A6 (silver/grey)

---

### Task 1.4.3: Add Arrow Trail (Optional Polish)

```gdscript
# Simple trail using Line2D
@onready var trail: Line2D = $Trail

func _process(delta: float) -> void:
    # Add point at current position
    trail.add_point(global_position)
    
    # Remove old points (keep last 5)
    if trail.points.size() > 5:
        trail.remove_point(0)
```

---

### Task 1.4.4: Add Arrow Impact Effect

```gdscript
# When arrow hits target
func _on_body_entered(body: Node2D) -> void:
    # Spawn impact particles
    spawn_impact_effect()
    
    # Flash effect on target
    if body.has_method("take_damage"):
        body.flash_hit()
    
    # Remove arrow after delay
    await get_tree().create_timer(2.0).timeout
    queue_free()

func spawn_impact_effect() -> void:
    # Simple particle or color flash
    var impact = ColorRect.new()
    impact.color = Color.WHITE
    impact.size = Vector2(10, 10)
    impact.position = global_position
    get_parent().add_child(impact)
    
    # Fade out
    var tween = create_tween()
    tween.tween_property(impact, "modulate:a", 0.0, 0.3)
    tween.tween_callback(impact.queue_free)
```

---

### Task 1.4.5: Verify Arrow Visibility

**Test Checklist**:
- [ ] Arrow is visible when shot
- [ ] Arrow flight path is clear
- [ ] Arrow direction is obvious
- [ ] Impact is visually feedback
- [ ] Different arrow types (if any) are distinct

---

## Success Criteria

- [ ] Arrows are clearly visible in flight
- [ ] Arrow direction is obvious
- [ ] Impact creates visible feedback
- [ ] No performance issues with multiple arrows
- [ ] Looks intentional, not placeholder

---

## Files to Modify

| File | Changes |
|------|---------|
| `scenes/arrow.tscn` | Arrow sprite/visual |
| `scripts/arrow.gd` | Arrow visual logic |
| `assets/sprites/arrow.tres` | Use or update texture |

---

## Testing

1. **Shoot arrows** in all directions
2. **Verify** visibility against background
3. **Test** with multiple arrows on screen
4. **Check** impact feedback
5. **Screenshot** for documentation

---

## Timebox

**Maximum Time**: 2 hours

If not complete:
- Use simple colored line for arrow
- Skip trail effect for MVP
- Focus on basic visibility

---

## Next Phase

After arrow visuals are complete:
→ Move to **Phase 1.5: Basic Particle Effects**

---

**Status**: 📋 **READY TO START**
**Human Checkpoint**: Required before starting
