extends GutTest

# Coverage tracking tests for SeasonManager autoload
# Verifies seasonal ranking and rewards flows with an isolated network stub.
#
# The suite hand-rolls its NetworkManager stub instead of using
# `double(Node)`: GUT cannot stub script-level methods (send_rpc,
# get_storage_sync) on a double of a bare native class, so the doubled
# mock crashed every RPC-calling coroutine before it could emit its
# signal (issue #977). The stub class below implements exactly the
# NetworkManager surface SeasonManager touches.

# --- Test Doubles ---

## Minimal NetworkManager double. `send_rpc` returns `rpc_response`
## synchronously, so SeasonManager's `await` resumes immediately.
class StubNetworkManager extends Node:
	var is_connected: bool = true
	var rpc_response: Dictionary = {"success": true, "result": {}}

	func send_rpc(_rpc_id: String, _payload: String, _timeout: float = 30.0) -> Dictionary:
		return rpc_response

	## SeasonManager._get_last_active_from_storage() calls this; a null
	## storage makes it fall back to "now", exercising the safe path.
	func get_storage_sync() -> Variant:
		return null

## Analytics stub with no log_* methods, so has_method() returns false
## and SeasonManager skips its analytics hooks.
class StubAnalyticsManager extends Node:
	pass

# --- Fixtures ---

const SeasonManagerScript = preload("res://autoloads/SeasonManager.gd")

var _season_manager: Node
var _mock_network: StubNetworkManager
var _mock_analytics: StubAnalyticsManager

func before_each() -> void:
	# Create fresh SeasonManager instance for each test
	_season_manager = SeasonManagerScript.new()
	add_child_autofree(_season_manager)

	# Create stub NetworkManager for RPC isolation
	_mock_network = StubNetworkManager.new()
	_mock_network.name = "NetworkManager"
	add_child_autofree(_mock_network)
	_season_manager.set("network_manager", _mock_network)

	# Stub analytics to avoid analytics calls during tests
	_mock_analytics = StubAnalyticsManager.new()
	_mock_analytics.name = "AnalyticsManager"
	add_child_autofree(_mock_analytics)
	_season_manager.set("analytics", _mock_analytics)

# --- Tests ---

func test_get_season_info_tracks_coverage() -> void:
	"""Test get_season_info() with coverage tracking."""
	watch_signals(_season_manager)

	# Stub successful RPC response
	_mock_network.rpc_response = {
		"success": true,
		"season": {"id": 1, "name": "Season 1"},
		"player_rank": 100,
		"player_score": 1500,
		"time_remaining": 86400000
	}

	_season_manager.get_season_info()

	# Verify season_info_loaded signal emitted
	assert_signal_emitted(_season_manager, "season_info_loaded")

	# Verify season data populated
	assert_eq(_season_manager.get("player_rank"), 100, "Player rank should be set")
	assert_eq(_season_manager.get("player_score"), 1500, "Player score should be set")

func test_get_leaderboard_tracks_coverage() -> void:
	"""Test get_leaderboard() with coverage tracking."""
	watch_signals(_season_manager)

	# Stub successful RPC response
	_mock_network.rpc_response = {
		"success": true,
		"leaderboard": [
			{"rank": 1, "user_id": "user1", "score": 2000},
			{"rank": 2, "user_id": "user2", "score": 1800}
		]
	}

	_season_manager.get_leaderboard(50)

	# Verify leaderboard_loaded signal emitted
	assert_signal_emitted(_season_manager, "leaderboard_loaded")

	# Verify leaderboard data populated
	var leaderboard: Array = _season_manager.get_leaderboard_sync()
	assert_eq(leaderboard.size(), 2, "Leaderboard should have 2 entries")

func test_update_rank_tracks_coverage() -> void:
	"""Test update_rank() with coverage tracking."""
	watch_signals(_season_manager)

	# Stub successful RPC response
	_mock_network.rpc_response = {
		"success": true,
		"winner": {"user_id": "winner1", "new_rank": 95},
		"loser": {"user_id": "loser1", "new_rank": 105},
		"is_punch_up": true
	}

	_season_manager.update_rank("winner1", "loser1", true)

	# Verify rank_updated signal emitted
	assert_signal_emitted(_season_manager, "rank_updated")

