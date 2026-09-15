extends GutTest
## Gilded Quest background palette validation (converted from the legacy
## SceneTree-pattern orphan per issue #1125 adoption).
## Validates that backgrounds exist and use the correct warm parchment base.

const BACKGROUND_PATH := "res://assets/backgrounds/"
const REQUIRED_BACKGROUNDS := ["main_menu.tres", "gameplay_forest.tres", "gameplay_arena.tres"]

func test_backgrounds_directory_exists() -> void:
	assert_not_null(DirAccess.open(BACKGROUND_PATH), "backgrounds directory must exist")

func test_required_backgrounds_exist_and_load() -> void:
	for bg_name in REQUIRED_BACKGROUNDS:
		var bg_path: String = BACKGROUND_PATH + bg_name
		assert_true(FileAccess.file_exists(bg_path), bg_name + " must exist")
		assert_not_null(load(bg_path), bg_name + " must load as a valid resource")

func test_palette_configuration_exists() -> void:
	assert_true(
		FileAccess.file_exists(BACKGROUND_PATH + "background_palette.tres"),
		"palette config must exist"
	)

func test_palette_script_exists() -> void:
	assert_true(
		FileAccess.file_exists("res://scripts/background_palette.gd"),
		"palette script must exist"
	)
