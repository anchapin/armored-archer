## Player Rating Manager autoload for ELO-based skill rating system.
## Tracks player competitive performance, rating history, and displays rating in PvP menus.
##
## Signals:
## - rating_updated(new_rating: int, old_rating: int, mode: String): Emitted when player rating changes
## - rating_history_loaded(history: Array): Emitted when rating history is loaded

extends Node

# --- Constants ---
const DEFAULT_RATING: int = 1200
const MINIMUM_RATING: int = 1000
const MAXIMUM_RATING: int = 3000
const K_FACTOR_NEW: float = 40.0
const K_FACTOR_ESTABLISHED: float = 20.0
const ESTABLISHED_MATCHES: int = 10

# --- Ratings Modes ---
enum RatingMode {
	ONE_V_ONE,
	TWO_V_TWO
}

# --- Signals ---
signal rating_updated(new_rating: int, old_rating: int, mode: RatingMode)
signal rating_history_loaded(history: Array)

# --- State ---
var _player_id: String
var _current_rating: Dictionary = {RatingMode.ONE_V_ONE: DEFAULT_RATING, RatingMode.TWO_V_TWO: DEFAULT_RATING}
var _rating_history: Dictionary = {RatingMode.ONE_V_ONE: [], RatingMode.TWO_V_TWO: []}
var _match_count: Dictionary = {RatingMode.ONE_V_ONE: 0, RatingMode.TWO_V_TWO: 0}
var _network_manager: Node

# --- Initialization ---
func _ready() -> void:
	_network_manager = get_node_or_null("/root/NetworkManager")
	load_rating_from_storage()

## Load rating from local storage
func load_rating_from_storage() -> void:
	if not _network_manager:
		return

	var storage = _network_manager.get_storage_sync()
	if not storage:
		print("Warning: Could not access storage for rating data")
		return

	var stored_ratings = storage.get("player_ratings")
	if stored_ratings is Dictionary:
		_current_rating = stored_ratings
		print("PlayerRatingManager: Loaded ratings from storage: %s" % str(_current_rating))

	var stored_history = storage.get("rating_history")
	if stored_history is Dictionary:
		_rating_history = stored_history
		print("PlayerRatingManager: Loaded rating history from storage")

	rating_history_loaded.emit(_rating_history.values())

## Get current player rating for specified mode
func get_current_rating(mode: RatingMode = RatingMode.ONE_V_ONE) -> int:
	return _current_rating.get(mode, DEFAULT_RATING)

## Update rating after match
func update_rating(opponent_rating: int, is_win: bool, mode: RatingMode = RatingMode.ONE_V_ONE) -> int:
	var old_rating: int = _current_rating.get(mode, DEFAULT_RATING)
	var new_rating: int = calculate_elo(old_rating, opponent_rating, is_win, mode)

	_current_rating[mode] = new_rating
	_match_count[mode] += 1

	# Add to history
	var match_entry = {
		"timestamp": Time.get_unix_time_from_system(),
		"old_rating": old_rating,
		"new_rating": new_rating,
		"opponent_rating": opponent_rating,
		"is_win": is_win
	}
	_rating_history[mode].append(match_entry)

	# Keep only last 50 history entries
	if _rating_history[mode].size() > 50:
		_rating_history[mode] = _rating_history[mode].slice(-50)

	# Save to storage
	save_rating_to_storage()

	# Emit signal
	rating_updated.emit(new_rating, old_rating, mode)

	return new_rating

## Calculate ELO rating change
func calculate_elo(player_rating: int, opponent_rating: int, is_win: bool, mode: RatingMode) -> int:
	var k_factor: float = get_k_factor(mode)
	var expected_score: float = get_expected_score(player_rating, opponent_rating)
	var actual_score: float = 1.0 if is_win else 0.0

	var rating_change: int = int(k_factor * (actual_score - expected_score))
	var new_rating: int = clamp(player_rating + rating_change, MINIMUM_RATING, MAXIMUM_RATING)

	print("PlayerRatingManager: ELO calculation - Player: %d, Opponent: %d, Win: %s, Change: %d" % [player_rating, opponent_rating, is_win, rating_change])

	return new_rating

## Get expected score in ELO formula
func get_expected_score(player_rating: int, opponent_rating: int) -> float:
	var rating_difference: int = opponent_rating - player_rating
	return 1.0 / (1.0 + pow(10.0, rating_difference / 400.0))

## Get K-factor based on player experience
func get_k_factor(mode: RatingMode) -> float:
	var matches: int = _match_count.get(mode, 0)

	# New players get higher K-factor for faster convergence
	if matches < ESTABLISHED_MATCHES:
		return K_FACTOR_NEW
	else:
		return K_FACTOR_ESTABLISHED

## Get rating history for mode
func get_rating_history(mode: RatingMode = RatingMode.ONE_V_ONE) -> Array:
	return _rating_history.get(mode, [])

## Get confidence interval for new players
func get_confidence_interval(mode: RatingMode = RatingMode.ONE_V_ONE) -> Dictionary:
	var matches: int = _match_count.get(mode, 0)

	# Standard deviation decreases as match count increases
	var uncertainty: float = 200.0 / sqrt(float(max(matches, 1)))

	return {
		"rating": _current_rating.get(mode, DEFAULT_RATING),
		"uncertainty": uncertainty,
		"lower_bound": _current_rating.get(mode, DEFAULT_RATING) - int(uncertainty),
		"upper_bound": _current_rating.get(mode, DEFAULT_RATING) + int(uncertainty)
	}

## Save rating to storage
func save_rating_to_storage() -> void:
	if not _network_manager:
		return

	var storage = _network_manager.get_storage_sync()
	if not storage:
		return

	storage.put("player_ratings", _current_rating)
	storage.put("rating_history", _rating_history)

	print("PlayerRatingManager: Saved ratings to storage")

## Reset rating (for testing or admin reset)
func reset_rating(mode: RatingMode = RatingMode.ONE_V_ONE) -> void:
	_current_rating[mode] = DEFAULT_RATING
	_match_count[mode] = 0
	_rating_history[mode] = []
	save_rating_to_storage()

	rating_updated.emit(DEFAULT_RATING, DEFAULT_RATING, mode)
