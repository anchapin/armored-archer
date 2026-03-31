extends GutTest

var _tokens = null

func before_each():
	var ArcherDesignTokens = preload("res://autoloads/ArcherDesignTokens.gd")
	_tokens = ArcherDesignTokens

func test_primary_colors_exist():
	assert_eq(_tokens.COLOR_PRIMARY, Color("#4A90D9"))
	assert_eq(_tokens.COLOR_PRIMARY_HOVER, Color("#5BA0E9"))
	assert_eq(_tokens.COLOR_PRIMARY_PRESSED, Color("#3A80C9"))
	assert_eq(_tokens.COLOR_PRIMARY_DISABLED, Color("#7AB3E8"))

func test_secondary_colors_exist():
	assert_eq(_tokens.COLOR_SECONDARY, Color("#6B7280"))
	assert_eq(_tokens.COLOR_SECONDARY_HOVER, Color("#7B8290"))

func test_semantic_colors():
	assert_eq(_tokens.COLOR_SUCCESS, Color("#22C55E"))
	assert_eq(_tokens.COLOR_WARNING, Color("#F59E0B"))
	assert_eq(_tokens.COLOR_ERROR, Color("#EF4444"))
	assert_eq(_tokens.COLOR_INFO, Color("#3B82F6"))

func test_neutral_dark_colors():
	assert_eq(_tokens.COLOR_BACKGROUND_DARK, Color("#0F0F1A"))
	assert_eq(_tokens.COLOR_SURFACE_DARK, Color("#1A1A2E"))
	assert_eq(_tokens.COLOR_SURFACE_VARIANT_DARK, Color("#252540"))
	assert_eq(_tokens.COLOR_BORDER_DARK, Color("#2D2D4A"))

func test_neutral_light_colors():
	assert_eq(_tokens.COLOR_BACKGROUND_LIGHT, Color("#F8FAFC"))
	assert_eq(_tokens.COLOR_SURFACE_LIGHT, Color("#FFFFFF"))
	assert_eq(_tokens.COLOR_SURFACE_VARIANT_LIGHT, Color("#F1F5F9"))
	assert_eq(_tokens.COLOR_BORDER_LIGHT, Color("#E2E8F0"))

func test_text_colors_dark():
	assert_eq(_tokens.COLOR_TEXT_PRIMARY_DARK, Color("#F8FAFC"))
	assert_eq(_tokens.COLOR_TEXT_SECONDARY_DARK, Color("#94A3B8"))
	assert_eq(_tokens.COLOR_TEXT_DISABLED_DARK, Color("#64748B"))

func test_text_colors_light():
	assert_eq(_tokens.COLOR_TEXT_PRIMARY_LIGHT, Color("#0F172A"))
	assert_eq(_tokens.COLOR_TEXT_SECONDARY_LIGHT, Color("#475569"))
	assert_eq(_tokens.COLOR_TEXT_DISABLED_LIGHT, Color("#94A3B8"))

func test_stitched_gilded_palette():
	assert_eq(_tokens.COLOR_SURFACE, Color("#fdffda"))
	assert_eq(_tokens.COLOR_SURFACE_CONTAINER, Color("#f6f3eb"))
	assert_eq(_tokens.COLOR_ON_SURFACE, Color("#383833"))
	assert_eq(_tokens.COLOR_PRIMARY_M3, Color("#0060ce"))
	assert_eq(_tokens.COLOR_SECONDARY_M3, Color("#8d5900"))
	assert_eq(_tokens.COLOR_TERTIARY, Color("#00734e"))

func test_rarity_colors():
	assert_eq(_tokens.COLOR_RARITY_COMMON, Color("#9CA3AF"))
	assert_eq(_tokens.COLOR_RARITY_RARE, Color("#3B82F6"))
	assert_eq(_tokens.COLOR_RARITY_EPIC, Color("#8B5CF6"))
	assert_eq(_tokens.COLOR_RARITY_LEGENDARY, Color("#F59E0B"))

func test_health_colors():
	assert_eq(_tokens.COLOR_HEALTH, Color("#22C55E"))
	assert_eq(_tokens.COLOR_HEALTH_LOW, Color("#EF4444"))
	assert_eq(_tokens.COLOR_HEALTH_MEDIUM, Color("#F59E0B"))

func test_mana_colors():
	assert_eq(_tokens.COLOR_MANA, Color("#3B82F6"))
	assert_eq(_tokens.COLOR_MANA_LOW, Color("#EF4444"))

func test_currency_colors():
	assert_eq(_tokens.COLOR_GOLD, Color("#F59E0B"))
	assert_eq(_tokens.COLOR_GEMS, Color("#8B5CF6"))

func test_player_enemy_colors():
	assert_eq(_tokens.COLOR_PLAYER, Color("#22C55E"))
	assert_eq(_tokens.COLOR_ENEMY, Color("#EF4444"))
	assert_eq(_tokens.COLOR_ALLY, Color("#3B82F6"))

