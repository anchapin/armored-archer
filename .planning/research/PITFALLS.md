# Pitfalls Research: Combat Feedback, UI Polish & Audio Integration

**Domain:** Godot 4 game juice implementation (adding polish/features to existing game)
**Researched:** 2026-03-23
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Screen Shake Breaking Game Feel

**What goes wrong:**
Screen shake becomes jarring instead of impactful. Camera movement feels disconnected from gameplay, or shake is so aggressive it causes motion sickness.

**Why it happens:**
- Using raw `rand_range()` for shake creates erratic, discontinuous movement
- No trauma decay means shake persists too long
- Trauma power set incorrectly causes uneven shake intensity curves
- Overusing shake on every minor impact dilutes the effect

**How to avoid:**
1. Use **FastNoiseLite** (Godot 4.3+) or OpenSimplexNoise instead of random offsets
   ```gdscript
   @onready var noise = FastNoiseLite.new()
   var noise_y: float = 0.0
   
   func shake():
       noise_y += 1
       var amount = pow(trauma, trauma_pwr)  # trauma_pwr = 2-3
       offset.x = max_offset.x * amount * noise.get_noise_2d(noise.seed, noise_y)
   ```
2. Implement trauma-based decay with configurable `trauma_decay` rate
3. Keep max_offset modest (10-30px for UI, 50-100px for big impacts)
4. Reserve screen shake for significant events only (kills, heavy hits, boss damage)

**Warning signs:**
- Players complain about motion sickness or disorientation
- Screen shake triggers on every arrow hit (too frequent)
- Camera detaches visually from gameplay during shake
- Shake doesn't feel "connected" to the action

**Phase to address:** Combat Feedback Phase 1 (screen shake implementation)

---

### Pitfall 2: Hit Stop Breaks Physics/Collision

**What goes wrong:**
Setting `Engine.time_scale = 0` pauses physics unexpectedly, causing projectiles to clip through enemies, players to fall through floors, or collision shapes to malfunction.

**Why it happens:**
- `Engine.time_scale = 0` affects ALL physics processes including collision detection
- Timers dependent on time_scale never complete
- Projectiles mid-flight stop but resume at wrong positions

**How to avoid:**
1. Use `create_timer()` with `ignore_time_scale = true`:
   ```gdscript
   func hitstop(duration: float):
       Engine.time_scale = 0.0
       var timer = get_tree().create_timer(duration, false, Timer.TIMER_PROCESS_PHYSICS, true)
       await timer.timeout
       Engine.time_scale = 1.0
   ```
2. For partial hit stop (one entity only), use AnimationTree TimeScale nodes or lerp-based delays instead
3. Never call hitstop on rapid-fire weapons (too many overlapping calls)

**Warning signs:**
- Enemies take damage but don't show hit reaction (collision skipped)
- Projectiles pass through targets during hit stop
- Console errors about collision pairs during time_scale = 0

**Phase to address:** Combat Feedback Phase 1 (hit stop)

---

### Pitfall 3: AudioStreamPlayer Nodes Not Cleaning Up

**What goes wrong:**
Audio plays but never stops. Sound effects layer on top of each other, causing audio cacophony. Memory usage grows over time.

**Why it happens:**
- Creating new AudioStreamPlayer nodes for each SFX without cleanup
- Forgetting to connect the `finished` signal or call `queue_free()`
- Not using `max_polyphony` on reused nodes

**How to avoid:**
1. **Best practice:** Create nodes dynamically, auto-cleanup:
   ```gdscript
   func play_sfx(stream: AudioStream, bus: String = "SFX"):
       var player = AudioStreamPlayer.new()
       player.stream = stream
       player.bus = bus
       add_child(player)
       player.finished.connect(func(): player.queue_free())
       player.play()
   ```
2. **Alternative:** Use `max_polyphony` property on a shared AudioStreamPlayer
3. Centralize audio through an AudioManager autoload

**Warning signs:**
- Sound effects playing multiple times simultaneously
- Audio continuing after scene changes
- Memory profiler showing growing AudioStreamPlayer count
- "Max polyphony reached" warnings

**Phase to address:** Audio Integration Phase 1 (SFX system)

---

### Pitfall 4: Tweens Causing Animation Conflicts

