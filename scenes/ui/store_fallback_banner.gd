## Non-intrusive banner shown during store outages.
## Displays a user-friendly message and auto-hides when the store recovers.
extends PanelContainer

signal retry_pressed()

@onready var message_label: Label = $HBoxContainer/MessageLabel
@onready var retry_button: Button = $HBoxContainer/RetryButton

var _dismiss_timer: Timer = null

func _ready() -> void:
	hide()
	if retry_button:
		retry_button.pressed.connect(_on_retry_pressed)

func show_outage_message(msg: String) -> void:
	if message_label:
		message_label.text = msg
	show()
	_start_dismiss_timer()

func show_recovery() -> void:
	if message_label:
		message_label.text = "Store is back online!"
	show()
	_start_dismiss_timer(3.0)

func hide_banner() -> void:
	_stop_dismiss_timer()
	hide()

func _on_retry_pressed() -> void:
	retry_pressed.emit()

func _start_dismiss_timer(duration: float = 10.0) -> void:
	_stop_dismiss_timer()
	_dismiss_timer = Timer.new()
	_dismiss_timer.one_shot = true
	_dismiss_timer.wait_time = duration
	_dismiss_timer.timeout.connect(hide_banner)
	add_child(_dismiss_timer)
	_dismiss_timer.start()

func _stop_dismiss_timer() -> void:
	if _dismiss_timer and is_instance_valid(_dismiss_timer):
		_dismiss_timer.stop()
		_dismiss_timer.queue_free()
		_dismiss_timer = null
