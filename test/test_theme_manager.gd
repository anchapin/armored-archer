extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

const ThemeManagerScript = preload("res://autoloads/ThemeManager.gd")

func _ready() -> void:
	print("=== Running ThemeManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_constants()
	await test_default_theme()
	await test_theme_mode()
	await test_is_dark_mode()
	await test_toggle_theme_mode()
	await test_set_theme_mode_valid()
	await test_tactile_theme_toggle()
	await test_get_theme_colors()
	await test_get_text_color()
	await test_get_text_disabled_color()
	await test_get_background_surface_color()
	await test_get_surface_color()
	await test_get_primary_color()
	await test_get_secondary_color()
	await test_get_ghost_border_color()
	await test_theme_colors_contain_required_keys()

	print("\n=== ThemeManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

## Remove any persisted theme config so each test starts from pristine
## defaults (LIGHT mode, theme enabled) regardless of machine state.
func _create_theme_manager() -> Node:
	if FileAccess.file_exists(ThemeManagerScript.THEME_CONFIG_PATH):
		DirAccess.remove_absolute(ThemeManagerScript.THEME_CONFIG_PATH)
	var theme = ThemeManagerScript.new()
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

	if theme.THEME_KEY == "theme_enabled":
		_pass("test_theme_key_constant")
	else:
		_fail("test_theme_key_constant", "THEME_KEY should be 'theme_enabled'")

	if theme.THEME_MODE_KEY == "theme_mode":
		_pass("test_theme_mode_key_constant")
	else:
		_fail("test_theme_mode_key_constant", "THEME_MODE_KEY should be 'theme_mode'")

	theme.queue_free()

func test_default_theme() -> void:
	var theme = await _create_theme_manager()

	if theme.get_theme_mode() == ThemeManagerScript.ThemeMode.LIGHT:
		_pass("test_default_light_theme")
	else:
		_fail("test_default_light_theme", "Default should be light theme")

	theme.queue_free()

func test_theme_mode() -> void:
	var theme = await _create_theme_manager()

	if theme.get_theme_mode() == ThemeManagerScript.ThemeMode.LIGHT:
		_pass("test_theme_mode_light")
	else:
		_fail("test_theme_mode_light", "Theme mode should be LIGHT")

	theme.queue_free()

func test_is_dark_mode() -> void:
	var theme = await _create_theme_manager()

	if theme.is_dark_mode() == false:
		_pass("test_is_dark_mode_false")
	else:
		_fail("test_is_dark_mode_false", "Should return false for light theme")

	theme.set_theme_mode(ThemeManagerScript.ThemeMode.DARK)
	if theme.is_dark_mode() == true:
		_pass("test_is_dark_mode_true")
	else:
		_fail("test_is_dark_mode_true", "Should return true for dark theme")

	theme.queue_free()

func test_toggle_theme_mode() -> void:
	var theme = await _create_theme_manager()

	theme.toggle_theme_mode()
	if theme.is_dark_mode() == true:
		_pass("test_toggle_theme_mode_to_dark")
	else:
		_fail("test_toggle_theme_mode_to_dark", "Should toggle to dark")

	theme.toggle_theme_mode()
	if theme.is_dark_mode() == false:
		_pass("test_toggle_theme_mode_to_light")
	else:
		_fail("test_toggle_theme_mode_to_light", "Should toggle to light")

	theme.queue_free()

func test_set_theme_mode_valid() -> void:
	var theme = await _create_theme_manager()

	theme.set_theme_mode(ThemeManagerScript.ThemeMode.DARK)
	if theme.get_theme_mode() == ThemeManagerScript.ThemeMode.DARK:
		_pass("test_set_theme_mode_dark")
	else:
		_fail("test_set_theme_mode_dark", "Should set to dark theme mode")

	theme.set_theme_mode(ThemeManagerScript.ThemeMode.LIGHT)
	if theme.get_theme_mode() == ThemeManagerScript.ThemeMode.LIGHT:
		_pass("test_set_theme_mode_light")
	else:
		_fail("test_set_theme_mode_light", "Should set to light theme mode")

	theme.queue_free()

func test_tactile_theme_toggle() -> void:
	var theme = await _create_theme_manager()

	if theme.is_theme_enabled() == true:
		_pass("test_tactile_theme_enabled_by_default")
	else:
		_fail("test_tactile_theme_enabled_by_default", "Tactile theme should be enabled by default")

	theme.set_tactile_theme(false)
	if theme.is_theme_enabled() == false:
		_pass("test_set_tactile_theme_disabled")
	else:
		_fail("test_set_tactile_theme_disabled", "Should disable tactile theme")

	theme.toggle_theme()
	if theme.is_theme_enabled() == true:
		_pass("test_toggle_tactile_theme")
	else:
		_fail("test_toggle_tactile_theme", "toggle_theme should re-enable tactile theme")

	theme.queue_free()

func test_get_theme_colors() -> void:
	var theme = await _create_theme_manager()

	var colors = theme.get_theme_colors()

	# get_theme_colors() returns the ArcherDesignTokens palette (Tactile Heroism)
	if colors.has("surface") and colors.has("primary") and colors.has("on_surface"):
		_pass("test_get_theme_colors_contains_keys")
	else:
		_fail("test_get_theme_colors_contains_keys", "Should contain required keys")

	theme.queue_free()

func test_get_text_color() -> void:
	var theme = await _create_theme_manager()

	var text = theme.get_text_color()

	if text != Color.MAGENTA:
		_pass("test_get_text_color")
	else:
		_fail("test_get_text_color", "Should return valid text color")

	theme.queue_free()

func test_get_text_disabled_color() -> void:
	var theme = await _create_theme_manager()

	var text = theme.get_text_disabled_color()

	if text != Color.MAGENTA:
		_pass("test_get_text_disabled_color")
	else:
		_fail("test_get_text_disabled_color", "Should return valid disabled text color")

	theme.queue_free()

func test_get_background_surface_color() -> void:
	var theme = await _create_theme_manager()

	var bg = theme.get_surface_color("base")

	if bg != Color.MAGENTA:
		_pass("test_get_background_surface_color")
	else:
		_fail("test_get_background_surface_color", "Should return valid base surface color")

	theme.queue_free()

func test_get_surface_color() -> void:
	var theme = await _create_theme_manager()

	var surface = theme.get_surface_color()

	if surface != Color.MAGENTA:
		_pass("test_get_surface_color")
	else:
		_fail("test_get_surface_color", "Should return valid surface color")

	theme.queue_free()

func test_get_primary_color() -> void:
	var theme = await _create_theme_manager()

	var primary = theme.get_primary_color()

	if primary != Color.MAGENTA:
		_pass("test_get_primary_color")
	else:
		_fail("test_get_primary_color", "Should return valid primary color")

	theme.queue_free()

func test_get_secondary_color() -> void:
	var theme = await _create_theme_manager()

	var secondary = theme.get_secondary_color()

	if secondary != Color.MAGENTA:
		_pass("test_get_secondary_color")
	else:
		_fail("test_get_secondary_color", "Should return valid secondary color")

	theme.queue_free()

func test_get_ghost_border_color() -> void:
	var theme = await _create_theme_manager()

	var border = theme.get_ghost_border_color()

	if border != Color.MAGENTA:
		_pass("test_get_ghost_border_color")
	else:
		_fail("test_get_ghost_border_color", "Should return valid ghost border color")

	theme.queue_free()

func test_theme_colors_contain_required_keys() -> void:
	var theme = await _create_theme_manager()

	# The token palette replaces the legacy _themes dictionary
	var colors = theme.get_theme_colors()
	var required_keys = ["surface", "surface_container", "surface_variant", "on_surface",
		"primary", "primary_container", "on_primary", "secondary", "on_secondary",
		"tertiary", "on_tertiary", "ambient_shadow"]
	var has_all = true

	for key in required_keys:
		if not colors.has(key):
			has_all = false
			break

	if has_all:
		_pass("test_theme_colors_contain_required_keys")
	else:
		_fail("test_theme_colors_contain_required_keys", "Token palette missing required keys")

	theme.queue_free()
