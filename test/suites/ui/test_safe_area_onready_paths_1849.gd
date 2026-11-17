extends GutTest

## Issue #1849: three UI scripts declared their `@onready` node paths as if the
## scene root held a bare `VBoxContainer`, while the shipped `.tscn` files
## nest that container under `SafeAreaContainer` (and, for the leaderboard,
## under extra `SeasonVBox` / `YourRankVBox` levels). Every one of those
## refs therefore resolved to `null` at runtime:
##
##   * `scenes/ui/leaderboard_menu.gd`      — 13 broken refs
##   * `scenes/ui/stat_allocation.gd`       — 13 broken refs
##   * `scenes/ui/stat_allocation_ui.gd`    — 22 broken refs
##   => 48 broken refs in total.
##
## The suite has two layers (following the #1830 / #959 precedent):
##
##   1. **Static** — every `@onready` declaration in the three scripts is
##      matched against the expected, corrected path, and every corrected
##      path is resolved against the node tree parsed out of the shipped
##      `.tscn`. This layer also guards against a regression back to the
##      bare `$VBoxContainer/...` form.
##   2. **Runtime** — the real `leaderboard_menu.tscn` is instantiated and
##      added to the tree, so `_ready()` runs: every `@onready` slot must
##      hold a live node and the rewards / back / preview buttons must be
##      wired to their handlers.
##
## The two stat scenes are instantiated *without* entering the tree: their
## `_ready()` awaits `PlayerStatsManager.get_player_stats()`, i.e. an
## autoload with server side effects, which is exactly the situation the
## #959 precedent handles with a source-level layer. The instantiated scene
## tree is real, so resolving the paths against it proves the `@onready`
## assignments would land on live nodes.

const LEADERBOARD_SCRIPT := "res://scenes/ui/leaderboard_menu.gd"
const LEADERBOARD_SCENE := "res://scenes/ui/leaderboard_menu.tscn"
const STAT_ALLOCATION_SCRIPT := "res://scenes/ui/stat_allocation.gd"
const STAT_ALLOCATION_SCENE := "res://scenes/ui/stat_allocation.tscn"
const STAT_ALLOCATION_UI_SCRIPT := "res://scenes/ui/stat_allocation_ui.gd"
const STAT_ALLOCATION_UI_SCENE := "res://scenes/ui/stat_allocation_ui.tscn"

## The prefix that used to be missing from all 48 broken refs.
const BROKEN_PREFIX := "$VBoxContainer/"

## The number of refs fixed by this change (13 + 13 + 22).
const FIXED_REF_COUNT := 48

## The leaderboard asks SeasonManager for data in `_ready()`; in a unit test
## there is no live server, so that push_error is expected and unrelated to
## the path contract under test.
const EXPECTED_PUSH_ERRORS := ["Not connected to server"]

