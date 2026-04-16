extends Control

# --- State ---
var current_chapter: String = "chapter_1"
var available_chapters: Array = []
var _difficulty_colors: Dictionary = {}

# --- Theme Manager Reference ---
var theme_manager: Node

# --- Design Tokens Reference ---
var design_tokens: Node

# --- Player Stats Reference ---
var player_stats: Node

# --- Node References ---
@onready var chapter_title: Label = $ChapterTitle
@onready var stages_container: VBoxContainer = $StagesContainer
@onready var chapter_label: Label = $ChapterLabel
@onready var progress_label: Label = $ProgressLabel
@onready var prev_chapter_button: Button = $ChapterNav/PrevChapterButton
@onready var next_chapter_button: Button = $ChapterNav/NextChapterButton

# --- Scene Constants ---
const MAIN_SCENE = preload("res://scenes/main.tscn")

# --- Rank Colors ---
const RANK_COLORS = {
	1: Color("#FFD700"),  # Gold for 1st
	2: Color("#C0C0C0"),  # Silver for 2nd
	3: Color("#CD7F32"),  # Bronze for 3rd
}

func _ready() -> void:
	# Get ThemeManager reference
	theme_manager = get_node_or_null("/root/ThemeManager")

	# Get DesignTokens reference
	design_tokens = get_node_or_null("/root/DesignTokens")

	# Get PlayerStatsManager reference
	player_stats = get_node_or_null("/root/PlayerStatsManager")

	# Apply theme if available
	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)

	# Get available chapters from CampaignManager
	load_available_chapters()

	# Set initial chapter to first unlocked or first available
	if not available_chapters.is_empty():
		current_chapter = _get_first_unlocked_chapter()

	update_chapter_display()
	build_stage_buttons()

	# Connect to CampaignManager signals
	CampaignManager.stage_unlocked.connect(_on_stage_unlocked)
	CampaignManager.stage_completed.connect(_on_stage_completed)
	CampaignManager.campaign_progress_updated.connect(_on_progress_updated)
	CampaignManager.chapter_unlocked.connect(_on_chapter_unlocked)

	# Connect back button
	$BackButton.pressed.connect(_on_back_button_pressed)

	# Connect chapter navigation buttons
	prev_chapter_button.pressed.connect(_on_prev_chapter_pressed)
	next_chapter_button.pressed.connect(_on_next_chapter_pressed)

## Gets the first unlocked chapter from the available chapters.
##
## Returns:
## 	String: First unlocked chapter ID
func _get_first_unlocked_chapter() -> String:
	"""Gets the first unlocked chapter from available chapters."""
	for chapter_id in available_chapters:
		if CampaignManager.is_chapter_unlocked(chapter_id):
			return chapter_id
	return available_chapters[0] if not available_chapters.is_empty() else "chapter_1"

func load_available_chapters() -> void:
	"""Loads the list of available chapters from CampaignManager."""
	available_chapters = []
	var campaigns = CampaignManager.campaigns_data.get("campaigns", [])
	for campaign in campaigns:
		if campaign.has("id"):
			available_chapters.append(campaign.get("id"))

	# Load difficulty tier metadata for color-coded indicators
	_difficulty_colors = CampaignManager.get_difficulty_metadata()

func update_chapter_display() -> void:
	"""Updates the chapter title, label, progress, and navigation buttons."""
	var chapter_data = get_campaign_data(current_chapter)
	if chapter_data:
		var chapter_name = chapter_data.get("name", "Campaign")
		var is_unlocked = CampaignManager.is_chapter_unlocked(current_chapter)

		if is_unlocked:
			chapter_title.text = chapter_name
		else:
			# Show locked chapter with requirements
			var req_data = CampaignManager.get_chapter_unlock_requirement(current_chapter)
			var description = req_data.get("description", "Locked")
			chapter_title.text = "%s \u1F512 (%s)" % [chapter_name, description]

	# Update chapter label with chapter number
	var chapter_index = available_chapters.find(current_chapter)
	if chapter_index >= 0:
		chapter_label.text = "Chapter %d / %d" % [chapter_index + 1, available_chapters.size()]

	# Update progress display (only for unlocked chapters)
	if CampaignManager.is_chapter_unlocked(current_chapter):
		update_progress_display()
	else:
		progress_label.text = "Locked - Complete previous chapter to unlock"

	# Update navigation buttons
	prev_chapter_button.disabled = chapter_index <= 0

	# Disable next chapter button if locked
	var is_next_locked = false
	if chapter_index < available_chapters.size() - 1:
		var next_chapter = available_chapters[chapter_index + 1]
		is_next_locked = not CampaignManager.is_chapter_unlocked(next_chapter)
	next_chapter_button.disabled = is_next_locked

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

	# Check if chapter is unlocked
	var is_chapter_unlocked = CampaignManager.is_chapter_unlocked(current_chapter)

	if not is_chapter_unlocked:
		# Show chapter locked message instead of stages
		var locked_label = Label.new()
		locked_label.text = "Chapter locked"
		locked_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		locked_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		locked_label.modulate = Color.GRAY
		stages_container.add_child(locked_label)
		return

	var stages = get_campaign_stages(current_chapter)
	var stage_markers = {}

	# Get stage markers if CampaignManager has the method
	if CampaignManager and CampaignManager.has_method("get_all_stage_markers"):
		stage_markers = CampaignManager.get_all_stage_markers()

	for stage_data in stages:
		var stage_button = create_stage_button(stage_data, stage_markers)
		stages_container.add_child(stage_button)

