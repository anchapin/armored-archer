## Manages progression indicators including map markers, quest objectives, and level requirements.
## Provides clear visual feedback on player progress and next steps.
##
## Signals:
## - quest_updated(quest_id: String, progress: float): Emitted when quest progress changes
## - objective_completed(quest_id: String, objective_id: String): Emitted when objective is completed
## - level_requirement_met(level: int): Emitted when level requirement is met
## - map_markers_updated(): Emitted when map markers are updated
##
extends Node

# --- Manager References ---
var campaign_manager: Node
var player_stats_manager: Node

# --- Quest Data ---
var active_quests: Array = []
var completed_quests: Array = []

# --- Objective Tracking ---
var quest_objectives: Dictionary = {}

# --- Level Requirements ---
var level_requirements: Dictionary = {}

# --- Map Markers ---
var map_markers: Dictionary = {}

# --- Signals ---
signal quest_updated(quest_id: String, progress: float)
signal objective_completed(quest_id: String, objective_id: String)
signal level_requirement_met(level: int)
signal map_markers_updated()

# --- Quest Types ---
enum QuestType {
	STAGE_COMPLETION,      # Complete specific stages
	BOSS_DEFEAT,          # Defeat specific boss
	STAT_TARGET,          # Reach stat target
	LEVEL_TARGET,         # Reach level target
	COLLECT_ITEM,         # Collect specific items
	SURVIVAL              # Survive for time/waves
}

# --- Objective States ---
enum ObjectiveState {
	NOT_STARTED,
	IN_PROGRESS,
	COMPLETED,
	FAILED
}

func _ready() -> void:
	"""Initializes progression indicators with manager references."""
	campaign_manager = get_node_or_null("/root/CampaignManager")
	player_stats_manager = get_node_or_null("/root/PlayerStatsManager")

	# Connect to relevant signals
	if campaign_manager:
		campaign_manager.stage_completed.connect(_on_stage_completed)
		campaign_manager.stage_unlocked.connect(_on_stage_unlocked)

	if player_stats_manager:
		player_stats_manager.level_up.connect(_on_level_up)
		player_stats_manager.stats_updated.connect(_on_stats_updated)

	# Load saved progression data
	load_progression_data()

	# Initialize active quests
	initialize_active_quests()

# --- Quest Management ---

## Returns the list of currently active quests.
##
## Returns:
##   Array: List of active quest dictionaries
func get_active_quests() -> Array:
	"""Returns the list of currently active quests."""
	return active_quests.duplicate()

## Returns objectives for a specific quest.
##
## Parameters:
##   quest_id: ID of the quest to get objectives for
##
## Returns:
##   Array: List of objective dictionaries
func get_quest_objectives(quest_id: String) -> Array:
	"""Returns objectives for a specific quest."""
	if quest_objectives.has(quest_id):
		return quest_objectives[quest_id].duplicate()
	return []

## Returns level requirements for a specific level or stage.
##
## Parameters:
##   level_or_stage: Level number or stage ID to check
##
## Returns:
##   Dictionary: Level requirements data
func get_level_requirements(level_or_stage) -> Dictionary:
	"""Returns level requirements for a specific level or stage."""
	if level_or_stage is int:
		return level_requirements.get("level_%d" % level_or_stage, {})
	elif level_or_stage is String:
		return level_requirements.get(level_or_stage, {})
	return {}

## Updates map markers for the current progression state.
func update_map_markers() -> void:
	"""Updates map markers based on current progression state."""
	map_markers.clear()

	# Add markers for active quest objectives
	for quest in active_quests:
		var quest_id = quest.get("id", "")
		var objectives = get_quest_objectives(quest_id)

		for objective in objectives:
			if objective.get("state") == ObjectiveState.IN_PROGRESS:
				var stage_id = objective.get("stage_id", "")
				if stage_id != "":
					_add_map_marker(stage_id, "quest", objective.get("description", ""))

	# Add markers for next available content
	if campaign_manager:
		for chapter in campaign_manager.campaigns_data.get("campaigns", []):
			var stages = chapter.get("stages", [])
			for stage_data in stages:
				var stage_id = stage_data.get("id", "")
				if campaign_manager.is_stage_unlocked(stage_id) and not campaign_manager.is_stage_completed(stage_id):
					# Check if this stage has a level requirement
					var reqs = get_level_requirements(stage_id)
					if reqs.is_empty():
						_add_map_marker(stage_id, "available", stage_data.get("name", ""))
					else:
						var player_level = player_stats_manager.get_level() if player_stats_manager else 1
						var req_level = reqs.get("level", 1)
						if player_level >= req_level:
							_add_map_marker(stage_id, "available", stage_data.get("name", ""))
						else:
							_add_map_marker(stage_id, "locked", stage_data.get("name", ""))

	map_markers_updated.emit()

