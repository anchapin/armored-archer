extends CharacterBody2D
class_name CharacterBody2DScript

## Base character body script for the player
## Handles movement, physics, and basic character behavior

# --- Movement Stats ---
@export var move_speed: float = 200.0
@export var acceleration: float = 800.0
@export var friction: float = 1000.0

# --- State ---
var is_moving: bool = false
var is_aiming: bool = false
var aim_direction: Vector2 = Vector2.RIGHT

# --- Signals ---
signal movement_started
signal movement_stopped
signal aim_direction_changed(direction: Vector2)

# --- Node References ---
@onready var body_sprite: Sprite2D = $BodySprite
@onready var bow_pivot: Node2D = $BowPivot
@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var animated_sprite: AnimatedSprite2D = $AnimatedSprite2D

# --- Animation State ---
var current_animation: String = "idle_down"
var facing_direction: String = "down"


func _ready() -> void:
	# Initialize character state
	is_moving = false
	is_aiming = false

	# Scale up 16x16 Kenney sprites to 32x32
	if animated_sprite:
		animated_sprite.scale = Vector2(2, 2)
		# Try to load Kenney sprites if available
		_load_kenney_sprites()

	# Connect to GameManager signals for health/death events
	_connect_game_manager_signals()

	# Start idle animation
	_play_animation("idle")


func _load_kenney_sprites() -> void:
	"""Load Kenney sprites to replace placeholder textures."""
	if not animated_sprite or not animated_sprite.sprite_frames:
		return

	var sprite_frames = animated_sprite.sprite_frames
	var animations = sprite_frames.get_animation_names()

	# Kenney sprite mapping - maps frame index to tile file
	# Kenney players: tile_0000-0015
	var frame_mappings = {
		# Idle animations (using single frame, repeated)
		"idle_down": ["tile_0000.png", "tile_0000.png", "tile_0000.png", "tile_0000.png", "tile_0000.png", "tile_0000.png"],
		"idle_up": ["tile_0001.png", "tile_0001.png", "tile_0001.png", "tile_0001.png", "tile_0001.png", "tile_0001.png"],
		"idle_left": ["tile_0002.png", "tile_0002.png", "tile_0002.png", "tile_0002.png", "tile_0002.png", "tile_0002.png"],
		"idle_right": ["tile_0003.png", "tile_0003.png", "tile_0003.png", "tile_0003.png", "tile_0003.png", "tile_0003.png"],
		# Walk animations (alternating frames)
		"walk_down": ["tile_0004.png", "tile_0005.png", "tile_0004.png", "tile_0005.png", "tile_0004.png", "tile_0005.png"],
		"walk_up": ["tile_0006.png", "tile_0007.png", "tile_0006.png", "tile_0007.png", "tile_0006.png", "tile_0007.png"],
		"walk_left": ["tile_0002.png", "tile_0003.png", "tile_0002.png", "tile_0003.png", "tile_0002.png", "tile_0003.png"],
		"walk_right": ["tile_0002.png", "tile_0003.png", "tile_0002.png", "tile_0003.png", "tile_0002.png", "tile_0003.png"],
		# Attack animations
		"attack_down": ["tile_0008.png", "tile_0009.png", "tile_0010.png", "tile_0011.png", "tile_0008.png", "tile_0009.png", "tile_0010.png"],
		"attack_up": ["tile_0012.png", "tile_0013.png", "tile_0014.png", "tile_0015.png", "tile_0012.png", "tile_0013.png", "tile_0014.png"],
		"attack_left": ["tile_0008.png", "tile_0009.png", "tile_0010.png", "tile_0011.png", "tile_0008.png", "tile_0009.png", "tile_0010.png"],
		"attack_right": ["tile_0008.png", "tile_0009.png", "tile_0010.png", "tile_0011.png", "tile_0008.png", "tile_0009.png", "tile_0010.png"],
		# Hit animations
		"hit_down": ["tile_0008.png", "tile_0009.png", "tile_0010.png"],
		"hit_up": ["tile_0012.png", "tile_0013.png", "tile_0014.png"],
		"hit_left": ["tile_0008.png", "tile_0009.png", "tile_0010.png"],
		"hit_right": ["tile_0008.png", "tile_0009.png", "tile_0010.png"],
		# Death animations
		"death_down": ["tile_0008.png", "tile_0009.png", "tile_0010.png", "tile_0011.png", "tile_0012.png", "tile_0013.png", "tile_0014.png"],
		"death_up": ["tile_0008.png", "tile_0009.png", "tile_0010.png", "tile_0011.png", "tile_0012.png", "tile_0013.png", "tile_0014.png"],
		"death_left": ["tile_0008.png", "tile_0009.png", "tile_0010.png", "tile_0011.png", "tile_0012.png", "tile_0013.png", "tile_0014.png"],
		"death_right": ["tile_0008.png", "tile_0009.png", "tile_0010.png", "tile_0011.png", "tile_0012.png", "tile_0013.png", "tile_0014.png"],
		# Bow draw animations
		"bow_draw_down": ["tile_0008.png", "tile_0009.png", "tile_0010.png", "tile_0011.png", "tile_0008.png", "tile_0009.png", "tile_0010.png"],
		"bow_draw_up": ["tile_0012.png", "tile_0013.png", "tile_0014.png", "tile_0015.png", "tile_0012.png", "tile_0013.png", "tile_0014.png"],
		"bow_draw_left": ["tile_0008.png", "tile_0009.png", "tile_0010.png", "tile_0011.png", "tile_0008.png", "tile_0009.png", "tile_0010.png"],
		"bow_draw_right": ["tile_0008.png", "tile_0009.png", "tile_0010.png", "tile_0011.png", "tile_0008.png", "tile_0009.png", "tile_0010.png"],
	}

	var kenney_path = "res://assets/sprites/kenney/players/"

	for anim_name in animations:
		if frame_mappings.has(anim_name):
			var frames = frame_mappings[anim_name]
			var frame_count = sprite_frames.get_frame_count(anim_name)
			for i in range(min(frame_count, frames.size())):
				var png_file = frames[i]
				var full_path = kenney_path + png_file
				var texture = load(full_path)
				if texture:
					sprite_frames.set_frame(anim_name, i, texture)


