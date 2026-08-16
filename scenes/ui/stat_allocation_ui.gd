extends Control

# --- Node References ---
@onready var level_label: Label = $VBoxContainer/StatsContainer/LevelContainer/LevelLabel
@onready var xp_label: Label = $VBoxContainer/StatsContainer/XPContainer/XPLabel
@onready var ability_points_label: Label = $VBoxContainer/AbilityPointsLabel

@onready var attack_value: Label = $VBoxContainer/StatsContainer/AttackContainer/AttackValue
@onready var attack_plus: Button = $VBoxContainer/StatsContainer/AttackContainer/AttackPlus
@onready var defense_value: Label = $VBoxContainer/StatsContainer/DefenseContainer/DefenseValue
@onready var defense_plus: Button = $VBoxContainer/StatsContainer/DefenseContainer/DefensePlus
@onready var dodge_value: Label = $VBoxContainer/StatsContainer/DodgeContainer/DodgeValue
@onready var dodge_plus: Button = $VBoxContainer/StatsContainer/DodgeContainer/DodgePlus
@onready var crit_rate_value: Label = $VBoxContainer/StatsContainer/CritRateContainer/CritRateValue
@onready var crit_rate_plus: Button = $VBoxContainer/StatsContainer/CritRateContainer/CritRatePlus

@onready var xp_progress_bar: ProgressBar = $VBoxContainer/XPProgressBar
@onready var back_button: Button = $VBoxContainer/BackButton
@onready var loading_indicator: Control = $LoadingIndicator

# --- Respec Section ---
@onready var respec_button: Button = $VBoxContainer/RespecButton
@onready var respec_cost_label: Label = $VBoxContainer/RespecContainer/RespecCostLabel
@onready var respec_cooldown_label: Label = $VBoxContainer/RespecContainer/RespecCooldownLabel
@onready var free_respec_label: Label = $VBoxContainer/RespecContainer/FreeRespecLabel

# --- Build Slots Section ---
@onready var build_slots_container: HBoxContainer = $VBoxContainer/BuildSlotsContainer
@onready var build_slot_1_button: Button = $VBoxContainer/BuildSlotsContainer/BuildSlot1
@onready var build_slot_2_button: Button = $VBoxContainer/BuildSlotsContainer/BuildSlot2
@onready var build_slot_3_button: Button = $VBoxContainer/BuildSlotsContainer/BuildSlot3
@onready var save_build_button: Button = $VBoxContainer/BuildSlotsContainer/SaveBuildButton
@onready var save_build_dialog: ConfirmationDialog = $SaveBuildDialog
@onready var build_name_input: LineEdit = $SaveBuildDialog/BuildNameInput

# --- Manager References ---
@onready var player_stats_manager: Node = get_node_or_null("/root/PlayerStatsManager")
@onready var stat_allocation_manager: Node = get_node_or_null("/root/StatAllocationManager")
@onready var store_manager: Node = get_node_or_null("/root/StoreManager")

# --- Stats State ---
var current_level: int = 1
var current_xp: int = 0
var current_ability_points: int = 0
var current_stats: Dictionary = {}

# --- Temp Allocation for Respec ---
var temp_allocation: Dictionary = {"attack": 10, "defense": 10, "dodge": 10, "crit_rate": 5}
var original_allocation: Dictionary = {}

# --- Build Slots Data ---
var saved_builds: Dictionary = {}

# --- Constants ---
const MAX_BUILD_SLOTS: int = 3

func _ready() -> void:
	# Show loading indicator while waiting for player stats
	if loading_indicator:
		loading_indicator.visible = true

	_setup_stat_allocation_manager()
	_setup_player_stats_manager()
	_setup_store_manager()
	_setup_button_connections()

	# Load initial data
	if stat_allocation_manager:
		saved_builds = stat_allocation_manager.get_all_builds()
		refresh_respec_ui()

	if player_stats_manager:
		if player_stats_manager.is_initialized:
			refresh_ui()
		else:
			await player_stats_manager.get_player_stats()
			refresh_ui()
	else:
		if loading_indicator:
			loading_indicator.visible = false

	_setup_build_slots()

