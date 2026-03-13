extends Control

var boss_ref: CharacterBody2D = null

@onready var health_bar: ProgressBar = $HealthBar
@onready var name_label: Label = $NameLabel
@onready var health_label: Label = $HealthLabel

var _base_offset_top: float = 10.0

func _ready() -> void:
	SafeAreaManager.safe_area_changed.connect(_on_safe_area_changed)
	_adjust_for_safe_area()
	hide()

	var bosses = get_tree().get_nodes_in_group("Boss")
	for boss in bosses:
		if boss.has_signal("health_changed"):
			boss.health_changed.connect(_on_boss_health_changed)
			boss.boss_defeated.connect(_on_boss_defeated)
			set_boss(boss)
			break

func _on_safe_area_changed() -> void:
	_adjust_for_safe_area()

func _adjust_for_safe_area() -> void:
	var safe_margins: Dictionary = SafeAreaManager.get_safe_margins()
	offset_top = _base_offset_top + safe_margins.top

func set_boss(boss: CharacterBody2D) -> void:
	boss_ref = boss
	if boss_ref.has_method("get"):
		name_label.text = boss_ref.get("boss_name")
	show()

func _on_boss_health_changed(current: int, max_health: int) -> void:
	if boss_ref and boss_ref.has_method("get"):
		name_label.text = boss_ref.get("boss_name")

	var health_percent: float = float(current) / float(max_health) * 100.0
	health_bar.value = health_percent
	health_label.text = "%d / %d" % [current, max_health]

func _on_boss_defeated( _boss_name: String) -> void:
	await get_tree().create_timer(1.0).timeout
	hide()

func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if SafeAreaManager.safe_area_changed.is_connected(_on_safe_area_changed):
		SafeAreaManager.safe_area_changed.disconnect(_on_safe_area_changed)
	
	# Disconnect from boss signals if boss exists
	if boss_ref and is_instance_valid(boss_ref):
		if boss_ref.has_signal("health_changed") and boss_ref.health_changed.is_connected(_on_boss_health_changed):
			boss_ref.health_changed.disconnect(_on_boss_health_changed)
		if boss_ref.has_signal("boss_defeated") and boss_ref.boss_defeated.is_connected(_on_boss_defeated):
			boss_ref.boss_defeated.disconnect(_on_boss_defeated)
