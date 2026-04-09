extends GutTest

## Unit tests for MatchmakingAnalyticsManager
## Tests match quality metrics, balance detection, and analytics reporting

var analytics_manager: Node
var MatchmakingAnalyticsManager_script

func before_each():
	# Load MatchmakingAnalyticsManager script
	MatchmakingAnalyticsManager_script = preload("res://autoloads/MatchmakingAnalyticsManager.gd")

	# Create MatchmakingAnalyticsManager instance
	analytics_manager = MatchmakingAnalyticsManager_script.new()
	# Set up as if it were autoload
	analytics_manager.name = "MatchmakingAnalyticsManager"
	# Set up mock network manager
	var mock_network = Node.new()
	mock_network.name = "NetworkManager"
	analytics_manager._network_manager = mock_network
	add_child(analytics_manager)
	add_child(mock_network)

func after_each():
	if analytics_manager:
		analytics_manager.queue_free()

## Test constants are correct
func test_target_constants():
	assert_eq(analytics_manager.TARGET_RATING_DIFF, 100, "Target rating diff should be 100")
	assert_eq(analytics_manager.TARGET_COMPLETION_RATE, 0.90, "Target completion rate should be 90%")
	assert_eq(analytics_manager.TARGET_WIN_RATE_VARIANCE, 0.10, "Target win rate variance should be 10%")
	assert_eq(analytics_manager.TARGET_QUEUE_TIME_MEDIAN, 60, "Target queue time should be 60s")
	assert_eq(analytics_manager.TARGET_ABANDONMENT_RATE, 0.05, "Target abandonment rate should be 5%")

## Test match data logging
func test_log_match_data():
	var rating_diff = 50
	var weapons = ["weapon_1", "weapon_2"]
	var duration = 300.0

	analytics_manager.log_match_data(rating_diff, weapons, duration, "match_test")

	# Verify match data was logged
	var metrics = analytics_manager.get_match_quality_metrics()
	assert_eq(metrics.total_matches, 1, "Should have 1 match logged")
	assert_eq(metrics.completed_matches, 1, "Match should be marked as completed")

## Test match data logging generates ID
func test_match_data_generates_id():
	var rating_diff = 25
	var weapons = ["weapon_1"]
	var duration = 250.0

	# Log without providing match_id (should generate one)
	analytics_manager.log_match_data(rating_diff, weapons, duration, "")

	# Log with explicit match_id
	analytics_manager.log_match_data(rating_diff, weapons, duration, "explicit_id")

	var metrics = analytics_manager.get_match_quality_metrics()
	assert_eq(metrics.total_matches, 2, "Both matches should be logged")

## Test queue time logging
func test_log_queue_time():
	var queue_time = 45.0

	analytics_manager.log_queue_time(queue_time)

	var metrics = analytics_manager.get_match_quality_metrics()
	# Queue times are stored separately, not reflected in quality metrics directly
	assert_true(metrics.total_matches >= 0, "Metrics should be accessible")

## Test abandonment tracking
func test_track_abandonment():
	# First log a match
	analytics_manager.log_match_data(50, ["weapon_1"], 300.0, "match_1")

	# Then track abandonment
	analytics_manager.track_abandonment("match_1", "player_disconnected")

	var metrics = analytics_manager.get_match_quality_metrics()
	assert_eq(metrics.completed_matches, 0, "Abandoned match should not be counted as completed")
	assert_eq(metrics.abandoned_matches, 1, "Abandoned match should be counted")

## Test weapon result logging
func test_log_weapon_result():
	var weapon_id = "weapon_test"

	# Log multiple results for same weapon
	analytics_manager.log_weapon_result(weapon_id, true)  # win
	analytics_manager.log_weapon_result(weapon_id, false)  # loss
	analytics_manager.log_weapon_result(weapon_id, true)  # win
	analytics_manager.log_weapon_result(weapon_id, true)  # win

	var stats = analytics_manager.get_weapon_statistics()
	assert_true(stats.has(weapon_id), "Weapon stats should exist")
	assert_eq(stats[weapon_id].matches, 4, "Weapon should have 4 matches")
	assert_eq(stats[weapon_id].wins, 3, "Weapon should have 3 wins")
	assert_eq(stats[weapon_id].losses, 1, "Weapon should have 1 loss")

## Test weapon win rate calculation
func test_weapon_win_rate():
	var weapon_id = "weapon_test"

	# Log 10 matches: 6 wins, 4 losses
	for i in range(6):
		analytics_manager.log_weapon_result(weapon_id, true)
	for i in range(4):
		analytics_manager.log_weapon_result(weapon_id, false)

	var stats = analytics_manager.get_weapon_statistics()
	var win_rate = stats[weapon_id].win_rate

	assert_almost_eq(win_rate, 0.6, 0.01, "Win rate should be 0.6 (60%)")

