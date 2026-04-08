extends Node2D

## Enemy spawner that manages wave-based enemy spawning and boss encounters.
##
## Features:
## - Wave-based enemy spawning with configurable counts
## - Object pool integration for performance
## - Boss spawning support
## - Automatic wave progression
##

# --- Spawner Settings ---
@export var spawn_area: Rect2 = Rect2(-300, -200, 600, 400)
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
const RANGED_ENEMY_SCENE: PackedScene = preload("res://scenes/enemies/ranged_enemy.tscn")
const SCOUT_ENEMY_SCENE: PackedScene = preload("res://scenes/enemies/scout_enemy.tscn")
const BRUTE_ENEMY_SCENE: PackedScene = preload("res://scenes/enemies/brute_enemy.tscn")
const GUARDIAN_ENEMY_SCENE: PackedScene = preload("res://scenes/enemies/guardian_enemy.tscn")
const NECROMANCER_ENEMY_SCENE: PackedScene = preload("res://scenes/enemies/necromancer_enemy.tscn")

# --- Boss Scenes ---
const BOSS_BASIC_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_basic.tscn")
const BOSS_WIND_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_wind.tscn")
const BOSS_FIRE_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_fire.tscn")
const BOSS_ICE_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_ice.tscn")
const BOSS_EARTH_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_earth.tscn")

# --- State ---
var current_wave: int = 0
var enemies_to_spawn: int = 0
var spawn_timer: float = 0.0
var wave_timer: float = 0.0
var is_spawning: bool = false
var active_enemies: Array[Node] = []
var total_enemies_for_stage: int = 0
var wave_complete: bool = false  # Track if current wave has finished spawning


# --- Node References ---
var spawn_timer_node: Timer
var wave_timer_node: Timer



# --- Signals ---
signal enemy_count_changed(remaining: int, total: int)

func _ready() -> void:
	# Create timers dynamically for autoload instance
	spawn_timer_node = Timer.new()
	spawn_timer_node.one_shot = true
	add_child(spawn_timer_node)
	spawn_timer_node.timeout.connect(_on_spawn_timer_timeout)

	wave_timer_node = Timer.new()
	wave_timer_node.one_shot = true
	add_child(wave_timer_node)
	wave_timer_node.timeout.connect(_on_wave_timer_timeout)

	print("DEBUG: Spawner ready, starting first wave")
	start_next_wave()

func _exit_tree() -> void:
	## Clean up timer signals to prevent memory leaks
	if spawn_timer_node and spawn_timer_node.is_connected("timeout", _on_spawn_timer_timeout):
		spawn_timer_node.disconnect("timeout", _on_spawn_timer_timeout)
	if wave_timer_node and wave_timer_node.is_connected("timeout", _on_wave_timer_timeout):
		wave_timer_node.disconnect("timeout", _on_wave_timer_timeout)

	## Disconnect enemy_died signals from active enemies
	for enemy in active_enemies:
		if is_instance_valid(enemy) and enemy.is_connected("enemy_died", _on_enemy_exiting):
			enemy.enemy_died.disconnect(_on_enemy_exiting)

func connect_enemy_death(enemy: Node) -> void:
	"""Connect spawner's death handler to enemy - called from BaseEnemy._ready()"""
	if enemy and enemy.has_signal("enemy_died"):
		enemy.enemy_died.connect(_on_enemy_exiting)
		print("DEBUG: Connected to enemy_died for %s" % enemy.name)

func start_next_wave() -> void:
	print("DEBUG: Starting wave %d of %d, spawning %d enemies" % [current_wave, max_waves, enemies_to_spawn])
	if current_wave >= max_waves:
		if boss_id != "":
			spawn_boss()
		return

	current_wave += 1
	enemies_to_spawn = base_enemy_count + (current_wave - 1) * enemy_count_increment
	total_enemies_for_stage += enemies_to_spawn
	is_spawning = true
	wave_complete = false  # Reset wave completion flag
	# CRITICAL: Stop any existing wave timer to prevent premature next wave start
	if wave_timer_node and wave_timer_node.time_left > 0:
		print("DEBUG: Stopping existing wave timer before starting new wave")
		wave_timer_node.stop()

	if spawn_timer_node:
		spawn_timer_node.wait_time = time_between_enemies
		spawn_timer_node.start()

