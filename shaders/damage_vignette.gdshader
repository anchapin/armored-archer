shader_type canvas_item;

uniform float intensity : hint_range(0.0, 1.0) = 0.0;
uniform vec4 vignette_color : source_color = vec4(0.8, 0.0, 0.0, 1.0);
uniform float radius : hint_range(0.0, 2.0) = 0.8;
uniform float softness : hint_range(0.0, 1.0) = 0.5;

void fragment() {
	vec2 uv = UV;
	vec2 center = vec2(0.5, 0.5);
	float dist = distance(uv, center);
	
	// Create vignette gradient - darker at edges, clear in center
	float vignette = smoothstep(radius, radius - softness, dist);
	
	// Apply intensity
	vignette *= intensity;
	
	COLOR = vec4(vignette_color.rgb, vignette_color.a * vignette);
}