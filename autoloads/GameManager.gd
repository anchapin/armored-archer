## Manages overall game state including player health, stage progression, and game flow.
## Controls win/lose conditions and boss spawning.
##
## Signals:
## - health_changed(new_health: int, max_health: int): Emitted when player health changes
## - player_died(): Emitted when player health reaches zero
## - game_won(): Emitted when the stage is completed successfully
## - boss_spawned(boss_node: CharacterBody2D): Emitted when a boss appears
## - stage_completed(stage_id: String): Emitted when a campaign stage is finished
##
extends Node
const CoverageTracker = preload("res://addons/gut/coverage/coverage_tracker.gd")

# --- Signals ---
signal health_changed(new_health: int, max_health: int)
signal player_died()
signal game_won()
signal boss_spawned(boss_node: Node)
signal stage_completed(stage_id: String)
signal game_paused()
signal game_resumed()

# --- References ---
@onready var analytics: Node = $"/root/AnalyticsManager" if has_node("/root/AnalyticsManager") else null

# --- Boss Scenes ---
const BOSS_BASIC_SCENE = preload("res://scenes/enemies/bosses/boss_basic.tscn")
const BOSS_WIND_SCENE = preload("res://scenes/enemies/bosses/boss_wind.tscn")
const BOSS_FIRE_SCENE = preload("res://scenes/enemies/bosses/boss_fire.tscn")
const BOSS_ICE_SCENE = preload("res://scenes/enemies/bosses/boss_ice.tscn")
const BOSS_ELECTRIC_SCENE = preload("res://scenes/enemies/bosses/boss_electric.tscn")

# --- Game State ---
var player_current_health: int = 100
var player_max_health: int = 100
var current_stage: int = 1
var is_game_active: bool = false
var is_paused: bool = false
var game_start_time: int = 0  # For tracking game duration

# --- Campaign Stage ---
var current_stage_id: String = ""
var current_waves: int = 3
var boss_id: String = ""

# --- Biome Background ---
var biome_background: Node = null
var biome_terrain: Node = null

# --- Enemy Scaling ---
const EnemyScaler = preload("res://scripts/combat/enemy_scaler.gd")

# --- Health Management ---
func take_player_damage(damage: int) -> void:
	"""Applies damage to the player.

	Parameters:
		damage: Amount of damage to apply
	"""
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 43)

	if not is_game_active:
		CoverageTracker.track_execution("res://autoloads/GameManager.gd", 49)
		return

	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 52)
	var previous_health := player_current_health
	player_current_health = max(0, player_current_health - damage)
	health_changed.emit(player_current_health, player_max_health)

	# Trigger VFX on damage
	_trigger_damage_vfx(damage)

	# Track health change in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("player_damage_taken", {
			"damage": damage,
			"previous_health": previous_health,
			"current_health": player_current_health,
			"max_health": player_max_health,
			"stage": current_stage
		})

	if player_current_health <= 0:
		CoverageTracker.track_execution("res://autoloads/GameManager.gd", 66)
		player_died.emit()

func heal_player(amount: int) -> void:
	"""Heals the player by the specified amount.

	Parameters:
		amount: Amount of health to restore
	"""
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 69)

	if not is_game_active:
		CoverageTracker.track_execution("res://autoloads/GameManager.gd", 75)
		return

	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 78)
	var previous_health := player_current_health
	player_current_health = min(player_max_health, player_current_health + amount)
	health_changed.emit(player_current_health, player_max_health)

	# Heal VFX - hide damage overlay if healed above threshold
	if player_current_health > int(player_max_health * 0.3):
		if has_node("/root/VFXManager"):
			get_node("/root/VFXManager").hide_damage_overlay()

	# Track health change in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("player_healed", {
			"heal_amount": amount,
			"previous_health": previous_health,
			"current_health": player_current_health,
			"max_health": player_max_health
		})

# --- Game Flow ---
# === Damage VFX ===

var _previous_health_for_vfx: int = 100


