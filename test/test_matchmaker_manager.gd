extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running MatchmakerManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	test_initial_state()
	test_constants()
	test_available_matches()
	test_player_rank()
	test_current_match()
	test_get_available_matches()
	test_get_current_match()
	test_get_player_rank_sync()
	test_is_in_match()
	test_signal_emission()
	test_punch_up_stats_initial()
	test_punch_up_win_rate_calculation()
	test_punch_up_total_matches()

	print("\n=== MatchmakerManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_matchmaker_manager() -> Node:
	var mm = load("res://autoloads/MatchmakerManager.gd").new()
	add_child(mm)
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
	var mm = _create_matchmaker_manager()

	if mm.available_matches.is_empty() and mm.player_rank == 0 and mm.current_match.is_empty():
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "Initial state should be empty")

	mm.queue_free()

func test_constants() -> void:
	var mm = _create_matchmaker_manager()

	if mm.RPC_LIST_MATCHES == "armored_archer/list_matches":
		_pass("test_constants_rpc_list_matches")
	else:
		_fail("test_constants_rpc_list_matches", "RPC_LIST_MATCHES should match")

	if mm.RPC_CREATE_MATCH == "armored_archer/create_match":
		_pass("test_constants_rpc_create_match")
	else:
		_fail("test_constants_rpc_create_match", "RPC_CREATE_MATCH should match")

	if mm.RPC_ACCEPT_MATCH == "armored_archer/accept_match":
		_pass("test_constants_rpc_accept_match")
	else:
		_fail("test_constants_rpc_accept_match", "RPC_ACCEPT_MATCH should match")

	mm.queue_free()

func test_available_matches() -> void:
	var mm = _create_matchmaker_manager()
	mm.available_matches = [{"id": "match1"}, {"id": "match2"}]

	if mm.available_matches.size() == 2:
		_pass("test_available_matches")
	else:
		_fail("test_available_matches", "Should have 2 matches")

	mm.queue_free()

func test_player_rank() -> void:
	var mm = _create_matchmaker_manager()
	mm.player_rank = 1500

	if mm.player_rank == 1500:
		_pass("test_player_rank")
	else:
		_fail("test_player_rank", "Player rank should be 1500")

	mm.queue_free()

func test_current_match() -> void:
	var mm = _create_matchmaker_manager()
	mm.current_match = {"id": "match_123", "status": "active"}

	if mm.current_match.has("id"):
		_pass("test_current_match")
	else:
		_fail("test_current_match", "Current match should have id")

	mm.queue_free()

func test_get_available_matches() -> void:
	var mm = _create_matchmaker_manager()
	mm.available_matches = [{"id": "test"}]

	if mm.get_available_matches().size() == 1:
		_pass("test_get_available_matches")
	else:
		_fail("test_get_available_matches", "Should return matches")

	mm.queue_free()

func test_get_current_match() -> void:
	var mm = _create_matchmaker_manager()
	mm.current_match = {"id": "current"}

	if mm.get_current_match().has("id"):
		_pass("test_get_current_match")
	else:
		_fail("test_get_current_match", "Should return current match")

	mm.queue_free()

func test_get_player_rank_sync() -> void:
	var mm = _create_matchmaker_manager()
	mm.player_rank = 2000

	if mm.get_player_rank_sync() == 2000:
		_pass("test_get_player_rank_sync")
	else:
		_fail("test_get_player_rank_sync", "Should return player rank")

	mm.queue_free()

func test_is_in_match() -> void:
	var mm = _create_matchmaker_manager()

	if not mm.is_in_match():
		_pass("test_is_in_match_empty")
	else:
		_fail("test_is_in_match_empty", "Should not be in match when empty")

	mm.current_match = {"status": "completed"}
	if not mm.is_in_match():
		_pass("test_is_in_match_completed")
	else:
		_fail("test_is_in_match_completed", "Should not be in match when completed")

	mm.current_match = {"status": "active"}
	if mm.is_in_match():
		_pass("test_is_in_match_active")
	else:
		_fail("test_is_in_match_active", "Should be in match when active")

	mm.queue_free()

func test_signal_emission() -> void:
	var mm = _create_matchmaker_manager()
	var matches_loaded = false
	var match_created = false
	var match_accepted = false
	var rank_retrieved = false
	var punch_up_stats_updated = false

	mm.matches_loaded.connect(func(m, r): matches_loaded = true)
	mm.match_created.connect(func(m): match_created = true)
	mm.match_accepted.connect(func(m): match_accepted = true)
	mm.rank_retrieved.connect(func(r): rank_retrieved = true)
	mm.punch_up_stats_updated.connect(func(w, l, wr): punch_up_stats_updated = true)

	mm.matches_loaded.emit([], 100)
	mm.match_created.emit({})
	mm.match_accepted.emit({})
	mm.rank_retrieved.emit(1500)
	mm.punch_up_stats_updated.emit(5, 3, 0.625)

	await get_tree().create_timer(0.1).timeout

	if matches_loaded and match_created and match_accepted and rank_retrieved and punch_up_stats_updated:
		_pass("test_signal_emission")
	else:
		_fail("test_signal_emission", "All signals should be emitted")

	mm.queue_free()

# --- Punch Up Tests ---
func test_punch_up_stats_initial() -> void:
	var mm = _create_matchmaker_manager()

	if mm.get_punch_up_wins() == 0 and mm.get_punch_up_losses() == 0 and mm.get_punch_up_win_rate() == 0.0:
		_pass("test_punch_up_stats_initial")
	else:
		_fail("test_punch_up_stats_initial", "Initial punch up stats should be zero")

	mm.queue_free()

func test_punch_up_win_rate_calculation() -> void:
	var mm = _create_matchmaker_manager()

	mm.punch_up_wins = 3
	mm.punch_up_losses = 1

	var win_rate = mm.get_punch_up_win_rate()
	if win_rate == 0.75:
		_pass("test_punch_up_win_rate_calculation")
	else:
		_fail("test_punch_up_win_rate_calculation", "Win rate should be 0.75, got: %f" % win_rate)

	mm.queue_free()

func test_punch_up_total_matches() -> void:
	var mm = _create_matchmaker_manager()

	mm.punch_up_wins = 10
	mm.punch_up_losses = 5

	if mm.get_punch_up_total_matches() == 15:
		_pass("test_punch_up_total_matches")
	else:
		_fail("test_punch_up_total_matches", "Total should be 15")

	mm.queue_free()