func test_get_season_rewards_tracks_coverage() -> void:
	"""Test get_season_rewards() with coverage tracking."""
	watch_signals(_season_manager)

	# Stub successful RPC response
	_mock_network.rpc_response = {
		"success": true,
		"rewards": {
			"rank": 100,
			"currency": {"coins": 500, "gems": 50},
			"items": ["item1", "item2"]
		}
	}

	_season_manager.get_season_rewards()

	# Verify rewards_loaded signal emitted
	assert_signal_emitted(_season_manager, "rewards_loaded")

	# Verify rewards data populated
	var rewards: Dictionary = _season_manager.get_rewards_sync()
	assert_eq(rewards.get("rank"), 100, "Reward rank should be set")

func test_claim_season_rewards_tracks_coverage() -> void:
	"""Test claim_season_rewards() with coverage tracking."""
	watch_signals(_season_manager)

	# Stub successful RPC response
	_mock_network.rpc_response = {
		"success": true,
		"claimed": true,
		"rewards": {
			"rank": 100,
			"currency": {"coins": 500, "gems": 50}
		}
	}

	_season_manager.claim_season_rewards()

	# Verify rewards_claimed signal emitted
	assert_signal_emitted(_season_manager, "rewards_claimed")

	# Verify has_claimed_rewards set
	assert_true(_season_manager.is_rewards_claimed(), "Rewards should be marked as claimed")

func test_network_error_handling_tracks_coverage() -> void:
	"""Test network error handling with coverage tracking."""
	watch_signals(_season_manager)

	# Stub RPC error response
	_mock_network.rpc_response = {
		"error": "Network error"
	}

	_season_manager.get_season_info()

	# The error path logs the failure; expecting it keeps GUT's
	# error tracking from failing the test for the intentional error.
	assert_push_error("Failed to get season info")

	# Verify season_info_loaded NOT emitted on error
	assert_signal_not_emitted(_season_manager, "season_info_loaded")

	# Error is pushed, verify season data not populated
	assert_eq(_season_manager.get("player_rank"), 0, "Player rank should remain 0 on error")

func test_disconnected_state_tracks_coverage() -> void:
	"""Test disconnected state with coverage tracking."""
	# Stub disconnected network
	_mock_network.is_connected = false

	watch_signals(_season_manager)

	_season_manager.get_season_info()

	# The disconnected path logs the failure before returning
	assert_push_error("Not connected to server")

	# Verify season_info_loaded NOT emitted when disconnected
	assert_signal_not_emitted(_season_manager, "season_info_loaded")

	# Verify season data not populated
	assert_eq(_season_manager.get("player_rank"), 0, "Player rank should remain 0 when disconnected")

func test_analytics_tracking_tracks_coverage() -> void:
	"""Test analytics tracking with coverage tracking - simplified version."""
	watch_signals(_season_manager)

	# Analytics tracking is tested implicitly through get_season_info:
	# the analytics stub exposes no log_* methods, so the manager must
	# skip its analytics hooks without erroring.

	# Stub successful RPC response
	_mock_network.rpc_response = {
		"success": true,
		"season": {"id": 1, "name": "Season 1"},
		"player_rank": 100,
		"player_score": 1500,
		"time_remaining": 86400000
	}

	_season_manager.get_season_info()

	# Verify season_info_loaded signal emitted
	assert_signal_emitted(_season_manager, "season_info_loaded")

func test_leaderboard_limit_parameter_tracks_coverage() -> void:
	"""Test leaderboard limit parameter with coverage tracking."""
	watch_signals(_season_manager)

	# Stub successful RPC response with specific limit
	_mock_network.rpc_response = {
		"success": true,
		"leaderboard": [
			{"rank": 1, "user_id": "user1", "score": 2000}
		]
	}

	_season_manager.get_leaderboard(25)

	# Verify leaderboard_loaded signal emitted
	assert_signal_emitted(_season_manager, "leaderboard_loaded")

func test_update_rank_validation_tracks_coverage() -> void:
	"""Test update_rank validation with coverage tracking."""
	watch_signals(_season_manager)

	# Try to update with empty IDs (should fail validation)
	_season_manager.update_rank("", "", false)

	# The validation failure is logged before returning
	assert_push_error("Winner and loser IDs required")

	# Verify rank_updated NOT emitted on validation error
	assert_signal_not_emitted(_season_manager, "rank_updated")
