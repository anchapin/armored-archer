class_name GildedSpritePalette
extends Resource

# Gilded Quest Character Sprite Palette Configuration
# Design System: "Tactile Heroism"
# ================================================

# Primary colors
@export var royal_blue: Color = Color("#0060ce")      # Main accents, hero elements
@export var gold: Color = Color("#ffd700")              # Legendary highlights, heroic feel
@export var emerald: Color = Color("#50c878")           # Secondary accents, nature elements

# Background/surface colors
@export var parchment: Color = Color("#fdffda")        # Warm parchment base

# Character-specific overrides
@export var hero_tint: Color = Color("#ffe6b3")        # Warm gold tint for hero character
@export var enemy_tint: Color = Color("#b3ccf0")        # Cool blue tint for enemies
@export var boss_tint: Color = Color("#ffd999")        # Enhanced gold for bosses

# ================================================
# Palette Usage Guidelines
# ================================================
# 
# Hero Character:
#   - Base: Parchment undertones
#   - Primary: Gold highlights
#   - Secondary: Emerald accents
#
# Enemies:
#   - Base: Parchment undertones
#   - Primary: Royal Blue accents
#   - Secondary: Cooler tones
#
# Bosses:
#   - Base: Parchment undertones
#   - Primary: Enhanced Gold (more saturation)
#   - Secondary: Emerald accents
#
# All Characters:
#   - Warm parchment undertones throughout
#   - Consistent tactile/paper feel
# ================================================

func get_palette_for_character(type: String) -> Dictionary:
	match type:
		"hero":
			return {"primary": gold, "secondary": emerald, "tint": hero_tint}
		"enemy":
			return {"primary": royal_blue, "secondary": emerald, "tint": enemy_tint}
		"boss":
			return {"primary": gold, "secondary": emerald, "tint": boss_tint}
		_:
			return {"primary": gold, "secondary": emerald, "tint": hero_tint}


static func load_palette() -> GildedSpritePalette:
	var path := "res://assets/sprites/characters/character_palette.tres"
	var palette: GildedSpritePalette = load(path)
	if palette == null:
		palette = GildedSpritePalette.new()
	return palette
