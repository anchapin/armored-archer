extends GutTest

# Tests for the MatchmakingAnalyticsManager autoload's server telemetry
# wiring (issue #1664). Hand-rolled NetworkManager stub, same MOCK-05
# rationale as test_campaign_manager.gd: GUT cannot stub script-level
# methods on a double of a bare native class.

## Records fire-and-forget telemetry calls.
class StubNetworkManager extends Node:
	var is_connected: bool = true
	var async_calls: Array = []

	func send_rpc_async(rpc_id: String, payload: String, _timeout: float = 10.0) -> void:
		async_calls.append({"rpc_id": rpc_id, "payload": payload})

# --- Fixtures ---

var _manager = null
var _network: StubNetworkManager = null

func before_each():
	var Manager = preload("res://autoloads/MatchmakingAnalyticsManager.gd")
	_manager = Manager.new()
	add_child(_manager)
	_network = StubNetworkManager.new()
	add_child(_network)
	_manager._network_manager = _network

func after_each():
	_manager.queue_free()
	_network.queue_free()

# --- log_match_data wiring ---

func test_log_match_data_sends_schema_payload_to_server():
	_manager.log_match_data(42, ["bow", "sword"], 123.5, "match_1")

	assert_eq(_network.async_calls.size(), 1, "one telemetry RPC sent")
	var call: Dictionary = _network.async_calls[0]
	assert_eq(call["rpc_id"], "armored_archer/log_match_data")
	var payload: Dictionary = JSON.parse_string(call["payload"])
	assert_eq(payload["match_id"], "match_1")
	assert_eq(payload["rating_diff"], 42)
	assert_eq(payload["weapons"], ["bow", "sword"])
	assert_eq(payload["duration"], 123.5)
	assert_true(payload["timestamp"] > 0, "server schema requires a timestamp")
	assert_false(payload.has("completed"), "payload carries only schema fields")

func test_log_match_data_skips_send_when_disconnected():
	_network.is_connected = false
	_manager.log_match_data(42, ["bow"], 10.0, "match_2")
	assert_eq(_network.async_calls.size(), 0, "no RPC while disconnected")

# --- track_abandonment wiring ---

func test_track_abandonment_sends_schema_payload_to_server():
	_manager.log_match_data(10, ["bow"], 5.0, "match_3")
	_network.async_calls.clear()

	_manager.track_abandonment("match_3", "player_quit")

	assert_eq(_network.async_calls.size(), 1, "one telemetry RPC sent")
	var call: Dictionary = _network.async_calls[0]
	assert_eq(call["rpc_id"], "armored_archer/log_abandonment")
	var payload: Dictionary = JSON.parse_string(call["payload"])
	assert_eq(payload["match_id"], "match_3")
	assert_eq(payload["reason"], "player_quit")
	assert_true(payload["timestamp"] > 0, "server schema requires a timestamp")

func test_track_abandonment_omits_empty_reason():
	_manager.log_match_data(10, ["bow"], 5.0, "match_4")
	_network.async_calls.clear()

	_manager.track_abandonment("match_4")

	var payload: Dictionary = JSON.parse_string(_network.async_calls[0]["payload"])
	assert_false(payload.has("reason"), "reason is optional server-side; empty stays absent")

func test_track_abandonment_clamps_reason_to_server_limit():
	_manager.log_match_data(10, ["bow"], 5.0, "match_5")
	_network.async_calls.clear()

	_manager.track_abandonment("match_5", "x".repeat(600))

	var payload: Dictionary = JSON.parse_string(_network.async_calls[0]["payload"])
	assert_eq(payload["reason"].length(), 500, "reason clamped to the schema's 500-char limit")

func test_track_abandonment_skips_send_when_disconnected():
	_network.is_connected = false
	_manager.log_match_data(10, ["bow"], 5.0, "match_6")
	_manager.track_abandonment("match_6", "player_quit")
	assert_eq(_network.async_calls.size(), 0, "no RPC while disconnected")