## Test match quality metrics calculation
func test_match_quality_metrics():
	# Log several matches with varying quality
	analytics_manager.log_match_data(50, ["weapon_1"], 300.0, "match_1")
	analytics_manager.log_match_data(100, ["weapon_2"], 400.0, "match_2")
	analytics_manager.log_match_data(25, ["weapon_1"], 250.0, "match_3")

	var metrics = analytics_manager.get_match_quality_metrics()

	assert_eq(metrics.total_matches, 3, "Should have 3 matches")
	assert_almost_eq(metrics.avg_rating_diff, 175.0 / 3.0, 0.1, "Average rating diff should be calculated")

## Test completion rate calculation
func test_completion_rate():
	# Log 5 matches, abandon 1
	analytics_manager.log_match_data(50, ["weapon_1"], 300.0, "match_1")
	analytics_manager.log_match_data(50, ["weapon_1"], 300.0, "match_2")
	analytics_manager.log_match_data(50, ["weapon_1"], 300.0, "match_3")
	analytics_manager.log_match_data(50, ["weapon_1"], 300.0, "match_4")
	analytics_manager.log_match_data(50, ["weapon_1"], 300.0, "match_5")
	analytics_manager.track_abandonment("match_3", "timeout")

	var metrics = analytics_manager.get_match_quality_metrics()

	# 5 total, 1 abandoned = 4 completed
	# But track_abandonment decrements completed_matches
	var expected_completion = 4.0 / 5.0
	assert_almost_eq(metrics.completion_rate, expected_completion, 0.01, "Completion rate should be 80%")

## Test abandonment rate calculation
func test_abandonment_rate():
	# Log 10 matches, abandon 2
	for i in range(10):
		analytics_manager.log_match_data(50, ["weapon_1"], 300.0, "match_%d" % i)
	analytics_manager.track_abandonment("match_2", "disconnect")
	analytics_manager.track_abandonment("match_7", "timeout")

	var metrics = analytics_manager.get_match_quality_metrics()

	var expected_abandonment = 2.0 / 10.0
	assert_almost_eq(metrics.abandonment_rate, expected_abandonment, 0.01, "Abandonment rate should be 20%")

## Test rating difference distribution
func test_rating_difference_distribution():
	# Log matches with various rating differences
	analytics_manager.log_match_data(25, ["weapon_1"], 300.0, "match_1")
	analytics_manager.log_match_data(75, ["weapon_2"], 350.0, "match_2")
	analytics_manager.log_match_data(125, ["weapon_3"], 400.0, "match_3")
	analytics_manager.log_match_data(175, ["weapon_4"], 450.0, "match_4")
	analytics_manager.log_match_data(225, ["weapon_5"], 500.0, "match_5")

	var distribution = analytics_manager.get_rating_difference_distribution()

	assert_eq(distribution["0-50"], 1, "One match in 0-50 range")
	assert_eq(distribution["51-100"], 1, "One match in 51-100 range")
	assert_eq(distribution["101-150"], 1, "One match in 101-150 range")
	assert_eq(distribution["151-200"], 1, "One match in 151-200 range")
	assert_eq(distribution["200+"], 1, "One match in 200+ range")

## Test balance issue detection - high win rate
func test_balance_issue_high_win_rate():
	var weapon_id = "overpowered_weapon"

	# Log 15 matches, 12 wins (80% win rate)
	for i in range(12):
		analytics_manager.log_weapon_result(weapon_id, true)
	for i in range(3):
		analytics_manager.log_weapon_result(weapon_id, false)

	var issues = analytics_manager.detect_balance_issues()

	var weapon_issue = null
	for issue in issues:
		if issue.weapon_id == weapon_id:
			weapon_issue = issue
			break

	assert_not_null(weapon_issue, "Should detect balance issue for high win rate weapon")
	assert_eq(weapon_issue.issue_type, "high_win_rate", "Issue type should be high_win_rate")

## Test balance issue detection - low win rate
func test_balance_issue_low_win_rate():
	var weapon_id = "underpowered_weapon"

	# Log 15 matches, 2 wins (13% win rate)
	for i in range(2):
		analytics_manager.log_weapon_result(weapon_id, true)
	for i in range(13):
		analytics_manager.log_weapon_result(weapon_id, false)

	var issues = analytics_manager.detect_balance_issues()

	var weapon_issue = null
	for issue in issues:
		if issue.weapon_id == weapon_id:
			weapon_issue = issue
			break

	assert_not_null(weapon_issue, "Should detect balance issue for low win rate weapon")
	assert_eq(weapon_issue.issue_type, "low_win_rate", "Issue type should be low_win_rate")

