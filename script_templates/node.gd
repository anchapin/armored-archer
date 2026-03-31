## {ClassName}
## 
## {Description}
##
## @export - {exposed_vars}
## @onready - {cached_nodes}

extends {ParentClass}

# --- Signals ---
signal {signal_name}({signal_params})

# --- Constants ---

# --- References ---
@onready var {node_name}: {NodeType} = ${NodePath}

# --- Exports ---
@export var {var_name}: {Type} = {default_value}

# --- State ---
var {state_var}: {Type} = {default_value}

# --- Lifecycle ---
func _ready() -> void:
	pass

func _process(delta: float) -> void:
	pass

# --- Public Methods ---
func {method_name}({params}) -> {return_type}:
	pass

# --- Private Methods ---
func _{method_name}({params}) -> {return_type}:
	pass
