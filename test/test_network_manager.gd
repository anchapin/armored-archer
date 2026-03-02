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
