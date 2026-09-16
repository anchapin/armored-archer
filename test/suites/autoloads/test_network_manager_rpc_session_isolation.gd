extends GutTest

# Issue #1108 regression suite: the shared HTTPRequest leaked spurious session
# lifecycle errors from RPC/probe traffic, and send_rpc_async silently dropped
# payloads on ERR_BUSY while a tracked RPC cycle was in flight.
#
# Coverage:
#   1. The persistent session handler is wired ONLY to the auth node; RPC and
#      health-probe nodes are not connected to it (dedicated-node routing).
#   2. RPC completions (2xx without a token key) never emit session_created.
#   3. Health-probe completions (200 with empty body — the cold-start poison)
#      never emit session_created.
#   4. Auth completions on the auth node still emit session_created(true)
#      (positive control — isolation must not swallow real auth results).
#   5. send_rpc_async queues behind _rpc_busy instead of dropping payloads,
#      concurrent async calls serialize, and N concurrent tracked + async
#      calls produce ZERO session_created(false) emissions and ZERO dropped
#      payloads (the issue's acceptance criteria).
#
# Testing approach (established by test_network_manager_401_storm.gd): GUT
# cannot double the native HTTPRequest class (issue #1026) and native
# request() is not virtual, so Section A drives the dedicated nodes'
# request_completed signals directly (emitting a built-in signal is the
# documented seam for scripted responses), and Section B scripts the two
# wire seams — _perform_rpc_attempt and _fire_async_rpc — from a subclass.
# The busy-lock, queueing, and drain logic under test is all real
# production code.

var NetworkManagerClass = load("res://autoloads/NetworkManager.gd")
var _session_file_path: String = NetworkManagerClass.SESSION_FILE
var _network
# Counts session_created(false) emissions; reset in before_each and fed by
# the watcher connected right after the instance is created (i.e. after
# _ready()'s offline auto-connect emission, which must not be counted).
var _session_failures: Array = []

func _remove_persisted_session() -> void:
	# Issue #969: a session file persisted by an earlier test or run is
	# restored by NetworkManager._ready(), polluting initial state.
	if FileAccess.file_exists(_session_file_path):
		DirAccess.remove_absolute(_session_file_path)

func before_each() -> void:
	_remove_persisted_session()

	_network = NetworkManagerClass.new()
	# Offline keeps _ready()'s auto-connect short-circuited (issue #1026
	# pattern from test_network_manager.gd); each test flips the session
	# state it needs explicitly.
	_network.is_offline = true
	add_child_autofree(_network)
	# Point the transport at a guaranteed-refused local port so any real
	# dispatch fails fast instead of reaching a developer stack.
	_network.base_url = "http://127.0.0.1:9"

	# Watch for spurious session failures from here on (after _ready()'s
	# offline short-circuit emission).
	_session_failures = []
	var watcher: Callable = func(success: bool, error_message: String):
		if not success:
			_session_failures.append(error_message)
	_network.session_created.connect(watcher)

func after_each() -> void:
	_remove_persisted_session()
	_network = null

func _make_session_valid_on(nm) -> void:
	nm.session_token = "issue_1108_token"
	nm.refresh_token = "issue_1108_refresh"
	nm.is_connected = true
	nm.is_offline = false

## Emits a scripted completion on `node`'s request_completed signal — the
## deterministic seam for delivering canned HTTP responses (issue #1026).
func _emit_completion(node: HTTPRequest, response_code: int, body: String) -> void:
	node.cancel_request()
	node.emit_signal(
		"request_completed", HTTPRequest.RESULT_SUCCESS, response_code,
		PackedStringArray(), body.to_utf8_buffer()
	)

# ==================== SECTION A: NODE ROUTING ISOLATION ====================

func test_session_handler_wired_only_to_auth_node() -> void:
	# Issue #1108 structural invariant: _on_http_request_completed (which
	# owns session_created/session_refreshed emission) must be connected to
	# the auth node ONLY. Re-wiring RPC or probe traffic back onto it is the
	# regression that reintroduces the spurious session errors.
	var handler: Callable = _network._on_http_request_completed
	assert_true(
		_network.http_request.request_completed.is_connected(handler),
		"Auth node must feed the persistent session handler"
	)
	assert_false(
		_network._rpc_http_request.request_completed.is_connected(handler),
		"RPC node must NOT feed the persistent session handler"
	)
	assert_false(
		_network._probe_http_request.request_completed.is_connected(handler),
		"Probe node must NOT feed the persistent session handler"
	)

