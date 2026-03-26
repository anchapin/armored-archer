shader_type canvas_item;

uniform sampler2D screen_texture : hint_screen_texture, filter_linear_mipmap;
uniform float blur_amount : hint_range(0.0, 10.0) = 3.0;
uniform vec4 glass_color : source_color = vec4(1.0, 1.0, 1.0, 0.8);
uniform float corner_radius : hint_range(0.0, 100.0) = 48.0;

void fragment() {
	// Get UV coordinates
	vec2 uv = UV;
	
	// Sample the screen texture behind with blur
	vec4 screen_color = textureLod(screen_texture, SCREEN_UV, blur_amount);
	
	// Mix screen with glass color - frosted effect
	// The blur creates the frosted glass look while parchment bleeds through
	vec4 final_color = mix(screen_color, glass_color, glass_color.a * 0.5);
	
	COLOR = final_color;
}