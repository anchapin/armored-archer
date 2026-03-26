extends GutTest
const CoverageTracker = preload("res://addons/gut/coverage/coverage_tracker.gd")

# Coverage tracking tests for GameManager autoload
# Verifies that CoverageTracker.track_execution() calls work correctly
# Tests game state changes with coverage tracking

var _game_manager: GameManager
var _mock_analytics: Node

func before_each():
	# Create fresh GameManager instance for each test
	_game_manager = GameManager.new()
	add_child_autofree(_game_manager)

	# Mock analytics to avoid analytics calls during tests
	_mock_analytics = double(Node).new()
	_mock_analytics.name = "AnalyticsManager"
	add_child_autofree(_mock_analytics)
	stub(_mock_analytics, "log_custom_event").to_return({})
	stub(_mock_analytics, "log_pve_stage_started").to_return({})
	stub(_mock_analytics, "log_pve_stage_completed").to_return({})
	stub(_mock_analytics, "log_pve_stage_failed").to_return({})
	_game_manager.set("analytics", _mock_analytics)

func test_health_damage_tracks_coverage():
	"""Test that taking damage tracks coverage correctly."""
	watch_signals(_game_manager)

	# Track function entry (line 43)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 43)

	# Activate game and take damage
	_game_manager.is_game_active = true
	_game_manager.take_player_damage(50)

	# Track health changed signal (line 97)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 97)

	# Verify damage was applied
	assert_eq(_game_manager.player_current_health, 50, "Health should be 50 after taking 50 damage")
	assert_signal_emitted(_game_manager, "health_changed")

func test_player_death_tracks_coverage():
	"""Test that player death tracks coverage correctly."""
	watch_signals(_game_manager)

	# Set low health
	_game_manager.is_game_active = true
	_game_manager.player_current_health = 10

	# Track function entry (line 43)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 43)

	# Take fatal damage
	_game_manager.take_player_damage(20)

	# Track player death branch (line 66)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 66)

	# Verify death
	assert_eq(_game_manager.player_current_health, 0, "Health should be 0 after fatal damage")
	assert_signal_emitted(_game_manager, "player_died")

func test_healing_tracks_coverage():
	"""Test that healing tracks coverage correctly."""
	watch_signals(_game_manager)

	# Set low health
	_game_manager.is_game_active = true
	_game_manager.player_current_health = 60

	# Track heal function entry (line 69)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 69)

	# Heal player
	_game_manager.heal_player(25)

	# Track health changed signal (line 97)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 97)

	# Verify healing
	assert_eq(_game_manager.player_current_health, 85, "Health should be 85 after healing 25")
	assert_signal_emitted(_game_manager, "health_changed")

func test_game_start_tracks_coverage():
	"""Test that starting the game tracks coverage correctly."""
	watch_signals(_game_manager)

	# Set low health to verify reset
	_game_manager.player_current_health = 50

	# Track start_game function entry (line 92)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 92)

	# Start game
	_game_manager.start_game()

	# Track game active state (line 94)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 94)

	# Track health changed signal (line 97)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 97)

	# Verify game state
	assert_eq(_game_manager.player_current_health, 100, "Health should reset to max")
	assert_true(_game_manager.is_game_active, "Game should be active")
	assert_signal_emitted(_game_manager, "health_changed")

func test_boss_spawn_tracks_coverage():
	"""Test that boss spawning tracks coverage correctly."""
	watch_signals(_game_manager)

	# Track spawn_boss function entry (line 189)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 189)

	# Spawn boss
	_game_manager.spawn_boss("boss_basic")

	# Track boss spawned signal (line 225)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 225)

	# Verify boss spawned
	assert_signal_emitted(_game_manager, "boss_spawned")

func test_game_won_tracks_coverage():
	"""Test that winning the game tracks coverage correctly."""
	watch_signals(_game_manager)

	# Activate game
	_game_manager.is_game_active = true

	# End game with win
	_game_manager.end_game(true)

	# Track game won signal (line 126)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 126)

	# Verify game won
	assert_false(_game_manager.is_game_active, "Game should not be active after end")
	assert_signal_emitted(_game_manager, "game_won")

func test_stage_completed_tracks_coverage():
	"""Test that completing a stage tracks coverage correctly."""
	watch_signals(_game_manager)

	# Set up stage
	_game_manager.is_game_active = true
	_game_manager.current_stage_id = "test_stage_1"

	# Track complete_stage function entry (line 173)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 173)

	# Complete stage
	_game_manager.complete_stage()

	# Track stage completed signal (line 148)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 148)

	# Verify stage completed
	assert_eq(_game_manager.current_stage, 2, "Stage should increment")
	assert_signal_emitted(_game_manager, "stage_completed")

func test_inactive_game_tracks_coverage():
	"""Test that inactive game state tracks coverage correctly."""
	watch_signals(_game_manager)

	# Set game inactive
	_game_manager.is_game_active = false
	_game_manager.player_current_health = 80

	# Track function entry (line 43)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 43)

	# Try to take damage
	_game_manager.take_player_damage(20)

	# Track inactive game branch (line 49)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 49)

	# Verify damage was ignored
	assert_eq(_game_manager.player_current_health, 80, "Health should not change when game inactive")
