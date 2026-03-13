extends "res://scenes/enemies/base_enemy.gd"

## Thunder Lord boss with electric-based attacks and phases.
##
## Phase 1: Electric projectile attacks and basic melee
## Phase 2 (below 50% health): Chain lightning and thunder clap
## Phase 3 (below 25% health): Storm mode with rapid lightning

# --- Boss Stats ---
@export var boss_name: String = "Thunder Lord"

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 700.0
var attack_range: float = 80.0
var is_attacking: bool = false
var attack_cooldown: float = 1.4
var attack_timer: float = 0.0
var phase: int = 1

# --- Phase 1 Settings ---
var phase1_speed: float = 145.0
var phase1_damage: int = 22

# --- Phase 2 Settings (below 50% health) ---
var phase2_speed: float = 175.0
var phase2_damage: int = 32
var phase2_attack_cooldown: float = 1.0

# --- Phase 3 Settings (below 25% health) ---
var phase3_speed: float = 200.0
var phase3_damage: int = 42
var phase3_attack_cooldown: float = 0.6

# --- Chain Lightning Settings ---
var chain_lightning_cooldown: float = 5.0
var chain_lightning_timer: float = 0.0
var chain_range: float = 250.0

# --- Thunder Clap Settings ---
var thunder_clap_cooldown: float = 8.0
var thunder_clap_timer: float = 0.0

# --- Storm Mode Settings ---
var storm_active: bool = false
var storm_duration: float = 4.0
var storm_cooldown: float = 15.0
var storm_timer: float = 0.0

# --- Electric Projectile Settings ---
var electric_projectile_cooldown: float = 3.0
var electric_projectile_timer: float = 0.0
var electric_projectile_speed: float = 320.0

# --- Projectile Scene ---
var projectile_scene: PackedScene

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 680
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

		if not storm_active:
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
	chain_lightning_timer += delta
	thunder_clap_timer += delta
	electric_projectile_timer += delta
	storm_timer += delta

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
	# Electric projectile attack
	if electric_projectile_timer >= electric_projectile_cooldown and player_ref:
		var distance: float = global_position.distance_to(player_ref.global_position)
		if distance < detection_range:
			fire_electric_projectile()
			electric_projectile_timer = 0.0

	# Chain Lightning - Phase 2+
	if phase >= 2 and chain_lightning_timer >= chain_lightning_cooldown and player_ref:
		var distance: float = global_position.distance_to(player_ref.global_position)
		if distance < detection_range:
			fire_chain_lightning()
			chain_lightning_timer = 0.0

	# Thunder Clap - Phase 2+
	if phase >= 2 and thunder_clap_timer >= thunder_clap_cooldown and player_ref:
		var distance: float = global_position.distance_to(player_ref.global_position)
		if distance < detection_range * 0.7:
			fire_thunder_clap()
			thunder_clap_timer = 0.0

	# Storm Mode - Phase 3
	if phase >= 3 and storm_timer >= storm_cooldown and not storm_active:
		start_storm()

func fire_electric_projectile() -> void:
	if not player_ref or not projectile_scene:
		return

	var projectile: Node = projectile_scene.instantiate()
	var direction: Vector2 = (player_ref.global_position - global_position).normalized()

	projectile.global_position = global_position + direction * 50.0
	projectile.rotation = direction.angle()
	projectile.scale = Vector2(1.4, 1.4)

	get_tree().root.add_child(projectile)

func fire_chain_lightning() -> void:
	if not player_ref:
		return

	# Chain lightning hits the player first, then chains to nearby enemies
	# Deal damage to player
	player_ref.take_damage(damage)

	# Get all enemies in range to chain to
	var all_bodies = get_tree().get_nodes_in_group("Enemies")
	var enemies_in_range: Array[Node] = []

	for body in all_bodies:
		if body == self:
			continue
		var dist = global_position.distance_to(body.global_position)
		if dist < chain_range:
			enemies_in_range.append(body)

	# Chain to up to 2 enemies
	var chains = min(2, enemies_in_range.size())
	for i in range(chains):
		var target = enemies_in_range[i]
		if is_instance_valid(target) and target.has_method("take_damage"):
			target.take_damage(int(damage * 0.5))

func fire_thunder_clap() -> void:
	if not player_ref:
		return

	# Deal damage in a wide area around boss
	var distance = global_position.distance_to(player_ref.global_position)
	if distance < detection_range * 0.6:
		player_ref.take_damage(int(damage * 1.5))

	# Could add knockback effect here

func start_storm() -> void:
	storm_active = true
	storm_timer = 0.0

	# Stop moving during storm
	velocity = Vector2.ZERO

	# Fire rapid lightning bolts
	var bolts = 8
	for i in range(bolts):
		await get_tree().create_timer(0.2).timeout

		if not player_ref:
			continue

		var random_offset = Vector2(randf_range(-100, 100), randf_range(-100, 100))
		var target_pos = player_ref.global_position + random_offset

		# Fire projectile toward random position near player
		var projectile: Node = projectile_scene.instantiate()
		var direction = (target_pos - global_position).normalized()

		projectile.global_position = global_position + direction * 30.0
		projectile.rotation = direction.angle()
		projectile.scale = Vector2(1.0, 1.0)

		get_tree().root.add_child(projectile)

	await get_tree().create_timer(storm_duration - bolts * 0.2).timeout
	storm_active = false

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
	chain_lightning_cooldown = 4.0

func enter_phase_3() -> void:
	phase = 3
	move_speed = phase3_speed
	damage = phase3_damage
	attack_cooldown = phase3_attack_cooldown
	electric_projectile_cooldown = 1.0

func die() -> void:
	boss_defeated.emit(boss_name)
	CampaignManager.unlock_modifier_pool("lightning_damage")
	super.die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		if body.has_method("take_damage"):
			body.take_damage(damage)
