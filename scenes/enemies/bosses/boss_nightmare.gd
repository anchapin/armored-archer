class_name NightmareBeast
extends BaseEnemy

## Nightmare Beast Boss - Fear-based boss with debuff mechanics.
##
## Phase 1: Claw attacks, Nightmare Gaze (fear effect), Shadow Bolt (ranged)
## Phase 2 (50% health): Nightmare Realm (reduces player damage), Chaos Phase
## Special: Nightmare Gaze - Applies fear, player takes extra damage for 5s
## Special: Nightmare Realm - Reduces player damage by 40% for 6s
##
## Unique mechanics:
## - Nightmare Gaze: Fears player, causing them to flee and take +25% damage
## - Shadow Bolt: Ranged attack that bypasses armor
## - Chaos Phase: Teleports randomly during attacks

# --- Boss Stats ---
@export var boss_name: String = "Nightmare Beast"

# --- AI State ---
var player_ref: Node2D = null
var detection_range: float = 600.0
var attack_range: float = 65.0
var ranged_range: float = 300.0

# --- Movement ---
var base_move_speed: float = 115.0
var enraged_move_speed: float = 150.0

# --- Attack Settings ---
var attack_cooldown: float = 1.6
var attack_timer: float = 0.0

# --- Special Abilities ---
var gaze_cooldown: float = 10.0
var gaze_duration: float = 5.0
var gaze_damage_bonus: float = 0.25  # +25% damage
var current_gaze_cooldown: float = 0.0

var realm_cooldown: float = 15.0
var realm_duration: float = 6.0
var realm_damage_reduction: float = 0.4  # 40% damage reduction
var current_realm_cooldown: float = 0.0

# --- Shadow Bolt ---
var bolt_cooldown: float = 4.0
var bolt_damage: int = 25
var current_bolt_cooldown: float = 0.0

# --- Chaos Phase (Phase 2) ---
var is_chaos_active: bool = false
var teleport_cooldown: float = 2.0
var teleport_timer: float = 0.0

# --- Boss State ---
var current_phase: int = 1
var is_enraged: bool = false

# --- Active Effects ---
var player_fear_active: bool = false
var player_realm_active: bool = false

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 900
	damage = 30
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
	if current_gaze_cooldown > 0:
		current_gaze_cooldown -= delta
	if current_realm_cooldown > 0:
		current_realm_cooldown -= delta
	if current_bolt_cooldown > 0:
		current_bolt_cooldown -= delta

	# Chaos phase teleport
	if is_chaos_active:
		teleport_timer -= delta
		if teleport_timer <= 0:
			chaos_teleport()

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

	# Try ranged attack if player is far
	if player_ref and current_bolt_cooldown <= 0:
		var distance = global_position.distance_to(player_ref.global_position)
		if distance > attack_range * 1.5 and distance <= ranged_range:
			perform_shadow_bolt()
			return

	# Nightmare Gaze
	if current_gaze_cooldown <= 0 and randf() < 0.25:
		perform_nightmare_gaze()
		return

	# Nightmare Realm (Phase 2 only)
	if current_phase == 2 and current_realm_cooldown <= 0 and randf() < 0.3:
		perform_nightmare_realm()
		return

	# Basic claw attack
	if attack_timer <= 0:
		perform_claw_attack()
		attack_timer = attack_cooldown

func perform_claw_attack() -> void:
	if not player_ref:
		return

	var claw_damage = damage
	if is_enraged:
		claw_damage = int(claw_damage * 1.5)

	# Apply fear bonus if active
	if player_fear_active and player_ref and player_ref.has_method("take_damage"):
		claw_damage = int(claw_damage * (1.0 + gaze_damage_bonus))
		player_ref.take_damage(claw_damage)
	elif player_ref and player_ref.has_method("take_damage"):
		player_ref.take_damage(claw_damage)

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.6, 0.2, 0.6, 1)
		await get_tree().create_timer(0.1).timeout
		sprite.modulate = Color(1, 1, 1, 1)

func perform_shadow_bolt() -> void:
	current_bolt_cooldown = bolt_cooldown

	if not player_ref:
		return

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.3, 0, 0.5, 1)

	var bolt_damage = bolt_damage
	if is_enraged:
		bolt_damage = int(bolt_damage * 1.6)

	# Instant damage (projectile could be added for visual)
	if player_ref.has_method("take_damage"):
		player_ref.take_damage(bolt_damage)

	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func perform_nightmare_gaze() -> void:
	current_gaze_cooldown = gaze_cooldown

	# Visual feedback - eye glow
	if sprite:
		sprite.modulate = Color(0.8, 0, 0.8, 1)
		sprite.scale = Vector2(1.1, 1.1)

	velocity = Vector2.ZERO

	await get_tree().create_timer(0.5).timeout

	# Apply fear to player
	if player_ref:
		if player_ref.has_method("apply_fear"):
			player_ref.apply_fear(gaze_duration)
		player_fear_active = true

		# Clear fear after duration
		_clear_fear_after_delay(gaze_duration)

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)
		sprite.scale = Vector2(1, 1)

func _clear_fear_after_delay(delay: float) -> void:
	await get_tree().create_timer(delay).timeout
	player_fear_active = false

func perform_nightmare_realm() -> void:
	current_realm_cooldown = realm_cooldown

	# Visual feedback - dark aura
	if sprite:
		sprite.modulate = Color(0.2, 0, 0.3, 1)
		sprite.scale = Vector2(1.2, 1.2)

	velocity = Vector2.ZERO

	await get_tree().create_timer(0.6).timeout

	# Apply realm effect (reduces player damage)
	if player_ref:
		if player_ref.has_method("apply_damage_reduction"):
			player_ref.apply_damage_reduction(realm_damage_reduction, realm_duration)
		player_realm_active = true

		_clear_realm_after_delay(realm_duration)

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)
		sprite.scale = Vector2(1, 1)

func _clear_realm_after_delay(delay: float) -> void:
	await get_tree().create_timer(delay).timeout
	player_realm_active = false

func chaos_teleport() -> void:
	if not player_ref:
		return

	teleport_timer = teleport_cooldown

	# Visual feedback - fade out
	if sprite:
		sprite.modulate = Color(1, 1, 1, 0.3)

	await get_tree().create_timer(0.15).timeout

	# Teleport to random position near player
	var angle = randf() * PI * 2.0
	var distance = 100 + randf() * 50
	var new_pos = player_ref.global_position + Vector2(cos(angle), sin(angle)) * distance
	new_pos = new_pos.clamp(Vector2(50, 50), Vector2(590, 310))
	global_position = new_pos

	# Visual feedback - fade in
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)
		sprite.scale = Vector2(1.2, 1.2)
		await get_tree().create_timer(0.1).timeout
		sprite.scale = Vector2(1, 1)

func take_damage(amount: int) -> void:
	# Apply realm damage reduction if active
	var actual_damage = amount
	if player_realm_active:
		actual_damage = int(amount * (1.0 - realm_damage_reduction))

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
	is_chaos_active = true
	move_speed = enraged_move_speed
	damage = 38
	attack_cooldown = 1.3

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.5, 0, 0.7, 1)
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
