# Phase 01: Audio Foundation - Research

**Researched:** 2026-03-24
**Domain:** Godot 4.x Audio System Implementation
**Confidence:** HIGH

## Summary

Phase 01 implements audio infrastructure for combat feedback using Godot 4.6+'s native audio system. The core components are: (1) AudioManager autoload with pooled AudioStreamPlayer nodes for SFX, (2) Audio bus configuration with SFX/Music/Ambient buses, and (3) combat SFX integration for hits, kills, and arrow shots. No external dependencies required—all capabilities are native to Godot 4.x.

**Primary recommendation:** Create AudioManager as an autoload with 10 pooled AudioStreamPlayer nodes, configure three audio buses (SFX, Music, Ambient) in default_bus_layout.tres, and wire combat SFX calls to CombatManager/Player.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Godot Engine | 4.6+ | Game engine | Native audio system with buses and players |
| AudioStreamPlayer | Native | Sound playback | Built-in node for non-positional audio |
| AudioServer | Native | Bus control | Programmatic volume control |
| AudioBusLayout | Native | Bus configuration | Persistent bus settings |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| AudioStreamRandomizer | Native | Sound variations | Multiple takes of same sound (e.g., footstep_01, footstep_02) |
| AudioStreamPlayer2D | Native | Positional audio | Future: spatial audio for 3D positioning |

**Installation:**
No installation required—Godot 4.6+ includes all audio capabilities natively. Audio files (WAV/OGG) must be imported to project.

## Architecture Patterns

### Recommended Project Structure
```
autoloads/
├── AudioManager.gd        # SFX pool and playback control
├── ObjectPool.gd          # (existing) General object pooling
assets/
└── audio/
    ├── sfx/
    │   ├── combat/
    │   │   ├── arrow_shot.wav
    │   │   ├── hit.wav
    │   │   └── kill.wav
    │   └── ui/
    └── music/
    └── ambient/
project/
└── default_bus_layout.tres  # Audio bus configuration
```

### Pattern 1: AudioManager Autoload with Player Pool

**What:** Singleton that manages a pool of AudioStreamPlayer nodes to prevent audio cutoff when multiple SFX play simultaneously.

**When to use:** Any game with frequent SFX (combat, UI, environmental) where overlapping sounds can occur.

**Example:**
```gdscript
# Source: KidsCanCode Godot Recipes - Audio Manager
# https://kidscancode.org/godot_recipes/4.x/audio/audio_manager/index.html
extends Node

# Pool configuration - 8-12 players recommended
var num_players: int = 10
var bus: String = "SFX"

var _available: Array[AudioStreamPlayer] = []
var _queue: Array[String] = []

func _ready() -> void:
    # Create pool of AudioStreamPlayer nodes
    for i in num_players:
        var player = AudioStreamPlayer.new()
        add_child(player)
        _available.append(player)
        player.finished.connect(_on_stream_finished.bind(player))
        player.bus = bus

func _on_stream_finished(player: AudioStreamPlayer) -> void:
    # Return player to available pool when finished
    _available.append(player)

func play(sound_path: String) -> void:
    # Queue sound for playback
    _queue.append(sound_path)

func _process(_delta: float) -> void:
    # Play queued sound when player is available
    if not _queue.is_empty() and not _available.is_empty():
        var sound = _queue.pop_front()
        var player = _available.pop_front()
        player.stream = load(sound)
        player.play()
```

**Usage:**
```gdscript
# Anywhere in project
AudioManager.play("res://assets/audio/sfx/combat/arrow_shot.wav")
```

### Pattern 2: Audio Bus Configuration

**What:** Configure audio buses in default_bus_layout.tres for independent volume control.

**When to use:** Games that need separate volume controls for SFX, music, and ambient sounds.

**Example:**
```gdscript
# Source: Godot Documentation - Audio buses
# https://docs.godotengine.org/en/4.4/tutorials/audio/audio_buses.html
extends Node

# Get bus index by name
func get_bus_index(bus_name: String) -> int:
    return AudioServer.get_bus_index(bus_name)

# Set volume in decibels (-80 to 0, where 0 is loudest)
func set_bus_volume(bus_name: String, volume_db: float) -> void:
    var bus_idx = get_bus_index(bus_name)
    AudioServer.set_bus_volume_db(bus_idx, volume_db)

# Example: Slider callback
func _on_sfx_slider_value_changed(value: float) -> void:
    # Convert linear (0-1) to decibels
    var db = linear_to_db(value)
    set_bus_volume("SFX", db)

func linear_to_db(linear: float) -> float:
    if linear <= 0:
        return -80.0
    return 20.0 * log(linear) / log(10.0)
```

