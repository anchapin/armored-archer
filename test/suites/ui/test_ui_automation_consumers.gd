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
		assert_true(text.contains("not UI_AUTOMATION.are_animations_enabled()"), consumer)
	var menu_source := FileAccess.get_file_as_string("res://scenes/ui/main_menu.gd")
	assert_false(menu_source.contains("UI_AUTOMATION.button_hover_in"), "Base button owns hover; no duplicate tween")
	assert_false(menu_source.contains("UI_AUTOMATION.button_press"), "Base button owns press; no duplicate tween")
