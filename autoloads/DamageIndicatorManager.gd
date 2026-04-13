## Damage Indicator Manager autoload for floating damage numbers.
## Provides damage number spawning with color coding.
##
## Signals:
## - damage_number_queued(): Emitted when damage number is queued
## - damage_number_spawned(): Emitted when damage number is spawned

extends Node

# --- Signals ---
signal damage_number_queued()
signal damage_number_spawned()

# --- State ---
var _damage_numbers: Array = []
var _max_concurrent_numbers: int = 5

# --- Constants ---
const DAMAGE_NUMBER_SCENE: String = "res://scenes/ui/damage_number.tscn"
const MAX_CONCURRENT: int = 5

# --- Initialization ---
func _ready() -> void:
	_damage_numbers = []
	_max_concurrent_numbers = 0

# --- Public API ---

## Spawn damage number at position with color coding
##
## Parameters:
##   position: Vector2 where number spawns
##   damage: Damage amount dealt
##   is_critical: True for critical hits (> 100%)
##
## Returns:
##   Node: DamageNumber scene instance
func spawn_damage_number(position: Vector2, damage: int, is_critical: bool) -> Node:
	var damage_number_scene = load(DAMAGE_NUMBER_SCENE)
	if not damage_number_scene:
		return null

	var instance = damage_number_scene.instantiate()
	instance.global_position = position
	get_tree().root.add_child(instance)

	# Set damage text
	var label = instance.get_node("Label")
	if label:
		var color = get_damage_color(damage, is_critical)
		label.text = str(damage)
		label.modulate = color

	# Set floating behavior
	# Float upward then fade out
	var tween = create_tween()
	tween.tween_property(instance, "modulate:a", Color.WHITE, 1.0)
	tween.tween_property(instance, "global_position:y", position.y + 50.0, 0.5)
	tween.tween_interval(0.03)
	tween.tween_ease(Tween.EASE_OUT)
	tween.finished.connect(_on_number_faded)

	# Cleanup when faded
	instance.queue_free()

	return instance

## Get damage color based on damage percentage
##
## Parameters:
##   damage: Damage amount
##   is_critical: Whether this is a critical hit
##
## Returns:
##   Color: Color for damage number
func get_damage_color(damage: int, is_critical: bool) -> Color:
	if is_critical:
		return Color.RED  # Critical hits: Red, 100% opacity
	else:
		# Weak hits (< 50% of max expected): Green
		if damage < 20:
			return Color(0.8, 1.0, 0.8, 1.0)
		# Normal hits (50-100% of max expected): Yellow
		else:
			return Color(1.0, 0.75, 1.0, 0.75)
