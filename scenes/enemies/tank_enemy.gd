extends "res://scenes/enemies/base_enemy.gd"

## Tank enemy - slow but high health.
## Has a shield that blocks some damage.
##
## Behavior:
## - Very high health pool
## - Slow movement
## - High damage attacks
## - Shield mechanic that reduces damage periodically

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 350.0
var attack_range: float = 55.0
var is_attacking: bool = false
var attack_cooldown: float = 2.0
var attack_timer: float = 0.0

# --- Shield Settings ---
var shield_active: bool = false
var shield_damage_reduction: float = 0.4
var shield_duration: float = 3.0
var shield_cooldown: float = 8.0
var shield_timer: float = 0.0

# --- Charge Attack ---
var can_charge: bool = true
var charge_cooldown: float = 6.0
var charge_timer: float = 0.0
var is_charging: bool = false

func _ready() -> void:
	max_health = 200
	move_speed = 60.0
	damage = 25
	xp_reward = 50
	super._ready()

func _physics_process(delta: float) -> void:
	shield_timer += delta
	charge_timer += delta

	# Activate shield periodically
	if shield_timer >= shield_cooldown and not shield_active:
		activate_shield()

	# Deactivate shield after duration
	if shield_active and shield_timer >= shield_duration:
		deactivate_shield()

	if not player_ref:
		find_player()

	if player_ref and not is_charging:
		var distance_to_player = global_position.distance_to(player_ref.global_position)

		if distance_to_player <= detection_range:
			if distance_to_player > attack_range:
				chase_player()
			else:
				attack_player(delta)
		else:
			velocity = Vector2.ZERO

	var _moved = move_and_slide()

func find_player() -> void:
	var players = get_tree().get_nodes_in_group("Player")
	if players.size() > 0:
		player_ref = players[0]

func chase_player() -> void:
	if not player_ref:
		return
	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed
	if sprite:
		sprite.flip_h = direction.x < 0

	# Check for charge opportunity
	if can_charge and charge_timer >= charge_cooldown:
		var distance = global_position.distance_to(player_ref.global_position)
		if distance > attack_range * 2 and distance < detection_range * 0.7:
			perform_charge()
			charge_timer = 0.0

func attack_player(delta: float) -> void:
	velocity = Vector2.ZERO
	attack_timer += delta

	if attack_timer >= attack_cooldown:
		attack_timer = 0.0
		perform_attack()

func perform_attack() -> void:
	if player_ref and player_ref.has_method("take_damage"):
		player_ref.take_damage(damage)

func perform_charge() -> void:
	if is_charging or not player_ref:
		return

	is_charging = true
	can_charge = false

	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	var charge_velocity = direction * move_speed * 3.0

	# Charge for a short duration
	var charge_duration = 0.4
	var timer = 0.0
	while timer < charge_duration:
		timer += get_process_delta_time()
		velocity = charge_velocity
		var _moved = move_and_slide()
		await get_tree().process_frame

	velocity = Vector2.ZERO
	is_charging = false

	# Reset charge ability after cooldown
	await get_tree().create_timer(charge_cooldown).timeout
	can_charge = true

func activate_shield() -> void:
	shield_active = true
	shield_timer = 0.0
	# Visual feedback could be added here

func deactivate_shield() -> void:
	shield_active = false
	shield_timer = 0.0

func take_damage(amount: int) -> void:
	var actual_damage = amount

	# Apply shield damage reduction
	if shield_active:
		actual_damage = int(amount * (1.0 - shield_damage_reduction))

	current_health -= actual_damage
	if current_health <= 0:
		die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body.is_in_group("Player"):
		body.take_damage(damage)
