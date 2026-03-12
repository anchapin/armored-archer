#!/bin/bash
# App Icon Generation Script
# This script documents the required icon sizes and can generate them from master icons
# Usage: ./generate_icons.sh [ios|android|both]

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Paths
ASSETS_DIR="assets/icons"
APP_STORE_DIR="app_store_assets"

# Function to print section header
print_header() {
    echo ""
    echo "========================================"
    echo "$1"
    echo "========================================"
}

# Function to check if ImageMagick is available
check_imagemagick() {
    if ! command -v convert &> /dev/null; then
        echo -e "${YELLOW}ImageMagick not found. Icon generation disabled.${NC}"
        echo "Install with: brew install imagemagick (macOS) or apt install imagemagick (Linux)"
        return 1
    fi
    return 0
}

# iOS Icon Sizes
print_header "iOS App Icon Sizes"
echo "Master: 1024x1024 (assets/icons/icon_ios_1024.png)"
echo ""
echo "Device-specific sizes (generated from master):"
echo "  - 180x180  (@3x) iPhone App Icon"
echo "  - 120x120  (@2x) iPhone App Icon"
echo "  - 167x167  (@2x) iPad Pro"
echo "  - 152x152  (@2x) iPad"
echo "  - 76x76    (@1x) iPad"
echo "  - 80x80    (@2x) Spotlight"
echo "  - 58x58    (@2x) Settings"
echo "  - 40x40    (@1x) Spotlight"
echo "  - 29x29    (@1x) Settings"
echo ""
echo "App Store assets:"
echo "  - 1024x1024 (app_store_assets/ios/icon_1024x1024.png)"
echo "  - 1200x600  (app_store_assets/ios/feature_graphic_1200x600.png)"

# Android Icon Sizes
print_header "Android App Icon Sizes"
echo "Master: 1024x1024, 512x512 (assets/icons/icon_android_*.png)"
echo ""
echo "Launcher icons (generated from master):"
echo "  - 192x192  xxxhdpi - Adaptive Icon"
echo "  - 144x144  xxxhdpi - Legacy"
echo "  - 96x96    xxhdpi  - Legacy"
echo "  - 72x72    xhdpi   - Legacy"
echo "  - 48x48    mdpi    - Legacy"
echo ""
echo "App Store assets:"
echo "  - 512x512   (app_store_assets/android/icon_512x512.png)"
echo "  - 1024x1024 (app_store_assets/android/icon_1024x1024.png)"
echo "  - 1024x500  (app_store_assets/android/feature_graphic_1024x500.png)"

# Generate iOS icons
generate_ios() {
    print_header "Generating iOS Icons"
    
    check_imagemagick || return
    
    MASTER="$ASSETS_DIR/icon_ios_1024.png"
    
    if [ ! -f "$MASTER" ]; then
        echo -e "${RED}Master icon not found: $MASTER${NC}"
        return 1
    fi
    
    echo "Generating iOS icons from $MASTER..."
    
    # Generate device icons
    convert "$MASTER" -resize 180x180 "$ASSETS_DIR/icon_ios_180.png"
    convert "$MASTER" -resize 120x120 "$ASSETS_DIR/icon_ios_120.png"
    convert "$MASTER" -resize 167x167 "$ASSETS_DIR/icon_ios_167.png"
    convert "$MASTER" -resize 152x152 "$ASSETS_DIR/icon_ios_152.png"
    convert "$MASTER" -resize 76x76 "$ASSETS_DIR/icon_ios_76.png"
    convert "$MASTER" -resize 80x80 "$ASSETS_DIR/icon_ios_spotlight_80.png"
    convert "$MASTER" -resize 58x58 "$ASSETS_DIR/icon_ios_settings_58.png"
    convert "$MASTER" -resize 40x40 "$ASSETS_DIR/icon_ios_spotlight_40.png"
    convert "$MASTER" -resize 29x29 "$ASSETS_DIR/icon_ios_settings_29.png"
    
    # Copy to app store assets
    cp "$MASTER" "$APP_STORE_DIR/ios/icon_1024x1024.png"
    
    echo -e "${GREEN}iOS icons generated successfully!${NC}"
}

# Generate Android icons
generate_android() {
    print_header "Generating Android Icons"
    
    check_imagemagick || return
    
    MASTER_1024="$ASSETS_DIR/icon_android_1024.png"
    MASTER_512="$ASSETS_DIR/icon_android_512.png"
    
    if [ ! -f "$MASTER_1024" ]; then
        echo -e "${RED}Master icon not found: $MASTER_1024${NC}"
        return 1
    fi
    
    echo "Generating Android icons from $MASTER_1024..."
    
    # Generate launcher icons
    convert "$MASTER_1024" -resize 192x192 "$ASSETS_DIR/icon_android_192.png"
    convert "$MASTER_1024" -resize 144x144 "$ASSETS_DIR/icon_android_144.png"
    convert "$MASTER_1024" -resize 96x96 "$ASSETS_DIR/icon_android_96.png"
    convert "$MASTER_1024" -resize 72x72 "$ASSETS_DIR/icon_android_72.png"
    convert "$MASTER_1024" -resize 48x48 "$ASSETS_DIR/icon_android_48.png"
    
    # Copy to app store assets
    cp "$MASTER_512" "$APP_STORE_DIR/android/icon_512x512.png"
    cp "$MASTER_1024" "$APP_STORE_DIR/android/icon_1024x1024.png"
    
    echo -e "${GREEN}Android icons generated successfully!${NC}"
}

# Main
case "${1:-both}" in
    ios)
        generate_ios
        ;;
    android)
        generate_android
        ;;
    both)
        generate_ios
        generate_android
        ;;
    *)
        echo "Usage: $0 [ios|android|both]"
        exit 1
        ;;
esac

print_header "Icon Generation Complete"
echo "See app_store_assets/ICON_SPECIFICATION.md for full documentation"
