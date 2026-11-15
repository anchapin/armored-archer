extends GutTest

## Issue #1851: `scenes/ui/loadout.gd::_update_stats_display()` created three
## plain `Label`s whose text carried BBCode markup:
##
##   * the section header ("[b]Total Stats (Base + Gear):[/b]"),
##   * the gear power line ("[b]Gear Power:[/b] " + a colour-tagged rating),
##   * the synergy header ("[b]Synergy Bonuses:[/b]").
##
## A plain `Label` does not parse BBCode, so the tags were painted literally
## on screen. The fix keeps the labels as plain text and uses the numeric
## power rating at this call site; `GearBalanceCalculator.format_power_rating()`
## itself is untouched because its other callers consume the markup.
##
## The suite drives the real `_update_stats_display()` with a local
## `GearManager` instance (seeded with a fixture gear piece, never added to
## the tree and never registered as an autoload) plus a stubbed balance
## calculator, so no global/autoload state is mutated. It asserts that no
## rendered label text contains BBCode delimiters and that the three labels
## read exactly as intended.

const LOADOUT_SCRIPT_PATH := "res://scenes/ui/loadout.gd"
const GEAR_MANAGER_SCRIPT_PATH := "res://autoloads/GearManager.gd"
const GEAR_BALANCE_CALCULATOR_PATH := "res://autoloads/GearBalanceCalculator.gd"

## Deterministic power rating returned by the stubbed balance calculator.
const STUB_POWER_RATING := 42

## Fixture gear piece equipped by the stubbed inventory.
const STUB_GEAR_ID := "gear_1"


## Stub of the balance calculator: returns a fixed power rating and a fixed
## synergy bonus, and mirrors the production `format_power_rating()` markup so
## the suite can prove the loadout screen no longer consumes it.
class StubBalanceCalculator extends Node:
	const POWER_RATING := 42

	func get_gear_power_rating(_gear_data: Dictionary) -> float:
		return float(POWER_RATING)

	func get_synergy_bonus(_gear_set_ids: Dictionary) -> Dictionary:
		return {"attack": 5.0}

	func format_power_rating(power_rating: float) -> String:
		return "[color=#FFFFFF]%d[/color]" % int(power_rating)


## Stub of the combined stats manager.
class StubCombinedStatsManager extends Node:
	func get_all_stats() -> Dictionary:
		return {
			"attack": 10,
			"defense": 5,
			"speed": 200,
			"health": 100,
			"dodge": 0,
			"crit_rate": 0,
		}


var _loadout: Control
var _stats_container: VBoxContainer
var _gear_manager: Node
var _balance_calculator: StubBalanceCalculator
var _combined_stats_manager: StubCombinedStatsManager


func before_each() -> void:
	## Builds a loadout screen instance that is NOT added to the tree (so the
	## unrelated `_ready()` wiring and the live autoloads stay out of the way)
	## and wires the fixture managers the stats display reads.
	_loadout = load(LOADOUT_SCRIPT_PATH).new()
	_stats_container = VBoxContainer.new()
	_loadout.add_child(_stats_container)

	# A real (but tree-less) GearManager instance keeps the property type of
	# `loadout.gd` intact; its inventory is seeded with the fixture gear.
	_gear_manager = load(GEAR_MANAGER_SCRIPT_PATH).new()
	_gear_manager.set("player_inventory", {"gear": [_fixture_gear()]})
	_gear_manager.set("equipped_gear", {"helm": STUB_GEAR_ID})

	_balance_calculator = StubBalanceCalculator.new()
	_combined_stats_manager = StubCombinedStatsManager.new()
	_gear_manager.set("gear_balance_calculator", _balance_calculator)

	_loadout.set("stats_container", _stats_container)
	_loadout.set("gear_manager", _gear_manager)
	_loadout.set("gear_balance_calculator", _balance_calculator)
	_loadout.set("combined_stats_manager", _combined_stats_manager)


func after_each() -> void:
	if _loadout != null:
		_loadout.free()
		_loadout = null
	_stats_container = null
	if _gear_manager != null:
		_gear_manager.free()
		_gear_manager = null
	if _balance_calculator != null:
		_balance_calculator.free()
		_balance_calculator = null
	if _combined_stats_manager != null:
		_combined_stats_manager.free()
		_combined_stats_manager = null


func _fixture_gear() -> Dictionary:
	return {
		"id": STUB_GEAR_ID,
		"base_gear_id": "set_1",
		"rarity": "legendary",
		"type": "helm",
		"stats": [{"stat": "defense", "value": 5}],
	}


func _read_text(path: String) -> String:
	var file := FileAccess.open(path, FileAccess.READ)
	assert_not_null(file, "Could not open %s" % path)
	if file == null:
		return ""
	var text := file.get_as_text()
	file.close()
	return text


