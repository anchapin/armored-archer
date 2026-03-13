extends "res://scenes/enemies/base_enemy.gd"

## Swarmer enemy - erratic movement patterns.
## Uses unpredictable zig-zag movement to evade attacks.
##
## Behavior:
## - Erratic zig-zag movement
## - Can split (fake) to confuse
## - Medium health and damage
## - Hard to hit due to unpredictable movement

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 400.0
var attack_range: float = 35.0
var is_attacking: bool = false
var attack_cooldown: float = 0.8
var attack_timer: float = 0.0

# --- Movement Settings ---
var base_move_speed: float = 180.0
var direction_timer: float = 0.0
var current_direction: Vector2 = Vector2.RIGHT
var zigzag_enabled: bool = true
var zigzag_timer: float = 0.0
var zigzag_interval: float = 0.3
var move_noise: float = 50.0

# --- Dash Settings ---
var dash_cooldown: float = 4.0
var dash_timer: float = 0.0
var is_dashing: bool = false

func _ready() -> void:
	max_health = 70
	move_speed = base_move_speed
	damage = 10
	xp_reward = 40
	super._ready()

func _physics_process(delta: float) -> void:
	direction_timer += delta
	zigzag_timer += delta
	dash_timer += delta

	# Change direction periodically
	if direction_timer >= 0.5:
		direction_timer = 0.0
		change_direction()

	# Check for dash ability
	if dash_timer >= dash_cooldown and player_ref:
		var distance = global_position.distance_to(player_ref.global_position)
		if distance > attack_range and distance < detection_range:
			perform_dash()
			dash_timer = 0.0

	if not player_ref:
		find_player()

	if player_ref:
		var distance_to_player = global_position.distance_to(player_ref.global_position)

		if distance_to_player <= detection_range:
			if distance_to_player > attack_range:
				zigzag_toward_player(delta)
			else:
				attack_player(delta)
		else:
			wander(delta)

	move_and_slide()

func find_player() -> void:
	var players = get_tree().get_nodes_in_group("Player")
	if players.size() > 0:
		player_ref = players[0]

func change_direction() -> void:
	if not player_ref:
		current_direction = Vector2(randf_range(-1, 1), randf_range(-1, 1)).normalized()
		return

	# General direction toward player with noise
	var to_player = (player_ref.global_position - global_position).normalized()
	var noise = Vector2(randf_range(-0.5, 0.5), randf_range(-0.5, 0.5))
	current_direction = (to_player + noise).normalized()

func zigzag_toward_player(_delta: float) -> void:
	if not player_ref or is_dashing:
		return

	# Get base direction to player
	var to_player = (player_ref.global_position - global_position).normalized()

	# Add perpendicular zigzag motion
	var perpendicular = Vector2(-to_player.y, to_player.x)
	var zigzag = 0.0

	if zigzag_timer >= zigzag_interval:
		zigzag_timer = 0.0
		zigzag = randf_range(-1, 1)

	var final_direction = (to_player + perpendicular * zigzag * 0.8).normalized()
	velocity = final_direction * move_speed

	if sprite:
		sprite.flip_h = final_direction.x < 0

func attack_player(delta: float) -> void:
	velocity = Vector2.ZERO
	attack_timer += delta

	if attack_timer >= attack_cooldown:
		attack_timer = 0.0
		perform_attack()

func perform_attack() -> void:
	if player_ref and player_ref.has_method("take_damage"):
		player_ref.take_damage(damage)

func wander(_delta: float) -> void:
	velocity = current_direction * move_speed * 0.5

func perform_dash() -> void:
	if is_dashing or not player_ref:
		return

	is_dashing = true

	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed * 3.0

	if sprite:
		sprite.flip_h = direction.x < 0

	await get_tree().create_timer(0.15).timeout
	is_dashing = false
	velocity = Vector2.ZERO

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body.is_in_group("Player"):
		body.take_damage(damage)
