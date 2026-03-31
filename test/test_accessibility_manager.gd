extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running AccessibilityManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_constants()
	await test_default_settings()
	await test_font_scale_range()
	await test_font_scale_clamp()
	await test_scaled_font_size()
	await test_high_contrast_toggle()
	await test_reduced_motion_toggle()
	await test_screen_reader_toggle()
	await test_get_settings()
	await test_apply_settings()
	await test_get_accessibility_color()
	await test_wcag_aa_contrast()
	await test_wcag_aaa_contrast()
	await test_contrast_ratio_calculation()
	await test_luminance_calculation()
	await test_linearize_function()

	print("\n=== AccessibilityManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_accessibility_manager() -> Node:
	var a11y = load("res://autoloads/AccessibilityManager.gd").new()
	add_child(a11y)
	await get_tree().process_frame
	return a11y

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_constants() -> void:
	var a11y = await _create_accessibility_manager()

	if a11y.FONT_SCALE_MIN == 0.8:
		_pass("test_font_scale_min_constant")
	else:
		_fail("test_font_scale_min_constant", "FONT_SCALE_MIN should be 0.8")

	if a11y.FONT_SCALE_MAX == 1.5:
		_pass("test_font_scale_max_constant")
	else:
		_fail("test_font_scale_max_constant", "FONT_SCALE_MAX should be 1.5")

	if a11y.FONT_SCALE_DEFAULT == 1.0:
		_pass("test_font_scale_default_constant")
	else:
		_fail("test_font_scale_default_constant", "FONT_SCALE_DEFAULT should be 1.0")

	a11y.queue_free()

func test_default_settings() -> void:
	var a11y = await _create_accessibility_manager()

	if abs(a11y.get_font_scale() - 1.0) < 0.01:
		_pass("test_default_font_scale")
	else:
		_fail("test_default_font_scale", "Default font scale should be 1.0")

	if a11y.is_high_contrast_enabled() == false:
		_pass("test_default_high_contrast")
	else:
		_fail("test_default_high_contrast", "Default high contrast should be false")

	if a11y.is_reduced_motion_enabled() == false:
		_pass("test_default_reduced_motion")
	else:
		_fail("test_default_reduced_motion", "Default reduced motion should be false")

	if a11y.is_screen_reader_enabled() == false:
		_pass("test_default_screen_reader")
	else:
		_fail("test_default_screen_reader", "Default screen reader should be false")

	a11y.queue_free()

func test_font_scale_range() -> void:
	var a11y = await _create_accessibility_manager()

	a11y.set_font_scale(1.0)
	if abs(a11y.get_font_scale() - 1.0) < 0.01:
		_pass("test_font_scale_valid_mid")
	else:
		_fail("test_font_scale_valid_mid", "Valid font scale should be set")

	a11y.queue_free()

func test_font_scale_clamp() -> void:
	var a11y = await _create_accessibility_manager()

	a11y.set_font_scale(2.0)
	if a11y.get_font_scale() <= 1.5:
		_pass("test_font_scale_clamp_max")
	else:
		_fail("test_font_scale_clamp_max", "Should clamp to 1.5")

	a11y.set_font_scale(0.5)
	if a11y.get_font_scale() >= 0.8:
		_pass("test_font_scale_clamp_min")
	else:
		_fail("test_font_scale_clamp_min", "Should clamp to 0.8")

	a11y.queue_free()

func test_scaled_font_size() -> void:
	var a11y = await _create_accessibility_manager()

	a11y.set_font_scale(1.0)
	var size = a11y.get_scaled_font_size(16)
	if size == 16:
		_pass("test_scaled_font_size_default")
	else:
		_fail("test_scaled_font_size_default", "Should be 16 at 1.0 scale")

	a11y.set_font_scale(1.5)
	size = a11y.get_scaled_font_size(16)
	if size == 24:
		_pass("test_scaled_font_size_150")
	else:
		_fail("test_scaled_font_size_150", "Should be 24 at 1.5 scale")

	a11y.set_font_scale(0.8)
	size = a11y.get_scaled_font_size(16)
	if size == 12:
		_pass("test_scaled_font_size_80")
	else:
		_fail("test_scaled_font_size_80", "Should be 12 at 0.8 scale")

	a11y.queue_free()

func test_high_contrast_toggle() -> void:
	var a11y = await _create_accessibility_manager()

	a11y.set_high_contrast(true)
	if a11y.is_high_contrast_enabled() == true:
		_pass("test_high_contrast_enabled")
	else:
		_fail("test_high_contrast_enabled", "Should be enabled")

	a11y.set_high_contrast(false)
	if a11y.is_high_contrast_enabled() == false:
		_pass("test_high_contrast_disabled")
	else:
		_fail("test_high_contrast_disabled", "Should be disabled")

	a11y.queue_free()

func test_reduced_motion_toggle() -> void:
	var a11y = await _create_accessibility_manager()

	a11y.set_reduced_motion(true)
	if a11y.is_reduced_motion_enabled() == true:
		_pass("test_reduced_motion_enabled")
	else:
		_fail("test_reduced_motion_enabled", "Should be enabled")

	a11y.set_reduced_motion(false)
	if a11y.is_reduced_motion_enabled() == false:
		_pass("test_reduced_motion_disabled")
	else:
		_fail("test_reduced_motion_disabled", "Should be disabled")

	a11y.queue_free()

func test_screen_reader_toggle() -> void:
	var a11y = await _create_accessibility_manager()

	a11y.set_screen_reader_enabled(true)
	if a11y.is_screen_reader_enabled() == true:
		_pass("test_screen_reader_enabled")
	else:
		_fail("test_screen_reader_enabled", "Should be enabled")

	a11y.set_screen_reader_enabled(false)
	if a11y.is_screen_reader_enabled() == false:
		_pass("test_screen_reader_disabled")
	else:
		_fail("test_screen_reader_disabled", "Should be disabled")

	a11y.queue_free()

func test_get_settings() -> void:
	var a11y = await _create_accessibility_manager()

	var settings = a11y.get_settings()

	if settings.has("font_scale") and settings.has("high_contrast"):
		_pass("test_get_settings_keys")
	else:
		_fail("test_get_settings_keys", "Should have required keys")

	if settings["font_scale"] == 1.0:
		_pass("test_get_settings_font_scale")
	else:
		_fail("test_get_settings_font_scale", "Font scale should be 1.0")

	a11y.queue_free()

func test_apply_settings() -> void:
	var a11y = await _create_accessibility_manager()

	a11y.apply_settings({
		"font_scale": 1.3,
		"high_contrast": true,
		"reduced_motion": true,
	})

	if abs(a11y.get_font_scale() - 1.3) < 0.01:
		_pass("test_apply_settings_font_scale")
	else:
		_fail("test_apply_settings_font_scale", "Should apply font scale")

	if a11y.is_high_contrast_enabled() == true:
		_pass("test_apply_settings_high_contrast")
	else:
		_fail("test_apply_settings_high_contrast", "Should apply high contrast")

	if a11y.is_reduced_motion_enabled() == true:
		_pass("test_apply_settings_reduced_motion")
	else:
		_fail("test_apply_settings_reduced_motion", "Should apply reduced motion")

	a11y.queue_free()

func test_get_accessibility_color() -> void:
	var a11y = await _create_accessibility_manager()

	var color = a11y.get_accessibility_color("background", true)

	if color == Color.MAGENTA:
		_pass("test_get_accessibility_color_disabled")
	else:
		_fail("test_get_accessibility_color_disabled", "Should return magenta when disabled")

	a11y.set_high_contrast(true)
	color = a11y.get_accessibility_color("background", true)

	if color != Color.MAGENTA:
		_pass("test_get_accessibility_color_enabled_dark")
	else:
		_fail("test_get_accessibility_color_enabled_dark", "Should return dark color")

	color = a11y.get_accessibility_color("background", false)
	if color != Color.MAGENTA:
		_pass("test_get_accessibility_color_enabled_light")
	else:
		_fail("test_get_accessibility_color_enabled_light", "Should return light color")

	a11y.queue_free()

func test_wcag_aa_contrast() -> void:
	var white = Color.WHITE
	var black = Color.BLACK

	if AccessibilityManager.meets_wcag_aa(white, black, 14):
		_pass("test_wcag_aa_black_white_normal")
	else:
		_fail("test_wcag_aa_black_white_normal", "Should meet AA for black on white")

	if AccessibilityManager.meets_wcag_aa(white, black, 18):
		_pass("test_wcag_aa_black_white_large")
	else:
		_fail("test_wcag_aa_black_white_large", "Should meet AA for large text")

func test_wcag_aaa_contrast() -> void:
	var white = Color.WHITE
	var black = Color.BLACK

	if AccessibilityManager.meets_wcag_aaa(white, black, 14):
		_pass("test_wcag_aaa_black_white_normal")
	else:
		_fail("test_wcag_aaa_black_white_normal", "Should meet AAA for black on white")

	if AccessibilityManager.meets_wcag_aaa(white, black, 18):
		_pass("test_wcag_aaa_black_white_large")
	else:
		_fail("test_wcag_aaa_black_white_large", "Should meet AAA for large text")

func test_contrast_ratio_calculation() -> void:
	var white = Color.WHITE
	var black = Color.BLACK
	var ratio = AccessibilityManager._get_contrast_ratio(white, black)

	if ratio >= 20.0:
		_pass("test_contrast_ratio_high")
	else:
		_fail("test_contrast_ratio_high", "Black on white should have high ratio")

func test_luminance_calculation() -> void:
	var white_lum = AccessibilityManager._get_relative_luminance(Color.WHITE)
	if abs(white_lum - 1.0) < 0.01:
		_pass("test_luminance_white")
	else:
		_fail("test_luminance_white", "White luminance should be 1.0")

	var black_lum = AccessibilityManager._get_relative_luminance(Color.BLACK)
	if black_lum < 0.01:
		_pass("test_luminance_black")
	else:
		_fail("test_luminance_black", "Black luminance should be ~0")

func test_linearize_function() -> void:
	var low = AccessibilityManager._linearize(0.03)
	if low < 0.1:
		_pass("test_linearize_low_value")
	else:
		_fail("test_linearize_low_value", "Low values should linearize to small numbers")

	var high = AccessibilityManager._linearize(0.9)
	if high > 0.7:
		_pass("test_linearize_high_value")
	else:
		_fail("test_linearize_high_value", "High values should linearize to larger numbers")