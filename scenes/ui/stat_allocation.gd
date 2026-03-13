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

# --- PlayerStatsManager Reference ---
@onready var player_stats_manager: Node = get_node_or_null("/root/PlayerStatsManager")

# --- Stats State ---
var current_level: int = 1
var current_xp: int = 0
var current_ability_points: int = 0
var current_stats: Dictionary = {}

func _ready() -> void:
	if player_stats_manager:
		player_stats_manager.stats_updated.connect(_on_stats_updated)
		player_stats_manager.level_up.connect(_on_level_up)
		player_stats_manager.xp_gained.connect(_on_xp_gained)
		player_stats_manager.stat_allocated.connect(_on_stat_allocated)

		if player_stats_manager.is_initialized:
			refresh_ui()
		else:
			await player_stats_manager.get_player_stats()

	_setup_button_connections()

func _setup_button_connections() -> void:
	attack_plus.pressed.connect(_on_attack_plus_pressed)
	defense_plus.pressed.connect(_on_defense_plus_pressed)
	dodge_plus.pressed.connect(_on_dodge_plus_pressed)
	crit_rate_plus.pressed.connect(_on_crit_rate_plus_pressed)
	back_button.pressed.connect(_on_back_pressed)

func refresh_ui() -> void:
	if not player_stats_manager:
		return

	current_level = player_stats_manager.get_level()
	current_xp = player_stats_manager.get_xp()
	current_ability_points = player_stats_manager.get_ability_points()
	current_stats = player_stats_manager.player_stats.get("stats", {})

	level_label.text = "Level: %d" % current_level
	xp_label.text = "XP: %d" % current_xp
	ability_points_label.text = "Ability Points: %d" % current_ability_points

	attack_value.text = str(current_stats.get("attack", 10))
	defense_value.text = str(current_stats.get("defense", 10))
	dodge_value.text = str(current_stats.get("dodge", 10))
	crit_rate_value.text = str(current_stats.get("crit_rate", 5))

	_update_button_states()
	_update_xp_progress()

func _update_button_states() -> void:
	attack_plus.disabled = current_ability_points <= 0
	defense_plus.disabled = current_ability_points <= 0
	dodge_plus.disabled = current_ability_points <= 0
	crit_rate_plus.disabled = current_ability_points <= 0

func _update_xp_progress() -> void:
	var xp_for_current_level: int = _get_xp_for_level(current_level)
	var xp_for_next_level: int = _get_xp_for_level(current_level + 1)
	var xp_in_current_level: int = current_xp - xp_for_current_level
	var xp_needed_for_next_level: int = xp_for_next_level - xp_for_current_level

	var progress: float = float(xp_in_current_level) / float(xp_needed_for_next_level)
	xp_progress_bar.value = progress * 100.0

func _get_xp_for_level(level: int) -> int:
	var base_xp: int = 100
	var growth_factor: float = 1.5
	var total_xp: int = 0
	var xp_for_level: int = base_xp

	for i in range(1, level):
		total_xp += xp_for_level
		xp_for_level = int(xp_for_level * growth_factor)

	return total_xp

func _on_stats_updated( _stats: Dictionary) -> void:
	refresh_ui()

func _on_level_up( _new_level: int, _ability_points_gained: int) -> void:
	show_level_up_effect(new_level, ability_points_gained)

func _on_xp_gained(amount: int, _total_xp: int) -> void:
	show_xp_gained_effect(amount)

func _on_stat_allocated( _stat_name: String, _amount: int) -> void:
	show_stat_allocated_effect(stat_name, amount)

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

func _on_back_pressed() -> void:
	queue_free()

func show_level_up_effect( _new_level: int, _ability_points_gained: int) -> void:
	var tween = create_tween()
	tween.tween_property(ability_points_label, "modulate", Color.YELLOW, 0.2)
	tween.tween_property(ability_points_label, "modulate", Color.WHITE, 0.2)

func show_xp_gained_effect( _amount: int) -> void:
	var tween = create_tween()
	tween.tween_property(xp_label, "modulate", Color.GREEN, 0.2)
	tween.tween_property(xp_label, "modulate", Color.WHITE, 0.2)

func show_stat_allocated_effect( _stat_name: String, _amount: int) -> void:
	pass

func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if player_stats_manager:
		if player_stats_manager.stats_updated.is_connected(_on_stats_updated):
			player_stats_manager.stats_updated.disconnect(_on_stats_updated)
		if player_stats_manager.level_up.is_connected(_on_level_up):
			player_stats_manager.level_up.disconnect(_on_level_up)
		if player_stats_manager.xp_gained.is_connected(_on_xp_gained):
			player_stats_manager.xp_gained.disconnect(_on_xp_gained)
		if player_stats_manager.stat_allocated.is_connected(_on_stat_allocated):
			player_stats_manager.stat_allocated.disconnect(_on_stat_allocated)
