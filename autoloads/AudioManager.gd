extends Node

## Audio Manager - Singleton for SFX + music playback with pooled SFX players,
## a dedicated music player on the Music bus, bus volume/mute controls, and
## lightweight persistence of audio settings to user://audio_settings.cfg.
##
## Issue #911 acceptance:
##   - default_bus_layout.tres (Master/SFX/Music) is wired in project.godot so
##     `set_bus_volume("SFX", …)` no longer push_errors at runtime.
##   - `play_sfx(name)` routes named SFX (arrow_shot/arrow_hit/arrow_kill,
##     shoot, reload, level_up, …) to AudioStreams and the existing SFX pool.
##   - Music playback uses a single AudioStreamPlayer on the Music bus with a
##     loopable stream and an API to switch menu/combat tracks at runtime.
##   - Settings UI binds to set_bus_volume / set_bus_mute for SFX + Music.
##
## Issue #914 acceptance:
##   - `play_event(name)` centralizes the full ratified inventory (arrow_shot /
##     arrow_hit / arrow_kill, the 4 archetype deaths, boss_intro / boss_death,
##     wave_clear, stage_win / stage_lose, loot_pickup, ui_click). Unknown
##     names log a warning and resolve to silence — no push_error spam.
##   - `play_music_menu()` / `play_music_combat()` no-arg overloads read the
##     default tracks declared in autoloads/const.gd (issue #912 pending).
##   - Listens for SceneTree.tree_changed to switch music on scene transitions
##     and stops music cleanly on WM_CLOSE_REQUEST (app exit).

# --- Configuration constants ---
const NUM_PLAYERS: int = 10
const SFX_BUS: String = "SFX"
const MUSIC_BUS: String = "Music"
const SETTINGS_FILE: String = "user://audio_settings.cfg"
const SETTINGS_SECTION: String = "audio"
const DEFAULT_DB_FLOOR: float = -80.0

# --- Event → path map (issue #914) ---
# Every entry in the ratified sound-event inventory maps to a res:// path.
# Files pending procurement (issue #912) are kept here so callers don't have to
# branch on availability — the file is loaded with `load(path)` and a missing
# file logs a warning (never push_error) and resolves to silence.
const _EVENT_PATHS: Dictionary = {
    # Combat — arrow flight
    "arrow_shot": "res://assets/audio/sfx/combat/arrow_shot.wav",
    "arrow_hit": "res://assets/audio/sfx/combat/hit.wav",
    "arrow_kill": "res://assets/audio/sfx/combat/kill.wav",
    # Combat — per-archetype death (Ch1 archetypes)
    "archetype_death_goblin": "res://assets/audio/sfx/combat/archetype_death_goblin.wav",
    "archetype_death_wolf": "res://assets/audio/sfx/combat/archetype_death_wolf.wav",
    "archetype_death_guardian": "res://assets/audio/sfx/combat/archetype_death_guardian.wav",
    "archetype_death_elemental": "res://assets/audio/sfx/combat/archetype_death_elemental.wav",
    # Combat — boss
    "boss_intro": "res://assets/audio/sfx/combat/boss_intro.wav",
    "boss_death": "res://assets/audio/sfx/combat/boss_death.wav",
    # Combat — flow
    "wave_clear": "res://assets/audio/sfx/combat/wave_clear.wav",
    "stage_win": "res://assets/audio/sfx/combat/stage_win.wav",
    "stage_lose": "res://assets/audio/sfx/combat/stage_lose.wav",
    "loot_pickup": "res://assets/audio/sfx/combat/loot_pickup.wav",
    # UI
    "ui_click": "res://assets/audio/sfx/ui/click.wav",
}

# --- Scene-name → music-track routing (issue #914) ---
# Strings derived from res:// scene paths (basename, lower-cased). When the
# active scene's basename matches, the matching track plays. Anything else
# defaults to combat. Add entries above as new menu-style scenes ship.
const _MENU_SCENE_KEYS: Array[String] = [
    "login_screen",
    "main_menu",
    "campaign_map",
    "loadout",
    "cosmetic_shop",
    "store_menu",
    "settings_menu",
    "leaderboard_menu",
    "matchmaking_menu",
    "matchmaking_queue",
    "game_over",
]

# --- SFX pool (existing) ---
var _available: Array[AudioStreamPlayer] = []
var _active: Array[AudioStreamPlayer] = []
var _queue: Array[AudioStream] = []

# --- Music playback ---
var _music_player: AudioStreamPlayer
var _current_music_path: String = ""
var _current_music_loop: bool = true

# --- Persistence cache ---
var _settings_loaded: bool = false
var _sfx_volume: float = 1.0
var _music_volume: float = 1.0
var _sfx_muted: bool = false
var _music_muted: bool = false


