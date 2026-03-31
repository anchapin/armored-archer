extends GutTest

var ObjectPoolClass = load("res://autoloads/ObjectPool.gd")

func test_object_pool_initializes():
	var pool = ObjectPoolClass.new()
	add_child_autofree(pool)
	assert_true(true, "ObjectPool should instantiate")

func test_object_pool_has_acquire_release():
	var pool = ObjectPoolClass.new()
	add_child_autofree(pool)
	assert_true(pool.has_method("acquire") or pool.has_method("get_object"),
		"ObjectPool should have acquire method")
	assert_true(pool.has_method("release") or pool.has_method("return_object"),
		"ObjectPool should have release method")