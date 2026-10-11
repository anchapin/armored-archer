extends GutTest

class TouchPlayer extends CharacterBody2D:
	var move_input := Vector2.ZERO
	var aim_input := Vector2.ZERO
	var shots := 0
	func set_virtual_move_direction(value: Vector2) -> void:
		move_input = value
	func set_virtual_aim_direction(value: Vector2) -> void:
		aim_input = value
	func _handle_shoot() -> void:
		shots += 1

var saved_tutorial: Dictionary
var saved_game_active: bool
var saved_health: int

func before_each() -> void:
	saved_tutorial = TutorialManager.tutorial_data.duplicate(true)
	saved_game_active = GameManager.is_game_active
	saved_health = GameManager.player_current_health
	TutorialManager.tutorial_data = {}
	TutorialManager.is_tutorial_active = false

func after_each() -> void:
	TutorialManager.is_tutorial_active = false
	TutorialManager.current_tutorial_id = ""
	TutorialManager.hide_tutorial_overlay()
	TutorialManager.tutorial_data = saved_tutorial
	TutorialManager._save_tutorial_data()
	GameManager.is_game_active = saved_game_active
	GameManager.player_current_health = saved_health
	EnemySpawner._process(0.0)

func _touch() -> Node:
	var touch = load("res://scenes/touch_ui.tscn").instantiate()
	add_child_autofree(touch)
	return touch

func test_explicit_binding_survives_hud_parent_and_deferred_ready() -> void:
	var hud := CanvasLayer.new()
	add_child_autofree(hud)
	var touch = load("res://scenes/touch_ui.tscn").instantiate()
	hud.add_child(touch)
	var player := TouchPlayer.new()
	add_child_autofree(player)
	touch.set_player(player)
	await get_tree().process_frame
	assert_eq(touch.player, player)
	touch.movement_joystick.joystick_moved.emit(Vector2.RIGHT)
	assert_eq(player.move_input, Vector2.RIGHT)
	touch.movement_joystick.joystick_released.emit()
	assert_eq(player.move_input, Vector2.ZERO, "Release must clear latched movement")

func test_touch_drives_controls_tutorial_and_release_fires_once() -> void:
	var touch = _touch()
	var player := TouchPlayer.new()
	add_child_autofree(player)
	touch.set_player(player)
	TutorialManager.start_tutorial("welcome")
	touch.movement_joystick.joystick_moved.emit(Vector2.ZERO)
	assert_eq(TutorialManager.current_step_index, 0, "Deadzone must not advance")
	touch.movement_joystick.joystick_moved.emit(Vector2.LEFT)
	assert_eq(TutorialManager.get_current_step().id, "aiming")
	touch.aiming_joystick.joystick_moved.emit(Vector2.UP)
	assert_eq(TutorialManager.get_current_step().id, "shooting")
	touch.aiming_joystick.joystick_released.emit()
	assert_eq(player.shots, 1)
	assert_eq(player.aim_input, Vector2.ZERO)
	assert_eq(TutorialManager.get_current_step().id, "auto_aim")
	touch.aiming_joystick.joystick_released.emit()
	assert_eq(player.shots, 1, "An idle release must not fire")

func test_teaching_pauses_but_victory_step_and_skip_resume() -> void:
	TutorialManager.start_tutorial("welcome")
	assert_true(TutorialManager.is_combat_paused())
	TutorialManager.current_step_index = 5
	assert_false(TutorialManager.is_combat_paused(), "Victory objective must be playable")
	TutorialManager.skip_current_tutorial()
	assert_false(TutorialManager.is_combat_paused())
	assert_false(TutorialManager.is_first_time_player(), "Explicit skip persists on return")

func test_completed_returning_player_does_not_pause() -> void:
	TutorialManager.tutorial_data = {"welcome": {"state": "completed"}}
	assert_false(TutorialManager.is_first_time_player())
	assert_false(TutorialManager.start_tutorial("welcome"))
	assert_false(TutorialManager.is_combat_paused())

func test_spawn_and_wave_clocks_pause_and_resume() -> void:
	TutorialManager.start_tutorial("welcome")
	var count: int = EnemySpawner.active_enemies.size()
	var pending: int = EnemySpawner.enemies_to_spawn
	EnemySpawner.spawn_enemy()
	EnemySpawner._process(0.0)
	assert_eq(EnemySpawner.active_enemies.size(), count)
	assert_eq(EnemySpawner.enemies_to_spawn, pending)
	assert_true(EnemySpawner.spawn_timer_node.paused)
	assert_true(EnemySpawner.wave_timer_node.paused)
	TutorialManager.skip_current_tutorial()
	EnemySpawner._process(0.0)
	assert_false(EnemySpawner.spawn_timer_node.paused)
	assert_false(EnemySpawner.wave_timer_node.paused)

func test_enemies_freeze_without_waking_parked_pool_nodes() -> void:
	var enemy := Node2D.new()
	add_child_autofree(enemy)
	enemy.add_to_group("Enemies")
	var parked := Node2D.new()
	parked.process_mode = Node.PROCESS_MODE_DISABLED
	add_child_autofree(parked)
	parked.add_to_group("Enemies")
	TutorialManager.start_tutorial("welcome")
	EnemySpawner._process(0.0)
	assert_eq(enemy.process_mode, Node.PROCESS_MODE_DISABLED)
	TutorialManager.skip_current_tutorial()
	EnemySpawner._process(0.0)
	assert_eq(enemy.process_mode, Node.PROCESS_MODE_INHERIT)
	assert_eq(parked.process_mode, Node.PROCESS_MODE_DISABLED)

func test_contact_and_late_attack_damage_blocked_during_teaching() -> void:
	GameManager.is_game_active = true
	GameManager.player_current_health = 100
	TutorialManager.start_tutorial("welcome")
	GameManager.take_player_damage(25)
	assert_eq(GameManager.player_current_health, 100)
	var player = load("res://scenes/player.tscn").instantiate()
	add_child_autofree(player)
	var health: int = player.current_health
	player.take_damage(25)
	assert_eq(player.current_health, health)

func test_victory_completes_welcome_before_return() -> void:
	var stage_id: String = GameManager.current_stage_id
	GameManager.current_stage_id = ""
	GameManager.is_game_active = true
	TutorialManager.start_tutorial("welcome")
	TutorialManager.current_step_index = 5
	GameManager.end_game(true)
	assert_true(TutorialManager.is_tutorial_complete("welcome"))
	assert_false(TutorialManager.is_combat_paused())
	GameManager.current_stage_id = stage_id

func test_old_timed_tutorial_does_not_skip_new_welcome_step() -> void:
	TutorialManager.start_tutorial("beta_features")
	TutorialManager.start_tutorial("welcome")
	await get_tree().create_timer(3.2).timeout
	assert_eq(TutorialManager.current_step_index, 0)
	assert_eq(TutorialManager.get_current_step().id, "movement")
