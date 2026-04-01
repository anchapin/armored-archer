## Manages shooting mechanics for the player character.
## Provides centralized shooting logic, mode management, and cooldown handling.
##
## Usage:
##   ShootingManager.shoot_arrow(from_position, direction) - Fire an arrow
##   ShootingManager.can_shoot() - Check if player can shoot
##   ShootingManager.set_shooting_mode(mode) - Set AUTO or MANUAL mode
##   ShootingManager.handle_auto_shoot(delta) - Process auto-shoot logic
##
extends Node

# --- Signals ---
signal arrow_fired(position: Vector2, direction: Vector2)
signal ammo_changed(current_ammo: int, max_ammo: int)
signal shooting_mode_changed(mode: ShootingMode)

# --- Enums ---
enum ShootingMode {
	MANUAL,  # Player must press shoot button
	AUTO     # Auto-shoot when aiming at target
}

# --- Configuration ---
const BASE_COOLDOWN: float = 0.5  # Seconds between shots
const AUTO_SHOOT_COOLDOWN: float = 0.6  # Slightly longer for auto-shoot
const MAX_AMMO: int = 50  # Maximum ammo capacity

# --- State ---
var _shooting_mode: ShootingMode = ShootingMode.MANUAL
var _cooldown_timer: float = 0.0
var _current_ammo: int = MAX_AMMO
var _is_reloading: bool = false
var _reload_timer: float = 0.0
const RELOAD_TIME: float = 2.0  # Seconds to reload

# --- Settings Storage ---
const SETTINGS_FILE = "user://shooting_settings.json"

func _ready() -> void:
	_load_settings()
	ammo_changed.emit(_current_ammo, MAX_AMMO)

# --- Shooting Logic ---

## Shoot an arrow from the given position in the given direction
func shoot_arrow(from_position: Vector2, direction: Vector2) -> void:
	if not can_shoot():
		return

	# Consume ammo
	_current_ammo -= 1
	ammo_changed.emit(_current_ammo, MAX_AMMO)

	# Get arrow from object pool
	var arrow = ObjectPool.get_arrow()
	if arrow:
		# Setup arrow with position and direction
		if arrow.has_method("setup"):
			arrow.setup(from_position, direction, 25, 800.0)
		else:
			# Fallback for arrows without setup method
			arrow.position = from_position
			if arrow.has_method("set_direction"):
				arrow.set_direction(direction)

		# Visual feedback - muzzle flash at bow position
		_trigger_muzzle_flash(from_position, direction)

		# Audio feedback - shoot sound
		_play_shoot_sound()

		# Screen shake on shoot (subtle)
		_trigger_screen_shake_light()

		# Start cooldown
		_cooldown_timer = BASE_COOLDOWN

		# Emit signal
		arrow_fired.emit(from_position, direction)

		# Auto-reload if out of ammo
		if _current_ammo <= 0:
			_start_reload()

func _trigger_muzzle_flash(position: Vector2, direction: Vector2) -> void:
	"""Create a visual muzzle flash effect at the shooting position."""
	var vfx = get_node_or_null("/root/VFXManager")
	if vfx and vfx.has_method("play_muzzle_flash"):
		vfx.play_muzzle_flash(position, direction)

func _play_shoot_sound() -> void:
	"""Play shoot sound effect."""
	var audio = get_node_or_null("/root/AudioManager")
	if audio and audio.has_method("play_sfx"):
		audio.play_sfx("shoot")

func _trigger_screen_shake_light() -> void:
	"""Trigger a light screen shake on shoot."""
	var vfx = get_node_or_null("/root/VFXManager")
	if vfx and vfx.has_method("trigger_light_shake"):
		vfx.trigger_light_shake()

## Check if player can shoot
func can_shoot() -> bool:
	if _is_reloading:
		return false
	if _current_ammo <= 0:
		return false
	if _cooldown_timer > 0:
		return false
	return true

