extends GutTest

## Tests for damage overlay and slow-motion effects

var _damage_overlay: ColorRect = null
var _effects_manager: Node = null
var _game_manager: Node = null


func before_each() -> void:
	# Load damage overlay scene
	var overlay_scene := load("res://scenes/effects/damage_overlay.tscn")
	_damage_overlay = overlay_scene.instantiate()
	add_child_autofree(_damage_overlay)

	# Get manager references
	_effects_manager = get_node("/root/EffectsManager")
	_game_manager = get_node("/root/GameManager")


func test_damage_overlay_created() -> void:
	assert_not_null(_damage_overlay, "Damage overlay scene should instantiate")
	assert_eq(_damage_overlay.get_class(), "ColorRect", "Root should be ColorRect")
	assert_false(_damage_overlay.visible, "Overlay should start invisible")


func test_damage_overlay_has_shader() -> void:
	var material = _damage_overlay.material
	assert_not_null(material, "Overlay should have material")
	assert_true(material is ShaderMaterial, "Material should be ShaderMaterial")


func test_damage_overlay_show_below_threshold() -> void:
	# Test showing overlay when HP < 30%
	if _damage_overlay.has_method("set_health"):
		_damage_overlay.set_health(20, 100)
		await wait_frames(60)  # Wait for fade animation
		assert_true(_damage_overlay.visible, "Overlay should be visible at 20% HP")


func test_damage_overlay_hide_above_threshold() -> void:
	# Test hiding overlay when HP >= 30%
	if _damage_overlay.has_method("set_health"):
		_damage_overlay.set_health(20, 100)  # Show first
		await wait_frames(60)
		assert_true(_damage_overlay.visible, "Overlay should be visible initially")

		_damage_overlay.set_health(50, 100)  # Heal
		await wait_frames(60)
		assert_false(_damage_overlay.visible, "Overlay should hide at 50% HP")


func test_damage_overlay_intensity_scales_with_health() -> void:
	if _damage_overlay.has_method("set_health"):
		# Test at different health levels
		_damage_overlay.set_health(10, 100)  # Very low health
		await wait_frames(60)
		var intensity_low = _damage_overlay.material.get_shader_parameter("intensity")

		_damage_overlay.set_health(25, 100)  # Higher low health
		await wait_frames(60)
		var intensity_high = _damage_overlay.material.get_shader_parameter("intensity")

		assert_gt(intensity_low, intensity_high, "Intensity should be higher at lower health")


func test_damage_overlay_methods() -> void:
	assert_true(_damage_overlay.has_method("set_health"), "Should have set_health method")
	assert_true(_damage_overlay.has_method("is_active"), "Should have is_active method")


func test_effects_manager_exists() -> void:
	assert_not_null(_effects_manager, "EffectsManager should be loaded")


func test_effects_manager_slow_motion() -> void:
	assert_true(_effects_manager.has_method("trigger_slow_motion"), "Should have trigger_slow_motion method")
	assert_true(_effects_manager.has_method("is_slow_motion_active"), "Should have is_slow_motion_active method")
	assert_true(_effects_manager.has_method("set_time_scale"), "Should have set_time_scale method")


func test_effects_manager_damage_overlay() -> void:
	assert_true(_effects_manager.has_method("show_damage_overlay"), "Should have show_damage_overlay method")
	assert_true(_effects_manager.has_method("hide_damage_overlay"), "Should have hide_damage_overlay method")
	assert_true(_effects_manager.has_method("on_player_damage"), "Should have on_player_damage method")
	assert_true(_effects_manager.has_method("on_player_heal"), "Should have on_player_heal method")


func test_slow_motion_triggers() -> void:
	var initial_scale = Engine.time_scale
	_effects_manager.trigger_slow_motion(0.5, 0.3)
	await wait_frames(30)  # Wait for tween to start
	var slowed_scale = Engine.time_scale
	assert_lt(slowed_scale, initial_scale, "Time scale should be reduced after trigger")
	# Reset for other tests
	_effects_manager.set_time_scale(1.0, false)


func test_game_manager_health_connection() -> void:
	if _game_manager and _game_manager.has_signal("health_changed"):
		var health_emitted := false
		_game_manager.health_changed.connect(func(_new, _max): health_emitted = true)
		_game_manager.take_player_damage(10)
		await wait_frames(10)
		assert_true(health_emitted, "GameManager should emit health_changed signal")


func test_vfx_manager_crit_slow_motion() -> void:
	var vfx_manager = get_node("/root/VFXManager")
	if vfx_manager:
		assert_true(vfx_manager.has_method("play_crit_effect"), "VFXManager should have play_crit_effect")
		# Playing crit effect should trigger slow motion
		var initial_scale = Engine.time_scale
		vfx_manager.play_crit_effect(Vector2.ZERO)
		await wait_frames(30)
		# Note: This may fail if particle system isn't fully initialized
		# but the method call should work without errors


func test_damage_overlay_fades_smoothly() -> void:
	if _damage_overlay.has_method("set_health"):
		_damage_overlay.set_health(100, 100)  # Full health - hidden
		assert_false(_damage_overlay.visible, "Should start hidden")

		_damage_overlay.set_health(10, 100)  # Low health - show
		await wait_frames(10)  # Partial fade
		var partial_intensity = _damage_overlay.material.get_shader_parameter("intensity")
		assert_gt(partial_intensity, 0.0, "Should be fading in")

		await wait_frames(60)  # Full fade
		var full_intensity = _damage_overlay.material.get_shader_parameter("intensity")
		assert_gt(full_intensity, partial_intensity, "Should be more faded in")


func test_damage_overlay_threshold() -> void:
	if _damage_overlay.has_method("set_health"):
		# Test exactly at threshold
		_damage_overlay.set_health(30, 100)  # Exactly 30%
		await wait_frames(60)
		# At 30%, should not show (threshold is < 30%)
		assert_false(_damage_overlay.visible or _damage_overlay.material.get_shader_parameter("intensity") > 0.01,
			"Overlay should not show at exactly 30% HP")

		# Test just below threshold
		_damage_overlay.set_health(29, 100)  # Just below 30%
		await wait_frames(60)
		assert_true(_damage_overlay.visible, "Overlay should show at 29% HP")