func _setup_stat_allocation_manager() -> void:
	"""Sets up StatAllocationManager signal connections."""
	if stat_allocation_manager:
		stat_allocation_manager.respec_completed.connect(_on_respec_completed)
		stat_allocation_manager.build_saved.connect(_on_build_saved)
		stat_allocation_manager.build_loaded.connect(_on_build_loaded)
		stat_allocation_manager.builds_updated.connect(_on_builds_updated)
		stat_allocation_manager.respec_cooldown_remaining.connect(_on_respec_cooldown_remaining)

func _setup_player_stats_manager() -> void:
	"""Sets up PlayerStatsManager signal connections."""
	if player_stats_manager:
		player_stats_manager.stats_updated.connect(_on_stats_updated)
		player_stats_manager.level_up.connect(_on_level_up)
		player_stats_manager.xp_gained.connect(_on_xp_gained)
		player_stats_manager.stat_allocated.connect(_on_stat_allocated)
		player_stats_manager.stats_respec.connect(_on_stats_respec)
		player_stats_manager.build_saved.connect(_on_build_saved_remote)
		player_stats_manager.build_loaded.connect(_on_build_loaded_remote)
		player_stats_manager.builds_updated.connect(_on_builds_updated)

func _setup_store_manager() -> void:
	"""Sets up StoreManager signal connections for gem balance updates."""
	if store_manager:
		store_manager.currency_updated.connect(_on_currency_updated)

func _setup_button_connections() -> void:
	"""Sets up all button signal connections."""
	attack_plus.pressed.connect(_on_attack_plus_pressed)
	defense_plus.pressed.connect(_on_defense_plus_pressed)
	dodge_plus.pressed.connect(_on_dodge_plus_pressed)
	crit_rate_plus.pressed.connect(_on_crit_rate_plus_pressed)
	back_button.pressed.connect(_on_back_pressed)
	respec_button.pressed.connect(_on_respec_pressed)

	if save_build_button:
		save_build_button.pressed.connect(_on_save_build_pressed)

	if build_slot_1_button:
		build_slot_1_button.pressed.connect(func(): _on_build_slot_pressed(1))
	if build_slot_2_button:
		build_slot_2_button.pressed.connect(func(): _on_build_slot_pressed(2))
	if build_slot_3_button:
		build_slot_3_button.pressed.connect(func(): _on_build_slot_pressed(3))

	if save_build_dialog:
		save_build_dialog.confirmed.connect(_on_save_build_confirmed)

func _setup_build_slots() -> void:
	"""Sets up build slots UI."""
	_update_build_slots_ui()

func refresh_ui() -> void:
	"""Refreshes the UI with current player stats."""
	if not player_stats_manager:
		return

	# Hide loading indicator once data is loaded
	if loading_indicator:
		loading_indicator.visible = false

	current_level = player_stats_manager.get_level()
	current_xp = player_stats_manager.get_xp()
	current_ability_points = player_stats_manager.get_ability_points()
	current_stats = player_stats_manager.player_stats.get("stats", {})

	# Update temp allocation to match current
	temp_allocation = current_stats.duplicate()

	level_label.text = "Level: %d" % current_level
	xp_label.text = "XP: %d" % current_xp
	ability_points_label.text = "Ability Points: %d" % current_ability_points

	attack_value.text = str(current_stats.get("attack", 10))
	defense_value.text = str(current_stats.get("defense", 10))
	dodge_value.text = str(current_stats.get("dodge", 10))
	crit_rate_value.text = str(current_stats.get("crit_rate", 5))

	_update_button_states()
	_update_xp_progress()
	refresh_respec_ui()
	_update_build_slots_ui()

