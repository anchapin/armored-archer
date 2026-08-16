extends Control

@onready var health_bar: ProgressBar = $HealthBar
@onready var health_label: Label = $HealthLabel

# --- Visual Constants ---
const LOW_HEALTH_PULSE_SPEED: float = 4.0
const HEALTH_GRADIENT_HEIGHT: int = 8

var _base_offset_left: float = -220.0
var _base_offset_bottom: float = 50.0
var tween: Tween
var _pulse_tween: Tween

func _ready() -> void:
	GameManager.health_changed.connect(_on_health_changed)
	SafeAreaManager.safe_area_changed.connect(_on_safe_area_changed)
	_update_display(GameManager.player_current_health, GameManager.player_max_health)
	_adjust_for_safe_area()
	_setup_themed_style()

func _setup_themed_style() -> void:
	# Apply themed gradient to health bar using Relic Archive colors
	var style_box := StyleBoxFlat.new()
	style_box.corner_radius_top_left = 4
	style_box.corner_radius_top_right = 4
	style_box.corner_radius_bottom_left = 4
	style_box.corner_radius_bottom_right = 4
	
	# No-Line Rule: Remove all borders
	style_box.border_width_left = 0
	style_box.border_width_top = 0
	style_box.border_width_right = 0
	style_box.border_width_bottom = 0
	
	# Set progress color based on health percentage
	var bg_style := StyleBoxFlat.new()
	bg_style.bg_color = ArcherDesignTokens.RA_SURFACE_CONTAINER_LOW
	bg_style.corner_radius_top_left = 4
	bg_style.corner_radius_top_right = 4
	bg_style.corner_radius_bottom_left = 4
	bg_style.corner_radius_bottom_right = 4
	bg_style.border_width_left = 0
	bg_style.border_width_top = 0
	bg_style.border_width_right = 0
	bg_style.border_width_bottom = 0
	
	health_bar.add_theme_stylebox_override("background", bg_style)
	
	# Create health bar fill with gradient (green to red)
	var fill_style := StyleBoxFlat.new()
	fill_style.corner_radius_top_left = 3
	fill_style.corner_radius_top_right = 3
	fill_style.corner_radius_bottom_left = 3
	fill_style.corner_radius_bottom_right = 3
	fill_style.bg_color = ArcherDesignTokens.RA_TERTIARY  # Green for healthy
	health_bar.add_theme_stylebox_override("fill", fill_style)
	
	# Add glow effect to container using Relic Archive theme
	var container_style := StyleBoxFlat.new()
	container_style.bg_color = Color(0, 0, 0, 0.3)
	container_style.corner_radius_top_left = 6
	container_style.corner_radius_top_right = 6
	container_style.corner_radius_bottom_left = 6
	container_style.corner_radius_bottom_right = 6
	container_style.shadow_color = ArcherDesignTokens.RA_PRIMARY  # Golden glow
	container_style.shadow_size = 8
	add_theme_stylebox_override("panel", container_style)
	
	# Style the health label
	if health_label:
		health_label.add_theme_color_override("font_color", ArcherDesignTokens.RA_ON_SURFACE)

	# Add decorative status indicator
	_add_decorative_elements()

func _add_decorative_elements() -> void:
	"""Adds decorative UI elements for visual hierarchy."""
	# Add corner ornaments
	DecorativeUI.create_corner_ornament(self, "top_left", ArcherDesignTokens.RA_TERTIARY)
	DecorativeUI.create_corner_ornament(self, "top_right", ArcherDesignTokens.RA_TERTIARY)
	DecorativeUI.create_corner_ornament(self, "bottom_left", ArcherDesignTokens.RA_TERTIARY)
	DecorativeUI.create_corner_ornament(self, "bottom_right", ArcherDesignTokens.RA_TERTIARY)

	# Add header accent
	var accent = DecorativeUI.create_header_accent(self)
	accent.anchor_left = 0
	accent.anchor_right = 1
	accent.anchor_top = 0
	accent.anchor_bottom = 0
	accent.offset_top = 0

func _on_safe_area_changed() -> void:
	_adjust_for_safe_area()

func _adjust_for_safe_area() -> void:
	var safe_margins: Dictionary = SafeAreaManager.get_safe_margins()
	offset_left = _base_offset_left - safe_margins.right
	offset_bottom = _base_offset_bottom - safe_margins.bottom

func _on_health_changed(new_health: int, max_health: int) -> void:
	_update_display(new_health, max_health)

func _update_display(health: int, max_health: int) -> void:
	var health_percent: float = float(health) / float(max_health) * 100.0
	
	# Smooth animation for health change
	if tween:
		tween.kill()
	tween = create_tween()
	tween.tween_property(health_bar, "value", health_percent, 0.3).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	
	health_label.text = "%d / %d" % [health, max_health]
	
	# Update health bar color based on percentage using themed colors
	var fill_style := health_bar.get_theme_stylebox("fill") as StyleBoxFlat
	if fill_style:
		var color: Color
		if health_percent > 60:
			color = ArcherDesignTokens.RA_TERTIARY  # Green
		elif health_percent > 30:
			color = ArcherDesignTokens.RA_PRIMARY  # Golden (warning)
		else:
			color = ArcherDesignTokens.RA_ERROR  # Red
		fill_style.bg_color = color
	
	# Add pulsing glow when health is low
	if health_percent < 25:
		_start_low_health_pulse()
	else:
		_stop_low_health_pulse()

func _start_low_health_pulse() -> void:
	if _pulse_tween:
		_pulse_tween.kill()
	_pulse_tween = create_tween()
	_pulse_tween.set_loops()
	_pulse_tween.tween_property(self, "modulate", Color(1, 0.6, 0.6, 1), 0.3).set_trans(Tween.TRANS_SINE)
	_pulse_tween.tween_property(self, "modulate", Color(1, 1, 1, 1), 0.3).set_trans(Tween.TRANS_SINE)

func _stop_low_health_pulse() -> void:
	if _pulse_tween:
		_pulse_tween.kill()
		_pulse_tween = null
	modulate = Color(1, 1, 1, 1)

func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if GameManager.health_changed.is_connected(_on_health_changed):
		GameManager.health_changed.disconnect(_on_health_changed)
	if SafeAreaManager.safe_area_changed.is_connected(_on_safe_area_changed):
		SafeAreaManager.safe_area_changed.disconnect(_on_safe_area_changed)
