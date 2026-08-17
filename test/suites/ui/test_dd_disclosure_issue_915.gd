extends GutTest

## Dynamic Difficulty Disclosure UI tests (issue #915).
##
## Asserts the disclosure scene loads, the body contains every key
## constraint phrase from the ratified PRD (PvE-only, ±20 %, reward-
## neutral), and the acknowledgement flag persists.

const SCENE_PATH := "res://scenes/ui/components/dd_disclosure_dialog.tscn"
const SCRIPT_PATH := "res://scenes/ui/components/dd_disclosure_dialog.gd"
const DISCLOSURE_FILE := "user://dd_disclosure.json"

var test_save_file: String = "user://dd_disclosure_test.json"


func before_all() -> void:
	# Back up any existing acknowledgement so we don't trash real state.
	if FileAccess.file_exists(DISCLOSURE_FILE):
		var src := FileAccess.open(DISCLOSURE_FILE, FileAccess.READ)
		if src:
			var content: String = src.get_as_text()
			src.close()
			var dst := FileAccess.open(test_save_file, FileAccess.WRITE)
			if dst:
				dst.store_string(content)
				dst.close()
	# Start clean.
	if FileAccess.file_exists(DISCLOSURE_FILE):
		DirAccess.remove_absolute(DISCLOSURE_FILE)


func after_all() -> void:
	if FileAccess.file_exists(test_save_file):
		var src := FileAccess.open(test_save_file, FileAccess.READ)
		if src:
			var content: String = src.get_as_text()
			src.close()
			var dst := FileAccess.open(DISCLOSURE_FILE, FileAccess.WRITE)
			if dst:
				dst.store_string(content)
				dst.close()
		DirAccess.remove_absolute(test_save_file)
	if FileAccess.file_exists(DISCLOSURE_FILE):
		DirAccess.remove_absolute(DISCLOSURE_FILE)


func before_each() -> void:
	if FileAccess.file_exists(DISCLOSURE_FILE):
		DirAccess.remove_absolute(DISCLOSURE_FILE)


func test_disclosure_scene_exists() -> void:
	assert_true(ResourceLoader.exists(SCENE_PATH),
		"DD disclosure scene must ship at %s" % SCENE_PATH)


func test_disclosure_script_loads() -> void:
	var script: GDScript = load(SCRIPT_PATH)
	assert_not_null(script, "DD disclosure script must load")


func test_disclosure_dialog_instantiates() -> void:
	var scene: PackedScene = load(SCENE_PATH)
	assert_not_null(scene, "Packed scene must load")
	var dialog: Node = scene.instantiate()
	assert_not_null(dialog, "Dialog must instantiate")
	if dialog and is_instance_valid(dialog):
		dialog.queue_free()


func test_disclosure_unacknowledged_by_default() -> void:
	var script: GDScript = load(SCRIPT_PATH)
	assert_false(script.has_acknowledged(),
		"Fresh install must report has_acknowledged() == false")


func test_disclosure_body_contains_required_phrases() -> void:
	var script: GDScript = load(SCRIPT_PATH)
	# Pull the constant directly from the script source so the test fails
	# loudly if marketing copy drifts away from the ratified PRD wording.
	var body: String = script.DISCLOSURE_BODY
	assert_true(body.contains("PvE-only"),
		"Disclosure must state 'PvE-only'")
	assert_true(body.contains("±20%"),
		"Disclosure must state '±20%' bound")
	assert_true(body.contains("reward-neutral"),
		"Disclosure must state 'reward-neutral'")


func test_disclosure_acknowledgement_persists() -> void:
	var scene: PackedScene = load(SCENE_PATH)
	var dialog: Node = scene.instantiate()
	assert_not_null(dialog)
	add_child_autofree(dialog)
	# Drive the Ok button press path. The button is at
	# $SafeAreaContainer/VBoxContainer/OkButton per the .tscn.
	var ok: Button = dialog.get_node_or_null(
		"SafeAreaContainer/VBoxContainer/OkButton")
	assert_not_null(ok, "OK button must exist in dialog")
	if ok:
		ok.pressed.emit()
	# Give the fade-out tween a frame to complete.
	await get_tree().process_frame
	await get_tree().process_frame
	var script: GDScript = load(SCRIPT_PATH)
	assert_true(script.has_acknowledged(),
		"After acknowledgement, has_acknowledged() must return true")