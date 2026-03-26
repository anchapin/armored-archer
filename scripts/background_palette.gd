class_name GildedBackgroundPalette
extends Resource

# Gilded Quest Background Palette Configuration
# Design System: "Tactile Heroism"
# ================================================

@export var base_color: Color = Color("#fdffda")
@export var surface_color: Color = Color("#f8fdd2")
@export var surface_container_color: Color = Color("#f2f5bf")
@export var surface_container_low_color: Color = Color("#ebf0b3")

# Accent colors
@export var gold_accent: Color = Color("#ffd700")
@export var royal_blue_accent: Color = Color("#0060ce")

# Environmental colors
@export var forest_green: Color = Color("#4d804d")
@export var arena_neutral: Color = Color("#d9d1c7")

# Vignette effect
@export var vignette_strength: float = 0.15


# ================================================
# Background Preset Configuration
# ================================================
class BackgroundPreset:
	var name: String
	var base_tint: Color
	var layer_colors: Array[Color]
	var supports_parallax: bool
	
	func _init(p_name: String, p_base: Color, p_layers: Array[Color], p_parallax: bool):
		name = p_name
		base_tint = p_base
		layer_colors = p_layers
		supports_parallax = p_parallax


# ================================================
# Preset Definitions
# ================================================

static func get_main_menu_preset() -> BackgroundPreset:
	return BackgroundPreset.new(
		"main_menu",
		Color("#fdffda"),  # Parchment base
		[Color("#fdffda"), Color("#f8fdd2"), Color("#ebf0b3")],  # 3 depth layers
		false  # Static background
	)


static func get_forest_preset() -> BackgroundPreset:
	return BackgroundPreset.new(
		"gameplay_forest",
		Color("#e6f0cc"),  # Green-tinted parchment
		[Color("#e6f0cc"), Color("#cce0b3"), Color("#b3cc99")],  # 3 depth layers
		true  # Supports parallax
	)


static func get_arena_preset() -> BackgroundPreset:
	return BackgroundPreset.new(
		"gameplay_arena",
		Color("#f0ede8"),  # Neutral warm
		[Color("#f0ede8"), Color("#e0dcd7"), Color("#d0cbc6")],  # 3 depth layers
		true  # Supports parallax
	)


# ================================================
# Surface Hierarchy Helpers
# ================================================

# Get all background presets
static func get_all_presets() -> Array[BackgroundPreset]:
	return [
		get_main_menu_preset(),
		get_forest_preset(),
		get_arena_preset()
	]


# Load palette from resource
static func load_palette() -> GildedBackgroundPalette:
	var path := "res://assets/backgrounds/background_palette.tres"
	var palette: GildedBackgroundPalette = load(path)
	if palette == null:
		palette = GildedBackgroundPalette.new()
	return palette


# Get color for specific depth layer
static func get_layer_color(preset_name: String, layer_index: int) -> Color:
	var preset: BackgroundPreset
	match preset_name:
		"main_menu": preset = get_main_menu_preset()
		"gameplay_forest": preset = get_forest_preset()
		"gameplay_arena": preset = get_arena_preset()
		_: preset = get_main_menu_preset()
	
	if layer_index < preset.layer_colors.size():
		return preset.layer_colors[layer_index]
	return preset.base_tint
