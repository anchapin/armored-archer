extends Control

# --- Boss Reference ---
var boss_ref: CharacterBody2D = null

# --- Node References ---
@onready var health_bar: ProgressBar = $HealthBar
@onready var name_label: Label = $NameLabel
@onready var health_label: Label = $HealthLabel

func _ready() -> void:
	hide()
	
	var bosses = get_tree().get_nodes_in_group("Boss")
	for boss in bosses:
		if boss.has_signal("health_changed"):
			boss.health_changed.connect(_on_boss_health_changed)
			boss.boss_defeated.connect(_on_boss_defeated)
			set_boss(boss)
			break

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

func _on_boss_defeated(boss_name: String) -> void:
	await get_tree().create_timer(1.0).timeout
	hide()
