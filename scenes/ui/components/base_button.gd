class_name ArcheryBaseButton
extends Button

# =============================================================================
# BASE BUTTON - Armored Archer
# =============================================================================
# Reusable button component with consistent styling and states.
# Use as base for all buttons or extend for specialized variants.
# =============================================================================

## Emitted when button state changes
signal state_changed(button_state: String)

enum ButtonState {
	NORMAL,
	HOVER,
	PRESSED,
	DISABLED,
	FOCUSED
}

@export var button_type: String = "primary"
@export var is_toggle: bool = false
@export var toggle_group: String = ""

var _current_state: ButtonState = ButtonState.NORMAL
var _is_toggled: bool = false
var _base_scale: float = 1.0

# --- Lifecycle ---
func _ready() -> void:
	_setup_button()
	_connect_signals()
	_base_scale = scale.x

func _setup_button() -> void:
	# Apply default styling
	_update_button_style()
	_update_size()

func _connect_signals() -> void:
	mouse_entered.connect(_on_mouse_entered)
	mouse_exited.connect(_on_mouse_exited)
	button_down.connect(_on_button_down)
	button_up.connect(_on_button_up)
	toggled.connect(_on_toggled)

# --- State Management ---
func _on_mouse_entered() -> void:
	if not disabled:
		_set_state(ButtonState.HOVER)
		_animate_hover(true)

func _on_mouse_exited() -> void:
	if not disabled:
		_set_state(ButtonState.NORMAL)
		_animate_hover(false)

func _on_button_down() -> void:
	if not disabled:
		_set_state(ButtonState.PRESSED)
		_animate_press(true)

func _on_button_up() -> void:
	if not disabled:
		if is_hovered():
			_set_state(ButtonState.HOVER)
		else:
			_set_state(ButtonState.NORMAL)
		_animate_press(false)

func _on_toggled(button_pressed: bool) -> void:
	_is_toggled = button_pressed
	_update_button_style()

func _set_state(new_state: ButtonState) -> void:
	if _current_state == new_state:
		return
	
	_current_state = new_state
	_update_button_style()
	
	match new_state:
		ButtonState.NORMAL: state_changed.emit("normal")
		ButtonState.HOVER: state_changed.emit("hover")
		ButtonState.PRESSED: state_changed.emit("pressed")
		ButtonState.DISABLED: state_changed.emit("disabled")
		ButtonState.FOCUSED: state_changed.emit("focused")

# --- Visual Animations ---
func _animate_hover(is_hovering: bool) -> void:
	var tween := create_tween()
	if is_hovering:
		tween.tween_property(self, "scale", Vector2(_base_scale * 1.05, _base_scale * 1.05), 0.1).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		# Add subtle glow pulse on hover
		_animate_glow(true)
	else:
		tween.tween_property(self, "scale", Vector2(_base_scale, _base_scale), 0.1).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
		_animate_glow(false)

func _animate_press(is_pressed: bool) -> void:
	var tween := create_tween()
	if is_pressed:
		# Tactile press with scale and slight rotation for physical feel
		tween.tween_property(self, "scale", Vector2(_base_scale * 0.92, _base_scale * 0.92), 0.08).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		tween.parallel().tween_property(self, "rotation", deg_to_rad(1.5), 0.08).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	else:
		tween.tween_property(self, "scale", Vector2(_base_scale, _base_scale), 0.1).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
		tween.parallel().tween_property(self, "rotation", 0, 0.1).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)

func _animate_glow(enabled: bool) -> void:
	# Add pulsing glow effect for hover state
	var style := get_theme_stylebox("normal") as StyleBoxFlat
	if not style:
		return
	
	var tween := create_tween()
	if enabled:
		tween.tween_property(style, "shadow_size", 12, 0.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	else:
		tween.tween_property(style, "shadow_size", ArcherDesignTokens.RA_AMBIENT_SHADOW_BLUR, 0.3).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)

# --- Style Updates ---
func _update_button_style() -> void:
	var colors: Dictionary = _get_colors_for_type()
	var radius: int = ArcherDesignTokens.get_ra_button_radius()  # RA_ROUNDNESS_FOUR (4px)

	match _current_state:
		ButtonState.HOVER:
			colors = _get_hover_colors(colors)
		ButtonState.PRESSED:
			colors = _get_pressed_colors(colors)
		ButtonState.DISABLED:
			colors = _get_disabled_colors(colors)

	if _is_toggled:
		colors = _get_toggled_colors(colors)

	_apply_style(colors, radius)

