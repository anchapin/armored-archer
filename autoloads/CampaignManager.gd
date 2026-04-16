## Manages campaign progression, stage unlocking, and completion tracking.
## Loads campaign data from JSON and handles boss defeat rewards.
##
## Signals:
## - stage_unlocked(stage_id: String): Emitted when a new stage becomes available
## - stage_completed(stage_id: String): Emitted when a stage is finished
## - campaign_progress_updated(chapter_id: String, progress: float): Emitted when overall progress changes
## - chapter_unlocked(chapter_id: String): Emitted when a chapter becomes available
##
extends Node

# --- Data ---
var campaigns_data: Dictionary = {}

# --- Progress Tracking ---
var unlocked_stages: Array = []
var completed_stages: Array = []
var bosses_defeated: Array = []
var unlocked_chapters: Array = []

# --- Modifier Pool Unlocks ---
var unlocked_modifier_pools: Array = []

# --- Manager References ---
# --- Analytics Reference ---
var analytics: Node
var network_manager: Node
var difficulty_manager: Node
var pacing_manager: Node
var progression_manager: Node

# --- Signals ---
signal stage_unlocked(stage_id: String)
signal stage_completed(stage_id: String)
signal campaign_progress_updated(chapter_id: String, progress: float)
signal chapter_unlocked(chapter_id: String)
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

	if pacing_manager == null:
		pacing_manager = get_node_or_null("/root/PacingManager")

	if progression_manager == null:
		progression_manager = get_node_or_null("/root/ProgressionIndicatorManager")

	# Load campaign data and progress
	load_campaigns_data()
	load_progress()

	# If no saved progress, initialize with first stage and chapter unlocked
	if unlocked_stages.is_empty():
		unlocked_stages = ["1_1"]
	if unlocked_chapters.is_empty():
		unlocked_chapters = ["chapter_1"]
		save_progress()

	# Connect to network for sync
	if network_manager and network_manager.has_signal("connection_status_changed"):
		network_manager.connection_status_changed.connect(_on_connection_status_changed)

	# Connect to progression manager for quest tracking
	if progression_manager and progression_manager.has_signal("quest_updated"):
		progression_manager.quest_updated.connect(_on_quest_updated)

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

	# Merge server chapter unlocks with local (union)
	var server_chapters: Array = response.get("unlocked_chapters", [])
	for chapter_id in server_chapters:
		if not chapter_id in unlocked_chapters:
			unlocked_chapters.append(chapter_id)

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

		# Check for chapter unlocks after completing a stage
		check_and_unlock_chapters()

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

## Checks if a chapter is available to play.

## Parameters:
## 	chapter_id: Chapter identifier to check

## Returns:
## 	bool: True if chapter is unlocked
func is_chapter_unlocked(chapter_id: String) -> bool:
	"""Checks if a chapter is available to play."""
	return chapter_id in unlocked_chapters

## Gets the chapter unlock requirement data.

## Parameters:
## 	chapter_id: Chapter identifier to check

## Returns:
## 	Dictionary: Unlock requirement data with type, required_chapter, required_stage, description
func get_chapter_unlock_requirement(chapter_id: String) -> Dictionary:
	"""Gets the chapter unlock requirement data."""
	return campaigns_data.get("chapter_unlock_requirements", {}).get(chapter_id, {})

## Gets the level requirement for a chapter.

## Parameters:
## 	chapter_id: Chapter identifier to check

## Returns:
## 	int: Minimum level required to access this chapter
func get_chapter_level_requirement(chapter_id: String) -> int:
	"""Gets the level requirement for a chapter."""
	for chapter in campaigns_data.get("campaigns", []):
		if chapter.get("id") == chapter_id:
			return chapter.get("level_requirement", 1)
	return 1

## Gets the level requirement for a stage.

## Parameters:
## 	stage_id: Stage identifier to check

## Returns:
## 	int: Minimum level required to play this stage
func get_stage_level_requirement(stage_id: String) -> int:
	"""Gets the level requirement for a stage."""
	var stage_data = get_stage_data(stage_id)
	return stage_data.get("level_requirement", 1)

## Unlocks a chapter and emits the chapter_unlocked signal.

