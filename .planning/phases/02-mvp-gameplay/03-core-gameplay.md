# Phase 3: Core Gameplay Loop

**Priority**: P0 - Critical
**Estimated Effort**: 5-7 days
**Status**: 📋 Pending

---

## Problem

Even with visuals and UX fixed, the core gameplay loop may not be clear or satisfying.

---

## Objectives

1. Player can see enemies spawning
2. Combat feedback is clear and satisfying
3. Player understands win/loss conditions
4. Complete core loop is playable

---

## Tasks

### Phase 3.1: Enemy Spawning Visibility

**Goal**: Player can see and understand when enemies spawn

**Implementation**:
```gdscript
# In enemy_spawner.gd
@export var spawn_effect_scene: PackedScene

func spawn_enemy(position: Vector2) -> void:
    # Spawn visual effect first
    if spawn_effect_scene:
        var effect = spawn_effect_scene.instantiate()
        get_parent().add_child(effect)
        effect.global_position = position
    
    # Small delay before enemy appears
    await get_tree().create_timer(0.3).timeout
    
    # Spawn enemy
    var enemy = enemy_scene.instantiate()
    get_parent().add_child(enemy)
    enemy.global_position = position
```

**Visual Spawn Effects**:
- Smoke puff particles
- Circular ground marker (1 second before spawn)
- "Teleport in" flash effect

---

### Phase 3.2: Combat Feedback

**Goal**: Every combat action has clear feedback

**Hit Feedback**:
```gdscript
# On arrow hit enemy
func on_arrow_hit(enemy: Node2D, position: Vector2) -> void:
    # 1. Damage number popup
    spawn_damage_popup(enemy.damage, position)
    
    # 2. Hit particle effect
    spawn_hit_particles(position)
    
    # 3. Enemy flash white
    enemy.flash_white()
    
    # 4. Screen shake (small)
    ScreenShake.shake(2.0)
    
    # 5. Sound effect
    $HitSound.play()
```

**Miss Feedback**:
```gdscript
# On arrow miss (hit ground/wall)
func on_arrow_miss(position: Vector2) -> void:
    # 1. Different particle effect
    spawn_miss_particles(position)
    
    # 2. Different sound
    $MissSound.play()
```

---

### Phase 3.3: Player Movement & Collision

**Goal**: Player understands boundaries and collisions

**Boundary Visibility**:
```gdscript
# Add visible arena boundaries
@onready var boundary_top: ColorRect = $BoundaryTop
@onready var boundary_bottom: ColorRect = $BoundaryBottom
@onready var boundary_left: ColorRect = $BoundaryLeft
@onready var boundary_right: ColorRect = $BoundaryRight

func _ready() -> void:
    # Semi-transparent red borders
    var color = Color(1, 0, 0, 0.3)  # 30% red
    boundary_top.color = color
    boundary_bottom.color = color
    boundary_left.color = color
    boundary_right.color = color
```

**Collision Feedback**:
```gdscript
# When player hits wall
func _on_body_entered(body: Node2D) -> void:
    if body.is_in_group("Boundary"):
        # Small screen shake
        ScreenShake.shake(1.0)
        # Thud sound
        $ThudSound.play()
```

---

### Phase 3.4: Death & Respawn Clarity

**Goal**: Player immediately understands death and can respawn

**Death Screen**:
```gdscript
# In game_over.gd
@onready var death_label: Label = $DeathLabel
@onready var respawn_button: Button = $RespawnButton
@onready var stats_label: Label = $StatsLabel

func show_death_screen(stats: Dictionary) -> void:
    death_label.text = "YOU DIED"
    stats_label.text = format_stats(stats)
    respawn_button.visible = true
    respawn_button.grab_focus()
    
    # Slow motion effect
    Engine.time_scale = 0.5

func _on_respawn_button_pressed() -> void:
    Engine.time_scale = 1.0
    get_tree().reload_current_scene()
```

**Death Visual**:
```gdscript
# On player death
func die() -> void:
    # Flash red screen
    var flash = ColorRect.new()
    flash.color = Color(1, 0, 0, 0.5)
    flash.set_anchors_preset(Control.PRESET_FULL_RECT)
    get_parent().add_child(flash)
    
    var tween = create_tween()
    tween.tween_property(flash, "modulate:a", 0.0, 1.0)
    tween.tween_callback(flash.queue_free)
    
    # Spawn death particles
    spawn_death_particles(global_position)
```

---

### Phase 3.5: Win/Loss State Visibility

**Goal**: Player knows when they've won or lost

**Victory Screen**:
```gdscript
# In victory_screen.gd
@onready var victory_label: Label = $VictoryLabel
@onready var rewards_label: Label = $RewardsLabel
@onready var continue_button: Button = $ContinueButton

func show_victory(rewards: Dictionary) -> void:
    victory_label.text = "VICTORY!"
    rewards_label.text = format_rewards(rewards)
    continue_button.visible = true
    
    # Celebration effects
    spawn_confetti()
    play_victory_sound()
```

**Wave Clear** (for wave-based gameplay):
```gdscript
# When wave is cleared
func on_wave_cleared(wave_number: int) -> void:
    # Show "Wave Clear" banner
    var banner = $WaveClearBanner
    banner.text = "WAVE %d CLEAR" % wave_number
    banner.visible = true
    
    var tween = create_tween()
    tween.tween_property(banner, "modulate:a", 1.0, 0.5)
    await get_tree().create_timer(2.0).timeout
    tween.tween_property(banner, "modulate:a", 0.0, 0.5)
```

---

## Success Criteria

- [ ] Enemy spawns are visible and clear
- [ ] Combat has satisfying feedback (hit/miss)
- [ ] Player understands arena boundaries
- [ ] Death is clear with easy respawn
- [ ] Victory is celebrated with feedback
- [ ] Complete core loop is playable start-to-finish

---

## Testing

1. **Play full game loop** multiple times
2. **Verify** all feedback is clear
3. **Check** win/loss states are obvious
4. **Get feedback** from fresh player
5. **Iterate** based on feedback

---

## Timebox

**Maximum Time**: 7 days

If not complete:
- Focus on clarity over polish
- Use simple visual feedback
- Ensure core loop is playable

---

## Next Phase

After core gameplay loop is solid:
→ Move to **Phase 4: Polish & Content**

---

**Status**: 📋 **READY TO START**
**Human Checkpoint**: Required before starting
