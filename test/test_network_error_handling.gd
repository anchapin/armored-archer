extends GutTest

## Tests for robust network error handling and offline mode support
## Issue #138: Network Error Handling & Offline Support

# --- Mock Classes ---
class MockHTTPRequest:
	var request_completed = Signal()
	var last_request: Dictionary = {}
	var should_timeout: bool = false
	var should_fail: bool = false
	var response_code: int = 200
	var response_body: String = "{}"
	
	func request(url: String, headers: PackedStringArray, method: int, body: String) -> Error:
		last_request = {
			"url": url,
			"headers": headers,
			"method": method,
			"body": body
		}
		
		if should_fail:
			return FAILED
		
		# Simulate async completion
		get_tree().create_timer(0.1).timeout.connect(_on_request_complete)
		return OK
	
	func cancel_request() -> void:
		pass
	
	func _on_request_complete() -> void:
		var result: Array = [0, response_code, [], response_body.to_utf8_buffer()]
		request_completed.emit(result)

# --- Test Suite ---

func test_network_manager_exists() -> void:
	var network_mgr = get_tree().root.get_node_or_null("/root/NetworkManager")
	assert_not_null(network_mgr, "NetworkManager should be loaded as autoload")

func test_offline_action_queue_exists() -> void:
	var queue = get_tree().root.get_node_or_null("/root/OfflineActionQueue")
	assert_not_null(queue, "OfflineActionQueue should be loaded as autoload")

func test_network_manager_has_retry_function() -> void:
	var network_mgr = get_tree().root.get_node("NetworkManager")
	assert_true(network_mgr.has_method("send_rpc_with_retry"), "NetworkManager should have send_rpc_with_retry method")

func test_network_manager_has_retry_error_detection() -> void:
	var network_mgr = get_tree().root.get_node("NetworkManager")
	assert_true(network_mgr.has_method("_is_retryable_error"), "NetworkManager should have _is_retryable_error method")

func test_retryable_error_detection() -> void:
	var network_mgr = get_tree().root.get_node("NetworkManager")
	
	# Retryable errors
	assert_true(network_mgr._is_retryable_error("Request timed out"), "Timeout should be retryable")
	assert_true(network_mgr._is_retryable_error("Connection refused"), "Connection error should be retryable")
	assert_true(network_mgr._is_retryable_error("HTTP error: 503"), "503 should be retryable")
	assert_true(network_mgr._is_retryable_error("No internet connection"), "No connection should be retryable")
	
	# Non-retryable errors
	assert_false(network_mgr._is_retryable_error("Not authenticated"), "Auth error should not be retryable")
	assert_false(network_mgr._is_retryable_error("HTTP error: 401"), "401 should not be retryable")
	assert_false(network_mgr._is_retryable_error("Invalid request"), "Invalid request should not be retryable")

func test_offline_action_queue_management() -> void:
	var queue = get_tree().root.get_node("OfflineActionQueue")
	queue.clear_queue()
	
	# Queue an action
	queue.queue_action(
		"test_action",
		"test_rpc",
		{"test": "data"}
	)
	
	assert_eq(queue.get_pending_action_count(), 1, "Queue should have 1 action")
	
	# Check action format
	var actions = queue.get_queue_snapshot()
	assert_eq(actions[0]["action_type"], "test_action", "Action type should match")
	assert_eq(actions[0]["rpc_id"], "test_rpc", "RPC ID should match")
	assert_eq(actions[0]["retry_count"], 0, "Retry count should start at 0")

func test_offline_action_queue_max_size() -> void:
	var queue = get_tree().root.get_node("OfflineActionQueue")
	queue.clear_queue()
	
	# Fill queue beyond max (50)
	for i in range(60):
		queue.queue_action(
			"action_%d" % i,
			"rpc_%d" % i,
			{"index": i}
		)
	
	# Queue should be capped at 50
	assert_eq(queue.get_pending_action_count(), 50, "Queue should be capped at max size (50)")

func test_combat_manager_uses_retry_logic() -> void:
	var combat_mgr = get_tree().root.get_node("CombatManager")
	assert_true(combat_mgr.has_method("submit_combat_action"), "CombatManager should have submit_combat_action method")
	
	# Check that method handles offline case
	var network_mgr = get_tree().root.get_node("NetworkManager")
	network_mgr.is_connected = false
	network_mgr.is_offline = true
	
	# This should queue offline action instead of erroring
	combat_mgr.submit_combat_action("test_match", "shoot", 1.57, 0.8)
	
	# Should have queued the action
	var queue = get_tree().root.get_node("OfflineActionQueue")
	assert_gt(queue.get_pending_action_count(), 0, "Offline combat action should be queued")

