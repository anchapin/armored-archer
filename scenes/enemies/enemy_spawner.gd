extends Node2D

## Enemy spawner that manages wave-based enemy spawning and boss encounters.
##
## Features:
## - Wave-based enemy spawning with configurable counts
## - Object pool integration for performance
## - Boss spawning support
## - Automatic wave progression
## - Stage-driven deterministic spawning via `enemy_scene_map` (issue #910)
##

# --- Spawner Settings ---
@export var spawn_area: Rect2 = Rect2(-300, -200, 600, 400)
@export var time_between_waves: float = 4.0
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
const ELEMENTAL_ENEMY_SCENE: PackedScene = preload("res://scenes/enemies/elemental_enemy.tscn")
const TANK_ENEMY_SCENE: PackedScene = preload("res://scenes/enemies/tank_enemy.tscn")
const SWARMER_ENEMY_SCENE: PackedScene = preload("res://scenes/enemies/swarmer_enemy.tscn")
const SPEED_ENEMY_SCENE: PackedScene = preload("res://scenes/enemies/speed_enemy.tscn")

# --- Boss Scenes ---
const BOSS_BASIC_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_basic.tscn")
const BOSS_WIND_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_wind.tscn")
const BOSS_FIRE_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_fire.tscn")
const BOSS_ICE_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_ice.tscn")
const BOSS_EARTH_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_earth.tscn")
const BOSS_ELECTRIC_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_electric.tscn")
const BOSS_KING_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_king.tscn")
const BOSS_IRON_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_iron.tscn")
const BOSS_NIGHTMARE_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_nightmare.tscn")
const BOSS_SHADOW_SCENE: PackedScene = preload("res://scenes/enemies/bosses/boss_shadow.tscn")

# --- Enemy Type → Scene Map (issue #910) ---
## Explicit map keyed by `data/campaigns.json` enemy type strings.
## Each stage's `enemy.type` is resolved through this map for deterministic
## spawning — no random fallback on the Ch1 path.
## Use `last_stage_enemy_stats: Dictionary` to override scene defaults with
## the per-stage `health/attack/defense/speed` values when present.
var enemy_scene_map: Dictionary = {
	"ch1_1": SCOUT_ENEMY_SCENE,        # Stage 1_1: Forest Edge (Goblin Scout)
	"ch1_2": SWARMER_ENEMY_SCENE,      # Stage 1_2: Ambush (Wolf Pack)
	"ch1_3": GUARDIAN_ENEMY_SCENE,     # Stage 1_3: First Blood (Forest Guardian)
	"ch1_4": ELEMENTAL_ENEMY_SCENE,    # Stage 1_4: Wind Passage (Wind Elemental)
	"ch2_1": BRUTE_ENEMY_SCENE,        # Stage 2_1: Outer Walls (Stone Golem)
	"ch2_2": TANK_ENEMY_SCENE,         # Stage 2_2: Courtyard (Armored Knight)
	"ch2_3": SWARMER_ENEMY_SCENE,      # Stage 2_3: Armory (Fire Imps)
	"ch2_4": GUARDIAN_ENEMY_SCENE,     # Stage 2_4: Throne (Frost Warden)
	"ch3_1": BRUTE_ENEMY_SCENE,        # Stage 3_1: Twisted Paths (Shadow Beast)
	"ch3_2": NECROMANCER_ENEMY_SCENE,  # Stage 3_2: The Hollow (Cultist Priest)
	"ch3_3": GUARDIAN_ENEMY_SCENE,     # Stage 3_3: Cursed Grove (Lightning Guardian)
	"ch3_4": BRUTE_ENEMY_SCENE,        # Stage 3_4: Ancient Shrine (Elder King)
	"ch4_1": BRUTE_ENEMY_SCENE,        # Stage 4_1: Cracked Earth (Earth Golem)
	"ch4_2": BRUTE_ENEMY_SCENE,        # Stage 4_2: Iron Fortress (Titan Guardian)
	"ch4_3": BRUTE_ENEMY_SCENE,        # Stage 4_3: Shadow Realm (Shadow Knight)
	"ch4_4": BRUTE_ENEMY_SCENE,        # Stage 4_4: Nightmare's End (Nightmare Walker)
	"ch4_5": BRUTE_ENEMY_SCENE,        # Stage 4_5: Shadow Ascension (Shadow Lord)
}

