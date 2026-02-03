#!/bin/bash
# PlumbPro Inventory Desktop Build Script
# Detects platform and builds the appropriate installer

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}PlumbPro Inventory Desktop Builder${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Detect OS
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows (Git Bash, Cygwin, or WSL)
    echo -e "${GREEN}Windows detected${NC}"
    echo ""
    exec "$SCRIPT_DIR/build-desktop-win.bat"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo -e "${GREEN}macOS detected${NC}"
    echo ""
    exec "$SCRIPT_DIR/build-desktop-mac.sh"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo -e "${YELLOW}Linux detected${NC}"
    echo "Note: Linux builds AppImage instead of .exe or .dmg"
    echo ""
    
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    cd "$PROJECT_ROOT"
    
    echo "Step 1: Installing frontend dependencies..."
    npm install --legacy-peer-deps
    echo -e "${GREEN}Done!${NC}"
    
    echo "Step 2: Building frontend..."
    npm run build
    echo -e "${GREEN}Done!${NC}"
    
    echo "Step 3: Installing desktop dependencies..."
    cd desktop
    npm install
    echo -e "${GREEN}Done!${NC}"
    
    echo "Step 4: Building Linux AppImage..."
    npm run package:linux
    echo -e "${GREEN}Done!${NC}"
    
    echo ""
    echo -e "${GREEN}Build complete!${NC}"
    echo "Check desktop/release/ for the AppImage file"
else
    echo -e "${RED}Unknown operating system: $OSTYPE${NC}"
    echo "Please use one of the platform-specific scripts:"
    echo "  - Windows: scripts/build-desktop-win.bat"
    echo "  - macOS:   scripts/build-desktop-mac.sh"
    exit 1
fi