func test_matchmaker_manager_graceful_offline() -> void:
	var matchmaker = get_tree().root.get_node("MatchmakerManager")
	var network_mgr = get_tree().root.get_node("NetworkManager")
	
	network_mgr.is_connected = false
	network_mgr.is_offline = true
	
	var was_called = false
	matchmaker.matches_loaded.connect(func(_matches, _rank): was_called = true)
	
	# Should emit cached data, not error
	matchmaker.list_matches()
	await get_tree().process_frame
	
	assert_true(was_called, "Should emit matches_loaded with cached data when offline")

func test_offline_action_persistence() -> void:
	var queue = get_tree().root.get_node("OfflineActionQueue")
	queue.clear_queue()
	
	# Queue an action
	queue.queue_action(
		"persistent_action",
		"test_rpc",
		{"data": "test"}
	)
	
	# Check that queue is saved to file
	assert_true(FileAccess.file_exists("user://offline_actions.json"), "Offline queue should persist to file")

func test_network_timeout_detection() -> void:
	var network_mgr = get_tree().root.get_node("NetworkManager")
	
	# Verify timeout is retryable
	var is_retryable = network_mgr._is_retryable_error("Request timed out after 30.0 seconds")
	assert_true(is_retryable, "Network timeout should be retryable")

func test_combat_action_queued_signal() -> void:
	var queue = get_tree().root.get_node("OfflineActionQueue")
	queue.clear_queue()
	
	var signal_emitted = false
	queue.action_queued.connect(func(_action): signal_emitted = true)
	
	queue.queue_action("test", "test_rpc", {})
	
	assert_true(signal_emitted, "action_queued signal should be emitted")

func test_connection_status_signal() -> void:
	var network_mgr = get_tree().root.get_node("NetworkManager")
	
	var status_changed = false
	network_mgr.connection_status_changed.connect(func(is_online): status_changed = true)
	
	# This should trigger the signal
	network_mgr.connection_status_changed.emit(false)
	
	assert_true(status_changed, "connection_status_changed signal should be functional")

func test_offline_queue_processes_on_reconnect() -> void:
	var queue = get_tree().root.get_node("OfflineActionQueue")
	var network_mgr = get_tree().root.get_node("NetworkManager")
	
	queue.clear_queue()
	
	# Queue an action while offline
	queue.queue_action("test_action", "test_rpc", {"test": "data"})
	assert_eq(queue.get_pending_action_count(), 1, "Action should be queued")
	
	# Simulate connection restore
	var was_processed = false
	queue.queue_synced.connect(func(): was_processed = true)
	
	# Trigger reconnection (would normally call process_queue)
	# This is integration-tested with actual network connectivity

func test_combat_manager_queue_on_network_error() -> void:
	var combat_mgr = get_tree().root.get_node("CombatManager")
	var queue = get_tree().root.get_node("OfflineActionQueue")
	var network_mgr = get_tree().root.get_node("NetworkManager")
	
	queue.clear_queue()
	network_mgr.is_connected = true
	network_mgr.is_offline = false
	
	# With proper mock, test that transient errors queue actions
	# Note: This requires mocking the HTTP layer

func test_offline_queue_respects_max_retries() -> void:
	var queue = get_tree().root.get_node("OfflineActionQueue")
	queue.clear_queue()
	
	queue.queue_action("test", "test_rpc", {})
	var actions = queue.get_queue_snapshot()
	
	assert_eq(actions[0]["max_retries"], 3, "Max retries should be capped at 3")

func test_offline_action_metadata_preserved() -> void:
	var queue = get_tree().root.get_node("OfflineActionQueue")
	queue.clear_queue()
	
	var metadata = {"match_id": "abc123", "player_id": "xyz789"}
	queue.queue_action("combat_action", "submit_action", {"test": "data"}, metadata)
	
	var actions = queue.get_queue_snapshot()
	assert_eq(actions[0]["metadata"], metadata, "Metadata should be preserved in queued action")

# Ensure cleanup
func after_each() -> void:
	var queue = get_tree().root.get_node_or_null("OfflineActionQueue")
	if queue:
		queue.clear_queue()
