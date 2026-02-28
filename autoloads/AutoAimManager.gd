extends Node

# --- Configuration ---
const AIM_RANGE: float = 500.0
const MAX_AIM_ANGLE: float = deg_to_rad(45.0)

# --- State ---
var registered_enemies: Array[Node2D] = []

# --- Enemy Registration ---
func register_enemy(enemy: Node2D) -> void:
	if enemy in registered_enemies:
		return
	
	registered_enemies.append(enemy)

func unregister_enemy(enemy: Node2D) -> void:
	if enemy in registered_enemies:
		registered_enemies.erase(enemy)

# --- Target Finding ---
func get_best_target(player_pos: Vector2, aim_direction: Vector2) -> Node2D:
	if aim_direction.length() == 0:
		return null
	
	var best_target: Node2D = null
	var best_distance: float = AIM_RANGE
	var aim_angle: float = aim_direction.angle()
	
	for enemy in registered_enemies:
		if not is_instance_valid(enemy):
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
	var target: Node2D = get_best_target(player_pos, aim_direction)
	
	if target and is_instance_valid(target):
		return target.global_position
	
	return Vector2.ZERO

func is_target_locked(player_pos: Vector2, aim_direction: Vector2) -> bool:
	return get_best_target(player_pos, aim_direction) != null
