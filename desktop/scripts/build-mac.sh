#!/bin/bash

###############################################################################
# macOS Build Script for PlumbPro Inventory
# Fixes common electron-builder issues on macOS
###############################################################################

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PlumbPro Inventory - macOS Build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if we're in the desktop directory
if [ ! -f "package.json" ] || [ ! -d "main" ]; then
    echo -e "${RED}Error: Please run this script from the desktop/ directory${NC}"
    exit 1
fi

# Fix app-builder permissions
echo "▶ Fixing app-builder permissions..."
chmod +x node_modules/app-builder-bin/mac/app-builder_arm64 2>/dev/null || true
chmod +x node_modules/app-builder-bin/mac/app-builder_amd64 2>/dev/null || true
echo "✓ Permissions fixed"

# Clear electron-builder cache
echo "▶ Clearing electron-builder cache..."
rm -rf ~/Library/Caches/electron-builder 2>/dev/null || true
rm -rf dist/ 2>/dev/null || true
rm -rf release/ 2>/dev/null || true
echo "✓ Cache cleared"

# Check for required tools
echo "▶ Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

echo "✓ Node.js $(node -v) found"

# Check for Python (needed for native modules)
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Warning: Python 3 not found. Some native modules may fail to build.${NC}"
fi

# Set environment variables for build
echo "▶ Setting build environment..."
export PYTHON=$(which python3 2>/dev/null || which python 2>/dev/null || echo "")
export NODE_OPTIONS="--max-old-space-size=4096"

# Detect architecture
ARCH=$(uname -m)
echo "✓ Building for architecture: $ARCH"

# Build the application
echo ""
echo "▶ Building application..."
echo "  This may take several minutes..."
echo ""

# Run the build
if npm run build; then
    echo ""
    echo -e "${GREEN}✓ Build completed successfully!${NC}"
    echo ""
    echo "Find your installer in:"
    ls -1 release/*/*.dmg 2>/dev/null || echo "  (Check release/ directory)"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Build failed${NC}"
    echo ""
    echo "Common fixes:"
    echo "  1. Delete node_modules and run npm install again"
    echo "  2. Ensure Xcode Command Line Tools are installed: xcode-select --install"
    echo "  3. Try building with Rosetta: arch -x86_64 npm run build"
    echo ""
    exit 1
fi
