extends GutTest

## Unit tests for MatchmakingPoolManager
## Tests rating-based pool matching, bracket expansion, and queue management

var matchmaking_pool_manager: Node
var matchmaking_pool_manager_script: Resource

func before_each():
	# Load MatchmakingPoolManager script
	matchmaking_pool_manager_script = preload("res://autoloads/MatchmakingPoolManager.gd")

	# Create MatchmakingPoolManager instance
	matchmaking_pool_manager = matchmaking_pool_manager_script.new()
	# Set up as if it were autoload
	matchmaking_pool_manager.name = "MatchmakingPoolManager"
	# Set up mock network manager
	var mock_network = Node.new()
	mock_network.name = "NetworkManager"
	matchmaking_pool_manager._network_manager = mock_network
	matchmaking_pool_manager._player_rating_manager = null
	add_child(matchmaking_pool_manager)
	add_child(mock_network)

func after_each():
	if matchmaking_pool_manager:
		matchmaking_pool_manager.queue_free()

## Test initial rating bracket size
func test_initial_rating_bracket_100():
	# Test that initial bracket size is 100
	var initial_bracket = matchmaking_pool_manager.INITIAL_BRACKET_SIZE
	assert_eq(initial_bracket, 100, "Initial bracket size should be 100")

## Test bracket expansion over time
func test_bracket_expansion_over_time():
	# Test bracket expansion at different wait times
	var mode = matchmaking_pool_manager.MatchMode.ONE_V_ONE

	# Not in queue - should return initial bracket
	var bracket_not_in_queue = matchmaking_pool_manager.get_current_bracket_size(mode)
	assert_eq(bracket_not_in_queue, 100, "Bracket should be 100 when not in queue")

	# Simulate being in queue for different times
	matchmaking_pool_manager._in_queue[mode] = true
	var now = Time.get_unix_time_from_system()

	# 0 seconds - initial bracket
	matchmaking_pool_manager._queue_join_time[mode] = now
	var bracket_0s = matchmaking_pool_manager.get_current_bracket_size(mode)
	assert_eq(bracket_0s, 100, "Bracket should be 100 at 0 seconds")

	# 30 seconds - expanded bracket
	matchmaking_pool_manager._queue_join_time[mode] = now - 30
	var bracket_30s = matchmaking_pool_manager.get_current_bracket_size(mode)
	assert_eq(bracket_30s, 200, "Bracket should expand to 200 at 30 seconds")

	# 60 seconds - wide bracket
	matchmaking_pool_manager._queue_join_time[mode] = now - 60
	var bracket_60s = matchmaking_pool_manager.get_current_bracket_size(mode)
	assert_eq(bracket_60s, 300, "Bracket should expand to 300 at 60 seconds")

	# 90 seconds - any rating
	matchmaking_pool_manager._queue_join_time[mode] = now - 90
	var bracket_90s = matchmaking_pool_manager.get_current_bracket_size(mode)
	assert_eq(bracket_90s, -1, "Bracket should be -1 (any rating) at 90 seconds")

## Test separate 1v1 and 2v2 pools
func test_separate_1v1_and_2v2_pools():
	# Test that 1v1 and 2v2 modes are tracked separately
	var mode_1v1 = matchmaking_pool_manager.MatchMode.ONE_V_ONE
	var mode_2v2 = matchmaking_pool_manager.MatchMode.TWO_V_TWO

	# Set different states for each mode
	matchmaking_pool_manager._in_queue[mode_1v1] = true
	matchmaking_pool_manager._in_queue[mode_2v2] = false

	assert_true(matchmaking_pool_manager.is_in_queue(mode_1v1), "Should be in 1v1 queue")
	assert_false(matchmaking_pool_manager.is_in_queue(mode_2v2), "Should not be in 2v2 queue")

	# Set different ratings for each mode
	matchmaking_pool_manager._current_rating[mode_1v1] = 1500
	matchmaking_pool_manager._current_rating[mode_2v2] = 1200

	var rating_1v1 = matchmaking_pool_manager.get_current_rating(mode_1v1)
	var rating_2v2 = matchmaking_pool_manager.get_current_rating(mode_2v2)

	assert_eq(rating_1v1, 1500, "1v1 rating should be 1500")
	assert_eq(rating_2v2, 1200, "2v2 rating should be 1200")

## Test queue position accuracy
func test_queue_position_accuracy():
	# Test queue position tracking
	var mode = matchmaking_pool_manager.MatchMode.ONE_V_ONE

	# Set queue position
	matchmaking_pool_manager._queue_position[mode] = 5
	var position = matchmaking_pool_manager.get_queue_position()

	assert_eq(position, 5, "Queue position should be 5")

	# Set estimated wait time
	matchmaking_pool_manager._estimated_wait[mode] = 45.0
	var wait_time = matchmaking_pool_manager.get_estimated_wait()

	assert_eq(wait_time, 45.0, "Estimated wait should be 45.0 seconds")

## Test queue constants are correct
func test_queue_constants():
	# Test that queue constants match expected values
	assert_eq(matchmaking_pool_manager.INITIAL_BRACKET_SIZE, 100, "Initial bracket should be 100")
	assert_eq(matchmaking_pool_manager.EXPANDED_BRACKET_SIZE, 200, "Expanded bracket should be 200")
	assert_eq(matchmaking_pool_manager.WIDE_BRACKET_SIZE, 300, "Wide bracket should be 300")
	assert_eq(matchmaking_pool_manager.EXPANSION_TIME_1, 30.0, "First expansion should be at 30s")
	assert_eq(matchmaking_pool_manager.EXPANSION_TIME_2, 60.0, "Second expansion should be at 60s")
	assert_eq(matchmaking_pool_manager.MAX_WAIT_TIME, 90.0, "Max wait should be 90s")
	assert_eq(matchmaking_pool_manager.UPDATE_INTERVAL, 2.0, "Update interval should be 2s")

