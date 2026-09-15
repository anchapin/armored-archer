extends GutTest

## Issue #1090 / #1185 — ObjectPool coverage for the pooled combat-juice VFX
## paths added when per-hit particles, damage popups, and arrow trails were
## routed through ObjectPool (PR 741c843d).
##
## GUT port of the assertions that lived in the deleted legacy
## test/test_vfx_pooling_issue_1090.gd (removed in PR #1159 because it was
## never wired into the legacy runner; this suite restores that coverage).

# --- Fixtures ---

# Elemental particle pools added in issue #1090, plus the charge pool added
# in issue #1136. They share identical acquire/release semantics in
# ObjectPool.gd (get_<type>_effect / return_<type>_effect over
# GPUParticles2D) and differ only in size.
# `base` = pool-size constant, `floor` = prewarm minimum, `stats` = key
# reported by get_statistics().
const ELEMENTAL_POOLS: Dictionary = {
	"crit": {"base": 8, "floor": 2, "stats": "crit_effects"},
	"miss": {"base": 6, "floor": 2, "stats": "miss_effects"},
	"fire": {"base": 6, "floor": 2, "stats": "fire_effects"},
	"ice": {"base": 6, "floor": 2, "stats": "ice_effects"},
	"lightning": {"base": 6, "floor": 2, "stats": "lightning_effects"},
	"charge": {"base": 6, "floor": 2, "stats": "charge_effects"},
}
const POPUP_BASE_SIZE: int = 12
const POPUP_FLOOR: int = 3
const TRAIL_BASE_SIZE: int = 16
const TRAIL_FLOOR: int = 4

var _object_pool_script: GDScript
var _profiler_script: GDScript
var _profiler: Node


func before_all() -> void:
	_object_pool_script = load("res://autoloads/ObjectPool.gd")
	_profiler_script = load("res://autoloads/PerformanceProfiler.gd")
	_profiler = get_node_or_null("/root/PerformanceProfiler")


# --- Helpers ---

# Create a fresh ObjectPool instance (ISO-04 fresh-instance isolation).
# Issue #1110 moved pool construction out of _ready() into prewarm_pools()
# (wired from GameManager.start_game()), so prewarm explicitly here — the
# pools are then filled as soon as this returns, as before.
func _make_pool() -> Node:
	var pool: Node = _object_pool_script.new()
	add_child_autofree(pool)
	pool.prewarm_pools()
	return pool


# Create a fresh ObjectPool whose _initialize_pools() ran while the
# PerformanceProfiler autoload temporarily reported `tier`. This exercises
# the device-tier multiplier branch (ObjectPool.gd budget/mid-range
# adjustment) deterministically regardless of the host machine.
func _make_pool_with_tier(tier: int) -> Node:
	var previous_tier: int = _profiler._device_tier
	_profiler._device_tier = tier
	var pool: Node = _make_pool()
	_profiler._device_tier = previous_tier
	return pool


# Multiplier _initialize_pools() applies for the profiler's current tier.
func _live_multiplier() -> float:
	if _profiler != null and _profiler.is_budget_device():
		return 0.5
	if _profiler != null and _profiler.is_mid_range_device():
		return 0.75
	return 1.0


# --- Statistics coverage ---


# get_statistics() must report every pool type added in issue #1090 with
# the full per-type counter set (port of the legacy statistics assertion).
func test_statistics_expose_all_vfx_pool_types() -> void:
	var pool: Node = _make_pool()
	var stats: Dictionary = pool.get_statistics()
	var expected_keys: Array = [
		"crit_effects", "miss_effects", "fire_effects", "ice_effects",
		"lightning_effects", "charge_effects", "damage_popups", "arrow_trails",
	]
	for key in expected_keys:
		assert_has(stats, key, "get_statistics() must report the '%s' pool" % key)
		for counter in ["created", "reused", "active", "available", "reuse_rate"]:
			assert_has(
				stats[key], counter,
				"stats['%s'] must include the '%s' counter" % [key, counter]
			)


