extends GutTest

# Unit tests for ArcherDesignTokens.gd
# Tests design token constants and helper functions

const ArcherDesignTokens = preload("res://autoloads/ArcherDesignTokens.gd")

func test_primary_colors_exist() -> void:
	assert_eq(ArcherDesignTokens.COLOR_PRIMARY, Color("#0060ce"), "Primary color should match")
	assert_eq(ArcherDesignTokens.COLOR_PRIMARY_FIXED, Color("#6e9fff"), "Primary fixed color should match")
	assert_eq(ArcherDesignTokens.COLOR_PRIMARY_DIM, Color("#0054b7"), "Primary dim color should match")

func test_secondary_colors() -> void:
	assert_eq(ArcherDesignTokens.COLOR_SECONDARY, Color("#8d5900"), "Secondary color should match")
	assert_eq(ArcherDesignTokens.COLOR_SECONDARY_CONTAINER, Color("#ffc885"), "Secondary container color should match")

func test_tertiary_colors() -> void:
	assert_eq(ArcherDesignTokens.COLOR_TERTIARY, Color("#00734e"), "Tertiary color should match")
	assert_eq(ArcherDesignTokens.COLOR_TERTIARY_CONTAINER, Color("#69f6b8"), "Tertiary container color should match")

func test_semantic_colors() -> void:
	assert_eq(ArcherDesignTokens.COLOR_SUCCESS, Color("#22C55E"), "Success color should match")
	assert_eq(ArcherDesignTokens.COLOR_WARNING, Color("#F59E0B"), "Warning color should match")
	assert_eq(ArcherDesignTokens.COLOR_ERROR, Color("#EF4444"), "Error color should match")
	assert_eq(ArcherDesignTokens.COLOR_INFO, Color("#3B82F6"), "Info color should match")

func test_background_colors_dark() -> void:
	assert_eq(ArcherDesignTokens.COLOR_BACKGROUND_DARK, Color("#0F0F1A"), "Background dark should match")
	assert_eq(ArcherDesignTokens.COLOR_SURFACE_DARK, Color("#1A1A2E"), "Surface dark should match")

func test_background_colors_light() -> void:
	assert_eq(ArcherDesignTokens.COLOR_BACKGROUND_LIGHT, Color("#F8FAFC"), "Background light should match")
	assert_eq(ArcherDesignTokens.COLOR_SURFACE_LIGHT, Color("#FFFFFF"), "Surface light should match")

func test_surface_colors() -> void:
	assert_eq(ArcherDesignTokens.COLOR_SURFACE, Color("#fdffda"), "Surface color should match")
	assert_eq(ArcherDesignTokens.COLOR_SURFACE_CONTAINER, Color("#f6f3eb"), "Surface container color should match")

func test_game_colors() -> void:
	assert_eq(ArcherDesignTokens.COLOR_HEALTH, Color("#00734e"), "Health color should match")
	assert_eq(ArcherDesignTokens.COLOR_HEALTH_LOW, Color(0.94, 0.27, 0.31, 1), "Health low color should match")
	assert_eq(ArcherDesignTokens.COLOR_GOLD, Color("#8d5900"), "Gold color should match")
	assert_eq(ArcherDesignTokens.COLOR_GEMS, Color("#8B5CF6"), "Gems color should match")

func test_rarity_colors() -> void:
	assert_eq(ArcherDesignTokens.COLOR_RARITY_COMMON, Color(0.61, 0.61, 0.61, 1), "Common rarity should match")
	assert_eq(ArcherDesignTokens.COLOR_RARITY_RARE, Color("#0060ce"), "Rare rarity should match")
	assert_eq(ArcherDesignTokens.COLOR_RARITY_EPIC, Color("#8d5900"), "Epic rarity should match")
	assert_eq(ArcherDesignTokens.COLOR_RARITY_LEGENDARY, Color(1, 0.77, 0.22, 1), "Legendary rarity should match")

func test_font_sizes() -> void:
	assert_eq(ArcherDesignTokens.FONT_SIZE_XS, 10, "Font size XS should be 10")
	assert_eq(ArcherDesignTokens.FONT_SIZE_SM, 12, "Font size SM should be 12")
	assert_eq(ArcherDesignTokens.FONT_SIZE_BASE, 14, "Font size BASE should be 14")
	assert_eq(ArcherDesignTokens.FONT_SIZE_LG, 16, "Font size LG should be 16")
	assert_eq(ArcherDesignTokens.FONT_SIZE_TITLE, 24, "Font size TITLE should be 24")

