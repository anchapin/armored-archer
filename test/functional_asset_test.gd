## Functional testing of pixel art assets in Godot project
## Tests scene loading, animation systems, asset references, and integration.
##
## Converted to the GUT lifecycle for issue #1852:
##   * resources are loaded in `before_each()` instead of `_ready()`, so the
##     suite no longer depends on the runner calling `_ready()`;
##   * the stale node-name assertions were rewritten against the nodes the
##     current scenes actually ship (the player names its animated body
##     "BodySprite"; the base enemy uses a plain "Sprite2D");
##   * `test_gamemanager_exists` now makes a real assertion instead of
##     recording a PASS without asserting anything.

extends GutTest

const PLAYER_SCENE_PATH := "res://scenes/player.tscn"
const BASE_ENEMY_SCENE_PATH := "res://scenes/enemies/base_enemy.tscn"
const PLAYER_SPRITES_PATH := "res://assets/sprites/player/player_sprites.tres"
const ENEMY_SPRITES_PATH := "res://assets/sprites/enemies/enemy_sprites.tres"

# Cached resources to avoid duplicated-load warnings (refreshed per test).
var _player_scene: PackedScene
var _base_enemy_scene: PackedScene
var _player_sprites: SpriteFrames
var _enemy_sprites: SpriteFrames

var test_results: Dictionary = {
	"scene_load_tests": [],
	"animation_system_tests": [],
	"asset_reference_tests": [],
	"game_manager_tests": [],
	"equipment_system_tests": [],
	"summary": {
		"total_tests": 0,
		"passed": 0,
		"failed": 0,
		"errors": []
	}
}

func before_each() -> void:
	# GUT lifecycle hook: load the resources once per test so the suite works
	# regardless of how the runner instantiates the script.
	_player_scene = load(PLAYER_SCENE_PATH) as PackedScene
	_base_enemy_scene = load(BASE_ENEMY_SCENE_PATH) as PackedScene
	_player_sprites = load(PLAYER_SPRITES_PATH) as SpriteFrames
	_enemy_sprites = load(ENEMY_SPRITES_PATH) as SpriteFrames

## Test 1: Scene Load Test
func test_player_scene_loads() -> void:
	assert_not_null(_player_scene, "Player scene should load without errors")
	test_results["scene_load_tests"].append({"test": "player_scene_loads", "status": "PASS", "file": PLAYER_SCENE_PATH})

func test_player_scene_instantiate() -> void:
	assert_not_null(_player_scene, "Player scene should load without errors")
	var instance = _player_scene.instantiate()
	assert_not_null(instance, "Player scene should instantiate")
	# The player scene names its animated body node "BodySprite".
	var body_sprite = instance.get_node_or_null("BodySprite")
	assert_not_null(body_sprite, "Player should have a BodySprite node")
	assert_true(body_sprite is Node2D, "Player BodySprite should be a 2D node")
	var sprite_frames = body_sprite.get("sprite_frames")
	assert_not_null(sprite_frames, "Player BodySprite should be assigned a SpriteFrames resource")
	instance.free()
	test_results["scene_load_tests"].append({"test": "player_scene_instantiate", "status": "PASS"})

func test_base_enemy_scene_loads() -> void:
	assert_not_null(_base_enemy_scene, "Enemy scene should load without errors")
	test_results["scene_load_tests"].append({"test": "base_enemy_scene_loads", "status": "PASS", "file": BASE_ENEMY_SCENE_PATH})

func test_base_enemy_scene_instantiate() -> void:
	assert_not_null(_base_enemy_scene, "Enemy scene should load without errors")
	var instance = _base_enemy_scene.instantiate()
	assert_not_null(instance, "Enemy scene should instantiate")
	# The base enemy scene ships a plain "Sprite2D" visual, not an animated one.
	var enemy_sprite = instance.get_node_or_null("Sprite2D")
	assert_not_null(enemy_sprite, "Enemy should have a Sprite2D node")
	assert_true(enemy_sprite is Sprite2D, "Enemy visual node should be a Sprite2D")
	assert_not_null(enemy_sprite.texture, "Enemy Sprite2D should have a texture assigned")
	instance.free()
	test_results["scene_load_tests"].append({"test": "base_enemy_scene_instantiate", "status": "PASS"})

