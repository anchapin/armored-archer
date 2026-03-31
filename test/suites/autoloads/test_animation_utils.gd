extends GutTest

var AnimationUtilsClass = load("res://autoloads/AnimationUtils.gd")

func before_each():
	pass

func after_each():
	pass

func test_animation_utils_class_type():
	var anim_utils = AnimationUtilsClass.new()
	add_child_autofree(anim_utils)
	assert_true(anim_utils != null, "AnimationUtils should instantiate")
	assert_eq(anim_utils.get_class(), "AnimationUtils", "Class should be AnimationUtils")

func test_static_fade_in_callable():
	var node = Node2D.new()
	add_child_autofree(node)
	var tween = AnimationUtils.fade_in(node, 0.01)
	assert_true(tween != null, "fade_in should return a tween")

func test_static_fade_out_callable():
	var node = Node2D.new()
	add_child_autofree(node)
	var tween = AnimationUtils.fade_out(node, 0.01, false)
	assert_true(tween != null, "fade_out should return a tween")

func test_static_scale_bounce_callable():
	var node = Node2D.new()
	node.scale = Vector2(1, 1)
	add_child_autofree(node)
	var tween = AnimationUtils.scale_bounce(node, 1.1)
	assert_true(tween != null, "scale_bounce should return a tween")

func test_static_pulse_callable():
	var node = Node2D.new()
	add_child_autofree(node)
	var tween = AnimationUtils.pulse(node, 0.1, 2.0)
	assert_true(tween != null, "pulse should return a tween")

func test_static_scale_down_callable():
	var node = Node2D.new()
	node.scale = Vector2(1, 1)
	add_child_autofree(node)
	var tween = AnimationUtils.scale_down(node, 0.95)
	assert_true(tween != null, "scale_down should return a tween")