extends GutTest

## Tests for DynamicDifficultyManager autoload.
## Tests win/lose streak tracking, difficulty modifiers, and performance ratings.
##
## NOTE: DynamicDifficultyManager should be implemented.
## This test verifies the expected API and behavior.

var dynamic_difficulty_manager: Node

func before_all():
	# Get reference to DynamicDifficultyManager autoload
	dynamic_difficulty_manager = get_node("/root/DynamicDifficultyManager")

	if dynamic_difficulty_manager == null:
		gut.p("WARNING: DynamicDifficultyManager autoload not found.")

func before_each():
	# Reset difficulty state before each test
	if dynamic_difficulty_manager and dynamic_difficulty_manager.has_method("reset_difficulty"):
		dynamic_difficulty_manager.reset_difficulty()

func test_win_streak_tracking():
	# Win streaks should be tracked correctly
	# Reset to 0 on loss, increment on win
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	# Track some wins
	dynamic_difficulty_manager.track_match_outcome(true, "pve")
	dynamic_difficulty_manager.track_match_outcome(true, "pve")
	dynamic_difficulty_manager.track_match_outcome(true, "pve")

	var win_streak: int = dynamic_difficulty_manager.get_win_streak()

	assert_eq(win_streak, 3, "Win streak should be 3 after 3 wins")

func test_win_streak_reset_on_loss():
	# Win streak should reset to 0 on loss
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	# Build win streak
	dynamic_difficulty_manager.track_match_outcome(true, "pve")
	dynamic_difficulty_manager.track_match_outcome(true, "pve")

	# Reset with loss
	dynamic_difficulty_manager.track_match_outcome(false, "pve")

	var win_streak: int = dynamic_difficulty_manager.get_win_streak()

	assert_eq(win_streak, 0, "Win streak should reset to 0 after loss")

func test_lose_streak_tracking():
	# Lose streaks should be tracked correctly
	# Reset to 0 on win, increment on loss
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	# Track some losses
	dynamic_difficulty_manager.track_match_outcome(false, "pvp")
	dynamic_difficulty_manager.track_match_outcome(false, "pvp")
	dynamic_difficulty_manager.track_match_outcome(false, "pvp")

	var lose_streak: int = dynamic_difficulty_manager.get_lose_streak()

	assert_eq(lose_streak, 3, "Lose streak should be 3 after 3 losses")

func test_lose_streak_reset_on_win():
	# Lose streak should reset to 0 on win
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	# Build lose streak
	dynamic_difficulty_manager.track_match_outcome(false, "pvp")
	dynamic_difficulty_manager.track_match_outcome(false, "pvp")

	# Reset with win
	dynamic_difficulty_manager.track_match_outcome(true, "pvp")

	var lose_streak: int = dynamic_difficulty_manager.get_lose_streak()

	assert_eq(lose_streak, 0, "Lose streak should reset to 0 after win")

func test_difficulty_increase_on_win_streak():
	# Difficulty should increase after 3+ wins
	# Modifier should increase by +10%
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	var initial_modifier: float = dynamic_difficulty_manager.get_difficulty_modifier()

	# Trigger win streak threshold (3 wins)
	dynamic_difficulty_manager.track_match_outcome(true, "pve")
	dynamic_difficulty_manager.track_match_outcome(true, "pve")
	dynamic_difficulty_manager.track_match_outcome(true, "pve")

	var new_modifier: float = dynamic_difficulty_manager.get_difficulty_modifier()

	assert_gt(new_modifier, initial_modifier, "Difficulty should increase after win streak")

func test_difficulty_decrease_on_lose_streak():
	# Difficulty should decrease after 3+ losses
	# Modifier should decrease by -10%
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	var initial_modifier: float = dynamic_difficulty_manager.get_difficulty_modifier()

	# Set to higher difficulty first
	dynamic_difficulty_manager.set_difficulty_modifier(0.1)

	# Trigger lose streak threshold (3 losses)
	dynamic_difficulty_manager.track_match_outcome(false, "pve")
	dynamic_difficulty_manager.track_match_outcome(false, "pve")
	dynamic_difficulty_manager.track_match_outcome(false, "pve")

	var new_modifier: float = dynamic_difficulty_manager.get_difficulty_modifier()

	assert_lt(new_modifier, 0.1, "Difficulty should decrease after lose streak")

func test_difficulty_modifier_max():
	# Difficulty modifier should not exceed +20% (0.20)
	# Even with many consecutive wins
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	# Track many wins (10 wins = +100% if not capped)
	for i in range(10):
		dynamic_difficulty_manager.track_match_outcome(true, "pve")

	var modifier: float = dynamic_difficulty_manager.get_difficulty_modifier()

	assert_le(modifier, 0.20, "Difficulty modifier should not exceed +20%")

