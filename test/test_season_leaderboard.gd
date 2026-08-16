extends GutTest

## Unit tests for Season leaderboard functionality
## Tests leaderboard retrieval, rating decay, and season transitions

var season_manager: Node
var _season_script

func before_each():
	# Load SeasonManager script
	_season_script = preload("res://autoloads/SeasonManager.gd")

	# Create SeasonManager instance
	season_manager = _season_script.new()
	# Set up as if it were autoload
	season_manager.name = "SeasonManager"
	# Set up mock network manager
	var mock_network = Node.new()
	mock_network.name = "NetworkManager"
	mock_network.user_id = "test_user_123"
	season_manager.network_manager = mock_network
	add_child(season_manager)
	add_child(mock_network)

func after_each():
	if season_manager:
		season_manager.queue_free()

## Test leaderboard top 100 retrieval
func test_leaderboard_top_100():
	# Set up a leaderboard with top players
	var test_leaderboard = []
	for i in range(100):
		test_leaderboard.append({
			"player_id": "player_%d" % i,
			"rating": 2000 - (i * 10),
			"wins": 50 - i,
			"losses": i,
			"rank": i + 1
		})

	season_manager.leaderboard = test_leaderboard
	var retrieved = season_manager.get_leaderboard_sync()

	assert_eq(retrieved.size(), 100, "Leaderboard should have 100 entries")
	assert_eq(retrieved[0].rating, 2000, "Top player should have highest rating")

## Test leaderboard sorting by rating
func test_leaderboard_sorting():
	var unsorted_leaderboard = [
		{"player_id": "player_1", "rating": 1500, "rank": 1},
		{"player_id": "player_2", "rating": 1800, "rank": 2},
		{"player_id": "player_3", "rating": 1200, "rank": 3},
		{"player_id": "player_4", "rating": 2000, "rank": 4}
	]

	season_manager.leaderboard = unsorted_leaderboard
	var retrieved = season_manager.get_leaderboard_sync()

	# Top player should be player_4 with rating 2000
	assert_eq(retrieved[0].player_id, "player_4", "Leaderboard should be sorted by rating descending")

## Test rating decay application
func test_rating_decay_applied():
	# Test rating decay for inactive players
	var current_rating: int = 1500
	var now_ms: int = int(Time.get_unix_time_from_system() * 1000)

	# 7 days inactive - should start decay
	var seven_days_ago_ms = now_ms - (7 * 24 * 60 * 60 * 1000)
	var decayed_7_days = season_manager.apply_rating_decay(current_rating, seven_days_ago_ms)

	# Should have minimal decay (0 periods at 7 days)
	assert_true(decayed_7_days < current_rating or decayed_7_days == current_rating, "Rating may decay slightly at 7 days")

	# 14 days inactive - should have 1 period of decay
	var fourteen_days_ago_ms = now_ms - (14 * 24 * 60 * 60 * 1000)
	var decayed_14_days = season_manager.apply_rating_decay(current_rating, fourteen_days_ago_ms)

	assert_true(decayed_14_days < decayed_7_days, "Rating should decay more at 14 days")

	# 30 days inactive - should have higher decay rate
	var thirty_days_ago_ms = now_ms - (30 * 24 * 60 * 60 * 1000)
	var decayed_30_days = season_manager.apply_rating_decay(current_rating, thirty_days_ago_ms)

	assert_true(decayed_30_days < decayed_14_days, "Rating should decay more at 30 days (higher rate)")

	# 45 days inactive - significant decay
	var forty_five_days_ago_ms = now_ms - (45 * 24 * 60 * 60 * 1000)
	var decayed_45_days = season_manager.apply_rating_decay(current_rating, forty_five_days_ago_ms)

	assert_true(decayed_45_days < decayed_30_days, "Rating should decay more at 45 days")

