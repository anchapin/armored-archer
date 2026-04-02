#!/usr/bin/env python3
"""
Foley AI Batch Audio Generation for Armored Archer
Generates multiple sound effects using ElevenLabs API in a single batch run.

Requirements:
- requests: pip install requests
- ElevenLabs API key set as environment variable ELEVENLABS_KEY
"""

import os
import sys
import time
import requests
from typing import Dict, List, Tuple

# Configuration
ELEVENLABS_KEY = os.environ.get("ELEVENLABS_KEY")
if not ELEVENLABS_KEY:
    print("Error: ELEVENLABS_KEY environment variable not set")
    print("Get API key from: https://elevenlabs.io/")
    sys.exit(1)

API_URL = "https://api.elevenlabs.io/v1/fg-sound-generation"
OUTPUT_DIR = "res://audio/foley_ai"

# Create output directory
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Sound prompts organized by category
SOUND_LIBRARY = {
    "combat": [
        ("bow_fire_medium", "bow string release with tension echo, medium intensity, sharp metallic twang, 1.0"),
        ("arrow_flight_short", "arrow flying through air with faint whistle, short duration, 0.3"),
        ("arrow_impact_metal", "arrow impact on metal armor, sharp clang, high frequency, 0.4"),
        ("arrow_impact_flesh", "arrow impact on flesh, dull thud, medium frequency, 0.3"),
        ("sword_swing_fast", "sword swing through air, swoosh with slight edge resonance, 0.4"),
        ("sword_impact_shield", "sword impact on metal shield, loud clang, metallic reverberation, 0.6"),
        ("goblin_death", "goblin death, gurgle sound fading quickly, 0.8"),
        ("explosion_small", "small explosion with debris, blast sound with falling rubble tail, 1.2"),
    ],
    "ui": [
        ("button_click_soft", "button press with soft tactile click, very short, 0.1"),
        ("button_release", "button release with subtle spring back, low volume, 0.1"),
        ("toggle_on", "toggle switch on with satisfying click, medium crispness, 0.15"),
        ("toggle_off", "toggle switch off with soft thud, low volume, 0.15"),
        ("success_chime", "success chime, two-note ascending melody, pleasant tone, 0.4"),
        ("level_up", "level up fanfare, short triumphant brass flourish, 0.6"),
        ("error_buzz", "error buzz, low frequency dissonance, short duration, 0.3"),
        ("warning_ping", "warning ping, high frequency tone, attention-grabbing, 0.2"),
    ],
    "movement": [
        ("footstep_concrete_light", "footstep on stone floor, sharp click with slight stone rattle, light, 0.15"),
        ("footstep_wood_medium", "footstep on wooden floorboard, dull thud with slight creak, medium, 0.2"),
        ("footstep_grass_soft", "footstep on grass, soft rustle with earth crush, light, 0.15"),
        ("footstep_water", "footstep in water, splash with droplet ripples, medium, 0.3"),
        ("jump_effort", "jump effort sound, exertion grunt with slight whoosh, 0.3"),
        ("land_light", "landing from jump, light impact with soft dust, 0.2"),
    ],
    "ambient": [
        ("dungeon_ambience", "dungeon ambience, low frequency with distant dripping and wind howl, loop, 5.0"),
        ("forest_ambience", "forest ambience, birdsong with wind through leaves, peaceful, loop, 5.0"),
        ("underground_ambience", "underground ambience, low rumble with water dripping, oppressive, loop, 5.0"),
        ("battle_aftermath", "battle aftermath, low wind with distant cries, somber, loop, 4.0"),
    ],
    "magic": [
        ("fireball_cast", "fireball cast, whoosh with crackling flame buildup, 0.8"),
        ("heal_spell", "heal spell cast, soft chime with ethereal resonance, 0.6"),
        ("shield_block", "shield block, metallic clink with energy hum, 0.3"),
        ("teleport", "teleport, vacuum whoosh with spatial reverb, 0.6"),
    ],
    "vfx": [
        ("screen_shake_low", "screen shake, low rumble with quick fade, 0.5"),
        ("slow_motion", "slow motion, whoosh with pitch shift downward, 0.6"),
        ("speed_boost", "speed boost, whoosh with pitch shift upward, 0.5"),
        ("critical_hit", "critical hit, sharp accent with slight echo, 0.4"),
    ],
}


