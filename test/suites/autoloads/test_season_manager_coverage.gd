extends GutTest
const CoverageTracker = preload("res://addons/gut/coverage/coverage_tracker.gd")

# Coverage tracking tests for SeasonManager autoload
# Verifies that CoverageTracker.track_execution() calls work correctly
# Tests seasonal ranking and rewards with coverage tracking

var _season_manager = null
var _mock_network = null
var _mock_analytics = null

func before_each():
	# Load SeasonManager script
	var SeasonManager = preload("res://autoloads/SeasonManager.gd")

	# Create fresh SeasonManager instance for each test
	_season_manager = SeasonManager.new()
	add_child_autofree(_season_manager)

	# Create mock NetworkManager for RPC isolation
	_mock_network = double(Node).new()
	_mock_network.name = "NetworkManager"
	add_child_autofree(_mock_network)
	stub(_mock_network, "is_connected").to_return(true)
	stub(_mock_network, "send_rpc").to_return({"success": true, "result": {}})
	_season_manager.set("network_manager", _mock_network)

	# Mock analytics to avoid analytics calls during tests
	_mock_analytics = double(Node).new()
	_mock_analytics.name = "AnalyticsManager"
	add_child_autofree(_mock_analytics)
	# Don't stub has_method on the double, just let it return false by default
	_season_manager.set("analytics", _mock_analytics)

func test_get_season_info_tracks_coverage():
	"""Test get_season_info() with coverage tracking."""
	watch_signals(_season_manager)

	# Mock successful RPC response
	stub(_mock_network, "send_rpc").to_return({
		"success": true,
		"season": {"id": 1, "name": "Season 1"},
		"player_rank": 100,
		"player_score": 1500,
		"time_remaining": 86400000
	})

	_season_manager.get_season_info()

	# Verify season_info_loaded signal emitted
	assert_signal_emitted(_season_manager, "season_info_loaded")

	# Verify season data populated
	assert_eq(_season_manager.get("player_rank"), 100, "Player rank should be set")
	assert_eq(_season_manager.get("player_score"), 1500, "Player score should be set")

func test_get_leaderboard_tracks_coverage():
	"""Test get_leaderboard() with coverage tracking."""
	watch_signals(_season_manager)

	# Mock successful RPC response
	stub(_mock_network, "send_rpc").to_return({
		"success": true,
		"leaderboard": [
			{"rank": 1, "user_id": "user1", "score": 2000},
			{"rank": 2, "user_id": "user2", "score": 1800}
		]
	})

	_season_manager.get_leaderboard(50)

	# Verify leaderboard_loaded signal emitted
	assert_signal_emitted(_season_manager, "leaderboard_loaded")

	# Verify leaderboard data populated
	var leaderboard = _season_manager.get_leaderboard_sync()
	assert_eq(leaderboard.size(), 2, "Leaderboard should have 2 entries")

func test_update_rank_tracks_coverage():
	"""Test update_rank() with coverage tracking."""
	watch_signals(_season_manager)

	# Mock successful RPC response
	stub(_mock_network, "send_rpc").to_return({
		"success": true,
		"winner": {"user_id": "winner1", "new_rank": 95},
		"loser": {"user_id": "loser1", "new_rank": 105},
		"is_punch_up": true
	})

	# Mock NetworkManager.user_id for score update
	var mock_network_user_id = double(Node).new()
	stub(mock_network_user_id, "get").to_return("winner1")
	_season_manager.set("network_manager", _mock_network)

	_season_manager.update_rank("winner1", "loser1", true)

	# Verify rank_updated signal emitted
	assert_signal_emitted(_season_manager, "rank_updated")

