extends Node

# Simple HTTP test script to run from Godot command line
# Usage: godot --script res://scripts/test_godot_http.gd

var http_request: HTTPRequest

func _ready() -> void:
	print("=== Godot HTTP Request Test ===")

	http_request = HTTPRequest.new()
	add_child(http_request)
	http_request.timeout = 30
	http_request.use_threads = true
	http_request.request_completed.connect(_on_request_completed)

	var url: String = "http://127.0.0.1:7350/v2/account/authenticate/device"
	var auth_string: String = Marshalls.utf8_to_base64("defaultkey:")
	var headers: PackedStringArray = [
		"Content-Type: application/json",
		"Authorization: Basic %s" % auth_string
	]
	var body: Dictionary = {"id": "godot-test-12345", "create": true}
	var json_string: String = JSON.stringify(body)

	print("URL: %s" % url)
	print("Headers: %s" % headers)
	print("Body: %s" % json_string)

	var error: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, json_string)
	print("Request sent, error code: %d" % error)

func _on_request_completed(result: int, response_code: int, headers: PackedStringArray, body: PackedByteArray) -> void:
	print("=== Response ===")
	print("Result: %d" % result)
	print("Response Code: %d" % response_code)
	print("Body: %s" % body.get_string_from_utf8())

	# Exit after test
	get_tree().quit(0)
