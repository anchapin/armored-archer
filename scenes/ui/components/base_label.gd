class_name BaseLabel
extends Label

# =============================================================================
# BASE LABEL - Armored Archer (Relic Archive Update)
# =============================================================================
# Reusable label component with consistent typography presets.
# Now supports Relic Archive design system fonts:
# - Epilogue - Heroic Display (display-lg) for boss names, level-up milestones
# - Space Grotesk - Tactical Stats (body-lg, title-md) for combat stats
# - Lexend - Micro-Labels (label-md) for secondary metadata
# - Plus Jakarta Sans - Display & Headlines (light mode fallback)
# - Be Vietnam Pro - Titles & Body (light mode fallback)
# =============================================================================

enum LabelType {
	TITLE,        # Large display text
	HEADER,       # Section headers
	SUBHEADER,    # Subsection headers
	BODY,         # Regular body text
	CAPTION,      # Small supporting text
	OVERLINE,     # Uppercase labels
	BUTTON,       # Button text
	NUMERIC,       # Numbers/stats display
	HEROIC,       # Heroic display (Epilogue - boss names, rewards)
	TACTICAL,      # Tactical stats (Space Grotesk - combat stats)
	MICRO          # Micro-labels (Lexend - secondary metadata)
}

@export var label_type: LabelType = LabelType.BODY
@export var use_relic_fonts: bool = false  # Use Relic Archive fonts

var _is_dark_theme: bool = true

# --- Relic Archive Font Paths ---
const FONT_EPILOGUE_REGULAR_PATH := "res://fonts/Epilogue-Regular.ttf"
const FONT_EPILOGUE_BOLD_PATH := "res://fonts/Epilogue-Bold.ttf"
const FONT_SPACE_GROTESK_REGULAR_PATH := "res://fonts/SpaceGrotesk-Regular.ttf"
const FONT_SPACE_GROTESK_BOLD_PATH := "res://fonts/SpaceGrotesk-Bold.ttf"
const FONT_LEXEND_REGULAR_PATH := "res://fonts/Lexend-Regular.ttf"

# --- Lifecycle ---
func _ready() -> void:
	_setup_label()

func _setup_label() -> void:
	_apply_type_style()

# --- Style Updates ---
func _apply_type_style() -> void:
	var font_size: int
	var text_color: Color
	var font_path: String = ""

	match label_type:
		LabelType.HEROIC:
			# Heroic display - Epilogue Bold for boss names, rewards
			font_size = ArcherDesignTokens.FONT_SIZE_DISPLAY_LG  # 56px
			text_color = _get_text_primary_color()
			if use_relic_fonts:
				font_path = FONT_EPILOGUE_BOLD_PATH
		LabelType.TACTICAL:
			# Tactical stats - Space Grotesk Bold for combat stats
			font_size = ArcherDesignTokens.FONT_SIZE_LG  # 16px
			text_color = _get_text_primary_color()
			if use_relic_fonts:
				font_path = FONT_SPACE_GROTESK_BOLD_PATH
		LabelType.MICRO:
			# Micro-labels - Lexend Regular for secondary metadata
			font_size = ArcherDesignTokens.FONT_SIZE_SM  # 12px
			text_color = _get_text_secondary_color()
			if use_relic_fonts:
				font_path = FONT_LEXEND_REGULAR_PATH
		LabelType.TITLE:
			font_size = ArcherDesignTokens.FONT_SIZE_TITLE
			text_color = _get_text_primary_color()
			if use_relic_fonts:
				font_path = FONT_EPILOGUE_BOLD_PATH
		LabelType.HEADER:
			font_size = ArcherDesignTokens.FONT_SIZE_HEADER
			text_color = _get_text_primary_color()
			if use_relic_fonts:
				font_path = FONT_SPACE_GROTESK_BOLD_PATH
		LabelType.SUBHEADER:
			font_size = ArcherDesignTokens.FONT_SIZE_XL
			text_color = _get_text_primary_color()
			if use_relic_fonts:
				font_path = FONT_SPACE_GROTESK_REGULAR_PATH
		LabelType.BODY:
			font_size = ArcherDesignTokens.FONT_SIZE_BASE
			text_color = _get_text_primary_color()
			if use_relic_fonts:
				font_path = FONT_SPACE_GROTESK_REGULAR_PATH
		LabelType.CAPTION:
			font_size = ArcherDesignTokens.FONT_SIZE_SM
			text_color = _get_text_secondary_color()
			if use_relic_fonts:
				font_path = FONT_LEXEND_REGULAR_PATH
		LabelType.OVERLINE:
			font_size = ArcherDesignTokens.FONT_SIZE_XS
			text_color = _get_text_secondary_color()
			if use_relic_fonts:
				font_path = FONT_LEXEND_REGULAR_PATH
		LabelType.BUTTON:
			font_size = ArcherDesignTokens.FONT_SIZE_BASE
			text_color = _get_text_primary_color()
			if use_relic_fonts:
				font_path = FONT_SPACE_GROTESK_BOLD_PATH
		LabelType.NUMERIC:
			font_size = ArcherDesignTokens.FONT_SIZE_LG
			text_color = _get_text_primary_color()
			if use_relic_fonts:
				font_path = FONT_SPACE_GROTESK_BOLD_PATH
		_:
			font_size = ArcherDesignTokens.FONT_SIZE_BASE
			text_color = _get_text_primary_color()

	# Apply font size
	add_theme_font_size_override("font_size", font_size)

	# Apply font if path provided
	if not font_path.is_empty():
		var font = load(font_path)
		if font != null:
			add_theme_font_override("font", font)

	# Apply text color
	add_theme_color_override("font_color", text_color)

func _get_text_primary_color() -> Color:
	# Relic Archive uses RA_ON_SURFACE for dark mode
	if _is_dark_theme:
		return ArcherDesignTokens.RA_ON_SURFACE
	else:
		return ArcherDesignTokens.COLOR_TEXT_PRIMARY_LIGHT

func _get_text_secondary_color() -> Color:
	# Relic Archive uses RA_ON_SURFACE_VARIANT for dark mode
	if _is_dark_theme:
		return ArcherDesignTokens.RA_ON_SURFACE_VARIANT
	else:
		return ArcherDesignTokens.COLOR_TEXT_SECONDARY_LIGHT

# --- Public Methods ---
func set_label_type(new_type: LabelType) -> void:
	label_type = new_type
	_apply_type_style()

func set_text_color(color: Color) -> void:
	add_theme_color_override("font_color", color)

func set_dark_theme(is_dark: bool) -> void:
	_is_dark_theme = is_dark
	_apply_type_style()

func set_use_relic_fonts(use: bool) -> void:
	use_relic_fonts = use
	_apply_type_style()

func get_label_type() -> LabelType:
	return label_type
