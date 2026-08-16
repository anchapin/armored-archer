extends BaseEnemy

## AI state variables
var player_ref: CharacterBody2D = null
var detection_range: float = 200.0
var attack_range: float = 35.0
var is_attacking: bool = false
var attack_cooldown: float = 1.5
var attack_timer: float = 0.0

# --- Animation States ---
enum AnimState { IDLE, WALK, ATTACK, HIT, DEATH }
var current_anim: AnimState = AnimState.IDLE

func _ready() -> void:
	super._ready()
	# Set up animation frame timing
	_setup_animation_frames()

func _setup_animation_frames() -> void:
	# These are populated from goblin sprite sheets
	pass

func _physics_process(delta: float) -> void:
	if not player_ref:
		find_player()

	if player_ref:
		var distance_to_player = global_position.distance_to(player_ref.global_position)

		if distance_to_player <= detection_range:
			if distance_to_player > attack_range:
				_set_animation_state(AnimState.WALK)
				chase_player()
			else:
				_set_animation_state(AnimState.ATTACK)
				attack_player(delta)
		else:
			_set_animation_state(AnimState.IDLE)
			velocity = Vector2.ZERO

	var _moved = move_and_slide()

func _set_animation_state(state: AnimState) -> void:
	if current_anim != state:
		current_anim = state
		# Emit signal for animation change if needed

func find_player() -> void:
	var players = get_tree().get_nodes_in_group("Player")
	if players.size() > 0:
		player_ref = players[0]
	else:
		player_ref = null

func chase_player() -> void:
	if not player_ref:
		return
	var direction: Vector2 = (player_ref.global_position - global_position).normalized()
	velocity = direction * move_speed
	if sprite:
		sprite.flip_h = direction.x < 0
		# Update sprite based on direction
		_update_sprite_direction(direction)

func _update_sprite_direction(direction: Vector2) -> void:
	# Determine which animation frame to use based on movement direction
	# Down: 0, Up: 1, Side: 2, Up-side: 3
	if sprite and sprite.texture:
		# This would switch between idle_down, idle_up, idle_left, idle_right
		# Based on the goblin animations in assets/sprites/enemies/
		pass

func attack_player(delta: float) -> void:
	velocity = Vector2.ZERO
	attack_timer += delta

	if attack_timer >= attack_cooldown:
		attack_timer = 0.0
		perform_attack()

func perform_attack() -> void:
	if player_ref and player_ref.has_method("take_damage"):
		player_ref.take_damage(damage)

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body.is_in_group("Player") and body.has_method("take_damage"):
		body.take_damage(damage)
