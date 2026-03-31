class_name ArcherButton
extends Button

# =============================================================================
# ARCHER BUTTON - Armored Archer
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
@export var enable_animations: bool = true

var _current_state: ButtonState = ButtonState.NORMAL
var _is_toggled: bool = false
var _is_animating: bool = false
var _is_loading: bool = false
var _hover_tween: Tween = null
var _loading_tween: Tween = null
var _loading_indicator: Control = null

# --- Lifecycle ---
func _ready() -> void:
	_setup_button()
	_connect_signals()

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
	if not disabled and not _is_loading:
		_set_state(ButtonState.HOVER)
		if enable_animations:
			_play_hover_anim(true)

func _on_mouse_exited() -> void:
	if not disabled and not _is_loading:
		_set_state(ButtonState.NORMAL)
		if enable_animations:
			_play_hover_anim(false)

func _on_button_down() -> void:
	if not disabled and not _is_loading:
		_set_state(ButtonState.PRESSED)
		if enable_animations:
			_play_press_anim(true)

func _on_button_up() -> void:
	if not disabled and not _is_loading:
		if is_hovered():
			_set_state(ButtonState.HOVER)
		else:
			_set_state(ButtonState.NORMAL)

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

# --- Style Updates ---
func _update_button_style() -> void:
	var colors: Dictionary = _get_colors_for_type()
	var radius: int = DesignTokens.RADIUS_MD
	
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
	match button_type:
		"primary":
			return {
				"bg": DesignTokens.COLOR_PRIMARY,
				"text": Color.WHITE,
				"border": DesignTokens.COLOR_PRIMARY
			}
		"secondary":
			return {
				"bg": DesignTokens.COLOR_SECONDARY,
				"text": Color.WHITE,
				"border": DesignTokens.COLOR_SECONDARY
			}
		"success":
			return {
				"bg": DesignTokens.COLOR_SUCCESS,
				"text": Color.WHITE,
				"border": DesignTokens.COLOR_SUCCESS
			}
		"warning":
			return {
				"bg": DesignTokens.COLOR_WARNING,
				"text": Color.BLACK,
				"border": DesignTokens.COLOR_WARNING
			}
		"error":
			return {
				"bg": DesignTokens.COLOR_ERROR,
				"text": Color.WHITE,
				"border": DesignTokens.COLOR_ERROR
			}
		"ghost":
			return {
				"bg": Color.TRANSPARENT,
				"text": DesignTokens.COLOR_TEXT_PRIMARY_DARK,
				"border": Color.TRANSPARENT
			}
		"outline":
			return {
				"bg": Color.TRANSPARENT,
				"text": DesignTokens.COLOR_PRIMARY,
				"border": DesignTokens.COLOR_PRIMARY
			}
		_:
			return {
				"bg": DesignTokens.COLOR_PRIMARY,
				"text": Color.WHITE,
				"border": DesignTokens.COLOR_PRIMARY
			}

func _get_hover_colors(colors: Dictionary) -> Dictionary:
	var hover_bg: Color = colors["bg"].lightened(0.1)
	return {"bg": hover_bg, "text": colors["text"], "border": colors["border"]}

func _get_pressed_colors(colors: Dictionary) -> Dictionary:
	var pressed_bg: Color = colors["bg"].darkened(0.1)
	return {"bg": pressed_bg, "text": colors["text"], "border": colors["border"]}

func _get_disabled_colors(colors: Dictionary) -> Dictionary:
	return {
		"bg": colors["bg"].lerp(Color.GRAY, 0.5),
		"text": colors["text"].lerp(Color.GRAY, 0.5),
		"border": colors["border"].lerp(Color.GRAY, 0.5)
	}

func _get_toggled_colors(colors: Dictionary) -> Dictionary:
	return {
		"bg": colors["bg"].darkened(0.15),
		"text": colors["text"],
		"border": colors["border"]
	}

func _apply_style(colors: Dictionary, radius: int) -> void:
	# Create StyleBoxFlat for button background
	var style_normal := StyleBoxFlat.new()
	style_normal.bg_color = colors["bg"]
	style_normal.corner_radius_top_left = radius
	style_normal.corner_radius_top_right = radius
	style_normal.corner_radius_bottom_left = radius
	style_normal.corner_radius_bottom_right = radius
	style_normal.border_width_left = 1
	style_normal.border_width_top = 1
	style_normal.border_width_right = 1
	style_normal.border_width_bottom = 1
	style_normal.border_color = colors["border"]
	
	# Set the style
	add_theme_stylebox_override("normal", style_normal)
	
	# Set text color
	add_theme_color_override("font_color", colors["text"])
	add_theme_color_override("font_hover_color", colors["text"])
	add_theme_color_override("font_pressed_color", colors["text"])
	add_theme_color_override("font_disabled_color", DesignTokens.COLOR_TEXT_DISABLED_DARK)