# --- Prewarm / device-tier coverage ---


# Prewarm must allocate exactly the tier budget per pool type — never more
# than pool_size * pool_size_multiplier, never less than the floor.
func test_prewarm_counts_match_live_device_tier_budget() -> void:
	var pool: Node = _make_pool()
	var multiplier: float = _live_multiplier()
	for type_name in ELEMENTAL_POOLS:
		var cfg: Dictionary = ELEMENTAL_POOLS[type_name]
		var expected: int = maxi(int(cfg.base * multiplier), cfg.floor)
		var actual: int = (pool.get("_%s_effect_pool" % type_name) as Array).size()
		assert_eq(
			actual, expected,
			"%s pool must prewarm to the tier budget (base %d x %.2f, floor %d)"
				% [type_name, cfg.base, multiplier, cfg.floor]
		)
	assert_eq(
		(pool._damage_popup_pool as Array).size(),
		maxi(int(POPUP_BASE_SIZE * multiplier), POPUP_FLOOR),
		"damage popup pool must prewarm to the tier budget"
	)
	assert_eq(
		(pool._arrow_trail_pool as Array).size(),
		maxi(int(TRAIL_BASE_SIZE * multiplier), TRAIL_FLOOR),
		"arrow trail pool must prewarm to the tier budget"
	)


# Budget devices (pool_size_multiplier = 0.5, ObjectPool.gd:113-117) must
# halve every prewarm count while respecting the per-type floors.
func test_budget_device_multiplier_halves_prewarm_counts() -> void:
	var pool: Node = _make_pool_with_tier(_profiler_script.DeviceTier.BUDGET)
	for type_name in ELEMENTAL_POOLS:
		var cfg: Dictionary = ELEMENTAL_POOLS[type_name]
		var expected: int = maxi(int(cfg.base * 0.5), cfg.floor)
		assert_eq(
			(pool.get("_%s_effect_pool" % type_name) as Array).size(), expected,
			"budget %s pool must prewarm to half its size (floor-respected)"
				% type_name
		)
	assert_eq(
		(pool._damage_popup_pool as Array).size(), 6,
		"budget damage popup pool must prewarm 6 of 12"
	)
	assert_eq(
		(pool._arrow_trail_pool as Array).size(), 8,
		"budget arrow trail pool must prewarm 8 of 16"
	)


# Flagship devices (multiplier 1.0) keep the full pool sizes.
func test_flagship_device_prewarms_full_pool_sizes() -> void:
	var pool: Node = _make_pool_with_tier(_profiler_script.DeviceTier.FLAGSHP)
	for type_name in ELEMENTAL_POOLS:
		var cfg: Dictionary = ELEMENTAL_POOLS[type_name]
		assert_eq(
			(pool.get("_%s_effect_pool" % type_name) as Array).size(), cfg.base,
			"flagship %s pool must prewarm to its full size" % type_name
		)
	assert_eq(
		(pool._damage_popup_pool as Array).size(), POPUP_BASE_SIZE,
		"flagship damage popup pool must prewarm to its full size"
	)
	assert_eq(
		(pool._arrow_trail_pool as Array).size(), TRAIL_BASE_SIZE,
		"flagship arrow trail pool must prewarm to its full size"
	)


# --- Acquire / release coverage ---


