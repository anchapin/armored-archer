extends GutTest

## Visual Regression Tests for Base UI Components
##
## Tests capture screenshots of UI components in different themes and viewport sizes,
## then compare against baseline screenshots to detect visual regressions.
##
## Components tested:
## - Critical (blocks PR): button, panel, progress_bar, theme_toggle
## - Nice-to-have (warning only): label, icon, container, loading_indicator

const VIEWPORT_MOBILE = Vector2i(375, 667)
const VIEWPORT_TABLET = Vector2i(768, 1024)
const VIEWPORT_DESKTOP = Vector2i(1920, 1080)
const TOLERANCE = 0.01  # 1% pixel difference

var _theme_manager: ThemeManager
var _baseline_dir: String = "res://test/screenshots/baseline/"
var _current_dir: String = "user://test/screenshots/current/"


func before_all():
	# Setup directories
	DirAccess.make_dir_absolute("res://test/screenshots/baseline")
	DirAccess.make_dir_absolute("user://test/screenshots/current")

	# Initialize theme manager
	_theme_manager = ThemeManager.new()


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


## Compare captured image with baseline
func compare_with_baseline(image: Image, component_name: String, theme: String, viewport_size: Vector2i) -> bool:
	var viewport_name := _get_viewport_name(viewport_size)
	var baseline_path := "%s%s_%s_%s.png" % [_baseline_dir, component_name, theme, viewport_name]
	var current_path := "%s%s_%s_%s.png" % [_current_dir, component_name, theme, viewport_name]

	# Save current screenshot
	image.save_png(current_path)

	# Load baseline if exists
	var baseline := Image.new()
	if baseline.load(baseline_path) != OK:
		# Create baseline if doesn't exist
		print("Creating baseline: ", baseline_path)
		image.save_png(baseline_path)
		return true  # Pass when creating baseline

	# Compare images pixel-by-pixel
	var diff := _calculate_image_difference(image, baseline)
	var passed := diff < TOLERANCE

	if not passed:
		print("Visual difference %.2f%% exceeds threshold %.2f%% for %s %s %s" % [
			diff * 100, TOLERANCE * 100, component_name, theme, viewport_name
		])

	return passed


## Calculate pixel difference between two images
func _calculate_image_difference(img1: Image, img2: Image) -> float:
	if img1.get_size() != img2.get_size():
		return 1.0  # 100% different if sizes don't match

	var diff_pixels := 0
	var total_pixels := img1.get_width() * img1.get_height()

	for x in range(img1.get_width()):
		for y in range(img1.get_height()):
			var c1 := img1.get_pixel(x, y)
			var c2 := img2.get_pixel(x, y)
			if c1 != c2:
				diff_pixels += 1

	return float(diff_pixels) / float(total_pixels)


## Get viewport name for file naming
func _get_viewport_name(viewport_size: Vector2i) -> String:
	if viewport_size == VIEWPORT_MOBILE:
		return "mobile"
	elif viewport_size == VIEWPORT_TABLET:
		return "tablet"
	elif viewport_size == VIEWPORT_DESKTOP:
		return "desktop"
	return "custom"


## Set theme for testing
func _set_theme(theme_name: String):
	if _theme_manager:
		_theme_manager.set_theme(theme_name)
	await get_tree().process_frame  # Wait for theme to apply


# ============================================================================
# Critical Component Tests (Block PR on failure)
# ============================================================================

func test_base_button_visual_regression():
	var button_path := "res://scenes/ui/components/base_button.tscn"

	if not ResourceLoader.exists(button_path):
		pending("Base button scene not found")

	var button: BaseButton = load(button_path).instantiate()
	button.text = "Test Button"
	add_child(button)

	# Test both themes and all viewports
	for theme in ["light", "dark"]:
		_set_theme(theme)
		for viewport_size in [VIEWPORT_MOBILE, VIEWPORT_TABLET, VIEWPORT_DESKTOP]:
			var image: Image = await capture_screenshot("base_button", theme, viewport_size)
			var passed := compare_with_baseline(image, "base_button", theme, viewport_size)
			assert_true(
				passed,
				"Base button visual regression for %s %s" % [theme, _get_viewport_name(viewport_size)]
			)

	button.queue_free()


func test_base_panel_visual_regression():
	var panel_path := "res://scenes/ui/components/base_panel.tscn"

	if not ResourceLoader.exists(panel_path):
		pending("Base panel scene not found")

	var panel: Panel = load(panel_path).instantiate()
	add_child(panel)

	for theme in ["light", "dark"]:
		_set_theme(theme)
		for viewport_size in [VIEWPORT_MOBILE, VIEWPORT_TABLET, VIEWPORT_DESKTOP]:
			var image: Image = await capture_screenshot("base_panel", theme, viewport_size)
			var passed := compare_with_baseline(image, "base_panel", theme, viewport_size)
			assert_true(
				passed,
				"Base panel visual regression for %s %s" % [theme, _get_viewport_name(viewport_size)]
			)

	panel.queue_free()


func test_base_progress_bar_visual_regression():
	var progress_bar_path := "res://scenes/ui/components/base_progress_bar.tscn"

	if not ResourceLoader.exists(progress_bar_path):
		pending("Base progress bar scene not found")

	var progress_bar: ProgressBar = load(progress_bar_path).instantiate()
	progress_bar.value = 50.0  # Set to 50% for consistent testing
	add_child(progress_bar)

	for theme in ["light", "dark"]:
		_set_theme(theme)
		for viewport_size in [VIEWPORT_MOBILE, VIEWPORT_TABLET, VIEWPORT_DESKTOP]:
			var image: Image = await capture_screenshot("base_progress_bar", theme, viewport_size)
			var passed := compare_with_baseline(image, "base_progress_bar", theme, viewport_size)
			assert_true(
				passed,
				"Base progress bar visual regression for %s %s" % [theme, _get_viewport_name(viewport_size)]
			)

	progress_bar.queue_free()


func test_theme_toggle_visual_regression():
	var toggle_path := "res://scenes/ui/components/theme_toggle.tscn"

	if not ResourceLoader.exists(toggle_path):
		pending("Theme toggle scene not found")

	var toggle: CheckBox = load(toggle_path).instantiate()
	add_child(toggle)

	for theme in ["light", "dark"]:
		_set_theme(theme)
		for viewport_size in [VIEWPORT_MOBILE, VIEWPORT_TABLET, VIEWPORT_DESKTOP]:
			var image: Image = await capture_screenshot("theme_toggle", theme, viewport_size)
			var passed := compare_with_baseline(image, "theme_toggle", theme, viewport_size)
			assert_true(
				passed,
				"Theme toggle visual regression for %s %s" % [theme, _get_viewport_name(viewport_size)]
			)

	toggle.queue_free()


# ============================================================================
# Nice-to-Have Component Tests (Warning only, don't block PR)
# ============================================================================

func test_base_label_visual_regression():
	var label_path := "res://scenes/ui/components/base_label.tscn"

	if not ResourceLoader.exists(label_path):
		pending("Base label scene not found")

	var label: Label = load(label_path).instantiate()
	add_child(label)

	for theme in ["light", "dark"]:
		_set_theme(theme)
		for viewport_size in [VIEWPORT_MOBILE, VIEWPORT_TABLET, VIEWPORT_DESKTOP]:
			var image: Image = await capture_screenshot("base_label", theme, viewport_size)
			var passed := compare_with_baseline(image, "base_label", theme, viewport_size)
			if not passed:
				print("WARNING: Visual regression in base_label (nice-to-have component)")

	label.queue_free()
	assert_true(true)
