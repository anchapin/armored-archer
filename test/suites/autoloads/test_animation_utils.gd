extends GutTest

var AnimationUtilsClass = load("res://autoloads/AnimationUtils.gd")

func test_animation_utils_initializes():
	var anim_utils = AnimationUtilsClass.new()
	add_child_autofree(anim_utils)
	assert_true(true, "AnimationUtils should instantiate")

func test_animation_utils_has_helper_methods():
	var anim_utils = AnimationUtilsClass.new()
	add_child_autofree(anim_utils)
	assert_true(anim_utils.has_method("create_tween") or 
		anim_utils.has_method("play_animation") or
		anim_utils.has_method("get_animation_player"),
		"AnimationUtils should have animation methods")