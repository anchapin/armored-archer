# Phase 03-03 Research: Tween-based UI Polish & Micro-interactions

## Overview
Research document for implementing button feedback and loading state animations in Armored Archer. This builds on existing infrastructure (AnimationUtils, UITransitionOptimizer, DesignTokens) to provide polished UI interactions.

---

## 1. Tween-based Animation Patterns for Godot UI

### 1.1 Core Tween Patterns

#### Pattern: Chained Tween Sequences
```gdscript
# Sequential animations using await
var tween := node.create_tween()
tween.tween_property(node, "position", target_pos, duration)
await tween.finished
# Continue with next animation
```

#### Pattern: Parallel Tween Execution
```gdscript
# Multiple properties animate simultaneously
var tween := node.create_tween()
tween.parallel().tween_property(node, "scale", Vector2.ONE * 1.1, duration)
tween.parallel().tween_property(node, "modulate:a", 0.8, duration)
```

#### Pattern: Callback Chains
```gdscript
# Execute callbacks at specific points
var tween := node.create_tween()
tween.tween_callback(on_start)
tween.tween_property(node, "position", target, duration)
tween.tween_callback(on_complete)
```

### 1.2 Easing Curves Reference
Godot 4.x provides built-in transitions:

| Transition | Feel | Use Case |
|------------|------|----------|
| `TRANS_LINEAR` | Constant | Loading spinners |
| `TRANS_SINE` | Smooth start/end | Fades, subtle motion |
| `TRANS_QUAD` | Moderate ease | General UI |
| `TRANS_CUBIC` | Pronounced | Slides, transitions |
| `TRANS_BACK` | Overshoot | Button press, bounces |
| `TRANS_ELASTIC` | Bouncy | Special effects |
| `TRANS_BOUNCE` | Spring | Error shake |

**Easing values** (affects curve shape):
- `EASE_IN`: Slow start, fast end
- `EASE_OUT`: Fast start, slow end  
- `EASE_IN_OUT`: Slow start and end

### 1.3 Integration with Design Tokens
Current design tokens in `autoloads/design_tokens.gd`:

```gdscript
# Animation durations
ANIM_DURATION_INSTANT := 0.0
ANIM_DURATION_FAST := 0.1
ANIM_DURATION_NORMAL := 0.2
ANIM_DURATION_SLOW := 0.3
ANIM_DURATION_SLOWER := 0.5

# Easing values
ANIM_EASE_OUT := 0.25      # Cubic ease-out
ANIM_EASE_IN_OUT := 0.42  # Cubic ease-in-out
```

**Recommended pattern for consistent animations:**
```gdscript
var tween := node.create_tween()
tween.tween_property(node, "property", target, 
    ArcherDesignTokens.ANIM_DURATION_NORMAL).set_ease(
    ArcherDesignTokens.ANIM_EASE_OUT).set_trans(Tween.TRANS_SINE)
```

### 1.4 AnimationUtils Enhancement Recommendations
Current utilities in `autoloads/AnimationUtils.gd` cover:
- `fade_in()` / `fade_out()`
- `scale_bounce()`
- `slide_in()`
- `pulse()`
- `scale_down()` / `scale_up()`

**Suggested additions for 03-03:**
```gdscript
## Shake effect for errors
static func shake(node: Node, intensity: float = 5.0) -> Tween:
    var tween := node.create_tween()
    var original_x := node.position.x
    tween.tween_property(node, "position:x", original_x - intensity, 0.05)
    tween.tween_property(node, "position:x", original_x + intensity, 0.05)
    tween.tween_property(node, "position:x", original_x - intensity * 0.5, 0.05)
    tween.tween_property(node, "position:x", original_x, 0.05)
    return tween

## Color flash for feedback
static func flash(node: Node, flash_color: Color, duration: float = 0.2) -> Tween:
    var tween := node.create_tween()
    var original_modulate := node.modulate
    tween.tween_property(node, "modulate", flash_color, duration * 0.5)
    tween.tween_property(node, "modulate", original_modulate, duration * 0.5)
    return tween

## Sequential stagger animation for lists
static func stagger_in(nodes: Array, stagger_delay: float = 0.05) -> Tween:
    var tween := node.create_tween()
    for i in nodes.size():
        var child := nodes[i]
        child.modulate.a = 0.0
        child.position.y += 20  # Start slightly below
        tween.tween_property(child, "modulate:a", 1.0, 0.2).set_delay(i * stagger_delay)
        tween.parallel().tween_property(child, "position:y", child.position.y - 20, 0.2).set_delay(i * stagger_delay)
    return tween
```

