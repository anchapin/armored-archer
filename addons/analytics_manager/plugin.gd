@tool
extends EditorPlugin

func _enable_plugin() -> void:
	add_autoload_singleton("AnalyticsManager", "res://addons/analytics_manager/analytics_manager.gd")

func _disable_plugin() -> void:
	remove_autoload_singleton("AnalyticsManager")
