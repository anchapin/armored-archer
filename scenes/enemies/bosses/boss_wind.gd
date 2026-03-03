extends "res://scenes/enemies/base_enemy.gd"

# --- Boss Stats ---
@export var boss_name: String = "Wind Guardian"

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 700.0
var attack_range: float = 100.0
var is_attacking: bool = false
var attack_cooldown: float = 2.0
var attack_timer: float = 0.0
var phase: int = 1

# --- Phase 1 Settings ---
var phase1_speed: float = 140.0
var phase1_damage: int = 25
var dash_cooldown: float = 4.0
var dash_timer: float = 0.0
var is_dashing: bool = false

# --- Phase 2 Settings (below 50% health) ---
var phase2_speed: float = 180.0
var phase2_damage: int = 35
var phase2_attack_cooldown: float = 1.2
var phase2_dash_cooldown: float = 2.5

# --- Wind Attack Settings ---
var wind_projectile_cooldown: float = 5.0
var wind_projectile_timer: float = 0.0
var wind_projectile_speed: float = 300.0

# --- Node References ---
@onready var hurt_area: Area2D = $HurtArea
@onready var sprite: Sprite2D = $Sprite2D

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 600
	damage = phase1_damage
	move_speed = phase1_speed
	current_health = max_health
	add_to_group("Boss")
	super._ready()
	
	if hurt_area:
		hurt_area.body_entered.connect(_on_hurt_area_body_entered)
	
	health_changed.emit(current_health, max_health)

func _physics_process(delta: float) -> void:
	if not player_ref:
		find_player()
	
	if player_ref:
		update_timers(delta)
		var distance_to_player = global_position.distance_to(player_ref.global_position)
		
		if not is_dashing:
			if distance_to_player <= detection_range:
				if distance_to_player > attack_range:
					chase_player()
				else:
					attack_player(delta)
			else:
				velocity = Vector2.ZERO
		
		check_dash_ability()
		check_wind_projectile()
	
	move_and_slide()

func update_timers(delta: float) -> void:
	attack_timer += delta
	dash_timer += delta
	wind_projectile_timer += delta

func find_player() -> void:
	var players = get_tree().get_nodes_in_group("Player")
	if players.size() > 0:
		player_ref = players[0]

func chase_player() -> void:
	var direction = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed
	if sprite:
		sprite.flip_h = direction.x < 0

func attack_player(delta: float) -> void:
	velocity = Vector2.ZERO
	
	if attack_timer >= attack_cooldown:
		attack_timer = 0.0
		perform_attack()

func perform_attack() -> void:
	if player_ref and player_ref.has_method("take_damage"):
		player_ref.take_damage(damage)

func check_dash_ability() -> void:
	if dash_timer >= dash_cooldown and player_ref:
		var distance = global_position.distance_to(player_ref.global_position)
		if distance > attack_range and distance < detection_range:
			perform_dash()

func perform_dash() -> void:
	if is_dashing:
		return
	
	is_dashing = true
	dash_timer = 0.0
	
	var direction = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed * 3.0
	
	await get_tree().create_timer(0.3).timeout
	is_dashing = false
	velocity = Vector2.ZERO

func check_wind_projectile() -> void:
	if wind_projectile_timer >= wind_projectile_cooldown and player_ref:
		var distance = global_position.distance_to(player_ref.global_position)
		if distance < detection_range:
			fire_wind_projectile()
			wind_projectile_timer = 0.0

func fire_wind_projectile() -> void:
	var projectile_scene = preload("res://scenes/arrow.tscn")
	if projectile_scene:
		var projectile = projectile_scene.instantiate()
		
		if player_ref:
			var direction = (player_ref.global_position - global_position).normalized()
			projectile.global_position = global_position + direction * 50.0
			projectile.rotation = direction.angle()
			projectile.scale = Vector2(1.5, 1.5)
			
			get_tree().root.add_child(projectile)

func take_damage(amount: int) -> void:
	current_health -= amount
	health_changed.emit(current_health, max_health)
	
	var health_percentage = float(current_health) / float(max_health)
	
	if health_percentage <= 0.5 and phase == 1:
		enter_phase_2()
	
	if current_health <= 0:
		die()

func enter_phase_2() -> void:
	phase = 2
	move_speed = phase2_speed
	damage = phase2_damage
	attack_cooldown = phase2_attack_cooldown
	dash_cooldown = phase2_dash_cooldown
	wind_projectile_cooldown = 3.0

func die() -> void:
	boss_defeated.emit(boss_name)
	CampaignManager.unlock_modifier_pool("piercing_arrow")
	super.die(150)

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body.is_in_group("Player"):
		body.take_damage(damage)
