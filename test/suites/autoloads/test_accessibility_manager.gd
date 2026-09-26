extends GutTest

var AccessibilityManagerClass = load("res://autoloads/AccessibilityManager.gd")
var test_manager

func before_each():
	# Create fresh instance for each test
	test_manager = AccessibilityManagerClass.new()
	add_child_autofree(test_manager)

func after_each():
	# Clean up instance
	test_manager = null

# Test fresh instance isolation (ISO-04)
func test_fresh_instance_per_test():
	# This test verifies state doesn't leak from previous tests
	assert_eq(test_manager.get_font_scale(), 1.0, "Should start with default")

func test_multiple_instances_have_independent_state():
	var manager1 = AccessibilityManagerClass.new()
	var manager2 = AccessibilityManagerClass.new()

	manager1.set_font_scale(1.2)
	manager2.set_font_scale(1.4)

	assert_eq(manager1.get_font_scale(), 1.2, "Manager1 should have its own state")
	assert_eq(manager2.get_font_scale(), 1.4, "Manager2 should have its own state")

	manager1.queue_free()
	manager2.queue_free()

# Test signal emission with watch_signals (ISO-04)
func test_set_font_scale_emits_signal():
	watch_signals(test_manager)
	test_manager.set_font_scale(1.2)
	assert_signal_emitted(test_manager, "settings_changed")

# Test clamping behavior
func test_set_font_scale_clamps_to_max():
	test_manager.set_font_scale(5.0)  # Exceeds FONT_SCALE_MAX (1.5)
	assert_eq(test_manager.get_font_scale(), 1.5, "Should clamp to maximum")

func test_set_font_scale_clamps_to_min():
	test_manager.set_font_scale(0.5)  # Below FONT_SCALE_MIN (0.8)
	assert_eq(test_manager.get_font_scale(), 0.8, "Should clamp to minimum")

# Test high contrast mode
func test_high_contrast_mode_default():
	assert_false(test_manager.is_high_contrast_enabled(), "High contrast should be disabled by default")

func test_toggle_high_contrast_mode():
	test_manager.set_high_contrast(true)
	assert_true(test_manager.is_high_contrast_enabled(), "High contrast should be enabled")

func test_get_high_contrast_colors():
	# Fix for issue #1361 follow-up: production API takes `is_dark: bool`, not a string.
	test_manager.set_high_contrast(true)
	var dark_colors = test_manager.get_high_contrast_colors(true)
	assert_not_null(dark_colors, "High contrast colors should be available")
	assert_eq(dark_colors.background, Color("#000000"), "Background should be black")
	assert_eq(dark_colors.text_primary, Color("#FFFFFF"), "Text should be white")

# Test reduced motion
func test_reduced_motion_default():
	assert_false(test_manager.is_reduced_motion_enabled(), "Reduced motion should be disabled by default")

func test_toggle_reduced_motion():
	test_manager.set_reduced_motion(true)
	assert_true(test_manager.is_reduced_motion_enabled(), "Reduced motion should be enabled")

# Test screen reader mode
func test_screen_reader_default():
	assert_false(test_manager.is_screen_reader_enabled(), "Screen reader should be disabled by default")

func test_toggle_screen_reader():
	test_manager.set_screen_reader_enabled(true)
	assert_true(test_manager.is_screen_reader_enabled(), "Screen reader should be enabled")

# Test reset to defaults
func test_reset_to_defaults():
	test_manager.set_font_scale(1.3)
	test_manager.set_high_contrast(true)
	test_manager.set_reduced_motion(true)

	test_manager.reset_to_defaults()

	assert_eq(test_manager.get_font_scale(), 1.0, "Font scale should reset to default")
	assert_false(test_manager.is_high_contrast_enabled(), "High contrast should be disabled")
	assert_false(test_manager.is_reduced_motion_enabled(), "Reduced motion should be disabled")