func _connect_game_manager_signals() -> void:
	if has_node("/root/GameManager"):
		var game_manager = get_node("/root/GameManager")
		if game_manager.has_signal("health_changed"):
			game_manager.health_changed.connect(_on_health_changed)
		if game_manager.has_signal("player_died"):
			game_manager.player_died.connect(_on_player_died)


func _physics_process(delta: float) -> void:
	# Get input direction
	var input_direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")

	# Apply movement
	if input_direction != Vector2.ZERO:
		velocity = velocity.move_toward(input_direction * move_speed, acceleration * delta)
		is_moving = true
	else:
		velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
		is_moving = false

	# Handle aiming
	if Input.is_action_pressed("aim"):
		is_aiming = true
		_update_aim_direction()
	else:
		is_aiming = false

	# Move the character
	var _moved = move_and_slide()
	
	# Make camera follow player
	var camera = get_node_or_null("Camera2D")
	if camera:
		camera.global_position = global_position
	
	# Update facing direction and animation
	_update_facing_direction()
	update_animation()


func _update_aim_direction() -> void:
	# Get aim direction from right stick or mouse
	var aim_input := Input.get_vector("aim_left", "aim_right", "aim_up", "aim_down")

	if aim_input != Vector2.ZERO:
		aim_direction = aim_input.normalized()
		_rotate_bow_toward_aim()
		emit_signal("aim_direction_changed", aim_direction)


func _rotate_bow_toward_aim() -> void:
	# Rotate bow pivot to face aim direction
	if bow_pivot:
		bow_pivot.rotation = aim_direction.angle()


func get_aim_direction() -> Vector2:
	return aim_direction


func is_player_aiming() -> bool:
	return is_aiming


# --- Animation System ---

func _play_animation(anim_name: String, force_restart: bool = false) -> void:
	if not animated_sprite or not animated_sprite.sprite_frames:
		return
	
	var new_animation = anim_name + "_" + facing_direction
	
	# Check if animation exists
	var available_animations = animated_sprite.sprite_frames.get_animation_names()
	if not available_animations.has(new_animation):
		return
	
	if new_animation != current_animation or force_restart:
		current_animation = new_animation
		animated_sprite.play(new_animation)


func update_animation() -> void:
	# Priority: death > hit > attack > bow_draw > walk > idle
	if not animated_sprite:
		return
	
	# Check for death state first (would come from GameManager)
	# For now, check movement and aim state
	
	if is_aiming:
		_play_animation("bow_draw")
	elif is_moving:
		_play_animation("walk")
	else:
		_play_animation("idle")


func _update_facing_direction() -> void:
	# Determine facing direction based on velocity or aim direction
	var direction: Vector2
	
	if is_aiming and aim_direction != Vector2.ZERO:
		direction = aim_direction
	else:
		direction = velocity
	
	if direction == Vector2.ZERO:
		return
	
	# Map velocity/aim direction to 4 cardinal directions
	if abs(direction.x) > abs(direction.y):
		facing_direction = "right" if direction.x > 0 else "left"
	else:
		facing_direction = "down" if direction.y > 0 else "up"


func _on_health_changed(current_health: float, max_health: float) -> void:
	# Play hit animation when health changes (damage)
	if animated_sprite and current_health < max_health:
		_play_animation("hit", true)


func _on_player_died() -> void:
	# Play death animation when player dies
	if animated_sprite:
		_play_animation("death", true)
		# Disable movement after death
		set_physics_process(false)
