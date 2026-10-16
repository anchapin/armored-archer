extends GutTest

## Theme Consistency Validation Tests
##
## Tests verify that theme switching doesn't break layouts, colors meet WCAG AA
## accessibility standards, and design tokens are properly used throughout the UI.

var _theme_manager: Node
var _ThemeManagerClass: GDScript
const ArcherDesignTokens = preload("res://autoloads/ArcherDesignTokens.gd")


func before_all():
	# Initialize theme manager via load (no class_name defined in headless mode)
	_ThemeManagerClass = load("res://autoloads/ThemeManager.gd")
	_theme_manager = _ThemeManagerClass.new()


func after_all():
	if _theme_manager:
		_theme_manager.queue_free()


## Capture screenshot of current viewport
func capture_screenshot(component_name: String, theme: String, viewport_size: Vector2i) -> Image:
	# Set viewport size
	get_viewport().size = viewport_size
	await get_tree().process_frame
	await get_tree().process_frame

	# Capture screenshot
	var viewport: Viewport = get_viewport()
	var image: Image = viewport.get_texture().get_data()
	image.flip_y()  # Godot textures are flipped
	return image


## Compare layout structure between two images (ignoring colors)
func _compare_layout_structure(img1: Image, img2: Image) -> float:
	if img1.get_size() != img2.get_size():
		return 1.0  # 100% different if sizes don't match

	# Convert to grayscale for layout comparison
	var gray1 := _to_grayscale(img1)
	var gray2 := _to_grayscale(img2)

	var diff_pixels := 0
	var total_pixels := img1.get_width() * img1.get_height()

	# Compare with higher tolerance for layout-only comparison
	for x in range(img1.get_width()):
		for y in range(img1.get_height()):
			var v1 := gray1.get_pixel(x, y).r
			var v2 := gray2.get_pixel(x, y).r
			if absf(v1 - v2) > 0.1:  # 10% tolerance for layout comparison
				diff_pixels += 1

	return float(diff_pixels) / float(total_pixels)


## Convert image to grayscale
func _to_grayscale(img: Image) -> Image:
	var gray := Image.new()
	gray.copy_from(img)

	for x in range(gray.get_width()):
		for y in range(gray.get_height()):
			var color := gray.get_pixel(x, y)
			var luminance := 0.299 * color.r + 0.587 * color.g + 0.114 * color.b
			gray.set_pixel(x, y, Color(luminance, luminance, luminance, color.a))

	return gray


## Calculate WCAG contrast ratio between two colors
func _calculate_contrast_ratio(fg: Color, bg: Color) -> float:
	var fg_luminance := _calculate_luminance(fg)
	var bg_luminance := _calculate_luminance(bg)

	var lighter := maxf(fg_luminance, bg_luminance)
	var darker := minf(fg_luminance, bg_luminance)

	return (lighter + 0.05) / (darker + 0.05)


## Calculate relative luminance (WCAG definition)
func _calculate_luminance(color: Color) -> float:
	var r := _to_linear_colorspace(color.r)
	var g := _to_linear_colorspace(color.g)
	var b := _to_linear_colorspace(color.b)
	return 0.2126 * r + 0.7152 * g + 0.0722 * b


## Convert sRGB to linear color space
func _to_linear_colorspace(c: float) -> float:
	if c <= 0.03928:
		return c / 12.92
	else:
		return pow((c + 0.055) / 1.055, 2.4)


# ============================================================================
# Layout Invariance Tests
# ============================================================================

