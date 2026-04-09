## Boss Manager autoload for boss encounter state and phase management.
## Manages boss phases, special attacks, and loot tables.
##
## Usage:
## - Call start_boss_encounter() to begin boss fight
## - BossManager tracks phase transitions at health thresholds
## - Special attacks are managed with cooldowns
## - Boss drops Epic/Legendary gear on defeat
##
## Signals:
## - boss_phase_changed(boss_type: String, new_phase: int): Emitted when phase changes
## - boss_defeated(boss_type: String, loot: Array): Emitted when boss is defeated
## - special_attack_cast(boss_type: String, attack_name: String): Emitted on special attack

extends Node

# --- Boss Types ---
enum BossType {
	GUARDIAN,   # Stone Guardian - defense-heavy
	WARLOCK,    # Shadow Warlock - ranged spells
	TITAN       # Forest Titan - melee brute
}

# --- Boss Phase System ---
var boss_phases: Dictionary = {
	BossType.GUARDIAN: {
		"phases": [100, 75, 50, 0],  # Health thresholds
		"special_attacks": ["ground_slam", "shield_bash"]
	},
	BossType.WARLOCK: {
		"phases": [100, 75, 50, 0],
		"special_attacks": ["shadow_bolt", "teleport", "summon_minions"]
	},
	BossType.TITAN: {
		"phases": [100, 75, 50, 0],
		"special_attacks": ["stomp", "roar", "charge"]
	}
}

# --- Special Attack Configuration ---
var special_attacks: Dictionary = {
	"ground_slam": {"damage": 30, "cooldown": 5.0, "aoe_radius": 100.0},
	"shield_bash": {"damage": 20, "cooldown": 4.0, "stun_duration": 1.5},
	"shadow_bolt": {"damage": 25, "cooldown": 3.0, "projectile_speed": 300.0},
	"teleport": {"damage": 0, "cooldown": 6.0, "range": 300.0},
	"summon_minions": {"damage": 0, "cooldown": 10.0, "minion_count": 2},
	"stomp": {"damage": 25, "cooldown": 4.5, "stun_duration": 1.0},
	"roar": {"damage": 0, "cooldown": 8.0, "fear_duration": 2.0},
	"charge": {"damage": 35, "cooldown": 6.0, "charge_speed": 400.0}
}

# --- Boss Loot Tables ---
var boss_loot_tables: Dictionary = {
	BossType.GUARDIAN: {
		"guaranteed_drop": {"type": "armor", "rarity": "legendary", "stat_bonus": "+defense"},
		"epic_chance": 0.3,
		"common_chance": 0.4,
		"gold_reward": 500
	},
	BossType.WARLOCK: {
		"guaranteed_drop": {"type": "bow", "rarity": "legendary", "stat_bonus": "+attack"},
		"epic_chance": 0.4,
		"common_chance": 0.3,
		"gold_reward": 600
	},
	BossType.TITAN: {
		"guaranteed_drop": {"type": "amulet", "rarity": "legendary", "stat_bonus": "+health"},
		"epic_chance": 0.35,
		"common_chance": 0.35,
		"gold_reward": 550
	}
}

# --- Encounter State ---
var _current_boss_type: BossType = BossType.GUARDIAN
var _current_phase: int = 0
var _current_health: int = 0
var _max_health: int = 0
var _encounter_active: bool = false
var _special_attack_cooldowns: Dictionary = {}
var _player_reference: Node2D

# --- UI References ---
var _boss_health_bar: ProgressBar
var _boss_phase_label: Label

# --- Signals ---
signal boss_phase_changed(boss_type: String, new_phase: int)
signal boss_defeated(boss_type: String, loot: Array)
signal special_attack_cast(boss_type: String, attack_name: String)

# --- Manager References ---
var _gear_manager: Node
var _enemy_ai_manager: Node