func _ready() -> void:
	# SFX pool
	for i in NUM_PLAYERS:
		var player := AudioStreamPlayer.new()
		player.name = "SFXPlayer_%d" % i
		player.bus = SFX_BUS
		add_child(player)
		_available.append(player)
		player.finished.connect(_on_stream_finished.bind(player))

	# Music player
	_music_player = AudioStreamPlayer.new()
	_music_player.name = "MusicPlayer"
	_music_player.bus = MUSIC_BUS
	add_child(_music_player)

	# Load persisted settings and apply; warn (never push_error) on missing bus
	_load_settings()
	_apply_settings()

	# Issue #914: listen for scene transitions to swap menu↔combat music and
	# stop cleanly on app exit. tree_changed fires after scene swaps, so the
	# current_scene is the newly-arrived one when we react.
	var tree := get_tree()
	if tree:
		tree.tree_changed.connect(_on_tree_changed)

	print("[AudioManager] Initialized (SFX pool=%d, music bus=%s)" % [NUM_PLAYERS, MUSIC_BUS])


# =============================================================================
# SFX playback
# =============================================================================

func _on_stream_finished(player: AudioStreamPlayer) -> void:
	_available.append(player)
	_active.erase(player)
	_process_queue()

func _process(_delta: float) -> void:
	_process_queue()

func _process_queue() -> void:
	while not _queue.is_empty() and not _available.is_empty():
		var stream: AudioStream = _queue.pop_front()
		var player: AudioStreamPlayer = _available.pop_front()
		player.stream = stream
		player.play()
		_active.append(player)

## Play an AudioStream directly (queued through the SFX pool).
func play(stream: AudioStream) -> void:
	if stream == null:
		push_warning("[AudioManager] Attempted to play null stream")
		return
	_queue.append(stream)

## Play a sound from a res:// path.
func play_path(path: String) -> void:
	if path.is_empty():
		push_warning("[AudioManager] Attempted to play empty path")
		return
	# ResourceLoader.exists is the cheap pre-check before a noisy load(). Files
	# pending procurement (issue #912) legitimately don't yet — issue #914
	# keeps the logic clean by warning, never erroring.
	if not ResourceLoader.exists(path):
		push_warning("[AudioManager] Sound asset missing (procurement pending): %s" % path)
		return
	var stream: AudioStream = load(path) as AudioStream
	if stream == null:
		push_warning("[AudioManager] Failed to load sound: %s" % path)
		return
	play(stream)

## Play a named SFX. Maps friendly names to res:// paths (issue #911 callers).
## Falls back to play_path on miss. Returns true if a stream was queued.
func play_sfx(name: String) -> bool:
	if name.is_empty():
		push_warning("[AudioManager] play_sfx called with empty name")
		return false
	if not _has_bus(SFX_BUS):
		# Bus missing means default_bus_layout.tres was not loaded; never push_error.
		push_warning("[AudioManager] SFX bus unavailable, skipping '%s'" % name)
		return false
	var path := _resolve_sfx_path(name)
	if path.is_empty():
		push_warning("[AudioManager] Unknown SFX name '%s'" % name)
		return false
	play_path(path)
	return true

## Convenience for the explicit combat calls wired in scripts/arrow.gd.
func play_arrow_shot() -> void: play_sfx("arrow_shot")

## Convenience for arrow-on-enemy impact wired in scripts/arrow.gd.
func play_arrow_hit() -> void: play_sfx("arrow_hit")

## Convenience for kill wired in scenes/enemies/base_enemy.gd.die().
func play_arrow_kill() -> void: play_sfx("arrow_kill")

## Centralized sound-event dispatcher (issue #914).
##
## Accepts any name from the ratified inventory (arrow_shot/hit/kill, the four
## archetype_death_* variants, boss_intro / boss_death, wave_clear, stage_win /
## stage_lose, loot_pickup, ui_click). Unknown names log a warning and return
## false. Files missing on disk (procurement pending, issue #912) log a
## warning and resolve to silence — never a hard push_error.
##
## Returns true if a stream was successfully queued for playback.
func play_event(event_name: String) -> bool:
	if event_name.is_empty():
		push_warning("[AudioManager] play_event called with empty name")
		return false
	if not _has_bus(SFX_BUS):
		push_warning("[AudioManager] SFX bus unavailable, skipping '%s'" % event_name)
		return false
	var path: String = _EVENT_PATHS.get(event_name, "")
	if path.is_empty():
		push_warning("[AudioManager] Unknown sound event '%s'" % event_name)
		return false
	play_path(path)
	return true

## Resolve an event name to its res:// path (issue #914). Public so tests can
## assert the full inventory is wired without touching the audio pool.
func get_event_path(event_name: String) -> String:
	return _EVENT_PATHS.get(event_name, "")

## Inventory check for tests + UIs (issue #914).
func has_event(event_name: String) -> bool:
	return _EVENT_PATHS.has(event_name)

