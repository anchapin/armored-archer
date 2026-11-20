extends GutTest

# Real loopback transport exercises the production attempt callbacks. Only the
# session-refresh operation is controlled; recovery/serialization/replay remain
# production code, with no live Nakama or external network traffic.
class RefreshProbe:
	extends "res://autoloads/NetworkManager.gd"
	var refresh_calls: int = 0
	var refresh_mode: String = "success"

	func _refresh_session() -> void:
		refresh_calls += 1
		if refresh_mode == "blocked":
			auth_blocked.emit("probe blocked", "test only")
		elif refresh_mode == "failed":
			session_refreshed.emit(false, "probe failed")
		else:
			session_token = "rotated-test-token"
			session_refreshed.emit(true, "")

var _network: RefreshProbe
var _server: TCPServer
var _connections: Array[StreamPeerTCP] = []
var _answered: Dictionary = {}
var _codes: Array[int] = []
var _received: int = 0
var _listener_count: int = 0

func before_each() -> void:
	_network = RefreshProbe.new()
	_network.is_offline = true
	add_child_autofree(_network)
	# Match the existing loopback suite: avoid a threaded client waiting on
	# this same main-thread server while cancellation joins its worker.
	_network._rpc_http_request.use_threads = false
	_network.session_token = "test-token"
	_network.is_connected = true
	_network._refresh_watchdog_ms = 300
	_network._refresh_watchdog_max_frames = 120
	_listener_count = _network._rpc_http_request.request_completed.get_connections().size()
	_server = TCPServer.new()
	_connections.clear()
	_answered.clear()
	_received = 0
	_codes.clear()

func after_each() -> void:
	for connection in _connections:
		connection.disconnect_from_host()
	_server.stop()

func _listen(codes: Array[int]) -> void:
	_codes.assign(codes)
	var error: Error = _server.listen(0, "127.0.0.1")
	assert_eq(error, OK, "Loopback listener must start")
	_network.base_url = "http://127.0.0.1:%d" % _server.get_local_port()

func _poll() -> void:
	if _server.is_connection_available():
		_connections.append(_server.take_connection())
	for connection in _connections:
		connection.poll()
		if connection.get_status() != StreamPeerTCP.STATUS_CONNECTED:
			continue
		if _answered.has(connection) or connection.get_available_bytes() <= 0:
			continue
		connection.get_data(connection.get_available_bytes())
		var code: int = _codes[mini(_received, _codes.size() - 1)]
		_received += 1
		_answered[connection] = true
		if code == 0:
			continue # Silent peer: only the production timeout can finish.
		var body: String = '{"value":42}' if code == 200 else '{"error":"expired"}'
		var bytes: PackedByteArray = body.to_utf8_buffer()
		var response: String = ("HTTP/1.1 %d Probe\r\nContent-Type: application/json\r\n"
			+ "Content-Length: %d\r\nConnection: close\r\n\r\n%s") % [code, bytes.size(), body]
		assert_eq(connection.put_data(response.to_utf8_buffer()), OK)

func _begin(results: Array, timeout: float = 1.0) -> void:
	var request: Callable = func():
		results.append(await _network.send_rpc("probe", "{}", timeout))
	request.call()

func _wait(results: Array, count: int = 1) -> void:
	var deadline: int = Time.get_ticks_msec() + 2000
	while results.size() < count and Time.get_ticks_msec() < deadline:
		_poll()
		await get_tree().process_frame
	assert_eq(results.size(), count, "Every RPC must return before the test deadline")

func _assert_settled() -> void:
	assert_false(_network._rpc_busy, "RPC lock must be released")
	assert_false(_network._rpc_request_active, "Routing flag must clear")
	assert_eq(_network._rpc_http_request.request_completed.get_connections().size(),
		_listener_count, "No per-attempt completion listener may survive")
	await get_tree().process_frame # queue_free must finish before checking timers.
	var timers: int = 0
	for child in _network.get_children():
		if child is Timer:
			timers += 1
	assert_eq(timers, 0, "Attempt timers must be freed")

func test_rpc_attempt_success_delivers_body_and_cleans_up() -> void:
	_listen([200])
	var results: Array = []
	_begin(results)
	await _wait(results)
	if not results.is_empty():
		assert_eq(results[0], {"value": 42.0}, "Callback payload must reach caller")
	assert_eq(_received, 1)
	assert_eq(_network.refresh_calls, 0)
	await _assert_settled()

