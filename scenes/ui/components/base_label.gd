class_name BaseLabel
extends Label

# =============================================================================
# BASE LABEL - Armored Archer
# =============================================================================
# Reusable label component with consistent typography presets.
# =============================================================================

enum LabelType {
	TITLE,        # Large display text
	HEADER,       # Section headers
	SUBHEADER,    # Subsection headers
	BODY,         # Regular body text
	CAPTION,      # Small supporting text
	OVERLINE,     # Uppercase labels
	BUTTON,       # Button text
	NUMERIC       # Numbers/stats display
}

@export var label_type: LabelType = LabelType.BODY

var _is_dark_theme: bool = true

# --- Lifecycle ---
func _ready() -> void:
	_setup_label()

func _setup_label() -> void:
	_apply_type_style()

# --- Style Updates ---
func _apply_type_style() -> void:
	var font_size: int
	var text_color: Color
	
	match label_type:
		LabelType.TITLE:
			font_size = ArcherDesignTokens.FONT_SIZE_TITLE
			text_color = _get_text_primary_color()
		LabelType.HEADER:
			font_size = ArcherDesignTokens.FONT_SIZE_HEADER
			text_color = _get_text_primary_color()
		LabelType.SUBHEADER:
			font_size = ArcherDesignTokens.FONT_SIZE_XL
			text_color = _get_text_primary_color()
		LabelType.BODY:
			font_size = ArcherDesignTokens.FONT_SIZE_BASE
			text_color = _get_text_primary_color()
		LabelType.CAPTION:
			font_size = ArcherDesignTokens.FONT_SIZE_SM
			text_color = _get_text_secondary_color()
		LabelType.OVERLINE:
			font_size = ArcherDesignTokens.FONT_SIZE_XS
			text_color = _get_text_secondary_color()
		LabelType.BUTTON:
			font_size = ArcherDesignTokens.FONT_SIZE_BASE
			text_color = _get_text_primary_color()
		LabelType.NUMERIC:
			font_size = ArcherDesignTokens.FONT_SIZE_LG
			text_color = _get_text_primary_color()
		_:
			font_size = ArcherDesignTokens.FONT_SIZE_BASE
			text_color = _get_text_primary_color()
	
	add_theme_font_size_override("font_size", font_size)
	add_theme_color_override("font_color", text_color)

func _get_text_primary_color() -> Color:
	return ArcherDesignTokens.COLOR_TEXT_PRIMARY_DARK if _is_dark_theme else ArcherDesignTokens.COLOR_TEXT_PRIMARY_LIGHT

func _get_text_secondary_color() -> Color:
	return ArcherDesignTokens.COLOR_TEXT_SECONDARY_DARK if _is_dark_theme else ArcherDesignTokens.COLOR_TEXT_SECONDARY_LIGHT

# --- Public Methods ---
func set_label_type(new_type: LabelType) -> void:
	label_type = new_type
	_apply_type_style()

func set_text_color(color: Color) -> void:
	add_theme_color_override("font_color", color)

func set_dark_theme(is_dark: bool) -> void:
	_is_dark_theme = is_dark
	_apply_type_style()

func get_label_type() -> LabelType:
	return label_type
