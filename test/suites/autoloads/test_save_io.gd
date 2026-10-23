extends GutTest
## Issue #1723 / #1728: saves must survive a kill mid-write.
##
## SaveIO writes "<path>.tmp" first, keeps the previous good file as
## "<path>.bak" and renames the temp file over the target. Reads fall back
## to the backup when the main file is missing or does not parse.

const PATH := "user://test_save_io.json"


func _cleanup() -> void:
	for suffix in ["", ".tmp", ".bak"]:
		if FileAccess.file_exists(PATH + suffix):
			DirAccess.remove_absolute(PATH + suffix)


func before_each() -> void:
	_cleanup()


func after_each() -> void:
	_cleanup()


func test_save_round_trip() -> void:
	assert_true(SaveIO.write_json(PATH, {"coins": 5, "chapters": ["chapter_1"]}))
	var data = SaveIO.read_json(PATH)
	assert_true(data is Dictionary)
	assert_eq(data["coins"], 5)
	assert_eq(data["chapters"].size(), 1)
	assert_eq(data["chapters"][0], "chapter_1")
	assert_false(FileAccess.file_exists(PATH + ".tmp"), "no temp file left behind")


func test_saved_payload_carries_version() -> void:
	assert_true(SaveIO.write_json(PATH, {"coins": 5}))
	var data = SaveIO.read_json(PATH)
	assert_true(data.has("_version"))
	assert_eq(int(data["_version"]), SaveIO.SAVE_VERSION)


func test_backup_created_on_second_write() -> void:
	assert_true(SaveIO.write_json(PATH, {"v": 1}))
	assert_true(SaveIO.write_json(PATH, {"v": 2}))
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
	# A corrupt main file is not a good save: it must not be promoted into
	# the backup slot and wipe the last known-good copy.
	assert_true(SaveIO.write_json(PATH, {"v": 4}))
	assert_eq(SaveIO._parse_file(PATH + ".bak")["v"], 1, "good backup kept")


func test_missing_or_unusable_file_returns_null() -> void:
	assert_null(SaveIO.read_json(PATH))
	# A corrupt main file with no usable backup behaves like a missing file,
	# so callers fall back to their defaults.
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	f.store_string("not json {{{")
	f.close()
	assert_null(SaveIO.read_json(PATH))


func test_array_payload_round_trip() -> void:
	assert_true(SaveIO.write_text(PATH, JSON.stringify([1, 2, 3])))
	var data = SaveIO.read_json(PATH)
	assert_true(data is Array)
	assert_eq(data.size(), 3)
	assert_eq(data[0], 1)


func test_write_failure_returns_false() -> void:
	assert_false(SaveIO.write_json("user://no_such_dir_1723/x.json", {"a": 1}))
	assert_false(FileAccess.file_exists("user://no_such_dir_1723/x.json"))
	assert_false(FileAccess.file_exists("user://no_such_dir_1723/x.json.tmp"))