func _trigger_damage_vfx(damage: int) -> void:
	"""Trigger visual effects when player takes damage."""
	if not has_node("/root/VFXManager"):
		return
	
	var vfx = get_node("/root/VFXManager")
	
	# Screen shake based on damage amount
	if damage >= 20:
		vfx.trigger_heavy_shake()
	elif damage >= 10:
		vfx.trigger_medium_shake()
	else:
		vfx.trigger_light_shake()
	
	# Show damage overlay if health is low
	var health_percent := float(player_current_health) / float(player_max_health)
	if health_percent < 0.3:
		# Intensity increases as health decreases
		var intensity := 1.0 - (health_percent / 0.3)
		vfx.show_damage_overlay(intensity)
	elif _previous_health_for_vfx > int(player_max_health * 0.3) and player_current_health > int(player_max_health * 0.3):
		# Healed above threshold - hide overlay
		vfx.hide_damage_overlay()
	
	_previous_health_for_vfx = player_current_health


func start_game() -> void:
	"""Starts a new game session, resetting health and state."""
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 94)

	player_current_health = player_max_health
	is_game_active = true
	is_paused = false
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 94)
	game_start_time = Time.get_unix_time_from_system()
	health_changed.emit(player_current_health, player_max_health)
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 97)
	
	# Set biome background based on current stage
	_update_biome_background()

	# Track game start in analytics
	if analytics and analytics.has_method("log_pve_stage_started"):
		analytics.log_pve_stage_started(
			current_stage_id if current_stage_id != "" else "campaign_" + str(current_stage),
			"Stage " + str(current_stage),
			"normal",
			1
		)
	elif analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("game_started", {
			"stage": current_stage,
			"stage_id": current_stage_id,
			"timestamp": game_start_time
		})

# --- Pause/Resume Management ---

func pause_game() -> void:
	"""Pause the game."""
	if not is_game_active or game_paused:
		return

	is_paused = true
	get_tree().paused = true
	game_paused.emit()

	# Track pause in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("game_paused", {
			"stage": current_stage,
			"stage_id": current_stage_id
		})

func resume_game() -> void:
	"""Resume the game."""
	if not is_paused:
		return

	is_paused = false
	get_tree().paused = false
	game_resumed.emit()

	# Track resume in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("game_resumed", {
			"stage": current_stage,
			"stage_id": current_stage_id
		})

func toggle_pause() -> void:
	"""Toggle pause state."""
	if is_paused:
		resume_game()
	else:
		pause_game()

func quit_to_main_menu() -> void:
	"""Quit to main menu."""
	# Resume game state before changing scenes
	if is_paused:
		get_tree().paused = false
		is_paused = false

	is_game_active = false

	# Track quit in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("quit_to_main_menu", {
			"stage": current_stage,
			"stage_id": current_stage_id
		})

	# Change to main menu
	var _err = get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

func get_is_paused() -> bool:
	"""Check if game is paused."""
	return is_paused

func end_game(won: bool) -> void:
	"""Ends the current game session.

	Parameters:
		won: True if the player won, false if they died
	"""
	is_game_active = false

	var game_duration: float = 0.0
	if game_start_time > 0:
		game_duration = Time.get_unix_time_from_system() - game_start_time

	if won:
		CoverageTracker.track_execution("res://autoloads/GameManager.gd", 126)
		game_won.emit()

		# Track stage completion in analytics
		if analytics and analytics.has_method("log_pve_stage_completed"):
			analytics.log_pve_stage_completed(
				current_stage_id if current_stage_id != "" else "campaign_" + str(current_stage),
				"Stage " + str(current_stage),
				game_duration,
				3,  # stars_earned - default to 3 (full completion)
				"normal",
				1
			)
		elif analytics and analytics.has_method("log_custom_event"):
			analytics.log_custom_event("game_won", {
				"stage": current_stage,
				"stage_id": current_stage_id,
				"duration_seconds": game_duration
			})

		if current_stage_id != "" and CampaignManager.has_method("complete_stage"):
			CampaignManager.complete_stage(current_stage_id)
			CoverageTracker.track_execution("res://autoloads/GameManager.gd", 148)
			stage_completed.emit(current_stage_id)

			# Return to campaign map after completing a stage
			var _err = get_tree().change_scene_to_file("res://scenes/ui/campaign_map.tscn")
	else:
		player_died.emit()

		# Track game over in analytics
		if analytics and analytics.has_method("log_pve_stage_failed"):
			analytics.log_pve_stage_failed(
				current_stage_id if current_stage_id != "" else "campaign_" + str(current_stage),
				"Stage " + str(current_stage),
				game_duration,
				"player_died",
				"normal"
			)
		elif analytics and analytics.has_method("log_custom_event"):
			analytics.log_custom_event("game_lost", {
				"stage": current_stage,
				"stage_id": current_stage_id,
				"duration_seconds": game_duration,
				"reason": "player_died"
			})

