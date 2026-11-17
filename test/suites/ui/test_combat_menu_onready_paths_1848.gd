extends GutTest

## Issue #1848: combat_menu.gd @onready node paths were stale.
##
## The scene `scenes/ui/combat_menu.tscn` wraps its whole UI in a
## `SafeAreaContainer` instance and nests the stats children under
## `StatsVBox` and the action children under `ActionVBox`. The health
## widgets were also renamed (`HealthBar` -> `MyHealthBar` /
## `OpponentHealthBar`, `HealthLabel` -> `MyHealthLabel` /
## `OpponentHealthLabel`).
##
## The script still used the pre-rename, pre-restructure paths
## (`$VBoxContainer/StatsPanel/MyStatsContainer/HealthBar`, ...), so
## every one of the 12 `@onready` refs resolved to `null` and the
## combat screen failed inside `_ready()` (the pressed/value_changed
## wiring dereferences those null refs).
##
## The suite is split into two layers (same split the repo already uses
## for issue #959, see test/suites/ui/test_issue_959_ui_onready_paths.gd):
##
##  * **Source level** — every `@onready` path literal in combat_menu.gd
##    is extracted and checked segment-by-segment against the real node
##    tree declared in combat_menu.tscn. No scene is instantiated, so the
##    check is independent of autoload side effects.
##  * **Runtime** — the real `combat_menu.tscn` is instantiated, `_ready()`
##    is allowed to run, and the 12 refs are asserted non-null together
##    with the three `_ready()` signal wirings
##    (`shoot_button.pressed`, `back_button.pressed`,
##    `angle_slider.value_changed`) each having at least one connection.

const SCENE_PATH := "res://scenes/ui/combat_menu.tscn"
const SCRIPT_PATH := "res://scenes/ui/combat_menu.gd"

## The 12 corrected @onready paths, keyed by the script slot name.
const EXPECTED_PATHS := {
	"my_health_bar": "$SafeAreaContainer/VBoxContainer/StatsPanel/StatsVBox/MyStatsContainer/MyHealthBar",
	"my_health_label": "$SafeAreaContainer/VBoxContainer/StatsPanel/StatsVBox/MyStatsContainer/MyHealthLabel",
	"opponent_health_bar": "$SafeAreaContainer/VBoxContainer/StatsPanel/StatsVBox/OpponentStatsContainer/OpponentHealthBar",
	"opponent_health_label": "$SafeAreaContainer/VBoxContainer/StatsPanel/StatsVBox/OpponentStatsContainer/OpponentHealthLabel",
	"turn_label": "$SafeAreaContainer/VBoxContainer/TurnPanel/TurnLabel",
	"combat_log": "$SafeAreaContainer/VBoxContainer/LogPanel/CombatLog",
	"shoot_button": "$SafeAreaContainer/VBoxContainer/ActionPanel/ActionVBox/ShootButton",
	"angle_slider": "$SafeAreaContainer/VBoxContainer/ActionPanel/ActionVBox/AngleSlider",
	"angle_value_label": "$SafeAreaContainer/VBoxContainer/ActionPanel/ActionVBox/AngleValueLabel",
	"back_button": "$SafeAreaContainer/VBoxContainer/BottomPanel/BackButton",
	"loading_label": "$SafeAreaContainer/VBoxContainer/LoadingLabel",
	"stats_panel": "$SafeAreaContainer/VBoxContainer/StatsPanel",
}

var _saved_encounter_data: Dictionary = {}


func before_all() -> void:
	for path: String in [SCENE_PATH, SCRIPT_PATH]:
		if not ResourceLoader.exists(path):
			pending("[#1848] Required asset missing at %s — skipping suite." % path)


func before_each() -> void:
	# combat_menu._ready() auto-initializes a PvE encounter when
	# GameManager.current_encounter_data is populated. Other suites may
	# leave encounter data behind, so pin it to an empty dict for the
	# duration of the runtime test and restore it afterwards.
	_saved_encounter_data = GameManager.current_encounter_data.duplicate()
	GameManager.current_encounter_data = {}


func after_each() -> void:
	GameManager.current_encounter_data = _saved_encounter_data


# ---------------------------------------------------------------------------
# 1. Source level — the 12 @onready paths must match the corrected ones.
# ---------------------------------------------------------------------------


