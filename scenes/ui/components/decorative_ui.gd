class_name DecorativeUI
extends Node

# =============================================================================
# DECORATIVE UI - Armored Archer
# =============================================================================
# Collection of decorative UI elements for visual hierarchy:
# - Section dividers with decorative elements
# - Progress badges/indicators
# - Corner ornaments and accents
# - Animated background patterns (subtle)
# =============================================================================

# --- Section Divider with Ornament ---
## Creates a horizontal section divider with decorative ornaments
##
## Parameters:
##   parent: Container to add the divider to
##   text: Label text to display in the divider center
##   color: Accent color for the divider
## Returns: HBoxContainer with the divider
static func create_section_divider(parent: Node, text: String = "", color: Color = ArcherDesignTokens.RA_PRIMARY) -> HBoxContainer:
	var container = HBoxContainer.new()
	container.custom_minimum_height = 32
	container.alignment = BoxContainer.ALIGNMENT_CENTER

	# Left line
	var left_line = ColorRect.new()
	left_line.custom_minimum_size = Vector2(40, 1)
	left_line.color = color
	left_line.modulate.a = 0.5
	container.add_child(left_line)

	# Ornament spacer
	var spacer_left = Control.new()
	spacer_left.custom_minimum_size = Vector2(8, 0)
	container.add_child(spacer_left)

	# Center text or ornament
	if text != "":
		var label = Label.new()
		label.text = text.to_upper()
		label.add_theme_color_override("font_color", color)
		label.add_theme_font_size_override("font_size", 12)
		label.add_theme_color_override("font_outline_color", Color(0, 0, 0))
		label.add_theme_constant_override("outline_size", 1)
		container.add_child(label)
	else:
		# Decorative ornament (diamond)
		var ornament = Control.new()
		ornament.custom_minimum_size = Vector2(8, 8)
		var style = StyleBoxFlat.new()
		style.bg_color = color
		style.corner_radius_top_left = 2
		style.corner_radius_top_right = 2
		style.corner_radius_bottom_left = 2
		style.corner_radius_bottom_right = 2
		ornament.add_theme_stylebox_override("panel", style)
		container.add_child(ornament)

	# Spacer
	var spacer_right = Control.new()
	spacer_right.custom_minimum_size = Vector2(8, 0)
	container.add_child(spacer_right)

	# Right line
	var right_line = ColorRect.new()
	right_line.custom_minimum_size = Vector2(40, 1)
	right_line.color = color
	right_line.modulate.a = 0.5
	container.add_child(right_line)

	if parent:
		parent.add_child(container)

	return container

# --- Progress Badge ---
## Creates a small badge indicator for progress/status
##
## Parameters:
##   text: Text to display in badge
##   color: Background color
##   is_pulsing: Whether to animate the badge
## Returns: Label styled as badge
static func create_progress_badge(text: String = "", color: Color = ArcherDesignTokens.RA_SECONDARY, is_pulsing: bool = false) -> Label:
	var badge = Label.new()
	badge.text = text
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	badge.add_theme_font_size_override("font_size", 10)
	badge.add_theme_color_override("font_color", Color(1, 1, 1))

	var style = StyleBoxFlat.new()
	style.bg_color = color
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	badge.add_theme_stylebox_override("normal", style)

	badge.custom_minimum_size = Vector2(20, 20)

	if is_pulsing:
		# Add subtle pulse animation
		var tween = badge.create_tween()
		tween.set_loops()
		tween.tween_property(badge, "modulate:a", 0.7, 0.8).set_trans(Tween.TRANS_SINE)
		tween.tween_property(badge, "modulate:a", 1.0, 0.8).set_trans(Tween.TRANS_SINE)

	return badge

