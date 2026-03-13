extends Node

# --- Environment Types ---
enum EnvironmentType {
	DEVELOPMENT,
	STAGING,
	PRODUCTION
}

# --- Configuration ---
@export var server_url: String = ""
@export var server_port: int = 0
@export var server_key: String = ""

# --- Environment State ---
var current_environment: EnvironmentType = EnvironmentType.DEVELOPMENT

# --- Default Configs (Development Only) ---
const DEFAULT_CONFIG: Dictionary = {
	EnvironmentType.DEVELOPMENT: {
		"server_url": "127.0.0.1",
		"server_port": 7350,
		"server_key": "defaultkey"
	},
	EnvironmentType.STAGING: {
		"server_url": "staging.armoredarcher.example.com",
		"server_port": 7350,
		"server_key": ""
	},
	EnvironmentType.PRODUCTION: {
		"server_url": "",
		"server_port": 0,
		"server_key": ""
	}
}

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
signal session_created(success: bool, error_message: String)
signal session_refreshed(success: bool, error_message: String)
signal connection_status_changed(is_online: bool)
signal reconnection_attempted(success: bool, attempt_number: int)
signal connection_lost(reason: String)

# --- Constants ---
const SESSION_FILE: String = "user://session_data.json"

# --- Reconnection Configuration ---
const MAX_RETRY_ATTEMPTS: int = 3
const RETRY_DELAY_SECONDS: float = 2.0
const RECONNECT_ON_FOCUS: bool = true

# --- Reconnection State ---
var _reconnect_timer: Timer = null
var _retry_attempts: int = 0
var _is_reconnecting: bool = false
var _last_connection_loss_reason: String = ""

# --- Environment Variables ---
func _detect_environment() -> EnvironmentType:
	# Check for explicit environment setting
	var env_name: String = OS.get_environment("ARMORED_ARCHER_ENVIRONMENT")
	if not env_name.is_empty():
		match env_name.to_lower():
			"production", "prod":
				return EnvironmentType.PRODUCTION
			"staging", "stage":
				return EnvironmentType.STAGING
			"development", "dev":
				return EnvironmentType.DEVELOPMENT

	# Auto-detect based on build type or other indicators
	# Check for debug build (typically development)
	if OS.is_debug_build():
		return EnvironmentType.DEVELOPMENT

	# Default to staging for release builds unless explicitly configured
	return EnvironmentType.STAGING

func _load_environment_variables() -> void:
	# Detect current environment
	current_environment = _detect_environment()

	# Get environment-specific configuration
	var env_url: String = OS.get_environment("NAKAMA_SERVER_URL")
	var env_port: String = OS.get_environment("NAKAMA_SERVER_PORT")
	var env_key: String = OS.get_environment("NAKAMA_SERVER_KEY")

	# Load from environment variables if set
	if not env_url.is_empty():
		server_url = env_url
	else:
		# Fall back to environment-specific defaults
		server_url = DEFAULT_CONFIG[current_environment]["server_url"]
		_log_config_warning("NAKAMA_SERVER_URL", server_url)

	if not env_port.is_empty():
		server_port = int(env_port)
	else:
		# Fall back to environment-specific defaults
		server_port = DEFAULT_CONFIG[current_environment]["server_port"]
		_log_config_warning("NAKAMA_SERVER_PORT", str(server_port))

	if not env_key.is_empty():
		server_key = env_key
	else:
		# Fall back to environment-specific defaults
		server_key = DEFAULT_CONFIG[current_environment]["server_key"]
		_log_config_warning("NAKAMA_SERVER_KEY", server_key)

	_validate_required_config()

func _log_config_warning(variable_name: String, fallback_value: String) -> void:
	if current_environment == EnvironmentType.PRODUCTION:
		push_error("PRODUCTION: %s not set! Using fallback: %s. Configure proper environment variables for production!" % [variable_name, fallback_value])
		# Log critical security warning for production
		_log_security_warning("Missing required environment variable in production: %s" % variable_name)
	elif current_environment == EnvironmentType.STAGING:
		push_warning("STAGING: %s not set, using fallback: %s" % [variable_name, fallback_value])
	else:
		push_warning("DEVELOPMENT: %s not set, using default: %s" % [variable_name, fallback_value])

func _log_security_warning(message: String) -> void:
	# Log security-related warnings for audit trail
	print("SECURITY: %s" % message)
	# Could also send to analytics/alerting system in production

