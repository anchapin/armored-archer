extends GutTest

## Unit tests for PlayerRatingManager
## Tests ELO-based rating system, K-factors, and rating history.

const PlayerRatingManagerScript := preload("res://autoloads/PlayerRatingManager.gd")

var rating_manager: Node

## Records rating_updated emissions (lambdas capture locals by value, so a
## flag-flipping lambda never updates the outer variables).
class RatingRecorder extends RefCounted:
	var calls: Array = []

	func record(new_rating: int, old_rating: int, _mode: int) -> void:
		calls.append([new_rating, old_rating])

func before_each():
	# Fresh instance per test: the shared autoload singleton leaks state
	# between tests (match counts, ratings, history), and its _ready loads
	# persisted storage whose JSON round-trip turns the enum-keyed state
	# dictionaries' keys into strings. Reset to a deterministic fresh state
	# and detach storage so the suite stays isolated.
	rating_manager = PlayerRatingManagerScript.new()
	add_child_autofree(rating_manager)
	rating_manager._network_manager = null
	rating_manager._current_rating = {
		PlayerRatingManager.RatingMode.ONE_V_ONE: PlayerRatingManager.DEFAULT_RATING,
		PlayerRatingManager.RatingMode.TWO_V_TWO: PlayerRatingManager.DEFAULT_RATING
	}
	rating_manager._rating_history = {
		PlayerRatingManager.RatingMode.ONE_V_ONE: [],
		PlayerRatingManager.RatingMode.TWO_V_TWO: []
	}
	rating_manager._match_count = {
		PlayerRatingManager.RatingMode.ONE_V_ONE: 0,
		PlayerRatingManager.RatingMode.TWO_V_TWO: 0
	}

## Test PlayerRatingManager singleton exists
func test_player_rating_manager_exists():
	var manager = get_node_or_null("/root/PlayerRatingManager")
	assert_not_null(manager, "PlayerRatingManager should be loaded as autoload")

## Test default rating
func test_default_rating():
	var manager = rating_manager

	var rating = manager.get_current_rating(PlayerRatingManager.RatingMode.ONE_V_ONE)
	assert_eq(rating, PlayerRatingManager.DEFAULT_RATING, "Default rating should be 1200")

## Test get_current_rating for 1v1 mode
func test_get_current_rating_1v1():
	var manager = rating_manager

	var rating = manager.get_current_rating(PlayerRatingManager.RatingMode.ONE_V_ONE)
	assert_true(rating >= PlayerRatingManager.MINIMUM_RATING, "Rating should be above minimum")
	assert_true(rating <= PlayerRatingManager.MAXIMUM_RATING, "Rating should be below maximum")

## Test get_current_rating for 2v2 mode
func test_get_current_rating_2v2():
	var manager = rating_manager

	var rating = manager.get_current_rating(PlayerRatingManager.RatingMode.TWO_V_TWO)
	assert_true(rating >= PlayerRatingManager.MINIMUM_RATING, "Rating should be above minimum")
	assert_true(rating <= PlayerRatingManager.MAXIMUM_RATING, "Rating should be below maximum")

## Test ELO formula - win against similar rating
func test_elo_win_similar_rating():
	var manager = rating_manager

	var player_rating: int = 1200
	var opponent_rating: int = 1200
	var new_rating: int = manager.calculate_elo(player_rating, opponent_rating, true, PlayerRatingManager.RatingMode.ONE_V_ONE)

	# Win against equal rating should give moderate gain
	assert_true(new_rating > player_rating, "Win should increase rating")
	assert_true(new_rating - player_rating < 50, "Gain should be reasonable (<50)")

## Test ELO formula - loss against similar rating
func test_elo_loss_similar_rating():
	var manager = rating_manager

	var player_rating: int = 1200
	var opponent_rating: int = 1200
	var new_rating: int = manager.calculate_elo(player_rating, opponent_rating, false, PlayerRatingManager.RatingMode.ONE_V_ONE)

	# Loss against equal rating should decrease rating
	assert_true(new_rating < player_rating, "Loss should decrease rating")
	assert_true(player_rating - new_rating < 50, "Loss should be reasonable (<50)")

