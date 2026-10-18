extends GutTest

# Tests for the WeaponBalanceManager admin balance-report wiring: the
# client fetches the server-aggregated report through the admin-gated
# armored_archer/get_balance_metrics RPC. Hand-rolled NetworkManager stub,
# same MOCK-05 rationale as test_campaign_manager.gd: GUT cannot stub
# script-level methods on a double of a bare native class.

## Records tracked send_rpc calls and replays a canned response.
class StubNetworkManager extends Node:
	var is_connected: bool = true
	var calls: Array = []
	var canned_response: Dictionary = {"success": true, "weapons": [], "flagged_weapons": []}

	func send_rpc(rpc_id: String, payload: String, _timeout: float = 30.0) -> Dictionary:
		calls.append({"rpc_id": rpc_id, "payload": payload})
		return canned_response

# --- Fixtures ---

var _manager = null
var _network: StubNetworkManager = null

func before_each():
	var Manager = preload("res://autoloads/WeaponBalanceManager.gd")
	_manager = Manager.new()
	add_child(_manager)
	_network = StubNetworkManager.new()
	add_child(_network)
	_manager.network_manager = _network

func after_each():
	_manager.queue_free()
	_network.queue_free()

# --- request_balance_report wiring ---

func test_report_request_sends_empty_payload_without_weapon_id():
	await _manager.request_balance_report()

	assert_eq(_network.calls.size(), 1, "one report RPC sent")
	var call: Dictionary = _network.calls[0]
	assert_eq(call["rpc_id"], "armored_archer/get_balance_metrics")
	assert_eq(call["payload"], "{}")

func test_report_request_includes_weapon_id_when_given():
	await _manager.request_balance_report("bow_a")

	var payload: Dictionary = JSON.parse_string(_network.calls[0]["payload"])
	assert_eq(payload["weapon_id"], "bow_a")

func test_report_request_emits_parsed_report():
	watch_signals(_manager)

	await _manager.request_balance_report()

	assert_signal_emitted(_manager, "balance_report_received")
	var emitted: Array = get_signal_parameters(_manager, "balance_report_received")
	assert_true(emitted[0]["success"])

func test_report_request_does_not_emit_on_error_response():
	_network.canned_response = {"error": "Not authenticated"}
	watch_signals(_manager)

	await _manager.request_balance_report()

	assert_push_error("Weapon balance report request failed: Not authenticated")
	assert_signal_not_emitted(_manager, "balance_report_received")

func test_report_request_does_not_emit_on_authorization_denial():
	_network.canned_response = {"success": false, "error": "Not authorized"}
	watch_signals(_manager)

	await _manager.request_balance_report()

	assert_push_error("Weapon balance report request failed: Not authorized")
	assert_signal_not_emitted(_manager, "balance_report_received")

func test_report_request_skips_call_when_disconnected():
	_network.is_connected = false

	await _manager.request_balance_report()

	assert_push_error("Cannot request balance report: not connected to server")
	assert_eq(_network.calls.size(), 0, "no RPC while disconnected")
