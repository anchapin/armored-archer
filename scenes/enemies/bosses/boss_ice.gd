extends "res://scenes/enemies/base_enemy.gd"

## Ice boss (Frost) - cold-based boss with slow and freeze mechanics.
##
## Phase 1: Ice projectiles and slow aura
## Phase 2 (below 50% health): Ice spikes ground, freezing attacks
## Phase 3 (below 25% health): Blizzard mode - faster, more freezing

# --- Boss Stats ---
@export var boss_name: String = "Frost"

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 550.0
var attack_range: float = 120.0
var phase: int = 1

# --- Movement ---
var base_move_speed: float = 110.0
var phase2_speed: float = 140.0
var phase3_speed: float = 170.0

# --- Attack Settings ---
var attack_cooldown: float = 1.8
var attack_timer: float = 0.0

# --- Ice Projectile Settings ---
var ice_projectile_cooldown: float = 3.0
var ice_projectile_timer: float = 0.0
var ice_projectile_speed: float = 220.0
var ice_projectile_damage: int = 15
var ice_slow_duration: float = 2.0

# --- Slow Aura Settings ---
var slow_aura_radius: float = 100.0
var slow_amount: float = 0.4  # Reduces player speed by 40%

# --- Ice Spikes Settings (Phase 2+) ---
var ice_spikes_cooldown: float = 5.0
var ice_spikes_timer: float = 0.0
var spike_count: int = 5

# --- Blizzard Settings (Phase 3) ---
var blizzard_damage: int = 8
var blizzard_tick_rate: float = 0.5
var blizzard_timer: float = 0.0
var is_in_blizzard: bool = false

# --- Enraged Settings (Phase 3) ---
var is_enraged: bool = false
var freeze_duration_boost: float = 1.5

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 700
	damage = 20
	move_speed = base_move_speed
	current_health = max_health
	add_to_group("Boss")
	super._ready()

	health_changed.emit(current_health, max_health)

func _physics_process(delta: float) -> void:
	if not player_ref:
		find_player()

	update_timers(delta)

	# Apply slow aura to player if in range
	apply_slow_aura()

	if player_ref:
		var distance_to_player: float = global_position.distance_to(player_ref.global_position)

		if not is_in_blizzard:
			if distance_to_player <= detection_range:
				if distance_to_player > attack_range:
					chase_player()
				else:
					handle_attacks()
			else:
				velocity = Vector2.ZERO

	# Phase 3 blizzard effect
	if phase >= 3:
		handle_blizzard(delta)

	move_and_slide()

func update_timers(_delta: float) -> void:
	attack_timer += _delta
	ice_projectile_timer += _delta
	ice_spikes_timer += _delta
	blizzard_timer += _delta

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

func apply_slow_aura() -> void:
	if player_ref:
		var distance: float = global_position.distance_to(player_ref.global_position)
		if distance <= slow_aura_radius:
			if player_ref.has_method("apply_slow"):
				var slow_amt = slow_amount
				if is_enraged:
					slow_amt = min(0.7, slow_amount * 1.3)
				player_ref.apply_slow(slow_amt, 0.1)  # Apply every 0.1 seconds

func handle_attacks() -> void:
	velocity = Vector2.ZERO

	check_ice_projectile()
	check_ice_spikes()

func check_ice_projectile() -> void:
	if ice_projectile_timer >= ice_projectile_cooldown and player_ref:
		fire_ice_projectile()
		ice_projectile_timer = 0.0

