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

# Animation speeds
@export var parallax_speed_factor: float = 0.5
@export var particle_float_speed: float = 0.3


# ================================================
# Background Preset Configuration
# ================================================
class BackgroundPreset:
	var name: String
	var base_tint: Color
	var layer_colors: Array[Color]
	var supports_parallax: bool
	var has_particles: bool
	var has_gradient: bool
	var ambient_colors: Array[Color]
	
	func _init(p_name: String, p_base: Color, p_layers: Array[Color], p_parallax: bool, p_particles: bool = false, p_gradient: bool = false, p_ambient: Array[Color] = [] ):
		name = p_name
		base_tint = p_base
		layer_colors = p_layers
		supports_parallax = p_parallax
		has_particles = p_particles
		has_gradient = p_gradient
		ambient_colors = p_ambient


# ================================================
# Preset Definitions
# ================================================

static func get_main_menu_preset() -> BackgroundPreset:
	return BackgroundPreset.new(
		"main_menu",
		Color("#0e0e0e"),  # Dark obsidian (Relic Archive)
		[Color("#0e0e0e"), Color("#141414"), Color("#1a1a1a")],  # 3 depth layers
		false,  # Static background
		true,   # Has floating particles
		true,   # Has gradient
		[Color(1, 0.675, 0.329, 0.1)]  # Golden ambient tint
	)


static func get_forest_preset() -> BackgroundPreset:
	return BackgroundPreset.new(
		"gameplay_forest",
		Color("#0a1a0a"),  # Dark green-tinted
		[Color("#0a1a0a"), Color("#0d250d"), Color("#103010")],  # 3 depth layers
		true,  # Supports parallax
		true,  # Has floating particles
		true,  # Has gradient
		[Color(0.3, 0.7, 0.3, 0.05)]  # Green ambient tint
	)


static func get_arena_preset() -> BackgroundPreset:
	return BackgroundPreset.new(
		"gameplay_arena",
		Color("#1a1a1a"),  # Neutral dark gray
		[Color("#1a1a1a"), Color("#222222"), Color("#2a2a2a")],  # 3 depth layers
		true,  # Supports parallax
		true,  # Has floating particles
		false,  # No gradient
		[Color(1, 0.675, 0.329, 0.05)]  # Golden ambient tint
	)


static func get_cavern_preset() -> BackgroundPreset:
	return BackgroundPreset.new(
		"gameplay_cavern",
		Color("#050505"),  # Very dark
		[Color("#050505"), Color("#080808"), Color("#0b0b0b")],  # 3 depth layers
		false,  # Static background
		true,  # Has floating particles (glow)
		true,  # Has gradient
		[Color(0.5, 0.5, 1.0, 0.08)]  # Blue ambient tint
	)


# ================================================
# Surface Hierarchy Helpers
# ================================================

# Get all background presets
static func get_all_presets() -> Array[BackgroundPreset]:
	return [
		get_main_menu_preset(),
		get_forest_preset(),
		get_arena_preset(),
		get_cavern_preset()
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
		"gameplay_cavern": preset = get_cavern_preset()
		_: preset = get_main_menu_preset()
	
	if layer_index < preset.layer_colors.size():
		return preset.layer_colors[layer_index]
	return preset.base_tint


# Get ambient tint for background
static func get_ambient_tint(preset_name: String) -> Color:
	var preset: BackgroundPreset
	match preset_name:
		"main_menu": preset = get_main_menu_preset()
		"gameplay_forest": preset = get_forest_preset()
		"gameplay_arena": preset = get_arena_preset()
		"gameplay_cavern": preset = get_cavern_preset()
		_: preset = get_main_menu_preset()
	
	if preset.ambient_colors.size() > 0:
		return preset.ambient_colors[0]
	return Color(1, 1, 1, 0)
