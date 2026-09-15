extends GutTest

func test_basic_assertion():
	assert_true(true, "Basic assertion should pass")

func test_basic_string_equality():
	var expected = "hello"
	var actual = "hello"
	assert_eq(expected, actual, "String equality should fail with mismatched strings")

func test_basic_number_equality():
	assert_eq(5, 5, "Number equality should pass")

func test_basic_array_equality():
	var arr = [1, 2, 3]
	assert_eq(arr.size(), 3, "Array size should be correct")

func test_string_inequality():
	assert_ne("hello", "world", "Different strings should not be equal")

func test_number_inequality():
	assert_ne(5, 10, "Different numbers should not be equal")

func test_boolean_assertions():
	assert_true(true, "True should be true")
	assert_false(false, "False should be false")

func test_null_assertions():
	assert_null(null, "Null should be null")
	var something = "value"
	assert_not_null(something, "Non-null value should not be null")

func test_array_operations():
	var arr = []
	arr.append(1)
	arr.append(2)
	arr.append(3)
	assert_eq(arr.size(), 3, "Array should have 3 elements")
	assert_true(arr.has(2), "Array should contain 2")
	assert_false(arr.has(5), "Array should not contain 5")

func test_dictionary_operations():
	var dict = {"key": "value", "number": 42}
	assert_eq(dict["key"], "value", "Dict should have correct value")
	assert_eq(dict["number"], 42, "Dict should have correct number")
	assert_true(dict.has("key"), "Dict should have key")
	assert_false(dict.has("missing"), "Dict should not have missing key")

func test_math_operations():
	assert_eq(2 + 2, 4, "Basic addition")
	assert_eq(10 - 3, 7, "Basic subtraction")
	assert_eq(3 * 4, 12, "Basic multiplication")
	assert_eq(10.0 / 2.0, 5.0, "Basic division")

func test_string_operations():
	var str = "hello world"
	assert_eq(str.length(), 11, "String length should be 11")
	assert_true(str.begins_with("hello"), "Should begin with hello")
	assert_true(str.ends_with("world"), "Should end with world")
	assert_eq(str.to_upper(), "HELLO WORLD", "Should convert to upper")
	assert_eq(str.to_lower(), "hello world", "Should stay lower")

func test_range_assertion():
	assert_between(5, 1, 10, "5 should be between 1 and 10")
	assert_between(0.5, 0.0, 1.0, "0.5 should be between 0 and 1")

func test_type_checks():
	var num = 42
	var str = "text"
	var arr = [1, 2]
	var dict = {"a": 1}
	assert_eq(typeof(num), TYPE_INT, "Should be int")
	assert_eq(typeof(str), TYPE_STRING, "Should be string")
	assert_eq(typeof(arr), TYPE_ARRAY, "Should be array")
	assert_eq(typeof(dict), TYPE_DICTIONARY, "Should be dictionary")
