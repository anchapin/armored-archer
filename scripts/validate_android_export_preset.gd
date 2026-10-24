@tool
extends SceneTree
## Validate the checked-in Android preset with the running editor's schema.
## Run: godot4 --headless --editor --script scripts/validate_android_export_preset.gd

var _failures: int = 0
var _checks: int = 0


func _initialize() -> void:
	_validate.call_deferred()


func _validate() -> void:
	var config := ConfigFile.new()
	_expect(config.load("res://export_presets.cfg") == OK, "ConfigFile must parse")
	_expect(config.has_section("preset.0"), "Godot must discover preset.0")
	_expect(config.has_section("preset.0.options"), "Android options must exist")
	if _failures > 0:
		_finish()
		return
	var preset := "preset.0"
	var options := "preset.0.options"
	for key: String in ["name", "platform"]:
		_expect(config.get_value(preset, key, "") == "Android", key + " must be Android")
	for key: String in ["include_filter", "exclude_filter"]:
		_expect(config.has_section_key(preset, key), key + " must be explicit")
	_expect(config.get_value(preset, "export_filter", "") == "all_resources", "Export all resources")
	_expect(config.get_value(preset, "runnable", false) == true, "Preset must be runnable")
	_expect(config.get_value(preset, "export_path", "") == "export/android/armored-archer.apk",
		"Use documented APK output")
	var expected := {
		"gradle_build/use_gradle_build": false,
		"gradle_build/export_format": 0,
		"architectures/armeabi-v7a": true,
		"architectures/arm64-v8a": true,
		"architectures/x86": false,
		"architectures/x86_64": false,
		"package/unique_name": "com.armoredarcher.game",
		"package/name": "Armored Archer",
		"package/signed": true,
		"permissions/internet": true,
	}
	for key: String in expected:
		_expect(config.get_value(options, key, null) == expected[key], key + " must match contract")
	for key: String in ["keystore/release", "keystore/release_user", "keystore/release_password"]:
		_expect(config.get_value(options, key, "") == "", "No tracked release signing value: " + key)
	_expect(ClassDB.class_exists("EditorExportPlatformAndroid"), "Run with Godot editor binary")
	if ClassDB.class_exists("EditorExportPlatformAndroid"):
		var platform: Object = ClassDB.instantiate("EditorExportPlatformAndroid")
		var schema: Object = platform.call("create_preset")
		var names: Array[String] = []
		for property: Dictionary in schema.get_property_list():
			names.append(property.name)
		for section: String in ["preset.0.options", "preset.1.options"]:
			for key: String in config.get_section_keys(section):
				_expect(key in names, "Recognized Android export option (%s): %s" % [section, key])
	_validate_release_preset(config)
	_finish()


func _validate_release_preset(config: ConfigFile) -> void:
	## Issue #1725: Play Store release preset (AAB, arm64 only, no tracked secrets).
	var preset := "preset.1"
	var options := "preset.1.options"
	_expect(config.has_section(preset) and config.has_section(options), "Release preset must exist")
	_expect(config.get_value(preset, "name", "") == "Android Release", "Release preset name")
	_expect(config.get_value(preset, "platform", "") == "Android", "Release preset platform")
	_expect(config.get_value(preset, "export_path", "") == "export/android/armored-archer-release.aab",
		"Release preset exports an AAB")
	var expected := {
		"gradle_build/use_gradle_build": true,
		"gradle_build/export_format": 1,
		"architectures/armeabi-v7a": false,
		"architectures/arm64-v8a": true,
		"architectures/x86": false,
		"architectures/x86_64": false,
		"package/unique_name": "com.armoredarcher.game",
		"package/signed": true,
	}
	for key: String in expected:
		_expect(config.get_value(options, key, null) == expected[key], "Release: " + key)
	var target_sdk := int(config.get_value(options, "gradle_build/target_sdk", "0"))
	_expect(target_sdk >= 36, "Release targets API 36+ (Play requirement from Aug 31 2026)")
	for key: String in ["keystore/release", "keystore/release_user", "keystore/release_password"]:
		_expect(config.get_value(options, key, "") == "", "No tracked release signing value: " + key)


func _expect(passed: bool, label: String) -> void:
	_checks += 1
	if not passed:
		_failures += 1
		printerr("FAIL: ", label)


func _finish() -> void:
	while EditorInterface.get_resource_filesystem().is_scanning():
		await process_frame
	print("Android export preset: %d checks, %d failures" % [_checks, _failures])
	quit(1 if _failures else 0)
