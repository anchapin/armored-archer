## Mock storage for testing
## Simulates Nakama storage interface without network calls.
##
## Usage (see test/test_season_leaderboard.gd for a live example):
##     var node := Node.new()
##     node.set_script(preload("res://test/mocks/mock_storage.gd"))  # pass the Script, NOT .new()
##     add_child(node)
##
## `set_script()` expects a Script resource — calling `.new()` on the
## preload produces a Node instance, which Godot 4.6 rejects with
## "Invalid call". See #894.
##
## NOTE: this Node subclass intentionally shadows `Object.get()`. In
## Godot 4.6 the project treats "method overrides native class"
## warnings as errors, so the conflict has been renamed to
## `get_value()` / `lookup()` for the test API. See #894.

extends Node

var _storage_data: Dictionary = {}

func put(key: String, value) -> void:
	_storage_data[key] = value

func lookup(key: String):
	return _storage_data.get(key, null)

func clear() -> void:
	_storage_data.clear()