func test_font_sizes():
	assert_eq(_tokens.FONT_SIZE_XS, 10)
	assert_eq(_tokens.FONT_SIZE_SM, 12)
	assert_eq(_tokens.FONT_SIZE_BASE, 14)
	assert_eq(_tokens.FONT_SIZE_LG, 16)
	assert_eq(_tokens.FONT_SIZE_XL, 18)
	assert_eq(_tokens.FONT_SIZE_2XL, 20)
	assert_eq(_tokens.FONT_SIZE_TITLE, 24)
	assert_eq(_tokens.FONT_SIZE_HEADER, 28)
	assert_eq(_tokens.FONT_SIZE_DISPLAY, 32)

func test_font_scale_constants():
	assert_eq(_tokens.FONT_SCALE_MIN, 0.8)
	assert_eq(_tokens.FONT_SCALE_DEFAULT, 1.0)
	assert_eq(_tokens.FONT_SCALE_MAX, 1.5)

func test_spacing_constants():
	assert_eq(_tokens.SPACING_XXS, 2)
	assert_eq(_tokens.SPACING_XS, 4)
	assert_eq(_tokens.SPACING_SM, 8)
	assert_eq(_tokens.SPACING_MD, 12)
	assert_eq(_tokens.SPACING_LG, 16)
	assert_eq(_tokens.SPACING_XL, 24)
	assert_eq(_tokens.SPACING_2XL, 32)
	assert_eq(_tokens.SPACING_3XL, 48)

func test_corner_radius():
	assert_eq(_tokens.RADIUS_NONE, 0)
	assert_eq(_tokens.RADIUS_SM, 4)
	assert_eq(_tokens.RADIUS_MD, 8)
	assert_eq(_tokens.RADIUS_LG, 12)
	assert_eq(_tokens.RADIUS_XL, 16)
	assert_eq(_tokens.RADIUS_FULL, 9999)

func test_shadow_constants():
	assert_eq(_tokens.SHADOW_OFFSET_SM, Vector2(0, 1))
	assert_eq(_tokens.SHADOW_OFFSET_MD, Vector2(0, 2))
	assert_eq(_tokens.SHADOW_OFFSET_LG, Vector2(0, 4))
	assert_eq(_tokens.SHADOW_BLUR_SM, 2)
	assert_eq(_tokens.SHADOW_BLUR_MD, 4)
	assert_eq(_tokens.SHADOW_BLUR_LG, 8)
	assert_eq(_tokens.SHADOW_ALPHA_SM, 0.1)
	assert_eq(_tokens.SHADOW_ALPHA_MD, 0.2)
	assert_eq(_tokens.SHADOW_ALPHA_LG, 0.3)

func test_animation_durations():
	assert_eq(_tokens.ANIM_DURATION_INSTANT, 0.0)
	assert_eq(_tokens.ANIM_DURATION_FAST, 0.1)
	assert_eq(_tokens.ANIM_DURATION_NORMAL, 0.2)
	assert_eq(_tokens.ANIM_DURATION_SLOW, 0.3)
	assert_eq(_tokens.ANIM_DURATION_SLOWER, 0.5)

func test_animation_easing():
	assert_eq(_tokens.ANIM_EASE_OUT, 0.25)
	assert_eq(_tokens.ANIM_EASE_IN_OUT, 0.42)

func test_border_widths():
	assert_eq(_tokens.BORDER_WIDTH_NONE, 0)
	assert_eq(_tokens.BORDER_WIDTH_SM, 1)
	assert_eq(_tokens.BORDER_WIDTH_MD, 2)
	assert_eq(_tokens.BORDER_WIDTH_LG, 3)

func test_opacity_constants():
	assert_eq(_tokens.OPACITY_DISABLED, 0.4)
	assert_eq(_tokens.OPACITY_HIDDEN, 0.0)
	assert_eq(_tokens.OPACITY_TRANSPARENT, 0.5)
	assert_eq(_tokens.OPACITY_FULL, 1.0)

func test_z_index_layers():
	assert_eq(_tokens.Z_BASE, 0)
	assert_eq(_tokens.Z_BELOW, -10)
	assert_eq(_tokens.Z_OVERLAY, 100)
	assert_eq(_tokens.Z_POPUP, 200)
	assert_eq(_tokens.Z_MODAL, 300)
	assert_eq(_tokens.Z_TOAST, 400)

func test_font_paths():
	assert_eq(_tokens.FONT_PLUS_JAKARTA_SANS_PATH, "res://fonts/Plus_Jakarta_Sans.ttf")
	assert_eq(_tokens.FONT_BE_VIETNAM_PRO_PATH, "res://fonts/Be_Vietnam_Pro.ttf")

func test_get_primary_color_default():
	var color = _tokens.get_primary_color()
	assert_eq(color, _tokens.COLOR_PRIMARY)

func test_get_primary_color_hover():
	var color = _tokens.get_primary_color("hover")
	assert_eq(color, _tokens.COLOR_PRIMARY_HOVER)

func test_get_primary_color_pressed():
	var color = _tokens.get_primary_color("pressed")
	assert_eq(color, _tokens.COLOR_PRIMARY_PRESSED)

