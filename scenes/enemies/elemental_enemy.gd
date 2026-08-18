class_name ElementalEnemy
extends BaseEnemy

## Elemental enemy with elemental attacks and weakness/resistance system.
## Elements: fire, ice, lightning with opposing element weaknesses.
##
## Usage:
## - Set elemental_type property to define element
## - Elemental attacks deal damage type with status effects
## - Opposite elements deal 2x damage (fire vs ice, ice vs fire)
##
## Signals:
## - elemental_attack_cast(element: String): Emitted when casting attack

# --- Elemental Types ---
enum ElementalType {
	FIRE,
	ICE,
	LIGHTNING
}

# --- Elemental Properties ---
@export var elemental_type: ElementalType = ElementalType.FIRE

# --- Element Configurations ---
var elemental_data: Dictionary = {
	ElementalType.FIRE: {
		"name": "Fire",
		"color": Color.RED,
		"weakness": ElementalType.ICE,
		"resistance": ElementalType.FIRE,
		"attackdamage": 15,
		"attack_cooldown": 2.0,
		"status_effect": "burn"
	},
	ElementalType.ICE: {
		"name": "Ice",
		"color": Color.CYAN,
		"weakness": ElementalType.FIRE,
		"resistance": ElementalType.ICE,
		"attackdamage": 12,
		"attack_cooldown": 2.5,
		"status_effect": "freeze"
	},
	ElementalType.LIGHTNING: {
		"name": "Lightning",
		"color": Color.YELLOW,
		"weakness": null,  # Lightning has no weakness
		"resistance": ElementalType.LIGHTNING,
		"attackdamage": 18,
		"attack_cooldown": 1.8,
		"status_effect": "shock"
	}
}

# --- Combat State ---
var _attack_cooldown: float = 0.0
var _attack_range: float = 200.0
var _player_reference: Node2D

# --- Signals ---
signal elemental_attack_cast(element: String)

# --- Node References ---
@onready var attack_timer: Timer = $AttackTimer
@onready var detection_area: Area2D = $DetectionArea

func _ready() -> void:
	# Set base stats based on element (before super so current_health seeds from max_health)
	max_health = 60
	move_speed = 130.0
	damage = get_elemental_data().attackdamage
	xp_reward = 30

	super._ready()

	# Setup attack timer
	if not attack_timer:
		attack_timer = Timer.new()
		attack_timer.name = "AttackTimer"
		add_child(attack_timer)
		attack_timer.wait_time = get_elemental_data().attack_cooldown
		attack_timer.one_shot = true

	# Setup detection area
	if not detection_area:
		detection_area = Area2D.new()
		detection_area.name = "DetectionArea"
		var detection_shape = CollisionShape2D.new()
		var circle = CircleShape2D.new()
		circle.radius = _attack_range
		detection_shape.shape = circle
		detection_area.add_child(detection_shape)
		add_child(detection_area)
		detection_area.collision_layer = 0
		detection_area.collision_mask = 1  # Player layer

	# Connect detection signal
	if detection_area:
		detection_area.body_entered.connect(_on_player_detected)

	# Apply elemental sprite color
	if sprite:
		sprite.modulate = get_elemental_data().color

func _physics_process(delta: float) -> void:
	if is_dead:
		return

	# Update attack cooldown
	if _attack_cooldown > 0:
		_attack_cooldown -= delta

	# AI behavior: dodge when close, cast when at range
	if _player_reference:
		var distance = global_position.distance_to(_player_reference.global_position)
		if distance < 80.0:
			_dodge_when_close()
		elif distance <= _attack_range and _attack_cooldown <= 0:
			cast_attack()

## Get elemental data for current type
##
## Returns:
##   Dictionary: Element configuration
func get_elemental_data() -> Dictionary:
	return elemental_data.get(elemental_type, elemental_data[ElementalType.FIRE])

## Calculate elemental damage considering weakness and resistance
##
## Parameters:
##   basedamage: Base damage value
##   damage_type: Attacker's elemental type
##   attacker_element: ElementalType of attacker
##
## Returns:
##   int: Final damage value
func get_elementaldamage(basedamage: int, attacker_element: ElementalType) -> int:
	var data = get_elemental_data()

	# Check for weakness (2x damage)
	if data.weakness == attacker_element:
		return basedamage * 2

	# Check for resistance (0.5x damage)
	if data.resistance == attacker_element and attacker_element != null:
		return basedamage / 2

	return basedamage

## Cast elemental attack
func cast_attack() -> void:
	if _attack_cooldown > 0:
		return

	var data = get_elemental_data()
	_attack_cooldown = data.attack_cooldown

	# Emit attack signal
	var element_name = data.name.to_lower()
	elemental_attack_cast.emit(element_name)

	# Apply damage to player if in range
	if _player_reference and _player_reference.has_method("take_damage"):
		_player_reference.take_damage(damage)

	# Apply status effect
	_apply_status_effect(_player_reference, data.status_effect)

## Dodge when player is too close
func _dodge_when_close() -> void:
	if not _player_reference:
		return

	# Calculate dodge direction (away from player)
	var dodge_dir = (global_position - _player_reference.global_position).normalized()

	# Apply dodge movement
	velocity = dodge_dir * move_speed * 1.5
	move_and_slide()

## Maintain distance from player
func maintain_distance(target_distance: float = 150.0) -> void:
	if not _player_reference:
		return

	var distance = global_position.distance_to(_player_reference.global_position)

	if distance > target_distance + 20.0:
		# Move closer
		var direction = (_player_reference.global_position - global_position).normalized()
		velocity = direction * move_speed * 0.5
		move_and_slide()
	elif distance < target_distance - 20.0:
		# Move away (dodge)
		_dodge_when_close()

## Override select_attack_pattern from base enemy
func select_attack_pattern() -> void:
	if _player_reference:
		var distance = global_position.distance_to(_player_reference.global_position)
		if distance <= _attack_range:
			cast_attack()
		else:
			maintain_distance()

## Apply elemental status effect
##
## Parameters:
##   target: Player character
##   effect_type: "burn", "freeze", or "shock"
func _apply_status_effect(target: Node2D, effect_type: String) -> void:
	if not target:
		return

	match effect_type:
		"burn":
			# Apply burn DoT
			if target.has_method("apply_burn"):
				target.apply_burn(5, 3.0)  # 5 damage over 3 seconds
		"freeze":
			# Apply slow effect
			if target.has_method("apply_slow"):
				target.apply_slow(0.5, 2.0)  # 50% speed reduction for 2 seconds
		"shock":
			# Apply stun effect
			if target.has_method("apply_stun"):
				target.apply_stun(0.5)  # 0.5 second stun

func _on_player_detected(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		_player_reference = body
