extends "res://scenes/ui/components/base_button.gd"

## Apply primary tokens as style colors, never as RGB modulation of an
## already colored button. Keep the base button's signals and interaction.
func _get_colors_for_type() -> Dictionary:
	return _primary_colors(ArcherDesignTokens.COLOR_PRIMARY)

func _get_hover_colors(_colors: Dictionary) -> Dictionary:
	return _primary_colors(ArcherDesignTokens.COLOR_PRIMARY_FIXED)

func _get_pressed_colors(_colors: Dictionary) -> Dictionary:
	return _primary_colors(ArcherDesignTokens.COLOR_PRIMARY_DIM)

func _primary_colors(background: Color) -> Dictionary:
	return {
		"bg": background,
		"text": ArcherDesignTokens.COLOR_ON_PRIMARY_CONTAINER if background == ArcherDesignTokens.COLOR_PRIMARY_FIXED else ArcherDesignTokens.COLOR_ON_PRIMARY,
		"gradient_start": background,
		"gradient_end": background,
	}