func test_combat_menu_declares_the_twelve_expected_onready_paths() -> void:
	var script_text: String = _read_text(SCRIPT_PATH)
	if script_text.is_empty():
		return
	for slot: String in EXPECTED_PATHS.keys():
		var expected_path: String = EXPECTED_PATHS[slot]
		var needle: String = "@onready var %s" % slot
		assert_true(
			script_text.contains(needle),
			"combat_menu.gd must still declare `@onready var %s` (issue #1848)." % slot
		)
		assert_true(
			script_text.contains(expected_path),
			"combat_menu.gd must declare `%s = %s` (issue #1848)." % [slot, expected_path]
		)


func test_combat_menu_has_no_stale_pre_rename_paths() -> void:
	# Guard against the pre-#1848 shapes creeping back in:
	#  * paths without the `SafeAreaContainer/` prefix,
	#  * stats children without the `StatsVBox/` segment,
	#  * action children without the `ActionVBox/` segment,
	#  * the pre-rename `HealthBar` / `HealthLabel` node names.
	var script_text: String = _read_text(SCRIPT_PATH)
	if script_text.is_empty():
		return

	assert_false(
		script_text.contains("$VBoxContainer/"),
		"combat_menu.gd must not use `$VBoxContainer/...` paths — the UI lives " +
				"under `SafeAreaContainer/` (issue #1848)."
	)
	assert_false(
		script_text.contains("StatsPanel/MyStatsContainer/") or
				script_text.contains("StatsPanel/OpponentStatsContainer/"),
		"combat_menu.gd must include the `StatsVBox/` segment between `StatsPanel/` " +
				"and the stats containers (issue #1848)."
	)
	assert_false(
		script_text.contains("ActionPanel/ShootButton") or
				script_text.contains("ActionPanel/AngleSlider") or
				script_text.contains("ActionPanel/AngleValueLabel"),
		"combat_menu.gd must include the `ActionVBox/` segment between `ActionPanel/` " +
				"and the action widgets (issue #1848)."
	)
	assert_false(
		script_text.contains("/HealthBar") or script_text.contains("/HealthLabel"),
		"combat_menu.gd must use the renamed `MyHealthBar` / `MyHealthLabel` / " +
				"`OpponentHealthBar` / `OpponentHealthLabel` nodes (issue #1848)."
	)


func test_every_onready_path_resolves_in_the_scene_tree() -> void:
	# Static cross-check: parse the `[node name=... parent=...]`
	# declarations out of combat_menu.tscn and verify that every path
	# literal used by combat_menu.gd exists in that tree, segment by
	# segment. This is the check that would have caught issue #1848
	# before the scene was ever instantiated.
	var script_text: String = _read_text(SCRIPT_PATH)
	var tscn_text: String = _read_text(SCENE_PATH)
	if script_text.is_empty() or tscn_text.is_empty():
		return

	var tree: Dictionary = _parse_scene_tree(tscn_text)
	assert_false(
		tree.is_empty(),
		"combat_menu.tscn must expose a parsable node tree (issue #1848)."
	)

	for slot: String in EXPECTED_PATHS.keys():
		var path: String = EXPECTED_PATHS[slot]
		assert_true(
			_path_exists(tree, path),
			"combat_menu.gd path for `%s` (%s) must exist in combat_menu.tscn " % [slot, path] +
					"(issue #1848)."
		)


func test_scene_tree_contains_the_renamed_health_nodes() -> void:
	# Pin the renamed nodes themselves so a rename in the .tscn cannot
	# silently break the script again.
	var tscn_text: String = _read_text(SCENE_PATH)
	if tscn_text.is_empty():
		return
	for node_name: String in ["MyHealthBar", "MyHealthLabel", "OpponentHealthBar", "OpponentHealthLabel"]:
		assert_true(
			tscn_text.contains("[node name=\"%s\"" % node_name),
			"combat_menu.tscn must declare a node named '%s' (issue #1848)." % node_name
		)


# ---------------------------------------------------------------------------
# 2. Runtime — instantiate the real scene and check the refs + wirings.
# ---------------------------------------------------------------------------


func test_combat_menu_scene_resolves_all_twelve_onready_refs() -> void:
	var menu: Node = _instantiate_combat_menu()
	if menu == null:
		return

	for slot: String in EXPECTED_PATHS.keys():
		var value: Variant = menu.get(slot)
		assert_not_null(
			value,
			"combat_menu.%s must resolve to a non-null node after _ready() (issue #1848)." % slot
		)


