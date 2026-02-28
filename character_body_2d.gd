extends CharacterBody2D

# --- RPG Stats (Tied directly to your PRD) ---
# In Godot, @export exposes the variable to the visual Inspector, 
# making it easy to tweak without touching code.
@export var base_speed: float = 300.0
@export var base_attack: int = 15

# --- Health ---
@export var max_health: int = 100
var current_health: int = max_health

# --- State Variables ---
var is_aiming: bool = false
var current_aim_direction: Vector2 = Vector2.ZERO
var virtual_move_direction: Vector2 = Vector2.ZERO
var virtual_aim_direction: Vector2 = Vector2.ZERO

# --- Node References ---
# The '$' syntax is Godot's way of querying child nodes (similar to document.getElementById)
# We assume you have a Node2D called 'BowPivot' holding your Bow sprite.
@onready var bow_pivot: Node2D = $BowPivot
@onready var body_sprite: Sprite2D = $BodySprite
@onready var animation_player: AnimationPlayer = $AnimationPlayer

func _ready() -> void:
	add_to_group("Player")

func _physics_process(_delta: float) -> void:
	handle_movement()
	handle_aiming_and_shooting()

func handle_movement() -> void:
	# 1. Read Left Joystick (Virtual or Physical)
	var move_dir := virtual_move_direction
	if move_dir.length() == 0:
		# Input.get_vector normalizes diagonal movement automatically (so you don't move 
		# faster when pushing up and right simultaneously).
		move_dir = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	
	# 2. Apply Velocity
	velocity = move_dir * base_speed
	
	# 3. Execute Movement
	# move_and_slide applies the velocity and handles wall collisions automatically
	move_and_slide()
	
	# 4. Polish: Flip character sprite based on movement direction
	if move_dir.x != 0:
		body_sprite.flip_h = move_dir.x < 0

func handle_aiming_and_shooting() -> void:
	# 1. Read Right Joystick (Virtual or Physical)
	var aim_dir := virtual_aim_direction
	if aim_dir.length() == 0:
		aim_dir = Input.get_vector("aim_left", "aim_right", "aim_up", "aim_down")
	
	# 2. Check for Active Aiming (> 0.1 accounts for thumbstick deadzones)
	if aim_dir.length() > 0.1:
		is_aiming = true
		current_aim_direction = aim_dir.normalized()
		
		# Rotate the bow to point in the joystick's direction.
		# .angle() returns radians, which Godot uses natively for rotation.
		bow_pivot.rotation = current_aim_direction.angle()
		
		# Trigger "draw" animation
		if not animation_player.is_playing():
			animation_player.play("draw")
		
	# 3. Detect "Release" to Fire
	elif is_aiming:
		# If aim_dir length is 0 but we WERE aiming, the player released their thumb.
		animation_player.play("release")
		fire_arrow(current_aim_direction)
		is_aiming = false # Reset state

const ARROW_SCENE = preload("res://scenes/arrow.tscn")

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

func set_virtual_move_direction(direction: Vector2) -> void:
	virtual_move_direction = direction

func set_virtual_aim_direction(direction: Vector2) -> void:
	virtual_aim_direction = direction

# --- Health Management ---
func take_damage(damage: int) -> void:
	GameManager.take_player_damage(damage)
