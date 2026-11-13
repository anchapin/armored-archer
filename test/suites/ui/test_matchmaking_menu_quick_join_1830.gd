extends GutTest

## Issue #1830: the matchmaking menu's QuickJoinButton scene/script contract.
##
## `scenes/ui/matchmaking_menu.gd` declared
## `@onready var quick_join_button ... = $SafeAreaContainer/VBoxContainer/CreatePanel/QuickJoinButton`
## but `scenes/ui/matchmaking_menu.tscn` contained no `QuickJoinButton` node at
## all, so the onready fetch failed and `_ready()` aborted part-way through
## (everything initialised after `quick_join_button.pressed.connect(...)` was
## never reached).
##
## Evidence (git history of both files):
##   * `git log -S"QuickJoinButton" --all -- scenes/` returns exactly one
##     commit (7f88b701) and it only touches the **script** — the .tscn never
##     declared the node.
##   * The quick-join feature itself is intact and unreachable-from-the-menu:
##     `_on_quick_join_pressed()` exists, `MatchmakingPoolManager` is a live
##     autoload, `scenes/pvp/matchmaking_queue.tscn` exists and is referenced
##     from nowhere else in the project.
##   => The scene side was the defect; the node was restored next to its
##      siblings (`CreateVBox/CreateRankedButton`, `CreateVBox/CreateCasualButton`)
##      and the script path was corrected to the sibling layout.
##
## The suite has two layers:
##   1. **Static** — every `@onready` path declared in matchmaking_menu.gd is
##      resolved against the node tree parsed out of matchmaking_menu.tscn.
##   2. **Runtime** — the real scene is instantiated, every `@onready` slot is
##      checked for a live node, the expected `pressed` connections are
##      verified, and `_ready()` is asserted to complete without unexpected
##      errors.

const SCENE_PATH := "res://scenes/ui/matchmaking_menu.tscn"
const SCRIPT_PATH := "res://scenes/ui/matchmaking_menu.gd"
const BASE_BUTTON_SCRIPT := "res://scenes/ui/components/base_button.gd"

## The menu asks the MatchmakerManager for the match list from `_ready()`.
## In a unit test there is no live server, so that single push_error is
## expected and unrelated to the #1830 contract.
const EXPECTED_PUSH_ERRORS := ["Not connected to server"]

## Buttons whose `pressed` signal must be wired by `_ready()`.
const EXPECTED_PRESSED_CONNECTIONS := {
	"list_button": "_on_list_pressed",
	"create_ranked_button": "_on_create_ranked_pressed",
	"create_casual_button": "_on_create_casual_pressed",
	"quick_join_button": "_on_quick_join_pressed",
	"leaderboard_button": "_on_leaderboard_pressed",
	"back_button": "_on_back_pressed",
}

## Errors raised by the last `_instantiate_menu()` call that are not part of
## the tolerated set (see EXPECTED_PUSH_ERRORS).
var _unexpected_errors: Array = []


# ---------------------------------------------------------------------------
# Layer 1: static contract between the script and the scene.
# ---------------------------------------------------------------------------


func test_every_onready_path_resolves_to_a_node_in_the_scene() -> void:
	var script_text := _read_text(SCRIPT_PATH)
	var scene_text := _read_text(SCENE_PATH)
	assert_false(script_text.is_empty(), "Could not read %s" % SCRIPT_PATH)
	assert_false(scene_text.is_empty(), "Could not read %s" % SCENE_PATH)
	if script_text.is_empty() or scene_text.is_empty():
		return

	var scene_paths := _scene_node_paths(scene_text)
	var slots := _onready_slots(script_text)
	assert_gt(slots.size(), 0,
			"matchmaking_menu.gd must declare @onready slots (issue #1830).")
	var missing: Array = []
	for slot in slots:
		var node_path: String = slots[slot]
		if not scene_paths.has(node_path):
			missing.append("%s -> %s" % [slot, node_path])

	assert_eq(
		missing.size(),
		0,
		"Every @onready path in matchmaking_menu.gd must exist in " +
				"matchmaking_menu.tscn (issue #1830). Missing: %s" % [missing]
	)


func test_quick_join_button_is_declared_next_to_the_sibling_buttons() -> void:
	var scene_text := _read_text(SCENE_PATH)
	var script_text := _read_text(SCRIPT_PATH)
	if scene_text.is_empty() or script_text.is_empty():
		return

	assert_true(
		scene_text.contains("[node name=\"QuickJoinButton\" type=\"Button\" parent=\"SafeAreaContainer/VBoxContainer/CreatePanel/CreateVBox\""),
		"matchmaking_menu.tscn must declare a QuickJoinButton under " +
				"CreatePanel/CreateVBox, alongside CreateRankedButton/CreateCasualButton (issue #1830)."
	)
	assert_true(
		script_text.contains(
				"$SafeAreaContainer/VBoxContainer/CreatePanel/CreateVBox/QuickJoinButton"),
		"matchmaking_menu.gd must reference QuickJoinButton at the same path " +
				"the scene declares it (issue #1830)."
	)