**What goes wrong:**
UI elements jump or stutter instead of animating smoothly. Multiple tweens on the same property fight each other, causing erratic behavior.

**Why it happens:**
- Creating new tweens without stopping existing ones on same property
- Tween interpolation using wrong types (int vs float)
- Node being animated gets `queue_free()`d while tween runs
- Calling `create_tween()` inside `_process()`

**How to avoid:**
1. Always kill existing tweens before starting new ones:
   ```gdscript
   var current_tween: Tween
   
   func animate_to(target: Vector2):
       if current_tween and current_tween.is_valid():
           current_tween.kill()
       current_tween = create_tween()
       current_tween.tween_property(self, "position", target, 0.5)
   ```
2. Use explicit float literals: `.from(0.0)` not `.from(0)`
3. Bind tweens to nodes that won't be freed: `tween.bind_node(self)`
4. Use `await tween.finished` instead of connecting to `finished` signal

**Warning signs:**
- UI elements teleporting instead of moving smoothly
- Console warnings: "Tween was created but never started"
- Animations not playing on subsequent triggers
- Objects disappearing during animations (node freed)

**Phase to address:** UI Polish Phase 1 (tween management)

---

### Pitfall 5: Particle System Performance Death Spiral

**What goes wrong:**
Game runs fine in editor, but stutters badly on mobile. Performance degrades as combat continues. Eventually crashes on low-end devices.

**Why it happens:**
- GPUParticles2D scene instantiation is expensive in Godot 4.4+ (regression from 4.3)
- No pooling for particle effects (spawning new scenes repeatedly)
- Particle count too high for mobile GPU
- Complex shaders on particles causing fragment shader bottleneck

**How to avoid:**
1. **Pool particle effects** using existing ObjectPool pattern:
   ```gdscript
   # Add to ObjectPool.gd
   const KILL_EFFECT_POOL_SIZE: int = 5
   
   func get_kill_effect() -> Node:
       # Same pattern as get_hit_effect()
   ```
2. Reduce particle counts on mobile (check `PerformanceProfiler.is_budget_device()`)
3. Use simple textures (32x32 or smaller) for particles
4. Prefer GPUParticles2D over CPUParticles2D for high-count effects
5. Set `lifetime = 1.0` with `one_shot = true` for combat hit effects

**Warning signs:**
- Godot profiler showing particle rendering as top CPU consumer
- Performance drops after 30+ seconds of combat
- Mobile testing reveals 15-20 FPS during particle-heavy moments
- Scene instantiation causing frame hitches (especially Godot 4.4+)

**Phase to address:** Combat Feedback Phase 2 (particle pooling)

---

### Pitfall 6: Audio Bus Routing Causing Unwanted Effects

**What goes wrong:**
Reverb or other effects bleed between sound types. UI sounds have cave reverb. Music has combat sounds playing in background. Volume controls affect wrong sounds.

**Why it happens:**
- All sounds routed through Master bus only
- No separate buses for SFX/BGM/Voice
- Effects applied to Master bus instead of specific buses
- Bus names change during development without updating references

**How to avoid:**
1. Create dedicated buses: Master → BGM, SFX, Voice
   ```
   Master (output)
   ├── BGM (reverb: subtle room)
   ├── SFX (no effects, just volume)
   └── Voice (reverb: cave for dialogue)
   ```
2. Route effects through dedicated buses, not Master
3. Use `AudioServer.set_bus_volume_db()` for programmatic volume control
4. Keep bus names stable; use index lookup with fallback:
   ```gdscript
   func get_bus_index(bus_name: String) -> int:
       var idx = AudioServer.get_bus_index(bus_name)
       return idx if idx >= 0 else 0  # Fallback to Master
   ```

**Warning signs:**
- UI sounds have environmental reverb
- Combat SFX audible during menu/music
- Volume slider affects unrelated sounds
- "Bus not found" errors in console

**Phase to address:** Audio Integration Phase 1 (bus architecture)

---

### Pitfall 7: Damage Numbers / Kill Effects Not Syncing with Combat

**What goes wrong:**
Damage numbers appear but don't match actual damage dealt. Kill effects play on already-dead enemies. Numbers show wrong values.

