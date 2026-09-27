extends GutHookScript

# Post-test run data export script for coverage tracking
# Implemented in: 13-01-PLAN.md Task 2

const CoverageTrackerClass = preload("res://addons/gut/coverage/coverage_tracker.gd")
const CoverageExporterClass = preload("res://addons/gut/coverage/coverage_exporter.gd")
const ScriptLineParser = preload("res://addons/gut/coverage/script_line_parser.gd")

func run():
	"""Export coverage data to JSON file after test run completes."""
	print("[CoveragePostRun] Post-run script executing...")

	# Get coverage data and export
	var tracker = CoverageTrackerClass.get_instance()
	if tracker == null:
		push_error("Coverage post-run: tracker autoload not found; coverage.json will not be written")
		print("[CoveragePostRun] FAILED - tracker autoload not found")
		return

	# Repopulate the executable-line map. Each GUT test class clears the
	# tracker in `before_each` (test isolation), so the population done by
	# the pre-run hook is wiped by the time we get here. Re-parsing
	# `res://autoloads/` here restores the line map so `get_coverage_data()`
	# can compute total_count and executable_lines for the coverage gate.
	var line_map = ScriptLineParser.parse_autoload_directory()
	for script_path in line_map:
		tracker.set_script_line_map(script_path, line_map[script_path])

	var coverage_data = tracker.get_coverage_data()

	# Log coverage data for debugging
	print("[CoveragePostRun] Coverage data files: ", coverage_data.keys())
	print("[CoveragePostRun] Total files tracked: ", coverage_data.size())
	if coverage_data.size() > 0:
		for file in coverage_data.keys():
			print("[CoveragePostRun] File: %s, executed_lines: %s" % [file, coverage_data[file].get("executed_lines", [])])

	var exporter = CoverageExporterClass.new()
	var result = exporter.export_coverage_json(coverage_data, "res://test/coverage/json/coverage.json")

	# Don't assert in post_run - just log and continue
	if result != OK:
		gut.logger.error("Failed to export coverage.json, error code: %d" % result)
		print("[CoveragePostRun] FAILED to export - error code: %d" % result)
	else:
		gut.logger.info("Coverage data exported to res://test/coverage/json/coverage.json")
		print("[CoveragePostRun] Export completed successfully")
