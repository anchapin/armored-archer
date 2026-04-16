class_name ShadowAssassin
extends BaseEnemy

## Shadow Assassin Boss - Stealthy boss with teleport mechanics.
##
## Phase 1: Dagger attacks, Shadow Step (teleport behind player), Backstab
## Phase 2 (50% health): Shadow Clone (creates decoy), Phantom Strike (multiple hits)
## Special: Shadow Step - Teleports behind player, guaranteed backstab
## Special: Shadow Clone - Creates 2 decoys that distract
##
## Unique mechanics:
## - Shadow Step: Instant teleport behind player with increased damage
## - Backstab: 50% bonus damage when attacking from behind
## - Shadow Clone: Creates decoys that attract attacks

# --- Boss Stats ---
@export var boss_name: String = "Shadow Assassin"

# --- AI State ---
var player_ref: Node2D = null
var detection_range: float = 500.0
var attack_range: float = 60.0

# --- Movement ---
var base_move_speed: float = 125.0
var enraged_move_speed: float = 165.0
var stealth_move_speed: float = 150.0

# --- Attack Settings ---
var attack_cooldown: float = 1.4
var attack_timer: float = 0.0

# --- Special Abilities ---
var shadow_step_cooldown: float = 8.0
var current_step_cooldown: float = 0.0

var clone_cooldown: float = 12.0
var clone_duration: float = 6.0
var current_clone_cooldown: float = 0.0

# --- Stealth ---
var is_stealthed: bool = false
var stealth_duration: float = 2.0
var stealth_timer: float = 0.0
var can_enter_stealth: bool = true
var stealth_cooldown: float = 5.0
var stealth_enter_timer: float = 0.0

# --- Backstab Bonus ---
var backstab_multiplier: float = 1.5

# --- Phantom Strike (Phase 2) ---
var phantom_cooldown: float = 10.0
var phantom_damage: int = 20
var phantom_strikes: int = 3
var current_phantom_cooldown: float = 0.0

# --- Shadow Clone ---
var clone_scene: PackedScene = null
var active_clones: Array = []
var max_clones: int = 2

# --- Boss State ---
var current_phase: int = 1
var is_enraged: bool = false

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 850
	damage = 28
	move_speed = base_move_speed
	current_health = max_health
	add_to_group("Boss")
	super._ready()

	# Try to load shadow clone scene
	var clone_path = "res://scenes/enemies/shadow_clone.tscn"
	if ResourceLoader.exists(clone_path):
		clone_scene = load(clone_path) as PackedScene

	health_changed.emit(current_health, max_health)

func _physics_process(delta: float) -> void:
	if is_dead:
		return

	if not player_ref:
		find_player()

	# Update cooldowns
	if attack_timer > 0:
		attack_timer -= delta
	if current_step_cooldown > 0:
		current_step_cooldown -= delta
	if current_clone_cooldown > 0:
		current_clone_cooldown -= delta
	if current_phantom_cooldown > 0:
		current_phantom_cooldown -= delta
	if stealth_enter_timer > 0:
		stealth_enter_timer -= delta

	# Stealth management
	if is_stealthed:
		stealth_timer -= delta
		if stealth_timer <= 0:
			exit_stealth()
	elif can_enter_stealth and stealth_enter_timer <= 0 and randf() < 0.01:
		enter_stealth()

	# Clean up dead clones
	_clean_dead_clones()

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
	velocity = direction * (stealth_move_speed if is_stealthed else move_speed)
	if sprite:
		sprite.flip_h = direction.x < 0

func handle_attacks() -> void:
	velocity = Vector2.ZERO

	# Exit stealth before attacking
	if is_stealthed:
		exit_stealth()
		# Backstab bonus applies when exiting stealth behind player
		_perform_backstab()
		return

	# Shadow Step
	if current_step_cooldown <= 0 and randf() < 0.3:
		perform_shadow_step()
		return

	# Phantom Strike (Phase 2)
	if current_phase == 2 and current_phantom_cooldown <= 0 and randf() < 0.3:
		perform_phantom_strike()
		return

	# Shadow Clone (Phase 2)
	if current_phase == 2 and current_clone_cooldown <= 0 and active_clones.size() < max_clones and randf() < 0.3:
		perform_shadow_clone()
		return

	# Basic dagger attack
	if attack_timer <= 0:
		perform_dagger_attack()
		attack_timer = attack_cooldown

func perform_dagger_attack() -> void:
	if not player_ref:
		return

	var dagger_damage = damage
	if is_enraged:
		dagger_damage = int(dagger_damage * 1.4)

	# Check for backstab (attacking from behind)
	if _is_attacking_from_behind():
		dagger_damage = int(dagger_damage * backstab_multiplier)
		if sprite:
			sprite.modulate = Color(1, 0.3, 0.3, 1)  # Red tint for backstab

	if player_ref.has_method("take_damage"):
		player_ref.take_damage(dagger_damage)

	if sprite:
		await get_tree().create_timer(0.1).timeout
		sprite.modulate = Color(1, 1, 1, 1)

func _is_attacking_from_behind() -> bool:
	if not player_ref:
		return false

	var to_boss = global_position - player_ref.global_position
	var player_facing = Vector2(1, 0)  # Simplified - assumes player faces right
	# In real implementation, get player's actual facing direction

	# If boss is behind player (dot product with facing is negative)
	return to_boss.dot(player_facing) > 0

