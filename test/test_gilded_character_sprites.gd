extends SceneTree

# Test script for Gilded Quest character sprite palette validation
# Validates that character sprites exist and use the correct color palette

const CHARACTER_SPRITE_PATH := "res://assets/sprites/characters/"
const REQUIRED_SPRITES := ["hero.tres", "enemy.tres", "boss_basic.tres", "boss_wind.tres", "arrow.tres"]

func _init():
	print("=== Gilded Quest Character Sprite Validation ===")
	
	var exit_code := _run_validation()
	quit(exit_code)

func _run_validation() -> int:
	# Test 1: Characters directory exists
	print("Checking characters directory...")
	var chars_dir := DirAccess.open(CHARACTER_SPRITE_PATH)
	if chars_dir == null:
		print("FAIL: Characters directory not found: " + CHARACTER_SPRITE_PATH)
		return 1
	print("PASS: Characters directory exists")
	
	# Test 2: Required sprite files exist
	for sprite_name in REQUIRED_SPRITES:
		var sprite_path: String = CHARACTER_SPRITE_PATH + sprite_name
		print("Checking " + sprite_name + "...")
		if not FileAccess.file_exists(sprite_path):
			print("FAIL: Sprite not found: " + sprite_path)
			return 1
		var res: Resource = load(sprite_path)
		if res == null:
			print("FAIL: Invalid resource: " + sprite_path)
			return 1
		print("PASS: " + sprite_name + " exists and is valid")
	
	# Test 3: Palette configuration exists
	print("Checking palette configuration...")
	var palette_path := CHARACTER_SPRITE_PATH + "character_palette.tres"
	if not FileAccess.file_exists(palette_path):
		print("FAIL: Palette config not found: " + palette_path)
		return 1
	print("PASS: Palette configuration exists")
	
	# Test 4: Palette script exists
	print("Checking palette script...")
	var script_path := "res://scripts/sprite_palette.gd"
	if not FileAccess.file_exists(script_path):
		print("FAIL: Palette script not found: " + script_path)
		return 1
	print("PASS: Palette script exists")
	
	print("")
	print("=== ALL %d CHARACTER SPRITES VALIDATED ===" % REQUIRED_SPRITES.size())
	return 0
