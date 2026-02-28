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
	
	# Start a timer to clean up the arrow if it misses everything
	var timer = get_tree().create_timer(lifetime)
	timer.timeout.connect(queue_free)

func _physics_process(delta: float) -> void:
	# Move the arrow linearly in a top-down 2D space
	position += direction * base_speed * delta

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
			# No piercing left, destroy the arrow
			spawn_hit_effect()
			queue_free()
			
	# 3. Check if we hit a wall/environment
	elif body.is_in_group("Environment"):
		# If we hit a wall, destroy the arrow immediately
		spawn_hit_effect()
		queue_free()

func spawn_hit_effect() -> void:
	# TODO: Instantiate a particle effect (like sparks or dust) at global_position
	pass
