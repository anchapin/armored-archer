## Mock Network Manager for testing CampaignManager sync behavior

extends Node

signal connection_status_changed(is_online: bool)

var mock_is_online: bool = false
var mock_server_data: Dictionary = {}
var rpc_calls: Array = []

func set_online(is_online: bool) -> void:
	mock_is_online = is_online
	connection_status_changed.emit(is_online)

func is_session_valid() -> bool:
	return mock_is_online

func _has_method(method_name: StringName) -> bool:
	return method_name == "send_rpc"

## Mock send_rpc - returns mock server data
func send_rpc(rpc_id: String, payload: String) -> Dictionary:
	rpc_calls.append({"rpc_id": rpc_id, "payload": payload})

	if rpc_id == "armored_archer/get_campaign_progress":
		return mock_server_data.duplicate(true)

	return {"error": "Unknown RPC"}

## Async version (for completeness)
func send_rpc_async(rpc_id: String, payload: String, timeout: float = 5.0) -> void:
	send_rpc(rpc_id, payload)

## Set mock server response
func set_mock_campaign_progress(data: Dictionary) -> void:
	mock_server_data = data

## Clear mock state
func clear() -> void:
	rpc_calls.clear()
	mock_server_data.clear()
