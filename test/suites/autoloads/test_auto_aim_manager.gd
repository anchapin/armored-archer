extends GutTest

# Auto-aim registry + targeting now lives in ShootingManager (issue #1660
# phase 4: the AutoAimManager autoload was folded into its sole consumer).
# The six-method targeting API below is the one production code exposes:
#   get_best_target, get_target_position, get_nearest_enemy, is_target_locked,
#   register_enemy, unregister_enemy.
var ShootingManagerClass = load("res://autoloads/ShootingManager.gd")
var _shooting: Node

func before_each():
	_shooting = ShootingManagerClass.new()
	add_child_autofree(_shooting)

func after_each():
	_shooting = null

func _make_enemy(world_pos: Vector2) -> Node2D:
	var enemy := Node2D.new()
	add_child_autofree(enemy)
	enemy.position = world_pos
	return enemy

func test_auto_aim_registry_initializes():
	assert_true(_shooting != null, "ShootingManager (with absorbed auto-aim) should instantiate")

func test_auto_aim_targeting_methods_exist():
	assert_true(_shooting.has_method("get_best_target"),
		"ShootingManager should expose get_best_target (from AutoAimManager)")
	assert_true(_shooting.has_method("get_target_position"),
		"ShootingManager should expose get_target_position (from AutoAimManager)")
	assert_true(_shooting.has_method("get_nearest_enemy"),
		"ShootingManager should expose get_nearest_enemy (from AutoAimManager)")
	assert_true(_shooting.has_method("is_target_locked"),
		"ShootingManager should expose is_target_locked (from AutoAimManager)")
	assert_true(_shooting.has_method("register_enemy"),
		"ShootingManager should expose register_enemy (from AutoAimManager)")
	assert_true(_shooting.has_method("unregister_enemy"),
		"ShootingManager should expose unregister_enemy (from AutoAimManager)")

func test_register_and_unregister_enemy():
	var enemy = _make_enemy(Vector2(100, 0))
	_shooting.register_enemy(enemy)
	assert_eq(_shooting.registered_enemies.size(), 1,
		"register_enemy should add the enemy to the registry")
	_shooting.unregister_enemy(enemy)
	assert_eq(_shooting.registered_enemies.size(), 0,
		"unregister_enemy should remove the enemy from the registry")

func test_register_enemy_ignores_duplicates_and_null():
	var enemy = _make_enemy(Vector2(100, 0))
	_shooting.register_enemy(enemy)
	_shooting.register_enemy(enemy)
	assert_eq(_shooting.registered_enemies.size(), 1,
		"registering the same enemy twice should not duplicate it")
	_shooting.register_enemy(null)
	assert_eq(_shooting.registered_enemies.size(), 1,
		"register_enemy(null) should be a no-op")

func test_unregister_enemy_tolerates_unknown_enemy():
	var enemy = _make_enemy(Vector2(100, 0))
	_shooting.unregister_enemy(enemy)
	assert_eq(_shooting.registered_enemies.size(), 0,
		"unregistering an unknown enemy should not add anything")

func test_get_best_target_finds_enemy_in_range_and_angle():
	var enemy = _make_enemy(Vector2(100, 0))
	_shooting.register_enemy(enemy)
	assert_eq(_shooting.get_best_target(Vector2.ZERO, Vector2.RIGHT), enemy,
		"get_best_target should return the enemy inside the aim cone")

func test_get_best_target_returns_null_without_enemies():
	assert_null(_shooting.get_best_target(Vector2.ZERO, Vector2.RIGHT),
		"get_best_target should return null when nothing is registered")

func test_get_best_target_ignores_out_of_range_enemy():
	var enemy = _make_enemy(Vector2(1000, 0))
	_shooting.register_enemy(enemy)
	assert_null(_shooting.get_best_target(Vector2.ZERO, Vector2.RIGHT),
		"get_best_target should return null beyond AIM_RANGE")

func test_get_best_target_ignores_enemy_outside_aim_angle():
	var enemy = _make_enemy(Vector2(100, 100))
	_shooting.register_enemy(enemy)
	assert_null(_shooting.get_best_target(Vector2.ZERO, Vector2.UP),
		"get_best_target should return null outside MAX_AIM_ANGLE")

func test_get_best_target_returns_null_for_zero_direction():
	var enemy = _make_enemy(Vector2(100, 0))
	_shooting.register_enemy(enemy)
	assert_null(_shooting.get_best_target(Vector2.ZERO, Vector2.ZERO),
		"get_best_target should return null for a zero aim direction")

func test_get_best_target_prefers_closest_enemy():
	var far_enemy = _make_enemy(Vector2(200, 0))
	var close_enemy = _make_enemy(Vector2(100, 0))
	_shooting.register_enemy(far_enemy)
	_shooting.register_enemy(close_enemy)
	assert_eq(_shooting.get_best_target(Vector2.ZERO, Vector2.RIGHT), close_enemy,
		"get_best_target should select the closest valid enemy")

func test_get_nearest_enemy_ignores_aim_angle():
	var enemy = _make_enemy(Vector2(100, 100))
	_shooting.register_enemy(enemy)
	assert_eq(_shooting.get_nearest_enemy(Vector2.ZERO), enemy,
		"get_nearest_enemy should ignore the aim direction")
	assert_null(_shooting.get_nearest_enemy(Vector2.ZERO + Vector2(0, 2000)),
		"get_nearest_enemy should return null when nothing is within AIM_RANGE")

func test_get_target_position_returns_enemy_position():
	var enemy = _make_enemy(Vector2(100, 50))
	_shooting.register_enemy(enemy)
	assert_eq(_shooting.get_target_position(Vector2.ZERO, Vector2.RIGHT), enemy.global_position,
		"get_target_position should return the target's world position")

func test_get_target_position_returns_zero_without_target():
	assert_eq(_shooting.get_target_position(Vector2.ZERO, Vector2.RIGHT), Vector2.ZERO,
		"get_target_position should return Vector2.ZERO when no target is locked")

func test_is_target_locked_reflects_aim_cone():
	var enemy = _make_enemy(Vector2(100, 0))
	_shooting.register_enemy(enemy)
	assert_true(_shooting.is_target_locked(Vector2.ZERO, Vector2.RIGHT),
		"is_target_locked should be true while an enemy is in the aim cone")
	assert_false(_shooting.is_target_locked(Vector2.ZERO, Vector2.UP),
		"is_target_locked should be false when the enemy is outside the aim cone")
