extends Node

# Preloaded so we can use shared network constants (issue #908).
const NetworkConsts := preload("res://autoloads/const.gd")

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
var _is_refreshing: bool = false  # Track if current request is a refresh

# --- HTTP Requests ---
var http_request: HTTPRequest
var base_url: String
var _request_counter: int = 0  # Track individual requests
var _current_request_id: int = 0  # Track current request for debugging

# --- Signals ---
signal session_created(success: bool, error_message: String)
signal session_refreshed(success: bool, error_message: String)
signal connection_status_changed(is_online: bool)
signal reconnection_attempted(success: bool, attempt_number: int)
signal connection_lost(reason: String)
# Issue #908: emitted when auth is blocked because the bounded timeout/health-gate fired.
# `guidance` is a short user-facing string the UI renders. Issue #1079: dev-runbook
# guidance (e.g. "run: make services-start") is gated to non-production environments;
# production players get player-safe text instead.
signal auth_blocked(reason: String, guidance: String)
# Issue #1147: emitted as mid-session auth recovery advances through its
# stages (AUTH_RECOVERY_STAGE_*) so the UI can swap its spinner text while
# the coalesced refresh (or its device-auth fallback) is in flight.
signal auth_recovery_stage(stage: String)

# --- Constants ---
const SESSION_FILE: String = "user://session_data.json"

# Issue #1079: player-safe auth_blocked guidance for production builds.
# Dev-runbook strings ("make services-start", "press Retry") never reach players.
const AUTH_GUIDANCE_PLAYER_SESSION_EXPIRED: String = "Session expired. Please sign in again."
const AUTH_GUIDANCE_PLAYER_CONNECTION_PROBLEM: String = "Connection problem. Please try again."

# Issue #1147: auth_recovery_stage messages. The recovery wait emits
# "refresh_started" when it kicks off _refresh_session(), then exactly one of
# "refreshed" (fresh token stored), "blocked" (auth_blocked gate fired), or
# "failed" (refresh reported failure / deadline passed without either signal).
const AUTH_RECOVERY_STAGE_REFRESH_STARTED: String = "refresh_started"
const AUTH_RECOVERY_STAGE_REFRESHED: String = "refreshed"
const AUTH_RECOVERY_STAGE_BLOCKED: String = "blocked"
const AUTH_RECOVERY_STAGE_FAILED: String = "failed"

# --- Reconnection Configuration ---
const MAX_RETRY_ATTEMPTS: int = 3
const RETRY_DELAY_SECONDS: float = 2.0
const RECONNECT_ON_FOCUS: bool = true

# --- Issue #908: bounded auth timeout + health-gate state ---
# overall bound for the auth sequence (incl. retries) — kept under 15s acceptance limit
var _auth_started_at_ms: int = -1
var _auth_outer_timer: Timer = null
var _auth_pending_attempts: int = 0
var _auth_blocked_emitted: bool = false
# tracks whether `_try_auto_connect` already issued a health-gate probe
var _last_health_check_passed: bool = false

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

	# Issue #908: silently fall back to the documented local-dev default
	# ("defaultkey", which must match backend/data/nakama.yml:14 → runtime.http_key).
	# Setting ARMORED_ARCHER_ALLOW_EMPTY_SERVER_KEY=1 re-enables strict behaviour
	# so tests can still exercise the empty-key failure path.
	if server_key.is_empty() and OS.get_environment("ARMORED_ARCHER_ALLOW_EMPTY_SERVER_KEY") != "1":
		server_key = NetworkConsts.DEFAULT_SERVER_KEY
		print("NetworkManager: empty server_key auto-corrected to '%s' (matches backend runtime.http_key). Set NAKAMA_SERVER_KEY to override." % server_key)

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
	# E2E isolation: when running smoke tests / E2E suites, stay quiet and don't auto-connect
	if OS.get_environment("E2E_TEST") == "1":
		is_offline = true
		print("[E2E] NetworkManager running in isolated E2E mode — network disabled")
		return

	_load_environment_variables()
	_log_environment_info()
	base_url = "http://%s:%d" % [server_url, server_port]

	http_request = HTTPRequest.new()
	add_child(http_request)

	# Configure HTTPRequest for Godot 4.6
	http_request.timeout = 30
	http_request.use_threads = true  # Required for async requests
	http_request.max_redirects = 0   # Don't follow redirects automatically

	var _err = http_request.request_completed.connect(_on_http_request_completed)

	_load_session_from_file()

	if device_id.is_empty():
		_generate_device_id()
	
	# If session exists but without refresh token, clear it to force fresh authentication
	# This prevents trying to refresh with an invalid/expired session
	if not session_token.is_empty() and refresh_token.is_empty():
		session_token = ""
		user_id = ""
		username = ""

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