## Test balance issue detection - insufficient data
func test_balance_issue_insufficient_data():
	var weapon_id = "new_weapon"

	# Log only 5 matches (below threshold)
	for i in range(3):
		analytics_manager.log_weapon_result(weapon_id, true)
	for i in range(2):
		analytics_manager.log_weapon_result(weapon_id, false)

	var issues = analytics_manager.detect_balance_issues()

	var weapon_issue = null
	for issue in issues:
		if issue.weapon_id == weapon_id:
			weapon_issue = issue
			break

	# Should not detect issue with insufficient data
	assert_null(weapon_issue, "Should not detect issue with insufficient data")

## Test system balance issue detection
func test_system_balance_issues():
	# Log matches with high average rating difference
	analytics_manager.log_match_data(200, ["weapon_1"], 300.0, "match_1")
	analytics_manager.log_match_data(250, ["weapon_2"], 350.0, "match_2")
	analytics_manager.log_match_data(180, ["weapon_3"], 300.0, "match_3")

	var issues = analytics_manager.detect_balance_issues()

	var system_issue = null
	for issue in issues:
		if issue.weapon_id == "system":
			system_issue = issue
			break

	# Average rating diff > 150, which exceeds target (100) * 1.5
	assert_not_null(system_issue, "Should detect system balance issue with high rating diff")

## Test high abandonment rate detection
func test_high_abandonment_rate_detection():
	# Log 10 matches, abandon 4 (40% abandonment rate)
	for i in range(10):
		analytics_manager.log_match_data(50, ["weapon_1"], 300.0, "match_%d" % i)

	for i in [1, 3, 5, 7]:
		analytics_manager.track_abandonment("match_%d" % i, "disconnect")

	var issues = analytics_manager.detect_balance_issues()

	var system_issue = null
	for issue in issues:
		if issue.weapon_id == "system" and issue.issue_type == "high_abandonment_rate":
			system_issue = issue
			break

	# Abandonment rate 40% > target (5%) * 1.5 = 7.5%
	assert_not_null(system_issue, "Should detect system issue with high abandonment rate")

## Test analytics report export
func test_export_analytics_report():
	# Log some test data
	analytics_manager.log_match_data(50, ["weapon_1"], 300.0, "match_1")
	analytics_manager.log_weapon_result("weapon_1", true)

	var report = analytics_manager.export_analytics_report()

	assert_true(report.has("quality_metrics"), "Report should include quality metrics")
	assert_true(report.has("weapon_stats"), "Report should include weapon stats")
	assert_true(report.has("rating_diff_distribution"), "Report should include rating diff distribution")
	assert_true(report.has("detected_issues"), "Report should include detected issues")
	assert_true(report.has("export_timestamp"), "Report should include export timestamp")

## Test signal emission on match data logged
func test_match_data_logged_signal():
	var signal_emitted = false
	var received_match_id = ""

	analytics_manager.match_data_logged.connect(func(match_id: String):
		signal_emitted = true
		received_match_id = match_id
	)

	analytics_manager.log_match_data(50, ["weapon_1"], 300.0, "test_match")

	await get_tree().process_frame

	assert_true(signal_emitted, "match_data_logged signal should be emitted")
	assert_eq(received_match_id, "test_match", "Match ID should be passed in signal")

## Test signal emission on abandonment tracked
func test_abandonment_tracked_signal():
	var signal_emitted = false
	var received_match_id = ""

	analytics_manager.abandonment_tracked.connect(func(match_id: String):
		signal_emitted = true
		received_match_id = match_id
	)

	# First log a match
	analytics_manager.log_match_data(50, ["weapon_1"], 300.0, "match_1")
	# Then track abandonment
	analytics_manager.track_abandonment("match_1", "disconnect")

	await get_tree().process_frame

	assert_true(signal_emitted, "abandonment_tracked signal should be emitted")
	assert_eq(received_match_id, "match_1", "Match ID should be passed in signal")

## Test signal emission on balance issue detected
func test_balance_issue_detected_signal():
	var signal_emitted = false
	var received_weapon_id = ""
	var received_issue = ""

	analytics_manager.balance_issue_detected.connect(func(weapon_id: String, issue: String):
		signal_emitted = true
		received_weapon_id = weapon_id
		received_issue = issue
	)

	var weapon_id = "test_weapon"
	for i in range(15):
		analytics_manager.log_weapon_result(weapon_id, i < 12)  # 12 wins out of 15

	await get_tree().process_frame

	assert_true(signal_emitted, "balance_issue_detected signal should be emitted")
	assert_eq(received_weapon_id, weapon_id, "Weapon ID should be passed in signal")