## Test ELO formula - win against higher rating
func test_elo_win_higher_rating():
	var manager = rating_manager

	var player_rating: int = 1200
	var opponent_rating: int = 1400
	var new_rating: int = manager.calculate_elo(player_rating, opponent_rating, true, PlayerRatingManager.RatingMode.ONE_V_ONE)

	# Win against higher rating should give significant gain
	assert_true(new_rating > player_rating, "Win should increase rating")
	assert_true(new_rating - player_rating > 15, "Gain should be significant (>15)")

## Test ELO formula - loss against lower rating
func test_elo_loss_lower_rating():
	var manager = rating_manager

	var player_rating: int = 1200
	var opponent_rating: int = 1000
	var new_rating: int = manager.calculate_elo(player_rating, opponent_rating, false, PlayerRatingManager.RatingMode.ONE_V_ONE)

	# Loss against lower rating should cause significant loss
	assert_true(new_rating < player_rating, "Loss should decrease rating")
	assert_true(player_rating - new_rating > 15, "Loss should be significant (>15)")

## Test K-factor for new players
func test_k_factor_new_players():
	var manager = rating_manager

	# New players should have higher K-factor
	var k_factor_new: float = manager.get_k_factor(PlayerRatingManager.RatingMode.ONE_V_ONE)
	assert_eq(k_factor_new, PlayerRatingManager.K_FACTOR_NEW, "New players should have K=40")

## Test K-factor for established players
func test_k_factor_established_players():
	var manager = rating_manager

	# Force player to have 10 matches
	manager._match_count[PlayerRatingManager.RatingMode.ONE_V_ONE] = 10

	var k_factor_est: float = manager.get_k_factor(PlayerRatingManager.RatingMode.ONE_V_ONE)
	assert_eq(k_factor_est, PlayerRatingManager.K_FACTOR_ESTABLISHED, "Established players should have K=20")

## Test rating history tracking
func test_rating_history_tracking():
	var manager = rating_manager

	var initial_history = manager.get_rating_history(PlayerRatingManager.RatingMode.ONE_V_ONE)
	var initial_size: int = initial_history.size()

	manager.update_rating(1200, true, PlayerRatingManager.RatingMode.ONE_V_ONE)

	var new_history = manager.get_rating_history(PlayerRatingManager.RatingMode.ONE_V_ONE)
	assert_eq(new_history.size(), initial_size + 1, "History should have one more entry")

## Test rating_updated signal
func test_rating_updated_signal():
	var manager = rating_manager

	var recorder = RatingRecorder.new()
	manager.rating_updated.connect(recorder.record)

	manager.update_rating(1200, true, PlayerRatingManager.RatingMode.ONE_V_ONE)

	# Wait a frame for signal processing
	await get_tree().process_frame

	assert_eq(recorder.calls.size(), 1, "rating_updated signal should be emitted")
	assert_eq(recorder.calls[0][1], PlayerRatingManager.DEFAULT_RATING, "Signal should carry the old rating")
	assert_eq(recorder.calls[0][0], manager.get_current_rating(PlayerRatingManager.RatingMode.ONE_V_ONE), "Signal should carry the new rating")

## Test confidence interval for new players
func test_confidence_interval_new_players():
	var manager = rating_manager

	# New players should have high uncertainty
	var confidence = manager.get_confidence_interval(PlayerRatingManager.RatingMode.ONE_V_ONE)
	assert_true(confidence.uncertainty > 100, "New players should have high uncertainty")

## Test confidence interval for established players
func test_confidence_interval_established_players():
	var manager = rating_manager

	# Force player to have 50 matches
	manager._match_count[PlayerRatingManager.RatingMode.ONE_V_ONE] = 50

	var confidence = manager.get_confidence_interval(PlayerRatingManager.RatingMode.ONE_V_ONE)
	assert_true(confidence.uncertainty < 50, "Established players should have lower uncertainty")

## Test minimum rating floor
func test_minimum_rating_floor():
	var manager = rating_manager

	# A loss just above the floor against a much weaker opponent produces a
	# raw result below MINIMUM_RATING (1010 - 39 = 971 at K=40), so the
	# clamp in calculate_elo() must engage. (The old 1100-vs-800 setup lost
	# only ~17-34 points and never reached the floor.)
	var new_rating: int = manager.calculate_elo(1010, 100, false, PlayerRatingManager.RatingMode.ONE_V_ONE)
	assert_eq(new_rating, PlayerRatingManager.MINIMUM_RATING, "Rating should floor at minimum")

