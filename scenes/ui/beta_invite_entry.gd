extends Control

## Invite code entry screen for beta registration.
## Validates BETA-XXXX-XXXX-XXXX format codes via backend RPC.

signal code_accepted()
signal skipped()

@onready var code_input: LineEdit = $SafeAreaContainer/VBoxContainer/CodeInput
@onready var submit_button: ArcheryBaseButton = $SafeAreaContainer/VBoxContainer/SubmitButton
@onready var skip_button: ArcheryBaseButton = $SafeAreaContainer/VBoxContainer/SkipButton
@onready var error_label: Label = $SafeAreaContainer/VBoxContainer/ErrorLabel
@onready var title_label: Label = $SafeAreaContainer/VBoxContainer/TitleLabel


func _ready() -> void:
	_apply_theme()
	submit_button.pressed.connect(_on_submit_pressed)
	skip_button.pressed.connect(_on_skip_pressed)

	modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 1.0, 0.3)


func _on_submit_pressed() -> void:
	var code: String = code_input.text.strip_edges().to_upper()
	if not _is_valid_format(code):
		_show_error("Invalid format. Use BETA-XXXX-XXXX-XXXX")
		return

	submit_button.disabled = true
	error_label.visible = false

	var network_manager := get_node_or_null("/root/NetworkManager")
	if network_manager and network_manager.has_method("register_beta_invite"):
		var result = await network_manager.register_beta_invite(code)
		if result and result.get("success", false):
			code_accepted.emit()
			queue_free()
		else:
			_show_error(result.get("error", "Invalid or expired invite code") if result else "Connection error")
			submit_button.disabled = false
	else:
		_show_error("Unable to connect to server")
		submit_button.disabled = false


func _on_skip_pressed() -> void:
	skipped.emit()
	queue_free()


func _is_valid_format(code: String) -> bool:
	var pattern := RegEx.create_from_string("^BETA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$")
	return pattern.search(code) != null


func _show_error(message: String) -> void:
	if error_label:
		error_label.text = message
		error_label.visible = true


func _apply_theme() -> void:
	if title_label:
		title_label.modulate = ArcherDesignTokens.RA_PRIMARY
		title_label.add_theme_font_size_override("font_size", ArcherDesignTokens.FONT_SIZE_TITLE)
	if error_label:
		error_label.modulate = ArcherDesignTokens.RA_ERROR
	if code_input:
		code_input.placeholder_text = "BETA-XXXX-XXXX-XXXX"
		code_input.custom_minimum_size = Vector2(0, 44)
