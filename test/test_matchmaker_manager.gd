extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

# Mock NetworkManager for settlement-trigger tests
class MockNetwork:
	extends Node
	var is_connected: bool = true
	var user_id: String = "me"
	var last_rpc_id: String = ""
	var last_payload: String = ""
	var mock_responses: Dictionary = {}

	func send_rpc(rpc_id: String, payload: String) -> Dictionary:
		last_rpc_id = rpc_id
		last_payload = payload
		if mock_responses.has(rpc_id):
			return mock_responses[rpc_id]
		return {"success": true}

func _ready() -> void:
	print("=== Running MatchmakerManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_constants()
	await test_available_matches()
	await test_player_rank()
	await test_current_match()
	await test_get_available_matches()
	await test_get_current_match()
	await test_get_player_rank_sync()
	await test_is_in_match()
	await test_signal_emission()
	await test_punch_up_stats_initial()
	await test_punch_up_win_rate_calculation()
	await test_punch_up_total_matches()
	# Punch-up warning tests
	await test_is_punch_up_match()
	await test_calculate_punch_up_risk_level()
	await test_should_show_punch_up_warning()
	await test_get_punch_up_risk_details()
	# Settlement trigger + warning copy tests (issue #862)
	await test_complete_match_trigger_only()
	await test_punch_up_warning_dialog_copy()

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
	var signals_received: Array = []

	mm.matches_loaded.connect(func(_m, _r): signals_received.append("matches_loaded"))
	mm.match_created.connect(func(_m): signals_received.append("match_created"))
	mm.match_accepted.connect(func(_m): signals_received.append("match_accepted"))
	mm.rank_retrieved.connect(func(_r): signals_received.append("rank_retrieved"))
	mm.punch_up_stats_updated.connect(func(_w, _l, _wr): signals_received.append("punch_up_stats_updated"))

	mm.matches_loaded.emit([], 100)
	mm.match_created.emit({})
	mm.match_accepted.emit({})
	mm.rank_retrieved.emit(1500)
	mm.punch_up_stats_updated.emit(5, 3, 0.625)

	await get_tree().create_timer(0.1).timeout

	var expected_signals := ["matches_loaded", "match_created", "match_accepted", "rank_retrieved", "punch_up_stats_updated"]
	var all_received := true
	for sig_name in expected_signals:
		if not sig_name in signals_received:
			all_received = false

	if all_received:
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

# --- Punch Up Warning Tests ---
func test_is_punch_up_match() -> void:
	var mm = _create_matchmaker_manager()

	# Test punch-up match
	var punch_up_match = {
		"match_id": "match1",
		"is_punch_up": true,
		"creator_rank": 20
	}
	if mm.is_punch_up_match(punch_up_match):
		_pass("test_is_punch_up_match_true")
	else:
		_fail("test_is_punch_up_match_true", "Should identify punch-up match")

	# Test normal match
	var normal_match = {
		"match_id": "match2",
		"is_punch_up": false,
		"creator_rank": 20
	}
	if not mm.is_punch_up_match(normal_match):
		_pass("test_is_punch_up_match_false")
	else:
		_fail("test_is_punch_up_match_false", "Should not identify normal match as punch-up")

	# Test match without is_punch_up key
	var missing_key_match = {
		"match_id": "match3",
		"creator_rank": 20
	}
	if not mm.is_punch_up_match(missing_key_match):
		_pass("test_is_punch_up_match_missing_key")
	else:
		_fail("test_is_punch_up_match_missing_key", "Should handle missing key gracefully")

	mm.queue_free()

func test_calculate_punch_up_risk_level() -> void:
	var mm = _create_matchmaker_manager()
	mm.player_rank = 10

	# Test low risk (rank diff 6)
	var low_risk_match = {
		"match_id": "match1",
		"is_punch_up": true,
		"creator_rank": 16  # Diff of 6
	}
	if mm.calculate_punch_up_risk_level(low_risk_match) == "low":
		_pass("test_calculate_punch_up_risk_level_low")
	else:
		_fail("test_calculate_punch_up_risk_level_low", "Should return 'low' for rank diff 6")

	# Test medium risk (rank diff 10)
	var medium_risk_match = {
		"match_id": "match2",
		"is_punch_up": true,
		"creator_rank": 20  # Diff of 10
	}
	if mm.calculate_punch_up_risk_level(medium_risk_match) == "medium":
		_pass("test_calculate_punch_up_risk_level_medium")
	else:
		_fail("test_calculate_punch_up_risk_level_medium", "Should return 'medium' for rank diff 10")

	# Test high risk (rank diff 14)
	var high_risk_match = {
		"match_id": "match3",
		"is_punch_up": true,
		"creator_rank": 24  # Diff of 14
	}
	if mm.calculate_punch_up_risk_level(high_risk_match) == "high":
		_pass("test_calculate_punch_up_risk_level_high")
	else:
		_fail("test_calculate_punch_up_risk_level_high", "Should return 'high' for rank diff 14")

	# Test non-punch-up match
	var normal_match = {
		"match_id": "match4",
		"is_punch_up": false,
		"creator_rank": 20
	}
	if mm.calculate_punch_up_risk_level(normal_match) == "none":
		_pass("test_calculate_punch_up_risk_level_none")
	else:
		_fail("test_calculate_punch_up_risk_level_none", "Should return 'none' for non-punch-up")

	mm.queue_free()

func test_should_show_punch_up_warning() -> void:
	var mm = _create_matchmaker_manager()
	mm.player_rank = 10

	# Test high risk should show warning
	var high_risk_match = {
		"match_id": "match1",
		"is_punch_up": true,
		"creator_rank": 24  # Diff of 14 (high risk)
	}
	if mm.should_show_punch_up_warning(high_risk_match):
		_pass("test_should_show_punch_up_warning_high_risk")
	else:
		_fail("test_should_show_punch_up_warning_high_risk", "Should show warning for high risk")

	# Test medium risk should show warning
	var medium_risk_match = {
		"match_id": "match2",
		"is_punch_up": true,
		"creator_rank": 20  # Diff of 10 (medium risk)
	}
	if mm.should_show_punch_up_warning(medium_risk_match):
		_pass("test_should_show_punch_up_warning_medium_risk")
	else:
		_fail("test_should_show_punch_up_warning_medium_risk", "Should show warning for medium risk")

	# Test low risk should NOT show warning
	var low_risk_match = {
		"match_id": "match3",
		"is_punch_up": true,
		"creator_rank": 16  # Diff of 6 (low risk)
	}
	if not mm.should_show_punch_up_warning(low_risk_match):
		_pass("test_should_show_punch_up_warning_low_risk")
	else:
		_fail("test_should_show_punch_up_warning_low_risk", "Should not show warning for low risk")

	# Test non-punch-up should NOT show warning
	var normal_match = {
		"match_id": "match4",
		"is_punch_up": false,
		"creator_rank": 20
	}
	if not mm.should_show_punch_up_warning(normal_match):
		_pass("test_should_show_punch_up_warning_normal")
	else:
		_fail("test_should_show_punch_up_warning_normal", "Should not show warning for normal match")

	mm.queue_free()

func test_get_punch_up_risk_details() -> void:
	var mm = _create_matchmaker_manager()
	mm.player_rank = 10

	# Test high risk match details
	var high_risk_match = {
		"match_id": "match1",
		"is_punch_up": true,
		"creator_rank": 24  # Diff of 14 (high risk)
	}
	var details = mm.get_punch_up_risk_details(high_risk_match)

	if details.get("is_punch_up") == true and \
	   details.get("risk_level") == "high" and \
	   details.get("rank_difference") == 14 and \
	   details.get("opponent_rank") == 24:
		_pass("test_get_punch_up_risk_details_high_risk")
	else:
		_fail("test_get_punch_up_risk_details_high_risk", "Risk details incorrect for high risk: %s" % str(details))

	# Verify reward calculations
	var xp_multiplier: float = details.get("xp_multiplier", 0.0)
	var gem_bonus: int = details.get("gem_bonus", 0)
	var rank_penalty: int = details.get("rank_penalty", 0)

	# High risk should have higher rewards and penalties
	if xp_multiplier > 1.5 and gem_bonus >= 8 and rank_penalty >= 15:
		_pass("test_get_punch_up_risk_details_rewards")
	else:
		_fail("test_get_punch_up_risk_details_rewards",
			"Reward calculations incorrect: xp=%f, gems=%d, penalty=%d" % [xp_multiplier, gem_bonus, rank_penalty])

	# Test non-punch-up match details
	var normal_match = {
		"match_id": "match2",
		"is_punch_up": false,
		"creator_rank": 15
	}
	var normal_details = mm.get_punch_up_risk_details(normal_match)

	if normal_details.get("is_punch_up") == false and \
	   normal_details.get("risk_level") == "none" and \
	   normal_details.get("xp_multiplier") == 1.0 and \
	   normal_details.get("gem_bonus") == 0:
		_pass("test_get_punch_up_risk_details_normal")
	else:
		_fail("test_get_punch_up_risk_details_normal", "Risk details incorrect for normal match: %s" % str(normal_details))

	mm.queue_free()

# --- Settlement Trigger Tests (issue #862) ---

func test_complete_match_trigger_only() -> void:
	var mm = _create_matchmaker_manager()
	var mock_net = MockNetwork.new()
	add_child(mock_net)
	mm.network_manager = mock_net
	mm.current_match = {"match_id": "m1", "status": "active"}

	# Server declares the opponent the winner; the client sent no claim
	mock_net.mock_responses[mm.RPC_COMPLETE_MATCH] = {
		"success": true,
		"winner": {"user_id": "opponent", "new_rank": 1100},
		"loser": {"user_id": "me", "new_rank": 950},
		"is_punch_up": true
	}

	var emitted_results: Array = []
	mm.match_completed.connect(func(result): emitted_results.append(result))

	await mm.complete_match(true)

	var payload = JSON.parse_string(mock_net.last_payload)

	var passed := true
	var err := ""

	if payload == null:
		passed = false
		err = "Payload should parse as JSON"
	elif payload.has("winner_id") or payload.has("loser_id"):
		passed = false
		err = "Trigger-only payload must not carry a winner/loser assertion"
	elif payload.get("match_id", "") != "m1":
		passed = false
		err = "Payload must carry the match_id settlement key"
	elif not payload.get("is_punch_up", false):
		passed = false
		err = "Payload should carry the advisory is_punch_up flag"
	elif emitted_results.size() != 1:
		passed = false
		err = "match_completed should emit exactly once"
	elif emitted_results[0].get("is_victory", true) != false:
		passed = false
		err = "Victory must be derived from the server-declared winner"
	elif emitted_results[0].get("winner_id", "") != "opponent":
		passed = false
		err = "winner_id must be the server-declared winner"
	elif mm.punch_up_losses != 1 or mm.punch_up_wins != 0:
		passed = false
		err = "Punch-up stats must follow the server-declared outcome"
	elif not mm.current_match.is_empty():
		passed = false
		err = "Current match should be cleared after settlement"

	if passed:
		_pass("test_complete_match_trigger_only")
	else:
		_fail("test_complete_match_trigger_only", err)

	mm.queue_free()
	mock_net.queue_free()

func test_punch_up_warning_dialog_copy() -> void:
	var dialog = load("res://scenes/ui/punch_up_warning_dialog.tscn").instantiate()
	add_child(dialog)

	var match_data := {
		"match_id": "match1",
		"is_punch_up": true,
		"creator_rank": 24
	}
	dialog.set_match_data(match_data, 10)

	var lose_text: String = dialog.lose_penalty_label.text
	var rank_text: String = dialog.rank_difference_label.text
	var win_text: String = dialog.win_bonus_label.text

	var passed := true
	var err := ""

	if not lose_text.contains("Ladder Rating"):
		passed = false
		err = "Loss copy must name Ladder Rating (what's staked)"
	elif not lose_text.contains("2×"):
		passed = false
		err = "Loss copy must state the amplified (2x) Ladder Rating loss"
	elif lose_text.contains("-") and lose_text.to_upper().contains("XP"):
		passed = false
		err = "Loss copy must not advertise an XP penalty"
	elif not rank_text.contains("Power Rating"):
		passed = false
		err = "Gap copy must name Power Rating (eligibility)"
	elif not win_text.contains("Gems"):
		passed = false
		err = "Win copy should keep the gem bonus"

	if passed:
		_pass("test_punch_up_warning_dialog_copy")
	else:
		_fail("test_punch_up_warning_dialog_copy", err)

	dialog.queue_free()
