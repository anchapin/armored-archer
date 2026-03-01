extends Node

# --- Configuration ---
@export var server_url: String = ""
@export var server_port: int = 0
@export var server_key: String = ""

# --- Session State ---
var session_token: String = ""
var refresh_token: String = ""
var user_id: String = ""
var username: String = ""
var device_id: String = ""
var is_connected: bool = false
var is_offline: bool = false

# --- HTTP Requests ---
var http_request: HTTPRequest
var base_url: String

# --- Signals ---
signal session_created(success: bool, error_message: String = "")
signal session_refreshed(success: bool, error_message: String = "")
signal connection_status_changed(is_online: bool)

# --- Constants ---
const SESSION_FILE: String = "user://session_data.json"

# --- Environment Variables ---
func _load_environment_variables() -> void:
	var env_url: String = OS.getenv("NAKAMA_SERVER_URL")
	var env_port: String = OS.getenv("NAKAMA_SERVER_PORT")
	var env_key: String = OS.getenv("NAKAMA_SERVER_KEY")
	
	if not env_url.is_empty():
		server_url = env_url
	else:
		push_warning("NAKAMA_SERVER_URL not set, using default: 127.0.0.1")
		server_url = "127.0.0.1"
	
	if not env_port.is_empty():
		server_port = int(env_port)
	else:
		push_warning("NAKAMA_SERVER_PORT not set, using default: 7350")
		server_port = 7350
	
	if not env_key.is_empty():
		server_key = env_key
	else:
		push_warning("NAKAMA_SERVER_KEY not set, using default: defaultkey")
		server_key = "defaultkey"
	
	_validate_required_config()

func _validate_required_config() -> void:
	var missing_vars: Array[String] = []
	
	if server_url.is_empty():
		missing_vars.append("NAKAMA_SERVER_URL")
	
	if server_port == 0:
		missing_vars.append("NAKAMA_SERVER_PORT")
	
	if server_key.is_empty():
		missing_vars.append("NAKAMA_SERVER_KEY")
	
	if not missing_vars.is_empty():
		var warning_msg: String = "Using defaults for environment variables: %s" % ", ".join(missing_vars)
		push_warning(warning_msg)

# --- Initialization ---
func _ready() -> void:
	_load_environment_variables()
	base_url = "http://%s:%d" % [server_url, server_port]
	
	http_request = HTTPRequest.new()
	add_child(http_request)
	http_request.request_completed.connect(_on_http_request_completed)
	
	_load_session_from_file()
	
	if device_id.is_empty():
		_generate_device_id()
	
	_try_auto_connect()

# --- Device ID Management ---
func _generate_device_id() -> void:
	var uuid: Array = []
	for i in range(16):
		uuid.append(randi() % 256)
	
	device_id = ""
	for byte in uuid:
		device_id += "%02x" % byte
	
	_save_session_to_file()

# --- Authentication ---
func authenticate_device() -> void:
	if is_offline:
		session_created.emit(false, "Cannot authenticate while offline")
		return
	
	var url: String = "%s/v2/account/authenticate/device" % base_url
	var headers: PackedStringArray = [
		"Content-Type: application/json",
		"Accept: application/json"
	]
	var body: Dictionary = {
		"id": device_id,
		"create": true
	}
	
	var json: JSON = JSON.new()
	var json_string: String = json.stringify(body)
	
	var error: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, json_string)
	if error != OK:
		session_created.emit(false, "Failed to send authentication request")
		is_offline = true
		connection_status_changed.emit(false)

func _try_auto_connect() -> void:
	if not session_token.is_empty():
		_refresh_session()
	else:
		authenticate_device()

# --- Session Management ---
func _refresh_session() -> void:
	if refresh_token.is_empty():
		authenticate_device()
		return
	
	var url: String = "%s/v2/session/refresh" % base_url
	var headers: PackedStringArray = [
		"Content-Type: application/json",
		"Accept: application/json"
	]
	var body: Dictionary = {
		"token": refresh_token
	}
	
	var json: JSON = JSON.new()
	var json_string: String = json.stringify(body)
	
	http_request.request(url, headers, HTTPClient.METHOD_POST, json_string)

