extends "res://scenes/enemies/base_enemy.gd"

## Earth boss (Terra) - defensive boss with barriers and rocks.
##
## Phase 1: Rock projectiles and stone skin (damage reduction)
## Phase 2 (below 50% health): Rock armor, seismic slam
## Phase 3 (below 25% health): Earthquake ability, faster attacks

# --- Node References ---
@onready var sprite: Sprite2D = $Sprite2D

# --- Boss Stats ---
@export var boss_name: String = "Terra"

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 500.0
var attack_range: float = 100.0
var phase: int = 1

# --- Movement ---
var base_move_speed: float = 90.0
var phase2_speed: float = 110.0
var phase3_speed: float = 130.0

# --- Attack Settings ---
var attack_cooldown: float = 2.0
var attack_timer: float = 0.0

# --- Rock Projectile Settings ---
var rock_projectile_cooldown: float = 3.5
var rock_projectile_timer: float = 0.0
var rock_projectile_speed: float = 200.0
var rock_projectile_damage: int = 18
var rock_count: int = 3

# --- Stone Skin Settings (Phase 1) ---
var stone_skin_damage_reduction: float = 0.25

# --- Rock Armor Settings (Phase 2+) ---
var rock_armor_damage_reduction: float = 0.40
var rock_armor_health_bonus: int = 150
var is_rock_armor_active: bool = false

# --- Seismic Slam Settings (Phase 2+) ---
var seismic_slam_cooldown: float = 5.0
var seismic_slam_timer: float = 0.0
var seismic_slam_radius: float = 120.0

# --- Earthquake Settings (Phase 3) ---
var earthquake_cooldown: float = 7.0
var earthquake_timer: float = 0.0
var is_earthquake_active: bool = false
var earthquake_damage: int = 25

# --- Enraged Settings (Phase 3) ---
var is_enraged: bool = false

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 750
	damage = 22
	move_speed = base_move_speed
	current_health = max_health
	add_to_group("Boss")
	super._ready()

	health_changed.emit(current_health, max_health)

func _physics_process(delta: float) -> void:
	if not player_ref:
		find_player()

	update_timers(delta)

	if player_ref:
		var distance_to_player: float = global_position.distance_to(player_ref.global_position)

		if not is_earthquake_active:
			if distance_to_player <= detection_range:
				if distance_to_player > attack_range:
					chase_player()
				else:
					handle_attacks()
			else:
				velocity = Vector2.ZERO

	# Phase 3 earthquake effect
	if phase >= 3:
		handle_earthquake()

	var _moved = move_and_slide()

func update_timers(_delta: float) -> void:
	attack_timer += _delta
	rock_projectile_timer += _delta
	seismic_slam_timer += _delta
	earthquake_timer += _delta

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

func handle_attacks() -> void:
	velocity = Vector2.ZERO

	check_rock_projectile()
	if phase >= 2:
		check_seismic_slam()

func check_rock_projectile() -> void:
	if rock_projectile_timer >= rock_projectile_cooldown and player_ref:
		fire_rock_projectiles()
		rock_projectile_timer = 0.0

func fire_rock_projectiles() -> void:
	if not player_ref:
		return

	var projectile_scene: PackedScene = preload("res://scenes/arrow.tscn")

	for i in range(rock_count):
		if projectile_scene:
			var rock: Node = projectile_scene.instantiate()

			# Add slight spread to rocks
			var base_direction: Vector2 = (player_ref.global_position - global_position).normalized()
			var spread_angle: float = randf_range(-0.3, 0.3)
			var direction: Vector2 = base_direction.rotated(spread_angle)

			rock.global_position = global_position + direction * 30.0
			rock.rotation = direction.angle()
			rock.scale = Vector2(1.5, 1.5)
			rock.modulate = Color(0.6, 0.5, 0.4, 1)

			if rock.has_method("set_damage"):
				var dmg = rock_projectile_damage
				if is_enraged:
					dmg = int(dmg * 1.3)
				rock.set_damage(dmg)

			get_tree().root.add_child(rock)

