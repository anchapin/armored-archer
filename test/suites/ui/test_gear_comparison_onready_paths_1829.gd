extends GutTest

## Issue #1829: `scenes/ui/gear_comparison.gd` declared its ten `@onready`
## node paths as if the scene root held a bare `VBoxContainer`, while the
## shipped `scenes/ui/gear_comparison.tscn` nests that container under
## `SafeAreaContainer`. All ten refs therefore resolved to `null` at runtime
## and `_ready()` died on `close_button.pressed.connect(...)` (line 44).
##
## The suite has two layers (following the #1849 / #959 precedent):
##
##   1. **Static** — every `@onready` declaration in the script is matched
##      against the expected, corrected path, every corrected path is
##      resolved against the node tree parsed out of the shipped `.tscn`,
##      and the old bare `$VBoxContainer/...` form is guarded against.
##   2. **Runtime** — the real `gear_comparison.tscn` is instantiated and
##      added to the tree so `_ready()` runs: every `@onready` slot must hold
##      a live node and `CloseButton.pressed` must be connected to
##      `_on_close_button_pressed`.
##
## This file covers the node-path contract only. Comparison logic, palette /
## theme, inventory and gameplay behaviour are deliberately out of scope
## (see issues #1836 and #1832).

const GEAR_COMPARISON_SCRIPT := "res://scenes/ui/gear_comparison.gd"
const GEAR_COMPARISON_SCENE := "res://scenes/ui/gear_comparison.tscn"

## The prefix that was missing from all ten broken refs.
const BROKEN_PREFIX := "$VBoxContainer/"

## The number of refs fixed by this change.
const FIXED_REF_COUNT := 10