# --- State ---
var is_authenticating: bool = false

# --- Authentication ---
# Issue #908: auth is now gated by a /v2/health probe AND bounded by MAX_AUTH_DURATION_SEC,
# with up to 3 attempts at delays 1s/2s/4s before we raise auth_blocked (the UI shows the
# error panel). Both layers are required: the health gate stops us from sending a doomed
# authenticate/device request into a black hole, and the outer timer caps total wait time.
func authenticate_device() -> void:
	if is_offline:
		session_created.emit(false, "Cannot authenticate while offline")
		return

	# Prevent duplicate authentication requests
	if is_authenticating:
		return

	# Bounded outer timer: if (gate + retries) exceeds MAX_AUTH_DURATION_SEC we
	# emit auth_blocked and stop trying so the UI gets an actionable error.
	_start_auth_outer_timer()

	# Issue #908 — health-gate: probe /v2/health before authenticating. If the probe
	# fails we short-circuit to auth_blocked with an operator-actionable message.
	if not _last_health_check_passed:
		_run_health_gate_then_auth()
		return

	_rpc_request_active = false  # Issue #1079: auth requests are never RPC responses
	_is_refreshing = false  # This is NOT a refresh request
	is_authenticating = true

	var url: String = "%s/v2/account/authenticate/device" % base_url
	
	# Use Basic auth with server key as both username and password (Nakama default)
	var auth_string: String = Marshalls.utf8_to_base64("%s:" % server_key)
	var headers: PackedStringArray = [
		"Content-Type: application/json",
		"Accept: application/json",
		"Authorization: Basic %s" % auth_string
	]
	var body: Dictionary = {
		"id": device_id,
		"create": true
	}

	var json: JSON = JSON.new()
	var json_string: String = JSON.stringify(body)
	
	# Track this request for debugging
	_current_request_id += 1
	var this_request_id: int = _current_request_id

	# Cancel any pending request first
	if http_request.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED:
		http_request.cancel_request()

	# Small delay to ensure HTTPRequest is ready (prevents race condition)
	await get_tree().process_frame

	_request_counter += 1
	var error: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, json_string)

	if error != OK:
		is_authenticating = false
		session_created.emit(false, "Failed to send authentication request (Error: %d)" % error)
		is_offline = true
		connection_status_changed.emit(false)

# ==================== ISSUE #908: HEALTH-GATE + BOUNDED RETRY ====================

## Runs a synchronous-feeling /v2/health probe. Resolves true if Nakama answered
## 200 within HEALTH_CHECK_TIMEOUT_SEC, false otherwise. Never throws.
func _probe_health() -> bool:
	if http_request == null:
		return false
	var url: String = "%s%s" % [base_url, NetworkConsts.HEALTH_GATE_PATH]
	var timer: Timer = Timer.new()
	timer.wait_time = NetworkConsts.HEALTH_CHECK_TIMEOUT_SEC
	timer.one_shot = true
	add_child(timer)
	var result: Array = []
	var done: bool = false
	var _t1 = timer.timeout.connect(func():
		if not done:
			done = true
			if http_request.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED:
				http_request.cancel_request()
	, CONNECT_ONE_SHOT)
	var _t2 = http_request.request_completed.connect(func(_r: int, code: int, _h: PackedStringArray, _b: PackedByteArray):
		if not done:
			done = true
			result = [code]
	, CONNECT_ONE_SHOT)
	var err: Error = http_request.request(url, PackedStringArray(), HTTPClient.METHOD_GET, "")
	if err != OK:
		timer.queue_free()
		return false
	timer.start()
	while not done:
		await get_tree().process_frame
	timer.queue_free()
	if result.is_empty():
		return false
	var code: int = result[0]
	return code >= 200 and code < 300

## Health-gate wrapper: probes first; on failure emits auth_blocked and stops.
## On success, clears the gate flag and re-issues authenticate_device().
func _run_health_gate_then_auth() -> void:
	var probe_ok: bool = await _probe_health()
	if not probe_ok:
		is_authenticating = false
		_last_health_check_passed = false
		_emit_auth_blocked(
			"Cannot reach Nakama at %s" % base_url,
			_gate_auth_guidance(
				"Backend not reachable. Run: make services-start",
				AUTH_GUIDANCE_PLAYER_CONNECTION_PROBLEM
			)
		)
		return
	_last_health_check_passed = true
	# Re-enter authenticate_device with the gate cleared; this will fall through to
	# the actual request.
	_issue_auth_request_with_retry()

