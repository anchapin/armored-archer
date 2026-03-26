extends SceneTree

var _gut_scene: Node
var _exit_code: int = 0
var _config: Dictionary = {}

func _init():
	# Parse command-line arguments
	_parse_arguments()

	# Run tests
	_run_tests()

	# Exit with appropriate code
	quit(_exit_code)

func _parse_arguments():
	# Default configuration
	_config = {
		"verbose": false,
		"junit": true,
		"help": false
	}

	# Parse command-line arguments
	var args = OS.get_cmdline_args()
	for i in range(args.size()):
		var arg = args[i]
		match arg:
			"-v", "--verbose":
				_config["verbose"] = true
			"--no-junit":
				_config["junit"] = false
			"-h", "--help":
				_config["help"] = true

	# Show help if requested
	if _config["help"]:
		_print_help()
		quit(0)

func _print_help():
	print("""
GUT Test Runner for Armored Archer
==================================

Usage:
 godot --headless --script res://test/run_all_tests.gd [options]

Options:
 -h, --help           Show this help message
 -v, --verbose        Enable verbose output
 --no-junit           Disable JUnit XML output

Exit Codes:
 0 - All tests passed
 1 - One or more tests failed
 2 - Error loading GUT or configuration
""")

func _run_tests():
	print("=== GUT Test Runner ===")
	print("Configuration:")
	print("  Verbose: %s" % _config["verbose"])
	print("  JUnit: %s" % _config["junit"])
	print("")

	# Load GUT programmatic instance
	var GutClass = load("res://addons/gut/gut.gd")
	if GutClass == null:
		print("ERROR: Failed to load GUT plugin script")
		_exit_code = 2
		return
	_gut_scene = GutClass.new()
	if _gut_scene == null:
		print("ERROR: Failed to instantiate GUT plugin")
		_exit_code = 2
		return

	# Configure GUT
	_gut_scene.log_level = 1
	_gut_scene.color_output = true
	_gut_scene.include_subdirectories = true
	
	# Add GUT to tree
	root.add_child(_gut_scene)

	# Set directories to scan (from .gutconfig.json if possible, or defaults)
	# For simplicity in this environment, we'll pointed it to the suites
	_gut_scene.add_script_dir("res://test/suites")
	
	# Run tests
	print("Starting GUT test run...")
	_gut_scene.test_scripts()
	
	# Connect to end_run signal
	_gut_scene.end_run.connect(_on_tests_finished)

func _on_tests_finished():
	var summary = _gut_scene.get_summary()
	if summary.failing > 0:
		_exit_code = 1
		print("\nFAILED: %d tests failed" % summary.failing)
	else:
		_exit_code = 0
		print("\nSUCCESS: All tests passed")
	
	_clean_up_and_exit()

func _process(_delta: float):
	pass
	# Wait for a bit for tests to complete
	# In headless mode, tests run automatically

func _exit_tree():
	# Check if we should exit
	if _exit_code >= 0:
		_clean_up_and_exit()

func _clean_up_and_exit():
	if _gut_scene != null:
		_gut_scene.queue_free()
	quit(_exit_code)
