extends Area2D

## Arrow projectile that travels in a straight line and damages enemies.

# --- Configuration ---
var speed: float = 800.0
var damage: int = 25
var direction: Vector2 = Vector2.RIGHT
var lifetime: float = 5.0
var _lifetime_timer: float = 0.0
var is_active: bool = false

# --- Node References ---
@onready var _collision_shape: CollisionShape2D = $CollisionShape2D
@onready var _sprite: Sprite2D = $Sprite2D

func _ready() -> void:
	# Connect collision signal
	body_entered.connect(_on_body_entered)

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
	
	# Rotate sprite to face direction
	if direction.length() > 0.1:
		rotation = direction.angle()

func _on_body_entered(body: Node) -> void:
	"""Handle collision with body."""
	if not is_active:
		return
	
	# Check if we hit an enemy
	if body.is_in_group("Enemy") or body.is_in_group("Boss"):
		if body.has_method("take_damage"):
			body.take_damage(damage)
		_return_to_pool()
	elif body.is_in_group("Environment"):
		# Hit wall/obstacle
		_return_to_pool()

func _return_to_pool() -> void:
	"""Return this arrow to the object pool."""
	is_active = false
	ObjectPool.return_arrow(self)
