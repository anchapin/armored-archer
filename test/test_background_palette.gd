extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running BackgroundPalette Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_default_colors()
	await test_main_menu_preset()
	await test_forest_preset()
	await test_arena_preset()
	await test_preset_structure()
	await test_get_all_presets()
	await test_get_layer_color()
	await test_get_layer_color_bounds()
	await test_background_preset_class()

	print("\n=== BackgroundPalette Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_palette() -> GildedBackgroundPalette:
	return GildedBackgroundPalette.new()

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_default_colors() -> void:
	var palette = _create_palette()

	if palette.base_color == Color("#fdffda"):
		_pass("test_default_base_color")
	else:
		_fail("test_default_base_color", "Base color should be #fdffda")

	if palette.surface_color == Color("#f8fdd2"):
		_pass("test_default_surface_color")
	else:
		_fail("test_default_surface_color", "Surface color should be #f8fdd2")

	if palette.surface_container_color == Color("#f2f5bf"):
		_pass("test_default_surface_container_color")
	else:
		_fail("test_default_surface_container_color", "Surface container color should be #f2f5bf")

	if palette.surface_container_low_color == Color("#ebf0b3"):
		_pass("test_default_surface_container_low_color")
	else:
		_fail("test_default_surface_container_low_color", "Surface container low color should be #ebf0b3")

	if palette.gold_accent == Color("#ffd700"):
		_pass("test_default_gold_accent")
	else:
		_fail("test_default_gold_accent", "Gold accent should be #ffd700")

	if palette.royal_blue_accent == Color("#0060ce"):
		_pass("test_default_royal_blue_accent")
	else:
		_fail("test_default_royal_blue_accent", "Royal blue accent should be #0060ce")

	if palette.forest_green == Color("#4d804d"):
		_pass("test_default_forest_green")
	else:
		_fail("test_default_forest_green", "Forest green should be #4d804d")

	if palette.arena_neutral == Color("#d9d1c7"):
		_pass("test_default_arena_neutral")
	else:
		_fail("test_default_arena_neutral", "Arena neutral should be #d9d1c7")

	if palette.vignette_strength == 0.15:
		_pass("test_default_vignette_strength")
	else:
		_fail("test_default_vignette_strength", "Vignette strength should be 0.15")

func test_main_menu_preset() -> void:
	var preset = GildedBackgroundPalette.get_main_menu_preset()

	if preset.name == "main_menu":
		_pass("test_main_menu_preset_name")
	else:
		_fail("test_main_menu_preset_name", "Preset name should be main_menu")

	if preset.base_tint == Color("#fdffda"):
		_pass("test_main_menu_preset_base_tint")
	else:
		_fail("test_main_menu_preset_base_tint", "Base tint should be parchment")

	if preset.layer_colors.size() == 3:
		_pass("test_main_menu_preset_layer_count")
	else:
		_fail("test_main_menu_preset_layer_count", "Should have 3 layer colors")

	if preset.supports_parallax == false:
		_pass("test_main_menu_no_parallax")
	else:
		_fail("test_main_menu_no_parallax", "Main menu should not support parallax")

func test_forest_preset() -> void:
	var preset = GildedBackgroundPalette.get_forest_preset()

	if preset.name == "gameplay_forest":
		_pass("test_forest_preset_name")
	else:
		_fail("test_forest_preset_name", "Preset name should be gameplay_forest")

	if preset.base_tint == Color("#e6f0cc"):
		_pass("test_forest_preset_base_tint")
	else:
		_fail("test_forest_preset_base_tint", "Base tint should be green-tinted parchment")

	if preset.layer_colors.size() == 3:
		_pass("test_forest_preset_layer_count")
	else:
		_fail("test_forest_preset_layer_count", "Should have 3 layer colors")

	if preset.supports_parallax == true:
		_pass("test_forest_preset_parallax")
	else:
		_fail("test_forest_preset_parallax", "Forest should support parallax")

func test_arena_preset() -> void:
	var preset = GildedBackgroundPalette.get_arena_preset()

	if preset.name == "gameplay_arena":
		_pass("test_arena_preset_name")
	else:
		_fail("test_arena_preset_name", "Preset name should be gameplay_arena")

	if preset.base_tint == Color("#f0ede8"):
		_pass("test_arena_preset_base_tint")
	else:
		_fail("test_arena_preset_base_tint", "Base tint should be neutral warm")

	if preset.layer_colors.size() == 3:
		_pass("test_arena_preset_layer_count")
	else:
		_fail("test_arena_preset_layer_count", "Should have 3 layer colors")

	if preset.supports_parallax == true:
		_pass("test_arena_preset_parallax")
	else:
		_fail("test_arena_preset_parallax", "Arena should support parallax")

func test_preset_structure() -> void:
	for preset_func in [
		GildedBackgroundPalette.get_main_menu_preset,
		GildedBackgroundPalette.get_forest_preset,
		GildedBackgroundPalette.get_arena_preset
	]:
		var preset = preset_func.call()
		if preset.name != "":
			_pass("test_preset_%s_has_name" % preset.name)
		else:
			_fail("test_preset_%s_has_name" % preset.name, "Preset should have non-empty name")

		if preset.layer_colors.size() > 0:
			_pass("test_preset_%s_has_layers" % preset.name)
		else:
			_fail("test_preset_%s_has_layers" % preset.name, "Preset should have layer colors")

func test_get_all_presets() -> void:
	var presets = GildedBackgroundPalette.get_all_presets()

	if presets.size() == 3:
		_pass("test_all_presets_count")
	else:
		_fail("test_all_presets_count", "Should return 3 presets, got %d" % presets.size())

	var names = []
	for p in presets:
		names.append(p.name)

	if "main_menu" in names and "gameplay_forest" in names and "gameplay_arena" in names:
		_pass("test_all_presets_contains_expected")
	else:
		_fail("test_all_presets_contains_expected", "Should contain all expected presets")

func test_get_layer_color() -> void:
	var layer0 = GildedBackgroundPalette.get_layer_color("main_menu", 0)
	if typeof(layer0) == TYPE_COLOR:
		_pass("test_get_layer_color_returns_color")
	else:
		_fail("test_get_layer_color_returns_color", "Should return Color type")

	var forest_layer1 = GildedBackgroundPalette.get_layer_color("gameplay_forest", 1)
	if typeof(forest_layer1) == TYPE_COLOR:
		_pass("test_get_forest_layer_color")
	else:
		_fail("test_get_forest_layer_color", "Should return Color type")

	var arena_layer2 = GildedBackgroundPalette.get_layer_color("gameplay_arena", 2)
	if typeof(arena_layer2) == TYPE_COLOR:
		_pass("test_get_arena_layer_color")
	else:
		_fail("test_get_arena_layer_color", "Should return Color type")

func test_get_layer_color_bounds() -> void:
	var out_of_bounds = GildedBackgroundPalette.get_layer_color("main_menu", 99)
	var main_menu = GildedBackgroundPalette.get_main_menu_preset()

	if out_of_bounds == main_menu.base_tint:
		_pass("test_get_layer_color_out_of_bounds_returns_base")
	else:
		_fail("test_get_layer_color_out_of_bounds_returns_base", "Out of bounds should return base_tint")

	var negative_index = GildedBackgroundPalette.get_layer_color("main_menu", -1)
	if typeof(negative_index) == TYPE_COLOR:
		_pass("test_get_layer_color_negative_index")
	else:
		_fail("test_get_layer_color_negative_index", "Negative index should still return Color")

	var unknown_preset = GildedBackgroundPalette.get_layer_color("unknown_preset", 0)
	if typeof(unknown_preset) == TYPE_COLOR:
		_pass("test_get_layer_color_unknown_preset")
	else:
		_fail("test_get_layer_color_unknown_preset", "Unknown preset should return Color")

func test_background_preset_class() -> void:
	var preset = GildedBackgroundPalette.BackgroundPreset.new(
		"test_preset",
		Color.RED,
		[Color.BLUE, Color.GREEN],
		true
	)

	if preset.name == "test_preset":
		_pass("test_preset_class_name")
	else:
		_fail("test_preset_class_name", "Preset name should match")

	if preset.base_tint == Color.RED:
		_pass("test_preset_class_base_tint")
	else:
		_fail("test_preset_class_base_tint", "Base tint should match")

	if preset.layer_colors.size() == 2:
		_pass("test_preset_class_layer_count")
	else:
		_fail("test_preset_class_layer_count", "Layer count should match")

	if preset.supports_parallax == true:
		_pass("test_preset_class_parallax")
	else:
		_fail("test_preset_class_parallax", "Parallax should match")
