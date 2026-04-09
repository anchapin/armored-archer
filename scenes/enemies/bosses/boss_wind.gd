class_name TitanBoss
extends BaseEnemy

## Titan Boss (Forest Titan) - melee brute with high damage.
##
## Phase 1: Stomp attack (stun player), melee combos
## Phase 2 (50% health): Roar (fear effect), charge attack
## Phase 3: Enraged state - 2x damage, 1.5x speed
##
## Integrates with BossManager for phase management and loot.

# --- Boss Stats ---
@export var boss_name: String = "Forest Titan"

# --- AI State ---
var player_ref: Node2D = null
var detection_range: float = 600.0
var attack_range: float = 60.0

# --- Movement ---
var base_move_speed: float = 110.0
var enraged_move_speed: float = 165.0
var charge_speed: float = 350.0

# --- Attack Settings ---
var attack_cooldown: float = 1.5
var attack_timer: float = 0.0

# --- Special Attack Settings ---
var current_special_cooldown: float = 0.0
var is_charging: bool = false

# --- Boss State ---
var current_phase: int = 0
var is_enraged: bool = false

# --- Manager References ---
var _boss_manager: Node

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 900
	damage = 28
	move_speed = base_move_speed
	current_health = max_health
	add_to_group("Boss")
	super._ready()

	_boss_manager = get_node_or_null("/root/BossManager")

	health_changed.emit(current_health, max_health)

func _physics_process(delta: float) -> void:
	if is_dead:
		return

	if not player_ref:
		find_player()

	# Update attack cooldowns
	if attack_timer > 0:
		attack_timer -= delta
	if current_special_cooldown > 0:
		current_special_cooldown -= delta

	# Update BossManager cooldowns
	if _boss_manager:
		_boss_manager.update_attack_cooldowns(delta)

	if player_ref:
		var distance_to_player = global_position.distance_to(player_ref.global_position)

		if is_charging:
			_execute_charge(delta)
		elif distance_to_player <= detection_range:
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

	# Use special attack from BossManager if available
	if _boss_manager and current_special_cooldown <= 0:
		var special_attack = _boss_manager.get_special_attack()
		if not special_attack.is_empty():
			_perform_special_attack(special_attack)
			return

	# Basic melee attack
	if attack_timer <= 0:
		perform_basic_attack()
		attack_timer = attack_cooldown

func perform_basic_attack() -> void:
	if not player_ref:
		return

	var attack_damage = damage
	if is_enraged:
		attack_damage = int(damage * 2.0)

	if player_ref.has_method("take_damage"):
		player_ref.take_damage(attack_damage)

func _perform_special_attack(attack_data: Dictionary) -> void:
	var attack_name = attack_data.keys()[0] if attack_data else ""

	match attack_name:
		"stomp":
			perform_stomp(attack_data.stomp)
		"roar":
			perform_roar(attack_data.roar)
		"charge":
			perform_charge(attack_data.charge)

func perform_stomp(attack_data: Dictionary) -> void:
	if not player_ref:
		return

	var stomp_cooldown = attack_data.get("cooldown", 4.5)
	var stomp_damage = attack_data.get("damage", 25)
	var stun_duration = attack_data.get("stun_duration", 1.0)

	current_special_cooldown = stomp_cooldown

	# Visual feedback - stomp
	if sprite:
		sprite.modulate = Color(0.9, 0.8, 0.7, 1)
		sprite.scale = Vector2(1.1, 0.9)  # Flatten

	velocity = Vector2.ZERO

	await get_tree().create_timer(0.3).timeout

	# Check for players in range
	if player_ref:
		var distance = global_position.distance_to(player_ref.global_position)
		if distance <= attack_range * 2:
			var final_damage = stomp_damage
			if is_enraged:
				final_damage = int(stomp_damage * 2.0)
			if player_ref.has_method("take_damage"):
				player_ref.take_damage(final_damage)

			# Stun effect
			if player_ref.has_method("apply_stun"):
				player_ref.apply_stun(stun_duration)

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)
		sprite.scale = Vector2(1, 1)

