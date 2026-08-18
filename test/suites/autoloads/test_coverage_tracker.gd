extends GutTest
const CoverageTracker = preload("res://addons/gut/coverage/coverage_tracker.gd")
const TrackerHelper = preload("res://test/suites/autoloads/tracker_helper.gd")

# Unit tests for CoverageTracker singleton
# TDD GREEN phase - these tests should pass after implementation

func before_each():
	# Clear singleton instance for fresh test state
	TrackerHelper._clear_instance()

func test_track_execution_records_line():
	"""Test that track_execution records a line in the executed_lines dictionary."""
	var tracker = TrackerHelper.get_tracker_instance()
	tracker.track_execution("res://test.gd", 10)
	assert_true(10 in tracker._executed_lines["res://test.gd"], "Line 10 should be in executed_lines")

func test_track_execution_deduplicates():
	"""Test that calling track_execution twice with same line only records it once."""
	var tracker = TrackerHelper.get_tracker_instance()
	tracker.track_execution("res://test.gd", 10)
	tracker.track_execution("res://test.gd", 10)
	assert_eq(tracker._executed_lines["res://test.gd"].size(), 1, "Should have only 1 entry (deduplicated)")

func test_get_coverage_data_calculates_percentage():
	"""Test that get_coverage_data calculates percentage correctly."""
	var tracker = TrackerHelper.get_tracker_instance()
	tracker.set_script_line_map("res://test.gd", [10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
	tracker.track_execution("res://test.gd", 10)
	tracker.track_execution("res://test.gd", 20)
	tracker.track_execution("res://test.gd", 30)
	tracker.track_execution("res://test.gd", 40)
	tracker.track_execution("res://test.gd", 50)
	var data = tracker.get_coverage_data()
	assert_eq(data["res://test.gd"].percentage, 50.0, "Coverage should be 50.0%")

func test_before_all_clears_data():
	"""Test that before_all clears all executed line data."""
	var tracker = TrackerHelper.get_tracker_instance()
	tracker.track_execution("res://test.gd", 10)
	tracker.track_execution("res://test.gd", 20)
	tracker.before_all()
	assert_eq(tracker._executed_lines.size(), 0, "executed_lines should be empty after before_all")

func test_get_coverage_data_includes_executable_lines():
	"""Test that get_coverage_data includes executable_lines in result."""
	var tracker = TrackerHelper.get_tracker_instance()
	tracker.set_script_line_map("res://test.gd", [10, 20, 30])
	tracker.track_execution("res://test.gd", 10)
	var data = tracker.get_coverage_data()
	assert_eq(data["res://test.gd"].executable_lines.size(), 3, "Should have 3 executable lines")

func test_get_coverage_data_includes_executed_lines():
	"""Test that get_coverage_data includes executed_lines in result."""
	var tracker = TrackerHelper.get_tracker_instance()
	tracker.track_execution("res://test.gd", 10)
	tracker.track_execution("res://test.gd", 20)
	var data = tracker.get_coverage_data()
	assert_eq(data["res://test.gd"].executed_lines.size(), 2, "Should have 2 executed lines")

func test_get_coverage_data_zero_coverage():
	"""Test that get_coverage_data handles zero coverage correctly."""
	var tracker = TrackerHelper.get_tracker_instance()
	tracker.set_script_line_map("res://test.gd", [10, 20, 30])
	var data = tracker.get_coverage_data()
	assert_eq(data["res://test.gd"].percentage, 0.0, "Coverage should be 0.0% when no lines executed")

func test_get_coverage_data_full_coverage():
	"""Test that get_coverage_data handles full coverage correctly."""
	var tracker = TrackerHelper.get_tracker_instance()
	tracker.set_script_line_map("res://test.gd", [10, 20, 30])
	tracker.track_execution("res://test.gd", 10)
	tracker.track_execution("res://test.gd", 20)
	tracker.track_execution("res://test.gd", 30)
	var data = tracker.get_coverage_data()
	assert_eq(data["res://test.gd"].percentage, 100.0, "Coverage should be 100.0% when all lines executed")

func test_script_line_parser_skips_comments():
	"""Full-line comments (incl. ## doc comments) are skipped; code lines
	carrying trailing # or ## comments stay executable (#967 verdict)."""
	var parser = TrackerHelper.get_parser_instance()
	var test_file = "res://test/coverage/test_parse_comments.gd"
	# Create test file
	var file = FileAccess.open(test_file, FileAccess.WRITE)
	file.store_line("# This is a comment")
	file.store_line("## This is a doc comment")
	file.store_line("var x = 10  # Inline comment")
	file.store_line("var s = \"# hash inside a string is not a comment\"")
	file.store_line("var y = 20  ## Trailing doc comment")
	file.store_line("var z = 30")
	file.close()

	var lines = parser.parse_executable_lines(test_file)
	assert_eq(lines.size(), 4, "Should have 4 executable lines (comment-only lines skipped)")
	assert_eq(lines, [3, 4, 5, 6], "Lines 3-6 are executable; trailing comments do not hide code")

func test_script_line_parser_skips_empty_lines():
	"""Test that ScriptLineParser skips empty lines."""
	var parser = TrackerHelper.get_parser_instance()
	var test_file = "res://test/coverage/test_parse_empty.gd"
	var file = FileAccess.open(test_file, FileAccess.WRITE)
	file.store_line("")
	file.store_line("  \t  ")
	file.store_line("var x = 10")
	file.close()

	var lines = parser.parse_executable_lines(test_file)
	assert_eq(lines.size(), 1, "Should have 1 executable line (empty lines skipped)")

func test_script_line_parser_skips_brace_only_lines():
	"""Test that ScriptLineParser skips lines with only braces or punctuation."""
	var parser = TrackerHelper.get_parser_instance()
	var test_file = "res://test/coverage/test_parse_braces.gd"
	var file = FileAccess.open(test_file, FileAccess.WRITE)
	file.store_line("{")
	file.store_line("}")
	file.store_line("var x = 10")
	file.store_line(":")
	file.store_line(";")
	file.close()

	var lines = parser.parse_executable_lines(test_file)
	assert_eq(lines.size(), 1, "Should have 1 executable line (brace-only lines skipped)")

func test_coverage_exporter_exports_json():
	"""Test that CoverageExporter exports coverage data to JSON file."""
	var exporter = TrackerHelper.get_exporter_instance()
	var coverage_data = {
		"res://test.gd": {
			"file": "res://test.gd",
			"executable_lines": [1, 2, 3],
			"executed_lines": [1, 2],
			"covered_count": 2,
			"total_count": 3,
			"percentage": 66.67
		}
	}
	var result = exporter.export_coverage_json(coverage_data, "res://test/coverage/json/test_export.json")
	assert_eq(result, OK, "Export should succeed")

	# Verify file exists and contains data
	var file = FileAccess.open("res://test/coverage/json/test_export.json", FileAccess.READ)
	var content = file.get_as_text()
	file.close()
	assert_true(content.length() > 0, "Exported file should contain data")
