extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running SpritePalette Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_default_colors()
	await test_hero_palette()
	await test_enemy_palette()
	await test_boss_palette()
	await test_unknown_type_palette()
	await test_palette_color_types()
	await test_get_palette_keys()

	print("\n=== SpritePalette Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_palette() -> GildedSpritePalette:
	return GildedSpritePalette.new()

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

	if palette.royal_blue == Color("#0060ce"):
		_pass("test_default_royal_blue")
	else:
		_fail("test_default_royal_blue", "Royal blue should be #0060ce")

	if palette.gold == Color("#ffd700"):
		_pass("test_default_gold")
	else:
		_fail("test_default_gold", "Gold should be #ffd700")

	if palette.emerald == Color("#50c878"):
		_pass("test_default_emerald")
	else:
		_fail("test_default_emerald", "Emerald should be #50c878")

	if palette.parchment == Color("#fdffda"):
		_pass("test_default_parchment")
	else:
		_fail("test_default_parchment", "Parchment should be #fdffda")

	if palette.hero_tint == Color("#ffe6b3"):
		_pass("test_default_hero_tint")
	else:
		_fail("test_default_hero_tint", "Hero tint should be #ffe6b3")

	if palette.enemy_tint == Color("#b3ccf0"):
		_pass("test_default_enemy_tint")
	else:
		_fail("test_default_enemy_tint", "Enemy tint should be #b3ccf0")

	if palette.boss_tint == Color("#ffd999"):
		_pass("test_default_boss_tint")
	else:
		_fail("test_default_boss_tint", "Boss tint should be #ffd999")

func test_hero_palette() -> void:
	var palette = _create_palette()
	var hero = palette.get_palette_for_character("hero")

	if hero.has("primary") and hero.has("secondary") and hero.has("tint"):
		_pass("test_hero_palette_has_keys")
	else:
		_fail("test_hero_palette_has_keys", "Hero palette should have primary, secondary, tint")

	if hero.primary == palette.gold:
		_pass("test_hero_primary_is_gold")
	else:
		_fail("test_hero_primary_is_gold", "Hero primary should be gold")

	if hero.secondary == palette.emerald:
		_pass("test_hero_secondary_is_emerald")
	else:
		_fail("test_hero_secondary_is_emerald", "Hero secondary should be emerald")

	if hero.tint == palette.hero_tint:
		_pass("test_hero_tint_correct")
	else:
		_fail("test_hero_tint_correct", "Hero tint should match hero_tint")

func test_enemy_palette() -> void:
	var palette = _create_palette()
	var enemy = palette.get_palette_for_character("enemy")

	if enemy.has("primary") and enemy.has("secondary") and enemy.has("tint"):
		_pass("test_enemy_palette_has_keys")
	else:
		_fail("test_enemy_palette_has_keys", "Enemy palette should have primary, secondary, tint")

	if enemy.primary == palette.royal_blue:
		_pass("test_enemy_primary_is_royal_blue")
	else:
		_fail("test_enemy_primary_is_royal_blue", "Enemy primary should be royal_blue")

	if enemy.secondary == palette.emerald:
		_pass("test_enemy_secondary_is_emerald")
	else:
		_fail("test_enemy_secondary_is_emerald", "Enemy secondary should be emerald")

	if enemy.tint == palette.enemy_tint:
		_pass("test_enemy_tint_correct")
	else:
		_fail("test_enemy_tint_correct", "Enemy tint should match enemy_tint")

func test_boss_palette() -> void:
	var palette = _create_palette()
	var boss = palette.get_palette_for_character("boss")

	if boss.has("primary") and boss.has("secondary") and boss.has("tint"):
		_pass("test_boss_palette_has_keys")
	else:
		_fail("test_boss_palette_has_keys", "Boss palette should have primary, secondary, tint")

	if boss.primary == palette.gold:
		_pass("test_boss_primary_is_gold")
	else:
		_fail("test_boss_primary_is_gold", "Boss primary should be gold")

	if boss.secondary == palette.emerald:
		_pass("test_boss_secondary_is_emerald")
	else:
		_fail("test_boss_secondary_is_emerald", "Boss secondary should be emerald")

	if boss.tint == palette.boss_tint:
		_pass("test_boss_tint_correct")
	else:
		_fail("test_boss_tint_correct", "Boss tint should match boss_tint")

func test_unknown_type_palette() -> void:
	var palette = _create_palette()
	var unknown = palette.get_palette_for_character("unknown_type")

	if unknown.has("primary") and unknown.has("secondary") and unknown.has("tint"):
		_pass("test_unknown_palette_has_keys")
	else:
		_fail("test_unknown_palette_has_keys", "Unknown type palette should have keys")

	if unknown.primary == palette.gold:
		_pass("test_unknown_primary_defaults_to_gold")
	else:
		_fail("test_unknown_primary_defaults_to_gold", "Unknown type should default to gold")

	if unknown.tint == palette.hero_tint:
		_pass("test_unknown_tint_defaults_to_hero")
	else:
		_fail("test_unknown_tint_defaults_to_hero", "Unknown type should default to hero tint")

func test_palette_color_types() -> void:
	var palette = _create_palette()

	if typeof(palette.royal_blue) == TYPE_COLOR:
		_pass("test_royal_blue_is_color_type")
	else:
		_fail("test_royal_blue_is_color_type", "royal_blue should be Color type")

	if typeof(palette.gold) == TYPE_COLOR:
		_pass("test_gold_is_color_type")
	else:
		_fail("test_gold_is_color_type", "gold should be Color type")

	if typeof(palette.parchment) == TYPE_COLOR:
		_pass("test_parchment_is_color_type")
	else:
		_fail("test_parchment_is_color_type", "parchment should be Color type")

func test_get_palette_keys() -> void:
	var palette = _create_palette()

	for char_type in ["hero", "enemy", "boss", "unknown"]:
		var result = palette.get_palette_for_character(char_type)
		if result.keys().size() == 3:
			_pass("test_palette_%s_has_3_keys" % char_type)
		else:
			_fail("test_palette_%s_has_3_keys" % char_type, "Palette should have 3 keys")