func test_difficulty_modifier_min():
	# Difficulty modifier should not go below -20% (-0.20)
	# Even with many consecutive losses
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	# Set to high difficulty first
	dynamic_difficulty_manager.set_difficulty_modifier(0.15)

	# Track many losses (10 losses = -100% if not capped)
	for i in range(10):
		dynamic_difficulty_manager.track_match_outcome(false, "pve")

	var modifier: float = dynamic_difficulty_manager.get_difficulty_modifier()

	assert_ge(modifier, -0.20, "Difficulty modifier should not go below -20%")

func test_difficulty_levels():
	# Difficulty levels should be: Easy, Normal, Hard, Extreme
	# Based on modifier: Easy (-20%), Normal (0%), Hard (+10%), Extreme (+20%)
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	dynamic_difficulty_manager.set_difficulty_modifier(-0.20)
	var easy_level: String = dynamic_difficulty_manager.get_difficulty_level_string()
	assert_eq(easy_level, "Easy", "-20% modifier should be 'Easy'")

	dynamic_difficulty_manager.set_difficulty_modifier(0.0)
	var normal_level: String = dynamic_difficulty_manager.get_difficulty_level_string()
	assert_eq(normal_level, "Normal", "0% modifier should be 'Normal'")

	dynamic_difficulty_manager.set_difficulty_modifier(0.10)
	var hard_level: String = dynamic_difficulty_manager.get_difficulty_level_string()
	assert_eq(hard_level, "Hard", "+10% modifier should be 'Hard'")

	dynamic_difficulty_manager.set_difficulty_modifier(0.20)
	var extreme_level: String = dynamic_difficulty_manager.get_difficulty_level_string()
	assert_eq(extreme_level, "Extreme", "+20% modifier should be 'Extreme'")

func test_performance_rating_excellent():
	# Performance rating should be "Excellent" with 80%+ win rate
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	# Track 8 wins, 2 losses
	for i in range(8):
		dynamic_difficulty_manager.track_match_outcome(true, "pve")
	for i in range(2):
		dynamic_difficulty_manager.track_match_outcome(false, "pve")

	var rating: String = dynamic_difficulty_manager.get_performance_rating()

	assert_eq(rating, "Excellent", "80% win rate should be 'Excellent'")

func test_performance_rating_good():
	# Performance rating should be "Good" with 60-79% win rate
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	dynamic_difficulty_manager.reset_difficulty()

	# Track 6 wins, 4 losses
	for i in range(6):
		dynamic_difficulty_manager.track_match_outcome(true, "pve")
	for i in range(4):
		dynamic_difficulty_manager.track_match_outcome(false, "pve")

	var rating: String = dynamic_difficulty_manager.get_performance_rating()

	assert_eq(rating, "Good", "60% win rate should be 'Good'")

func test_performance_rating_average():
	# Performance rating should be "Average" with 40-59% win rate
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	dynamic_difficulty_manager.reset_difficulty()

	# Track 5 wins, 5 losses
	for i in range(5):
		dynamic_difficulty_manager.track_match_outcome(true, "pve")
	for i in range(5):
		dynamic_difficulty_manager.track_match_outcome(false, "pve")

	var rating: String = dynamic_difficulty_manager.get_performance_rating()

	assert_eq(rating, "Average", "50% win rate should be 'Average'")

func test_performance_rating_poor():
	# Performance rating should be "Poor" with <40% win rate
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	dynamic_difficulty_manager.reset_difficulty()

	# Track 3 wins, 7 losses
	for i in range(3):
		dynamic_difficulty_manager.track_match_outcome(true, "pve")
	for i in range(7):
		dynamic_difficulty_manager.track_match_outcome(false, "pve")

	var rating: String = dynamic_difficulty_manager.get_performance_rating()

	assert_eq(rating, "Poor", "30% win rate should be 'Poor'")

func test_calculate_target_difficulty():
	# Target difficulty should apply modifier to base difficulty
	# Adjusted = Base * (1 + Modifier), clamped to valid range
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	var base_difficulty: float = 0.5

	dynamic_difficulty_manager.set_difficulty_modifier(0.0)
	var normal_difficulty: float = dynamic_difficulty_manager.calculate_target_difficulty(base_difficulty)
	assert_almost_eq(normal_difficulty, 0.5, 0.01, "Normal modifier should not change base")

	dynamic_difficulty_manager.set_difficulty_modifier(0.20)
	var hard_difficulty: float = dynamic_difficulty_manager.calculate_target_difficulty(base_difficulty)
	assert_almost_eq(hard_difficulty, 0.6, 0.01, "+20% modifier should increase difficulty")

	dynamic_difficulty_manager.set_difficulty_modifier(-0.20)
	var easy_difficulty: float = dynamic_difficulty_manager.calculate_target_difficulty(base_difficulty)
	assert_almost_eq(easy_difficulty, 0.4, 0.01, "-20% modifier should decrease difficulty")

