class_name BaseContainer
extends Container

# =============================================================================
# BASE CONTAINER - Armored Archer
# =============================================================================
# Reusable container component for layout management.
# Provides consistent margins, padding, and alignment.
# =============================================================================

@export var container_type: String = "default"  # default, vertical, horizontal, grid
@export var alignment: HorizontalAlignment = HORIZONTAL_ALIGNMENT_CENTER
@export var vertical_alignment: VerticalAlignment = VERTICAL_ALIGNMENT_CENTER

@export var padding_top: int = DesignTokens.SPACING_MD
@export var padding_bottom: int = DesignTokens.SPACING_MD
@export var padding_left: int = DesignTokens.SPACING_MD
@export var padding_right: int = DesignTokens.SPACING_MD

@export var spacing: int = DesignTokens.SPACING_SM

var _is_dark_theme: bool = true

# --- Lifecycle ---
func _ready() -> void:
	_setup_container()

func _setup_container() -> void:
	_apply_layout_settings()

# --- Layout ---
func _apply_layout_settings() -> void:
	# Set custom minimum size based on type
	match container_type:
		"vertical", "horizontal":
			custom_minimum_size = Vector2(200, 100)
		"grid":
			custom_minimum_size = Vector2(300, 200)
	
	# Set theme colors
	_update_theme_colors()

func _update_theme_colors() -> void:
	if _is_dark_theme:
		modulate = Color.WHITE
	else:
		modulate = Color.WHITE

# --- Notification ---
func _notification(what: int) -> void:
	if what == NOTIFICATION_SORT_CHILDREN:
		_do_layout()

func _do_layout() -> void:
	var rect := get_rect()
	var content_pos := Vector2(padding_left, padding_top)
	var content_size := Vector2(
		rect.size.x - padding_left - padding_right,
		rect.size.y - padding_top - padding_bottom
	)
	
	match container_type:
		"vertical":
			_layout_vertical(content_pos, content_size)
		"horizontal":
			_layout_horizontal(content_pos, content_size)
		"grid":
			_layout_grid(content_pos, content_size)
		_:
			_layout_default(content_pos, content_size)

func _layout_default(pos: Vector2, size: Vector2) -> void:
	# Default: just position children at top-left
	var child_pos := pos
	for child in get_children():
		if not child is Control:
			continue
		var child_size := child.get_combined_minimum_size()
		child.position = child_pos
		child.size = child_size

func _layout_vertical(pos: Vector2, size: Vector2) -> void:
	var child_pos := pos
	var total_height := 0
	
	# First pass: calculate total height
	for child in get_children():
		if not child is Control:
			continue
		total_height += child.get_combined_minimum_size().y + spacing
	
	# Adjust starting position for alignment
	match vertical_alignment:
		VERTICAL_ALIGNMENT_CENTER:
			child_pos.y += (size.y - total_height) / 2
		VERTICAL_ALIGNMENT_BOTTOM:
			child_pos.y += size.y - total_height
	
	# Second pass: position children
	for child in get_children():
		if not child is Control:
			continue
		var child_size := child.get_combined_minimum_size()
		child.position = Vector2(pos.x, child_pos.y)
		child.size = Vector2(size.x, child_size.y)
		child_pos.y += child_size.y + spacing

func _layout_horizontal(pos: Vector2, size: Vector2) -> void:
	var child_pos := pos
	var total_width := 0
	
	# First pass: calculate total width
	for child in get_children():
		if not child is Control:
			continue
		total_width += child.get_combined_minimum_size().x + spacing
	
	# Adjust starting position for alignment
	match alignment:
		HORIZONTAL_ALIGNMENT_CENTER:
			child_pos.x += (size.x - total_width) / 2
		HORIZONTAL_ALIGNMENT_RIGHT:
			child_pos.x += size.x - total_width
	
	# Second pass: position children
	for child in get_children():
		if not child is Control:
			continue
		var child_size := child.get_combined_minimum_size()
		child.position = Vector2(child_pos.x, pos.y)
		child.size = Vector2(child_size.x, size.y)
		child_pos.x += child_size.x + spacing

func _layout_grid(pos: Vector2, size: Vector2) -> void:
	# Simple grid: 3 columns
	var cols := 3
	var col := 0
	var row := 0
	var x_pos := pos.x
	var y_pos := pos.y
	var max_height := 0
	
	for child in get_children():
		if not child is Control:
			continue
		var child_size := child.get_combined_minimum_size()
		var cell_width := size.x / cols
		
		child.position = Vector2(x_pos + col * cell_width, y_pos + row * (max_height + spacing))
		child.size = Vector2(cell_width - spacing, child_size.y)
		
		max_height = max(max_height, child_size.y)
		col += 1
		if col >= cols:
			col = 0
			row += 1
			y_pos += max_height + spacing
			max_height = 0

# --- Public Methods ---
func set_container_type(new_type: String) -> void:
	container_type = new_type
	_apply_layout_settings()

func set_alignment(h_align: HorizontalAlignment) -> void:
	alignment = h_align
	_do_layout()

func set_vertical_alignment(v_align: VerticalAlignment) -> void:
	vertical_alignment = v_align
	_do_layout()

func set_padding(all: int) -> void:
	padding_top = all
	padding_bottom = all
	padding_left = all
	padding_right = all
	_do_layout()

func set_padding_horizontal(horizontal: int) -> void:
	padding_left = horizontal
	padding_right = horizontal
	_do_layout()

func set_padding_vertical(vertical: int) -> void:
	padding_top = vertical
	padding_bottom = vertical
	_do_layout()

func set_spacing(new_spacing: int) -> void:
	spacing = new_spacing
	_do_layout()

func set_dark_theme(is_dark: bool) -> void:
	_is_dark_theme = is_dark
	_update_theme_colors()