## Archetype map keyed by `campaigns.json` `enemy.type` string.
## Used for stages configured by enemy.type rather than stage ID.
var archetype_scene_map: Dictionary = {
	"Goblin Scout": SCOUT_ENEMY_SCENE,
	"Wolf Pack": SWARMER_ENEMY_SCENE,
	"Forest Guardian": GUARDIAN_ENEMY_SCENE,
	"Wind Elemental": ELEMENTAL_ENEMY_SCENE,
	"Stone Golem": BRUTE_ENEMY_SCENE,
	"Armored Knight": TANK_ENEMY_SCENE,
	"Fire Imps": SWARMER_ENEMY_SCENE,
	"Frost Warden": GUARDIAN_ENEMY_SCENE,
	"Shadow Beast": BRUTE_ENEMY_SCENE,
	"Cultist Priest": NECROMANCER_ENEMY_SCENE,
	"Lightning Guardian": GUARDIAN_ENEMY_SCENE,
	"Elder King": BRUTE_ENEMY_SCENE,
	"Earth Golem": BRUTE_ENEMY_SCENE,
	"Titan Guardian": BRUTE_ENEMY_SCENE,
	"Shadow Knight": BRUTE_ENEMY_SCENE,
	"Nightmare Walker": BRUTE_ENEMY_SCENE,
	"Shadow Lord": BRUTE_ENEMY_SCENE,
}

## Explicit map from `boss_id` (campaigns.json `boss` field) to scene.
var boss_scene_map: Dictionary = {
	"boss_basic": BOSS_BASIC_SCENE,
	"boss_wind": BOSS_WIND_SCENE,
	"boss_fire": BOSS_FIRE_SCENE,
	"boss_ice": BOSS_ICE_SCENE,
	"boss_earth": BOSS_EARTH_SCENE,
	"boss_electric": BOSS_ELECTRIC_SCENE,
	"boss_king": BOSS_KING_SCENE,
	"boss_iron": BOSS_IRON_SCENE,
	"boss_nightmare": BOSS_NIGHTMARE_SCENE,
	"boss_shadow": BOSS_SHADOW_SCENE,
}

## Stage archetype name → canonical key in `enemy_scene_map`.
## Used to resolve the per-archetype scene for the spawned enemy.
const CH1_STAGE_KEYS: Dictionary = {
	"1_1": "ch1_1",
	"1_2": "ch1_2",
	"1_3": "ch1_3",
	"1_4": "ch1_4",
}

## Stats pulled from the active stage entry in campaigns.json. When set,
## `spawn_enemy_for_stage()` overrides the scene defaults with these values.
## Shape: { "health": int, "attack": int, "defense": int, "speed": int, "type": String }
var last_stage_enemy_stats: Dictionary = {}

# --- Active Stage Context (issue #910) ---
## Current chapter number (1..4), 0 when no stage is active.
var current_chapter: int = 0
## Current stage number within the active chapter (1..5), 0 when unset.
var current_stage: int = 0

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

func _is_e2e_test() -> bool:
	return OS.get_environment("E2E_TEST") == "1"



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

	if OS.get_environment("E2E_TEST") != "1":
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
	if OS.get_environment("E2E_TEST") != "1":
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
		if not _is_e2e_test():
			print("DEBUG: Stopping existing wave timer before starting new wave")
		wave_timer_node.stop()

	if spawn_timer_node:
		spawn_timer_node.wait_time = time_between_enemies
		spawn_timer_node.start()

