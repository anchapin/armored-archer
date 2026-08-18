extends Label

## Damage number popup that floats upward and fades out.

# --- Configuration ---
var float_speed: float = 80.0
var lifetime: float = 1.0
var fade_start: float = 0.6
var _time_alive: float = 0.0
var _start_scale: float = 1.0

# --- Colors ---
const COLOR_NORMAL := Color(1.0, 1.0, 1.0, 1.0)
const COLOR_CRIT := Color(1.0, 0.6, 0.2, 1.0)  # Golden for crits
const COLOR_MISS := Color(0.6, 0.6, 0.6, 0.8)
const COLOR_HEAL := Color(0.3, 1.0, 0.4, 1.0)


func _ready() -> void:
	# Center the label on its position
	if horizontal_alignment == HORIZONTAL_ALIGNMENT_CENTER:
		position -= size / 2.0
	
	_start_scale = scale.x
	
	# Add initial pop-in animation
	var tween := create_tween()
	tween.tween_property(self, "scale", Vector2(_start_scale * 1.2, _start_scale * 1.2), 0.1).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _process(delta: float) -> void:
	_time_alive += delta

	# Float upward with slight drift
	position.y -= float_speed * delta
	position.x += sin(_time_alive * 5) * 10 * delta  # Gentle sway

	# Fade out
	if _time_alive >= fade_start:
		var fade_progress := (_time_alive - fade_start) / (lifetime - fade_start)
		modulate.a = lerp(1.0, 0.0, fade_progress)

	# Issue #1090: instead of queue_free'ing, return to the ObjectPool so the
	# popup can be reused. Falls back to queue_free if the pool isn't available
	# (e.g. running outside the main scene tree).
	if _time_alive >= lifetime:
		var pool := get_node_or_null("/root/ObjectPool")
		if pool and pool.has_method("return_damage_popup"):
			pool.return_damage_popup(self)
		else:
			queue_free()


## Issue #1090: reset all per-instance state so the popup can be reused from
## the ObjectPool without re-instantiating. Mirrors the convention used by
## arrow.gd / pooled enemies.
func reset_pooled_state() -> void:
	_time_alive = 0.0
	modulate.a = 1.0
	modulate = COLOR_NORMAL
	position = Vector2.ZERO
	scale = Vector2.ONE
	set_process(false)
	visible = false
	# Strip theme overrides accumulated by setup_damage() so the next acquire
	# starts from a clean slate (Label holds strong references otherwise).
	if has_theme_font_size_override("font_size"):
		remove_theme_font_size_override("font_size")
	if has_theme_color_override("font_color"):
		remove_theme_color_override("font_color")
	if has_theme_color_override("font_outline_color"):
		remove_theme_color_override("font_outline_color")
	if has_theme_color_override("font_shadow_color"):
		remove_theme_color_override("font_shadow_color")
	if has_theme_constant_override("outline_size"):
		remove_theme_constant_override("outline_size")
	if has_theme_constant_override("shadow_outline_size"):
		remove_theme_constant_override("shadow_outline_size")


func setup_damage(amount: int, is_crit: bool = false, is_miss: bool = false, is_heal: bool = false) -> void:
	"""Configure the damage number appearance based on type."""
	# Add outline for better readability
	add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	add_theme_constant_override("outline_size", 2)
	
	if is_miss:
		text = "MISS"
		modulate = COLOR_MISS
		add_theme_font_size_override("font_size", 24)
		# Miss text is italic and smaller
		add_theme_color_override("font_color", COLOR_MISS)
		_start_scale = 0.9
	elif is_heal:
		text = "+%d" % amount
		modulate = COLOR_HEAL
		add_theme_font_size_override("font_size", 32)
		add_theme_color_override("font_color", COLOR_HEAL)
		# Green glow for heals
		add_theme_color_override("font_shadow_color", Color(0.3, 1.0, 0.4, 0.5))
		add_theme_constant_override("shadow_outline_size", 2)
	elif is_crit:
		text = "%d!" % amount
		modulate = COLOR_CRIT
		add_theme_font_size_override("font_size", 40)
		add_theme_color_override("font_color", COLOR_CRIT)
		# Golden outline for crits
		add_theme_color_override("font_outline_color", Color(0.3, 0.15, 0, 0.9))
		add_theme_constant_override("outline_size", 3)
		_start_scale = 1.5
	else:
		text = "%d" % amount
		modulate = COLOR_NORMAL
		add_theme_font_size_override("font_size", 30)
		add_theme_color_override("font_color", COLOR_NORMAL)
		_start_scale = 1.1


static func create_damage_popup(
	damage: int,
	global_pos: Vector2,
	is_crit: bool = false,
	is_miss: bool = false,
	is_heal: bool = false
) -> Label:
	"""Factory method to create and configure a damage popup."""
	var popup := Label.new()
	popup.position = global_pos
	popup.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	popup.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	popup.setup_damage(damage, is_crit, is_miss, is_heal)

	return popup