# --- Initialization ---
func _ready() -> void:
	_gear_manager = get_node_or_null("/root/GearManager")
	_enemy_ai_manager = get_node_or_null("/root/EnemyAIManager")

	# Find boss UI elements
	_boss_health_bar = get_tree().get_first_node_in_group("BossHealthBar")
	_boss_phase_label = get_tree().get_first_node_in_group("BossPhaseLabel")

# --- Public API ---

## Start a boss encounter
##
## Parameters:
##   boss_type: BossType enum value
##   player: Player character reference
func start_boss_encounter(boss_type: BossType, player: Node2D) -> void:
	_current_boss_type = boss_type
	_current_phase = 0
	_encounter_active = true
	_player_reference = player

	# Initialize special attack cooldowns
	_special_attack_cooldowns = {}
	var phase_data = boss_phases[boss_type]
	for attack in phase_data.special_attacks:
		_special_attack_cooldowns[attack] = 0.0

	# Setup boss UI
	_setup_boss_ui()

## End a boss encounter with rewards
##
## Parameters:
##   defeated: True if player won, False if player fled/died
func end_boss_encounter(defeated: bool = true) -> void:
	if not defeated:
		_encounter_active = false
		return

	# Generate loot
	var loot = roll_boss_loot(_current_boss_type)

	# Emit defeat signal
	var boss_name = _get_boss_name(_current_boss_type)
	boss_defeated.emit(boss_name, loot)

	# Clear encounter state
	_encounter_active = false

	# Clear boss UI
	if _boss_health_bar:
		_boss_health_bar.value = 0
	if _boss_phase_label:
		_boss_phase_label.text = ""

## Check for phase transition based on current health
##
## Parameters:
##   current_health: Boss's current health
##   max_health: Boss's maximum health
##
## Returns:
##   int: New phase number (0-3)
func check_phase_transition(current_health: int, max_health: int) -> int:
	if max_health == 0:
		return 0

	var health_ratio = float(current_health) / float(max_health)
	var new_phase: int = 0

	var phase_data = boss_phases[_current_boss_type]
	var phases = phase_data.phases

	# Find current phase based on health
	for i in range(phases.size() - 1):
		if health_ratio >= float(phases[i + 1]) / 100.0:
			new_phase = i
			break

	# Trigger phase change if needed
	if new_phase != _current_phase:
		trigger_phase_change(new_phase)

	return _current_phase

## Trigger a phase change
##
## Parameters:
##   new_phase: Phase number to transition to
func trigger_phase_change(new_phase: int) -> void:
	_current_phase = new_phase

	# Apply phase bonuses
	_apply_phase_bonuses(new_phase)

	# Emit signal
	var boss_name = _get_boss_name(_current_boss_type)
	boss_phase_changed.emit(boss_name, new_phase)

	# Update UI
	_update_boss_ui()

## Get special attack for current phase
##
## Returns:
##   Dictionary: Attack data with damage, cooldown, etc.
func get_special_attack() -> Dictionary:
	var phase_data = boss_phases[_current_boss_type]
	var available_attacks = phase_data.special_attacks

	# Select random available attack
	var attack_name = available_attacks.pick_random()

	# Check cooldown
	if _special_attack_cooldowns.has(attack_name):
		if _special_attack_cooldowns[attack_name] > 0:
			return {}  # Attack on cooldown

	# Update cooldown
	var attack_data = special_attacks[attack_name]
	_special_attack_cooldowns[attack_name] = attack_data.cooldown

	# Emit signal
	var boss_name = _get_boss_name(_current_boss_type)
	special_attack_cast.emit(boss_name, attack_name)

	return attack_data

## Update special attack cooldowns
##
## Parameters:
##   delta: Time delta
func update_attack_cooldowns(delta: float) -> void:
	for attack in _special_attack_cooldowns:
		if _special_attack_cooldowns[attack] > 0:
			_special_attack_cooldowns[attack] -= delta
			_special_attack_cooldowns[attack] = max(0.0, _special_attack_cooldowns[attack])

