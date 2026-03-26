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