func test_script_and_scene_agree_on_quick_join_button() -> void:
	# The grep-level contract of the issue: both sides must either reference
	# the same existing node, or neither may reference it at all.
	var script_text := _read_text(SCRIPT_PATH)
	var scene_text := _read_text(SCENE_PATH)
	if script_text.is_empty() or scene_text.is_empty():
		return

	var in_script := script_text.contains("QuickJoinButton")
	var in_scene := scene_text.contains("QuickJoinButton")
	assert_eq(in_script, in_scene,
			"QuickJoinButton must be referenced by the script and the scene " +
					"consistently (issue #1830). script=%s scene=%s" % [in_script, in_scene])


# ---------------------------------------------------------------------------
# Layer 2: runtime — the real scene loads and wires itself up.
# ---------------------------------------------------------------------------


func test_scene_loads_and_every_onready_slot_resolves() -> void:
	var menu := _instantiate_menu()
	if menu == null:
		return

	var unexpected := _unexpected_errors

	for slot in _onready_slots(_read_text(SCRIPT_PATH)):
		var value: Variant = menu.get(slot)
		assert_not_null(
			value,
			"matchmaking_menu.%s must resolve to a node (issue #1830)." % slot
		)

	assert_eq(
		unexpected.size(),
		0,
		"matchmaking_menu._ready() must complete without errors (issue #1830). Got: %s" % [unexpected]
	)


func test_quick_join_button_resolves_as_an_archery_base_button() -> void:
	var menu := _instantiate_menu()
	if menu == null:
		return

	var button: Button = menu.get("quick_join_button") as Button
	assert_not_null(button, "matchmaking_menu.quick_join_button must resolve (issue #1830).")
	if button == null:
		return

	var base_script: Script = load(BASE_BUTTON_SCRIPT)
	assert_true(
		is_instance_of(button, base_script),
		"matchmaking_menu.quick_join_button must be an ArcheryBaseButton, " +
				"like the sibling buttons (issue #1830)."
	)
	assert_eq(button.text, "Quick Join",
			"matchmaking_menu.quick_join_button must carry the Quick Join label (issue #1830).")


func test_expected_button_pressed_connections_are_in_place() -> void:
	var menu := _instantiate_menu()
	if menu == null:
		return

	var unexpected := _unexpected_errors

	for slot in EXPECTED_PRESSED_CONNECTIONS:
		var button: Button = menu.get(slot) as Button
		assert_not_null(
			button,
			"matchmaking_menu.%s must resolve to a button (issue #1830)." % slot
		)
		if button == null:
			continue
		var handler: String = EXPECTED_PRESSED_CONNECTIONS[slot]
		assert_true(
			button.pressed.is_connected(Callable(menu, handler)),
			"matchmaking_menu.%s.pressed must be connected to %s (issue #1830)." % [slot, handler]
		)

	assert_eq(
		unexpected.size(),
		0,
		"matchmaking_menu._ready() must complete without errors (issue #1830). Got: %s" % [unexpected]
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


## Maps `@onready var <slot>: <Type> = $<node path>` declarations to their
## node path, e.g. {"quick_join_button": "SafeAreaContainer/.../QuickJoinButton"}.
func _onready_slots(script_text: String) -> Dictionary:
	var slots := {}
	var regex := RegEx.new()
	regex.compile("@onready\\s+var\\s+(\\w+)\\s*:\\s*[\\w\\.]+\\s*=\\s*\\$([^\\s\\)]+)")
	for match_result in regex.search_all(script_text):
		slots[match_result.get_string(1)] = match_result.get_string(2)
	return slots


## Parses the `[node name="X" ... parent="Y"]` declarations of a .tscn into the
## set of node paths that exist relative to the scene root.
func _scene_node_paths(scene_text: String) -> Dictionary:
	var paths := {}
	var regex := RegEx.new()
	regex.compile("\\[node name=\"([^\"]+)\"[^\\]\\n]*parent=\"([^\"]*)\"")
	for match_result in regex.search_all(scene_text):
		var node_name: String = match_result.get_string(1)
		var parent: String = match_result.get_string(2)
		var full_path: String = node_name
		if parent == ".":
			full_path = node_name
		elif not parent.is_empty():
			full_path = parent + "/" + node_name
		paths[full_path] = true
	return paths


func _instantiate_menu() -> Node:
	var packed: PackedScene = load(SCENE_PATH)
	if packed == null:
		assert_true(false, "PackedScene must load at %s (issue #1830)." % SCENE_PATH)
		return null
	var instance: Node = packed.instantiate()
	if instance == null:
		assert_true(false, "Scene must instantiate: %s (issue #1830)." % SCENE_PATH)
		return null
	add_child_autofree(instance)
	# _ready() has run by now: collect (and tolerate) whatever it raised so
	# the unexpected ones can be asserted on explicitly.
	_unexpected_errors = _collect_and_clear_errors()
	return instance


## Returns the errors raised so far in this test, marking them handled so the
## unrelated, expected network push_error does not fail the test on its own.
func _collect_and_clear_errors() -> Array:
	var unexpected: Array = []
	for error in get_errors():
		var text: String = "%s %s" % [str(error.code), str(error.rationale)]
		var tolerated := false
		for needle in EXPECTED_PUSH_ERRORS:
			if text.to_lower().contains(needle.to_lower()):
				tolerated = true
		if not tolerated:
			unexpected.append(text)
		error.handled = true
	return unexpected
