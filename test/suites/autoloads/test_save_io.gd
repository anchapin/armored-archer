extends GutTest
## Issue #1723: saves must survive a kill mid-write.

const PATH := "user://test_save_io.json"


func _cleanup() -> void:
	for suffix in ["", ".tmp", ".bak"]:
		if FileAccess.file_exists(PATH + suffix):
			DirAccess.remove_absolute(PATH + suffix)


func before_each() -> void:
	_cleanup()


func after_each() -> void:
	_cleanup()


func test_round_trip_adds_version() -> void:
	assert_true(SaveIO.write_json(PATH, {"coins": 5}))
	var data = SaveIO.read_json(PATH)
	assert_true(data is Dictionary)
	assert_eq(data["coins"], 5)
	assert_eq(int(data["_version"]), SaveIO.SAVE_VERSION)


func test_no_tmp_file_left_after_write() -> void:
	SaveIO.write_json(PATH, {"a": 1})
	assert_false(FileAccess.file_exists(PATH + ".tmp"))


func test_second_write_keeps_previous_as_backup() -> void:
	SaveIO.write_json(PATH, {"v": 1})
	SaveIO.write_json(PATH, {"v": 2})
	assert_eq(SaveIO.read_json(PATH)["v"], 2)
	assert_true(FileAccess.file_exists(PATH + ".bak"))
	assert_eq(SaveIO._parse_file(PATH + ".bak")["v"], 1)


func test_corrupt_main_falls_back_to_backup() -> void:
	SaveIO.write_json(PATH, {"v": 1})
	SaveIO.write_json(PATH, {"v": 2})
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	f.store_string("{\"v\": 3, trunc")
	f.close()
	assert_eq(SaveIO.read_json(PATH)["v"], 1, "falls back to .bak")


func test_missing_file_returns_null() -> void:
	assert_null(SaveIO.read_json(PATH))


func test_array_payload_round_trip() -> void:
	assert_true(SaveIO.write_text(PATH, JSON.stringify([1, 2, 3])))
	var data = SaveIO.read_json(PATH)
	assert_true(data is Array)
	assert_eq(data.size(), 3)


func test_write_fails_cleanly_on_bad_path() -> void:
	assert_false(SaveIO.write_json("user://no_such_dir_1723/x.json", {"a": 1}))
