extends GutTest

var saved_health: int
var saved_max: int
var saved_active: bool
var player: Node

func before_each() -> void:
	saved_health = GameManager.player_current_health
	saved_max = GameManager.player_max_health
	saved_active = GameManager.is_game_active
	TutorialManager.skip_current_tutorial()
	player = load("res://scenes/player.tscn").instantiate()
	add_child_autofree(player)
	GameManager.player_max_health = 120
	GameManager.player_current_health = 120
	GameManager.damage_cooldown = 0.0
	GameManager.is_game_active = true
	GameManager._sync_health_to_player()

func after_each() -> void:
	GameManager.player_max_health = saved_max
	GameManager.player_current_health = saved_health
	GameManager.is_game_active = saved_active
	GameManager.damage_cooldown = 0.0

func test_repeat_hit_gate_and_recovery_keep_health_mirrored() -> void:
	player.take_damage(10)
	assert_eq(player.current_health, GameManager.player_current_health)
	var after_first: int = player.current_health
	player.take_damage(10)
	assert_eq(player.current_health, after_first)
	GameManager._process(0.11)
	player.take_damage(10)
	assert_lt(player.current_health, after_first)
	assert_eq(player.current_health, GameManager.player_current_health)

func test_heal_is_applied_once_without_sync_recursion() -> void:
	GameManager.player_current_health = 80
	GameManager._sync_health_to_player()
	player.heal(10)
	assert_eq(player.current_health, 90)
	assert_eq(GameManager.player_current_health, 90)
	assert_eq(player.max_health, 120)

func test_lethal_damage_ends_combat_once_and_blocks_later_damage() -> void:
	watch_signals(GameManager)
	player.take_damage(10000)
	assert_eq(GameManager.player_current_health, 0)
	assert_eq(player.current_health, 0)
	assert_false(GameManager.is_game_active)
	player.take_damage(10)
	assert_eq(player.current_health, 0)
	assert_signal_emit_count(GameManager, "player_died", 1)
