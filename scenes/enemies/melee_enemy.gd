extends "res://scenes/enemies/base_enemy.gd"

## AI state variables
var player_ref: CharacterBody2D = null
var detection_range: float = 400.0
var attack_range: float = 50.0
var is_attacking: bool = false
var attack_cooldown: float = 1.0
var attack_timer: float = 0.0

func _ready() -> void:
	super._ready()

func _physics_process(delta: float) -> void:
	if not player_ref:
		find_player()

	if player_ref:
		var distance_to_player = global_position.distance_to(player_ref.global_position)

		if distance_to_player <= detection_range:
			if distance_to_player > attack_range:
				chase_player()
			else:
				attack_player(delta)
		else:
			velocity = Vector2.ZERO

	move_and_slide()

func find_player() -> void:
	var players = get_tree().get_nodes_in_group("Player")
	if players.size() > 0:
		player_ref = players[0]

func chase_player() -> void:
	if not player_ref:
		return
	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed
	if sprite:
		sprite.flip_h = direction.x < 0

func attack_player(delta: float) -> void:
	velocity = Vector2.ZERO
	attack_timer += delta

	if attack_timer >= attack_cooldown:
		attack_timer = 0.0
		perform_attack()

func perform_attack() -> void:
	if player_ref and player_ref.has_method("take_damage"):
		player_ref.take_damage(damage)

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body.is_in_group("Player"):
		body.take_damage(damage)
