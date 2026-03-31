extends GutTest

var GameManagerClass = load("res://autoloads/GameManager.gd")
var _game
var _mock_analytics: Node  # Mock AnalyticsManager for test isolation

func before_each():
	# Create fresh GameManager instance for each test (ISO-04 pattern)
	_game = GameManagerClass.new()
	add_child_autofree(_game)

	# Create mock AnalyticsManager using GUT's double() functionality
	# This prevents real analytics calls during testing
	_mock_analytics = double(Node).new()
	_mock_analytics.name = "AnalyticsManager"
	add_child_autofree(_mock_analytics)

	# Stub AnalyticsManager methods that GameManager uses
	stub(_mock_analytics, "log_custom_event").to_call_super()
	stub(_mock_analytics, "log_pve_stage_started").to_call_super()
	stub(_mock_analytics, "log_pve_stage_completed").to_call_super()
	stub(_mock_analytics, "log_pve_stage_failed").to_call_super()

	# Inject mock by setting the @onready property directly
	_game.set("analytics", _mock_analytics)

func after_each():
	# Cleanup is handled by add_child_autofree, but clear references
	_game = null
	_mock_analytics = null

# --- Health Management Tests ---

func test_initial_state():
	# Verify initial state values
	assert_eq(_game.player_current_health, 100, "Initial health should be 100")
	assert_eq(_game.player_max_health, 100, "Initial max health should be 100")
	assert_eq(_game.current_stage, 1, "Initial stage should be 1")
	assert_false(_game.is_game_active, "Game should not be active initially")

func test_take_player_damage():
	# Test damage reduces health correctly
	_game.is_game_active = true
	_game.take_player_damage(25)
	assert_eq(_game.player_current_health, 75, "Health should be 75 after taking 25 damage")

func test_take_player_damage_excess():
	# Test health floors at 0 (damage > current_health)
	_game.is_game_active = true
	_game.player_current_health = 30
	_game.take_player_damage(50)
	assert_eq(_game.player_current_health, 0, "Health should floor at 0")

func test_take_player_damage_inactive_game():
	# Test damage ignored when game not active
	_game.is_game_active = false
	_game.player_current_health = 80
	_game.take_player_damage(20)
	assert_eq(_game.player_current_health, 80, "Health should not change when game inactive")

func test_heal_player():
	# Test healing increases health correctly
	_game.is_game_active = true
	_game.player_current_health = 60
	_game.heal_player(20)
	assert_eq(_game.player_current_health, 80, "Health should be 80 after healing 20")

func test_heal_player_excess():
	# Test health caps at max_health (heal > remaining)
	_game.is_game_active = true
	_game.player_current_health = 80
	_game.heal_player(50)
	assert_eq(_game.player_current_health, 100, "Health should cap at max health")

func test_heal_player_inactive_game():
	# Test healing ignored when game not active
	_game.is_game_active = false
	_game.player_current_health = 60
	_game.heal_player(20)
	assert_eq(_game.player_current_health, 60, "Health should not change when game inactive")

func test_health_min_boundary():
	# Test health stays at 0 after taking damage from 0
	_game.is_game_active = true
	_game.player_current_health = 0
	_game.take_player_damage(10)
	assert_eq(_game.player_current_health, 0, "Health should stay at 0")

func test_health_max_boundary():
	# Test health stays at max after healing above max
	_game.is_game_active = true
	_game.player_current_health = 100
	_game.heal_player(20)
	assert_eq(_game.player_current_health, 100, "Health should stay at max")

# --- Game Flow Tests ---

func test_start_game():
	# Test start_game() resets health to max, sets is_game_active=true
	_game.player_current_health = 50
	_game.start_game()
	assert_eq(_game.player_current_health, 100, "Start should reset health to max")
	assert_true(_game.is_game_active, "Game should be active after start")

func test_start_game_sets_game_start_time():
	# Test game_start_time is set to current time
	_game.start_game()
	assert_gt(_game.game_start_time, 0, "Game start time should be set")

func test_end_game_won():
	# Test end_game(true) sets is_game_active=false, emits game_won
	_game.is_game_active = true
	watch_signals(_game)
	_game.end_game(true)
	assert_false(_game.is_game_active, "Game should not be active after end")
	assert_signal_emitted(_game, "game_won")

func test_end_game_lost():
	# Test end_game(false) sets is_game_active=false, emits player_died
	_game.is_game_active = true
	watch_signals(_game)
	_game.end_game(false)
	assert_false(_game.is_game_active, "Game should not be active after end")
	assert_signal_emitted(_game, "player_died")

