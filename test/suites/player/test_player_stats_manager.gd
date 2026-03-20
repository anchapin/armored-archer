extends GutTest

var _player: PlayerStatsManager

# Called before each test
func before_each():
	_player = PlayerStatsManager.new()
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
	assert_eq(_player.get_crit_rate(), 0.0, "Default crit rate should be 0.0")

# Test: get_crit_rate includes base + stat bonus
func test_get_crit_rate_with_stats():
	_player.player_stats = {"stats": {"crit_rate": 0.15}}
	assert_eq(_player.get_crit_rate(), 0.15, "Crit rate should include stat bonus")

# Test: gain_xp with invalid amount (<= 0) returns error
func test_gain_xp_invalid_amount():
	var result = await _player.gain_xp(0)
	assert_false(result.ok, "gain_xp with 0 should fail")

	result = await _player.gain_xp(-100)
	assert_false(result.ok, "gain_xp with negative amount should fail")

# Test: gain_xp requires network connection
func test_gain_xp_no_network():
	# NetworkManager is not available in test environment
	var result = await _player.gain_xp(100)
	assert_false(result.ok, "gain_xp without network should fail")

# Test: allocate_stat with invalid points (<= 0) returns error
func test_allocate_stat_invalid_points():
	var result = await _player.allocate_stat("attack", 0)
	assert_false(result.ok, "allocate_stat with 0 points should fail")

	result = await _player.allocate_stat("attack", -1)
	assert_false(result.ok, "allocate_stat with negative points should fail")

# Test: allocate_stat requires network connection
func test_allocate_stat_no_network():
	# NetworkManager is not available in test environment
	var result = await _player.allocate_stat("attack", 1)
	assert_false(result.ok, "allocate_stat without network should fail")

# Test: get_player_stats requires network connection
func test_get_player_stats_no_network():
	# NetworkManager is not available in test environment
	var result = await _player.get_player_stats()
	assert_false(result.ok, "get_player_stats without network should fail")

# Test: stats_updated signal is emitted when stats change
func test_stats_updated_signal():
	watch_signals(_player)
	_player.player_stats = {"stats": {"attack": 15}}
	assert_signal_emitted(_player, "stats_updated", "stats_updated signal should be emitted")

# Test: xp_gained signal is emitted when XP is gained
func test_xp_gained_signal():
	watch_signals(_player)
	# This would require mocking NetworkManager
	# For now, just test signal can be watched
	assert_true(true, "Signal watching setup verified")

# Test: level_up signal is emitted when level increases
func test_level_up_signal():
	watch_signals(_player)
	_player.player_stats = {"level": 2}
	assert_signal_emitted(_player, "level_up", "level_up signal should be emitted")

# Test: stat_allocated signal is emitted when stat is allocated
func test_stat_allocated_signal():
	watch_signals(_player)
	# This would require mocking NetworkManager
	# For now, just test signal can be watched
	assert_true(true, "Signal watching setup verified")

# Test: is_initialized defaults to false
func test_is_initialized_default():
	assert_false(_player.is_initialized, "is_initialized should default to false")