## Parameters:
## 	chapter_id: ID of the chapter to unlock
func unlock_chapter(chapter_id: String) -> void:
	"""Unlocks a chapter and emits the chapter_unlocked signal."""
	if not chapter_id in unlocked_chapters:
		unlocked_chapters.append(chapter_id)
		chapter_unlocked.emit(chapter_id)

		# Track chapter unlocked in analytics
		if analytics and analytics.has_method("log_custom_event"):
			analytics.log_custom_event("chapter_unlocked", {
				"chapter_id": chapter_id
			})

		save_progress()

## Checks and unlocks chapters based on completion criteria.

## This is called when a stage is completed to see if any new chapters should unlock.
func check_and_unlock_chapters() -> void:
	"""Checks and unlocks chapters based on completion criteria."""
	var unlock_reqs = campaigns_data.get("chapter_unlock_requirements", {})

	for chapter_id in unlock_reqs:
		if chapter_id in unlocked_chapters:
			continue  # Already unlocked

		var req_data = unlock_reqs[chapter_id]
		var req_type = req_data.get("type", "")

		match req_type:
			"default":
				# Default chapters are always unlocked
				unlock_chapter(chapter_id)

			"chapter_completion":
				# Unlock if required chapter/stage is completed
				var required_stage = req_data.get("required_stage", "")
				if required_stage != "" and is_stage_completed(required_stage):
					unlock_chapter(chapter_id)

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
		# Check if the chapter is unlocked before unlocking the stage
		if current_chapter in unlocked_chapters:
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
		var difficulty_str: String = "normal"
		# Convert numeric difficulty tier to string
		var difficulty_tier: int = stage_data.get("difficulty", 1)
		difficulty_str = _get_difficulty_string(difficulty_tier)
		analytics.log_pve_boss_defeated(
			stage_data.get("id", ""),
			boss_id,
			difficulty_str,
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
		"unlocked_chapters": unlocked_chapters,
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
			unlocked_chapters = save_data.get("unlocked_chapters", [])
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

# --- Pacing & Variety Integration ---
func track_encounter_pacing(stage_id: String, duration: float) -> void:
	"""Tracks encounter pacing for the given stage.

	Parameters:
		stage_id: ID of the stage
		duration: Duration of the encounter in seconds
	"""
	if not pacing_manager:
		return

	var stage_data = get_stage_data(stage_id)
	if stage_data.is_empty():
		return

	# Classify the encounter
	var encounter_type = pacing_manager.classify_encounter(stage_data)

	# Track pacing state
	pacing_manager.track_pacing_state(encounter_type, duration)

	# Log to server
	pacing_manager.log_encounter_pacing()

func get_pacing_recommendations() -> Dictionary:
	"""Gets current pacing recommendations.

	Returns:
		Dictionary with pacing recommendations
	"""
	if not pacing_manager:
		return {}

	return pacing_manager.suggest_break()

func get_pacing_metrics() -> Dictionary:
	"""Gets current pacing metrics.

	Returns:
		Dictionary with pacing metrics
	"""
	if not pacing_manager:
		return {}

	return pacing_manager.get_pacing_metrics()

func get_recommended_encounter() -> String:
	"""Gets the recommended next encounter type.

	Returns:
		String: Recommended encounter type (combat, exploration, narrative, puzzle)
	"""
	if not pacing_manager:
		return "combat"

	var recommended_type = pacing_manager.get_recommended_encounter_type()
	match recommended_type:
		PacingManager.ContentType.COMBAT: return "combat"
		PacingManager.ContentType.EXPLORATION: return "exploration"
		PacingManager.ContentType.NARRATIVE: return "narrative"
		PacingManager.ContentType.PUZZLE: return "puzzle"
		_: return "combat"

func show_pacing_warning_if_needed() -> bool:
	"""Checks if pacing warning should be shown.

	Returns:
		bool: True if warning should be shown, false otherwise
	"""
	if not pacing_manager:
		return false

	var metrics = pacing_manager.get_pacing_metrics()
	var fatigue_level: String = metrics.get("fatigue_level", "None")

	if fatigue_level in ["High", "Critical"]:
		return true

	return false

func reset_pacing_state() -> void:
	"""Resets pacing state for new session."""
	if pacing_manager:
		pacing_manager.reset_pacing_state()

# --- Progression Indicators Integration ---
## Returns the next available stage for the player.
##
## Returns:
##   String: Stage ID of the next available stage, or empty string if none
func get_next_available_stage() -> String:
	"""Returns the next available stage for the player."""
	for chapter in campaigns_data.get("campaigns", []):
		var stages = chapter.get("stages", [])
		for stage_data in stages:
			var stage_id = stage_data.get("id", "")
			if is_stage_unlocked(stage_id) and not is_stage_completed(stage_id):
				return stage_id
	return ""

## Gets stage data with progression information.
##
## Parameters:
##   stage_id: Stage identifier
##
## Returns:
##   Dictionary: Stage data with progression info
func get_stage_with_progression(stage_id: String) -> Dictionary:
	"""Gets stage data with progression information."""
	var stage_data = get_stage_data(stage_id)

	if stage_data.is_empty():
		return {}

	stage_data["is_unlocked"] = is_stage_unlocked(stage_id)
	stage_data["is_completed"] = is_stage_completed(stage_id)

	# Add level requirement if available
	if progression_manager:
		var reqs = progression_manager.get_level_requirements(stage_id)
		if not reqs.is_empty():
			stage_data["level_requirement"] = reqs.get("level", 1)
		else:
			stage_data["level_requirement"] = 1
	else:
		stage_data["level_requirement"] = 1

	return stage_data

## Gets the quest objectives for a specific stage.
##
## Parameters:
##   stage_id: Stage identifier
##
## Returns:
##   Array: List of quest objectives
func get_stage_quest_objectives(stage_id: String) -> Array:
	"""Gets quest objectives for a specific stage."""
	if progression_manager and progression_manager.has_method("get_quest_objectives"):
		var quest_id = "stage_%s" % stage_id
		return progression_manager.get_quest_objectives(quest_id)
	return []

## Gets the current quest progress for a stage.
##
## Parameters:
##   stage_id: Stage identifier
##
## Returns:
##   float: Progress percentage (0.0 to 1.0)
func get_stage_quest_progress(stage_id: String) -> float:
	"""Gets quest progress for a specific stage."""
	var objectives = get_stage_quest_objectives(stage_id)
	if objectives.is_empty():
		return 0.0

	var total = objectives.size()
	var completed = 0

	for objective in objectives:
		if objective.get("state") == ProgressionIndicatorManager.ObjectiveState.COMPLETED:
			completed += 1

	return float(completed) / float(total) if total > 0 else 0.0

## Handles quest updated signal from ProgressionIndicatorManager.
##
## Parameters:
##   quest_id: ID of the updated quest
##   progress: Progress percentage (0.0 to 1.0)
func _on_quest_updated(quest_id: String, progress: float) -> void:
	"""Handles quest progress update from ProgressionIndicatorManager."""
	# Update campaign progress if this is a stage completion quest
	if quest_id.begins_with("stage_"):
		var stage_id = quest_id.substr(6)  # Remove "stage_" prefix
		update_campaign_progress()

## Gets all stage markers for the campaign map.
##
## Returns:
##   Dictionary: Stage markers keyed by stage ID
func get_all_stage_markers() -> Dictionary:
	"""Gets all stage markers for the campaign map."""
	var markers = {}

	if not progression_manager:
		return markers

	var map_markers_data = progression_manager.get_map_markers()
	var player_stats_manager = get_node_or_null("/root/PlayerStatsManager")

	for stage_id in map_markers_data:
		var stage_markers = map_markers_data[stage_id]
		var marker_info = {
			"stage_id": stage_id,
			"has_quest": false,
			"is_locked": false,
			"is_available": false
		}

		# Check each marker type
		for marker in stage_markers.get("markers", []):
			var marker_type = marker.get("type", "")
			match marker_type:
				"quest":
					marker_info["has_quest"] = true
					marker_info["quest_description"] = marker.get("description", "")
				"available":
					marker_info["is_available"] = true
				"locked":
					marker_info["is_locked"] = true

		markers[stage_id] = marker_info

	return markers