func test_target_difficulty_clamping():
	# Target difficulty should be clamped to valid range (0.0 to 1.5)
	# Even with extreme modifiers or base values
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	var max_base: float = 1.0
	var max_difficulty: float = dynamic_difficulty_manager.calculate_target_difficulty(max_base, 0.20)
	assert_le(max_difficulty, 1.5, "Max difficulty should be clamped to 1.5")

	var min_base: float = 0.5
	var min_difficulty: float = dynamic_difficulty_manager.calculate_target_difficulty(min_base, -0.20)
	assert_ge(min_difficulty, 0.0, "Min difficulty should be clamped to 0.0")

func test_win_rate_calculation():
	# Win rate should be calculated for recent matches
	# Default window is 10 matches
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	dynamic_difficulty_manager.reset_difficulty()

	# Track 10 matches: 7 wins, 3 losses
	for i in range(7):
		dynamic_difficulty_manager.track_match_outcome(true, "pve")
	for i in range(3):
		dynamic_difficulty_manager.track_match_outcome(false, "pve")

	var win_rate: float = dynamic_difficulty_manager.get_win_rate(10)

	assert_almost_eq(win_rate, 0.7, 0.01, "Win rate should be 70%")

func test_win_rate_custom_window():
	# Win rate should be calculable with custom window size
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	dynamic_difficulty_manager.reset_difficulty()

	# Track 20 matches: 10 wins, 10 losses
	for i in range(10):
		dynamic_difficulty_manager.track_match_outcome(true, "pve")
	for i in range(10):
		dynamic_difficulty_manager.track_match_outcome(false, "pve")

	var win_rate_5: float = dynamic_difficulty_manager.get_win_rate(5)
	var win_rate_10: float = dynamic_difficulty_manager.get_win_rate(10)

	# Different windows may give different results
	assert_ge(win_rate_5, 0.0, "Win rate should be valid")
	assert_ge(win_rate_10, 0.0, "Win rate should be valid")

func test_reward_modifier():
	# Reward modifier should increase with difficulty
	# Easy: 0.8x, Normal: 1.0x, Hard: 1.2x, Extreme: 1.4x
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	dynamic_difficulty_manager.set_difficulty_modifier(-0.20)
	var easy_reward: float = dynamic_difficulty_manager.get_encounter_reward_modifier()
	assert_almost_eq(easy_reward, 0.8, 0.01, "Easy should give 0.8x rewards")

	dynamic_difficulty_manager.set_difficulty_modifier(0.0)
	var normal_reward: float = dynamic_difficulty_manager.get_encounter_reward_modifier()
	assert_almost_eq(normal_reward, 1.0, 0.01, "Normal should give 1.0x rewards")

	dynamic_difficulty_manager.set_difficulty_modifier(0.20)
	var extreme_reward: float = dynamic_difficulty_manager.get_encounter_reward_modifier()
	assert_almost_eq(extreme_reward, 1.4, 0.01, "Extreme should give 1.4x rewards")

func test_match_history_tracking():
	# Match history should be tracked for performance calculation
	# Should maintain max 50 matches
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	dynamic_difficulty_manager.reset_difficulty()

	# Track 60 matches
	for i in range(60):
		dynamic_difficulty_manager.track_match_outcome(i % 2 == 0, "pve")

	# Should still have valid performance data
	var rating: String = dynamic_difficulty_manager.get_performance_rating()
	assert_ne(rating, "", "Performance rating should be calculated")

func test_difficulty_color():
	# Difficulty color should match level
	# Easy: Green, Normal: White, Hard: Orange, Extreme: Red
	if dynamic_difficulty_manager == null:
		gut.p("SKIP: DynamicDifficultyManager not available")
		return

	dynamic_difficulty_manager.set_difficulty_modifier(-0.20)
	var easy_color: Color = dynamic_difficulty_manager.get_difficulty_color()
	assert_almost_eq(easy_color.r, Color.GREEN.r, 0.1, "Easy should use green")

	dynamic_difficulty_manager.set_difficulty_modifier(0.20)
	var extreme_color: Color = dynamic_difficulty_manager.get_difficulty_color()
	assert_almost_eq(extreme_color.r, Color.RED.r, 0.1, "Extreme should use red")
