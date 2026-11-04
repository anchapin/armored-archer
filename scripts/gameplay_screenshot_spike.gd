## Gameplay screenshot spike demo (issue #1766).
##
## Offline, deterministic demo that plays ONE campaign stage and captures real
## viewport screenshots at fixed gameplay moments:
##
##   1. stage_loaded   — the gameplay scene is on screen
##   2. wave_spawn     — wave 1 enemies are alive
##   3. shot_fired     — the player actually fired an arrow
##   4. enemy_death    — at least one enemy died from player damage
##   5. boss_spawn     — the campaign boss is alive
##
## It never logs in and never talks to a server: `NetworkConsts.MVP_PVE_ONLY`
## is `true`, so the demo drives `GameManager`/`CampaignManager`/`EnemySpawner`
## directly. Stage data comes from `data/campaigns.json` via
## `CampaignManager.get_stage_data()`.
##
## Headless note (issue #1766 audit): `scripts/screenshot_capture.gd` shows that
## a headless run uses a dummy rendering device whose viewport texture cannot
## be read back, so it substitutes a 1x1 placeholder. This demo therefore
## reports the real captured size and fails loudly when the viewport texture is
## not readable — it never writes a placeholder image.
##
## Usage (needs a real display, e.g. xvfb-run):
##   godot --path . -s res://scripts/gameplay_screenshot_spike.gd -- \
##       --out-dir=/abs/path --stage=1_3 --timeout=60
##
## Output: one PNG per capture point plus `SPIKE_CAPTURE` JSON lines and a
## final `SPIKE_SUMMARY` JSON line on stdout.

extends SceneTree

const DEFAULT_STAGE_ID: String = "1_3"
const DEFAULT_OUT_DIR: String = "user://spike_captures"
const DEFAULT_TIMEOUT: float = 60.0
const CAPTURE_STEPS: Array[String] = ["stage_loaded", "wave_spawn", "shot_fired", "enemy_death", "boss_spawn"]
const SAMPLE_STRIDE: int = 8

var _stage_id: String = DEFAULT_STAGE_ID
var _out_dir: String = DEFAULT_OUT_DIR
var _timeout: float = DEFAULT_TIMEOUT
var _start_ms: int = 0
var _exit_code: int = 0
var _errors: int = 0
var _shots_fired: int = 0
var _captures: Array[Dictionary] = []
var _boss_requested: bool = false


func _initialize() -> void:
	_parse_args()
	call_deferred("_run")


func _parse_args() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--stage="):
			_stage_id = arg.get_slice("=", 1)
		elif arg.begins_with("--out-dir="):
			_out_dir = arg.get_slice("=", 1)
		elif arg.begins_with("--timeout="):
			_timeout = float(arg.get_slice("=", 1))


func _elapsed_ms() -> int:
	return Time.get_ticks_msec() - _start_ms


func _remaining_s() -> float:
	return maxf(0.0, _timeout - float(_elapsed_ms()) / 1000.0)


## Waits until `condition` returns true or the global timeout expires.
## `_pump()` keeps the fight alive and on camera while we wait.
func _wait_until(condition: Callable, label: String) -> bool:
	while _remaining_s() > 0.0:
		if condition.call():
			return true
		_pump()
		await process_frame
	_fail_step("timeout waiting for %s" % label)
	return false


## Drives the fight: the player walks towards the nearest live target (public
## virtual-control binding, same as the campaign smoke test) and fires arrows
## through the real ShootingManager entry point.
func _pump() -> void:
	var player: Node = current_scene.get_node_or_null("Player") if current_scene else null
	if player == null:
		return
	var target: Node2D = _nearest_target(player.global_position)
	if target == null:
		return
	var to_target: Vector2 = target.global_position - player.global_position
	if to_target.length() > 60.0:
		player.set_virtual_move_direction(to_target.normalized())
	else:
		player.set_virtual_move_direction(Vector2.ZERO)
	var shooting: Node = root.get_node_or_null("ShootingManager")
	if shooting and shooting.has_method("shoot_arrow"):
		# shoot_arrow() self-guards on cooldown/ammo and emits `arrow_fired`.
		shooting.shoot_arrow(player.global_position, to_target.normalized())


## Nearest live enemy (stage enemies first, then the boss).
func _nearest_target(from_position: Vector2) -> Node2D:
	var spawner: Node = root.get_node_or_null("EnemySpawner")
	var best: Node2D = null
	var best_distance: float = 100000.0
	if spawner:
		for enemy in spawner.active_enemies:
			if not is_instance_valid(enemy):
				continue
			var distance: float = (enemy.global_position - from_position).length()
			if distance < best_distance:
				best_distance = distance
				best = enemy
	for boss in get_nodes_in_group("Boss"):
		if not is_instance_valid(boss):
			continue
		var distance: float = (boss.global_position - from_position).length()
		if distance < best_distance:
			best_distance = distance
			best = boss
	return best


