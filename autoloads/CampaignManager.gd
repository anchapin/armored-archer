## Manages campaign progression, stage unlocking, and completion tracking.
## Loads campaign data from JSON and handles boss defeat rewards.
##
## Signals:
## - stage_unlocked(stage_id: String): Emitted when a new stage becomes available
## - stage_completed(stage_id: String): Emitted when a stage is finished
## - campaign_progress_updated(chapter_id: String, progress: float): Emitted when overall progress changes
##
extends Node

# --- Data ---
var campaigns_data: Dictionary = {}

# --- Progress Tracking ---
var unlocked_stages: Array = []
var completed_stages: Array = []
var bosses_defeated: Array = []

# --- Modifier Pool Unlocks ---
var unlocked_modifier_pools: Array = []

# --- Manager References ---
# --- Analytics Reference ---
var analytics: Node
var network_manager: Node
var difficulty_manager: Node

# --- Signals ---
signal stage_unlocked(stage_id: String)
signal stage_completed(stage_id: String)
signal campaign_progress_updated(chapter_id: String, progress: float)
signal modifier_pool_unlocked(modifier_id: String)
signal difficulty_display_changed(difficulty_level: String)

func _ready() -> void:
	"""Initializes campaign data and loads saved progress."""
	if analytics == null:
		analytics = get_node_or_null("/root/AnalyticsManager")
	if network_manager == null:
		network_manager = get_node_or_null("/root/NetworkManager")
	if difficulty_manager == null:
		difficulty_manager = get_node_or_null("/root/DynamicDifficultyManager")

		# Connect to difficulty changes
		if difficulty_manager and difficulty_manager.has_signal("difficulty_changed"):
			difficulty_manager.difficulty_changed.connect(_on_difficulty_changed)

	# Load campaign data and progress
	load_campaigns_data()
	load_progress()

	# If no saved progress, initialize with first stage unlocked
	if unlocked_stages.is_empty():
		unlocked_stages = ["1_1"]
		save_progress()

	# Connect to network for sync
	if network_manager and network_manager.has_signal("connection_status_changed"):
		network_manager.connection_status_changed.connect(_on_connection_status_changed)

func _on_connection_status_changed(is_online: bool) -> void:
	"""Syncs campaign progress when connection is established."""
	if is_online:
		await sync_campaign_progress()

func sync_campaign_progress() -> void:
	"""Fetches campaign progress from server and merges with local state."""
	if not network_manager or not network_manager.has_method("send_rpc"):
		return
	if not network_manager.is_session_valid():
		return

	var response: Dictionary = await network_manager.send_rpc(
		"armored_archer/get_campaign_progress",
		JSON.stringify({})
	)

	if response.has("error"):
		push_warning("Failed to sync campaign progress: " + str(response.error))
		return

	# Merge server completions with local (union)
	var server_completed: Array = response.get("completed_stages", [])
	for stage_id in server_completed:
		if not stage_id in completed_stages:
			completed_stages.append(stage_id)

	# Merge server unlocks with local (union)
	var server_unlocked: Array = response.get("unlocked_stages", [])
	for stage_id in server_unlocked:
		if not stage_id in unlocked_stages:
			unlocked_stages.append(stage_id)

	# Merge boss defeats
	var server_bosses: Array = response.get("bosses_defeated", [])
	for boss_id in server_bosses:
		if not boss_id in bosses_defeated:
			bosses_defeated.append(boss_id)

	# Emit campaign progress updated signal
	update_campaign_progress()

	# Save merged state locally
	save_progress()

func _on_difficulty_changed(new_level: String, modifier: float) -> void:
	"""Handles difficulty level changes and updates display.

	Parameters:
		new_level: New difficulty level string
		modifier: Difficulty modifier value
	"""
	difficulty_display_changed.emit(new_level)

	# Track difficulty change in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("difficulty_changed", {
			"new_level": new_level,
			"modifier": modifier
		})

func load_campaigns_data() -> void:
	"""Loads campaign definitions from res://data/campaigns.json."""
	var file = FileAccess.open("res://data/campaigns.json", FileAccess.READ)
	if file:
		var json_string = file.get_as_text()
		file.close()
		var json = JSON.new()
		var parse_result = json.parse(json_string)
		if parse_result == OK:
			campaigns_data = json.data
		else:
			push_error("Failed to parse campaigns.json")

func get_stage_data(stage_id: String) -> Dictionary:
	"""Retrieves data for a specific stage.

	Parameters:
		stage_id: Stage identifier (e.g., "1_1", "2_3")

	Returns:
		Dictionary: Stage configuration data or empty dict if not found
	"""
	for campaign in campaigns_data.get("campaigns", []):
		for stage in campaign.get("stages", []):
			if stage.get("id") == stage_id:
				return stage
	return {}

