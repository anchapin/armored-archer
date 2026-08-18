class_name TrackerHelper
extends Node

# Helper class for testing coverage tracker components
# Provides access to coverage classes and manages singleton state

const CoverageTrackerClass = preload("res://addons/gut/coverage/coverage_tracker.gd")
const ScriptLineParserClass = preload("res://addons/gut/coverage/script_line_parser.gd")
const CoverageExporterClass = preload("res://addons/gut/coverage/coverage_exporter.gd")

static func get_tracker_instance():
	"""Get the production autoload instance the static API writes to.

	#1020: static track_execution()/set_script_line_map() dispatch to the
	GutCoverageTracker autoload, so tests must read that same instance —
	a fresh .new() never observes those writes (same autoload-vs-instance
	lesson as #1025).
	"""
	var instance = CoverageTrackerClass.get_instance()
	if instance == null:
		push_error("TrackerHelper: GutCoverageTracker autoload not found — cannot test production singleton plumbing")
	return instance

static func get_parser_instance():
	"""Get a fresh ScriptLineParser instance for testing."""
	return ScriptLineParserClass

static func get_exporter_instance():
	"""Get a fresh CoverageExporter instance for testing."""
	return CoverageExporterClass.new()

static func _clear_instance():
	"""Clear the CoverageTracker singleton instance between tests."""
	# before_all() clears executed lines via the production static path;
	# the line map is reset here so each test starts fully hermetic
	# (production re-sets maps every pre-run, so clearing is test-only hygiene).
	CoverageTrackerClass.before_all()
	var instance = CoverageTrackerClass.get_instance()
	if instance:
		instance._script_line_map.clear()
