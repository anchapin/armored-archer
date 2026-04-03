extends "res://scenes/enemies/base_enemy.gd"

## Shield enemy (Guardian) - has a shield that blocks damage.
##
## Behavior:
## - Has a shield that absorbs some damage
## - Shield regenerates after being broken
## - Stationary or slow moving defender type
## - Blocks player movement

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 200.0
var attack_range: float = 40.0
var is_attacking: bool = false
var attack_cooldown: float = 1.8
var attack_timer: float = 0.0

# --- Shield Settings ---
var max_shield_health: int = 50
var shield_health: int = 50
var shield_regen_cooldown: float = 4.0
var shield_regen_timer: float = 0.0
var shield_damage_reduction: float = 0.6  # Blocks 60% of damage
var is_shield_active: bool = true

# --- Parry Settings ---
var can_parry: bool = true
var parry_window: float = 0.4
var parry_timer: float = 0.0
var is_parrying: bool = false
var parry_cooldown: float = 3.0

func _ready() -> void:
	max_health = 80
	move_speed = 70.0
	damage = 15
	xp_reward = 45
	current_health = max_health
	shield_health = max_shield_health
	super._ready()

func _physics_process(delta: float) -> void:
	if not player_ref:
		find_player()

	attack_timer += delta
	shield_regen_timer += delta
	parry_timer += delta

	# Update parry state
	if is_parrying:
		parry_timer += delta
		if parry_timer >= parry_window:
			is_parrying = false

	# Regenerate shield if broken and cooldown passed
	if shield_health <= 0 and shield_regen_timer >= shield_regen_cooldown:
		regenerate_shield()

	if player_ref:
		var distance_to_player: float = global_position.distance_to(player_ref.global_position)

		if distance_to_player <= detection_range:
			if distance_to_player > attack_range:
				# Move towards player but slowly (defender)
				chase_player()
			else:
				# In attack range
				if not is_attacking and attack_timer >= attack_cooldown:
					attempt_parry()
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
	velocity = direction * move_speed * 0.5  # Slow movement
	if sprite:
		sprite.flip_h = direction.x < 0

func attempt_parry() -> void:
	# Guardian can parry attacks - enters defensive stance briefly
	if can_parry and not is_parrying:
		is_parrying = true
		parry_timer = 0.0
		can_parry = false

		# Visual feedback - flash shield color
		if sprite:
			sprite.modulate = Color(0.3, 0.3, 1.0, 1.0)

		# Check if player attacks during parry window
		await get_tree().create_timer(parry_window).timeout

		# After parry window, attack if player is still close
		if player_ref:
			var distance: float = global_position.distance_to(player_ref.global_position)
			if distance <= attack_range:
				perform_shield_bash()

		# Reset parry cooldown
		await get_tree().create_timer(parry_cooldown - parry_window).timeout
		can_parry = true
		if sprite:
			sprite.modulate = Color(1, 1, 1, 1)
	else:
		# Not parrying, just attack
		perform_shield_bash()

func perform_shield_bash() -> void:
	is_attacking = true
	attack_timer = 0.0

	# Push player back slightly
	if player_ref and player_ref.has_method("apply_knockback"):
		var direction: Vector2 = (player_ref.global_position - global_position).normalized()
		player_ref.apply_knockback(direction * 40.0)

	var game_manager = get_node_or_null("/root/GameManager")
	if game_manager and game_manager.has_method("take_player_damage"):
		game_manager.take_player_damage(damage)

	is_attacking = false

func take_damage(amount: int) -> void:
	var damage_to_health: int = amount

	# If shield is active, shield takes damage first
	if is_shield_active and shield_health > 0:
		var shield_damage: int = int(amount * shield_damage_reduction)
		var remaining_damage: int = amount - shield_damage

		shield_health -= shield_damage
		damage_to_health = remaining_damage

		# Shield broken
		if shield_health <= 0:
			shield_health = 0
			is_shield_active = false
			shield_regen_timer = 0.0
			# Visual feedback - shield broken
			if sprite:
				sprite.modulate = Color(0.7, 0.7, 0.7, 1.0)

	current_health -= damage_to_health

	if current_health <= 0:
		die()

func regenerate_shield() -> void:
	shield_health = max_shield_health
	is_shield_active = true
	shield_regen_timer = 0.0
	# Visual feedback - shield restored
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		var game_manager = get_node_or_null("/root/GameManager")
		if game_manager and game_manager.has_method("take_player_damage"):
			game_manager.take_player_damage(damage)