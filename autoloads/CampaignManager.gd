extends Node

# --- Data ---
var campaigns_data: Dictionary = {}

# --- Progress Tracking ---
var unlocked_stages: Array = []
var completed_stages: Array = []

# --- Signals ---
signal stage_unlocked(stage_id: String)
signal stage_completed(stage_id: String)
signal campaign_progress_updated(chapter_id: String, progress: float)

func _ready() -> void:
	load_campaigns_data()
	unlocked_stages = ["1_1"]
	save_progress()

func load_campaigns_data() -> void:
	var file = FileAccess.open("res://data/campaigns.json", FileAccess.READ)
	if file:
		var json_string = file.get_as_text()
		file.close()
		var json = JSON.new()
		var parse_result = json.parse(json_string)
		if parse_result == OK:
			campaigns_data = json.data
		else:
			push_error("Failed to parse campaigns.json")

func get_stage_data(stage_id: String) -> Dictionary:
	for campaign in campaigns_data.get("campaigns", []):
		for stage in campaign.get("stages", []):
			if stage.get("id") == stage_id:
				return stage
	return {}

func complete_stage(stage_id: String) -> void:
	if not stage_id in completed_stages:
		completed_stages.append(stage_id)
		stage_completed.emit(stage_id)
		
		var stage_data = get_stage_data(stage_id)
		if stage_data.get("boss"):
			handle_boss_defeat(stage_data.get("boss"))
		
		unlock_next_stage(stage_id)
		save_progress()
		update_campaign_progress()

func is_stage_unlocked(stage_id: String) -> bool:
	return stage_id in unlocked_stages

func is_stage_completed(stage_id: String) -> bool:
	return stage_id in completed_stages

func unlock_next_stage(stage_id: String) -> void:
	var parts = stage_id.split("_")
	var current_chapter = parts[0]
	var current_stage_num = int(parts[1])
	
	var next_stage_id = "%s_%d" % [current_chapter, current_stage_num + 1]
	
	if get_stage_data(next_stage_id):
		if not next_stage_id in unlocked_stages:
			unlocked_stages.append(next_stage_id)
			stage_unlocked.emit(next_stage_id)

func handle_boss_defeat(boss_id: String) -> void:
	match boss_id:
		"boss_wind":
			unlock_modifier_pool("piercing_arrow")

func unlock_modifier_pool(modifier_id: String) -> void:
	print("Unlocked modifier pool: %s" % modifier_id)
	pass

func update_campaign_progress() -> void:
	for campaign in campaigns_data.get("campaigns", []):
		var chapter_id = campaign.id
		var total_stages = campaign.get("stages", []).size()
		var completed_in_chapter = 0
		
		for stage in campaign.get("stages", []):
			if stage.id in completed_stages:
				completed_in_chapter += 1
		
		var progress = float(completed_in_chapter) / float(total_stages)
		campaign_progress_updated.emit(chapter_id, progress)

func save_progress() -> void:
	var save_data = {
		"unlocked_stages": unlocked_stages,
		"completed_stages": completed_stages
	}
	var file = FileAccess.open("user://campaign_progress.json", FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(save_data))
		file.close()

func load_progress() -> void:
	var file = FileAccess.open("user://campaign_progress.json", FileAccess.READ)
	if file:
		var json_string = file.get_as_text()
		file.close()
		var json = JSON.new()
		var parse_result = json.parse(json_string)
		if parse_result == OK:
			var save_data = json.data
			unlocked_stages = save_data.get("unlocked_stages", [])
			completed_stages = save_data.get("completed_stages", [])
