extends "res://scenes/enemies/base_enemy.gd"

## Ranged enemy that attacks from a distance with projectiles.
##
## Behavior:
## - Maintains distance from player
## - Shoots projectiles when in attack range
## - Periodically fires even when player is far

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 500.0
var attack_range: float = 250.0
var is_attacking: bool = false
var attack_cooldown: float = 2.0
var attack_timer: float = 0.0
var retreat_range: float = 180.0
var is_retreating: bool = false
var retreat_timer: float = 0.0

# --- Projectile Settings ---
var projectile_cooldown: float = 2.5
var projectile_timer: float = 0.0
var projectile_speed: float = 250.0
var projectile_scene: PackedScene

func _ready() -> void:
	max_health = 60
	move_speed = 100.0
	damage = 15
	xp_reward = 35
	super._ready()
	
	# Try to load arrow scene for projectiles
	projectile_scene = preload("res://scenes/arrow.tscn")

func _physics_process(delta: float) -> void:
	if not player_ref:
		find_player()

	if player_ref:
		var distance_to_player = global_position.distance_to(player_ref.global_position)

		if distance_to_player <= detection_range:
			if distance_to_player < retreat_range:
				retreat_from_player()
			elif distance_to_player > attack_range:
				approach_player()
			else:
				velocity = Vector2.ZERO
				attack_timer += delta
				projectile_timer += delta
				if attack_timer >= attack_cooldown or projectile_timer >= projectile_cooldown:
					perform_ranged_attack()
		else:
			velocity = Vector2.ZERO

	move_and_slide()

func find_player() -> void:
	var players = get_tree().get_nodes_in_group("Player")
	if players.size() > 0:
		player_ref = players[0]

func approach_player() -> void:
	if not player_ref:
		return
	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed
	if sprite:
		sprite.flip_h = direction.x < 0

func retreat_from_player() -> void:
	if not player_ref:
		return
	# Move away from player
	var direction: Vector2 = (global_position - player_ref.global_position).normalized()
	velocity = direction * move_speed * 0.8
	if sprite:
		sprite.flip_h = direction.x < 0

func perform_ranged_attack() -> void:
	attack_timer = 0.0
	projectile_timer = 0.0
	
	if player_ref and player_ref.has_method("take_damage"):
		player_ref.take_damage(damage)
	
	fire_projectile()

func fire_projectile() -> void:
	if not player_ref or not projectile_scene:
		return

	var projectile: Node = projectile_scene.instantiate()
	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	
	projectile.global_position = global_position + direction * 30.0
	projectile.rotation = direction.angle()
	projectile.scale = Vector2(0.8, 0.8)
	
	get_tree().root.add_child(projectile)

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body.is_in_group("Player"):
		body.take_damage(damage)