func test_get_primary_color_disabled():
	var color = _tokens.get_primary_color("disabled")
	assert_eq(color, _tokens.COLOR_PRIMARY_DISABLED)

func test_get_color_primary():
	assert_eq(_tokens.get_color_primary(true), _tokens.COLOR_PRIMARY)
	assert_eq(_tokens.get_color_primary(false), _tokens.COLOR_PRIMARY)

func test_get_semantic_color_success():
	assert_eq(_tokens.get_semantic_color("success"), _tokens.COLOR_SUCCESS)

func test_get_semantic_color_warning():
	assert_eq(_tokens.get_semantic_color("warning"), _tokens.COLOR_WARNING)

func test_get_semantic_color_error():
	assert_eq(_tokens.get_semantic_color("error"), _tokens.COLOR_ERROR)

func test_get_semantic_color_info():
	assert_eq(_tokens.get_semantic_color("info"), _tokens.COLOR_INFO)

func test_get_semantic_color_unknown():
	assert_eq(_tokens.get_semantic_color("unknown"), _tokens.COLOR_INFO)

func test_get_background_color_dark():
	assert_eq(_tokens.get_background_color(true), _tokens.COLOR_BACKGROUND_DARK)

func test_get_background_color_light():
	assert_eq(_tokens.get_background_color(false), _tokens.COLOR_BACKGROUND_LIGHT)

func test_get_surface_color_dark():
	assert_eq(_tokens.get_surface_color(true), _tokens.COLOR_SURFACE_DARK)

func test_get_surface_color_light():
	assert_eq(_tokens.get_surface_color(false), _tokens.COLOR_SURFACE_LIGHT)

func test_get_surface_variant_color_dark():
	assert_eq(_tokens.get_surface_variant_color(true), _tokens.COLOR_SURFACE_VARIANT_DARK)

func test_get_surface_variant_color_light():
	assert_eq(_tokens.get_surface_variant_color(false), _tokens.COLOR_SURFACE_VARIANT_LIGHT)

func test_get_border_color_dark():
	assert_eq(_tokens.get_border_color(true), _tokens.COLOR_BORDER_DARK)

func test_get_border_color_light():
	assert_eq(_tokens.get_border_color(false), _tokens.COLOR_BORDER_LIGHT)

func test_get_text_primary_color_dark():
	assert_eq(_tokens.get_text_primary_color(true), _tokens.COLOR_TEXT_PRIMARY_DARK)

func test_get_text_primary_color_light():
	assert_eq(_tokens.get_text_primary_color(false), _tokens.COLOR_TEXT_PRIMARY_LIGHT)

func test_get_text_secondary_color_dark():
	assert_eq(_tokens.get_text_secondary_color(true), _tokens.COLOR_TEXT_SECONDARY_DARK)

func test_get_text_secondary_color_light():
	assert_eq(_tokens.get_text_secondary_color(false), _tokens.COLOR_TEXT_SECONDARY_LIGHT)

func test_get_text_disabled_color_dark():
	assert_eq(_tokens.get_text_disabled_color(true), _tokens.COLOR_TEXT_DISABLED_DARK)

func test_get_text_disabled_color_light():
	assert_eq(_tokens.get_text_disabled_color(false), _tokens.COLOR_TEXT_DISABLED_LIGHT)

func test_get_scaled_font_size_default():
	var size = _tokens.get_scaled_font_size(16)
	assert_eq(size, 16)

func test_get_scaled_font_size_min():
	var size = _tokens.get_scaled_font_size(16, 0.5)
	assert_eq(size, int(16 * 0.8))

func test_get_scaled_font_size_max():
	var size = _tiles.get_scaled_font_size(16, 2.0)
	assert_eq(size, int(16 * 1.5))

func test_get_health_color_full():
	var color = _tokens.get_health_color(1.0)
	assert_eq(color, _tokens.COLOR_HEALTH)

func test_get_health_color_medium():
	var color = _tokens.get_health_color(0.5)
	assert_eq(color, _tokens.COLOR_HEALTH_MEDIUM)

func test_get_health_color_low():
	var color = _tokens.get_health_color(0.1)
	assert_eq(color, _tokens.COLOR_HEALTH_LOW)

func test_get_rarity_color_common():
	assert_eq(_tokens.get_rarity_color("common"), _tokens.COLOR_RARITY_COMMON)

func test_get_rarity_color_rare():
	assert_eq(_tokens.get_rarity_color("rare"), _tokens.COLOR_RARITY_RARE)

func test_get_rarity_color_epic():
	assert_eq(_tokens.get_rarity_color("epic"), _tokens.COLOR_RARITY_EPIC)

func test_get_rarity_color_legendary():
	assert_eq(_tokens.get_rarity_color("legendary"), _tokens.COLOR_RARITY_LEGENDARY)

func test_get_rarity_color_unknown():
	assert_eq(_tokens.get_rarity_color("unknown"), _tokens.COLOR_RARITY_COMMON)