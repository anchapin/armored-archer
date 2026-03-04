## Manages auto-aiming system that assists player targeting.
## Registers enemies and provides best target selection based on aim direction.
##
extends Node

# --- Configuration ---
const AIM_RANGE: float = 500.0
## Pre-computed squared range to avoid expensive sqrt() calls
const AIM_RANGE_SQUARED: float = AIM_RANGE * AIM_RANGE
const MAX_AIM_ANGLE: float = deg_to_rad(45.0)
## Pre-computed squared max aim angle for faster comparisons
const MAX_AIM_ANGLE_SQUARED: float = MAX_AIM_ANGLE * MAX_AIM_ANGLE

# --- State ---
var registered_enemies: Array[Node2D] = []
## Cache for frequently called methods - invalidated when enemies change
var _cache_valid: bool = false

# --- Enemy Registration ---
func register_enemy(enemy: Node2D) -> void:
	"""Registers an enemy for auto-aim targeting.
	
	Parameters:
		enemy: Enemy node to register
	"""
	if enemy in registered_enemies:
		return
	
	registered_enemies.append(enemy)
	_cache_valid = false

func unregister_enemy(enemy: Node2D) -> void:
	"""Unregisters an enemy from auto-aim targeting.
	
	Parameters:
		enemy: Enemy node to unregister
	"""
	if enemy in registered_enemies:
		registered_enemies.erase(enemy)
		_cache_valid = false

# --- Target Finding ---
func get_best_target(player_pos: Vector2, aim_direction: Vector2) -> Node2D:
	"""Finds the best target within aiming angle and range.
	
	Uses squared distances to avoid expensive sqrt() calls.
	Early exits when possible to minimize calculations.
	
	Parameters:
		player_pos: Player's current position
		aim_direction: Normalized aiming direction vector
	
	Returns:
		Node2D: Best target enemy or null if none found
	"""
	# Early exit for zero-length aim direction
	if aim_direction.length_squared() == 0:
		return null
	
	# Early exit if no enemies registered
	if registered_enemies.is_empty():
		return null
	
	var best_target: Node2D = null
	var best_distance_squared: float = AIM_RANGE_SQUARED
	var aim_angle: float = aim_direction.angle()
	
	# Pre-calculate direction components for angle comparison
	var aim_dir_x: float = aim_direction.x
	var aim_dir_y: float = aim_direction.y
	
	for enemy in registered_enemies:
		# Skip invalid instances (optimization for destroyed enemies)
		if not is_instance_valid(enemy):
			continue
		
		var enemy_pos: Vector2 = enemy.global_position
		var to_enemy: Vector2 = enemy_pos - player_pos
		
		# Use squared distance for comparison (avoids sqrt)
		var distance_squared: float = to_enemy.length_squared()
		
		if distance_squared > AIM_RANGE_SQUARED:
			continue
		
		# Fast angle check using dot product (more efficient than angle())
		var to_enemy_normalized: Vector2 = to_enemy.normalized()
		var dot_product: float = aim_direction.dot(to_enemy_normalized)
		
		# Convert dot product to angle squared comparison
		# If dot < cos(MAX_AIM_ANGLE), angle exceeds max
		# cos(45°) ≈ 0.707, so we can skip the slower angle_difference
		if dot_product < 0.707:  # cos(45°)
			continue
		
		# Found valid target closer than previous best
		if distance_squared < best_distance_squared:
			best_distance_squared = distance_squared
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
