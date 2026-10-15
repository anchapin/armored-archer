extends GutTest

class ThemeFixture extends "res://autoloads/ThemeManager.gd":
	func _save_theme() -> void:
		pass

var manager: Node
var toggle: Control

func before_each() -> void:
	manager = ThemeFixture.new()
	toggle = load("res://scenes/ui/components/theme_toggle.gd").new()
	toggle._theme_manager = manager
	add_child(toggle)
	watch_signals(toggle)

func after_each() -> void:
	toggle.free()
	assert_eq(manager.dark_mode_changed.get_connections().size(), 0,
		"Leaving the tree disconnects the manager signal")
	manager.free()

func test_initial_mode_matches_light_manager() -> void:
	assert_false(toggle.is_dark_theme())
	assert_true(toggle._toggle_button.text.ends_with("Light"))

func test_button_press_changes_mode_not_accessibility() -> void:
	toggle._toggle_button.pressed.emit()
	assert_true(manager.is_dark_mode())
	assert_true(toggle.is_dark_theme())
	assert_true(manager.is_theme_enabled())
	assert_signal_emitted_with_parameters(toggle, "theme_toggled", [true])

func test_external_mode_changes_update_display() -> void:
	manager.set_theme_mode(manager.ThemeMode.DARK)
	assert_true(toggle.is_dark_theme())
	assert_true(toggle._toggle_button.text.ends_with("Dark"))
	manager.set_theme_mode(manager.ThemeMode.LIGHT)
	assert_false(toggle.is_dark_theme())
	assert_signal_emit_count(toggle, "theme_toggled", 2)

func test_apply_theme_uses_manager_mode_api() -> void:
	toggle.apply_theme(true)
	assert_true(manager.is_dark_mode())
	toggle.apply_theme(false)
	assert_false(manager.is_dark_mode())
	assert_false(toggle.is_dark_theme())
	assert_signal_emit_count(toggle, "theme_toggled", 2)

func test_accessibility_signal_does_not_change_mode() -> void:
	manager.set_tactile_theme(false)
	assert_false(toggle.is_dark_theme())
	assert_false(manager.is_theme_enabled())
	assert_signal_not_emitted(toggle, "theme_toggled")

func test_toggle_twice_restores_mode() -> void:
	toggle.toggle()
	toggle.toggle()
	assert_false(manager.is_dark_mode())
	assert_false(toggle.is_dark_theme())
	assert_signal_emit_count(toggle, "theme_toggled", 2)
