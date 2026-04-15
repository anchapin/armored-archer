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

	# Listen for boss spawn events instead of searching immediately
	var game_manager = get_node_or_null("/root/GameManager")
	if game_manager and game_manager.has_signal("boss_spawned"):
		game_manager.boss_spawned.connect(_on_boss_spawned)

	# Also check for existing boss (in case boss spawned before UI loaded)
	_connect_to_existing_boss()

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

func _on_boss_spawned(boss_node: Node) -> void:
	"""Handle boss spawn event from GameManager."""
	print("DEBUG: Boss health bar received boss_spawned signal")
	_connect_to_boss(boss_node)

func _connect_to_existing_boss() -> void:
	"""Check for existing boss and connect (handles cases where boss spawns before UI)."""
	var bosses = get_tree().get_nodes_in_group("Boss")
	for boss in bosses:
		if boss.has_signal("health_changed"):
			_connect_to_boss(boss)
			break

func _connect_to_boss(boss: Node) -> void:
	"""Connect to a boss entity's signals."""
	if not boss or not is_instance_valid(boss):
		return

	# Disconnect from previous boss if any
	if boss_ref and is_instance_valid(boss_ref):
		if boss_ref.has_signal("health_changed") and boss_ref.health_changed.is_connected(_on_boss_health_changed):
			boss_ref.health_changed.disconnect(_on_boss_health_changed)
		if boss_ref.has_signal("boss_defeated") and boss_ref.boss_defeated.is_connected(_on_boss_defeated):
			boss_ref.boss_defeated.disconnect(_on_boss_defeated)

	# Connect to new boss
	if boss.has_signal("health_changed"):
		boss.health_changed.connect(_on_boss_health_changed)
	if boss.has_signal("boss_defeated"):
		boss.boss_defeated.connect(_on_boss_defeated)

	set_boss(boss)
	print("DEBUG: Connected boss health bar to boss")

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

	# Disconnect from GameManager signal
	var game_manager = get_node_or_null("/root/GameManager")
	if game_manager and game_manager.has_signal("boss_spawned"):
		if game_manager.boss_spawned.is_connected(_on_boss_spawned):
			game_manager.boss_spawned.disconnect(_on_boss_spawned)

	# Disconnect from boss signals if boss exists
	if boss_ref and is_instance_valid(boss_ref):
		if boss_ref.has_signal("health_changed") and boss_ref.health_changed.is_connected(_on_boss_health_changed):
			boss_ref.health_changed.disconnect(_on_boss_health_changed)
		if boss_ref.has_signal("boss_defeated") and boss_ref.boss_defeated.is_connected(_on_boss_defeated):
			boss_ref.boss_defeated.disconnect(_on_boss_defeated)