func create_stage_button(stage_data: Dictionary, stage_markers: Dictionary = {}) -> Button:
	var button = Button.new()
	button.custom_minimum_size = Vector2(400, 60)

	# Get colors from DesignTokens if available
	var primary_color = ArcherDesignTokens.COLOR_PRIMARY if design_tokens else Color("#4A90D9")
	var success_color = ArcherDesignTokens.COLOR_SUCCESS if design_tokens else Color("#22C55E")
	var warning_color = ArcherDesignTokens.COLOR_WARNING if design_tokens else Color("#F59E0B")
	var text_color = Color.WHITE

	if theme_manager:
		text_color = theme_manager.get_text_color()

	var stage_id = stage_data.get("id")
	var is_unlocked = CampaignManager.is_stage_unlocked(stage_id)
	var is_completed = CampaignManager.is_stage_completed(stage_id)

	# Get level requirement for stage
	var level_req = stage_data.get("level_requirement", 1)
	var player_level = player_stats.get_level() if player_stats else 1
	var level_met = player_level >= level_req

	# Get stage marker info
	var marker_info = stage_markers.get(stage_id, {})
	var has_quest = marker_info.get("has_quest", false)
	var quest_description = marker_info.get("quest_description", "")
	var is_marker_locked = marker_info.get("is_locked", false)
	var is_marker_available = marker_info.get("is_available", false)

	# Build button text with difficulty indicator
	var difficulty = stage_data.get("difficulty", 1)
	var diff_tier = _difficulty_colors.get(str(difficulty), {})
	var diff_name = diff_tier.get("name", "")
	var diff_color_str = diff_tier.get("color", "#FFFFFF")
	var diff_color = Color(diff_color_str)

	var prefix = "[%d] " % difficulty
	var button_text = "%s%s: %s (%d waves)" % [prefix, stage_data.get("id"), stage_data.get("name"), stage_data.get("waves")]

	# Enemy name tooltip
	var enemy_data = CampaignManager.get_enemy_data(stage_id)
	var enemy_type = enemy_data.get("type", "")
	if enemy_type != "":
		button.tooltip_text = "Enemy: %s" % enemy_type

	# Add level requirement info to tooltip
	if level_req > 1:
		if not level_met:
			button.tooltip_text += "\nRequires Level %d" % level_req
		else:
			button.tooltip_text += "\nLevel %d" % level_req

	if not is_unlocked:
		button.disabled = true
		button.text = button_text + " (Locked)"
		# Use disabled color
		if theme_manager:
			button.modulate = theme_manager.get_text_disabled_color()
		else:
			button.modulate = Color(1, 1, 1, 0.5)
	elif is_completed:
		button.text = "\u2713 " + button_text
		button.modulate = success_color
	else:
		# Check if level requirement is met
		if not level_met:
			button.disabled = true
			button.text = button_text + " (Lvl %d required)" % level_req
			if theme_manager:
				button.modulate = theme_manager.get_text_disabled_color()
			else:
				button.modulate = Color(1, 1, 1, 0.5)
		else:
			button.text = button_text
			button.modulate = diff_color

	if stage_data.get("boss"):
		button.text += " [BOSS]"
		if is_unlocked and not is_completed:
			button.modulate = warning_color

	# Add quest marker if active quest
	if has_quest and is_unlocked and not is_completed and level_met:
		button.text += " \u25CF"  # Bullet point for quest marker
		if quest_description != "":
			button.tooltip_text += "\nQuest: " + quest_description

	# Add locked marker if stage has level requirement not met
	if is_marker_locked and not is_unlocked:
		button.text += " \u1F512"  # Lock emoji
		button.tooltip_text = "Requires Level %d" % level_req

	# Add available marker for new content
	if is_marker_available and is_unlocked and not is_completed and level_met:
		button.text += " \u2713"  # Checkmark

	# Only enable button press if unlocked and level requirement is met
	if is_unlocked and level_met:
		button.pressed.connect(_on_stage_pressed.bind(stage_id))

	return button

