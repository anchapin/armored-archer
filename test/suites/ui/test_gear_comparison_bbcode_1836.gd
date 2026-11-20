extends GutTest

## Issue #1836: `scenes/ui/gear_comparison.gd::_display_comparison_result()`
## built the comparison result out of BBCode markup:
##
##   * the headline ("[color=#22C55E]Left gear is better[/color]", the same
##     tag for "Right gear is better", "[color=#F59E0B]Both gear are
##     equal[/color]"),
##   * the differences header ("[color=#FFFFFF]Stat Differences:[/color]"),
##   * every stat difference (" [color=#22C55E](+%d)[/color]" /
##     " [color=#EF4444](%d)[/color]").
##
## The result is rendered by a plain `Label` — `gear_comparison.tscn` declares
## `ResultLabel` as type `Label`, not `RichTextLabel` — and a plain Label does
## not parse BBCode, so the tags were painted literally on screen.
##
## The fix keeps the result as plain text and moves the colours to theme font
## colour overrides:
##
##   * the headline lives in the result label and is coloured there
##     (success green for the gear that wins, warning yellow for a tie),
##   * the "Stat Differences:" header is its own white label,
##   * every stat difference is its own row of plain labels; the difference
##     value is green when the left gear wins the stat and red when the right
##     gear wins it.
##
## The suite has two layers:
##
##   1. **Static** — the script must not contain any BBCode colour markup.
##   2. **Runtime** — the real scene is instantiated and driven through
##      `set_gear_comparison()` for the left-better, right-better and equal
##      outcomes plus the difference rows. Every rendered text is asserted to
##      be markup free and the font colours are asserted.
##
## Comparison decisions and stat semantics are untouched by the fix: the
## suite only pins the presentation (text + font colour).

const GEAR_COMPARISON_SCRIPT := "res://scenes/ui/gear_comparison.gd"
const GEAR_COMPARISON_SCENE := "res://scenes/ui/gear_comparison.tscn"
const RESULT_LABEL_PATH := "SafeAreaContainer/VBoxContainer/ResultLabel"
const DIFFERENCE_ROWS_PATH := "SafeAreaContainer/VBoxContainer/DifferenceRows"

## The headline the screen shows for each comparison outcome.
const HEADLINE_LEFT_BETTER := "Left gear is better"
const HEADLINE_RIGHT_BETTER := "Right gear is better"
const HEADLINE_EQUAL := "Both gear are equal"

## The header above the stat differences.
const DIFFERENCES_HEADER := "Stat Differences:"

## BBCode delimiters that must never reach a rendered label.
const BBCODE_COLOR_OPEN := "[color"
const BBCODE_COLOR_CLOSE := "[/color]"


func before_all() -> void:
	for path in [GEAR_COMPARISON_SCRIPT, GEAR_COMPARISON_SCENE]:
		if not ResourceLoader.exists(path):
			pending("[#1836] Required asset missing at %s — skipping suite." % path)


# ---------------------------------------------------------------------------
# Layer 1: static — no BBCode markup in the script.
# ---------------------------------------------------------------------------


func test_script_contains_no_bbcode_colour_markup() -> void:
	## The regression: the result text was assembled from BBCode tags.
	var text: String = _read_text(GEAR_COMPARISON_SCRIPT)
	assert_false(text.is_empty(), "Could not read %s" % GEAR_COMPARISON_SCRIPT)
	assert_false(
		text.contains(BBCODE_COLOR_OPEN),
		"%s must not build BBCode colour markup (issue #1836)." % GEAR_COMPARISON_SCRIPT
	)
	assert_false(
		text.contains(BBCODE_COLOR_CLOSE),
		"%s must not build BBCode colour markup (issue #1836)." % GEAR_COMPARISON_SCRIPT
	)
	assert_false(
		text.contains("[color="),
		"%s must not build BBCode colour markup (issue #1836)." % GEAR_COMPARISON_SCRIPT
	)


