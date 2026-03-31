extends GutTest

# Unit tests for design_tokens.gd
# Tests design token constants and helper functions

func test_primary_colors_exist() -> void:
	assert_true(DesignTokens.has_signal(""), "DesignTokens autoload should exist")
	assert_eq(DesignTokens.COLOR_PRIMARY, Color("#4A90D9"), "Primary color should match")

func test_secondary_colors() -> void:
	assert_eq(DesignTokens.COLOR_SECONDARY, Color("#6B7280"), "Secondary color should match")

func test_semantic_colors() -> void:
	assert_eq(DesignTokens.COLOR_SUCCESS, Color("#22C55E"), "Success color should match")
	assert_eq(DesignTokens.COLOR_WARNING, Color("#F59E0B"), "Warning color should match")
	assert_eq(DesignTokens.COLOR_ERROR, Color("#EF4444"), "Error color should match")
	assert_eq(DesignTokens.COLOR_INFO, Color("#3B82F6"), "Info color should match")

func test_background_colors_dark() -> void:
	assert_eq(DesignTokens.COLOR_BACKGROUND_DARK, Color("#0F0F1A"), "Background dark should match")
	assert_eq(DesignTokens.COLOR_SURFACE_DARK, Color("#1A1A2E"), "Surface dark should match")

func test_background_colors_light() -> void:
	assert_eq(DesignTokens.COLOR_BACKGROUND_LIGHT, Color("#F8FAFC"), "Background light should match")
	assert_eq(DesignTokens.COLOR_SURFACE_LIGHT, Color("#FFFFFF"), "Surface light should match")

func test_game_colors() -> void:
	assert_eq(DesignTokens.COLOR_HEALTH, Color("#22C55E"), "Health color should match")
	assert_eq(DesignTokens.COLOR_HEALTH_LOW, Color("#EF4444"), "Health low color should match")
	assert_eq(DesignTokens.COLOR_GOLD, Color("#F59E0B"), "Gold color should match")
	assert_eq(DesignTokens.COLOR_GEMS, Color("#8B5CF6"), "Gems color should match")

func test_rarity_colors() -> void:
	assert_eq(DesignTokens.COLOR_RARITY_COMMON, Color("#9CA3AF"), "Common rarity should match")
	assert_eq(DesignTokens.COLOR_RARITY_RARE, Color("#3B82F6"), "Rare rarity should match")
	assert_eq(DesignTokens.COLOR_RARITY_EPIC, Color("#8B5CF6"), "Epic rarity should match")
	assert_eq(DesignTokens.COLOR_RARITY_LEGENDARY, Color("#F59E0B"), "Legendary rarity should match")

func test_font_sizes() -> void:
	assert_eq(DesignTokens.FONT_SIZE_XS, 10, "Font size XS should be 10")
	assert_eq(DesignTokens.FONT_SIZE_SM, 12, "Font size SM should be 12")
	assert_eq(DesignTokens.FONT_SIZE_BASE, 14, "Font size BASE should be 14")
	assert_eq(DesignTokens.FONT_SIZE_LG, 16, "Font size LG should be 16")
	assert_eq(DesignTokens.FONT_SIZE_XL, 18, "Font size XL should be 18")

func test_spacing_values() -> void:
	assert_eq(DesignTokens.SPACING_XS, 4, "Spacing XS should be 4")
	assert_eq(DesignTokens.SPACING_SM, 8, "Spacing SM should be 8")
	assert_eq(DesignTokens.SPACING_MD, 12, "Spacing MD should be 12")
	assert_eq(DesignTokens.SPACING_LG, 16, "Spacing LG should be 16")
	assert_eq(DesignTokens.SPACING_XL, 24, "Spacing XL should be 24")

func test_corner_radius() -> void:
	assert_eq(DesignTokens.RADIUS_NONE, 0, "Radius none should be 0")
	assert_eq(DesignTokens.RADIUS_SM, 4, "Radius SM should be 4")
	assert_eq(DesignTokens.RADIUS_MD, 8, "Radius MD should be 8")
	assert_eq(DesignTokens.RADIUS_LG, 12, "Radius LG should be 12")

func test_animation_durations() -> void:
	assert_eq(DesignTokens.ANIM_DURATION_INSTANT, 0.0, "Instant duration should be 0.0")
	assert_eq(DesignTokens.ANIM_DURATION_FAST, 0.1, "Fast duration should be 0.1")
	assert_eq(DesignTokens.ANIM_DURATION_NORMAL, 0.2, "Normal duration should be 0.2")
	assert_eq(DesignTokens.ANIM_DURATION_SLOW, 0.3, "Slow duration should be 0.3")

func test_z_index_layers() -> void:
	assert_eq(DesignTokens.Z_BASE, 0, "Z_BASE should be 0")
	assert_eq(DesignTokens.Z_OVERLAY, 100, "Z_OVERLAY should be 100")
	assert_eq(DesignTokens.Z_MODAL, 300, "Z_MODAL should be 300")
	assert_eq(DesignTokens.Z_TOAST, 400, "Z_TOAST should be 400")

