extends GutTest

var _tokens = null

func before_each():
	var ArcherDesignTokens = preload("res://autoloads/ArcherDesignTokens.gd")
	# Use an instance: get_surface_tier_color / get_ambient_shadow_blur /
	# get_gradient_colors are instance methods, and static members resolve
	# fine on an instance too. See issue #964.
	_tokens = ArcherDesignTokens.new()
	add_child_autofree(_tokens)

# =============================================================================
# TACTILE HEROISM COLOR PALETTE TESTS
# =============================================================================

func test_primary_colors_exist():
	assert_eq(_tokens.COLOR_PRIMARY, Color("#0060ce"))
	assert_eq(_tokens.COLOR_PRIMARY_CONTAINER, Color("#6e9fff"))
	assert_eq(_tokens.COLOR_PRIMARY_DIM, Color("#0054b7"))
	assert_eq(_tokens.COLOR_PRIMARY_FIXED, Color("#6e9fff"))
	assert_eq(_tokens.COLOR_ON_PRIMARY, Color("#ffffff"))

func test_secondary_colors_exist():
	assert_eq(_tokens.COLOR_SECONDARY, Color("#8d5900"))
	assert_eq(_tokens.COLOR_SECONDARY_CONTAINER, Color("#ffc885"))
	assert_eq(_tokens.COLOR_SECONDARY_DIM, Color("#7d4e00"))
	assert_eq(_tokens.COLOR_SECONDARY_FIXED, Color("#ffc885"))
	assert_eq(_tokens.COLOR_ON_SECONDARY, Color("#ffffff"))

func test_tertiary_colors_exist():
	assert_eq(_tokens.COLOR_TERTIARY, Color("#00734e"))
	assert_eq(_tokens.COLOR_TERTIARY_CONTAINER, Color("#69f6b8"))
	assert_eq(_tokens.COLOR_TERTIARY_DIM, Color("#006544"))
	assert_eq(_tokens.COLOR_TERTIARY_FIXED, Color("#69f6b8"))
	assert_eq(_tokens.COLOR_ON_TERTIARY, Color("#ffffff"))

func test_surface_colors():
	assert_eq(_tokens.COLOR_SURFACE, Color("#fdffda"))
	assert_eq(_tokens.COLOR_SURFACE_CONTAINER, Color("#f6f3eb"))
	assert_eq(_tokens.COLOR_SURFACE_CONTAINER_LOW, Color("#fcf9f1"))
	assert_eq(_tokens.COLOR_SURFACE_CONTAINER_LOWEST, Color("#ffffff"))
	assert_eq(_tokens.COLOR_SURFACE_CONTAINER_HIGH, Color("#f0eee5"))
	assert_eq(_tokens.COLOR_SURFACE_CONTAINER_HIGHEST, Color("#ebe8df"))
	assert_eq(_tokens.COLOR_SURFACE_VARIANT, Color("#ebe8df"))
	assert_eq(_tokens.COLOR_SURFACE_BRIGHT, Color("#fdffda"))
	assert_eq(_tokens.COLOR_SURFACE_DIM, Color("#e5e2d9"))

func test_content_colors():
	assert_eq(_tokens.COLOR_ON_SURFACE, Color("#383833"))
	assert_eq(_tokens.COLOR_OUTLINE_VARIANT, Color("#bbb9b3"))

func test_ambient_glass_effects():
	assert_eq(_tokens.COLOR_AMBIENT_SHADOW, Color(0.22, 0.22, 0.2, 0.06))
	assert_eq(_tokens.COLOR_GHOST_BORDER, Color(0.733, 0.725, 0.702, 0.15))
	assert_eq(_tokens.COLOR_GLASS_OVERLAY, Color(1, 1, 1, 0.8))

func test_gradient_colors():
	assert_eq(_tokens.COLOR_GRADIENT_PRIMARY_START, Color("#0060ce"))
	assert_eq(_tokens.COLOR_GRADIENT_PRIMARY_END, Color("#6e9fff"))

func test_additional_surface_colors():
	assert_eq(_tokens.COLOR_SURFACE_TINT, Color("#0060ce"))
	assert_eq(_tokens.COLOR_INVERSE_SURFACE, Color("#0e0e0b"))
	assert_eq(_tokens.COLOR_INVERSE_ON_SURFACE, Color("#9f9d97"))

# =============================================================================
# RELIC ARCHIVE COLOR PALETTE TESTS
# =============================================================================