func check_seismic_slam() -> void:
	if seismic_slam_timer >= seismic_slam_cooldown and player_ref:
		perform_seismic_slam()
		seismic_slam_timer = 0.0

func perform_seismic_slam() -> void:
	if not player_ref:
		return

	# Visual feedback - shake
	if sprite:
		sprite.modulate = Color(0.7, 0.6, 0.5, 1)

	# Stop movement during slam
	velocity = Vector2.ZERO

	await get_tree().create_timer(0.4).timeout

	# Check for players in range
	if player_ref:
		var distance: float = global_position.distance_to(player_ref.global_position)
		if distance <= seismic_slam_radius:
			var slam_damage = 30
			if is_enraged:
				slam_damage = int(slam_damage * 1.3)
			player_ref.take_damage(slam_damage)

			# Knockback
			if player_ref.has_method("apply_knockback"):
				var direction: Vector2 = (player_ref.global_position - global_position).normalized()
				player_ref.apply_knockback(direction * 100.0)

	# Reset visual
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func handle_earthquake() -> void:
	if not is_earthquake_active and earthquake_timer >= earthquake_cooldown:
		start_earthquake()

func start_earthquake() -> void:
	is_earthquake_active = true
	earthquake_timer = 0.0

	# Visual feedback - intense shaking
	if sprite:
		sprite.modulate = Color(0.5, 0.4, 0.3, 1)

	# Stop movement
	velocity = Vector2.ZERO

	# Continuous damage during earthquake
	var earthquake_duration: float = 2.5
	var elapsed: float = 0.0

	while elapsed < earthquake_duration:
		await get_tree().create_timer(0.5).timeout
		elapsed += 0.5

		if player_ref:
			var distance: float = global_position.distance_to(player_ref.global_position)
			if distance < 180:
				var dmg = int(earthquake_damage * 0.5)
				if is_enraged:
					dmg = int(dmg * 1.2)
				player_ref.take_damage(dmg)

	is_earthquake_active = false
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func take_damage(amount: int) -> void:
	# Calculate damage reduction based on phase and abilities
	var damage_reduction: float = stone_skin_damage_reduction

	if phase >= 2 and is_rock_armor_active:
		damage_reduction = rock_armor_damage_reduction

	if is_enraged:
		damage_reduction -= 0.1  # Takes more damage when enraged

	var actual_damage: int = int(float(amount) * (1.0 - damage_reduction))
	actual_damage = max(1, actual_damage)  # Always deal at least 1 damage

	current_health -= actual_damage
	health_changed.emit(current_health, max_health)

	var health_percentage = float(current_health) / float(max_health)

	# Phase transitions
	if health_percentage <= 0.25 and phase == 2:
		enter_phase_3()
	elif health_percentage <= 0.5 and phase == 1:
		enter_phase_2()

	if current_health <= 0:
		die()

func enter_phase_2() -> void:
	phase = 2
	move_speed = phase2_speed
	damage = 30
	rock_projectile_damage = 22

	# Activate rock armor
	is_rock_armor_active = true
	max_health += rock_armor_health_bonus
	current_health += rock_armor_health_bonus

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.6, 0.5, 0.4, 1)
		await get_tree().create_timer(0.5).timeout
		sprite.modulate = Color(1, 1, 1, 1)

	health_changed.emit(current_health, max_health)

func enter_phase_3() -> void:
	phase = 3
	move_speed = phase3_speed
	is_enraged = true
	rock_armor_damage_reduction = 0.35

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.4, 0.3, 0.2, 1)
		await get_tree().create_timer(0.5).timeout
		sprite.modulate = Color(1, 1, 1, 1)

func die() -> void:
	boss_defeated.emit(boss_name)
	CampaignManager.unlock_modifier_pool("earth_arrow")
	super.die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		var dmg = damage
		if is_enraged:
			dmg = int(dmg * 1.2)
		if body.has_method("take_damage"):
			body.take_damage(dmg)