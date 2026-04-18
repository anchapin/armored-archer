extends GutTest

## Unit tests for SeasonMessenger and seasonal messaging features
## Tests messaging logic, tier milestones, reward previews, and motivational messages

var season_messenger: Node
var season_manager: Node

func before_each():
	season_messenger = preload("res://autoloads/SeasonMessenger.gd").new()
	season_messenger.name = "SeasonMessenger"
	add_child(season_messenger)

	season_manager = preload("res://autoloads/SeasonManager.gd").new()
	season_manager.name = "SeasonManager"
	var mock_network = Node.new()
	mock_network.name = "NetworkManager"
	mock_network.user_id = "test_user_123"
	season_manager.network_manager = mock_network
	add_child(season_manager)
	add_child(mock_network)

	# Wire messenger to manager
	season_messenger.season_manager = season_manager

func after_each():
	if season_messenger:
		season_messenger.queue_free()
	if season_manager:
		season_manager.queue_free()

# --- Motivational Messages ---

func test_motivational_message_unranked():
	var msg = season_messenger.get_motivational_message(0)
	assert_eq(msg, "Play PvP matches to earn your rank!", "Unranked should have starter message")

func test_motivational_message_top_10():
	var msg = season_messenger.get_motivational_message(5)
	assert_has(msg, "Top 10", "Top 10 message should mention position")

func test_motivational_message_epic_range():
	var msg = season_messenger.get_motivational_message(25)
	assert_has(msg, "Legendary", "Rank 25 should push toward Legendary")

func test_motivational_message_rare_range():
	var msg = season_messenger.get_motivational_message(75)
	assert_has(msg, "Epic", "Rank 75 should push toward Epic")

func test_motivational_message_uncommon_range():
	var msg = season_messenger.get_motivational_message(200)
	assert_has(msg, "Rare", "Rank 200 should push toward Rare")

func test_motivational_message_common_range():
	var msg = season_messenger.get_motivational_message(600)
	assert_has(msg, "climb", "Rank 600 should encourage climbing")

# --- Next Tier Info ---

func test_next_tier_info_unranked():
	var info = season_messenger.get_next_tier_info(0)
	assert_eq(info.tier, "Common", "Unranked next tier should be Common")
	assert_has(info.message, "Start playing", "Unranked should suggest starting")

func test_next_tier_info_legendary():
	var info = season_messenger.get_next_tier_info(5)
	assert_has(info.tier, "Legendary (max)", "Legendary should show max tier")
	assert_has(info.message, "top", "Legendary message should reference top position")

func test_next_tier_info_epic():
	var info = season_messenger.get_next_tier_info(25)
	assert_eq(info.tier, "Legendary", "Epic should push to Legendary")
	assert_eq(info.threshold, 10, "Legendary threshold should be 10")

func test_next_tier_info_rare():
	var info = season_messenger.get_next_tier_info(75)
	assert_eq(info.tier, "Epic", "Rare should push to Epic")
	assert_eq(info.threshold, 50, "Epic threshold should be 50")

func test_next_tier_info_uncommon():
	var info = season_messenger.get_next_tier_info(200)
	assert_eq(info.tier, "Rare", "Uncommon should push to Rare")
	assert_eq(info.threshold, 100, "Rare threshold should be 100")

func test_next_tier_info_common():
	var info = season_messenger.get_next_tier_info(600)
	assert_eq(info.tier, "Uncommon", "Common should push to Uncommon")
	assert_eq(info.threshold, 500, "Uncommon threshold should be 500")

# --- Projected Rewards ---

func test_projected_rewards_legendary():
	var rewards = season_messenger.get_projected_rewards(5)
	assert_eq(rewards.tier, "Legendary", "Rank 5 should be Legendary")
	assert_eq(rewards.coins, 10000, "Legendary should give 10000 coins")
	assert_eq(rewards.gems, 500, "Legendary should give 500 gems")
	assert_true(rewards.cosmetics.has("title"), "Legendary should have title cosmetic")
	assert_true(rewards.cosmetics.has("aura"), "Legendary should have aura cosmetic")

