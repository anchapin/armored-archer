## Manages encounter-based campaign progression.
## Tracks current encounter, encounters completed, difficulty unlocked, player resources.
## Emits signals for progression updates and milestone achievements.
##
extends Node

# --- Encounter State ---
var current_encounter: String = ""
var encounters_completed: Array = []
var current_difficulty_unlocked: int = 1
var encounters: Dictionary = {}

# --- Player Resources ---
var player_xp: int = 0
var player_gold: int = 0

# --- Signals ---
signal encounter_started(encounter_id: String)
signal victory(encounter_id: String, xp_gained: int, gold_gained: int)
signal difficulty_unlocked(difficulty: int)
signal progression_updated()

func _ready() -> void:
	"""Initialize CampaignManager with all 8 encounters."""
	# Load encounters from EncounterData
	if EncounterData:
		var all_encounter_ids = EncounterData.get_all_encounters()
		for encounter_id in all_encounter_ids:
			encounters[encounter_id] = EncounterData.get_encounter(encounter_id)
	
	print("[CampaignManager] Initialized with %d encounters" % encounters.size())
	
	# Load saved progress
	load_progress()
	
	# Initialize first encounter if none set
	if current_encounter.is_empty() and not encounters.is_empty():
		current_encounter = EncounterData.get_encounters_by_difficulty(1)[0]

func start_encounter(encounter_id: String) -> void:
	"""Starts an encounter.
	
	Parameters:
		encounter_id: ID of the encounter to start
	"""
	if not encounter_id in encounters:
		push_error("[CampaignManager] Unknown encounter: %s" % encounter_id)
		return
	
	var encounter_data = encounters[encounter_id]
	if not can_start_encounter(encounter_id):
		push_warning("[CampaignManager] Cannot start locked encounter: %s" % encounter_id)
		return
	
	current_encounter = encounter_id
	encounter_started.emit(encounter_id)
	print("[CampaignManager] Started encounter: %s" % encounter_data.get("name", encounter_id))

func can_start_encounter(encounter_id: String) -> bool:
	"""Checks if an encounter can be started.
	
	Parameters:
		encounter_id: ID of the encounter to check
		
	Returns:
		bool: True if encounter is unlocked and available
	"""
	if not encounter_id in encounters:
		return false
	
	var encounter = encounters[encounter_id]
	var required_difficulty = encounter.get("difficulty", 1)
	
	# Can start if difficulty is unlocked
	return required_difficulty <= current_difficulty_unlocked

func mark_victory(encounter_id: String) -> void:
	"""Marks an encounter as completed with victory.
	
	Parameters:
		encounter_id: ID of the completed encounter
	"""
	if not encounter_id in encounters:
		push_error("[CampaignManager] Unknown encounter: %s" % encounter_id)
		return
	
	if encounter_id in encounters_completed:
		print("[CampaignManager] Encounter already completed: %s" % encounter_id)
		return
	
	var encounter_data = encounters[encounter_id]
	var xp_gained = encounter_data.get("loot", {}).get("xp", 0)
	var gold_gained = encounter_data.get("loot", {}).get("gold", 0)
	
	encounters_completed.append(encounter_id)
	player_xp += xp_gained
	player_gold += gold_gained
	
	victory.emit(encounter_id, xp_gained, gold_gained)
	print("[CampaignManager] Victory: %s | XP: %d | Gold: %d" % [encounter_data.get("name", encounter_id), xp_gained, gold_gained])
	
	# Check if should unlock next difficulty
	_check_difficulty_unlock(encounter_id)
	
	progression_updated.emit()
	save_progress()

