extends "res://scenes/enemies/base_enemy.gd"

## Fire Guardian boss with fire-based attacks and phases.
##
## Phase 1: Fireball projectiles and basic attacks
## Phase 2 (below 50% health): AOE fire nova and faster attacks
## Phase 3 (below 25% health): Rapid fireballs and fire ring

# --- Boss Stats ---
@export var boss_name: String = "Fire Guardian"

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 650.0
var attack_range: float = 90.0
var is_attacking: bool = false
var attack_cooldown: float = 1.8
var attack_timer: float = 0.0
var phase: int = 1

# --- Phase 1 Settings ---
var phase1_speed: float = 130.0
var phase1_damage: int = 25

# --- Phase 2 Settings (below 50% health) ---
var phase2_speed: float = 160.0
var phase2_damage: int = 35
var phase2_attack_cooldown: float = 1.2

# --- Phase 3 Settings (below 25% health) ---
var phase3_speed: float = 190.0
var phase3_damage: int = 45
var phase3_attack_cooldown: float = 0.8

# --- Fireball Settings ---
var fireball_cooldown: float = 4.0
var fireball_timer: float = 0.0
var fireball_speed: float = 280.0

# --- AOE Fire Nova Settings ---
var fire_nova_cooldown: float = 7.0
var fire_nova_timer: float = 0.0

# --- Fire Ring Settings ---
var fire_ring_cooldown: float = 10.0
var fire_ring_timer: float = 0.0

# --- Projectile Scene ---
var projectile_scene: PackedScene

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 700
	damage = phase1_damage
	move_speed = phase1_speed
	current_health = max_health
	add_to_group("Boss")
	super._ready()
	
	projectile_scene = preload("res://scenes/arrow.tscn")
	health_changed.emit(current_health, max_health)

func _physics_process(delta: float) -> void:
	update_timers(delta)
	
	if not player_ref:
		find_player()

	if player_ref:
		var distance_to_player: float = global_position.distance_to(player_ref.global_position)

		if distance_to_player <= detection_range:
			if distance_to_player > attack_range:
				chase_player()
			else:
				attack_player(delta)
		else:
			velocity = Vector2.ZERO

		check_special_attacks()

	move_and_slide()

func update_timers(_delta: float) -> void:
	attack_timer += delta
	fireball_timer += delta
	fire_nova_timer += delta
	fire_ring_timer += delta

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

func attack_player(_delta: float) -> void:
	velocity = Vector2.ZERO

	if attack_timer >= attack_cooldown:
		attack_timer = 0.0
		perform_attack()

func perform_attack() -> void:
	if player_ref and player_ref.has_method("take_damage"):
		player_ref.take_damage(damage)

func check_special_attacks() -> void:
	# Fireball projectile attack
	if fireball_timer >= fireball_cooldown and player_ref:
		var distance: float = global_position.distance_to(player_ref.global_position)
		if distance < detection_range:
			fire_fireball()
			fireball_timer = 0.0

	# AOE Fire Nova - Phase 2+
	if phase >= 2 and fire_nova_timer >= fire_nova_cooldown and player_ref:
		var distance: float = global_position.distance_to(player_ref.global_position)
		if distance < detection_range * 0.8:
			fire_fire_nova()
			fire_nova_timer = 0.0

	# Fire Ring - Phase 3
	if phase >= 3 and fire_ring_timer >= fire_ring_cooldown and player_ref:
		var distance: float = global_position.distance_to(player_ref.global_position)
		if distance < detection_range:
			fire_fire_ring()
			fire_ring_timer = 0.0

func fire_fireball() -> void:
	if not player_ref or not projectile_scene:
		return

	var projectile: Node = projectile_scene.instantiate()
	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	
	projectile.global_position = global_position + direction * 50.0
	projectile.rotation = direction.angle()
	projectile.scale = Vector2(1.3, 1.3)
	# Fire effect - red color could be applied to projectile
	
	get_tree().root.add_child(projectile)

func fire_fire_nova() -> void:
	# Create expanding fire ring AOE
	if not player_ref:
		return
	
	var direction_to_player = (player_ref.global_position - global_position).normalized()
	
	# Fire 5 fireballs in a cone
	for i in range(-2, 3):
		var angle_offset = i * 0.3
		var direction = direction_to_player.rotated(angle_offset)
		
		var projectile: Node = projectile_scene.instantiate()
		projectile.global_position = global_position + direction * 30.0
		projectile.rotation = direction.angle()
		projectile.scale = Vector2(1.0, 1.0)
		
		get_tree().root.add_child(projectile)

func fire_fire_ring() -> void:
	# Fire projectiles in all directions
	for i in range(8):
		var angle = i * (TAU / 8)  # TAU = 2*PI
		var direction = Vector2(cos(angle), sin(angle))
		
		var projectile: Node = projectile_scene.instantiate()
		projectile.global_position = global_position + direction * 40.0
		projectile.rotation = direction.angle()
		projectile.scale = Vector2(0.9, 0.9)
		
		get_tree().root.add_child(projectile)

func take_damage(amount: int) -> void:
	current_health -= amount
	health_changed.emit(current_health, max_health)

	var health_percentage = float(current_health) / float(max_health)

	if health_percentage <= 0.5 and phase == 1:
		enter_phase_2()
	elif health_percentage <= 0.25 and phase == 2:
		enter_phase_3()

	if current_health <= 0:
		die()

func enter_phase_2() -> void:
	phase = 2
	move_speed = phase2_speed
	damage = phase2_damage
	attack_cooldown = phase2_attack_cooldown
	fire_nova_cooldown = 5.0

func enter_phase_3() -> void:
	phase = 3
	move_speed = phase3_speed
	damage = phase3_damage
	attack_cooldown = phase3_attack_cooldown
	fireball_cooldown = 1.5

func die() -> void:
	boss_defeated.emit(boss_name)
	CampaignManager.unlock_modifier_pool("fire_damage")
	super.die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		if body.has_method("take_damage"):
			body.take_damage(damage)