func test_projected_rewards_epic():
	var rewards = season_messenger.get_projected_rewards(30)
	assert_eq(rewards.tier, "Epic", "Rank 30 should be Epic")
	assert_eq(rewards.coins, 5000, "Epic should give 5000 coins")
	assert_eq(rewards.gems, 250, "Epic should give 250 gems")
	assert_true(rewards.cosmetics.has("title"), "Epic should have title cosmetic")

func test_projected_rewards_rare():
	var rewards = season_messenger.get_projected_rewards(75)
	assert_eq(rewards.tier, "Rare", "Rank 75 should be Rare")
	assert_eq(rewards.coins, 2500, "Rare should give 2500 coins")
	assert_eq(rewards.gems, 100, "Rare should give 100 gems")

func test_projected_rewards_uncommon():
	var rewards = season_messenger.get_projected_rewards(200)
	assert_eq(rewards.tier, "Uncommon", "Rank 200 should be Uncommon")
	assert_eq(rewards.coins, 1000, "Uncommon should give 1000 coins")
	assert_eq(rewards.gems, 50, "Uncommon should give 50 gems")

func test_projected_rewards_common():
	var rewards = season_messenger.get_projected_rewards(600)
	assert_eq(rewards.tier, "Common", "Rank 600 should be Common")
	assert_eq(rewards.coins, 500, "Common should give 500 coins")
	assert_eq(rewards.gems, 25, "Common should give 25 gems")

func test_rewards_increase_with_tier():
	var common_rewards = season_messenger.get_projected_rewards(600)
	var uncommon_rewards = season_messenger.get_projected_rewards(200)
	var rare_rewards = season_messenger.get_projected_rewards(75)
	var epic_rewards = season_messenger.get_projected_rewards(30)
	var legendary_rewards = season_messenger.get_projected_rewards(5)

	assert_true(legendary_rewards.coins > epic_rewards.coins, "Legendary coins > Epic coins")
	assert_true(epic_rewards.coins > rare_rewards.coins, "Epic coins > Rare coins")
	assert_true(rare_rewards.coins > uncommon_rewards.coins, "Rare coins > Uncommon coins")
	assert_true(uncommon_rewards.coins > common_rewards.coins, "Uncommon coins > Common coins")

# --- Season End Warning Thresholds ---

func test_warning_thresholds_defined():
	assert_has(season_messenger.WARNING_THRESHOLDS, "Should define warning thresholds")
	assert_eq(season_messenger.WARNING_THRESHOLDS.size(), 4, "Should have 4 warning levels")
	assert_has(season_messenger.WARNING_THRESHOLDS, 168, "Should warn at 168 hours (7d)")
	assert_has(season_messenger.WARNING_THRESHOLDS, 72, "Should warn at 72 hours (3d)")
	assert_has(season_messenger.WARNING_THRESHOLDS, 24, "Should warn at 24 hours (1d)")
	assert_has(season_messenger.WARNING_THRESHOLDS, 1, "Should warn at 1 hour")

func test_warning_messages_defined():
	assert_has(season_messenger.WARNING_MESSAGES, 168, "Should have 7-day message")
	assert_has(season_messenger.WARNING_MESSAGES, 72, "Should have 3-day message")
	assert_has(season_messenger.WARNING_MESSAGES, 24, "Should have 1-day message")
	assert_has(season_messenger.WARNING_MESSAGES, 1, "Should have 1-hour message")

	for key in season_messenger.WARNING_MESSAGES:
		assert_gt(season_messenger.WARNING_MESSAGES[key].length(), 0, "Warning message should not be empty")

# --- Tier Milestone Messages ---