func perform_shadow_step() -> void:
	if not player_ref:
		return

	current_step_cooldown = shadow_step_cooldown

	# Visual feedback - fade out
	if sprite:
		sprite.modulate = Color(0, 0, 0, 0.5)

	await get_tree().create_timer(0.2).timeout

	# Teleport behind player
	var behind_offset = Vector2(-60, 0)  # Behind player (assuming player faces right)
	var new_pos = player_ref.global_position + behind_offset
	new_pos = new_pos.clamp(Vector2(50, 50), Vector2(590, 310))
	global_position = new_pos

	# Enter stealth briefly
	enter_stealth()
	stealth_duration = 1.5

	# Immediate backstab when exiting stealth
	await get_tree().create_timer(0.2).timeout
	exit_stealth()
	_perform_backstab()

func _perform_backstab() -> void:
	if not player_ref:
		return

	var backstab_damage = int(damage * backstab_multiplier)
	if is_enraged:
		backstab_damage = int(backstab_damage * 1.4)

	# Visual feedback
	if sprite:
		sprite.modulate = Color(1, 0.2, 0.2, 1)
		sprite.scale = Vector2(1.1, 1.1)

	if player_ref.has_method("take_damage"):
		player_ref.take_damage(backstab_damage)

	if player_ref.has_method("apply_knockback"):
		var direction = (player_ref.global_position - global_position).normalized()
		player_ref.apply_knockback(direction * 100.0)

	if sprite:
		await get_tree().create_timer(0.15).timeout
		sprite.modulate = Color(1, 1, 1, 1)
		sprite.scale = Vector2(1, 1)

func perform_phantom_strike() -> void:
	current_phantom_cooldown = phantom_cooldown

	# Visual feedback - rapid movement
	if sprite:
		sprite.modulate = Color(0.5, 0, 0.8, 1)

	velocity = Vector2.ZERO

	await get_tree().create_timer(0.3).timeout

	# Perform multiple rapid strikes
	for i in range(phantom_strikes):
		if not player_ref:
			break

		var strike_damage = phantom_damage
		if is_enraged:
			strike_damage = int(strike_damage * 1.5)

		if player_ref.has_method("take_damage"):
			player_ref.take_damage(strike_damage)

		# Small teleport between strikes
		if i < phantom_strikes - 1:
			var offset = Vector2(randf() * 80 - 40, randf() * 80 - 40)
			var new_pos = player_ref.global_position + offset
			new_pos = new_pos.clamp(Vector2(50, 50), Vector2(590, 310))
			global_position = new_pos
			await get_tree().create_timer(0.2).timeout

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func perform_shadow_clone() -> void:
	current_clone_cooldown = clone_cooldown

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.3, 0.3, 0.3, 1)

	velocity = Vector2.ZERO

	await get_tree().create_timer(0.4).timeout

	# Spawn clones
	if clone_scene:
		var clones_to_spawn = min(max_clones - active_clones.size(), 2)
		for i in range(clones_to_spawn):
			var offset_angle = (PI * 2.0 * i) / clones_to_spawn
			var spawn_pos = global_position + Vector2(cos(offset_angle), sin(offset_angle)) * 80
			_spawn_clone(spawn_pos)

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func _spawn_clone(position: Vector2) -> void:
	if not clone_scene:
		return

	var clone = clone_scene.instantiate()
	get_tree().root.add_child(clone)
	clone.global_position = position

	# Set clone stats
	if clone.has_method("set_stats"):
		clone.set_stats({
			"health": 100,
			"duration": clone_duration
		})

	# Connect to clone death signal
	if clone.has_signal("died"):
		clone.died.connect(_on_clone_died.bind(clone))

	active_clones.append(clone)

func _on_clone_died(clone: Node) -> void:
	if clone in active_clones:
		active_clones.erase(clone)

func _clean_dead_clones() -> void:
	var clones_to_remove = []
	for clone in active_clones:
		if not is_instance_valid(clone) or (clone.has_method("is_dead") and clone.is_dead):
			clones_to_remove.append(clone)

	for clone in clones_to_remove:
		active_clones.erase(clone)

func enter_stealth() -> void:
	is_stealthed = true
	stealth_timer = stealth_duration
	can_enter_stealth = false
	stealth_enter_timer = stealth_cooldown

	# Visual feedback - semi-transparent
	if sprite:
		sprite.modulate = Color(0.5, 0.5, 0.5, 0.4)

func exit_stealth() -> void:
	is_stealthed = false

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func take_damage(amount: int) -> void:
	# Reduced damage while stealthed
	var actual_damage = amount
	if is_stealthed:
		actual_damage = int(amount * 0.7)  # 30% damage reduction in stealth

	super.take_damage(actual_damage)
	health_changed.emit(current_health, max_health)

	# Exit stealth on taking damage
	if is_stealthed:
		exit_stealth()

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
	damage = 38
	attack_cooldown = 1.2
	phantom_strikes = 4  # More strikes in Phase 2

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.4, 0, 0.6, 1)
		await get_tree().create_timer(0.5).timeout
		sprite.modulate = Color(1, 1, 1, 1)

func die() -> void:
	boss_defeated.emit(boss_name)

	# Remove all clones
	for clone in active_clones:
		if is_instance_valid(clone) and clone.has_method("die"):
			clone.die()

	super.die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		var dmg = damage
		if is_enraged:
			dmg = int(dmg * 1.4)
		if _is_attacking_from_behind():
			dmg = int(dmg * backstab_multiplier)
		if body.has_method("take_damage"):
			body.take_damage(dmg)