func refresh_respec_ui() -> void:
	"""Refreshes the respec cost and cooldown display."""
	if not stat_allocation_manager:
		return

	var cost: int = stat_allocation_manager.get_respec_cost(stat_allocation_manager.has_free_respec())
	var cooldown_remaining: int = stat_allocation_manager.get_respec_cooldown_remaining()

	if cost == 0 and stat_allocation_manager.has_free_respec():
		respec_cost_label.text = "Free Respec Available!"
		respec_cost_label.modulate = Color.GREEN
		free_respec_label.visible = true
		free_respec_label.text = "%d free respec remaining this season" % (stat_allocation_manager.FREE_RESPEC_PER_SEASON - stat_allocation_manager.free_respecs_used_this_season)
	else:
		respec_cost_label.text = "Cost: %d Gems" % cost
		respec_cost_label.modulate = Color.WHITE
		free_respec_label.visible = false

	if cooldown_remaining > 0:
		respec_cooldown_label.text = "Cooldown: %s" % stat_allocation_manager.format_cooldown_time(cooldown_remaining)
		respec_button.disabled = true
		respec_cooldown_label.visible = true
	else:
		respec_cooldown_label.visible = false
		respec_button.disabled = false

func _update_button_states() -> void:
	"""Updates button enabled/disabled states based on ability points."""
	attack_plus.disabled = current_ability_points <= 0
	defense_plus.disabled = current_ability_points <= 0
	dodge_plus.disabled = current_ability_points <= 0
	crit_rate_plus.disabled = current_ability_points <= 0

func _update_xp_progress() -> void:
	"""Updates XP progress bar."""
	var xp_for_current_level: int = _get_xp_for_level(current_level)
	var xp_for_next_level: int = _get_xp_for_level(current_level + 1)
	var xp_in_current_level: int = current_xp - xp_for_current_level
	var xp_needed_for_next_level: int = xp_for_next_level - xp_for_current_level

	var progress: float = float(xp_in_current_level) / float(xp_needed_for_next_level)
	xp_progress_bar.value = progress * 100.0

func _update_build_slots_ui() -> void:
	"""Updates build slots button display."""
	if build_slot_1_button:
		_update_build_slot_button(build_slot_1_button, 1)
	if build_slot_2_button:
		_update_build_slot_button(build_slot_2_button, 2)
	if build_slot_3_button:
		_update_build_slot_button(build_slot_3_button, 3)

func _update_build_slot_button(button: Button, slot: int) -> void:
	"""Updates individual build slot button."""
	if saved_builds.has(slot):
		var build_data: Dictionary = saved_builds[slot]
		button.text = build_data.get("name", "Build %d" % slot)
		button.modulate = Color.WHITE
	else:
		button.text = "Slot %d (Empty)" % slot
		button.modulate = Color.GRAY

func _get_xp_for_level(level: int) -> int:
	"""Calculates total XP needed to reach a level."""
	var base_xp: int = 100
	var growth_factor: float = 1.5
	var total_xp: int = 0
	var xp_for_level: int = base_xp

	for i in range(1, level):
		total_xp += xp_for_level
		xp_for_level = int(xp_for_level * growth_factor)

	return total_xp

# --- Button Handlers ---

func _on_attack_plus_pressed() -> void:
	if player_stats_manager and current_ability_points > 0:
		player_stats_manager.allocate_stat("attack", 1)

func _on_defense_plus_pressed() -> void:
	if player_stats_manager and current_ability_points > 0:
		player_stats_manager.allocate_stat("defense", 1)

func _on_dodge_plus_pressed() -> void:
	if player_stats_manager and current_ability_points > 0:
		player_stats_manager.allocate_stat("dodge", 1)

func _on_crit_rate_plus_pressed() -> void:
	if player_stats_manager and current_ability_points > 0:
		player_stats_manager.allocate_stat("crit_rate", 1)