---

## 2. Screen Transition Approaches

### 2.1 Existing Infrastructure
`autoloads/UITransitionOptimizer.gd` provides:
- `transition_to_scene()` - Fade transition with device tier support
- `slide_transition_to()` - Slide + fade for menu navigation
- `show_dialog()` - Scale + fade for popups

**Device tier behavior:**
| Device | Duration | Fade | Particles |
|--------|----------|------|-----------|
| Budget | 0.15s | ❌ | ❌ |
| Mid-range | 0.25s | ✅ | ✅ |
| Flagship | 0.30s | ✅ | ✅ |

### 2.2 Transition Types Reference

#### Fade Transition (Recommended for scene changes)
```gdscript
func fade_transition(duration: float = 0.3) -> void:
    var canvas := get_tree().current_scene.get_node_or_null("CanvasLayer")
    if not canvas:
        canvas = CanvasLayer.new()
        get_tree().current_scene.add_child(canvas)
    
    var cover := ColorRect.new()
    cover.color = Color.BLACK
    cover.set_anchors_preset(Control.PRESET_FULL_RECT)
    canvas.add_child(cover)
    cover.modulate.a = 0.0
    
    var tween := cover.create_tween()
    tween.tween_property(cover, "modulate:a", 1.0, duration * 0.5)
    await tween.finished
    # Scene change happens here
    tween = cover.create_tween()
    tween.tween_property(cover, "modulate:a", 0.0, duration * 0.5)
    await tween.finished
    cover.queue_free()
```

#### Slide Transition (Recommended for menu navigation)
```gdscript
func slide_transition(direction: String = "left", duration: float = 0.3) -> void:
    var current := get_tree().current_scene
    var viewport := get_viewport_rect()
    var offset := viewport.size.x
    
    if direction == "right":
        offset = -offset
    
    # Slide out
    var out_tween := current.create_tween()
    out_tween.tween_property(current, "position:x", offset, duration)
    out_tween.parallel().tween_property(current, "modulate:a", 0.0, duration)
    await out_tween.finished
    # Change scene
    # Slide in new scene from opposite direction
```

#### Crossfade Transition (For overlay screens)
```gdscript
func crossfade_transition(new_scene: PackedScene, duration: float = 0.5) -> void:
    var current := get_tree().current_scene
    var new_instance := new_scene.instantiate()
    get_tree().root.add_child(new_instance)
    new_instance.modulate.a = 0.0
    
    var tween := new_instance.create_tween()
    tween.tween_property(new_instance, "modulate:a", 1.0, duration)
    tween.parallel().tween_property(current, "modulate:a", 0.0, duration)
    await tween.finished
    
    get_tree().current_scene = new_instance
    current.queue_free()
```

### 2.3 Transition Recommendations for Phase 03-03
Based on existing UITransitionOptimizer:
1. **Menu → Game**: Use fade transition (0.3s flagship, 0.15s budget)
2. **Menu → Menu**: Use slide transition
3. **Dialogs**: Use scale + fade (already implemented)
4. **Lists/Grids**: Use stagger-in animation

---

## 3. Button Feedback Patterns

### 3.1 Current Implementation
`scenes/ui/components/base_button.gd` already has:
- State enum: NORMAL, HOVER, PRESSED, DISABLED, FOCUSED
- Color state management via `_get_colors_for_type()`
- Basic scale animation on hover (`_play_hover_anim`)
- Press animation with scale down (`_play_press_anim`)

### 3.2 Enhanced Button Patterns

#### Multi-stage Press Animation
```gdscript
func _play_enhanced_press_anim() -> void:
    var tween := create_tween()
    # Stage 1: Quick scale down
    tween.tween_property(self, "scale", Vector2.ONE * 0.92, 0.05).set_ease(Tween.EASE_OUT)
    # Stage 2: Hold briefly
    tween.tween_interval(0.03)
    # Stage 3: Spring back with overshoot
    tween.tween_property(self, "scale", Vector2.ONE, 0.2).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
```

#### Ripple Effect (Touch feedback)
```gdscript
func _create_ripple(event_position: Vector2) -> void:
    var ripple := ColorRect.new()
    ripple.color = Color.WHITE
    ripple.set_anchors_preset(Control.PRESET_FULL_RECT)
    ripple.modulate.a = 0.3
    
    add_child(ripple)
    ripple.position = event_position - size / 2
    ripple.size = size * 2  # Oversize to cover button
    
    var tween := ripple.create_tween()
    tween.tween_property(ripple, "modulate:a", 0.0, 0.4)
    tween.tween_property(ripple, "scale", Vector2.ONE * 1.5, 0.4)
    tween.tween_callback(ripple.queue_free)
```

