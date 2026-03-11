extends Control

# --- State ---
var current_chapter: String = "chapter_1"

# --- Node References ---
@onready var chapter_title: Label = $ChapterTitle
@onready var stages_container: VBoxContainer = $StagesContainer

# --- Scene Constants ---
const MAIN_SCENE = preload("res://scenes/main.tscn")

func _ready() -> void:
	# Connect to CampaignManager signals for live updates
	if CampaignManager.has_signal("stage_unlocked"):
		CampaignManager.stage_unlocked.connect(_on_stage_unlocked)
	if CampaignManager.has_signal("stage_completed"):
		CampaignManager.stage_completed.connect(_on_stage_completed)
	if CampaignManager.has_signal("campaign_progress_updated"):
		CampaignManager.campaign_progress_updated.connect(_on_progress_updated)
	
	var chapter_data = get_campaign_data(current_chapter)
	if chapter_data:
		chapter_title.text = chapter_data.get("name", "Campaign")

	build_stage_buttons()

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
	if stage_data.is_empty():
		push_error("Failed to load stage data for: " + stage_id)
		return
	
	GameManager.current_stage_id = stage_id
	GameManager.current_waves = stage_data.get("waves", 3)
	GameManager.boss_id = stage_data.get("boss", "")

	get_tree().change_scene_to_packed(MAIN_SCENE)

func _on_stage_unlocked(_stage_id: String) -> void:
	build_stage_buttons()

func _on_stage_completed(_stage_id: String) -> void:
	build_stage_buttons()

func _on_progress_updated(chapter_id: String, progress: float) -> void:
	if chapter_id == current_chapter:
		var percentage = int(progress * 100)
		print("Chapter %s progress: %d%%" % [chapter_id, percentage])

func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/main.tscn")

func get_campaign_data(chapter_id: String) -> Dictionary:
	# Validate CampaignManager has the expected data
	if not CampaignManager.has_method("get_stage_data"):
		push_error("CampaignManager methods not available")
		return {}
	
	if CampaignManager.campaigns_data.is_empty():
		push_warning("Campaign data not loaded yet")
		return {}
	
	for campaign in CampaignManager.campaigns_data.get("campaigns", []):
		if campaign.get("id") == chapter_id:
			return campaign
	return {}

func get_campaign_stages(chapter_id: String) -> Array:
	var campaign_data = get_campaign_data(chapter_id)
	return campaign_data.get("stages", [])