func _on_respec_pressed() -> void:
	"""Opens respec confirmation dialog."""
	if not stat_allocation_manager or not player_stats_manager:
		return

	var cooldown_remaining: int = stat_allocation_manager.get_respec_cooldown_remaining()
	if cooldown_remaining > 0:
		push_warning("Respec is on cooldown for %d more seconds" % cooldown_remaining)
		return

	var cost: int = stat_allocation_manager.get_respec_cost(stat_allocation_manager.has_free_respec())
	var gem_balance: int = 0
	if store_manager:
		gem_balance = store_manager.get_gems()

	if cost > 0 and gem_balance < cost:
		push_error("Not enough gems for respec. Cost: %d, Balance: %d" % [cost, gem_balance])
		return

	# Store original allocation for rollback
	original_allocation = current_stats.duplicate()

	# Show confirmation dialog (using a simple confirmation for now)
	var dialog = ConfirmationDialog.new()
	dialog.title = "Respec Stats"
	dialog.dialog_text = "Reset and redistribute all stat points?\n\nCost: %d Gems\nCurrent stats will be refunded." % cost
	dialog.confirmed.connect(_execute_respec.bind(stat_allocation_manager.has_free_respec()))
	get_tree().current_scene.add_child(dialog)
	dialog.popup_centered()

func _execute_respec(use_free_respec: bool) -> void:
	"""Executes the respec operation."""
	if not stat_allocation_manager:
		return

	var new_allocation: Dictionary = {
		"attack": 10,
		"defense": 10,
		"dodge": 10,
		"crit_rate": 5
	}

	# Calculate available points from current level
	var total_points: int = (current_level - 1) * 1  # 1 point per level
	var base_points: int = 35  # Base stats: 10+10+10+5
	var allocatable_points: int = total_points

	# Distribute allocatable points evenly for now
	var points_per_stat: int = allocatable_points / 4
	var remainder: int = allocatable_points % 4

	new_allocation["attack"] = 10 + points_per_stat + (1 if remainder > 0 else 0)
	new_allocation["defense"] = 10 + points_per_stat + (1 if remainder > 1 else 0)
	new_allocation["dodge"] = 10 + points_per_stat + (1 if remainder > 2 else 0)
	new_allocation["crit_rate"] = 5 + points_per_stat

	stat_allocation_manager.respec_stats_server_side(new_allocation)

func _on_save_build_pressed() -> void:
	"""Opens build save dialog."""
	if save_build_dialog:
		if build_name_input:
			build_name_input.text = ""
		save_build_dialog.popup_centered()

func _on_save_build_confirmed() -> void:
	"""Saves the current build."""
	if not stat_allocation_manager:
		return

	var build_name: String = build_name_input.text if build_name_input else "My Build"
	if build_name.is_empty():
		build_name = "Build %d" % (saved_builds.size() + 1)

	# Find empty slot
	var empty_slot: int = -1
	for slot in range(1, MAX_BUILD_SLOTS + 1):
		if not saved_builds.has(slot):
			empty_slot = slot
			break

	if empty_slot == -1:
		# All slots full, default to slot 1
		empty_slot = 1

	stat_allocation_manager.save_build(empty_slot, build_name)
	save_build_dialog.visible = false

func _on_build_slot_pressed(slot: int) -> void:
	"""Handles build slot button press."""
	if not stat_allocation_manager:
		return

	if saved_builds.has(slot):
		var build_data: Dictionary = saved_builds[slot]
		var dialog = ConfirmationDialog.new()
		dialog.title = "Load Build"
		dialog.dialog_text = "Load '%s'?\n\nStats: %s" % [build_data.get("name", "Build"), str(build_data.get("stats", {}))]
		dialog.confirmed.connect(func(): stat_allocation_manager.load_build(slot))
		get_tree().current_scene.add_child(dialog)
		dialog.popup_centered()
	else:
		# Empty slot, prompt to save
		_on_save_build_pressed()

# --- Signal Handlers ---

func _on_stats_updated(_stats: Dictionary) -> void:
	refresh_ui()

func _on_level_up(new_level: int, ability_points_gained: int) -> void:
	show_level_up_effect(new_level, ability_points_gained)

func _on_xp_gained(amount: int, _total_xp: int) -> void:
	show_xp_gained_effect(amount)

func _on_stat_allocated(stat_name: String, amount: int) -> void:
	show_stat_allocated_effect(stat_name, amount)

func _on_stats_respec(new_stats: Dictionary, _cost_paid: int) -> void:
	show_respec_effect(new_stats)
	refresh_respec_ui()

func _on_respec_completed(new_stats: Dictionary, _cost_paid: int) -> void:
	show_respec_effect(new_stats)
	refresh_ui()

