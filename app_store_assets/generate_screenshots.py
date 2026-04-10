# Screenshot Generation Script
# This script generates placeholder screenshots with labels for App Store submission.
# It creates properly sized images for iOS and Android with text indicating what each screen should display.

import os

from PIL import Image, ImageDraw, ImageFont

# Screen types to capture
SCREENS = [
    {"name": "main_menu", "label": "Main Menu", "description": "Main game menu with Play, Settings, Shop buttons"},
    {"name": "combat", "label": "Combat Gameplay", "description": "Action combat with player character and enemies"},
    {"name": "gear_inventory", "label": "Gear Inventory", "description": "Equipment and inventory management screen"},
    {"name": "shop", "label": "Shop Interface", "description": "In-game store with items to purchase"},
    {"name": "leaderboard", "label": "PvP Leaderboard", "description": "Multiplayer rankings and stats"},
    {"name": "campaign", "label": "Stage Selection", "description": "Campaign map and level selection"},
    {"name": "loadout", "label": "Character Loadout", "description": "Character equipment and customization"},
]

# iOS sizes
IOS_SIZES = {
    "iphone_6_7": (1290, 2796),  # 6.7" displays (iPhone 14 Pro Max)
    "iphone_5_5": (1242, 2208),  # 5.5" displays (iPhone 8 Plus)
    "ipad": (2048, 2732),        # iPad Pro 12.9"
}

# Android sizes
ANDROID_SIZES = {
    "phone_portrait": (1080, 1920),
    "phone_landscape": (1920, 1080),
    "tablet": (2560, 1440),
}

def create_placeholder_screenshot(size, label, description, output_path):
    """Create a placeholder screenshot with label and description."""
    img = Image.new('RGB', size, color=(30, 30, 46))  # Dark blue-gray background
    draw = ImageDraw.Draw(img)

    # Try to use a larger font, fall back to default
    try:
        # Try common system fonts
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
        font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
    except OSError:
        # Fall back to default font
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # Draw decorative border
    border_color = (100, 120, 180)
    border_width = 8
    draw.rectangle([0, 0, size[0]-1, size[1]-1], outline=border_color, width=border_width)

    # Draw inner decorative rectangle
    inner_margin = 40
    draw.rectangle(
        [inner_margin, inner_margin, size[0]-inner_margin-1, size[1]-inner_margin-1],
        outline=border_color, width=2
    )

    # Calculate center positions
    center_x = size[0] // 2

    # Draw label at top
    label_y = 150
    draw.text((center_x, label_y), label, fill=(200, 200, 220), font=font_large, anchor="mm")

    # Draw icon placeholder in center
    icon_size = min(size) // 4
    icon_top_left = ((size[0] - icon_size) // 2, (size[1] - icon_size) // 2 - 30)
    draw.rectangle(
        [icon_top_left[0], icon_top_left[1],
         icon_top_left[0] + icon_size, icon_top_left[1] + icon_size],
        outline=(150, 160, 200), width=4
    )

    # Draw description at bottom
    desc_y = size[1] - 150
    draw.text((center_x, desc_y), description, fill=(140, 150, 170), font=font_medium, anchor="mm")

    # Add dimensions label
    dim_text = f"{size[0]} x {size[1]}"
    dim_y = size[1] - 60
    draw.text((center_x, dim_y), dim_text, fill=(80, 90, 110), font=font_small, anchor="mm")

    # Add placeholder note
    note = "PLACEHOLDER - Replace with actual game screenshot"
    note_y = 60
    draw.text((center_x, note_y), note, fill=(255, 100, 100), font=font_small, anchor="mm")

    # Save
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, "PNG")
    print(f"Created: {output_path}")


def main():
    base_path = "/home/alex/armored-archer/app_store_assets"

    # Create iOS screenshots
    ios_base = os.path.join(base_path, "ios", "screenshots")
    for screen in SCREENS[:6]:  # First 6 for iOS (we have 4, but create 6)
        for device, size in IOS_SIZES.items():
            output_path = os.path.join(ios_base, device, f"{screen['name']}.png")
            create_placeholder_screenshot(size, screen['label'], screen['description'], output_path)

    # Create Android screenshots
    android_base = os.path.join(base_path, "android", "screenshots")
    for screen in SCREENS[:6]:
        # Use standard Android sizes
        output_path = os.path.join(android_base, f"{screen['name']}.png")
        create_placeholder_screenshot((1080, 1920), screen['label'], screen['description'], output_path)

    print("\nPlaceholder screenshots created successfully!")
    print("Note: These are placeholder images with labels.")
    print("Replace with actual game screenshots using the Godot screenshot script.")


if __name__ == "__main__":
    main()