## Test rating decay minimum floor
func test_minimum_rating_floor():
	# Test that rating decay never goes below floor
	var current_rating: int = 1100
	var now_ms: int = int(Time.get_unix_time_from_system() * 1000)

	# 100 days inactive - should hit floor
	var hundred_days_ago_ms = now_ms - (100 * 24 * 60 * 60 * 1000)
	var decayed = season_manager.apply_rating_decay(current_rating, hundred_days_ago_ms)

	assert_eq(decayed, season_manager.MINIMUM_RATING, "Decayed rating should not go below minimum (1000)")

## Test rating decay at minimum rating
func test_rating_decay_at_minimum():
	# Test that players at minimum rating don't decay further
	var current_rating: int = season_manager.MINIMUM_RATING
	var now_ms: int = int(Time.get_unix_time_from_system() * 1000)

	var hundred_days_ago_ms = now_ms - (100 * 24 * 60 * 60 * 1000)
	var decayed = season_manager.apply_rating_decay(current_rating, hundred_days_ago_ms)

	assert_eq(decayed, season_manager.MINIMUM_RATING, "Rating at minimum should stay at minimum")

## Test rating decay constants
func test_rating_decay_constants():
	assert_eq(season_manager.DECAY_INACTIVE_DAYS_THRESHOLD, 7, "Decay threshold should be 7 days")
	assert_eq(season_manager.DECAY_RATE_PERCENT, 1.0, "Decay rate should be 1%")
	assert_eq(season_manager.HIGH_DECAY_THRESHOLD_DAYS, 30, "High decay threshold should be 30 days")
	assert_eq(season_manager.HIGH_DECAY_RATE_PERCENT, 2.0, "High decay rate should be 2%")
	assert_eq(season_manager.MINIMUM_RATING, 1000, "Minimum rating should be 1000")
	assert_eq(season_manager.MAX_DECAY_LOSS, 200, "Max decay loss should be 200")

## Test season duration
func test_season_duration():
	assert_eq(season_manager.SEASON_DURATION_DAYS, 30, "Season should be 30 days")
	assert_eq(season_manager.SEASON_DURATION_MS, 30 * 24 * 60 * 60 * 1000, "Season duration in ms should match")

## Test season reset logic
func test_season_resets_after_30_days():
	# Test that season data resets after duration
	var start_time = int(Time.get_unix_time_from_system() * 1000)
	var end_time = start_time + season_manager.SEASON_DURATION_MS

	season_manager.current_season = {
		"id": "season_1",
		"start_time": start_time,
		"end_time": end_time
	}

	var season = season_manager.get_current_season()
	assert_eq(season.end_time, end_time, "Season end time should be 30 days after start")

	# Simulate season transition
	var new_season_start = end_time
	var new_season = {
		"id": "season_2",
		"start_time": new_season_start,
		"end_time": new_season_start + season_manager.SEASON_DURATION_MS
	}

	season_manager.on_season_transition(season, new_season)

	var current = season_manager.get_current_season()
	assert_eq(current.id, "season_2", "Season should transition to new season")
	assert_eq(season_manager.player_rank, 0, "Player rank should reset")
	assert_eq(season_manager.player_score, 0, "Player score should reset")

## Test get_season_end_time
func test_get_season_end_time():
	var start_time = int(Time.get_unix_time_from_system() * 1000)
	var end_time = start_time + season_manager.SEASON_DURATION_MS

	season_manager.current_season = {
		"id": "season_1",
		"start_time": start_time,
		"end_time": end_time
	}

	var retrieved_end_time = season_manager.get_season_end_time()
	assert_eq(retrieved_end_time, end_time, "End time should match season data")

## Test decay info tracking
func test_decay_info_tracking():
	# Set up season manager with player score
	season_manager.current_season = {
		"id": "season_1",
		"start_time": Time.get_unix_time_from_system() * 1000
	}
	season_manager.player_score = 1500
	season_manager._update_decay_info()

	var decay_info = season_manager.get_decay_info()
	assert_true(decay_info.has("days_inactive"), "Decay info should have days_inactive")
	assert_true(decay_info.has("points_at_risk"), "Decay info should have points_at_risk")
	assert_true(decay_info.has("can_decay"), "Decay info should have can_decay")
	assert_true(decay_info.has("threshold_days"), "Decay info should have threshold_days")
	assert_true(decay_info.has("minimum_rating"), "Decay info should have minimum_rating")