#### Icon Animation
```gdscript
func _animate_icon(anim_type: String) -> void:
    if not has_node("Icon"):
        return
    var icon := $Icon
    var tween := icon.create_tween()
    
    match anim_type:
        "success":
            tween.tween_property(icon, "rotation", deg_to_rad(360), 0.3)
            tween.tween_property(icon, "scale", Vector2.ONE * 1.2, 0.15)
            tween.tween_property(icon, "scale", Vector2.ONE, 0.15)
        "error":
            tween.tween_property(icon, "position:y", icon.position.y - 3, 0.05)
            tween.tween_property(icon, "position:y", icon.position.y + 3, 0.05)
            tween.tween_property(icon, "position:y", icon.position.y, 0.05)
```

### 3.3 State Transition Patterns

#### Disabled State Animation
```gdscript
func _animate_disabled(disabled: bool) -> void:
    var tween := create_tween()
    if disabled:
        tween.tween_property(self, "modulate:a", ArcherDesignTokens.OPACITY_DISABLED, 0.2)
        tween.parallel().tween_property(self, "scale", Vector2.ONE * 0.95, 0.2)
    else:
        tween.tween_property(self, "modulate:a", 1.0, 0.2)
        tween.parallel().tween_property(self, "scale", Vector2.ONE, 0.2)
```

#### Toggle State Animation
```gdscript
func _animate_toggle(toggled: bool) -> void:
    var tween := create_tween()
    if toggled:
        tween.tween_property(self, "scale", Vector2.ONE * 1.05, 0.1)
        tween.tween_property(self, "scale", Vector2.ONE, 0.15).set_trans(Tween.TRANS_BACK)
    else:
        tween.tween_property(self, "scale", Vector2.ONE * 0.95, 0.1)
        tween.tween_property(self, "scale", Vector2.ONE, 0.15).set_trans(Tween.TRANS_BACK)
```

### 3.4 Button Loading State (Priority for 03-03)
```gdscript
var _is_loading: bool = false
var _loading_indicator: Control = null
var _original_text: String = ""

func set_loading(loading: bool) -> void:
    _is_loading = loading
    
    if loading:
        _show_loading_state()
    else:
        _hide_loading_state()

func _show_loading_state() -> void:
    _original_text = text
    disabled = true
    
    # Create inline loading indicator
    _loading_indicator = _create_spinner()
    add_child(_loading_indicator)
    _loading_indicator.position = size / 2 - Vector2(12, 12)
    _loading_indicator.start()
    
    # Animate button appearance
    var tween := create_tween()
    tween.tween_property(self, "modulate:a", 0.7, 0.2)

func _hide_loading_state() -> void:
    disabled = false
    
    if _loading_indicator:
        _loading_indicator.stop()
        _loading_indicator.queue_free()
        _loading_indicator = null
    
    text = _original_text
    
    var tween := create_tween()
    tween.tween_property(self, "modulate:a", 1.0, 0.2)

func _create_spinner() -> Control:
    # Reuse loading_indicator component or create inline
    var spinner := Control.new()
    # Configure minimal spinner inline
    return spinner
```

---

## 4. Loading Indicator Implementation Patterns

### 4.1 Existing Implementation
`scenes/ui/components/loading_indicator.gd` provides:
- Circular spinner using ProgressBar
- Rotation-based animation in `_process()`
- Fade in/out transitions
- Fullscreen overlay mode

### 4.2 Animation Styles (Enhanced for 03-03)

#### Style 1: Spinner (Current - Rotation-based)
```gdscript
# Optimized version using _process
func _animate_spinner() -> void:
    _rotation += delta * rotation_speed * TAU
    _spinner.rotation = _rotation
```

#### Style 2: Pulse (Scale-based)
```gdscript
func _animate_pulse() -> void:
    var tween := create_tween().set_loops()
    tween.tween_property(_spinner, "scale", Vector2.ONE * 1.2, 0.5)
    tween.tween_property(_spinner, "scale", Vector2.ONE * 0.8, 0.5)
```

