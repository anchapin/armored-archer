extends "res://scenes/enemies/base_enemy.gd"

## Speed enemy (Scout) - fast enemy with low health but high speed.
##
## Behavior:
## - Very fast movement to quickly close distance
## - Low health but compensates with numbers
## - Performs quick hit-and-run attacks

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 350.0
var attack_range: float = 35.0
var is_attacking: bool = false
var attack_cooldown: float = 0.8
var attack_timer: float = 0.0
var hit_and_run_timer: float = 0.0
var is_retreating: bool = false

# --- Hit and Run Settings ---
var retreat_duration: float = 0.5
var attack_pause: float = 0.3

func _ready() -> void:
	max_health = 40
	move_speed = 220.0
	damage = 8
	xp_reward = 20
	super._ready()

func _physics_process(delta: float) -> void:
	if not player_ref:
		find_player()

	attack_timer += delta
	hit_and_run_timer += delta

	if player_ref:
		var distance_to_player: float = global_position.distance_to(player_ref.global_position)

		if distance_to_player <= detection_range:
			if is_retreating:
				retreat_after_attack()
			elif distance_to_player > attack_range:
				chase_player()
			else:
				# In attack range
				if not is_attacking and attack_timer >= attack_cooldown:
					perform_hit_and_run_attack()
				else:
					velocity = Vector2.ZERO
		else:
			velocity = Vector2.ZERO

	var _moved = move_and_slide()

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

func perform_hit_and_run_attack() -> void:
	is_attacking = true
	attack_timer = 0.0

	# Deal damage
	var game_manager = get_node_or_null("/root/GameManager")
	if game_manager and game_manager.has_method("take_player_damage"):
		game_manager.take_player_damage(damage)

	# Brief pause before retreating
	await get_tree().create_timer(attack_pause).timeout

	# Start retreat
	is_retreating = true
	hit_and_run_timer = 0.0

	# Retreat for a short time
	await get_tree().create_timer(retreat_duration).timeout

	is_retreating = false
	is_attacking = false

func retreat_after_attack() -> void:
	if not player_ref:
		return

	# Move away from player
	var direction: Vector2 = (global_position - player_ref.global_position).normalized()
	velocity = direction * move_speed * 1.3
	if sprite:
		sprite.flip_h = direction.x < 0

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		var game_manager = get_node_or_null("/root/GameManager")
		if game_manager and game_manager.has_method("take_player_damage"):
			game_manager.take_player_damage(damage)