func _fail_step(reason: String) -> void:
	_errors += 1
	printerr("SPIKE_FAIL: " + reason)


func _run() -> void:
	_start_ms = Time.get_ticks_msec()
	print("SPIKE_START: stage=%s out_dir=%s timeout=%.1fs" % [_stage_id, _out_dir, _timeout])

	if not DirAccess.dir_exists_absolute(_out_dir):
		if DirAccess.make_dir_recursive_absolute(_out_dir) != OK:
			_fail_step("cannot create capture directory %s" % _out_dir)
			_finish()
			return

	var campaign: Node = root.get_node_or_null("CampaignManager")
	var game: Node = root.get_node_or_null("GameManager")
	var tutorial: Node = root.get_node_or_null("TutorialManager")
	if campaign == null or game == null or tutorial == null:
		_fail_step("required autoloads are missing")
		_finish()
		return

	var stage_data: Dictionary = campaign.get_stage_data(_stage_id)
	if stage_data.is_empty():
		_fail_step("stage %s not found in data/campaigns.json" % _stage_id)
		_finish()
		return

	# The welcome tutorial freezes combat; the spike wants combat, so mark it
	# skipped in memory (no save file is written by this demo).
	tutorial.tutorial_data = {"welcome": {"state": "skipped"}}

	var boss_value = stage_data.get("boss")
	game.current_stage_id = _stage_id
	game.current_waves = int(stage_data.get("waves", 3))
	game.current_encounter_data = campaign.get_enemy_data(_stage_id)
	game.current_difficulty = int(campaign.get_difficulty_tier(_stage_id))
	game.boss_id = "" if boss_value == null else str(boss_value)

	var shooting: Node = root.get_node_or_null("ShootingManager")
	if shooting and not shooting.arrow_fired.is_connected(_on_arrow_fired):
		shooting.arrow_fired.connect(_on_arrow_fired)

	change_scene_to_file("res://scenes/main.tscn")
	for _i in range(180):
		await process_frame
		if current_scene != null and current_scene.scene_file_path == "res://scenes/main.tscn":
			break
	if current_scene == null or current_scene.scene_file_path != "res://scenes/main.tscn":
		_fail_step("gameplay scene did not load")
		_finish()
		return

	var spawner: Node = root.get_node_or_null("EnemySpawner")
	if spawner == null:
		_fail_step("EnemySpawner autoload is missing")
		_finish()
		return

	await process_frame
	await _capture("stage_loaded")

	# Wave 1: wait until an enemy is alive AND close enough to be on camera,
	# so the capture actually shows the wave instead of an empty background.
	if not await _wait_until(func() -> bool: return _enemy_on_camera(spawner, 150.0), "wave 1 spawn"):
		_finish()
		return
	await _capture("wave_spawn")

	if not await _wait_until(func() -> bool: return _shots_fired > 0, "an arrow to be fired"):
		_finish()
		return
	await _capture("shot_fired")

	if not await _wait_until(func() -> bool: return spawner.enemies_defeated > 0, "an enemy death"):
		_finish()
		return
	await _capture("enemy_death")

	# The stage boss is spawned through the same path the game uses when the
	# final wave is cleared (EnemySpawner.spawn_boss -> GameManager.spawn_boss).
	# The spike triggers it early so the run stays short; the boss id comes from
	# data/campaigns.json.
	if not _boss_requested:
		_boss_requested = true
		var player: Node = current_scene.get_node_or_null("Player")
		var boss_manager: Node = root.get_node_or_null("BossManager")
		if boss_manager and player and boss_manager.has_method("start_boss_encounter"):
			boss_manager.start_boss_encounter(boss_manager.BossType.GUARDIAN, player)
		spawner.spawn_boss()
	if not await _wait_until(func() -> bool: return _boss_on_camera(110.0), "the boss to spawn"):
		_finish()
		return
	await _capture("boss_spawn")

	_finish()


## True when a stage enemy is alive and inside the camera frustum, so the
## capture actually shows the wave instead of an empty background.
func _enemy_on_camera(spawner: Node, _max_distance: float) -> bool:
	if spawner == null:
		return false
	for enemy in spawner.active_enemies:
		if is_instance_valid(enemy) and _is_on_screen(enemy):
			return true
	return false


## True when the boss is alive and inside the camera frustum.
func _boss_on_camera(_max_distance: float) -> bool:
	for boss in get_nodes_in_group("Boss"):
		if is_instance_valid(boss) and _is_on_screen(boss):
			return true
	return false


## True when the node's world position falls inside the 2D camera's view.
func _is_on_screen(node: Node2D) -> bool:
	var camera: Camera2D = current_scene.get_node_or_null("Camera2D") if current_scene else null
	if camera == null:
		return false
	var view_size: Vector2 = root.get_visible_rect().size
	var zoom: Vector2 = camera.zoom
	var half: Vector2 = view_size / (2.0 * zoom)
	var center: Vector2 = camera.get_screen_center_position()
	var offset: Vector2 = node.global_position - center
	return absf(offset.x) <= half.x and absf(offset.y) <= half.y


