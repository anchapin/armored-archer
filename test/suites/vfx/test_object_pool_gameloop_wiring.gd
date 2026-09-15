extends GutTest

## Issue #1110 — ObjectPool prewarm + scene-transition cleanup wired into
## the game flow:
##   * _ready() no longer constructs pools synchronously at boot; pools are
##     built behind the stage load via GameManager.start_game() ->
##     prewarm_pools() (scenes/main.gd calls start_game() as the combat
##     scene enters, under the campaign-map fade).
##   * Every scene change flushes active pooled objects back to their pools
##     via the root child_exiting_tree hook (_on_root_child_exiting_tree),
##     so pooled enemies/arrows/VFX never keep simulating across menus/PvP.
##
## Companion coverage lives in test_object_pool.gd (pool semantics) — this
## suite covers the *wiring* into the game flow only.

const ARROW_POOL_BASE: int = 20
const ARROW_POOL_FLOOR: int = 5
const ENEMY_POOL_BASE: int = 15
const ENEMY_POOL_FLOOR: int = 3
# Small Label-rooted scene used as a scene-file-backed "outgoing scene"
# fixture — the hook only fires for .tscn instantiations. damage_popup.tscn
# is the same scene ObjectPool prewarms, so it always loads.
const OUTGOING_SCENE: PackedScene = preload("res://scenes/damage_popup.tscn")
const ALL_STATS_KEYS: Array = [
	"arrows", "enemies", "hit_effects", "death_effects", "crit_effects",
	"miss_effects", "fire_effects", "ice_effects", "lightning_effects",
	"charge_effects", "damage_popups", "arrow_trails",
]

var _object_pool_script: GDScript
var _game_manager_script: GDScript
var _profiler: Node


func before_all() -> void:
	_object_pool_script = load("res://autoloads/ObjectPool.gd")
	_game_manager_script = load("res://autoloads/GameManager.gd")
	_profiler = get_node_or_null("/root/PerformanceProfiler")


# --- Helpers ---

# Fresh ObjectPool exactly as production boots it: _ready() ran but no
# prewarm happened yet.
func _make_unwarmed_pool() -> Node:
	var pool: Node = _object_pool_script.new()
	add_child_autofree(pool)
	return pool


# Fresh ObjectPool with the game-flow prewarm applied, mirroring what
# GameManager.start_game() does behind the stage load.
func _make_pool() -> Node:
	var pool: Node = _make_unwarmed_pool()
	pool.prewarm_pools()
	return pool


# Multiplier _initialize_pools() applies for the profiler's current tier.
func _live_multiplier() -> float:
	if _profiler != null and _profiler.is_budget_device():
		return 0.5
	if _profiler != null and _profiler.is_mid_range_device():
		return 0.75
	return 1.0


# A .tscn instantiation standing in for the outgoing current scene, exactly
# like the root node change_scene_to_file/packed produce.
func _make_outgoing_scene() -> Node:
	return OUTGOING_SCENE.instantiate()


# Drive the root child_exiting_tree hook with the exact state a real
# Godot 4.6 change_scene produces: current_scene is already null and the
# outgoing scene is a root-parented .tscn instantiation (both discriminators
# verified against the engine with a SceneTree probe; see issue #1110).
# `scene_active` instead simulates mid-combat (current_scene still set).
# GUT script-mode never sets current_scene, so it is driven explicitly here.
func _fire_scene_exit(pool: Node, outgoing: Node, scene_active: bool) -> void:
	var tree: SceneTree = get_tree()
	var runner_scene: Node = tree.current_scene
	var adopted: bool = false
	if outgoing.get_parent() != tree.root:
		tree.root.add_child(outgoing)
		adopted = true
	var midgame_marker: Node = null
	if scene_active:
		# set_current_scene() requires a root-parented node (or null).
		midgame_marker = Node.new()
		tree.root.add_child(midgame_marker)
	tree.current_scene = midgame_marker
	pool._on_root_child_exiting_tree(outgoing)
	if adopted:
		# Detach + free synchronously while current_scene still holds the
		# test state, so the hook's re-fire on removal is a no-op and the
		# scratch node's exit can never leak into a later test. Real
		# autoloads passed as `outgoing` are never adopted, never freed.
		tree.root.remove_child(outgoing)
		outgoing.free()
	tree.current_scene = runner_scene
	if midgame_marker != null:
		midgame_marker.free()


# --- Boot-path coverage ---


# Pool construction must NOT happen in _ready() — that synchronous cost at
# engine boot is what issue #1110 moved behind the stage load.
func test_ready_does_not_construct_pools() -> void:
	var pool: Node = _make_unwarmed_pool()
	assert_false(
		pool._pools_initialized,
		"_ready() must not construct pools (boot cost moves to prewarm)"
	)
	assert_eq(
		(pool._arrow_pool as Array).size(), 0,
		"arrow pool must be empty until prewarm"
	)
	assert_eq(
		(pool._enemy_pool as Array).size(), 0,
		"enemy pool must be empty until prewarm"
	)
	assert_eq(
		pool.get_child_count(), 0,
		"no pooled nodes may be instantiated at boot"
	)


# prewarm_pools() must construct the tier-budgeted pool set in one call.
func test_prewarm_pools_constructs_tier_budget() -> void:
	var pool: Node = _make_unwarmed_pool()
	pool.prewarm_pools()
	var multiplier: float = _live_multiplier()
	assert_true(pool._pools_initialized, "prewarm must mark pools initialized")
	assert_eq(
		(pool._arrow_pool as Array).size(),
		maxi(int(ARROW_POOL_BASE * multiplier), ARROW_POOL_FLOOR),
		"arrow pool must prewarm to the tier budget"
	)
	assert_eq(
		(pool._enemy_pool as Array).size(),
		maxi(int(ENEMY_POOL_BASE * multiplier), ENEMY_POOL_FLOOR),
		"enemy pool must prewarm to the tier budget"
	)


