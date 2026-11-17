extends GutTest

class MenuFixture:
	extends "res://scenes/ui/main_menu.gd"
	func _ready() -> void:
		pass

var optimizer: Node
var original_enabled: bool

func before_each() -> void:
	optimizer = get_node("/root/UITransitionOptimizer")
	original_enabled = optimizer._ui_animation_enabled

func after_each() -> void:
	optimizer._ui_animation_enabled = original_enabled

func _menu() -> Control:
	var scene = load("res://scenes/ui/main_menu.tscn").instantiate()
	scene.set_script(MenuFixture)
	add_child_autofree(scene)
	return scene

func test_disabled_menu_entry_keeps_visible_neutral_state_without_tweens() -> void:
	optimizer._ui_animation_enabled = false
	var menu = _menu()
	var before := get_tree().get_processed_tweens().size()
	menu._animate_menu_entry()
	assert_eq(menu.menu_container.modulate.a, 1.0)
	assert_eq(menu.menu_container.scale, Vector2.ONE)
	assert_eq(get_tree().get_processed_tweens().size(), before)

func test_enabled_menu_entry_uses_existing_animation_and_restores_scale() -> void:
	optimizer._ui_animation_enabled = true
	var menu = _menu()
	menu._animate_menu_entry()
	assert_eq(menu.menu_container.modulate.a, 0.0)
	assert_eq(menu.menu_container.scale, Vector2(0.8, 0.8))
	await wait_seconds(0.5)
	assert_almost_eq(menu.menu_container.modulate.a, 1.0, 0.001)
	assert_eq(menu.menu_container.scale, Vector2.ONE)

func test_consumers_use_static_setting_gate_without_dead_autoload_lookup() -> void:
	for consumer in ["campaign_map", "login_screen", "main_menu"]:
		var text := FileAccess.get_file_as_string("res://scenes/ui/%s.gd" % consumer)
		assert_false(text.contains('"/root/UIAutomation"'), consumer)
		assert_true(text.contains('preload("res://autoloads/UIAutomation.gd")'), consumer)
		assert_true(text.contains("not UIAutomationAPI.are_animations_enabled()"), consumer)
	var menu_source := FileAccess.get_file_as_string("res://scenes/ui/main_menu.gd")
	assert_false(menu_source.contains("UIAutomationAPI.button_hover_in"), "Base button owns hover; no duplicate tween")
	assert_false(menu_source.contains("UIAutomationAPI.button_press"), "Base button owns press; no duplicate tween")

func test_real_menu_button_has_only_base_signal_owners() -> void:
	var menu = _menu()
	var button = menu.play_button
	assert_eq(button.mouse_entered.get_connections().size(), 1)
	assert_eq(button.mouse_exited.get_connections().size(), 1)
	assert_eq(button.button_down.get_connections().size(), 1)
	assert_false(menu.has_method("_add_button_animations"))

func test_disabled_real_menu_button_creates_no_hover_or_press_tweens() -> void:
	optimizer._ui_animation_enabled = false
	var menu = _menu()
	var button = menu.play_button
	var before = get_tree().get_processed_tweens().size()
	button.mouse_entered.emit()
	button.button_down.emit()
	assert_eq(get_tree().get_processed_tweens().size(), before)
	assert_eq(button.scale, Vector2.ONE)
	assert_eq(button.rotation, 0.0)

func test_enabled_real_menu_button_base_owns_and_replaces_transform_tween() -> void:
	optimizer._ui_animation_enabled = true
	var menu = _menu()
	var button = menu.play_button
	button.mouse_entered.emit()
	var hover = button._transform_tween
	assert_not_null(hover)
	button.button_down.emit()
	assert_false(hover.is_valid())
	assert_not_null(button._transform_tween)
	assert_true(button.has_active_animation())
	await wait_seconds(0.12)
	assert_almost_eq(button.scale.x, 0.92, 0.001)
	button.button_up.emit()
	await wait_seconds(0.15)
	assert_eq(button.scale, Vector2.ONE)
	assert_almost_eq(button.rotation, 0.0, 0.001)