func _on_build_saved(build_slot: int, build_data: Dictionary) -> void:
	show_build_saved_effect(build_slot, build_data)

func _on_build_saved_remote(build_slot: int, build_data: Dictionary) -> void:
	show_build_saved_effect(build_slot, build_data)

func _on_build_loaded(build_slot: int, build_data: Dictionary) -> void:
	show_build_loaded_effect(build_slot, build_data)

func _on_build_loaded_remote(build_slot: int, build_data: Dictionary) -> void:
	show_build_loaded_effect(build_slot, build_data)

func _on_builds_updated(builds: Dictionary) -> void:
	saved_builds = builds
	_update_build_slots_ui()

func _on_respec_cooldown_remaining(seconds: int) -> void:
	if respec_cooldown_label:
		if seconds > 0:
			respec_cooldown_label.text = "Cooldown: %s" % stat_allocation_manager.format_cooldown_time(seconds)
			respec_button.disabled = true
			respec_cooldown_label.visible = true
		else:
			respec_cooldown_label.visible = false
			respec_button.disabled = false

func _on_currency_updated(_gems: int, _coins: int) -> void:
	refresh_respec_ui()

func _on_back_pressed() -> void:
	queue_free()

# --- Visual Effects ---

func show_level_up_effect(new_level: int, ability_points_gained: int) -> void:
	var tween = create_tween()
	var _t1 = tween.tween_property(ability_points_label, "modulate", Color.YELLOW, 0.2)
	var _t2 = tween.tween_property(ability_points_label, "modulate", Color.WHITE, 0.2)

func show_xp_gained_effect(amount: int) -> void:
	var tween = create_tween()
	var _t1 = tween.tween_property(xp_label, "modulate", Color.GREEN, 0.2)
	var _t2 = tween.tween_property(xp_label, "modulate", Color.WHITE, 0.2)

func show_stat_allocated_effect(_stat_name: String, _amount: int) -> void:
	pass

func show_respec_effect(new_stats: Dictionary) -> void:
	var tween = create_tween()
	var _t1 = tween.tween_property(respec_button, "modulate", Color.CYAN, 0.2)
	var _t2 = tween.tween_property(respec_button, "modulate", Color.WHITE, 0.2)

func show_build_saved_effect(build_slot: int, build_data: Dictionary) -> void:
	var build_name: String = build_data.get("name", "Build")
	print("Build saved to slot %d: %s" % [build_slot, build_name])

func show_build_loaded_effect(build_slot: int, build_data: Dictionary) -> void:
	var build_name: String = build_data.get("name", "Build")
	print("Build loaded from slot %d: %s" % [build_slot, build_name])

func _exit_tree() -> void:
	"""Disconnects signals to prevent memory leaks."""
	if player_stats_manager:
		if player_stats_manager.stats_updated.is_connected(_on_stats_updated):
			player_stats_manager.stats_updated.disconnect(_on_stats_updated)
		if player_stats_manager.level_up.is_connected(_on_level_up):
			player_stats_manager.level_up.disconnect(_on_level_up)
		if player_stats_manager.xp_gained.is_connected(_on_xp_gained):
			player_stats_manager.xp_gained.disconnect(_on_xp_gained)
		if player_stats_manager.stat_allocated.is_connected(_on_stat_allocated):
			player_stats_manager.stat_allocated.disconnect(_on_stat_allocated)

	if stat_allocation_manager:
		if stat_allocation_manager.respec_completed.is_connected(_on_respec_completed):
			stat_allocation_manager.respec_completed.disconnect(_on_respec_completed)
		if stat_allocation_manager.build_saved.is_connected(_on_build_saved):
			stat_allocation_manager.build_saved.disconnect(_on_build_saved)
		if stat_allocation_manager.build_loaded.is_connected(_on_build_loaded):
			stat_allocation_manager.build_loaded.disconnect(_on_build_loaded)
		if stat_allocation_manager.builds_updated.is_connected(_on_builds_updated):
			stat_allocation_manager.builds_updated.disconnect(_on_builds_updated)