func test_get_primary_color_default() -> void:
	var color = DesignTokens.get_primary_color()
	assert_eq(color, DesignTokens.COLOR_PRIMARY, "Default primary color should match")

func test_get_primary_color_hover() -> void:
	var color = DesignTokens.get_primary_color("hover")
	assert_eq(color, DesignTokens.COLOR_PRIMARY_HOVER, "Hover primary color should match")

func test_get_primary_color_pressed() -> void:
	var color = DesignTokens.get_primary_color("pressed")
	assert_eq(color, DesignTokens.COLOR_PRIMARY_PRESSED, "Pressed primary color should match")

func test_get_primary_color_disabled() -> void:
	var color = DesignTokens.get_primary_color("disabled")
	assert_eq(color, DesignTokens.COLOR_PRIMARY_DISABLED, "Disabled primary color should match")

func test_get_semantic_color_success() -> void:
	var color = DesignTokens.get_semantic_color("success")
	assert_eq(color, DesignTokens.COLOR_SUCCESS, "Success semantic color should match")

func test_get_semantic_color_warning() -> void:
	var color = DesignTokens.get_semantic_color("warning")
	assert_eq(color, DesignTokens.COLOR_WARNING, "Warning semantic color should match")

func test_get_semantic_color_error() -> void:
	var color = DesignTokens.get_semantic_color("error")
	assert_eq(color, DesignTokens.COLOR_ERROR, "Error semantic color should match")

func test_get_background_color_dark() -> void:
	var color = DesignTokens.get_background_color(true)
	assert_eq(color, DesignTokens.COLOR_BACKGROUND_DARK, "Dark background should match")

func test_get_background_color_light() -> void:
	var color = DesignTokens.get_background_color(false)
	assert_eq(color, DesignTokens.COLOR_BACKGROUND_LIGHT, "Light background should match")

func test_get_surface_color_dark() -> void:
	var color = DesignTokens.get_surface_color(true)
	assert_eq(color, DesignTokens.COLOR_SURFACE_DARK, "Dark surface should match")

func test_get_surface_color_light() -> void:
	var color = DesignTokens.get_surface_color(false)
	assert_eq(color, DesignTokens.COLOR_SURFACE_LIGHT, "Light surface should match")

func test_get_text_primary_color_dark() -> void:
	var color = DesignTokens.get_text_primary_color(true)
	assert_eq(color, DesignTokens.COLOR_TEXT_PRIMARY_DARK, "Dark text primary should match")

func test_get_text_primary_color_light() -> void:
	var color = DesignTokens.get_text_primary_color(false)
	assert_eq(color, DesignTokens.COLOR_TEXT_PRIMARY_LIGHT, "Light text primary should match")

func test_get_scaled_font_size_default() -> void:
	var size = DesignTokens.get_scaled_font_size(16)
	assert_eq(size, 16, "Default scale should return base size")

func test_get_scaled_font_size_min() -> void:
	var size = DesignTokens.get_scaled_font_size(16, 0.8)
	assert_eq(size, 12, "Min scale should return scaled size")

func test_get_scaled_font_size_max() -> void:
	var size = DesignTokens.get_scaled_font_size(16, 1.5)
	assert_eq(size, 24, "Max scale should return scaled size")

func test_get_health_color_full() -> void:
	var color = DesignTokens.get_health_color(1.0)
	assert_eq(color, DesignTokens.COLOR_HEALTH, "Full health should return green")

func test_get_health_color_low() -> void:
	var color = DesignTokens.get_health_color(0.2)
	assert_eq(color, DesignTokens.COLOR_HEALTH_LOW, "Low health should return red")

func test_get_health_color_medium() -> void:
	var color = DesignTokens.get_health_color(0.4)
	assert_eq(color, DesignTokens.COLOR_HEALTH_MEDIUM, "Medium health should return yellow")

func test_get_rarity_color_common() -> void:
	var color = DesignTokens.get_rarity_color("common")
	assert_eq(color, DesignTokens.COLOR_RARITY_COMMON, "Common rarity should match")

func test_get_rarity_color_rare() -> void:
	var color = DesignTokens.get_rarity_color("rare")
	assert_eq(color, DesignTokens.COLOR_RARITY_RARE, "Rare rarity should match")

func test_get_rarity_color_epic() -> void:
	var color = DesignTokens.get_rarity_color("epic")
	assert_eq(color, DesignTokens.COLOR_RARITY_EPIC, "Epic rarity should match")

func test_get_rarity_color_legendary() -> void:
	var color = DesignTokens.get_rarity_color("legendary")
	assert_eq(color, DesignTokens.COLOR_RARITY_LEGENDARY, "Legendary rarity should match")

func test_get_rarity_color_unknown() -> void:
	var color = DesignTokens.get_rarity_color("unknown")
	assert_eq(color, DesignTokens.COLOR_RARITY_COMMON, "Unknown rarity should default to common")