func test_spacing_values() -> void:
	assert_eq(ArcherDesignTokens.SPACING_XS, 4, "Spacing XS should be 4")
	assert_eq(ArcherDesignTokens.SPACING_SM, 8, "Spacing SM should be 8")
	assert_eq(ArcherDesignTokens.SPACING_MD, 12, "Spacing MD should be 12")
	assert_eq(ArcherDesignTokens.SPACING_LG, 16, "Spacing LG should be 16")
	assert_eq(ArcherDesignTokens.SPACING_XL, 24, "Spacing XL should be 24")
	assert_eq(ArcherDesignTokens.SPACING_2XL, 32, "Spacing 2XL should be 32")

func test_corner_radius() -> void:
	assert_eq(ArcherDesignTokens.RADIUS_NONE, 0, "Radius none should be 0")
	assert_eq(ArcherDesignTokens.RADIUS_SM, 4, "Radius SM should be 4")
	assert_eq(ArcherDesignTokens.RADIUS_MD, 8, "Radius MD should be 8")
	assert_eq(ArcherDesignTokens.RADIUS_LG, 12, "Radius LG should be 12")
	assert_eq(ArcherDesignTokens.RADIUS_FULL, 9999, "Radius FULL should be 9999")

func test_animation_durations() -> void:
	assert_eq(ArcherDesignTokens.ANIM_DURATION_INSTANT, 0.0, "Instant duration should be 0.0")
	assert_eq(ArcherDesignTokens.ANIM_DURATION_FAST, 0.1, "Fast duration should be 0.1")
	assert_eq(ArcherDesignTokens.ANIM_DURATION_NORMAL, 0.2, "Normal duration should be 0.2")
	assert_eq(ArcherDesignTokens.ANIM_DURATION_SLOW, 0.3, "Slow duration should be 0.3")

func test_z_index_layers() -> void:
	assert_eq(ArcherDesignTokens.Z_BASE, 0, "Z_BASE should be 0")
	assert_eq(ArcherDesignTokens.Z_OVERLAY, 100, "Z_OVERLAY should be 100")
	assert_eq(ArcherDesignTokens.Z_MODAL, 300, "Z_MODAL should be 300")
	assert_eq(ArcherDesignTokens.Z_TOAST, 400, "Z_TOAST should be 400")

func test_get_primary_color_default() -> void:
	var color = ArcherDesignTokens.get_primary_color("default")
	assert_eq(color, ArcherDesignTokens.COLOR_PRIMARY, "Default primary color should match")

func test_get_primary_color_hover() -> void:
	var color = ArcherDesignTokens.get_primary_color("hover")
	assert_eq(color, ArcherDesignTokens.COLOR_PRIMARY_FIXED, "Hover primary color should match")

func test_get_primary_color_pressed() -> void:
	var color = ArcherDesignTokens.get_primary_color("pressed")
	assert_eq(color, ArcherDesignTokens.COLOR_PRIMARY_DIM, "Pressed primary color should match")

func test_get_primary_color_disabled() -> void:
	var color = ArcherDesignTokens.get_primary_color("disabled")
	assert_eq(color, Color(1, 1, 1, 0.4), "Disabled primary color should be 40% opacity white")

func test_get_secondary_color_default() -> void:
	var color = ArcherDesignTokens.get_secondary_color("default")
	assert_eq(color, ArcherDesignTokens.COLOR_SECONDARY, "Default secondary color should match")

func test_get_secondary_color_hover() -> void:
	var color = ArcherDesignTokens.get_secondary_color("hover")
	assert_eq(color, ArcherDesignTokens.COLOR_SECONDARY_FIXED, "Hover secondary color should match")

func test_get_semantic_color_success() -> void:
	var color = ArcherDesignTokens.get_semantic_color("success")
	assert_eq(color, ArcherDesignTokens.COLOR_SUCCESS, "Success semantic color should match")

func test_get_semantic_color_warning() -> void:
	var color = ArcherDesignTokens.get_semantic_color("warning")
	assert_eq(color, ArcherDesignTokens.COLOR_WARNING, "Warning semantic color should match")

func test_get_semantic_color_error() -> void:
	var color = ArcherDesignTokens.get_semantic_color("error")
	assert_eq(color, ArcherDesignTokens.COLOR_ERROR, "Error semantic color should match")

func test_get_semantic_color_info() -> void:
	var color = ArcherDesignTokens.get_semantic_color("info")
	assert_eq(color, ArcherDesignTokens.COLOR_INFO, "Info semantic color should match")

func test_get_background_color_dark() -> void:
	var color = ArcherDesignTokens.get_background_color(true)
	assert_eq(color, ArcherDesignTokens.COLOR_BACKGROUND_DARK, "Dark background should match")