## Adds a map marker for the given stage.
##
## Parameters:
##   stage_id: ID of the stage
##   marker_type: Type of marker (quest, available, locked)
##   description: Description text for the marker
func _add_map_marker(stage_id: String, marker_type: String, description: String) -> void:
	"""Adds a map marker for the given stage."""
	if not map_markers.has(stage_id):
		map_markers[stage_id] = {
			"stage_id": stage_id,
			"markers": []
		}

	map_markers[stage_id]["markers"].append({
		"type": marker_type,
		"description": description
	})

## Returns all current map markers.
##
## Returns:
##   Dictionary: Map markers keyed by stage ID
func get_map_markers() -> Dictionary:
	"""Returns all current map markers."""
	return map_markers.duplicate()

## Initializes active quests based on player progress.
func initialize_active_quests() -> void:
	"""Initializes active quests based on current progression."""
	if not campaign_manager:
		return

	# Clear existing active quests
	active_quests.clear()

	# Get player level
	var player_level = player_stats_manager.get_level() if player_stats_manager else 1

	# Find next incomplete stage as primary quest
	for chapter in campaign_manager.campaigns_data.get("campaigns", []):
		var stages = chapter.get("stages", [])
		for stage_data in stages:
			var stage_id = stage_data.get("id", "")
			if campaign_manager.is_stage_unlocked(stage_id) and not campaign_manager.is_stage_completed(stage_id):
				# Check level requirement
				var reqs = get_level_requirements(stage_id)
				var req_level = reqs.get("level", 1)

				# Create stage completion quest
				var quest_id = "stage_%s" % stage_id
				var quest = {
					"id": quest_id,
					"type": QuestType.STAGE_COMPLETION,
					"name": "Complete %s" % stage_data.get("name", "Stage"),
					"stage_id": stage_id,
					"level_requirement": req_level,
					"is_locked": player_level < req_level,
					"priority": 100 if req_level <= player_level else 0
				}

				# Add objectives
				var objectives = [
					{
						"id": "complete_stage",
						"description": "Complete the stage",
						"state": ObjectiveState.IN_PROGRESS if not quest.is_locked else ObjectiveState.NOT_STARTED,
						"target": 1,
						"current": 0
					}
				]

				# Add boss objective if stage has boss
				if stage_data.get("boss"):
					objectives.append({
						"id": "defeat_boss",
						"description": "Defeat the boss",
						"state": ObjectiveState.NOT_STARTED,
						"target": 1,
						"current": 0
					})

				active_quests.append(quest)
				quest_objectives[quest_id] = objectives

				# Only add the first available stage as active quest
				return

	# Add level-up quest if player is close to next level
	if player_stats_manager and player_stats_manager.is_initialized:
		var current_xp = player_stats_manager.get_xp()
		var next_level_xp = _get_xp_for_level(player_level + 1)
		var prev_level_xp = _get_xp_for_level(player_level)
		var progress_to_next = float(current_xp - prev_level_xp) / float(next_level_xp - prev_level_xp)

		if progress_to_next > 0.5:
			var level_quest_id = "level_up_%d" % (player_level + 1)
			var level_quest = {
				"id": level_quest_id,
				"type": QuestType.LEVEL_TARGET,
				"name": "Reach Level %d" % (player_level + 1),
				"level_requirement": player_level + 1,
				"is_locked": false,
				"priority": 50
			}

			quest_objectives[level_quest_id] = [
				{
					"id": "gain_xp",
					"description": "Gain %d XP to reach level %d" % [next_level_xp - current_xp, player_level + 1],
					"state": ObjectiveState.IN_PROGRESS,
					"target": next_level_xp,
					"current": current_xp
				}
			]

			active_quests.append(level_quest)

	# Update map markers after initializing quests
	update_map_markers()

# --- Progress Tracking ---

