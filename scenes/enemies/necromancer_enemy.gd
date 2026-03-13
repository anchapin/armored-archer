extends "res://scenes/enemies/base_enemy.gd"

## Summoner enemy (Necromancer) - summons smaller minions to fight.
##
## Behavior:
## - Maintains distance and summons minions
## - Minions attack player while necromancer supports
## - Can heal or buff minions
## - Low health but dangerous with minions

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 400.0
var attack_range: float = 200.0
var retreat_range: float = 80.0

# --- Summon Settings ---
var minion_scene: PackedScene = null  # Will be set to melee enemy
var max_minions: int = 3
var active_minions: int = 0
var summon_cooldown: float = 6.0
var summon_timer: float = 0.0
var is_summoning: bool = false

# --- Attack Settings ---
var magic_damage: int = 8
var attack_cooldown: float = 1.5
var attack_timer: float = 0.0

# --- Buff Settings ---
var buff_cooldown: float = 5.0
var buff_timer: float = 0.0

func _ready() -> void:
	max_health = 70
	move_speed = 90.0
	damage = magic_damage
	xp_reward = 55

	# Try to preload melee enemy for summoning
	minion_scene = preload("res://scenes/enemies/melee_enemy.tscn")

	super._ready()

func _physics_process(delta: float) -> void:
	if not player_ref:
		find_player()

	attack_timer += delta
	summon_timer += delta
	buff_timer += delta

	# Update active minion count
	update_minion_count()

	if player_ref:
		var distance_to_player: float = global_position.distance_to(player_ref.global_position)

		if distance_to_player <= detection_range:
			if distance_to_player <= retreat_range:
				# Too close - retreat
				retreat_from_player()
			elif distance_to_player <= attack_range:
				# In magic attack range
				if not is_summoning:
					maintain_distance_and_attack(distance_to_player)
			else:
				# Move into range
				approach_player(distance_to_player)

			# Summon minions when possible
			if summon_timer >= summon_cooldown and active_minions < max_minions:
				start_summoning()

			# Buff minions
			if buff_timer >= buff_cooldown and active_minions > 0:
				buff_minions()
		else:
			chase_player()

	move_and_slide()

func find_player() -> void:
	var players: Array[Node] = get_tree().get_nodes_in_group("Player")
	if players.size() > 0:
		player_ref = players[0] as CharacterBody2D

func chase_player() -> void:
	if not player_ref:
		return

	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed * 0.7
	if sprite:
		sprite.flip_h = direction.x < 0

func approach_player(_distance: float) -> void:
	if not player_ref:
		return

	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed * 0.5
	if sprite:
		sprite.flip_h = direction.x < 0

func maintain_distance_and_attack(distance: float) -> void:
	if not player_ref:
		return

	# Try to maintain optimal distance
	var direction: Vector2 = (player_ref.global_position - global_position).normalized()

	if distance < attack_range * 0.7:
		# Too close, back away
		velocity = -direction * move_speed * 0.6
	elif distance > attack_range * 0.9:
		# Too far, approach
		velocity = direction * move_speed * 0.4
	else:
		# Just right - stop and attack
		velocity = Vector2.ZERO

	if sprite:
		sprite.flip_h = direction.x < 0

	# Fire magic attack
	if attack_timer >= attack_cooldown:
		perform_magic_attack()

func retreat_from_player() -> void:
	if not player_ref:
		return

	var direction: Vector2 = (global_position - player_ref.global_position).normalized()
	velocity = direction * move_speed * 1.2
	if sprite:
		sprite.flip_h = direction.x < 0

func perform_magic_attack() -> void:
	attack_timer = 0.0

	if player_ref and player_ref.has_method("take_damage"):
		player_ref.take_damage(damage)

func start_summoning() -> void:
	if not minion_scene or active_minions >= max_minions:
		return

	is_summoning = true
	summon_timer = 0.0

	# Visual feedback - flash color
	if sprite:
		sprite.modulate = Color(0.5, 0, 0.5, 1)

	# Delay before summoning completes
	await get_tree().create_timer(1.0).timeout

	summon_minion()

	# Reset visual
	is_summoning = false
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func summon_minion() -> void:
	if not minion_scene:
		return

	var minion: Node = minion_scene.instantiate()

	# Spawn at random position around necromancer
	var spawn_offset: Vector2 = Vector2(randf_range(-60, 60), randf_range(-60, 60))
	minion.global_position = global_position + spawn_offset

	get_tree().root.add_child(minion)

	# Track this minion
	active_minions += 1
	minion.died.connect(_on_minion_died)

func _on_minion_died() -> void:
	active_minions = max(0, active_minions - 1)

func update_minion_count() -> void:
	# This is a fallback - in practice, the died signal handles it
	pass

func buff_minions() -> void:
	buff_timer = 0.0

	# Find all active minions and buff them
	var enemies: Array[Node] = get_tree().get_nodes_in_group("Enemies")
	for enemy in enemies:
		if enemy.has_method("apply_buff") and enemy != self:
			enemy.apply_buff("speed_boost", 3.0)  # 3 second speed boost

func take_damage(amount: int) -> void:
	# Necromancer is fragile - takes full damage
	current_health -= amount
	if current_health <= 0:
		die()

func die() -> void:
	# Kill all minions when necromancer dies
	var enemies: Array[Node] = get_tree().get_nodes_in_group("Enemies")
	for enemy in enemies:
		if enemy != self and "minion" in enemy.name.to_lower():
			enemy.take_damage(999)

	super.die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		if body.has_method("take_damage"):
			body.take_damage(damage)