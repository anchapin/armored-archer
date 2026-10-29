extends GutTest

# Issue #1748 (follow-up to the issue #1361 pending conversions): the seven
# tests below were rewritten against the *current* production API.
#
# Production autoloads/ThemeManager.gd exposes:
#   - enum ThemeMode { LIGHT, DARK }
#   - get_theme_mode() / is_dark_mode()
#   - set_theme_mode(mode) / toggle_theme_mode()
#   - is_theme_enabled() / set_tactile_theme(enabled) / toggle_theme()
#   - signals theme_changed(theme_mode: String) and dark_mode_changed(enabled: bool)
#   - ConfigFile persistence at user://theme.cfg (section "settings", keys
#     "theme_mode" and "theme_enabled")
#
# There is NO set_theme(String), NO get_theme_name() and NO "gilded" theme in
# production, and ThemeManager takes no constructor arguments. The
# ConfigFile-injection pattern (MOCK-03 / test_isolation_patterns.md) is
# therefore applied against the production persistence path: the injected
# ConfigFile is written to user://theme.cfg around each test and the
# developer's saved preference is backed up and restored afterwards, so the
# suite never leaves persistent state behind.

const THEME_CONFIG_PATH := "user://theme.cfg"
const THEME_MODE_KEY := "theme_mode"
const THEME_ENABLED_KEY := "theme_enabled"

var ThemeManagerClass = load("res://autoloads/ThemeManager.gd")
var test_manager
var mock_config: ConfigFile
var _saved_config: PackedByteArray = PackedByteArray()
var _had_saved_config := false

func before_each():
	_backup_and_clear_config()
	mock_config = ConfigFile.new()
	test_manager = ThemeManagerClass.new()
	add_child_autofree(test_manager)

func after_each():
	test_manager = null
	_restore_config()

# --- persistence helpers (keep user://theme.cfg pristine) ------------------

func _backup_and_clear_config() -> void:
	_saved_config = PackedByteArray()
	_had_saved_config = false
	if FileAccess.file_exists(THEME_CONFIG_PATH):
		var existing := FileAccess.open(THEME_CONFIG_PATH, FileAccess.READ)
		if existing != null:
			_saved_config = existing.get_buffer(existing.get_length())
			existing.close()
			_had_saved_config = true
		DirAccess.remove_absolute(ProjectSettings.globalize_path(THEME_CONFIG_PATH))

func _restore_config() -> void:
	if _had_saved_config:
		var restore := FileAccess.open(THEME_CONFIG_PATH, FileAccess.WRITE)
		if restore != null:
			restore.store_buffer(_saved_config)
			restore.close()
	elif FileAccess.file_exists(THEME_CONFIG_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(THEME_CONFIG_PATH))

# --- helpers ---------------------------------------------------------------

func _set_dark_mode() -> void:
	# Called from a SceneTreeTimer callback so that the signal is emitted
	# asynchronously (after wait_for_signal() has connected to it).
	test_manager.set_theme_mode(ThemeManagerClass.ThemeMode.DARK)

# --- tests -----------------------------------------------------------------

# Test fresh instance isolation (ISO-04)
func test_fresh_instance_per_test():
	assert_eq(test_manager.get_theme_mode(), ThemeManagerClass.ThemeMode.LIGHT,
		"Fresh instance should default to ThemeMode.LIGHT")
	assert_false(test_manager.is_dark_mode(),
		"Fresh instance should not report dark mode")
	assert_true(test_manager.is_theme_enabled(),
		"Tactile theme should be enabled by default")

func test_multiple_instances_have_independent_state():
	var manager1 = ThemeManagerClass.new()
	add_child_autofree(manager1)
	var manager2 = ThemeManagerClass.new()
	add_child_autofree(manager2)

	manager1.set_theme_mode(ThemeManagerClass.ThemeMode.DARK)
	manager2.set_theme_mode(ThemeManagerClass.ThemeMode.LIGHT)

	assert_eq(manager1.get_theme_mode(), ThemeManagerClass.ThemeMode.DARK,
		"Manager1 should be dark")
	assert_eq(manager2.get_theme_mode(), ThemeManagerClass.ThemeMode.LIGHT,
		"Manager2 should be light")
	assert_true(manager1.is_dark_mode(), "Manager1 should report dark mode")
	assert_false(manager2.is_dark_mode(), "Manager2 should not report dark mode")