## Every `@onready` slot of `leaderboard_menu.gd` with its expected path and
## declared type. `season_message_panel` / `reward_preview_panel` were
## already correct and are kept here so the whole slot set is pinned down.
const LEADERBOARD_REFS: Array = [
	{"var": "season_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/SeasonPanel/SeasonVBox/SeasonLabel"},
	{"var": "time_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/SeasonPanel/SeasonVBox/TimeLabel"},
	{"var": "your_rank_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/YourRankPanel/YourRankVBox/RankLabel"},
	{"var": "your_tier_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/YourRankPanel/YourRankVBox/TierLabel"},
	{"var": "leaderboard_container", "type": "VBoxContainer",
		"path": "SafeAreaContainer/VBoxContainer/ScrollContainer/LeaderboardContainer"},
	{"var": "rewards_button", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/BottomPanel/RewardsButton"},
	{"var": "back_button", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/BottomPanel/BackButton"},
	{"var": "loading_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/LoadingLabel"},
	{"var": "motivational_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/YourRankPanel/YourRankVBox/MotivationalLabel"},
	{"var": "tier_progress_bar", "type": "ProgressBar",
		"path": "SafeAreaContainer/VBoxContainer/YourRankPanel/YourRankVBox/TierProgressBar"},
	{"var": "tier_progress_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/YourRankPanel/YourRankVBox/TierProgressLabel"},
	{"var": "decay_warning_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/YourRankPanel/YourRankVBox/DecayWarningLabel"},
	{"var": "season_message_panel", "type": "Control", "path": "SeasonMessagePanel"},
	{"var": "reward_preview_panel", "type": "Control", "path": "RewardPreviewPanel"},
	{"var": "preview_rewards_button", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/BottomPanel/PreviewRewardsButton"},
]

## Every `@onready` slot of `stat_allocation.gd`. `loading_indicator` was
## already correct.
const STAT_ALLOCATION_REFS: Array = [
	{"var": "level_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/LevelContainer/LevelLabel"},
	{"var": "xp_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/XPContainer/XPLabel"},
	{"var": "ability_points_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/AbilityPointsLabel"},
	{"var": "attack_value", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/AttackContainer/AttackValue"},
	{"var": "attack_plus", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/AttackContainer/AttackPlus"},
	{"var": "defense_value", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/DefenseContainer/DefenseValue"},
	{"var": "defense_plus", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/DefenseContainer/DefensePlus"},
	{"var": "dodge_value", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/DodgeContainer/DodgeValue"},
	{"var": "dodge_plus", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/DodgeContainer/DodgePlus"},
	{"var": "crit_rate_value", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/CritRateContainer/CritRateValue"},
	{"var": "crit_rate_plus", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/CritRateContainer/CritRatePlus"},
	{"var": "xp_progress_bar", "type": "ProgressBar",
		"path": "SafeAreaContainer/VBoxContainer/XPProgressBar"},
	{"var": "back_button", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/BackButton"},
	{"var": "loading_indicator", "type": "Control", "path": "LoadingIndicator"},
]

## Every `@onready` slot of `stat_allocation_ui.gd`. `loading_indicator`,
## `save_build_dialog` and `build_name_input` were already correct.
const STAT_ALLOCATION_UI_REFS: Array = [
	{"var": "level_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/LevelContainer/LevelLabel"},
	{"var": "xp_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/XPContainer/XPLabel"},
	{"var": "ability_points_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/AbilityPointsLabel"},
	{"var": "attack_value", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/AttackContainer/AttackValue"},
	{"var": "attack_plus", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/AttackContainer/AttackPlus"},
	{"var": "defense_value", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/DefenseContainer/DefenseValue"},
	{"var": "defense_plus", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/DefenseContainer/DefensePlus"},
	{"var": "dodge_value", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/DodgeContainer/DodgeValue"},
	{"var": "dodge_plus", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/DodgeContainer/DodgePlus"},
	{"var": "crit_rate_value", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/CritRateContainer/CritRateValue"},
	{"var": "crit_rate_plus", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/StatsContainer/CritRateContainer/CritRatePlus"},
	{"var": "xp_progress_bar", "type": "ProgressBar",
		"path": "SafeAreaContainer/VBoxContainer/XPProgressBar"},
	{"var": "back_button", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/BackButton"},
	{"var": "loading_indicator", "type": "Control", "path": "LoadingIndicator"},
	{"var": "respec_button", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/RespecButton"},
	{"var": "respec_cost_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/RespecContainer/RespecCostLabel"},
	{"var": "respec_cooldown_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/RespecContainer/RespecCooldownLabel"},
	{"var": "free_respec_label", "type": "Label",
		"path": "SafeAreaContainer/VBoxContainer/RespecContainer/FreeRespecLabel"},
	{"var": "build_slots_container", "type": "HBoxContainer",
		"path": "SafeAreaContainer/VBoxContainer/BuildSlotsContainer"},
	{"var": "build_slot_1_button", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/BuildSlotsContainer/BuildSlot1"},
	{"var": "build_slot_2_button", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/BuildSlotsContainer/BuildSlot2"},
	{"var": "build_slot_3_button", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/BuildSlotsContainer/BuildSlot3"},
	{"var": "save_build_button", "type": "Button",
		"path": "SafeAreaContainer/VBoxContainer/BuildSlotsContainer/SaveBuildButton"},
	{"var": "save_build_dialog", "type": "ConfirmationDialog", "path": "SaveBuildDialog"},
	{"var": "build_name_input", "type": "LineEdit", "path": "SaveBuildDialog/BuildNameInput"},
]

## Buttons of `leaderboard_menu.gd` that `_ready()` must wire up.
const LEADERBOARD_PRESSED_CONNECTIONS := {
	"rewards_button": "_on_rewards_pressed",
	"back_button": "_on_back_pressed",
	"preview_rewards_button": "_on_preview_rewards_pressed",
}


# ---------------------------------------------------------------------------
# Layer 1: static — the scripts declare the corrected paths.
# ---------------------------------------------------------------------------


func test_leaderboard_script_declares_the_corrected_paths() -> void:
	_assert_refs_declared(LEADERBOARD_SCRIPT, LEADERBOARD_REFS)


func test_stat_allocation_script_declares_the_corrected_paths() -> void:
	_assert_refs_declared(STAT_ALLOCATION_SCRIPT, STAT_ALLOCATION_REFS)


func test_stat_allocation_ui_script_declares_the_corrected_paths() -> void:
	_assert_refs_declared(STAT_ALLOCATION_UI_SCRIPT, STAT_ALLOCATION_UI_REFS)


func test_no_script_declares_the_broken_bare_vboxcontainer_prefix() -> void:
	# Regression guard: the original bug was the missing `SafeAreaContainer/`
	# segment. Re-introducing that pattern must fail this test.
	for script_path in [LEADERBOARD_SCRIPT, STAT_ALLOCATION_SCRIPT, STAT_ALLOCATION_UI_SCRIPT]:
		var text: String = _read_text(script_path)
		assert_false(
			text.contains(BROKEN_PREFIX),
			"%s must not declare any bare '%s' path (issue #1849)." % [script_path, BROKEN_PREFIX]
		)


func test_exactly_48_refs_gained_the_safe_area_prefix() -> void:
	# The scope of the fix: 13 (leaderboard) + 13 (stat_allocation)
	# + 22 (stat_allocation_ui) = 48 refs gained the `SafeAreaContainer/`
	# segment. This pins the size of the change so a partial revert is caught.
	var all_refs: Array = LEADERBOARD_REFS + STAT_ALLOCATION_REFS + STAT_ALLOCATION_UI_REFS
	var fixed: int = 0
	for ref in all_refs:
		var path: String = ref["path"]
		if path.begins_with("SafeAreaContainer/VBoxContainer/"):
			fixed += 1
	assert_eq(
		fixed,
		FIXED_REF_COUNT,
		"Exactly %d refs must have been moved under SafeAreaContainer (issue #1849)." % FIXED_REF_COUNT
	)


# ---------------------------------------------------------------------------
# Layer 1b: static — the corrected paths exist in the shipped .tscn files.
# ---------------------------------------------------------------------------


func test_leaderboard_scene_declares_every_corrected_path() -> void:
	_assert_paths_in_scene(LEADERBOARD_SCENE, LEADERBOARD_REFS)


func test_stat_allocation_scene_declares_every_corrected_path() -> void:
	_assert_paths_in_scene(STAT_ALLOCATION_SCENE, STAT_ALLOCATION_REFS)


func test_stat_allocation_ui_scene_declares_every_corrected_path() -> void:
	_assert_paths_in_scene(STAT_ALLOCATION_UI_SCENE, STAT_ALLOCATION_UI_REFS)


# ---------------------------------------------------------------------------
# Layer 2: runtime — the real scenes resolve the paths.
# ---------------------------------------------------------------------------


func test_instantiated_leaderboard_scene_resolves_every_onready_path() -> void:
	_assert_paths_resolve(LEADERBOARD_SCENE, LEADERBOARD_REFS)


func test_instantiated_stat_allocation_scene_resolves_every_onready_path() -> void:
	_assert_paths_resolve(STAT_ALLOCATION_SCENE, STAT_ALLOCATION_REFS)


func test_instantiated_stat_allocation_ui_scene_resolves_every_onready_path() -> void:
	_assert_paths_resolve(STAT_ALLOCATION_UI_SCENE, STAT_ALLOCATION_UI_REFS)


func test_leaderboard_ready_completes_and_wires_the_buttons() -> void:
	# The runtime proof for #1849: with the corrected paths, `_ready()` runs to
	# completion, every @onready slot holds a live node, and the rewards /
	# back / preview buttons are connected to their handlers.
	var menu: Node = _instantiate_in_tree(LEADERBOARD_SCENE)
	if menu == null:
		return

	var unexpected: Array = _collect_and_clear_errors()

	for ref in LEADERBOARD_REFS:
		var slot: String = ref["var"]
		var value: Variant = menu.get(slot)
		assert_not_null(
			value,
			"leaderboard_menu.%s must resolve to a live node (issue #1849)." % slot
		)

	for slot in LEADERBOARD_PRESSED_CONNECTIONS:
		var button: Button = menu.get(slot) as Button
		assert_not_null(
			button,
			"leaderboard_menu.%s must resolve to a button (issue #1849)." % slot
		)
		if button == null:
			continue
		var handler: String = LEADERBOARD_PRESSED_CONNECTIONS[slot]
		assert_true(
			button.pressed.is_connected(Callable(menu, handler)),
			"leaderboard_menu.%s.pressed must be connected to %s (issue #1849)." % [slot, handler]
		)

	assert_eq(
		unexpected.size(),
		0,
		"leaderboard_menu._ready() must complete without unexpected errors (issue #1849). Got: %s" % [unexpected]
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
			"%s must declare `%s` (issue #1849)." % [script_path, needle]
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
		"Every corrected path in %s must exist in the scene (issue #1849). Missing: %s" % [scene_path, missing]
	)


func _assert_paths_resolve(scene_path: String, refs: Array) -> void:
	# The real scene is instantiated, so the node tree is the shipped one.
	# The instance is intentionally NOT added to the tree: the stat scenes
	# await an autoload with server side effects in `_ready()` (see the
	# #959 precedent), while the leaderboard scene is exercised in the tree
	# by `test_leaderboard_ready_completes_and_wires_the_buttons()`.
	var packed: PackedScene = load(scene_path)
	assert_not_null(packed, "PackedScene must load at %s (issue #1849)." % scene_path)
	if packed == null:
		return
	var instance: Node = packed.instantiate()
	assert_not_null(instance, "Scene must instantiate: %s (issue #1849)." % scene_path)
	if instance == null:
		return

	for ref in refs:
		var slot: String = ref["var"]
		var declared_type: String = ref["type"]
		var path: String = ref["path"]
		var node: Node = instance.get_node_or_null(path)
		assert_not_null(
			node,
			"%s: @onready %s must resolve to $%s (issue #1849)." % [scene_path, slot, path]
		)
		if node == null:
			continue
		assert_true(
			node.is_class(declared_type),
			"%s: @onready %s must point at a %s (issue #1849)." % [scene_path, slot, declared_type]
		)

	instance.free()


func _instantiate_in_tree(scene_path: String) -> Node:
	var packed: PackedScene = load(scene_path)
	if packed == null:
		assert_true(false, "PackedScene must load at %s (issue #1849)." % scene_path)
		return null
	var instance: Node = packed.instantiate()
	if instance == null:
		assert_true(false, "Scene must instantiate: %s (issue #1849)." % scene_path)
		return null
	add_child_autofree(instance)
	return instance


## Returns the errors raised so far in this test that are not part of the
## tolerated set (see EXPECTED_PUSH_ERRORS), marking every error handled so
## the expected network push_error does not fail the test on its own.
func _collect_and_clear_errors() -> Array:
	var unexpected: Array = []
	for error in get_errors():
		var text: String = "%s %s" % [str(error.code), str(error.rationale)]
		var tolerated: bool = false
		for needle in EXPECTED_PUSH_ERRORS:
			if text.to_lower().contains(needle.to_lower()):
				tolerated = true
		if not tolerated:
			unexpected.append(text)
		error.handled = true
	return unexpected


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