### Pattern 3: Combat SFX Integration

**What:** Wire combat events to AudioManager.play() calls for hits, kills, and arrow shots.

**When to use:** Combat games where audio feedback enhances player satisfaction.

**Example:**
```gdscript
# In CombatManager.gd or Player.gd
func _on_arrow_fired() -> void:
    AudioManager.play("res://assets/audio/sfx/combat/arrow_shot.wav")

func _on_enemy_hit(enemy: Node) -> void:
    AudioManager.play("res://assets/audio/sfx/combat/hit.wav")

func _on_enemy_killed(enemy: Node) -> void:
    AudioManager.play("res://assets/audio/sfx/combat/kill.wav")
```

### Anti-Patterns to Avoid

- **Creating AudioStreamPlayer per sound:** Creates audio cutoff when multiple sounds play. Always pool players.
- **Using Master bus for all audio:** No independent volume control. Use separate buses.
- **Hardcoding volume values:** Use AudioServer for programmatic control for settings UI.
- **Loading audio at play time:** Preload streams in _ready() or use load caching to avoid latency.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SFX cutoff | Create/destroy AudioStreamPlayer on demand | Pool 8-12 pre-allocated players | Prevents audio stuttering, reduces GC pressure |
| Volume control | Manually scale volume per player | AudioServer.set_bus_volume_db() | Centralized control, works with settings UI |
| Audio routing | Hardcode target bus in each player | Configure default_bus_layout.tres | Persistent, editor-visible configuration |
| Sound variation | Play identical sound every time | AudioStreamRandomizer for random pitch/variation | More natural, less repetitive |

**Key insight:** Audio cutoff occurs when more sounds play than available voices. Godot's AudioStreamPlayer.max_polyphony defaults to 1, meaning each player handles one sound. Pooling multiple players solves this.

## Common Pitfalls

### Pitfall 1: Audio Cutoff / Stuttering

**What goes wrong:** SFX doesn't play or gets cut off during rapid-fire combat.

**Why it happens:** Using too few AudioStreamPlayer nodes in the pool, or calling play() while all players are busy.

**How to avoid:** Pool 8-12 players (this phase uses 10). Implement queue system that plays pending sounds when players become available.

**Warning signs:** Console messages about voice exhaustion, sounds not playing during combat spam.

### Pitfall 2: Bus Not Found at Runtime

**What goes wrong:** Audio plays on Master instead of intended bus.

**Why it happens:** Bus name typo or bus doesn't exist (e.g., renamed in editor but not code).

**How to avoid:** Use `AudioServer.get_bus_index()` with fallback: if bus doesn't exist, sounds route to Master automatically per Godot behavior.

### Pitfall 3: Audio Files Not Found

**What goes wrong:** AudioManager.play() fails silently, no sound plays.

**Why it happens:** File path incorrect, file not imported to project, or file not in res:// format.

**How to avoid:** Use correct paths (e.g., "res://assets/audio/sfx/combat/hit.wav"), ensure files are in project and imported.

## Code Examples

Verified patterns from official sources:

### SFX Pool with Queue System
```gdscript
# Source: kidscancode.org/godot_recipes
extends Node

var num_players: int = 10
var sfx_bus: String = "SFX"

var _available: Array[AudioStreamPlayer] = []
var _queue: Array[AudioStream] = []

func _ready() -> void:
    for i in num_players:
        var player = AudioStreamPlayer.new()
        add_child(player)
        _available.append(player)
        player.finished.connect(_on_finished.bind(player))
        player.bus = sfx_bus
        player.volume_db = 0.0

func _on_finished(player: AudioStreamPlayer) -> void:
    _available.append(player)

func play(stream: AudioStream) -> void:
    _queue.append(stream)

func _process(_delta: float) -> void:
    while not _queue.is_empty() and not _available.is_empty():
        var stream = _queue.pop_front()
        var player = _available.pop_front()
        player.stream = stream
        player.play()
```

### Volume Control with AudioServer
```gdscript
# Source: Godot Documentation + Inglo Games tutorial
# https://inglo-games.github.io/2020/04/22/audio-busses.html
func set_bus_volume_by_name(bus_name: String, linear_volume: float) -> void:
    var bus_idx = AudioServer.get_bus_index(bus_name)
    if bus_idx >= 0:
        # Convert 0-1 linear to decibels
        var db = linear_to_db(linear_volume)
        AudioServer.set_bus_volume_db(bus_idx, db)

func linear_to_db(linear: float) -> float:
    if linear <= 0.0:
        return -80.0  # Silent
    return 20.0 * log(linear) / log(10.0)

func db_to_linear(db: float) -> float:
    return pow(10.0, db / 20.0)
```