func _on_stage_pressed(stage_id: String) -> void:
	if not CampaignManager.is_stage_unlocked(stage_id):
		return  # ignore locked stage clicks

	var stage_data = CampaignManager.get_stage_data(stage_id)
	var enemy_data = CampaignManager.get_enemy_data(stage_id)
	var difficulty = CampaignManager.get_difficulty_tier(stage_id)

	GameManager.current_stage_id = stage_id
	GameManager.current_waves = stage_data.get("waves", 3)
	GameManager.current_encounter_data = enemy_data
	GameManager.current_difficulty = difficulty

	# Handle null boss values from JSON - use empty string if boss is null or missing
	var boss_value = stage_data.get("boss")
	GameManager.boss_id = boss_value if boss_value != null else ""

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
	var result = get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")


func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if CampaignManager:
		if CampaignManager.stage_unlocked.is_connected(_on_stage_unlocked):
			CampaignManager.stage_unlocked.disconnect(_on_stage_unlocked)
		if CampaignManager.stage_completed.is_connected(_on_stage_completed):
			CampaignManager.stage_completed.disconnect(_on_stage_completed)
		if CampaignManager.campaign_progress_updated.is_connected(_on_progress_updated):
			CampaignManager.campaign_progress_updated.disconnect(_on_progress_updated)
		if CampaignManager.chapter_unlocked.is_connected(_on_chapter_unlocked):
			CampaignManager.chapter_unlocked.disconnect(_on_chapter_unlocked)

	# Disconnect theme manager
	if theme_manager and theme_manager.theme_changed.is_connected(_on_theme_changed):
		theme_manager.theme_changed.disconnect(_on_theme_changed)

# --- Theme Support ---
func _apply_theme() -> void:
	if not theme_manager:
		return
	
	var colors = theme_manager.get_theme_colors()
	var is_dark = theme_manager.is_dark_mode()
	
	# Apply background color
	theme_manager.apply_background(self)
	
	# Apply colors to labels if they exist
	if chapter_title:
		chapter_title.modulate = colors["on_surface"]
	if chapter_label:
		chapter_label.modulate = colors["on_surface"]
	if progress_label:
		progress_label.modulate = colors["on_surface"]
	
	# Rebuild stage buttons to apply new theme colors
	build_stage_buttons()

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()

func _on_prev_chapter_pressed() -> void:
	var chapter_index = available_chapters.find(current_chapter)
	if chapter_index > 0:
		current_chapter = available_chapters[chapter_index - 1]
		update_chapter_display()
		build_stage_buttons()

func _on_next_chapter_pressed() -> void:
	var chapter_index = available_chapters.find(current_chapter)
	if chapter_index < available_chapters.size() - 1:
		var next_chapter = available_chapters[chapter_index + 1]
		# Only allow navigation to unlocked chapters
		if CampaignManager.is_chapter_unlocked(next_chapter):
			current_chapter = next_chapter
			update_chapter_display()
			build_stage_buttons()

func _on_chapter_unlocked(chapter_id: String) -> void:
	"""Handles chapter unlock event and updates navigation."""
	# Rebuild the stage buttons if current chapter was unlocked
	if chapter_id == current_chapter:
		build_stage_buttons()
	# Also rebuild the chapter display to update navigation
	update_chapter_display()

func get_campaign_data(chapter_id: String) -> Dictionary:
	for campaign in CampaignManager.campaigns_data.get("campaigns", []):
		if campaign.get("id") == chapter_id:
			return campaign
	return {}

func get_campaign_stages(chapter_id: String) -> Array:
	var campaign_data = get_campaign_data(chapter_id)
	return campaign_data.get("stages", [])