## Test 2: Animation System Test
func test_player_sprites_load_as_sprite_frames() -> void:
	# The legacy-format player_sprites.tres is still a Godot 4 SpriteFrames
	# resource; assert that contract explicitly instead of casting blindly.
	assert_not_null(_player_sprites, "player_sprites.tres should load")
	assert_true(_player_sprites is SpriteFrames, "player_sprites.tres should load as a SpriteFrames resource")

func test_enemy_sprites_load_as_sprite_frames() -> void:
	assert_not_null(_enemy_sprites, "enemy_sprites.tres should load")
	assert_true(_enemy_sprites is SpriteFrames, "enemy_sprites.tres should load as a SpriteFrames resource")

func test_player_sprites_animation_count() -> void:
	assert_not_null(_player_sprites, "player_sprites.tres should load")
	var animations = _player_sprites.get_animation_names()
	var animation_count = animations.size()
	# Expected: 24 animations (4 directions × 6 base animations)
	# idle(4), walk(4), attack(4), bow_draw(4), hit(4), death(4) = 24
	assert_true(animation_count >= 24, "Should have at least 24 player animations, got: " + str(animation_count))
	test_results["animation_system_tests"].append({"test": "player_sprites_animation_count", "status": "PASS", "count": animation_count, "expected": ">=24"})

func test_enemy_sprites_animation_count() -> void:
	assert_not_null(_enemy_sprites, "enemy_sprites.tres should load")
	var animations = _enemy_sprites.get_animation_names()
	var animation_count = animations.size()
	# Expected: multiple enemies × animations each
	assert_true(animation_count > 0, "Should have enemy animations")
	test_results["animation_system_tests"].append({"test": "enemy_sprites_animation_count", "status": "PASS", "count": animation_count})

func test_player_animation_fps_settings() -> void:
	var test_animations = ["idle_down", "walk_down", "attack_down", "bow_draw_down"]
	var expected_fps = {"idle_down": 8.0, "walk_down": 12.0, "attack_down": 10.0, "bow_draw_down": 8.0}
	
	for anim_name in test_animations:
		var fps = _player_sprites.get_animation_speed(anim_name)
		var expected = expected_fps.get(anim_name, 0.0)
		assert_eq(fps, expected, "Animation %s should have FPS %f, got %f" % [anim_name, expected, fps])
	
	test_results["animation_system_tests"].append({"test": "player_animation_fps_settings", "status": "PASS", "animations_checked": test_animations.size()})

func test_player_animation_loop_settings() -> void:
	var loop_animations = {"idle_down": true, "walk_down": true, "attack_down": false, "bow_draw_down": true}
	
	for anim_name in loop_animations.keys():
		var should_loop = loop_animations[anim_name]
		var is_looping = _player_sprites.get_animation_loop(anim_name)
		assert_eq(is_looping, should_loop, "Animation %s loop should be %s, got %s" % [anim_name, should_loop, is_looping])
	
	test_results["animation_system_tests"].append({"test": "player_animation_loop_settings", "status": "PASS", "animations_checked": loop_animations.size()})

## Test 3: Asset Reference Test
func test_player_png_files_exist() -> void:
	assert_not_null(_player_sprites, "player_sprites.tres should load")
	var animations = _player_sprites.get_animation_names()
	var missing_files = []
	var loaded_count = 0
	
	for anim_name in animations:
		var frame_count = _player_sprites.get_frame_count(anim_name)
		for frame_idx in range(frame_count):
			var texture = _player_sprites.get_frame_texture(anim_name, frame_idx)
			if texture == null:
				missing_files.append(anim_name + "[" + str(frame_idx) + "]")
			else:
				loaded_count += 1
	
	assert_eq(missing_files.size(), 0, "All player PNG files should be accessible. Missing: " + str(missing_files))
	test_results["asset_reference_tests"].append({"test": "player_png_files_exist", "status": "PASS", "loaded_textures": loaded_count})

func test_enemy_tres_files_exist() -> void:
	assert_not_null(_enemy_sprites, "enemy_sprites.tres should load")
	var animations = _enemy_sprites.get_animation_names()
	var missing_files = []
	var loaded_count = 0
	
	for anim_name in animations:
		var frame_count = _enemy_sprites.get_frame_count(anim_name)
		for frame_idx in range(frame_count):
			var texture = _enemy_sprites.get_frame_texture(anim_name, frame_idx)
			if texture == null:
				missing_files.append(anim_name + "[" + str(frame_idx) + "]")
			else:
				loaded_count += 1
	
	assert_eq(missing_files.size(), 0, "All enemy texture files should be accessible. Missing: " + str(missing_files))
	test_results["asset_reference_tests"].append({"test": "enemy_tres_files_exist", "status": "PASS", "loaded_textures": loaded_count})