func test_tier_messages_defined():
	assert_has(season_messenger.TIER_MESSAGES, "Legendary", "Should have Legendary message")
	assert_has(season_messenger.TIER_MESSAGES, "Epic", "Should have Epic message")
	assert_has(season_messenger.TIER_MESSAGES, "Rare", "Should have Rare message")
	assert_has(season_messenger.TIER_MESSAGES, "Uncommon", "Should have Uncommon message")
	assert_has(season_messenger.TIER_MESSAGES, "Common", "Should have Common message")

# --- Signal Emission ---

func test_season_message_signal():
	var message_received: Dictionary = {}
	season_messenger.season_message.connect(func(msg): message_received = msg)

	# Simulate season transition
	season_messenger._on_season_transitioned({}, {})

	assert_has(message_received, "type", "Message should have type field")
	assert_has(message_received, "text", "Message should have text field")
	assert_has(message_received, "priority", "Message should have priority field")
	assert_eq(message_received.type, "season_start", "Transition should emit season_start type")

func test_tier_milestone_signal():
	var milestone_received: Dictionary = {}
	season_messenger.tier_milestone_reached.connect(func(tier, rank): milestone_received = {"tier": tier, "rank": rank})

	# Simulate tier change via season info
	season_messenger._last_known_tier = "Common"
	season_manager.time_remaining = 7 * 24 * 60 * 60 * 1000  # 7 days remaining
	season_messenger._on_season_info_loaded({
		"player_rank": 30,
		"player_score": 1500,
	})

	assert_eq(milestone_received.get("tier", ""), "Epic", "Should emit Epic milestone")
	assert_eq(milestone_received.get("rank", 0), 30, "Should emit correct rank")

func test_no_milestone_for_same_tier():
	var milestone_received: Dictionary = {}
	season_messenger.tier_milestone_reached.connect(func(tier, rank): milestone_received = {"tier": tier, "rank": rank})

	# Same tier should not emit
	season_messenger._last_known_tier = "Common"
	season_manager.time_remaining = 7 * 24 * 60 * 60 * 1000
	season_messenger._on_season_info_loaded({
		"player_rank": 600,  # Still Common
		"player_score": 1100,
	})

	assert_eq(milestone_received.size(), 0, "Same tier should not emit milestone")

# --- Decay Warning Message ---

func test_decay_warning_emitted():
	var message_received: Dictionary = {}
	season_messenger.season_message.connect(func(msg): message_received = msg)

	season_messenger._on_decay_info_updated({
		"can_decay": true,
		"points_at_risk": 50,
	})

	assert_eq(message_received.get("type", ""), "decay_warning", "Should emit decay warning")
	assert_has(message_received.get("text", ""), "50", "Should mention points at risk")

func test_no_decay_warning_when_active():
	var message_received: Dictionary = {}
	season_messenger.season_message.connect(func(msg): message_received = msg)

	season_messenger._on_decay_info_updated({
		"can_decay": false,
		"points_at_risk": 0,
	})

	assert_eq(message_received.size(), 0, "Active player should not get decay warning")

# --- Message Queue ---

func test_message_queue():
	season_messenger.clear_messages()
	assert_eq(season_messenger.get_pending_messages().size(), 0, "Queue should be empty after clear")

	# Emit a message
	season_messenger._emit_message("test", "test message", "info")
	var pending = season_messenger.get_pending_messages()
	assert_eq(pending.size(), 1, "Queue should have 1 message")
	assert_eq(pending[0].type, "test", "Message type should match")
	assert_eq(pending[0].text, "test message", "Message text should match")
	assert_eq(pending[0].priority, "info", "Message priority should match")

# --- Format Hours Helper ---

func test_format_hours_days():
	var result = season_messenger._format_hours(200.0)
	assert_has(result, "d", "Should format as days")

func test_format_hours_hours():
	var result = season_messenger._format_hours(5.0)
	assert_has(result, "h", "Should format as hours")
	assert_false("d" in result, "Should not contain days")

func test_format_hours_minutes():
	var result = season_messenger._format_hours(0.5)
	assert_has(result, "m", "Should format as minutes")
