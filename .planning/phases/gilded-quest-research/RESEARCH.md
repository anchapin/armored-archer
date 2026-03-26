# Phase Research: Gilded Quest Design System Implementation in Godot 4

**Researched:** March 23, 2026
**Domain:** Godot 4 UI theming, shaders, and visual effects
**Confidence:** HIGH

## Summary

The Gilded Quest ("Tactile Heroism") design system can be implemented effectively in Godot 4 using a combination of built-in theme resources and custom shaders. Most design elements map directly to Godot primitives: design tokens via Theme resources, tonal layering via StyleBoxFlat color variations, and buttons via corner radius + shadow properties. Glassmorphism (blur + transparency for modals) requires a custom canvas_item shader using `hint_screen_texture`. Typography uses LabelSettings resources with imported font files (TTF/OTF). Combat visual effects leverage GPUParticles2D with ParticleProcessMaterial.

**Primary recommendation:** Implement UI layer first using theme resources and StyleBoxFlat, then add glassmorphism shaders for overlays, then integrate particle effects for gameplay moments.

---

## Standard Stack

### Core Godot 4 UI System
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Theme Resource | Godot 4.x | Centralized design tokens | Project-level customization of all Control node properties |
| StyleBoxFlat | Built-in | Procedural backgrounds for buttons/panels | Rounded corners, shadows, borders without textures |
| LabelSettings | Built-in | Typography overrides | Per-label font/color/size without theme propagation |
| GPUParticles2D | Built-in | Combat and UI particle effects | GPU-accelerated, thousands of particles |
| ShaderMaterial | Built-in | Custom visual effects | Glassmorphism, color grading, screen effects |

### Custom Implementation Needed
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| GlassShader.gdshader | Frosted glass effect for modals/overlays | Any semi-transparent overlay with backdrop blur |
| GlowShader.gdshader | "Hero moment" screen effects | Level-up, reward screens |
| Particle presets | Reusable combat effect configurations | Hit impacts, arrow trails, enemy deaths |

---

## Architecture Patterns

### Recommended Project Structure

```
res://themes/
├── gilded_quest_theme.tres       # Main Theme resource
├── styleboxes/
│   ├── button_normal.tres         # StyleBoxFlat
│   ├── button_hover.tres
│   ├── button_pressed.tres
│   ├── panel_card.tres
│   ├── panel_modal.tres
│   └── panel_surface.tres
├── label_settings/
│   ├── display_large.tres         # LabelSettings
│   ├── headline.tres
│   ├── title.tres
│   └── body.tres
└── colors/
    └── color_palette.gd           # Script for color tokens

res://shaders/
├── ui/
│   ├── glassmorphism.gdshader
│   ├── gradient_button.gdshader
│   └── glow_pulse.gdshader
└── particles/
    └── combat_effects.tres        # ParticleProcessMaterial presets

res://fonts/
├── Plus_Jakarta_Sans.ttf
└── Be_Vietnam_Pro.ttf
```

### Pattern 1: Theme-Based Design Tokens

**What:** Create a central Theme resource defining all design tokens as properties.

**When to use:** When multiple scenes need consistent styling across the entire UI.

**Example:**
```gdscript
# Create theme programmatically or in Editor
var theme = Theme.new()

# Color tokens (from design system)
theme.set_color("surface", "Control", Color("#fdffda"))
theme.set_color("surface_container", "Control", Color("#f6f3eb"))
theme.set_color("surface_container_low", "Control", Color("#fcf9f1"))
theme.set_color("surface_container_lowest", "Control", Color("#ffffff"))
theme.set_color("primary", "Control", Color("#0060ce"))
theme.set_color("on_surface", "Control", Color("#383833"))

# Button style tokens
var button_normal = StyleBoxFlat.new()
button_normal.bg_color = Color("#0060ce")
button_normal.corner_radius_top_left = 16  # md = 1.5rem
button_normal.corner_radius_top_right = 16
button_normal.corner_radius_bottom_left = 16
button_normal.corner_radius_bottom_right = 16
button_normal.shadow_color = Color(0.22, 0.22, 0.2, 0.06)  # on_surface at 6%
button_normal.shadow_size = 20
button_normal.shadow_offset = Vector2(0, 4)
theme.set_stylebox("normal", "Button", button_normal)
```