func test_script_colours_the_result_with_font_colour_overrides() -> void:
	## The colours must be applied through the theme, not through markup.
	var text: String = _read_text(GEAR_COMPARISON_SCRIPT)
	assert_true(
		text.contains("add_theme_color_override(\"font_color\""),
		"%s must colour the result through font colour overrides (issue #1836)." % GEAR_COMPARISON_SCRIPT
	)


# ---------------------------------------------------------------------------
# Layer 2: runtime — the rendered result.
# ---------------------------------------------------------------------------


func test_left_better_headline_is_plain_text() -> void:
	var panel: Node = _make_panel()
	if panel == null:
		return
	await get_tree().process_frame

	panel.call("set_gear_comparison", _gear_left(), _gear_right(), _comparison_left_better())

	var result_label: Label = panel.get_node(RESULT_LABEL_PATH) as Label
	assert_eq(
		result_label.text,
		HEADLINE_LEFT_BETTER,
		"The left-better headline must read '%s' (issue #1836)." % HEADLINE_LEFT_BETTER
	)
	assert_false(
		result_label.text.contains(BBCODE_COLOR_OPEN),
		"The headline must not contain BBCode markup (issue #1836): '%s'" % result_label.text
	)
	assert_eq(
		result_label.get_theme_color("font_color"),
		_success_color(),
		"The left-better headline must be success green (issue #1836)."
	)
	assert_eq(
		result_label.modulate,
		Color.WHITE,
		"The headline must not be tinted by a modulate (issue #1836)."
	)


func test_right_better_headline_is_plain_text() -> void:
	var panel: Node = _make_panel()
	if panel == null:
		return
	await get_tree().process_frame

	panel.call("set_gear_comparison", _gear_left(), _gear_right(), _comparison_right_better())

	var result_label: Label = panel.get_node(RESULT_LABEL_PATH) as Label
	assert_eq(
		result_label.text,
		HEADLINE_RIGHT_BETTER,
		"The right-better headline must read '%s' (issue #1836)." % HEADLINE_RIGHT_BETTER
	)
	assert_false(
		result_label.text.contains(BBCODE_COLOR_OPEN),
		"The headline must not contain BBCode markup (issue #1836): '%s'" % result_label.text
	)
	assert_eq(
		result_label.get_theme_color("font_color"),
		_success_color(),
		"The right-better headline keeps the success green of the old markup (issue #1836)."
	)


func test_equal_headline_is_plain_text() -> void:
	var panel: Node = _make_panel()
	if panel == null:
		return
	await get_tree().process_frame

	panel.call("set_gear_comparison", _gear_left(), _gear_right(), _comparison_equal())

	var result_label: Label = panel.get_node(RESULT_LABEL_PATH) as Label
	assert_eq(
		result_label.text,
		HEADLINE_EQUAL,
		"The equal headline must read '%s' (issue #1836)." % HEADLINE_EQUAL
	)
	assert_false(
		result_label.text.contains(BBCODE_COLOR_OPEN),
		"The headline must not contain BBCode markup (issue #1836): '%s'" % result_label.text
	)
	assert_eq(
		result_label.get_theme_color("font_color"),
		_warning_color(),
		"The equal headline must be warning yellow (issue #1836)."
	)


func test_difference_rows_render_without_markup() -> void:
	var panel: Node = _make_panel()
	if panel == null:
		return
	await get_tree().process_frame

	panel.call("set_gear_comparison", _gear_left(), _gear_right(), _comparison_left_better())

	var rows: VBoxContainer = panel.get_node_or_null(DIFFERENCE_ROWS_PATH) as VBoxContainer
	assert_not_null(rows, "The stat differences must be rendered as rows (issue #1836).")
	if rows == null:
		return

	var heading: Label = rows.get_child(0) as Label
	assert_eq(
		heading.text,
		DIFFERENCES_HEADER,
		"The differences header must read '%s' (issue #1836)." % DIFFERENCES_HEADER
	)
	assert_eq(
		heading.get_theme_color("font_color"),
		Color.WHITE,
		"The differences header must be white, like the old markup (issue #1836)."
	)

	var row_texts: Array = _row_texts(rows)
	assert_eq(
		row_texts.size(),
		2,
		"Both stat differences must be rendered (issue #1836)."
	)
	if row_texts.size() >= 1:
		assert_eq(
			row_texts[0],
			"attack: 10 vs 8 (+2)",
			"The first difference row must read 'attack: 10 vs 8 (+2)' (issue #1836)."
		)
	if row_texts.size() >= 2:
		assert_eq(
			row_texts[1],
			"speed: 5 vs 5",
			"The equal difference row must read 'speed: 5 vs 5' (issue #1836)."
		)

	for text in row_texts:
		var row_text: String = text
		assert_false(
			row_text.contains(BBCODE_COLOR_OPEN),
			"A difference row must not contain BBCode markup (issue #1836): '%s'" % row_text
		)
		assert_false(
			row_text.contains(BBCODE_COLOR_CLOSE),
			"A difference row must not contain BBCode markup (issue #1836): '%s'" % row_text
		)