## Every `@onready` slot of `gear_comparison.gd` with its expected path and
## declared type. All ten slots were broken by the missing `SafeAreaContainer/`
## segment; there are no already-correct slots in this script.
const GEAR_COMPARISON_REFS: Array = [
	{"var": "gear1_name", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/Container/Gear1Container/Gear1Name"},
	{"var": "gear1_rarity", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/Container/Gear1Container/Gear1Rarity"},
	{"var": "gear1_stats", "type": "VBoxContainer",
		"path": "SafeAreaContainer/VBoxContainer/Container/Gear1Container/Gear1Stats"},
	{"var": "gear1_modifiers", "type": "VBoxContainer",
		"path": "SafeAreaContainer/VBoxContainer/Container/Gear1Container/Gear1Modifiers"},
	{"var": "gear2_name", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/Container/Gear2Container/Gear2Name"},
	{"var": "gear2_rarity", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/Container/Gear2Container/Gear2Rarity"},
	{"var": "gear2_stats", "type": "VBoxContainer",
		"path": "SafeAreaContainer/VBoxContainer/Container/Gear2Container/Gear2Stats"},
	{"var": "gear2_modifiers", "type": "VBoxContainer",
		"path": "SafeAreaContainer/VBoxContainer/Container/Gear2Container/Gear2Modifiers"},
	{"var": "result_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/ResultLabel"},
	{"var": "close_button", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/CloseButton"},
]

## Buttons of `gear_comparison.gd` that `_ready()` must wire up.
const CLOSE_PRESSED_CONNECTION := {
	"close_button": "_on_close_button_pressed",
}


func before_all() -> void:
	for path in [GEAR_COMPARISON_SCRIPT, GEAR_COMPARISON_SCENE]:
		if not ResourceLoader.exists(path):
			pending("[#1829] Required asset missing at %s — skipping suite." % path)


# ---------------------------------------------------------------------------
# Layer 1: static — the script declares the corrected paths.
# ---------------------------------------------------------------------------


func test_script_declares_the_corrected_paths() -> void:
	_assert_refs_declared(GEAR_COMPARISON_SCRIPT, GEAR_COMPARISON_REFS)


func test_script_declares_no_bare_vboxcontainer_prefix() -> void:
	# Regression guard: the original bug was the missing `SafeAreaContainer/`
	# segment. Re-introducing that pattern must fail this test.
	var text: String = _read_text(GEAR_COMPARISON_SCRIPT)
	assert_false(
		text.contains(BROKEN_PREFIX),
		"%s must not declare any bare '%s' path (issue #1829)." % [GEAR_COMPARISON_SCRIPT, BROKEN_PREFIX]
	)


func test_exactly_ten_refs_gained_the_safe_area_prefix() -> void:
	# The scope of the fix: all ten `@onready` refs of this script gained the
	# `SafeAreaContainer/` segment. This pins the size of the change so a
	# partial revert is caught.
	var fixed: int = 0
	for ref in GEAR_COMPARISON_REFS:
		var path: String = ref["path"]
		if path.begins_with("SafeAreaContainer/VBoxContainer/"):
			fixed += 1
	assert_eq(
		fixed,
		FIXED_REF_COUNT,
		"Exactly %d refs must live under SafeAreaContainer (issue #1829)." % FIXED_REF_COUNT
	)


func test_script_has_exactly_ten_onready_declarations() -> void:
	# The script has no other `@onready` slots; this guards against a new
	# ref sneaking in with an unverified path.
	var text: String = _read_text(GEAR_COMPARISON_SCRIPT)
	var count: int = text.count("@onready var ")
	assert_eq(
		count,
		FIXED_REF_COUNT,
		"gear_comparison.gd must declare exactly %d @onready refs (issue #1829)." % FIXED_REF_COUNT
	)


# ---------------------------------------------------------------------------
# Layer 1b: static — the corrected paths exist in the shipped .tscn.
# ---------------------------------------------------------------------------


func test_scene_declares_every_corrected_path() -> void:
	_assert_paths_in_scene(GEAR_COMPARISON_SCENE, GEAR_COMPARISON_REFS)


# ---------------------------------------------------------------------------
# Layer 2: runtime — the real scene resolves the paths.
# ---------------------------------------------------------------------------


func test_instantiated_scene_resolves_every_onready_path() -> void:
	_assert_paths_resolve(GEAR_COMPARISON_SCENE, GEAR_COMPARISON_REFS)


func test_ready_completes_and_wires_the_close_button() -> void:
	# The runtime proof for #1829: with the corrected paths, `_ready()` runs
	# to completion, every `@onready` slot holds a live node and the Close
	# button is connected to its handler.
	var panel: Node = _instantiate_in_tree(GEAR_COMPARISON_SCENE)
	if panel == null:
		return

	# Any engine error raised while the scene entered the tree is inspected
	# below; unrelated autoload noise is tolerated so the assertions stay
	# meaningful.
	var missing_node_errors: Array = _collect_missing_node_errors()

	assert_eq(
		missing_node_errors.size(),
		0,
		"gear_comparison._ready() must not raise missing-node errors (issue #1829). Got: %s" % [missing_node_errors]
	)

	for ref in GEAR_COMPARISON_REFS:
		var slot: String = ref["var"]
		assert_not_null(
			panel.get(slot),
			"gear_comparison.%s must resolve to a live node (issue #1829)." % slot
		)

	for slot in CLOSE_PRESSED_CONNECTION:
		var button: Button = panel.get(slot) as Button
		assert_not_null(
			button,
			"gear_comparison.%s must resolve to a button (issue #1829)." % slot
		)
		if button == null:
			continue
		var handler: String = CLOSE_PRESSED_CONNECTION[slot]
		assert_true(
			button.pressed.is_connected(Callable(panel, handler)),
			"gear_comparison.%s.pressed must be connected to %s (issue #1829)." % [slot, handler]
		)


func test_ready_raises_no_missing_node_errors() -> void:
	# On the old paths `_ready()` errored with "Node not found" for each of
	# the ten refs. Any such error must be gone now.
	var panel: Node = _instantiate_in_tree(GEAR_COMPARISON_SCENE)
	if panel == null:
		return

	var missing_node_errors: Array = _collect_missing_node_errors()

	assert_eq(
		missing_node_errors.size(),
		0,
		"gear_comparison._ready() must not raise missing-node errors (issue #1829). Got: %s" % [missing_node_errors]
	)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


func _error_text(error) -> String:
	# GUT hands back GutTrackedError objects with `code` / `rationale` / `file`.
	return "%s %s %s" % [str(error.code), str(error.rationale), str(error.file)]


## Returns the "Node not found" errors raised by the script under test since
## the last check, marking every error handled so unrelated autoload noise
## does not fail the test on its own.
func _collect_missing_node_errors() -> Array:
	var missing_node_errors: Array = []
	for error in get_errors():
		var text: String = _error_text(error)
		var lowered: String = text.to_lower()
		# The old failure mode: "Node not found: "VBoxContainer/..."" raised
		# while the @onready slots were assigned.
		if lowered.contains("node not found") and (
				lowered.contains("vboxcontainer") or lowered.contains("gear_comparison")):
			missing_node_errors.append(text)
		error.handled = true
	return missing_node_errors

func _read_text(path: String) -> String:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return ""
	var content: String = file.get_as_text()
	file.close()
	return content


func _assert_refs_declared(script_path: String, refs: Array) -> void:
	var text: String = _read_text(script_path)
	assert_false(text.is_empty(), "Could not read %s" % script_path)
	if text.is_empty():
		return
	for ref in refs:
		var slot: String = ref["var"]
		var declared_type: String = ref["type"]
		var path: String = ref["path"]
		var needle: String = "@onready var %s: %s = $%s" % [slot, declared_type, path]
		assert_true(
			text.contains(needle),
			"%s must declare `%s` (issue #1829)." % [script_path, needle]
		)


func _assert_paths_in_scene(scene_path: String, refs: Array) -> void:
	var scene_text: String = _read_text(scene_path)
	assert_false(scene_text.is_empty(), "Could not read %s" % scene_path)
	if scene_text.is_empty():
		return
	var node_paths: Dictionary = _scene_node_paths(scene_text)
	var missing: Array = []
	for ref in refs:
		var path: String = ref["path"]
		if not node_paths.has(path):
			missing.append(path)
	assert_eq(
		missing.size(),
		0,
		"Every corrected path in %s must exist in the scene (issue #1829). Missing: %s" % [scene_path, missing]
	)


func _assert_paths_resolve(scene_path: String, refs: Array) -> void:
	# The real scene is instantiated, so the node tree is the shipped one.
	var packed: PackedScene = load(scene_path)
	assert_not_null(packed, "PackedScene must load at %s (issue #1829)." % scene_path)
	if packed == null:
		return
	var instance: Node = packed.instantiate()
	assert_not_null(instance, "Scene must instantiate: %s (issue #1829)." % scene_path)
	if instance == null:
		return

	for ref in refs:
		var slot: String = ref["var"]
		var declared_type: String = ref["type"]
		var path: String = ref["path"]
		var node: Node = instance.get_node_or_null(path)
		assert_not_null(
			node,
			"%s: @onready %s must resolve to $%s (issue #1829)." % [scene_path, slot, path]
		)
		if node == null:
			continue
		assert_true(
			node.is_class(declared_type),
			"%s: @onready %s must point at a %s (issue #1829)." % [scene_path, slot, declared_type]
		)

	instance.free()


func _instantiate_in_tree(scene_path: String) -> Node:
	var packed: PackedScene = load(scene_path)
	if packed == null:
		assert_true(false, "PackedScene must load at %s (issue #1829)." % scene_path)
		return null
	var instance: Node = packed.instantiate()
	if instance == null:
		assert_true(false, "Scene must instantiate: %s (issue #1829)." % scene_path)
		return null
	add_child_autofree(instance)
	return instance


## Parses the `[node name="X" ... parent="Y"]` declarations of a .tscn into
## the set of node paths that exist relative to the scene root.
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
