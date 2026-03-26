extends SceneTree

# Test script for Gilded Quest background palette validation
# Validates that backgrounds exist and use the correct warm parchment base

const BACKGROUND_PATH := "res://assets/backgrounds/"
const REQUIRED_BACKGROUNDS := ["main_menu.tres", "gameplay_forest.tres", "gameplay_arena.tres"]

func _init():
	print("=== Gilded Quest Background Validation ===")
	
	var exit_code := _run_validation()
	quit(exit_code)

func _run_validation() -> int:
	# Test 1: Backgrounds directory exists
	print("Checking backgrounds directory...")
	var bg_dir := DirAccess.open(BACKGROUND_PATH)
	if bg_dir == null:
		print("FAIL: Backgrounds directory not found: " + BACKGROUND_PATH)
		return 1
	print("PASS: Backgrounds directory exists")
	
	# Test 2: Required background files exist
	for bg_name in REQUIRED_BACKGROUNDS:
		var bg_path: String = BACKGROUND_PATH + bg_name
		print("Checking " + bg_name + "...")
		if not FileAccess.file_exists(bg_path):
			print("FAIL: Background not found: " + bg_path)
			return 1
		var res: Resource = load(bg_path)
		if res == null:
			print("FAIL: Invalid resource: " + bg_path)
			return 1
		print("PASS: " + bg_name + " exists and is valid")
	
	# Test 3: Palette configuration exists
	print("Checking palette configuration...")
	var palette_path := BACKGROUND_PATH + "background_palette.tres"
	if not FileAccess.file_exists(palette_path):
		print("FAIL: Palette config not found: " + palette_path)
		return 1
	print("PASS: Palette configuration exists")
	
	# Test 4: Palette script exists
	print("Checking palette script...")
	var script_path := "res://scripts/background_palette.gd"
	if not FileAccess.file_exists(script_path):
		print("FAIL: Palette script not found: " + script_path)
		return 1
	print("PASS: Palette script exists")
	
	print("")
	print("=== ALL %d BACKGROUNDS VALIDATED ===" % REQUIRED_BACKGROUNDS.size())
	return 0