#### Style 3: Dots (Sequential scale)
```gdscript
# Requires 3 dot nodes
func _animate_dots() -> void:
    var tween := create_tween().set_loops()
    # Dot 1
    tween.tween_property(_dot1, "scale", Vector2.ONE * 1.3, 0.2)
    tween.tween_property(_dot1, "scale", Vector2.ONE, 0.2)
    tween.tween_interval(0.1)
    # Dot 2
    tween.tween_property(_dot2, "scale", Vector2.ONE * 1.3, 0.2)
    tween.tween_property(_dot2, "scale", Vector2.ONE, 0.2)
    tween.tween_interval(0.1)
    # Dot 3
    tween.tween_property(_dot3, "scale", Vector2.ONE * 1.3, 0.2)
    tween.tween_property(_dot3, "scale", Vector2.ONE, 0.2)
    tween.tween_interval(0.3)  # Longer pause before loop
```

#### Style 4: Progress Bar (Determinate)
```gdscript
func _animate_progress() -> void:
    var tween := create_tween().set_loops()
    tween.tween_property(_progress_bar, "value", 100.0, 1.0).set_trans(Tween.TRANS_LINEAR)
    tween.tween_property(_progress_bar, "value", 0.0, 0.0)  # Reset
```

### 4.3 Integration with Design Tokens
```gdscript
# In loading_indicator.gd
func _get_animation_duration() -> float:
    return ArcherDesignTokens.ANIM_DURATION_SLOWER

func _get_ease() -> int:
    return ArcherDesignTokens.ANIM_EASE_OUT
```

### 4.4 Loading State Enum Pattern
```gdscript
enum LoadingState { IDLE, LOADING, SUCCESS, ERROR }

var _state: LoadingState = LoadingState.IDLE

func set_state(new_state: LoadingState) -> void:
    _state = new_state
    match _state:
        LoadingState.IDLE:
            stop()
            _show_idle_state()
        LoadingState.LOADING:
            _show_loading_state()
            start()
        LoadingState.SUCCESS:
            stop()
            _show_success_anim()
        LoadingState.ERROR:
            stop()
            _show_error_anim()
```

### 4.5 Memory Management
```gdscript
func _stop_animation() -> void:
    if _tween and is_instance_valid(_tween):
        _tween.kill()
        _tween = null
    
    # Stop process-based animation
    _is_animating = false

func _exit_tree() -> void:
    _stop_animation()  # Ensure cleanup
```

---

## 5. Mobile Performance Considerations

### 5.1 FPS Targets
- **Flagship**: 60 FPS, full animations
- **Mid-range**: 60 FPS, reduced particles
- **Budget**: 30-60 FPS, minimal animations

### 5.2 Device Detection Integration
```gdscript
func _should_animate() -> bool:
    if not has_node("/root/PerformanceProfiler"):
        return true
    return not PerformanceProfiler.is_budget_device()
```

### 5.3 Animation Optimization Techniques

#### Use `set_loops()` instead of recursive tweens
```gdscript
# ❌ Recursive (creates new tween each iteration)
func _animate() -> void:
    var tween := create_tween()
    tween.tween_property(...)
    tween.tween_callback(_animate)  # New tween each time

# ✅ Loop-based (single tween)
func _animate() -> void:
    var tween := create_tween().set_loops()
    tween.tween_property(...)
```

#### Kill existing tweens before starting new ones
```gdscript
func start_new_animation() -> void:
    if _existing_tween and is_instance_valid(_existing_tween):
        _existing_tween.kill()
    _existing_tween = create_tween()
    # ...
```

#### Use `await` instead of timers for sequenced animations
```gdscript
# ❌ Timer-based
func wait_then_continue() -> void:
    await get_tree().create_timer(0.5).timeout
    # Continue

# ✅ Tween-based (more precise)
func wait_then_continue() -> void:
    var tween := create_tween()
    tween.tween_interval(0.5)
    await tween.finished
    # Continue
```

#### Batch property changes with parallel tweens
```gdscript
# ❌ Sequential
var tween := create_tween()
tween.tween_property(node, "position", target, 0.3)
tween.tween_property(node, "scale", scale_target, 0.3)  # Waits for position

# ✅ Parallel
var tween := create_tween()
tween.parallel().tween_property(node, "position", target, 0.3)
tween.parallel().tween_property(node, "scale", scale_target, 0.3)  # Runs concurrently
```

### 5.4 Touch Input Considerations
- **Touch feedback**: Immediate visual response on touch (not wait for tap)
- **Long-press support**: Detect for context menus
- **Multi-touch**: Handle simultaneous touches gracefully

```gdscript
func _input(event: InputEvent) -> void:
    if event is InputEventScreenTouch:
        if event.pressed:
            _on_touch_pressed(event.position)
        else:
            _on_touch_released(event.position)
```

