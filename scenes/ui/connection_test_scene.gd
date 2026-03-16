extends Control

# --- UI References ---
@onready var server_url_label: Label = $VBoxContainer/ServerUrlLabel
@onready var server_key_label: Label = $VBoxContainer/ServerKeyLabel
@onready var status_label: Label = $VBoxContainer/StatusLabel
@onready var result_label: Label = $VBoxContainer/ResultLabel
@onready var log_output: TextEdit = $VBoxContainer/LogOutput
@onready var test_button: Button = $VBoxContainer/ButtonContainer/TestConnectionButton
@onready var clear_button: Button = $VBoxContainer/ButtonContainer/ClearLogButton
@onready var back_button: Button = $VBoxContainer/ButtonContainer/BackButton
@onready var timer: Timer = $Timer

# --- HTTP Request ---
var http_request: HTTPRequest
var is_testing: bool = false

# --- Test Configuration ---
var test_url: String = ""
var test_server_key: String = ""
var test_device_id: String = ""

func _ready() -> void:
	# Setup UI
	test_button.pressed.connect(_on_test_connection_pressed)
	clear_button.pressed.connect(_on_clear_log_pressed)
	back_button.pressed.connect(_on_back_pressed)
	
	# Setup HTTPRequest
	http_request = HTTPRequest.new()
	add_child(http_request)
	http_request.timeout = 10
	http_request.request_completed.connect(_on_request_completed)
	
	# Get configuration from NetworkManager if available
	_load_configuration()
	
	# Generate test device ID
	_generate_device_id()
	
	# Initial log
	_log("Connection Test Scene initialized")
	_log("Press 'Test Connection' to test Nakama server connectivity")

func _load_configuration() -> void:
	# Try to get NetworkManager autoload
	var network_manager: Node = get_node_or_null("/root/NetworkManager")
	
	if network_manager and network_manager.has_method("get_environment_name"):
		# Get values using reflection
		var server_url: String = network_manager.get("server_url")
		var server_port: int = network_manager.get("server_port")
		var server_key: String = network_manager.get("server_key")
		
		test_url = "http://%s:%d" % [server_url, server_port]
		test_server_key = server_key
	else:
		# Fallback to environment variables
		var env_url: String = OS.get_environment("NAKAMA_SERVER_URL")
		var env_port: String = OS.get_environment("NAKAMA_SERVER_PORT")
		var env_key: String = OS.get_environment("NAKAMA_SERVER_KEY")
		
		test_url = "http://%s:%s" % [env_url if env_url else "127.0.0.1", env_port if env_port else "7350"]
		test_server_key = env_key if env_key else "defaultkey"
	
	# Update UI
	server_url_label.text = "URL: %s" % test_url
	server_key_label.text = "Key: %s" % ("[SET]" if test_server_key else "[NOT SET]")
	
	_log("Configuration loaded:")
	_log("  Server URL: %s" % test_url)
	_log("  Server Key: %s" % ("[SET]" if test_server_key else "[NOT SET]"))

func _generate_device_id() -> void:
	var uuid: Array = []
	for i in range(16):
		uuid.append(randi() % 256)
	
	test_device_id = ""
	for byte in uuid:
		test_device_id += "%02x" % byte
	
	_log("Generated test device ID: %s" % test_device_id)

func _log(message: String) -> void:
	var timestamp: String = Time.get_datetime_string_from_system()
	log_output.text += "[%s] %s\n" % [timestamp, message]
	log_output.scroll_vertical = log_output.get_line_count()

func _set_status(status: String, color: Color = Color(1, 1, 0.5, 1)) -> void:
	status_label.text = "Status: %s" % status
	status_label.add_theme_color_override("font_color", color)

func _set_result(result: String, success: bool) -> void:
	result_label.text = "Result: %s" % result
	if success:
		result_label.add_theme_color_override("font_color", Color(0.6, 1.0, 0.6, 1))
	else:
		result_label.add_theme_color_override("font_color", Color(1.0, 0.6, 0.6, 1))

