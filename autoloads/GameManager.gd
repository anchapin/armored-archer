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

# --- Health Management ---
func take_player_damage(damage: int) -> void:
	"""Applies damage to the player.

	Parameters:
		damage: Amount of damage to apply
	"""
	if not is_game_active:
		return

	var previous_health := player_current_health
	player_current_health = max(0, player_current_health - damage)
	health_changed.emit(player_current_health, player_max_health)

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
			get_tree().change_scene_to_file("res://scenes/ui/campaign_map.tscn")
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

# --- Boss Management ---
func spawn_boss(boss_name: String) -> void:
	"""Instantiates and spawns a boss enemy.

	Parameters:
		boss_name: Identifier of the boss to spawn ("boss_basic" or "boss_wind")
	"""
	var boss_scene: PackedScene = null

	match boss_name:
		"boss_basic":
			boss_scene = preload("res://scenes/enemies/bosses/boss_basic.tscn")
		"boss_wind":
			boss_scene = preload("res://scenes/enemies/bosses/boss_wind.tscn")
		"boss_fire":
			boss_scene = preload("res://scenes/enemies/bosses/boss_fire.tscn")
		"boss_ice":
			boss_scene = preload("res://scenes/enemies/bosses/boss_ice.tscn")
		"boss_electric":
			boss_scene = preload("res://scenes/enemies/bosses/boss_electric.tscn")
		"boss_iron":
			# boss_iron - Use boss_basic as placeholder
			boss_scene = preload("res://scenes/enemies/bosses/boss_basic.tscn")
		"boss_king":
			# boss_king - Use boss_wind as placeholder
			boss_scene = preload("res://scenes/enemies/bosses/boss_wind.tscn")
		"boss_nightmare":
			# boss_nightmare - Use boss_basic as placeholder
			boss_scene = preload("res://scenes/enemies/bosses/boss_basic.tscn")
		"boss_shadow":
			# boss_shadow - Use boss_wind as placeholder
			boss_scene = preload("res://scenes/enemies/bosses/boss_wind.tscn")

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
