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

# --- Signals ---
signal health_changed(new_health: int, max_health: int)
signal player_died()
signal game_won()
signal boss_spawned(boss_node: Node)
signal stage_completed(stage_id: String)

# --- References ---
@onready var analytics: Node = $"/root/AnalyticsManager" if has_node("/root/AnalyticsManager") else null
var combined_stats_manager: Node

# --- Boss Scenes ---
const BOSS_BASIC_SCENE = preload("res://scenes/enemies/bosses/boss_basic.tscn")
const BOSS_WIND_SCENE = preload("res://scenes/enemies/bosses/boss_wind.tscn")
const BOSS_FIRE_SCENE = preload("res://scenes/enemies/bosses/boss_fire.tscn")
const BOSS_ICE_SCENE = preload("res://scenes/enemies/bosses/boss_ice.tscn")
const BOSS_ELECTRIC_SCENE = preload("res://scenes/enemies/bosses/boss_electric.tscn")
const BOSS_IRON_SCENE = preload("res://scenes/enemies/bosses/boss_iron.tscn")
const BOSS_KING_SCENE = preload("res://scenes/enemies/bosses/boss_king.tscn")
const BOSS_NIGHTMARE_SCENE = preload("res://scenes/enemies/bosses/boss_nightmare.tscn")
const BOSS_SHADOW_SCENE = preload("res://scenes/enemies/bosses/boss_shadow.tscn")

# --- Game State ---
var player_current_health: int = 100
var player_max_health: int = 100
var current_stage: int = 1
var is_game_active: bool = false
var game_start_time: int = 0  # For tracking game duration

# --- Campaign Stage ---
var current_stage_id: String = ""
var current_waves: int = 3
var boss_id: String = ""
var current_encounter_data: Dictionary = {}
var current_difficulty: int = 1

# --- Health Management ---
var damage_cooldown: float = 0.0

func _ready() -> void:
	"""Initialize manager references and connect to stat updates."""
	combined_stats_manager = get_node_or_null("/root/CombinedStatsManager")

	# Connect to stats update signal
	if combined_stats_manager and combined_stats_manager.has_signal("combined_stats_updated"):
		combined_stats_manager.combined_stats_updated.connect(_on_combined_stats_updated)

	# Initialize max health from stats
	_update_max_health_from_stats()

func _update_max_health_from_stats() -> void:
	"""Updates player_max_health from CombinedStatsManager."""
	if combined_stats_manager and combined_stats_manager.has_method("get_max_health"):
		var new_max_health: int = combined_stats_manager.get_max_health()
		if new_max_health > 0:
			player_max_health = new_max_health

func _on_combined_stats_updated(stats: Dictionary) -> void:
	"""Called when combined stats change."""
	var health_ratio: float = float(player_current_health) / float(player_max_health) if player_max_health > 0 else 1.0

	_update_max_health_from_stats()

	# Preserve health percentage after stats update
	player_current_health = int(player_max_health * health_ratio)
	health_changed.emit(player_current_health, player_max_health)

func take_player_damage(damage: int) -> void:
	"""Applies damage to the player.

	Parameters:
		damage: Amount of damage to apply
	"""
	if not is_game_active:
		return

	# Small cooldown to prevent damage spam (0.1s between hits)
	if damage_cooldown > 0:
		return
	damage_cooldown = 0.1

	var previous_health := player_current_health
	player_current_health = max(0, player_current_health - damage)
	health_changed.emit(player_current_health, player_max_health)

	# Sync health to CharacterBody2D
	_sync_health_to_player()

	# Update damage overlay through EffectsManager
	var effects_manager: Node = get_node_or_null("/root/EffectsManager")
	if effects_manager and effects_manager.has_method("on_player_damage"):
		effects_manager.on_player_damage(damage, player_current_health, player_max_health)

	# Trigger screen shake based on damage amount
	var vfx_manager: Node = get_node_or_null("/root/VFXManager")
	if vfx_manager and vfx_manager.has_method("trigger_light_shake"):
		if damage >= 30:
			vfx_manager.trigger_heavy_shake()
		elif damage >= 15:
			vfx_manager.trigger_medium_shake()
		elif damage > 0:
			vfx_manager.trigger_light_shake()

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
		player_died.emit()

func heal_player(amount: int) -> void:
	"""Heals the player by the specified amount.

	Parameters:
		amount: Amount of health to restore
	"""
	if not is_game_active:
		return

	var previous_health := player_current_health
	player_current_health = min(player_max_health, player_current_health + amount)
	health_changed.emit(player_current_health, player_max_health)

	# Sync health to CharacterBody2D
	_sync_health_to_player()

	# Update damage overlay through EffectsManager
	var effects_manager: Node = get_node_or_null("/root/EffectsManager")
	if effects_manager and effects_manager.has_method("on_player_heal"):
		effects_manager.on_player_heal(player_current_health, player_max_health)

	# Track health change in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("player_healed", {
			"heal_amount": amount,
			"previous_health": previous_health,
			"current_health": player_current_health,
			"max_health": player_max_health
		})