## Updates quest progress when a stage is completed.
##
## Parameters:
##   stage_id: ID of the completed stage
func _on_stage_completed(stage_id: String) -> void:
	"""Updates quest progress when a stage is completed."""
	var quest_id = "stage_%s" % stage_id
	var objectives = get_quest_objectives(quest_id)

	if objectives.is_empty():
		return

	# Update completion objective
	for objective in objectives:
		if objective.get("id") == "complete_stage":
			objective["state"] = ObjectiveState.COMPLETED
			objective["current"] = 1
			objective_completed.emit(quest_id, objective.get("id"))

	# Mark quest as completed
	_mark_quest_completed(quest_id)

	# Update quest progress
	_update_quest_progress(quest_id)

	# Reinitialize active quests for next stage
	initialize_active_quests()

## Updates quest progress when a stage is unlocked.
##
## Parameters:
##   stage_id: ID of the unlocked stage
func _on_stage_unlocked(stage_id: String) -> void:
	"""Updates quest progress when a stage is unlocked."""
	update_map_markers()

## Updates quest progress when player levels up.
##
## Parameters:
##   new_level: New player level
##   ability_points_gained: Ability points gained
func _on_level_up(new_level: int, ability_points_gained: int) -> void:
	"""Updates quest progress when player levels up."""
	# Check if any level requirements are now met
	for level_id in level_requirements:
		var req_level = int(level_id.split("_")[1])
		if new_level >= req_level:
			level_requirement_met.emit(req_level)

	# Update level-up quests
	for quest in active_quests:
		if quest.get("type") == QuestType.LEVEL_TARGET:
			var quest_level = quest.get("level_requirement", 1)
			if new_level >= quest_level:
				var objectives = get_quest_objectives(quest.get("id", ""))
				for objective in objectives:
					objective["state"] = ObjectiveState.COMPLETED
					objective["current"] = objective.get("target", 0)
					objective_completed.emit(quest.get("id", ""), objective.get("id", ""))

				_mark_quest_completed(quest.get("id", ""))
				_update_quest_progress(quest.get("id", ""))

	# Reinitialize active quests
	initialize_active_quests()

## Updates quest progress when stats are updated.
##
## Parameters:
##   stats: Updated player stats
func _on_stats_updated(stats: Dictionary) -> void:
	"""Updates quest progress when stats are updated."""
	# Check for stat-based quest objectives
	for quest in active_quests:
		var quest_id = quest.get("id", "")
		var objectives = get_quest_objectives(quest_id)

		for objective in objectives:
			if objective.get("id").begins_with("stat_"):
				var stat_name = objective.get("id").substr(5)
				var target_value = objective.get("target", 0)
				var current_value = stats.get("stats", {}).get(stat_name, 0)

				if current_value >= target_value:
					objective["state"] = ObjectiveState.COMPLETED
					objective["current"] = current_value
					objective_completed.emit(quest_id, objective.get("id"))

		_update_quest_progress(quest_id)

## Updates the progress for a specific quest.
##
## Parameters:
##   quest_id: ID of the quest to update
func _update_quest_progress(quest_id: String) -> void:
	"""Updates the progress percentage for a quest."""
	var objectives = get_quest_objectives(quest_id)
	if objectives.is_empty():
		return

	var total_objectives = objectives.size()
	var completed_objectives = 0

	for objective in objectives:
		if objective.get("state") == ObjectiveState.COMPLETED:
			completed_objectives += 1

	var progress = float(completed_objectives) / float(total_objectives)
	quest_updated.emit(quest_id, progress)

## Marks a quest as completed.
##
## Parameters:
##   quest_id: ID of the quest to mark as completed
func _mark_quest_completed(quest_id: String) -> void:
	"""Marks a quest as completed and moves it to completed list."""
	for i in range(active_quests.size() - 1, -1, -1):
		if active_quests[i].get("id") == quest_id:
			active_quests.remove_at(i)
			completed_quests.append(quest_id)
			break

# --- Progress Visualization ---

