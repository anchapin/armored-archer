extends Node2D

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
const MELEE_ENEMY_SCENE = preload("res://scenes/enemies/melee_enemy.tscn")

# --- State ---
var current_wave: int = 0
var enemies_to_spawn: int = 0
var spawn_timer: float = 0.0
var wave_timer: float = 0.0
var is_spawning: bool = false
var active_enemies: Array = []

# --- Node References ---
@onready var spawn_timer_node: Timer = $SpawnTimer
@onready var wave_timer_node: Timer = $WaveTimer

func _ready() -> void:
	start_next_wave()
	if spawn_timer_node:
		spawn_timer_node.timeout.connect(_on_spawn_timer_timeout)
	if wave_timer_node:
		wave_timer_node.timeout.connect(_on_wave_timer_timeout)

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
	
	var spawn_position = get_random_spawn_position()
	var enemy_instance = MELEE_ENEMY_SCENE.instantiate()
	
	enemy_instance.died.connect(_on_enemy_died)
	get_tree().root.add_child(enemy_instance)
	enemy_instance.global_position = spawn_position
	
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

func _on_enemy_died(xp_reward: int) -> void:
	var enemy_to_remove = null
	for enemy in active_enemies:
		if not is_instance_valid(enemy):
			enemy_to_remove = enemy
			break
	
	if enemy_to_remove:
		active_enemies.erase(enemy_to_remove)
	
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
	var bosses = get_tree().get_nodes_in_group("Boss")
	return bosses.size() > 0
