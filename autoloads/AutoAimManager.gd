## Manages auto-aiming system that assists player targeting.
## Registers enemies and provides best target selection based on aim direction.
##
extends Node

# --- Configuration ---
const AIM_RANGE: float = 500.0
const MAX_AIM_ANGLE: float = deg_to_rad(45.0)

# --- State ---
# Using Dictionary for O(1) lookups instead of Array (performance optimization)
var registered_enemies: Dictionary = {}

# --- Enemy Registration ---
func register_enemy(enemy: Node2D) -> void:
	"""Registers an enemy for auto-aim targeting.
	
	Parameters:
		enemy: Enemy node to register
	"""
	if enemy == null or not is_instance_valid(enemy):
		return
	
	# Use weak reference to avoid memory leaks
	registered_enemies[enemy.get_instance_id()] = weakref(enemy)

func unregister_enemy(enemy: Node2D) -> void:
	"""Unregisters an enemy from auto-aim targeting.
	
	Parameters:
		enemy: Enemy node to unregister
	"""
	if enemy == null:
		return
	
	registered_enemies.erase(enemy.get_instance_id())

# --- Target Finding ---
func get_best_target(player_pos: Vector2, aim_direction: Vector2) -> Node2D:
	"""Finds the best target within aiming angle and range.
	
	Parameters:
		player_pos: Player's current position
		aim_direction: Normalized aiming direction vector
	
	Returns:
		Node2D: Best target enemy or null if none found
	"""
	if aim_direction.length() == 0:
		return null
	
	var best_target: Node2D = null
	var best_distance: float = AIM_RANGE
	var aim_angle: float = aim_direction.angle()
	
	# Iterate through dictionary values
	for id in registered_enemies:
		var weak_ref: WeakRef = registered_enemies[id]
		var enemy: Node2D = weak_ref.get_ref()
		
		if enemy == null or not is_instance_valid(enemy):
			# Clean up invalid weak reference
			registered_enemies.erase(id)
			continue
		
		var enemy_pos: Vector2 = enemy.global_position
		var to_enemy: Vector2 = enemy_pos - player_pos
		var distance: float = to_enemy.length()
		
		if distance > AIM_RANGE:
			continue
		
		var angle_to_enemy: float = to_enemy.angle()
		var angle_diff: float = absf(angle_difference(aim_angle, angle_to_enemy))
		
		if angle_diff > MAX_AIM_ANGLE:
			continue
		
		if distance < best_distance:
			best_distance = distance
			best_target = enemy
	
	return best_target

func get_target_position(player_pos: Vector2, aim_direction: Vector2) -> Vector2:
	"""Gets world position of the best target.
	
	Parameters:
		player_pos: Player's current position
		aim_direction: Normalized aiming direction vector
	
	Returns:
		Vector2: Target position or Vector2.ZERO if no target
	"""
	var target: Node2D = get_best_target(player_pos, aim_direction)
	
	if target and is_instance_valid(target):
		return target.global_position
	
	return Vector2.ZERO

func is_target_locked(player_pos: Vector2, aim_direction: Vector2) -> bool:
	"""Checks if there is a valid target in the aiming cone.
	
	Parameters:
		player_pos: Player's current position
		aim_direction: Normalized aiming direction vector
	
	Returns:
		bool: True if a target is locked
	"""
	return get_best_target(player_pos, aim_direction) != null