## Test 4: Game Manager Integration Test
func test_gamemanager_exists() -> void:
	# GameManager is a registered autoload (see project.godot), so it must be
	# present under the scene tree root while the suite runs.
	var game_manager = get_tree().root.get_node_or_null("GameManager")
	assert_not_null(game_manager, "GameManager autoload should be present in the scene tree root")
	test_results["game_manager_tests"].append({"test": "gamemanager_exists", "status": "PASS"})

## Test 5: Equipment System Test
func test_gear_registry_initializes() -> void:
	var registry = GearRegistry
	assert_not_null(registry, "GearRegistry autoload should exist")
	assert_true(registry.base_gear_db.size() > 0, "GearRegistry should have base gear items")
	test_results["equipment_system_tests"].append({"test": "gear_registry_initializes", "status": "PASS", "gear_count": registry.base_gear_db.size()})

func test_gear_registry_texture_paths() -> void:
	var registry = GearRegistry
	assert_not_null(registry, "GearRegistry autoload should exist")
	var missing_textures = []
	var loaded_count = 0
	
	for gear_id in registry.base_gear_db.keys():
		var gear_data = registry.base_gear_db[gear_id]
		if gear_data.base_texture == null:
			missing_textures.append(gear_id)
		else:
			loaded_count += 1
	
	assert_eq(missing_textures.size(), 0, "All gear textures should load. Missing: " + str(missing_textures))
	test_results["equipment_system_tests"].append({"test": "gear_registry_texture_paths", "status": "PASS", "loaded_textures": loaded_count})

## Utility function to generate report
func generate_test_report() -> String:
	var report = "\n" + "=".repeat(80) + "\n"
	report += "PIXEL ART ASSET FUNCTIONAL TEST REPORT\n"
	report += "=".repeat(80) + "\n\n"
	
	var total = 0
	var passed = 0
	var failed = 0
	
	# Scene Load Tests
	report += "1. SCENE LOAD TESTS\n"
	report += "-".repeat(80) + "\n"
	for test in test_results["scene_load_tests"]:
		report += "   [%s] %s\n" % [test["status"], test["test"]]
		if test["status"] == "PASS":
			passed += 1
		else:
			failed += 1
		total += 1
	report += "\n"
	
	# Animation System Tests
	report += "2. ANIMATION SYSTEM TESTS\n"
	report += "-".repeat(80) + "\n"
	for test in test_results["animation_system_tests"]:
		var extra = ""
		if test.has("count"):
			extra = " (Count: %d, Expected: %s)" % [test["count"], test.get("expected", "N/A")]
		report += "   [%s] %s%s\n" % [test["status"], test["test"], extra]
		if test["status"] == "PASS":
			passed += 1
		else:
			failed += 1
		total += 1
	report += "\n"
	
	# Asset Reference Tests
	report += "3. ASSET REFERENCE TESTS\n"
	report += "-".repeat(80) + "\n"
	for test in test_results["asset_reference_tests"]:
		var extra = ""
		if test.has("loaded_textures"):
			extra = " (Loaded: %d textures)" % test["loaded_textures"]
		report += "   [%s] %s%s\n" % [test["status"], test["test"], extra]
		if test["status"] == "PASS":
			passed += 1
		else:
			failed += 1
		total += 1
	report += "\n"
	
	# Equipment System Tests
	report += "4. EQUIPMENT SYSTEM TESTS\n"
	report += "-".repeat(80) + "\n"
	for test in test_results["equipment_system_tests"]:
		var extra = ""
		if test.has("gear_count"):
			extra = " (Gear Items: %d)" % test["gear_count"]
		if test.has("loaded_textures"):
			extra = " (Loaded: %d textures)" % test["loaded_textures"]
		report += "   [%s] %s%s\n" % [test["status"], test["test"], extra]
		if test["status"] == "PASS":
			passed += 1
		else:
			failed += 1
		total += 1
	report += "\n"
	
	# Summary
	report += "=".repeat(80) + "\n"
	report += "SUMMARY\n"
	report += "-".repeat(80) + "\n"
	report += "Total Tests: %d\n" % total
	report += "Passed: %d\n" % passed
	report += "Failed: %d\n" % failed
	var status = "READY FOR GAMEPLAY" if failed == 0 else "NEEDS FIXES"
	report += "Status: %s\n" % status
	report += "=".repeat(80) + "\n"
	
	return report
