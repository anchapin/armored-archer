extends Node2D

@onready var player: CharacterBody2D = get_node_or_null("Player")
@onready var touch_ui: Control = get_node_or_null("TouchUI")

func _ready() -> void:
	if touch_ui and player:
		touch_ui.set_player(player)
	elif touch_ui:
		# Try to find player via get_node_or_null with parent check
		var parent = get_parent()
		if parent and parent.has_node("Player"):
			player = parent.get_node_or_null("Player")
			if player:
				touch_ui.set_player(player)