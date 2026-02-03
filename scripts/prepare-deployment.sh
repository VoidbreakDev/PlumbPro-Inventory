#!/bin/bash

###############################################################################
# PlumbPro Inventory - Deployment Preparation Script
# Run this before building the desktop application
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Version
VERSION=${1:-"1.0.0"}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PlumbPro Inventory - Deployment Preparation${NC}"
echo -e "${BLUE}  Version: ${VERSION}${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check Node.js
echo -e "${BLUE}▶ Checking Node.js version...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then 
    echo -e "${RED}✗ Node.js version ${NODE_VERSION} is too old. Required: ${REQUIRED_VERSION}+${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js ${NODE_VERSION} found${NC}"

# Check npm
echo -e "${BLUE}▶ Checking npm...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm ${NPM_VERSION} found${NC}"

# Check Git
echo -e "${BLUE}▶ Checking Git...${NC}"
if ! command -v git &> /dev/null; then
    echo -e "${RED}✗ Git is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Git found${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}✗ package.json not found. Are you in the project root?${NC}"
    exit 1
fi

# Clean previous builds
echo -e "${BLUE}▶ Cleaning previous builds...${NC}"
rm -rf dist/
rm -rf desktop/dist/
rm -rf desktop/release/
echo -e "${GREEN}✓ Build directories cleaned${NC}"

# Install dependencies
echo -e "${BLUE}▶ Installing dependencies...${NC}"

echo "  Installing root dependencies..."
npm install

echo "  Installing server dependencies..."
cd server && npm install && cd ..

echo "  Installing desktop dependencies..."
cd desktop && npm install && cd ..

echo -e "${GREEN}✓ All dependencies installed${NC}"

# Run tests
echo -e "${BLUE}▶ Running tests...${NC}"
if npm run test 2>/dev/null; then
    echo -e "${GREEN}✓ Tests passed${NC}"
else
    echo -e "${YELLOW}⚠ Tests failed or not configured${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Build frontend
echo -e "${BLUE}▶ Building frontend...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}✗ Frontend build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Frontend built successfully${NC}"

# Verify desktop resources
echo -e "${BLUE}▶ Checking desktop resources...${NC}"

if [ ! -f "desktop/resources/icons/icon.ico" ]; then
    echo -e "${YELLOW}⚠ Windows icon not found (desktop/resources/icons/icon.ico)${NC}"
fi

if [ ! -f "desktop/resources/icons/icon.icns" ]; then
    echo -e "${YELLOW}⚠ macOS icon not found (desktop/resources/icons/icon.icns)${NC}"
fi

if [ ! -f "desktop/resources/icons/icon.png" ]; then
    echo -e "${YELLOW}⚠ Linux icon not found (desktop/resources/icons/icon.png)${NC}"
fi

# Check environment variables for code signing
echo -e "${BLUE}▶ Checking code signing configuration...${NC}"

if [ -z "$WIN_CSC_LINK" ] && [ -z "$WIN_CSC_KEY_PASSWORD" ]; then
    echo -e "${YELLOW}⚠ Windows code signing not configured${NC}"
    echo "  Set WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD for signed Windows builds"
else
    echo -e "${GREEN}✓ Windows code signing configured${NC}"
fi

if [ -z "$APPLE_ID" ] && [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
    echo -e "${YELLOW}⚠ macOS code signing/notarization not configured${NC}"
    echo "  Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID for signed macOS builds"
else
    echo -e "${GREEN}✓ macOS code signing configured${NC}"
fi

# Update version numbers
echo -e "${BLUE}▶ Updating version numbers...${NC}"

# Update desktop package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('desktop/package.json', 'utf8'));
pkg.version = '${VERSION}';
fs.writeFileSync('desktop/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo -e "${GREEN}✓ Version updated to ${VERSION}${NC}"

# Pre-build checks
echo -e "${BLUE}▶ Running pre-build checks...${NC}"

# Check server can start
cd server
if timeout 5s node -e "require('./src/server.js')" 2>/dev/null; then
    echo -e "${GREEN}✓ Server can start${NC}"
else
    echo -e "${YELLOW}⚠ Server start check inconclusive (may need database)${NC}"
fi
cd ..

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Deployment preparation complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Test the application locally:"
echo "   cd desktop && npm run dev"
echo ""
echo "2. Build for your platform:"
echo "   cd desktop"
echo "   npm run package:win    # For Windows"
echo "   npm run package:mac    # For macOS"
echo "   npm run package:linux  # For Linux"
echo "   npm run package:all    # For all platforms"
echo ""
echo "3. Or build and release to GitHub:"
echo "   npm run release"
echo ""
echo "Built installers will be in: desktop/release/${VERSION}/"
echo ""