func _log_environment_info() -> void:
	var env_name: String = EnvironmentType.keys()[current_environment]
	print("=== NetworkManager Environment Info ===")
	print("Environment: %s" % env_name)
	print("Server URL: %s" % server_url)
	print("Server Port: %d" % server_port)
	print("Server Key: %s" % ("[SET]" if not server_key.is_empty() else "[NOT SET]"))
	print("========================================")

	if current_environment == EnvironmentType.PRODUCTION:
		print("WARNING: Running in PRODUCTION mode - ensure all secrets are properly configured!")

func _validate_required_config() -> void:
	var missing_vars: Array[String] = []
	var is_production: bool = current_environment == EnvironmentType.PRODUCTION

	# Production requires all config to be properly set via environment variables
	if server_url.is_empty() or (is_production and server_url == DEFAULT_CONFIG[EnvironmentType.PRODUCTION]["server_url"]):
		missing_vars.append("NAKAMA_SERVER_URL")

	if server_port == 0 or (is_production and server_port == DEFAULT_CONFIG[EnvironmentType.PRODUCTION]["server_port"]):
		missing_vars.append("NAKAMA_SERVER_PORT")

	# Server key is critical in production - warn if using defaults
	if is_production:
		if server_key.is_empty() or server_key == "defaultkey":
			missing_vars.append("NAKAMA_SERVER_KEY (CRITICAL: Using default key in production is insecure!)")
	elif server_key.is_empty():
		missing_vars.append("NAKAMA_SERVER_KEY")

	if not missing_vars.is_empty():
		var warning_msg: String = "Environment: %s | Missing required config: %s" % [
			EnvironmentType.keys()[current_environment],
			", ".join(missing_vars)
		]
		if is_production:
			push_error("PRODUCTION SECURITY ERROR: %s" % warning_msg)
			# In production, we could also disable network operations if critical config is missing
		else:
			push_warning(warning_msg)

# --- Initialization ---
func _ready() -> void:
	_load_environment_variables()
	_log_environment_info()
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
func _on_http_request_completed(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
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

		# Log network error for analytics
		_log_network_error("connection_failed", "/v2/account/authenticate/device", response_code)
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

		# Log authentication error for analytics
		_log_network_error("authentication_failed", "/v2/account/authenticate/device", response_code)

func _log_network_error(error_type: String, endpoint: String, status_code: int) -> void:
	# Use AnalyticsManager if available
	if has_node("/root/AnalyticsManager"):
		var analytics: Node = get_node("/root/AnalyticsManager")
		if analytics.has_method("log_network_error"):
			analytics.log_network_error(error_type, endpoint, status_code)

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

# --- Environment Info ---
func get_environment() -> EnvironmentType:
	return current_environment

func get_environment_name() -> String:
	return EnvironmentType.keys()[current_environment]

func is_production() -> bool:
	return current_environment == EnvironmentType.PRODUCTION

func is_development() -> bool:
	return current_environment == EnvironmentType.DEVELOPMENT

func is_staging() -> bool:
	return current_environment == EnvironmentType.STAGING

# --- RPC Communication ---
func send_rpc(rpc_id: String, payload: String, timeout: float = 30.0) -> Dictionary:
	if not is_session_valid():
		return {"error": "Not authenticated"}

	var start_time: int = Time.get_ticks_msec()
	var url: String = "%s/v2/rpc/%s" % [base_url, rpc_id]
	var headers: PackedStringArray = get_auth_headers()

	headers.append("Content-Type: application/json")

	# Set up timeout handling
	var timer: Timer = Timer.new()
	timer.wait_time = timeout
	timer.one_shot = true
	add_child(timer)

	var timed_out: bool = false
	var request_result: Array = []

	var on_timeout: Callable = func():
		timed_out = true
		http_request.cancel_request()

	var on_request_completed: Callable = func(result: Array):
		request_result = result
		timer.stop()

	timer.timeout.connect(on_timeout, CONNECT_ONE_SHOT)
	http_request.request_completed.connect(on_request_completed, CONNECT_ONE_SHOT)

	timer.start()

	var error_code: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, payload)

	if error_code != OK:
		timer.queue_free()
		return {"error": "Failed to send RPC request"}

	await http_request.request_completed

	timer.queue_free()

	# Check if request timed out
	if timed_out:
		return {"error": "Request timed out after %.1f seconds" % timeout}

	# Process the successful response
	var response_data: Dictionary = {}
	var result = request_result

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

	# Log RPC latency for analytics
	var latency_ms: int = Time.get_ticks_msec() - start_time
	_log_rpc_latency(rpc_id, latency_ms)

	return response_data

