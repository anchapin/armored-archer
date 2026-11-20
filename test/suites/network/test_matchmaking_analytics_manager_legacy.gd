# Discover the legacy MatchmakingAnalyticsManager expectations in GUT without
# copying test bodies; the manager is implemented in autoloads/. The name
# carries the _legacy suffix so it does not collide with the independent
# telemetry suite in test/suites/autoloads/ (issue #1827).
extends "res://test/test_matchmaking_analytics_manager.gd"
