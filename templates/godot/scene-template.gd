extends ${1:Node2D}

# --- Configuration ---
@export var base_speed: float = 300.0
@export var damage: int = 10

# --- State ---
var is_active: bool = true
var current_health: int = 100
var max_health: int = 100

# --- References ---
@onready var ${2:sprite}: Sprite2D = $Sprite2D
@onready var ${3:collision}: CollisionShape2D = $CollisionShape2D

# --- Signals ---
signal health_changed(current: int, max: int)
signal died()
signal activated()
signal deactivated()

# --- Constants ---
const ${4:CONSTANT_NAME}: float = 1.0

# --- Initialization ---
func _ready() -> void:
	_setup_connections()

func _setup_connections() -> void:
	pass

# --- Process ---
func _physics_process(delta: float) -> void:
	if is_active:
		_process_movement(delta)

func _process_movement(delta: float) -> void:
	pass

# --- Public Methods ---
func activate() -> void:
	if not is_active:
		is_active = true
		activated.emit()

func deactivate() -> void:
	if is_active:
		is_active = false
		deactivated.emit()

func take_damage(amount: int) -> void:
	current_health -= amount
	current_health = max(0, current_health)
	health_changed.emit(current_health, max_health)

	if current_health <= 0:
		_die()

func heal(amount: int) -> void:
	current_health += amount
	current_health = min(max_health, current_health)
	health_changed.emit(current_health, max_health)

func get_health_percent() -> float:
	return float(current_health) / float(max_health)

# --- Private Methods ---
func _die() -> void:
	died.emit()
	queue_free()

# --- Signal Handlers ---
func _on_${5:area}_body_entered(body: Node2D) -> void:
	if body.has_method("take_damage"):
		body.take_damage(damage)