**Why it happens:**
- Client-side visual effects not synchronized with server authoritative results
- Damage numbers spawned before server confirms hit
- Kill effects triggered by local health check, not actual death event
- Network latency causing visual/desync

**How to avoid:**
1. **Server-authoritative visuals:** Spawn damage numbers in response to server-computed damage
2. Wait for `combat_action_submitted` signal with server result before spawning visuals
3. Use server-provided damage values, not locally calculated ones
4. For kill effects, listen to actual death events (enemy `died` signal), not health checks:
   ```gdscript
   # Wrong: Local health check
   if health <= 0:
       spawn_kill_effect()
   
   # Right: Server-authoritative death signal
   func _on_enemy_died(enemy_id: String, damage_source: String):
       spawn_kill_effect(enemy_id)
   ```

**Warning signs:**
- Damage numbers differ between what was dealt and what's shown
- Kill effects playing on enemies that don't die
- Visual effects desynced from actual game state in multiplayer
- Players exploiting by seeing damage before server confirms

**Phase to address:** Combat Feedback Phase 2 (visual sync)

---

### Pitfall 8: UI Animation Blocking Input

**What goes wrong:**
Button animations prevent rapid clicking. Menu transitions feel sluggish. Players miss input during transitions or accidentally double-trigger.

**Why it happens:**
- Transitions use `await` blocking the entire input flow
- No animation state tracking to prevent input during transitions
- Tween completes but node state not reset properly
- Back button pressed during forward animation causes visual glitch

**How to avoid:**
1. Track animation state:
   ```gdscript
   var is_animating: bool = false
   
   func transition_to(scene_path: String):
       if is_animating:
           return
       is_animating = true
       
       var tween = create_tween()
       # ... animate out current, animate in new
       
       await tween.finished
       is_animating = false
   ```
2. Use input buffering for important actions during transitions
3. Disable pointer input during animations: `gui.disable_input = true`
4. Prefer `set_deferred()` for input re-enablement to avoid frame timing issues

**Warning signs:**
- Players complaining about "missed" button presses
- Double actions triggering on single taps
- Menu transitions feel sluggish despite smooth animations
- Input blocking on touch devices worse than mouse

**Phase to address:** UI Polish Phase 2 (input safety)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|---------------|-----------------|
| Spawn new nodes for each SFX | Simple code, no pooling logic | Memory leaks, audio layering | Never (MVP only) |
| `Engine.time_scale = 0` for hit stop | Simple implementation | Breaks physics | Only for full-game pauses |
| Hardcoded bus indices | Quick setup | Breaks when adding buses | Only in prototypes |
| Inline tweens without cleanup | Fewer lines of code | Animation conflicts | Only for one-shot animations |
| No pooling for damage numbers | Easy to implement | Performance degradation | Only for < 10 numbers/sec |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Nakama server | Visual effects on client before server confirms | Wait for server RPC response before spawning visuals |
| ObjectPool | Returning pooled objects without resetting state | Call `reset_pooled_state()` in return functions |
| Audio system | Changing volume on nodes directly | Use `AudioServer.set_bus_volume_db()` on buses |
| Camera2D | Adding effects to camera that conflict with shake | Layer camera systems or use camera following + offset |
| Particle systems | One-shot particles never returned to pool | Call `return_hit_effect()` when particle lifetime ends |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| GPUParticles2D scene instantiation | Frame hitches every 0.5s during combat | Pool particle scenes, pre-instantiate | Godot 4.4+ on mobile |
| Multiple overlapping tweens | UI elements teleporting/jumping | Always `kill()` before creating new tweens | Any UI with rapid state changes |
| AudioStreamPlayer proliferation | Audio using 100MB+ memory | Reuse nodes or auto-cleanup | After 5+ minutes of gameplay |
| Screen shake on every hit | Players getting motion sickness | Trauma decay + frequency caps | Players with vestibular issues |
| Unpooled damage numbers | GC stutters every few seconds | Pool damage number labels | > 60 enemies on screen |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|----------|
| Storing SFX paths in user-editable config | Audio injection exploits | Use internal audio index, not paths |
| Loading audio from user-specified paths | Arbitrary file read | Only load from `res://` resources |
| SFX volume multiplier from server | Audio-based side channels | Validate volume is 0.0-1.0 range |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|----------------|
| Screen shake lasts > 300ms | Motion sickness, disorientation | 50-150ms for small hits, 200ms for kills |
| Hit stop > 100ms | Game feels unresponsive | 30-60ms for small hits |
| Sound effects > 0.5s duration for feedback | Delays feel sluggish | Short, punchy sounds (100-300ms) |
| UI animations > 400ms | Transitions feel slow | 150-250ms for micro-interactions |
| No audio for failed actions | Missing feedback loop | Play subtle "error" sound for invalid input |
| Volume sliders non-functional | Users can't adjust to preference | Connect sliders to bus volume, not node volume |