## Test maximum rating ceiling
func test_maximum_rating_ceiling():
	var manager = rating_manager

	# A win just below the ceiling against a near-peer produces a raw result
	# above MAXIMUM_RATING (2990 + 14 = 3004 at K=40), so the clamp in
	# calculate_elo() must engage. (The old 2900-vs-1000 setup gained ~0
	# points because the expected score was already ~1.0.)
	var new_rating: int = manager.calculate_elo(2990, 2900, true, PlayerRatingManager.RatingMode.ONE_V_ONE)
	assert_eq(new_rating, PlayerRatingManager.MAXIMUM_RATING, "Rating should ceiling at maximum")

## Test rating history size limit (50 entries)
func test_rating_history_size_limit():
	var manager = rating_manager

	# Add 51 matches to exceed limit
	for i in range(51):
		manager.update_rating(1200, i % 2 == 0, PlayerRatingManager.RatingMode.ONE_V_ONE)

	var history = manager.get_rating_history(PlayerRatingManager.RatingMode.ONE_V_ONE)
	assert_eq(history.size(), 50, "History should be limited to 50 entries")

## Test reset_rating
func test_reset_rating():
	var manager = rating_manager

	manager._current_rating[PlayerRatingManager.RatingMode.ONE_V_ONE] = 1500
	manager._match_count[PlayerRatingManager.RatingMode.ONE_V_ONE] = 25

	manager.reset_rating(PlayerRatingManager.RatingMode.ONE_V_ONE)

	var rating = manager.get_current_rating(PlayerRatingManager.RatingMode.ONE_V_ONE)
	assert_eq(rating, PlayerRatingManager.DEFAULT_RATING, "Rating should reset to default")

	var match_count = manager._match_count.get(PlayerRatingManager.RatingMode.ONE_V_ONE)
	assert_eq(match_count, 0, "Match count should reset")

## Test separate modes (1v1 and 2v2)
func test_separate_modes():
	var manager = rating_manager

	var rating_1v1 = manager.get_current_rating(PlayerRatingManager.RatingMode.ONE_V_ONE)
	var rating_2v2 = manager.get_current_rating(PlayerRatingManager.RatingMode.TWO_V_TWO)

	# Both should start with default rating
	assert_eq(rating_1v1, PlayerRatingManager.DEFAULT_RATING, "1v1 rating should be default")
	assert_eq(rating_2v2, PlayerRatingManager.DEFAULT_RATING, "2v2 rating should be default")

	# Update 1v1 rating
	manager.update_rating(1300, true, PlayerRatingManager.RatingMode.ONE_V_ONE)

	# 2v2 rating should be unchanged
	var rating_2v2_after = manager.get_current_rating(PlayerRatingManager.RatingMode.TWO_V_TWO)
	assert_eq(rating_2v2_after, PlayerRatingManager.DEFAULT_RATING, "2v2 rating should remain default")

	# 1v1 rating should change
	var rating_1v1_after = manager.get_current_rating(PlayerRatingManager.RatingMode.ONE_V_ONE)
	assert_ne(rating_1v1_after, PlayerRatingManager.DEFAULT_RATING, "1v1 rating should change")

## Test expected score calculation
func test_expected_score_calculation():
	var manager = rating_manager

	# Player 1200 vs Opponent 1200 = expected 0.5
	var expected = manager.get_expected_score(1200, 1200)
	assert_almost_eq(expected, 0.5, 0.001, "Expected score should be 0.5 for equal ratings")

	# Player 1200 vs Opponent 1400 = player lower, expected < 0.5
	var expected_lower = manager.get_expected_score(1200, 1400)
	assert_true(expected_lower < 0.5, "Expected score should be lower when player rating is lower")

	# Player 1400 vs Opponent 1200 = player higher, expected > 0.5
	var expected_higher = manager.get_expected_score(1400, 1200)
	assert_true(expected_higher > 0.5, "Expected score should be higher when player rating is higher")
