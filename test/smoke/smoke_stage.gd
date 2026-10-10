## Headless smoke test: boot the stage scene and play it for a fixed time (#1464).
##
## Usage:
##   godot --headless -s res://test/smoke/smoke_stage.gd -- [--seconds=60] [--min-alive=10]
##
## Fails (exit 1) when the scene can't load, or the player dies before
## --min-alive seconds. Script/parse errors are caught by scripts/smoke_stage.sh,
## which greps the engine log.
extends SceneTree

const STAGE_SCENE := "res://scenes/main.tscn"

var _seconds: float = 60.0
var _min_alive: float = 10.0
var _elapsed: float = 0.0
var _died_at: float = -1.0
var _won: bool = false
var _max_enemies: int = 0


func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--seconds="):
			_seconds = float(arg.get_slice("=", 1))
		elif arg.begins_with("--min-alive="):
			_min_alive = float(arg.get_slice("=", 1))
	var packed: PackedScene = load(STAGE_SCENE)
	if packed == null:
		printerr("SMOKE FAIL: could not load %s" % STAGE_SCENE)
		quit(1)
		return
	change_scene_to_packed(packed)
	var gm: Node = root.get_node_or_null("GameManager")
	if gm:
		if gm.has_signal("player_died"):
			gm.player_died.connect(func(): if _died_at < 0.0: _died_at = _elapsed)
		if gm.has_signal("game_won"):
			gm.game_won.connect(func(): _won = true)
	print("SMOKE: playing %s for %.0fs (player must survive %.0fs)" % [STAGE_SCENE, _seconds, _min_alive])


func _process(delta: float) -> bool:
	_elapsed += delta
	var spawner: Node = root.get_node_or_null("EnemySpawner")
	if spawner and "active_enemies" in spawner:
		_max_enemies = max(_max_enemies, spawner.active_enemies.size())
	if _won or _elapsed >= _seconds or (_died_at >= 0.0 and _elapsed - _died_at > 1.0):
		_finish()
		return true
	return false


func _finish() -> void:
	var result := "won" if _won else ("died at %.1fs" % _died_at if _died_at >= 0.0 else "alive")
	print("SMOKE RESULT: elapsed=%.1fs player=%s max_enemies_on_screen=%d" % [_elapsed, result, _max_enemies])
	if _died_at >= 0.0 and _died_at < _min_alive:
		printerr("SMOKE FAIL: player died after %.1fs (minimum %.0fs)" % [_died_at, _min_alive])
		quit(1)
		return
	print("SMOKE PASS")
	quit(0)