func test_theme_switching_layout_invariance():
	var main_menu_path := "res://scenes/ui/main_menu.tscn"

	if not ResourceLoader.exists(main_menu_path):
		pending("Main menu scene not found")
		return

	var scene: Node = load(main_menu_path).instantiate()
	add_child(scene)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().process_frame

	# Prefer the real autoload so the scene actually restyles; fall back to a
	# local instance when autoloads are unavailable.
	var manager: Node = get_node_or_null("/root/ThemeManager")
	if manager == null:
		manager = _theme_manager
		add_child(manager)

	# Capture light theme layout (node rects, not pixels - headless has no
	# GPU readback, so screenshot comparison cannot work here).
	manager.set_theme_mode(_ThemeManagerClass.ThemeMode.LIGHT)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().process_frame
	var light_layout := _capture_layout(scene)

	# Capture dark theme layout
	manager.set_theme_mode(_ThemeManagerClass.ThemeMode.DARK)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().process_frame
	var dark_layout := _capture_layout(scene)

	# Verify layout positions are same (only colors changed)
	var layout_diffs := []
	for key in light_layout:
		if not dark_layout.has(key):
			layout_diffs.append("missing in dark: " + key)
		elif str(light_layout[key]) != str(dark_layout[key]):
			layout_diffs.append("%s: %s -> %s" % [key, light_layout[key], dark_layout[key]])
	for key in dark_layout:
		if not light_layout.has(key):
			layout_diffs.append("missing in light: " + key)
	assert_eq(
		layout_diffs.size(),
		0,
		"Theme switch should not change any Control position or size: " + "; ".join(layout_diffs.slice(0, 5))
	)

	manager.set_theme_mode(_ThemeManagerClass.ThemeMode.LIGHT)
	if manager == _theme_manager:
		manager.queue_free()
	scene.queue_free()


## Walk the scene tree and record every Control's path, position and size.
## Theme switching must never alter layout - only colors.
func _capture_layout(root: Node) -> Dictionary:
	var layout := {}
	_collect_layout(root, layout)
	return layout


func _collect_layout(node: Node, layout: Dictionary) -> void:
	if node is Control:
		# Round to whole pixels: sub-pixel offsets from idle animations (e.g. the
		# character preview bob) are time-based, not theme-caused.
		layout[str(node.get_path())] = [node.position.round(), node.size.round()]
	for child in node.get_children():
		_collect_layout(child, layout)


# ============================================================================
# Color Contrast Accessibility Tests
# ============================================================================

func test_color_contrast_accessibility():
	# Test dark theme
	var text_color_dark: Color = ArcherDesignTokens.get_text_primary_color(true)
	var bg_color_dark: Color = ArcherDesignTokens.get_background_color(true)
	var contrast_dark := _calculate_contrast_ratio(text_color_dark, bg_color_dark)
	assert_gte(
		contrast_dark,
		4.5,
		"Dark theme text must meet WCAG AA contrast ratio (4.5:1), got %.2f:1" % contrast_dark
	)

	# Test light theme
	var text_color_light: Color = ArcherDesignTokens.get_text_primary_color(false)
	var bg_color_light: Color = ArcherDesignTokens.get_background_color(false)
	var contrast_light := _calculate_contrast_ratio(text_color_light, bg_color_light)
	assert_gte(
		contrast_light,
		4.5,
		"Light theme text must meet WCAG AA contrast ratio (4.5:1), got %.2f:1" % contrast_light
	)

	# Test secondary text (lower contrast allowed for WCAG AA large text)
	var text_color_secondary: Color = ArcherDesignTokens.get_text_secondary_color(true)
	var contrast_secondary := _calculate_contrast_ratio(text_color_secondary, bg_color_dark)
	assert_gte(
		contrast_secondary,
		3.0,  # WCAG AA for large text is 3:1
		"Secondary text must meet WCAG AA contrast ratio for large text (3:1), got %.2f:1" % contrast_secondary
	)


func test_button_contrast_accessibility():
	# Primary button dark theme
	var primary_bg: Color = ArcherDesignTokens.COLOR_PRIMARY
	var primary_text := Color(1.0, 1.0, 1.0)  # White text on primary button
	var primary_contrast := _calculate_contrast_ratio(primary_text, primary_bg)
	assert_gte(
		primary_contrast,
		4.5,
		"Primary button must meet WCAG AA contrast ratio (4.5:1), got %.2f:1" % primary_contrast
	)

	# Primary button light theme
	var primary_bg_light: Color = ArcherDesignTokens.COLOR_PRIMARY
	var primary_contrast_light := _calculate_contrast_ratio(primary_text, primary_bg_light)
	assert_gte(
		primary_contrast_light,
		4.5,
		"Primary button (light) must meet WCAG AA contrast ratio (4.5:1), got %.2f:1" % primary_contrast_light
	)


