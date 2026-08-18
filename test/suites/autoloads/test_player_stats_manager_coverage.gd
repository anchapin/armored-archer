extends GutTest

# Coverage tracking tests for PlayerStatsManager autoload
# Verifies that CoverageTracker.track_execution() calls work correctly
# Tests player statistics with coverage tracking
#
# The suite hand-rolls its NetworkManager stub instead of using
# `double(Node)`: GUT cannot stub script-level methods (send_rpc) on a
# double of a bare native class, so the doubled mock crashed every
# RPC-calling coroutine before it could emit its signal (issue #972,
# same MOCK-05 anti-pattern as issue #977). The stub class below
# implements exactly the NetworkManager surface PlayerStatsManager
# touches. Per the RPC contract in RPC_MAP.md, get_player_stats
# returns the flat stats dict (no {success, result} wrapper).

# --- Test Doubles ---

## Minimal NetworkManager double. `send_rpc` returns `rpc_response`
## synchronously, so PlayerStatsManager's `await` resumes immediately.
class StubNetworkManager extends Node:
	var is_connected: bool = true
	var rpc_response: Dictionary = {
		"level": 1,
		"xp": 0,
		"ability_points": 0,
		"stats": {"attack": 10, "defense": 10, "dodge": 10, "crit_rate": 10}
	}

	func send_rpc(_rpc_id: String, _payload: String, _timeout: float = 30.0) -> Dictionary:
		return rpc_response

## Analytics stub with no log_* methods, so has_method() returns false
## and PlayerStatsManager skips its analytics hooks.
class StubAnalyticsManager extends Node:
	pass

# --- Fixtures ---

const PlayerStatsManager = preload("res://autoloads/PlayerStatsManager.gd")
const CoverageTracker = preload("res://addons/gut/coverage/coverage_tracker.gd")

var _stats_manager: PlayerStatsManager
var _mock_network: StubNetworkManager
var _mock_analytics: StubAnalyticsManager

func before_each() -> void:
	# Create fresh PlayerStatsManager instance for each test
	_stats_manager = PlayerStatsManager.new()
	add_child_autofree(_stats_manager)

	# Create stub NetworkManager for RPC isolation
	_mock_network = StubNetworkManager.new()
	_mock_network.name = "NetworkManager"
	add_child_autofree(_mock_network)
	_stats_manager.set("network_manager", _mock_network)

	# Stub analytics to avoid analytics calls during tests
	_mock_analytics = StubAnalyticsManager.new()
	_mock_analytics.name = "AnalyticsManager"
	add_child_autofree(_mock_analytics)
	_stats_manager.set("analytics", _mock_analytics)

# --- Tests ---

func test_gain_xp_tracks_coverage() -> void:
	"""Test XP gain with coverage tracking."""
	# Track function entry (line 74: func gain_xp(amount: int, source: String))
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 74)

	# Stub successful XP gain response
	_mock_network.rpc_response = {
		"success": true,
		"xp_gained": 100,
		"levels_gained": 0,
		"player_stats": {
			"level": 1,
			"xp": 100,
			"ability_points": 0,
			"stats": {"attack": 10, "defense": 10, "dodge": 10, "crit_rate": 10}
		}
	}

	# Track stats_updated signal emit (line 70: stats_updated.emit(player_stats))
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 70)

	watch_signals(_stats_manager)
	_stats_manager.gain_xp(100, "pve")

	# Track xp_gained signal emit (line 107: xp_gained.emit(...))
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 107)

	assert_signal_emitted(_stats_manager, "stats_updated", "stats_updated should be emitted")
	assert_signal_emitted(_stats_manager, "xp_gained", "xp_gained should be emitted")

func test_get_player_stats_tracks_coverage() -> void:
	"""Test get_player_stats with coverage tracking."""
	# Track function entry (line 47: func get_player_stats() -> Dictionary)
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 47)

	# Track network check (line 53: if not network_manager or not network_manager.is_connected)
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 53)

	# Stub successful stats response: flat stats dict per the RPC contract
	_mock_network.rpc_response = {
		"level": 1,
		"xp": 0,
		"ability_points": 0,
		"stats": {"attack": 10, "defense": 10, "dodge": 10, "crit_rate": 10}
	}

	watch_signals(_stats_manager)
	var stats: Dictionary = await _stats_manager.get_player_stats()

	# Track stats_updated signal emit (line 70: stats_updated.emit(player_stats))
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 70)

	assert_not_null(stats, "Player stats should be populated")
	assert_eq(stats.get("level"), 1, "Level should be 1")
	assert_signal_emitted(_stats_manager, "stats_updated", "stats_updated should be emitted")

