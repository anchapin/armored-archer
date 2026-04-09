class_name GuardianBoss
extends BaseEnemy

## Guardian Boss (Stone Guardian) - defense-heavy boss with multiple phases.
##
## Phase 1 (100-75%): Basic melee attacks, slow movement
## Phase 2 (75-50%): Ground slam shockwave attack (AOE)
## Phase 3 (50-0%): Shield bash combo, enraged movement
##
## Integrates with BossManager for phase management and loot.

# --- Boss Stats ---
@export var boss_name: String = "Stone Guardian"

# --- AI State ---
var player_ref: Node2D = null
var detection_range: float = 500.0
var attack_range: float = 80.0

# --- Movement ---
var base_move_speed: float = 80.0
var enraged_speed: float = 100.0

# --- Attack Settings ---
var attack_cooldown: float = 2.5
var attack_timer: float = 0.0

# --- Special Attack Settings ---
var ground_slam_cooldown: float = 5.0
var shield_bash_cooldown: float = 4.0
var current_special_cooldown: float = 0.0

# --- Boss State ---
var current_phase: int = 0
var is_enraged: bool = false

# --- Manager References ---
var _boss_manager: Node

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 800
	damage = 15
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
		attack_damage = int(damage * 1.2)

	if player_ref.has_method("take_damage"):
		player_ref.take_damage(attack_damage)

func _perform_special_attack(attack_data: Dictionary) -> void:
	var attack_name = attack_data.keys()[0] if attack_data else ""

	match attack_name:
		"ground_slam":
			perform_ground_slam(attack_data.ground_slam)
		"shield_bash":
			perform_shield_bash(attack_data.shield_bash)

func perform_ground_slam(attack_data: Dictionary) -> void:
	if not player_ref:
		return

	var slam_cooldown = attack_data.get("cooldown", 5.0)
	var slam_damage = attack_data.get("damage", 30)
	var aoe_radius = attack_data.get("aoe_radius", 100.0)

	current_special_cooldown = slam_cooldown

	# Visual feedback - shake
	if sprite:
		sprite.modulate = Color(0.7, 0.6, 0.5, 1)

	# Stop movement during slam
	velocity = Vector2.ZERO

	await get_tree().create_timer(0.5).timeout

	# Check for players in range
	if player_ref:
		var distance = global_position.distance_to(player_ref.global_position)
		if distance <= aoe_radius:
			var final_damage = slam_damage
			if is_enraged:
				final_damage = int(slam_damage * 1.2)
			if player_ref.has_method("take_damage"):
				player_ref.take_damage(final_damage)

			# Knockback
			if player_ref.has_method("apply_knockback"):
				var direction = (player_ref.global_position - global_position).normalized()
				player_ref.apply_knockback(direction * 80.0)

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func perform_shield_bash(attack_data: Dictionary) -> void:
	if not player_ref:
		return

	var bash_cooldown = attack_data.get("cooldown", 4.0)
	var bash_damage = attack_data.get("damage", 20)
	var stun_duration = attack_data.get("stun_duration", 1.5)

	current_special_cooldown = bash_cooldown

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.8, 0.7, 0.6, 1)

	velocity = Vector2.ZERO

	await get_tree().create_timer(0.3).timeout

	if player_ref:
		var distance = global_position.distance_to(player_ref.global_position)
		if distance <= attack_range:
			var final_damage = bash_damage
			if is_enraged:
				final_damage = int(bash_damage * 1.2)
			if player_ref.has_method("take_damage"):
				player_ref.take_damage(final_damage)

			# Stun effect
			if player_ref.has_method("apply_stun"):
				player_ref.apply_stun(stun_duration)

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
			damage = 15
		1:  # Phase 2
			move_speed = base_move_speed
			damage = 18
		2:  # Phase 3 (enraged)
			is_enraged = true
			move_speed = enraged_speed
			damage = 22

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.8, 0.7, 0.6, 1)
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
			dmg = int(dmg * 1.2)
		if body.has_method("take_damage"):
			body.take_damage(dmg)