func test_difference_rows_colour_the_winning_side() -> void:
	## The green/red meaning of the old markup is kept: the difference value is
	## green when the left gear wins the stat and red when the right gear does.
	var panel: Node = _make_panel()
	if panel == null:
		return
	await get_tree().process_frame

	panel.call(
		"set_gear_comparison",
		_gear_left(),
		_gear_right(),
		_comparison_mixed_differences()
	)

	var rows: VBoxContainer = panel.get_node_or_null(DIFFERENCE_ROWS_PATH) as VBoxContainer
	assert_not_null(rows, "The stat differences must be rendered as rows (issue #1836).")
	if rows == null:
		return

	var left_row: HBoxContainer = rows.get_child(1) as HBoxContainer
	var right_row: HBoxContainer = rows.get_child(2) as HBoxContainer
	assert_not_null(left_row, "The first difference row must exist (issue #1836).")
	assert_not_null(right_row, "The second difference row must exist (issue #1836).")
	if left_row == null or right_row == null:
		return

	var left_delta: Label = _delta_label(left_row)
	var right_delta: Label = _delta_label(right_row)

	assert_not_null(left_delta, "The left-winning difference must show a delta (issue #1836).")
	assert_not_null(right_delta, "The right-winning difference must show a delta (issue #1836).")
	if left_delta == null or right_delta == null:
		return

	assert_eq(left_delta.text, " (+2)", "The left-winning delta must read ' (+2)' (issue #1836).")
	assert_eq(right_delta.text, " (-3)", "The right-winning delta must read ' (-3)' (issue #1836).")
	assert_eq(
		left_delta.get_theme_color("font_color"),
		_success_color(),
		"The left-winning delta must be success green (issue #1836)."
	)
	assert_eq(
		right_delta.get_theme_color("font_color"),
		_error_color(),
		"The right-winning delta must be error red (issue #1836)."
	)


func test_no_rendered_label_contains_bbcode_markup() -> void:
	## Belt and braces: no label anywhere in the comparison screen may carry
	## BBCode markup.
	var panel: Node = _make_panel()
	if panel == null:
		return
	await get_tree().process_frame

	panel.call("set_gear_comparison", _gear_left(), _gear_right(), _comparison_mixed_differences())

	for label in _all_labels(panel):
		var label_text: String = (label as Label).text
		assert_false(
			label_text.contains(BBCODE_COLOR_OPEN),
			"A rendered label must not contain BBCode markup (issue #1836): '%s'" % label_text
		)
		assert_false(
			label_text.contains(BBCODE_COLOR_CLOSE),
			"A rendered label must not contain BBCode markup (issue #1836): '%s'" % label_text
		)


func test_repeated_comparison_replaces_the_previous_rows() -> void:
	## A second comparison must not stack the previous difference rows.
	var panel: Node = _make_panel()
	if panel == null:
		return
	await get_tree().process_frame

	panel.call("set_gear_comparison", _gear_left(), _gear_right(), _comparison_mixed_differences())
	panel.call("set_gear_comparison", _gear_left(), _gear_right(), _comparison_equal())

	var rows: VBoxContainer = panel.get_node_or_null(DIFFERENCE_ROWS_PATH) as VBoxContainer
	assert_not_null(rows, "The stat differences must be rendered as rows (issue #1836).")
	if rows == null:
		return
	assert_eq(
		rows.get_child_count(),
		2,
		"Only the header and one difference row may remain (issue #1836)."
	)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


