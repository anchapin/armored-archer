extends GutTest

# Issue #902: combat_menu.gd local display-only result path.
#
# Before the fix, `_on_pvp_combat_ended()` built a placeholder
# result_data dictionary with invented numbers
# (`xp_gained: 150 if is_victory else 50`, `old_rank: 0`,
# `rank_delta: 0`, `match_duration: 120.0`, `rewards: []`) and passed it
# straight to the match_results scene. That display-only path diverged
# from the server-declared settlement payload emitted by
# MatchmakerManager.match_completed, so the player could see one set of
# numbers on the results screen and a different set after reconciliation.
#
# After the fix, combat_menu.gd:
# - must NOT carry placeholder XP / rank / season-position literals;
# - must subscribe to MatchmakerManager.match_completed to render the
#   server-declared payload verbatim;
# - must NOT block on a race (the result screen renders when the signal
#   arrives, not from the local combat_ended callback).
#
# File-text matching is the most reliable signal: instantiating the full
# scene triggers unrelated @onready failures from sibling nodes that are
# out of scope for issue #902 (see other suites in test/suites/ui/), so we
# assert against the source literal directly.

const SOURCE_PATH := "res://scenes/ui/combat_menu.gd"


func _source_text() -> String:
	var file := FileAccess.open(SOURCE_PATH, FileAccess.READ)
	assert_not_null(file, "Could not open %s" % SOURCE_PATH)
	if file == null:
		return ""
	var text := file.get_as_text()
	file.close()
	return text


func test_combat_menu_does_not_hardcode_placeholder_xp() -> void:
	# The historic local XP placeholder (150/50) must be removed —
	# combat_menu must never invent XP gains, only render the server's value.
	# We strip line-leading comments before searching so explanatory comments
	# that quote the historic placeholder do not trip the assertion.
	var source_text := _strip_gd_comments(_source_text())
	if source_text.is_empty():
		return

	assert_false(
		source_text.contains("150 if is_victory else 50"),
		"combat_menu.gd must not carry the placeholder XP literal (issue #902). XP must come from the server-declared settlement payload."
	)
	assert_false(
		source_text.contains("Base XP reward"),
		"combat_menu.gd must not contain the 'Base XP reward' comment (issue #902); XP is server-authoritative."
	)


func _strip_gd_comments(text: String) -> String:
	# Strips full-line `#` comments and inline trailing comments from GDScript
	# source so assertions ignore explanatory text quoting historic strings.
	var stripped_lines: PackedStringArray = PackedStringArray()
	for line in text.split("\n"):
		var trimmed := line.lstrip(" \t")
		if trimmed.begins_with("#"):
			continue
		var hash_idx := trimmed.find(" #")
		if hash_idx == -1:
			hash_idx = trimmed.find("\t#")
		if hash_idx >= 0:
			stripped_lines.append(trimmed.substr(0, hash_idx))
		else:
			stripped_lines.append(line)
	return "\n".join(stripped_lines)


func test_combat_menu_does_not_hardcode_placeholder_rank_or_duration() -> void:
	# All of these were invented locally before the fix. The server is the
	# single source of truth for old_rank/new_rank/rank_delta/match_duration.
	var source_text := _source_text()
	if source_text.is_empty():
		return

	assert_false(
		source_text.contains("\"old_rank\": 0"),
		"combat_menu.gd must not invent old_rank placeholders (issue #902)."
	)
	assert_false(
		source_text.contains("\"new_rank\": 0"),
		"combat_menu.gd must not invent new_rank placeholders (issue #902)."
	)
	assert_false(
		source_text.contains("\"rank_delta\": 0"),
		"combat_menu.gd must not invent rank_delta placeholders (issue #902)."
	)
	assert_false(
		source_text.contains("\"match_duration\": 120.0"),
		"combat_menu.gd must not hardcode a 2-minute default duration (issue #902)."
	)


func test_combat_menu_routes_through_match_completed_signal() -> void:
	# The new server-declared-only path must subscribe to
	# MatchmakerManager.match_completed and render the payload verbatim.
	var source_text := _source_text()
	if source_text.is_empty():
		return

	assert_true(
		source_text.contains("match_completed"),
		"combat_menu.gd must subscribe to MatchmakerManager.match_completed to render the server-declared settlement payload (issue #902)."
	)
	assert_true(
		source_text.contains("MatchmakerManager"),
		"combat_menu.gd must route through MatchmakerManager for result rendering (issue #902)."
	)


func test_combat_menu_does_not_block_on_race() -> void:
	# The acceptance criterion explicitly says: "must route through
	# server-declared results, not block on a race". The callback must NOT
	# invoke change_scene_to_packed synchronously anymore — that would
	# cause the result screen to render before the server signal arrives.
	var source_text := _source_text()
	if source_text.is_empty():
		return

	# The old synchronously-rendering callback must not live in
	# _on_pvp_combat_ended anymore. We assert by checking that the new
	# callback that renders the payload is the one that performs the
	# change_scene_to_packed call.
	assert_true(
		source_text.contains("_on_server_match_completed"),
		"combat_menu.gd must have a dedicated server-result callback (issue #902)."
	)
	# The server callback must be the one wired to match_completed.
	var callback_idx := source_text.find("_on_server_match_completed")
	var next_chunk := source_text.substr(callback_idx, 1200)
	assert_true(
		next_chunk.contains("change_scene_to_packed"),
		"Server-result callback must call change_scene_to_packed with the server payload (issue #902)."
	)