# --- Corner Ornament ---
## Creates decorative corner accents for panels
##
## Parameters:
##   parent: Node to add ornament to
##   corner: Which corner ("top_left", "top_right", "bottom_left", "bottom_right")
##   color: Ornament color
static func create_corner_ornament(parent: Node, corner: String = "top_left", color: Color = ArcherDesignTokens.RA_PRIMARY) -> void:
	var ornament = PanelContainer.new()
	ornament.set_anchors_preset(Control.PRESET_TOP_LEFT)

	var style = StyleBoxFlat.new()
	style.bg_color = color
	style.corner_radius_top_left = 2
	style.corner_radius_top_right = 2
	style.corner_radius_bottom_left = 2
	style.corner_radius_bottom_right = 2
	ornament.add_theme_stylebox_override("panel", style)

	ornament.custom_minimum_size = Vector2(6, 6)

	match corner:
		"top_left":
			ornament.anchor_left = 0
			ornament.anchor_top = 0
			ornament.anchor_right = 0
			ornament.anchor_bottom = 0
			ornament.offset_left = 4
			ornament.offset_top = 4
		"top_right":
			ornament.anchor_left = 1
			ornament.anchor_top = 0
			ornament.anchor_right = 1
			ornament.anchor_bottom = 0
			ornament.offset_left = -10
			ornament.offset_top = 4
		"bottom_left":
			ornament.anchor_left = 0
			ornament.anchor_top = 1
			ornament.anchor_right = 0
			ornament.anchor_bottom = 1
			ornament.offset_left = 4
			ornament.offset_top = -10
		"bottom_right":
			ornament.anchor_left = 1
			ornament.anchor_top = 1
			ornament.anchor_right = 1
			ornament.anchor_bottom = 1
			ornament.offset_left = -10
			ornament.offset_top = -10

	parent.add_child(ornament)

# --- Animated Background Pattern ---
## Creates a subtle animated background for panels
##
## Parameters:
##   parent: Node to add pattern to
##   pattern_type: "diagonal", "grid", or "dots"
static func create_animated_pattern(parent: Node, pattern_type: String = "diagonal") -> ColorRect:
	var pattern = ColorRect.new()
	pattern.set_anchors_preset(Control.PRESET_FULL_RECT)
	pattern.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pattern.z_index = -1

	var style = StyleBoxFlat.new()
	match pattern_type:
		"diagonal":
			# Subtle diagonal lines
			style.bg_color = Color(1, 1, 1, 0.02)
		"grid":
			# Subtle grid pattern
			style.bg_color = Color(1, 1, 1, 0.015)
		"dots":
			# Subtle dots pattern
			style.bg_color = Color(1, 1, 1, 0.01)
		_:
			style.bg_color = Color(1, 1, 1, 0.01)

	pattern.add_theme_stylebox_override("panel", style)

	# Add subtle animation
	var tween = pattern.create_tween()
	tween.set_loops()
	tween.tween_property(pattern, "modulate:a", 0.03, 4.0).set_trans(Tween.TRANS_SINE)
	tween.tween_property(pattern, "modulate:a", 0.02, 4.0).set_trans(Tween.TRANS_SINE)

	parent.add_child(pattern)
	return pattern

# --- Status Indicator Bar ---
## Creates a small status indicator bar with color coding
##
## Parameters:
##   status: "active", "inactive", "warning", "error"
##   width: Width of the bar
## Returns: ColorRect
static func create_status_indicator(status: String = "inactive", width: int = 40) -> ColorRect:
	var indicator = ColorRect.new()
	indicator.custom_minimum_size = Vector2(width, 4)
	indicator.anchor_right = 0
	indicator.anchor_bottom = 0

	var color: Color
	match status:
		"active":
			color = ArcherDesignTokens.RA_SECONDARY  # Green
		"warning":
			color = ArcherDesignTokens.RA_TERTIARY  # Yellow/orange
		"error":
			color = ArcherDesignTokens.RA_ERROR  # Red
		_:
			color = Color(1, 1, 1, 0.3)  # Inactive

	indicator.color = color

	# Add corner radius
	var style = StyleBoxFlat.new()
	style.bg_color = color
	style.corner_radius_top_left = 2
	style.corner_radius_top_right = 2
	style.corner_radius_bottom_left = 2
	style.corner_radius_bottom_right = 2
	indicator.add_theme_stylebox_override("panel", style)

	# Pulse for active status
	if status == "active":
		var tween = indicator.create_tween()
		tween.set_loops()
		tween.tween_property(indicator, "modulate:a", 0.6, 0.8).set_trans(Tween.TRANS_SINE)
		tween.tween_property(indicator, "modulate:a", 1.0, 0.8).set_trans(Tween.TRANS_SINE)

	return indicator

# --- Header Accent ---
## Creates a decorative header accent with gradient line
##
## Parameters:
##   parent: Container to add accent to
##   height: Height of the accent bar
## Returns: ColorRect
static func create_header_accent(parent: Node, height: int = 3) -> ColorRect:
	var accent = ColorRect.new()
	accent.custom_minimum_height = height
	accent.anchor_left = 0
	accent.anchor_right = 1
	accent.anchor_top = 0
	accent.anchor_bottom = 0

	# Gradient style using metallic gold
	var style = StyleBoxFlat.new()
	style.bg_color = ArcherDesignTokens.RA_PRIMARY
	accent.add_theme_stylebox_override("panel", style)

	parent.add_child(accent)
	return accent