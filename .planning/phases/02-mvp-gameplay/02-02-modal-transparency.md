# Phase 2.2: Modal Transparency Fixes

**Priority**: P0 - Critical
**Estimated Effort**: 2-4 hours
**Status**: 📋 Pending

---

## Problem

Modals and popups are transparent, making text unreadable and UI confusing.

---

## Objectives

1. Make all modals opaque
2. Ensure text is readable on modal backgrounds
3. Add proper visual hierarchy

---

## Tasks

### Task 2.2.1: Identify All Modals

**Common Modals**:
- [ ] Pause menu
- [ ] Settings popup
- [ ] Item tooltips
- [ ] Confirmation dialogs
- [ ] Level up screen
- [ ] Reward popups
- [ ] Error messages

**Search in Code**:
```bash
# Find modal/panel scenes
grep -r "Panel" scenes/ui/
grep -r "Modal" scenes/ui/
grep -r "Popup" scenes/ui/
```

---

### Task 2.2.2: Fix Modal Backgrounds

**Godot Panel Fix**:

```gdscript
# In modal script or scene
@onready var panel: Panel = $Panel

func _ready() -> void:
    # Set opaque background
    var style = StyleBoxFlat.new()
    style.bg_color = Color("#1A1A2E")  # Dark blue-black
    style.set_corner_radius_all(10)
    panel.add_theme_stylebox_override("panel", style)
    
    # Or if using ColorRect
    # $ColorRect.color = Color("#1A1A2E", 1.0)  # Fully opaque
```

**Color Recommendations**:
- **Dark Modal**: #1A1A2E (dark blue-black)
- **Medium Modal**: #2C3E50 (dark grey-blue)
- **Light Modal**: #ECF0F1 (light grey, for dark themes)

**Alpha Values**:
- Background: 1.0 (fully opaque)
- If semi-transparent needed: 0.95 minimum

---

### Task 2.2.3: Fix Text Contrast

```gdscript
# Ensure text is readable
@onready var title: Label = $Panel/VBoxContainer/Title
@onready var content: Label = $Panel/VBoxContainer/Content

func _ready() -> void:
    # High contrast text
    title.add_theme_color_override("font_color", Color.WHITE)
    content.add_theme_color_override("font_color", Color("#ECF0F1"))
    
    # Ensure font size is readable
    var font = title.get_theme_font("font")
    title.add_theme_font_size_override("font_size", 18)
    content.add_theme_font_size_override("font_size", 14)
```

**Text Color Guidelines**:
- Dark background → White/Light text
- Light background → Black/Dark text
- Minimum contrast ratio: 4.5:1

---

### Task 2.2.4: Add Modal Backdrop

For focus and visual hierarchy:

```gdscript
# Add semi-transparent backdrop behind modal
func show_modal() -> void:
    # Create backdrop
    var backdrop = ColorRect.new()
    backdrop.color = Color(0, 0, 0, 0.7)  # 70% black
    backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
    backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
    get_parent().add_child(backdrop)
    
    # Show modal on top
    modal.visible = true
    modal.z_index = 100
```

---

### Task 2.2.5: Test All Modals

**Test Checklist**:
- [ ] All modals are opaque or near-opaque
- [ ] Text is readable on all backgrounds
- [ ] Modal hierarchy is clear
- [ ] Backdrop appears behind modals
- [ ] Modals close properly

---

## Success Criteria

- [ ] No transparent modals
- [ ] All text is readable
- [ ] Visual hierarchy is clear
- [ ] Modals look intentional and polished

---

## Files to Modify

Will depend on audit results. Common files:
| File | Changes |
|------|---------|
| `scenes/ui/*.tscn` | Panel/ColorRect backgrounds |
| `scenes/ui/*.gd` | Background setup code |

---

## Testing

1. **Open each modal** in game
2. **Verify** text is readable
3. **Check** background opacity
4. **Test** modal close/reopen
5. **Screenshot** for documentation

---

## Timebox

**Maximum Time**: 4 hours

If not complete:
- Focus on most-used modals first
- Use solid colors instead of gradients
- Document remaining issues for later

---

## Next Phase

After modals are fixed:
→ Move to **Phase 2.3: Button Overlap Resolution**

---

**Status**: 📋 **READY TO START**
**Human Checkpoint**: Required before starting
