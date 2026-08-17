## GUT test for issue #908 — 75% login blocker.
##
## Coverage:
##   1. Stack unhealthy → auth_blocked emitted in <15s with actionable message.
##   2. Stack healthy → login reaches main menu (session_created(true) fires).
##   3. Outer bound: MAX_AUTH_DURATION_SEC is respected even when retries exhausted.
##
## Run with GUT:
##   godot4 --headless -s addons/gut/gut_cmdln.gd \
##         -gconfig=.gutconfig.json \
##         -gselect=test_login_blocker_908.gd

extends GutTest

const NetworkManagerScript := preload("res://autoloads/NetworkManager.gd")
const NetworkConsts := preload("res://autoloads/const.gd")
const LoginScreenScript := preload("res://scenes/ui/login_screen.gd")
const TIMEOUT_LIMIT_MS: int = 15000

var _nm: Node = null

func before_each() -> void:
	# Don't let NetworkManager._ready re-read env vars and clobber the port we
	# pass in. Set the env vars before instantiation so the loaded values match
	# the test's expectations.
	OS.set_environment("ARMORED_ARCHER_ALLOW_EMPTY_SERVER_KEY", "1")
	OS.set_environment("ARMORED_ARCHER_ENVIRONMENT", "DEVELOPMENT")
	OS.set_environment("E2E_TEST", "0")

func after_each() -> void:
	if is_instance_valid(_nm):
		# Make sure the HTTPRequest gets a chance to cancel before the node is freed.
		if _nm.http_request and is_instance_valid(_nm.http_request):
			_nm.http_request.cancel_request()
		_nm.queue_free()
		_nm = null

func after_all() -> void:
	# Drain any pending queue_free()s so GUT doesn't count orphans as failures.
	if get_tree():
		await get_tree().process_frame
		await get_tree().process_frame

# Build a NetworkManager pointing at (server_url, server_port), wait for _ready,
# then override the fields _ready may have reset from env vars.
func _make_nm(server_url: String = "127.0.0.1", server_port: int = 1, server_key: String = "defaultkey") -> Node:
	_nm = NetworkManagerScript.new()
	add_child_autofree(_nm)
	await get_tree().process_frame
	await get_tree().process_frame
	# _ready may have re-derived from env vars; re-pin them.
	_nm.server_url = server_url
	_nm.server_port = server_port
	_nm.server_key = server_key
	_nm.base_url = "http://%s:%d" % [server_url, server_port]
	_nm.is_offline = false
	_nm._auth_blocked_emitted = false
	_nm._last_health_check_passed = false
	_nm.is_authenticating = false
	return _nm

# --- Tests ---

# (1) Stack unhealthy → bounded timeout → auth_blocked in <15s.
func test_unhealthy_stack_bounded_timeout() -> void:
	var nm: Node = await _make_nm("127.0.0.1", 1, "defaultkey")
	var received: Array = []
	var capture := func(reason: String, guidance: String):
		received.append({"reason": reason, "guidance": guidance})
	nm.auth_blocked.connect(capture)
	var started: int = Time.get_ticks_msec()
	nm.authenticate_device()
	var elapsed: int = 0
	while received.is_empty() and elapsed < TIMEOUT_LIMIT_MS:
		await wait_frames(3)
		elapsed = Time.get_ticks_msec() - started
	if nm.auth_blocked.is_connected(capture):
		nm.auth_blocked.disconnect(capture)
	assert_false(received.is_empty(), "auth_blocked did not fire within %dms" % TIMEOUT_LIMIT_MS)
	if not received.is_empty():
		assert_lt(elapsed, TIMEOUT_LIMIT_MS, "auth_blocked fired after %dms" % elapsed)
		assert_true(
			String(received[0]["guidance"]).find("make services-start") != -1,
			"guidance missing 'make services-start': " + str(received[0])
		)

# (2) Outer timer / retry exhaustion also bounded.
func test_retry_loop_bounded_by_max_auth_duration() -> void:
	var nm: Node = await _make_nm("127.0.0.1", 1, "defaultkey")
	# Worst-case bound: MAX_AUTH_DURATION_SEC plus a 5s connect-timeout fudge.
	var expected_cap: float = NetworkConsts.MAX_AUTH_DURATION_SEC + 5.0
	var received: Array = []
	var capture := func(reason: String, guidance: String):
		received.append({"reason": reason, "guidance": guidance})
	nm.auth_blocked.connect(capture)
	var started: int = Time.get_ticks_msec()
	nm.authenticate_device()
	while received.is_empty():
		await wait_frames(3)
		if Time.get_ticks_msec() - started > int((expected_cap + 2.0) * 1000.0):
			break
	if nm.auth_blocked.is_connected(capture):
		nm.auth_blocked.disconnect(capture)
	var elapsed_ms: int = Time.get_ticks_msec() - started
	assert_false(received.is_empty(), "auth_blocked never fired (cap=%.1fs, elapsed=%dms)" % [expected_cap, elapsed_ms])
	assert_lt(elapsed_ms, int((expected_cap + 2.0) * 1000.0),
		"auth_blocked fired after %dms (cap=%.1fs)" % [elapsed_ms, expected_cap]
	)

