extends GutTest

var PlayerStatsManagerClass = load("res://autoloads/PlayerStatsManager.gd")
var _player

# Mock NetworkManager for testing RPCs
class MockNetwork:
	extends Node
	var is_server_connected: bool = true
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
	_player = PlayerStatsManagerClass.new()
	add_child_autofree(_player)

# Called after each test
func after_each():
	_player = null

# Test: Initial state should be empty and not initialized
func test_initial_state():
	assert_true(_player.player_stats.is_empty(), "Initial player_stats should be empty")
	assert_false(_player.is_initialized, "Initial is_initialized should be false")

# Test: RPC constants are properly defined
func test_rpc_constants():
	assert_eq(_player.RPC_GAIN_XP, "armored_archer/gain_xp", "RPC_GAIN_XP should match")
	assert_eq(_player.RPC_ALLOCATE_STATS, "armored_archer/allocate_stats", "RPC_ALLOCATE_STATS should match")
	assert_eq(_player.RPC_GET_PLAYER_STATS, "armored_archer/get_player_stats", "RPC_GET_PLAYER_STATS should match")

# Test: get_level returns default value
func test_get_level_default():
	assert_eq(_player.get_level(), 1, "Default level should be 1")

# Test: get_level returns value from player_stats
func test_get_level_with_stats():
	_player.player_stats = {"level": 10, "xp": 500}
	assert_eq(_player.get_level(), 10, "Level should be 10")

# Test: get_xp returns default value
func test_get_xp_default():
	assert_eq(_player.get_xp(), 0, "Default XP should be 0")

# Test: get_xp returns value from player_stats
func test_get_xp_with_stats():
	_player.player_stats = {"level": 1, "xp": 250}
	assert_eq(_player.get_xp(), 250, "XP should be 250")

# Test: get_ability_points returns default value
func test_get_ability_points_default():
	assert_eq(_player.get_ability_points(), 0, "Default ability points should be 0")

# Test: get_ability_points returns value from player_stats
func test_get_ability_points_with_stats():
	_player.player_stats = {"level": 5, "xp": 100, "ability_points": 3}
	assert_eq(_player.get_ability_points(), 3, "Ability points should be 3")

# Test: get_stat returns default for missing stat
func test_get_stat_default():
	assert_eq(_player.get_stat("attack"), 0, "Default stat should be 0")

# Test: get_stat returns value from player_stats
func test_get_stat_with_stats():
	_player.player_stats = {"stats": {"attack": 15, "defense": 10}}
	assert_eq(_player.get_stat("attack"), 15, "Attack stat should be 15")
	assert_eq(_player.get_stat("defense"), 10, "Defense stat should be 10")

# Test: get_attack calculates total attack
func test_get_attack_default():
	assert_eq(_player.get_attack(), 0, "Default attack should be 0")

# Test: get_attack includes base + stat bonus
func test_get_attack_with_stats():
	_player.player_stats = {"stats": {"attack": 15}}
	assert_eq(_player.get_attack(), 15, "Attack should include stat bonus")

# Test: get_defense calculates total defense
func test_get_defense_default():
	assert_eq(_player.get_defense(), 0, "Default defense should be 0")

# Test: get_defense includes base + stat bonus
func test_get_defense_with_stats():
	_player.player_stats = {"stats": {"defense": 10}}
	assert_eq(_player.get_defense(), 10, "Defense should include stat bonus")

# Test: get_dodge calculates total dodge
func test_get_dodge_default():
	assert_eq(_player.get_dodge(), 0, "Default dodge should be 0")

# Test: get_dodge includes base + stat bonus
func test_get_dodge_with_stats():
	_player.player_stats = {"stats": {"dodge": 5}}
	assert_eq(_player.get_dodge(), 5, "Dodge should include stat bonus")

# Test: get_crit_rate calculates total crit rate
func test_get_crit_rate_default():
	assert_eq(_player.get_crit_rate(), 0, "Default crit rate should be 0")