## Test is_in_any_queue helper
func test_is_in_any_queue():
	var mode_1v1 = matchmaking_pool_manager.MatchMode.ONE_V_ONE
	var mode_2v2 = matchmaking_pool_manager.MatchMode.TWO_V_TWO

	# Initially not in any queue
	assert_false(matchmaking_pool_manager.is_in_any_queue(), "Should not be in any queue initially")

	# Join 1v1 queue
	matchmaking_pool_manager._in_queue[mode_1v1] = true
	assert_true(matchmaking_pool_manager.is_in_any_queue(), "Should be in 1v1 queue")

	# Leave 1v1, join 2v2
	matchmaking_pool_manager._in_queue[mode_1v1] = false
	matchmaking_pool_manager._in_queue[mode_2v2] = true
	assert_true(matchmaking_pool_manager.is_in_any_queue(), "Should be in 2v2 queue")

	# Leave both queues
	matchmaking_pool_manager._in_queue[mode_2v2] = false
	assert_false(matchmaking_pool_manager.is_in_any_queue(), "Should not be in any queue")

## Test current rating retrieval
func test_get_current_rating():
	var mode_1v1 = matchmaking_pool_manager.MatchMode.ONE_V_ONE
	var mode_2v2 = matchmaking_pool_manager.MatchMode.TWO_V_TWO

	# Default rating should be 1200
	var default_1v1 = matchmaking_pool_manager.get_current_rating(mode_1v1)
	var default_2v2 = matchmaking_pool_manager.get_current_rating(mode_2v2)

	assert_eq(default_1v1, 1200, "Default 1v1 rating should be 1200")
	assert_eq(default_2v2, 1200, "Default 2v2 rating should be 1200")

	# Set custom ratings
	matchmaking_pool_manager._current_rating[mode_1v1] = 1850
	matchmaking_pool_manager._current_rating[mode_2v2] = 1625

	var custom_1v1 = matchmaking_pool_manager.get_current_rating(mode_1v1)
	var custom_2v2 = matchmaking_pool_manager.get_current_rating(mode_2v2)

	assert_eq(custom_1v1, 1850, "Custom 1v1 rating should be 1850")
	assert_eq(custom_2v2, 1625, "Custom 2v2 rating should be 1625")

## Test bracket expansion timing precision
func test_bracket_expansion_timing():
	var mode = matchmaking_pool_manager.MatchMode.ONE_V_ONE
	matchmaking_pool_manager._in_queue[mode] = true
	var now = Time.get_unix_time_from_system()

	# Test boundary conditions

	# 29.9 seconds - should still be initial bracket
	matchmaking_pool_manager._queue_join_time[mode] = now - 29.9
	assert_eq(matchmaking_pool_manager.get_current_bracket_size(mode), 100, "Bracket should be 100 at 29.9s")

	# 30.0 seconds - should expand to 200
	matchmaking_pool_manager._queue_join_time[mode] = now - 30.0
	assert_eq(matchmaking_pool_manager.get_current_bracket_size(mode), 200, "Bracket should be 200 at 30.0s")

	# 59.9 seconds - should still be expanded bracket
	matchmaking_pool_manager._queue_join_time[mode] = now - 59.9
	assert_eq(matchmaking_pool_manager.get_current_bracket_size(mode), 200, "Bracket should be 200 at 59.9s")

	# 60.0 seconds - should expand to 300
	matchmaking_pool_manager._queue_join_time[mode] = now - 60.0
	assert_eq(matchmaking_pool_manager.get_current_bracket_size(mode), 300, "Bracket should be 300 at 60.0s")

## Test active mode tracking
func test_active_mode_tracking():
	var mode_1v1 = matchmaking_pool_manager.MatchMode.ONE_V_ONE
	var mode_2v2 = matchmaking_pool_manager.MatchMode.TWO_V_TWO

	# Default active mode should be 1v1
	assert_eq(matchmaking_pool_manager._active_mode, mode_1v1, "Default active mode should be 1v1")

	# Set 2v2 as active
	matchmaking_pool_manager._active_mode = mode_2v2

	# Queue position should return 2v2 position
	matchmaking_pool_manager._queue_position[mode_1v1] = 10
	matchmaking_pool_manager._queue_position[mode_2v2] = 3

	assert_eq(matchmaking_pool_manager.get_queue_position(), 3, "Queue position should be for active mode")

## Test match mode enum values
func test_match_mode_enum_values():
	assert_eq(matchmaking_pool_manager.MatchMode.ONE_V_ONE, 0, "ONE_V_ONE should be 0")
	assert_eq(matchmaking_pool_manager.MatchMode.TWO_V_TWO, 1, "TWO_V_TWO should be 1")

## Test RPC constants
func test_rpc_constants():
	assert_eq(matchmaking_pool_manager.RPC_JOIN_POOL, "armored_archer/join_matchmaking_pool", "Join pool RPC constant")
	assert_eq(matchmaking_pool_manager.RPC_LEAVE_POOL, "armored_archer/leave_matchmaking_pool", "Leave pool RPC constant")
	assert_eq(matchmaking_pool_manager.RPC_GET_QUEUE_STATUS, "armored_archer/get_queue_status", "Get status RPC constant")