# (3) Stack healthy → login reaches main menu (session_created(true) fires).
func test_healthy_stack_reaches_main_menu() -> void:
	if not _is_stack_reachable():
		pending("healthy_stack_reaches_main_menu — Nakama not reachable on 127.0.0.1:7350 (start stack with `make services-start`)")
		return
	var nm: Node = await _make_nm("127.0.0.1", 7350, "defaultkey")
	var got_session: Array = []
	var capture := func(success: bool, _msg: String):
		if success:
			got_session.append(true)
	nm.session_created.connect(capture)
	nm.authenticate_device()
	var waited_ms: int = 0
	while got_session.is_empty() and waited_ms < 8000:
		await wait_frames(3)
		waited_ms += 100
	if nm.session_created.is_connected(capture):
		nm.session_created.disconnect(capture)
	assert_false(got_session.is_empty(), "session_created(true) did not fire in 8s")

# (4) Health gate: gate fails fast on unreachable port.
func test_health_gate_fast_fail_on_unreachable_port() -> void:
	var nm: Node = await _make_nm("127.0.0.1", 1, "defaultkey")
	var received: Array = []
	var capture := func(reason: String, guidance: String):
		received.append({"r": reason, "g": guidance})
	nm.auth_blocked.connect(capture)
	var started: int = Time.get_ticks_msec()
	nm.authenticate_device()
	while received.is_empty():
		await wait_frames(3)
		if Time.get_ticks_msec() - started > TIMEOUT_LIMIT_MS:
			break
	var elapsed: int = Time.get_ticks_msec() - started
	if nm.auth_blocked.is_connected(capture):
		nm.auth_blocked.disconnect(capture)
	assert_false(received.is_empty(), "auth_blocked never fired")
	if not received.is_empty():
		assert_lt(elapsed, TIMEOUT_LIMIT_MS, "auth_blocked fired after %dms (cap=%d)" % [elapsed, TIMEOUT_LIMIT_MS])
		var text: String = received[0]["r"] + " | " + received[0]["g"]
		assert_true(
			text.find("Cannot reach") != -1 or text.find("make services-start") != -1,
			"missing actionable guidance: " + text
		)

# (5) Constants match the issue #908 acceptance criteria.
func test_constants_match_acceptance_criteria() -> void:
	assert_almost_eq(NetworkConsts.MAX_AUTH_DURATION_SEC, 12.0, 0.001,
		"MAX_AUTH_DURATION_SEC must be 12s (≤15s acceptance criteria)")
	assert_lt(NetworkConsts.MAX_AUTH_DURATION_SEC, 15.0,
		"MAX_AUTH_DURATION_SEC must be <15s")
	assert_eq(NetworkConsts.AUTH_RETRY_DELAYS, [1.0, 2.0, 4.0],
		"delays must be 1s/2s/4s (3 attempts)")
	assert_eq(NetworkConsts.HEALTH_GATE_PATH, "/v2/health",
		"health gate path must match Nakama endpoint")
	assert_eq(NetworkConsts.DEFAULT_SERVER_KEY, "defaultkey",
		"client default key must match backend runtime.http_key (data/nakama.yml:14)")

# --- Helpers ---
func _is_stack_reachable() -> bool:
	var client: HTTPClient = HTTPClient.new()
	var err: Error = client.connect_to_host("127.0.0.1", 7350)
	if err != OK:
		return false
	var start: int = Time.get_ticks_msec()
	while client.get_status() == HTTPClient.STATUS_CONNECTING:
		client.poll()
		if Time.get_ticks_msec() - start > 1500:
			return false
		OS.delay_msec(20)
	if client.get_status() != HTTPClient.STATUS_CONNECTED:
		return false
	var req_err: Error = client.request(HTTPClient.METHOD_GET, "/v2/health", PackedStringArray(), "")
	if req_err != OK:
		return false
	while client.get_status() == HTTPClient.STATUS_REQUESTING:
		client.poll()
		if Time.get_ticks_msec() - start > 1500:
			return false
		OS.delay_msec(20)
	if not client.has_response():
		return false
	return client.get_response_code() == 200
