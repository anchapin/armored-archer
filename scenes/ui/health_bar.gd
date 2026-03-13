extends Control

@onready var health_bar: ProgressBar = $HealthBar
@onready var health_label: Label = $HealthLabel

var _base_offset_left: float = -220.0
var _base_offset_bottom: float = 50.0

func _ready() -> void:
	GameManager.health_changed.connect(_on_health_changed)
	SafeAreaManager.safe_area_changed.connect(_on_safe_area_changed)
	_update_display(GameManager.player_current_health, GameManager.player_max_health)
	_adjust_for_safe_area()

func _on_safe_area_changed() -> void:
	_adjust_for_safe_area()

func _adjust_for_safe_area() -> void:
	var safe_margins: Dictionary = SafeAreaManager.get_safe_margins()
	offset_left = _base_offset_left - safe_margins.right
	offset_bottom = _base_offset_bottom - safe_margins.bottom

func _on_health_changed(new_health: int, max_health: int) -> void:
	_update_display(new_health, max_health)

func _update_display(health: int, max_health: int) -> void:
	var health_percent: float = float(health) / float(max_health) * 100.0
	health_bar.value = health_percent
	health_label.text = "%d / %d" % [health, max_health]

func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if GameManager.health_changed.is_connected(_on_health_changed):
		GameManager.health_changed.disconnect(_on_health_changed)
	if SafeAreaManager.safe_area_changed.is_connected(_on_safe_area_changed):
		SafeAreaManager.safe_area_changed.disconnect(_on_safe_area_changed)