## Process cooldown and auto-shoot
func handle_auto_shoot(delta: float) -> void:
	# Update cooldown
	if _cooldown_timer > 0:
		_cooldown_timer -= delta

	# Update reload
	if _is_reloading:
		_reload_timer -= delta
		if _reload_timer <= 0:
			_finish_reload()

	# Handle auto-shoot mode
	if _shooting_mode == ShootingMode.AUTO:
		_process_auto_shoot()

## Process auto-shoot logic
func _process_auto_shoot() -> void:
	# Get player node
	var player = get_tree().get_first_node_in_group("Player")
	if not player:
		return

	# Check if player is aiming
	if not player.has_method("is_player_aiming"):
		return
	if not player.is_player_aiming():
		return

	# Get aim direction
	if not player.has_method("get_aim_direction"):
		return
	var aim_dir = player.get_aim_direction()

	# Check if there's a target in range
	var player_pos = player.global_position
	if not AutoAimManager.is_target_locked(player_pos, aim_dir):
		return

	# Auto-shoot if cooldown is ready
	if can_shoot() and _cooldown_timer <= 0:
		# Get bow pivot position
		var bow_pos = player_pos
		var bow_pivot = player.get_node_or_null("BowPivot")
		if bow_pivot:
			bow_pos = bow_pivot.global_position

		shoot_arrow(bow_pos, aim_dir)
		_cooldown_timer = AUTO_SHOOT_COOLDOWN

# --- Ammo Management ---

## Reload ammo
func reload() -> void:
	if _is_reloading or _current_ammo >= MAX_AMMO:
		return
	_start_reload()

func _start_reload() -> void:
	_is_reloading = true
	_reload_timer = RELOAD_TIME

	# Play reload sound
	var audio = get_node_or_null("/root/AudioManager")
	if audio and audio.has_method("play_sfx"):
		audio.play_sfx("reload")

func _finish_reload() -> void:
	_is_reloading = false
	_current_ammo = MAX_AMMO
	ammo_changed.emit(_current_ammo, MAX_AMMO)

## Get current ammo
func get_ammo() -> int:
	return _current_ammo

## Get max ammo
func get_max_ammo() -> int:
	return MAX_AMMO

## Add ammo (for pickups)
func add_ammo(amount: int) -> void:
	_current_ammo = min(_current_ammo + amount, MAX_AMMO)
	ammo_changed.emit(_current_ammo, MAX_AMMO)

# --- Shooting Mode Management ---

## Set shooting mode (MANUAL or AUTO)
func set_shooting_mode(mode: ShootingMode) -> void:
	if _shooting_mode != mode:
		_shooting_mode = mode
		shooting_mode_changed.emit(mode)
		_save_settings()

## Get current shooting mode
func get_shooting_mode() -> ShootingMode:
	return _shooting_mode

## Toggle between MANUAL and AUTO mode
func toggle_shooting_mode() -> void:
	if _shooting_mode == ShootingMode.MANUAL:
		set_shooting_mode(ShootingMode.AUTO)
	else:
		set_shooting_mode(ShootingMode.MANUAL)

# --- Settings Persistence ---

func _save_settings() -> void:
	var settings = {
		"shooting_mode": _shooting_mode
	}

	var file = FileAccess.open(SETTINGS_FILE, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(settings))
		file.close()

func _load_settings() -> void:
	if not FileAccess.file_exists(SETTINGS_FILE):
		return

	var file = FileAccess.open(SETTINGS_FILE, FileAccess.READ)
	if file:
		var json_str = file.get_as_text()
		file.close()

		var json = JSON.new()
		var error = json.parse(json_str)
		if error == OK:
			var settings = json.data
			if settings.has("shooting_mode"):
				_shooting_mode = settings["shooting_mode"] as ShootingMode

# --- Public Getters ---

## Check if currently reloading
func is_reloading() -> bool:
	return _is_reloading

## Get reload progress (0.0 to 1.0)
func get_reload_progress() -> float:
	if not _is_reloading:
		return 0.0
	return 1.0 - (_reload_timer / RELOAD_TIME)

## Get cooldown progress (0.0 to 1.0, 1.0 = ready)
func get_cooldown_progress() -> float:
	if _cooldown_timer <= 0:
		return 1.0
	return 1.0 - (_cooldown_timer / BASE_COOLDOWN)
