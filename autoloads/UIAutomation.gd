## UI Automation Manager
## Provides common UI animations and transitions
##
## Usage:
##   var ui_auto = UIAutomation.new()
##   ui_auto.fade_in(node, duration)
##   ui_auto.fade_out(node, duration, callback)
##   ui_auto.scale_in(node, duration)
##   ui_auto.slide_in(node, direction, duration)
##   ui_auto.pulse(node)
##
extends Node

# --- Singleton Instance ---
static var _instance: UIAutomation

# --- Animation Settings ---
const DEFAULT_DURATION: float = 0.3
const FAST_DURATION: float = 0.15
const SLOW_DURATION: float = 0.5

# --- Animation Curves ---
enum EasingType {
	EASE_OUT,      # Fast start, slow end (standard)
	EASE_IN,       # Slow start, fast end
	EASE_IN_OUT,   # Slow start, fast middle, slow end
	LINEAR,        # Constant speed
}

# --- Slide Directions ---
enum SlideDirection {
	LEFT,
	RIGHT,
	UP,
	DOWN,
}

# =============================================================================
# LIFECYCLE
# =============================================================================

func _ready() -> void:
	_instance = self

func _exit_tree() -> void:
	_instance = null

# =============================================================================
# STATIC ACCESS
# =============================================================================

static func get_instance() -> UIAutomation:
	if _instance == null:
		var auto = UIAutomation.new()
		# Add to scene tree if not already
		var root = Engine.get_main_loop().root
		root.add_child(auto)
	return _instance

# =============================================================================
# FADE ANIMATIONS
# =============================================================================

## Fade in a node (alpha 0 -> 1)
static func fade_in(node: Node, duration: float = DEFAULT_DURATION, easing: EasingType = EasingType.EASE_OUT) -> Tween:
	if node == null:
		return null
	
	var tween = node.create_tween()
	var ease = _get_ease_type(easing)
	
	# Set initial state
	node.modulate.a = 0.0
	if node is Control:
		node.visible = true
	
	# Fade in
	tween.tween_property(node, "modulate:a", 1.0, duration).set_ease(ease).set_trans(Tween.TRANS_SINE)
	
	return tween

## Fade out a node (alpha 1 -> 0)
static func fade_out(node: Node, duration: float = DEFAULT_DURATION, easing: EasingType = EasingType.EASE_IN, free_on_complete: bool = false) -> Tween:
	if node == null:
		return null
	
	var tween = node.create_tween()
	var ease = _get_ease_type(easing)
	
	# Set initial state
	node.modulate.a = 1.0
	
	# Fade out
	tween.tween_property(node, "modulate:a", 0.0, duration).set_ease(ease).set_trans(Tween.TRANS_SINE)
	
	if free_on_complete:
		tween.tween_callback(node.queue_free)
	
	return tween

# =============================================================================
# SCALE ANIMATIONS
# =============================================================================

## Scale in a node (scale 0 -> 1 with bounce)
static func scale_in(node: Node, duration: float = DEFAULT_DURATION, easing: EasingType = EasingType.EASE_OUT) -> Tween:
	if node == null:
		return null
	
	var tween = node.create_tween()
	var ease = _get_ease_type(easing)
	
	# Set initial state
	node.scale = Vector2.ZERO
	if node is Control:
		node.visible = true
	
	# Scale in with optional overshoot
	if easing == EasingType.EASE_OUT:
		# Elastic out effect
		tween.tween_property(node, "scale", Vector2.ONE, duration).set_ease(ease).set_trans(Tween.TRANS_ELASTIC)
	else:
		tween.tween_property(node, "scale", Vector2.ONE, duration).set_ease(ease).set_trans(Tween.TRANS_SINE)
	
	return tween

## Scale out a node (scale 1 -> 0)
static func scale_out(node: Node, duration: float = DEFAULT_DURATION, easing: EasingType = EasingType.EASE_IN, free_on_complete: bool = false) -> Tween:
	if node == null:
		return null
	
	var tween = node.create_tween()
	var ease = _get_ease_type(easing)
	
	# Set initial state
	node.scale = Vector2.ONE
	
	# Scale out
	tween.tween_property(node, "scale", Vector2.ZERO, duration).set_ease(ease).set_trans(Tween.TRANS_SINE)
	
	if free_on_complete:
		tween.tween_callback(node.queue_free)
	
	return tween

# =============================================================================
# SLIDE ANIMATIONS
# =============================================================================

## Slide in from direction
static func slide_in(node: Node, direction: SlideDirection, duration: float = DEFAULT_DURATION, easing: EasingType = EasingType.EASE_OUT) -> Tween:
	if node == null:
		return null
	
	var tween = node.create_tween()
	var ease = _get_ease_type(easing)
	
	# Calculate start position based on direction
	var screen_size = Engine.get_main_loop().root.get_visible_rect().size
	var offset: Vector2
	
	match direction:
		SlideDirection.LEFT:
			offset = Vector2(-screen_size.x, 0)
		SlideDirection.RIGHT:
			offset = Vector2(screen_size.x, 0)
		SlideDirection.UP:
			offset = Vector2(0, -screen_size.y)
		SlideDirection.DOWN:
			offset = Vector2(0, screen_size.y)
	
	# Set initial position
	node.position += offset
	if node is Control:
		node.visible = true
	
	# Slide to original position
	tween.tween_property(node, "position", node.position - offset, duration).set_ease(ease).set_trans(Tween.TRANS_SINE)
	
	return tween

