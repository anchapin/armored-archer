extends GutHookScript
# No need to preload, GutCoverageTrackerClass is global

# Pre-test run initialization script for coverage tracking
# Implemented in: 13-01-PLAN.md Task 2

var _tracker_ref = null
var ScriptLineParser = null

func run():
	"""Initialize coverage tracker before test run starts."""
	# Load classes
	_tracker_ref = load("res://addons/gut/coverage/coverage_tracker.gd")
	ScriptLineParser = preload("res://addons/gut/coverage/script_line_parser.gd")
	# Clear previous data
	var tracker = _tracker_ref.get_instance()
	if tracker:
		tracker.before_all()

	# Parse autoload scripts to build line number map
	var parser = ScriptLineParser.new()
	var line_map = parser.parse_autoload_directory()
	for script_path in line_map:
		tracker.set_script_line_map(script_path, line_map[script_path])
