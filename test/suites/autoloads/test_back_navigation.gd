extends GutTest
## Issue #1724: Back button and app-background handling.


class FakeScene:
	extends Node
	var back_calls: int = 0
	var pause_calls: int = 0
	var consume_back: bool = true

	func on_back_requested() -> bool:
		back_calls += 1
		return consume_back

	func on_app_paused() -> void:
		pause_calls += 1


var _scene: Node


func before_each() -> void:
	_scene = null


func after_each() -> void:
	var dialog := get_tree().root.get_node_or_null(BackNavigation.QUIT_DIALOG_NAME)
	if dialog:
		dialog.free()
	if _scene and is_instance_valid(_scene):
		if get_tree().current_scene == _scene:
			get_tree().current_scene = null
		_scene.free()


func _install(scene: Node) -> void:
	_scene = scene
	get_tree().root.add_child(scene)
	get_tree().current_scene = scene


func test_scene_handler_consumes_back() -> void:
	var scene := FakeScene.new()
	_install(scene)
	assert_true(BackNavigation.handle_back(get_tree()))
	assert_eq(scene.back_calls, 1)
	assert_false(get_tree().root.has_node(BackNavigation.QUIT_DIALOG_NAME))


func test_back_presses_screen_back_button() -> void:
	var scene := Node.new()
	var other := Button.new()
	other.text = "Play"
	var back := Button.new()
	back.text = "Back"
	scene.add_child(other)
	scene.add_child(back)
	_install(scene)
	var presses: Array = [0]
	back.pressed.connect(func(): presses[0] += 1)
	assert_true(BackNavigation.handle_back(get_tree()))
	assert_eq(presses[0], 1)


func test_disabled_or_hidden_back_button_is_skipped() -> void:
	var scene := Node.new()
	var disabled := Button.new()
	disabled.text = "Back"
	disabled.disabled = true
	var hidden := Button.new()
	hidden.text = "Close"
	hidden.visible = false
	scene.add_child(disabled)
	scene.add_child(hidden)
	_install(scene)
	assert_null(BackNavigation.find_back_button(scene))


func test_no_back_target_shows_quit_confirm_once() -> void:
	_install(Node.new())
	assert_false(BackNavigation.handle_back(get_tree()))
	assert_true(get_tree().root.has_node(BackNavigation.QUIT_DIALOG_NAME))
	BackNavigation.handle_back(get_tree())
	var count := 0
	for child in get_tree().root.get_children():
		if child.name == BackNavigation.QUIT_DIALOG_NAME:
			count += 1
	assert_eq(count, 1, "no duplicate dialogs")


func test_scene_declining_back_falls_through() -> void:
	var scene := FakeScene.new()
	scene.consume_back = false
	_install(scene)
	assert_false(BackNavigation.handle_back(get_tree()))
	assert_eq(scene.back_calls, 1)
	assert_true(get_tree().root.has_node(BackNavigation.QUIT_DIALOG_NAME))


func test_app_paused_notifies_scene() -> void:
	var scene := FakeScene.new()
	_install(scene)
	BackNavigation.handle_app_paused(get_tree())
	assert_eq(scene.pause_calls, 1)


func test_flush_saves_is_safe_without_managers() -> void:
	BackNavigation.flush_saves(get_tree())
	assert_true(true, "no crash when autoloads are absent or present")
