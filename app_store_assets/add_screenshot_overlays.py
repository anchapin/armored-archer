#!/usr/bin/env python3
"""Adds marketing headline overlays to raw app store screenshots."""

import os
import sys
from PIL import Image, ImageDraw, ImageFont

HEADLINES = {
    "01_main_menu": "Master the Bow",
    "02_combat": "Epic Combat Awaits",
    "03_gear_inventory": "Collect Legendary Gear",
    "04_loadout": "Build Your Archer",
    "05_shop": "Cosmetic Skins",
    "06_campaign": "Conquer the Realm",
    "07_leaderboard": "Climb the Ranks",
}

OVERLAY_BG = (14, 14, 14, 200)  # RA_SURFACE with alpha
TEXT_COLOR = (255, 172, 84)  # RA_PRIMARY (#ffac54)
SUBTEXT_COLOR = (173, 170, 170)  # RA_ON_SURFACE_VARIANT

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR = os.path.join(SCRIPT_DIR, "..", "user_screenshots")
OUTPUT_BASE = SCRIPT_DIR

IOS_SIZES = {
    "iphone_6_7": (1290, 2796),
    "iphone_5_5": (1242, 2208),
    "ipad": (2048, 2732),
}


def get_font(size: int) -> ImageFont.FreeTypeFont:
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def add_overlay(input_path: str, output_path: str, headline: str) -> None:
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    bar_height = int(h * 0.12)
    draw.rectangle([0, 0, w, bar_height], fill=OVERLAY_BG)

    font_size = max(24, min(w // 14, 80))
    font = get_font(font_size)
    bbox = draw.textbbox((0, 0), headline, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (w - tw) // 2
    y = (bar_height - th) // 2
    draw.text((x, y), headline, fill=TEXT_COLOR, font=font)

    combined = Image.alpha_composite(img, overlay).convert("RGB")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    combined.save(output_path, "PNG")
    print(f"Created: {output_path}")


def main() -> None:
    input_dir = sys.argv[1] if len(sys.argv) > 1 else INPUT_DIR
    if not os.path.isdir(input_dir):
        print(f"Input directory not found: {input_dir}")
        print("Usage: python3 add_screenshot_overlays.py <input_dir>")
        sys.exit(1)

    files = sorted(os.listdir(input_dir))
    screenshots = [f for f in files if f.lower().endswith(".png")]

    for filename in screenshots:
        name = os.path.splitext(filename)[0]
        base = name.split("_", 1)[-1] if "_" in name else name

        headline = HEADLINES.get(name, HEADLINES.get(f"0{base}" if len(base) == 1 else base, name.replace("_", " ").title()))
        input_path = os.path.join(input_dir, filename)

        for device, size in IOS_SIZES.items():
            output_path = os.path.join(OUTPUT_BASE, "ios", "screenshots", device, f"{name}.png")
            add_overlay(input_path, output_path, headline)

        android_path = os.path.join(OUTPUT_BASE, "android", "screenshots", f"{name}.png")
        add_overlay(input_path, android_path, headline)

    print(f"\nProcessed {len(screenshots)} screenshots.")


if __name__ == "__main__":
    main()
