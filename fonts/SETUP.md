Gilded Quest UI Foundation - Font Setup Instructions
========================================================

Theme resources have been created with Gilded Quest color palette and typography scale.
The fonts (Plus Jakarta Sans and Be Vietnam Pro) need to be manually downloaded and imported.

DOWNLOAD STEPS:
1. Visit: https://fonts.google.com/specimen/Plus+Jakarta+Sans
2. Click "Download family" to get the variable font
3. Extract: PlusJakartaSans-VariableFont_wght.ttf
4. Copy to: res://fonts/Plus_Jakarta_Sans.ttf

5. Visit: https://fonts.google.com/specimen/Be+Vietnam+Pro
6. Click "Download family" to get the variable font
7. Extract: BeVietnamPro-VariableFont_wght.ttf
8. Copy to: res://fonts/Be_Vietnam_Pro.ttf

AFTER IMPORTING FONDS:
1. Open the LabelSettings resources in Godot editor
2. Assign the font resource to the "Font" property:
   - display_large.tres → Plus_Jakarta_Sans.ttf (56px)
   - headline.tres → Plus_Jakarta_Sans.ttf (28px)
   - title.tres → Plus_Jakarta_Sans.ttf (22px)
   - body.tres → Be_Vietnam_Pro.ttf (16px)
   - body_small.tres → Be_Vietnam_Pro.ttf (14px)

ALTERNATIVE: If you have Node.js, you can use google-fonts-downloader:
  npm install -g google-fonts-downloader
  gfdownloader -f "Plus Jakarta Sans,Be Vietnam Pro" -o res://fonts/

Theme: res://themes/gilded_quest_theme.tres
Project Settings: window/theme/theme set to use this theme