# Test: get_crit_rate includes base + stat bonus
func test_get_crit_rate_with_stats():
	_player.player_stats = {"stats": {"crit_rate": 15}}
	assert_eq(_player.get_crit_rate(), 15, "Crit rate should include stat bonus")

# Test: gain_xp with invalid amount (<= 0)
func test_gain_xp_invalid_amount():
	var mock_net = MockNetwork.new()
	_player.network_manager = mock_net
	
	_player.gain_xp(0, "test")
	# Consume expected push_error from PlayerStatsManager.gain_xp (issue #1361 follow-up).
	assert_push_error("Invalid XP amount")
	assert_eq(mock_net.last_rpc_id, "", "Should not send RPC for 0 XP")

	_player.gain_xp(-100, "test")
	# Consume expected push_error from PlayerStatsManager.gain_xp (issue #1361 follow-up).
	assert_push_error("Invalid XP amount")
	assert_eq(mock_net.last_rpc_id, "", "Should not send RPC for negative XP")

# Test: gain_xp requires network connection
func test_gain_xp_no_network():
	pending("ENV_DEPENDENT: requires live Nakama on 127.0.0.1:7350; see issue #960")
	return
	_player.network_manager = null
	_player.gain_xp(100, "test")
	assert_true(true, "Should handle null network manager gracefully")

# Test: allocate_stat with invalid points (<= 0)
func test_allocate_stat_invalid_points():
	var mock_net = MockNetwork.new()
	_player.network_manager = mock_net
	
	_player.allocate_stat("attack", 0)
	# Consume expected push_error from PlayerStatsManager.allocate_stat (issue #1361 follow-up).
	assert_push_error("Invalid points amount")
	assert_eq(mock_net.last_rpc_id, "", "Should not send RPC for 0 points")

	_player.allocate_stat("attack", -1)
	# Consume expected push_error from PlayerStatsManager.allocate_stat (issue #1361 follow-up).
	assert_push_error("Invalid points amount")
	assert_eq(mock_net.last_rpc_id, "", "Should not send RPC for negative points")

# Test: allocate_stat requires network connection
func test_allocate_stat_no_network():
	pending("ENV_DEPENDENT: requires live Nakama on 127.0.0.1:7350; see issue #960")
	return
	_player.network_manager = null
	_player.allocate_stat("attack", 1)
	assert_true(true, "Should handle null network manager gracefully")

# Test: get_player_stats requires network connection
func test_get_player_stats_no_network():
	pending("ENV_DEPENDENT: requires live Nakama on 127.0.0.1:7350; see issue #960")
	return
	_player.network_manager = null
	var result = await _player.get_player_stats()
	assert_true(result.is_empty(), "Should return empty dict when no network")

# Test: stats_updated signal is emitted when stats change
func test_stats_updated_signal():
	# Issue #1361 follow-up: production PlayerStatsManager emits `stats_updated`
	# only via the RPC methods (load_player_stats, gain_xp, allocate_stats,
	# respec_stats). Direct assignment to `player_stats` does not emit it.
	pending("Direct `player_stats =` does not emit stats_updated in production (issue #1361 follow-up)")
	return
	watch_signals(_player)
	_player.player_stats = {"stats": {"attack": 15}}
	assert_signal_emitted(_player, "stats_updated", "stats_updated signal should be emitted")

# Test: xp_gained signal is emitted when XP is gained
func test_xp_gained_signal():
	var mock_net = MockNetwork.new()
	_player.network_manager = mock_net
	mock_net.mock_responses[_player.RPC_GAIN_XP] = {
		"success": true,
		"xp_gained": 100,
		"player_stats": {"level": 1, "xp": 100}
	}
	
	watch_signals(_player)
	await _player.gain_xp(100, "test")
	assert_signal_emitted(_player, "xp_gained", "xp_gained signal should be emitted")
	assert_eq(_player.get_xp(), 100, "XP should be updated")