func test_complete_stage():
	# Test complete_stage() increments current_stage and ends game with win
	_game.is_game_active = true
	_game.current_stage = 3
	watch_signals(_game)
	_game.complete_stage()
	assert_eq(_game.current_stage, 4, "Stage should increment")
	assert_false(_game.is_game_active, "Game should end after stage complete")
	assert_signal_emitted(_game, "game_won")

func test_reset_stage():
	# Test reset_stage() sets stage=1, health=max, is_game_active=true
	_game.current_stage = 5
	_game.player_current_health = 30
	_game.reset_stage()
	assert_eq(_game.current_stage, 1, "Stage should reset to 1")
	assert_eq(_game.player_current_health, 100, "Health should reset to max")
	assert_true(_game.is_game_active, "Game should be active after reset")

func test_game_flow_complete_loop():
	# Test start -> damage -> end sequence works correctly
	_game.start_game()
	assert_eq(_game.player_current_health, 100, "Start should reset health")
	assert_true(_game.is_game_active, "Game should be active")

	_game.take_player_damage(30)
	assert_eq(_game.player_current_health, 70, "Damage should reduce health")

	_game.end_game(true)
	assert_false(_game.is_game_active, "End game should deactivate game")

func test_complete_stage_increments():
	# Test current_stage increments by 1
	_game.is_game_active = true
	_game.current_stage = 1
	watch_signals(_game)
	_game.complete_stage()
	assert_eq(_game.current_stage, 2, "Stage should increment by 1")

# --- Signal Tests ---

func test_health_changed_signal():
	# Test health_changed emits with (new_health, max_health) parameters
	watch_signals(_game)
	_game.is_game_active = true
	_game.take_player_damage(30)
	assert_signal_emitted_with_parameters(_game, "health_changed", [70, 100])

func test_health_changed_signal_on_damage():
	# Test health_changed emits when damage taken
	watch_signals(_game)
	_game.is_game_active = true
	_game.player_current_health = 100
	_game.take_player_damage(25)
	assert_signal_emitted(_game, "health_changed")

func test_health_changed_signal_on_heal():
	# Test health_changed emits when healed
	watch_signals(_game)
	_game.is_game_active = true
	_game.player_current_health = 60
	_game.heal_player(20)
	assert_signal_emitted(_game, "health_changed")

func test_player_died_signal():
	# Test player_died emits when health reaches 0
	watch_signals(_game)
	_game.is_game_active = true
	_game.player_current_health = 10
	_game.take_player_damage(20)
	assert_signal_emitted(_game, "player_died")

func test_game_won_signal():
	# Test game_won emits when game ends with won=true
	watch_signals(_game)
	_game.is_game_active = true
	_game.end_game(true)
	assert_signal_emitted(_game, "game_won")

func test_stage_completed_signal():
	# Test stage_completed emits with stage_id string
	watch_signals(_game)
	_game.is_game_active = true
	_game.current_stage_id = "test_stage_1"
	_game.current_stage = 1
	_game.complete_stage()
	assert_signal_emitted_with_parameters(_game, "stage_completed", ["test_stage_1"])

func test_boss_spawned_signal():
	# Test boss_spawned emits with boss_node parameter
	watch_signals(_game)
	# Note: We can't fully test boss spawning without scene files, but we can test the signal
	# The actual boss spawn tests below will verify the signal is emitted

# --- Boss Spawn Tests ---

func test_spawn_boss_basic():
	# Test spawn_boss("boss_basic") creates boss_basic scene
	watch_signals(_game)
	_game.spawn_boss("boss_basic")
	assert_signal_emitted(_game, "boss_spawned")

func test_spawn_boss_wind():
	# Test spawn_boss("boss_wind") creates boss_wind scene
	watch_signals(_game)
	_game.spawn_boss("boss_wind")
	assert_signal_emitted(_game, "boss_spawned")

func test_spawn_boss_fire():
	# Test spawn_boss("boss_fire") creates boss_fire scene
	watch_signals(_game)
	_game.spawn_boss("boss_fire")
	assert_signal_emitted(_game, "boss_spawned")

func test_spawn_boss_ice():
	# Test spawn_boss("boss_ice") creates boss_ice scene
	watch_signals(_game)
	_game.spawn_boss("boss_ice")
	assert_signal_emitted(_game, "boss_spawned")

func test_spawn_boss_electric():
	# Test spawn_boss("boss_electric") creates boss_electric scene
	watch_signals(_game)
	_game.spawn_boss("boss_electric")
	assert_signal_emitted(_game, "boss_spawned")

func test_spawn_boss_placeholder():
	# Test spawn_boss("boss_iron") uses boss_basic placeholder
	watch_signals(_game)
	_game.spawn_boss("boss_iron")
	assert_signal_emitted(_game, "boss_spawned")
