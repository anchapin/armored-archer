extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running AudioManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_constants()
	await test_initial_state()
	await test_pool_creation()
	await test_play_null_stream()
	await test_play_empty_path()
	await test_set_bus_volume()
	await test_get_bus_volume()
	await test_linear_to_db()
	await test_db_to_linear()
	await test_available_player_count()
	await test_active_player_count()
	await test_queued_sound_count()
	await test_stop_all()
	await test_clear_queue()

	print("\n=== AudioManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_audio_manager() -> Node:
	var audio = load("res://autoloads/AudioManager.gd").new()
	add_child(audio)
	await get_tree().process_frame
	return audio

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_constants() -> void:
	var audio = await _create_audio_manager()

	if audio.NUM_PLAYERS == 10:
		_pass("test_num_players_constant")
	else:
		_fail("test_num_players_constant", "NUM_PLAYERS should be 10")

	if audio.SFX_BUS == "SFX":
		_pass("test_sfx_bus_constant")
	else:
		_fail("test_sfx_bus_constant", "SFX_BUS should be 'SFX'")

	audio.queue_free()

func test_initial_state() -> void:
	var audio = await _create_audio_manager()

	if audio._available.size() == audio.NUM_PLAYERS:
		_pass("test_initial_available_players")
	else:
		_fail("test_initial_available_players", "Should have 10 available players")

	if audio._active.is_empty():
		_pass("test_initial_no_active_players")
	else:
		_fail("test_initial_no_active_players", "Should have no active players initially")

	if audio._queue.is_empty():
		_pass("test_initial_empty_queue")
	else:
		_fail("test_initial_empty_queue", "Queue should be empty initially")

	audio.queue_free()

func test_pool_creation() -> void:
	var audio = await _create_audio_manager()
	var sfx_player_count = 0

	for child in audio.get_children():
		# Issue #911: AudioManager now also owns a music player on the Music
		# bus; count only the SFX-bus players to match NUM_PLAYERS.
		if child is AudioStreamPlayer and child.bus == audio.SFX_BUS:
			sfx_player_count += 1

	if sfx_player_count == audio.NUM_PLAYERS:
		_pass("test_pool_creation")
	else:
		_fail("test_pool_creation", "Should have %d SFX AudioStreamPlayer children" % audio.NUM_PLAYERS)

	audio.queue_free()

func test_play_null_stream() -> void:
	var audio = await _create_audio_manager()

	audio.play(null)

	if audio.get_queued_sound_count() == 0:
		_pass("test_play_null_stream_ignored")
	else:
		_fail("test_play_null_stream_ignored", "Null stream should not be queued")

	audio.queue_free()

func test_play_empty_path() -> void:
	var audio = await _create_audio_manager()

	audio.play_path("")

	if audio.get_queued_sound_count() == 0:
		_pass("test_play_empty_path_ignored")
	else:
		_fail("test_play_empty_path_ignored", "Empty path should not be queued")

	audio.queue_free()

func test_set_bus_volume() -> void:
	var audio = await _create_audio_manager()

	audio.set_bus_volume("SFX", 0.5)

	_pass("test_set_bus_volume_no_crash")

	audio.queue_free()

func test_get_bus_volume() -> void:
	var audio = await _create_audio_manager()

	var vol = audio.get_bus_volume("SFX")

	if vol >= 0.0 and vol <= 1.0:
		_pass("test_get_bus_volume_in_range")
	else:
		_fail("test_get_bus_volume_in_range", "Volume should be between 0 and 1")

	audio.queue_free()

func test_linear_to_db() -> void:
	var audio = await _create_audio_manager()

	var db = audio.linear_to_db(0.5)

	if db < 0.0 and db > -80.0:
		_pass("test_linear_to_db_negative_range")
	else:
		_fail("test_linear_to_db_negative_range", "dB should be negative for volume < 1")

	var zero_db = audio.linear_to_db(1.0)
	if abs(zero_db) < 0.01:
		_pass("test_linear_to_db_max_volume")
	else:
		_fail("test_linear_to_db_max_volume", "1.0 linear should be 0 dB")

	var min_db = audio.linear_to_db(0.0)
	if min_db <= -79.0:
		_pass("test_linear_to_db_zero_volume")
	else:
		_fail("test_linear_to_db_zero_volume", "0.0 linear should be -80 dB")

	audio.queue_free()

func test_db_to_linear() -> void:
	var audio = await _create_audio_manager()

	var linear = audio.db_to_linear(0.0)

	if abs(linear - 1.0) < 0.01:
		_pass("test_db_to_linear_zero_db")
	else:
		_fail("test_db_to_linear_zero_db", "0 dB should be 1.0 linear")

	var neg_linear = audio.db_to_linear(-6.0)
	if neg_linear > 0.4 and neg_linear < 0.6:
		_pass("test_db_to_linear_negative_db")
	else:
		_fail("test_db_to_linear_negative_db", "-6 dB should be ~0.5 linear")

	audio.queue_free()

func test_available_player_count() -> void:
	var audio = await _create_audio_manager()

	var count = audio.get_available_player_count()

	if count == audio.NUM_PLAYERS:
		_pass("test_available_player_count")
	else:
		_fail("test_available_player_count", "Should return 10")

	audio.queue_free()

func test_active_player_count() -> void:
	var audio = await _create_audio_manager()

	var count = audio.get_active_player_count()

	if count == 0:
		_pass("test_active_player_count_zero")
	else:
		_fail("test_active_player_count_zero", "Should be 0 with no sounds playing")

	audio.queue_free()

func test_queued_sound_count() -> void:
	var audio = await _create_audio_manager()

	var count = audio.get_queued_sound_count()

	if count == 0:
		_pass("test_queued_sound_count_initial")
	else:
		_fail("test_queued_sound_count_initial", "Should be 0 initially")

	audio.queue_free()

func test_stop_all() -> void:
	var audio = await _create_audio_manager()

	audio.stop_all()

	if audio._active.is_empty():
		_pass("test_stop_all_clears_active")
	else:
		_fail("test_stop_all_clears_active", "Active list should be empty")

	audio.queue_free()

func test_clear_queue() -> void:
	var audio = await _create_audio_manager()

	audio.clear_queue()

	if audio._queue.is_empty():
		_pass("test_clear_queue")
	else:
		_fail("test_clear_queue", "Queue should be empty")

	audio.queue_free()