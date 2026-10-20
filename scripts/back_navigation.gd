class_name BackNavigation
extends RefCounted
## Android Back button and app-background handling (issue #1724).
##
## With application/config/quit_on_go_back=false the OS Back button no longer
## closes the game. The UITransitionOptimizer autoload forwards the engine
## notifications here:
##  - Back: the current scene may handle it via on_back_requested() -> bool
##    (combat opens/closes the pause menu). Otherwise we press the screen's
##    own Back/Close/Cancel button. If there is none, ask before quitting.
##  - App paused (backgrounded): flush saves and let the scene react through
##    on_app_paused() (combat pauses itself, so the player returns to the
##    pause menu, not mid-fight).

const BACK_LABELS: Array[String] = ["back", "close", "cancel", "<", "< back", "\u2190 back", "\u2190"]
const QUIT_DIALOG_NAME := "BackQuitConfirm"


static func handle_back(tree: SceneTree) -> bool:
	var scene: Node = tree.current_scene
	if scene != null and scene.has_method("on_back_requested"):
		if scene.on_back_requested():
			return true
	var button := find_back_button(scene)
	if button != null:
		button.pressed.emit()
		return true
	show_quit_confirm(tree)
	return false


static func handle_app_paused(tree: SceneTree) -> void:
	flush_saves(tree)
	var scene: Node = tree.current_scene
	if scene != null and scene.has_method("on_app_paused"):
		scene.on_app_paused()


static func flush_saves(tree: SceneTree) -> void:
	var campaign := tree.root.get_node_or_null("CampaignManager")
	if campaign != null and campaign.has_method("save_progress"):
		campaign.save_progress()
	var difficulty := tree.root.get_node_or_null("DynamicDifficultyManager")
	if difficulty != null and difficulty.has_method("save_difficulty_state"):
		difficulty.save_difficulty_state()


static func find_back_button(node: Node) -> Button:
	if node == null:
		return null
	if node is Button:
		var button := node as Button
		if (
			button.is_visible_in_tree()
			and not button.disabled
			and button.text.strip_edges().to_lower() in BACK_LABELS
		):
			return button
	for child in node.get_children():
		var found := find_back_button(child)
		if found != null:
			return found
	return null


static func show_quit_confirm(tree: SceneTree) -> void:
	if tree.root.has_node(QUIT_DIALOG_NAME):
		return
	var dialog := ConfirmationDialog.new()
	dialog.name = QUIT_DIALOG_NAME
	dialog.dialog_text = "Quit the game?"
	dialog.ok_button_text = "Quit"
	dialog.cancel_button_text = "Stay"
	dialog.process_mode = Node.PROCESS_MODE_ALWAYS
	dialog.confirmed.connect(tree.quit)
	dialog.canceled.connect(dialog.queue_free)
	dialog.close_requested.connect(dialog.queue_free)
	tree.root.add_child(dialog)
	dialog.popup_centered()
