extends GutTest

class PointerPlayer extends "res://scripts/character_body_2d.gd":
	var actions: Array[String] = []
	var shots: int = 0
	var shot_direction: Vector2 = Vector2.ZERO
	func _ready() -> void:
		set_physics_process(false)
	func _notify_pointer_action(action_name: String) -> void:
		actions.append(action_name)
	func _handle_shoot() -> void:
		shots += 1
		shot_direction = aim_direction

var player: CharacterBody2D
var saved_game_active: bool

func before_each() -> void:
	saved_game_active = GameManager.is_game_active
	GameManager.is_game_active = true
	player = PointerPlayer.new()
	for node_name in ["BodySprite", "BowPivot"]:
		var node := Node2D.new()
		node.name = node_name
		player.add_child(node)
	var animation := AnimationPlayer.new()
	animation.name = "AnimationPlayer"
	player.add_child(animation)
	add_child(player)

func after_each() -> void:
	player.free()
	GameManager.is_game_active = saved_game_active

func _click(pressed: bool, button: MouseButton = MOUSE_BUTTON_LEFT) -> InputEventMouseButton:
	var event := InputEventMouseButton.new()
	event.device = 0
	event.button_index = button
	event.pressed = pressed
	event.position = Vector2(200, 100)
	return event

func test_pointer_motion_aims_without_firing() -> void:
	var motion := InputEventMouseMotion.new()
	motion.device = 0
	motion.position = Vector2(200, 100)
	player._unhandled_input(motion)
	player._update_aim_direction(1.0 / player.aim_smoothing)
	var expected: Vector2 = (player._mouse_aim_position - player.global_position).normalized()
	assert_almost_eq(player.aim_direction.x, expected.x, 0.001)
	assert_almost_eq(player.aim_direction.y, expected.y, 0.001)
	assert_eq(player.shots, 0)
	assert_eq(player.actions, ["aim_right"])

func test_left_press_aims_at_click_and_fires_once() -> void:
	player._unhandled_input(_click(true))
	player._unhandled_input(_click(false))
	assert_eq(player.shots, 1)
	assert_eq(player.actions, ["shoot"])
	var expected: Vector2 = (player._mouse_aim_position - player.global_position).normalized()
	assert_eq(player.shot_direction, expected)

func test_right_click_and_inactive_game_do_not_fire() -> void:
	player._unhandled_input(_click(true, MOUSE_BUTTON_RIGHT))
	assert_eq(player.shots, 0)
	GameManager.is_game_active = false
	player._unhandled_input(_click(true))
	assert_eq(player.shots, 0)

func test_emulated_touch_mouse_does_not_double_fire() -> void:
	var event := _click(true)
	event.device = InputEvent.DEVICE_ID_EMULATION
	player._unhandled_input(event)
	assert_eq(player.shots, 0)
	assert_false(player._mouse_aim_active)

func test_keyboard_direction_takes_priority_over_pointer() -> void:
	player._unhandled_input(_click(false))
	player._set_pointer_aim(Vector2(200, 100))
	Input.action_press("aim_left")
	player._update_aim_direction(1.0 / player.aim_smoothing)
	Input.action_release("aim_left")
	assert_eq(player.aim_direction, Vector2.LEFT)

func test_stationary_pointer_tracks_camera_transform() -> void:
	player._set_pointer_aim(Vector2(200, 100))
	var viewport: Viewport = get_viewport()
	var original: Transform2D = viewport.canvas_transform
	viewport.canvas_transform = Transform2D(0.0, Vector2(50, 20))
	player._update_aim_direction(1.0 / player.aim_smoothing)
	var target: Vector2 = player._mouse_aim_position
	viewport.canvas_transform = original
	assert_eq(target, Vector2(150, 80))

func test_viewport_routes_world_click_but_ui_button_consumes_its_click() -> void:
	var viewport := SubViewport.new()
	viewport.size = Vector2i(640, 360)
	add_child(viewport)
	player.reparent(viewport)
	var touch = load("res://scenes/touch_ui.tscn").instantiate()
	touch.controls_mode = touch.ControlsMode.DESKTOP
	viewport.add_child(touch)
	var button := Button.new()
	button.position = Vector2(300, 200)
	button.size = Vector2(80, 30)
	viewport.add_child(button)
	await get_tree().process_frame
	viewport.push_input(_click(true), true)
	viewport.push_input(_click(false), true)
	var world_shots: int = player.shots
	var event := _click(true)
	event.position = Vector2(330, 210)
	viewport.push_input(event, true)
	var ui_shots: int = player.shots
	player.reparent(self)
	viewport.free()
	assert_eq(world_shots, 1, "Empty touch overlay must not swallow desktop clicks")
	assert_eq(ui_shots, 1, "UI-consumed click must not fire into world")
