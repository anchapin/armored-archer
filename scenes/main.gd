extends Node2D

@onready var player: CharacterBody2D = get_node_or_null("Player")
@onready var touch_ui: Control = get_node_or_null("TouchUI")
@onready var camera: Camera2D = $Camera2D

func _ready() -> void:
	# Start the game
	GameManager.start_game()

func _process(_delta: float) -> void:
	# Make camera follow player
	if player and camera:
		camera.global_position = player.global_position
