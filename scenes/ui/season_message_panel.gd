## Floating panel that displays seasonal messages (tier milestones, season warnings, decay alerts).
## Queues multiple messages and auto-dismisses after a delay.
extends PanelContainer

signal message_dismissed()

# --- UI References ---
@onready var icon_label: Label = $VBoxContainer/HBoxContainer/IconLabel
@onready var message_label: Label = $VBoxContainer/HBoxContainer/MessageLabel
@onready var dismiss_button: Button = $VBoxContainer/HBoxContainer/DismissButton

# --- State ---
var _message_queue: Array = []
var _is_displaying: bool = false

# --- Priority Icons ---
const PRIORITY_ICONS: Dictionary = {
	"warning": "!",
	"achievement": "*",
	"info": "i",
}

# --- Priority Colors ---
const PRIORITY_COLORS: Dictionary = {
	"warning": Color("#FF7351"),
	"achievement": Color("#FFD700"),
	"info": Color("#6E9FFF"),
}

func _ready() -> void:
	hide()
	dismiss_button.pressed.connect(_on_dismiss_pressed)

	var messenger: Node = get_node_or_null("/root/SeasonMessenger")
	if messenger:
		messenger.season_message.connect(_on_season_message)

func _on_season_message(message: Dictionary) -> void:
	if _is_displaying:
		_message_queue.append(message)
	else:
		_display_message(message)

func _display_message(message: Dictionary) -> void:
	var priority: String = message.get("priority", "info")
	var text: String = message.get("text", "")

	icon_label.text = PRIORITY_ICONS.get(priority, "i")
	icon_label.modulate = PRIORITY_COLORS.get(priority, Color.WHITE)
	message_label.text = text

	show()
	_is_displaying = true
	_get_timer().start(6.0)

func _on_dismiss_pressed() -> void:
	_dismiss()

func _dismiss() -> void:
	_get_timer().stop()
	hide()
	_is_displaying = false
	message_dismissed.emit()

	if not _message_queue.is_empty():
		var next: Dictionary = _message_queue.pop_front()
		_display_message(next)

func _get_timer() -> Timer:
	var timer: Timer = get_node_or_null("AutoDismissTimer")
	if not timer:
		timer = Timer.new()
		timer.name = "AutoDismissTimer"
		timer.one_shot = true
		timer.timeout.connect(_dismiss)
		add_child(timer)
	return timer

func clear_queue() -> void:
	_message_queue.clear()
