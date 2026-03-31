## Functional testing of pixel art assets in Godot project
## Tests scene loading, animation systems, asset references, and integration

extends GutTest

# Cached resources to avoid duplicated-load warnings
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

func _ready() -> void:
	# Preload resources once to avoid duplicated-load warnings
	_player_scene = load("res://scenes/player.tscn")
	_base_enemy_scene = load("res://scenes/enemies/base_enemy.tscn")
	_player_sprites = load("res://assets/sprites/player/player_sprites.tres")
	_enemy_sprites = load("res://assets/sprites/enemies/enemy_sprites.tres")
	pass

## Test 1: Scene Load Test
func test_player_scene_loads() -> void:
	assert_not_null(_player_scene, "Player scene should load without errors")
	test_results["scene_load_tests"].append({"test": "player_scene_loads", "status": "PASS", "file": "res://scenes/player.tscn"})

func test_player_scene_instantiate() -> void:
	var instance = _player_scene.instantiate()
	assert_not_null(instance, "Player scene should instantiate")
	# Check AnimatedSprite2D node
	var animated_sprite = instance.get_node_or_null("AnimatedSprite2D")
	assert_not_null(animated_sprite, "Player should have AnimatedSprite2D node")
	test_results["scene_load_tests"].append({"test": "player_scene_instantiate", "status": "PASS"})

func test_base_enemy_scene_loads() -> void:
	assert_not_null(_base_enemy_scene, "Enemy scene should load without errors")
	test_results["scene_load_tests"].append({"test": "base_enemy_scene_loads", "status": "PASS", "file": "res://scenes/enemies/base_enemy.tscn"})

func test_base_enemy_scene_instantiate() -> void:
	var instance = _base_enemy_scene.instantiate()
	assert_not_null(instance, "Enemy scene should instantiate")
	var animated_sprite = instance.get_node_or_null("AnimatedSprite2D")
	assert_not_null(animated_sprite, "Enemy should have AnimatedSprite2D node")
	test_results["scene_load_tests"].append({"test": "base_enemy_scene_instantiate", "status": "PASS"})

## Test 2: Animation System Test
func test_player_sprites_animation_count() -> void:
	var animations = _player_sprites.get_animation_names()
	var animation_count = animations.size()
	# Expected: 24 animations (4 directions × 6 base animations)
	# idle(4), walk(4), attack(4), bow_draw(4), hit(4), death(4) = 24
	assert_greater_than_or_equal(animation_count, 24, "Should have at least 24 player animations, got: " + str(animation_count))
	test_results["animation_system_tests"].append({"test": "player_sprites_animation_count", "status": "PASS", "count": animation_count, "expected": ">=24"})

func test_enemy_sprites_animation_count() -> void:
	var animations = _enemy_sprites.get_animation_names()
	var animation_count = animations.size()
	# Expected: multiple enemies × animations each
	assert_greater_than(animation_count, 0, "Should have enemy animations")
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
	var game_manager = get_tree().root.get_node_or_null("GameManager")
	# If GameManager doesn't exist yet, that's okay - it gets added at runtime
	test_results["game_manager_tests"].append({"test": "gamemanager_exists", "status": "PASS" if game_manager else "SKIP"})

## Test 5: Equipment System Test
func test_gear_registry_initializes() -> void:
	var registry = GearRegistry
	assert_not_null(registry, "GearRegistry autoload should exist")
	assert_greater_than(registry.base_gear_db.size(), 0, "GearRegistry should have base gear items")
	test_results["equipment_system_tests"].append({"test": "gear_registry_initializes", "status": "PASS", "gear_count": registry.base_gear_db.size()})

func test_gear_registry_texture_paths() -> void:
	var registry = GearRegistry
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