## Issues the real /v2/account/authenticate/device call inside the bounded retry
## envelope defined by NetworkConsts.AUTH_RETRY_DELAYS. Stops on success, on auth_blocked,
## or when the outer auth timer fires.
func _issue_auth_request_with_retry() -> void:
	# Reset outer timer for the actual request phase.
	_start_auth_outer_timer()
	_attempt_auth_with_retry_loop(0)

func _attempt_auth_with_retry_loop(attempt_index: int) -> void:
	if _auth_blocked_emitted:
		return
	if attempt_index >= NetworkConsts.AUTH_RETRY_DELAYS.size() + 1:
		# Exhausted retries — emit auth_blocked.
		_emit_auth_blocked(
			"Authentication timed out after %d attempts." % (attempt_index),
			_gate_auth_guidance(
				"Backend is slow or unreachable. Run: make services-start, then press Retry.",
				AUTH_GUIDANCE_PLAYER_CONNECTION_PROBLEM
			)
		)
		return
	_auth_pending_attempts = attempt_index + 1
	# Wait for the per-attempt delay (skip on the very first attempt).
	if attempt_index > 0:
		var delay: float = NetworkConsts.AUTH_RETRY_DELAYS[attempt_index - 1]
		await get_tree().create_timer(delay).timeout
	if _auth_blocked_emitted:
		return
	_actually_send_device_auth(attempt_index)

func _actually_send_device_auth(attempt_index: int) -> void:
	_rpc_request_active = false  # Issue #1079: auth requests are never RPC responses
	_is_refreshing = false
	is_authenticating = true
	var url: String = "%s%s" % [base_url, NetworkConsts.DEVICE_AUTH_PATH]
	var auth_string: String = Marshalls.utf8_to_base64("%s:" % server_key)
	var headers: PackedStringArray = [
		"Content-Type: application/json",
		"Accept: application/json",
		"Authorization: Basic %s" % auth_string
	]
	var body: Dictionary = {"id": device_id, "create": true}
	var json_string: String = JSON.stringify(body)
	_current_request_id += 1
	if http_request.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED:
		http_request.cancel_request()
	await get_tree().process_frame
	_request_counter += 1
	var error: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, json_string)
	if error != OK:
		is_authenticating = false
		# Treat as a retryable transport error.
		_attempt_auth_with_retry_loop(attempt_index + 1)
		await get_tree().process_frame  # ensure call above runs
		return
	# Wait for response or for outer timeout. _on_http_request_completed will
	# either mark us connected or send us through the retry path on auth errors.
	var waited_ms: int = 0
	var poll_ms: int = 50
	while is_authenticating and not _auth_blocked_emitted:
		await get_tree().create_timer(poll_ms / 1000.0).timeout
		waited_ms += poll_ms
		if not _last_health_check_passed:
			return  # health gate cleared by probe failure during retry
	# If still authenticating after the loop (i.e., outer timer fired), retry once more.
	if not _auth_blocked_emitted and not is_connected:
		_attempt_auth_with_retry_loop(attempt_index + 1)

## Starts (or restarts) the bounded outer auth timer. On timeout, raises auth_blocked.
func _start_auth_outer_timer() -> void:
	if _auth_outer_timer and is_instance_valid(_auth_outer_timer):
		_auth_outer_timer.queue_free()
	_auth_started_at_ms = Time.get_ticks_msec()
	_auth_blocked_emitted = false
	_auth_outer_timer = Timer.new()
	_auth_outer_timer.wait_time = NetworkConsts.MAX_AUTH_DURATION_SEC
	_auth_outer_timer.one_shot = true
	var _t = _auth_outer_timer.timeout.connect(_on_auth_outer_timeout)
	add_child(_auth_outer_timer)
	_auth_outer_timer.start()

func _on_auth_outer_timeout() -> void:
	if _auth_blocked_emitted:
		return
	is_authenticating = false
	is_offline = true
	connection_status_changed.emit(false)
	_emit_auth_blocked(
		"Authentication did not complete within %.0fs" % NetworkConsts.MAX_AUTH_DURATION_SEC,
		_gate_auth_guidance(
			"Backend did not respond in time. Run: make services-start, then press Retry.",
			AUTH_GUIDANCE_PLAYER_CONNECTION_PROBLEM
		)
	)

func _emit_auth_blocked(reason: String, guidance: String) -> void:
	if _auth_blocked_emitted:
		return
	_auth_blocked_emitted = true
	_last_health_check_passed = false
	push_warning("NetworkManager: auth blocked — %s" % reason)
	auth_blocked.emit(reason, guidance)

