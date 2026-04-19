extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running Season Manager Integration Tests ===\n")
	await run_tests()
	print("\n=== Season Manager Integration Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func run_tests() -> void:
	await test_season_constants()
	await test_initial_state()
	await test_season_transition_updates_local_state()
	await test_rating_decay_calculation()
	await test_format_time_remaining()
	print("\nAll season manager integration tests complete.")

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func _create_season_manager() -> Node:
	var sm = load("res://autoloads/SeasonManager.gd").new()
	add_child(sm)
	return sm

func test_season_constants() -> void:
	var sm = _create_season_manager()

	if sm.SEASON_DURATION_DAYS != 30:
		_fail("test_season_constants_duration", "SEASON_DURATION_DAYS should be 30, got: %d" % sm.SEASON_DURATION_DAYS)
		sm.queue_free()
		return

	if sm.DECAY_INACTIVE_DAYS_THRESHOLD != 7:
		_fail("test_season_constants_decay", "DECAY_INACTIVE_DAYS_THRESHOLD should be 7, got: %d" % sm.DECAY_INACTIVE_DAYS_THRESHOLD)
		sm.queue_free()
		return

	if sm.MINIMUM_RATING != 1000:
		_fail("test_season_constants_min_rating", "MINIMUM_RATING should be 1000, got: %d" % sm.MINIMUM_RATING)
		sm.queue_free()
		return

	_pass("test_season_constants")
	sm.queue_free()

func test_initial_state() -> void:
	var sm = _create_season_manager()

	if not sm.current_season.is_empty():
		# Might be initialized from autoload, check it's a dictionary
		if typeof(sm.current_season) != TYPE_DICTIONARY:
			_fail("test_season_initial_state", "current_season should be a Dictionary")
			sm.queue_free()
			return

	if sm.player_rank != 0:
		_fail("test_season_initial_state_rank", "Initial player_rank should be 0, got: %d" % sm.player_rank)
		sm.queue_free()
		return

	if sm.player_score != 0:
		_fail("test_season_initial_state_score", "Initial player_score should be 0, got: %d" % sm.player_score)
		sm.queue_free()
		return

	_pass("test_season_initial_state")
	sm.queue_free()

func test_season_transition_updates_local_state() -> void:
	var sm = _create_season_manager()

	# Set up an active season
	var old_season = {
		"season_id": "season-1",
		"season_number": 1,
		"status": "active",
		"start_time": Time.get_unix_time_from_system() * 1000 - 2500000000,
		"end_time": Time.get_unix_time_from_system() * 1000,
	}
	sm.current_season = old_season
	sm.player_rank = 42
	sm.player_score = 1500

	# Simulate season transition
	var new_season = {
		"season_id": "season-2",
		"season_number": 2,
		"status": "active",
		"start_time": Time.get_unix_time_from_system() * 1000,
		"end_time": Time.get_unix_time_from_system() * 1000 + 2500000000,
	}

	if sm.has_method("on_season_transition"):
		sm.on_season_transition(old_season, new_season)

	# After transition, season data should be updated
	if sm.current_season.get("season_id") != "season-2":
		_fail("test_season_transition", "current_season should be updated to season-2")
		sm.queue_free()
		return

	# Rank and score should reset for new season
	if sm.player_rank != 0:
		_fail("test_season_transition_rank", "player_rank should reset to 0 after transition")
		sm.queue_free()
		return

	_pass("test_season_transition_updates_local_state")
	sm.queue_free()

func test_rating_decay_calculation() -> void:
	var sm = _create_season_manager()

	# Test no decay for recently active player
	var current_time_ms = Time.get_unix_time_from_system() * 1000
	var recent_active_ms = current_time_ms - 3 * 24 * 60 * 60 * 1000  # 3 days ago
	var rating = 1500
	var decayed = sm.apply_rating_decay(rating, recent_active_ms)
	if decayed != rating:
		_fail("test_rating_decay_recent", "No decay should apply for recently active player (3 days)")
		sm.queue_free()
		return

	# Test decay applies for 10-day inactive player
	var inactive_10d_ms = current_time_ms - 10 * 24 * 60 * 60 * 1000
	var decayed_10d = sm.apply_rating_decay(1500, inactive_10d_ms)
	# Should have some decay but not below minimum
	if decayed_10d >= 1500:
		_fail("test_rating_decay_10d", "Decay should reduce rating for 10-day inactive player")
		sm.queue_free()
		return
	if decayed_10d < sm.MINIMUM_RATING:
		_fail("test_rating_decay_10d_min", "Rating should not go below MINIMUM_RATING (%d)" % sm.MINIMUM_RATING)
		sm.queue_free()
		return

	# Test decay is capped
	var inactive_100d_ms = current_time_ms - 100 * 24 * 60 * 60 * 1000
	var decayed_100d = sm.apply_rating_decay(1500, inactive_100d_ms)
	if decayed_100d < sm.MINIMUM_RATING:
		_fail("test_rating_decay_cap", "Rating should not drop below MINIMUM_RATING even after very long inactivity")
		sm.queue_free()
		return

	_pass("test_rating_decay_calculation")
	sm.queue_free()

func test_format_time_remaining() -> void:
	var sm = _create_season_manager()

	# Test with known time remaining (1 day, 2 hours, 30 minutes)
	sm.time_remaining = 24 * 60 * 60 + 2 * 60 * 60 + 30 * 60
	var formatted = sm.format_time_remaining()
	if formatted == "":
		_fail("test_format_time_remaining", "format_time_remaining should return non-empty string")
		sm.queue_free()
		return

	# Test with zero time remaining
	sm.time_remaining = 0
	var zero_formatted = sm.format_time_remaining()
	if zero_formatted == "":
		_fail("test_format_time_remaining_zero", "Should format zero time remaining")
		sm.queue_free()
		return

	_pass("test_format_time_remaining")
	sm.queue_free()
