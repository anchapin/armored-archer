## Encounter data definition for the 8-encounter campaign system.
## Difficulty 1 (Forest): goblin, scout, alpha boss
## Difficulty 2 (Cavern): golem, elemental, warlord boss
## Difficulty 3 (Sky): drake, frost_giant, ancient_guardian boss
##
extends Node

## All 8 encounters organized by difficulty tier
var encounters: Dictionary = {
	# --- DIFFICULTY 1: FOREST ---
	"forest_goblin": {
		"id": "forest_goblin",
		"name": "Forest Goblin",
		"biome": "forest",
		"difficulty": 1,
		"enemy": {
			"type": "goblin",
			"health": 15,
			"attack": 3,
			"defense": 1,
			"speed": 2
		},
		"loot": {
			"xp": 50,
			"gold": 25
		}
	},
	"forest_scout": {
		"id": "forest_scout",
		"name": "Forest Scout",
		"biome": "forest",
		"difficulty": 1,
		"enemy": {
			"type": "scout",
			"health": 20,
			"attack": 4,
			"defense": 2,
			"speed": 3
		},
		"loot": {
			"xp": 75,
			"gold": 40
		}
	},
	"forest_alpha": {
		"id": "forest_alpha",
		"name": "Forest Alpha (Boss)",
		"biome": "forest",
		"difficulty": 1,
		"is_boss": true,
		"enemy": {
			"type": "alpha_wolf",
			"health": 50,
			"attack": 6,
			"defense": 3,
			"speed": 4
		},
		"loot": {
			"xp": 150,
			"gold": 100
		}
	},
	# --- DIFFICULTY 2: CAVERN ---
	"cavern_golem": {
		"id": "cavern_golem",
		"name": "Cavern Golem",
		"biome": "cavern",
		"difficulty": 2,
		"enemy": {
			"type": "golem",
			"health": 40,
			"attack": 5,
			"defense": 4,
			"speed": 1
		},
		"loot": {
			"xp": 100,
			"gold": 60
		}
	},
	"cavern_elemental": {
		"id": "cavern_elemental",
		"name": "Cavern Elemental",
		"biome": "cavern",
		"difficulty": 2,
		"enemy": {
			"type": "elemental",
			"health": 35,
			"attack": 7,
			"defense": 2,
			"speed": 3
		},
		"loot": {
			"xp": 125,
			"gold": 75
		}
	},
	"cavern_warlord": {
		"id": "cavern_warlord",
		"name": "Cavern Warlord (Boss)",
		"biome": "cavern",
		"difficulty": 2,
		"is_boss": true,
		"enemy": {
			"type": "warlord",
			"health": 80,
			"attack": 9,
			"defense": 5,
			"speed": 2
		},
		"loot": {
			"xp": 250,
			"gold": 150
		}
	},
	# --- DIFFICULTY 3: SKY ---
	"sky_drake": {
		"id": "sky_drake",
		"name": "Sky Drake",
		"biome": "sky",
		"difficulty": 3,
		"enemy": {
			"type": "drake",
			"health": 60,
			"attack": 8,
			"defense": 3,
			"speed": 5
		},
		"loot": {
			"xp": 150,
			"gold": 90
		}
	},
	"frost_giant": {
		"id": "frost_giant",
		"name": "Frost Giant",
		"biome": "sky",
		"difficulty": 3,
		"enemy": {
			"type": "giant",
			"health": 70,
			"attack": 10,
			"defense": 6,
			"speed": 2
		},
		"loot": {
			"xp": 175,
			"gold": 110
		}
	},
	"ancient_guardian": {
		"id": "ancient_guardian",
		"name": "Ancient Guardian (Boss)",
		"biome": "sky",
		"difficulty": 3,
		"is_boss": true,
		"enemy": {
			"type": "guardian",
			"health": 120,
			"attack": 12,
			"defense": 8,
			"speed": 3
		},
		"loot": {
			"xp": 400,
			"gold": 250
		}
	}
}