func test_rpc_completion_2xx_without_token_emits_no_session_created_false() -> void:
	# A successful RPC response body has no "token" key. Pre-#1108 the shared
	# node ran the auth handler on it and emitted
	# session_created(false, "Server response missing token") on EVERY RPC.
	_emit_completion(_network._rpc_http_request, 200, JSON.stringify({"ok": true}))
	await get_tree().process_frame

	assert_eq(_session_failures.size(), 0,
		"RPC 2xx-without-token must not emit session_created(false): %s" % str(_session_failures))

func test_probe_completion_200_empty_body_emits_no_session_created_false() -> void:
	# The health probe's 200-with-empty-body is the exact cold-start poison:
	# pre-#1108 the shared node's auth handler failed to parse "" and emitted
	# session_created(false, "Failed to parse server response") while auth was
	# still in progress, flashing 'Connection Failed' in login_screen.
	_emit_completion(_network._probe_http_request, 200, "")
	await get_tree().process_frame

	assert_eq(_session_failures.size(), 0,
		"Probe 200-empty-body must not emit session_created(false): %s" % str(_session_failures))

func test_auth_node_completion_still_emits_session_created_true() -> void:
	# Positive control: the isolation must not swallow REAL auth results. A
	# token-bearing 200 on the auth node must still emit session_created(true)
	# and store the session. Fresh (disconnected) state so the
	# was_connected branch emits session_created, not just session_refreshed.
	var got_session: Array = []
	var capture: Callable = func(success: bool, _error_message: String):
		if success:
			got_session.append(true)
	_network.session_created.connect(capture)

	var body: Dictionary = {
		"token": "t_1108",
		"refresh_token": "r_1108",
		"user_id": "u_1108",
		"username": "n_1108"
	}
	_emit_completion(_network.http_request, 200, JSON.stringify(body))
	await get_tree().process_frame

	assert_eq(got_session.size(), 1,
		"Auth-node token response must emit session_created(true) exactly once")
	assert_eq(_network.session_token, "t_1108", "Auth-node response must store the token")
	assert_eq(_session_failures.size(), 0, "No spurious failures expected on the auth path")

func test_dispatched_rpc_and_probe_traffic_emits_no_session_created_false() -> void:
	# End-to-end isolation with REAL dispatches (dead-port base_url): both a
	# fire-and-forget RPC and a health probe go out, their scripted poison
	# completions are delivered, and no session_created(false) may fire —
	# whichever completion (real refusal or canned 200) lands first.
	_make_session_valid_on(_network)

	# _async_rpc_in_flight is set synchronously before the dispatch (unlike
	# get_http_client_status(), which only moves off DISCONNECTED on the
	# worker thread when use_threads is enabled), so it is the reliable
	# "dispatched" signal here.
	_network.send_rpc_async("armored_archer/log_encounter_pacing", JSON.stringify({"seq": 1}))
	assert_true(_network._async_rpc_in_flight,
		"Fire-and-forget RPC must dispatch on the dedicated RPC node")

	var probe_outcomes: Array = []
	var prober: Callable = func():
		probe_outcomes.append(await _network._probe_health())
	prober.call()

	# Deliver the poison completions (no-op if the real refusal already
	# completed the one-shots — both outcomes are assertion-equivalent).
	var frames: int = 0
	while _network._rpc_http_request.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED and frames < 120:
		await get_tree().process_frame
		frames += 1
	_emit_completion(_network._rpc_http_request, 200, JSON.stringify({"ok": true}))

	frames = 0
	while probe_outcomes.is_empty() and frames < 240:
		await get_tree().process_frame
		frames += 1
	_emit_completion(_network._probe_http_request, 200, "")

	frames = 0
	while frames < 10:
		await get_tree().process_frame
		frames += 1

	assert_eq(_session_failures.size(), 0,
		"Dispatched RPC + probe traffic must not emit session_created(false): %s" % str(_session_failures))
	assert_false(_network._async_rpc_in_flight,
		"Async dispatch must be settled (its one-shot consumed)")

