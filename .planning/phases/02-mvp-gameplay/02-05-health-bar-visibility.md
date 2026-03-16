# Phase 2.5: Health Bar & Damage Popup Visibility

**Priority**: P0 - Critical
**Estimated Effort**: 2-3 hours
**Status**: 📋 Pending

---

## Problem

Health bars and damage numbers are hard to see, making combat feedback unclear.

---

## Objectives

1. Make health bars clearly visible
2. Ensure damage popups are readable
3. Add visual feedback for low health

---

## Tasks

### Task 2.5.1: Audit Health Bars

**Files to Check**:
- `scenes/ui/health_bar.tscn`
- `scenes/ui/boss_health_bar.tscn`
- Any enemy health bar components

**Check For**:
- [ ] Health bar visibility against background
- [ ] Color contrast (health bar vs background)
- [ ] Size (too small?)
- [ ] Position (in view?)
- [ ] Update smoothness

---

### Task 2.5.2: Fix Health Bar Visibility

```gdscript
# In health_bar.gd
@onready var health_bar: ProgressBar = $HealthBar
@onready var health_bar_bg: TextureProgressBar = $HealthBar/Background

func _ready() -> void:
    # Make health bar larger and more visible
    health_bar.custom_minimum_size = Vector2(200, 30)
    
    # High contrast colors
    health_bar.add_theme_color_override("fill", Color("#2ECC71"))  # Bright green
    health_bar.add_theme_color_override("background", Color("#2C3E50"))  # Dark background
    
    # Add outline/shadow for visibility
    var style = StyleBoxFlat.new()
    style.bg_color = Color("#2C3E50")
    style.set_corner_radius_all(5)
    style.set_border_width_all(2)
    style.border_color = Color("#000000")  # Black border
    health_bar.add_theme_stylebox_override("background", style)
```

**Health Bar Colors**:
- **Player Health**: Green (#2ECC71)
- **Enemy Health**: Red (#E74C3C)
- **Boss Health**: Purple/Orange (#8E44AD or #D35400)
- **Low Health Warning**: Flashing Red (#C0392B)

---

### Task 2.5.3: Add Low Health Warning

```gdscript
@export var low_health_threshold: float = 0.3  # 30% health

func update_health(current: float, max_health: float) -> void:
    var health_percent = current / max_health
    health_bar.value = health_percent * 100
    
    # Low health warning
    if health_percent < low_health_threshold:
        # Flash red
        var tween = create_tween()
        tween.tween_property(health_bar, "modulate", Color("#FF0000"), 0.3)
        tween.tween_property(health_bar, "modulate", Color.WHITE, 0.3)
        tween.set_loops()
```

---

### Task 2.5.4: Fix Damage Popup Visibility

```gdscript
# In damage_popup.gd or damage_popup.tscn
@onready var label: Label = $Label

func _ready() -> void:
    # Large, readable text
    label.add_theme_font_size_override("font_size", 24)
    label.add_theme_color_override("font_color", Color.WHITE)
    
    # Add outline for visibility
    var font = label.get_theme_font("font")
    # If using BitmapFont, ensure it has outline
    
    # Or add outline manually
    var outline = Label.new()
    outline.text = label.text
    outline.add_theme_color_override("font_color", Color("#000000"))
    outline.position = Vector2(1, 1)  # Offset for outline effect
    add_child(outline)

func show_damage(amount: int, position: Vector2) -> void:
    global_position = position
    label.text = str(amount)
    
    # Animate popup
    var tween = create_tween()
    tween.tween_property(self, "position:y", position.y - 50, 0.5)  # Float up
    tween.tween_property(self, "modulate:a", 0.0, 0.3)  # Fade out
    tween.tween_callback(queue_free)
```

**Damage Number Colors**:
- **Normal Damage**: White (#FFFFFF)
- **Critical Hit**: Yellow/Orange (#F1C40F)
- **Low Damage**: Grey (#95A5A6)

---

### Task 2.5.5: Spawn Damage Popups on Hit

```gdscript
# In enemy.gd or combat system
func take_damage(amount: int, hit_position: Vector2) -> void:
    health -= amount
    
    # Spawn damage popup
    var popup = preload("res://scenes/ui/damage_popup.tscn").instantiate()
    get_parent().add_child(popup)
    popup.show_damage(amount, hit_position)
    
    # Update health bar
    if has_node("HealthBar"):
        $HealthBar.update_health(health, max_health)
```

---

### Task 2.5.6: Test Health & Damage Visibility

**Test Checklist**:
- [ ] Health bars are visible against all backgrounds
- [ ] Health bar colors are clear and high-contrast
- [ ] Low health warning is noticeable
- [ ] Damage numbers are readable
- [ ] Damage numbers appear at correct position

---

## Success Criteria

- [ ] Health bars are clearly visible
- [ ] Health bar colors are high-contrast
- [ ] Low health warning is obvious
- [ ] Damage numbers are readable
- [ ] Combat feedback is clear

---

## Files to Modify

| File | Changes |
|------|---------|
| `scenes/ui/health_bar.tscn` | Health bar styling |
| `scenes/ui/health_bar.gd` | Health update logic |
| `scenes/ui/boss_health_bar.tscn` | Boss health bar |
| `scenes/ui/damage_popup.tscn` | Damage popup styling |
| `scenes/ui/damage_popup.gd` | Popup animation |
| `scenes/enemies/*.gd` | Spawn damage popups |

---

## Testing

1. **Take damage** multiple times
2. **Verify** health bar updates smoothly
3. **Check** damage numbers are readable
4. **Test** low health warning
5. **Screenshot** for documentation

---

## Timebox

**Maximum Time**: 3 hours

If not complete:
- Use simple colored rectangles for health bars
- Use plain text for damage numbers
- Focus on visibility over polish

---

## Phase 2 Completion

After health bars and damage popups are fixed:
→ **Phase 2: UX & UI Fixes** is COMPLETE
→ Move to **Phase 3: Core Gameplay Loop**

---

## Phase 2 Summary

**Completed**:
- ✅ UI Layout Audit & Documentation
- ✅ Modal Transparency Fixes
- ✅ Button Overlap Resolution
- ✅ Touch Control Calibration
- ✅ Health Bar & Damage Popup Visibility

**Result**: Game UI is now usable - no overlaps, readable text, functional controls

---

**Status**: 📋 **READY TO START**
**Human Checkpoint**: Required before starting
