#!/usr/bin/env python3
"""Generate SpriteFrames resources for equipment types."""

import os

# Get project root
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))

# Base path for sprites
SPRITES_PATH = os.path.join(project_root, "assets", "sprites", "equipment")

# Equipment types and their sprites
EQUIPMENT_FRAMES = {
    "bow": {
        "sprites": [
            "wooden_bow.tres",
            "composite_bow.tres",
            "elven_bow.tres",
            "dragon_bow.tres",
        ]
    },
    "arrow": {
        "sprites": [
            "wooden_arrow.tres",
            "iron_arrow.tres",
            "steel_arrow.tres",
            "silver_arrow.tres",
            "enchanted_arrow.tres",
        ]
    },
    "armor": {
        "sprites": [
            "leather_armor.tres",
            "chain_armor.tres",
            "plate_armor.tres",
            "dragon_armor.tres",
        ]
    },
    "helm": {
        "sprites": [
            "leather_helm.tres",
            "chain_helm.tres",
            "plate_helm.tres",
            "dragon_helm.tres",
        ]
    },
    "amulet": {
        "sprites": [
            "health_amulet.tres",
            "mana_amulet.tres",
            "speed_amulet.tres",
            "strength_amulet.tres",
        ]
    },
}

def generate_spriteframes(equipment_type: str, sprites: list) -> str:
    """Generate SpriteFrames .tres content for an equipment type."""

    # Build the frames string
    frames = []
    for sprite_file in sprites:
        sprite_name = sprite_file.replace(".tres", "")
        # Use res:// path format for Godot
        res_path = f"res://assets/sprites/equipment/{equipment_type}/{sprite_file}"
        frames.append(f'"{res_path}"')

    frames_str = ",\n".join(frames)

    return f'''[gd_resource type="SpriteFrames" load_steps=3 format=3]

[ext_resource type="Texture2D" id="1" path="res://assets/sprites/equipment/{equipment_type}/{sprites[0]}"]

[resource]
animations = [{{
"frames": [

{frames_str}

],
"loop": true,
"name": &"default",
"speed": 5.0
}}]
'''

def create_spriteframes():
    """Create SpriteFrames resources for each equipment type."""
    total_created = 0

    for equip_type, data in EQUIPMENT_FRAMES.items():
        sprites = data["sprites"]

        # Output file path - use plural form (bow_sprites.tres, etc.)
        output_filename = f"{equip_type}_sprites.tres"
        output_path = os.path.join(SPRITES_PATH, equip_type, output_filename)

        content = generate_spriteframes(equip_type, sprites)

        with open(output_path, "w") as f:
            f.write(content)

        total_created += 1
        print(f"Created: {output_path}")

    print(f"\nTotal SpriteFrames created: {total_created}")

if __name__ == "__main__":
    create_spriteframes()
