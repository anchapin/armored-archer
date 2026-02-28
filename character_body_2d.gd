extends CharacterBody2D

# --- RPG Stats (Tied directly to your PRD) ---
# In Godot, @export exposes the variable to the visual Inspector, 
# making it easy to tweak without touching code.
@export var base_speed: float = 300.0
@export var base_attack: int = 15
@export var auto_aim_enabled: bool = true

# --- Health ---
@export var max_health: int = 100
var current_health: int = max_health

# --- State Variables ---
var is_aiming: bool = false
var current_aim_direction: Vector2 = Vector2.ZERO
var virtual_move_direction: Vector2 = Vector2.ZERO
var virtual_aim_direction: Vector2 = Vector2.ZERO

# --- Node References ---
@onready var bow_pivot: Node2D = $BowPivot
@onready var body_sprite: Sprite2D = $BodySprite
@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var hurt_box: Area2D = $HurtBox

# --- Modular Sprite System ---
@onready var modular_character: ModularCharacterSprite = $ModularCharacter

# --- Auto Aim ---
const AUTO_AIM_INDICATOR_SCENE = preload("res://scenes/player/auto_aim_indicator.tscn")
var auto_aim_indicator: Node2D = null

func _ready() -> void:
	add_to_group("Player")
	
	if modular_character:
		TransmogManager.set_character_sprite(modular_character)
	
	if auto_aim_enabled:
		auto_aim_indicator = AUTO_AIM_INDICATOR_SCENE.instantiate()
		auto_aim_indicator.visible = false
		get_tree().root.add_child(auto_aim_indicator)

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
		
		# 3. Apply Auto-Aim if enabled
		if auto_aim_enabled and auto_aim_indicator:
			var target_pos: Vector2 = AutoAimManager.get_target_position(global_position, current_aim_direction)
			
			if target_pos != Vector2.ZERO:
				current_aim_direction = (target_pos - global_position).normalized()
				auto_aim_indicator.global_position = target_pos
				auto_aim_indicator.visible = true
			else:
				auto_aim_indicator.visible = false
		
		# Rotate the bow to point in the joystick's direction.
		# .angle() returns radians, which Godot uses natively for rotation.
		bow_pivot.rotation = current_aim_direction.angle()
		
		# Trigger "draw" animation
		if not animation_player.is_playing():
			animation_player.play("draw")
		
	# 4. Detect "Release" to Fire
	elif is_aiming:
		# If aim_dir length is 0 but we WERE aiming, the player released their thumb.
		animation_player.play("release")
		fire_arrow(current_aim_direction)
		
		if auto_aim_indicator:
			auto_aim_indicator.visible = false
		
		is_aiming = false # Reset state

const ARROW_SCENE = preload("res://scenes/arrow.tscn")

func fire_arrow(direction: Vector2) -> void:
	var arrow_instance = ARROW_SCENE.instantiate()
	
	var total_stats = TransmogManager.get_total_stats()
	var total_damage = base_attack + total_stats.attack
	
	var active_modifiers = {
		"piercing": 2
	}
	
	get_tree().root.add_child(arrow_instance)
	arrow_instance.setup(bow_pivot.global_position, direction, total_damage, active_modifiers)

func set_virtual_move_direction(direction: Vector2) -> void:
	virtual_move_direction = direction

func set_virtual_aim_direction(direction: Vector2) -> void:
	virtual_aim_direction = direction

# --- Health Management ---
func take_damage(damage: int) -> void:
	GameManager.take_player_damage(damage)
