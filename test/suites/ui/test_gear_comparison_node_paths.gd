extends GutTest

const COMPARISON_SCENE = preload("res://scenes/ui/gear_comparison.tscn")

func test_real_comparison_scene_resolves_all_declared_nodes() -> void:
	var scene = COMPARISON_SCENE.instantiate()
	add_child_autofree(scene)
	for slot in ["gear1_name", "gear1_rarity", "gear1_stats", "gear1_modifiers",
			"gear2_name", "gear2_rarity", "gear2_stats", "gear2_modifiers",
			"result_label", "close_button"]:
		assert_not_null(scene.get(slot), slot)
	assert_true(scene.close_button.pressed.is_connected(scene._on_close_button_pressed))

func test_real_scene_populates_both_gear_columns_and_comparison_result() -> void:
	var scene = COMPARISON_SCENE.instantiate()
	add_child_autofree(scene)
	scene.set_gear_comparison(
		{"name": "Longbow", "rarity": "rare", "stats": [{"name": "Attack", "value": 12}]},
		{"name": "Shortbow", "rarity": "common", "stats": [{"name": "Attack", "value": 8}]},
		{"better": "gear1", "differences": [{"stat": "Attack", "gear1_value": 12,
			"gear2_value": 8, "difference": 4, "better": "gear1"}]}
	)
	assert_eq(scene.gear1_name.text, "Longbow")
	assert_eq(scene.gear2_name.text, "Shortbow")
	assert_eq(scene.gear1_stats.get_child(0).text, "Attack: 12")
	assert_eq(scene.gear2_stats.get_child(0).text, "Attack: 8")
	assert_true(scene.result_label.text.contains("Left gear is better"))
	watch_signals(scene)
	scene.close_button.pressed.emit()
	assert_signal_emitted(scene, "comparison_closed")
	assert_true(scene.is_queued_for_deletion())