## Roll boss loot drops
##
## Parameters:
##   boss_type: BossType enum value
##
## Returns:
##   Array: List of loot items
func roll_boss_loot(boss_type: BossType) -> Array:
	var loot = []

	if not boss_loot_tables.has(boss_type):
		return loot

	var loot_table = boss_loot_tables[boss_type]

	# Guaranteed drop
	loot.append(loot_table.guaranteed_drop)

	# Epic drop chance
	if randf() < loot_table.epic_chance:
		loot.append(_generate_epic_drop(boss_type))
	# Common drop chance
	elif randf() < loot_table.common_chance:
		loot.append(_generate_common_drop(boss_type))

	# Gold reward
	loot.append({"type": "gold", "amount": loot_table.gold_reward})

	return loot

## Get current boss phase
##
## Returns:
##   int: Current phase number (0-3)
func get_current_phase() -> int:
	return _current_phase

## Get current boss type
##
## Returns:
##   BossType: Current boss type
func get_current_boss_type() -> BossType:
	return _current_boss_type

## Check if encounter is active
##
## Returns:
##   bool: True if boss encounter is in progress
func is_encounter_active() -> bool:
	return _encounter_active

# --- Private Methods ---

## Setup boss UI elements
func _setup_boss_ui() -> void:
	if _boss_health_bar:
		_boss_health_bar.max_value = 100
		_boss_health_bar.value = 100

	if _boss_phase_label:
		_boss_phase_label.text = "Phase 1"

## Update boss UI with current state
func _update_boss_ui() -> void:
	if _boss_health_bar and _max_health > 0:
		var health_ratio = float(_current_health) / float(_max_health)
		_boss_health_bar.value = health_ratio * 100

	if _boss_phase_label:
		_boss_phase_label.text = "Phase %d" % (_current_phase + 1)

## Apply phase-specific bonuses to boss
##
## Parameters:
##   phase: Current phase number
func _apply_phase_bonuses(phase: int) -> void:
	# Phase 1: Normal stats
	# Phase 2: +10% damage
	# Phase 3: +20% damage, +10% speed

	var damage_multiplier: float = 1.0
	var speed_multiplier: float = 1.0

	match phase:
		1:
			damage_multiplier = 1.1
		2:
			damage_multiplier = 1.2
			speed_multiplier = 1.1

	# Apply bonuses via EnemyAIManager
	if _enemy_ai_manager and _enemy_ai_manager.has_method("apply_boss_damage_multiplier"):
		_enemy_ai_manager.apply_boss_damage_multiplier(damage_multiplier)

## Get boss name for display
##
## Parameters:
##   boss_type: BossType enum value
##
## Returns:
##   String: Boss name
func _get_boss_name(boss_type: BossType) -> String:
	match boss_type:
		BossType.GUARDIAN:
			return "Stone Guardian"
		BossType.WARLOCK:
			return "Shadow Warlock"
		BossType.TITAN:
			return "Forest Titan"
		_:
			return "Unknown Boss"

## Generate Epic drop
##
## Parameters:
##   boss_type: BossType enum value
##
## Returns:
##   Dictionary: Epic loot item
func _generate_epic_drop(boss_type: BossType) -> Dictionary:
	var types = ["helm", "armor", "bow", "arrow", "amulet"]
	var selected_type = types.pick_random()

	return {
		"type": selected_type,
		"rarity": "epic",
		"stat_bonus": "+random"
	}

## Generate Common drop
##
## Parameters:
##   boss_type: BossType enum value
##
## Returns:
##   Dictionary: Common loot item
func _generate_common_drop(boss_type: BossType) -> Dictionary:
	var types = ["potion", "scroll", "material"]
	var selected_type = types.pick_random()

	return {
		"type": selected_type,
		"rarity": "common"
	}
