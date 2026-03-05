extends "res://scenes/enemies/base_enemy.gd"

# --- Boss Stats ---
@export var boss_name: String = "Basic Boss"

# --- AI State ---
var player_ref: CharacterBody2D = null
var detection_range: float = 600.0
var attack_range: float = 80.0
var is_attacking: bool = false
var attack_cooldown: float = 1.5
var attack_timer: float = 0.0
var phase: int = 1

# --- Phase 1 Settings ---
var phase1_speed: float = 120.0
var phase1_damage: int = 20

# --- Phase 2 Settings (below 50% health) ---
var phase2_speed: float = 160.0
var phase2_damage: int = 30
var phase2_attack_cooldown: float = 1.0

# --- Signals ---
signal boss_defeated(boss_name: String)
signal health_changed(current: int, max: int)

func _ready() -> void:
	max_health = 500
	damage = phase1_damage
	move_speed = phase1_speed
	current_health = max_health
	add_to_group("Boss")
	super._ready()
	
	health_changed.emit(current_health, max_health)

func _physics_process(delta: float) -> void:
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
	
	move_and_slide()

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

func attack_player(delta: float) -> void:
	velocity = Vector2.ZERO
	attack_timer += delta
	
	if attack_timer >= attack_cooldown:
		attack_timer = 0.0
		perform_attack()

func perform_attack() -> void:
	if player_ref and player_ref.has_method("take_damage"):
		player_ref.take_damage(damage)

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

func die() -> void:
	boss_defeated.emit(boss_name)
	super.die()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body.is_in_group("Player"):
		body.take_damage(damage)
