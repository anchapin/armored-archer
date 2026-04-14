#!/bin/bash
# Build script for Nakama Go module
# Produces a shared object file for Nakama to load

set -e

echo "Building Armored Archer Nakama Go module..."

# Set build environment - CGO must be enabled for plugin mode
export CGO_ENABLED=1
export GOOS=linux
export GOARCH=amd64

# Create build directory
mkdir -p build

# Build as plugin (CGO must be enabled)
go build -buildmode=plugin -o build/server.so ./cmd/server

echo "Build complete: build/server.so ($(du -h build/server.so | cut -f1))"
echo ""
echo "To deploy:"
echo "  1. Ensure docker-compose.yml mounts: ./build/server.so:/nakama/data/modules/server.so"
echo "  2. Update nakama.yml to set go_entrypoint: modules/server.so"
echo "  3. Restart Nakama: docker compose restart nakama"
echo "  4. Check logs: docker compose logs nakama | grep -i 'armored'"
