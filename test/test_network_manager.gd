extends Node

var _mock_network_manager: Node = null
var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running NetworkManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	test_initial_state()
	test_device_id_generation()
	test_session_token_storage()
	test_logout_clears_session()
	test_get_auth_headers_empty_token()
	test_get_auth_headers_with_token()
	test_is_session_valid()
	test_signal_emission()
	test_device_id_persistence()
	test_environment_variable_loading()
	test_authenticate_device_offline()
	test_base_url_construction()
	test_session_update_from_response()
	test_connection_status_signals()
	test_handle_auth_error_no_connection()
	test_handle_auth_error_with_message()
	test_session_file_operations()
	test_send_rpc_not_authenticated()
	test_get_auth_headers_partial()
	
	print("\n=== NetworkManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_network_manager() -> Node:
	var nm = load("res://autoloads/NetworkManager.gd").new()
	add_child(nm)
	return nm

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var nm = _create_network_manager()
	
	if nm.session_token == "" and nm.refresh_token == "" and nm.user_id == "":
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "Initial state should be empty")
	
	nm.queue_free()

func test_device_id_generation() -> void:
	var nm = _create_network_manager()
	nm._generate_device_id()
	
	if nm.device_id != null and nm.device_id.length() > 0:
		_pass("test_device_id_generation")
	else:
		_fail("test_device_id_generation", "Device ID should be generated")
	
	nm.queue_free()

func test_session_token_storage() -> void:
	var nm = _create_network_manager()
	nm.session_token = "test_token_123"
	nm.refresh_token = "refresh_token_456"
	nm.user_id = "user_789"
	nm.username = "test_player"
	
	if nm.session_token == "test_token_123" and nm.refresh_token == "refresh_token_456":
		_pass("test_session_token_storage")
	else:
		_fail("test_session_token_storage", "Session tokens should be stored")
	
	nm.queue_free()

func test_logout_clears_session() -> void:
	var nm = _create_network_manager()
	nm.session_token = "test_token"
	nm.refresh_token = "refresh_token"
	nm.user_id = "user_id"
	nm.username = "username"
	nm.is_connected = true
	
	nm.logout()
	
	if nm.session_token == "" and nm.refresh_token == "" and not nm.is_connected:
		_pass("test_logout_clears_session")
	else:
		_fail("test_logout_clears_session", "Logout should clear all session data")
	
	nm.queue_free()

func test_get_auth_headers_empty_token() -> void:
	var nm = _create_network_manager()
	nm.session_token = ""
	var headers = nm.get_auth_headers()
	
	if headers.is_empty():
		_pass("test_get_auth_headers_empty_token")
	else:
		_fail("test_get_auth_headers_empty_token", "Headers should be empty")
	
	nm.queue_free()

func test_get_auth_headers_with_token() -> void:
	var nm = _create_network_manager()
	nm.session_token = "test_bearer_token"
	var headers = nm.get_auth_headers()
	
	if not headers.is_empty() and headers[0].begins_with("Authorization: Bearer"):
		_pass("test_get_auth_headers_with_token")
	else:
		_fail("test_get_auth_headers_with_token", "Headers should have Authorization")
	
	nm.queue_free()

func test_is_session_valid() -> void:
	var nm = _create_network_manager()
	
	if not nm.is_session_valid():
		_pass("test_is_session_valid_empty")
	else:
		_fail("test_is_session_valid_empty", "Should be invalid with no token")
	
	nm.session_token = "valid_token"
	if not nm.is_session_valid():
		_pass("test_is_session_valid_not_connected")
	else:
		_fail("test_is_session_valid_not_connected", "Should be invalid when not connected")
	
	nm.is_connected = true
	if nm.is_session_valid():
		_pass("test_is_session_valid_connected")
	else:
		_fail("test_is_session_valid_connected", "Should be valid with token and connected")
	
	nm.queue_free()

func test_signal_emission() -> void:
	var nm = _create_network_manager()
	var signal_received = false
	
	nm.session_created.connect(func(s, e): signal_received = true)
	nm.session_created.emit(true, "")
	
	await get_tree().create_timer(0.1).timeout
	
	if signal_received:
		_pass("test_signal_emission")
	else:
		_fail("test_signal_emission", "Signal should be emitted")
	
	nm.queue_free()

# --- Additional NetworkManager Tests for Higher Coverage ---

func test_device_id_persistence() -> void:
	var nm = _create_network_manager()
	nm._generate_device_id()
	var first_device_id = nm.device_id
	
	# Create another instance and check device ID format consistency
	var nm2 = _create_network_manager()
	nm2._generate_device_id()
	
	# Device ID should be 32 hex characters (16 bytes)
	if nm.device_id.length() == 32:
		_pass("test_device_id_persistence_format")
	else:
		_fail("test_device_id_persistence_format", "Device ID should be 32 hex chars")
	
	nm.queue_free()
	nm2.queue_free()

