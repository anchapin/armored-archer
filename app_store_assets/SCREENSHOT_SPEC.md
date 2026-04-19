# Screenshot Specification

Reference for all required app store screenshots across iOS and Android.

## Screenshot Slots

Upload order matters — the first screenshot is the most prominent.

| # | Name | Scene/State | Capture Method |
|---|------|-------------|----------------|
| 1 | `01_main_menu` | Main menu fully loaded | `capture_main_menu()` |
| 2 | `02_combat` | Active combat with enemies visible | `capture_combat()` |
| 3 | `03_gear_inventory` | Inventory screen with items | `capture_gear_inventory()` |
| 4 | `04_loadout` | Character loadout screen | `capture_loadout()` |
| 5 | `05_shop` | Cosmetic shop with items | `capture_shop()` |
| 6 | `06_campaign` | Campaign map / stage selection | `capture_campaign()` |
| 7 | `07_leaderboard` | PvP leaderboard | `capture_leaderboard()` |

## Platform Requirements

### iOS (7 screenshots per device)
- **iphone_6_7**: 1290x2796 px (6.7" — iPhone 14 Pro Max+)
- **iphone_5_5**: 1242x2208 px (5.5" — iPhone 8 Plus)
- **ipad**: 2048x2732 px (iPad Pro 12.9")

### Android (7 screenshots)
- Phone portrait: 1080x1920 px (minimum 320px shortest side, max 3840px longest)
- Optional: tablet screenshots at 2560x1440

## Capture Workflow

1. Run the game in Godot editor or on device
2. Press F12 to capture individual screenshots, or call `capture_all_store_screenshots()` for automated capture
3. Raw screenshots save to `user://screenshots/`
4. Run `python3 app_store_assets/add_screenshot_overlays.py` to add marketing text
5. Final screenshots go into `app_store_assets/{platform}/screenshots/{device}/`

## Guidelines

- No device frames in screenshots
- Text must be readable at thumbnail size
- Show actual gameplay — no mockups
- First 3 screenshots should show the most compelling features
- Use portrait orientation for all