## Returns enemy stats dictionary for a stage.
##
## Parameters:
##   stage_id: Stage identifier (e.g., "1_1", "2_3")
##
## Returns:
##   Dictionary: Enemy data with type, health, attack, defense, speed or empty dict
func get_enemy_data(stage_id: String) -> Dictionary:
	var stage = get_stage_data(stage_id)
	return stage.get("enemy", {})

## Returns difficulty tier (1-3) for a stage.
##
## Parameters:
##   stage_id: Stage identifier to check
##
## Returns:
##   int: Difficulty tier (1=Starter, 2=Challenging, 3=Endgame)
func get_difficulty_tier(stage_id: String) -> int:
	var stage = get_stage_data(stage_id)
	return stage.get("difficulty", 1)

## Returns biome name for a chapter.
##
## Parameters:
##   chapter_id: Chapter identifier (e.g., "chapter_1")
##
## Returns:
##   String: Biome name (forest, cavern, mountain)
func get_biome(chapter_id: String) -> String:
	for chapter in campaigns_data.get("campaigns", []):
		if chapter.get("id") == chapter_id:
			var stages = chapter.get("stages", [])
			if stages.size() > 0:
				return stages[0].get("biome", "forest")
	return "forest"

## Returns loot configuration for a stage.
##
## Parameters:
##   stage_id: Stage identifier to check
##
## Returns:
##   Dictionary: Loot config with xp, gold, rarity_weights
func get_loot_config(stage_id: String) -> Dictionary:
	var stage = get_stage_data(stage_id)
	return stage.get("loot", {})

## Returns difficulty tier metadata (name, color) from campaigns.json.
##
## Returns:
##   Dictionary: Difficulty tier info keyed by tier number
func get_difficulty_metadata() -> Dictionary:
	return campaigns_data.get("difficulty_tiers", {})

## Returns stages filtered by difficulty tier.
##
## Parameters:
##   difficulty: Difficulty tier to filter by (1-3)
##
## Returns:
##   Array: List of stage dictionaries matching the difficulty
func get_stages_by_difficulty(difficulty: int) -> Array:
	var result = []
	for chapter in campaigns_data.get("campaigns", []):
		for stage in chapter.get("stages", []):
			if stage.get("difficulty", 1) == difficulty:
				result.append(stage)
	return result

func complete_stage(stage_id: String) -> void:
	"""Marks a stage as completed and triggers progression.

	Parameters:
		stage_id: ID of the completed stage
	"""
	if not stage_id in completed_stages:
		completed_stages.append(stage_id)
		stage_completed.emit(stage_id)

		var stage_data = get_stage_data(stage_id)
		var boss_value = stage_data.get("boss")
		var boss_id: String = boss_value if boss_value != null else ""
	
		# Send stage completion to server with boss defeat info
		_notify_server_stage_complete(stage_id, boss_id)

		if boss_id:
			handle_boss_defeat(boss_id)

		unlock_next_stage(stage_id)
		save_progress()
		update_campaign_progress()

func _notify_server_stage_complete(stage_id: String, boss_id: String) -> void:
	"""Notifies the server about stage completion and unlocks modifier pools.

	Parameters:
		stage_id: ID of the completed stage
		boss_id: ID of the boss defeated (empty string if no boss)
	"""
	if not network_manager or not network_manager.has_method("send_rpc"):
		return

	var tier: int = 1
	if "current_difficulty" in GameManager:
		tier = GameManager.current_difficulty
	var payload: Dictionary = {
		"stage_id": stage_id,
		"boss_defeated": boss_id != "",
		"boss_id": boss_id,
		"difficulty": _get_difficulty_string(tier)
	}

	# Send async RPC to server
	network_manager.send_rpc_async("armored_archer/stage_complete", JSON.stringify(payload), 10.0)

func is_stage_unlocked(stage_id: String) -> bool:
	"""Checks if a stage is available to play.

	Parameters:
		stage_id: Stage identifier to check

	Returns:
		bool: True if stage is unlocked
	"""
	return stage_id in unlocked_stages

func is_stage_completed(stage_id: String) -> bool:
	"""Checks if a stage has been completed.

	Parameters:
		stage_id: Stage identifier to check

	Returns:
		bool: True if stage is completed
	"""
	return stage_id in completed_stages

