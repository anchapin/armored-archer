extends Control

## Beta welcome screen shown to beta users on first launch.
## Displays beta guidelines and invite code.

signal dismissed()

const BETA_ONBOARDING_FILE := "user://beta_onboarding.json"

@onready var title_label: Label = $SafeAreaContainer/VBoxContainer/TitleLabel
@onready var guidelines_label: RichTextLabel = $SafeAreaContainer/VBoxContainer/GuidelinesLabel
@onready var invite_code_label: Label = $SafeAreaContainer/VBoxContainer/InviteCodeContainer/InviteCodeLabel
@onready var dismiss_button: ArcheryBaseButton = $SafeAreaContainer/VBoxContainer/DismissButton


func _ready() -> void:
	_apply_theme()
	dismiss_button.pressed.connect(_on_dismiss_pressed)
	_fetch_invite_code()

	modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 1.0, 0.3)


static func has_seen_welcome() -> bool:
	var file := FileAccess.open(BETA_ONBOARDING_FILE, FileAccess.READ)
	if file == null:
		return false
	var content: String = file.get_as_text()
	file.close()
	var json := JSON.new()
	if json.parse(content) != OK:
		return false
	return json.data.get("welcome_shown", false) == true


func set_invite_code(code: String) -> void:
	if invite_code_label:
		invite_code_label.text = code


func _on_dismiss_pressed() -> void:
	var data := {
		"welcome_shown": true,
		"timestamp": Time.get_unix_time_from_system(),
	}
	var file := FileAccess.open(BETA_ONBOARDING_FILE, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
		file.close()

	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 0.0, 0.2)
	tween.tween_callback(func(): dismissed.emit())
	tween.tween_callback(queue_free)


func _fetch_invite_code() -> void:
	var network_manager := get_node_or_null("/root/NetworkManager")
	if network_manager and network_manager.has_method("get_beta_profile"):
		var profile = await network_manager.get_beta_profile()
		if profile and profile.has("invite_code"):
			set_invite_code(profile["invite_code"])
			return
	if invite_code_label:
		invite_code_label.text = "N/A"


func _apply_theme() -> void:
	if title_label:
		title_label.modulate = ArcherDesignTokens.RA_PRIMARY
		title_label.add_theme_font_size_override("font_size", ArcherDesignTokens.FONT_SIZE_TITLE)
	if guidelines_label:
		guidelines_label.add_theme_color_override("default_color", ArcherDesignTokens.RA_ON_SURFACE_VARIANT)
		guidelines_label.add_theme_font_size_override("normal_font_size", ArcherDesignTokens.FONT_SIZE_BASE)
	if invite_code_label:
		invite_code_label.modulate = ArcherDesignTokens.RA_PRIMARY
