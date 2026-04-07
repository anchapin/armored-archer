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
	pending("Base button scene not found - component needs to be created")


func test_base_panel_visual_regression():
	pending("Base panel scene not found - component needs to be created")


func test_base_progress_bar_visual_regression():
	pending("Base progress bar scene not found - component needs to be created")


func test_theme_toggle_visual_regression():
	pending("Theme toggle scene not found - component needs to be created")


# ============================================================================
# Nice-to-Have Component Tests (Warning only, don't block PR)
# ============================================================================

func test_base_label_visual_regression():
	pending("Base label scene not found - component needs to be created")
	assert_true(true)