---

## "Looks Done But Isn't" Checklist

- [ ] **Screen Shake:** Often missing noise-based smoothing — verify feels smooth, not jittery
- [ ] **Hit Stop:** Often implemented with `time_scale = 0` breaking physics — verify projectiles don't clip
- [ ] **Damage Numbers:** Often showing local values, not server values — verify multiplayer sync
- [ ] **Audio SFX:** Often leaking nodes — verify memory stable after 10 minutes gameplay
- [ ] **Tweens:** Often not cleaned up — verify animations play correctly on repeated triggers
- [ ] **Particle Effects:** Often not pooled — verify performance stable on mobile
- [ ] **Audio Buses:** Often missing proper routing — verify UI sounds don't have combat reverb
- [ ] **Kill Effects:** Often triggered locally — verify kill effects sync with actual deaths
- [ ] **UI Transitions:** Often blocking input — verify rapid clicking works during animations
- [ ] **Volume Controls:** Often set on nodes — verify master volume affects all audio

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|---------------|
| Screen shake jittery | LOW | Add FastNoiseLite, increase trauma_pwr to 2-3 |
| Hit stop breaking physics | MEDIUM | Refactor to use `ignore_time_scale` timers |
| Audio memory leak | MEDIUM | Add queue_free() in finished signal, audit all AudioStreamPlayers |
| Tween conflicts | LOW | Add kill() before create_tween(), track active tweens |
| Particle performance | MEDIUM | Add pooling, reduce counts, test on low-end device |
| Bus routing bleed | LOW | Restructure bus layout, route effects properly |
| Visual desync | HIGH | Refactor to server-authoritative, add validation |
| Input blocking | LOW | Add is_animating guard, use set_deferred for re-enable |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Screen shake jittery | Combat Feedback 1 | Test on target device, verify smooth not erratic |
| Hit stop physics | Combat Feedback 1 | Test projectiles mid-flight during hit stop |
| Audio node leaks | Audio Integration 1 | Profile memory after 10min gameplay |
| Tween conflicts | UI Polish 1 | Trigger animations rapidly, verify no teleporting |
| Particle performance | Combat Feedback 2 | Test on low-end mobile device |
| Bus routing bleed | Audio Integration 1 | Play combat sounds, verify menu has no reverb |
| Visual desync | Combat Feedback 2 | Multiplayer test, verify numbers match server |
| Input blocking | UI Polish 2 | Rapid-click test during all transitions |

---

# Pixel Art Sprites Pitfalls (v3.2.0)

*Added: 2026-03-24 - For milestone: Adding pixel art sprites to existing Godot game*

---

## Critical Pitfalls

### Pitfall PA-1: Blurry Sprites from Wrong Texture Filter

**What goes wrong:** Pixel art appears blurred, fuzzy, or smeared when rendered in-game.

**Why it happens:** Godot 4 defaults to **Linear texture filtering** for all textures. This blends neighboring pixels when scaling, which is correct for HD graphics but destroys pixel art crispness.

**Consequences:**
- Carefully crafted pixel art looks like a "watercolor" version
- Loss of retro aesthetic
- Player complaints about visual quality
- Need to reimport all sprite assets

**Prevention:**
1. Set project-wide default: `Project Settings → Rendering → Textures → Default Texture Filter = Nearest`
2. **Reimport existing textures** — textures imported before changing the default retain old settings
3. Select all sprite textures in FileSystem, go to Import tab, set Filter to Nearest, click Reimport

**Detection:** Compare editor viewport vs. game running — blurriness often visible in-game but not in editor.

