extends Area2D

# --- Base Stats ---
@export var base_speed: float = 600.0
@export var lifetime: float = 3.0 # Destroys arrow after 3 seconds to prevent memory leaks

# --- Dynamic RPG Stats (Passed in by Player) ---
var current_damage: int = 0
var direction: Vector2 = Vector2.ZERO

# --- Modifiers (Unlocked via PvE/Gear) ---
var piercing_count: int = 0 # How many enemies this arrow can pass through
var does_bounce: bool = false # Example for future implementation

func _ready() -> void:
	# Connect the collision signal natively in code
	# This fires whenever a physics body enters the Area2D's collision shape
	body_entered.connect(_on_body_entered)
	
	# Start a timer to return arrow to pool if it misses everything
	var timer = get_tree().create_timer(lifetime)
	timer.timeout.connect(return_arrow_to_pool)

func _physics_process(delta: float) -> void:
	# Move the arrow linearly in a top-down 2D space
	position += direction * base_speed * delta
	
	# Off-screen culling: return arrow to pool if it's far outside viewport
	if _is_off_screen():
		return_arrow_to_pool()

# --- The Initialization Method ---
# You call this from player.gd right after instantiating the arrow
func setup(spawn_pos: Vector2, dir: Vector2, damage: int, modifiers: Dictionary) -> void:
	global_position = spawn_pos
	direction = dir.normalized()
	current_damage = damage
	
	# Point the arrow sprite in the correct direction
	rotation = direction.angle()
	
	# Apply RPG Modifiers passed from the Player's Loadout
	if modifiers.has("piercing"):
		piercing_count = modifiers["piercing"]
	if modifiers.has("bounce"):
		does_bounce = modifiers["bounce"]

# --- Hit Detection Logic ---
func _on_body_entered(body: Node2D) -> void:
	# 1. Check if we hit an enemy (Assuming enemies are in an "Enemies" group 
	# or have a specific method)
	if body.has_method("take_damage"):
		# Apply the calculated RPG damage to the enemy
		body.take_damage(current_damage)
		
		# 2. Handle the Piercing Modifier
		if piercing_count > 0:
			piercing_count -= 1
			# Optional: Reduce damage slightly after each pierce
			current_damage = int(current_damage * 0.8) 
		else:
			# No piercing left, return arrow to pool instead of destroying
			spawn_hit_effect()
			return_arrow_to_pool()
			
	# 3. Check if we hit a wall/environment
	elif body.is_in_group("Environment"):
		# If we hit a wall, return arrow to pool
		spawn_hit_effect()
		return_arrow_to_pool()

const HIT_EFFECT_SCENE = preload("res://assets/particles/hit_effect.tscn")

func spawn_hit_effect() -> void:
	# Use object pool for hit effect (performance optimization)
	var hit_effect = ObjectPool.get_hit_effect()
	hit_effect.global_position = global_position
	
	# Auto-return hit effect to pool after animation completes
	# Use a timer to ensure effect is returned even if animation fails
	var cleanup_timer = get_tree().create_timer(1.0)
	cleanup_timer.timeout.connect(_on_hit_effect_timeout.bind(hit_effect))

func _on_hit_effect_timeout(effect: Node) -> void:
	if is_instance_valid(effect):
		ObjectPool.return_hit_effect(effect)

func return_arrow_to_pool() -> void:
	# Return arrow to object pool for reuse instead of destroying
	ObjectPool.return_arrow(self)

# --- Off-screen Culling ---
# Check if the arrow is far outside the viewport (budget device optimization)
const OFF_SCREEN_MARGIN: float = 200.0  # Extra margin beyond viewport

func _is_off_screen() -> bool:
	var viewport_rect = get_viewport_rect()
	# Add margin for off-screen check
	viewport_rect = viewport_rect.grow(OFF_SCREEN_MARGIN)
	return not viewport_rect.has_point(global_position)
