# Phase 2.4: Touch Control Calibration

**Priority**: P0 - Critical
**Estimated Effort**: 2-4 hours
**Status**: 📋 Pending

---

## Problem

Touch controls (joysticks, buttons) may be misaligned, unresponsive, or interfere with game view.

---

## Objectives

1. Ensure touch controls are properly positioned
2. Calibrate joystick sensitivity
3. Prevent touch controls from blocking game view

---

## Tasks

### Task 2.4.1: Audit Touch Controls

**Files to Check**:
- `scenes/touch_ui.tscn`
- `scenes/virtual_joystick.tscn`
- `scripts/touch_ui.gd`
- `scripts/virtual_joystick.gd`

**Check For**:
- [ ] Joystick position on screen
- [ ] Joystick size (too small/large?)
- [ ] Button placement
- [ ] Touch deadzone settings
- [ ] Visual clarity of controls

---

### Task 2.4.2: Position Touch Controls

**Recommended Layout**:
```
Screen Layout:
┌─────────────────────────┐
│  [Game View]            │
│                         │
│                         │
│  [Left Stick]    [Fire] │
│  (Movement)     (Button)│
└─────────────────────────┘
```

**Implementation**:
```gdscript
# In touch_ui.gd
@onready var left_joystick: Control = $LeftJoystick
@onready var fire_button: Button = $FireButton

func _ready() -> void:
    # Position joysticks in bottom corners
    # Use anchors to stay in position on all screen sizes
    
    # Left joystick: bottom-left
    left_joystick.anchors_preset = Control.PRESET_BOTTOM_LEFT
    left_joystick.offset_left = 50
    left_joystick.offset_top = -150
    left_joystick.offset_right = 200
    left_joystick.offset_bottom = -50
    
    # Fire button: bottom-right
    fire_button.anchors_preset = Control.PRESET_BOTTOM_RIGHT
    fire_button.offset_left = -200
    fire_button.offset_top = -150
    fire_button.offset_right = -50
    fire_button.offset_bottom = -50
```

---

### Task 2.4.3: Calibrate Joystick Sensitivity

```gdscript
# In virtual_joystick.gd
@export var deadzone: float = 0.15  # Ignore small inputs
@export var max_distance: float = 50.0  # Max joystick travel
@export var sensitivity: float = 1.0  # Output multiplier

func _process(delta: float) -> void:
    var input_vector = get_input_vector()
    
    # Apply deadzone
    if input_vector.length() < deadzone:
        output_vector = Vector2.ZERO
    else:
        # Normalize and apply sensitivity
        output_vector = input_vector.normalized() * sensitivity
    
    # Output for player movement
    if has_node("../../Player"):
        var player = get_node("../../Player")
        player.set_movement_input(output_vector)
```

**Recommended Values**:
- **Deadzone**: 0.1-0.2 (prevents drift)
- **Sensitivity**: 0.8-1.2 (adjust to taste)
- **Max Distance**: 40-60 pixels

---

### Task 2.4.4: Add Touch Visual Feedback

```gdscript
# Make touch controls visible and clear
@onready var joystick_bg: ColorRect = $Joystick/Background
@onready var joystick_knob: ColorRect = $Joystick/Knob

func _ready() -> void:
    # Semi-transparent background
    joystick_bg.color = Color(1, 1, 1, 0.3)  # 30% white
    
    # Solid knob
    joystick_knob.color = Color(1, 1, 1, 0.8)  # 80% white
    
    # Add outline for visibility
    joystick_knob.modulate = Color("#3498DB")  # Blue tint
```

---

### Task 2.4.5: Prevent Touch from Blocking View

**Issue**: Touch UI layer blocking game view

**Solution**:
```gdscript
# In touch_ui.gd
func _ready() -> void:
    # Set mouse filter to ignore when not needed
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    
    # Or make touch areas only where controls are
    for child in get_children():
        if child is Control:
            child.mouse_filter = Control.MOUSE_FILTER_TOUCH
```

**Layering**:
```
CanvasLayer (z_index: 100)  ← Touch UI (on top, but transparent where needed)
├── LeftJoystick (touch only in joystick area)
├── RightJoystick (touch only in joystick area)
└── FireButton (touch only on button)

Node2D (z_index: 0)  ← Game world (visible everywhere else)
├── Player
├── Enemies
└── Arrows
```

---

### Task 2.4.6: Test Touch Controls

**Test Checklist**:
- [ ] Joysticks are in comfortable position
- [ ] Joystick sensitivity feels right
- [ ] Fire button is easy to tap
- [ ] Touch controls don't block game view
- [ ] Controls work on different screen sizes

---

## Success Criteria

- [ ] Touch controls are comfortably positioned
- [ ] Joystick sensitivity is calibrated
- [ ] Controls don't block game view
- [ ] Controls are clearly visible
- [ ] Works on different screen sizes

---

## Files to Modify

| File | Changes |
|------|---------|
| `scenes/touch_ui.tscn` | Control positioning |
| `scenes/touch_ui.gd` | Touch control logic |
| `scenes/virtual_joystick.tscn` | Joystick visuals |
| `scenes/virtual_joystick.gd` | Sensitivity calibration |

---

## Testing

1. **Test on actual device** (not just editor)
2. **Play for 5+ minutes** (comfort check)
3. **Test different hand positions**
4. **Verify** controls don't block view
5. **Adjust** sensitivity as needed

---

## Timebox

**Maximum Time**: 4 hours

If not complete:
- Use default Godot touch settings
- Focus on positioning over polish
- Document calibration issues for later

---

## Next Phase

After touch controls are calibrated:
→ Move to **Phase 2.5: Health Bar & Damage Popup Visibility**

---

**Status**: 📋 **READY TO START**
**Human Checkpoint**: Required before starting
