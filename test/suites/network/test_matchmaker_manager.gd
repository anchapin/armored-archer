extends GutTest

var MatchmakerManagerClass = load("res://autoloads/MatchmakerManager.gd")
var _mm

# Mock NetworkManager for testing RPCs and user_id
class MockNetwork:
	extends Node
	var is_server_connected: bool = true
	var user_id: String = "test_user"
	var mock_responses: Dictionary = {}
	var last_rpc_id: String = ""
	var last_payload: String = ""
	
	func send_rpc(rpc_id: String, payload: String) -> Dictionary:
		last_rpc_id = rpc_id
		last_payload = payload
		if mock_responses.has(rpc_id):
			return mock_responses[rpc_id]
		return {"success": true}

# Called before each test
func before_each():
	_mm = MatchmakerManagerClass.new()
	add_child_autofree(_mm)

# Called after each test
func after_each():
	_mm = null

# Test: Initial state
func test_initial_state():
	assert_true(_mm.available_matches.is_empty(), "Initial available_matches should be empty")
	assert_eq(_mm.player_rank, 0, "Initial player_rank should be 0")
	assert_true(_mm.current_match.is_empty(), "Initial current_match should be empty")
	assert_eq(_mm.punch_up_wins, 0, "Initial punch_up_wins should be 0")
	assert_eq(_mm.punch_up_losses, 0, "Initial punch_up_losses should be 0")

# Test: RPC constants
func test_rpc_constants():
	assert_eq(_mm.RPC_LIST_MATCHES, "armored_archer/list_matches")
	assert_eq(_mm.RPC_CREATE_MATCH, "armored_archer/create_match")
	assert_eq(_mm.RPC_ACCEPT_MATCH, "armored_archer/accept_match")
	assert_eq(_mm.RPC_GET_PLAYER_RANK, "armored_archer/get_player_rank")
	assert_eq(_mm.RPC_COMPLETE_MATCH, "armored_archer/complete_match")

# Test: list_matches success
func test_list_matches_success():
	var mock_net = MockNetwork.new()
	_mm.network_manager = mock_net
	
	var matches = [{"match_id": "m1"}, {"match_id": "m2"}]
	mock_net.mock_responses[_mm.RPC_LIST_MATCHES] = {
		"success": true,
		"matches": matches,
		"player_rank": 1500
	}
	
	watch_signals(_mm)
	await _mm.list_matches("ranked", 1000, 2000, 10)
	
	assert_signal_emitted(_mm, "matches_loaded")
	assert_eq(_mm.available_matches.size(), 2)
	assert_eq(_mm.player_rank, 1500)
	
	var payload = JSON.parse_string(mock_net.last_payload)
	assert_eq(payload["match_type"], "ranked")
	assert_eq(payload["min_rank"], 1000)
	assert_eq(payload["max_rank"], 2000)
	assert_eq(payload["limit"], 10)

# Test: create_match success
func test_create_match_success():
	var mock_net = MockNetwork.new()
	_mm.network_manager = mock_net
	
	var match_data = {"match_id": "new_match", "match_type": "ranked"}
	mock_net.mock_responses[_mm.RPC_CREATE_MATCH] = {
		"success": true,
		"match": match_data
	}
	
	watch_signals(_mm)
	await _mm.create_match("ranked", true, "opponent1")
	
	assert_signal_emitted(_mm, "match_created")
	assert_eq(_mm.current_match["match_id"], "new_match")
	
	var payload = JSON.parse_string(mock_net.last_payload)
	assert_eq(payload["match_type"], "ranked")
	assert_true(payload["is_punch_up"])
	assert_eq(payload["target_opponent_id"], "opponent1")

# Test: accept_match success
func test_accept_match_success():
	var mock_net = MockNetwork.new()
	_mm.network_manager = mock_net
	
	var match_data = {"match_id": "joined_match"}
	mock_net.mock_responses[_mm.RPC_ACCEPT_MATCH] = {
		"success": true,
		"match": match_data
	}
	
	watch_signals(_mm)
	await _mm.accept_match("m123")
	
	assert_signal_emitted(_mm, "match_accepted")
	assert_eq(_mm.current_match["match_id"], "joined_match")
	
	var payload = JSON.parse_string(mock_net.last_payload)
	assert_eq(payload["match_id"], "m123")

# Test: get_player_rank success
func test_get_player_rank_success():
	var mock_net = MockNetwork.new()
	_mm.network_manager = mock_net
	
	mock_net.mock_responses[_mm.RPC_GET_PLAYER_RANK] = {
		"success": true,
		"rank": 1200
	}
	
	watch_signals(_mm)
	await _mm.get_player_rank()
	
	assert_signal_emitted(_mm, "rank_retrieved")
	assert_eq(_mm.player_rank, 1200)