func _label_texts(container: Node) -> Array:
	var texts: Array = []
	for child in container.get_children():
		if child is Label:
			texts.append((child as Label).text)
	return texts


func _find_label(container: Node, needle: String) -> Label:
	for child in container.get_children():
		if child is Label and (child as Label).text.strip_edges() == needle:
			return child as Label
	return null


func test_stats_labels_render_no_bbcode_literals() -> void:
	## The regression: plain Labels showed the BBCode tags verbatim.
	_loadout._update_stats_display()

	var texts: Array = _label_texts(_stats_container)
	assert_gt(texts.size(), 0, "The stats display must create labels (issue #1851).")
	for text in texts:
		var label_text: String = text
		var bold_tag: String = "[b]"
		var bold_close_tag: String = "[/b]"
		var colour_tag: String = "[color"
		var colour_close_tag: String = "[/color]"
		assert_false(label_text.contains(bold_tag), "Literal bold tag rendered (issue #1851): '%s'" % label_text)
		assert_false(label_text.contains(bold_close_tag), "Literal bold tag rendered (issue #1851): '%s'" % label_text)
		assert_false(label_text.contains(colour_tag), "Literal colour tag rendered (issue #1851): '%s'" % label_text)
		assert_false(label_text.contains(colour_close_tag), "Literal colour tag rendered (issue #1851): '%s'" % label_text)


func test_header_label_reads_total_stats() -> void:
	_loadout._update_stats_display()

	var header := _find_label(_stats_container, "Total Stats (Base + Gear):")
	assert_not_null(header, "The stats header must read 'Total Stats (Base + Gear):' (issue #1851).")


func test_power_label_reads_gear_power_number() -> void:
	_loadout._update_stats_display()

	var power := _find_label(_stats_container, "Gear Power: %d" % STUB_POWER_RATING)
	assert_not_null(
		power,
		"The gear power line must read 'Gear Power: %d' (issue #1851)." % STUB_POWER_RATING
	)


func test_synergy_label_reads_synergy_bonuses() -> void:
	_loadout._update_stats_display()

	var synergy := _find_label(_stats_container, "Synergy Bonuses:")
	assert_not_null(synergy, "The synergy header must read 'Synergy Bonuses:' (issue #1851).")


func test_loadout_source_contains_no_bbcode_markup() -> void:
	## Static guard: the loadout screen must not hand BBCode to plain Labels.
	var text := _read_text(LOADOUT_SCRIPT_PATH)
	assert_false(text.contains("[b]"), "loadout.gd must not contain BBCode bold markup (issue #1851).")
	assert_false(text.contains("[/b]"), "loadout.gd must not contain BBCode bold markup (issue #1851).")
	assert_false(text.contains("[color="), "loadout.gd must not contain BBCode colour markup (issue #1851).")
	assert_false(text.contains("[/color]"), "loadout.gd must not contain BBCode colour markup (issue #1851).")


func test_loadout_does_not_consume_format_power_rating() -> void:
	## This call site must use the numeric rating; the formatter itself stays
	## untouched for its other callers.
	var text := _read_text(LOADOUT_SCRIPT_PATH)
	assert_false(
		_references_power_rating_formatter(text),
		"loadout.gd must not feed the colour-tagged formatter output into a plain Label (issue #1851)."
	)


func test_format_power_rating_still_returns_markup_for_other_callers() -> void:
	## `GearManager.get_gear_stats_summary()` consumes the markup version.
	var calculator := get_node_or_null("/root/GearBalanceCalculator")
	if calculator == null:
		pending("GearBalanceCalculator autoload not available — skipping issue #1851 formatter check.")
		return

	var formatted: String = calculator.format_power_rating(10.0)
	assert_eq(
		formatted,
		"[color=#FFFFFF]10[/color]",
		"format_power_rating() must keep returning colour markup for its other callers (issue #1851)."
	)


func test_gear_balance_calculator_source_still_uses_markup() -> void:
	var text := _read_text(GEAR_BALANCE_CALCULATOR_PATH)
	assert_true(
		text.contains("[color=%s]%d[/color]"),
		"format_power_rating() must keep returning colour markup for its other callers (issue #1851)."
	)

func _references_power_rating_formatter(source: String) -> bool:
	# Ignore full-line documentation comments, but preserve the broad guard
	# against formatter references in every executable line.
	for line in source.split("\n"):
		if line.strip_edges().begins_with("#"):
			continue
		if line.contains("format_power_rating"):
			return true
	return false

func test_power_rating_guard_distinguishes_comments_and_references() -> void:
	assert_false(_references_power_rating_formatter("# format_power_rating() returns BBCode"))
	assert_true(_references_power_rating_formatter("label.text = calculator.format_power_rating(data)"))
	assert_true(_references_power_rating_formatter("label.text = calculator.format_power_rating (data)"))
	assert_true(_references_power_rating_formatter("var formatter = calculator.format_power_rating"))