## Sends an RPC request without waiting for response (fire-and-forget).
## Used for notifications like stage completion where we don't need the result.
func send_rpc_async(rpc_id: String, payload: String, _timeout: float = 10.0) -> void:
	if not is_session_valid():
		push_warning("Cannot send RPC: not authenticated")
		return

	var url: String = "%s/v2/rpc/%s" % [base_url, rpc_id]
	var headers: PackedStringArray = get_auth_headers()
	headers.append("Content-Type: application/json")

	# Fire request without waiting - we don't care about the response
	var error_code: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, payload)
	if error_code != OK:
		push_warning("Failed to send async RPC: %s" % rpc_id)

func _log_rpc_latency(rpc_name: String, latency_ms: int) -> void:
	# Use AnalyticsManager if available
	if has_node("/root/AnalyticsManager"):
		var analytics: Node = get_node("/root/AnalyticsManager")
		if analytics.has_method("log_rpc_latency"):
			analytics.log_rpc_latency(rpc_name, latency_ms)

# ==================== RECONNECTION HANDLING ====================

## Initiates a reconnection attempt with exponential backoff
func attempt_reconnection() -> void:
	if _is_reconnecting:
		return

	if _retry_attempts >= MAX_RETRY_ATTEMPTS:
		push_warning("Max reconnection attempts (%d) reached" % MAX_RETRY_ATTEMPTS)
		reconnection_attempted.emit(false, _retry_attempts)
		_reset_reconnection_state()
		return

	_is_reconnecting = true
	_retry_attempts += 1

	reconnection_attempted.emit(true, _retry_attempts)

	# Start retry timer
	if _reconnect_timer:
		_reconnect_timer.queue_free()

	_reconnect_timer = Timer.new()
	_reconnect_timer.wait_time = RETRY_DELAY_SECONDS * _retry_attempts  # Exponential backoff
	_reconnect_timer.one_shot = true
	_reconnect_timer.timeout.connect(_on_reconnect_timer_timeout)
	add_child(_reconnect_timer)
	_reconnect_timer.start()

## Handles the reconnection timer timeout
func _on_reconnect_timer_timeout() -> void:
	if not session_token.is_empty():
		_refresh_session()
	elif not device_id.is_empty():
		authenticate_device()
	else:
		# No credentials to reconnect with
		_is_reconnecting = false
		reconnection_attempted.emit(false, _retry_attempts)

## Resets the reconnection state
func _reset_reconnection_state() -> void:
	_is_reconnecting = false
	_retry_attempts = 0
	if _reconnect_timer:
		_reconnect_timer.queue_free()
		_reconnect_timer = null

## Handles connection loss - should be called when network is detected as down
func handle_connection_lost(reason: String = "Network connection lost") -> void:
	if is_offline:
		return  # Already in offline mode

	_last_connection_loss_reason = reason
	is_connected = false
	is_offline = true
	connection_lost.emit(reason)
	connection_status_changed.emit(false)

	# Attempt automatic reconnection
	attempt_reconnection()

## Handles successful reconnection
func handle_reconnection() -> void:
	is_offline = false
	is_connected = true
	connection_status_changed.emit(true)
	_reset_reconnection_state()

	# Refresh session after reconnection
	if not refresh_token.is_empty():
		_refresh_session()

## Checks if we are currently in a reconnection attempt
func is_reconnecting() -> bool:
	return _is_reconnecting

## Gets the number of retry attempts made
func get_retry_attempts() -> int:
	return _retry_attempts

## Checks if offline mode is active
func is_network_offline() -> bool:
	return is_offline

## Force sets the offline mode (for UI toggles or testing)
func set_offline_mode(offline: bool) -> void:
	if is_offline != offline:
		is_offline = offline
		if offline:
			is_connected = false
		connection_status_changed.emit(not offline)

# --- Cleanup ---
func _exit_tree() -> void:
	# Clean up HTTP request node
	if http_request != null:
		http_request.queue_free()
		http_request = null

	# Clean up reconnection timer
	if _reconnect_timer != null:
		_reconnect_timer.queue_free()
		_reconnect_timer = null

	print("[NetworkManager] Cleanup complete - all resources released")
