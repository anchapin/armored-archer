## Demo Test Runner
##
## Simple script to load and run the vertical slice demo.
## Can be executed from Godot Editor or as a test scene.

extends Node

## Demo scene path
const DEMO_SCRIPT_PATH: String = "res://scripts/vertical_slice_demo.gd"

## Run the demo when scene is ready
func _ready() -> void:
	print("============================================================")
	print("ARMORED ARCHER - VERTICAL SLICE DEMO TEST")
	print("============================================================")
	print()
	print("Loading demo script from: %s" % DEMO_SCRIPT_PATH)

	# Load the demo script
	var demo_script = load(DEMO_SCRIPT_PATH)
	if not demo_script:
		push_error("Failed to load demo script from: %s" % DEMO_SCRIPT_PATH)
		return

	print("Demo script loaded successfully")
	print()

	# Create instance
	var demo_instance = demo_script.new()
	add_child(demo_instance)

	# Check if demo has start_demo method
	if demo_instance.has_method("start_demo"):
		print("Starting demo...")
		print()
		demo_instance.start_demo()
	else:
		push_error("Demo script does not have start_demo() method")

	# Auto-quit after delay to let demo complete
	await get_tree().create_timer(0.5).timeout
	print("Demo test runner initialized")