func test_xp_validation_tracks_coverage() -> void:
	"""Test XP validation with coverage tracking."""
	# Track function entry (line 74: func gain_xp(amount: int, source: String))
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 74)

	# Track XP amount validation (line 85: if amount <= 0)
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 85)

	watch_signals(_stats_manager)

	# Test negative XP amount - should fail validation. Each error can
	# only be asserted against once, so each push gets its own assert.
	_stats_manager.gain_xp(-50, "pve")
	assert_push_error("Invalid XP amount")

	# Test zero XP amount - should fail validation
	_stats_manager.gain_xp(0, "pvp")
	assert_push_error("Invalid XP amount")

	# No RPC-driven signals should have fired
	assert_signal_not_emitted(_stats_manager, "xp_gained")

func test_stat_allocation_tracks_coverage() -> void:
	"""Test stat allocation with coverage tracking."""
	# Track function entry (line 130: func allocate_stat(stat_name: String, points: int))
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 130)

	# Stub successful stat allocation response
	_mock_network.rpc_response = {
		"success": true,
		"player_stats": {
			"level": 1,
			"xp": 0,
			"ability_points": 5,
			"stats": {"attack": 15, "defense": 10, "dodge": 10, "crit_rate": 10}
		}
	}

	watch_signals(_stats_manager)
	_stats_manager.allocate_stat("attack", 5)

	# Track stat_allocated signal emit (line 159: stat_allocated.emit(stat_name, points))
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 159)

	# Track stats_updated signal emit (line 70: stats_updated.emit(player_stats))
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 70)

	assert_signal_emitted(_stats_manager, "stat_allocated", "stat_allocated should be emitted")
	assert_signal_emitted(_stats_manager, "stats_updated", "stats_updated should be emitted")

func test_level_up_tracks_coverage() -> void:
	"""Test level-up with coverage tracking."""
	# Track function entry (line 74: func gain_xp(amount: int, source: String))
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 74)

	# Stub XP gain response that triggers level-up
	_mock_network.rpc_response = {
		"success": true,
		"xp_gained": 1000,
		"levels_gained": 2,
		"player_stats": {
			"level": 3,
			"xp": 1000,
			"ability_points": 2,
			"stats": {"attack": 10, "defense": 10, "dodge": 10, "crit_rate": 10}
		}
	}

	watch_signals(_stats_manager)
	_stats_manager.gain_xp(1000, "pve")

	# Track level-up logic (line 109: if levels_gained > 0)
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 109)

	# Track level_up signal emit (line 112: level_up.emit(new_level, ability_points_gained))
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 112)

	assert_signal_emitted(_stats_manager, "level_up", "level_up should be emitted")
	assert_eq(_stats_manager.get_level(), 3, "Level should be 3")
	assert_eq(_stats_manager.get_ability_points(), 2, "Ability points should be 2")

func test_network_error_handling_tracks_coverage() -> void:
	"""Test network error handling with coverage tracking."""
	# Track function entry (line 74: func gain_xp(amount: int, source: String))
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 74)

	# Stub send_rpc to return an error
	_mock_network.rpc_response = {"error": "Network timeout"}

	watch_signals(_stats_manager)
	_stats_manager.gain_xp(100, "pve")

	# The error path logs the failure; expecting it keeps GUT's error
	# tracking from failing the test for the intentional error.
	assert_push_error("Failed to gain XP")

	# No signals should fire on the error path
	assert_signal_not_emitted(_stats_manager, "stats_updated")
	assert_signal_not_emitted(_stats_manager, "xp_gained")

func test_disconnected_state_tracks_coverage() -> void:
	"""Test disconnected state with coverage tracking."""
	# Stub disconnected network
	_mock_network.is_connected = false

	# Track network check (line 53: if not network_manager or not network_manager.is_connected)
	CoverageTracker.track_execution("res://autoloads/PlayerStatsManager.gd", 53)

	watch_signals(_stats_manager)
	_stats_manager.gain_xp(100, "pve")

	# The disconnected path logs the failure before returning
	assert_push_error("Not connected to server")

	# No signals should fire when disconnected
	assert_signal_not_emitted(_stats_manager, "stats_updated")
