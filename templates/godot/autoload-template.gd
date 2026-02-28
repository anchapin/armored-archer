extends Node

# --- Configuration ---
@export var config_value: float = 1.0

# --- State ---
var state_var: bool = false
var data_dict: Dictionary = {}

# --- Constants ---
const CONSTANT_NAME: String = "value"

# --- Signals ---
signal state_changed(new_state: bool)
signal data_updated(data: Dictionary)

# --- Initialization ---
func _ready() -> void:
	_initialize_state()

func _initialize_state() -> void:
	pass

# --- Public Methods ---
func set_state(new_state: bool) -> void:
	if state_var != new_state:
		state_var = new_state
		state_changed.emit(new_state)

func get_state() -> bool:
	return state_var

func update_data(key: String, value: Variant) -> void:
	data_dict[key] = value
	data_updated.emit(data_dict)

func get_data(key: String, default_value: Variant = null) -> Variant:
	return data_dict.get(key, default_value)

# --- Private Methods ---
func _process_state() -> void:
	pass

# --- Signal Handlers ---
func _on_state_changed(new_state: bool) -> void:
	_process_state()