func test_ra_surface_colors():
	assert_eq(_tokens.RA_SURFACE, Color("#0e0e0e"))
	assert_eq(_tokens.RA_SURFACE_CONTAINER, Color("#191a1a"))
	assert_eq(_tokens.RA_SURFACE_CONTAINER_HIGH, Color("#1f2020"))
	assert_eq(_tokens.RA_SURFACE_CONTAINER_HIGHEST, Color("#262626"))
	assert_eq(_tokens.RA_SURFACE_CONTAINER_LOW, Color("#131313"))
	assert_eq(_tokens.RA_SURFACE_CONTAINER_LOWEST, Color("#000000"))

func test_ra_content_colors():
	assert_eq(_tokens.RA_ON_SURFACE, Color("#ffffff"))
	assert_eq(_tokens.RA_ON_SURFACE_VARIANT, Color("#adaaaa"))

func test_ra_primary_colors():
	assert_eq(_tokens.RA_PRIMARY, Color("#ffac54"))
	assert_eq(_tokens.RA_PRIMARY_DIM, Color("#ec8c00"))
	assert_eq(_tokens.RA_PRIMARY_FIXED, Color("#ff9800"))
	assert_eq(_tokens.RA_ON_PRIMARY, Color("#583100"))
	assert_eq(_tokens.RA_PRIMARY_CONTAINER, Color("#ff9800"))

func test_ra_secondary_colors():
	assert_eq(_tokens.RA_SECONDARY, Color("#4f453a"))
	assert_eq(_tokens.RA_SECONDARY_DIM, Color("#e1d2c3"))
	assert_eq(_tokens.RA_SECONDARY_FIXED, Color("#efe0d1"))
	assert_eq(_tokens.RA_SECONDARY_CONTAINER, Color("#efe0d1"))

func test_ra_accent_colors():
	assert_eq(_tokens.RA_TERTIARY, Color("#7ef839"))
	assert_eq(_tokens.RA_TERTIARY_DIM, Color("#62db13"))
	assert_eq(_tokens.RA_ERROR, Color("#ff7351"))
	assert_eq(_tokens.RA_ERROR_DIM, Color("#d53d18"))
	assert_eq(_tokens.RA_OUTLINE_VARIANT, Color("#484848"))

func test_ra_ambient_effects():
	assert_eq(_tokens.RA_AMBIENT_SHADOW_COLOR, Color(0.49, 0.97, 0.22, 0.12))
	assert_eq(_tokens.RA_AMBIENT_SHADOW_BLUR, 24)
	assert_eq(_tokens.RA_GHOST_BORDER_COLOR, Color(0.28, 0.28, 0.28, 0.15))

# =============================================================================
# GAME-SPECIFIC COLORS TESTS
# =============================================================================

func test_rarity_colors():
	# Using get_rarity_color helper
	assert_eq(_tokens.get_rarity_color("common"), Color(0.61, 0.61, 0.61, 1))
	assert_eq(_tokens.get_rarity_color("rare"), _tokens.COLOR_PRIMARY)
	assert_eq(_tokens.get_rarity_color("epic"), _tokens.COLOR_SECONDARY)
	assert_eq(_tokens.get_rarity_color("legendary"), Color(1, 0.77, 0.22, 1))
	assert_eq(_tokens.get_rarity_color("unknown"), Color(0.61, 0.61, 0.61, 1))

func test_health_colors():
	# Using get_health_color helper
	assert_eq(_tokens.get_health_color(1.0), _tokens.COLOR_TERTIARY)  # Healthy
	assert_eq(_tokens.get_health_color(0.5), Color(0.96, 0.71, 0.35, 1))  # Medium/low
	assert_eq(_tokens.get_health_color(0.1), Color(0.94, 0.27, 0.31, 1))  # Critical

func test_ra_rarity_colors():
	assert_eq(_tokens.get_ra_rarity_color("common"), Color(0.61, 0.61, 0.61, 1))
	assert_eq(_tokens.get_ra_rarity_color("rare"), _tokens.RA_PRIMARY)
	assert_eq(_tokens.get_ra_rarity_color("epic"), _tokens.RA_ERROR)
	assert_eq(_tokens.get_ra_rarity_color("legendary"), Color(1, 0.22, 0.77, 1))