func unlock_next_stage(stage_id: String) -> void:
	"""Unlocks the next stage in sequence after completing current one.

	Parameters:
		stage_id: ID of the just-completed stage
	"""
	var parts = stage_id.split("_")
	var current_chapter = parts[0]
	var current_stage_num = int(parts[1])

	var next_stage_id = "%s_%d" % [current_chapter, current_stage_num + 1]

	if get_stage_data(next_stage_id):
		if not next_stage_id in unlocked_stages:
			unlocked_stages.append(next_stage_id)
			stage_unlocked.emit(next_stage_id)

			# Track stage unlocked in analytics
			if analytics and analytics.has_method("log_custom_event"):
				analytics.log_custom_event("stage_unlocked", {
					"stage_id": next_stage_id,
					"unlocked_from": stage_id,
					"chapter": int(current_chapter)
				})

func get_chapter_progress(chapter_id: String) -> float:
	"""Calculates progress for a chapter based on completed stages.

	Parameters:
		chapter_id: Chapter identifier to calculate progress for

	Returns:
		float: Progress value from 0.0 to 1.0
	"""
	for campaign in campaigns_data.get("campaigns", []):
		if campaign.id == chapter_id:
			var total_stages = campaign.get("stages", []).size()
			var completed_in_chapter = 0
			for stage in campaign.get("stages", []):
				if stage.id in completed_stages:
					completed_in_chapter += 1
			return float(completed_in_chapter) / float(total_stages)
	return 0.0

func handle_boss_defeat(boss_id: String) -> void:
	"""Handles special rewards for defeating a boss.

	Parameters:
		boss_id: Identifier of the defeated boss
	"""
	# Track boss defeated if not already tracked
	if not boss_id in bosses_defeated:
		bosses_defeated.append(boss_id)

	# Track boss defeated in analytics
	if analytics and analytics.has_method("log_pve_boss_defeated"):
		var stage_data = _get_stage_with_boss(boss_id)
		analytics.log_pve_boss_defeated(
			stage_data.get("id", ""),
			boss_id,
			stage_data.get("difficulty", "normal"),
			1  # attempts - could track multiple attempts
		)

	match boss_id:
		"boss_wind":
			unlock_modifier_pool("piercing_arrow")
		"boss_fire":
			unlock_modifier_pool("fire_arrow")
		"boss_electric":
			unlock_modifier_pool("lightning_damage")
		"boss_ice":
			unlock_modifier_pool("ice_arrow")
		"boss_earth":
			unlock_modifier_pool("earth_arrow")
		"boss_iron":
			unlock_modifier_pool("iron_forged")
		"boss_king":
			unlock_modifier_pool("royal_blessing")
		"boss_nightmare":
			unlock_modifier_pool("nightmare_essence")
		"boss_shadow":
			unlock_modifier_pool("shadow_touched")

func _get_stage_with_boss(boss_id: String) -> Dictionary:
	"""Find the stage that contains a specific boss.

	Parameters:
		boss_id: The boss identifier

	Returns:
		Dictionary: Stage data or empty dict if not found
	"""
	for campaign in campaigns_data.get("campaigns", []):
		for stage in campaign.get("stages", []):
			if stage.get("boss") == boss_id:
				return stage
	return {}

func unlock_modifier_pool(modifier_id: String) -> void:
	"""Unlocks a modifier pool for gear generation.

	Parameters:
		modifier_id: Identifier of the modifier to unlock
	"""
	if not modifier_id in unlocked_modifier_pools:
		unlocked_modifier_pools.append(modifier_id)
		modifier_pool_unlocked.emit(modifier_id)

		# Track modifier unlocked in analytics
		if analytics and analytics.has_method("log_custom_event"):
			analytics.log_custom_event("modifier_pool_unlocked", {
				"modifier_id": modifier_id
			})

		save_progress()
	else:
		pass

func get_unlocked_modifier_pools() -> Array:
	"""Returns the list of unlocked modifier pool IDs.

	Returns:
		Array: List of unlocked modifier pool IDs
	"""
	return unlocked_modifier_pools.duplicate()

func is_modifier_pool_unlocked(modifier_id: String) -> bool:
	"""Checks if a modifier pool is unlocked.

	Parameters:
		modifier_id: Identifier of the modifier to check

	Returns:
		bool: True if the modifier pool is unlocked
	"""
	return modifier_id in unlocked_modifier_pools

func update_campaign_progress() -> void:
	"""Calculates and emits progress for each campaign chapter."""
	for campaign in campaigns_data.get("campaigns", []):
		var chapter_id = campaign.id
		var total_stages = campaign.get("stages", []).size()
		var completed_in_chapter = 0

		for stage in campaign.get("stages", []):
			if stage.id in completed_stages:
				completed_in_chapter += 1

		var progress = float(completed_in_chapter) / float(total_stages)
		campaign_progress_updated.emit(chapter_id, progress)