## Public: returns true if the most recent /v2/health probe succeeded.
func health_check() -> bool:
	_last_health_check_passed = await _probe_health()
	return _last_health_check_passed

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

	_rpc_request_active = false  # Issue #1079: auth requests are never RPC responses
	_is_refreshing = true  # Mark this as a refresh request

	var url: String = "%s/v2/account/session/refresh" % base_url
	
	# Use Basic auth with server key for session refresh (required by Nakama)
	var auth_string: String = Marshalls.utf8_to_base64("%s:" % server_key)
	var headers: PackedStringArray = [
		"Content-Type: application/json",
		"Accept: application/json",
		"Authorization: Basic %s" % auth_string
	]
	var body: Dictionary = {
		"token": refresh_token
	}

	var json: JSON = JSON.new()
	var json_string: String = JSON.stringify(body)

	_request_counter += 1
	var error: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, json_string)

	if error != OK:
		_is_refreshing = false
		authenticate_device()

# --- HTTP Response Handling ---
func _on_http_request_completed(_result: int, response_code: int, headers: PackedStringArray, body: PackedByteArray) -> void:
	# Reset authentication flag
	is_authenticating = false

	var response_text: String = body.get_string_from_utf8()

	if response_code >= 200 and response_code < 300:
		var json: JSON = JSON.new()
		var parse_result: Error = json.parse(response_text)

		if parse_result == OK:
			var response_data: Dictionary = json.data

			if "token" in response_data:
				# Check connection state BEFORE updating session
				var was_connected: bool = is_connected

				_update_session_from_response(response_data)

				if not was_connected:
					is_connected = true
					session_created.emit(true, "")
					session_refreshed.emit(true, "")
				else:
					session_refreshed.emit(true, "")

				is_offline = false
				connection_status_changed.emit(true)
				_auth_blocked_emitted = true  # success — cancel outer timer pathway
			else:
				session_created.emit(false, "Server response missing token")
		else:
			session_created.emit(false, "Failed to parse server response")
	else:
		# If this was a refresh request, fall back to device authentication
		if _is_refreshing:
			_is_refreshing = false
			authenticate_device()
		elif _rpc_request_active and (response_code == 401 or response_code == 403):
			# Issue #1079: RPC auth errors are handled by send_rpc's recovery
			# (one coalesced refresh + single replay). Routing them into
			# _handle_authentication_error leaked dev-runbook guidance to
			# players on every mid-session 401 — do not do that.
			pass
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

## Issue #1079: player-facing auth guidance must never contain dev-runbook
## strings. Dev guidance is restricted to non-production environments; the
## production environment (the only one players run) gets player-safe text.
func _gate_auth_guidance(dev_guidance: String, player_guidance: String) -> String:
	if is_production():
		return player_guidance
	return dev_guidance

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
		# Issue #908: surface an actionable error to the UI immediately. The outer
		# timer will not fire a second auth_blocked because _auth_blocked_emitted
		# is now true.
		_emit_auth_blocked(
			"%s (HTTP %d)" % [error_message, response_code],
			_gate_auth_guidance(
				"Authentication rejected. Run: make services-start, then press Retry.",
				AUTH_GUIDANCE_PLAYER_SESSION_EXPIRED
			)
		)

func _log_network_error(error_type: String, endpoint: String, status_code: int) -> void:
	# Use AnalyticsManager if available
	var analytics = get_node_or_null("/root/AnalyticsManager")
	if analytics and analytics.has_method("log_network_error"):
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
		var _err = file.store_string(JSON.stringify(session_data))
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
		var _err = file.store_string("{}")
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
# Track RPC request ID separately from auth request ID
var _rpc_request_id: int = 0
var _pending_rpc_callbacks: Dictionary = {}  # Map request_id to callback info
var _rpc_busy: bool = false  # Serialize requests to single HTTPRequest node

# --- Issue #1079: Mid-Session Auth Recovery (401/403 refresh + replay) ---
# True while the shared HTTPRequest node is servicing an RPC (send_rpc or
# send_rpc_async) rather than an auth request, so _on_http_request_completed
# can route 401/403s to recovery instead of the startup auth-error UI path.
var _rpc_request_active: bool = false
# Re-entrancy guard: concurrent RPC auth errors coalesce into ONE refresh.
var _refreshing_session: bool = false
# Outcome of the most recent coalesced refresh, read by coalesced waiters.
var _last_refresh_succeeded: bool = false
# Issue #1147: reason carried from the most recent auth_blocked emission that
# aborted a coalesced refresh; read by _send_rpc_with_recovery so the
# in-flight RPC surfaces the gate's reason instead of the stale 401 body.
# Empty when the last recovery cycle was not gated.
var _last_auth_blocked_reason: String = ""
# Issue #1151: waiter watchdog. Bounds BOTH the leader's refresh wait
# (_run_refresh_and_await_result) and each coalesced waiter by the
# MAX_AUTH_DURATION_SEC deadline so a stalled leader cannot freeze the main
# thread forever. The frame-count cap is a backstop against wallclock drift
# (e.g. system clock changes during a long session). Tests override these to
# a smaller value for fast turnaround; production keeps the default deadlines.
var _refresh_watchdog_ms: int = int(NetworkConsts.MAX_AUTH_DURATION_SEC * 1000.0)
var _refresh_watchdog_max_frames: int = int(NetworkConsts.MAX_AUTH_DURATION_SEC * 60.0)

