extends Node2D

@onready var player: CharacterBody2D = get_node_or_null("Player")
@onready var touch_ui: Control = get_node_or_null("HUD/TouchUI")
@onready var camera: Camera2D = $Camera2D
@onready var game_over: Control = get_node_or_null("HUD/GameOver")
@onready var tutorial_controller: Node = get_node_or_null("HUD/TutorialController")

# --- Combat Pause Ownership ---
var _owns_tree_pause: bool = false
var _pause_overlay: Control
var _pause_button: Button

# --- Tutorial Integration ---
var tutorial_controller_scene: PackedScene = preload("res://scenes/ui/tutorial_controller.tscn")

func _ready() -> void:
	# Only stage controls stay live. Combat, pools and wave timers pause with the tree.
	process_mode = Node.PROCESS_MODE_ALWAYS
	player.process_mode = Node.PROCESS_MODE_PAUSABLE
	$HUD.process_mode = Node.PROCESS_MODE_PAUSABLE
	game_over.process_mode = Node.PROCESS_MODE_ALWAYS
	_setup_pause_controls()
	GameManager.player_died.connect(_on_combat_finished)
	GameManager.game_won.connect(_on_combat_finished)
	# Issue #914: swap to combat music as the combat scene enters. tree_changed
	# auto-switch would handle this too, but an explicit call avoids any gap
	# between scene load and the tree_changed signal firing.
	var audio := get_node_or_null("/root/AudioManager")
	if audio and audio.has_method("play_default_music_combat"):
		audio.play_default_music_combat()

	# Setup tutorial controller
	_setup_tutorial_controller()

	# Check if first-time player and start tutorial
	if TutorialManager and TutorialManager.is_first_time_player():
		TutorialManager.start_tutorial("welcome")

	# Bind explicitly across the HUD CanvasLayer boundary.
	if touch_ui:
		touch_ui.set_player(player)

	# Tutorial state must be established before combat starts.
	GameManager.start_game()
	EnemySpawner.start_stage(GameManager.current_stage_id, GameManager.current_waves,
		GameManager.current_encounter_data, GameManager.boss_id)

func _setup_tutorial_controller() -> void:
	# Create tutorial controller dynamically
	if not tutorial_controller:
		tutorial_controller = tutorial_controller_scene.instantiate()
		tutorial_controller.name = "TutorialController"
		# Issue #1449: parent under the HUD CanvasLayer so the overlay is drawn in
		# screen space instead of world space (where it followed the camera off-screen).
		$HUD.add_child(tutorial_controller)

func _process(_delta: float) -> void:
	# Make camera follow player
	if player and camera:
		camera.global_position = player.global_position

func _input(event: InputEvent) -> void:
	if event.is_action_pressed("pause") and not event.is_echo():
		_toggle_pause()
		get_viewport().set_input_as_handled()
		return
	if get_tree().paused or not GameManager.is_game_active:
		return
	# Pass input to tutorial controller for completion tracking
	if tutorial_controller and tutorial_controller.has_method("check_tutorial_input"):
		tutorial_controller.check_tutorial_input(event)

func _exit_tree() -> void:
	if GameManager.player_died.is_connected(_on_combat_finished):
		GameManager.player_died.disconnect(_on_combat_finished)
	if GameManager.game_won.is_connected(_on_combat_finished):
		GameManager.game_won.disconnect(_on_combat_finished)
	_release_tree_pause()
	EnemySpawner.stop_stage()

func _setup_pause_controls() -> void:
	_pause_button = Button.new()
	_pause_button.text = "Pause"
	_pause_button.position = Vector2(20, 70)
	_pause_button.process_mode = Node.PROCESS_MODE_ALWAYS
	$HUD.add_child(_pause_button)
	_pause_button.pressed.connect(_toggle_pause)

	_pause_overlay = Control.new()
	_pause_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_pause_overlay.process_mode = Node.PROCESS_MODE_ALWAYS
	_pause_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	$HUD.add_child(_pause_overlay)
	var shade: ColorRect = ColorRect.new()
	shade.color = Color(0, 0, 0, 0.75)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_pause_overlay.add_child(shade)
	var center: CenterContainer = CenterContainer.new()
	center.name = "CenterContainer"
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_pause_overlay.add_child(center)
	var controls: VBoxContainer = VBoxContainer.new()
	controls.name = "VBoxContainer"
	center.add_child(controls)
	var label: Label = Label.new()
	label.text = "Paused"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	controls.add_child(label)
	var resume: Button = Button.new()
	resume.name = "Button"
	resume.text = "Resume"
	resume.custom_minimum_size = Vector2(180, 48)
	controls.add_child(resume)
	resume.pressed.connect(_toggle_pause)
	_pause_overlay.hide()

func _clear_combat_input() -> void:
	player.velocity = Vector2.ZERO
	player.set_virtual_move_direction(Vector2.ZERO)
	player.set_virtual_aim_direction(Vector2.ZERO)
	if touch_ui:
		touch_ui.clear_input()

func on_back_requested() -> bool:
	## Android Back during combat opens the pause menu; Back again resumes (#1724).
	if not GameManager.is_game_active:
		return false
	_toggle_pause()
	return true

func on_app_paused() -> void:
	## App went to the background: pause combat so the player returns to the pause menu (#1724).
	if GameManager.is_game_active and not _owns_tree_pause:
		_toggle_pause()

func _toggle_pause() -> void:
	if not GameManager.is_game_active:
		return
	if _owns_tree_pause:
		_release_tree_pause()
		_pause_overlay.hide()
		_pause_button.show()
	else:
		_clear_combat_input()
		_owns_tree_pause = true
		get_tree().paused = true
		_pause_overlay.show()
		_pause_button.hide()

func _on_combat_finished() -> void:
	_clear_combat_input()
	_owns_tree_pause = true
	get_tree().paused = true
	_pause_overlay.hide()
	_pause_button.hide()

func _release_tree_pause() -> void:
	if _owns_tree_pause:
		get_tree().paused = false
		_owns_tree_pause = false