# --- HTTP Response Handling ---
func _on_http_request_completed(result: int, response_code: int, headers: PackedStringArray, body: PackedByteArray) -> void:
	var response_text: String = body.get_string_from_utf8()
	
	if response_code >= 200 and response_code < 300:
		var json: JSON = JSON.new()
		var parse_result: Error = json.parse(response_text)
		
		if parse_result == OK:
			var response_data: Dictionary = json.data
			
			if "token" in response_data:
				_update_session_from_response(response_data)
				
				if not is_connected:
					is_connected = true
					session_created.emit(true, "")
					session_refreshed.emit(true, "")
				else:
					session_refreshed.emit(true, "")
				
				is_offline = false
				connection_status_changed.emit(true)
	else:
		_handle_authentication_error(response_code, response_text)

func _update_session_from_response(response_data: Dictionary) -> void:
	if "token" in response_data:
		session_token = response_data["token"]
	
	if "refresh_token" in response_data:
		refresh_token = response_data["refresh_token"]
	
	if "user_id" in response_data:
		user_id = response_data["user_id"]
	
	if "username" in response_data:
		username = response_data["username"]
	
	is_connected = true
	_save_session_to_file()

func _handle_authentication_error(response_code: int, response_text: String) -> void:
	if response_code == 0 or response_code == -1:
		is_offline = true
		connection_status_changed.emit(false)
		session_created.emit(false, "No internet connection")
	else:
		is_connected = false
		var error_message: String = "Authentication failed (code: %d)" % response_code
		
		var json: JSON = JSON.new()
		if json.parse(response_text) == OK:
			var response_data: Dictionary = json.data
			if "message" in response_data:
				error_message = response_data["message"]
		
		session_created.emit(false, error_message)
		session_refreshed.emit(false, error_message)

# --- Session Storage ---
func _save_session_to_file() -> void:
	var session_data: Dictionary = {
		"session_token": session_token,
		"refresh_token": refresh_token,
		"user_id": user_id,
		"username": username,
		"device_id": device_id
	}
	
	var file: FileAccess = FileAccess.open(SESSION_FILE, FileAccess.WRITE)
	if file:
		var json: JSON = JSON.new()
		file.store_string(json.stringify(session_data))
		file.close()

func _load_session_from_file() -> void:
	if not FileAccess.file_exists(SESSION_FILE):
		return
	
	var file: FileAccess = FileAccess.open(SESSION_FILE, FileAccess.READ)
	if file:
		var json_string: String = file.get_as_text()
		file.close()
		
		var json: JSON = JSON.new()
		if json.parse(json_string) == OK:
			var session_data: Dictionary = json.data
			
			if "session_token" in session_data:
				session_token = session_data["session_token"]
			
			if "refresh_token" in session_data:
				refresh_token = session_data["refresh_token"]
			
			if "user_id" in session_data:
				user_id = session_data["user_id"]
			
			if "username" in session_data:
				username = session_data["username"]
			
			if "device_id" in session_data:
				device_id = session_data["device_id"]

# --- Public API ---
func logout() -> void:
	session_token = ""
	refresh_token = ""
	user_id = ""
	username = ""
	is_connected = false
	
	var file: FileAccess = FileAccess.open(SESSION_FILE, FileAccess.WRITE)
	if file:
		file.store_string("{}")
		file.close()
	
	session_created.emit(false, "Logged out")

func get_auth_headers() -> PackedStringArray:
	if session_token.is_empty():
		return []
	
	return ["Authorization: Bearer %s" % session_token]

func is_session_valid() -> bool:
	return not session_token.is_empty() and is_connected

# --- RPC Communication ---
func send_rpc(rpc_id: String, payload: String) -> Dictionary:
	if not is_session_valid():
		return {"error": "Not authenticated"}
	
	var url: String = "%s/v2/rpc/%s" % [base_url, rpc_id]
	var headers: PackedStringArray = get_auth_headers()
	
	headers.append("Content-Type: application/json")
	
	var error_code: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, payload)
	
	if error_code != OK:
		return {"error": "Failed to send RPC request"}
	
	var result: Array = await http_request.request_completed
	
	var response_data: Dictionary = {}
	
	if result[1] >= 200 and result[1] < 300:
		var json: JSON = JSON.new()
		if json.parse(result[3].get_string_from_utf8()) == OK:
			response_data = json.data
		else:
			response_data = {"error": "Failed to parse response"}
	else:
		var json: JSON = JSON.new()
		if json.parse(result[3].get_string_from_utf8()) == OK:
			var parsed: Dictionary = json.data
			if parsed.has("error"):
				response_data = {"error": parsed.error}
			elif parsed.has("message"):
				response_data = {"error": parsed.message}
			else:
				response_data = {"error": "Unknown error"}
		else:
			response_data = {"error": "HTTP error: %d" % result[1]}
	
	return response_data
