extends GutTest

const CAMPAIGN := preload("res://scenes/ui/campaign_map.tscn")
const HEALTH := preload("res://scenes/ui/health_bar.tscn")
const COUNTER := preload("res://scenes/ui/components/enemies_counter.gd")

func test_campaign_content_uses_scrolling_container() -> void:
	var scene: Control = CAMPAIGN.instantiate()
	add_child_autofree(scene)
	await get_tree().process_frame
	var content: VBoxContainer = scene.get_node("SafeAreaContainer/ScrollContainer/Content")
	assert_true(content.get_node("StagesContainer") is VBoxContainer)
	assert_true(content.get_node("ChapterNav") is HBoxContainer)
	assert_true(scene.get_node("Background") is ColorRect)
	assert_true(content.get_node("BossRequirementsPanel").position.y > content.get_node("StagesContainer").position.y)

func test_health_bar_has_only_one_numeric_label() -> void:
	var scene: Control = HEALTH.instantiate()
	add_child_autofree(scene)
	assert_false(scene.get_node("HealthBar").show_percentage)

func test_enemy_counter_reads_autoload_and_updates() -> void:
	var counter: Label = COUNTER.new()
	add_child_autofree(counter)
	await get_tree().process_frame
	assert_true(EnemySpawner.enemy_count_changed.is_connected(counter._on_enemy_count_changed))
	counter._on_enemy_count_changed(2, 3)
	assert_eq(counter.text, "Enemies: 1 / 3 (33%)")

func test_campaign_progress_counter_tween_updates() -> void:
	var scene: Control = CAMPAIGN.instantiate()
	add_child_autofree(scene)
	await get_tree().process_frame
	scene._tween_counter(scene.progress_percent, 50, 0.05)
	await get_tree().create_timer(0.1).timeout
	assert_eq(scene.progress_percent.text, "50%")

func test_virtual_joystick_touch_drag_and_release() -> void:
	var joystick: Control = load("res://scenes/virtual_joystick.tscn").instantiate()
	add_child_autofree(joystick)
	await get_tree().process_frame
	var center: Vector2 = joystick._get_joystick_center()
	var touch := InputEventScreenTouch.new()
	touch.index = 0
	touch.position = center
	touch.pressed = true
	joystick._input(touch)
	var drag := InputEventScreenDrag.new()
	drag.index = 0
	drag.position = center + Vector2(joystick.joystick_radius * 0.5, 0)
	joystick._input(drag)
	assert_true(joystick.output_vector.x > 0.4)
	assert_almost_eq(joystick.output_vector.y, 0.0, 0.01)
	touch.pressed = false
	joystick._input(touch)
	assert_eq(joystick.output_vector, Vector2.ZERO)