func fire_ice_projectile() -> void:
	if not player_ref:
		return

	var projectile_scene: PackedScene = preload("res://scenes/arrow.tscn")
	if projectile_scene:
		var ice_projectile: Node = projectile_scene.instantiate()

		var direction: Vector2 = (player_ref.global_position - global_position).normalized()
		ice_projectile.global_position = global_position + direction * 35.0
		ice_projectile.rotation = direction.angle()
		ice_projectile.scale = Vector2(1.3, 1.3)
		ice_projectile.modulate = Color(0.6, 0.8, 1.0, 1)

		if ice_projectile.has_method("set_damage"):
			var dmg = ice_projectile_damage
			if is_enraged:
				dmg = int(dmg * 1.3)
			ice_projectile.set_damage(dmg)

		# Apply slow effect on hit
		ice_projectile.tree_exiting.connect(func():
			if player_ref and is_instance_valid(player_ref):
				if player_ref.has_method("apply_slow"):
					var dur = ice_slow_duration
					if is_enraged:
						dur += freeze_duration_boost
					player_ref.apply_slow(0.5, dur)
		)

		get_tree().root.add_child(ice_projectile)

func check_ice_spikes() -> void:
	if phase >= 2 and ice_spikes_timer >= ice_spikes_cooldown and player_ref:
		spawn_ice_spikes()
		ice_spikes_timer = 0.0

func spawn_ice_spikes() -> void:
	if not player_ref:
		return

	# Spawn ice spikes around the player
	var player_pos: Vector2 = player_ref.global_position

	for i in range(spike_count):
		var offset: Vector2 = Vector2(
			randf_range(-80, 80),
			randf_range(-80, 80)
		)
		var spike_pos: Vector2 = player_pos + offset

		# Visual feedback (flash sprite)
		if sprite:
			var flash_color = Color(0.5, 0.7, 1.0, 0.8)
			sprite.modulate = flash_color

		# Check if spike hits player
		if player_ref:
			var distance: float = spike_pos.distance_to(player_ref.global_position)
			if distance < 40:
				var spike_damage = 25
				if is_enraged:
					spike_damage = int(spike_damage * 1.3)
				player_ref.take_damage(spike_damage)

				# Apply freeze
				if player_ref.has_method("apply_slow"):
					var freeze_amt = 0.8
					var dur = 1.5
					if is_enraged:
						dur += freeze_duration_boost
					player_ref.apply_slow(freeze_amt, dur)

	# Reset color
	await get_tree().create_timer(0.2).timeout
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func handle_blizzard(_delta: float) -> void:
	if not is_in_blizzard and blizzard_timer >= 8.0:
		start_blizzard()

	if is_in_blizzard:
		# Continuous damage in blizzard
		if player_ref:
			var distance: float = global_position.distance_to(player_ref.global_position)
			if distance < 150:
				player_ref.take_damage(blizzard_damage)

func start_blizzard() -> void:
	is_in_blizzard = true
	blizzard_timer = 0.0

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.4, 0.6, 1.0, 1)

	# Hold position during blizzard
	await get_tree().create_timer(3.0).timeout

	is_in_blizzard = false
	if sprite:
		sprite.modulate = Color(1, 1, 1, 1)

func take_damage(amount: int) -> void:
	var actual_damage = amount
	if is_enraged:
		actual_damage = int(amount * 1.15)

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
	damage = 28
	ice_projectile_damage = 20

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.5, 0.8, 1.0, 1)
		await get_tree().create_timer(0.5).timeout
		sprite.modulate = Color(1, 1, 1, 1)

func enter_phase_3() -> void:
	phase = 3
	move_speed = phase3_speed
	is_enraged = true
	slow_aura_radius = 130.0

	# Visual feedback
	if sprite:
		sprite.modulate = Color(0.3, 0.5, 0.9, 1)
		await get_tree().create_timer(0.5).timeout
		sprite.modulate = Color(1, 1, 1, 1)

func die() -> void:
	boss_defeated.emit(boss_name)
	CampaignManager.unlock_modifier_pool("ice_arrow")
	super.die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		var dmg = damage
		if is_enraged:
			dmg = int(dmg * 1.3)
		if body.has_method("take_damage"):
			body.take_damage(dmg)
		if body.has_method("apply_slow"):
			body.apply_slow(0.6, 1.0)