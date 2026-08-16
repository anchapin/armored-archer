class_name FlyingEnemy
extends BaseEnemy

## Flying enemy (Harpy) with aerial movement and dive-bomb attacks.
## Features flight with reduced gravity, circling behavior, and dive-bomb attack.
##
## Usage:
## - Uses fly_towards() for smooth aerial movement
## - Dive-bomb attack charges then impacts for 1.5x damage
## - Recovers for 2 seconds after diving
##
## Signals:
## - dive_attack_started(): Emitted when starting dive
## - dive_attack_impact(): Emitted when dive connects

# --- Flight Configuration ---
@export var flight_height: float = 50.0  # Height above ground
@export var circle_radius: float = 100.0
@export var divedamage_multiplier: float = 1.5

# --- Combat State ---
var _player_reference: Node2D
var _is_diving: bool = false
var _dive_target: Vector2
var _circle_angle: float = 0.0
var _dive_cooldown: float = 0.0
var _dive_recovery_time: float = 2.0
var _dive_recovery_timer: float = 0.0

# --- Attack Configuration ---
var _dive_charge_time: float = 0.5
var _dive_charge_timer: float = 0.0

# --- Flight State ---
var _target_altitude: float = 0.0
var _current_altitude: float = 0.0

# --- Signals ---
signal dive_attack_started()
signal dive_attack_impact(position: Vector2)

# --- Node References ---
@onready var attack_timer: Timer = $AttackTimer

func _ready() -> void:
	super._ready()

	# Setup attack timer
	if not attack_timer:
		attack_timer = Timer.new()
		attack_timer.name = "AttackTimer"
		attack_timer.wait_time = 4.0
		attack_timer.one_shot = true
		add_child(attack_timer)

	# Set base stats for harpy
	max_health = 45
	max_speed = 160.0
	damage = 12
	xp_reward = 35

	# Initialize flight altitude
	_target_altitude = flight_height
	_current_altitude = 0.0

func _physics_process(delta: float) -> void:
	if is_dead:
		return

	# Update cooldowns
	if _dive_cooldown > 0:
		_dive_cooldown -= delta
	if _dive_recovery_timer > 0:
		_dive_recovery_timer -= delta

	# Smooth altitude transition
	if _current_altitude < _target_altitude:
		_current_altitude += delta * 50.0
		_current_altitude = min(_current_altitude, _target_altitude)

	# AI behavior based on state
	if _is_diving:
		_execute_dive_attack(delta)
	else:
		_execute_flight_behavior(delta)

## Fly towards target position with smooth movement
##
## Parameters:
##   target: Target position to fly towards
func fly_towards(target: Vector2) -> void:
	var direction = (target - global_position).normalized()
	velocity = direction * max_speed
	move_and_slide()

## Circle around target
##
## Parameters:
##   target: Target position to circle
##   radius: Circle radius
##   speed: Speed of circling
func circle_target(target: Vector2, radius: float = circle_radius, speed: float = 2.0) -> void:
	_circle_angle += speed * 0.016

	var circle_pos = Vector2(
		cos(_circle_angle) * radius,
		sin(_circle_angle) * radius
	)

	var target_pos = target + circle_pos
	fly_towards(target_pos)

## Execute dive-bomb attack
func dive_attack() -> void:
	if _is_diving or _dive_cooldown > 0 or not _player_reference:
		return

	_is_diving = true
	_dive_charge_timer = _dive_charge_time
	_dive_target = _player_reference.global_position

	dive_attack_started.emit()

## Escape when damaged (fly up and away)
func escape_whendamaged() -> void:
	if not _player_reference:
		return

	var escape_dir = (global_position - _player_reference.global_position).normalized()
	_target_altitude = flight_height * 1.5  # Fly higher
	velocity = escape_dir * max_speed * 1.2
	move_and_slide()

## Override select_attack_pattern from base enemy
func select_attack_pattern() -> void:
	if not _player_reference:
		return

	if _dive_recovery_timer > 0:
		# Recovery phase - fly away
		escape_whendamaged()
	elif not _is_diving and _dive_cooldown <= 0:
		var distance = global_position.distance_to(_player_reference.global_position)
		if distance < 150.0:
			# Close enough to dive
			dive_attack()
		else:
			# Circle player
			circle_target(_player_reference.global_position)

## Execute dive attack animation
##
## Parameters:
##   delta: Time delta
func _execute_dive_attack(delta: float) -> void:
	if _dive_charge_timer > 0:
		# Charging phase
		_dive_charge_timer -= delta
		# Hover in place while charging
		velocity = Vector2.ZERO
	elif _is_diving:
		# Dive phase - charge towards target
		var dive_dir = (_dive_target - global_position).normalized()
		velocity = dive_dir * max_speed * 2.0  # Fast dive

		var new_pos = global_position + velocity * delta
		if new_pos.distance_to(_dive_target) < 20.0:
			# Impact
			_on_dive_impact()
		else:
			global_position = new_pos

## Handle dive impact
func _on_dive_impact() -> void:
	dive_attack_impact.emit(global_position)

	# Deal damage to nearby player
	if _player_reference:
		var distance = global_position.distance_to(_player_reference.global_position)
		if distance < 50.0:
			# 1.5x damage on dive
			var divedamage = int(damage * divedamage_multiplier)
			if _player_reference.has_method("takedamage"):
				_player_reference.takedamage(divedamage)

	# Start recovery
	_is_diving = false
	_dive_recovery_timer = _dive_recovery_time
	_dive_cooldown = 5.0

	# Fly back up
	_target_altitude = flight_height
	escape_whendamaged()

## Execute normal flight behavior (circle then dive)
##
## Parameters:
##   delta: Time delta
func _execute_flight_behavior(delta: float) -> void:
	if _player_reference:
		select_attack_pattern()
	else:
		# Idle hovering
		var idle_dir = Vector2(sin(_circle_angle), cos(_circle_angle))
		velocity = idle_dir * max_speed * 0.2
		_circle_angle += delta * 0.5
		move_and_slide()

## Apply reduced gravity for flying
func apply_gravity() -> void:
	# Flying enemies use reduced gravity
	var gravity = 50.0  # Much lower than normal gravity
	velocity.y += gravity * 0.016

## Override takedamage to trigger escape behavior
func takedamage(amount: int) -> void:
	super.takedamage(amount)
	if not is_dead and current_health > 0:
		# 30% chance to escape when hit
		if randf() < 0.3:
			escape_whendamaged()
