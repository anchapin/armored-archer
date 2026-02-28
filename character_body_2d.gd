extends CharacterBody2D

# --- RPG Stats (Tied directly to your PRD) ---
# In Godot, @export exposes the variable to the visual Inspector, 
# making it easy to tweak without touching code.
@export var base_speed: float = 300.0
@export var base_attack: int = 15

# --- State Variables ---
var is_aiming: bool = false
var current_aim_direction: Vector2 = Vector2.ZERO

# --- Node References ---
# The '$' syntax is Godot's way of querying child nodes (similar to document.getElementById)
# We assume you have a Node2D called 'BowPivot' holding your Bow sprite.
@onready var bow_pivot: Node2D = $BowPivot
@onready var body_sprite: Sprite2D = $BodySprite

func _physics_process(_delta: float) -> void:
	handle_movement()
	handle_aiming_and_shooting()

func handle_movement() -> void:
	# 1. Read Left Joystick
	# Input.get_vector normalizes diagonal movement automatically (so you don't move 
	# faster when pushing up and right simultaneously).
	var move_dir := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	
	# 2. Apply Velocity
	velocity = move_dir * base_speed
	
	# 3. Execute Movement
	# move_and_slide applies the velocity and handles wall collisions automatically
	move_and_slide()
	
	# 4. Polish: Flip character sprite based on movement direction
	if move_dir.x != 0:
		body_sprite.flip_h = move_dir.x < 0

func handle_aiming_and_shooting() -> void:
	# 1. Read Right Joystick
	var aim_dir := Input.get_vector("aim_left", "aim_right", "aim_up", "aim_down")
	
	# 2. Check for Active Aiming (> 0.1 accounts for thumbstick deadzones)
	if aim_dir.length() > 0.1:
		is_aiming = true
		current_aim_direction = aim_dir.normalized()
		
		# Rotate the bow to point in the joystick's direction.
		# .angle() returns radians, which Godot uses natively for rotation.
		bow_pivot.rotation = current_aim_direction.angle()
		
		# TODO: Trigger "draw_bow" Animation here
		
	# 3. Detect "Release" to Fire
	elif is_aiming:
		# If aim_dir length is 0 but we WERE aiming, the player released their thumb.
		fire_arrow(current_aim_direction)
		is_aiming = false # Reset state

const ARROW_SCENE = preload("res://node_2d.tscn") # Load the arrow blueprint

func fire_arrow(direction: Vector2) -> void:
	var arrow_instance = ARROW_SCENE.instantiate()
	
	# Calculate total damage (Base Attack + Gear Stats)
	var total_damage = base_attack + 10 # 10 represents extra damage from equipped bow
	
	# Fetch active modifiers from the player's current loadout
	var active_modifiers = {
		"piercing": 2 # This arrow will hit 3 enemies total before destroying itself
	}
	
	# Add the arrow to the game world
	get_tree().root.add_child(arrow_instance)
	
	# Initialize the arrow using the setup() function we just wrote
	arrow_instance.setup(bow_pivot.global_position, direction, total_damage, active_modifiers)
	
	# Client-Side Visuals:
	# TODO: Instantiate an Arrow.tscn (scene), set its global_position to 
	# bow_pivot.global_position, apply the rotation, and give it velocity.
	
	# Server-Side Logic (For PvP):
	# TODO: Send RPC to Nakama: {"action": "shoot", "angle": direction.angle(), "stats": current_loadout}