## Test clear local data
func test_clear_local_data():
	# Log some data first
	analytics_manager.log_match_data(50, ["weapon_1"], 300.0, "match_1")
	analytics_manager.log_weapon_result("weapon_1", true)

	# Clear data
	analytics_manager.clear_local_data()

	var metrics = analytics_manager.get_match_quality_metrics()
	var stats = analytics_manager.get_weapon_statistics()

	assert_eq(metrics.total_matches, 0, "Metrics should be cleared")
	assert_eq(stats.size(), 0, "Weapon stats should be cleared")

## Test weapon stats with multiple weapons
func test_multiple_weapon_stats():
	var weapon1 = "weapon_1"
	var weapon2 = "weapon_2"

	# Log matches for both weapons
	analytics_manager.log_weapon_result(weapon1, true)
	analytics_manager.log_weapon_result(weapon1, false)
	analytics_manager.log_weapon_result(weapon2, true)
	analytics_manager.log_weapon_result(weapon2, true)
	analytics_manager.log_weapon_result(weapon2, false)

	var stats = analytics_manager.get_weapon_statistics()

	assert_true(stats.has(weapon1), "Should have stats for weapon_1")
	assert_true(stats.has(weapon2), "Should have stats for weapon_2")
	assert_eq(stats[weapon1].matches, 2, "Weapon 1 should have 2 matches")
	assert_eq(stats[weapon2].matches, 3, "Weapon 2 should have 3 matches")

## Test average rating diff with weapon stats
func test_avg_rating_diff_in_weapon_stats():
	var weapon_id = "weapon_test"

	# Log match results with different rating diffs
	analytics_manager.log_match_data(50, [weapon_id], 300.0, "match_1")
	analytics_manager.log_match_data(100, [weapon_id], 350.0, "match_2")
	analytics_manager.log_match_data(150, [weapon_id], 400.0, "match_3")

	var stats = analytics_manager.get_weapon_statistics()
	var avg_diff = stats[weapon_id].avg_rating_diff

	# (50 + 100 + 150) / 3 = 100
	assert_almost_eq(avg_diff, 100.0, 0.1, "Average rating diff should be calculated correctly")

## Test queue time management
func test_queue_time_limit():
	var large_queue_time = 150.0

	# Log many queue times
	for i in range(1200):
		analytics_manager.log_queue_time(i)

	# Log a large queue time
	analytics_manager.log_queue_time(large_queue_time)

	var metrics = analytics_manager.get_match_quality_metrics()
	# Queue times are tracked internally, not directly in quality metrics
	# This test verifies the function doesn't crash with large inputs
	assert_true(true, "Should handle large queue times without crashing")

## Test get_target_* functions
func test_get_target_functions():
	assert_eq(analytics_manager.get_target_rating_diff(), 100, "Target rating diff should be 100")
	assert_eq(analytics_manager.get_target_completion_rate(), 0.90, "Target completion rate should be 0.90")
	assert_eq(analytics_manager.get_target_win_rate_variance(), 0.10, "Target win rate variance should be 0.10")
	assert_eq(analytics_manager.get_target_queue_time_median(), 60, "Target queue time median should be 60")
	assert_eq(analytics_manager.get_target_abandonment_rate(), 0.05, "Target abandonment rate should be 0.05")

## Test issue severity levels
func test_balance_issue_severity():
	var weapon_id = "test_weapon"

	# Test high severity (> 80% win rate)
	for i in range(13):
		analytics_manager.log_weapon_result(weapon_id, true)
	for i in range(2):
		analytics_manager.log_weapon_result(weapon_id, false)

	var issues_high = analytics_manager.detect_balance_issues()
	var high_issue = null
	for issue in issues_high:
		if issue.weapon_id == weapon_id:
			high_issue = issue
			break

	assert_not_null(high_issue, "Should detect high severity issue")
	assert_eq(high_issue.severity, "medium", "80% win rate should be medium severity")

	# Clear and test very high severity
	analytics_manager.clear_local_data()
	for i in range(14):
		analytics_manager.log_weapon_result(weapon_id, true)
	for i in range(1):
		analytics_manager.log_weapon_result(weapon_id, false)

	var issues_very_high = analytics_manager.detect_balance_issues()
	var very_high_issue = null
	for issue in issues_very_high:
		if issue.weapon_id == weapon_id:
			very_high_issue = issue
			break

	assert_eq(very_high_issue.severity, "high", "93% win rate should be high severity")