### 5.5 Safe Area Considerations
Already implemented via `autoloads/SafeAreaManager.gd`. Animation endpoints should account for safe areas.

---

## 6. Design Token Integration Suggestions

### 6.1 Current Token Coverage
The design tokens provide:
- Colors: PRIMARY, SECONDARY, SUCCESS, WARNING, ERROR with state variants
- Typography: Font sizes, scales
- Spacing: XXS through 3XL
- Corner radius: SM through FULL
- Animation: Durations and easing values
- Opacity: Disabled, hidden, transparent

### 6.2 Suggested Token Additions

#### Animation Tokens
```gdscript
## Easing presets (Tween transition constants)
const ANIM_TRANSITION_DEFAULT := Tween.TRANS_SINE
const ANIM_TRANSITION_BOUNCE := Tween.TRANS_BOUNCE
const ANIM_TRANSITION_ELASTIC := Tween.TRANS_ELASTIC

## Easing presets (Tween ease constants)
const ANIM_EASE_DEFAULT := Tween.EASE_OUT
const ANIM_EASE_GENTLE := Tween.EASE_IN_OUT
```

#### Button Tokens
```gdscript
## Button specific
const BUTTON_SCALE_HOVER := 1.05
const BUTTON_SCALE_PRESSED := 0.95
const BUTTON_SCALE_TOGGLE := 1.08
const BUTTON_OPACITY_LOADING := 0.7
```

#### Loading Tokens
```gdscript
## Loading indicators
const LOADING_ROTATION_SPEED := 2.0  # rotations per second
const LOADING_PULSE_SCALE := 0.15    # scale delta for pulse
const LOADING_DOT_COUNT := 3
const LOADING_DOT_STAGGER := 0.15     # seconds between dot animations
```

### 6.3 Integration Pattern
```gdscript
# In base_button.gd
func _play_hover_anim(is_hovering: bool) -> void:
    var target_scale := Vector2.ONE * ArcherDesignTokens.BUTTON_SCALE_HOVER if is_hovering else Vector2.ONE
    
    var tween := create_tween()
    tween.tween_property(self, "scale", target_scale, 
        ArcherDesignTokens.ANIM_DURATION_FAST).set_ease(
        ArcherDesignTokens.ANIM_EASE_OUT).set_trans(
        ArcherDesignTokens.ANIM_TRANSITION_DEFAULT)
```

---

## 7. Implementation Recommendations Summary

### Priority 1: Loading State for Buttons
1. Add `set_loading(bool)` method to base_button.gd
2. Create inline spinner or reference loading_indicator
3. Disable button during loading
4. Restore state on completion

### Priority 2: Loading Indicator Styles
1. Add AnimationStyle enum (SPINNER, PULSE, DOTS)
2. Implement switch logic in loading_indicator.gd
3. Add tween cleanup in _stop_animation()
4. Use design tokens for durations

### Priority 3: Enhanced Button Feedback
1. Add ripple effect for touch
2. Improve press animation with overshoot
3. Add success/error icon animations
4. Ensure disabled state animation

### Priority 4: Network Interaction Updates
1. Find async operations in main_menu.gd
2. Find async operations in login_screen.gd
3. Find async operations in store_menu.gd
4. Apply set_loading(true/false) around network calls

### Performance Checklist
- [ ] Use device tier to enable/disable animations
- [ ] Kill existing tweens before starting new ones
- [ ] Use set_loops() for repeating animations
- [ ] Use parallel() for concurrent property changes
- [ ] Clean up in _exit_tree()
- [ ] Test on budget device target (30 FPS)

---

## 8. References

### Godot 4.x Tween Documentation
- `Tween` class: https://docs.godotengine.org/en/stable/classes/class_tween.html
- `create_tween()`: https://docs.godotengine.org/en/stable/classes/class_node.html#class-node-method-create-tween

### Related Project Files
- `autoloads/AnimationUtils.gd` - Base animation utilities
- `autoloads/design_tokens.gd` - Design constants
- `autoloads/UITransitionOptimizer.gd` - Scene transitions
- `scenes/ui/components/base_button.gd` - Button component
- `scenes/ui/components/loading_indicator.gd` - Loading indicator
- `autoloads/SafeAreaManager.gd` - Safe area handling
- `autoloads/PerformanceProfiler.gd` - Device tier detection

---

*Research completed for Phase 03-03: UI Polish & Micro-interactions*
*Last updated: Based on current codebase state*