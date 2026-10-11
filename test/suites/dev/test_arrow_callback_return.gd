extends GutTest

func test_contact_return_deactivates_now_but_parks_once_after_callback() -> void:
	var arrow: Node = ObjectPool.get_arrow()
	arrow.setup(Vector2(9000, 9000), Vector2.RIGHT, 1)
	var wall := StaticBody2D.new()
	add_child_autofree(wall)
	wall.add_to_group("Environment")
	arrow._on_body_entered(wall)
	arrow._on_body_entered(wall)
	assert_false(arrow.is_active, "Second contact must not deal damage or enqueue return")
	assert_true(arrow._return_pending)
	assert_eq(arrow.process_mode, Node.PROCESS_MODE_INHERIT, "Parking is deferred")
	await get_tree().process_frame
	assert_eq(arrow.process_mode, Node.PROCESS_MODE_DISABLED)
	assert_false(arrow._return_pending)
	assert_eq(ObjectPool._arrow_pool.count(arrow), 1, "No duplicate pool entry")

func test_real_physics_contact_returns_without_collision_callback_errors() -> void:
	var wall := StaticBody2D.new()
	wall.collision_layer = 2
	wall.collision_mask = 1
	wall.position = Vector2(10000, 10000)
	wall.add_to_group("Environment")
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(80, 80)
	shape.shape = rect
	wall.add_child(shape)
	add_child_autofree(wall)
	var arrow: Node = ObjectPool.get_arrow()
	arrow.setup(wall.position, Vector2.RIGHT, 1, 0.0)
	for _i in range(6):
		await get_tree().physics_frame
	assert_false(arrow.is_active)
	assert_eq(arrow.process_mode, Node.PROCESS_MODE_DISABLED)
	assert_eq(ObjectPool._arrow_pool.count(arrow), 1)