func save_progress() -> void:
	"""Saves campaign progress to user://campaign_progress.json."""
	var save_data = {
		"unlocked_stages": unlocked_stages,
		"completed_stages": completed_stages,
		"unlocked_modifier_pools": unlocked_modifier_pools,
		"bosses_defeated": bosses_defeated
	}
	var file = FileAccess.open("user://campaign_progress.json", FileAccess.WRITE)
	if file:
		var _err = file.store_string(JSON.stringify(save_data))
		file.close()

func load_progress() -> void:
	"""Loads campaign progress from user://campaign_progress.json."""
	var file = FileAccess.open("user://campaign_progress.json", FileAccess.READ)
	if file:
		var json_string = file.get_as_text()
		file.close()
		var json = JSON.new()
		var parse_result = json.parse(json_string)
		if parse_result == OK:
			var save_data = json.data
			unlocked_stages = save_data.get("unlocked_stages", [])
			completed_stages = save_data.get("completed_stages", [])
			unlocked_modifier_pools = save_data.get("unlocked_modifier_pools", [])
			bosses_defeated = save_data.get("bosses_defeated", [])

func sync_modifiers_from_server() -> void:
	"""Fetches unlocked modifiers from the server and syncs local state."""
	if not network_manager or not network_manager.has_method("send_rpc"):
		return

	var response = network_manager.send_rpc("armored_archer/get_unlocked_modifiers", JSON.stringify({}))

	if response.has("error"):
		push_warning("Failed to sync modifiers from server: " + str(response.error))
		return

	if response.has("success") and response.success:
		# Sync unlocked modifier pools
		if response.has("unlocked_modifier_pools"):
			var server_modifiers = response.unlocked_modifier_pools
			for mod_id in server_modifiers:
				if not mod_id in unlocked_modifier_pools:
					unlocked_modifier_pools.append(mod_id)
					modifier_pool_unlocked.emit(mod_id)

		# Sync boss defeats
		if response.has("boss_defeats"):
			var server_bosses = response.boss_defeats
			for boss_id in server_bosses:
				if not boss_id in bosses_defeated:
					bosses_defeated.append(boss_id)

		# Save synced data
		save_progress()

func get_bosses_defeated() -> Array:
	"""Returns the list of boss IDs that have been defeated.

	Returns:
		Array: List of defeated boss IDs
	"""
	return bosses_defeated.duplicate()

func has_defeated_boss(boss_id: String) -> bool:
	"""Checks if a specific boss has been defeated.

	Parameters:
		boss_id: The boss identifier to check

	Returns:
		bool: True if the boss has been defeated
	"""
	return boss_id in bosses_defeated

func _get_difficulty_string(tier: int) -> String:
	"""Converts numeric difficulty tier to server-expected string.

	Parameters:
		tier: Numeric difficulty tier (1-3)

	Returns:
		String: Server difficulty string (easy, medium, hard, or normal)
	"""
	match tier:
		1: return "easy"
		2: return "medium"
		3: return "hard"
		_: return "normal"

# --- Dynamic Difficulty Integration ---
func get_current_difficulty_level() -> String:
	"""Returns the current dynamic difficulty level.

	Returns:
		String: Current difficulty level ("Easy", "Normal", "Hard", or "Extreme")
	"""
	if difficulty_manager:
		return difficulty_manager.get_difficulty_level_string()
	return "Normal"

func get_difficulty_modifier() -> float:
	"""Returns the current difficulty modifier.

	Returns:
		float: Modifier value from -0.20 to 0.20
	"""
	if difficulty_manager:
		return difficulty_manager.get_difficulty_modifier()
	return 0.0

func get_stage_difficulty_with_modifier(stage_id: String) -> Dictionary:
	"""Calculates stage difficulty including dynamic difficulty modifier.

	Parameters:
		stage_id: Stage identifier

	Returns:
		Dictionary: Stage data with adjusted difficulty
	"""
	var stage_data = get_stage_data(stage_id)
	var base_difficulty = stage_data.get("difficulty", 1)

	if difficulty_manager:
		var modifier = difficulty_manager.get_difficulty_modifier()
		var adjusted_difficulty = base_difficulty

		# Map modifier to difficulty adjustment
		if modifier <= -0.15:
			adjusted_difficulty = max(1, base_difficulty - 1)
		elif modifier >= 0.15:
			adjusted_difficulty = min(3, base_difficulty + 1)

		stage_data["adjusted_difficulty"] = adjusted_difficulty
		stage_data["dynamic_modifier"] = modifier

	return stage_data

func save_difficulty_setting() -> void:
	"""Saves the current difficulty setting for persistence."""
	if difficulty_manager:
		difficulty_manager.save_difficulty_state()
