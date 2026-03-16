#!/bin/bash
# TypeScript Module Backup Script
# Creates a backup of the TypeScript module for rollback purposes
# Usage: ./backup-typescript-module.sh [backup_directory]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${1:-/opt/nakama/backup}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_SUBDIR="typescript_backup_${TIMESTAMP}"
SOURCE_DIR="$(pwd)"

echo "=========================================="
echo "TypeScript Module Backup"
echo "=========================================="
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Source Directory: $SOURCE_DIR"
echo "  Backup Directory: $BACKUP_DIR"
echo "  Backup Subdirectory: $BACKUP_SUBDIR"
echo ""

# Check if running from backend directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}✗ Error: Must run from backend directory${NC}"
    exit 1
fi

# Create backup directory
echo -e "${BLUE}Creating backup directory...${NC}"
mkdir -p "$BACKUP_DIR/$BACKUP_SUBDIR"

# Backup TypeScript source files
echo ""
echo "=========================================="
echo "Backing Up TypeScript Source"
echo "=========================================="
echo ""

echo -e "${YELLOW}Copying TypeScript source files...${NC}"
cp -r "$SOURCE_DIR/src" "$BACKUP_DIR/$BACKUP_SUBDIR/"
echo -e "${GREEN}✓ Source files backed up${NC}"

# Backup configuration files
echo ""
echo -e "${YELLOW}Copying configuration files...${NC}"
cp "$SOURCE_DIR/package.json" "$BACKUP_DIR/$BACKUP_SUBDIR/"
cp "$SOURCE_DIR/package-lock.json" "$BACKUP_DIR/$BACKUP_SUBDIR/"
cp "$SOURCE_DIR/tsconfig.json" "$BACKUP_DIR/$BACKUP_SUBDIR/"
cp "$SOURCE_DIR/webpack.nakama.config.js" "$BACKUP_DIR/$BACKUP_SUBDIR/"
cp "$SOURCE_DIR/babel.config.js" "$BACKUP_DIR/$BACKUP_SUBDIR/"
cp "$SOURCE_DIR/.env.example" "$BACKUP_DIR/$BACKUP_SUBDIR/" 2>/dev/null || true
echo -e "${GREEN}✓ Configuration files backed up${NC}"

# Build TypeScript module
echo ""
echo "=========================================="
echo "Building TypeScript Module"
echo "=========================================="
echo ""

echo -e "${YELLOW}Installing dependencies...${NC}"
npm install --production

echo ""
echo -e "${YELLOW}Building TypeScript...${NC}"
npm run build

echo -e "${GREEN}✓ Build completed${NC}"

# Backup build output
echo ""
echo -e "${YELLOW}Copying build output...${NC}"
cp -r "$SOURCE_DIR/build" "$BACKUP_DIR/$BACKUP_SUBDIR/"
echo -e "${GREEN}✓ Build output backed up${NC}"

# Create Nakama-ready module
echo ""
echo "=========================================="
echo "Creating Nakama Module Bundle"
echo "=========================================="
echo ""

echo -e "${YELLOW}Creating bundled module...${NC}"
npm run bundle:nakama

# Copy bundled module
if [ -f "$SOURCE_DIR/data/modules/index.js" ]; then
    cp "$SOURCE_DIR/data/modules/index.js" "$BACKUP_DIR/$BACKUP_SUBDIR/server.ts"
    echo -e "${GREEN}✓ Nakama module bundle created${NC}"
else
    echo -e "${RED}✗ Failed to create Nakama module bundle${NC}"
    exit 1
fi

# Create backup manifest
echo ""
echo "=========================================="
echo "Creating Backup Manifest"
echo "=========================================="
echo ""

MANIFEST_FILE="$BACKUP_DIR/$BACKUP_SUBDIR/BACKUP_MANIFEST.json"
cat > "$MANIFEST_FILE" << EOF
{
  "backup_id": "$BACKUP_SUBDIR",
  "timestamp": "$(date -Iseconds)",
  "source_directory": "$SOURCE_DIR",
  "backup_location": "$BACKUP_DIR/$BACKUP_SUBDIR",
  "contents": [
    "src/",
    "build/",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "webpack.nakama.config.js",
    "babel.config.js",
    "server.ts (bundled Nakama module)"
  ],
  "node_version": "$(node --version)",
  "npm_version": "$(npm --version)",
  "typescript_version": "$(npx tsc --version 2>/dev/null | cut -d' ' -f2 || echo 'unknown')",
  "backup_script": "backup-typescript-module.sh"
}
EOF

echo -e "${GREEN}✓ Backup manifest created: $MANIFEST_FILE${NC}"

# Create checksum
echo ""
echo -e "${YELLOW}Creating checksums...${NC}"
CHECKSUM_FILE="$BACKUP_DIR/$BACKUP_SUBDIR/CHECKSUMS.sha256"
cd "$BACKUP_DIR/$BACKUP_SUBDIR"
find . -type f -name "*.ts" -o -name "*.js" -o -name "*.json" | sort | xargs sha256sum > "$CHECKSUM_FILE"
cd "$SOURCE_DIR"
echo -e "${GREEN}✓ Checksums created: $CHECKSUM_FILE${NC}"

# Create README
cat > "$BACKUP_DIR/$BACKUP_SUBDIR/README.md" << EOF
# TypeScript Module Backup

**Backup ID**: $BACKUP_SUBDIR
**Created**: $(date)

## Contents

- \`src/\` - TypeScript source files
- \`build/\` - Compiled JavaScript
- \`server.ts\` - Bundled Nakama module (ready for deployment)
- Configuration files (package.json, tsconfig.json, etc.)

## Restoration

To restore this backup:

\`\`\`bash
# Stop Nakama
sudo systemctl stop nakama

# Copy module
cp $BACKUP_DIR/$BACKUP_SUBDIR/server.ts /opt/nakama/modules/server

# Start Nakama
sudo systemctl start nakama

# Verify
curl http://localhost:7350/health
\`\`\`

## Verification

\`\`\`bash
# Verify checksums
cd $BACKUP_DIR/$BACKUP_SUBDIR
sha256sum -c CHECKSUMS.sha256
\`\`\`

## Build from Source

If you need to rebuild:

\`\`\`bash
npm install
npm run build
npm run bundle:nakama
\`\`\`
EOF

echo -e "${GREEN}✓ README created${NC}"

# Summary
echo ""
echo "=========================================="
echo "Backup Summary"
echo "=========================================="
echo ""
echo -e "${GREEN}✓ TypeScript module backup completed successfully!${NC}"
echo ""
echo "Backup Location: $BACKUP_DIR/$BACKUP_SUBDIR"
echo ""
echo "Backup Contents:"
echo "  - TypeScript source files"
echo "  - Compiled JavaScript"
echo "  - Bundled Nakama module (server.ts)"
echo "  - Configuration files"
echo "  - Build manifest and checksums"
echo ""
echo "To verify this backup:"
echo "  ./scripts/verify-typescript-backup.sh"
echo ""
echo "To restore this backup:"
echo "  sudo cp $BACKUP_DIR/$BACKUP_SUBDIR/server.ts /opt/nakama/modules/server"
echo ""
echo "=========================================="

exit 0
