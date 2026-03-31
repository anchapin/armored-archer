extends Node
# GutCoverageTrackerClass is a global class_name, no need to preload
# const GutCoverageTrackerClass = preload("res://addons/gut/coverage/coverage_tracker.gd")
const ScriptLineParser = preload("res://addons/gut/coverage/script_line_parser.gd")

# GUT plugin integration for coverage tracking
# Implemented in: 13-01-PLAN.md Task 2

var _coverage_tracker_script = load("res://addons/gut/coverage/coverage_tracker.gd")
var _coverage_tracker: Node = null
var _script_parser = null
var _gut: GutMain = null

func _enter_tree():
	"""Called when plugin is loaded by GUT."""
	_gut = get_node_or_null("/root/Gut")
	if _gut != null:
		_gut.connect("start_run", _on_gut_start_run)
		_gut.connect("end_run", _on_gut_end_run)

func _on_gut_start_run():
	"""Called when GUT starts running tests."""
	_coverage_tracker = _coverage_tracker_script.get_instance()
	_script_parser = ScriptLineParser.new()

	var line_map = _script_parser.parse_autoload_directory()
	for script_path in line_map:
		_coverage_tracker.set_script_line_map(script_path, line_map[script_path])

func _on_gut_end_run():
	"""Called when GUT finishes running all tests."""
	# No action needed - post_run_script handles export
	pass