## Test decay info for active player
func test_decay_info_active_player():
	season_manager.current_season = {
		"id": "season_1",
		"start_time": Time.get_unix_time_from_system() * 1000
	}
	season_manager.player_score = 1500
	season_manager._update_decay_info()

	var decay_info = season_manager.get_decay_info()
	assert_false(decay_info.can_decay, "Active player should not be able to decay")
	assert_eq(decay_info.points_at_risk, 0, "Active player should have 0 points at risk")

## Test decay info for inactive player
func test_decay_info_inactive_player():
	# Simulate 14 days inactive
	var now = Time.get_unix_time_from_system() * 1000
	var fourteen_days_ago_ms = now - (14 * 24 * 60 * 60 * 1000)

	season_manager.current_season = {
		"id": "season_1",
		"start_time": now * 1000
	}
	season_manager.player_score = 1500

	# Mock storage to return inactive timestamp
	var mock_storage = Node.new()
	mock_storage.name = "MockStorage"
	mock_storage.set_script(preload("res://test/mocks/mock_storage.gd").new())
	season_manager.network_manager.add_child(mock_storage)
	season_manager.network_manager._storage_sync = mock_storage

	season_manager._update_decay_info()

	var decay_info = season_manager.get_decay_info()
	assert_true(decay_info.days_inactive >= 14, "Player should show as inactive")
	assert_true(decay_info.points_at_risk > 0, "Inactive player should have points at risk")

## Test leaderboard filtering by mode
func test_leaderboard_mode_filtering():
	# Create leaderboard with mixed modes
	var test_leaderboard = []
	for i in range(50):
		test_leaderboard.append({
			"player_id": "player_%d" % i,
			"rating": 2000 - (i * 10),
			"mode": "1v1" if i % 2 == 0 else "2v2",
			"rank": i + 1
		})

	season_manager.leaderboard = test_leaderboard
	var retrieved = season_manager.get_leaderboard_sync()

	# All entries should be present
	assert_eq(retrieved.size(), 50, "All leaderboard entries should be present")

## Test leaderboard with ties
func test_leaderboard_tie_handling():
	var test_leaderboard = [
		{"player_id": "player_1", "rating": 1500, "rank": 1},
		{"player_id": "player_2", "rating": 1500, "rank": 2},
		{"player_id": "player_3", "rating": 1400, "rank": 3}
	]

	season_manager.leaderboard = test_leaderboard
	var retrieved = season_manager.get_leaderboard_sync()

	# Players with same rating should maintain their order
	assert_eq(retrieved[0].player_id, "player_1", "First tied player should be player_1")
	assert_eq(retrieved[1].player_id, "player_2", "Second tied player should be player_2")

## Test player activity tracking
func test_player_activity_tracking():
	season_manager.current_season = {
		"id": "season_1",
		"start_time": Time.get_unix_time_from_system() * 1000
	}
	season_manager.player_score = 1200

	# Initially no activity
	var initial_last_active = season_manager._get_last_active_from_storage()

	# Update activity
	season_manager.update_player_activity()

	var updated_last_active = season_manager._get_last_active_from_storage()

	# Last active should be updated to current time
	assert_true(updated_last_active >= initial_last_active, "Last active should be updated")

## Test season history tracking
func test_season_history_tracking():
	season_manager.season_history = [
		{"season_id": "season_1", "player_rank": 42, "final_rating": 1500},
		{"season_id": "season_2", "player_rank": 25, "final_rating": 1650}
	]

	var history = season_manager.season_history
	assert_eq(history.size(), 2, "Season history should track 2 seasons")
	assert_eq(history[0].player_rank, 42, "First season rank should be 42")
	assert_eq(history[1].player_rank, 25, "Second season rank should be 25")

