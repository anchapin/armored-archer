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

# --- Game State ---
var player_current_health: int = 100
var player_max_health: int = 100
var current_stage: int = 1
var is_game_active: bool = true

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
	
	player_current_health = max(0, player_current_health - damage)
	health_changed.emit(player_current_health, player_max_health)
	
	if player_current_health <= 0:
		player_died.emit()

func heal_player(amount: int) -> void:
	"""Heals the player by the specified amount.
	
	Parameters:
		amount: Amount of health to restore
	"""
	if not is_game_active:
		return
	
	player_current_health = min(player_max_health, player_current_health + amount)
	health_changed.emit(player_current_health, player_max_health)

# --- Game Flow ---
func start_game() -> void:
	"""Starts a new game session, resetting health and state."""
	player_current_health = player_max_health
	is_game_active = true
	health_changed.emit(player_current_health, player_max_health)

func end_game(won: bool) -> void:
	"""Ends the current game session.
	
	Parameters:
		won: True if the player won, false if they died
	"""
	is_game_active = false
	
	if won:
		game_won.emit()
		
		if current_stage_id != "":
			CampaignManager.complete_stage(current_stage_id)
			stage_completed.emit(current_stage_id)
	else:
		player_died.emit()

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
	
	if boss_scene:
		var boss_instance = boss_scene.instantiate() as CharacterBody2D
		get_tree().root.add_child(boss_instance)
		boss_instance.global_position = Vector2(0, -200)
		boss_spawned.emit(boss_instance)