func spawn_enemy() -> void:
	print("DEBUG: spawn_enemy() ENTRY, enemies_to_spawn=%d, is_spawning=%s" % [enemies_to_spawn, is_spawning])

	if enemies_to_spawn <= 0:
		is_spawning = false
		wave_complete = true  # Mark wave as complete (all enemies spawned)
		# Don't start wave timer here - it should only start after enemies die
		return

	var spawn_position: Vector2 = get_random_spawn_position()

	# Use object pool for enemy instantiation (performance optimization)
	var enemy_instance: Node
	var object_pool = get_node_or_null("/root/ObjectPool")
	if object_pool and object_pool.has_method("get_enemy"):
		enemy_instance = object_pool.get_enemy()
	else:
		# Fallback: instantiate from preloaded scenes if object pool unavailable
		var enemy_scenes = [MELEE_ENEMY_SCENE, RANGED_ENEMY_SCENE, SCOUT_ENEMY_SCENE,
				BRUTE_ENEMY_SCENE, GUARDIAN_ENEMY_SCENE, NECROMANCER_ENEMY_SCENE]
		var random_scene = enemy_scenes[randi() % enemy_scenes.size()]
		enemy_instance = random_scene.instantiate()




	enemy_instance.global_position = spawn_position

	# Reset enemy stats for new spawn with null safety
	if enemy_instance and enemy_instance.has_method("reset_for_spawn"):
		enemy_instance.reset_for_spawn()

	# CRITICAL: Connect enemy death signal to spawner (must be done per spawn)
	# This handles pooled enemies that lose signal connections when returned to pool
	if enemy_instance.has_signal("enemy_died"):
		# Disconnect any old connections first (pooled enemies may have stale connections)
		if enemy_instance.is_connected("enemy_died", _on_enemy_exiting):
			enemy_instance.enemy_died.disconnect(_on_enemy_exiting)
			print("DEBUG: Disconnected old enemy_died signal for %s" % enemy_instance.name)
		print("DEBUG: Connecting enemy_died signal for %s (%s)" % [enemy_instance.name, str(enemy_instance.get_instance_id())])
		enemy_instance.enemy_died.connect(_on_enemy_exiting)

	# Enable collision after spawning (disabled when returned to pool)
	if enemy_instance.has_method("enable_collision"):
		enemy_instance.enable_collision()

	# CRITICAL: Only add if not already in list (handles pooled enemy reuse)
	if not enemy_instance in active_enemies:
		active_enemies.append(enemy_instance)
		print("DEBUG: Added enemy %s (%s) to active_enemies at index %d (now %d total)" %
			[enemy_instance.name, str(enemy_instance.get_instance_id()), active_enemies.size() - 1, active_enemies.size()])
	else:
		print("DEBUG: Enemy %s (%s) already in active_enemies, skipping" %
			[enemy_instance.name, str(enemy_instance.get_instance_id())])
	enemies_to_spawn -= 1

	# CRITICAL: Set spawning state when done spawning all enemies
	if enemies_to_spawn <= 0:
		is_spawning = false
		wave_complete = true  # Mark wave as complete
		print("DEBUG: Wave spawning complete, enemies_to_spawn=%d, is_spawning=%s" % [enemies_to_spawn, is_spawning])
		return  # Exit early to avoid restarting timer unnecessarily

	# CRITICAL: Restart spawn timer to spawn next enemy (timer is one-shot)
	if spawn_timer_node:
		print("DEBUG: Restarting spawn timer for next enemy (%d remaining)" % enemies_to_spawn)
		spawn_timer_node.wait_time = time_between_enemies
		spawn_timer_node.start()

	# Emit enemy count updated signal on spawn
	enemy_count_changed.emit(active_enemies.size(), total_enemies_for_stage)

