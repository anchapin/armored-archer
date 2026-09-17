extends GutTest

# Issue #1138 regression suite: 401-storm N+1 amplification in the #1079
# replay path. _rpc_busy used to be released BEFORE the coalesced refresh,
# so every caller queued on the busy lock immediately fired with the
# still-stale token, 401'd, and added its own recovery + replay to the
# storm. These tests prove the busy lock is held across recovery + replay
# (single concurrent recovery, queued callers served with the rotated
# token), that a failed recovery cannot deadlock the queue, and that the
# busy state is released exactly once per cycle.
#
# GUT cannot double the native HTTPRequest class (issue #1026), and native
# request() is not virtual, so a transport subclass override would never be
# called. Instead StormManager below extends NetworkManager itself and
# overrides the two wire seams — _perform_rpc_attempt (issue #1138) and
# _refresh_session — with scripted responses. GDScript dispatches these
# virtually, so the busy-lock, recovery-coalescing, watchdog, and replay
# logic under test is all the real production code.

var NetworkManagerClass = load("res://autoloads/NetworkManager.gd")
var _network
var _session_file_path: String = NetworkManagerClass.SESSION_FILE

## Scripted NetworkManager: counts wire requests and answers them from
## canned state. Not prefixed with "Test" so GUT does not treat it as a
## nested test script.
class StormManager:
	extends "res://autoloads/NetworkManager.gd"

	const STALE_TOKEN: String = "stale_session_token"
	const FRESH_TOKEN: String = "rotated_session_token"

	# Wire counters — the amplification assertions read these.
	var rpc_request_count: int = 0
	var refresh_request_count: int = 0
	# Scripted refresh outcome; a failing refresh never rotates the token
	# and never emits session_refreshed (leader resolves via the #1151
	# watchdog).
	var refresh_succeeds: bool = true
	var refresh_delay_frames: int = 3

	## One scripted RPC round trip: 401 when signed with the stale token,
	## {"ok": true} when signed with the rotated one. Mirrors the real
	## attempt's return contract (see _perform_rpc_attempt in
	## NetworkManager.gd).
	func _perform_rpc_attempt(rpc_id: String, payload: String, _timeout: float) -> Dictionary:
		rpc_request_count += 1
		var token_used: String = session_token
		# Simulate the network round trip so callers genuinely queue on the
		# busy lock while the leader's cycle is in flight.
		for i in range(2):
			await get_tree().process_frame
		if token_used == FRESH_TOKEN:
			return {
				"response": {"ok": true, "rpc_id": rpc_id, "payload": payload},
				"is_auth_error": false,
				"token_used": token_used,
				"failed": false
			}
		return {
			"response": {"error": "token expired (issue #1138 test)", "is_auth_error": true},
			"is_auth_error": true,
			"token_used": token_used,
			"failed": false
		}

	## Scripted refresh: rotates the token a few frames in and emits
	## session_refreshed, which the real _run_refresh_and_await_result
	## one-shot listener is already waiting for. The delay mirrors the real
	## refresh round trip and gives queued callers frames to (wrongly, in a
	## regression) wake up with the still-stale token.
	func _refresh_session() -> void:
		refresh_request_count += 1
		for i in range(refresh_delay_frames):
			await get_tree().process_frame
		if refresh_succeeds:
			session_token = FRESH_TOKEN
			refresh_token = "rotated_refresh_token"
			session_refreshed.emit(true, "")

func _remove_persisted_session() -> void:
	# Issue #969: a session file persisted by an earlier test or run is
	# restored by NetworkManager._ready(), polluting initial state.
	if FileAccess.file_exists(_session_file_path):
		DirAccess.remove_absolute(_session_file_path)
	# Issue #1095: wipe the SecureStore encrypted blob too — it is the
	# new at-rest location for session/refresh tokens after the
	# plaintext-to-encrypted migration.
	var secure_store: Node = get_node_or_null("/root/SecureStore")
	if secure_store != null and secure_store.has_method("has_session_blob") and secure_store.has_session_blob():
		secure_store.call("erase_session_blob")

func before_each() -> void:
	_remove_persisted_session()

	_network = StormManager.new()
	# Offline keeps _ready()'s auto-connect short-circuited (issue #1026
	# pattern from test_network_manager.gd); each test flips the session
	# state it needs explicitly.
	_network.is_offline = true
	add_child_autofree(_network)

func after_each() -> void:
	_remove_persisted_session()
	_network = null

func _make_session_valid_with_stale_token() -> void:
	_network.session_token = StormManager.STALE_TOKEN
	_network.refresh_token = "stale_refresh_token"
	_network.is_connected = true
	_network.is_offline = false