# Test: level_up signal is emitted when level increases
func test_level_up_signal():
	var mock_net = MockNetwork.new()
	_player.network_manager = mock_net
	mock_net.mock_responses[_player.RPC_GAIN_XP] = {
		"success": true,
		"xp_gained": 1000,
		"levels_gained": 1,
		"player_stats": {"level": 2, "xp": 1000}
	}
	
	watch_signals(_player)
	await _player.gain_xp(1000, "test")
	assert_signal_emitted(_player, "level_up", "level_up signal should be emitted")
	assert_eq(_player.get_level(), 2, "Level should be 2")

# Test: stat_allocated signal is emitted when stat is allocated
func test_stat_allocated_signal():
	var mock_net = MockNetwork.new()
	_player.network_manager = mock_net
	mock_net.mock_responses[_player.RPC_ALLOCATE_STATS] = {
		"success": true,
		"player_stats": {"level": 1, "stats": {"attack": 5}}
	}
	
	watch_signals(_player)
	await _player.allocate_stat("attack", 5)
	assert_signal_emitted(_player, "stat_allocated", "stat_allocated signal should be emitted")
	assert_eq(_player.get_attack(), 5, "Attack should be updated")

# Test: is_initialized defaults to false
func test_is_initialized_default():
	assert_false(_player.is_initialized, "is_initialized should default to false")

# Test: get_player_stats success
func test_get_player_stats_success():
	var mock_net = MockNetwork.new()
	_player.network_manager = mock_net
	var test_stats = {"level": 5, "xp": 500, "stats": {"attack": 10}}
	mock_net.mock_responses[_player.RPC_GET_PLAYER_STATS] = test_stats
	
	watch_signals(_player)
	var result = await _player.get_player_stats()
	
	assert_eq(result, test_stats, "Should return stats from RPC")
	assert_eq(_player.player_stats, test_stats, "Internal stats should be updated")
	assert_true(_player.is_initialized, "Should be initialized")
	assert_signal_emitted(_player, "stats_updated")

# Test: get_player_stats error
func test_get_player_stats_error():
	var mock_net = MockNetwork.new()
	_player.network_manager = mock_net
	mock_net.mock_responses[_player.RPC_GET_PLAYER_STATS] = {"error": "Internal error"}

	# Issue #1361 follow-up: production pushes an error log on RPC failure.
	# Call first, then consume the error so it doesn't count as an unexpected error.
	var result = await _player.get_player_stats()
	assert_push_error("Failed to get player stats: Internal error")
	assert_true(result.is_empty(), "Should return empty on RPC error")
	assert_false(_player.is_initialized, "Should not be initialized on error")

# Test: gain_xp error response
func test_gain_xp_error():
	var mock_net = MockNetwork.new()
	_player.network_manager = mock_net
	mock_net.mock_responses[_player.RPC_GAIN_XP] = {"error": "Server error"}

	# Issue #1361 follow-up: production pushes an error log on RPC failure.
	# Call first, then consume the error so it doesn't count as an unexpected error.
	watch_signals(_player)
	await _player.gain_xp(100, "pve")
	assert_push_error("Failed to gain XP: Server error")
	assert_signal_emit_count(_player, "xp_gained", 0)

# Test: allocate_stat error response
func test_allocate_stat_error():
	var mock_net = MockNetwork.new()
	_player.network_manager = mock_net
	mock_net.mock_responses[_player.RPC_ALLOCATE_STATS] = {"error": "No points"}

	# Issue #1361 follow-up: production pushes an error log on RPC failure.
	# Call first, then consume the error so it doesn't count as an unexpected error.
	watch_signals(_player)
	await _player.allocate_stat("attack", 1)
	assert_push_error("Failed to allocate stat: No points")
	assert_signal_emit_count(_player, "stat_allocated", 0)
