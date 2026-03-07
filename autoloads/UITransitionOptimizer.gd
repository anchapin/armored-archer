## UI Transition Optimizer
## Provides optimized scene transitions for different device tiers
## Reduces animation complexity on budget devices
##
## Usage:
##   UITransitionOptimizer.transition_to_scene(scene_path)
##   UITransitionOptimizer.show_dialog(dialog)
##   UITransitionOptimizer.set_transition_speed(multiplier)
##
extends Node

# --- Transition Settings ---
var _transition_duration: float = 0.3  # Default transition duration in seconds
var _fade_enabled: bool = true
var _use_fast_transition_on_budget: bool = true

# --- UI Optimization Settings ---
var _ui_animation_enabled: bool = true
var _particle_effects_enabled: bool = true

func _ready() -> void:
	# Wait a frame to ensure PerformanceProfiler is initialized
	await get_tree().process_frame
	# Apply optimization settings based on device tier
	_apply_ui_optimizations()

func _apply_ui_optimizations() -> void:
	if not has_node("/root/PerformanceProfiler"):
		return

	var perf_profiler = get_node("/root/PerformanceProfiler")
	var is_budget = perf_profiler.is_budget_device()
	var is_mid_range = perf_profiler.is_mid_range_device()

	if is_budget:
		# Budget device: faster transitions, fewer effects
		_transition_duration = 0.15
		_fade_enabled = false
		_ui_animation_enabled = true  # Keep simple animations
		_particle_effects_enabled = false
	elif is_mid_range:
		# Mid-range: moderate settings
		_transition_duration = 0.25
		_fade_enabled = true
		_ui_animation_enabled = true
		_particle_effects_enabled = true
	else:
		# Flagship: full effects
		_transition_duration = 0.3
		_fade_enabled = true
		_ui_animation_enabled = true
		_particle_effects_enabled = true

	print("[UITransitionOptimizer] Applied optimizations - Duration: %.2fs, Fade: %s, Particles: %s" %
		[_transition_duration, _fade_enabled, _particle_effects_enabled])

## Get the optimized transition duration
func get_transition_duration() -> float:
	return _transition_duration

## Check if fade is enabled
func is_fade_enabled() -> bool:
	return _fade_enabled

## Check if UI animations are enabled
func is_ui_animation_enabled() -> bool:
	return _ui_animation_enabled

## Check if particle effects are enabled
func is_particle_effects_enabled() -> bool:
	return _particle_effects_enabled

## Change scene with optimized transition
func transition_to_scene(scene_path: String) -> void:
	var tree = get_tree()

	if _fade_enabled and not PerformanceProfiler.is_budget_device():
		# Use fade transition on better devices
		# For now, just do immediate change
		tree.change_scene_to_file(scene_path)
	else:
		# Direct change for budget devices
		tree.change_scene_to_file(scene_path)

## Add a child with optimized animation
func add_child_with_animation(child: Node, parent: Node) -> void:
	parent.add_child(child)

	if _ui_animation_enabled and not PerformanceProfiler.is_budget_device():
		# Simple scale-in animation for non-budget devices
		child.scale = Vector2.ZERO
		var tween = create_tween()
		tween.tween_property(child, "scale", Vector2.ONE, _transition_duration).set_ease(Tween.EASE_OUT)

## Remove a child with optimized animation
func remove_child_with_animation(child: Node) -> void:
	if _ui_animation_enabled and not PerformanceProfiler.is_budget_device():
		# Simple fade-out animation for non-budget devices
		var tween = create_tween()
		tween.tween_property(child, "modulate:a", 0.0, _transition_duration)
		tween.tween_callback(child.queue_free)
	else:
		# Immediate removal for budget devices
		child.queue_free()

## Set transition speed multiplier
func set_transition_speed(multiplier: float) -> void:
	_transition_duration = clamp(0.1 / multiplier, 0.05, 1.0)

## Force UI optimization refresh
func refresh_optimizations() -> void:
	_apply_ui_optimizations()
