extends Node

# =============================================================================
# ANIMATION UTILITIES - Armored Archer
# =============================================================================
# Reusable tween utility functions for UI animations.
# Uses design tokens for consistent timing and easing.
# =============================================================================

## Fade in a node (alpha 0 -> 1)
## duration: Animation duration in seconds (uses design_tokens if 0)
static func fade_in(node: Node, duration: float = 0.0) -> Tween:
	var dur: float = duration if duration > 0 else ArcherDesignTokens.ANIM_DURATION_NORMAL
	var tween: Tween = node.create_tween()
	node.modulate.a = 0.0
	node.visible = true
	tween.tween_property(node, "modulate:a", 1.0, dur).set_ease(
		Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	return tween

## Fade out a node (alpha 1 -> 0) then hide
static func fade_out(node: Node, duration: float = 0.0, hide_on_complete: bool = true) -> Tween:
	var dur: float = duration if duration > 0 else ArcherDesignTokens.ANIM_DURATION_NORMAL
	var tween: Tween = node.create_tween()
	tween.tween_property(node, "modulate:a", 0.0, dur).set_ease(
		Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	if hide_on_complete:
		tween.tween_callback(func(): node.visible = false)
	return tween

## Scale bounce effect (1.0 -> 1.1 -> 1.0)
static func scale_bounce(node: Node, scale_factor: float = 1.1) -> Tween:
	var tween: Tween = node.create_tween()
	var original_scale: Vector2 = node.scale
	tween.tween_property(node, "scale", original_scale * scale_factor, 
		ArcherDesignTokens.ANIM_DURATION_FAST).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
	tween.tween_property(node, "scale", original_scale, 
		ArcherDesignTokens.ANIM_DURATION_NORMAL).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
	return tween

## Slide in from edge (left/right/top/bottom)
static func slide_in(node: Node, from_edge: String, duration: float = 0.0) -> Tween:
	var dur: float = duration if duration > 0 else ArcherDesignTokens.ANIM_DURATION_SLOW
	var start_pos: Vector2 = node.position
	var offset: Vector2 = Vector2.ZERO
	
	var viewport: Rect2 = node.get_viewport_rect()
	var node_size: Vector2 = node.size if node is Control else Vector2(100, 100)
	
	match from_edge:
		"left":
			offset = Vector2(-viewport.size.x - node_size.x, 0)
		"right":
			offset = Vector2(viewport.size.x + node_size.x, 0)
		"top":
			offset = Vector2(0, -viewport.size.y - node_size.y)
		"bottom":
			offset = Vector2(0, viewport.size.y + node_size.y)
	
	node.position += offset
	node.visible = true
	
	var tween: Tween = node.create_tween()
	tween.tween_property(node, "position", start_pos, dur).set_ease(
		Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	return tween

## Continuous pulse animation
static func pulse(node: Node, scale_range: float = 0.1, speed: float = 2.0) -> Tween:
	var tween: Tween = node.create_tween().set_loops()
	var base_scale: Vector2 = node.scale
	tween.tween_property(node, "scale", base_scale * (1.0 + scale_range), 0.5 / speed)
	tween.tween_property(node, "scale", base_scale, 0.5 / speed)
	return tween

## Scale down effect (press feedback)
static func scale_down(node: Node, scale_factor: float = 0.95) -> Tween:
	var tween: Tween = node.create_tween()
	tween.tween_property(node, "scale", node.scale * scale_factor, 
		ArcherDesignTokens.ANIM_DURATION_FAST).set_ease(Tween.EASE_OUT)
	return tween

## Scale up effect (release feedback)
static func scale_up(node: Node) -> Tween:
	var tween: Tween = node.create_tween()
	var original_scale: Vector2 = node.scale / node.scale.x  # Normalize to Vector2.ONE assumption
	# Reset to original scale (assume Vector2.ONE as base)
	tween.tween_property(node, "scale", Vector2.ONE, 
		ArcherDesignTokens.ANIM_DURATION_NORMAL).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
	return tween