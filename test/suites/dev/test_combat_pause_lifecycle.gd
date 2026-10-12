extends GutTest

var stage: Node
var old_active: bool
var old_stage: String
var old_time_scale: float
var old_encounter: Dictionary
var old_waves: int
var old_spawner_waves: int
var old_stats: Dictionary
var old_chapter: int
var old_spawner_stage: int

func before_each() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	get_tree().paused = false
	old_spawner_waves = EnemySpawner.max_waves
	old_stats = EnemySpawner.last_stage_enemy_stats.duplicate(true)
	old_chapter = EnemySpawner.current_chapter
	old_spawner_stage = EnemySpawner.current_stage
	old_time_scale = Engine.time_scale
	Engine.time_scale = 1.0
	old_encounter = GameManager.current_encounter_data.duplicate(true)
	old_waves = GameManager.current_waves
	old_active = GameManager.is_game_active
	old_stage = GameManager.current_stage_id
	EnemySpawner.stop_stage()
	ObjectPool.cleanup_all()
	TutorialManager.skip_current_tutorial()
	GameManager.current_stage_id = "1_1"
	GameManager.current_waves = 4
	GameManager.current_encounter_data = CampaignManager.get_enemy_data("1_1")
	stage = load("res://scenes/main.tscn").instantiate()
	add_child(stage)
	TutorialManager.skip_current_tutorial()
	EnemySpawner.spawn_timer_node.stop()

func after_each() -> void:
	if is_instance_valid(stage):
		stage.free()
	get_tree().paused = false
	EnemySpawner.stop_stage()
	ObjectPool.cleanup_all()
	GameManager.current_stage_id = old_stage
	GameManager.is_game_active = old_active
	GameManager.current_encounter_data = old_encounter
	GameManager.current_waves = old_waves
	Engine.time_scale = old_time_scale
	EnemySpawner.max_waves = old_spawner_waves
	EnemySpawner.last_stage_enemy_stats = old_stats
	EnemySpawner.current_chapter = old_chapter
	EnemySpawner.current_stage = old_spawner_stage

func test_pause_freezes_player_pooled_combat_and_wave_clock_then_resumes() -> void:
	EnemySpawner.spawn_enemy()
	var enemy: Node = EnemySpawner.active_enemies[0]
	enemy.global_position = Vector2(10000, 10000)
	var arrow: Node = ObjectPool.get_arrow()
	arrow.setup(Vector2(9000, 9000), Vector2.RIGHT, 10)
	stage.player.set_virtual_move_direction(Vector2.RIGHT)
	EnemySpawner.spawn_timer_node.start(0.5)
	stage._pause_button.pressed.emit()
	var player_pos: Vector2 = stage.player.global_position
	var enemy_pos: Vector2 = enemy.global_position
	var arrow_pos: Vector2 = arrow.global_position
	var spawn_time: float = EnemySpawner.spawn_timer_node.time_left
	await get_tree().create_timer(0.2).timeout
	assert_true(get_tree().paused)
	assert_true(stage._pause_overlay.visible)
	assert_eq(stage.player.global_position, player_pos)
	assert_eq(enemy.global_position, enemy_pos)
	assert_eq(arrow.global_position, arrow_pos)
	assert_eq(EnemySpawner.spawn_timer_node.time_left, spawn_time)
	assert_eq(stage.player.virtual_move_direction, Vector2.ZERO)
	stage._pause_overlay.get_node("CenterContainer/VBoxContainer/Button").pressed.emit()
	assert_false(get_tree().paused)
	await get_tree().create_timer(0.1).timeout
	assert_ne(arrow.global_position, arrow_pos)
	assert_lt(EnemySpawner.spawn_timer_node.time_left, spawn_time)

func test_result_pauses_combat_but_game_over_can_return_to_map() -> void:
	EnemySpawner.spawn_enemy()
	GameManager.end_game(false)
	await get_tree().process_frame
	assert_true(get_tree().paused)
	assert_true(stage.game_over.visible)
	assert_true(stage.game_over.can_process())
	assert_false(stage.player.can_process())
	var pending: int = EnemySpawner.enemies_to_spawn
	await get_tree().create_timer(0.15).timeout
	assert_eq(EnemySpawner.enemies_to_spawn, pending)
	stage._toggle_pause()
	assert_true(get_tree().paused, "Pause action cannot resume a ended combat")
	stage.free()
	stage = null
	assert_false(get_tree().paused, "Leaving combat releases only its owned pause")

func test_pause_cancels_aim_touch_without_firing_and_exit_releases_pause() -> void:
	var touch: Node = stage.touch_ui
	touch._touch_aim_started = true
	touch.aiming_joystick.touch_index = 2
	touch.aiming_joystick.is_active = true
	stage.player.set_virtual_aim_direction(Vector2.RIGHT)
	var ammo: int = ShootingManager.get_ammo()
	stage._toggle_pause()
	assert_false(touch._touch_aim_started)
	assert_eq(touch.aiming_joystick.touch_index, -1)
	assert_eq(stage.player.virtual_aim_direction, Vector2.ZERO)
	assert_eq(ShootingManager.get_ammo(), ammo)
	stage.free()
	stage = null
	assert_false(get_tree().paused)

func test_keyboard_pause_action_toggles_and_victory_stays_frozen() -> void:
	var action: InputEventAction = InputEventAction.new()
	action.action = "pause"
	action.pressed = true
	stage._input(action)
	assert_true(get_tree().paused)
	stage._input(action)
	assert_false(get_tree().paused)
	GameManager.is_game_active = false
	GameManager.game_won.emit()
	assert_true(get_tree().paused)
	assert_true(stage.game_over.visible)
	assert_true(stage.game_over.can_process())
	assert_eq(stage.game_over.result_label.text, "Victory!")
