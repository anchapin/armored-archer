extends GutTest

const CONSUMERS := [
	"campaign_map", "game_over", "gear_comparison", "gear_inventory",
	"level_requirement_gate", "matchmaking_menu", "punch_up_warning_dialog",
	"quest_objective_display", "quest_tracker",
]

func test_consumers_resolve_registered_design_token_autoload() -> void:
	var tokens := get_node_or_null("/root/ArcherDesignTokens")
	assert_not_null(tokens, "The registered palette autoload must exist")
	for consumer in CONSUMERS:
		var source := FileAccess.get_file_as_string("res://scenes/ui/%s.gd" % consumer)
		assert_true(source.contains('get_node_or_null("/root/ArcherDesignTokens")'), consumer)
		assert_false(source.contains('"/root/DesignTokens"'), consumer)

func test_quest_panel_uses_primary_token_instead_of_stale_blue() -> void:
	var tracker = load("res://scenes/ui/quest_tracker.gd").new()
	autofree(tracker)
	tracker.design_tokens = get_node("/root/ArcherDesignTokens")
	var panel = tracker._create_quest_panel({"id": "palette-test", "name": "Palette test"})
	autofree(panel)
	assert_eq(panel.modulate, ArcherDesignTokens.COLOR_PRIMARY)

func test_match_item_uses_warning_error_and_primary_tokens() -> void:
	var menu = load("res://scenes/ui/matchmaking_menu.gd").new()
	autofree(menu)
	menu.design_tokens = get_node("/root/ArcherDesignTokens")
	var item = menu._create_match_item({"creator_rank": 100, "is_punch_up": true})
	autofree(item)
	var labels = item.get_child(0)
	assert_eq(labels.get_child(2).modulate, ArcherDesignTokens.COLOR_WARNING)
	assert_eq(labels.get_child(3).modulate, ArcherDesignTokens.COLOR_ERROR)
	assert_eq(item.get_child(1).modulate, Color.WHITE)
	assert_eq(item.get_child(1)._get_colors_for_type()["bg"], ArcherDesignTokens.COLOR_PRIMARY)

func test_primary_button_styles_keep_text_readable_without_modulation() -> void:
	var button = load("res://scenes/ui/components/primary_token_button.gd").new()
	add_child_autofree(button)
	var normal = button._get_colors_for_type()
	assert_eq(normal["bg"], ArcherDesignTokens.COLOR_PRIMARY)
	assert_eq(normal["text"], ArcherDesignTokens.COLOR_ON_PRIMARY)
	assert_eq(button.modulate, Color.WHITE)
	var hover = button._get_hover_colors(normal)
	assert_eq(hover["bg"], ArcherDesignTokens.COLOR_PRIMARY_FIXED)
	assert_eq(hover["text"], ArcherDesignTokens.COLOR_ON_PRIMARY_CONTAINER)
	var pressed = button._get_pressed_colors(normal)
	assert_eq(pressed["bg"], ArcherDesignTokens.COLOR_PRIMARY_DIM)
	assert_eq(pressed["text"], ArcherDesignTokens.COLOR_ON_PRIMARY)
	button.disabled = true
	button._set_state(button.ButtonState.DISABLED)
	assert_true(button.disabled)
	assert_true(button.has_signal("state_changed"))