func _ready() -> void:
	"""Initialize encounter data."""
	pass

func get_encounter(encounter_id: String) -> Dictionary:
	"""Returns encounter data for a given encounter ID.
	
	Parameters:
		encounter_id: ID of the encounter to retrieve
		
	Returns:
		Dictionary: Encounter data or empty dict if not found
	"""
	if encounter_id in encounters:
		return encounters[encounter_id].duplicate(true)
	push_warning("[EncounterData] Encounter not found: %s" % encounter_id)
	return {}

func get_all_encounters() -> Array:
	"""Returns array of all encounter IDs.
	
	Returns:
		Array: List of all encounter IDs
	"""
	return encounters.keys()

func get_encounters_by_difficulty(difficulty: int) -> Array:
	"""Returns all encounters for a given difficulty tier.
	
	Parameters:
		difficulty: Difficulty tier (1, 2, or 3)
		
	Returns:
		Array: List of encounter IDs at that difficulty
	"""
	var result: Array = []
	for encounter_id in encounters.keys():
		if encounters[encounter_id].get("difficulty") == difficulty:
			result.append(encounter_id)
	return result

func get_encounters_by_biome(biome: String) -> Array:
	"""Returns all encounters in a given biome.
	
	Parameters:
		biome: Biome name (forest, cavern, sky)
		
	Returns:
		Array: List of encounter IDs in that biome
	"""
	var result: Array = []
	for encounter_id in encounters.keys():
		if encounters[encounter_id].get("biome") == biome:
			result.append(encounter_id)
	return result

func is_boss_encounter(encounter_id: String) -> bool:
	"""Checks if an encounter is a boss encounter.

	Parameters:
		encounter_id: ID of the encounter

	Returns:
		bool: True if the encounter is a boss fight
	"""
	var encounter = get_encounter(encounter_id)
	return encounter.get("is_boss", false)

# --- Pacing & Variety Support ---
## Gets the encounter type for pacing classification.
##
## Parameters:
##   encounter_id: ID of the encounter
##
## Returns:
##   String: Encounter type (combat, exploration, narrative, puzzle)
func get_encounter_pacing_type(encounter_id: String) -> String:
	"""Gets the encounter type for pacing classification.

	Parameters:
		encounter_id: ID of the encounter

	Returns:
		String: Encounter type (combat, exploration, narrative, puzzle)
	"""
	var encounter = get_encounter(encounter_id)
	var biome = encounter.get("biome", "")
	var difficulty = encounter.get("difficulty", 1)
	var is_boss = encounter.get("is_boss", false)

	# Boss encounters are always combat
	if is_boss:
		return "combat"

	# Difficulty-based classification
	match difficulty:
		1:
			# Forest: Mix of combat and exploration
			if biome == "forest":
				# Randomly classify as exploration for variety
				if encounter_id in ["forest_scout"]:
					return "exploration"
		2:
			# Cavern: More combat, some puzzles
			if biome == "cavern":
				# Some cavern encounters can be puzzles
				if encounter_id in ["cavern_golem"]:
					return "puzzle"
		3:
			# Sky: Heavy combat
			if biome == "sky":
				return "combat"

	# Default to combat
	return "combat"

## Gets the intensity of an encounter for fatigue calculation.
##
## Parameters:
##   encounter_id: ID of the encounter
##
## Returns:
##   float: Intensity value (0.0 to 1.0)
func get_encounter_intensity(encounter_id: String) -> float:
	"""Gets the intensity of an encounter for fatigue calculation.

	Parameters:
		encounter_id: ID of the encounter

	Returns:
		float: Intensity value (0.0 to 1.0)
	"""
	var encounter = get_encounter(encounter_id)
	var difficulty = encounter.get("difficulty", 1)
	var is_boss = encounter.get("is_boss", false)

	var intensity: float = float(difficulty) / 3.0

	# Bosses are more intense
	if is_boss:
		intensity = min(intensity * 1.5, 1.0)

	return intensity
