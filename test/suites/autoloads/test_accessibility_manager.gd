extends GutTest

var AccessibilityManagerClass = load("res://autoloads/AccessibilityManager.gd")
var test_manager
var mock_config: ConfigFile

func before_each():
	# Create fresh mock ConfigFile for each test
	mock_config = ConfigFile.new()
	# Inject mock to avoid file I/O
	test_manager = AccessibilityManagerClass.new(mock_config)
	add_child_autofree(test_manager)

func after_each():
	# Clean up instance
	test_manager = null

# Test fresh instance isolation (ISO-04)
func test_fresh_instance_per_test():
	# This test verifies state doesn't leak from previous tests
	assert_eq(test_manager.get_font_scale(), 1.0, "Should start with default")

func test_multiple_instances_have_independent_state():
	var manager1 = AccessibilityManagerClass.new(ConfigFile.new())
	var manager2 = AccessibilityManagerClass.new(ConfigFile.new())

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

# Test ConfigFile injection prevents file I/O (MOCK-03)
func test_config_file_injection():
	test_manager.set_font_scale(1.3)
	# Verify ConfigFile was used (no actual file written)
	assert_eq(mock_config.get_value("accessibility", "font_scale", 1.0), 1.3)

# Test clamping behavior
func test_set_font_scale_clamps_to_max():
	test_manager.set_font_scale(5.0)  # Exceeds FONT_SCALE_MAX (1.5)
	assert_eq(test_manager.get_font_scale(), 1.5, "Should clamp to maximum")

func test_set_font_scale_clamps_to_min():
	test_manager.set_font_scale(0.5)  # Below FONT_SCALE_MIN (0.8)
	assert_eq(test_manager.get_font_scale(), 0.8, "Should clamp to minimum")