func send_rpc(rpc_id: String, payload: String, timeout: float = 30.0) -> Dictionary:
	# Issue #1079: thin public wrapper. The not-authenticated early return must
	# stay synchronous because callers (and tests) invoke send_rpc without
	# await on this path; recovery + replay live in _send_rpc_with_recovery.
	if not is_session_valid():
		return {"error": "Not authenticated", "is_auth_error": false}
	return await _send_rpc_with_recovery(rpc_id, payload, timeout, false)

## Issue #1079: send_rpc implementation with mid-session auth recovery. On a
## 401/403 it performs ONE automatic session refresh (coalesced across
## concurrent RPCs via _refreshing_session) and replays the original request
## exactly once; `is_replay` marks that replay so a second auth error surfaces
## the error instead of looping.
func _send_rpc_with_recovery(rpc_id: String, payload: String, timeout: float, is_replay: bool) -> Dictionary:
	if not is_session_valid():
		return {"error": "Not authenticated", "is_auth_error": false}

	# Wait for any in-flight request to complete
	while _rpc_busy:
		await get_tree().process_frame

	_rpc_busy = true

	# Increment RPC request ID
	_rpc_request_id += 1
	var this_rpc_id: int = _rpc_request_id

	var start_time: int = Time.get_ticks_msec()
	var url: String = "%s/v2/rpc/%s" % [base_url, rpc_id]
	# Issue #1079: remember the token this request is signed with so recovery
	# can tell whether a concurrent refresh already rotated it.
	var token_used: String = session_token
	var headers: PackedStringArray = get_auth_headers()

	var _err = headers.append("Content-Type: application/json")

	# Wrap payload in JSON object as expected by Nakama HTTP API
	# Nakama expects: {"payload": "<json_string>"} for POST requests
	var body: Dictionary = {"payload": payload}
	var json_body: String = JSON.stringify(body)

	# Set up timeout handling
	var timer: Timer = Timer.new()
	timer.wait_time = timeout
	timer.one_shot = true
	add_child(timer)

	var timed_out: bool = false
	var request_result: Array = []
	var response_received: bool = false

	var on_timeout: Callable = func():
		timed_out = true
		http_request.cancel_request()

	var on_request_completed: Callable = func(_result: int, _response_code: int, _headers: PackedStringArray, body: PackedByteArray):
		request_result = [_result, _response_code, _headers, body, this_rpc_id]
		response_received = true
		if is_instance_valid(timer):
			timer.stop()

	var _err1 = timer.timeout.connect(on_timeout, CONNECT_ONE_SHOT)
	var _err2 = http_request.request_completed.connect(on_request_completed, CONNECT_ONE_SHOT)

	timer.start()

	# Issue #1079: mark the shared node as servicing an RPC until this
	# coroutine finishes processing, so the persistent completion handler does
	# not misroute a 401/403 into the startup auth-error UI path.
	_rpc_request_active = true
	var error_code: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, json_body)

	if error_code != OK:
		_rpc_request_active = false
		timer.queue_free()
		_rpc_busy = false
		return {"error": "Failed to send RPC request"}

	# Wait for response with timeout protection
	while not response_received and not timed_out:
		await get_tree().process_frame

	_rpc_request_active = false
	timer.queue_free()

	# Check if request timed out
	if timed_out:
		_rpc_busy = false
		return {"error": "Request timed out after %.1f seconds" % timeout}

	# Process the successful response
	var response_data: Dictionary = {}
	var is_auth_error: bool = false
	var result = request_result

	# Validate that request_result has enough elements (should have 5: result, code, headers, body, rpc_id)
	if result.size() < 4:
		push_error("Request result incomplete: got %d elements, expected 5. Response received: %s" % [result.size(), response_received])
		_rpc_busy = false
		return {"error": "Invalid response: request_result is incomplete", "is_auth_error": false}

	var rpc_id_completed: int = -1
	if result.size() >= 5:
		rpc_id_completed = result[4]


	if result[1] >= 200 and result[1] < 300:
		var json: JSON = JSON.new()
		if json.parse(result[3].get_string_from_utf8()) == OK:
			response_data = json.data
		else:
			response_data = {"error": "Failed to parse response", "is_auth_error": false}
	else:
		# Check if this is an authentication error (401, 403) vs a server error (400, 500, etc.)
		is_auth_error = (result[1] == 401 or result[1] == 403)

		var json: JSON = JSON.new()
		if json.parse(result[3].get_string_from_utf8()) == OK:
			var parsed: Dictionary = json.data
			if parsed.has("error"):
				response_data = {"error": parsed.error, "is_auth_error": is_auth_error}
			elif parsed.has("message"):
				response_data = {"error": parsed.message, "is_auth_error": is_auth_error}
			else:
				response_data = {"error": "HTTP error: %d" % result[1], "is_auth_error": is_auth_error}
		else:
			response_data = {"error": "HTTP error: %d" % result[1], "is_auth_error": is_auth_error}

	# Issue #1079: on an auth error, attempt ONE coalesced session refresh and
	# replay the original request exactly once before surfacing the error.
	if is_auth_error and not is_replay:
		_rpc_busy = false
		if await _recover_session_after_auth_error(token_used):
			# Single replay with the refreshed token; is_replay prevents loops.
			return await _send_rpc_with_recovery(rpc_id, payload, timeout, true)
		# Refresh failed — fall through and surface the original auth error.
		# Issue #1147: unless the auth_blocked gate aborted the recovery, in
		# which case its reason replaces the stale 401 body so the in-flight
		# caller renders one coherent auth error instead of competing with
		# the auth_blocked UI panel.
		if not _last_auth_blocked_reason.is_empty():
			response_data = {
				"error": "Authentication blocked: %s" % _last_auth_blocked_reason,
				"is_auth_error": true
			}

	# Log RPC latency for analytics
	var latency_ms: int = Time.get_ticks_msec() - start_time
	_log_rpc_latency(rpc_id, latency_ms)

	_rpc_busy = false
	return response_data

