# Screenshot Capture Script for Godot
# Attach this script to the root node of your main scene to capture screenshots.
# Usage: Press F12 to capture a screenshot, or call capture_screenshot() from code.

extends Node

## Screenshot capture script for App Store listings
## Press F12 or call capture_screenshot() to save a screenshot

@export var screenshot_path: String = "user://screenshots/"
@export var file_prefix: String = "screenshot_"
@export var auto_number: bool = true

var _screenshot_count: int = 0


func _ready() -> void:
	# Create screenshots directory if it doesn't exist
	var dir = DirAccess.open(screenshot_path)
	if dir == null:
		DirAccess.make_dir_recursive_absolute(screenshot_path)

	# Find the next available screenshot number
	if auto_number:
		_find_next_screenshot_number()


func _find_next_screenshot_number() -> void:
	var dir = DirAccess.open(screenshot_path)
	if dir:
		dir.list_dir_begin()
		var file_name = dir.get_next()
		while file_name != "":
			if file_name.begins_with(file_prefix) and file_name.ends_with(".png"):
				var num = file_name.trim_prefix(file_prefix).trim_suffix(".png").to_int()
				if num >= _screenshot_count:
					_screenshot_count = num + 1
			file_name = dir.get_next()


func _input(event: InputEvent) -> void:
	# Capture screenshot on F12 press
	if event.is_action_pressed("ui_focus_next"):  # F12 typically maps to this
		capture_screenshot()


func capture_screenshot() -> String:
	# Get the viewport image
	var viewport = get_viewport()
	var image = viewport.get_texture().get_image()

	# Generate filename
	var timestamp = Time.get_unix_time_from_system()
	var file_name = file_prefix + str(_screenshot_count).pad_zeros(4) + ".png"
	var full_path = screenshot_path + file_name

	# Save the image
	image.save_png(full_path)
	_screenshot_count += 1

	print("Screenshot saved: ", full_path)
	return full_path


# Helper function to capture specific screen types
# Call these from your game code when showing each screen

func capture_main_menu() -> String:
	print("Capturing: Main Menu")
	return capture_screenshot()


func capture_combat() -> String:
	print("Capturing: Combat Gameplay")
	return capture_screenshot()


func capture_gear_inventory() -> String:
	print("Capturing: Gear Inventory")
	return capture_screenshot()


func capture_shop() -> String:
	print("Capturing: Shop Interface")
	return capture_screenshot()


func capture_leaderboard() -> String:
	print("Capturing: PvP Leaderboard")
	return capture_screenshot()


func capture_campaign() -> String:
	print("Capturing: Campaign/Stage Selection")
	return capture_screenshot()


func capture_loadout() -> String:
	print("Capturing: Character Loadout")
	return capture_screenshot()