func _make_panel() -> Node:
	var packed: PackedScene = load(GEAR_COMPARISON_SCENE)
	assert_not_null(packed, "PackedScene must load at %s (issue #1836)." % GEAR_COMPARISON_SCENE)
	if packed == null:
		return null
	var instance: Node = packed.instantiate()
	assert_not_null(instance, "Scene must instantiate (issue #1836).")
	if instance == null:
		return null
	add_child_autofree(instance)
	return instance


func _read_text(path: String) -> String:
	var file: FileAccess = FileAccess.open(path, FileAccess.READ)
	if file == null:
		return ""
	var content: String = file.get_as_text()
	file.close()
	return content


func _all_labels(node: Node) -> Array:
	var labels: Array = []
	if node is Label:
		labels.append(node)
	for child in node.get_children():
		labels.append_array(_all_labels(child))
	return labels


## The visible text of every difference row (the row labels concatenated).
func _row_texts(rows: VBoxContainer) -> Array:
	var texts: Array = []
	for child in rows.get_children():
		if child is HBoxContainer:
			var row_text: String = ""
			for label in child.get_children():
				if label is Label:
					row_text += (label as Label).text
			texts.append(row_text)
	return texts


## The label that carries the coloured difference value of a row.
func _delta_label(row: HBoxContainer) -> Label:
	var labels: Array = []
	for child in row.get_children():
		if child is Label:
			labels.append(child)
	if labels.size() < 2:
		return null
	return labels[1] as Label


func _gear_left() -> Dictionary:
	return {
		"name": "Hunter Bow",
		"rarity": "rare",
		"stats": [{"name": "attack", "value": 10}, {"name": "speed", "value": 5}],
		"modifiers": [],
	}


func _gear_right() -> Dictionary:
	return {
		"name": "Scout Bow",
		"rarity": "common",
		"stats": [{"name": "attack", "value": 8}, {"name": "speed", "value": 5}],
		"modifiers": [],
	}


func _comparison_left_better() -> Dictionary:
	return {
		"better": "gear1",
		"differences": [
			{
				"stat": "attack",
				"gear1_value": 10,
				"gear2_value": 8,
				"difference": 2,
				"better": "gear1",
			},
			{
				"stat": "speed",
				"gear1_value": 5,
				"gear2_value": 5,
				"difference": 0,
				"better": "equal",
			},
		],
	}


func _comparison_right_better() -> Dictionary:
	return {
		"better": "gear2",
		"differences": [
			{
				"stat": "attack",
				"gear1_value": 8,
				"gear2_value": 10,
				"difference": -2,
				"better": "gear2",
			},
		],
	}


func _comparison_equal() -> Dictionary:
	return {
		"better": "equal",
		"differences": [
			{
				"stat": "attack",
				"gear1_value": 5,
				"gear2_value": 5,
				"difference": 0,
				"better": "equal",
			},
		],
	}


func _comparison_mixed_differences() -> Dictionary:
	return {
		"better": "gear1",
		"differences": [
			{
				"stat": "attack",
				"gear1_value": 10,
				"gear2_value": 8,
				"difference": 2,
				"better": "gear1",
			},
			{
				"stat": "speed",
				"gear1_value": 5,
				"gear2_value": 8,
				"difference": -3,
				"better": "gear2",
			},
		],
	}


## The colours the screen uses. They mirror the production fallbacks so the
## suite works with and without the DesignTokens autoload.
func _success_color() -> Color:
	if get_node_or_null("/root/ArcherDesignTokens") == null:
		return Color.GREEN
	return ArcherDesignTokens.COLOR_SUCCESS


func _error_color() -> Color:
	if get_node_or_null("/root/ArcherDesignTokens") == null:
		return Color.RED
	return ArcherDesignTokens.COLOR_ERROR


func _warning_color() -> Color:
	if get_node_or_null("/root/ArcherDesignTokens") == null:
		return Color.YELLOW
	return ArcherDesignTokens.COLOR_WARNING