func spawn_enemy() -> void:
	if not _is_e2e_test():
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
		# Deterministic scene selection via enemy_scene_map (issue #910).
		# Falls back to scout_enemy if no stage context is set — the
		# random-scene fallback that previously corrupted Ch1 is removed.
		var mapped_scene: PackedScene = _resolve_current_stage_scene()
		if not mapped_scene:
			mapped_scene = SCOUT_ENEMY_SCENE
			push_warning("EnemySpawner: no scene resolved for current stage, defaulting to scout_enemy")
		enemy_instance = mapped_scene.instantiate()




	enemy_instance.global_position = spawn_position

	# Apply per-stage stats from campaigns.json (issue #910) before reset,
	# so they override scene defaults on first spawn.
	if enemy_instance:
		_apply_stage_stats(enemy_instance)

	# Reset enemy stats for new spawn with null safety
	if enemy_instance and enemy_instance.has_method("reset_for_spawn"):
		enemy_instance.reset_for_spawn()

	# CRITICAL: Connect enemy death signal to spawner (must be done per spawn)
	# This handles pooled enemies that lose signal connections when returned to pool
	if enemy_instance.has_signal("enemy_died"):
		# Disconnect any old connections first (pooled enemies may have stale connections)
		if enemy_instance.is_connected("enemy_died", _on_enemy_exiting):
			enemy_instance.enemy_died.disconnect(_on_enemy_exiting)
			if not _is_e2e_test():
				print("DEBUG: Disconnected old enemy_died signal for %s" % enemy_instance.name)
		if not _is_e2e_test():
			print("DEBUG: Connecting enemy_died signal for %s (%s)" % [enemy_instance.name, str(enemy_instance.get_instance_id())])
		enemy_instance.enemy_died.connect(_on_enemy_exiting)

	# Enable collision after spawning (disabled when returned to pool)
	if enemy_instance.has_method("enable_collision"):
		enemy_instance.enable_collision()

	# CRITICAL: Only add if not already in list (handles pooled enemy reuse)
	if not enemy_instance in active_enemies:
		active_enemies.append(enemy_instance)
		if not _is_e2e_test():
			print("DEBUG: Added enemy %s (%s) to active_enemies at index %d (now %d total)" %
				[enemy_instance.name, str(enemy_instance.get_instance_id()), active_enemies.size() - 1, active_enemies.size()])
	else:
		if not _is_e2e_test():
			print("DEBUG: Enemy %s (%s) already in active_enemies, skipping" %
				[enemy_instance.name, str(enemy_instance.get_instance_id())])
	enemies_to_spawn -= 1

	# CRITICAL: Set spawning state when done spawning all enemies
	if enemies_to_spawn <= 0:
		is_spawning = false
		wave_complete = true  # Mark wave as complete
		if not _is_e2e_test():
			print("DEBUG: Wave spawning complete, enemies_to_spawn=%d, is_spawning=%s" % [enemies_to_spawn, is_spawning])
		return  # Exit early to avoid restarting timer unnecessarily

	# CRITICAL: Restart spawn timer to spawn next enemy (timer is one-shot)
	if spawn_timer_node:
		if not _is_e2e_test():
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
		if OS.get_environment("E2E_TEST") != "1":
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
			# Issue #914: wave_clear sting fires between waves (not on the final
			# wave — that triggers stage_win via GameManager.end_game(true)).
			var audio := get_node_or_null("/root/AudioManager")
			if audio and audio.has_method("play_event"):
				audio.play_event("wave_clear")
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

		# Wait for boss to spawn, then connect its defeat signal
		await get_tree().process_frame
		await get_tree().process_frame  # Double frame to ensure boss is fully initialized

		var bosses: Array[Node] = get_tree().get_nodes_in_group("Boss")
		if bosses.size() > 0:
			var boss = bosses[0]
			if boss.has_signal("boss_defeated"):
				boss.boss_defeated.connect(_on_boss_defeated)
				print("DEBUG: Connected to boss_defeated signal for %s" % boss.name)

func is_boss_alive() -> bool:
	var bosses: Array[Node] = get_tree().get_nodes_in_group("Boss")
	return bosses.size() > 0

func _on_boss_defeated(_boss_name: String) -> void:
	"""Handle boss defeat - complete the stage with victory."""
	print("DEBUG: Boss %s defeated, ending game with victory" % _boss_name)

	# Mark wave as complete since all waves and boss are done
	wave_complete = true

	# Wait a moment for boss death effects, then trigger victory
	await get_tree().create_timer(1.0).timeout

	var game_mgr = get_node_or_null("/root/GameManager")
	if game_mgr and game_mgr.has_method("end_game"):
		game_mgr.end_game(true)

# --- Stage-driven helpers (issue #910) ---