func test_get_background_color_light() -> void:
	var color = ArcherDesignTokens.get_background_color(false)
	assert_eq(color, ArcherDesignTokens.COLOR_BACKGROUND_LIGHT, "Light background should match")

func test_get_surface_tier_color() -> void:
	var color = ArcherDesignTokens.get_surface_tier_color("base")
	assert_eq(color, ArcherDesignTokens.COLOR_SURFACE, "Base surface should match")

	var container = ArcherDesignTokens.get_surface_tier_color("container")
	assert_eq(container, ArcherDesignTokens.COLOR_SURFACE_CONTAINER, "Container surface should match")

func test_get_ambient_shadow_color() -> void:
	var color = ArcherDesignTokens.get_ambient_shadow_color()
	assert_eq(color, ArcherDesignTokens.COLOR_AMBIENT_SHADOW, "Ambient shadow color should match")

func test_get_ghost_border_color() -> void:
	var color = ArcherDesignTokens.get_ghost_border_color()
	assert_eq(color, ArcherDesignTokens.COLOR_GHOST_BORDER, "Ghost border color should match")

func test_get_text_primary_color_dark() -> void:
	var color = ArcherDesignTokens.get_text_primary_color(true)
	assert_eq(color, ArcherDesignTokens.COLOR_TEXT_PRIMARY_DARK, "Dark text primary should match")

func test_get_text_primary_color_light() -> void:
	var color = ArcherDesignTokens.get_text_primary_color(false)
	assert_eq(color, ArcherDesignTokens.COLOR_TEXT_PRIMARY_LIGHT, "Light text primary should match")

func test_get_scaled_font_size_default() -> void:
	var size = ArcherDesignTokens.get_scaled_font_size(16, 1.0)
	assert_eq(size, 16, "Default scale should return base size")

func test_get_scaled_font_size_min() -> void:
	var size = ArcherDesignTokens.get_scaled_font_size(16, 0.8)
	assert_eq(size, 12, "Min scale should return scaled size")

func test_get_scaled_font_size_max() -> void:
	var size = ArcherDesignTokens.get_scaled_font_size(16, 1.5)
	assert_eq(size, 24, "Max scale should return scaled size")

func test_get_health_color_full() -> void:
	var color = ArcherDesignTokens.get_health_color(0.8)
	assert_eq(color, ArcherDesignTokens.COLOR_TERTIARY, "High health should return green")

func test_get_health_color_low() -> void:
	var color = ArcherDesignTokens.get_health_color(0.1)
	assert_eq(color, Color(0.94, 0.27, 0.31, 1), "Low health should return red")

func test_get_health_color_medium() -> void:
	var color = ArcherDesignTokens.get_health_color(0.4)
	assert_eq(color, Color(0.96, 0.71, 0.35, 1), "Medium health should return yellow")

func test_get_rarity_color_common() -> void:
	var color = ArcherDesignTokens.get_rarity_color("common")
	assert_eq(color, ArcherDesignTokens.COLOR_RARITY_COMMON, "Common rarity should match")

func test_get_rarity_color_rare() -> void:
	var color = ArcherDesignTokens.get_rarity_color("rare")
	assert_eq(color, ArcherDesignTokens.COLOR_RARITY_RARE, "Rare rarity should match")

func test_get_rarity_color_epic() -> void:
	var color = ArcherDesignTokens.get_rarity_color("epic")
	assert_eq(color, ArcherDesignTokens.COLOR_RARITY_EPIC, "Epic rarity should match")

func test_get_rarity_color_legendary() -> void:
	var color = ArcherDesignTokens.get_rarity_color("legendary")
	assert_eq(color, ArcherDesignTokens.COLOR_RARITY_LEGENDARY, "Legendary rarity should match")

func test_get_rarity_color_unknown() -> void:
	var color = ArcherDesignTokens.get_rarity_color("unknown")
	assert_eq(color, ArcherDesignTokens.COLOR_RARITY_COMMON, "Unknown rarity should default to common")

func test_get_gradient_colors() -> void:
	var colors = ArcherDesignTokens.get_gradient_colors("primary")
	assert_eq(colors[0], ArcherDesignTokens.COLOR_GRADIENT_PRIMARY_START, "Gradient primary start should match")
	assert_eq(colors[1], ArcherDesignTokens.COLOR_GRADIENT_PRIMARY_END, "Gradient primary end should match")

func test_is_color_light() -> void:
	assert_true(ArcherDesignTokens.is_color_light(Color("#ffffff")), "White should be light")
	assert_false(ArcherDesignTokens.is_color_light(Color("#000000")), "Black should not be light")