# ==================== SECTION B: SCRIPTED-WIRE QUEUE TESTS ====================

## Scripted NetworkManager (issue #1026 pattern from the 401-storm suite):
## overrides the two wire seams — _perform_rpc_attempt (tracked RPCs) and
## _fire_async_rpc (fire-and-forget dispatch) — recording every payload that
## reaches the wire. Not prefixed with "Test" so GUT does not treat it as a
## nested test script.
class IsolationManager:
	extends "res://autoloads/NetworkManager.gd"

	var tracked_dispatches: Array = []
	var async_dispatches: Array = []
	var round_trip_frames: int = 2

	## One scripted tracked round trip; mirrors the real attempt's return
	## contract (see _perform_rpc_attempt in NetworkManager.gd).
	func _perform_rpc_attempt(rpc_id: String, payload: String, _timeout: float) -> Dictionary:
		tracked_dispatches.append({"rpc_id": rpc_id, "payload": payload})
		# Simulate the network round trip so callers genuinely queue on the
		# busy lock while the leader's cycle is in flight.
		for i in range(round_trip_frames):
			await get_tree().process_frame
		return {
			"response": {"ok": true, "rpc_id": rpc_id},
			"is_auth_error": false,
			"token_used": session_token,
			"failed": false
		}

	## One scripted fire-and-forget dispatch; mirrors the real contract —
	## the node is occupied synchronously and freed a few frames later.
	func _fire_async_rpc(rpc_id: String, payload: String) -> void:
		async_dispatches.append({"rpc_id": rpc_id, "payload": payload})
		_async_rpc_in_flight = true
		for i in range(round_trip_frames):
			await get_tree().process_frame
		_async_rpc_in_flight = false

func _make_scripted_manager():
	var nm = IsolationManager.new()
	nm.is_offline = true
	add_child_autofree(nm)
	nm.base_url = "http://127.0.0.1:9"
	return nm

## Pumps frames until every async settle-condition clears or the budget is
## exhausted; returns the frames spent.
func _await_async_settled(nm, frame_budget: int) -> int:
	var frames: int = 0
	while (not nm._async_rpc_queue.is_empty() or nm._async_rpc_in_flight or nm._async_rpc_draining) and frames < frame_budget:
		await get_tree().process_frame
		frames += 1
	return frames

func test_send_rpc_async_queues_behind_busy_gate() -> void:
	# Issue #1108 acceptance: send_rpc_async must honor the _rpc_busy
	# serialization gate. Pre-#1108 the dispatch returned ERR_BUSY and the
	# telemetry payload was silently dropped.
	var nm = _make_scripted_manager()
	_make_session_valid_on(nm)

	# Simulate an in-flight tracked cycle holding the busy gate.
	nm._rpc_busy = true
	for i in range(5):
		nm.send_rpc_async("armored_archer/sync_difficulty", JSON.stringify({"seq": i}))

	assert_eq(nm._async_rpc_queue.size(), 5,
		"All busy-time async payloads must be queued (zero dropped)")
	assert_eq(nm.async_dispatches.size(), 0,
		"Nothing may dispatch while the busy gate is held")
	assert_false(nm._async_rpc_in_flight, "No async dispatch may be in flight while gated")

	# Release the gate; the queue must drain completely.
	nm._rpc_busy = false
	var _frames: int = await _await_async_settled(nm, 300)

	assert_eq(nm.async_dispatches.size(), 5,
		"Every queued payload must eventually dispatch after the gate releases")
	assert_eq(nm._async_rpc_queue.size(), 0, "Async queue must be fully drained")
	assert_false(nm._async_rpc_in_flight, "Async dispatch flag must clear after the drain")
	assert_false(nm._async_rpc_draining, "Drain coroutine must exit after the drain")

