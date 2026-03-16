extends "res://scenes/enemies/base_enemy.gd"

## Fire boss (Inferno) - powerful fire-based boss.
##
## Phase 1: Fireball attacks and ground fire
## Phase 2 (below 50% health): Faster attacks, more fireballs, flame wave
## Phase 3 (below 25% health): Enraged - all attacks are stronger

# --- Boss Stats ---
@export var boss_name: String = "Inferno"

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 600.0
var attack_range: float = 150.0
var phase: int = 1

# --- Movement ---
var base_move_speed: float = 100.0
var phase2_speed: float = 130.0
var phase3_speed: float = 160.0

# --- Attack Settings ---
var attack_cooldown: float = 2.0
var attack_timer: float = 0.0

# --- Fireball Settings ---
var fireball_cooldown: float = 4.0
var fireball_timer: float = 0.0
var fireball_speed: float = 250.0
var fireball_damage: int = 20
var phase2_fireball_cooldown: float = 2.5
var phase3_fireball_cooldown: float = 1.5

# --- Ground Fire Settings ---
var ground_fire_cooldown: float = 5.0
var ground_fire_timer: float = 0.0
var ground_fire_duration: float = 4.0

# --- Flame Wave Settings (Phase 2+) ---
var flame_wave_cooldown: float = 6.0
var flame_wave_timer: float = 0.0
var is_using_flame_wave: bool = false

# --- Enraged Settings (Phase 3) ---
var is_enraged: bool = false
var enraged_damage_multiplier: float = 1.5

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 800
	damage = 25
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

		if not is_using_flame_wave:
			if distance_to_player <= detection_range:
				if distance_to_player > attack_range:
					chase_player()
				else:
					handle_attacks()
			else:
				velocity = Vector2.ZERO

	move_and_slide()

func update_timers(_delta: float) -> void:
	attack_timer += _delta
	fireball_timer += _delta
	ground_fire_timer += _delta
	flame_wave_timer += _delta

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

	# Check which attacks to use based on cooldowns and phase
	check_fireball_attack()
	check_ground_fire()
	if phase >= 2:
		check_flame_wave()

func check_fireball_attack() -> void:
	var cooldown = fireball_cooldown
	if phase == 2:
		cooldown = phase2_fireball_cooldown
	elif phase == 3:
		cooldown = phase3_fireball_cooldown

	if fireball_timer >= cooldown and player_ref:
		fire_fireball()
		fireball_timer = 0.0

func fire_fireball() -> void:
	if not player_ref:
		return

	var projectile_scene: PackedScene = preload("res://scenes/arrow.tscn")
	if projectile_scene:
		var fireball: Node = projectile_scene.instantiate()

		var direction: Vector2 = (player_ref.global_position - global_position).normalized()
		fireball.global_position = global_position + direction * 40.0
		fireball.rotation = direction.angle()
		fireball.scale = Vector2(1.8, 1.8)

		if fireball.has_method("set_damage"):
			var dmg = fireball_damage
			if is_enraged:
				dmg = int(dmg * enraged_damage_multiplier)
			fireball.set_damage(dmg)

		get_tree().root.add_child(fireball)

func check_ground_fire() -> void:
	if ground_fire_timer >= ground_fire_cooldown and player_ref:
		spawn_ground_fire()
		ground_fire_timer = 0.0

func spawn_ground_fire() -> void:
	if not player_ref:
		return

	# Spawn ground fire at player's current position
	# In a full implementation, this would create a damaging area
	# For now, we'll use visual feedback and damage
	var fire_position: Vector2 = player_ref.global_position

	# Create visual effect (simple implementation)
	if sprite:
		var flash_color = Color(1.0, 0.3, 0.0, 0.5)
		sprite.modulate = flash_color
		await get_tree().create_timer(0.3).timeout
		sprite.modulate = Color(1, 1, 1, 1)

func check_flame_wave() -> void:
	if phase >= 2 and flame_wave_timer >= flame_wave_cooldown and player_ref:
		perform_flame_wave()

func perform_flame_wave() -> void:
	is_using_flame_wave = true
	flame_wave_timer = 0.0
	velocity = Vector2.ZERO

	# Visual feedback
	if sprite:
		sprite.modulate = Color(1.0, 0.5, 0.0, 1)

	# Hold position during flame wave
	await get_tree().create_timer(0.5).timeout

	# Damage player if close
	if player_ref:
		var distance: float = global_position.distance_to(player_ref.global_position)
		if distance < 200:
			var wave_damage = 30
			if is_enraged:
				wave_damage = int(wave_damage * enraged_damage_multiplier)
			player_ref.take_damage(wave_damage)

	await get_tree().create_timer(0.5).timeout

	is_using_flame_wave = false
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func take_damage(amount: int) -> void:
	var actual_damage = amount
	if is_enraged:
		actual_damage = int(amount * 1.2)  # Takes 20% more damage when enraged

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
	damage = 35
	fireball_damage = 25

	# Visual feedback
	if sprite:
		sprite.modulate = Color(1.0, 0.6, 0.0, 1)
		await get_tree().create_timer(0.5).timeout
		sprite.modulate = Color(1, 1, 1, 1)

func enter_phase_3() -> void:
	phase = 3
	move_speed = phase3_speed
	is_enraged = true

	# More aggressive cooldowns
	flame_wave_cooldown = 4.0
	ground_fire_cooldown = 3.5

	# Visual feedback - enraged state
	if sprite:
		sprite.modulate = Color(1.0, 0.2, 0.0, 1)
		await get_tree().create_timer(0.5).timeout
		sprite.modulate = Color(1, 1, 1, 1)

func die() -> void:
	boss_defeated.emit(boss_name)
	CampaignManager.unlock_modifier_pool("fire_arrow")
	super.die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		var dmg = damage
		if is_enraged:
			dmg = int(dmg * enraged_damage_multiplier)
		if body.has_method("take_damage"):
			body.take_damage(dmg)