extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running ThemeManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_constants()
	await test_default_theme()
	await test_theme_name()
	await test_is_dark_theme()
	await test_is_light_theme()
	await test_toggle_theme()
	await test_set_theme_valid()
	await test_set_theme_invalid()
	await test_get_theme_colors()
	await test_get_color_valid()
	await test_get_color_invalid()
	await test_get_background_color()
	await test_get_surface_color()
	await test_get_text_primary_color()
	await test_get_text_secondary_color()
	await test_get_border_color()
	await test_theme_data_contains_required_keys()

	print("\n=== ThemeManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_theme_manager() -> Node:
	var theme = load("res://autoloads/ThemeManager.gd").new()
	add_child(theme)
	await get_tree().process_frame
	return theme

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_constants() -> void:
	var theme = await _create_theme_manager()

	if theme.THEME_CONFIG_PATH == "user://theme.cfg":
		_pass("test_theme_config_path_constant")
	else:
		_fail("test_theme_config_path_constant", "THEME_CONFIG_PATH incorrect")

	if theme.THEME_KEY == "theme":
		_pass("test_theme_key_constant")
	else:
		_fail("test_theme_key_constant", "THEME_KEY should be 'theme'")

	theme.queue_free()

func test_default_theme() -> void:
	var theme = await _create_theme_manager()

	if theme.is_dark_theme() == true:
		_pass("test_default_dark_theme")
	else:
		_fail("test_default_dark_theme", "Default should be dark theme")

	theme.queue_free()

func test_theme_name() -> void:
	var theme = await _create_theme_manager()

	if theme.get_theme_name() == &"dark":
		_pass("test_theme_name_dark")
	else:
		_fail("test_theme_name_dark", "Theme name should be 'dark'")

	theme.queue_free()

func test_is_dark_theme() -> void:
	var theme = await _create_theme_manager()

	if theme.is_dark_theme() == true:
		_pass("test_is_dark_theme_true")
	else:
		_fail("test_is_dark_theme_true", "Should return true for dark theme")

	theme.queue_free()

func test_is_light_theme() -> void:
	var theme = await _create_theme_manager()

	if theme.is_light_theme() == false:
		_pass("test_is_light_theme_false")
	else:
		_fail("test_is_light_theme_false", "Should return false for dark theme")

	theme.set_theme("light")
	if theme.is_light_theme() == true:
		_pass("test_is_light_theme_true")
	else:
		_fail("test_is_light_theme_true", "Should return true for light theme")

	theme.queue_free()

func test_toggle_theme() -> void:
	var theme = await _create_theme_manager()

	theme.toggle_theme()
	if theme.is_light_theme() == true:
		_pass("test_toggle_theme_to_light")
	else:
		_fail("test_toggle_theme_to_light", "Should toggle to light")

	theme.toggle_theme()
	if theme.is_dark_theme() == true:
		_pass("test_toggle_theme_to_dark")
	else:
		_fail("test_toggle_theme_to_dark", "Should toggle to dark")

	theme.queue_free()

func test_set_theme_valid() -> void:
	var theme = await _create_theme_manager()

	theme.set_theme("light")
	if theme.get_theme_name() == &"light":
		_pass("test_set_theme_light")
	else:
		_fail("test_set_theme_light", "Should set to light theme")

	theme.set_theme("dark")
	if theme.get_theme_name() == &"dark":
		_pass("test_set_theme_dark")
	else:
		_fail("test_set_theme_dark", "Should set to dark theme")

	theme.queue_free()

func test_set_theme_invalid() -> void:
	var theme = await _create_theme_manager()

	theme.set_theme("invalid_theme")
	if theme.get_theme_name() == &"dark":
		_pass("test_set_theme_invalid_defaults_dark")
	else:
		_fail("test_set_theme_invalid_defaults_dark", "Should default to dark")

	theme.queue_free()

func test_get_theme_colors() -> void:
	var theme = await _create_theme_manager()

	var colors = theme.get_theme_colors()

	if colors.has("background") and colors.has("text_primary"):
		_pass("test_get_theme_colors_contains_keys")
	else:
		_fail("test_get_theme_colors_contains_keys", "Should contain required keys")

	theme.queue_free()

func test_get_color_valid() -> void:
	var theme = await _create_theme_manager()

	var bg = theme.get_color("background")

	if bg != Color.MAGENTA:
		_pass("test_get_color_valid")
	else:
		_fail("test_get_color_valid", "Should return valid color")

	theme.queue_free()

func test_get_color_invalid() -> void:
	var theme = await _create_theme_manager()

	var invalid = theme.get_color("nonexistent_color")

	if invalid == Color.MAGENTA:
		_pass("test_get_color_invalid")
	else:
		_fail("test_get_color_invalid", "Should return magenta for invalid key")

	theme.queue_free()

func test_get_background_color() -> void:
	var theme = await _create_theme_manager()

	var bg = theme.get_background_color()

	if bg != Color.MAGENTA:
		_pass("test_get_background_color")
	else:
		_fail("test_get_background_color", "Should return valid background color")

	theme.queue_free()

func test_get_surface_color() -> void:
	var theme = await _create_theme_manager()

	var surface = theme.get_surface_color()

	if surface != Color.MAGENTA:
		_pass("test_get_surface_color")
	else:
		_fail("test_get_surface_color", "Should return valid surface color")

	theme.queue_free()

func test_get_text_primary_color() -> void:
	var theme = await _create_theme_manager()

	var text = theme.get_text_primary_color()

	if text != Color.MAGENTA:
		_pass("test_get_text_primary_color")
	else:
		_fail("test_get_text_primary_color", "Should return valid text color")

	theme.queue_free()

func test_get_text_secondary_color() -> void:
	var theme = await _create_theme_manager()

	var text = theme.get_text_secondary_color()

	if text != Color.MAGENTA:
		_pass("test_get_text_secondary_color")
	else:
		_fail("test_get_text_secondary_color", "Should return valid secondary text color")

	theme.queue_free()

func test_get_border_color() -> void:
	var theme = await _create_theme_manager()

	var border = theme.get_border_color()

	if border != Color.MAGENTA:
		_pass("test_get_border_color")
	else:
		_fail("test_get_border_color", "Should return valid border color")

	theme.queue_free()

func test_theme_data_contains_required_keys() -> void:
	var theme = await _create_theme_manager()

	var dark_theme = theme._themes["dark"]
	var required_keys = ["name", "background", "surface", "surface_variant", "border", "text_primary", "text_secondary", "text_disabled"]
	var has_all = true

	for key in required_keys:
		if not dark_theme.has(key):
			has_all = false
			break

	if has_all:
		_pass("test_theme_data_contains_required_keys")
	else:
		_fail("test_theme_data_contains_required_keys", "Dark theme missing required keys")

	var light_theme = theme._themes["light"]
	has_all = true
	for key in required_keys:
		if not light_theme.has(key):
			has_all = false
			break

	if has_all:
		_pass("test_light_theme_data_contains_required_keys")
	else:
		_fail("test_light_theme_data_contains_required_keys", "Light theme missing required keys")

	theme.queue_free()