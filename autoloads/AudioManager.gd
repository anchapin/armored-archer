extends Node

## Audio Manager - Singleton for SFX playback with pooled AudioStreamPlayer nodes
## Prevents audio cutoff during rapid combat by pooling 10 players

# Pool configuration - 10 players prevents cutoff during combat spam
const NUM_PLAYERS: int = 10
const SFX_BUS: String = "SFX"

# Pool of available AudioStreamPlayer nodes
var _available: Array[AudioStreamPlayer] = []
var _active: Array[AudioStreamPlayer] = []

# Queue for sounds when all players busy
var _queue: Array[AudioStream] = []

func _ready() -> void:
	# Create pool of AudioStreamPlayer nodes
	for i in NUM_PLAYERS:
		var player = AudioStreamPlayer.new()
		player.name = "SFXPlayer_%d" % i
		player.bus = SFX_BUS
		add_child(player)
		_available.append(player)
		player.finished.connect(_on_stream_finished.bind(player))

	print("[AudioManager] Initialized with %d pooled players" % NUM_PLAYERS)

func _on_stream_finished(player: AudioStreamPlayer) -> void:
	# Return player to available pool
	_available.append(player)
	_active.erase(player)

	# Play next queued sound if any
	_process_queue()

func _process(_delta: float) -> void:
	_process_queue()

func _process_queue() -> void:
	while not _queue.is_empty() and not _available.is_empty():
		var stream = _queue.pop_front()
		var player = _available.pop_front()
		player.stream = stream
		player.play()
		_active.append(player)

## Play an AudioStream directly
func play(stream: AudioStream) -> void:
	if stream == null:
		push_warning("[AudioManager] Attempted to play null stream")
		return
	_queue.append(stream)

## Play a sound from a file path (res://...)
func play_path(path: String) -> void:
	if path.is_empty():
		push_warning("[AudioManager] Attempted to play empty path")
		return
	
	var stream = load(path)
	if stream == null:
		push_error("[AudioManager] Failed to load sound: %s" % path)
		return
	
	play(stream)

## Set volume for an audio bus (0-1 linear scale)
func set_bus_volume(bus_name: String, linear_volume: float) -> void:
	var bus_idx = AudioServer.get_bus_index(bus_name)
	if bus_idx < 0:
		push_error("[AudioManager] Bus not found: %s" % bus_name)
		return
	
	var db = linear_to_db(linear_volume)
	AudioServer.set_bus_volume_db(bus_idx, db)

## Get volume for an audio bus (returns 0-1 linear scale)
func get_bus_volume(bus_name: String) -> float:
	var bus_idx = AudioServer.get_bus_index(bus_name)
	if bus_idx < 0:
		return 0.0
	return db_to_linear(AudioServer.get_bus_volume_db(bus_idx))

## Convert linear (0-1) to decibels (-80 to 0)
func linear_to_db(linear: float) -> float:
	if linear <= 0.0:
		return -80.0
	return 20.0 * log(linear) / log(10.0)

## Convert decibels to linear (0-1)
func db_to_linear(db: float) -> float:
	return pow(10.0, db / 20.0)

## Get number of available (idle) players
func get_available_player_count() -> int:
	return _available.size()

## Get number of active (playing) players
func get_active_player_count() -> int:
	return _active.size()

## Get number of sounds in queue
func get_queued_sound_count() -> int:
	return _queue.size()

## Stop all currently playing sounds
func stop_all() -> void:
	for player in _active:
		player.stop()
	_active.clear()

## Clear the sound queue
func clear_queue() -> void:
	_queue.clear()