# Test: complete_match triggers settlement (win, server-declared)
func test_complete_match_win():
	var mock_net = MockNetwork.new()
	mock_net.user_id = "me"
	_mm.network_manager = mock_net
	_mm.current_match = {"match_id": "m1"}

	mock_net.mock_responses[_mm.RPC_COMPLETE_MATCH] = {
		"success": true,
		"winner": {"user_id": "me", "new_rank": 1100},
		"loser": {"user_id": "opponent", "new_rank": 900},
		"is_punch_up": true
	}

	watch_signals(_mm)
	await _mm.complete_match(true)

	assert_signal_emitted(_mm, "match_completed")
	assert_signal_emitted(_mm, "punch_up_stats_updated")
	assert_eq(_mm.player_rank, 1100)
	assert_eq(_mm.punch_up_wins, 1)
	assert_true(_mm.current_match.is_empty(), "Current match should be cleared")

	# Trigger-only payload: no winner/loser assertion is sent (issue #862)
	var payload = JSON.parse_string(mock_net.last_payload)
	assert_eq(payload["match_id"], "m1")
	assert_true(payload["is_punch_up"])
	assert_false(payload.has("winner_id"), "Payload must not assert a winner")
	assert_false(payload.has("loser_id"), "Payload must not assert a loser")

# Test: complete_match outcome comes from the server declaration (loss)
func test_complete_match_loss():
	var mock_net = MockNetwork.new()
	mock_net.user_id = "me"
	_mm.network_manager = mock_net
	_mm.current_match = {"match_id": "m1"}

	# Server declares the OPPONENT the winner; the client sent no claim
	mock_net.mock_responses[_mm.RPC_COMPLETE_MATCH] = {
		"success": true,
		"winner": {"user_id": "opponent", "new_rank": 1100},
		"loser": {"user_id": "me", "new_rank": 950},
		"is_punch_up": true
	}

	watch_signals(_mm)
	await _mm.complete_match(true)

	assert_signal_emitted(_mm, "match_completed")
	assert_signal_emitted(_mm, "punch_up_stats_updated")
	assert_eq(_mm.player_rank, 950)
	assert_eq(_mm.punch_up_losses, 1)

	# Victory must be derived from the server-declared winner
	var params = get_signal_parameters(_mm, "match_completed", 0)
	assert_false(params[0]["is_victory"], "Victory must come from server declaration")
	assert_eq(params[0]["winner_id"], "opponent")

# Test: complete_match handles a server-declared draw
func test_complete_match_draw():
	var mock_net = MockNetwork.new()
	mock_net.user_id = "me"
	_mm.network_manager = mock_net
	_mm.current_match = {"match_id": "m1"}

	mock_net.mock_responses[_mm.RPC_COMPLETE_MATCH] = {
		"success": true,
		"match": {},
		"is_draw": true,
		"end_reason": "draw"
	}

	watch_signals(_mm)
	await _mm.complete_match(false)

	var draw_params = get_signal_parameters(_mm, "match_completed", 0)
	assert_true(draw_params[0].get("is_draw", false), "Draw should be reported")
	assert_true(_mm.current_match.is_empty(), "Current match should be cleared")

# Test: Utility methods
func test_utilities():
	_mm.available_matches = [{"id": 1}]
	_mm.current_match = {"id": 2, "status": "active"}
	_mm.player_rank = 1000
	
	assert_eq(_mm.get_available_matches().size(), 1)
	assert_eq(_mm.get_current_match()["id"], 2)
	assert_eq(_mm.get_player_rank_sync(), 1000)
	assert_true(_mm.is_in_match())
	
	_mm.current_match = {"status": "completed"}
	assert_false(_mm.is_in_match())

# Test: Punch Up stats calculation
func test_punch_up_stats_calc():
	_mm.punch_up_wins = 3
	_mm.punch_up_losses = 1
	
	assert_eq(_mm.get_punch_up_wins(), 3)
	assert_eq(_mm.get_punch_up_losses(), 1)
	assert_eq(_mm.get_punch_up_total_matches(), 4)
	assert_almost_eq(_mm.get_punch_up_win_rate(), 0.75, 0.01)
	
	_mm.punch_up_wins = 0
	_mm.punch_up_losses = 0
	assert_eq(_mm.get_punch_up_win_rate(), 0.0)

# Test: Error cases
func test_error_cases():
	var mock_net = MockNetwork.new()
	_mm.network_manager = mock_net
	
	# Invalid create_match type
	await _mm.create_match("invalid")
	assert_eq(mock_net.last_rpc_id, "", "Should not send RPC for invalid match type")
	
	# Empty accept_match id
	await _mm.accept_match("")
	assert_eq(mock_net.last_rpc_id, "", "Should not send RPC for empty match id")
	
	# No active match for complete_match
	_mm.current_match = {}
	await _mm.complete_match(false)
	assert_eq(mock_net.last_rpc_id, "", "Should not send RPC when no active match")

# Test: No network
func test_no_network():
	_mm.network_manager = null
	# Should not crash
	await _mm.list_matches()
	await _mm.create_match("ranked")
	await _mm.accept_match("m")
	await _mm.get_player_rank()
	await _mm.complete_match()
	assert_true(true, "Should handle null network manager")
