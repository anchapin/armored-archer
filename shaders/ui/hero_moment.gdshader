shader_type canvas_item;

// Screen texture for post-processing effect
uniform sampler2D screen_texture : hint_screen_texture, filter_linear_mipmap;

// Glow intensity (0.0 to 2.0)
uniform float glow_intensity : hint_range(0.0, 2.0) = 0.5;

// Glow color (gold)
uniform vec4 glow_color : source_color = vec4(1.0, 0.843, 0.0, 1.0);

// Pulse speed for animation
uniform float pulse_speed : hint_range(0.0, 10.0) = 2.0;

// Threshold for what constitutes a "bright" area
uniform float brightness_threshold : hint_range(0.0, 1.0) = 0.5;

// Amount of blur for the glow effect
uniform float blur_amount : hint_range(0.0, 10.0) = 3.0;

void fragment() {
	// Get screen color
	vec4 screen_color = texture(screen_texture, SCREEN_UV);
	
	// Calculate brightness (simple luminance)
	float brightness = dot(screen_color.rgb, vec3(0.299, 0.587, 0.114));
	
	// Only apply glow to bright areas
	float glow_mask = smoothstep(brightness_threshold, brightness_threshold + 0.2, brightness);
	
	// Calculate animated pulse using sine wave
	float pulse = sin(TIME * pulse_speed) * 0.5 + 0.5;
	float animated_intensity = glow_intensity * (0.7 + 0.3 * pulse);
	
	// Sample surrounding pixels for blur effect (simple box blur)
	vec4 glow = vec4(0.0);
	float total_samples = 0.0;
	
	for (float x = -1.0; x <= 1.0; x += 1.0) {
		for (float y = -1.0; y <= 1.0; y += 1.0) {
			vec2 offset = vec2(x, y) * blur_amount * 0.01;
			glow += texture(screen_texture, SCREEN_UV + offset);
			total_samples += 1.0;
		}
	}
	glow /= total_samples;
	
	// Calculate glow based on brightness
	float glow_strength = glow_mask * animated_intensity;
	
	// Apply additive glow
	vec4 final_color = screen_color + (glow_color * glow_strength * glow.a);
	
	// Mix with original based on glow intensity
	COLOR = mix(screen_color, final_color, glow_intensity * 0.5);
}

void light() {
	// No additional lighting needed for this effect
}