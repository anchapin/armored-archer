## Mock storage for testing
## Simulates Nakama storage interface without network calls

extends Node

var _storage_data: Dictionary = {}

func put(key: String, value) -> void:
	_storage_data[key] = value

func get(key: String):
	return _storage_data.get(key, null)

func clear() -> void:
	_storage_data.clear()