# --- Game Flow ---
func start_game() -> void:
	"""Starts a new game session, resetting health and state."""
	player_current_health = player_max_health
	is_game_active = true
	game_start_time = Time.get_unix_time_from_system()
	health_changed.emit(player_current_health, player_max_health)

	# Sync health to CharacterBody2D
	_sync_health_to_player()

	# Track game start in analytics with proper context data
	if analytics and analytics.has_method("log_pve_stage_started"):
		# Get stage data for accurate analytics context
		var stage_name: String = "Stage " + str(current_stage)
		var difficulty_str: String = "normal"
		var chapter_num: int = 1

		# Try to get stage data from CampaignManager
		if current_stage_id != "" and CampaignManager and CampaignManager.has_method("get_stage_data"):
			var stage_data: Dictionary = CampaignManager.get_stage_data(current_stage_id)
			if not stage_data.is_empty():
				stage_name = stage_data.get("name", stage_name)
				# Get difficulty string from tier
				var difficulty_tier: int = stage_data.get("difficulty", 1)
				if CampaignManager.has_method("_get_difficulty_string"):
					difficulty_str = CampaignManager._get_difficulty_string(difficulty_tier)
				# Extract chapter number from stage_id (format: "chapter_stage")
				var parts: Array = current_stage_id.split("_")
				if parts.size() >= 2:
					chapter_num = int(parts[0])
				elif current_difficulty > 0:
					# Fallback: use current_difficulty tier for chapter
					chapter_num = current_difficulty

		analytics.log_pve_stage_started(
			current_stage_id if current_stage_id != "" else "campaign_" + str(current_stage),
			stage_name,
			difficulty_str,
			chapter_num
		)
	elif analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("game_started", {
			"stage": current_stage,
			"stage_id": current_stage_id,
			"timestamp": game_start_time
		})

func end_game(won: bool) -> void:
	"""Ends the current game session.

	Parameters:
		won: True if the player won, false if they died
	"""
	if not is_game_active:
		return
	is_game_active = false

	var game_duration: float = 0.0
	if game_start_time > 0:
		game_duration = Time.get_unix_time_from_system() - game_start_time

	# Issue #914: stage_win / stage_lose stings fire on the SFX bus before any
		# scene transition so the player hears the result.
	var audio := get_node_or_null("/root/AudioManager")
	if audio and audio.has_method("play_event"):
		audio.play_event("stage_win" if won else "stage_lose")

	if won:
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
	if not is_game_active:
		return

	current_stage += 1
	end_game(true)

func reset_stage() -> void:
	"""Resets to stage 1 for a new attempt."""
	current_stage = 1
	player_current_health = player_max_health
	is_game_active = true
	health_changed.emit(player_current_health, player_max_health)

	# Sync health to CharacterBody2D
	_sync_health_to_player()

# --- Boss Management ---
func spawn_boss(boss_name: String) -> void:
	"""Instantiates and spawns a boss enemy.

	Parameters:
		boss_name: Identifier of the boss to spawn ("boss_basic" or "boss_wind")
	"""
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
			boss_scene = BOSS_IRON_SCENE
		"boss_king":
			boss_scene = BOSS_KING_SCENE
		"boss_nightmare":
			boss_scene = BOSS_NIGHTMARE_SCENE
		"boss_shadow":
			boss_scene = BOSS_SHADOW_SCENE

	if boss_scene:
		var boss_instance = boss_scene.instantiate() as CharacterBody2D
		get_tree().root.add_child(boss_instance)
		boss_instance.global_position = Vector2(0, -200)
		boss_spawned.emit(boss_instance)

		# Track boss spawn in analytics
		if analytics and analytics.has_method("log_custom_event"):
			analytics.log_custom_event("boss_spawned", {
				"boss_name": boss_name,
				"stage": current_stage,
				"stage_id": current_stage_id
			})

# --- Health Synchronization ---

## Synchronizes GameManager's health to CharacterBody2D.
func _sync_health_to_player() -> void:
	"""Syncs health to the player CharacterBody2D."""
	var player = get_tree().get_first_node_in_group("Player")
	if player and player.has_method("heal"):
		# Calculate health difference and apply as heal/damage
		var health_diff: int = player_current_health - (player.current_health if "current_health" in player else 0)
		if health_diff > 0:
			player.heal(health_diff)
		elif health_diff < 0 and player.has_method("take_damage"):
			# Don't apply damage through sync to avoid loops
			# Just update the character's health directly
			if "current_health" in player:
				player.current_health = max(0, player.current_health + health_diff)
