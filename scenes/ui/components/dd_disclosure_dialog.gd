extends Control

## Dynamic Difficulty Disclosure Dialog (issue #915).
##
## Player-visible notice required by the ratified PRD constraint for the
## Dynamic Difficulty system. This dialog DOES NOT toggle the DD system
## client-side — it only informs the player of the server-side behavior:
## PvE-only, bounded ±20%, reward-neutral.
##
## The dialog is shown once on first PvE entry (or via Settings → "Dynamic
## Difficulty" toggle). Persistence is stored in `user://dd_disclosure.json`
## so it never re-pops after acknowledgement.

signal acknowledged()

const DISCLOSURE_FILE := "user://dd_disclosure.json"

@onready var title_label: Label = $SafeAreaContainer/VBoxContainer/TitleLabel
@onready var summary_label: RichTextLabel = $SafeAreaContainer/VBoxContainer/SummaryLabel
@onready var ok_button: Button = $SafeAreaContainer/VBoxContainer/OkButton

const DISCLOSURE_TITLE := "Dynamic Difficulty"

# Required PRD text (issue #915 acceptance criteria). Verbatim wording.
const DISCLOSURE_BODY := "Dynamic Difficulty (PvE-only, bounded ±20%%, reward-neutral).

This game adjusts enemy stats slightly based on your recent performance in
[color=#ffac54]PvE[/color] stages only. The system is:

 • [b]PvE-only[/b] — PvP matches are never affected.
 • [b]Bounded[/b] — enemy health, damage, and spawn rate can only change by
   [color=#ffac54]±20%%[/color] from their baseline values.
 • [b]Reward-neutral[/b] — XP, gold, and loot drops are never modified by
   this system. A harder run does not pay better.

You can opt out from Settings → Dynamic Difficulty at any time."


func _ready() -> void:
	_apply_theme()

	if ok_button:
		ok_button.pressed.connect(_on_ok_pressed)

	modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 1.0, 0.3)


## Static check: has the player already seen/acknowledged this disclosure?
## Used by main_menu.gd to decide whether to pop the dialog on first PvE
## entry.
static func has_acknowledged() -> bool:
	var file := FileAccess.open(DISCLOSURE_FILE, FileAccess.READ)
	if file == null:
		return false
	var content: String = file.get_as_text()
	file.close()
	var json := JSON.new()
	if json.parse(content) != OK:
		return false
	return json.data.get("acknowledged", false) == true


## Resets the disclosure acknowledgement (debug / Settings toggle).
static func reset_acknowledgement() -> void:
	if FileAccess.file_exists(DISCLOSURE_FILE):
		DirAccess.remove_absolute(DISCLOSURE_FILE)


func _on_ok_pressed() -> void:
	var data := {
		"acknowledged": true,
		"timestamp": Time.get_unix_time_from_system(),
	}
	var file := FileAccess.open(DISCLOSURE_FILE, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
		file.close()

	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 0.0, 0.2)
	tween.tween_callback(func(): acknowledged.emit())
	tween.tween_callback(queue_free)


func _apply_theme() -> void:
	if title_label:
		title_label.modulate = ArcherDesignTokens.RA_ON_SURFACE
		title_label.add_theme_font_size_override("font_size", ArcherDesignTokens.FONT_SIZE_TITLE)
	if summary_label:
		summary_label.add_theme_color_override("default_color", ArcherDesignTokens.RA_ON_SURFACE_VARIANT)
		summary_label.add_theme_font_size_override("normal_font_size", ArcherDesignTokens.FONT_SIZE_BASE)