# get_<type>_effect() must serve prewarmed instances without instantiating
# fresh ones, and return_<type>_effect() must pool the instance (hidden,
# not emitting, back in the available array) instead of queue_free'ing it.
func test_elemental_acquire_returns_pooled_instance_without_instantiating() -> void:
	var pool: Node = _make_pool()
	for type_name in ELEMENTAL_POOLS:
		var stats_key: String = ELEMENTAL_POOLS[type_name].stats
		var effect: GPUParticles2D = pool.call("get_%s_effect" % type_name)
		assert_not_null(
			effect, "get_%s_effect() must return a pooled instance" % type_name
		)
		assert_true(
			effect.emitting,
			"%s effect must start emitting on acquire" % type_name
		)
		assert_true(
			effect.visible, "%s effect must be visible on acquire" % type_name
		)
		assert_true(
			(pool.get("_active_%s_effects" % type_name) as Array).has(effect),
			"%s effect must be tracked as active after acquire" % type_name
		)
		assert_eq(
			(pool.get_statistics() as Dictionary)[stats_key].created, 0,
			"%s acquire must reuse a prewarmed instance, not instantiate"
				% type_name
		)

		pool.call("return_%s_effect" % type_name, effect)
		assert_true(
			is_instance_valid(effect),
			"returned %s effect must be pooled, not freed" % type_name
		)
		assert_false(
			effect.emitting, "%s effect must stop emitting when returned"
				% type_name
		)
		assert_false(
			effect.visible, "%s effect must be hidden when returned" % type_name
		)
		assert_true(
			(pool.get("_%s_effect_pool" % type_name) as Array).has(effect),
			"%s effect must be back in its pool after return" % type_name
		)
		assert_false(
			(pool.get("_active_%s_effects" % type_name) as Array).has(effect),
			"%s effect must leave the active set after return" % type_name
		)


# A second acquire after a return must hand out the same instance.
func test_elemental_pool_reuses_same_instance_across_round_trips() -> void:
	var pool: Node = _make_pool()
	for type_name in ELEMENTAL_POOLS:
		var first: GPUParticles2D = pool.call("get_%s_effect" % type_name)
		pool.call("return_%s_effect" % type_name, first)
		var second: GPUParticles2D = pool.call("get_%s_effect" % type_name)
		assert_eq(
			second, first,
			"%s pool must reuse the same instance on re-acquire" % type_name
		)
		pool.call("return_%s_effect" % type_name, second)


# After N round-trips, get_statistics() must report reuse_rate > 0 for the
# pooled path (issue acceptance criterion).
func test_statistics_report_reuse_rate_after_round_trips() -> void:
	var pool: Node = _make_pool()
	for _i in range(3):
		var effect: GPUParticles2D = pool.get_fire_effect()
		pool.return_fire_effect(effect)
	var fire_stats: Dictionary = \
		(pool.get_statistics() as Dictionary).fire_effects
	assert_gte(
		fire_stats.reused, 3,
		"three fire round-trips must count as reuses"
	)
	assert_eq(
		fire_stats.created, 0,
		"round-trips must not instantiate new fire effects"
	)
	assert_gt(
		fire_stats.reuse_rate, 0.0,
		"fire reuse_rate must be > 0 after round-trips"
	)


# --- Charge effect coverage (issue #1136) ---


# Issue #1136 acceptance: get_statistics() must report a charge_effects
# reuse_rate on a synthetic stress test of acquire/return round-trips.
func test_charge_effect_statistics_report_reuse_rate_under_stress() -> void:
	var pool: Node = _make_pool()
	for _i in range(5):
		var effect: GPUParticles2D = pool.get_charge_effect()
		pool.return_charge_effect(effect)
	var charge_stats: Dictionary = \
		(pool.get_statistics() as Dictionary).charge_effects
	assert_eq(
		charge_stats.created, 0,
		"charge stress loop must only serve prewarmed instances (created == 0)"
	)
	assert_gte(
		charge_stats.reused, 5,
		"five charge round-trips must count as reuses"
	)
	assert_gt(
		charge_stats.reuse_rate, 0.0,
		"charge reuse_rate must be > 0 after the stress loop"
	)


# --- Damage popup coverage ---


