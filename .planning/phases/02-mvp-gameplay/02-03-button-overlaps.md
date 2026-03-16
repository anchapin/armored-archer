# Phase 2.3: Button Overlap Resolution

**Priority**: P0 - Critical
**Estimated Effort**: 3-5 hours
**Status**: 📋 Pending

---

## Problem

Buttons overlap each other or other UI elements, making them unusable or hard to click.

---

## Objectives

1. Fix all button overlap issues
2. Ensure proper touch target sizes
3. Add consistent spacing between buttons

---

## Tasks

### Task 2.3.1: Identify Button Issues

From the UI audit, list all button overlap issues:

**Common Problems**:
- [ ] Buttons stacked on top of each other
- [ ] Buttons cut off by screen edges
- [ ] Buttons overlapping text
- [ ] Buttons too small to tap
- [ ] Inconsistent button spacing

---

### Task 2.3.2: Define Button Standards

**Touch Target Size**:
- Minimum: 48x48 pixels (iOS/Android guideline)
- Recommended: 60x48 pixels for primary buttons
- Padding: 16px minimum between buttons

**Button Layout**:
```
Vertical Stack (VBoxContainer):
- Separation: 12px
- Alignment: Center or Fill
- Margins: 16px on sides

Horizontal Row (HBoxContainer):
- Separation: 16px
- Alignment: Center
- Stretch: Equal or Ratio
```

---

### Task 2.3.3: Fix Button Layouts

**Use Containers Instead of Manual Positioning**:

```gdscript
# BAD: Manual positioning (causes overlaps)
button1.position = Vector2(100, 200)
button2.position = Vector2(100, 220)  # Overlaps!

# GOOD: Use VBoxContainer
@onready var button_container: VBoxContainer = $VBoxContainer

func _ready() -> void:
    button_container.add_theme_constant_override("separation", 12)
    # Add buttons to container, not scene directly
    var play_button = Button.new()
    play_button.text = "Play"
    button_container.add_child(play_button)
    
    var settings_button = Button.new()
    settings_button.text = "Settings"
    button_container.add_child(settings_button)
```

**Scene Structure**:
```
MainMenu (Control)
├── Background (ColorRect)
├── VBoxContainer (Center Container)
│   ├── Title (Label)
│   ├── PlayButton (Button)
│   ├── SettingsButton (Button)
│   └── QuitButton (Button)
└── VersionLabel (Label, Bottom)
```

---

### Task 2.3.4: Fix Specific Button Issues

**Issue: Buttons Overlapping**
```gdscript
# Before: Overlapping buttons
# Button1 at y=200, height=40 → ends at y=240
# Button2 at y=220 → OVERLAPS by 20px!

# After: Proper spacing
# Button1 at y=200, height=40 → ends at y=240
# Spacing: 12px
# Button2 at y=252 (240 + 12) → NO OVERLAP
```

**Issue: Buttons Too Small**
```gdscript
# Before: 30x20 pixels (too small for touch)
button.custom_minimum_size = Vector2(30, 20)

# After: 160x48 pixels (good for touch)
button.custom_minimum_size = Vector2(160, 48)
```

**Issue: Buttons Cut Off**
```gdscript
# Use containers with proper anchors
@onready var container: VBoxContainer = $MarginContainer/VBoxContainer

func _ready() -> void:
    # Set anchors to keep within screen
    container.set_anchors_preset(Control.PRESET_CENTER)
    container.offset_left = -100
    container.offset_top = -50
    container.offset_right = 100
    container.offset_bottom = 50
```

---

### Task 2.3.5: Add Button Visual Feedback

```gdscript
# Button style for clarity
func _ready() -> void:
    var style = StyleBoxFlat.new()
    style.bg_color = Color("#3498DB")  # Blue
    style.set_corner_radius_all(8)
    
    var hover_style = StyleBoxFlat.new()
    hover_style.bg_color = Color("#2980B9")  # Darker blue
    hover_style.set_corner_radius_all(8)
    
    button.add_theme_stylebox_override("normal", style)
    button.add_theme_stylebox_override("hover", hover_style)
```

---

### Task 2.3.6: Test Button Functionality

**Test Checklist**:
- [ ] All buttons are fully visible
- [ ] No buttons overlap
- [ ] Buttons are touch-friendly (min 48px tall)
- [ ] Consistent spacing between buttons
- [ ] Buttons provide visual feedback on tap

---

## Success Criteria

- [ ] No button overlaps
- [ ] All buttons are easily clickable
- [ ] Consistent spacing throughout UI
- [ ] Buttons look intentional and polished

---

## Files to Modify

Will depend on audit. Common files:
| File | Changes |
|------|---------|
| `scenes/ui/main_menu.tscn` | Button layout |
| `scenes/ui/*.tscn` | Any scene with buttons |
| `scenes/ui/*.gd` | Button setup code |

---

## Testing

1. **Test each screen** with buttons
2. **Verify** no overlaps
3. **Check** touch target sizes
4. **Test** on actual device (not just editor)
5. **Screenshot** for documentation

---

## Timebox

**Maximum Time**: 5 hours

If not complete:
- Fix critical (unusable) buttons first
- Use Godot's built-in button themes
- Document remaining issues for later

---

## Next Phase

After buttons are fixed:
→ Move to **Phase 2.4: Touch Control Calibration**

---

**Status**: 📋 **READY TO START**
**Human Checkpoint**: Required before starting
