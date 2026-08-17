extends GutTest

## GUT tests for issue #913 — SpriteFrames + AnimatedSprite2D infrastructure for
## the 7 Ch1 cast + death animation completion + boss intro on spawn.
##
## These tests assert the *infrastructure* is in place (correct node types,
## required animation names, wiring). Frames are placeholder/empty until the
## #912 art procurement lands; the tests must not depend on real art.

const _CH1_CHARACTERS: Dictionary = {
	"player_archer": "res://scenes/player.tscn",
	"goblin_scout": "res://scenes/enemies/scout_enemy.tscn",
	"wolf_pack": "res://scenes/enemies/swarmer_enemy.tscn",
	"forest_guardian": "res://scenes/enemies/guardian_enemy.tscn",
	"wind_elemental": "res://scenes/enemies/elemental_enemy.tscn",
	"boss_basic": "res://scenes/enemies/bosses/boss_basic.tscn",
	"boss_wind": "res://scenes/enemies/bosses/boss_wind.tscn",
}

# Per-character required animation names (subset of acceptance criteria).
const _REQUIRED_ANIMS: Dictionary = {
	"player_archer": ["idle", "draw", "release", "walk", "death"],
	"goblin_scout": ["idle", "walk", "attack", "death"],
	"wolf_pack": ["idle", "walk", "attack", "death"],
	"forest_guardian": ["idle", "walk", "attack", "death"],
	"wind_elemental": ["idle", "walk", "attack", "death"],
	"boss_basic": ["idle", "intro", "attack", "death"],
	"boss_wind": ["idle", "intro", "attack", "death"],
}

func test_all_ch1_characters_have_animated_sprite() -> void:
	# Acceptance: "All 7 Ch1 characters render via AnimatedSprite2D".
	for character_name in _CH1_CHARACTERS:
		var scene_path: String = _CH1_CHARACTERS[character_name]
		assert_true(ResourceLoader.exists(scene_path), "Scene exists: %s" % scene_path)
		var packed: PackedScene = load(scene_path)
		assert_not_null(packed, "PackedScene loads: %s" % scene_path)
		var instance: Node = packed.instantiate()
		add_child_autofree(instance)

		var animated_sprite: AnimatedSprite2D = _find_animated_sprite(instance)
		assert_not_null(animated_sprite, "%s must have an AnimatedSprite2D child" % character_name)

func test_required_animations_defined_per_character() -> void:
	# Acceptance: each SpriteFrames resource has the expected animation names.
	for character_name in _CH1_CHARACTERS:
		var scene_path: String = _CH1_CHARACTERS[character_name]
		var packed: PackedScene = load(scene_path)
		var instance: Node = packed.instantiate()
		add_child_autofree(instance)

		var animated_sprite: AnimatedSprite2D = _find_animated_sprite(instance)
		if not animated_sprite or not animated_sprite.sprite_frames:
			fail_test("%s has no SpriteFrames" % character_name)
			continue
		var frames: SpriteFrames = animated_sprite.sprite_frames
		var required: Array = _REQUIRED_ANIMS[character_name]
		for anim_name in required:
			assert_true(frames.has_animation(anim_name),
				"%s must define animation '%s'" % [character_name, anim_name])

func test_base_enemy_waits_for_death_animation() -> void:
	# Acceptance: "Death: anim completes before queue_free (no instant pops)".
	# We assert the script structure rather than running the full death pipeline
	# (which requires pool/spawner autoloads). The await on animation_finished
	# is what guarantees the body isn't freed mid-animation.
	var script: GDScript = load("res://scenes/enemies/base_enemy.gd")
	assert_not_null(script, "base_enemy.gd must load")
	var source: String = script.get_source_code()
	assert_true(source.contains("await animated_sprite.animation_finished"),
		"base_enemy.gd must await AnimatedSprite2D.animation_finished during death")
	assert_true(source.contains("play_death_animation"),
		"base_enemy.gd must expose play_death_animation()")
	assert_true(source.contains("&\"death\""),
		"base_enemy.gd must reference the 'death' animation name")

func test_boss_intro_animations_defined_on_boss_basic_and_boss_wind() -> void:
	# Acceptance: "Boss intro animation plays on spawn for 1_3/1_4".
	for boss_name in ["boss_basic", "boss_wind"]:
		var scene_path: String = _CH1_CHARACTERS[boss_name]
		var packed: PackedScene = load(scene_path)
		var instance: Node = packed.instantiate()
		add_child_autofree(instance)
		var animated_sprite: AnimatedSprite2D = _find_animated_sprite(instance)
		assert_not_null(animated_sprite, "%s must have an AnimatedSprite2D" % boss_name)
		assert_true(animated_sprite.sprite_frames.has_animation(&"intro"),
			"%s SpriteFrames must define 'intro' animation" % boss_name)
		# autoplay = &"intro" means the intro anim runs on spawn (acceptance: "intro on spawn").
		assert_eq(animated_sprite.autoplay, &"intro",
			"%s AnimatedSprite2D autoplay must be 'intro'" % boss_name)

func test_boss_scripts_play_intro_on_ready() -> void:
	# Wire-up check: the boss .gd files must invoke intro playback.
	for boss_path in [
		"res://scenes/enemies/bosses/boss_basic.gd",
		"res://scenes/enemies/bosses/boss_wind.gd",
	]:
		var script: GDScript = load(boss_path)
		var source: String = script.get_source_code()
		assert_true(source.contains("_play_intro_and_idle"),
			"%s must call _play_intro_and_idle in _ready()" % boss_path)
		assert_true(source.contains("animation_finished"),
			"%s must await animation_finished for intro" % boss_path)

## Find any AnimatedSprite2D in the scene tree (player uses BodySprite name;
## enemies use Sprite2D name — accept either).
func _find_animated_sprite(node: Node) -> AnimatedSprite2D:
	if node is AnimatedSprite2D:
		return node
	for child in node.get_children():
		var found: AnimatedSprite2D = _find_animated_sprite(child)
		if found:
			return found
	return null

func test_const_gd_anim_name_constants_defined() -> void:
	# Acceptance: animation names shared by 3+ files go in autoloads/const.gd.
	var script: GDScript = load("res://autoloads/const.gd")
	var source: String = script.get_source_code()
	for const_name in ["ANIM_IDLE", "ANIM_DEATH", "ANIM_INTRO", "ANIM_DRAW", "ANIM_RELEASE"]:
		assert_true(source.contains("const %s" % const_name),
			"autoloads/const.gd must define const %s" % const_name)
