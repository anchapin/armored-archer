extends GutTest

## Acceptance coverage for #1446 (stage 1_1 survivability) and the #1445
## tutorial combat freeze. Runs against the live autoloads (same pattern as
## test_combat_pause_lifecycle.gd).

class FakePlayer:
	extends CharacterBody2D
	var hits: int = 0
	func take_damage(_amount: int) -> void:
		hits += 1

var _enemy_script: GDScript = load("res://scenes/enemies/base_enemy.gd")
var _old_tutorial_active: bool
var _old_tutorial_id: String

func before_each() -> void:
	_old_tutorial_active = TutorialManager.is_tutorial_active
	_old_tutorial_id = TutorialManager.current_tutorial_id
	EnemySpawner.stop_stage()

func after_each() -> void:
	TutorialManager.is_tutorial_active = _old_tutorial_active
	TutorialManager.current_tutorial_id = _old_tutorial_id
	EnemySpawner.stop_stage()
	GameManager.damage_cooldown = 0.0

# --- #1446: player invulnerability window ---

func test_rapid_hits_apply_once_per_invulnerability_window() -> void:
	TutorialManager.is_tutorial_active = false
	var old_active: bool = GameManager.is_game_active
	var old_health: int = GameManager.player_current_health
	GameManager.is_game_active = true
	GameManager.damage_cooldown = 0.0
	GameManager.player_current_health = 100

	GameManager.take_player_damage(8)
	assert_eq(GameManager.player_current_health, 92, "first hit lands")
	GameManager.take_player_damage(8)
	assert_eq(GameManager.player_current_health, 92, "second hit inside window is ignored")
	GameManager.damage_cooldown = 0.0  # window expires
	GameManager.take_player_damage(8)
	assert_eq(GameManager.player_current_health, 84, "hit after window lands")

	GameManager.is_game_active = old_active
	GameManager.player_current_health = old_health
	GameManager.damage_cooldown = 0.0

func test_invulnerability_window_meets_stage1_acceptance() -> void:
	# Issue bar: standing-still player survives >= 15s of contact on 1_1.
	# 1_1 scouts deal 8 dmg into 100 HP: 100 / 8 = 12.5 hits to kill, so the
	# window must exceed ~1.2s. 1.5s yields ~18s of survival.
	var survival_seconds: float = floor(100.0 / 8.0) * GameManager.PLAYER_INVULNERABILITY_DURATION
	assert_gt(survival_seconds, 15.0, "window x hits-to-kill clears the 15s bar")

# --- #1446: per-enemy contact cooldown ---

func test_enemy_contact_damage_respects_cooldown() -> void:
	# Not added to the tree: base_enemy._ready expects scene children the bare
	# script instance does not have. The handler itself is tree-independent.
	var enemy: Node = _enemy_script.new()
	var player: CharacterBody2D = FakePlayer.new()
	player.add_to_group("Player")
	add_child_autofree(player)

	enemy._on_hurt_area_body_entered(player)
	enemy._on_hurt_area_body_entered(player)
	assert_eq(player.hits, 1, "re-entry inside cooldown deals no extra damage")

	enemy._last_contact_damage_msec -= int(enemy.CONTACT_DAMAGE_COOLDOWN * 1000.0) + 50
	enemy._on_hurt_area_body_entered(player)
	assert_eq(player.hits, 2, "hit lands after cooldown expires")
	enemy.free()

# --- #1446: wave-1 grace period ---

func test_wave_one_first_spawn_is_delayed() -> void:
	EnemySpawner.start_stage("1_1", 4, {}, "")
	assert_true(EnemySpawner.spawn_timer_node.time_left > 0.0, "wave 1 timer armed")
	assert_gt(EnemySpawner.spawn_timer_node.wait_time, 2.0,
		"first spawn waits the grace period, not the 0.5s inter-enemy cadence")

# --- #1446: minimum spawn distance (regression guard for the landed half) ---

func test_spawns_respect_minimum_distance_from_player() -> void:
	var player: CharacterBody2D = FakePlayer.new()
	player.add_to_group("Player")
	player.global_position = Vector2.ZERO
	add_child_autofree(player)
	await get_tree().process_frame

	for i in 100:
		var pos: Vector2 = EnemySpawner.get_random_spawn_position()
		assert_true(pos.distance_to(player.global_position) >= EnemySpawner.MIN_SPAWN_DISTANCE_FROM_PLAYER,
			"spawn %d at %s violates min distance" % [i, pos])

# --- #1445: tutorial freeze ---

func test_tutorial_freezes_enemies_and_spawning() -> void:
	TutorialManager.is_tutorial_active = true
	TutorialManager.current_tutorial_id = "welcome"
	# Bare node in the Enemies group: the spawner freeze only needs group
	# membership and process_mode, not a real enemy scene.
	var enemy: CharacterBody2D = CharacterBody2D.new()
	enemy.add_to_group("Enemies")
	add_child_autofree(enemy)
	var original_mode: int = enemy.process_mode

	EnemySpawner._process(0.0)
	assert_eq(enemy.process_mode, Node.PROCESS_MODE_DISABLED, "enemy frozen while tutorial is up")
	assert_true(EnemySpawner.spawn_timer_node.paused, "spawn clock frozen")

	# Tutorial finished or skipped releases combat.
	TutorialManager.is_tutorial_active = false
	EnemySpawner._process(0.0)
	assert_eq(enemy.process_mode, original_mode, "enemy restored after tutorial")
	assert_true(not EnemySpawner.spawn_timer_node.paused, "spawn clock released")