func test_ra_health_colors():
	# Using get_ra_health_color helper
	assert_eq(_tokens.get_ra_health_color(1.0), _tokens.RA_TERTIARY)  # Healthy
	assert_eq(_tokens.get_ra_health_color(0.5), Color(0.96, 0.71, 0.35, 1))  # Medium/low
	assert_eq(_tokens.get_ra_health_color(0.1), _tokens.RA_ERROR)  # Critical

# =============================================================================
# TYPOGRAPHY TESTS
# =============================================================================

func test_font_paths():
	assert_eq(_tokens.FONT_PLUS_JAKARTA_SANS_PATH, "res://fonts/Plus_Jakarta_Sans.ttf")
	assert_eq(_tokens.FONT_BE_VIETNAM_PRO_PATH, "res://fonts/Be_Vietnam_Pro.ttf")
	assert_eq(_tokens.FONT_INTER_PATH, "res://fonts/Inter.ttf")
	assert_eq(_tokens.FONT_EPILOGUE_PATH, "res://fonts/Epilogue-Regular.ttf")
	assert_eq(_tokens.FONT_EPILOGUE_BOLD_PATH, "res://fonts/Epilogue-Bold.ttf")
	assert_eq(_tokens.FONT_SPACE_GROTESK_PATH, "res://fonts/SpaceGrotesk-Regular.ttf")
	assert_eq(_tokens.FONT_SPACE_GROTESK_BOLD_PATH, "res://fonts/SpaceGrotesk-Bold.ttf")
	assert_eq(_tokens.FONT_LEXEND_PATH, "res://fonts/Lexend-Regular.ttf")

# =============================================================================
# SPACING TESTS
# =============================================================================

func test_spacing_constants():
	assert_eq(_tokens.SPACING_XXS, 2)
	assert_eq(_tokens.SPACING_XS, 4)
	assert_eq(_tokens.SPACING_SM, 8)
	assert_eq(_tokens.SPACING_MD, 12)
	assert_eq(_tokens.SPACING_LG, 16)
	assert_eq(_tokens.SPACING_XL, 24)
	assert_eq(_tokens.SPACING_2XL, 32)
	assert_eq(_tokens.SPACING_3XL, 48)
	assert_eq(_tokens.SPACING_20, 80)
	assert_eq(_tokens.SPACING_24, 96)

# =============================================================================
# CORNER RADIUS TESTS
# =============================================================================

func test_corner_radius():
	assert_eq(_tokens.RADIUS_NONE, 0)
	assert_eq(_tokens.RADIUS_SM, 4)
	assert_eq(_tokens.RADIUS_MD, 8)
	assert_eq(_tokens.RADIUS_LG, 12)
	assert_eq(_tokens.RADIUS_XL, 16)
	assert_eq(_tokens.RADIUS_FULL, 9999)
	assert_eq(_tokens.RADIUS_XL_MODAL, 48)

func test_ra_roundness():
	assert_eq(_tokens.RA_ROUNDNESS_FOUR, 4)
	assert_eq(_tokens.RA_ROUNDNESS_EIGHT, 8)
	assert_eq(_tokens.RA_ROUNDNESS_TWELVE, 12)
	assert_eq(_tokens.RA_ROUNDNESS_FULL, 9999)

# =============================================================================
# SHADOW TESTS
# =============================================================================

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

func test_ambient_shadow_settings():
	assert_eq(_tokens.AMBIENT_SHADOW_BLUR_MIN, 20)
	assert_eq(_tokens.AMBIENT_SHADOW_BLUR_MAX, 40)
	assert_eq(_tokens.AMBIENT_SHADOW_OFFSET, Vector2(0, 0))

# =============================================================================
# ANIMATION TESTS
# =============================================================================

func test_animation_durations():
	assert_eq(_tokens.ANIM_DURATION_INSTANT, 0.0)
	assert_eq(_tokens.ANIM_DURATION_FAST, 0.1)
	assert_eq(_tokens.ANIM_DURATION_NORMAL, 0.2)
	assert_eq(_tokens.ANIM_DURATION_SLOW, 0.3)
	assert_eq(_tokens.ANIM_DURATION_SLOWER, 0.5)

func test_animation_easing():
	assert_eq(_tokens.ANIM_EASE_OUT, 0.25)
	assert_eq(_tokens.ANIM_EASE_IN_OUT, 0.42)

# =============================================================================
# BORDER TESTS
# =============================================================================