## Issue #1079: recovers the session after an RPC auth error. Concurrent 401s
## coalesce into a single refresh via the _refreshing_session guard; if a
## concurrent recovery already rotated the token while this request was in
## flight, the caller can replay immediately without refreshing again.
## Returns true when a usable (rotated) session token is available.
func _recover_session_after_auth_error(token_used: String) -> bool:
	if token_used != session_token and not session_token.is_empty():
		# Token already rotated by a concurrent recovery — replay against it.
		return true
	if _refreshing_session:
		# Issue #1151: the leader's refresh is bounded by MAX_AUTH_DURATION_SEC,
		# but this waiter's loop had no upper bound. If the leader stalls (scene
		# tree paused, reentrant refresh, leader error path that never clears
		# _refreshing_session), the waiter would spin forever on the main thread,
		# freezing UI and input. Mirror the leader's deadline and add a frame-count
		# cap so the waiter always surfaces a refresh_failed to its caller instead
		# of hanging the game.
		var start_ms: int = Time.get_ticks_msec()
		var deadline_ms: int = start_ms + _refresh_watchdog_ms
		var max_frames: int = _refresh_watchdog_max_frames
		var frames_waited: int = 0
		while _refreshing_session and frames_waited < max_frames:
			if Time.get_ticks_msec() >= deadline_ms:
				break
			await get_tree().process_frame
			frames_waited += 1
		if _refreshing_session:
			# Watchdog fired: leader is still in-flight, but we have to surface
			# the original 401 to our caller instead of hanging. Do NOT touch
			# _refreshing_session — the leader owns it. The leader may still
			# complete and unblock subsequent RPCs.
			push_warning(
				"NetworkManager._recover_session_after_auth_error: leader refresh stalled past MAX_AUTH_DURATION_SEC=%.0fs (waiter waited %d frames / %d ms); bailing out to surface 401 to caller"
				% [NetworkConsts.MAX_AUTH_DURATION_SEC, frames_waited, Time.get_ticks_msec() - start_ms]
			)
			return false
		return _last_refresh_succeeded and not session_token.is_empty()
	_refreshing_session = true
	# Issue #1147: clear any gate reason left over from an earlier recovery
	# cycle so _send_rpc_with_recovery only surfaces a reason that belongs
	# to this cycle's refresh.
	_last_auth_blocked_reason = ""
	var refreshed: bool = await _run_refresh_and_await_result()
	_last_refresh_succeeded = refreshed
	_refreshing_session = false
	return refreshed