func test_concurrent_async_calls_serialize_and_all_dispatch() -> void:
	# The dedicated RPC node serves one request at a time: back-to-back
	# fire-and-forget calls must serialize (first fires, rest queue) with
	# FIFO order preserved — no ERR_BUSY drops.
	var nm = _make_scripted_manager()
	_make_session_valid_on(nm)

	for i in range(4):
		nm.send_rpc_async("armored_archer/log_encounter_pacing", JSON.stringify({"seq": i}))

	assert_eq(nm.async_dispatches.size(), 1, "First async call dispatches immediately")
	assert_eq(nm._async_rpc_queue.size(), 3, "Remaining calls queue behind it")

	var _frames: int = await _await_async_settled(nm, 300)

	assert_eq(nm.async_dispatches.size(), 4,
		"All fire-and-forget payloads must reach the wire (zero dropped)")
	for i in range(4):
		assert_eq(nm.async_dispatches[i]["payload"], JSON.stringify({"seq": i}),
			"Payload %d must dispatch in FIFO order" % i)

func test_concurrent_tracked_and_async_traffic_zero_errors_zero_drops() -> void:
	# Issue #1108 acceptance (the headline scenario): N concurrent tracked
	# send_rpc callers PLUS M concurrent send_rpc_async telemetry calls →
	# ZERO session_created(false) emissions, ZERO dropped payloads, queue
	# fully drained, busy gate released.
	var nm = _make_scripted_manager()
	_make_session_valid_on(nm)

	const TRACKED_COUNT: int = 6
	const ASYNC_COUNT: int = 6

	var responses: Array = []
	var caller: Callable = func(seq: int):
		var response: Dictionary = await nm.send_rpc("issue_1108_rpc", JSON.stringify({"seq": seq}))
		responses.append(response)

	# The first tracked caller takes the busy gate synchronously (its
	# scripted round trip then holds it for a few frames).
	caller.call(0)
	assert_true(nm._rpc_busy, "Leader tracked caller must hold the busy gate")

	# Telemetry fired into the gate must queue, not drop.
	for i in range(ASYNC_COUNT):
		nm.send_rpc_async("armored_archer/log_encounter_pacing", JSON.stringify({"seq": i}))
	assert_eq(nm._async_rpc_queue.size(), ASYNC_COUNT,
		"All async telemetry fired under the gate must be queued")

	# More tracked callers pile in behind the leader.
	for i in range(1, TRACKED_COUNT):
		caller.call(i)

	var frames: int = 0
	while (responses.size() < TRACKED_COUNT or nm.async_dispatches.size() < ASYNC_COUNT or not nm._async_rpc_queue.is_empty() or nm._async_rpc_in_flight or nm._async_rpc_draining) and frames < 600:
		await get_tree().process_frame
		frames += 1

	assert_eq(_session_failures.size(), 0,
		"N concurrent RPC+async calls must emit ZERO session_created(false): %s" % str(_session_failures))
	assert_eq(responses.size(), TRACKED_COUNT,
		"All %d tracked callers must settle (no hang)" % TRACKED_COUNT)
	for i in range(responses.size()):
		assert_true(responses[i].get("ok", false),
			"Tracked caller %d must be served, got %s" % [i, responses[i]])
	assert_eq(nm.async_dispatches.size(), ASYNC_COUNT,
		"Every async payload must dispatch — zero dropped telemetry")
	assert_eq(nm._async_rpc_queue.size(), 0, "Async queue must be fully drained")
	assert_false(nm._rpc_busy, "Busy gate must be released after all cycles settle")

func test_tracked_rpc_settles_while_async_in_flight() -> void:
	# The tracked busy-wait (#1108) also waits out an in-flight async
	# dispatch occupying the RPC node. This exercises the extended wait
	# condition for hangs: the tracked caller must settle and all flags must
	# release — no deadlock between the two traffic kinds.
	var nm = _make_scripted_manager()
	_make_session_valid_on(nm)

	nm.send_rpc_async("armored_archer/sync_difficulty", "{}")
	assert_true(nm._async_rpc_in_flight, "Async dispatch must be in flight")

	var responses: Array = []
	var caller: Callable = func():
		responses.append(await nm.send_rpc("issue_1108_rpc", "{}"))
	caller.call()

	var frames: int = 0
	while responses.is_empty() and frames < 300:
		await get_tree().process_frame
		frames += 1

	assert_eq(responses.size(), 1,
		"Tracked RPC must settle after the async dispatch clears (no deadlock)")
	assert_true(responses[0].get("ok", false), "Tracked RPC must be served, got %s" % responses[0])
	assert_eq(nm.async_dispatches.size(), 1, "Exactly one async dispatch must have fired")
	assert_false(nm._rpc_busy, "Busy gate must be released after the cycle")
