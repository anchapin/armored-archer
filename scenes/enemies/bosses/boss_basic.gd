extends BaseEnemy

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

	# Issue #913: play intro animation on spawn. If the sprite has actual frames,
	# wait for intro to finish before becoming attackable. With empty placeholder
	# frames the intro completes instantly and we proceed to idle.
	_play_intro_and_idle()

	health_changed.emit(current_health, max_health)

## Play intro animation on spawn, then return to idle loop (issue #913).
func _play_intro_and_idle() -> void:
	if not animated_sprite or not animated_sprite.sprite_frames:
		return
	if animated_sprite.sprite_frames.has_animation(&"intro"):
		animated_sprite.play(&"intro")
		if animated_sprite.sprite_frames.get_frame_count(&"intro") > 0:
			await animated_sprite.animation_finished
	if animated_sprite.sprite_frames.has_animation(&"idle"):
		animated_sprite.play(&"idle")

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

	var _err = move_and_slide()

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
	var game_manager = get_node_or_null("/root/GameManager")
	if game_manager and game_manager.has_method("take_player_damage"):
		game_manager.take_player_damage(damage)

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
	if body and body.is_in_group("Player"):
		var game_manager = get_node_or_null("/root/GameManager")
		if game_manager and game_manager.has_method("take_player_damage"):
			game_manager.take_player_damage(damage)
