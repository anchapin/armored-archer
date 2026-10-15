extends GutTest

## Tutorial System Tests
## Tests the onboarding system for first-time players
##

const TUTORIAL_SCRIPT = preload("res://autoloads/TutorialManager.gd")

# Keep production tutorial methods, but do not connect to autoload services.
class TutorialFixture extends "res://autoloads/TutorialManager.gd":
	func _ready() -> void:
		pass

var tutorial_manager: Node
var had_original_save: bool = false
var backup_ready: bool = false
var test_save_file: String = "user://tutorial_data_gut_backup_%s.json" % Time.get_ticks_usec()

func before_all() -> void:
	# Backup existing tutorial data before permitting test writes.
	had_original_save = FileAccess.file_exists(TUTORIAL_SCRIPT.TUTORIAL_SAVE_FILE)
	if had_original_save:
		var src := FileAccess.open(TUTORIAL_SCRIPT.TUTORIAL_SAVE_FILE, FileAccess.READ)
		assert_not_null(src, "Original tutorial save must be readable")
		if src == null:
			return
		var content: String = src.get_as_text()
		src.close()

		var dst := FileAccess.open(test_save_file, FileAccess.WRITE)
		assert_not_null(dst, "Tutorial backup must be writable")
		if dst == null:
			return
		dst.store_string(content)
		dst.close()

	backup_ready = true
	# Clear tutorial data for testing
	if FileAccess.file_exists(TUTORIAL_SCRIPT.TUTORIAL_SAVE_FILE):
		DirAccess.remove_absolute(TUTORIAL_SCRIPT.TUTORIAL_SAVE_FILE)

func after_all() -> void:
	if not backup_ready:
		return
	if not had_original_save:
		DirAccess.remove_absolute(TUTORIAL_SCRIPT.TUTORIAL_SAVE_FILE)
	# Keep the backup on any restore error rather than lose original data.
	if had_original_save:
		var src := FileAccess.open(test_save_file, FileAccess.READ)
		assert_not_null(src, "Tutorial backup must be readable for restore")
		if src == null:
			return
		var content: String = src.get_as_text()
		src.close()
		var dst := FileAccess.open(TUTORIAL_SCRIPT.TUTORIAL_SAVE_FILE, FileAccess.WRITE)
		assert_not_null(dst, "Original tutorial save must be writable for restore")
		if dst == null:
			return
		dst.store_string(content)
		dst.close()
		DirAccess.remove_absolute(test_save_file)

func before_each() -> void:
	assert_true(backup_ready, "Tutorial save backup must succeed before testing")
	if not backup_ready:
		return
	tutorial_manager = TutorialFixture.new()
	add_child_autofree(tutorial_manager)
	# Reset only the isolated manager and on-disk test data.
	tutorial_manager.reset_tutorial_progress()

func after_each() -> void:
	# Invalidate pending wait-step timers before GUT frees this manager.
	if tutorial_manager == null:
		return
	tutorial_manager._step_generation += 1
	tutorial_manager.is_tutorial_active = false

func test_tutorial_manager_exists() -> void:
	assert_not_null(get_node_or_null("/root/TutorialManager"),
		"TutorialManager should be loaded as autoload")

func test_first_time_player_returns_true_for_new_player() -> void:
	assert_true(tutorial_manager.is_first_time_player(), "New player should be flagged as first-time")

func test_first_time_player_returns_false_after_completion() -> void:
	tutorial_manager.start_tutorial("welcome")
	# Complete all steps
	for i in range(6):  # Welcome tutorial has 6 steps (issue #915: added auto_aim)
		tutorial_manager.complete_current_step()

	assert_false(tutorial_manager.is_first_time_player(), "Completed tutorial should not be first-time")

func test_tutorial_starts_successfully() -> void:
	var started: bool = tutorial_manager.start_tutorial("welcome")
	assert_true(started, "Tutorial should start successfully")

