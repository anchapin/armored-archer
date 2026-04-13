extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running Arrow Script Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_setup_basic()
	await test_setup_with_direction()
	await test_setup_normalizes_direction()
	await test_reset_pooled_state()
	await test_lifetime_timer()
	await test_rotation_based_on_direction()

	print("\n=== Arrow Script Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_arrow() -> Area2D:
	var arrow_script = load("res://scripts/arrow.gd")
	var arrow = Area2D.new()
	arrow.set_script(arrow_script)
	add_child(arrow)
	return arrow

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var arrow = _create_arrow()

	# Note: damage initial value is 50 (see arrow.gd)
	# pooled state resets damage to 25, tested separately
	if arrow.speed == 800.0 and arrow.damage == 50 and arrow.direction == Vector2.RIGHT and arrow.lifetime == 5.0 and not arrow.is_active:
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "Initial state should have default values (speed=800, damage=50, direction=RIGHT, lifetime=5, is_active=false)")

	arrow.queue_free()

func test_setup_basic() -> void:
	var arrow = _create_arrow()
	arrow.setup(Vector2(100, 100), Vector2.RIGHT, 50, 600.0)

	if arrow.position == Vector2(100, 100) and arrow.damage == 50 and arrow.speed == 600.0 and arrow.is_active:
		_pass("test_setup_basic")
	else:
		_fail("test_setup_basic", "Setup should initialize arrow correctly")

	arrow.queue_free()

func test_setup_with_direction() -> void:
	var arrow = _create_arrow()
	arrow.setup(Vector2.ZERO, Vector2(1, 1), 30, 400.0)

	if arrow.direction == Vector2(1, 1).normalized():
		_pass("test_setup_with_direction")
	else:
		_fail("test_setup_with_direction", "Direction should be set from vector")

	arrow.queue_free()

func test_setup_normalizes_direction() -> void:
	var arrow = _create_arrow()
	arrow.setup(Vector2.ZERO, Vector2(3, 4), 25, 800.0)

	if arrow.direction.length() == 1.0:
		_pass("test_setup_normalizes_direction")
	else:
		_fail("test_setup_normalizes_direction", "Direction should be normalized")

	arrow.queue_free()

func test_reset_pooled_state() -> void:
	var arrow = _create_arrow()
	arrow.setup(Vector2(500, 500), Vector2.UP, 100, 1000.0)
	arrow.is_active = true
	arrow._lifetime_timer = 4.5

	arrow.reset_pooled_state()

	if not arrow.is_active and arrow._lifetime_timer == 0.0 and arrow.damage == 25 and arrow.speed == 800.0 and arrow.position == Vector2.ZERO:
		_pass("test_reset_pooled_state")
	else:
		_fail("test_reset_pooled_state", "Reset should restore default values")

	arrow.queue_free()

func test_lifetime_timer() -> void:
	var arrow = _create_arrow()
	arrow.is_active = true
	arrow.lifetime = 2.0

	# Call _physics_process directly to test timer tracking
	arrow._physics_process(0.5)

	if arrow._lifetime_timer == 0.5:
		_pass("test_lifetime_timer")
	else:
		_fail("test_lifetime_timer", "Lifetime timer should track delta (got %f, expected 0.5)" % arrow._lifetime_timer)

	arrow.queue_free()

func test_rotation_based_on_direction() -> void:
	var arrow = _create_arrow()
	arrow.setup(Vector2.ZERO, Vector2.RIGHT, 25, 800.0)

	if abs(arrow.rotation) < 0.01:
		_pass("test_rotation_based_on_direction")
	else:
		_fail("test_rotation_based_on_direction", "Arrow should rotate to face direction")

	arrow.queue_free()

func test_rotation_for_up_direction() -> void:
	var arrow = _create_arrow()
	arrow.setup(Vector2.ZERO, Vector2.UP, 25, 800.0)

	if abs(arrow.rotation - PI / 2) < 0.1:
		_pass("test_rotation_for_up_direction")
	else:
		_fail("test_rotation_for_up_direction", "Rotation should be 90 degrees for UP")

	arrow.queue_free()
