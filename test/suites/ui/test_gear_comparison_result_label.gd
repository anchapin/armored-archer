extends GutTest

const COMPARISON_SCENE = preload("res://scenes/ui/gear_comparison.tscn")

func test_label_preserves_all_comparison_branches_without_markup() -> void:
	var scene = COMPARISON_SCENE.instantiate()
	add_child_autofree(scene)
	var expected := {"gear1": "Left gear is better", "gear2": "Right gear is better", "equal": "Both gear are equal"}
	for better in expected:
		scene._display_comparison_result({"better": better, "differences": [
			{"stat": "Attack", "gear1_value": 12, "gear2_value": 8, "difference": 4, "better": "gear1"},
			{"stat": "Health", "gear1_value": 8, "gear2_value": 12, "difference": -4, "better": "gear2"},
			{"stat": "Speed", "gear1_value": 5, "gear2_value": 5, "difference": 0, "better": "equal"}
		]})
		assert_eq(scene.result_label.text, expected[better] + "\n\nStat Differences:\nAttack: 12 vs 8 (+4)\nHealth: 8 vs 12 (-4)\nSpeed: 5 vs 5\n")
		assert_false(scene.result_label.text.contains("[color"))
		assert_false(scene.result_label.text.contains("[/color]"))
	assert_eq(scene.result_label.modulate, Color.WHITE)
	assert_eq(scene.result_label.get_theme_color("font_color"), ThemeManager.get_text_color())

func test_local_background_covers_scene_and_tracks_resize_without_blocking_input() -> void:
	var scene = COMPARISON_SCENE.instantiate()
	add_child_autofree(scene)
	await get_tree().process_frame
	var background: ColorRect = scene.get_node("_theme_background")
	assert_eq(background.position, Vector2.ZERO)
	assert_eq(background.size, scene.size)
	assert_eq(background.color, ArcherDesignTokens.COLOR_SURFACE)
	assert_eq(background.mouse_filter, Control.MOUSE_FILTER_IGNORE)
	assert_eq(background.get_index(), 0)
	scene.set_anchors_preset(Control.PRESET_TOP_LEFT)
	scene.size = Vector2(1280, 720)
	await get_tree().process_frame
	assert_eq(background.size, scene.size)
	watch_signals(scene)
	scene.close_button.pressed.emit()
	assert_signal_emitted(scene, "comparison_closed")
	assert_true(scene.is_queued_for_deletion())

func test_populated_labels_use_screen_text_color_and_keep_rarity_words() -> void:
	var scene = COMPARISON_SCENE.instantiate()
	add_child_autofree(scene)
	scene.set_gear_comparison(
		{"name": "Longbow", "rarity": "rare", "modifiers": [{"name": "Swift", "description": "Quick draw"}]},
		{"name": "Shortbow", "rarity": "common"}, {"better": "equal"})
	for label in [scene.gear1_name, scene.gear1_rarity, scene.gear2_name, scene.gear2_rarity]:
		assert_eq(label.modulate, Color.WHITE)
		assert_eq(label.get_theme_color("font_color"), ThemeManager.get_text_color())
	assert_eq(scene.gear1_rarity.text, "Rare")
	assert_eq(scene.gear2_rarity.text, "Common")
	var modifier = scene.gear1_modifiers.get_child(0)
	assert_eq(modifier.get_child(0).text, "Swift")
	assert_eq(modifier.get_child(1).text, ": Quick draw")
	assert_eq(modifier.get_child(0).get_theme_color("font_color"), ThemeManager.get_text_color())
	assert_eq(modifier.get_child(1).get_theme_color("font_color"), ThemeManager.get_text_color())
