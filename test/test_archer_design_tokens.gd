extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running ArcherDesignTokens Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_primary_colors()
	await test_semantic_colors()
	await test_neutral_colors()
	await test_game_colors()
	await test_typography_sizes()
	await test_spacing_values()
	await test_corner_radius()
	await test_animation_durations()
	await test_get_primary_color()
	await test_get_semantic_color()
	await test_get_background_color()
	await test_get_health_color()
	await test_get_rarity_color()
	await test_get_scaled_font_size()

	print("\n=== ArcherDesignTokens Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_primary_colors() -> void:
	if ArcherDesignTokens.COLOR_PRIMARY == Color("#4A90D9"):
		_pass("test_color_primary")
	else:
		_fail("test_color_primary", "COLOR_PRIMARY incorrect")

	if ArcherDesignTokens.COLOR_PRIMARY_HOVER == Color("#5BA0E9"):
		_pass("test_color_primary_hover")
	else:
		_fail("test_color_primary_hover", "COLOR_PRIMARY_HOVER incorrect")

	if ArcherDesignTokens.COLOR_PRIMARY_PRESSED == Color("#3A80C9"):
		_pass("test_color_primary_pressed")
	else:
		_fail("test_color_primary_pressed", "COLOR_PRIMARY_PRESSED incorrect")

func test_semantic_colors() -> void:
	if ArcherDesignTokens.COLOR_SUCCESS == Color("#22C55E"):
		_pass("test_color_success")
	else:
		_fail("test_color_success", "COLOR_SUCCESS incorrect")

	if ArcherDesignTokens.COLOR_WARNING == Color("#F59E0B"):
		_pass("test_color_warning")
	else:
		_fail("test_color_warning", "COLOR_WARNING incorrect")

	if ArcherDesignTokens.COLOR_ERROR == Color("#EF4444"):
		_pass("test_color_error")
	else:
		_fail("test_color_error", "COLOR_ERROR incorrect")

	if ArcherDesignTokens.COLOR_INFO == Color("#3B82F6"):
		_pass("test_color_info")
	else:
		_fail("test_color_info", "COLOR_INFO incorrect")

func test_neutral_colors() -> void:
	if ArcherDesignTokens.COLOR_BACKGROUND_DARK == Color("#0F0F1A"):
		_pass("test_color_background_dark")
	else:
		_fail("test_color_background_dark", "COLOR_BACKGROUND_DARK incorrect")

	if ArcherDesignTokens.COLOR_BACKGROUND_LIGHT == Color("#F8FAFC"):
		_pass("test_color_background_light")
	else:
		_fail("test_color_background_light", "COLOR_BACKGROUND_LIGHT incorrect")

	if ArcherDesignTokens.COLOR_SURFACE_DARK == Color("#1A1A2E"):
		_pass("test_color_surface_dark")
	else:
		_fail("test_color_surface_dark", "COLOR_SURFACE_DARK incorrect")

	if ArcherDesignTokens.COLOR_TEXT_PRIMARY_DARK == Color("#F8FAFC"):
		_pass("test_color_text_primary_dark")
	else:
		_fail("test_color_text_primary_dark", "COLOR_TEXT_PRIMARY_DARK incorrect")

func test_game_colors() -> void:
	if ArcherDesignTokens.COLOR_HEALTH == Color("#22C55E"):
		_pass("test_color_health")
	else:
		_fail("test_color_health", "COLOR_HEALTH incorrect")

	if ArcherDesignTokens.COLOR_HEALTH_LOW == Color("#EF4444"):
		_pass("test_color_health_low")
	else:
		_fail("test_color_health_low", "COLOR_HEALTH_LOW incorrect")

	if ArcherDesignTokens.COLOR_GOLD == Color("#F59E0B"):
		_pass("test_color_gold")
	else:
		_fail("test_color_gold", "COLOR_GOLD incorrect")

	if ArcherDesignTokens.COLOR_GEMS == Color("#8B5CF6"):
		_pass("test_color_gems")
	else:
		_fail("test_color_gems", "COLOR_GEMS incorrect")

	if ArcherDesignTokens.COLOR_RARITY_COMMON == Color("#9CA3AF"):
		_pass("test_color_rarity_common")
	else:
		_fail("test_color_rarity_common", "COLOR_RARITY_COMMON incorrect")

	if ArcherDesignTokens.COLOR_RARITY_RARE == Color("#3B82F6"):
		_pass("test_color_rarity_rare")
	else:
		_fail("test_color_rarity_rare", "COLOR_RARITY_RARE incorrect")

	if ArcherDesignTokens.COLOR_RARITY_EPIC == Color("#8B5CF6"):
		_pass("test_color_rarity_epic")
	else:
		_fail("test_color_rarity_epic", "COLOR_RARITY_EPIC incorrect")

	if ArcherDesignTokens.COLOR_RARITY_LEGENDARY == Color("#F59E0B"):
		_pass("test_color_rarity_legendary")
	else:
		_fail("test_color_rarity_legendary", "COLOR_RARITY_LEGENDARY incorrect")

func test_typography_sizes() -> void:
	if ArcherDesignTokens.FONT_SIZE_XS == 10:
		_pass("test_font_size_xs")
	else:
		_fail("test_font_size_xs", "FONT_SIZE_XS incorrect")

	if ArcherDesignTokens.FONT_SIZE_SM == 12:
		_pass("test_font_size_sm")
	else:
		_fail("test_font_size_sm", "FONT_SIZE_SM incorrect")

	if ArcherDesignTokens.FONT_SIZE_BASE == 14:
		_pass("test_font_size_base")
	else:
		_fail("test_font_size_base", "FONT_SIZE_BASE incorrect")

	if ArcherDesignTokens.FONT_SIZE_LG == 16:
		_pass("test_font_size_lg")
	else:
		_fail("test_font_size_lg", "FONT_SIZE_LG incorrect")

	if ArcherDesignTokens.FONT_SIZE_TITLE == 24:
		_pass("test_font_size_title")
	else:
		_fail("test_font_size_title", "FONT_SIZE_TITLE incorrect")

func test_spacing_values() -> void:
	if ArcherDesignTokens.SPACING_XS == 4:
		_pass("test_spacing_xs")
	else:
		_fail("test_spacing_xs", "SPACING_XS incorrect")

	if ArcherDesignTokens.SPACING_SM == 8:
		_pass("test_spacing_sm")
	else:
		_fail("test_spacing_sm", "SPACING_SM incorrect")

	if ArcherDesignTokens.SPACING_MD == 12:
		_pass("test_spacing_md")
	else:
		_fail("test_spacing_md", "SPACING_MD incorrect")

	if ArcherDesignTokens.SPACING_LG == 16:
		_pass("test_spacing_lg")
	else:
		_fail("test_spacing_lg", "SPACING_LG incorrect")

	if ArcherDesignTokens.SPACING_XL == 24:
		_pass("test_spacing_xl")
	else:
		_fail("test_spacing_xl", "SPACING_XL incorrect")

	if ArcherDesignTokens.SPACING_2XL == 32:
		_pass("test_spacing_2xl")
	else:
		_fail("test_spacing_2xl", "SPACING_2XL incorrect")

func test_corner_radius() -> void:
	if ArcherDesignTokens.RADIUS_NONE == 0:
		_pass("test_radius_none")
	else:
		_fail("test_radius_none", "RADIUS_NONE incorrect")

	if ArcherDesignTokens.RADIUS_SM == 4:
		_pass("test_radius_sm")
	else:
		_fail("test_radius_sm", "RADIUS_SM incorrect")

	if ArcherDesignTokens.RADIUS_MD == 8:
		_pass("test_radius_md")
	else:
		_fail("test_radius_md", "RADIUS_MD incorrect")

	if ArcherDesignTokens.RADIUS_LG == 12:
		_pass("test_radius_lg")
	else:
		_fail("test_radius_lg", "RADIUS_LG incorrect")

	if ArcherDesignTokens.RADIUS_FULL == 9999:
		_pass("test_radius_full")
	else:
		_fail("test_radius_full", "RADIUS_FULL incorrect")

func test_animation_durations() -> void:
	if ArcherDesignTokens.ANIM_DURATION_FAST == 0.1:
		_pass("test_anim_duration_fast")
	else:
		_fail("test_anim_duration_fast", "ANIM_DURATION_FAST incorrect")

	if ArcherDesignTokens.ANIM_DURATION_NORMAL == 0.2:
		_pass("test_anim_duration_normal")
	else:
		_fail("test_anim_duration_normal", "ANIM_DURATION_NORMAL incorrect")

	if ArcherDesignTokens.ANIM_DURATION_SLOW == 0.3:
		_pass("test_anim_duration_slow")
	else:
		_fail("test_anim_duration_slow", "ANIM_DURATION_SLOW incorrect")

func test_get_primary_color() -> void:
	var color = ArcherDesignTokens.get_primary_color("default")
	if color == Color("#4A90D9"):
		_pass("test_get_primary_color_default")
	else:
		_fail("test_get_primary_color_default", "get_primary_color default incorrect")

	color = ArcherDesignTokens.get_primary_color("hover")
	if color == Color("#5BA0E9"):
		_pass("test_get_primary_color_hover")
	else:
		_fail("test_get_primary_color_hover", "get_primary_color hover incorrect")

	color = ArcherDesignTokens.get_primary_color("pressed")
	if color == Color("#3A80C9"):
		_pass("test_get_primary_color_pressed")
	else:
		_fail("test_get_primary_color_pressed", "get_primary_color pressed incorrect")

	color = ArcherDesignTokens.get_primary_color("disabled")
	if color == Color("#7AB3E8"):
		_pass("test_get_primary_color_disabled")
	else:
		_fail("test_get_primary_color_disabled", "get_primary_color disabled incorrect")

func test_get_semantic_color() -> void:
	var color = ArcherDesignTokens.get_semantic_color("success")
	if color == Color("#22C55E"):
		_pass("test_get_semantic_color_success")
	else:
		_fail("test_get_semantic_color_success", "get_semantic_color success incorrect")

	color = ArcherDesignTokens.get_semantic_color("warning")
	if color == Color("#F59E0B"):
		_pass("test_get_semantic_color_warning")
	else:
		_fail("test_get_semantic_color_warning", "get_semantic_color warning incorrect")

	color = ArcherDesignTokens.get_semantic_color("error")
	if color == Color("#EF4444"):
		_pass("test_get_semantic_color_error")
	else:
		_fail("test_get_semantic_color_error", "get_semantic_color error incorrect")

func test_get_background_color() -> void:
	var color = ArcherDesignTokens.get_background_color(true)
	if color == Color("#0F0F1A"):
		_pass("test_get_background_color_dark")
	else:
		_fail("test_get_background_color_dark", "get_background_color dark incorrect")

	color = ArcherDesignTokens.get_background_color(false)
	if color == Color("#F8FAFC"):
		_pass("test_get_background_color_light")
	else:
		_fail("test_get_background_color_light", "get_background_color light incorrect")

func test_get_health_color() -> void:
	var color = ArcherDesignTokens.get_health_color(0.8)
	if color == Color("#22C55E"):
		_pass("test_get_health_color_high")
	else:
		_fail("test_get_health_color_high", "get_health_color high incorrect")

	color = ArcherDesignTokens.get_health_color(0.4)
	if color == Color("#F59E0B"):
		_pass("test_get_health_color_medium")
	else:
		_fail("test_get_health_color_medium", "get_health_color medium incorrect")

	color = ArcherDesignTokens.get_health_color(0.1)
	if color == Color("#EF4444"):
		_pass("test_get_health_color_low")
	else:
		_fail("test_get_health_color_low", "get_health_color low incorrect")

func test_get_rarity_color() -> void:
	var color = ArcherDesignTokens.get_rarity_color("common")
	if color == Color("#9CA3AF"):
		_pass("test_get_rarity_color_common")
	else:
		_fail("test_get_rarity_color_common", "get_rarity_color common incorrect")

	color = ArcherDesignTokens.get_rarity_color("rare")
	if color == Color("#3B82F6"):
		_pass("test_get_rarity_color_rare")
	else:
		_fail("test_get_rarity_color_rare", "get_rarity_color rare incorrect")

	color = ArcherDesignTokens.get_rarity_color("epic")
	if color == Color("#8B5CF6"):
		_pass("test_get_rarity_color_epic")
	else:
		_fail("test_get_rarity_color_epic", "get_rarity_color epic incorrect")

	color = ArcherDesignTokens.get_rarity_color("legendary")
	if color == Color("#F59E0B"):
		_pass("test_get_rarity_color_legendary")
	else:
		_fail("test_get_rarity_color_legendary", "get_rarity_color legendary incorrect")

	color = ArcherDesignTokens.get_rarity_color("unknown")
	if color == Color("#9CA3AF"):
		_pass("test_get_rarity_color_unknown")
	else:
		_fail("test_get_rarity_color_unknown", "get_rarity_color unknown should fallback")

func test_get_scaled_font_size() -> void:
	var size = ArcherDesignTokens.get_scaled_font_size(16, 1.0)
	if size == 16:
		_pass("test_get_scaled_font_size_default")
	else:
		_fail("test_get_scaled_font_size_default", "scaled font at 1.0 incorrect")

	size = ArcherDesignTokens.get_scaled_font_size(16, 1.5)
	if size == 24:
		_pass("test_get_scaled_font_size_max")
	else:
		_fail("test_get_scaled_font_size_max", "scaled font at 1.5 incorrect")

	size = ArcherDesignTokens.get_scaled_font_size(16, 0.8)
	if size == 12:
		_pass("test_get_scaled_font_size_min")
	else:
		_fail("test_get_scaled_font_size_min", "scaled font at 0.8 incorrect")

	size = ArcherDesignTokens.get_scaled_font_size(16, 2.0)
	if size == 24:
		_pass("test_get_scaled_font_size_clamp")
	else:
		_fail("test_get_scaled_font_size_clamp", "should clamp to max")