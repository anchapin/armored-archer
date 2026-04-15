extends GutTest

## Tutorial System Tests
## Tests the onboarding system for first-time players
##

var tutorial_manager: Node
var test_save_file: String = "user://tutorial_data_test.json"

func before_all() -> void:
	# Backup existing tutorial data
	if FileAccess.file_exists(TutorialManager.TUTORIAL_SAVE_FILE):
		var src := FileAccess.open(TutorialManager.TUTORIAL_SAVE_FILE, FileAccess.READ)
		var content: String = src.get_as_text()
		src.close()

		var dst := FileAccess.open(test_save_file, FileAccess.WRITE)
		dst.store_string(content)
		dst.close()

	# Clear tutorial data for testing
	if FileAccess.file_exists(TutorialManager.TUTORIAL_SAVE_FILE):
		DirAccess.remove_absolute(TutorialManager.TUTORIAL_SAVE_FILE)

func after_all() -> void:
	# Restore original tutorial data
	if FileAccess.file_exists(test_save_file):
		var src := FileAccess.open(test_save_file, FileAccess.READ)
		var content: String = src.get_as_text()
		src.close()

		var dst := FileAccess.open(TutorialManager.TUTORIAL_SAVE_FILE, FileAccess.WRITE)
		dst.store_string(content)
		dst.close()

		DirAccess.remove_absolute(test_save_file)

func before_each() -> void:
	tutorial_manager = TutorialManager
	# Reset tutorial state between tests
	tutorial_manager.reset_tutorial_progress()

func test_tutorial_manager_exists() -> void:
	assert_not_null(tutorial_manager, "TutorialManager should be loaded as autoload")

func test_first_time_player_returns_true_for_new_player() -> void:
	assert_true(tutorial_manager.is_first_time_player(), "New player should be flagged as first-time")

func test_first_time_player_returns_false_after_completion() -> void:
	tutorial_manager.start_tutorial("welcome")
	# Complete all steps
	for i in range(5):  # Welcome tutorial has 5 steps
		tutorial_manager.complete_current_step()

	assert_false(tutorial_manager.is_first_time_player(), "Completed tutorial should not be first-time")

func test_tutorial_starts_successfully() -> void:
	var started := tutorial_manager.start_tutorial("welcome")
	assert_true(started, "Tutorial should start successfully")

func test_tutorial_returns_false_for_completed_tutorial() -> void:
	# Complete the tutorial first
	tutorial_manager.start_tutorial("welcome")
	for i in range(5):
		tutorial_manager.complete_current_step()

	# Try to start again
	var started := tutorial_manager.start_tutorial("welcome")
	assert_false(started, "Completed tutorial should not start again")

func test_tutorial_skipping_works() -> void:
	tutorial_manager.start_tutorial("welcome")
	tutorial_manager.skip_current_tutorial()

	var state := tutorial_manager.get_tutorial_state("welcome")
	assert_eq(state, tutorial_manager.TutorialState.SKIPPED, "Tutorial should be marked as skipped")

func test_tutorial_steps_are_defined() -> void:
	assert_true(TutorialManager.TUTORIALS.has("welcome"), "Welcome tutorial should be defined")

	var welcome_tutorial = TutorialManager.TUTORIALS["welcome"]
	assert_true(welcome_tutorial.has("steps"), "Welcome tutorial should have steps")

	var steps = welcome_tutorial["steps"]
	assert_eq(steps.size(), 5, "Welcome tutorial should have 5 steps")

func test_tutorial_steps_have_required_fields() -> void:
	var welcome_tutorial = TutorialManager.TUTORIALS["welcome"]
	var steps = welcome_tutorial["steps"]

	for step in steps:
		assert_true(step.has("id"), "Step should have id field")
		assert_true(step.has("title"), "Step should have title field")
		assert_true(step.has("description"), "Step should have description field")
		assert_true(step.has("action"), "Step should have action field")
		assert_true(step.has("position"), "Step should have position field")

func test_tutorial_progress_updates() -> void:
	tutorial_manager.start_tutorial("welcome")

	var progress_received := false

	var handler := tutorial_manager.tutorial_progress_changed.connect(
		func(progress): progress_received = true
	)

	tutorial_manager.complete_current_step()
	await get_tree().process_frame

	assert_true(progress_received, "Progress signal should be emitted on step completion")

	tutorial_manager.tutorial_progress_changed.disconnect(handler)

func test_overall_progress_calculates_correctly() -> void:
	# Should start at 0
	var progress = tutorial_manager.get_overall_progress()
	assert_eq(progress, 0.0, "Initial progress should be 0")

	# Complete welcome tutorial
	tutorial_manager.start_tutorial("welcome")
	for i in range(5):
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
	var completed := false

	var handler := tutorial_manager.tutorial_completed.connect(
		func(tutorial_id): completed = true
	)

	tutorial_manager.start_tutorial("welcome")
	for i in range(5):
		tutorial_manager.complete_current_step()

	await get_tree().process_frame

	assert_true(completed, "Tutorial completed signal should be emitted")

	tutorial_manager.tutorial_completed.disconnect(handler)

func test_tutorial_data_persists() -> void:
	tutorial_manager.start_tutorial("welcome")
	for i in range(5):
		tutorial_manager.complete_current_step()

	# Reload tutorial data
	tutorial_manager._load_tutorial_data()

	var is_complete = tutorial_manager.is_tutorial_complete("welcome")
	assert_true(is_complete, "Tutorial completion should persist after reload")
