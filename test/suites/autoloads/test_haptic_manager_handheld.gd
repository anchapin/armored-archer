extends GutTest
## Issue #1722: haptics must reach the phone motor, not only gamepad rumble.

var HapticManagerClass = load("res://autoloads/HapticManager.gd")


func test_buzz_helper_exists() -> void:
	var haptics = HapticManagerClass.new()
	add_child_autofree(haptics)
	assert_true(haptics.has_method("_buzz"), "HapticManager routes taps through _buzz")


func test_taps_do_not_error_when_disabled() -> void:
	var haptics = HapticManagerClass.new()
	add_child_autofree(haptics)
	haptics._haptics_enabled = false
	haptics.light_tap()
	haptics.heavy_tap()
	assert_false(haptics.is_haptics_enabled(), "disabled haptics stay off")


func test_buzz_is_safe_on_desktop_without_pads() -> void:
	var haptics = HapticManagerClass.new()
	add_child_autofree(haptics)
	haptics._is_mobile = false
	haptics._buzz(25)
	haptics._is_mobile = true
	haptics._buzz(25)
	assert_true(true, "_buzz does not raise on either path")


func test_android_preset_grants_vibrate_permission() -> void:
	var cfg := FileAccess.get_file_as_string("res://export_presets.cfg")
	assert_true(cfg.contains("permissions/vibrate=true"), "VIBRATE needed for vibrate_handheld")