## Look up the scene mapped to the current stage's archetype.
##
## Resolution order:
##   1. `last_stage_enemy_stats["type"]` via `archetype_scene_map`
##   2. `current_chapter` + `current_stage` via `enemy_scene_map`
##      (e.g. chapter=1 stage=4 → "ch1_4")
##   3. Empty PackedScene (caller falls back to scout_enemy)
func _resolve_current_stage_scene() -> PackedScene:
	var stage_type: String = last_stage_enemy_stats.get("type", "")
	if stage_type != "" and archetype_scene_map.has(stage_type):
		return archetype_scene_map[stage_type]
	var ch_key := "ch%d_%d" % [current_chapter, current_stage]
	if enemy_scene_map.has(ch_key):
		return enemy_scene_map[ch_key]
	return null

## Apply campaigns.json inline stats to the spawned enemy instance.
## Only overrides when the stat is present and > 0.
func _apply_stage_stats(enemy: Node) -> void:
	if last_stage_enemy_stats.is_empty():
		return
	if not enemy:
		return
	var stats: Dictionary = last_stage_enemy_stats
	if stats.has("health") and int(stats["health"]) > 0:
		enemy.set("max_health", int(stats["health"]))
	if stats.has("attack") and int(stats["attack"]) > 0:
		enemy.set("damage", int(stats["attack"]))
	if stats.has("defense"):
		enemy.set("defense", int(stats.get("defense", 0)))
	if stats.has("speed") and int(stats["speed"]) > 0:
		enemy.set("move_speed", float(stats["speed"]))

## Set the active stage so subsequent `spawn_enemy()` calls pick the
## mapped archetype and apply the inline stage stats.
##
## Parameters:
##   chapter: int — chapter number (1..4)
##   stage: int — stage number within the chapter (1..5)
##   stats: Dictionary — `enemy` entry from campaigns.json
##     ({"type": "...", "health": int, "attack": int, "defense": int, "speed": int})
func set_active_stage(chapter: int, stage: int, stats: Dictionary = {}) -> void:
	current_chapter = chapter
	current_stage = stage
	last_stage_enemy_stats = stats.duplicate(true)
	if OS.get_environment("E2E_TEST") != "1":
		print("DEBUG: EnemySpawner.set_active_stage(ch=%d, st=%d, type=%s, hp=%d)" %
			[chapter, stage, stats.get("type", "?"), int(stats.get("health", 0))])

## Resolve a boss scene by id (campaigns.json `boss` field).
func get_boss_scene(boss_id_value: String) -> PackedScene:
	if boss_scene_map.has(boss_id_value):
		return boss_scene_map[boss_id_value]
	push_warning("EnemySpawner: unknown boss_id '%s'" % boss_id_value)
	return null

## Look up the scene mapped to a named archetype from campaigns.json
## `enemy.type` strings. Returns null when the type is not registered.
func get_scene_for_archetype(archetype: String) -> PackedScene:
	if archetype_scene_map.has(archetype):
		return archetype_scene_map[archetype]
	return null

## Direct entry point used by BossFire and other callers that previously
## routed through the deleted EnemyFactory. Falls back to a scout.
func spawn_archetype(archetype: String, position: Vector2,
		difficulty: int = 1) -> Node:
	var scene: PackedScene = get_scene_for_archetype(archetype)
	if not scene:
		push_warning("EnemySpawner.spawn_archetype: unknown archetype '%s'" % archetype)
		return null
	var instance: Node = scene.instantiate()
	instance.global_position = position
	# Apply difficulty scaling (mirrors EnemyFactory.apply_difficulty_modifier).
	if instance.has_method("apply_difficulty_modifier"):
		instance.apply_difficulty_modifier(difficulty)
	elif "damage" in instance and "max_health" in instance:
		var mult: float = 1.0
		match difficulty:
			1:
				mult = 0.8
			2:
				mult = 1.0
			3:
				mult = 1.3
		instance.max_health = int(int(instance.max_health) * mult)
		instance.damage = int(int(instance.damage) * mult)
	if instance.has_signal("enemy_died") and not instance.is_connected("enemy_died", _on_enemy_exiting):
		instance.enemy_died.connect(_on_enemy_exiting)
	if instance.has_method("enable_collision"):
		instance.enable_collision()
	var parent_node: Node = get_parent()
	if parent_node == null:
		parent_node = get_tree().current_scene
	if parent_node:
		parent_node.add_child(instance)
	if active_enemies.find(instance) == -1:
		active_enemies.append(instance)
	return instance

# gdlint-ignore-file
