extends GutTest

var test_manager: ThemeManager
var mock_config: ConfigFile

func before_each():
	mock_config = ConfigFile.new()
	test_manager = ThemeManager.new(mock_config)

func after_each():
	if test_manager:
		test_manager.queue_free()

# Test fresh instance isolation (ISO-04)
func test_fresh_instance_per_test():
	assert_eq(test_manager.get_theme_name(), "dark", "Should start with dark theme")

func test_multiple_instances_have_independent_state():
	var manager1 = ThemeManager.new(ConfigFile.new())
	var manager2 = ThemeManager.new(ConfigFile.new())

	manager1.set_theme("light")
	manager2.set_theme("dark")

	assert_eq(manager1.get_theme_name(), "light", "Manager1 should be light")
	assert_eq(manager2.get_theme_name(), "dark", "Manager2 should be dark")

	manager1.queue_free()
	manager2.queue_free()

# Test signal emission with parameters (ISO-04)
func test_set_theme_emits_signal_with_parameters():
	watch_signals(test_manager)
	test_manager.set_theme("light")
	assert_signal_emitted_with_parameters(test_manager, "theme_changed", [false])

# Test async signal with wait_for_signal (ISO-04)
func test_async_theme_change():
	test_manager.set_theme("light")
	await wait_for_signal(test_manager.theme_changed, 1.0)
	assert_signal_emitted(test_manager, "theme_changed")

# Test ConfigFile injection prevents file I/O (MOCK-03)
func test_config_file_injection():
	test_manager.set_theme("light")
	assert_eq(mock_config.get_value("settings", "theme", "dark"), "light")

# Test theme validation
func test_set_theme_with_invalid_name_defaults_to_dark():
	test_manager.set_theme("invalid_theme")
	assert_eq(test_manager.get_theme_name(), "dark", "Should default to dark")

func test_toggle_theme_switches_between_dark_and_light():
	test_manager.set_theme("dark")
	test_manager.toggle_theme()
	assert_eq(test_manager.get_theme_name(), "light", "Should toggle to light")
	test_manager.toggle_theme()
	assert_eq(test_manager.get_theme_name(), "dark", "Should toggle back to dark")