func _on_test_connection_pressed() -> void:
	if is_testing:
		_log("Test already in progress...")
		return
	
	is_testing = true
	test_button.disabled = true
	_set_status("Testing...", Color(1, 1, 0.5, 1))
	result_label.text = "Result: Testing..."
	
	_log("=== Starting Connection Test ===")
	_log("Step 1: Testing basic HTTP connectivity...")
	
	# Test 1: Basic connectivity (GET request)
	var auth_url: String = "%s/v2/account/authenticate/device" % test_url
	var auth_string: String = Marshalls.utf8_to_base64("%s:" % test_server_key)
	var headers: PackedStringArray = [
		"Content-Type: application/json",
		"Accept: application/json",
		"Authorization: Basic %s" % auth_string
	]
	
	var body: Dictionary = {
		"id": test_device_id,
		"create": true
	}
	
	var json: JSON = JSON.new()
	var json_string: String = JSON.stringify(body)
	
	_log("Sending POST request to: %s" % auth_url)
	_log("Request body: %s" % json_string)
	
	var error: Error = http_request.request(auth_url, headers, HTTPClient.METHOD_POST, json_string)
	
	if error != OK:
		_log("ERROR: Failed to send request - Error code: %d" % error)
		_on_test_complete(false, "Failed to send HTTP request (Error: %d)" % error)

func _on_request_completed(result: int, response_code: int, headers: PackedStringArray, body: PackedByteArray) -> void:
	_log("=== HTTP Response Received ===")
	_log("Result: %d, Response Code: %d" % [result, response_code])
	
	var response_text: String = body.get_string_from_utf8()
	_log("Response: %s" % response_text.substr(0, min(300, response_text.length())))
	
	if response_code >= 200 and response_code < 300:
		# Parse response
		var json: JSON = JSON.new()
		if json.parse(response_text) == OK:
			var data: Dictionary = json.data
			
			if "token" in data:
				_log("SUCCESS: Authentication successful!")
				_log("Token received: %s..." % str(data["token"]).substr(0, 50))
				
				if "created" in data:
					_log("Account created: %s" % ("YES" if data["created"] else "NO (existing account)"))
				
				_on_test_complete(true, "Connection successful! Token received.")
			else:
				_log("ERROR: No token in response")
				_on_test_complete(false, "Server response missing token")
		else:
			_log("ERROR: Failed to parse JSON response")
			_on_test_complete(false, "Invalid JSON response from server")
	else:
		_log("ERROR: HTTP error code: %d" % response_code)
		_on_test_complete(false, "HTTP Error: %d" % response_code)

func _on_test_complete(success: bool, message: String) -> void:
	is_testing = false
	test_button.disabled = false
	
	if success:
		_set_status("Connected!", Color(0.6, 1.0, 0.6, 1))
		_set_result(message, true)
		_log("=== TEST PASSED ===")
	else:
		_set_status("Failed", Color(1.0, 0.6, 0.6, 1))
		_set_result(message, false)
		_log("=== TEST FAILED ===")
		_log("Troubleshooting tips:")
		_log("  1. Check if Nakama server is running: docker ps")
		_log("  2. Check server logs: docker logs armored_archer_server")
		_log("  3. Test with curl: curl http://127.0.0.1:7350/")
		_log("  4. Check firewall settings")
		_log("  5. Verify .env configuration")

func _on_clear_log_pressed() -> void:
	log_output.text = ""
	_log("Log cleared")

func _on_back_pressed() -> void:
	var err = get_tree().change_scene_to_file("res://scenes/ui/login_screen.tscn")
	if err != OK:
		_log("ERROR: Failed to load login screen: %d" % err)

func _exit_tree() -> void:
	if http_request:
		http_request.queue_free()
		http_request = null