## Full inventory keys in declaration order. Used by tests to assert wiring
## without callers having to maintain their own copy.
func get_all_event_names() -> Array[String]:
	var keys: Array[String] = []
	for k in _EVENT_PATHS.keys():
		keys.append(k)
	return keys

func _resolve_sfx_path(name: String) -> String:
	# Allow callers to pass either friendly names or full res:// paths.
	if name.begins_with("res://"):
		return name
	match name:
		"arrow_shot", "shoot":
			return "res://assets/audio/sfx/combat/arrow_shot.wav"
		"arrow_hit", "hit":
			return "res://assets/audio/sfx/combat/hit.wav"
		"arrow_kill", "kill":
			return "res://assets/audio/sfx/combat/kill.wav"
		"reload":
			return "res://assets/audio/sfx/combat/reload.wav"
		"level_up":
			return "res://assets/audio/sfx/combat/level_up.wav"
	return ""


# =============================================================================
# Music playback
# =============================================================================

## Play a music track on the Music bus. Pass loop=true for menu/combat loops.
## If a track is already playing, it crossfades by simply swapping streams.
func play_music(path: String, loop: bool = true) -> void:
	if path.is_empty():
		push_warning("[AudioManager] play_music called with empty path")
		return
	if not _has_bus(MUSIC_BUS):
		push_warning("[AudioManager] Music bus unavailable, skipping '%s'" % path)
		return
	if path == _current_music_path and _music_player.playing:
		return
	# Issue #914: missing music files (procurement pending) warn, never error.
	if not ResourceLoader.exists(path):
		push_warning("[AudioManager] Music asset missing (procurement pending): %s" % path)
		return
	var stream: AudioStream = load(path) as AudioStream
	if stream == null:
		push_warning("[AudioManager] Failed to load music: %s" % path)
		return
	# Looping support — both AudioStreamWAV and AudioStreamOgg have loop=false default.
	if stream is AudioStreamWAV:
		(stream as AudioStreamWAV).loop_mode = (
			AudioStreamWAV.LOOP_FORWARD if loop else AudioStreamWAV.LOOP_DISABLED
		)
	elif stream is AudioStreamOggVorbis:
		(stream as AudioStreamOggVorbis).loop = loop
	elif stream is AudioStreamMP3:
		(stream as AudioStreamMP3).loop = loop
	_current_music_path = path
	_current_music_loop = loop
	_music_player.stream = stream
	_music_player.play()

## Convenience for menu tracks (path overload — preserved from #911).
func play_music_menu(path: String) -> void: play_music(path, true)

## Convenience for combat tracks (path overload — preserved from #911).
func play_music_combat(path: String) -> void: play_music(path, true)

## Default menu music — reads `const.MENU_MUSIC_PATH` (issue #914).
## No-arg form for callers that don't want to know the file path.
func play_default_music_menu() -> void:
	var menu_path: String = _resolve_const_path("MENU_MUSIC_PATH", "res://assets/audio/music/menu_loop.ogg")
	play_music(menu_path, true)

## Default combat music — reads `const.COMBAT_MUSIC_PATH` (issue #914).
func play_default_music_combat() -> void:
	var combat_path: String = _resolve_const_path("COMBAT_MUSIC_PATH", "res://assets/audio/music/combat_loop.ogg")
	play_music(combat_path, true)

## Look up a `const.<Name>` on autoloads/const.gd without a hard dependency on
## the script being loaded. Returns the fallback when the const isn't defined.
func _resolve_const_path(const_name: String, fallback: String) -> String:
	var const_script := load("res://autoloads/const.gd")
	if const_script == null:
		return fallback
	if const_name in const_script:
		return str(const_script.get(const_name))
	return fallback

# --- Scene-driven auto-switching (issue #914) ---
## SceneTree.tree_changed fires after the active scene is swapped. Inspect the
## current scene's basename and start the right loop, or stop music on exit.
## Guarded against tree teardown (get_tree() returns null mid-cleanup).
func _on_tree_changed() -> void:
	if not is_inside_tree():
		return
	var tree := get_tree()
	if tree == null:
		stop_music()
		return
	var current := tree.current_scene
	if current == null:
		stop_music()
		return
	var basename := _scene_basename(current.scene_file_path)
	if basename == "":
		# Not loaded from a .tscn (programmatic scene) — keep whatever's playing.
		return
	if _is_menu_scene(basename):
		play_default_music_menu()
	else:
		play_default_music_combat()

func _scene_basename(path: String) -> String:
	if path.is_empty():
		return ""
	# "res://scenes/ui/main_menu.tscn" → "main_menu"
	var no_ext := path.get_basename()
	var slash_idx := no_ext.rfind("/")
	if slash_idx < 0:
		return no_ext.to_lower()
	return no_ext.substr(slash_idx + 1).to_lower()

