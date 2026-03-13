extends "res://scenes/enemies/base_enemy.gd"

## Tank enemy (Brute) - slow with high health and damage.
##
## Behavior:
## - Very slow but nearly unstoppable
## - High health pool
## - Heavy damage on contact
## - Can break through player defenses

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 300.0
var attack_range: float = 45.0
var is_attacking: bool = false
var attack_cooldown: float = 2.0
var attack_timer: float = 0.0

# --- Charge Attack Settings ---
var can_charge: bool = true
var charge_cooldown: float = 5.0
var charge_timer: float = 0.0
var is_charging: bool = false
var charge_speed: float = 350.0
var charge_duration: float = 0.6
var charge_remaining: float = 0.0

# --- Knockback Settings ---
var knockback_force: float = 80.0
var knockback_recovery: float = 0.8

func _ready() -> void:
	max_health = 180
	move_speed = 60.0
	damage = 25
	xp_reward = 50
	super._ready()

func _physics_process(delta: float) -> void:
	if not player_ref:
		find_player()

	attack_timer += delta
	charge_timer += delta

	# Recover from knockback
	if knockback_recovery > 0:
		knockback_recovery -= delta
		if knockback_recovery <= 0:
			knockback_recovery = 0

	if player_ref and knockback_recovery == 0:
		var distance_to_player: float = global_position.distance_to(player_ref.global_position)

		if is_charging:
			perform_charge_movement(delta)
		elif distance_to_player <= detection_range:
			if distance_to_player > attack_range:
				chase_player()
				# Try to start charge if player is far enough
				if can_charge and charge_timer >= charge_cooldown and distance_to_player > 150:
					start_charge()
			else:
				attack_player(delta)
		else:
			velocity = Vector2.ZERO

	move_and_slide()

func find_player() -> void:
	var players: Array[Node] = get_tree().get_nodes_in_group("Player")
	if players.size() > 0:
		player_ref = players[0] as CharacterBody2D

func chase_player() -> void:
	if not player_ref:
		return

	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed
	if sprite:
		sprite.flip_h = direction.x < 0

func attack_player(_delta: float) -> void:
	velocity = Vector2.ZERO

	if attack_timer >= attack_cooldown:
		perform_heavy_attack()

func perform_heavy_attack() -> void:
	attack_timer = 0.0

	if player_ref and player_ref.has_method("take_damage"):
		# Apply knockback to player
		var direction: Vector2 = (player_ref.global_position - global_position).normalized()
		if player_ref.has_method("apply_knockback"):
			player_ref.apply_knockback(direction * knockback_force)

		player_ref.take_damage(damage)

func start_charge() -> void:
	if not player_ref:
		return

	is_charging = true
	can_charge = false
	charge_timer = 0.0
	charge_remaining = charge_duration

	# Lock direction at start of charge
	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	velocity = direction * charge_speed

	# Visual feedback
	if sprite:
		sprite.modulate = Color(1.0, 0.3, 0.3, 1)

func perform_charge_movement(delta: float) -> void:
	charge_remaining -= delta

	if charge_remaining <= 0:
		# End charge
		is_charging = false
		charge_cooldown_reset()
		if sprite:
			sprite.modulate = Color(1, 1, 1, 1)
	else:
		# Continue charging - maintain direction
		if player_ref:
			var direction: Vector2 = (player_ref.global_position - global_position).normalized()
			velocity = direction * charge_speed
			if sprite:
				sprite.flip_h = direction.x < 0

func charge_cooldown_reset() -> void:
	# Reset charge ability after cooldown
	await get_tree().create_timer(charge_cooldown).timeout
	can_charge = true

func take_damage(amount: int) -> void:
	# Brute takes reduced damage from small attacks (armor)
	var effective_damage = amount
	if amount < 15:
		effective_damage = max(1, amount - 5)  # -5 damage reduction for small attacks
	elif amount < 30:
		effective_damage = amount - 2  # -2 damage reduction for medium attacks

	current_health -= effective_damage
	if current_health <= 0:
		die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		if body.has_method("take_damage"):
			body.take_damage(damage)