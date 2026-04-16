class_name IronGolem
extends BaseEnemy

## Iron Golem Boss - Tank boss with shield mechanics.
##
## Phase 1: High defense, slam attacks, periodic shield regeneration
## Phase 2 (50% health): Enraged, breaks shields with devastating ground slam
## Special: Iron Shield - absorbs incoming damage for a duration
##
## Unique mechanics:
## - Iron Shield: Absorbs all damage for 3 seconds, 15s cooldown
## - Ground Slam: AOE damage with knockback
## - Armor Plating: 30% damage reduction (passive)

# --- Boss Stats ---
@export var boss_name: String = "Iron Golem"

# --- AI State ---
var player_ref: Node2D = null
var detection_range: float = 500.0
var attack_range: float = 70.0

# --- Movement ---
var base_move_speed: float = 90.0
var enraged_move_speed: float = 130.0

# --- Attack Settings ---
var attack_cooldown: float = 2.0
var attack_timer: float = 0.0

# --- Special Abilities ---
var shield_active: bool = false
var shield_cooldown: float = 15.0
var shield_duration: float = 3.0
var shield_timer: float = 0.0
var current_special_cooldown: float = 0.0

# --- Slam Attack ---
var slam_cooldown: float = 6.0
var slam_damage: int = 35
var slam_radius: float = 120.0
var slam_knockback: float = 200.0

# --- Boss State ---
var current_phase: int = 1
var is_enraged: bool = false

# --- Passive Defense ---
var armor_reduction: float = 0.3  # 30% damage reduction

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 1200
	damage = 32
	move_speed = base_move_speed
	current_health = max_health
	add_to_group("Boss")
	super._ready()

	health_changed.emit(current_health, max_health)

func _physics_process(delta: float) -> void:
	if is_dead:
		return

	if not player_ref:
		find_player()

	# Update cooldowns
	if attack_timer > 0:
		attack_timer -= delta
	if current_special_cooldown > 0:
		current_special_cooldown -= delta

	# Shield management
	if shield_active:
		shield_timer -= delta
		if shield_timer <= 0:
			deactivate_shield()

	if player_ref:
		var distance_to_player = global_position.distance_to(player_ref.global_position)

		if distance_to_player <= detection_range:
			if distance_to_player > attack_range:
				chase_player()
			else:
				handle_attacks()
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

	var direction = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed
	if sprite:
		sprite.flip_h = direction.x < 0

func handle_attacks() -> void:
	velocity = Vector2.ZERO

	# Try to use special abilities
	if current_special_cooldown <= 0:
		if not shield_active and randf() < 0.3:
			activate_iron_shield()
		elif randf() < 0.4:
			perform_ground_slam()
		return

	# Basic attack
	if attack_timer <= 0:
		perform_basic_attack()
		attack_timer = attack_cooldown

func perform_basic_attack() -> void:
	if not player_ref:
		return

	var attack_damage = damage
	if is_enraged:
		attack_damage = int(damage * 1.5)

	if player_ref.has_method("take_damage"):
		player_ref.take_damage(attack_damage)

func activate_iron_shield() -> void:
	shield_active = true
	shield_timer = shield_duration
	current_special_cooldown = shield_cooldown

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.6, 0.6, 0.7, 1)  # Metallic blue-gray

func deactivate_shield() -> void:
	shield_active = false

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func perform_ground_slam() -> void:
	if not player_ref:
		return

	current_special_cooldown = slam_cooldown

	# Visual feedback - crouch
	if sprite:
		sprite.modulate = Color(0.8, 0.4, 0.2, 1)
		sprite.scale = Vector2(1.2, 0.8)

	velocity = Vector2.ZERO

	await get_tree().create_timer(0.5).timeout

	# Deal AOE damage
	var slam_dmg = slam_damage
	if is_enraged:
		slam_dmg = int(slam_damage * 1.8)

	if player_ref:
		var distance = global_position.distance_to(player_ref.global_position)
		if distance <= slam_radius:
			if player_ref.has_method("take_damage"):
				player_ref.take_damage(slam_dmg)

			# Knockback
			if player_ref.has_method("apply_knockback"):
				var direction = (player_ref.global_position - global_position).normalized()
				var knock_strength = slam_knockback
				if is_enraged:
					knock_strength *= 1.5
				player_ref.apply_knockback(direction * knock_strength)

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)
		sprite.scale = Vector2(1, 1)

func take_damage(amount: int) -> void:
	# Apply shield if active
	var actual_damage = amount
	if shield_active:
		actual_damage = 0
	# Apply armor reduction
	else:
		actual_damage = int(amount * (1.0 - armor_reduction))

	super.take_damage(actual_damage)
	health_changed.emit(current_health, max_health)

	# Check phase transition
	var health_percentage = float(current_health) / float(max_health)

	if health_percentage <= 0.5 and not is_enraged:
		enter_phase_2()

	if current_health <= 0:
		die()

func enter_phase_2() -> void:
	is_enraged = true
	current_phase = 2
	move_speed = enraged_move_speed
	damage = 45
	attack_cooldown = 1.5

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.9, 0.3, 0.3, 1)
		await get_tree().create_timer(0.5).timeout
		sprite.modulate = Color(1, 1, 1, 1)

func die() -> void:
	boss_defeated.emit(boss_name)
	super.die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		var dmg = damage
		if is_enraged:
			dmg = int(dmg * 1.5)
		if body.has_method("take_damage"):
			body.take_damage(dmg)
