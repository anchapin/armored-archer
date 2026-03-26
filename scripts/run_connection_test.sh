#!/bin/bash
# Run the connection test scene directly

echo "=========================================="
echo "Armored Archer - Connection Test"
echo "=========================================="
echo ""

# Load environment variables from .env file
if [ -f .env ]; then
    echo "Loading environment from .env..."
    export $(grep -v '^#' .env | xargs)
else
    echo "WARNING: .env file not found, using defaults"
fi

echo "Running connection test scene..."
echo "Press Ctrl+C or close the window to exit"
echo ""

cd /home/alex/armored-archer
godot --path . res://scenes/ui/connection_test_scene.tscn