func get_random_spawn_position() -> Vector2:
	var random_x = randf_range(spawn_area.position.x, spawn_area.end.x)
	var random_y = randf_range(spawn_area.position.y, spawn_area.end.y)
	return global_position + Vector2(random_x, random_y)

func _on_spawn_timer_timeout() -> void:
	if is_spawning:
		print("DEBUG: About to call spawn_enemy()")
		spawn_enemy()

func _on_wave_timer_timeout() -> void:
	print("DEBUG: Wave timer timeout, checking if next wave should start")
	# Only start next wave if wave is complete and no enemies are alive
	# This prevents starting next wave while still spawning enemies
	if active_enemies.size() == 0 and not is_spawning and wave_complete:
		print("DEBUG: Starting next wave (wave timer)")
		start_next_wave()
	else:
		print("DEBUG: Cannot start next wave - active: %d, is_spawning=%s, wave_complete=%s" % [active_enemies.size(), is_spawning, wave_complete])

# Track enemy removal via enemy_died signal (fires when enemy dies, works with object pooling)
func _on_enemy_exiting(enemy: Node) -> void:
	print("DEBUG: === _on_enemy_exiting ENTRY === enemy=%s (%s), in_active_list=%s, active_count=%d, is_spawning=%s" %
		[enemy.name, str(enemy.get_instance_id()), str(enemy in active_enemies), active_enemies.size(), is_spawning])
	print("DEBUG: Active enemies in list:")
	for i in range(active_enemies.size()):
		var e = active_enemies[i]
		if is_instance_valid(e):
			print("  [%d] %s (%s)" % [i, e.name, str(e.get_instance_id())])
		else:
			print("  [%d] INVALID" % i)

	# Find and remove the enemy from active list
	var index := active_enemies.find(enemy)
	if index >= 0:
		print("DEBUG: Removing enemy at index %d, remaining: %d" % [index, active_enemies.size() - 1])
		active_enemies.remove_at(index)
		enemy_count_changed.emit(active_enemies.size(), total_enemies_for_stage)
	else:
		print("DEBUG: Enemy %s (%s) not found in active_enemies - this is a bug!" % [enemy.name, str(enemy.get_instance_id())])

	# Check if stage is complete
	if active_enemies.size() == 0 and not is_spawning:
		print("DEBUG: Stage complete check - wave: %d, max: %d, wave_complete: %s, boss_id: %s" % [current_wave, max_waves, wave_complete, boss_id])
		if current_wave >= max_waves:
			if boss_id == "" or not is_boss_alive():
				print("DEBUG: Calling GameManager.end_game(true) - all waves done, boss: %s" % boss_id)
				var game_mgr = get_node_or_null("/root/GameManager")
				if game_mgr and game_mgr.has_method("end_game"):
					game_mgr.end_game(true)
		else:
			print("DEBUG: Wave complete, starting wave timer for next wave")
			# CRITICAL: Only start wave timer if not already running (prevent duplicate timers)
			if wave_timer_node:
				if wave_timer_node.time_left <= 0:
					wave_timer_node.wait_time = time_between_waves
					wave_timer_node.start()
				else:
					print("DEBUG: Wave timer already running (%.1f sec left), not starting new timer" % wave_timer_node.time_left)

func spawn_boss() -> void:
	if boss_id == "":
		return

	var game_mgr = get_node_or_null("/root/GameManager")
	if game_mgr and game_mgr.has_method("spawn_boss"):
		game_mgr.spawn_boss(boss_id)

func is_boss_alive() -> bool:
	var bosses: Array[Node] = get_tree().get_nodes_in_group("Boss")
	return bosses.size() > 0
# gdlint-ignore-file
