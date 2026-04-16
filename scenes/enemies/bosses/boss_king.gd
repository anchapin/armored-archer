class_name ElderKing
extends BaseEnemy

## Elder King Boss - Royal boss with summoning mechanics.
##
## Phase 1: Sword combos, Royal Command (summon guards)
## Phase 2 (50% health): King's Blessing (self-heal), Judgment (widened AOE)
## Special: Royal Command - Summons 2 Elite Guards to fight
## Special: King's Blessing - Heals 25% max health, single use
##
## Unique mechanics:
## - Royal Command: Summons elite guards that attack player
## - Sword Combo: Multi-hit attack with increasing damage
## - Judgment: Wide AOE attack in Phase 2

# --- Boss Stats ---
@export var boss_name: String = "Elder King"

# --- AI State ---
var player_ref: Node2D = null
var detection_range: float = 550.0
var attack_range: float = 75.0

# --- Movement ---
var base_move_speed: float = 100.0
var enraged_move_speed: float = 140.0

# --- Attack Settings ---
var attack_cooldown: float = 1.8
var attack_timer: float = 0.0
var combo_count: int = 0
var max_combo: int = 3

# --- Special Abilities ---
var summon_cooldown: float = 12.0
var summon_duration: float = 8.0
var current_special_cooldown: float = 0.0

var blessing_used: bool = false
var blessing_heal_percent: float = 0.25  # 25% max health

# --- Judgment Attack (Phase 2) ---
var judgment_cooldown: float = 10.0
var judgment_damage: int = 40
var judgment_radius: float = 180.0

# --- Elite Guard Summon ---
var elite_guard_scene: PackedScene = null
var active_guards: Array = []
var max_guards: int = 2

# --- Boss State ---
var current_phase: int = 1
var is_enraged: bool = false

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 1000
	damage = 35
	move_speed = base_move_speed
	current_health = max_health
	add_to_group("Boss")
	super._ready()

	# Try to load elite guard scene
	var guard_path = "res://scenes/enemies/elite_guard.tscn"
	if ResourceLoader.exists(guard_path):
		elite_guard_scene = load(guard_path) as PackedScene

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

	# Clean up dead guards
	_clean_dead_guards()

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

	# Phase 2: Can use Judgment
	if current_phase == 2 and current_special_cooldown <= 0 and randf() < 0.3:
		perform_judgment()
		return

	# Royal Command (summon guards) - can use if not at max guards
	if current_special_cooldown <= 0 and active_guards.size() < max_guards and randf() < 0.4:
		perform_royal_command()
		return

	# King's Blessing - single use at low health in Phase 2
	if current_phase == 2 and not blessing_used and float(current_health) / float(max_health) < 0.3:
		perform_kings_blessing()
		return

	# Sword combo attack
	if attack_timer <= 0:
		perform_sword_combo()
		attack_timer = attack_cooldown

func perform_sword_combo() -> void:
	if not player_ref:
		return

	combo_count += 1
	var combo_damage = damage + (combo_count * 10)  # Increasing damage

	if is_enraged:
		combo_damage = int(combo_damage * 1.4)

	if player_ref.has_method("take_damage"):
		player_ref.take_damage(combo_damage)

	# Visual feedback for combo
	if sprite:
		sprite.modulate = Color(1, 0.9, 0.5, 1)  # Gold tint
		await get_tree().create_timer(0.15).timeout
		sprite.modulate = Color(1, 1, 1, 1)

	# Reset combo after max hits
	if combo_count >= max_combo:
		combo_count = 0
		attack_timer = 1.0  # Longer cooldown after full combo

func perform_royal_command() -> void:
	current_special_cooldown = summon_cooldown

	# Visual feedback - raise sword
	if sprite:
		sprite.modulate = Color(1, 0.8, 0.2, 1)  # Bright gold
		sprite.scale = Vector2(1.1, 1.1)

	velocity = Vector2.ZERO

	await get_tree().create_timer(0.6).timeout

	# Summon guards
	if elite_guard_scene:
		var guards_to_spawn = min(max_guards - active_guards.size(), 2)
		for i in range(guards_to_spawn):
			var offset_angle = (PI * 2.0 * i) / guards_to_spawn
			var spawn_pos = global_position + Vector2(cos(offset_angle), sin(offset_angle)) * 100
			_spawn_guard(spawn_pos)

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)
		sprite.scale = Vector2(1, 1)

func _spawn_guard(position: Vector2) -> void:
	if not elite_guard_scene:
		return

	var guard = elite_guard_scene.instantiate()
	get_tree().root.add_child(guard)
	guard.global_position = position

	# Set guard stats
	if guard.has_method("set_stats"):
		guard.set_stats({
			"health": 150,
			"damage": 15,
			"speed": 80,
			"duration": summon_duration
		})

	# Connect to guard death signal
	if guard.has_signal("died"):
		guard.died.connect(_on_guard_died.bind(guard))

	active_guards.append(guard)

func _on_guard_died(guard: Node) -> void:
	if guard in active_guards:
		active_guards.erase(guard)

func _clean_dead_guards() -> void:
	var guards_to_remove = []
	for guard in active_guards:
		if not is_instance_valid(guard) or (guard.has_method("is_dead") and guard.is_dead):
			guards_to_remove.append(guard)

	for guard in guards_to_remove:
		active_guards.erase(guard)

func perform_kings_blessing() -> void:
	if blessing_used:
		return

	blessing_used = true

	# Visual feedback - golden aura
	if sprite:
		sprite.modulate = Color(1, 1, 0.6, 1)  # Golden
		sprite.scale = Vector2(1.3, 1.3)

	var heal_amount = int(max_health * blessing_heal_percent)
	current_health = min(current_health + heal_amount, max_health)
	health_changed.emit(current_health, max_health)

	await get_tree().create_timer(0.8).timeout

	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)
		sprite.scale = Vector2(1, 1)

func perform_judgment() -> void:
	current_special_cooldown = judgment_cooldown

	# Visual feedback - raise hands
	if sprite:
		sprite.modulate = Color(0.9, 0.9, 1, 1)  # Pale glow
		sprite.scale = Vector2(1.2, 1.2)

	velocity = Vector2.ZERO

	await get_tree().create_timer(0.7).timeout

	# Deal wide AOE damage
	var judgment_dmg = judgment_damage
	if is_enraged:
		judgment_dmg = int(judgment_damage * 1.5)

	if player_ref:
		var distance = global_position.distance_to(player_ref.global_position)
		if distance <= judgment_radius:
			if player_ref.has_method("take_damage"):
				player_ref.take_damage(judgment_dmg)

			# Slight knockback
			if player_ref.has_method("apply_knockback"):
				var direction = (player_ref.global_position - global_position).normalized()
				player_ref.apply_knockback(direction * 80.0)

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)
		sprite.scale = Vector2(1, 1)

func take_damage(amount: int) -> void:
	super.take_damage(amount)
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
	attack_cooldown = 1.4

	# Visual feedback
	if sprite:
		sprite.modulate = Color(1, 0.4, 0.4, 1)
		await get_tree().create_timer(0.5).timeout
		sprite.modulate = Color(1, 1, 1, 1)

func die() -> void:
	boss_defeated.emit(boss_name)

	# Remove all guards
	for guard in active_guards:
		if is_instance_valid(guard) and guard.has_method("die"):
			guard.die()

	super.die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		var dmg = damage
		if is_enraged:
			dmg = int(dmg * 1.4)
		if body.has_method("take_damage"):
			body.take_damage(dmg)