func _check_difficulty_unlock(completed_encounter_id: String) -> void:
	"""Checks if completing an encounter unlocks the next difficulty.
	
	Parameters:
		completed_encounter_id: The encounter that was just completed
	"""
	var current_difficulty = encounters[completed_encounter_id].get("difficulty", 1)
	
	# If this was a boss encounter and is the final boss of current difficulty
	if encounters[completed_encounter_id].get("is_boss", false):
		if current_difficulty == current_difficulty_unlocked and current_difficulty < 3:
			# Check if there's a next difficulty available
			var next_difficulty_encounters = EncounterData.get_encounters_by_difficulty(current_difficulty + 1)
			if not next_difficulty_encounters.is_empty():
				current_difficulty_unlocked = current_difficulty + 1
				difficulty_unlocked.emit(current_difficulty + 1)
				print("[CampaignManager] Difficulty unlocked: %d" % (current_difficulty + 1))

func get_next_unlocked() -> String:
	"""Gets the next unlocked encounter that hasn't been completed.
	
	Returns:
		String: Encounter ID of next available encounter, or empty string if all completed
	"""
	# Try to get next encounter in current difficulty
	var diff_encounters = EncounterData.get_encounters_by_difficulty(current_difficulty_unlocked)
	
	for encounter_id in diff_encounters:
		if not encounter_id in encounters_completed:
			return encounter_id
	
	# If all in current difficulty are done and next difficulty unlocked, return first of next
	if current_difficulty_unlocked < 3:
		var next_difficulty_encounters = EncounterData.get_encounters_by_difficulty(current_difficulty_unlocked + 1)
		if not next_difficulty_encounters.is_empty():
			return next_difficulty_encounters[0]
	
	return ""

func reset() -> void:
	"""Resets all campaign progress."""
	current_encounter = ""
	encounters_completed.clear()
	current_difficulty_unlocked = 1
	player_xp = 0
	player_gold = 0
	
	if not encounters.is_empty():
		current_encounter = EncounterData.get_encounters_by_difficulty(1)[0]
	
	print("[CampaignManager] Campaign reset")
	progression_updated.emit()
	save_progress()

func get_encounter(encounter_id: String) -> Dictionary:
	"""Gets encounter data.
	
	Parameters:
		encounter_id: ID of the encounter
		
	Returns:
		Dictionary: Encounter data
	"""
	return encounters.get(encounter_id, {})

func is_encounter_completed(encounter_id: String) -> bool:
	"""Checks if an encounter has been completed.
	
	Parameters:
		encounter_id: ID of the encounter
		
	Returns:
		bool: True if encounter is completed
	"""
	return encounter_id in encounters_completed

func get_completion_percent() -> float:
	"""Gets overall campaign completion percentage.
	
	Returns:
		float: Percentage (0.0 to 1.0)
	"""
	if encounters.is_empty():
		return 0.0
	return float(encounters_completed.size()) / float(encounters.size())

func save_progress() -> void:
	"""Saves campaign progress to user://encounter_progress.json."""
	var save_data = {
		"current_encounter": current_encounter,
		"encounters_completed": encounters_completed,
		"current_difficulty_unlocked": current_difficulty_unlocked,
		"player_xp": player_xp,
		"player_gold": player_gold
	}
	var file = FileAccess.open("user://encounter_progress.json", FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(save_data))
		file.close()
		print("[CampaignManager] Progress saved")

func load_progress() -> void:
	"""Loads campaign progress from user://encounter_progress.json."""
	var file = FileAccess.open("user://encounter_progress.json", FileAccess.READ)
	if file:
		var json_string = file.get_as_text()
		file.close()
		var json = JSON.new()
		var parse_result = json.parse(json_string)
		if parse_result == OK:
			var save_data = json.data
			current_encounter = save_data.get("current_encounter", "")
			encounters_completed = save_data.get("encounters_completed", [])
			current_difficulty_unlocked = save_data.get("current_difficulty_unlocked", 1)
			player_xp = save_data.get("player_xp", 0)
			player_gold = save_data.get("player_gold", 0)
			print("[CampaignManager] Progress loaded")
		else:
			print("[CampaignManager] No previous progress found, starting fresh")
	else:
		print("[CampaignManager] No previous progress found, starting fresh")
