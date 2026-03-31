extends Node
## Manages match creation, listing, filtering, and joining.
## Handles matchmaking via Nakama RPC endpoints.
##
## Signals:
## - match_created(match_id: String): Emitted when a new match is created
## - matches_updated(matches: Array): Emitted when match list is refreshed
## - match_joined(match_id: String, match_data: Dictionary): Emitted when joined a match

# --- Signals ---
signal match_created(match_id: String)
signal matches_updated(matches: Array)
signal match_joined(match_id: String, match_data: Dictionary)

# --- Properties ---
var available_matches: Array = []
var current_match: Dictionary = {}

# --- State ---
var is_matchmaking_active: bool = false
var _pending_creation: bool = false

# --- Initialization ---
func _ready() -> void:
	print("[MatchmakingManager] Initialized")

# --- Match Creation ---

## Creates a new match with specified parameters
## Parameters:
##   match_type: String - Type of match ("1v1", "2v2", etc.)
##   punch_up: bool - Whether punch-up mode is enabled
func create_match(match_type: String = "1v1", punch_up: bool = false) -> String:
	if _pending_creation:
		push_warning("[MatchmakingManager] Match creation already in progress")
		return ""
	
	if not NetworkManager.is_session_valid():
		push_error("[MatchmakingManager] Cannot create match: not authenticated")
		return ""
	
	print("[MatchmakingManager] Creating match - type: %s, punch_up: %s" % [match_type, punch_up])
	
	_pending_creation = true
	
	# TODO: RPC to Nakama - call rpc_create_match with match_type, punch_up
	# Expected response: { "match_id": "...", "match_data": {...} }
	var rpc_payload: String = JSON.stringify({
		"match_type": match_type,
		"punch_up": punch_up,
		"timestamp": Time.get_ticks_msec()
	})
	
	var response: Dictionary = await NetworkManager.send_rpc("rpc_create_match", rpc_payload)
	_pending_creation = false
	
	if response.has("error"):
		push_error("[MatchmakingManager] Create match error: %s" % response.error)
		return ""
	
	if response.has("match_id"):
		var match_id: String = response.match_id
		print("[MatchmakingManager] Match created: %s" % match_id)
		match_created.emit(match_id)
		return match_id
	
	return ""

# --- Match Listing & Filtering ---

## Retrieves list of available matches with optional filters
## Parameters:
##   filters: Dictionary - Filter criteria { "match_type": "1v1", "min_rating": 1000, etc. }
func list_matches(filters: Dictionary = {}) -> Array:
	if not NetworkManager.is_session_valid():
		push_error("[MatchmakingManager] Cannot list matches: not authenticated")
		return []
	
	print("[MatchmakingManager] Listing matches with filters: %s" % filters)
	
	# TODO: RPC to Nakama - call rpc_list_matches with filters
	# Expected response: { "matches": [{...}, {...}], "count": 5 }
	var rpc_payload: String = JSON.stringify({
		"filters": filters,
		"limit": 20,
		"offset": 0
	})
	
	var response: Dictionary = await NetworkManager.send_rpc("rpc_list_matches", rpc_payload)
	
	if response.has("error"):
		push_error("[MatchmakingManager] List matches error: %s" % response.error)
		return []
	
	if response.has("matches"):
		available_matches = response.matches
		print("[MatchmakingManager] Found %d available matches" % available_matches.size())
		matches_updated.emit(available_matches)
		return available_matches
	
	return []

## Refreshes the available matches list
func refresh_matches() -> void:
	var _result = await list_matches({})

# --- Match Joining ---

## Joins an existing match by ID
## Parameters:
##   match_id: String - The ID of the match to join
func join_match(match_id: String) -> bool:
	if not NetworkManager.is_session_valid():
		push_error("[MatchmakingManager] Cannot join match: not authenticated")
		return false
	
	if match_id.is_empty():
		push_error("[MatchmakingManager] Invalid match_id")
		return false
	
	print("[MatchmakingManager] Joining match: %s" % match_id)
	
	# TODO: RPC to Nakama - call rpc_join_match with match_id
	# Expected response: { "match_data": {...}, "join_status": "success" }
	var rpc_payload: String = JSON.stringify({
		"match_id": match_id,
		"timestamp": Time.get_ticks_msec()
	})
	
	var response: Dictionary = await NetworkManager.send_rpc("rpc_join_match", rpc_payload)
	
	if response.has("error"):
		push_error("[MatchmakingManager] Join match error: %s" % response.error)
		return false
	
	if response.has("match_data"):
		current_match = response.match_data
		print("[MatchmakingManager] Successfully joined match: %s" % match_id)
		match_joined.emit(match_id, current_match)
		return true
	
	return false

# --- Match Info ---

## Gets current match data
func get_current_match() -> Dictionary:
	return current_match.duplicate()

## Gets specific match info by ID
func get_match_info(match_id: String) -> Dictionary:
	for match_data in available_matches:
		if match_data.get("match_id") == match_id:
			return match_data.duplicate()
	
	return {}

## Checks if currently in a match
func is_in_match() -> bool:
	return not current_match.is_empty()

# --- Match Status ---

## Gets the number of available matches
func get_available_match_count() -> int:
	return available_matches.size()

## Filters matches by type
func get_matches_by_type(match_type: String) -> Array:
	var filtered: Array = []
	for match_data in available_matches:
		if match_data.get("match_type") == match_type:
			filtered.append(match_data)
	return filtered

## Filters matches by minimum rating
func get_matches_by_rating(min_rating: int) -> Array:
	var filtered: Array = []
	for match_data in available_matches:
		if match_data.get("rating", 0) >= min_rating:
			filtered.append(match_data)
	return filtered

# --- Cleanup ---
func _exit_tree() -> void:
	print("[MatchmakingManager] Cleanup complete")