## Spawns `count` concurrent send_rpc callers, each with a distinct payload
## (distinct (rpc_id, payload) tuples), and waits until every caller settled
## or the frame budget is exhausted. Returns the collected responses.
func _fire_concurrent_rpcs(count: int, frame_budget: int) -> Array:
	var responses: Array = []
	var caller: Callable = func(seq: int):
		var response: Dictionary = await _network.send_rpc(
			"issue_1138_storm", JSON.stringify({"seq": seq})
		)
		responses.append(response)
	for i in range(count):
		caller.call(i)
	var frames: int = 0
	while responses.size() < count and frames < frame_budget:
		await get_tree().process_frame
		frames += 1
	return responses

func test_401_storm_no_n1_amplification():
	# Issue #1138 acceptance: 20 concurrent RPCs against a 401-returning
	# server must produce at most 21 wire RPC requests (1 unavoidable
	# original 401 + 20 post-recovery sends) plus exactly 1 refresh — not
	# the 2M+ round-trips the pre-fix early busy release caused (40+ today).
	_make_session_valid_with_stale_token()

	var responses: Array = await _fire_concurrent_rpcs(20, 3000)

	assert_eq(responses.size(), 20, "All 20 concurrent callers must settle (no hang)")
	if responses.size() != 20:
		return
	for i in range(responses.size()):
		if responses[i].has("error"):
			assert_eq(responses[i].error, "", "Caller %d should be served, got error" % i)
			return
	assert_true(responses.all(func(r): return r.get("ok", false)),
		"Every caller must receive the 200 body, not a surfaced 401")
	assert_eq(_network.refresh_request_count, 1,
		"Exactly ONE coalesced refresh must serve the whole storm")
	assert_true(_network.rpc_request_count <= 21,
		"401 storm must not amplify: expected <= 21 RPC wire requests (1 original + 20 post-recovery sends), got %d" % _network.rpc_request_count)
	assert_eq(_network.session_token, StormManager.FRESH_TOKEN,
		"Recovery must rotate the session token")
	assert_false(_network._rpc_busy, "Busy lock must be released after the storm settles")

func test_recovery_failure_no_deadlock():
	# Issue #1138 acceptance: when recovery fails, queued callers must still
	# settle (surfacing their auth error) and the busy lock must be
	# released — no caller may hang forever behind a stuck leader cycle.
	_make_session_valid_with_stale_token()
	# A failing refresh never rotates the token and never emits
	# session_refreshed, so each leader resolves via the #1151 watchdog.
	# Shrink it for a fast test.
	_network.refresh_succeeds = false
	_network._refresh_watchdog_ms = 150
	_network._refresh_watchdog_max_frames = 120

	var responses: Array = await _fire_concurrent_rpcs(3, 3000)

	assert_eq(responses.size(), 3, "All callers must settle even when recovery fails")
	if responses.size() != 3:
		return
	for i in range(responses.size()):
		assert_true(responses[i].get("is_auth_error", false),
			"Caller %d must surface the auth error, got %s" % [i, responses[i]])
	assert_false(_network._rpc_busy,
		"Busy lock must be released after failed recovery (no deadlock)")
	# Recovery is attempted once per caller, serially — bounded, not a storm.
	assert_eq(_network.refresh_request_count, 3,
		"Each caller attempts exactly one (failing) refresh, serialized")
	assert_eq(_network.rpc_request_count, 3,
		"Failed recovery must not replay: exactly one original per caller")

func test_busy_released_after_successful_replay():
	# Issue #1138 acceptance: busy state is released exactly once — after a
	# successful 401 -> refresh -> replay cycle the lock is free again and a
	# subsequent RPC is served normally with the rotated token.
	_make_session_valid_with_stale_token()

	var first: Dictionary = await _network.send_rpc("issue_1138_replay", "{}")
	assert_true(first.get("ok", false), "First call must succeed via 401 + refresh + single replay")
	assert_eq(_network.session_token, StormManager.FRESH_TOKEN, "Token must be rotated")
	assert_false(_network._rpc_busy, "Busy lock must be released after the cycle")
	assert_eq(_network.refresh_request_count, 1, "Exactly one refresh for the cycle")
	assert_eq(_network.rpc_request_count, 2, "Original 401 + single replay")

	# The next request must not be blocked by a leaked busy state and must
	# succeed on its first attempt with the rotated token.
	var second: Dictionary = await _network.send_rpc("issue_1138_replay", "{}")
	assert_true(second.get("ok", false), "Follow-up RPC must be served after the cycle")
	assert_eq(_network.refresh_request_count, 1, "No extra refresh after recovery settled")
	assert_eq(_network.rpc_request_count, 3, "Follow-up RPC fires exactly once")
	assert_false(_network._rpc_busy, "Busy lock must still be released")
