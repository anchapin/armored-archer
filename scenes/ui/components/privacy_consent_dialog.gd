extends Control

## First-launch privacy consent dialog (GDPR/CCPA compliance).
## Shows a summary of data practices and requires user acceptance
## before any data collection begins.

signal consent_given()

const CONSENT_FILE := "user://privacy_consent.json"
const PRIVACY_POLICY_URL := "https://anchapin.github.io/armored-archer/docs/privacy-policy.html"

@onready var accept_button: ArcheryBaseButton = $SafeAreaContainer/VBoxContainer/AcceptButton
@onready var view_policy_button: ArcheryBaseButton = $SafeAreaContainer/VBoxContainer/ViewPolicyButton
@onready var title_label: Label = $SafeAreaContainer/VBoxContainer/TitleLabel
@onready var summary_label: RichTextLabel = $SafeAreaContainer/VBoxContainer/SummaryLabel


func _ready() -> void:
	_apply_theme()

	accept_button.pressed.connect(_on_accept_pressed)
	view_policy_button.pressed.connect(_on_view_policy_pressed)

	modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 1.0, 0.3)


static func has_consented() -> bool:
	var file := FileAccess.open(CONSENT_FILE, FileAccess.READ)
	if file == null:
		return false
	var content: String = file.get_as_text()
	file.close()
	var json := JSON.new()
	if json.parse(content) != OK:
		return false
	return json.data.get("consented", false) == true


func _on_accept_pressed() -> void:
	var data := {
		"consented": true,
		"timestamp": Time.get_unix_time_from_system(),
	}
	var file := FileAccess.open(CONSENT_FILE, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
		file.close()

	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 0.0, 0.2)
	tween.tween_callback(func(): consent_given.emit())
	tween.tween_callback(queue_free)


func _on_view_policy_pressed() -> void:
	OS.shell_open(PRIVACY_POLICY_URL)


func _apply_theme() -> void:
	if title_label:
		title_label.modulate = ArcherDesignTokens.RA_ON_SURFACE
		title_label.add_theme_font_size_override("font_size", ArcherDesignTokens.FONT_SIZE_TITLE)
	if summary_label:
		summary_label.add_theme_color_override("default_color", ArcherDesignTokens.RA_ON_SURFACE_VARIANT)
		summary_label.add_theme_font_size_override("normal_font_size", ArcherDesignTokens.FONT_SIZE_BASE)
