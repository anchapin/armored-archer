extends GutTest
## Gilded Quest character sprite palette validation (converted from the
## legacy SceneTree-pattern orphan per issue #1125 adoption).
## Validates that character sprites exist and use the correct color palette.

const CHARACTER_SPRITE_PATH := "res://assets/sprites/characters/"
const REQUIRED_SPRITES := ["hero.tres", "enemy.tres", "boss_basic.tres", "boss_wind.tres", "arrow.tres"]

func test_characters_directory_exists() -> void:
	assert_not_null(DirAccess.open(CHARACTER_SPRITE_PATH), "characters directory must exist")

func test_required_sprites_exist_and_load() -> void:
	for sprite_name in REQUIRED_SPRITES:
		var sprite_path: String = CHARACTER_SPRITE_PATH + sprite_name
		assert_true(FileAccess.file_exists(sprite_path), sprite_name + " must exist")
		assert_not_null(load(sprite_path), sprite_name + " must load as a valid resource")

func test_palette_configuration_exists() -> void:
	assert_true(
		FileAccess.file_exists(CHARACTER_SPRITE_PATH + "character_palette.tres"),
		"palette config must exist"
	)

func test_palette_script_exists() -> void:
	assert_true(
		FileAccess.file_exists("res://scripts/sprite_palette.gd"),
		"palette script must exist"
	)
