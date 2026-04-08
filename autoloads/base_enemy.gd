## Base enemy class singleton for global enemy reference.
## Provides class-level access to BaseEnemy functionality.
##
## Usage:
## - Extend BaseEnemy in enemy scripts: `extends BaseEnemy`
## - This singleton ensures the BaseEnemy class is always loaded
## - Common enemy functionality is implemented in scenes/enemies/base_enemy.gd
extends Node

# Note: BaseEnemy class is defined in scenes/enemies/base_enemy.gd
# This singleton provides global access and ensures the class is loaded

func _ready() -> void:
	"""Ensures BaseEnemy class is loaded on project start."""
	# Preload BaseEnemy to ensure it's available for all enemy types
	preload("res://scenes/enemies/base_enemy.gd")
