extends GutTest

# Issue #1772 (follow-up to the issue #1361 pending conversions): the previous
# version of this suite asserted a generic `acquire` / `release` API that
# production never shipped. autoloads/ObjectPool.gd exposes a *typed* pool
# API instead, one pair per pooled object kind:
#
#   get_arrow()            / return_arrow(node)
#   get_enemy(scene?)      / return_enemy(node)
#   get_hit_effect()       / return_hit_effect(node)
#   get_death_effect()     / return_death_effect(node)
#   get_crit_effect()      / return_crit_effect(node)
#   get_miss_effect()      / return_miss_effect(node)
#
# There is no `acquire` / `release` / `get_object` / `return_object` — pool
# management is internal and per-type. The tests below assert the API that
# is actually shipped instead of pinging on a non-existent one.
#
# Scope note: the `get_*` half of the round trip instantiates pooled scenes
# (res://scenes/arrow.tscn, res://assets/particles/*.tscn, ...), so it is
# only exercised where those assets are available. The asset-free `return_*`
# path is exercised at runtime below.

const TYPED_GETTERS: Array[String] = [
	"get_arrow",
	"get_enemy",
	"get_hit_effect",
	"get_death_effect",
	"get_crit_effect",
	"get_miss_effect",
]

const TYPED_RETURNERS: Array[String] = [
	"return_arrow",
	"return_enemy",
	"return_hit_effect",
	"return_death_effect",
	"return_crit_effect",
	"return_miss_effect",
]

const GENERIC_API: Array[String] = [
	"acquire",
	"release",
	"get_object",
	"return_object",
]

var ObjectPoolClass = load("res://autoloads/ObjectPool.gd")

func test_object_pool_initializes():
	var pool = ObjectPoolClass.new()
	add_child_autofree(pool)
	assert_true(true, "ObjectPool should instantiate")

func test_object_pool_has_typed_pool_api():
	# Issue #1772: production exposes a typed pool API, not acquire/release.
	var pool = ObjectPoolClass.new()
	add_child_autofree(pool)

	for getter in TYPED_GETTERS:
		assert_true(pool.has_method(getter),
			"ObjectPool should expose the typed getter '%s'" % getter)

	for returner in TYPED_RETURNERS:
		assert_true(pool.has_method(returner),
			"ObjectPool should expose the typed returner '%s'" % returner)

func test_object_pool_has_no_generic_acquire_release():
	# The old expectation (a generic acquire/release pair) does not exist in
	# production and must not creep back in as an alias.
	var pool = ObjectPoolClass.new()
	add_child_autofree(pool)

	for method_name in GENERIC_API:
		assert_false(pool.has_method(method_name),
			"ObjectPool should not expose a generic '%s' method" % method_name)

func test_object_pool_typed_methods_have_expected_arity():
	# Getters take at most one optional scene argument; returners take the
	# pooled node to give back.
	var pool = ObjectPoolClass.new()
	add_child_autofree(pool)
	var methods: Dictionary = {}
	for entry in pool.get_method_list():
		methods[entry["name"]] = entry

	for getter in TYPED_GETTERS:
		assert_true(methods.has(getter),
			"ObjectPool should list the typed getter '%s'" % getter)
		if not methods.has(getter):
			continue
		assert_true((methods[getter]["args"] as Array).size() <= 1,
			"Typed getter '%s' should take at most one optional argument" % getter)

	for returner in TYPED_RETURNERS:
		assert_true(methods.has(returner),
			"ObjectPool should list the typed returner '%s'" % returner)
		if not methods.has(returner):
			continue
		assert_eq((methods[returner]["args"] as Array).size(), 1,
			"Typed returner '%s' should take exactly one pooled node" % returner)

func test_object_pool_return_arrow_parks_and_stores_node():
	# Asset-free round trip: the release half of the typed API needs no
	# pooled scene, so it can be asserted directly.
	var pool = ObjectPoolClass.new()
	add_child_autofree(pool)
	var arrow := Node2D.new()
	add_child_autofree(arrow)

	pool.return_arrow(arrow)

	assert_eq(arrow.process_mode, Node.PROCESS_MODE_DISABLED,
		"Returned arrow should be parked (processing disabled)")
	assert_eq(pool._arrow_pool.count(arrow), 1,
		"Returned arrow should be tracked in the arrow pool exactly once")
	assert_eq(pool._active_arrows.count(arrow), 0,
		"Returned arrow should no longer be tracked as active")

	# Hand the node back so the pool does not queue_free() a node that GUT
	# also frees as an autofree child.
	pool._arrow_pool.erase(arrow)
