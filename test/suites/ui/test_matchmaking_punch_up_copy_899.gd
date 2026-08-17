extends GutTest

# Issue #899: client punch-up copy/data drift.
#
# Verifies the matchmaking_menu.tscn RANKED column shows the punch-up reward
# range that matches the server constants in backend/src/modules/matchmaker.ts
# (PUNCH_UP_XP_MULTIPLIER_MIN/MAX = 1.2/2.0 → +20%/+100%; GEMS 3-10).
# Before the fix, the label read "Punch Up Win: +50% XP, +5 Gems" — those
# values were wrong. After the fix the label reads "+20-100% XP, +3-10 Gems".
#
# We assert against the .tscn literal directly: instantiating the full scene
# triggers unrelated @onready failures from sibling nodes that are out of
# scope for issue #899 (see matchmaking_menu.gd), so file-text matching is the
# most reliable signal for the literal copy drift.

const SCENE_PATH := "res://scenes/ui/matchmaking_menu.tscn"
const STALE_XP_TEXT := "+50% XP"
const STALE_GEM_TEXT := "+5 Gems"
const CORRECT_RANGE := "Punch Up Win: +20-100% XP, +3-10 Gems"


func _scene_text() -> String:
	var file := FileAccess.open(SCENE_PATH, FileAccess.READ)
	assert_not_null(file, "Could not open %s" % SCENE_PATH)
	if file == null:
		return ""
	var text := file.get_as_text()
	file.close()
	return text


func test_ranked_punch_up_label_does_not_show_stale_copy() -> void:
	var scene_text := _scene_text()
	if scene_text.is_empty():
		return

	assert_false(
		scene_text.contains(STALE_XP_TEXT),
		"matchmaking_menu.tscn must not contain stale +50%% XP copy (issue #899)."
	)
	assert_false(
		scene_text.contains(STALE_GEM_TEXT),
		"matchmaking_menu.tscn must not contain stale +5 Gems copy (issue #899)."
	)


func test_ranked_punch_up_label_matches_server_constants() -> void:
	var scene_text := _scene_text()
	if scene_text.is_empty():
		return

	assert_true(
		scene_text.contains(CORRECT_RANGE),
		"matchmaking_menu.tscn RANKED punch-up copy must match server MIN/MAX constants (issue #899). Expected literal: %s" % CORRECT_RANGE
	)


func test_punch_up_warning_dialog_initial_copy_matches_server_constants() -> void:
	# Punch_up_warning_dialog.tscn has an initial literal that gets
	# overwritten at runtime by _update_dialog_content(). The literal is the
	# only thing a player sees if the dynamic update hasn't run yet, so it
	# must also reflect the server MIN/MAX constants (issue #899 spirit:
	# client copy must match server constants).
	const DIALOG_PATH := "res://scenes/ui/punch_up_warning_dialog.tscn"
	const DIALOG_CORRECT := "+20-100% XP, +3-10 Gems"
	const DIALOG_STALE_XP := "+60% XP"
	const DIALOG_STALE_GEM := "+8 Gems"

	var file := FileAccess.open(DIALOG_PATH, FileAccess.READ)
	assert_not_null(file, "Could not open %s" % DIALOG_PATH)
	if file == null:
		return
	var scene_text := file.get_as_text()
	file.close()

	assert_true(
		scene_text.contains(DIALOG_CORRECT),
		"punch_up_warning_dialog.tscn must advertise the server punch-up MIN/MAX range (issue #899). Expected literal: %s" % DIALOG_CORRECT
	)
	assert_false(
		scene_text.contains(DIALOG_STALE_XP),
		"punch_up_warning_dialog.tscn must not contain stale +60%% XP copy (issue #899)."
	)
	assert_false(
		scene_text.contains(DIALOG_STALE_GEM),
		"punch_up_warning_dialog.tscn must not contain stale +8 Gems copy (issue #899)."
	)