**Sources:**
- [Godot Official Docs - Importing Images](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html) (HIGH)
- [GDQuest - Setting up Pixel Art in Godot 4](https://www.gdquest.com/library/pixel_art_setup_godot4/) (HIGH)
- [Bugnet Blog - Fix Godot 2D Sprites Blurry](https://bugnet.io/blog/fix-godot-2d-sprites-blurry-when-scaled) (HIGH)

---

### Pitfall PA-2: Wrong Stretch Mode Causing Pixel Distortion

**What goes wrong:** Pixels appear stretched, squashed, or non-square on different screen sizes.

**Why it happens:** Incorrect viewport stretch mode. Without proper settings, Godot scales sprites inconsistently, creating non-square pixels.

**Consequences:**
- Inconsistent pixel sizes across resolutions
- "Subpixels" appearing when render resolution isn't integer multiple of base
- Unprofessional appearance on high-DPI displays

**Prevention:**
1. Set `Display → Window → Stretch → Mode = viewport` (or `canvas_items` for mixed UI)
2. Set `Stretch → Aspect = keep` to maintain aspect ratio
3. Set base viewport resolution (e.g., 320×180 or 640×360)
4. Enable `Scale Mode = integer` (Godot 4.3+) for whole-number scaling only
5. Enable `rendering/2d/snap/snap_2d_transforms_to_pixel` for sub-pixel precision

**Detection:** Test on multiple resolutions — 1920×1080, 2560×1440, 3840×2160.

**Sources:**
- [itch.io - Godot 4.4 Settings for Pixel Art](https://itch.io/blog/806788/godot-44-settings-for-pixel-art) (HIGH)
- [Screwloose Games - Pixel Art Guide](https://screwloose-games.github.io/documentation/content/guides/art/pixel_art/pixel_art_guide.html) (HIGH)

---

### Pitfall PA-3: VRAM Compression Artifacts on Pixel Art

**What goes wrong:** Visible compression artifacts, color banding, or "blocky" appearance on pixel art sprites.

**Why it happens:** Using VRAM Compressed or Lossy compression modes designed for high-res textures.

**Consequences:**
- Visible artifacts degrading sprite quality
- Loss of fine color details in pixel art
- Banding in gradients

**Prevention:**
1. Set compress mode to **Lossless** for all pixel art textures
2. For imported sprites: Import tab → Compress → Mode = Lossless
3. Ensure "Detect 3D" doesn't reimport as VRAM Compressed

**Detection:** Inspect sprites at zoom — compression artifacts visible as color blocks.

**Sources:**
- [Godot Official Docs - Compress Mode](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html) (HIGH)

---

## Moderate Pitfalls

### Pitfall PA-4: Forgetting Per-Node Texture Override

**What goes wrong:** Some sprites blur while others are crisp — inconsistent visual quality.

**Why it happens:** Nodes inherit texture filter settings incorrectly, or individual nodes override with Linear.

**Prevention:**
1. Check `CanvasItem → Texture → Filter` on Sprite2D nodes
2. Set parent node to Nearest, let children inherit
3. For materials: Check `Sampling → Filter` in material settings (set to Nearest)

**Sources:**
- [Godot Forum](https://forum.godotengine.org/t/how-to-import-pixel-art-in-godot-4/7105) (MEDIUM)

---

### Pitfall PA-5: Wrong Sprite Sheet Layout Breaking Animations

**What goes wrong:** Animation frames don't line up, or only partial sprite visible.

**Why it happens:**
- Inconsistent frame sizes in sprite sheet
- No padding between frames (sprites "bleed" into neighbors)
- Incorrect AnimationPlayer configuration

**Prevention:**
1. Add 1px transparent border around sprite sheet edges
2. Use consistent frame dimensions across all animation frames
3. Configure AnimationPlayer with correct frame count and fps
4. Test animation in-game, not just editor

**Sources:**
- [Screwloose Games - Pixel Art Guide](https://screwloose-games.github.io/documentation/content/guides/art/pixel_art/pixel_art_guide.html) (MEDIUM)

---

### Pitfall PA-6: Breaking Existing Placeholder System

**What goes wrong:** Replacing placeholder textures breaks game logic, collisions, or UI layouts.

**Why it happens:** Placeholder code expects specific texture sizes, aspect ratios, or sprite sheet layouts.

**Prevention:**
1. Document existing placeholder sprite dimensions and structure
2. Match new pixel art to same dimensions/aspect ratios
3. Maintain consistent anchor points for modular sprites
4. Test all game states after each sprite replacement

**This Project Context:** The existing `modular_character_sprite.gd` uses palette-based coloring. New sprites must work with `GildedSpritePalette` system.

---

### Pitfall PA-7: Not Testing on Target Platform

**What goes wrong:** Sprites look crisp in editor/PC but blurry on mobile or vice versa.

**Why it happens:** Different rendering pipelines, DPI scaling, or GPU texture handling across platforms.

**Consequences:**
- Bad mobile player experience
- Inconsistent brand experience

**Prevention:**
1. Test on target platforms early (mobile, desktop, web)
2. Check both portrait and landscape orientations
3. Test on low-end devices with lower GPU capabilities

---

## Minor Pitfalls

### Pitfall PA-8: Animation Timing Mismatch
**What goes wrong:** Animations feel "off" — too fast, too slow, or inconsistent with gameplay.
**Prevention:** Set animation fps to match game tick rate, test with actual gameplay.

### Pitfall PA-9: Missing Export for Designer Iteration
**What goes wrong:** Designer cannot swap sprites without coder intervention.
**Prevention:** Expose sprite/texture as `@export` properties.

### Pitfall PA-10: Not Using Power-of-Two Dimensions
**What goes wrong:** Potential memory issues, slower loading.
**Prevention:** Use power-of-two dimensions (16×16, 32×32, 64×64).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Player sprite replacement | Breaking existing animation code | Keep same sprite sheet layout as placeholders |
| Enemy sprites | Wrong filter settings | Reimport ALL textures after changing project settings |
| UI icons | Different scale than game sprites | Use consistent filter settings across all icon types |
| Background tiles | TileMap misalignment | Test TileMap integration early, verify grid alignment |
| Modular character system | Color palette not applying | Test `GildedSpritePalette` integration with new sprites |

---

## Integration Checklist for Existing Project

Before adding pixel art to this existing Godot project:

- [ ] **Backup project** before changing import settings
- [ ] Test import settings on ONE sprite first before batch
- [ ] Verify existing `modular_character_sprite.gd` still functions
- [ ] Check `GildedSpritePalette` works with new sprite colors
- [ ] Test on actual mobile device, not just emulator
- [ ] Verify no regression in existing UI layouts

---

## Pixel Art Sources

| Source | Confidence | Relevance |
|--------|------------|-----------|
| Godot Official Docs - Importing Images | HIGH | Import settings, compression modes |
| GDQuest - Pixel Art Setup Godot 4 | HIGH | Complete setup guide |
| itch.io - Godot 4.4 Settings for Pixel Art | HIGH | Current best practices |
| Bugnet - Fix Blurry Sprites | HIGH | Troubleshooting blur issues |
| Screwloose Games - Pixel Art Guide | MEDIUM | Resolution planning, scaling |
| Godot Forums | MEDIUM | Community workarounds |

---

## Sources (Original)

- KidsCanCode: Screen Shake Recipes (https://kidscancode.org/godot_recipes/4.x/2d/screen_shake/)
- The Shaggy Dev: Better Screen Shake (https://shaggydev.com/2022/02/23/screen-shake-godot/)
- Godot Docs: Audio Buses (https://docs.godotengine.org/en/stable/tutorials/audio/audio_buses.html)
- Uhuyama Lab: Godot Audio Management (https://uhiyama-lab.com/en/notes/godot/godot-audio-management-basics-audiostreamplayer-audiobus)
- Godot Engine GitHub: Tween int/float issues (#87326, #86046)
- Godot Engine GitHub: Particle instantiation regression (#104360)
- DashNothing YouTube: Freeze Frame Hit Stop
- Toxigon: GDScript Optimization Guide 2026
- Reddit r/godot: Game juice discussions, hit stop implementation

---

*Pitfalls research for: Godot 4 juice implementation (combat feedback, UI polish, audio integration)*
*Researched: 2026-03-23*

*Pixel Art Pitfalls added: 2026-03-24*
*For milestone: v3.2.0 Pixel Art Sprites*
