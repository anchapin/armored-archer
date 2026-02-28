extends Node

# --- RPC IDs ---
const RPC_GAIN_XP = "armored_archer/gain_xp"
const RPC_ALLOCATE_STATS = "armored_archer/allocate_stats"
const RPC_GET_PLAYER_STATS = "armored_archer/get_player_stats"

# --- Player Stats ---
var player_stats: Dictionary = {}
var is_initialized: bool = false

# --- Signals ---
signal stats_updated(stats: Dictionary)
signal level_up(new_level: int, ability_points_gained: int)
signal xp_gained(amount: int, total_xp: int)
signal stat_allocated(stat_name: String, amount: int)

# --- Network Reference ---
@onready var network_manager: Node = get_node_or_null("/root/NetworkManager")

func _ready() -> void:
	if network_manager:
		network_manager.connected.connect(_on_connected)

func _on_connected() -> void:
	await get_player_stats()

func get_player_stats() -> Dictionary:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return {}
	
	var payload = JSON.stringify({})
	var response = await network_manager.send_rpc(RPC_GET_PLAYER_STATS, payload)
	
	if response.has("error"):
		push_error("Failed to get player stats: %s" % response.error)
		return {}
	
	player_stats = JSON.parse_string(response)
	is_initialized = true
	
	emit_signal("stats_updated", player_stats)
	
	return player_stats

func gain_xp(amount: int, source: String) -> void:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return
	
	if amount <= 0:
		push_error("Invalid XP amount")
		return
	
	var payload = JSON.stringify({
		"xp_amount": amount,
		"source": source
	})
	
	var response = await network_manager.send_rpc(RPC_GAIN_XP, payload)
	
	if response.has("error"):
		push_error("Failed to gain XP: %s" % response.error)
		return
	
	var result = JSON.parse_string(response)
	
	if result.get("success", false):
		var xp_gained: int = result.get("xp_gained", 0)
		var levels_gained: int = result.get("levels_gained", 0)
		
		emit_signal("xp_gained", xp_gained, player_stats.get("xp", 0))
		
		if levels_gained > 0:
			var new_level: int = result.player_stats.level
			var ability_points_gained: int = levels_gained
			emit_signal("level_up", new_level, ability_points_gained)
		
		player_stats = result.player_stats
		emit_signal("stats_updated", player_stats)

func allocate_stat(stat_name: String, points: int) -> void:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return
	
	if points <= 0:
		push_error("Invalid points amount")
		return
	
	var payload = JSON.stringify({
		"stat_name": stat_name,
		"points": points
	})
	
	var response = await network_manager.send_rpc(RPC_ALLOCATE_STATS, payload)
	
	if response.has("error"):
		push_error("Failed to allocate stat: %s" % response.error)
		return
	
	var result = JSON.parse_string(response)
	
	if result.get("success", false):
		emit_signal("stat_allocated", stat_name, points)
		player_stats = result.player_stats
		emit_signal("stats_updated", player_stats)

func get_level() -> int:
	return player_stats.get("level", 1)

func get_xp() -> int:
	return player_stats.get("xp", 0)

func get_ability_points() -> int:
	return player_stats.get("ability_points", 0)

func get_stat(stat_name: String) -> int:
	if player_stats.has("stats") and player_stats.stats.has(stat_name):
		return player_stats.stats[stat_name]
	return 0

func get_attack() -> int:
	return get_stat("attack")

func get_defense() -> int:
	return get_stat("defense")

func get_dodge() -> int:
	return get_stat("dodge")

func get_crit_rate() -> int:
	return get_stat("crit_rate")