# Test signal emission with parameters (ISO-04)
func test_set_theme_emits_signal_with_parameters():
	watch_signals(test_manager)
	test_manager.set_theme_mode(ThemeManagerClass.ThemeMode.DARK)
	assert_signal_emitted_with_parameters(test_manager, "theme_changed", ["dark"])
	assert_signal_emitted_with_parameters(test_manager, "dark_mode_changed", [true])

# Test async signal with wait_for_signal (ISO-04)
func test_async_theme_change():
	watch_signals(test_manager)
	var timer := get_tree().create_timer(0.05)
	timer.timeout.connect(_set_dark_mode)

	var emitted: bool = await wait_for_signal(test_manager.theme_changed, 1.0)

	assert_true(emitted, "theme_changed should be emitted within the wait window")
	assert_signal_emitted_with_parameters(test_manager, "theme_changed", ["dark"])
	assert_signal_emitted_with_parameters(test_manager, "dark_mode_changed", [true])

# Test ConfigFile injection prevents file I/O (MOCK-03)
func test_config_file_injection():
	mock_config.set_value("settings", THEME_MODE_KEY, ThemeManagerClass.ThemeMode.DARK)
	mock_config.set_value("settings", THEME_ENABLED_KEY, true)
	assert_eq(mock_config.save(THEME_CONFIG_PATH), OK,
		"Injected theme config should be written to user://theme.cfg")

	var manager = ThemeManagerClass.new()
	add_child_autofree(manager)

	assert_eq(manager.get_theme_mode(), ThemeManagerClass.ThemeMode.DARK,
		"Manager should load the injected theme mode from user://theme.cfg")
	assert_true(manager.is_dark_mode(),
		"Manager should report dark mode after loading the injected config")

	manager.set_theme_mode(ThemeManagerClass.ThemeMode.LIGHT)
	var reloaded := ConfigFile.new()
	assert_eq(reloaded.load(THEME_CONFIG_PATH), OK,
		"Persisted theme config should be readable")
	assert_eq(reloaded.get_value("settings", THEME_MODE_KEY, -1),
		ThemeManagerClass.ThemeMode.LIGHT,
		"Theme mode change should be persisted to user://theme.cfg")

# Test theme validation
func test_set_theme_mode_with_invalid_value_is_not_dark():
	# The enum API only knows LIGHT and DARK — there is no "gilded" theme.
	assert_eq(ThemeManagerClass.ThemeMode.size(), 2,
		"ThemeMode should only define LIGHT and DARK")
	assert_false(ThemeManagerClass.ThemeMode.has("GILDED"),
		"Production has no 'gilded' theme")

	# Inject an out-of-range mode value through the persisted config:
	# production stores the raw int, and only ThemeMode.DARK may ever be
	# reported as dark mode.
	mock_config.set_value("settings", THEME_MODE_KEY, 99)
	mock_config.set_value("settings", THEME_ENABLED_KEY, true)
	assert_eq(mock_config.save(THEME_CONFIG_PATH), OK,
		"Invalid theme mode config should be written to user://theme.cfg")

	var manager = ThemeManagerClass.new()
	add_child_autofree(manager)

	assert_false(manager.is_dark_mode(),
		"An unknown theme mode value must not be reported as dark mode")

func test_toggle_theme_mode_switches_between_dark_and_light():
	test_manager.set_theme_mode(ThemeManagerClass.ThemeMode.LIGHT)

	test_manager.toggle_theme_mode()
	assert_eq(test_manager.get_theme_mode(), ThemeManagerClass.ThemeMode.DARK,
		"Should toggle to dark")
	assert_true(test_manager.is_dark_mode(), "Should report dark mode")

	test_manager.toggle_theme_mode()
	assert_eq(test_manager.get_theme_mode(), ThemeManagerClass.ThemeMode.LIGHT,
		"Should toggle back to light")
	assert_false(test_manager.is_dark_mode(), "Should not report dark mode")

	assert_true(test_manager.is_theme_enabled(),
		"Tactile theme should start enabled")
	test_manager.toggle_theme()
	assert_false(test_manager.is_theme_enabled(),
		"toggle_theme() should flip the tactile theme flag")
