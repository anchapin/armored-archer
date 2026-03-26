extends "res://scenes/enemies/base_enemy.gd"

## Speed enemy - fast but low health.
## Uses dash attacks to close distance quickly.
##
## Behavior:
## - Moves very fast
## - Performs dash attacks
## - Low health but hard to hit due to speed
## - Erratic movement patterns

# --- Node References ---
@onready var sprite: Sprite2D = $Sprite2D

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 450.0
var attack_range: float = 40.0
var is_attacking: bool = false
var attack_cooldown: float = 1.2
var attack_timer: float = 0.0

# --- Dash Settings ---
var dash_cooldown: float = 3.0
var dash_timer: float = 0.0
var is_dashing: bool = false
var dash_speed_mult: float = 4.0

# --- Movement ---
var direction_change_timer: float = 0.0
var move_direction: Vector2 = Vector2.ZERO

func _ready() -> void:
	max_health = 40
	move_speed = 280.0
	damage = 12
	xp_reward = 30
	super._ready()

func _physics_process(delta: float) -> void:
	if not player_ref:
		find_player()

	if player_ref:
		update_movement(delta)

		var distance_to_player = global_position.distance_to(player_ref.global_position)

		if distance_to_player <= detection_range:
			if distance_to_player > attack_range:
				chase_player()
			else:
				attack_player(delta)
		else:
			if not is_dashing:
				wander(delta)

	var _moved = move_and_slide()

func find_player() -> void:
	var players = get_tree().get_nodes_in_group("Player")
	if players.size() > 0:
		player_ref = players[0]

func update_movement(delta: float) -> void:
	dash_timer += delta
	attack_timer += delta

	# Handle dash ability
	if dash_timer >= dash_cooldown and player_ref:
		var distance = global_position.distance_to(player_ref.global_position)
		if distance > attack_range and distance < detection_range * 0.8:
			perform_dash()
			dash_timer = 0.0

func chase_player() -> void:
	if not player_ref or is_dashing:
		return
	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed
	if sprite:
		sprite.flip_h = direction.x < 0

func attack_player(_delta: float) -> void:
	velocity = Vector2.ZERO

	if attack_timer >= attack_cooldown:
		attack_timer = 0.0
		perform_attack()

func perform_attack() -> void:
	if player_ref and player_ref.has_method("take_damage"):
		player_ref.take_damage(damage)

func perform_dash() -> void:
	if is_dashing or not player_ref:
		return

	is_dashing = true

	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed * dash_speed_mult

	# Face in dash direction
	if sprite:
		sprite.flip_h = direction.x < 0

	# Short dash duration
	await get_tree().create_timer(0.2).timeout
	is_dashing = false
	velocity = Vector2.ZERO

func wander(delta: float) -> void:
	# Random movement when player not in range
	direction_change_timer += delta

	if direction_change_timer >= 1.0:
		direction_change_timer = 0.0
		move_direction = Vector2(randf_range(-1, 1), randf_range(-1, 1)).normalized()

	velocity = move_direction * move_speed * 0.5

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body.is_in_group("Player"):
		body.take_damage(damage)