func _update_size() -> void:
	# Set minimum size
	custom_minimum_size = Vector2(120, 40)
	
	# Set font size
	add_theme_font_size_override("font_size", DesignTokens.FONT_SIZE_BASE)

# --- Public Methods ---
func set_button_type(new_type: String) -> void:
	button_type = new_type
	_update_button_style()

func set_button_disabled(disabled: bool) -> void:
	self.disabled = disabled
	if disabled:
		_set_state(ButtonState.DISABLED)
	else:
		_set_state(ButtonState.NORMAL)

func set_loading(loading: bool) -> void:
	_is_loading = loading
	if loading:
		_show_loading()
	else:
		_hide_loading()

func _show_loading() -> void:
	# Disable button during loading to prevent double-tap
	disabled = true
	
	# Create loading indicator if not already created
	if not _loading_indicator:
		_loading_indicator = _create_loading_indicator()
	
	if _loading_indicator:
		_loading_indicator.visible = true
		# Use AnimationUtils.pulse if available, otherwise basic tween
		if has_node("/root/AnimationUtils"):
			"/root/AnimationUtils".pulse(_loading_indicator, 0.15, 3.0)
		else:
			_start_loading_pulse()

func _hide_loading() -> void:
	# Re-enable button
	disabled = false
	_set_state(ButtonState.NORMAL)
	
	# Hide and clean up loading indicator
	if _loading_indicator:
		_loading_indicator.visible = false
	
	if _loading_tween:
		_loading_tween.kill()
		_loading_tween = null

func _create_loading_indicator() -> Control:
	# Create a simple loading indicator
	var container := CenterContainer.new()
	container.name = "LoadingIndicator"
	container.set_anchors_preset(Control.PRESET_FULL_RECT)
	
	# Create spinner
	var spinner := ProgressBar.new()
	spinner.name = "Spinner"
	spinner.custom_minimum_size = Vector2(24, 24)
	spinner.show_percentage = false
	
	# Style the spinner
	var style := StyleBoxFlat.new()
	style.bg_color = Color(1, 1, 1, 0.3)
	style.corner_radius_top_left = 12
	style.corner_radius_top_right = 12
	style.corner_radius_bottom_left = 12
	style.corner_radius_bottom_right = 12
	spinner.add_theme_stylebox_override("background", style)
	
	var fill_style := StyleBoxFlat.new()
	fill_style.bg_color = Color.WHITE
	spinner.add_theme_stylebox_override("fill", fill_style)
	
	spinner.min_value = 0
	spinner.max_value = 100
	spinner.value = 25
	
	container.add_child(spinner)
	add_child(container)
	container.visible = false
	
	return container

func _start_loading_pulse() -> void:
	if _loading_tween:
		_loading_tween.kill()
	
	var spinner = _loading_indicator.get_node_or_null("Spinner") if _loading_indicator else null
	if not spinner:
		return
	
	_loading_tween = create_tween().set_loops()
	_loading_tween.tween_property(spinner, "scale", Vector2(1.2, 1.2), 0.3)
	_loading_tween.tween_property(spinner, "scale", Vector2.ONE, 0.3)

func is_loading() -> bool:
	return _is_loading

func get_current_state() -> ButtonState:
	return _current_state

func is_toggled_on() -> bool:
	return _is_toggled

# --- Animation Functions ---
func _play_hover_anim(is_hovering: bool) -> void:
	if _is_animating:
		return
	
	if _hover_tween and _hover_tween.is_valid():
		_hover_tween.kill()
	
	if is_hovering:
		_hover_tween = create_tween()
		_hover_tween.tween_property(self, "scale", Vector2.ONE * 1.05, 
			ArcherDesignTokens.ANIM_DURATION_FAST).set_ease(Tween.EASE_OUT)
	else:
		_hover_tween = create_tween()
		_hover_tween.tween_property(self, "scale", Vector2.ONE, 
			ArcherDesignTokens.ANIM_DURATION_FAST).set_ease(Tween.EASE_OUT)

func _play_press_anim(is_pressing: bool) -> void:
	if _is_animating:
		return
	
	_is_animating = true
	
	var tween := create_tween()
	if is_pressing:
		tween.tween_property(self, "scale", Vector2.ONE * 0.95, 
			ArcherDesignTokens.ANIM_DURATION_INSTANT).set_ease(Tween.EASE_OUT)
		# Auto-release animation when button comes up
		tween.tween_property(self, "scale", Vector2.ONE, 
			ArcherDesignTokens.ANIM_DURATION_NORMAL).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
	
	tween.tween_callback(func(): _is_animating = false)
