extends Node

# --- RPC IDs ---
const RPC_GET_SEASON_INFO = "armored_archer/get_season_info"
const RPC_GET_LEADERBOARD = "armored_archer/get_leaderboard"
const RPC_UPDATE_RANK = "armored_archer/update_rank"
const RPC_GET_SEASON_REWARDS = "armored_archer/get_season_rewards"
const RPC_CLAIM_SEASON_REWARDS = "armored_archer/claim_season_rewards"

# --- Season Data ---
var current_season: Dictionary = {}
var player_rank: int = 0
var player_score: int = 0
var time_remaining: int = 0
var leaderboard: Array = []
var season_rewards: Dictionary = {}
var rewards_claimed: bool = false

# --- Signals ---
signal season_info_loaded(season_info: Dictionary)
signal leaderboard_loaded(leaderboard: Array)
signal rank_updated(rank_change: Dictionary)
signal rewards_loaded(rewards: Dictionary)
signal rewards_claimed(rewards: Dictionary)

# --- Network Reference ---
@onready var network_manager: Node = get_node_or_null("/root/NetworkManager")

# --- Get Season Info ---
func get_season_info() -> void:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return
	
	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_SEASON_INFO, json.stringify({}))
	
	if response.has("error"):
		push_error("Failed to get season info: %s" % response.error)
		return
	
	if response.get("success", false):
		current_season = response.get("season", {})
		player_rank = response.get("player_rank", 0)
		player_score = response.get("player_score", 0)
		time_remaining = response.get("time_remaining", 0)
		
		season_info_loaded.emit({
			"season": current_season,
			"player_rank": player_rank,
			"player_score": player_score,
			"time_remaining": time_remaining
		})

# --- Get Leaderboard ---
func get_leaderboard(limit: int = 50) -> void:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return
	
	var payload: Dictionary = {
		"limit": limit
	}
	
	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_LEADERBOARD, json.stringify(payload))
	
	if response.has("error"):
		push_error("Failed to get leaderboard: %s" % response.error)
		return
	
	if response.get("success", false):
		leaderboard = response.get("leaderboard", [])
		leaderboard_loaded.emit(leaderboard)

# --- Update Rank ---
func update_rank(winner_id: String, loser_id: String, is_punch_up: bool = false) -> void:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return
	
	if winner_id.is_empty() or loser_id.is_empty():
		push_error("Winner and loser IDs required")
		return
	
	var payload: Dictionary = {
		"winner_id": winner_id,
		"loser_id": loser_id,
		"is_punch_up": is_punch_up
	}
	
	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_UPDATE_RANK, json.stringify(payload))
	
	if response.has("error"):
		push_error("Failed to update rank: %s" % response.error)
		return
	
	if response.get("success", false):
		var rank_change: Dictionary = {
			"winner": response.get("winner", {}),
			"loser": response.get("loser", {}),
			"is_punch_up": response.get("is_punch_up", false)
		}
		
		if NetworkManager.user_id == winner_id:
			player_score = rank_change.winner.get("new_rank", player_score)
		elif NetworkManager.user_id == loser_id:
			player_score = rank_change.loser.get("new_rank", player_score)
		
		rank_updated.emit(rank_change)

# --- Get Season Rewards ---
func get_season_rewards() -> void:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return
	
	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_SEASON_REWARDS, json.stringify({}))
	
	if response.has("error"):
		push_error("Failed to get season rewards: %s" % response.error)
		return
	
	if response.get("success", false):
		season_rewards = response.get("rewards", {})
		rewards_loaded.emit(season_rewards)

# --- Claim Season Rewards ---
func claim_season_rewards() -> void:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return
	
	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_CLAIM_SEASON_REWARDS, json.stringify({}))
	
	if response.has("error"):
		push_error("Failed to claim rewards: %s" % response.error)
		return
	
	if response.get("success", false):
		season_rewards = response.get("rewards", {})
		rewards_claimed = response.get("claimed", false)
		rewards_claimed.emit(season_rewards)

# --- Utility Methods ---
func get_current_season() -> Dictionary:
	return current_season

func get_player_rank_sync() -> int:
	return player_rank

func get_player_score_sync() -> int:
	return player_score

func get_time_remaining() -> int:
	return time_remaining

func get_leaderboard_sync() -> Array:
	return leaderboard

func get_rewards_sync() -> Dictionary:
	return season_rewards

func is_rewards_claimed() -> bool:
	return rewards_claimed

func format_time_remaining() -> String:
	var seconds: int = time_remaining / 1000
	var days: int = seconds / 86400
	var hours: int = (seconds % 86400) / 3600
	var minutes: int = (seconds % 3600) / 60
	
	if days > 0:
		return "%dd %dh" % [days, hours]
	elif hours > 0:
		return "%dh %dm" % [hours, minutes]
	else:
		return "%dm" % minutes

func get_rank_tier(rank: int) -> String:
	if rank <= 10:
		return "Legendary"
	elif rank <= 50:
		return "Epic"
	elif rank <= 100:
		return "Rare"
	elif rank <= 500:
		return "Uncommon"
	else:
		return "Common"

func get_rank_color(rank: int) -> Color:
	if rank <= 10:
		return Color.ORANGE
	elif rank <= 50:
		return.Color.MAGENTA
	elif rank <= 100:
		return.Color.BLUE
	elif rank <= 500:
		return.Color.GREEN
	else:
		return.Color.GRAY
