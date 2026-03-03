extends Node

var is_connected: bool = false
var session_token: String = ""
var user_id: String = ""
var base_url: String = "http://localhost:7350"

var mock_responses: Dictionary = {}
var request_queue: Array = []

signal connected()
signal connection_failed(error: String)

func _ready() -> void:
	pass

func connect_mock() -> void:
	await get_tree().create_timer(0.1).timeout
	is_connected = true
	session_token = "mock_token_" + str(Time.get_unix_time_from_system())
	user_id = "mock_user_" + str(randi() % 10000)
	connected.emit()

func disconnect_mock() -> void:
	is_connected = false
	session_token = ""
	user_id = ""

func is_session_valid() -> bool:
	return is_connected and not session_token.is_empty()

func get_auth_headers() -> PackedStringArray:
	if session_token.is_empty():
		return []
	return ["Authorization: Bearer %s" % session_token]

func set_mock_response(rpc_id: String, response: Dictionary) -> void:
	mock_responses[rpc_id] = response

func send_rpc(rpc_id: String, payload: String, timeout: float = 30.0) -> Dictionary:
	request_queue.append({"rpc_id": rpc_id, "payload": payload})
	
	if mock_responses.has(rpc_id):
		return mock_responses[rpc_id]
	
	await get_tree().create_timer(0.05).timeout
	
	return {"success": true, "data": {}}

func get_session_token() -> String:
	return session_token

func get_user_id() -> String:
	return user_id