func test_border_widths():
	assert_eq(_tokens.BORDER_WIDTH_NONE, 0)
	assert_eq(_tokens.BORDER_WIDTH_SM, 1)
	assert_eq(_tokens.BORDER_WIDTH_MD, 2)
	assert_eq(_tokens.BORDER_WIDTH_LG, 3)

# =============================================================================
# OPACITY TESTS
# =============================================================================

func test_opacity_constants():
	assert_eq(_tokens.OPACITY_DISABLED, 0.4)
	assert_eq(_tokens.OPACITY_HIDDEN, 0.0)
	assert_eq(_tokens.OPACITY_TRANSPARENT, 0.5)
	assert_eq(_tokens.OPACITY_FULL, 1.0)

# =============================================================================
# Z-INDEX TESTS
# =============================================================================

func test_z_index_layers():
	assert_eq(_tokens.Z_BASE, 0)
	assert_eq(_tokens.Z_BELOW, -10)
	assert_eq(_tokens.Z_OVERLAY, 100)
	assert_eq(_tokens.Z_POPUP, 200)
	assert_eq(_tokens.Z_MODAL, 300)
	assert_eq(_tokens.Z_TOAST, 400)

# =============================================================================
# BUTTON STYLES TESTS
# =============================================================================

func test_button_inset_shadow():
	assert_eq(_tokens.BUTTON_INSET_SHADOW_COLOR, Color(0, 0, 0, 0.2))
	assert_eq(_tokens.BUTTON_INSET_SHADOW_OFFSET, Vector2(0, 4))
	assert_eq(_tokens.BUTTON_INSET_SHADOW_BLUR, 4)

func test_button_radius():
	assert_eq(_tokens.BUTTON_RADIUS_MD, 24)
	assert_eq(_tokens.BUTTON_RADIUS_LG, 32)
	assert_eq(_tokens.BUTTON_RADIUS_XL, 48)

# =============================================================================
# FONT SCALE TESTS
# =============================================================================

func test_font_scale_constants():
	assert_eq(_tokens.FONT_SCALE_MIN, 0.8)
	assert_eq(_tokens.FONT_SCALE_DEFAULT, 1.0)
	assert_eq(_tokens.FONT_SCALE_MAX, 1.5)

# =============================================================================
# HELPER FUNCTION TESTS
# =============================================================================

func test_get_primary_color_default():
	var color = _tokens.get_primary_color()
	assert_eq(color, _tokens.COLOR_PRIMARY)

func test_get_primary_color_hover():
	var color = _tokens.get_primary_color("hover")
	assert_eq(color, _tokens.COLOR_PRIMARY_FIXED)

func test_get_primary_color_pressed():
	var color = _tokens.get_primary_color("pressed")
	assert_eq(color, _tokens.COLOR_PRIMARY_DIM)

func test_get_primary_color_disabled():
	var color = _tokens.get_primary_color("disabled")
	assert_eq(color, Color(1, 1, 1, 0.4))

func test_get_secondary_color_default():
	var color = _tokens.get_secondary_color()
	assert_eq(color, _tokens.COLOR_SECONDARY)

func test_get_secondary_color_hover():
	var color = _tokens.get_secondary_color("hover")
	assert_eq(color, _tokens.COLOR_SECONDARY_FIXED)

func test_get_secondary_color_pressed():
	var color = _tokens.get_secondary_color("pressed")
	assert_eq(color, _tokens.COLOR_SECONDARY_DIM)

func test_get_surface_tier_color():
	assert_eq(_tokens.get_surface_tier_color("base"), _tokens.COLOR_SURFACE)
	assert_eq(_tokens.get_surface_tier_color("container"), _tokens.COLOR_SURFACE_CONTAINER)
	assert_eq(_tokens.get_surface_tier_color("low"), _tokens.COLOR_SURFACE_CONTAINER_LOW)
	assert_eq(_tokens.get_surface_tier_color("highest"), _tokens.COLOR_SURFACE_CONTAINER_HIGHEST)
	assert_eq(_tokens.get_surface_tier_color("unknown"), _tokens.COLOR_SURFACE)

func test_get_ambient_shadow_color():
	assert_eq(_tokens.get_ambient_shadow_color(), _tokens.COLOR_AMBIENT_SHADOW)

func test_get_ambient_shadow_blur():
	assert_eq(_tokens.get_ambient_shadow_blur(false), _tokens.AMBIENT_SHADOW_BLUR_MIN)
	assert_eq(_tokens.get_ambient_shadow_blur(true), _tokens.AMBIENT_SHADOW_BLUR_MAX)

