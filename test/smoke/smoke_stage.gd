## Configured campaign 1_1 smoke. Control teaching must work before combat.
extends SceneTree

var _seconds: float = 60.0
var _min_alive: float = 10.0
var _elapsed: float = 0.0
var _died_at: float = -1.0
var _won: bool = false
var _playing: bool = false
var _max_enemies: int = 0
var _exit_code: int = 0

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--seconds="):
			_seconds = float(arg.get_slice("=", 1))
		elif arg.begins_with("--min-alive="):
			_min_alive = float(arg.get_slice("=", 1))
	call_deferred("_start_configured_stage")

func _fail(reason: String) -> void:
	printerr("SMOKE FAIL: " + reason)
	_exit_code = 1
	_cleanup_and_quit()

func _start_configured_stage() -> void:
	# The wrapper supplies a fresh, temporary user-data directory.
	var tutorial: Node = root.get_node("TutorialManager")
	if not tutorial.is_first_time_player():
		_fail("requires a fresh isolated tutorial save")
		return
	change_scene_to_file("res://scenes/ui/campaign_map.tscn")
	await process_frame
	await process_frame
	if current_scene == null or not current_scene.has_method("_on_stage_pressed"):
		_fail("campaign map unavailable")
		return
	current_scene._on_stage_pressed("1_1")
	for _i in range(180):
		await process_frame
		if current_scene and current_scene.scene_file_path == "res://scenes/main.tscn":
			break
	if current_scene == null or current_scene.scene_file_path != "res://scenes/main.tscn":
		_fail("campaign stage transition failed")
		return
	await process_frame
	var gm: Node = root.get_node("GameManager")
	var spawner: Node = root.get_node("EnemySpawner")
	var player: Node = current_scene.get_node("Player")
	var touch: Node = current_scene.get_node("HUD/TouchUI")
	if gm.current_stage_id != "1_1" or gm.current_encounter_data.is_empty():
		_fail("stage ID or encounter configuration missing")
		return
	if touch.player != player:
		_fail("TouchUI not bound to the stage player")
		return
	var health: int = gm.player_current_health
	var enemy_count: int = spawner.active_enemies.size()
	await create_timer(4.0).timeout
	if tutorial.current_step_index != 0 or not tutorial.is_combat_paused():
		_fail("welcome Movement skipped or combat not paused")
		return
	if gm.player_current_health != health or spawner.active_enemies.size() != enemy_count:
		_fail("damage or spawning occurred during Movement teaching")
		return
	var start: Vector2 = player.position
	_touch(touch.movement_joystick, 0, true)
	await create_timer(0.7).timeout
	_touch(touch.movement_joystick, 0, false)
	await create_timer(0.3).timeout
	if player.position.distance_to(start) < 5.0 or player.virtual_move_direction != Vector2.ZERO:
		_fail("touch movement or release reset failed")
		return
	if tutorial.get_current_step().get("id", "") != "aiming":
		_fail("touch movement did not advance tutorial")
		return
	_touch(touch.aiming_joystick, 1, true)
	await create_timer(0.3).timeout
	if tutorial.get_current_step().get("id", "") != "shooting":
		_fail("touch aim did not advance tutorial")
		return
	_touch(touch.aiming_joystick, 1, false)
	OS.delay_msec(200)
	await create_timer(0.2).timeout
	if tutorial.get_current_step().get("id", "") != "auto_aim" or player.virtual_aim_direction != Vector2.ZERO:
		_fail("touch shot/release did not advance tutorial or clear aim")
		return
	await create_timer(6.5).timeout
	if tutorial.get_current_step().get("action", "") != "complete_level" or tutorial.is_combat_paused():
		_fail("combat did not resume for victory objective")
		return
	gm.player_died.connect(_on_player_died)
	gm.game_won.connect(func(): _won = true)
	_playing = true
	print("SMOKE: configured1_1 teaching/touch/release PASS; combat for %.0fs" % _seconds)

func _on_player_died() -> void:
	if _died_at < 0.0:
		_died_at = _elapsed

func _touch(joystick: Node, index: int, pressed: bool) -> void:
	var event := InputEventScreenTouch.new()
	event.index = index
	event.pressed = pressed
	event.position = joystick._get_joystick_center() + Vector2(30.0, 0.0)
	# Custom headless SceneTree input dispatch differs from a rendered Window.
	# Exercise the same joystick input callback explicitly, not a signal emit.
	joystick._input(event)

func _process(delta: float) -> bool:
	if not _playing:
		return false
	_elapsed += delta
	var spawner: Node = root.get_node("EnemySpawner")
	_max_enemies = max(_max_enemies, spawner.active_enemies.size())
	if _died_at < 0.0 and current_scene and current_scene.has_node("Player"):
		var player: Node2D = current_scene.get_node("Player")
		# Move around a small central route using the public touch binding.
		# This is input, not a teleport, stat change or invulnerability override.
		var destination := Vector2(80.0 * cos(_elapsed / 3.0), 100.0 * sin(_elapsed / 3.0))
		player.set_virtual_move_direction(player.position.direction_to(destination))
	if _won or _elapsed >= _seconds or (_died_at >= 0.0 and _elapsed - _died_at > 1.0):
		_finish()
		return false
	return false

func _finish() -> void:
	print("SMOKE RESULT: stage=1_1 combat=%.1fs won=%s died_at=%.1f max_enemies=%d" % [_elapsed, _won, _died_at, _max_enemies])
	if _died_at >= 0.0 and _died_at < _min_alive:
		_fail("player died before minimum combat duration")
		return
	var spawner: Node = root.get_node("EnemySpawner")
	if not _won and (spawner.current_chapter != 1 or spawner.current_stage != 1 or spawner.max_waves != 4):
		_fail("active spawner lost selected campaign context")
		return
	for enemy in spawner.active_enemies:
		if enemy.get_script().resource_path != "res://scenes/enemies/scout_enemy.gd" or enemy.max_health != 30 or enemy.damage != 8 or enemy.move_speed != 10.0:
			_fail("active enemy differs from configured1_1 archetype/stats")
			return
	if _max_enemies == 0:
		_fail("no enemies active after combat resumed")
		return
	_cleanup_and_quit()

func _cleanup_and_quit() -> void:
	_playing = false
	root.get_node("AudioManager").stop_all()
	root.get_node("AudioManager").stop_music()
	for audio in root.get_node("AudioManager").get_children():
		if audio is AudioStreamPlayer:
			audio.stream = null
	root.get_node("ObjectPool").cleanup_all()
	if current_scene:
		current_scene.queue_free()
	await process_frame
	await process_frame
	OS.delay_msec(200)
	await create_timer(0.2).timeout
	print("SMOKE PASS")
	quit(_exit_code)
