extends GutTest

var counter: Label

func before_each() -> void:
	TutorialManager.skip_current_tutorial()
	EnemySpawner.start_stage("1_1", 4, CampaignManager.get_enemy_data("1_1"), "")
	counter = load("res://scenes/ui/components/enemies_counter.gd").new()
	add_child_autofree(counter)

func after_each() -> void:
	EnemySpawner.stop_stage()

func test_pending_and_final_spawn_are_not_defeats() -> void:
	assert_eq(counter.text, "Enemies: 0 / 18 (0%)")
	watch_signals(EnemySpawner)
	for _i in range(3):
		EnemySpawner.spawn_enemy()
	assert_eq(counter.text, "Enemies: 0 / 18 (0%)")
	assert_signal_emit_count(EnemySpawner, "enemy_count_changed", 3)
	assert_signal_emitted_with_parameters(EnemySpawner, "enemy_count_changed", [3, 18], 2)

func test_only_confirmed_deaths_advance_progress_between_waves() -> void:
	for _i in range(3):
		EnemySpawner.spawn_enemy()
	var first: Node = EnemySpawner.active_enemies[0]
	for enemy in EnemySpawner.active_enemies.duplicate():
		EnemySpawner._on_enemy_exiting(enemy)
	assert_eq(counter.text, "Enemies: 3 / 18 (16%)")
	EnemySpawner._on_enemy_exiting(first)
	assert_eq(EnemySpawner.enemies_defeated, 3)
	EnemySpawner._on_wave_timer_timeout()
	assert_eq(EnemySpawner.current_wave, 2)
	assert_eq(counter.text, "Enemies: 3 / 18 (16%)")

func test_new_stage_and_menu_clear_old_progress() -> void:
	EnemySpawner.spawn_enemy()
	EnemySpawner._on_enemy_exiting(EnemySpawner.active_enemies[0])
	EnemySpawner.start_stage("1_2", 2, {}, "")
	assert_eq(counter.text, "Enemies: 0 / 7 (0%)")
	EnemySpawner.stop_stage()
	assert_eq(counter.text, "Enemies: 0")

func test_real_lethal_damage_advances_progress_on_normal_juice_path() -> void:
	EnemySpawner.spawn_enemy()
	var enemy: Node = EnemySpawner.active_enemies[0]
	enemy.take_damage(enemy.current_health)
	assert_eq(counter.text, "Enemies: 1 / 18 (5%)")
	assert_eq(EnemySpawner.active_enemies.size(), 0)
	enemy.take_damage(1000)
	assert_eq(EnemySpawner.enemies_defeated, 1)
	await get_tree().create_timer(1.2).timeout
	assert_false(enemy.visible)
	assert_eq(EnemySpawner.enemies_defeated, 1)