func _on_arrow_fired(_position: Vector2, _direction: Vector2) -> void:
	_shots_fired += 1


## Captures the real viewport image and prints one structured report line.
func _capture(step: String) -> void:
	await RenderingServer.frame_post_draw
	var record: Dictionary = {"step": step, "elapsed_ms": _elapsed_ms(), "errors_logged": _errors}
	var spawner: Node = root.get_node_or_null("EnemySpawner")
	if spawner:
		record["enemies_spawned"] = spawner.total_enemies_for_stage
		record["enemies_alive"] = spawner.active_enemies.size()
		record["enemies_killed"] = spawner.enemies_defeated
		record["wave"] = spawner.current_wave
	record["shots_fired"] = _shots_fired

	var image: Image = root.get_texture().get_image()
	if image == null:
		record["status"] = "no_image"
		record["width"] = 0
		record["height"] = 0
		record["distinct_colors"] = 0
		_fail_step("viewport texture is not readable at step %s (headless dummy renderer?)" % step)
		_captures.append(record)
		_print_capture(record)
		return

	record["width"] = image.get_width()
	record["height"] = image.get_height()
	record["distinct_colors"] = _count_distinct_colors(image)
	var path: String = "%s/%02d_%s.png" % [_out_dir, _captures.size() + 1, step]
	var err: int = image.save_png(path)
	if err != OK:
		record["status"] = "save_failed"
		_fail_step("could not save capture %s (error %d)" % [path, err])
	else:
		record["status"] = "ok"
		record["path"] = path
		record["bytes"] = _file_size(path)
	if int(record["width"]) <= 1 or int(record["height"]) <= 1:
		_fail_step("capture %s is %sx%s (placeholder-sized)" % [step, record["width"], record["height"]])
	if int(record["distinct_colors"]) <= 1:
		_fail_step("capture %s is a uniform image (%d distinct colors)" % [step, record["distinct_colors"]])
	_captures.append(record)
	_print_capture(record)


func _print_capture(record: Dictionary) -> void:
	print("SPIKE_CAPTURE " + JSON.stringify(record))


## Counts distinct sampled colors so a placeholder/blank frame is detectable.
func _count_distinct_colors(image: Image) -> int:
	var seen: Dictionary = {}
	var width: int = image.get_width()
	var height: int = image.get_height()
	var y: int = 0
	while y < height:
		var x: int = 0
		while x < width:
			seen[image.get_pixel(x, y).to_rgba32()] = true
			x += SAMPLE_STRIDE
		y += SAMPLE_STRIDE
	return seen.size()


func _file_size(path: String) -> int:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return -1
	var length: int = file.get_length()
	file.close()
	return length


## Byte-level difference ratio between two captures (0.0 = identical).
func _diff_ratio(a: Dictionary, b: Dictionary) -> float:
	var path_a: String = a.get("path", "")
	var path_b: String = b.get("path", "")
	if path_a == "" or path_b == "":
		return -1.0
	var image_a := Image.load_from_file(path_a)
	var image_b := Image.load_from_file(path_b)
	if image_a == null or image_b == null:
		return -1.0
	if image_a.get_size() != image_b.get_size():
		return -1.0
	var data_a: PackedByteArray = image_a.get_data()
	var data_b: PackedByteArray = image_b.get_data()
	if data_a.size() == 0:
		return -1.0
	var differing: int = 0
	for i in data_a.size():
		if data_a[i] != data_b[i]:
			differing += 1
	return float(differing) / float(data_a.size())


func _finish() -> void:
	var summary: Dictionary = {
		"stage": _stage_id,
		"elapsed_ms": _elapsed_ms(),
		"captures": _captures.size(),
		"shots_fired": _shots_fired,
		"errors_logged": _errors,
		"exit_code": _exit_code,
	}
	var diffs: Array = []
	for i in range(1, _captures.size()):
		diffs.append({"from": _captures[i - 1].get("step", ""), "to": _captures[i].get("step", ""),
			"diff_ratio": _diff_ratio(_captures[i - 1], _captures[i])})
	summary["pairwise_diff_ratio"] = diffs
	var ok: bool = _errors == 0 and _captures.size() == CAPTURE_STEPS.size()
	for capture in _captures:
		if capture.get("status", "") != "ok":
			ok = false
	summary["result"] = "PASS" if ok else "FAIL"
	print("SPIKE_SUMMARY " + JSON.stringify(summary))
	print("SPIKE RESULT: %s" % summary["result"])

	var audio: Node = root.get_node_or_null("AudioManager")
	if audio:
		if audio.has_method("stop_all"):
			audio.stop_all()
		if audio.has_method("stop_music"):
			audio.stop_music()
	if current_scene:
		current_scene.queue_free()
	await process_frame
	await process_frame
	OS.delay_msec(100)
	quit(_exit_code)
