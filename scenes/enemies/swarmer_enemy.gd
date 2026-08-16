class_name SwarmerEnemy
extends BaseEnemy

## Swarmer enemy (Goblin Rusher) with group coordination and rush attacks.
## Features group buff when 3+ swarmers nearby, flanking, and retreat behavior.
##
## Usage:
## - Uses check_nearby_swarmers() to count allies
## - apply_group_buff() grants 20% speed when 3+ swarmers nearby
## - rush_attack() with linear movement toward player
##
## Signals:
## - swarmer_spawned(): Emitted when swarmer enters play

# --- Group Configuration ---
@export var group_buff_threshold: int = 3
@export var group_buff_speed_multiplier: float = 1.2

# --- Combat State ---
var _player_reference: Node2D
var _is_rushing: bool = false
var _rush_target: Vector2
var _group_buff_active: bool = false
var _swarmer_detection_range: float = 150.0
var _attack_cooldown: float = 0.0

# --- Retreat Configuration ---
var _retreat_when_hurt_threshold: float = 0.25  # 25% health
var _is_retreating: bool = false

# --- Movement Settings ---
var _rush_speed: float = 200.0
var _normal_speed: float = 180.0
var _flank_offset: float = 30.0

# --- Signals ---
signal swarmer_spawned()
signal group_buff_activated()
signal group_buff_deactivated()

# --- Node References ---
@onready var detection_area: Area2D = $DetectionArea

func _ready() -> void:
	super._ready()

	# Setup detection area for player
	if not detection_area:
		detection_area = Area2D.new()
		detection_area.name = "DetectionArea"
		var detection_shape = CollisionShape2D.new()
		var circle = CircleShape2D.new()
		circle.radius = 400.0
		detection_shape.shape = circle
		detection_area.add_child(detection_shape)
		add_child(detection_area)
		detection_area.collision_layer = 0
		detection_area.collision_mask = 1  # Player layer

	# Set base stats for goblin rusher
	max_health = 25
	max_speed = _normal_speed
	damage = 8
	xp_reward = 15

	# Emit spawn signal
	swarmer_spawned.emit()

func _physics_process(delta: float) -> void:
	if is_dead:
		return

	# Update cooldown
	if _attack_cooldown > 0:
		_attack_cooldown -= delta

	# Check group buff status
	_check_group_buff()

	# AI behavior based on state
	if _is_retreating:
		_retreat_when_hurt()
	elif _is_rushing:
		_execute_rush_attack(delta)
	else:
		_execute_group_behavior(delta)

## Check nearby swarmers and apply group buff
func check_nearby_swarmers() -> int:
	var swarmers = 0
	var enemies = get_tree().get_nodes_in_group("Enemies")

	for enemy in enemies:
		if enemy is SwarmerEnemy and enemy != self:
			var distance = global_position.distance_to(enemy.global_position)
			if distance <= _swarmer_detection_range:
				swarmers += 1

	return swarmers

## Apply group buff when 3+ swarmers nearby
func apply_group_buff() -> void:
	if not _group_buff_active:
		_group_buff_active = true
		max_speed = _normal_speed * group_buff_speed_multiplier
		group_buff_activated.emit()

	# Visual indicator
	if sprite:
		sprite.modulate = Color.YELLOW

## Remove group buff
func remove_group_buff() -> void:
	if _group_buff_active:
		_group_buff_active = false
		max_speed = _normal_speed
		group_buff_deactivated.emit()

	# Remove visual indicator
	if sprite:
		sprite.modulate = Color.WHITE

## Rush attack - linear movement toward player
func rush_attack() -> void:
	if _is_rushing or not _player_reference:
		return

	_is_rushing = true
	_rush_target = _player_reference.global_position

## Flanking movement - move to side when multiple swarmers attack
func move_to_side() -> void:
	if not _player_reference:
		return

	var to_player = (_player_reference.global_position - global_position).normalized()
	var perpendicular = Vector2(-to_player.y, to_player.x)

	# Randomly choose left or right flank
	var direction = perpendicular if randf() > 0.5 else -perpendicular
	velocity = direction * max_speed
	move_and_slide()

## Retreat when health is low
func retreat_when_hurt() -> void:
	if is_dead or not _player_reference:
		return

	var health_ratio = float(current_health) / float(max_health)
	if health_ratio < _retreat_when_hurt_threshold:
		_is_retreating = true

## Override select_attack_pattern from base enemy
func select_attack_pattern() -> void:
	if not _player_reference:
		return

	var swarmers_nearby = check_nearby_swarmers()

	if swarmers_nearby >= group_buff_threshold:
		apply_group_buff()
	else:
		remove_group_buff()

	# Flank if multiple swarmers attacking
	if swarmers_nearby >= 2:
		move_to_side()
	else:
		rush_attack()

## Execute rush attack animation
##
## Parameters:
##   delta: Time delta
func _execute_rush_attack(delta: float) -> void:
	if not _player_reference:
		return

	var distance = global_position.distance_to(_player_reference.global_position)

	if distance < 20.0:
		# Impact - deal damage
		_on_rush_impact()
	else:
		# Move toward player
		var direction = (_rush_target - global_position).normalized()
		velocity = direction * _rush_speed
		move_and_slide()

## Handle rush impact
func _on_rush_impact() -> void:
	if _player_reference and _player_reference.has_method("takedamage"):
		_player_reference.takedamage(damage)

	_is_rushing = false
	_attack_cooldown = 0.8

## Execute group behavior (swarm coordination)
##
## Parameters:
##   delta: Time delta
func _execute_group_behavior(delta: float) -> void:
	if _player_reference:
		select_attack_pattern()
	else:
		# Idle wandering
		_wander(delta)

## Wander when no player detected
##
## Parameters:
##   delta: Time delta
func _wander(delta: float) -> void:
	var wander_dir = Vector2(sin(_circle_angle), cos(_circle_angle))
	velocity = wander_dir * max_speed * 0.3
	_circle_angle += delta * 0.5
	move_and_slide()

var _circle_angle: float = 0.0

## Check group buff status periodically
func _check_group_buff() -> void:
	var swarmers_nearby = check_nearby_swarmers()

	if swarmers_nearby >= group_buff_threshold and not _group_buff_active:
		apply_group_buff()
	elif swarmers_nearby < group_buff_threshold and _group_buff_active:
		remove_group_buff()

## Retreat behavior - flee when hurt
##
## Parameters:
##   delta: Time delta
func _retreat_when_hurt() -> void:
	if not _player_reference:
		return

	var retreat_dir = (global_position - _player_reference.global_position).normalized()
	velocity = retreat_dir * max_speed * 1.2
	move_and_slide()

	# End retreat if healed or safe distance
	var health_ratio = float(current_health) / float(max_health)
	var distance = global_position.distance_to(_player_reference.global_position)

	if health_ratio > _retreat_when_hurt_threshold or distance > 300.0:
		_is_retreating = false

## Override takedamage to trigger retreat
func takedamage(amount: int) -> void:
	super.takedamage(amount)

	if not is_dead and current_health > 0:
		var health_ratio = float(current_health) / float(max_health)
		if health_ratio < _retreat_when_hurt_threshold:
			_is_retreating = true

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		if body.has_method("takedamage"):
			body.takedamage(damage)
