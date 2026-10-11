extends GutTest

class NetworkStub extends Node:
	signal connection_status_changed(is_online: bool)
	var is_connected := false
class SeasonStub extends Node:
	signal season_info_loaded(info: Dictionary)
	var fetches := 0
	func get_season_info() -> void:
		fetches += 1

func test_season_fetch_requires_verified_online_state_and_handles_reconnect() -> void:
	var manager = load("res://autoloads/StatAllocationManager.gd").new()
	var network := NetworkStub.new()
	var season := SeasonStub.new()
	add_child_autofree(network)
	add_child_autofree(season)
	# Don't run production _ready against the actual autoload network.
	manager.network_manager = network
	manager.season_manager = season
	manager._on_connection_status_changed(false)
	manager._on_connection_status_changed(true)
	assert_eq(season.fetches, 0, "Offline startup or stale event must not fetch")
	network.is_connected = true
	manager._on_connection_status_changed(true)
	assert_eq(season.fetches, 1)
	network.is_connected = false
	manager._on_connection_status_changed(false)
	assert_eq(season.fetches, 1)
	network.is_connected = true
	manager._on_connection_status_changed(true)
	assert_eq(season.fetches, 2, "Later reconnect gets current season")
	manager.free()
