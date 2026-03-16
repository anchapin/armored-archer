# Phase 1.5: Basic Particle Effects

**Priority**: P1 - High
**Estimated Effort**: 2-3 hours
**Status**: 📋 Pending

---

## Problem

Combat lacks visual feedback - hits, deaths, and special events have no particle effects.

---

## Objectives

1. Add hit impact particles
2. Add enemy death effects
3. Add basic environmental particles (optional)

---

## Tasks

### Task 1.5.1: Audit Current Particles

**Files**: 
- `assets/particles/` directory
- Any existing GPUParticles2D nodes

**Steps**:
1. Check existing particle assets
2. Identify where particles are needed
3. Document current state
4. Prioritize impact > death > environment

---

### Task 1.5.2: Create Hit Impact Particles

**Simple Impact Effect**:

```gdscript
# Create impact particle scene
# assets/particles/impact_effect.tscn

extends GPUParticles2D

func _ready() -> void:
    # Configure particles
    amount = 10
    lifetime = 0.5
    explosiveness = 1.0
    
    # Simple circle texture
    var texture = CircleTexture2D.new()
    texture.size = 8
    process_material = ParticleProcessMaterial.new()
    process_material.direction = Vector3(0, -1, 0)
    process_material.spread = 360
    process_material.initial_velocity_min = 50.0
    process_material.initial_velocity_max = 100.0
    process_material.gravity = Vector3(0, 0, 0)
    
    # Color based on damage type
    modulate = Color("#E74C3C")  # Red for physical

func spawn_at(position: Vector2) -> void:
    global_position = position
    emitting = true
    
    # Auto-cleanup
    await get_tree().create_timer(lifetime).timeout
    queue_free()
```

**Usage in Combat**:
```gdscript
# When enemy is hit
func on_hit(position: Vector2) -> void:
    var impact = preload("res://assets/particles/impact_effect.tscn").instantiate()
    get_parent().add_child(impact)
    impact.spawn_at(position)
```

---

### Task 1.5.3: Create Death Effect

```gdscript
# Enemy death particles
# More dramatic than hit effect

extends GPUParticles2D

func _ready() -> void:
    amount = 20
    lifetime = 1.0
    explosiveness = 1.0
    
    process_material = ParticleProcessMaterial.new()
    process_material.direction = Vector3(0, -1, 0)
    process_material.spread = 360
    process_material.initial_velocity_min = 100.0
    process_material.initial_velocity_max = 200.0
    
    # Fade out effect
    process_material.color_curve = Gradient.new()
    
    modulate = Color("#FF6B6B")  # Bright red/pink

func on_enemy_death(position: Vector2) -> void:
    var death_effect = instantiate()
    get_parent().add_child(death_effect)
    death_effect.global_position = position
```

---

### Task 1.5.4: Add Arrow Trail Particles (Optional)

```gdscript
# Attach to arrow scene
@onready var trail: GPUParticles2D = $Trail

func _process(delta: float) -> void:
    if emitting:
        trail.emitting = true
        trail.position = Vector2.ZERO
        trail.process_material.direction = Vector3(-velocity.x, -velocity.y, 0)
```

---

### Task 1.5.5: Verify Particle Performance

**Test Checklist**:
- [ ] Particles are visible and clear
- [ ] No performance drop with multiple particles
- [ ] Particles auto-cleanup (no memory leak)
- [ ] Effects enhance clarity, not distract
- [ ] Different effects are distinguishable

---

## Success Criteria

- [ ] Hit impacts have visible feedback
- [ ] Enemy deaths feel satisfying
- [ ] Particles don't cause performance issues
- [ ] Effects auto-cleanup properly
- [ ] Visual hierarchy is clear (hit < death < special)

---

## Files to Create/Modify

| File | Changes |
|------|---------|
| `assets/particles/impact_effect.tscn` | New particle scene |
| `assets/particles/death_effect.tscn` | New particle scene |
| `scenes/enemies/enemy.gd` | Spawn particles on hit/death |
| `scenes/arrow.gd` | Optional trail particles |

---

## Testing

1. **Spawn multiple enemies** and attack
2. **Verify** particles appear on hit
3. **Test** death effects
4. **Check** performance with many particles
5. **Verify** cleanup (no memory leak)

---

## Timebox

**Maximum Time**: 3 hours

If not complete:
- Use simple color flash instead of particles
- Focus on hit effects only
- Use Godot's built-in particle templates

---

## Phase 1 Completion

After particle effects are complete:
→ **Phase 1: Visual Foundation** is COMPLETE
→ Move to **Phase 2: UX & UI Fixes**

---

## Phase 1 Summary

**Completed**:
- ✅ Background & Environment Colors
- ✅ Player Sprite & Colors
- ✅ Enemy Sprites & Colors
- ✅ Arrow Projectile Visuals
- ✅ Basic Particle Effects

**Result**: Game is now visually coherent - player can see what's happening

---

**Status**: 📋 **READY TO START**
**Human Checkpoint**: Required before starting