func _is_menu_scene(basename: String) -> bool:
	for menu_name in _MENU_SCENE_KEYS:
		if menu_name.to_lower() == basename:
			return true
	return false

func _notification(what: int) -> void:
	# App exit — stop music cleanly so audio devices aren't held open by a
	# lingering AudioStreamPlayer on quit. (issue #914)
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		stop_music()

## Stop the currently playing music track.
func stop_music() -> void:
	if _music_player:
		_music_player.stop()
	_current_music_path = ""

func is_music_playing() -> bool:
	return _music_player != null and _music_player.playing

func get_current_music_path() -> String:
	return _current_music_path


# =============================================================================
# Bus controls (volume / mute) + persistence
# =============================================================================

## Set linear volume (0-1) for a bus. Returns true on success.
func set_bus_volume(bus_name: String, linear_volume: float) -> bool:
	if not _has_bus(bus_name):
		push_warning("[AudioManager] Bus not found: %s" % bus_name)
		return false
	var bus_idx: int = AudioServer.get_bus_index(bus_name)
	var clamped: float = clampf(linear_volume, 0.0, 1.0)
	AudioServer.set_bus_volume_db(bus_idx, linear_to_db(clamped))
	if bus_name == SFX_BUS:
		_sfx_volume = clamped
	elif bus_name == MUSIC_BUS:
		_music_volume = clamped
	_save_settings()
	return true

## Get linear volume (0-1) for a bus. Returns 0.0 if bus missing.
func get_bus_volume(bus_name: String) -> float:
	if not _has_bus(bus_name):
		return 0.0
	var bus_idx: int = AudioServer.get_bus_index(bus_name)
	return db_to_linear(AudioServer.get_bus_volume_db(bus_idx))

## Mute / unmute a bus. Returns true on success.
func set_bus_mute(bus_name: String, muted: bool) -> bool:
	if not _has_bus(bus_name):
		push_warning("[AudioManager] Bus not found: %s" % bus_name)
		return false
	var bus_idx: int = AudioServer.get_bus_index(bus_name)
	AudioServer.set_bus_mute(bus_idx, muted)
	if bus_name == SFX_BUS:
		_sfx_muted = muted
	elif bus_name == MUSIC_BUS:
		_music_muted = muted
	_save_settings()
	return true

func is_bus_muted(bus_name: String) -> bool:
	if not _has_bus(bus_name):
		return false
	var bus_idx: int = AudioServer.get_bus_index(bus_name)
	return AudioServer.is_bus_mute(bus_idx)

func _has_bus(bus_name: String) -> bool:
	return AudioServer.get_bus_index(bus_name) >= 0

func linear_to_db(linear: float) -> float:
	if linear <= 0.0:
		return DEFAULT_DB_FLOOR
	return 20.0 * log(linear) / log(10.0)

func db_to_linear(db: float) -> float:
	return pow(10.0, db / 20.0)


# =============================================================================
# Pool introspection (preserved for existing tests)
# =============================================================================

func get_available_player_count() -> int: return _available.size()
func get_active_player_count() -> int: return _active.size()
func get_queued_sound_count() -> int: return _queue.size()

func stop_all() -> void:
	for player in _active:
		player.stop()
	_active.clear()

func clear_queue() -> void:
	_queue.clear()


# =============================================================================
# Settings persistence
# =============================================================================

func _load_settings() -> void:
	_settings_loaded = true
	var cfg := ConfigFile.new()
	var err := cfg.load(SETTINGS_FILE)
	if err != OK:
		return
	_sfx_volume = float(cfg.get_value(SETTINGS_SECTION, "sfx_volume", 1.0))
	_music_volume = float(cfg.get_value(SETTINGS_SECTION, "music_volume", 1.0))
	_sfx_muted = bool(cfg.get_value(SETTINGS_SECTION, "sfx_muted", false))
	_music_muted = bool(cfg.get_value(SETTINGS_SECTION, "music_muted", false))

func _apply_settings() -> void:
	set_bus_volume(SFX_BUS, _sfx_volume)
	set_bus_volume(MUSIC_BUS, _music_volume)
	set_bus_mute(SFX_BUS, _sfx_muted)
	set_bus_mute(MUSIC_BUS, _music_muted)

func _save_settings() -> void:
	if not _settings_loaded:
		return
	var cfg := ConfigFile.new()
	cfg.set_value(SETTINGS_SECTION, "sfx_volume", _sfx_volume)
	cfg.set_value(SETTINGS_SECTION, "music_volume", _music_volume)
	cfg.set_value(SETTINGS_SECTION, "sfx_muted", _sfx_muted)
	cfg.set_value(SETTINGS_SECTION, "music_muted", _music_muted)
	cfg.save(SETTINGS_FILE)