## Returns the progress path visualization data.
##
## Returns:
##   Dictionary: Progress path with stages and connections
func get_progress_path() -> Dictionary:
	"""Returns the progress path visualization."""
	var path_data = {
		"chapters": [],
		"current_position": {},
		"next_milestone": {}
	}

	if not campaign_manager:
		return path_data

	# Build chapter progression data
	for chapter in campaign_manager.campaigns_data.get("campaigns", []):
		var chapter_data = {
			"id": chapter.get("id", ""),
			"name": chapter.get("name", ""),
			"stages": [],
			"progress": campaign_manager.get_chapter_progress(chapter.get("id", ""))
		}

		var stages = chapter.get("stages", [])
		for stage_data in stages:
			var stage_id = stage_data.get("id", "")
			var stage_entry = {
				"id": stage_id,
				"name": stage_data.get("name", ""),
				"is_unlocked": campaign_manager.is_stage_unlocked(stage_id),
				"is_completed": campaign_manager.is_stage_completed(stage_id),
				"has_quest": _has_active_quest_for_stage(stage_id),
				"level_requirement": get_level_requirements(stage_id).get("level", 1)
			}

			chapter_data["stages"].append(stage_entry)

			# Track current position and next milestone
			if stage_entry["is_unlocked"] and not stage_entry["is_completed"]:
				if path_data["current_position"].is_empty():
					path_data["current_position"] = stage_entry

				if path_data["next_milestone"].is_empty():
					var reqs = get_level_requirements(stage_id)
					var player_level = player_stats_manager.get_level() if player_stats_manager else 1
					var req_level = reqs.get("level", 1)

					if player_level >= req_level:
						path_data["next_milestone"] = stage_entry

		path_data["chapters"].append(chapter_data)

	return path_data

## Checks if there's an active quest for a specific stage.
##
## Parameters:
##   stage_id: ID of the stage to check
##
## Returns:
##   bool: True if there's an active quest for this stage
func _has_active_quest_for_stage(stage_id: String) -> bool:
	"""Checks if there's an active quest for a specific stage."""
	for quest in active_quests:
		if quest.get("stage_id") == stage_id:
			return true
	return false

# --- Helper Functions ---

## Returns the XP required for a given level.
##
## Parameters:
##   level: Level to calculate XP for
##
## Returns:
##   int: Total XP required for the level
func _get_xp_for_level(level: int) -> int:
	"""Returns the XP required for a given level using the XP curve."""
	# Using standard XP curve: XP = base * (level^2) * multiplier
	# From StatAllocationManager: Level 1 = 0 XP, Level 2 = 100, Level 3 = 300, etc.
	match level:
		1: return 0
		2: return 100
		3: return 300
		4: return 600
		5: return 1000
		6: return 1500
		7: return 2100
		8: return 2800
		9: return 3600
		10: return 4500
		11: return 5500
		12: return 6600
		13: return 7800
		14: return 9100
		15: return 10500
		_: return 100 * level * level

## Checks if a level requirement is met.
##
## Parameters:
##   level_or_stage: Level number or stage ID to check
##
## Returns:
##   bool: True if requirement is met
func is_level_requirement_met(level_or_stage) -> bool:
	"""Checks if a level requirement is met."""
	var reqs = get_level_requirements(level_or_stage)
	if reqs.is_empty():
		return true

	var req_level = reqs.get("level", 1)
	var player_level = player_stats_manager.get_level() if player_stats_manager else 1

	return player_level >= req_level

## Saves progression data to disk.
func save_progression_data() -> void:
	"""Saves progression data to user://progression_data.json."""
	var save_data = {
		"active_quests": active_quests,
		"completed_quests": completed_quests,
		"quest_objectives": quest_objectives
	}

	var file = FileAccess.open("user://progression_data.json", FileAccess.WRITE)
	if file:
		var _err = file.store_string(JSON.stringify(save_data))
		file.close()

## Loads progression data from disk.
func load_progression_data() -> void:
	"""Loads progression data from user://progression_data.json."""
	var file = FileAccess.open("user://progression_data.json", FileAccess.READ)
	if file:
		var json_string = file.get_as_text()
		file.close()
		var json = JSON.new()
		var parse_result = json.parse(json_string)
		if parse_result == OK:
			var save_data = json.data
			active_quests = save_data.get("active_quests", [])
			completed_quests = save_data.get("completed_quests", [])
			quest_objectives = save_data.get("quest_objectives", {})

## Clears all progression data (for testing or reset).
func clear_progression_data() -> void:
	"""Clears all progression data."""
	active_quests.clear()
	completed_quests.clear()
	quest_objectives.clear()
	map_markers.clear()
	save_progression_data()
