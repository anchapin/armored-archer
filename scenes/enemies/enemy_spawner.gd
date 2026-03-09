extends Node2D

## Enemy spawner that manages wave-based enemy spawning and boss encounters.
##
## Features:
## - Wave-based enemy spawning with configurable counts
## - Object pool integration for performance
## - Boss spawning support
## - Automatic wave progression

# --- Spawner Settings ---
@export var spawn_area: Rect2 = Rect2(-400, -300, 800, 600)
@export var time_between_waves: float = 5.0
@export var time_between_enemies: float = 0.5

# --- Wave Configuration ---
@export var base_enemy_count: int = 3
@export var enemy_count_increment: int = 1
@export var max_waves: int = 3

# --- Boss Configuration ---
@export var boss_id: String = ""

# --- Enemy Scenes ---
const MELEE_ENEMY_SCENE: PackedScene = preload("res://scenes/enemies/melee_enemy.tscn")

# --- State ---
var current_wave: int = 0
var enemies_to_spawn: int = 0
var spawn_timer: float = 0.0
var wave_timer: float = 0.0
var is_spawning: bool = false
var active_enemies: Array[Node] = []

# --- Node References ---
@onready var spawn_timer_node: Timer = $SpawnTimer
@onready var wave_timer_node: Timer = $WaveTimer

# --- Signal connections for cleanup ---
var _signal_connections: Array[Callable] = []

func _ready() -> void:
	start_next_wave()
	if spawn_timer_node:
		var spawn_connection: Callable = spawn_timer_node.timeout.connect(_on_spawn_timer_timeout)
		_signal_connections.append(spawn_connection)
	if wave_timer_node:
		var wave_connection: Callable = wave_timer_node.timeout.connect(_on_wave_timer_timeout)
		_signal_connections.append(wave_connection)

func _exit_tree() -> void:
	## Clean up all connected signals to prevent memory leaks
	_cleanup_timer_signal(spawn_timer_node, _on_spawn_timer_timeout)
	_cleanup_timer_signal(wave_timer_node, _on_wave_timer_timeout)

	## Disconnect enemy died signals from active enemies
	for enemy in active_enemies:
		if is_instance_valid(enemy) and enemy.has_signal("died"):
			if enemy.is_connected("died", _on_enemy_died):
				enemy.disconnect("died", _on_enemy_died)

## Helper function to safely disconnect timer signals
func _cleanup_timer_signal(timer: Timer, callback: Callable) -> void:
	if timer and timer.is_connected("timeout", callback):
		timer.disconnect("timeout", callback)

func start_next_wave() -> void:
	if current_wave >= max_waves:
		if boss_id != "":
			spawn_boss()
		return

	current_wave += 1
	enemies_to_spawn = base_enemy_count + (current_wave - 1) * enemy_count_increment
	is_spawning = true

	if spawn_timer_node:
		spawn_timer_node.wait_time = time_between_enemies
		spawn_timer_node.start()

func spawn_enemy() -> void:
	if enemies_to_spawn <= 0:
		is_spawning = false
		if wave_timer_node:
			wave_timer_node.wait_time = time_between_waves
			wave_timer_node.start()
		return

	var spawn_position: Vector2 = get_random_spawn_position()

	# Use object pool for enemy instantiation (performance optimization)
	var enemy_instance: Node = ObjectPool.get_enemy()

	# Validate enemy instance before connecting signals
	if enemy_instance and enemy_instance.has_signal("died"):
		var died_connection: Callable = enemy_instance.died.connect(_on_enemy_died)
		_signal_connections.append(died_connection)

	enemy_instance.global_position = spawn_position

	# Reset enemy stats for new spawn with null safety
	if enemy_instance and enemy_instance.has_method("reset_for_spawn"):
		enemy_instance.reset_for_spawn()

	active_enemies.append(enemy_instance)
	enemies_to_spawn -= 1

func get_random_spawn_position() -> Vector2:
	var random_x = randf_range(spawn_area.position.x, spawn_area.end.x)
	var random_y = randf_range(spawn_area.position.y, spawn_area.end.y)
	return global_position + Vector2(random_x, random_y)

func _on_spawn_timer_timeout() -> void:
	if is_spawning:
		spawn_enemy()

func _on_wave_timer_timeout() -> void:
	start_next_wave()

func _on_enemy_died(_xp_reward: int) -> void:
	# Find and remove the dead enemy from active list
	var enemy_to_remove: Node = null
	for enemy in active_enemies:
		if not is_instance_valid(enemy):
			enemy_to_remove = enemy
			break

	if enemy_to_remove:
		active_enemies.erase(enemy_to_remove)

	# Return enemy to object pool instead of waiting for cleanup
	# (The enemy is already queued for cleanup via its died signal)
	# We handle pool return in the enemy's own cleanup

	if active_enemies.size() == 0 and not is_spawning:
		if current_wave >= max_waves:
			if boss_id == "" or not is_boss_alive():
				GameManager.end_game(true)
		else:
			start_next_wave()

func spawn_boss() -> void:
	if boss_id == "":
		return

	GameManager.spawn_boss(boss_id)

func is_boss_alive() -> bool:
	var bosses: Array[Node] = get_tree().get_nodes_in_group("Boss")
	return bosses.size() > 0