func test_get_ghost_border_color():
	assert_eq(_tokens.get_ghost_border_color(), _tokens.COLOR_GHOST_BORDER)

func test_get_button_depth_settings():
	var settings = _tokens.get_button_depth_settings()
	assert_eq(settings.color, _tokens.BUTTON_INSET_SHADOW_COLOR)
	assert_eq(settings.offset, _tokens.BUTTON_INSET_SHADOW_OFFSET)
	assert_eq(settings.blur, _tokens.BUTTON_INSET_SHADOW_BLUR)

func test_get_button_radius():
	assert_eq(_tokens.get_button_radius("xl"), _tokens.BUTTON_RADIUS_XL)
	assert_eq(_tokens.get_button_radius("md"), _tokens.BUTTON_RADIUS_MD)
	assert_eq(_tokens.get_button_radius("lg"), _tokens.BUTTON_RADIUS_MD)  # Default

func test_get_modal_radius():
	assert_eq(_tokens.get_modal_radius(), _tokens.RADIUS_XL_MODAL)

func test_is_color_light():
	assert_true(_tokens.is_color_light(Color("#ffffff")))
	assert_false(_tokens.is_color_light(Color("#000000")))

func test_get_text_color_for_background():
	var light_bg = Color("#ffffff")
	var dark_bg = Color("#000000")
	assert_eq(_tokens.get_text_color_for_background(light_bg), _tokens.COLOR_ON_SURFACE)
	assert_eq(_tokens.get_text_color_for_background(dark_bg), Color.WHITE)

func test_get_gradient_colors():
	var primary_grad = _tokens.get_gradient_colors("primary")
	assert_eq(primary_grad[0], _tokens.COLOR_GRADIENT_PRIMARY_START)
	assert_eq(primary_grad[1], _tokens.COLOR_GRADIENT_PRIMARY_END)

func test_get_scaled_font_size():
	assert_eq(_tokens.get_scaled_font_size(16), 16)
	assert_eq(_tokens.get_scaled_font_size(16, 0.5), int(16 * 0.8))
	assert_eq(_tokens.get_scaled_font_size(16, 2.0), int(16 * 1.5))

# =============================================================================
# RELIC ARCHIVE HELPER FUNCTION TESTS
# =============================================================================

func test_get_ra_surface_tier_color():
	assert_eq(_tokens.get_ra_surface_tier_color("base"), _tokens.RA_SURFACE)
	assert_eq(_tokens.get_ra_surface_tier_color("background"), _tokens.RA_SURFACE)
	assert_eq(_tokens.get_ra_surface_tier_color("container"), _tokens.RA_SURFACE_CONTAINER)
	assert_eq(_tokens.get_ra_surface_tier_color("highest"), _tokens.RA_SURFACE_CONTAINER_HIGHEST)

func test_get_ra_primary_color():
	assert_eq(_tokens.get_ra_primary_color(), _tokens.RA_PRIMARY)
	assert_eq(_tokens.get_ra_primary_color("hover"), _tokens.RA_PRIMARY_FIXED)
	assert_eq(_tokens.get_ra_primary_color("pressed"), _tokens.RA_PRIMARY_DIM)
	assert_eq(_tokens.get_ra_primary_color("disabled"), Color(1, 1, 1, 0.4))

func test_get_ra_ambient_shadow_color():
	assert_eq(_tokens.get_ra_ambient_shadow_color(), _tokens.RA_AMBIENT_SHADOW_COLOR)

func test_get_ra_ambient_shadow_blur():
	assert_eq(_tokens.get_ra_ambient_shadow_blur(), _tokens.RA_AMBIENT_SHADOW_BLUR)

func test_get_ra_ghost_border_color():
	assert_eq(_tokens.get_ra_ghost_border_color(), _tokens.RA_GHOST_BORDER_COLOR)

func test_get_ra_gradient_colors():
	var ra_grad = _tokens.get_ra_gradient_colors("primary")
	assert_eq(ra_grad[0], _tokens.RA_GRADIENT_PRIMARY_START)
	assert_eq(ra_grad[1], _tokens.RA_GRADIENT_PRIMARY_END)

func test_get_ra_button_radius():
	assert_eq(_tokens.get_ra_button_radius(), _tokens.RA_ROUNDNESS_FOUR)
