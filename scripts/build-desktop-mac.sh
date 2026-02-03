#!/bin/bash
# PlumbPro Inventory Desktop Build Script for macOS
# This script builds the macOS installer (.dmg)

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "PlumbPro Inventory Desktop Build (macOS)"
echo "========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "Node.js version:"
node --version
echo ""

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Step 0: Cleaning old builds..."
rm -rf dist desktop/dist desktop/release
echo -e "${GREEN}Done!${NC}"
echo ""

echo "Step 1: Installing frontend dependencies..."
npm install --legacy-peer-deps || {
    echo -e "${RED}ERROR: Failed to install frontend dependencies${NC}"
    exit 1
}
echo -e "${GREEN}Done!${NC}"
echo ""

echo "Step 2: Building frontend..."
npm run build || {
    echo -e "${RED}ERROR: Frontend build failed${NC}"
    exit 1
}
echo -e "${GREEN}Done!${NC}"
echo ""

echo "Step 3: Installing desktop dependencies..."
cd desktop
npm install || {
    echo -e "${RED}ERROR: Failed to install desktop dependencies${NC}"
    exit 1
}
echo -e "${GREEN}Done!${NC}"
echo ""

echo "Step 4: Building macOS installer (.dmg)..."
echo "This may take a few minutes..."
npm run package:mac || {
    echo -e "${RED}ERROR: Desktop build failed${NC}"
    exit 1
}
echo -e "${GREEN}Done!${NC}"
echo ""

echo "========================================="
echo -e "${GREEN}BUILD COMPLETED SUCCESSFULLY!${NC}"
echo "========================================="
echo ""
echo "macOS installer location:"
echo "  desktop/release/[version]/PlumbPro-Inventory-[version]-[arch].dmg"
echo ""
echo "Next steps:"
echo "  1. Test the installer:"
echo "     open desktop/release/[version]/*.dmg"
echo "  2. Upload to GitHub Releases for distribution"
echo ""

# Find and display the actual DMG file
DMG_FILE=$(find "desktop/release" -name "*.dmg" -type f | head -1)
if [ -n "$DMG_FILE" ]; then
    echo -e "${GREEN}Found installer: $DMG_FILE${NC}"
    ls -lh "$DMG_FILE"
fi
echo ""