func perform_roar(attack_data: Dictionary) -> void:
	if not player_ref:
		return

	var roar_cooldown = attack_data.get("cooldown", 8.0)
	var fear_duration = attack_data.get("fear_duration", 2.0)

	current_special_cooldown = roar_cooldown

	# Visual feedback - roar
	if sprite:
		sprite.modulate = Color(0.8, 0.6, 0.4, 1)
		sprite.scale = Vector2(1.15, 1.15)  # Expand

	velocity = Vector2.ZERO

	await get_tree().create_timer(0.4).timeout

	# Fear effect - push player back
	if player_ref:
		var distance = global_position.distance_to(player_ref.global_position)
		if distance <= 300:
			# Push player away
			var direction = (player_ref.global_position - global_position).normalized()
			var push_distance = 150.0
			var new_pos = global_position + direction * push_distance
			new_pos = new_pos.clamp(Vector2(50, 50), Vector2(590, 310))

			# Apply fear
			if player_ref.has_method("apply_fear"):
				player_ref.apply_fear(fear_duration)

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)
		sprite.scale = Vector2(1, 1)

func perform_charge(attack_data: Dictionary) -> void:
	if is_charging or not player_ref:
		return

	var charge_cooldown = attack_data.get("cooldown", 6.0)

	current_special_cooldown = charge_cooldown
	is_charging = true
	_charge_target = player_ref.global_position

	# Visual feedback - charge
	if sprite:
		sprite.modulate = Color(0.9, 0.5, 0.3, 1)

var _charge_target: Vector2

func _execute_charge(delta: float) -> void:
	if not player_ref:
		is_charging = false
		return

	var direction = (_charge_target - global_position).normalized()
	velocity = direction * charge_speed

	# Check if reached target
	var distance = global_position.distance_to(_charge_target)
	if distance < 20.0:
		# Impact
		_on_charge_impact()

func _on_charge_impact() -> void:
	is_charging = false
	velocity = Vector2.ZERO

	# Deal damage to nearby player
	if player_ref:
		var distance = global_position.distance_to(player_ref.global_position)
		if distance <= 40.0:
			var charge_damage = int(damage * 1.5)
			if is_enraged:
				charge_damage = int(charge_damage * 2.0)
			if player_ref.has_method("take_damage"):
				player_ref.take_damage(charge_damage)

			# Knockback
			if player_ref.has_method("apply_knockback"):
				var direction = (player_ref.global_position - global_position).normalized()
				player_ref.apply_knockback(direction * 120.0)

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func take_damage(amount: int) -> void:
	super.take_damage(amount)
	health_changed.emit(current_health, max_health)

	# Check phase transitions via BossManager
	if _boss_manager:
		var new_phase = _boss_manager.check_phase_transition(current_health, max_health)
		if new_phase != current_phase:
			transition_to_phase(new_phase)

	if current_health <= 0:
		die()

func transition_to_phase(phase_num: int) -> void:
	current_phase = phase_num

	match phase_num:
		0:  # Phase 1
			move_speed = base_move_speed
			damage = 28
		1:  # Phase 2 (half health)
			move_speed = base_move_speed
			damage = 35
		2:  # Phase 3 (enraged at 50%)
			is_enraged = true
			move_speed = enraged_move_speed
			damage = 45  # Slightly more than phase 2

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.9, 0.7, 0.5, 1)
		await get_tree().create_timer(0.5).timeout
		sprite.modulate = Color(1, 1, 1, 1)

func die() -> void:
	boss_defeated.emit(boss_name)

	# Trigger BossManager defeat
	if _boss_manager:
		_boss_manager.end_boss_encounter(true)

	super.die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		var dmg = damage
		if is_enraged:
			dmg = int(dmg * 2.0)
		if body.has_method("take_damage"):
			body.take_damage(dmg)