## Slide out to direction
static func slide_out(node: Node, direction: SlideDirection, duration: float = DEFAULT_DURATION, easing: EasingType = EasingType.EASE_IN, free_on_complete: bool = false) -> Tween:
	if node == null:
		return null
	
	var tween = node.create_tween()
	var ease = _get_ease_type(easing)
	
	# Calculate end position based on direction
	var screen_size = Engine.get_main_loop().root.get_visible_rect().size
	var offset: Vector2
	
	match direction:
		SlideDirection.LEFT:
			offset = Vector2(-screen_size.x, 0)
		SlideDirection.RIGHT:
			offset = Vector2(screen_size.x, 0)
		SlideDirection.UP:
			offset = Vector2(0, -screen_size.y)
		SlideDirection.DOWN:
			offset = Vector2(0, screen_size.y)
	
	# Slide to end position
	tween.tween_property(node, "position", node.position + offset, duration).set_ease(ease).set_trans(Tween.TRANS_SINE)
	
	if free_on_complete:
		tween.tween_callback(node.queue_free)
	
	return tween

# =============================================================================
# PULSE ANIMATIONS
# =============================================================================

## Pulse animation (scale up then back)
static func pulse(node: Node, scale_factor: float = 1.1, duration: float = 0.15) -> Tween:
	if node == null:
		return null
	
	var tween = node.create_tween()
	var original_scale = node.scale
	
	# Pulse up
	tween.tween_property(node, "scale", original_scale * scale_factor, duration).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	# Pulse back
	tween.tween_property(node, "scale", original_scale, duration).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_SINE)
	
	return tween

## Continuous shake animation
static func shake(node: Node, intensity: float = 5.0, duration: float = 0.3) -> Tween:
	if node == null:
		return null
	
	var tween = node.create_tween()
	var original_position = node.position
	
	# Create shake effect
	var steps = int(duration / 0.05)
	for i in range(steps):
		var offset_x = randf_range(-intensity, intensity)
		var offset_y = randf_range(-intensity, intensity)
		var target_pos = original_position + Vector2(offset_x, offset_y)
		tween.tween_property(node, "position", target_pos, 0.05)
	
	# Return to original position
	tween.tween_property(node, "position", original_position, 0.05)
	
	return tween

# =============================================================================
# BUTTON HOVER ANIMATIONS
# =============================================================================

## Animate button hover (scale up slightly)
static func button_hover_in(button: Control) -> Tween:
	if button == null:
		return null
	
	var tween = button.create_tween()
	tween.tween_property(button, "scale", Vector2(1.05, 1.05), 0.1).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	return tween

## Animate button hover out (scale back)
static func button_hover_out(button: Control) -> Tween:
	if button == null:
		return null
	
	var tween = button.create_tween()
	tween.tween_property(button, "scale", Vector2.ONE, 0.1).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	return tween

## Animate button press (scale down then back)
static func button_press(button: Control) -> Tween:
	if button == null:
		return null
	
	var tween = button.create_tween()
	tween.tween_property(button, "scale", Vector2(0.95, 0.95), 0.05).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	tween.tween_property(button, "scale", Vector2.ONE, 0.1).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	return tween

# =============================================================================
# NUMBER COUNTER ANIMATION
# =============================================================================

## Animate number change (count up/down)
static func animate_number(label: Label, from_value: int, to_value: int, duration: float = 0.5) -> Tween:
	if label == null:
		return null
	
	var tween = label.create_tween()
	
	# Create a custom tweener for counting
	var counter = { "value": from_value }
	tween.tween_property(counter, "value", to_value, duration).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	tween.tween_callback(func(): label.text = str(counter["value"]))
	
	# Update label each frame
	var update_tween = label.create_tween()
	update_tween.set_loops()
	update_tween.tween_callback(func():
		if counter["value"] != to_value:
			label.text = str(roundi(counter["value"]))
	)
	
	return tween

# =============================================================================
# SCREEN TRANSITION
# =============================================================================

## Create a fade-to-color screen transition
static func screen_fade(color: Color, duration: float = 0.3, callback: Callable = Callable()) -> void:
	var root = Engine.get_main_loop().root
	
	# Create overlay
	var overlay = ColorRect.new()
	overlay.color = color
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.modulate.a = 0.0
	root.add_child(overlay)
	
	var tween = overlay.create_tween()
	
	# Fade to color
	tween.tween_property(overlay, "modulate:a", 1.0, duration / 2.0).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_SINE)
	
	if callback.is_valid():
		tween.tween_callback(callback)
	
	# Fade from color
	tween.tween_property(overlay, "modulate:a", 0.0, duration / 2.0).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	tween.tween_callback(overlay.queue_free)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

static func _get_ease_type(easing: EasingType) -> Tween.EaseType:
	match easing:
		EasingType.EASE_OUT:
			return Tween.EASE_OUT
		EasingType.EASE_IN:
			return Tween.EASE_IN
		EasingType.EASE_IN_OUT:
			return Tween.EASE_IN_OUT
		EasingType.LINEAR:
			return Tween.EASE_IN_OUT  # Linear doesn't exist as ease type
		_:
			return Tween.EASE_OUT

## Check if animations are enabled (respects device performance)
static func are_animations_enabled() -> bool:
	var optimizer = Engine.get_main_loop().root.get_node_or_null("/root/UITransitionOptimizer")
	if optimizer:
		return optimizer.is_ui_animation_enabled()
	return true

## Get recommended duration based on device performance
static func get_recommended_duration() -> float:
	var optimizer = Engine.get_main_loop().root.get_node_or_null("/root/UITransitionOptimizer")
	if optimizer:
		return optimizer.get_transition_duration()
	return DEFAULT_DURATION
