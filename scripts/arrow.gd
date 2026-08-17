extends Area2D

## Arrow projectile that travels in a straight line and damages enemies.

# --- Configuration ---
var speed: float = 800.0
var damage: int = 50
var direction: Vector2 = Vector2.RIGHT
var lifetime: float = 5.0
var _lifetime_timer: float = 0.0
var is_active: bool = false

# --- Node References ---
@onready var _collision_shape: CollisionShape2D = $CollisionShape2D
@onready var _sprite: Sprite2D = $Sprite2D
func _ready() -> void:
	# Connect collision signal
	var _err = body_entered.connect(_on_body_entered)

func _physics_process(delta: float) -> void:
	if not is_active:
		return

	# Move in direction
	position += direction.normalized() * speed * delta

	# Track lifetime
	_lifetime_timer += delta
	if _lifetime_timer >= lifetime:
		_return_to_pool()

func setup(start_pos: Vector2, dir: Vector2, dmg: int, spd: float = 800.0) -> void:
	"""Initialize arrow with given parameters."""
	position = start_pos
	direction = dir.normalized()
	damage = dmg
	speed = spd
	_lifetime_timer = 0.0
	is_active = true

	# CRITICAL: Arrows (Area2D) use collision_layer=1 (projectiles) to collide with enemies on layer 2
	# The arrow's collision_layer=1 must be in the enemy's collision_mask
	# The arrow's collision_mask=2 must match the enemy's collision_layer
	collision_layer = 1
	# Set collision mask to check enemy layer (layer 2)
	collision_mask = 2

	# CRITICAL: Re-enable collision shape (it's disabled in reset_pooled_state)
	if _collision_shape:
		_collision_shape.disabled = false

	# Rotate sprite to face direction
	if direction.length() > 0.1:
		rotation = direction.angle()

	# Log collision layers for debugging
func _on_body_entered(body: Node) -> void:
	"""Handle collision with body."""
	if not is_active:
		return


	# Check if we hit an enemy
	if body.is_in_group("Enemies") or body.is_in_group("Boss"):
		# Audio feedback — arrow_hit on the SFX bus (issue #911)
		var audio = get_node_or_null("/root/AudioManager")
		if audio:
			if audio.has_method("play_arrow_hit"):
				audio.play_arrow_hit()
			elif audio.has_method("play_sfx"):
				audio.play_sfx("arrow_hit")
		if body.has_method("take_damage"):
			body.take_damage(damage)
		_return_to_pool()
	elif body.is_in_group("Environment"):
		# Hit wall/obstacle
		_return_to_pool()

func _return_to_pool() -> void:
	"""Return this arrow to the object pool."""
	is_active = false
	var object_pool = get_node_or_null("/root/ObjectPool")
	if object_pool and object_pool.has_method("return_arrow"):
		object_pool.return_arrow(self)
	else:
		queue_free()

## Reset state when returning to pool - called by ObjectPool
func reset_pooled_state() -> void:
	is_active = false
	_lifetime_timer = 0.0
	direction = Vector2.RIGHT
	speed = 800.0
	damage = 25
	lifetime = 5.0
	position = Vector2.ZERO
	rotation = 0.0
	# CRITICAL: Reset collision_layer to 1 (projectiles)
	# Arrows (Area2D) should have collision_layer=1 and use collision_mask=2 to detect enemies on layer 2
	collision_layer = 1

	# Disable collision
	if _collision_shape:
		_collision_shape.set_deferred("disabled", true)


func _exit_tree() -> void:
	# Clean up any remaining references
	is_active = false
	# Note: Don't call ObjectPool here as it may already be freed
