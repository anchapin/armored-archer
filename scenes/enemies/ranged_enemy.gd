extends BaseEnemy

## Ranged enemy (Shooter) that attacks from a distance with projectiles.
##
## Behavior:
## - Maintains distance from player
## - Fires arrows/projectiles when in range
## - Retreats if player gets too close

# --- Ranged Attack Settings ---
var projectile_scene: PackedScene = preload("res://scenes/arrow.tscn")
var attack_range: float = 250.0
var detection_range: float = 450.0
var retreat_range: float = 100.0
var projectile_speed: float = 280.0
var projectile_damage_multiplier: float = 0.8

# --- AI State ---
var player_ref: CharacterBody2D = null
var is_attacking: bool = false
var attack_cooldown: float = 1.5
var attack_timer: float = 0.0
var is_retreating: bool = false

func _ready() -> void:
	max_health = 60
	move_speed = 100.0
	damage = 12
	xp_reward = 30
	super._ready()

func _physics_process(delta: float) -> void:
	if not player_ref:
		find_player()

	if player_ref:
		var distance_to_player: float = global_position.distance_to(player_ref.global_position)

		# Update attack timer
		attack_timer += delta

		if distance_to_player <= detection_range:
			if distance_to_player <= retreat_range:
				# Too close - retreat
				retreat_from_player()
			elif distance_to_player <= attack_range and attack_timer >= attack_cooldown:
				# In attack range
				stop_and_attack()
			else:
				# Maintain distance
				maintain_distance(distance_to_player)
		else:
			# Move towards player if out of range
			chase_player()

	var _moved = move_and_slide()

func find_player() -> void:
	var players: Array[Node] = get_tree().get_nodes_in_group("Player")
	if players.size() > 0:
		player_ref = players[0] as CharacterBody2D

func chase_player() -> void:
	if not player_ref:
		return
	is_retreating = false
	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed * 0.8
	if sprite:
		sprite.flip_h = direction.x < 0

func maintain_distance(distance: float) -> void:
	if not player_ref:
		return

	var direction: Vector2 = (player_ref.global_position - global_position).normalized()

	# If too far, approach; if too close, back away
	var target_direction = direction
	if distance > attack_range * 0.8:
		velocity = target_direction * move_speed * 0.6
	else:
		velocity = -target_direction * move_speed * 0.5

	if sprite:
		sprite.flip_h = direction.x < 0

func retreat_from_player() -> void:
	if not player_ref:
		return

	is_retreating = true
	var direction: Vector2 = (global_position - player_ref.global_position).normalized()
	velocity = direction * move_speed * 1.2
	if sprite:
		sprite.flip_h = direction.x < 0

func stop_and_attack() -> void:
	velocity = Vector2.ZERO

	if attack_timer >= attack_cooldown:
		perform_ranged_attack()

func perform_ranged_attack() -> void:
	if not player_ref:
		return

	attack_timer = 0.0

	if projectile_scene:
		var projectile: Node = projectile_scene.instantiate()
		var direction: Vector2 = (player_ref.global_position - global_position).normalized()

		projectile.global_position = global_position + direction * 30.0
		projectile.rotation = direction.angle()

		# Set projectile damage
		if projectile.has_method("set_damage"):
			projectile.set_damage(int(damage * projectile_damage_multiplier))

		get_tree().root.add_child(projectile)

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		var game_manager = get_node_or_null("/root/GameManager")
		if game_manager and game_manager.has_method("take_player_damage"):
			game_manager.take_player_damage(damage)