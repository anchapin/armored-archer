extends Node2D

@onready var player: CharacterBody2D = get_node_or_null("Player")
@onready var touch_ui: Control = get_node_or_null("TouchUI")
@onready var camera: Camera2D = $Camera2D
@onready var tutorial_controller: Node = get_node_or_null("TutorialController")

# --- Tutorial Integration ---
var tutorial_controller_scene: PackedScene = preload("res://scenes/ui/tutorial_controller.tscn")

func _ready() -> void:
	# Start the game
	GameManager.start_game()

	# Setup tutorial controller
	_setup_tutorial_controller()

	# Check if first-time player and start tutorial
	if TutorialManager and TutorialManager.is_first_time_player():
		# Wait a bit before starting tutorial
		await get_tree().create_timer(1.0).timeout
		TutorialManager.start_tutorial("welcome")

func _setup_tutorial_controller() -> void:
	# Create tutorial controller dynamically
	if not tutorial_controller:
		tutorial_controller = tutorial_controller_scene.new()
		tutorial_controller.name = "TutorialController"
		add_child(tutorial_controller)

func _process(_delta: float) -> void:
	# Make camera follow player
	if player and camera:
		camera.global_position = player.global_position

func _input(event: InputEvent) -> void:
	# Pass input to tutorial controller for completion tracking
	if tutorial_controller and tutorial_controller.has_method("check_tutorial_input"):
		tutorial_controller.check_tutorial_input(event)