func test_rpc_attempt_timeout_then_success_has_no_stale_listener() -> void:
	_listen([0, 200])
	var results: Array = []
	_begin(results, 0.3)
	await _wait(results)
	if not results.is_empty():
		assert_string_contains(str(results[0].get("error", "")), "Request timed out")
	assert_eq(_received, 1, "Silent request must reach the peer before timeout")
	assert_eq(_network.refresh_calls, 0)
	await _assert_settled()
	_begin(results)
	await _wait(results, 2)
	if results.size() == 2:
		assert_eq(results[1], {"value": 42.0})
	assert_eq(_received, 2)
	await _assert_settled()

func test_rpc_attempt_dispatch_error_cleans_up() -> void:
	_network.base_url = "invalid-url"
	var results: Array = []
	_begin(results)
	assert_engine_error("ERR_INVALID_PARAMETER")
	assert_eq(results.size(), 1)
	if not results.is_empty():
		assert_eq(results[0].get("error"), "Failed to send RPC request")
	assert_eq(_network.refresh_calls, 0)
	await _assert_settled()

func _assert_auth_replay(code: int) -> void:
	_listen([code, 200])
	var results: Array = []
	_begin(results)
	await _wait(results)
	if not results.is_empty():
		assert_eq(results[0], {"value": 42.0})
	assert_eq(_network.refresh_calls, 1, "Exactly one refresh")
	assert_eq(_received, 2, "Exactly one replay")
	await _assert_settled()

func test_rpc_attempt_401_refreshes_and_replays_once() -> void:
	await _assert_auth_replay(401)

func test_rpc_attempt_403_refreshes_and_replays_once() -> void:
	await _assert_auth_replay(403)

func test_rpc_attempt_second_401_does_not_refresh_or_replay_again() -> void:
	_listen([401, 401])
	var results: Array = []
	_begin(results)
	await _wait(results)
	if not results.is_empty():
		assert_true(results[0].get("is_auth_error", false))
	assert_eq(_network.refresh_calls, 1)
	assert_eq(_received, 2)
	await _assert_settled()

func _assert_failed_refresh(mode: String) -> void:
	_network.refresh_mode = mode
	_listen([401])
	var results: Array = []
	_begin(results)
	await _wait(results)
	if not results.is_empty():
		assert_true(results[0].get("is_auth_error", false))
		if mode == "blocked":
			assert_string_contains(str(results[0].get("error", "")), "probe blocked")
	assert_eq(_network.refresh_calls, 1)
	assert_eq(_received, 1, "No replay after failed/blocked refresh")
	await _assert_settled()

func test_rpc_attempt_failed_refresh_does_not_replay() -> void:
	await _assert_failed_refresh("failed")

func test_rpc_attempt_blocked_refresh_does_not_replay() -> void:
	await _assert_failed_refresh("blocked")

func test_rpc_attempt_concurrent_401s_rotate_once_and_release_lock() -> void:
	_listen([401, 200, 200])
	var results: Array = []
	_begin(results)
	_begin(results)
	await _wait(results, 2)
	for result in results:
		assert_eq(result, {"value": 42.0})
	assert_eq(_network.refresh_calls, 1)
	assert_eq(_received, 3, "One failed request, one replay, one queued request")
	await _assert_settled()

func test_rpc_attempt_logout_cancellation_finishes_on_existing_timeout() -> void:
	_listen([0])
	var results: Array = []
	_begin(results, 0.5)
	var deadline: int = Time.get_ticks_msec() + 1000
	while _received == 0 and Time.get_ticks_msec() < deadline:
		_poll()
		await get_tree().process_frame
	assert_eq(_received, 1, "Request must dispatch before logout")
	_network.send_rpc_async("queued-probe", "{}")
	assert_eq(_network._async_rpc_queue.size(), 1)
	_network.logout()
	await _wait(results)
	if not results.is_empty():
		assert_string_contains(str(results[0].get("error", "")), "Request timed out")
	assert_eq(_received, 1, "Queued request must not dispatch after logout")
	assert_true(_network._async_rpc_queue.is_empty())
	assert_false(_network._async_rpc_in_flight)
	assert_eq(_network.refresh_calls, 0)
	await _assert_settled()