func test_tutorial_returns_false_for_completed_tutorial() -> void:
	# Complete the tutorial first
	tutorial_manager.start_tutorial("welcome")
	for i in range(6):
		tutorial_manager.complete_current_step()

	# Try to start again
	var started: bool = tutorial_manager.start_tutorial("welcome")
	assert_false(started, "Completed tutorial should not start again")

func test_tutorial_skipping_works() -> void:
	tutorial_manager.start_tutorial("welcome")
	tutorial_manager.skip_current_tutorial()

	var state: int = tutorial_manager.get_tutorial_state("welcome")
	assert_eq(state, TUTORIAL_SCRIPT.TutorialState.SKIPPED, "Tutorial should be marked as skipped")

func test_tutorial_steps_are_defined() -> void:
	assert_true(TUTORIAL_SCRIPT.TUTORIALS.has("welcome"), "Welcome tutorial should be defined")

	var welcome_tutorial = TUTORIAL_SCRIPT.TUTORIALS["welcome"]
	assert_true(welcome_tutorial.has("steps"), "Welcome tutorial should have steps")

	var steps = welcome_tutorial["steps"]
	assert_eq(steps.size(), 6, "Welcome tutorial should have 6 steps (issue #915: added auto_aim)")

func test_tutorial_steps_have_required_fields() -> void:
	var welcome_tutorial = TUTORIAL_SCRIPT.TUTORIALS["welcome"]
	var steps = welcome_tutorial["steps"]

	for step in steps:
		assert_true(step.has("id"), "Step should have id field")
		assert_true(step.has("title"), "Step should have title field")
		assert_true(step.has("description"), "Step should have description field")
		assert_true(step.has("action"), "Step should have action field")
		assert_true(step.has("position"), "Step should have position field")

func test_tutorial_progress_updates() -> void:
	tutorial_manager.start_tutorial("welcome")

	watch_signals(tutorial_manager)
	tutorial_manager.complete_current_step()
	await get_tree().process_frame
	assert_signal_emitted(tutorial_manager, "tutorial_progress_changed",
		"Progress signal should be emitted on step completion")

func test_overall_progress_calculates_correctly() -> void:
	# Should start at 0
	var progress = tutorial_manager.get_overall_progress()
	assert_eq(progress, 0.0, "Initial progress should be 0")

	# Complete every defined tutorial, including beta_features.
	for tutorial_id in TUTORIAL_SCRIPT.TUTORIALS:
		tutorial_manager.start_tutorial(tutorial_id)
		for step in TUTORIAL_SCRIPT.TUTORIALS[tutorial_id]["steps"]:
			tutorial_manager.complete_current_step()

	progress = tutorial_manager.get_overall_progress()
	assert_eq(progress, 1.0, "Progress should be 1.0 after completing all tutorials")

func test_input_action_tracking_works() -> void:
	tutorial_manager.start_tutorial("welcome")

	# Simulate movement input (should complete movement step)
	tutorial_manager.on_input_action("move_left")

	var step = tutorial_manager.get_current_step()
	# Should be on aiming step now
	assert_eq(step.get("id", ""), "aiming", "Input action should complete current step")

func test_tutorial_completion_signal_emitted() -> void:
	watch_signals(tutorial_manager)
	tutorial_manager.start_tutorial("welcome")
	for i in range(6):
		tutorial_manager.complete_current_step()
	await get_tree().process_frame
	assert_signal_emitted(tutorial_manager, "tutorial_completed",
		"Tutorial completed signal should be emitted")

func test_tutorial_data_persists() -> void:
	tutorial_manager.start_tutorial("welcome")
	for i in range(6):
		tutorial_manager.complete_current_step()

	# Reload tutorial data
	tutorial_manager._load_tutorial_data()

	var is_complete = tutorial_manager.is_tutorial_complete("welcome")
	assert_true(is_complete, "Tutorial completion should persist after reload")
