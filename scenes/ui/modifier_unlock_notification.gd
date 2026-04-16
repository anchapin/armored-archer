## Displays notifications for newly unlocked modifier pools.
##
## This panel shows a visual notification when the player unlocks new modifier pools
## through boss defeats or other progression events.
##
extends PanelContainer

signal notification_dismissed()

@onready var title_label: Label = $VBoxContainer/TitleLabel
@onready var content_label: Label = $VBoxContainer/ContentLabel
@onready var dismiss_button: Button = $VBoxContainer/DismissButton

var notification_queue: Array = []
var current_notification: Dictionary = {}
var is_displaying: bool = false

# Modifier pool names for display
var MODIFIER_NAMES: Dictionary = {
	"piercing_arrow": "Piercing Arrow",
	"heavy_impact": "Heavy Impact",
	"vitality_boost": "Vitality Boost",
	"wind_fury": "Wind Fury",
	"fortification": "Fortification",
	"fire_arrow": "Fire Arrow",
	"lightning_damage": "Lightning Damage",
	"ice_arrow": "Ice Arrow",
	"earth_arrow": "Earth Arrow",
	"iron_forged": "Iron Forged",
	"royal_blessing": "Royal Blessing",
	"nightmare_essence": "Nightmare Essence",
	"shadow_touched": "Shadow Touched",
}

func _ready() -> void:
	"""Initializes the notification panel."""
	hide()
	dismiss_button.pressed.connect(_on_dismiss_pressed)

	# Connect to CampaignManager for modifier pool unlocks
	if CampaignManager:
		if CampaignManager.has_signal("modifier_pool_unlocked"):
			CampaignManager.modifier_pool_unlocked.connect(_on_modifier_pool_unlocked)

func show_notification(modifier_id: String, unlock_source: String = "") -> void:
	"""Shows a notification for a newly unlocked modifier pool.

	Parameters:
		modifier_id: ID of the unlocked modifier pool
		unlock_source: Optional source of the unlock (e.g., boss name)
	"""
	var notification = {
		"modifier_id": modifier_id,
		"unlock_source": unlock_source
	}

	if is_displaying:
		notification_queue.append(notification)
	else:
		_display_notification(notification)

func _display_notification(notification: Dictionary) -> void:
	"""Displays a notification on the panel.

	Parameters:
		notification: Dictionary containing modifier_id and unlock_source
	"""
	current_notification = notification
	var modifier_id = notification.get("modifier_id", "")
	var unlock_source = notification.get("unlock_source", "")

	var modifier_name = MODIFIER_NAMES.get(modifier_id, modifier_id.to_pascal_case())
	var source_text = ""
	if not unlock_source.is_empty():
		source_text = "\nDefeated: %s" % unlock_source.to_pascal_case()

	title_label.text = "New Modifier Pool Unlocked!"
	content_label.text = "%s%s\n\nAvailable for gear drops!" % [modifier_name, source_text]

	show()
	is_displaying = true

	# Auto-dismiss after 5 seconds
	_get_notification_timer().start(5.0)

func _on_dismiss_pressed() -> void:
	"""Handles dismiss button press."""
	_dismiss_current_notification()

func _dismiss_current_notification() -> void:
	"""Dismisses the current notification and shows the next one if available."""
	_get_notification_timer().stop()
	hide()
	is_displaying = false
	notification_dismissed.emit()

	if not notification_queue.is_empty():
		var next_notification = notification_queue.pop_front()
		_display_notification(next_notification)

func _on_modifier_pool_unlocked(modifier_id: String) -> void:
	"""Handles modifier pool unlock signal from CampaignManager.

	Parameters:
		modifier_id: ID of the unlocked modifier pool
	"""
	show_notification(modifier_id)

func _get_notification_timer() -> Timer:
	"""Gets or creates the notification timer.

	Returns:
		Timer: The notification timer
	"""
	var timer = get_node_or_null("NotificationTimer")
	if not timer:
		timer = Timer.new()
		timer.name = "NotificationTimer"
		timer.wait_time = 5.0
		timer.one_shot = true
		timer.timeout.connect(_dismiss_current_notification)
		add_child(timer)
	return timer

## Clears all pending notifications.
func clear_queue() -> void:
	"""Clears all pending notifications."""
	notification_queue.clear()