# ============================================================================
# Design Token Usage Tests
# ============================================================================

func test_design_token_usage():
	# Verify color tokens exist
	assert_not_null(ArcherDesignTokens.COLOR_PRIMARY, "Primary color token defined")
	assert_not_null(ArcherDesignTokens.COLOR_SECONDARY, "Secondary color token defined")
	assert_not_null(ArcherDesignTokens.COLOR_SUCCESS, "Success color token defined")
	assert_not_null(ArcherDesignTokens.COLOR_WARNING, "Warning color token defined")
	assert_not_null(ArcherDesignTokens.COLOR_ERROR, "Error color token defined")

	# Verify spacing tokens exist
	assert_eq(ArcherDesignTokens.SPACING_XS, 4, "XS spacing token defined")
	assert_eq(ArcherDesignTokens.SPACING_SM, 8, "SM spacing token defined")
	assert_eq(ArcherDesignTokens.SPACING_MD, 12, "MD spacing token defined")
	assert_eq(ArcherDesignTokens.SPACING_LG, 16, "LG spacing token defined")
	assert_eq(ArcherDesignTokens.SPACING_XL, 24, "XL spacing token defined")

	# Verify typography tokens exist
	assert_gt(ArcherDesignTokens.FONT_SIZE_BASE, 0, "Font size token defined")
	assert_gt(ArcherDesignTokens.FONT_SIZE_H1, 0, "H1 font size token defined")
	assert_gt(ArcherDesignTokens.FONT_SIZE_H2, 0, "H2 font size token defined")
	assert_gt(ArcherDesignTokens.FONT_SIZE_H3, 0, "H3 font size token defined")


func test_design_token_theme_switching():
	# Test background color changes between themes
	var bg_dark: Color = ArcherDesignTokens.get_background_color(true)
	var bg_light: Color = ArcherDesignTokens.get_background_color(false)

	# Dark theme should have darker background
	assert_lt(
		bg_dark.v,
		bg_light.v,
		"Dark theme background should be darker than light theme background"
	)

	# Test text color changes between themes
	var text_dark: Color = ArcherDesignTokens.get_text_primary_color(true)
	var text_light: Color = ArcherDesignTokens.get_text_primary_color(false)

	# Dark theme should have lighter text
	assert_gt(
		text_dark.v,
		text_light.v,
		"Dark theme text should be lighter than light theme text"
	)


func test_design_token_consistency():
	# Spacing should follow 4px grid system
	var spacing_values := [
		ArcherDesignTokens.SPACING_XS,
		ArcherDesignTokens.SPACING_SM,
		ArcherDesignTokens.SPACING_MD,
		ArcherDesignTokens.SPACING_LG,
		ArcherDesignTokens.SPACING_XL
	]

	for spacing in spacing_values:
		assert_eq(
			spacing % 4,
			0,
			"Spacing value %d should follow 4px grid system" % spacing
		)

	# Font sizes should increase hierarchically
	assert_lt(
		ArcherDesignTokens.FONT_SIZE_BASE,
		ArcherDesignTokens.FONT_SIZE_H3,
		"Base font size should be smaller than H3"
	)
	assert_lt(
		ArcherDesignTokens.FONT_SIZE_H3,
		ArcherDesignTokens.FONT_SIZE_H2,
		"H3 font size should be smaller than H2"
	)
	assert_lt(
		ArcherDesignTokens.FONT_SIZE_H2,
		ArcherDesignTokens.FONT_SIZE_H1,
		"H2 font size should be smaller than H1"
	)