## Test rank tier thresholds
func test_rank_tier_thresholds():
	assert_eq(season_manager.get_rank_tier(10), "Legendary", "Rank 10 should be Legendary")
	assert_eq(season_manager.get_rank_tier(50), "Epic", "Rank 50 should be Epic")
	assert_eq(season_manager.get_rank_tier(100), "Rare", "Rank 100 should be Rare")
	assert_eq(season_manager.get_rank_tier(500), "Uncommon", "Rank 500 should be Uncommon")
	assert_eq(season_manager.get_rank_tier(1000), "Common", "Rank 1000 should be Common")

## Test season rewards structure
func test_season_rewards_structure():
	var test_rewards = {
		"rank_1": {"gems": 1000, "coins": 5000},
		"rank_2": {"gems": 800, "coins": 4000},
		"rank_3": {"gems": 600, "coins": 3000},
		"rank_10": {"gems": 300, "coins": 1500},
		"rank_50": {"gems": 150, "coins": 750}
	}

	season_manager.season_rewards = test_rewards
	var retrieved = season_manager.get_rewards_sync()

	assert_true(retrieved.has("rank_1"), "Rewards should include rank 1")
	assert_eq(retrieved.rank_1.gems, 1000, "Rank 1 gems should be 1000")

## Test time formatting for seasons
func test_format_time_remaining():
	# Test various time formats
	season_manager.time_remaining = 2 * 24 * 60 * 60 * 1000  # 2 days
	assert_eq(season_manager.format_time_remaining(), "2d 0h", "Should format days correctly")

	season_manager.time_remaining = 3 * 60 * 60 * 1000  # 3 hours
	var hours_format = season_manager.format_time_remaining()
	assert_true("h" in hours_format and "m" in hours_format, "Should format hours and minutes")

	season_manager.time_remaining = 45 * 60 * 1000  # 45 minutes
	assert_eq(season_manager.format_time_remaining(), "45m", "Should format minutes correctly")

## Test season transition signals
func test_season_transition_signal():
	var transition_emitted = false
	var old_season_data = {}
	var new_season_data = {}

	season_manager.season_transitioned.connect(func(old, new):
		transition_emitted = true
		old_season_data = old
		new_season_data = new
	)

	var old_season = {"id": "season_1", "start_time": 0}
	var new_season = {"id": "season_2", "start_time": Time.get_unix_time_from_system() * 1000}

	season_manager.on_season_transition(old_season, new_season)

	await get_tree().process_frame

	assert_true(transition_emitted, "Season transitioned signal should be emitted")
	assert_eq(old_season_data.id, "season_1", "Old season should be passed")
	assert_eq(new_season_data.id, "season_2", "New season should be passed")

## Test RPC constants
func test_rpc_constants():
	assert_eq(season_manager.RPC_GET_SEASON_INFO, "armored_archer/get_season_info", "Get season info RPC constant")
	assert_eq(season_manager.RPC_GET_LEADERBOARD, "armored_archer/get_leaderboard", "Get leaderboard RPC constant")
	assert_eq(season_manager.RPC_UPDATE_RANK, "armored_archer/update_rank", "Update rank RPC constant")
	assert_eq(season_manager.RPC_GET_SEASON_REWARDS, "armored_archer/get_season_rewards", "Get rewards RPC constant")
	assert_eq(season_manager.RPC_CLAIM_SEASON_REWARDS, "armored_archer/claim_season_rewards", "Claim rewards RPC constant")
	assert_eq(season_manager.RPC_GET_SEASON_HISTORY, "armored_archer/get_season_history", "Get history RPC constant")
	assert_eq(season_manager.RPC_GET_PLAYER_RANK, "armored_archer/get_player_rank", "Get player rank RPC constant")