## Issue #1079: triggers the existing _refresh_session() machinery once and
## waits (bounded by the _refresh_watchdog_ms deadline, which mirrors
## MAX_AUTH_DURATION_SEC) for its session_refreshed signal. Returns true only
## when a fresh token was stored. On failure or timeout the caller surfaces
## the original RPC error — no retry loop.
## Issue #1147: auth_blocked is terminal for the refresh's device-auth
## fallback — session_refreshed will never arrive after the gate fires — so
## the wait listens to auth_blocked and short-circuits with false immediately
## instead of spinning until the deadline. The gate's reason is recorded in
## _last_auth_blocked_reason for the in-flight RPC caller.
func _run_refresh_and_await_result() -> bool:
	if http_request == null:
		return false
	var outcome: Array = []
	var on_refreshed: Callable = func(success: bool, _error_message: String):
		if outcome.is_empty():
			outcome.append(success)
	var on_blocked: Callable = func(reason: String, _guidance: String):
		if outcome.is_empty():
			outcome.append(false)
			_last_auth_blocked_reason = reason
	session_refreshed.connect(on_refreshed, CONNECT_ONE_SHOT)
	auth_blocked.connect(on_blocked, CONNECT_ONE_SHOT)
	auth_recovery_stage.emit(AUTH_RECOVERY_STAGE_REFRESH_STARTED)
	_refresh_session()
	var deadline_ms: int = Time.get_ticks_msec() + _refresh_watchdog_ms
	while outcome.is_empty():
		await get_tree().process_frame
		if Time.get_ticks_msec() >= deadline_ms:
			break
	# Neither signal fired before the deadline — drop the one-shot listeners
	# so they cannot linger on the singleton and fire for an unrelated later
	# auth cycle.
	if session_refreshed.is_connected(on_refreshed):
		session_refreshed.disconnect(on_refreshed)
	if auth_blocked.is_connected(on_blocked):
		auth_blocked.disconnect(on_blocked)
	if outcome.is_empty():
		push_warning(
			"NetworkManager._run_refresh_and_await_result: refresh wait hit the %d ms deadline without session_refreshed or auth_blocked"
			% _refresh_watchdog_ms
		)
		auth_recovery_stage.emit(AUTH_RECOVERY_STAGE_FAILED)
		return false
	if not bool(outcome[0]):
		if not _last_auth_blocked_reason.is_empty():
			auth_recovery_stage.emit(AUTH_RECOVERY_STAGE_BLOCKED)
		else:
			auth_recovery_stage.emit(AUTH_RECOVERY_STAGE_FAILED)
		return false
	auth_recovery_stage.emit(AUTH_RECOVERY_STAGE_REFRESHED)
	return bool(outcome[0]) and not session_token.is_empty()

## Sends an RPC request without waiting for response (fire-and-forget).
## Used for notifications like stage completion where we don't need the result.
func send_rpc_async(rpc_id: String, payload: String, _timeout: float = 10.0) -> void:
	if not is_session_valid():
		push_warning("Cannot send RPC: not authenticated")
		return

	var url: String = "%s/v2/rpc/%s" % [base_url, rpc_id]
	var headers: PackedStringArray = get_auth_headers()
	var _err = headers.append("Content-Type: application/json")

	# Wrap payload in JSON object as expected by Nakama HTTP API
	var body: Dictionary = {"payload": payload}
	var json_body: String = JSON.stringify(body)

	# Fire request without waiting - we don't care about the response
	# Issue #1079: mark the completion as an RPC response so a 401/403 is not
	# misrouted into the startup auth-error UI path. Fire-and-forget requests
	# never replay; the next tracked send_rpc runs the refresh + replay.
	_rpc_request_active = true
	var on_completed: Callable = func(_result: int, _response_code: int, _headers: PackedStringArray, _body: PackedByteArray):
		_rpc_request_active = false
	var _err2 = http_request.request_completed.connect(on_completed, CONNECT_ONE_SHOT)
	var error_code: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, json_body)
	if error_code != OK:
		_rpc_request_active = false
		if http_request.request_completed.is_connected(on_completed):
			http_request.request_completed.disconnect(on_completed)
		push_warning("Failed to send async RPC: %s" % rpc_id)

func _log_rpc_latency(rpc_name: String, latency_ms: int) -> void:
	# Use AnalyticsManager if available
	var analytics = get_node_or_null("/root/AnalyticsManager")
	if analytics and analytics.has_method("log_rpc_latency"):
		analytics.log_rpc_latency(rpc_name, latency_ms)

