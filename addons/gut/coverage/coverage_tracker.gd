extends Node
class_name GutCoverageTrackerClass

# Coverage tracking singleton for recording line executions during test runs
# Implemented as an Autoload configured in project.godot as "CoverageTracker"

# Instance variables to store data
var _executed_lines: Dictionary = {}  # script_path -> Array of line numbers
var _script_line_map: Dictionary = {}  # script_path -> Array of executable line numbers

## Static helper to get the Autoload instance safely
static func get_instance() -> GutCoverageTrackerClass:
	if Engine.has_singleton("GutCoverageTracker"):
		return Engine.get_singleton("GutCoverageTracker") as GutCoverageTrackerClass
	var root = Engine.get_main_loop().root
	if root and root.has_node("GutCoverageTracker"):
		return root.get_node("GutCoverageTracker") as GutCoverageTrackerClass
	return null

## Record that a specific line was executed during test
static func track_execution(script_path: String, line: int) -> void:
	var instance = get_instance()
	if instance:
		instance._track_execution_internal(script_path, line)

func _track_execution_internal(script_path: String, line: int) -> void:
	if not _executed_lines.has(script_path):
		_executed_lines[script_path] = []
	if line not in _executed_lines[script_path]:
		_executed_lines[script_path].append(line)

## Return coverage statistics for all tracked scripts
static func get_coverage_data() -> Dictionary:
	var instance = get_instance()
	if instance:
		return instance._get_coverage_data_internal()
	return {}

func _get_coverage_data_internal() -> Dictionary:
	var coverage_data = {}
	for script_path in _executed_lines:
		var executable_lines = _script_line_map.get(script_path, [])
		var executed_lines = _executed_lines[script_path]
		var covered_count = executed_lines.size()
		var total_count = executable_lines.size()
		var percentage = (float(covered_count) / float(total_count) * 100.0) if total_count > 0 else 0.0
		percentage = round(percentage * 100.0) / 100.0

		coverage_data[script_path] = {
			"file": script_path,
			"executable_lines": executable_lines,
			"executed_lines": executed_lines,
			"covered_count": covered_count,
			"total_count": total_count,
			"percentage": percentage
		}
	return coverage_data

## Set the map of executable line numbers for a script
static func set_script_line_map(script_path: String, line_numbers: Array) -> void:
	var instance = get_instance()
	if instance:
		instance._set_script_line_map_internal(script_path, line_numbers)

func _set_script_line_map_internal(script_path: String, line_numbers: Array) -> void:
	_script_line_map[script_path] = line_numbers

## Clear all executed line data
static func before_all() -> void:
	var instance = get_instance()
	if instance:
		instance._before_all_internal()

func _before_all_internal() -> void:
	_executed_lines.clear()
