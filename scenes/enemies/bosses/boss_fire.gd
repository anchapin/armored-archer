class_name WarlockBoss
extends BaseEnemy

## Warlock Boss (Shadow Warlock) - ranged spells boss with minion summoning.
##
## Phase 1: Shadow bolt projectiles, teleport dodge
## Phase 2: Summon 2 shadow minions at transition
## Phase 3: Dual shadow bolts + rapid teleports
##
## Integrates with BossManager for phase management and loot.

# --- Boss Stats ---
@export var boss_name: String = "Shadow Warlock"

# --- AI State ---
var player_ref: Node2D = null
var detection_range: float = 400.0
var attack_range: float = 250.0

# --- Movement ---
var base_move_speed: float = 90.0
var teleport_range: float = 150.0

# --- Attack Settings ---
var attack_cooldown: float = 2.0
var attack_timer: float = 0.0

# --- Special Attack Settings ---
var current_special_cooldown: float = 0.0
var can_summon_minions: bool = false

# --- Boss State ---
var current_phase: int = 0
var is_enraged: bool = false

# --- Manager References ---
var _boss_manager: Node

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 700
	damage = 18
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
			# Warlock keeps distance
			if distance_to_player < 150.0:
				_teleport_away()
			elif distance_to_player > attack_range:
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

	# Shadow bolt attack
	if attack_timer <= 0:
		fire_shadow_bolt()
		attack_timer = attack_cooldown

func fire_shadow_bolt() -> void:
	if not player_ref:
		return

	var bolt_damage = damage
	if is_enraged:
		bolt_damage = int(damage * 1.3)

	# Create shadow bolt projectile
	var projectile_scene: PackedScene = preload("res://scenes/arrow.tscn")
	if projectile_scene:
		var bolt = projectile_scene.instantiate()

		var direction = (player_ref.global_position - global_position).normalized()
		bolt.global_position = global_position + direction * 40.0
		bolt.rotation = direction.angle()
		bolt.scale = Vector2(1.5, 1.5)
		bolt.modulate = Color(0.3, 0.3, 0.4, 1)  # Dark purple

		if bolt.has_method("set_damage"):
			bolt.set_damage(bolt_damage)

		get_tree().root.add_child(bolt)

func _perform_special_attack(attack_data: Dictionary) -> void:
	var attack_name = attack_data.keys()[0] if attack_data else ""

	match attack_name:
		"shadow_bolt":
			fire_shadow_bolt()  # More powerful version
		"teleport":
			_perform_teleport(attack_data.teleport)
		"summon_minions":
			summon_shadow_minions(attack_data.summon_minions)

func _perform_teleport(attack_data: Dictionary) -> void:
	var teleport_cooldown = attack_data.get("cooldown", 6.0)
	var teleport_range_val = attack_data.get("range", 300.0)

	current_special_cooldown = teleport_cooldown

	# Visual feedback - fade out
	if sprite:
		sprite.modulate.a = 0.3

	await get_tree().create_timer(0.2).timeout

	# Teleport to random position near player
	if player_ref:
		var random_angle = randf() * PI * 2
		var teleport_pos = player_ref.global_position + Vector2(cos(random_angle), sin(random_angle)) * teleport_range_val

		# Keep within bounds
		teleport_pos = teleport_pos.clamp(Vector2(50, 50), Vector2(590, 310))
		global_position = teleport_pos

	# Visual feedback - fade in
	if sprite:
		sprite.modulate.a = 1.0

func summon_shadow_minions(attack_data: Dictionary) -> void:
	var summon_cooldown = attack_data.get("cooldown", 10.0)
	var minion_count = attack_data.get("minion_count", 2)

	current_special_cooldown = summon_cooldown

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.5, 0.3, 0.5, 1)

	# Spawn minions (using enemy spawner or enemy factory)
	for i in range(minion_count):
		var minion_pos = global_position + Vector2(randf_range(-50, 50), randf_range(-50, 50))

		# Use EnemySpawner (EnemyFactory was removed in issue #910)
		var enemy_spawner = get_node_or_null("/root/EnemySpawner")
		if enemy_spawner and enemy_spawner.has_method("spawn_archetype"):
			enemy_spawner.spawn_archetype("Goblin Scout", minion_pos, 2)  # Difficulty 2

	await get_tree().create_timer(0.5).timeout

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func _teleport_away() -> void:
	if not player_ref:
		return

	# Simple teleport away when too close
	var direction = (global_position - player_ref.global_position).normalized()
	var teleport_pos = global_position + direction * teleport_range

	teleport_pos = teleport_pos.clamp(Vector2(50, 50), Vector2(590, 310))

	# Visual feedback
	if sprite:
		sprite.modulate.a = 0.3

	await get_tree().create_timer(0.15).timeout

	global_position = teleport_pos

	if sprite:
		sprite.modulate.a = 1.0

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
			damage = 18
			can_summon_minions = false
		1:  # Phase 2
			move_speed = base_move_speed
			damage = 22
			can_summon_minions = true
		2:  # Phase 3
			is_enraged = true
			move_speed = base_move_speed * 1.2
			damage = 26
			can_summon_minions = true

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.6, 0.4, 0.6, 1)
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
			dmg = int(dmg * 1.3)
		if body.has_method("take_damage"):
			body.take_damage(dmg)