# A second prewarm must never double-fill the pools (issue #1110: game flow
# calls prewarm on every start_game, so it must be idempotent).
func test_prewarm_pools_is_idempotent_no_double_fill() -> void:
	var pool: Node = _make_pool()
	var arrow_size: int = (pool._arrow_pool as Array).size()
	var child_count: int = pool.get_child_count()
	pool.prewarm_pools()
	pool.prewarm_pools()
	assert_eq(
		(pool._arrow_pool as Array).size(), arrow_size,
		"repeat prewarm must not grow the arrow pool"
	)
	assert_eq(
		pool.get_child_count(), child_count,
		"repeat prewarm must not instantiate extra nodes"
	)


# Getters must lazily construct pools if a caller beats the prewarm (e.g.
# PvP or tests), so removing boot-time init cannot break any flow.
func test_getters_lazily_initialize_before_prewarm() -> void:
	var pool: Node = _make_unwarmed_pool()
	var arrow: Node = pool.get_arrow()
	assert_not_null(arrow, "get_arrow() must work without an explicit prewarm")
	assert_true(
		pool._pools_initialized,
		"get_arrow() must lazily initialize the pools"
	)
	assert_not_null(
		pool.get_charge_effect(), "charge getter must work unprewarmed too"
	)
	pool.return_arrow(arrow)


# --- Game-flow wiring: prewarm (GameManager.start_game) ---


# start_game() — called by scenes/main.gd as the combat scene enters, i.e.
# behind the campaign-map fade — must prewarm the /root/ObjectPool the
# production code looks up. A fresh pool is swapped into that slot so the
# assertion observes this call's effect, not an earlier test's.
func test_game_manager_start_game_prewarms_pools() -> void:
	var game_manager: Node = _game_manager_script.new()
	add_child_autofree(game_manager)

	var real_pool: Node = get_node("/root/ObjectPool")
	var real_name: StringName = real_pool.name
	real_pool.name = "ObjectPoolSwappedForWiringTest"
	var fresh_pool: Node = _object_pool_script.new()
	fresh_pool.name = real_name
	get_tree().root.add_child(fresh_pool)

	assert_false(
		fresh_pool._pools_initialized, "swapped-in pool must start unwarmed"
	)
	game_manager.start_game()
	assert_true(
		fresh_pool._pools_initialized,
		"GameManager.start_game() must prewarm the pools (issue #1110)"
	)
	assert_gt(
		(fresh_pool._arrow_pool as Array).size(), 0,
		"start_game() must construct the combat pools"
	)

	fresh_pool.name = "ObjectPoolWiringTestDispose"
	fresh_pool.queue_free()
	real_pool.name = real_name


# --- Game-flow wiring: scene-transition cleanup (root hook) ---


# Acceptance (issue #1110): after a scene change every pool's active count
# must return to zero, with the objects parked (hidden, not processing)
# rather than freed.
func test_scene_exit_returns_active_objects_to_pools() -> void:
	var pool: Node = _make_pool()
	var arrow: Node = pool.get_arrow()
	var enemy: Node = pool.get_enemy()
	var hit_effect: Node = pool.get_hit_effect()
	var charge_effect: GPUParticles2D = pool.get_charge_effect()
	var popup: Label = pool.get_damage_popup()

	var stats: Dictionary = pool.get_statistics()
	for key in ["arrows", "enemies", "hit_effects", "charge_effects", "damage_popups"]:
		assert_eq(
			stats[key].active, 1,
			"%s must be active before the transition" % key
		)

	_fire_scene_exit(pool, _make_outgoing_scene(), false)

	stats = pool.get_statistics()
	for key in ALL_STATS_KEYS:
		assert_eq(
			stats[key].active, 0,
			"%s active count must return to zero after a scene change" % key
		)
	for pooled in [arrow, enemy, hit_effect, charge_effect, popup]:
		assert_true(
			is_instance_valid(pooled),
			"scene change must pool active objects, not free them"
		)
		assert_false(pooled.visible, "pooled objects must be hidden")
		assert_false(
			pooled.is_processing(),
			"pooled objects must stop simulating (leak fix, issue #1110)"
		)
	assert_true(
		(pool._arrow_pool as Array).has(arrow),
		"arrow must be back in its pool after the transition"
	)
	assert_true(
		(pool._enemy_pool as Array).has(enemy),
		"enemy must be back in its pool after the transition"
	)


# The hook must NOT fire mid-combat: a root-parented gameplay node (e.g. a
# boss from GameManager.spawn_boss) exits while current_scene is still set,
# and that must not flush pools.
func test_scene_exit_hook_skips_midgame_root_children() -> void:
	var pool: Node = _make_pool()
	var arrow: Node = pool.get_arrow()
	_fire_scene_exit(pool, _make_outgoing_scene(), true)
	assert_eq(
		(pool._active_arrows as Array).size(), 1,
		"mid-combat root-child exits must not flush the pools"
	)
	pool.return_arrow(arrow)


# The hook must ignore autoload exits during tree teardown (current_scene is
# null at shutdown, and GDScript autoloads carry no scene_file_path).
func test_scene_exit_hook_skips_autoload_exits() -> void:
	var pool: Node = _make_pool()
	var arrow: Node = pool.get_arrow()
	_fire_scene_exit(pool, get_node("/root/GameManager"), false)
	assert_eq(
		(pool._active_arrows as Array).size(), 1,
		"autoload exits must not flush the pools"
	)
	pool.return_arrow(arrow)
