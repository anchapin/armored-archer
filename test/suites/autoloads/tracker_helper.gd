class_name TrackerHelper
extends Node

# Helper class for testing coverage tracker components
# Provides access to coverage classes and manages singleton state

const CoverageTrackerClass = preload("res://addons/gut/coverage/coverage_tracker.gd")
const ScriptLineParserClass = preload("res://addons/gut/coverage/script_line_parser.gd")
const CoverageExporterClass = preload("res://addons/gut/coverage/coverage_exporter.gd")

static func get_tracker_instance():
	"""Get a fresh CoverageTracker instance for testing."""
	return CoverageTrackerClass.new()

static func get_parser_instance():
	"""Get a fresh ScriptLineParser instance for testing."""
	return ScriptLineParserClass

static func get_exporter_instance():
	"""Get a fresh CoverageExporter instance for testing."""
	return CoverageExporterClass.new()

static func _clear_instance():
	"""Clear the CoverageTracker singleton instance between tests."""
	CoverageTrackerClass.before_all()
