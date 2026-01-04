#!/bin/bash

###############################################################################
# PlumbPro Inventory - Uninstall Script
# Safely removes PlumbPro Inventory from macOS/Linux
###############################################################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DATA_DIR="$HOME/.plumbpro"
INSTALL_DIR="$(pwd)"

print_header() {
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  PlumbPro Inventory Uninstaller${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}▶${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_header

echo "This will completely remove PlumbPro Inventory from your system."
echo ""
read -p "Do you want to continue? (yes/no) " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Uninstall cancelled"
    exit 0
fi

echo ""
read -p "Remove database data? This cannot be undone! (yes/no) " -r
REMOVE_DB=$REPLY
echo ""

OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS_TYPE=Linux;;
    Darwin*)    OS_TYPE=Mac;;
esac

# Stop services
print_step "Stopping services..."

if [ "$OS_TYPE" = "Linux" ]; then
    sudo systemctl stop plumbpro 2>/dev/null || true
    sudo systemctl disable plumbpro 2>/dev/null || true
    sudo rm -f /etc/systemd/system/plumbpro.service
    sudo systemctl daemon-reload
elif [ "$OS_TYPE" = "Mac" ]; then
    launchctl unload "$HOME/Library/LaunchAgents/com.plumbpro.server.plist" 2>/dev/null || true
    rm -f "$HOME/Library/LaunchAgents/com.plumbpro.server.plist"
fi

# Stop any running processes
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

print_success "Services stopped"

# Remove database
if [[ $REMOVE_DB =~ ^[Yy][Ee][Ss]$ ]]; then
    print_step "Removing database..."

    if [ -f "$DATA_DIR/config.json" ]; then
        DB_NAME=$(grep -o '"databaseUrl"[^,]*' "$DATA_DIR/config.json" | grep -o 'plumbpro' || echo "plumbpro")

        if [ "$OS_TYPE" = "Mac" ]; then
            dropdb "$DB_NAME" 2>/dev/null || true
            psql postgres -c "DROP USER plumbpro_user;" 2>/dev/null || true
        else
            sudo -u postgres psql -c "DROP DATABASE $DB_NAME;" 2>/dev/null || true
            sudo -u postgres psql -c "DROP USER plumbpro_user;" 2>/dev/null || true
        fi

        print_success "Database removed"
    fi
fi

# Remove desktop shortcuts
print_step "Removing shortcuts..."

if [ "$OS_TYPE" = "Mac" ]; then
    rm -rf "$HOME/Applications/PlumbPro Inventory.app"
elif [ "$OS_TYPE" = "Linux" ]; then
    rm -f "$HOME/.local/share/applications/plumbpro.desktop"
fi

print_success "Shortcuts removed"

# Remove CLI alias
print_step "Removing CLI alias..."

if [ -f "$HOME/.bashrc" ]; then
    sed -i.bak '/plumbpro.sh/d' "$HOME/.bashrc"
fi

if [ -f "$HOME/.zshrc" ]; then
    sed -i.bak '/plumbpro.sh/d' "$HOME/.zshrc"
fi

print_success "CLI alias removed"

# Remove data directory
print_step "Removing data directory..."
rm -rf "$DATA_DIR"
print_success "Data directory removed"

# Final message
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Uninstall Complete${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "PlumbPro Inventory has been removed from your system."
echo ""
echo "The following items remain and can be manually deleted:"
echo "  - Installation directory: $INSTALL_DIR"
echo "  - Node.js (if installed by installer)"
echo "  - PostgreSQL (if installed by installer)"
echo ""
echo "Thank you for using PlumbPro Inventory!"
echo ""