**Source:** [Godot Theme Editor Documentation](https://docs.godotengine.org/en/4.4/tutorials/ui/gui_using_theme_editor.html)

### Pattern 2: "No-Line" Layout via Tonal Layering

**What:** Replace 1px borders with layered background colors from the surface hierarchy.

**When to use:** All container layouts - cards, panels, section dividers.

**Example:**
```gdscript
# Surface hierarchy (from design system):
# surface (#fdffda) → surface_container (#f6f3eb) → surface_container_low (#fcf9f1) → surface_container_lowest (#ffffff)

# Panel with nested effect (no borders)
var panel_style = StyleBoxFlat.new()
panel_style.bg_color = Color("#f6f3eb")  # surface_container
panel_style.corner_radius_top_left = 16
panel_style.corner_radius_top_right = 16
panel_style.corner_radius_bottom_left = 16
panel_style.corner_radius_bottom_right = 16

# Inner container uses surface_container_high (#f0eee5)
# This creates natural "carved" depth without any border lines
```

**Note:** StyleBoxFlat supports individual corner radii but NOT inner-bottom shadows (inset). The 4px "bubbly" inner shadow requires custom shader.

### Pattern 3: Glassmorphism for Modals

**What:** Semi-transparent panels with backdrop blur, allowing parchment background to show through.

**When to use:** Inventory modals, settings overlays, any floating panel over game UI.

**Example (Shader):**
```glsl
shader_type canvas_item;

uniform sampler2D screen_texture : hint_screen_texture, filter_linear_mipmap;
uniform float blur_amount : hint_range(0.0, 10.0) = 3.0;
uniform vec4 glass_color : source_color = vec4(1.0, 1.0, 0.98, 0.8);
uniform float corner_radius : hint_range(0.0, 100.0) = 24.0;  # xl = 3rem

void fragment() {
    // Sample screen behind this element with blur
    vec4 blurred = texture(screen_texture, SCREEN_UV, blur_amount);
    
    // Mix glass tint with blurred background
    vec3 final_color = mix(blurred.rgb, glass_color.rgb, glass_color.a);
    
    // Apply to fragment
    COLOR = vec4(final_color, 1.0);
}
```

**Source:** [Godot Shaders - Frosted Glass](https://godotshaders.com/shader/frosted-glass-shader-rounded-rect-outline-shadow/)

**Implementation note:** The blur operation is expensive. Use small blur values (2-4) and consider lower resolution for mobile. The shader needs a rounded rect mask to match the design's xl corner radius.

### Pattern 4: Typography with Custom Fonts

**What:** Import Plus Jakarta Sans and Be Vietnam Pro, create LabelSettings for each type scale.

**When to use:** All text elements - labels, buttons, stats.

**Example:**
```gdscript
# Import fonts: Project Settings → Rendering → Textures → Default Texture Filter = Linear
# Place .ttf files in res://fonts/

# Create LabelSettings resources
var display_settings = LabelSettings.new()
display_settings.font = load("res://fonts/Plus_Jakarta_Sans.ttf")
display_settings.font_size = 56  # display-lg = 3.5rem
display_settings.font_color = Color("#383833")  # on_surface
display_settings.outline_size = 2
display_settings.outline_color = Color("#0060ce")

var body_settings = LabelSettings.new()
body_settings.font = load("res://fonts/Be_Vietnam_Pro.ttf")
body_settings.font_size = 16  # body-lg = 1rem
body_settings.font_color = Color("#383833")

# Apply to labels
$TitleLabel.label_settings = display_settings
$DescriptionLabel.label_settings = body_settings
```

**Source:** [Godot Font Documentation](https://docs.godotengine.org/en/4.5/tutorials/ui/gui_using_fonts.html)

### Pattern 5: Combat Particle Effects

**What:** GPUParticles2D with ParticleProcessMaterial for hit impacts, arrow trails, enemy deaths.

**When to use:** Gameplay moments requiring "hero" visual feedback.

**Example:**
```gdscript
# Arrow hit effect
var particles = GPUParticles2D.new()
var material = ParticleProcessMaterial.new()

# Explosion burst
material.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
material.emission_sphere_radius = 10
material.direction = Vector3(0, 0, 0)
material.spread = 180
material.initial_velocity_min = 100
material.initial_velocity_max = 200
material.gravity = Vector3(0, -200, 0)
material.scale_min = 0.5
material.scale_max = 1.5

# Color gradient (gold for heroic)
var gradient = Gradient.new()
gradient.set_color(0, Color("#ffd700"))  # Gold
gradient.set_color(0.5, Color("#ff8c00"))  # Orange
gradient.set_color(1.0, Color("#ff4500", 0))  # Fade out
material.color_ramp = gradient

material.lifetime = 0.5
material.explosiveness = 0.9
particles.process_material = material
particles.amount = 32
particles.one_shot = true
```

**Source:** [Godot Particles Documentation](https://docs.godotengine.org/en/4.4/tutorials/3d/particles/index.html)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Basic button backgrounds | Custom textures | StyleBoxFlat | Built-in corner radius, shadows, anti-aliasing |
| Theme colors | Scattered constants | Theme resource | Single source, editor-accessible |
| Basic rounded panels | Sprite 9-patch | StyleBoxFlat | Procedural, no texture management |
| Standard particles | Custom CPU loops | GPUParticles2D | GPU acceleration, thousands of particles |

---

## Common Pitfalls

### Pitfall 1: Missing Inner Shadow on Buttons

**What goes wrong:** Design calls for 4px inner-bottom shadow (inset) on primary buttons for "bubbly 3D" effect.

**Why it happens:** StyleBoxFlat only supports drop shadows (external), not inset shadows.

**How to avoid:** Use a layered approach - two StyleBoxFlats, or create a ShaderMaterial that simulates inset shadow by drawing a darker rectangle at the bottom with gradient fade.

**Warning signs:** Button looks flat despite having corner radius and drop shadow.

### Pitfall 2: Glassmorphism Breaks UI Performance

**What goes wrong:** Heavy blur shader causes frame drops on mobile or low-end devices.

**Why it happens:** `hint_screen_texture` with high blur_radius is GPU-intensive.

**How to avoid:** 
- Limit blur to 2-4px on mobile
- Use lower `amount_ratio` on particles
- Consider static blur (cached) vs. real-time blur
- Test on target devices early

### Pitfall 3: Font Not Rendering Correctly

**What goes wrong:** Custom fonts appear pixelated or wrong weight.

**Why it happens:** Font import settings wrong (nearest neighbor vs linear) or font size too small for MSDF.

**How to avoid:** Set Project Settings → Rendering → Textures → Default Texture Filter = Linear. For pixel art fonts, use Nearest. Ensure MSDF pixel range is at least 2x max font size.

### Pitfall 4: Theme Override Inheritance Confusion

**What goes wrong:** Theme changes not propagating to child controls.

**Why it happens:** Local theme overrides on Control nodes take priority over project theme.

**How to avoid:** Set styles at the panel/container level, not individual controls. Use Theme Type Variations for different button states.

---

## Code Examples

### Complete Button Style (Primary)

```gdscript
# Primary button with "bubbly" effect
var btn_style = StyleBoxFlat.new()
btn_style.bg_color = Color("#0060ce")  # primary
btn_style.corner_radius_top_left = 16  # md corner radius
btn_style.corner_radius_top_right = 16
btn_style.corner_radius_bottom_left = 16
btn_style.corner_radius_bottom_right = 16

# Shadow for depth (not inner, but creates floating effect)
btn_style.shadow_color = Color(0.22, 0.22, 0.2, 0.06)  # on_surface at 6%
btn_style.shadow_size = 8
btn_style.shadow_offset = Vector2(0, 2)

# Anti-aliasing for smooth edges
btn_style.anti_aliasing = true
btn_style.anti_aliasing_size = 1.0
```

### Glass Modal Panel

```gdscript
# Apply glass shader to modal panel
var glass_mat = ShaderMaterial.new()
glass_mat.shader = load("res://shaders/ui/glassmorphism.gdshader")
glass_mat.set_shader_parameter("blur_amount", 3.0)
glass_mat.set_shader_parameter("glass_color", Color(1.0, 0.99, 0.98, 0.8))

$ModalPanel.material_override = glass_mat
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Texture-based UI | StyleBoxFlat | Godot 3.x+ | No sprite management, procedural shapes |
| Static blur sprites | Screen-space shaders | Godot 4.x | Dynamic, resolution-independent |
| CPUParticles | GPUParticles2D | Godot 4.x | Thousands of particles at 60fps |
| Theme overrides only | LabelSettings | Godot 4.0+ | Per-label typography without theme bloat |

**Deprecated/outdated:**
- `StyleBoxTexture` (9-patch): Use StyleBoxFlat for simple shapes
- `CanvasItemMaterial` for UI: Use ShaderMaterial with canvas_item type
- `.fnt` bitmap fonts: Use TTF/OTF with MSDF for crisp scaling

---

## Open Questions

1. **Performance on Mobile**
   - What we know: Glassmorphism shaders work but are GPU-intensive
   - What's unclear: Minimum device specs for 60fps with multiple glass panels
   - Recommendation: Test early on target devices, provide "low quality" fallback

2. **Inner Button Shadow**
   - What we know: StyleBoxFlat lacks inset shadows
   - What's unclear: Best approach - layered StyleBoxFlats or shader?
   - Recommendation: Start with drop shadow only, evaluate if inner shadow is worth shader complexity

3. **Font File Licensing**
   - What we know: Need Plus Jakarta Sans and Be Vietnam Pro
   - What's unclear: License terms for commercial game
   - Recommendation: Verify OFL or commercial license before implementation

4. **Asymmetric Layout / Intentional Overlap**
   - What we know: Design calls for elements breaking container boundaries
   - What's unclear: How to handle in Godot's layout system (anchors)
   - Recommendation: Use Control nodes with negative margins, test on multiple screen sizes

---

## Implementation Recommendations

### Phase 1: Foundation (High Priority)
1. Create Theme resource with all color tokens
2. Import and configure fonts (TTF)
3. Create StyleBoxFlat presets for buttons/panels
4. Apply theme to main UI scenes

### Phase 2: Advanced Effects (Medium Priority)
1. Glassmorphism shader for modals
2. Hover/press state transitions on buttons
3. Shadow refinement per design spec

### Phase 3: Gameplay Integration (Lower Priority)
1. Particle effects for combat feedback
2. Screen-space "hero moment" effects (level-up, rewards)
3. Performance optimization for mobile

---

## Sources

### Primary (HIGH confidence)
- [Godot Theme Editor Documentation](https://docs.godotengine.org/en/4.4/tutorials/ui/gui_using_theme_editor.html) - Theme resources and editor
- [StyleBoxFlat Class](https://docs.godotengine.org/en/4.4/classes/class_styleboxflat.html) - Built-in procedural styling
- [Godot Font Documentation](https://docs.godotengine.org/en/4.5/tutorials/ui/gui_using_fonts.html) - Typography system
- [LabelSettings Class](https://docs.godotengine.org/en/4.4/classes/class_labelsettings.html) - Per-label overrides
- [Godot Particles Documentation](https://docs.godotengine.org/en/4.4/tutorials/3d/particles/index.html) - GPUParticles2D

### Secondary (MEDIUM confidence)
- [Godot Shaders - Frosted Glass](https://godotshaders.com/shader/frosted-glass-shader-rounded-rect-outline-shadow/) - Glassmorphism shader reference
- [Godot Shaders - Fluid Glass UI](https://godotshaders.com/shader/fluid-glass-ui/) - Advanced glass effects
- [GPUParticles2D Effects Tutorial](https://uhiyama-lab.com/en/notes/godot/gpu-particles2d-effects) - Combat effect patterns

### Tertiary (LOW confidence)
- [Godot Proposals - Shadow Options](https://github.com/godotengine/godot-proposals/issues/4948) - Inner shadow feature request (not implemented)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Godot 4 built-in features are well-documented and stable
- Architecture: HIGH - Theme + StyleBoxFlat + ShaderMaterial patterns are standard Godot practice
- Pitfalls: HIGH - Known issues with StyleBoxFlat and performance are documented

**Research date:** March 23, 2026
**Valid until:** 6 months - Godot 4.x theming API is stable; shaders may evolve