## Standalone Campaign Persistence Validation Script
##
## This script validates campaign persistence without needing full autoload setup.
## Run with: godot --headless --script test/validation/campaign_persistence_validation.gd

extends SceneTree

const SAVE_FILE_PATH = "user://campaign_progress.json"

var _results: Dictionary = {
	"total": 0,
	"passed": 0,
	"failed": 0,
	"details": []
}

func _init():
	print("=== Campaign Persistence Validation ===\n")
	run_all_tests()
	print_results()
	quit(1 if _results.failed > 0 else 0)

func print_results():
	print("\n=== Validation Results ===")
	print("Total: %d" % _results.total)
	print("Passed: %d" % _results.passed)
	print("Failed: %d" % _results.failed)

	for detail in _results.details:
		var status = "✅ PASS" if detail.passed else "❌ FAIL"
		print("\n%s - %s" % [status, detail.name])
		if not detail.passed and detail.reason:
			print("  Reason: %s" % detail.reason)

## === Test Runner ===

func test(name: String, fn: Callable) -> void:
	_results.total += 1
	var passed = false
	var reason = ""

	# Clean up before test
	_remove_save_file()

	var result = fn.call()
	passed = result
	if not passed and result is String:
		reason = result

	if passed:
		_results.passed += 1
	else:
		_results.failed += 1

	_results.details.append({
		"name": name,
		"passed": passed,
		"reason": reason
	})

func run_all_tests():
	test("Save file is created after save", test_save_creates_file)
	test("Save file contains correct structure", test_save_structure)
	test("Load reads saved data correctly", test_load_data)
	test("Load handles missing file gracefully", test_load_missing_file)
	test("Load handles corrupted JSON gracefully", test_load_corrupted)
	test("Multiple saves overwrite correctly", test_multiple_saves)
	test("Large data sets are handled", test_large_data)
	test("Empty arrays are saved and loaded", test_empty_arrays)

## === Helper Functions ===

func _remove_save_file():
	if FileAccess.file_exists(SAVE_FILE_PATH):
		DirAccess.remove_absolute(SAVE_FILE_PATH)

func _write_save(data: Dictionary):
	var file = FileAccess.open(SAVE_FILE_PATH, FileAccess.WRITE)
	file.store_string(JSON.stringify(data))
	file.close()

func _read_save() -> Dictionary:
	var file = FileAccess.open(SAVE_FILE_PATH, FileAccess.READ)
	if file:
		var content = file.get_as_text()
		file.close()
		var json = JSON.new()
		if json.parse(content) == OK:
			return json.data
	return {}

## === Test Functions ===

func test_save_creates_file():
	var data = {
		"unlocked_chapters": ["chapter_1"],
		"unlocked_stages": ["1_1"],
		"completed_stages": [],
		"unlocked_modifier_pools": [],
		"bosses_defeated": []
	}
	_write_save(data)
	return FileAccess.file_exists(SAVE_FILE_PATH)

func test_save_structure():
	var data = {
		"unlocked_chapters": ["chapter_1"],
		"unlocked_stages": ["1_1"],
		"completed_stages": [],
		"unlocked_modifier_pools": [],
		"bosses_defeated": []
	}
	_write_save(data)
	var loaded = _read_save()

	var required = ["unlocked_chapters", "unlocked_stages", "completed_stages", "unlocked_modifier_pools", "bosses_defeated"]
	for key in required:
		if not loaded.has(key):
			return "Missing key: %s" % key
		if not loaded[key] is Array:
			return "Key %s is not an array" % key
	return true

func test_load_data():
	var original = {
		"unlocked_chapters": ["chapter_1", "chapter_2"],
		"unlocked_stages": ["1_1", "1_2", "1_3", "2_1"],
		"completed_stages": ["1_1", "1_2"],
		"unlocked_modifier_pools": ["heavy_impact", "piercing_arrow"],
		"bosses_defeated": ["boss_basic"]
	}
	_write_save(original)
	var loaded = _read_save()

	if loaded != original:
		return "Loaded data doesn't match original"
	return true

func test_load_missing_file():
	_remove_save_file()
	var loaded = _read_save()
	return loaded.is_empty()

func test_load_corrupted():
	var file = FileAccess.open(SAVE_FILE_PATH, FileAccess.WRITE)
	file.store_string("invalid json {{{")
	file.close()
	var loaded = _read_save()
	return loaded.is_empty()

func test_multiple_saves():
	# First save
	_write_save({"unlocked_stages": ["1_1"], "completed_stages": [], "unlocked_chapters": [], "unlocked_modifier_pools": [], "bosses_defeated": []})

	# Second save
	_write_save({"unlocked_stages": ["1_1", "1_2"], "completed_stages": ["1_1"], "unlocked_chapters": [], "unlocked_modifier_pools": [], "bosses_defeated": []})

	var loaded = _read_save()
	if loaded["unlocked_stages"].size() != 2:
		return "Second save didn't overwrite correctly"
	if loaded["completed_stages"].size() != 1:
		return "Second save didn't overwrite correctly"
	return true

func test_large_data():
	var data = {
		"unlocked_chapters": [],
		"unlocked_stages": [],
		"completed_stages": [],
		"unlocked_modifier_pools": [],
		"bosses_defeated": []
	}

	# Add 100 stages
	for i in range(100):
		data["unlocked_stages"].append("1_%d" % i)
		if i < 50:
			data["completed_stages"].append("1_%d" % i)

	var start = Time.get_ticks_msec()
	_write_save(data)
	var save_time = Time.get_ticks_msec() - start

	start = Time.get_ticks_msec()
	var loaded = _read_save()
	var load_time = Time.get_ticks_msec() - start

	if save_time > 100:
		return "Save too slow: %dms" % save_time
	if load_time > 50:
		return "Load too slow: %dms" % load_time
	if loaded["unlocked_stages"].size() != 100:
		return "Not all stages saved"
	return true

func test_empty_arrays():
	var data = {
		"unlocked_chapters": [],
		"unlocked_stages": [],
		"completed_stages": [],
		"unlocked_modifier_pools": [],
		"bosses_defeated": []
	}
	_write_save(data)
	var loaded = _read_save()

	var required = ["unlocked_chapters", "unlocked_stages", "completed_stages", "unlocked_modifier_pools", "bosses_defeated"]
	for key in required:
		if loaded[key].size() != 0:
			return "%s not empty" % key
	return true
