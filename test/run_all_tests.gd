extends SceneTree

# GUT Test Runner for Armored Archer
# This script runs GUT tests with command-line options and outputs JUnit XML for CI

var _gut: Node
var _config: Dictionary = {}
var _exit_code: int = 0

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
		"help": false,
		"select": "",
		"unit_test": ""
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
			"-s", "--select":
				if i + 1 < args.size():
					_config["select"] = args[i + 1]
			"-u", "--unit_test":
				if i + 1 < args.size():
					_config["unit_test"] = args[i + 1]

	# Show help if requested
	if _config["help"]:
		_print_help()
		quit(0)

func _print_help():
	print("""
GUT Test Runner for Armored Archer
==================================

Usage:
  godot4 --headless --script res://test/run_all_tests.gd [options]

Options:
  -h, --help           Show this help message
  -v, --verbose        Enable verbose output
  --no-junit           Disable JUnit XML output
  -s, --select <dir>   Run tests from specific directory (e.g., suites/player)
  -u, --unit_test <name> Run specific test class

Examples:
  # Run all tests
  godot4 --headless --script res://test/run_all_tests.gd

  # Run with verbose output
  godot4 --headless --script res://test/run_all_tests.gd --verbose

  # Run specific suite
  godot4 --headless --script res://test/run_all_tests.gd --select suites/player

  # Run specific test
  godot4 --headless --script res://test/run_all_tests.gd --select suites/player --unit_test test_player_stats_manager

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
	if not _config["select"].is_empty():
		print("  Select: %s" % _config["select"])
	if not _config["unit_test"].is_empty():
		print("  Unit Test: %s" % _config["unit_test"])
	print("")

	# Load GUT plugin
	_gut = load("res://addons/gut/gut.gd").new()

	if _gut == null:
		print("ERROR: Failed to load GUT plugin")
		_exit_code = 2
		return

	# Configure GUT
	_configure_gut()

	# Add GUT to tree
	root.add_child(_gut)

	# Wait for tests to complete
	await _gut.finished

	# Check results
	_check_results()

	# Clean up
	_gut.queue_free()

func _configure_gut():
	# Load GUT configuration from .gutconfig.json
	var config_file = FileAccess.open("res://.gutconfig.json", FileAccess.READ)
	if config_file:
		var json_string = config_file.get_as_text()
		config_file.close()
		var json = JSON.new()
		var error = json.parse(json_string)
		if error == OK:
			var gut_config = json.data
			_gut.set_gut_config(gut_config)
		else:
			print("WARNING: Failed to parse .gutconfig.json")
	else:
		print("WARNING: Failed to open .gutconfig.json")

	# Override with command-line options
	if _config["verbose"]:
		_gut.logger.set_log_level(3)  # Verbose
	else:
		_gut.logger.set_log_level(1)  # Normal

	if not _config["junit"]:
		_gut.set_export_path("")

	# Set specific test selection
	if not _config["select"].is_empty():
		_gut.set_selected(_config["select"])

	if not _config["unit_test"].is_empty():
		_gut.set_unit_test_name(_config["unit_test"])

func _check_results():
	var summary = _gut.get_summary()

	print("")
	print("=== Test Results ===")
	print("  Scripts run: %d" % summary.get_script_count())
	print("  Tests run: %d" % summary.get_test_count())
	print("  Passed: %d" % summary.get_pass_count())
	print("  Failed: %d" % summary.get_fail_count())
	print("  Pending: %d" % summary.get_pending_count())
	print("  Duration: %.2fs" % summary.get_duration())

	# Set exit code based on results
	if summary.get_fail_count() > 0:
		_exit_code = 1
		print("")
		print("❌ Tests FAILED")
	else:
		_exit_code = 0
		print("")
		print("✅ All tests PASSED")

	# Output JUnit XML if enabled
	if _config["junit"]:
		_output_junit(summary)

func _output_junit(summary):
	var junit_path = "res://test/results/gut-results.xml"

	# Ensure results directory exists
	DirAccess.make_dir_absolute("res://test/results/")

	# Export JUnit XML
	var exporter = _gut.get_exporter()
	exporter.set_path(junit_path)
	exporter.export_results(summary)

	if _config["verbose"]:
		print("")
		print("JUnit XML written to: %s" % junit_path)
