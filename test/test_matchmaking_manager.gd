extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running MatchmakingManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_get_current_match_empty()
	await test_is_in_match_false()
	await test_get_available_match_count_empty()
	await test_get_match_info_empty()
	await test_get_matches_by_type_empty()
	await test_get_matches_by_rating_empty()
	await test_create_match_pending_prevention()
	await test_join_match_empty_id()
	await test_match_filtering()

	print("\n=== MatchmakingManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_matchmaking_manager() -> Node:
	var mm = load("res://autoloads/MatchmakingManager.gd").new()
	add_child(mm)
	await get_tree().process_frame
	return mm

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var mm = await _create_matchmaking_manager()

	if mm.available_matches.is_empty():
		_pass("test_initial_matches_empty")
	else:
		_fail("test_initial_matches_empty", "Available matches should be empty initially")

	if mm.current_match.is_empty():
		_pass("test_initial_current_match_empty")
	else:
		_fail("test_initial_current_match_empty", "Current match should be empty initially")

	if mm._pending_creation == false:
		_pass("test_initial_pending_creation_false")
	else:
		_fail("test_initial_pending_creation_false", "Pending creation should be false initially")

	mm.queue_free()

func test_get_current_match_empty() -> void:
	var mm = await _create_matchmaking_manager()

	var match_data = mm.get_current_match()

	if match_data.is_empty():
		_pass("test_get_current_match_empty")
	else:
		_fail("test_get_current_match_empty", "Should return empty dict when no match")

	mm.queue_free()

func test_is_in_match_false() -> void:
	var mm = await _create_matchmaking_manager()

	if not mm.is_in_match():
		_pass("test_is_in_match_false")
	else:
		_fail("test_is_in_match_false", "Should not be in a match initially")

	mm.queue_free()

func test_get_available_match_count_empty() -> void:
	var mm = await _create_matchmaking_manager()

	if mm.get_available_match_count() == 0:
		_pass("test_get_available_match_count_empty")
	else:
		_fail("test_get_available_match_count_empty", "Should return 0 when no matches available")

	mm.queue_free()

func test_get_match_info_empty() -> void:
	var mm = await _create_matchmaking_manager()

	var info = mm.get_match_info("nonexistent_match")

	if info.is_empty():
		_pass("test_get_match_info_empty")
	else:
		_fail("test_get_match_info_empty", "Should return empty dict for nonexistent match")

	mm.queue_free()

func test_get_matches_by_type_empty() -> void:
	var mm = await _create_matchmaking_manager()

	var filtered = mm.get_matches_by_type("1v1")

	if filtered.is_empty():
		_pass("test_get_matches_by_type_empty")
	else:
		_fail("test_get_matches_by_type_empty", "Should return empty array when no matches")

	mm.queue_free()

func test_get_matches_by_rating_empty() -> void:
	var mm = await _create_matchmaking_manager()

	var filtered = mm.get_matches_by_rating(1000)

	if filtered.is_empty():
		_pass("test_get_matches_by_rating_empty")
	else:
		_fail("test_get_matches_by_rating_empty", "Should return empty array when no matches")

	mm.queue_free()

func test_create_match_pending_prevention() -> void:
	var mm = await _create_matchmaking_manager()
	mm._pending_creation = true

	var result = mm.create_match("1v1", false)

	if result == "":
		_pass("test_create_match_pending_prevention")
	else:
		_fail("test_create_match_pending_prevention", "Should return empty string when pending")

	mm._pending_creation = false
	mm.queue_free()

func test_join_match_empty_id() -> void:
	var mm = await _create_matchmaking_manager()

	var result = await mm.join_match("")

	if result == false:
		_pass("test_join_match_empty_id")
	else:
		_fail("test_join_match_empty_id", "Should return false for empty match ID")

	mm.queue_free()

func test_match_filtering() -> void:
	var mm = await _create_matchmaking_manager()

	# Populate with test data
	mm.available_matches = [
		{"match_id": "m1", "match_type": "1v1", "rating": 1200},
		{"match_id": "m2", "match_type": "2v2", "rating": 1500},
		{"match_id": "m3", "match_type": "1v1", "rating": 1100},
		{"match_id": "m4", "match_type": "1v1", "rating": 1800},
	]

	var type_filtered = mm.get_matches_by_type("1v1")
	if type_filtered.size() == 3:
		_pass("test_filter_by_type")
	else:
		_fail("test_filter_by_type", "Should find 3 matches of type 1v1, got %d" % type_filtered.size())

	var rating_filtered = mm.get_matches_by_rating(1500)
	if rating_filtered.size() == 2:
		_pass("test_filter_by_rating")
	else:
		_fail("test_filter_by_rating", "Should find 2 matches with rating >= 1500, got %d" % rating_filtered.size())

	var high_rating = mm.get_matches_by_rating(2000)
	if high_rating.is_empty():
		_pass("test_filter_by_rating_no_match")
	else:
		_fail("test_filter_by_rating_no_match", "Should find no matches with rating >= 2000")

	mm.queue_free()
