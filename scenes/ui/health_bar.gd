extends Control

# --- Node References ---
@onready var health_bar: ProgressBar = $HealthBar
@onready var health_label: Label = $HealthLabel

func _ready() -> void:
	GameManager.health_changed.connect(_on_health_changed)
	_update_display(GameManager.player_current_health, GameManager.player_max_health)

func _on_health_changed(new_health: int, max_health: int) -> void:
	_update_display(new_health, max_health)

func _update_display(health: int, max_health: int) -> void:
	var health_percent: float = float(health) / float(max_health) * 100.0
	health_bar.value = health_percent
	health_label.text = "%d / %d" % [health, max_health]