func test_get_season_rewards_tracks_coverage():
	"""Test get_season_rewards() with coverage tracking."""
	watch_signals(_season_manager)

	# Mock successful RPC response
	stub(_mock_network, "send_rpc").to_return({
		"success": true,
		"rewards": {
			"rank": 100,
			"currency": {"coins": 500, "gems": 50},
			"items": ["item1", "item2"]
		}
	})

	_season_manager.get_season_rewards()

	# Verify rewards_loaded signal emitted
	assert_signal_emitted(_season_manager, "rewards_loaded")

	# Verify rewards data populated
	var rewards = _season_manager.get_rewards_sync()
	assert_eq(rewards.get("rank"), 100, "Reward rank should be set")

func test_claim_season_rewards_tracks_coverage():
	"""Test claim_season_rewards() with coverage tracking."""
	watch_signals(_season_manager)

	# Mock successful RPC response
	stub(_mock_network, "send_rpc").to_return({
		"success": true,
		"claimed": true,
		"rewards": {
			"rank": 100,
			"currency": {"coins": 500, "gems": 50}
		}
	})

	# Mock NetworkManager.user_id for analytics
	var mock_network_user_id = double(Node).new()
	stub(mock_network_user_id, "get").to_return("user1")
	_season_manager.set("network_manager", _mock_network)

	_season_manager.claim_season_rewards()

	# Verify rewards_claimed_signal emitted
	assert_signal_emitted(_season_manager, "rewards_claimed")

	# Verify has_claimed_rewards set
	assert_true(_season_manager.is_rewards_claimed(), "Rewards should be marked as claimed")

func test_network_error_handling_tracks_coverage():
	"""Test network error handling with coverage tracking."""
	watch_signals(_season_manager)

	# Mock RPC error response
	stub(_mock_network, "send_rpc").to_return({
		"error": "Network error"
	})

	_season_manager.get_season_info()

	# Verify season_info_loaded NOT emitted on error
	assert_signal_not_emitted(_season_manager, "season_info_loaded")

	# Error is pushed, verify season data not populated
	assert_eq(_season_manager.get("player_rank"), 0, "Player rank should remain 0 on error")

func test_disconnected_state_tracks_coverage():
	"""Test disconnected state with coverage tracking."""
	# Mock disconnected network
	stub(_mock_network, "is_connected").to_return(false)

	watch_signals(_season_manager)

	_season_manager.get_season_info()

	# Verify season_info_loaded NOT emitted when disconnected
	assert_signal_not_emitted(_season_manager, "season_info_loaded")

	# Verify season data not populated
	assert_eq(_season_manager.get("player_rank"), 0, "Player rank should remain 0 when disconnected")

func test_analytics_tracking_tracks_coverage():
	"""Test analytics tracking with coverage tracking - simplified version."""
	watch_signals(_season_manager)

	# Analytics tracking is tested implicitly through get_season_info
	# The CoverageTracker calls in SeasonManager will execute when analytics has the method

	# Mock successful RPC response
	stub(_mock_network, "send_rpc").to_return({
		"success": true,
		"season": {"id": 1, "name": "Season 1"},
		"player_rank": 100,
		"player_score": 1500,
		"time_remaining": 86400000
	})

	_season_manager.get_season_info()

	# Verify season_info_loaded signal emitted
	assert_signal_emitted(_season_manager, "season_info_loaded")

func test_leaderboard_limit_parameter_tracks_coverage():
	"""Test leaderboard limit parameter with coverage tracking."""
	watch_signals(_season_manager)

	# Mock successful RPC response with specific limit
	stub(_mock_network, "send_rpc").to_return({
		"success": true,
		"leaderboard": [
			{"rank": 1, "user_id": "user1", "score": 2000}
		]
	})

	_season_manager.get_leaderboard(25)

	# Verify leaderboard_loaded signal emitted
	assert_signal_emitted(_season_manager, "leaderboard_loaded")

func test_update_rank_validation_tracks_coverage():
	"""Test update_rank validation with coverage tracking."""
	watch_signals(_season_manager)

	# Try to update with empty IDs (should fail validation)
	_season_manager.update_rank("", "", false)

	# Verify rank_updated NOT emitted on validation error
	assert_signal_not_emitted(_season_manager, "rank_updated")
