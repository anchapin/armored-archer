extends GutTest

func after_each() -> void:
	EnemySpawner.stop_stage()

func test_selected_stage_configures_wave_and_pooled_archetype_stats() -> void:
	var stats: Dictionary = CampaignManager.get_enemy_data("1_1")
	EnemySpawner.start_stage("1_1", 4, stats, "")
	assert_eq(EnemySpawner.current_chapter, 1)
	assert_eq(EnemySpawner.current_stage, 1)
	assert_eq(EnemySpawner.max_waves, 4)
	assert_eq(EnemySpawner.current_wave, 1)
	EnemySpawner.spawn_enemy()
	var enemy: Node = EnemySpawner.active_enemies[0]
	assert_eq(enemy.get_script().resource_path, "res://scenes/enemies/scout_enemy.gd")
	assert_eq(enemy.max_health, 30)
	assert_eq(enemy.current_health, 30)
	assert_eq(enemy.damage, 8)
	assert_eq(enemy.move_speed, 10.0)

func test_restart_discards_old_wave_state_and_stale_death() -> void:
	EnemySpawner.start_stage("1_1", 4, CampaignManager.get_enemy_data("1_1"), "")
	EnemySpawner.spawn_enemy()
	var old: Node = EnemySpawner.active_enemies[0]
	EnemySpawner.current_wave = 3
	EnemySpawner.start_stage("1_2", 2, CampaignManager.get_enemy_data("1_2"), "")
	assert_eq(EnemySpawner.current_wave, 1)
	assert_eq(EnemySpawner.current_stage, 2)
	assert_eq(EnemySpawner.max_waves, 2)
	assert_eq(EnemySpawner.active_enemies.size(), 0)
	EnemySpawner._on_enemy_exiting(old)
	assert_eq(EnemySpawner.current_wave, 1)
	assert_true(EnemySpawner.is_spawning)

func test_menu_stop_disarms_timers_and_spawn_callbacks() -> void:
	EnemySpawner.start_stage("1_1", 4, {}, "")
	EnemySpawner.stop_stage()
	EnemySpawner._on_spawn_timer_timeout()
	EnemySpawner._on_wave_timer_timeout()
	EnemySpawner.spawn_enemy()
	assert_false(EnemySpawner.stage_active)
	assert_true(EnemySpawner.spawn_timer_node.is_stopped())
	assert_true(EnemySpawner.wave_timer_node.is_stopped())
	assert_eq(EnemySpawner.active_enemies.size(), 0)
	assert_eq(EnemySpawner.current_wave, 0)

func test_pooled_ai_drops_previous_player_reference() -> void:
	EnemySpawner.start_stage("1_1", 4, CampaignManager.get_enemy_data("1_1"), "")
	EnemySpawner.spawn_enemy()
	var enemy: Node = EnemySpawner.active_enemies[0]
	var old_player := CharacterBody2D.new()
	add_child_autofree(old_player)
	enemy.player_ref = old_player
	enemy.reset_for_spawn()
	assert_null(enemy.player_ref)
	assert_eq(enemy.velocity, Vector2.ZERO)

func test_boss_wait_does_not_end_a_new_stage() -> void:
	EnemySpawner.start_stage("1_1", 1, {}, "")
	GameManager.is_game_active = true
	EnemySpawner._on_boss_defeated("old")
	EnemySpawner.start_stage("1_2", 2, {}, "")
	await get_tree().create_timer(1.2).timeout
	assert_true(GameManager.is_game_active)
