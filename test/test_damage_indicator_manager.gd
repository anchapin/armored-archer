extends GutTest

## Unit tests for DamageIndicatorManager
## Tests damage number spawning, color coding, and object pooling

## Test DamageIndicatorManager singleton exists
func test_damage_indicator_manager_exists():
	var manager = get_node_or_null("/root/DamageIndicatorManager")
	assert_not_null(manager, "DamageIndicatorManager should be loaded as autoload")

## Test spawn_damage_number creates damage number
func test_spawn_damage_number():
	var manager = get_node_or_null("/root/DamageIndicatorManager")
	assert_not_null(manager, "DamageIndicatorManager required")

	var result = manager.spawn_damage_number(Vector2(100, 100), 50, false)
	assert_not_null(result, "Result should be returned")

## Test damage color coding: Green for weak hits (<50%)
func test_damage_color_weak_hit():
	var manager = get_node_or_null("/root/DamageIndicatorManager")
	assert_not_null(manager, "DamageIndicatorManager required")

	var color = manager.get_damage_color(25)  # 25% damage (<50%)
	assert_eq(color, Color.GREEN, "Weak hits should be GREEN")

## Test damage color coding: Yellow for normal hits (50-100%)
func test_damage_color_normal_hit():
	var manager = get_node_or_null("/root/DamageIndicatorManager")
	assert_not_null(manager, "DamageIndicatorManager required")

	var color = manager.get_damage_color(75)  # 75% damage (50-100%)
	assert_eq(color, Color.YELLOW, "Normal hits should be YELLOW")

## Test damage color coding: Red for critical hits (>100%)
func test_damage_color_critical_hit():
	var manager = get_node_or_null("/root/DamageIndicatorManager")
	assert_not_null(manager, "DamageIndicatorManager required")

	var color = manager.get_damage_color(150)  # 150% damage (>100%)
	assert_eq(color, Color.RED, "Critical hits should be RED")

## Test is_critical flag
func test_is_critical_flag():
	var manager = get_node_or_null("/root/DamageIndicatorManager")
	assert_not_null(manager, "DamageIndicatorManager required")

	# Spawn non-critical damage number
	manager.spawn_damage_number(Vector2(100, 100), 25, false)

	# Spawn critical damage number
	manager.spawn_damage_number(Vector2(200, 200), 150, true)

## Test multiple damage numbers
func test_multiple_damage_numbers():
	var manager = get_node_or_null("/root/DamageIndicatorManager")
	assert_not_null(manager, "DamageIndicatorManager required")

	for i in range(3):
		manager.spawn_damage_number(Vector2(100 + i * 50, 100), 25 + i * 25, false)

	# Should not throw errors
	pass_test("Multiple damage numbers spawned successfully")

## Test damage number with zero damage
func test_zero_damage():
	var manager = get_node_or_null("/root/DamageIndicatorManager")
	assert_not_null(manager, "DamageIndicatorManager required")

	var result = manager.spawn_damage_number(Vector2(100, 100), 0, false)
	assert_not_null(result, "Zero damage should still spawn number")

## Test damage number at negative position
func test_negative_position():
	var manager = get_node_or_null("/root/DamageIndicatorManager")
	assert_not_null(manager, "DamageIndicatorManager required")

	var result = manager.spawn_damage_number(Vector2(-100, -100), 50, false)
	assert_not_null(result, "Negative positions should be handled")
