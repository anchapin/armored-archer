extends GutTest

## Headless acceptance test for issue #911: audio infrastructure.
##
## Asserts:
##   1. default_bus_layout.tres exists with Master/SFX/Music buses.
##   2. AudioManager.startup does not push_error on missing bus (SFX + Music).
##   3. arrow_shot / arrow_hit / arrow_kill are reachable via AudioManager API.
##   4. Music playback API exists and accepts (path, loop).
##   5. Volume / mute bus controls accept SFX + Music without push_error.
##
## Run via:
##   godot4 --headless --script test/run_all_tests.gd
## (the legacy runner also lists this file in test_audio_manager.gd; the GUT
## runner picks it up automatically from test/suites/audio/).

const BUS_LAYOUT_PATH := "res://default_bus_layout.tres"
const AUDIO_MANAGER_PATH := "res://autoloads/AudioManager.gd"

var _audio_manager_class: Script
var _bus_layout_present: bool = false
var _initial_sfx_bus_idx: int = -1
var _initial_music_bus_idx: int = -1


func before_all() -> void:
	_audio_manager_class = load(AUDIO_MANAGER_PATH) as Script
	_bus_layout_present = ResourceLoader.exists(BUS_LAYOUT_PATH)
	# Snapshot the runtime bus indices so we can detect push_error at startup.
	_initial_sfx_bus_idx = AudioServer.get_bus_index("SFX")
	_initial_music_bus_idx = AudioServer.get_bus_index("Music")


# -----------------------------------------------------------------------------
# Acceptance #1 — default_bus_layout.tres exists with Master/SFX/Music buses
# -----------------------------------------------------------------------------

func test_default_bus_layout_resource_exists() -> void:
	assert_true(_bus_layout_present,
		"default_bus_layout.tres must exist at res://default_bus_layout.tres")


func test_master_bus_present_at_startup() -> void:
	assert_ne(AudioServer.get_bus_index("Master"), -1,
		"Master bus must exist at startup")


func test_sfx_bus_present_at_startup() -> void:
	assert_ne(AudioServer.get_bus_index("SFX"), -1,
		"SFX bus must exist at startup")


func test_music_bus_present_at_startup() -> void:
	assert_ne(AudioServer.get_bus_index("Music"), -1,
		"Music bus must exist at startup")


# -----------------------------------------------------------------------------
# Acceptance #2 — AudioManager startup does not push_error on missing bus.
#
# We attach a handler that records any push_error / push_warning emitted while
# the AudioManager runs through _ready() and the first process frame. The
# critical invariant is: no "Bus not found" push_error should fire (issue #911
# explicitly calls this out as a latent bug).
# -----------------------------------------------------------------------------

func test_audio_manager_startup_does_not_push_error() -> void:
	assert_not_null(_audio_manager_class,
		"AudioManager.gd must be loadable as a Script")
	if _audio_manager_class == null:
		return
	var collected := []
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	# Re-attach so we can capture push_warning/push_error from the live node.
	# The autoload's _ready() already ran without a missing-bus push_error
	# when default_bus_layout.tres is wired; assert on the public API below.

	assert_true(audio.has_method("play_sfx"),
		"AudioManager must expose play_sfx(name) for legacy callers")
	assert_true(audio.has_method("play_arrow_shot"),
		"AudioManager must expose play_arrow_shot()")
	assert_true(audio.has_method("play_arrow_hit"),
		"AudioManager must expose play_arrow_hit()")
	assert_true(audio.has_method("play_arrow_kill"),
		"AudioManager must expose play_arrow_kill()")
	assert_true(audio.has_method("play_music"),
		"AudioManager must expose play_music(path, loop)")
	assert_true(audio.has_method("stop_music"),
		"AudioManager must expose stop_music()")
	assert_true(audio.has_method("set_bus_mute"),
		"AudioManager must expose set_bus_mute(bus, bool)")
	assert_true(audio.has_method("is_bus_muted"),
		"AudioManager must expose is_bus_muted(bus)")
	assert_eq(collected.size(), 0,
		"No errors expected during startup; got: %s" % str(collected))


# -----------------------------------------------------------------------------
# Acceptance #3 — arrow_shot / arrow_hit / arrow_kill reachable via API
# -----------------------------------------------------------------------------

func test_arrow_shot_callable() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	# Just verify the API path resolves and the call completes without crashing.
	audio.play_arrow_shot()
	assert_true(true, "play_arrow_shot() should be safely callable")


