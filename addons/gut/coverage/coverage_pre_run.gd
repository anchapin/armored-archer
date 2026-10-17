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
	# Issue #1660: GutCoverageTracker is no longer a production autoload
	# (test tooling must not ship in release builds). Self-register the
	# tracker node for this test run so the static dispatch
	# (get_instance() -> Engine singleton -> root node) still resolves.
	var tracker = _tracker_ref.get_instance()
	if tracker == null:
		tracker = _tracker_ref.new()
		tracker.name = "GutCoverageTracker"
		Engine.get_main_loop().root.add_child(tracker)
	# Clear previous data
	if tracker:
		tracker.before_all()

	# Parse autoload scripts to build line number map
	var parser = ScriptLineParser.new()
	var line_map = parser.parse_autoload_directory()
	for script_path in line_map:
		tracker.set_script_line_map(script_path, line_map[script_path])
