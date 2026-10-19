extends GutTest

## ADR-0009 (issue #1714, option b): the read-through cache is the single
## store for the latest server-known combat snapshot; both write paths
## (CombatSyncManager polling, CombatManager RPC echo) feed it.

var CombatManagerClass = load("res://autoloads/CombatManager.gd")
var CombatSyncManagerClass = load("res://autoloads/CombatSyncManager.gd")

func before_each():
	CombatStateCache.reset()

func test_defaults_after_reset():
	assert_eq(CombatStateCache.my_health, 0, "my_health resets to 0")
	assert_eq(CombatStateCache.opponent_health, 0, "opponent_health resets to 0")
	assert_false(CombatStateCache.is_my_turn, "is_my_turn resets to false")
	assert_eq(CombatStateCache.match_status, "", "match_status resets to empty")
	assert_eq(CombatStateCache.source, "", "source resets to empty")

func test_update_snapshot_stores_values():
	CombatStateCache.update_snapshot(80, 90, true, "active", "poll")
	assert_eq(CombatStateCache.my_health, 80)
	assert_eq(CombatStateCache.opponent_health, 90)
	assert_true(CombatStateCache.is_my_turn)
	assert_eq(CombatStateCache.match_status, "active")
	assert_eq(CombatStateCache.source, "poll")
	assert_gt(CombatStateCache.received_at_msec, 0, "receive time recorded")

func test_update_snapshot_clamps_negative_health():
	CombatStateCache.update_snapshot(-5, -10, false, "active", "rpc")
	assert_eq(CombatStateCache.my_health, 0, "negative health clamps to 0")
	assert_eq(CombatStateCache.opponent_health, 0, "negative health clamps to 0")

func test_last_write_wins_across_paths():
	CombatStateCache.update_snapshot(100, 100, true, "active", "poll")
	CombatStateCache.update_snapshot(75, 60, false, "active", "rpc")
	assert_eq(CombatStateCache.my_health, 75, "later write wins")
	assert_eq(CombatStateCache.opponent_health, 60)
	assert_false(CombatStateCache.is_my_turn)
	assert_eq(CombatStateCache.source, "rpc")

func test_combat_manager_getters_read_cache():
	var cm = CombatManagerClass.new()
	add_child_autofree(cm)
	CombatStateCache.update_snapshot(55, 65, true, "active", "poll")
	assert_eq(cm.get_my_health(), 55, "CombatManager reads shared my_health")
	assert_eq(cm.get_opponent_health(), 65, "CombatManager reads shared opponent_health")
	assert_true(cm.is_my_turn_sync(), "CombatManager reads shared turn")

func test_combat_sync_manager_writes_reach_cache():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	csm.player_health = 42
	csm.opponent_health = 37
	csm.is_my_turn = true
	assert_eq(CombatStateCache.my_health, 42, "CombatSyncManager writes shared my_health")
	assert_eq(CombatStateCache.opponent_health, 37)
	assert_true(CombatStateCache.is_my_turn)

func test_combat_sync_manager_seed_is_precombat_placeholder():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	assert_eq(csm.player_health, 100, "seeds 100 player health")
	assert_eq(csm.opponent_health, 100, "seeds 100 opponent health")