# The acquire/return cycle must reset popup state so the next acquire
# starts from a clean slate (issue #1090: return-to-pool replaces
# queue_free).
func test_damage_popup_roundtrip_resets_state_for_reuse() -> void:
	var pool: Node = _make_pool()
	var popup: Label = pool.get_damage_popup()
	assert_not_null(popup, "get_damage_popup() must return a Label")
	assert_true(popup.visible, "popup must be visible on acquire")
	popup.setup_damage(50, true, false, false)
	assert_eq(
		popup.text, "50!", "crit popup must render the damage with a marker"
	)

	pool.return_damage_popup(popup)
	assert_true(
		is_instance_valid(popup), "returned popup must be pooled, not freed"
	)
	assert_false(popup.visible, "popup must be hidden while pooled")
	assert_true(
		(pool._damage_popup_pool as Array).has(popup),
		"popup must be back in its pool after return"
	)
	assert_lt(
		popup._time_alive, 0.01,
		"return must reset _time_alive for the next acquire"
	)
	assert_eq(
		popup.modulate.a, 1.0, "return must restore full opacity"
	)

	var reacquired: Label = pool.get_damage_popup()
	assert_eq(
		reacquired, popup, "second acquire must reuse the same popup"
	)


# Regression (issue #1090 acceptance): the popup must survive its lifetime
# and return ITSELF to the pool from _process — never queue_free mid-fade.
func test_damage_popup_returns_itself_to_pool_at_lifetime() -> void:
	# damage_popup.gd resolves its pool via /root/ObjectPool, so this test
	# exercises the registered autoload exactly as production does.
	var pool: Node = get_node_or_null("/root/ObjectPool")
	var stage: Node2D = Node2D.new()
	stage.name = "PopupLifetimeStage"
	add_child_autofree(stage)

	var popup: Label = pool.get_damage_popup()
	popup.reparent(stage)
	popup.global_position = Vector2(100.0, 100.0)
	popup.setup_damage(30, false, false, false)
	await get_tree().process_frame
	assert_true(
		is_instance_valid(popup) and popup.visible,
		"popup must render at least one frame before returning to the pool"
	)
	assert_gt(
		popup.modulate.a, 0.0,
		"popup must not be fully faded on its first frame"
	)

	await wait_seconds(float(popup.lifetime) + 0.3)
	assert_true(
		is_instance_valid(popup),
		"popup must not be queue_free'd at lifetime end (no free-during-tween)"
	)
	assert_true(
		(pool._damage_popup_pool as Array).has(popup),
		"popup must return itself to the pool at lifetime end"
	)
	assert_lt(
		popup._time_alive, 0.01, "self-return must reset _time_alive"
	)
	# The return path does not reparent; keep the shared autoload consistent.
	popup.reparent(pool)


# --- Arrow trail coverage ---


# Trails must round-trip through the pool and reuse the same instance
# (port of the legacy arrow-trail assertion).
func test_arrow_trail_roundtrip_and_reuse() -> void:
	var pool: Node = _make_pool()
	var trail: GPUParticles2D = pool.get_arrow_trail()
	assert_not_null(trail, "get_arrow_trail() must return a particle")
	assert_true(trail.emitting, "trail must emit while acquired")

	pool.return_arrow_trail(trail)
	assert_false(trail.emitting, "trail must stop emitting when returned")
	assert_true(
		(pool._arrow_trail_pool as Array).has(trail),
		"trail must be back in its pool after return"
	)

	var reacquired: GPUParticles2D = pool.get_arrow_trail()
	assert_eq(
		reacquired, trail, "second trail acquire must reuse the same instance"
	)
	pool.return_arrow_trail(reacquired)


# --- Robustness ---


# Returning null must be a safe no-op for every pooled VFX type.
func test_returning_null_instances_is_safe() -> void:
	var pool: Node = _make_pool()
	for type_name in ELEMENTAL_POOLS:
		pool.call("return_%s_effect" % type_name, null)
	pool.return_damage_popup(null)
	pool.return_arrow_trail(null)
	assert_true(
		is_instance_valid(pool), "pool must survive null returns"
	)