func test_combat_menu_ready_wires_the_three_action_signals() -> void:
	var menu: Node = _instantiate_combat_menu()
	if menu == null:
		return

	var shoot_button: Button = menu.get("shoot_button") as Button
	var back_button: Button = menu.get("back_button") as Button
	var angle_slider: HSlider = menu.get("angle_slider") as HSlider

	assert_not_null(shoot_button, "combat_menu.shoot_button must be non-null (issue #1848).")
	assert_not_null(back_button, "combat_menu.back_button must be non-null (issue #1848).")
	assert_not_null(angle_slider, "combat_menu.angle_slider must be non-null (issue #1848).")

	if shoot_button:
		assert_true(
			shoot_button.pressed.get_connections().size() >= 1,
			"shoot_button.pressed must have at least one connection after _ready() (issue #1848)."
		)
	if back_button:
		assert_true(
			back_button.pressed.get_connections().size() >= 1,
			"back_button.pressed must have at least one connection after _ready() (issue #1848)."
		)
	if angle_slider:
		assert_true(
			angle_slider.value_changed.get_connections().size() >= 1,
			"angle_slider.value_changed must have at least one connection after _ready() (issue #1848)."
		)


func test_combat_menu_ready_completes_without_missing_node_errors() -> void:
	# The historical failure mode was a null dereference inside _ready()
	# ("Invalid call on a base object of type NilInstance") because the
	# @onready refs were null. Instantiating the scene and letting
	# _ready() run must not raise.
	var menu: Node = _instantiate_combat_menu()
	if menu == null:
		return
	assert_not_null(menu, "combat_menu.tscn must instantiate and reach _ready() (issue #1848).")
	assert_true(
		menu.is_inside_tree(),
		"combat_menu must be inside the tree so _ready() has run (issue #1848)."
	)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


func _read_text(path: String) -> String:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return ""
	var content: String = file.get_as_text()
	file.close()
	return content


## Builds a map of full node paths -> node name from a .tscn file text.
## The root node has no `parent=` attribute, so it is keyed as its own
## name ("CombatMenu") and children are keyed relative to it.
func _parse_scene_tree(tscn_text: String) -> Dictionary:
	var tree: Dictionary = {}
	for line in tscn_text.split("\n"):
		var trimmed := line.strip_edges()
		if not trimmed.begins_with("[node "):
			continue
		var name_value := _extract_quoted(trimmed, "name")
		if name_value.is_empty():
			continue
		var parent_value := _extract_quoted(trimmed, "parent")
		var full_path: String
		if parent_value.is_empty() or parent_value == ".":
			full_path = name_value
		else:
			full_path = parent_value + "/" + name_value
		tree[full_path] = name_value
	return tree


## Extracts the value of `key="value"` out of a `[node ...]` header line.
func _extract_quoted(line: String, key: String) -> String:
	var marker: String = key + "=\""
	var start := line.find(marker)
	if start == -1:
		return ""
	start += marker.length()
	var finish := line.find("\"", start)
	if finish == -1:
		return ""
	return line.substr(start, finish - start)


## True when every segment of a `$A/B/C` path exists in the parsed tree.
func _path_exists(tree: Dictionary, dollar_path: String) -> bool:
	var relative: String = dollar_path
	if relative.begins_with("$"):
		relative = relative.substr(1)
	if relative.is_empty():
		return false
	var segments: PackedStringArray = relative.split("/", false)
	var current: String = ""
	for index in range(segments.size()):
		var segment: String = segments[index]
		current = segment if index == 0 else current + "/" + segment
		if not tree.has(current):
			return false
	return true


func _instantiate_combat_menu() -> Node:
	var packed: PackedScene = load(SCENE_PATH)
	if packed == null:
		assert_true(false, "PackedScene must load at %s (issue #1848)." % SCENE_PATH)
		return null
	var instance: Node = packed.instantiate()
	if instance == null:
		assert_true(false, "combat_menu.tscn must instantiate (issue #1848).")
		return null
	# Adding to the tree runs `_ready()`, which is where the 12 refs and
	# the three signal wirings are resolved.
	add_child_autofree(instance)
	return instance