# ==================== SYNCHRONOUS STORAGE CACHE ====================
# Issue #1022: several autoloads (PlayerRatingManager, MatchTransitionManager,
# SeasonManager, MatchResultsManager) and scenes/ui/pvp/match_results.gd call
# get_storage_sync(), which previously did not exist — every call was a latent
# runtime crash. Nakama storage I/O is asynchronous HTTP, so a truly
# synchronous network read is impossible; per the issue's guidance this is a
# client-side last-known-value cache persisted to user://. It is a crash-safe
# fallback only — server-authoritative state still flows through the domain
# RPCs documented in RPC_MAP.md, never through this cache.

const STORAGE_CACHE_FILE: String = "user://network_storage_cache.json"

var _storage_cache: Dictionary = {}
var _storage_cache_loaded: bool = false
var _storage_handle: SyncStorageHandle = null
# Instance-level path override so tests can redirect disk persistence.
var storage_cache_path: String = STORAGE_CACHE_FILE

## Returns a synchronous, cache-backed key-value storage handle.
##
## The handle exposes get()/put()/erase()/has() over the local storage cache
## and never blocks on the network. Reads of missing keys yield null, which
## every caller already treats as "use defaults". Never returns null itself.
func get_storage_sync() -> SyncStorageHandle:
	if _storage_handle == null:
		_storage_handle = SyncStorageHandle.new(self)
	return _storage_handle

## Loads the storage cache from disk once; missing or corrupt files fall back
## to an empty cache so callers see their own defaults.
func _ensure_storage_cache_loaded() -> void:
	if _storage_cache_loaded:
		return
	_storage_cache_loaded = true
	if not FileAccess.file_exists(storage_cache_path):
		return
	var file: FileAccess = FileAccess.open(storage_cache_path, FileAccess.READ)
	if file == null:
		push_warning("NetworkManager: could not open storage cache (error %d)" % FileAccess.get_open_error())
		return
	var json: JSON = JSON.new()
	if json.parse(file.get_as_text()) == OK and json.data is Dictionary:
		_storage_cache = json.data
	else:
		push_warning("NetworkManager: storage cache unreadable; starting empty")

## Persists the storage cache to disk; failures are logged, never fatal.
func _save_storage_cache() -> void:
	var file: FileAccess = FileAccess.open(storage_cache_path, FileAccess.WRITE)
	if file == null:
		push_warning("NetworkManager: could not write storage cache (error %d)" % FileAccess.get_open_error())
		return
	file.store_string(JSON.stringify(_storage_cache))

## Applies a cache write and persists it.
func _storage_put(key: String, value: Variant) -> void:
	_ensure_storage_cache_loaded()
	_storage_cache[key] = value
	_save_storage_cache()

## Reads a cached value, lazily loading the cache from disk first.
func _storage_get(key: String, default_value: Variant = null) -> Variant:
	_ensure_storage_cache_loaded()
	return _storage_cache.get(key, default_value)

## Returns true when `key` exists in the cache.
func _storage_has(key: String) -> bool:
	_ensure_storage_cache_loaded()
	return _storage_cache.has(key)

## Applies a cache erase (if present) and persists it.
func _storage_erase(key: String) -> void:
	_ensure_storage_cache_loaded()
	if _storage_cache.erase(key):
		_save_storage_cache()

## Synchronous key-value handle over NetworkManager's local storage cache.
##
## Duck-typed by callers via has_method() guards, so the method set is fixed:
## put/erase/has. Reads go through plain `storage.get(key)` calls, which
## resolve via the native Object.get() into the _get() virtual below —
## overriding get() directly is forbidden by Godot. All operations are local;
## no RPCs are issued.
class SyncStorageHandle:
	extends RefCounted

	var _owner: Node

	func _init(owner: Node) -> void:
		_owner = owner

	## Serves `storage.get(key)` for any key that is not a real property:
	## returns the cached value, or null when absent.
	func _get(key: StringName) -> Variant:
		return _owner._storage_get(String(key))

	## Caches `value` under `key` and persists the cache locally.
	func put(key: String, value: Variant) -> void:
		_owner._storage_put(key, value)

	## Removes `key` from the cache (no-op when absent) and persists.
	func erase(key: String) -> void:
		_owner._storage_erase(key)

	## Returns true when `key` exists in the cache.
	func has(key: String) -> bool:
		return _owner._storage_has(key)

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
	var _err = _reconnect_timer.timeout.connect(_on_reconnect_timer_timeout)
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
	# Clean up bounded auth outer timer (issue #908)
	if _auth_outer_timer != null and is_instance_valid(_auth_outer_timer):
		_auth_outer_timer.queue_free()
		_auth_outer_timer = null
	if OS.get_environment("E2E_TEST") != "1":
		print("[NetworkManager] Cleanup complete - all resources released")