func _get_colors_for_type() -> Dictionary:
	# Use Relic Archive (dark mode) palette
	match button_type:
		"primary":
			return {
				"bg": ArcherDesignTokens.RA_PRIMARY,
				"text": ArcherDesignTokens.RA_ON_PRIMARY,
				"gradient_start": ArcherDesignTokens.RA_PRIMARY,
				"gradient_end": ArcherDesignTokens.RA_PRIMARY_DIM
			}
		"secondary":
			return {
				"bg": ArcherDesignTokens.RA_SECONDARY,
				"text": ArcherDesignTokens.RA_ON_SECONDARY,
				"gradient_start": ArcherDesignTokens.RA_SECONDARY,
				"gradient_end": ArcherDesignTokens.RA_SECONDARY_DIM
			}
		"success":
			return {
				"bg": ArcherDesignTokens.RA_TERTIARY,
				"text": ArcherDesignTokens.RA_ON_TERTIARY,
				"gradient_start": ArcherDesignTokens.RA_TERTIARY,
				"gradient_end": ArcherDesignTokens.RA_TERTIARY_DIM
			}
		"warning":
			return {
				"bg": ArcherDesignTokens.RA_PRIMARY,
				"text": ArcherDesignTokens.RA_ON_PRIMARY,
				"gradient_start": ArcherDesignTokens.RA_PRIMARY,
				"gradient_end": ArcherDesignTokens.RA_PRIMARY_DIM
			}
		"error":
			return {
				"bg": ArcherDesignTokens.RA_ERROR,
				"text": ArcherDesignTokens.RA_ON_ERROR,
				"gradient_start": ArcherDesignTokens.RA_ERROR,
				"gradient_end": ArcherDesignTokens.RA_ERROR_DIM
			}
		"ghost":
			return {
				"bg": Color.TRANSPARENT,
				"text": ArcherDesignTokens.RA_ON_SURFACE,
				"gradient_start": Color.TRANSPARENT,
				"gradient_end": Color.TRANSPARENT
			}
		"outline":
			return {
				"bg": Color.TRANSPARENT,
				"text": ArcherDesignTokens.RA_PRIMARY,
				"gradient_start": Color.TRANSPARENT,
				"gradient_end": Color.TRANSPARENT
			}
		_:
			return {
				"bg": ArcherDesignTokens.RA_PRIMARY,
				"text": ArcherDesignTokens.RA_ON_PRIMARY,
				"gradient_start": ArcherDesignTokens.RA_PRIMARY,
				"gradient_end": ArcherDesignTokens.RA_PRIMARY_DIM
			}

func _get_hover_colors(colors: Dictionary) -> Dictionary:
	# Use RA_PRIMARY_FIXED for hover (golden hover)
	var hover_bg := ArcherDesignTokens.get_ra_primary_color("hover")
	return {
		"bg": hover_bg,
		"text": colors["text"],
		"gradient_start": hover_bg,
		"gradient_end": colors.get("gradient_end", hover_bg)
	}

func _get_pressed_colors(colors: Dictionary) -> Dictionary:
	# Use RA_PRIMARY_DIM for pressed (golden press)
	var pressed_bg := ArcherDesignTokens.get_ra_primary_color("pressed")
	return {
		"bg": pressed_bg,
		"text": colors["text"],
		"gradient_start": pressed_bg,
		"gradient_end": pressed_bg
	}

func _get_disabled_colors(colors: Dictionary) -> Dictionary:
	var bg_color: Color = colors["bg"]
	var text_color: Color = colors["text"]
	var disabled_bg: Color = bg_color.lerp(ArcherDesignTokens.RA_SURFACE, 0.5)
	var disabled_text: Color = text_color.lerp(ArcherDesignTokens.RA_ON_SURFACE_VARIANT, 0.5)
	return {
		"bg": disabled_bg,
		"text": disabled_text,
		"gradient_start": disabled_bg,
		"gradient_end": disabled_bg
	}

func _get_toggled_colors(colors: Dictionary) -> Dictionary:
	var bg_color: Color = colors["bg"]
	var toggled_bg: Color = bg_color.darkened(0.15)
	return {
		"bg": toggled_bg,
		"text": colors["text"],
		"gradient_start": toggled_bg,
		"gradient_end": toggled_bg
	}

func _apply_style(colors: Dictionary, radius: int) -> void:
	# Create StyleBoxFlat for button background
	var style_normal := StyleBoxFlat.new()

	# Apply gradient if available (No-Line Rule: use gradients instead of borders)
	if colors.has("gradient_start") and colors.has("gradient_end"):
		# Create gradient from golden to darker gold
		style_normal.bg_color = colors["bg"]  # Fallback
		style_normal.bg_color = colors["gradient_start"]
		# Note: Godot StyleBoxFlat doesn't support gradients directly,
		# so we use the lighter color as the base
	else:
		style_normal.bg_color = colors["bg"]

	# No-Line Rule: Remove all borders, use corner radius for depth
	style_normal.corner_radius_top_left = radius
	style_normal.corner_radius_top_right = radius
	style_normal.corner_radius_bottom_left = radius
	style_normal.corner_radius_bottom_right = radius
	style_normal.border_width_left = 0
	style_normal.border_width_top = 0
	style_normal.border_width_right = 0
	style_normal.border_width_bottom = 0

	# Add ambient glow for primary buttons (Relic Archive design)
	if button_type == "primary":
		style_normal.shadow_color = ArcherDesignTokens.RA_AMBIENT_SHADOW_COLOR
		style_normal.shadow_size = ArcherDesignTokens.RA_AMBIENT_SHADOW_BLUR
		style_normal.shadow_offset = Vector2(0, 0)

	# Set the style
	add_theme_stylebox_override("normal", style_normal)

	# Set text color (using Relic Archive colors)
	add_theme_color_override("font_color", colors["text"])
	add_theme_color_override("font_hover_color", colors["text"])
	add_theme_color_override("font_pressed_color", colors["text"])
	add_theme_color_override("font_disabled_color", ArcherDesignTokens.RA_ON_SURFACE_VARIANT)

func _update_size() -> void:
	# Set minimum size
	custom_minimum_size = Vector2(120, 40)
	
	# Set font size
	add_theme_font_size_override("font_size", ArcherDesignTokens.FONT_SIZE_BASE)

# --- Public Methods ---
func set_button_type(new_type: String) -> void:
	button_type = new_type
	_update_button_style()

func apply_disabled(disabled: bool) -> void:
	self.disabled = disabled
	if disabled:
		_set_state(ButtonState.DISABLED)
	else:
		_set_state(ButtonState.NORMAL)

func get_current_state() -> ButtonState:
	return _current_state

func is_toggled_on() -> bool:
	return _is_toggled
