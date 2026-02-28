extends Node2D

@onready var player: CharacterBody2D = $Player
@onready var touch_ui: Control = $TouchUI

func _ready() -> void:
	touch_ui.set_player(player)