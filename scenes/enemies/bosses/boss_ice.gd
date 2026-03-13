extends "res://scenes/enemies/base_enemy.gd"

## Ice Guardian boss with ice-based attacks and phases.
##
## Phase 1: Ice projectile attacks and basic melee
## Phase 2 (below 50% health): Ice Nova (slows) and faster movement
## Phase 3 (below 25% health): Blizzard AOE and freeze mechanic

# --- Boss Stats ---
@export var boss_name: String = "Ice Guardian"

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 600.0
var attack_range: float = 85.0
var is_attacking: bool = false
var attack_cooldown: float = 1.6
var attack_timer: float = 0.0
var phase: int = 1

# --- Phase 1 Settings ---
var phase1_speed: float = 120.0
var phase1_damage: int = 20

# --- Phase 2 Settings (below 50% health) ---
var phase2_speed: float = 150.0
var phase2_damage: int = 30
var phase2_attack_cooldown: float = 1.1

# --- Phase 3 Settings (below 25% health) ---
var phase3_speed: float = 180.0
var phase3_damage: int = 40
var phase3_attack_cooldown: float = 0.7

# --- Ice Projectile Settings ---
var ice_projectile_cooldown: float = 3.5
var ice_projectile_timer: float = 0.0
var ice_projectile_speed: float = 260.0

# --- Ice Nova Settings ---
var ice_nova_cooldown: float = 8.0
var ice_nova_timer: float = 0.0

# --- Blizzard Settings ---
var blizzard_cooldown: float = 12.0
var blizzard_timer: float = 0.0
var blizzard_active: bool = false

# --- Freeze Mechanic ---
var can_freeze: bool = true
var freeze_duration: float = 1.5
var freeze_cooldown: float = 10.0
var freeze_timer: float = 0.0

# --- Projectile Scene ---
var projectile_scene: PackedScene

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 650
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

		if not blizzard_active:
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
	ice_projectile_timer += delta
	ice_nova_timer += delta
	blizzard_timer += delta
	freeze_timer += delta

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
	# Ice projectile attack
	if ice_projectile_timer >= ice_projectile_cooldown and player_ref:
		var distance: float = global_position.distance_to(player_ref.global_position)
		if distance < detection_range:
			fire_ice_projectile()
			ice_projectile_timer = 0.0

	# Ice Nova - Phase 2+
	if phase >= 2 and ice_nova_timer >= ice_nova_cooldown and player_ref:
		var distance: float = global_position.distance_to(player_ref.global_position)
		if distance < detection_range * 0.9:
			fire_ice_nova()
			ice_nova_timer = 0.0

	# Blizzard - Phase 3
	if phase >= 3 and blizzard_timer >= blizzard_cooldown and player_ref:
		start_blizzard()

	# Freeze attack
	if can_freeze and phase >= 2 and freeze_timer >= freeze_cooldown and player_ref:
		var distance: float = global_position.distance_to(player_ref.global_position)
		if distance < detection_range * 0.6:
			attempt_freeze()
			freeze_timer = 0.0

func fire_ice_projectile() -> void:
	if not player_ref or not projectile_scene:
		return

	var projectile: Node = projectile_scene.instantiate()
	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	
	projectile.global_position = global_position + direction * 50.0
	projectile.rotation = direction.angle()
	projectile.scale = Vector2(1.2, 1.2)
	
	get_tree().root.add_child(projectile)

func fire_ice_nova() -> void:
	# Fire ice projectiles in all directions
	for i in range(6):
		var angle = i * (TAU / 6)
		var direction = Vector2(cos(angle), sin(angle))
		
		var projectile: Node = projectile_scene.instantiate()
		projectile.global_position = global_position + direction * 30.0
		projectile.rotation = direction.angle()
		projectile.scale = Vector2(1.0, 1.0)
		
		get_tree().root.add_child(projectile)

func start_blizzard() -> void:
	blizzard_active = true
	blizzard_timer = 0.0
	
	# Stop moving during blizzard
	velocity = Vector2.ZERO
	
	# Fire multiple projectiles around
	for i in range(10):
		await get_tree().create_timer(0.15).timeout
		
		var angle = i * (TAU / 10)
		var direction = Vector2(cos(angle), sin(angle))
		
		var projectile: Node = projectile_scene.instantiate()
		projectile.global_position = global_position + direction * 40.0
		projectile.rotation = direction.angle()
		projectile.scale = Vector2(0.8, 0.8)
		
		get_tree().root.add_child(projectile)
	
	await get_tree().create_timer(0.5).timeout
	blizzard_active = false

func attempt_freeze() -> void:
	if not player_ref:
		return
	
	can_freeze = false
	
	# Apply freeze effect (stop player movement briefly)
	if player_ref.has_method("apply_freeze"):
		player_ref.apply_freeze(freeze_duration)
	
	# Fire a direct ice projectile
	var projectile: Node = projectile_scene.instantiate()
	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	
	projectile.global_position = global_position + direction * 30.0
	projectile.rotation = direction.angle()
	projectile.scale = Vector2(1.5, 1.5)
	
	get_tree().root.add_child(projectile)
	
	# Reset freeze ability
	await get_tree().create_timer(freeze_cooldown).timeout
	can_freeze = true

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
	ice_nova_cooldown = 6.0

func enter_phase_3() -> void:
	phase = 3
	move_speed = phase3_speed
	damage = phase3_damage
	attack_cooldown = phase3_attack_cooldown
	ice_projectile_cooldown = 1.5

func die() -> void:
	boss_defeated.emit(boss_name)
	CampaignManager.unlock_modifier_pool("ice_damage")
	super.die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		if body.has_method("take_damage"):
			body.take_damage(damage)