def generate_sound(name: str, prompt: str, duration: float, category: str) -> Tuple[bool, str]:
    """Generate a single sound effect."""
    try:
        response = requests.post(
            API_URL,
            headers={"xi-api-key": ELEVENLABS_KEY},
            json={
                "text": prompt,
                "duration_seconds": duration,
                "num_iterations": 1,
            },
            timeout=30,
        )

        if response.status_code != 200:
            return False, f"API error: {response.status_code}"

        # Extract audio data from multipart response
        content_type = response.headers.get("Content-Type", "")
        if "audio" not in content_type:
            return False, f"Unexpected content type: {content_type}"

        # Save audio file
        category_dir = os.path.join(OUTPUT_DIR, category)
        os.makedirs(category_dir, exist_ok=True)
        file_path = os.path.join(category_dir, f"{name}.wav")

        with open(file_path, "wb") as f:
            f.write(response.content)

        file_size = len(response.content)
        size_kb = file_size / 1024

        return True, f"{size_kb:.1f} KB"

    except requests.exceptions.Timeout:
        return False, "Request timeout"
    except requests.exceptions.RequestException as e:
        return False, f"Request failed: {e}"
    except Exception as e:
        return False, f"Error: {e}"


def main():
    """Main batch generation function."""
    print("=" * 60)
    print("Foley AI Batch Audio Generation")
    print("=" * 60)

    total_sounds = sum(len(sounds) for sounds in SOUND_LIBRARY.values())
    print(f"Total sounds to generate: {total_sounds}")
    print(f"Output directory: {OUTPUT_DIR}")
    print()

    # Ask for categories or generate all
    print("Available categories:")
    for i, category in enumerate(SOUND_LIBRARY.keys(), 1):
        print(f"  {i}. {category}")
    print(f"  all. Generate all categories")

    choice = input("\nSelect category (or 'all'): ").strip().lower()

    categories_to_generate = []
    if choice == "all":
        categories_to_generate = list(SOUND_LIBRARY.keys())
    elif choice in [str(i) for i in range(1, len(SOUND_LIBRARY) + 1)]:
        categories_to_generate = [list(SOUND_LIBRARY.keys())[int(choice) - 1]]
    else:
        print("Invalid choice. Generating all categories.")
        categories_to_generate = list(SOUND_LIBRARY.keys())

    print()
    print(f"Generating sounds for: {', '.join(categories_to_generate)}")
    print()

    # Generate sounds
    results = []
    for category in categories_to_generate:
        sounds = SOUND_LIBRARY[category]
        print(f"\n[{category.upper()}]")
        for name, prompt, duration in sounds:
            print(f"  Generating {name}...", end=" ")

            success, message = generate_sound(name, prompt, duration, category)

            if success:
                print(f"✓ {message}")
                results.append((category, name, True))
            else:
                print(f"✗ {message}")
                results.append((category, name, False))

            # Rate limiting - avoid overwhelming the API
            time.sleep(0.5)

    # Summary
    print("\n" + "=" * 60)
    print("Generation Complete!")
    print("=" * 60)

    successful = sum(1 for _, _, success in results if success)
    failed = sum(1 for _, _, success in results if not success)

    print(f"Successful: {successful}/{len(results)}")
    print(f"Failed: {failed}/{len(results)}")

    if failed > 0:
        print("\nFailed sounds:")
        for category, name, success in results:
            if not success:
                print(f"  - {category}/{name}")

    total_size = sum(
        os.path.getsize(os.path.join(OUTPUT_DIR, category, f"{name}.wav"))
        for category, name, _ in results
        if os.path.exists(os.path.join(OUTPUT_DIR, category, f"{name}.wav"))
    )
    size_mb = total_size / (1024 * 1024)
    print(f"\nTotal generated: {size_mb:.2f} MB")

    print(f"\nOutput location: {OUTPUT_DIR}")
    print("Import these files in Godot: Drag folder from FileSystem dock to 'res://audio/'")


if __name__ == "__main__":
    main()
