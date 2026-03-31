extends GutTest

var MatchmakingManagerClass = load("res://autoloads/MatchmakingManager.gd")

func before_each():
	super.before_each()
	var mm = MatchmakingManagerClass.new()
	add_child_autofree(mm)

func test_matchmaking_manager_initializes():
	var mm = MatchmakingManagerClass.new()
	add_child_autofree(mm)
	assert_true(mm != null, "MatchmakingManager should instantiate")
	assert_true(mm.has_method("create_match"), "Should have create_match method")
	assert_true(mm.has_method("list_matches"), "Should have list_matches method")
	assert_true(mm.has_method("join_match"), "Should have join_match method")

func test_signals_exist():
	var mm = MatchmakingManagerClass.new()
	add_child_autofree(mm)
	assert_true(mm.has_signal("match_created"), "Should have match_created signal")
	assert_true(mm.has_signal("matches_updated"), "Should have matches_updated signal")
	assert_true(mm.has_signal("match_joined"), "Should have match_joined signal")

func test_initial_state():
	var mm = MatchmakingManagerClass.new()
	add_child_autofree(mm)
	assert_true(mm.available_matches.is_empty(), "Should start with empty matches")
	assert_true(mm.current_match.is_empty(), "Should start with no current match")
	assert_false(mm.is_matchmaking_active, "Should not be matchmaking initially")
	assert_false(mm.is_in_match(), "Should not be in a match initially")

func test_get_current_match():
	var mm = MatchmakingManagerClass.new()
	add_child_autofree(mm)
	var match_data = mm.get_current_match()
	assert_true(match_data.is_empty(), "Should return empty dict when no match")

func test_get_match_info_empty():
	var mm = MatchmakingManagerClass.new()
	add_child_autofree(mm)
	var match_info = mm.get_match_info("test_id")
	assert_true(match_info.is_empty(), "Should return empty for unknown match")

func test_get_available_match_count():
	var mm = MatchmakingManagerClass.new()
	add_child_autofree(mm)
	var count = mm.get_available_match_count()
	assert_eq(count, 0, "Should return 0 when no matches")

func test_get_matches_by_type():
	var mm = MatchmakingManagerClass.new()
	add_child_autofree(mm)
	var matches = mm.get_matches_by_type("1v1")
	assert_true(matches.is_empty(), "Should return empty array when no matches")

func test_get_matches_by_rating():
	var mm = MatchmakingManagerClass.new()
	add_child_autofree(mm)
	var matches = mm.get_matches_by_rating(1000)
	assert_true(matches.is_empty(), "Should return empty array when no matches")
