## Real HTTP probe regression. Uses a disposable loopback fixture, never a user backend.
extends SceneTree

class ProbeManager extends "res://autoloads/NetworkManager.gd":
	var auth_requests: int = 0

	func _issue_auth_request_with_retry() -> void:
		auth_requests += 1

var failures: int = 0
var manager: ProbeManager

func _initialize() -> void:
	call_deferred("_run")

func check(condition: bool, label: String) -> void:
	if not condition:
		failures += 1
		printerr("HEALTH FAIL: " + label)

func _run() -> void:
	for singleton in root.get_children():
		singleton.process_mode = Node.PROCESS_MODE_DISABLED
	manager = ProbeManager.new()
	root.add_child(manager)
	manager.is_offline = false
	manager._probe_http_request = HTTPRequest.new()
	manager.add_child(manager._probe_http_request)
	var fixture: String = OS.get_environment("HEALTH_FIXTURE_URL")
	check(fixture.begins_with("http://127.0.0.1:"), "fixture must be loopback")
	var blocked: Array = []
	manager.auth_blocked.connect(func(reason: String, _guidance: String): blocked.append(reason))
	manager.base_url = fixture + "/ok"
	var started: int = Time.get_ticks_msec()
	await manager._run_health_gate_then_auth()
	check(manager._last_health_check_passed, "HTTP 200 passes")
	check(manager.auth_requests == 1, "HTTP 200 allows auth exactly once")
	check(Time.get_ticks_msec() - started < 2000, "200 finishes without waiting for timeout")
	check(blocked.is_empty(), "200 does not emit blocked")
	manager.base_url = fixture + "/unavailable"
	await manager._run_health_gate_then_auth()
	check(not manager._last_health_check_passed, "503 clears previous success")
	check(manager.auth_requests == 1, "503 does not issue auth")
	check(blocked.size() == 1, "503 emits blocked")
	manager._auth_blocked_emitted = false
	manager.base_url = fixture + "/timeout"
	started = Time.get_ticks_msec()
	await manager._run_health_gate_then_auth()
	var elapsed: int = Time.get_ticks_msec() - started
	check(elapsed >= 3500 and elapsed < 5500, "timeout bounded at four seconds")
	check(not manager._last_health_check_passed, "timeout stays fail-closed")
	check(manager.auth_requests == 1, "timeout does not issue auth")
	check(blocked.size() == 2, "timeout emits blocked")
	check(manager._probe_http_request.request_completed.get_connections().is_empty(), "timeout disconnects callback")
	manager.base_url = fixture + "/ok"
	check(await manager._probe_health(), "probe after timeout succeeds")
	check(manager._probe_http_request.request_completed.get_connections().is_empty(), "success leaves no callback")
	manager._probe_http_request.request_completed.emit(HTTPRequest.RESULT_CONNECTION_ERROR, 200, PackedStringArray(), PackedByteArray())
	check(not manager._health_probe_busy, "probe busy flag cleared")
	manager.base_url = fixture + "/no-content"
	check(not await manager._probe_health(), "204 is not a healthy Nakama response")
	manager.base_url = fixture + "/disconnect"
	check(not await manager._probe_health(), "transport failure stays fail-closed")
	check(manager._probe_http_request.request_completed.get_connections().is_empty(), "transport failure disconnects callback")
	manager.queue_free()
	print("HEALTH RESULT: failures=%d" % failures)
	quit(0 if failures == 0 else 1)