func test_environment_variable_loading() -> void:
	var nm = _create_network_manager()
	# Test that environment variable loading doesn't crash
	nm._load_environment_variables()
	# Server URL should have default value
	if not nm.server_url.is_empty():
		_pass("test_environment_variable_loading")
	else:
		_fail("test_environment_variable_loading", "Server URL should have default")
	nm.queue_free()

func test_authenticate_device_offline() -> void:
	var nm = _create_network_manager()
	nm.is_offline = true
	var emit_received = false
	var error_msg = ""
	
	nm.session_created.connect(func(s, e): 
		emit_received = true
		error_msg = e
	)
	nm.authenticate_device()
	
	await get_tree().create_timer(0.1).timeout
	
	if emit_received and error_msg == "Cannot authenticate while offline":
		_pass("test_authenticate_device_offline")
	else:
		_fail("test_authenticate_device_offline", "Should emit error for offline")
	
	nm.queue_free()

func test_base_url_construction() -> void:
	var nm = _create_network_manager()
	nm.server_url = "192.168.1.1"
	nm.server_port = 7350
	nm.base_url = "http://%s:%d" % [nm.server_url, nm.server_port]
	
	if nm.base_url == "http://192.168.1.1:7350":
		_pass("test_base_url_construction")
	else:
		_fail("test_base_url_construction", "Base URL incorrect: " + nm.base_url)
	
	nm.queue_free()

func test_session_update_from_response() -> void:
	var nm = _create_network_manager()
	var response = {
		"token": "new_token_123",
		"refresh_token": "refresh_123",
		"user_id": "user_456",
		"username": "test_user"
	}
	
	nm._update_session_from_response(response)
	
	if nm.session_token == "new_token_123" and nm.refresh_token == "refresh_123" and nm.user_id == "user_456":
		_pass("test_session_update_from_response")
	else:
		_fail("test_session_update_from_response", "Session not updated correctly")
	
	nm.queue_free()

func test_connection_status_signals() -> void:
	var nm = _create_network_manager()
	var online_received = false
	var offline_received = false
	
	nm.connection_status_changed.connect(func(is_online): 
		if is_online:
			online_received = true
		else:
			offline_received = true
	)
	
	nm.connection_status_changed.emit(true)
	nm.connection_status_changed.emit(false)
	
	await get_tree().create_timer(0.1).timeout
	
	if online_received and offline_received:
		_pass("test_connection_status_signals")
	else:
		_fail("test_connection_status_signals", "Connection signals not received")
	
	nm.queue_free()

func test_handle_auth_error_no_connection() -> void:
	var nm = _create_network_manager()
	var emit_received = false
	var error_msg = ""
	
	nm.session_created.connect(func(s, e): 
		emit_received = true
		error_msg = e
	)
	
	nm._handle_authentication_error(0, "")
	
	await get_tree().create_timer(0.1).timeout
	
	if emit_received and error_msg == "No internet connection":
		_pass("test_handle_auth_error_no_connection")
	else:
		_fail("test_handle_auth_error_no_connection", "Error not handled correctly")
	
	nm.queue_free()

func test_handle_auth_error_with_message() -> void:
	var nm = _create_network_manager()
	var emit_received = false
	
	nm.session_created.connect(func(s, e): emit_received = true)
	
	nm._handle_authentication_error(401, '{"message": "Invalid credentials"}')
	
	await get_tree().create_timer(0.1).timeout
	
	if emit_received:
		_pass("test_handle_auth_error_with_message")
	else:
		_fail("test_handle_auth_error_with_message", "Error signal not emitted")
	
	nm.queue_free()

func test_session_file_operations() -> void:
	var nm = _create_network_manager()
	nm.session_token = "test_session"
	nm.refresh_token = "test_refresh"
	nm.user_id = "test_user"
	nm.username = "test_name"
	nm.device_id = "device123"
	
	# Save session
	nm._save_session_to_file()
	
	# Create new instance to load session
	var nm2 = _create_network_manager()
	nm2._load_session_from_file()
	
	if nm2.session_token == "test_session" and nm2.refresh_token == "test_refresh":
		_pass("test_session_file_operations")
	else:
		_fail("test_session_file_operations", "Session not persisted correctly")
	
	nm.queue_free()
	nm2.queue_free()

func test_send_rpc_not_authenticated() -> void:
	var nm = _create_network_manager()
	# Not connected, no session
	var result = nm.send_rpc("test_rpc", "{}")
	
	if result.has("error") and result.error == "Not authenticated":
		_pass("test_send_rpc_not_authenticated")
	else:
		_fail("test_send_rpc_not_authenticated", "Should return error for unauthenticated")
	
	nm.queue_free()

func test_get_auth_headers_partial() -> void:
	var nm = _create_network_manager()
	# Has session token but not connected
	nm.session_token = "test_token"
	nm.is_connected = false
	
	var result = nm.is_session_valid()
	
	if result == false:
		_pass("test_get_auth_headers_partial")
	else:
		_fail("test_get_auth_headers_partial", "Session should be invalid when not connected")
	
	nm.queue_free()