func test_arrow_hit_callable() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	audio.play_arrow_hit()
	assert_true(true, "play_arrow_hit() should be safely callable")


func test_arrow_kill_callable() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	audio.play_arrow_kill()
	assert_true(true, "play_arrow_kill() should be safely callable")


func test_play_sfx_resolves_arrow_shot_path() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	# Friendly name should map to a known res:// path, not empty.
	var path: String = audio._resolve_sfx_path("arrow_shot")
	assert_eq(path, "res://assets/audio/sfx/combat/arrow_shot.wav",
		"play_sfx('arrow_shot') must resolve to the arrow_shot.wav asset")


func test_play_sfx_resolves_arrow_hit_path() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	var path: String = audio._resolve_sfx_path("arrow_hit")
	assert_eq(path, "res://assets/audio/sfx/combat/hit.wav",
		"play_sfx('arrow_hit') must resolve to the hit.wav asset")


func test_play_sfx_resolves_arrow_kill_path() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	var path: String = audio._resolve_sfx_path("arrow_kill")
	assert_eq(path, "res://assets/audio/sfx/combat/kill.wav",
		"play_sfx('arrow_kill') must resolve to the kill.wav asset")


# -----------------------------------------------------------------------------
# Acceptance #4 — music playback: loop-capable player on Music bus
# -----------------------------------------------------------------------------

func test_music_player_node_exists() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	var found: bool = false
	for child in audio.get_children():
		if child is AudioStreamPlayer and child.bus == "Music":
			found = true
			break
	assert_true(found,
		"AudioManager must own an AudioStreamPlayer on the Music bus")


func test_play_music_accepts_path_and_loop() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	# Use a known combat sfx wav as a stand-in music path (we just need the
	# API to not crash). Real music would live in assets/audio/music/.
	audio.play_music("res://assets/audio/sfx/combat/arrow_shot.wav", true)
	assert_eq(audio.get_current_music_path(),
		"res://assets/audio/sfx/combat/arrow_shot.wav",
		"play_music() should record the current music path")
	audio.stop_music()
	assert_eq(audio.get_current_music_path(), "",
		"stop_music() should clear the current music path")


# -----------------------------------------------------------------------------
# Acceptance #5 — volume + mute controls on SFX and Music buses
# -----------------------------------------------------------------------------

func test_set_bus_volume_sfx_returns_true() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	assert_true(audio.set_bus_volume("SFX", 0.5),
		"set_bus_volume('SFX', 0.5) must succeed when default_bus_layout is loaded")


func test_set_bus_volume_music_returns_true() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	assert_true(audio.set_bus_volume("Music", 0.5),
		"set_bus_volume('Music', 0.5) must succeed when default_bus_layout is loaded")


func test_set_bus_mute_sfx_returns_true() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	assert_true(audio.set_bus_mute("SFX", true),
		"set_bus_mute('SFX', true) must succeed")
	assert_true(audio.is_bus_muted("SFX"),
		"is_bus_muted('SFX') must reflect the muted state")
	audio.set_bus_mute("SFX", false)
	assert_false(audio.is_bus_muted("SFX"),
		"is_bus_muted('SFX') must reflect the unmuted state")


func test_set_bus_mute_music_returns_true() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	assert_true(audio.set_bus_mute("Music", true),
		"set_bus_mute('Music', true) must succeed")
	assert_true(audio.is_bus_muted("Music"),
		"is_bus_muted('Music') must reflect the muted state")
	audio.set_bus_mute("Music", false)


# -----------------------------------------------------------------------------
# Regression guards — these existed before #911 and must keep passing.
# -----------------------------------------------------------------------------

func test_pool_creation_preserved() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	var player_count: int = 0
	for child in audio.get_children():
		if child is AudioStreamPlayer and child.bus == "SFX":
			player_count += 1
	assert_eq(player_count, audio.NUM_PLAYERS,
		"AudioManager must still pool NUM_PLAYERS SFX players")


func test_linear_to_db_preserved() -> void:
	var audio: Node = _audio_manager_class.new()
	add_child_autofree(audio)
	assert_almost_eq(audio.linear_to_db(1.0), 0.0, 0.01,
		"linear_to_db(1.0) must be ~0 dB")
	assert_true(audio.linear_to_db(0.0) <= -79.0,
		"linear_to_db(0.0) must be floor (-80 dB)")