### Sound Variation with Pitch
```gdscript
# Add variation to prevent repetitive sounds
func play_with_variation(stream: AudioStream, player: AudioStreamPlayer) -> void:
    player.stream = stream
    # Random pitch between 0.9 and 1.1 for variation
    player.pitch_scale = randf_range(0.9, 1.1)
    player.play()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single AudioStreamPlayer per scene | Pooled players with queue | Godot 2.x → 4.x | Prevents audio cutoff |
| Hardcoded volume | AudioServer programmatic control | Godot 3.x | Enables runtime volume sliders |
| Static sound playback | AudioStreamRandomizer | Godot 4.x | Natural variation in repeated sounds |

**Deprecated/outdated:**
- **AudioStreamPlayer3D for UI sounds:** Use AudioStreamPlayer (2D/3D positional for game world, non-positional for UI/combat)
- **Direct .wav file loading at runtime:** Use imported AudioStream resources with proper metadata

## Open Questions

1. **Where should combat SFX be triggered?**
   - What we know: CombatManager handles combat logic, Player fires arrows
   - What's unclear: Which node should call AudioManager.play()?
   - Recommendation: Trigger from CombatManager for hits/kills, Player for arrow shots

2. **How to handle missing audio files during development?**
   - What we know: AudioManager needs valid file paths
   - What's unclear: Should there be placeholder sounds or graceful no-op?
   - Recommendation: Add file existence check, print warning if file not found

3. **Should audio be device-tier aware?**
   - What we know: ObjectPool uses PerformanceProfiler for device tiers
   - What's unclear: Should AudioManager reduce pool size on low-end devices?
   - Recommendation: Keep 10 players regardless—audio overhead is minimal compared to visual/physics

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | GUT (Godot Unit Tester) |
| Config file | test/gut_config.gd (if exists) |
| Quick run command | `godot4 --headless --script res://test/run_all_tests.gd` |
| Full suite command | `godot4 --headless --script res://test/run_all_tests.gd` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIO-01 | User hears combat SFX - hits, kills, arrow shots | Integration | Manual verification required | ❌ No test exists |
| AUDIO-04 | Audio buses configured - SFX/Music/Ambient with volume | Unit | Check default_bus_layout.tres exists | ❌ No test exists |
| AUDIO-05 | SFX pool prevents cutoff - 8-12 pooled players | Unit | Verify AudioManager._available size | ❌ No test exists |

### Sampling Rate
- **Per task commit:** Quick run (godot4 headless test)
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/suites/audio/test_audio_manager.gd` — covers AUDIO-05 (pool size verification)
- [ ] `test/suites/audio/test_audio_bus_layout.gd` — covers AUDIO-04 (bus configuration)
- [ ] `test/suites/audio/test_combat_sfx.gd` — covers AUDIO-01 (integration test)
- [ ] Framework install: Uses existing GUT framework (no additional install needed)

## Sources

### Primary (HIGH confidence)
- Godot Documentation - Audio buses: https://docs.godotengine.org/en/4.4/tutorials/audio/audio_buses.html
- Godot Documentation - AudioStreamPlayer: https://docs.godotengine.org/en/4.4/classes/class_audiostreamplayer.html
- Godot Documentation - AudioServer: https://docs.godotengine.org/en/4.4/classes/class_audioserver.html

### Secondary (MEDIUM confidence)
- KidsCanCode - Audio Manager: https://kidscancode.org/godot_recipes/4.x/audio/audio_manager/index.html
- Inglo Games - Using Audio Busses: https://inglo-games.github.io/2020/04/22/audio-busses.html

### Tertiary (LOW confidence)
- GitHub Gist - Simple Godot 4 Audio Singleton: https://gist.github.com/BtheDestroyer/94b941f7e07e06c76ec825c50eafe1f0

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Godot 4.x native audio is well-documented and stable
- Architecture: HIGH - Pooled AudioStreamPlayer is a well-established pattern
- Pitfalls: MEDIUM - Based on community patterns, some edge cases may exist

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (30 days for stable tech)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUDIO-01 | User hears combat SFX — Impact sounds on hits, kills, arrow shots | AudioManager autoload with play() method wired to combat events |
| AUDIO-04 | Audio buses properly configured — SFX/Music/Ambient buses with volume controls | default_bus_layout.tres with 3 buses, AudioServer.set_bus_volume_db() for control |
| AUDIO-05 | SFX pool prevents audio cutoff — Pooled AudioStreamPlayer nodes (8-12 nodes) | 10-player pool with queue system, similar to KidsCanCode pattern |
</phase_requirements>