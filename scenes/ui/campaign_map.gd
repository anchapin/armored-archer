extends Control

# --- State ---
var current_chapter: String = "chapter_1"
var available_chapters: Array = []

# --- Node References ---
@onready var chapter_title: Label = $ChapterTitle
@onready var stages_container: VBoxContainer = $StagesContainer
@onready var chapter_label: Label = $ChapterLabel
@onready var progress_label: Label = $ProgressLabel
@onready var prev_chapter_button: Button = $ChapterNav/PrevChapterButton
@onready var next_chapter_button: Button = $ChapterNav/NextChapterButton

# --- Scene Constants ---
const MAIN_SCENE = preload("res://scenes/main.tscn")

func _ready() -> void:
	# Get available chapters from CampaignManager
	load_available_chapters()

	# Set initial chapter to first available
	if not available_chapters.is_empty():
		current_chapter = available_chapters[0]

	update_chapter_display()
	build_stage_buttons()

	# Connect to CampaignManager signals
	CampaignManager.stage_unlocked.connect(_on_stage_unlocked)
	CampaignManager.stage_completed.connect(_on_stage_completed)
	CampaignManager.campaign_progress_updated.connect(_on_progress_updated)

	# Connect back button
	$BackButton.pressed.connect(_on_back_button_pressed)

	# Connect chapter navigation buttons
	prev_chapter_button.pressed.connect(_on_prev_chapter_pressed)
	next_chapter_button.pressed.connect(_on_next_chapter_pressed)

func load_available_chapters() -> void:
	"""Loads the list of available chapters from CampaignManager."""
	available_chapters = []
	var campaigns = CampaignManager.campaigns_data.get("campaigns", [])
	for campaign in campaigns:
		if campaign.has("id"):
			available_chapters.append(campaign.get("id"))

func update_chapter_display() -> void:
	"""Updates the chapter title, label, progress, and navigation buttons."""
	var chapter_data = get_campaign_data(current_chapter)
	if chapter_data:
		chapter_title.text = chapter_data.get("name", "Campaign")

	# Update chapter label with chapter number
	var chapter_index = available_chapters.find(current_chapter)
	if chapter_index >= 0:
		chapter_label.text = "Chapter %d / %d" % [chapter_index + 1, available_chapters.size()]

	# Update progress display
	update_progress_display()

	# Update navigation buttons
	prev_chapter_button.disabled = chapter_index <= 0
	next_chapter_button.disabled = chapter_index >= available_chapters.size() - 1

func update_progress_display() -> void:
	"""Updates the progress label showing completed stages."""
	var stages = get_campaign_stages(current_chapter)
	var completed_count = 0

	for stage_data in stages:
		var stage_id = stage_data.get("id")
		if CampaignManager.is_stage_completed(stage_id):
			completed_count += 1

	progress_label.text = "Progress: %d / %d stages completed" % [completed_count, stages.size()]

func build_stage_buttons() -> void:
	for child in stages_container.get_children():
		child.queue_free()

	var stages = get_campaign_stages(current_chapter)

	for stage_data in stages:
		var stage_button = create_stage_button(stage_data)
		stages_container.add_child(stage_button)

func create_stage_button(stage_data: Dictionary) -> Button:
	var button = Button.new()
	button.text = "%s: %s (%d waves)" % [stage_data.get("id"), stage_data.get("name"), stage_data.get("waves")]
	button.custom_minimum_size = Vector2(400, 60)

	var stage_id = stage_data.get("id")
	var is_unlocked = CampaignManager.is_stage_unlocked(stage_id)
	var is_completed = CampaignManager.is_stage_completed(stage_id)

	if not is_unlocked:
		button.disabled = true
		button.text += " [LOCKED]"
	elif is_completed:
		button.text += " [DONE]"

	if stage_data.get("boss"):
		button.text += " [BOSS]"
		button.modulate = Color(1.0, 0.8, 0.2)

	if is_unlocked:
		button.pressed.connect(_on_stage_pressed.bind(stage_id))

	return button

func _on_stage_pressed(stage_id: String) -> void:
	var stage_data = CampaignManager.get_stage_data(stage_id)
	GameManager.current_stage_id = stage_id
	GameManager.current_waves = stage_data.get("waves", 3)
	GameManager.boss_id = stage_data.get("boss", "")

	get_tree().change_scene_to_packed(MAIN_SCENE)

func _on_stage_unlocked(stage_id: String) -> void:
	build_stage_buttons()

func _on_stage_completed(stage_id: String) -> void:
	build_stage_buttons()

func _on_progress_updated(chapter_id: String, progress: float) -> void:
	if chapter_id == current_chapter:
		var percentage = int(progress * 100)
		print("Chapter %s progress: %d%%" % [chapter_id, percentage])

func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/main.tscn")


func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if CampaignManager:
		if CampaignManager.stage_unlocked.is_connected(_on_stage_unlocked):
			CampaignManager.stage_unlocked.disconnect(_on_stage_unlocked)
		if CampaignManager.stage_completed.is_connected(_on_stage_completed):
			CampaignManager.stage_completed.disconnect(_on_stage_completed)
		if CampaignManager.campaign_progress_updated.is_connected(_on_progress_updated):
			CampaignManager.campaign_progress_updated.disconnect(_on_progress_updated)

func _on_prev_chapter_pressed() -> void:
	var chapter_index = available_chapters.find(current_chapter)
	if chapter_index > 0:
		current_chapter = available_chapters[chapter_index - 1]
		update_chapter_display()
		build_stage_buttons()

func _on_next_chapter_pressed() -> void:
	var chapter_index = available_chapters.find(current_chapter)
	if chapter_index < available_chapters.size() - 1:
		current_chapter = available_chapters[chapter_index + 1]
		update_chapter_display()
		build_stage_buttons()

func get_campaign_data(chapter_id: String) -> Dictionary:
	for campaign in CampaignManager.campaigns_data.get("campaigns", []):
		if campaign.get("id") == chapter_id:
			return campaign
	return {}

func get_campaign_stages(chapter_id: String) -> Array:
	var campaign_data = get_campaign_data(chapter_id)
	return campaign_data.get("stages", [])