# --- Stage Management ---
func complete_stage() -> void:
	"""Marks current stage as completed and ends the game with victory."""
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 175)

	if not is_game_active:
		CoverageTracker.track_execution("res://autoloads/GameManager.gd", 175)
		return

	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 178)
	current_stage += 1
	end_game(true)

func reset_stage() -> void:
	"""Resets to stage 1 for a new attempt."""
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 181)

	current_stage = 1
	player_current_health = player_max_health
	is_game_active = true
	health_changed.emit(player_current_health, player_max_health)

# --- Boss Management ---
func spawn_boss(boss_name: String) -> void:
	"""Instantiates and spawns a boss enemy.

	Parameters:
		boss_name: Identifier of the boss to spawn ("boss_basic" or "boss_wind")
	"""
	CoverageTracker.track_execution("res://autoloads/GameManager.gd", 189)

	var boss_scene: PackedScene = null

	match boss_name:
		"boss_basic":
			boss_scene = BOSS_BASIC_SCENE
		"boss_wind":
			boss_scene = BOSS_WIND_SCENE
		"boss_fire":
			boss_scene = BOSS_FIRE_SCENE
		"boss_ice":
			boss_scene = BOSS_ICE_SCENE
		"boss_electric":
			boss_scene = BOSS_ELECTRIC_SCENE
		"boss_iron":
			# boss_iron - Use boss_basic as placeholder
			boss_scene = BOSS_BASIC_SCENE
		"boss_king":
			# boss_king - Use boss_wind as placeholder
			boss_scene = BOSS_WIND_SCENE
		"boss_nightmare":
			# boss_nightmare - Use boss_basic as placeholder
			boss_scene = BOSS_BASIC_SCENE
		"boss_shadow":
			# boss_shadow - Use boss_wind as placeholder
			boss_scene = BOSS_WIND_SCENE

	if boss_scene:
		var boss_instance = boss_scene.instantiate() as CharacterBody2D
		get_tree().root.add_child(boss_instance)
		boss_instance.global_position = Vector2(0, -200)
		
		# Apply player-level scaling to boss
		EnemyScaler.apply_scaling_to_boss(boss_instance)
		
		boss_spawned.emit(boss_instance)
		CoverageTracker.track_execution("res://autoloads/GameManager.gd", 225)

		# Track boss spawn in analytics
		if analytics and analytics.has_method("log_custom_event"):
			analytics.log_custom_event("boss_spawned", {
				"boss_name": boss_name,
				"stage": current_stage,
				"stage_id": current_stage_id
			})

func _update_biome_background() -> void:
	# Find or create biome background
	if not biome_background or not is_instance_valid(biome_background):
		biome_background = get_tree().root.find_child("BiomeBackground", true, false)
	
	if not biome_background or not is_instance_valid(biome_background):
		var BiomeBackgroundScene = load("res://scenes/environment/biome_background.tscn")
		if BiomeBackgroundScene:
			biome_background = BiomeBackgroundScene.instantiate()
			get_tree().root.add_child(biome_background)
	
	if biome_background and is_instance_valid(biome_background):
		var biome = BiomeBackground.get_biome_from_encounter(current_stage_id)
		if biome_background.has_method("set_biome"):
			biome_background.set_biome(biome, true)
		print("[GameManager] Biome set to: ", BiomeBackground.Biome.keys()[biome])
	
	# Find or create biome terrain
	if not biome_terrain or not is_instance_valid(biome_terrain):
		biome_terrain = get_tree().root.find_child("BiomeTerrain", true, false)
	
	if not biome_terrain or not is_instance_valid(biome_terrain):
		var BiomeTerrainScene = load("res://scenes/environment/biome_terrain.tscn")
		if BiomeTerrainScene:
			biome_terrain = BiomeTerrainScene.instantiate()
			get_tree().root.add_child(biome_terrain)
	
	if biome_terrain and is_instance_valid(biome_terrain):
		var biome = BiomeTerrain.get_biome_from_encounter(current_stage_id)
		if biome_terrain.has_method("spawn_biome_terrain"):
			biome_terrain.spawn_biome_terrain(biome)
