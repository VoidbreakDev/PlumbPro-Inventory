#!/bin/bash

###############################################################################
# PlumbPro Inventory - Complete Installation Script
# Supports: macOS, Linux
# For Windows, see install.ps1
###############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Version
VERSION="3.0.0"

# Installation directory
INSTALL_DIR="$(pwd)"
DATA_DIR="$HOME/.plumbpro"
LOG_FILE="$DATA_DIR/install.log"

###############################################################################
# Utility Functions
###############################################################################

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  PlumbPro Inventory Installer v${VERSION}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}▶${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

###############################################################################
# Prerequisite Checks
###############################################################################

check_os() {
    print_step "Detecting operating system..."

    OS="$(uname -s)"
    case "${OS}" in
        Linux*)     OS_TYPE=Linux;;
        Darwin*)    OS_TYPE=Mac;;
        *)          OS_TYPE="UNKNOWN:${OS}"
    esac

    if [ "$OS_TYPE" = "UNKNOWN:${OS}" ]; then
        print_error "Unsupported operating system: $OS"
        print_warning "Please use Windows PowerShell script (install.ps1) on Windows"
        exit 1
    fi

    print_success "Operating system: $OS_TYPE"
    log "OS detected: $OS_TYPE"
}

check_node() {
    print_step "Checking for Node.js..."

    if check_command node; then
        NODE_VERSION=$(node -v)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')

        if [ "$MAJOR_VERSION" -ge 18 ]; then
            print_success "Node.js $NODE_VERSION found"
            log "Node.js version: $NODE_VERSION"
            return 0
        else
            print_warning "Node.js version $NODE_VERSION is too old (need v18+)"
            return 1
        fi
    else
        print_warning "Node.js not found"
        return 1
    fi
}

install_node() {
    print_step "Installing Node.js..."

    if [ "$OS_TYPE" = "Mac" ]; then
        if check_command brew; then
            brew install node
        else
            print_error "Homebrew not found. Please install from https://brew.sh"
            print_warning "Then install Node.js: brew install node"
            exit 1
        fi
    elif [ "$OS_TYPE" = "Linux" ]; then
        if check_command apt-get; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif check_command yum; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo yum install -y nodejs
        else
            print_error "Package manager not supported"
            print_warning "Please install Node.js v18+ manually from https://nodejs.org"
            exit 1
        fi
    fi

    print_success "Node.js installed successfully"
}

check_postgres() {
    print_step "Checking for PostgreSQL..."

    if check_command psql; then
        PSQL_VERSION=$(psql --version | awk '{print $3}')
        print_success "PostgreSQL $PSQL_VERSION found"
        log "PostgreSQL version: $PSQL_VERSION"
        return 0
    else
        print_warning "PostgreSQL not found"
        return 1
    fi
}

install_postgres() {
    print_step "Installing PostgreSQL..."

    if [ "$OS_TYPE" = "Mac" ]; then
        if check_command brew; then
            brew install postgresql@15
            brew services start postgresql@15
        else
            print_error "Homebrew required for PostgreSQL installation"
            exit 1
        fi
    elif [ "$OS_TYPE" = "Linux" ]; then
        if check_command apt-get; then
            sudo apt-get update
            sudo apt-get install -y postgresql postgresql-contrib
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
        elif check_command yum; then
            sudo yum install -y postgresql-server postgresql-contrib
            sudo postgresql-setup initdb
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
        fi
    fi

    print_success "PostgreSQL installed successfully"
}

###############################################################################
# Database Setup
###############################################################################

setup_database() {
    print_step "Setting up PostgreSQL database..."

    # Get database credentials
    echo ""
    echo "Database Configuration:"
    echo "━━━━━━━━━━━━━━━━━━━━━━"

    read -p "Database name [plumbpro]: " DB_NAME
    DB_NAME=${DB_NAME:-plumbpro}

    read -p "Database user [plumbpro_user]: " DB_USER
    DB_USER=${DB_USER:-plumbpro_user}

    read -sp "Database password (leave empty for random): " DB_PASSWORD
    echo ""

    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
        print_success "Generated secure password"
    fi

    read -p "Database host [localhost]: " DB_HOST
    DB_HOST=${DB_HOST:-localhost}

    read -p "Database port [5432]: " DB_PORT
    DB_PORT=${DB_PORT:-5432}

    log "Database configuration: $DB_NAME @ $DB_HOST:$DB_PORT"

    # Create database and user
    print_step "Creating database and user..."

    if [ "$OS_TYPE" = "Mac" ]; then
        createdb "$DB_NAME" 2>/dev/null || true
        psql postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
        psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
        psql "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true
    else
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
        sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true
    fi

    print_success "Database created: $DB_NAME"

    # Initialize schema
    print_step "Initializing database schema..."

    export PGPASSWORD="$DB_PASSWORD"

    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$INSTALL_DIR/server/src/db/schema.sql" >> "$LOG_FILE" 2>&1
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$INSTALL_DIR/server/src/db/mobile-schema.sql" >> "$LOG_FILE" 2>&1 || true
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$INSTALL_DIR/server/src/db/workflow-schema.sql" >> "$LOG_FILE" 2>&1 || true
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$INSTALL_DIR/server/src/db/workflow-templates.sql" >> "$LOG_FILE" 2>&1 || true

    unset PGPASSWORD

    print_success "Database schema initialized"

    # Save credentials
    DB_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
}

###############################################################################
# Application Setup
###############################################################################

install_dependencies() {
    print_step "Installing application dependencies..."

    # Backend dependencies
    print_step "Installing server dependencies..."
    cd "$INSTALL_DIR/server"
    npm install --production >> "$LOG_FILE" 2>&1
    print_success "Server dependencies installed"

    # Frontend dependencies
    print_step "Installing client dependencies..."
    cd "$INSTALL_DIR"
    npm install --production >> "$LOG_FILE" 2>&1
    print_success "Client dependencies installed"

    cd "$INSTALL_DIR"
}

create_env_file() {
    print_step "Creating environment configuration..."

    # Get additional configuration
    echo ""
    echo "Application Configuration:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

    read -p "Server port [5001]: " PORT
    PORT=${PORT:-5001}

    read -p "Client port [3000]: " CLIENT_PORT
    CLIENT_PORT=${CLIENT_PORT:-3000}

    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 64 | tr -d "\n")

    # Create .env file
    cat > "$INSTALL_DIR/server/.env" << EOF
# Database Configuration
DATABASE_URL=$DB_URL

# Server Configuration
PORT=$PORT
NODE_ENV=production
CORS_ORIGIN=http://localhost:$CLIENT_PORT

# Security
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# Email Configuration (Optional - configure later if needed)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=PlumbPro Inventory <noreply@plumbpro.com>

# AI Provider Configuration
# Only cloud AI providers are supported (Ollama/local LLM removed for simplicity)
AI_PROVIDER=auto

# Google Gemini AI (Free tier - 60 requests/min)
GEMINI_API_KEY=

# OpenAI (Optional - for Team/Business tiers)
OPENAI_API_KEY=

# Anthropic Claude (Optional - for Business tier)
ANTHROPIC_API_KEY=

# Feature Toggles
ENABLE_NOTIFICATIONS=true

# Feature-Specific AI Providers (all set to auto)
AI_PROVIDER_FORECAST=auto
AI_PROVIDER_SEARCH=auto
AI_PROVIDER_TEMPLATE=auto
AI_PROVIDER_ANOMALY=auto
AI_PROVIDER_PURCHASE_ORDERS=auto
AI_PROVIDER_INSIGHTS=auto
AI_PROVIDER_JOB_COMPLETION=auto
EOF

    # Create client .env
    cat > "$INSTALL_DIR/.env" << EOF
VITE_API_URL=http://localhost:$PORT/api
EOF

    print_success "Environment files created"

    # Save configuration
    mkdir -p "$DATA_DIR"
    cat > "$DATA_DIR/config.json" << EOF
{
  "version": "$VERSION",
  "installDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "databaseUrl": "$DB_URL",
  "serverPort": $PORT,
  "clientPort": $CLIENT_PORT,
  "installDir": "$INSTALL_DIR"
}
EOF

    chmod 600 "$DATA_DIR/config.json"
}

create_admin_user() {
    print_step "Creating administrator account..."

    echo ""
    echo "Administrator Account Setup:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    read -p "Email: " ADMIN_EMAIL
    while [[ ! "$ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; do
        print_error "Invalid email format"
        read -p "Email: " ADMIN_EMAIL
    done

    read -sp "Password (min 8 characters): " ADMIN_PASSWORD
    echo ""

    while [ ${#ADMIN_PASSWORD} -lt 8 ]; do
        print_error "Password must be at least 8 characters"
        read -sp "Password (min 8 characters): " ADMIN_PASSWORD
        echo ""
    done

    read -sp "Confirm password: " ADMIN_PASSWORD_CONFIRM
    echo ""

    while [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]; do
        print_error "Passwords do not match"
        read -sp "Password: " ADMIN_PASSWORD
        echo ""
        read -sp "Confirm password: " ADMIN_PASSWORD_CONFIRM
        echo ""
    done

    read -p "Company name (optional): " COMPANY_NAME

    # Create user via Node.js script
    cd "$INSTALL_DIR/server"

    cat > create-admin.js << 'EOFJS'
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createAdmin() {
    const email = process.argv[2];
    const password = process.argv[3];
    const company = process.argv[4] || '';

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
        `INSERT INTO users (email, password, company, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, email`,
        [email, hashedPassword, company]
    );

    console.log('Admin user created:', result.rows[0].email);
    await pool.end();
}

createAdmin().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
EOFJS

    node create-admin.js "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$COMPANY_NAME" >> "$LOG_FILE" 2>&1
    rm create-admin.js

    print_success "Administrator account created: $ADMIN_EMAIL"

    cd "$INSTALL_DIR"
}

###############################################################################
# Service Creation
###############################################################################

create_systemd_service() {
    if [ "$OS_TYPE" != "Linux" ]; then
        return
    fi

    print_step "Creating systemd service..."

    sudo tee /etc/systemd/system/plumbpro.service > /dev/null << EOF
[Unit]
Description=PlumbPro Inventory Server
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR/server
ExecStart=$(which node) src/server.js
Restart=on-failure
RestartSec=10
StandardOutput=append:$DATA_DIR/server.log
StandardError=append:$DATA_DIR/server-error.log

Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable plumbpro

    print_success "Systemd service created"
}

create_launchd_service() {
    if [ "$OS_TYPE" != "Mac" ]; then
        return
    fi

    print_step "Creating LaunchAgent..."

    mkdir -p "$HOME/Library/LaunchAgents"

    cat > "$HOME/Library/LaunchAgents/com.plumbpro.server.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.plumbpro.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which node)</string>
        <string>$INSTALL_DIR/server/src/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR/server</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$DATA_DIR/server.log</string>
    <key>StandardErrorPath</key>
    <string>$DATA_DIR/server-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
EOF

    launchctl load "$HOME/Library/LaunchAgents/com.plumbpro.server.plist"

    print_success "LaunchAgent created"
}

###############################################################################
# Desktop Shortcuts
###############################################################################

create_desktop_shortcuts() {
    print_step "Creating desktop shortcuts..."

    if [ "$OS_TYPE" = "Mac" ]; then
        # Create macOS app bundle
        BUNDLE_DIR="$HOME/Applications/PlumbPro Inventory.app"
        mkdir -p "$BUNDLE_DIR/Contents/MacOS"
        mkdir -p "$BUNDLE_DIR/Contents/Resources"

        cat > "$BUNDLE_DIR/Contents/MacOS/PlumbPro" << EOF
#!/bin/bash
open "http://localhost:$CLIENT_PORT"
EOF
        chmod +x "$BUNDLE_DIR/Contents/MacOS/PlumbPro"

        cat > "$BUNDLE_DIR/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>PlumbPro Inventory</string>
    <key>CFBundleExecutable</key>
    <string>PlumbPro</string>
    <key>CFBundleIdentifier</key>
    <string>com.plumbpro.inventory</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
</dict>
</plist>
EOF

        print_success "Application bundle created in Applications folder"

    elif [ "$OS_TYPE" = "Linux" ]; then
        # Create .desktop file
        mkdir -p "$HOME/.local/share/applications"

        cat > "$HOME/.local/share/applications/plumbpro.desktop" << EOF
[Desktop Entry]
Name=PlumbPro Inventory
Comment=Professional Inventory Management
Exec=xdg-open http://localhost:$CLIENT_PORT
Icon=$INSTALL_DIR/public/icon-192.png
Terminal=false
Type=Application
Categories=Office;
EOF

        chmod +x "$HOME/.local/share/applications/plumbpro.desktop"

        print_success "Desktop shortcut created"
    fi
}

###############################################################################
# CLI Tool
###############################################################################

create_cli_tool() {
    print_step "Creating CLI management tool..."

    cat > "$INSTALL_DIR/plumbpro.sh" << 'EOFCLI'
#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$HOME/.plumbpro"

case "$1" in
    start)
        echo "Starting PlumbPro Inventory..."
        cd "$SCRIPT_DIR/server" && npm start &
        cd "$SCRIPT_DIR" && npm run dev &
        echo "Server starting... Access at http://localhost:5173"
        ;;
    stop)
        echo "Stopping PlumbPro Inventory..."
        pkill -f "node.*server.js"
        pkill -f "vite"
        echo "Stopped"
        ;;
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    status)
        if pgrep -f "node.*server.js" > /dev/null; then
            echo "✓ Server is running"
        else
            echo "✗ Server is not running"
        fi
        ;;
    logs)
        tail -f "$DATA_DIR/server.log"
        ;;
    backup)
        echo "Creating backup..."
        BACKUP_FILE="$DATA_DIR/backup-$(date +%Y%m%d-%H%M%S).sql"
        source "$SCRIPT_DIR/server/.env"
        pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
        echo "Backup created: $BACKUP_FILE"
        ;;
    update)
        echo "Updating PlumbPro Inventory..."
        cd "$SCRIPT_DIR"
        git pull
        cd server && npm install
        cd "$SCRIPT_DIR" && npm install
        $0 restart
        ;;
    *)
        echo "PlumbPro Inventory CLI"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|backup|update}"
        echo ""
        echo "Commands:"
        echo "  start    - Start the application"
        echo "  stop     - Stop the application"
        echo "  restart  - Restart the application"
        echo "  status   - Check if running"
        echo "  logs     - View server logs"
        echo "  backup   - Create database backup"
        echo "  update   - Update to latest version"
        exit 1
        ;;
esac
EOFCLI

    chmod +x "$INSTALL_DIR/plumbpro.sh"

    # Add to PATH
    if ! grep -q "plumbpro.sh" "$HOME/.bashrc" 2>/dev/null; then
        echo "alias plumbpro='$INSTALL_DIR/plumbpro.sh'" >> "$HOME/.bashrc"
    fi

    if ! grep -q "plumbpro.sh" "$HOME/.zshrc" 2>/dev/null; then
        echo "alias plumbpro='$INSTALL_DIR/plumbpro.sh'" >> "$HOME/.zshrc"
    fi

    print_success "CLI tool created (use 'plumbpro' command)"
}

###############################################################################
# Build Frontend
###############################################################################

build_frontend() {
    print_step "Building production frontend..."

    cd "$INSTALL_DIR"
    npm run build >> "$LOG_FILE" 2>&1

    print_success "Frontend built successfully"
}

###############################################################################
# Main Installation
###############################################################################

main() {
    print_header

    # Create data directory
    mkdir -p "$DATA_DIR"
    touch "$LOG_FILE"

    log "Installation started"
    log "Installation directory: $INSTALL_DIR"

    # OS detection
    check_os

    # Check/install prerequisites
    if ! check_node; then
        read -p "Install Node.js? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_node
        else
            print_error "Node.js is required. Installation cancelled."
            exit 1
        fi
    fi

    if ! check_postgres; then
        read -p "Install PostgreSQL? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_postgres
        else
            print_error "PostgreSQL is required. Installation cancelled."
            exit 1
        fi
    fi

    # Setup
    setup_database
    install_dependencies
    create_env_file
    create_admin_user

    # Build
    build_frontend

    # Services
    if [ "$OS_TYPE" = "Linux" ]; then
        create_systemd_service
    elif [ "$OS_TYPE" = "Mac" ]; then
        create_launchd_service
    fi

    # CLI and shortcuts
    create_cli_tool
    create_desktop_shortcuts

    # Final steps
    log "Installation completed successfully"

    echo ""
    print_header
    print_success "Installation Complete!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Next Steps:"
    echo ""
    echo "1. Start the application:"
    echo "   $INSTALL_DIR/plumbpro.sh start"
    echo "   (or use: plumbpro start)"
    echo ""
    echo "2. Access the application:"
    echo "   http://localhost:$CLIENT_PORT"
    echo ""
    echo "3. Login with your credentials:"
    echo "   Email: $ADMIN_EMAIL"
    echo ""
    echo "Configuration:"
    echo "  - Database: $DB_NAME"
    echo "  - Server Port: $PORT"
    echo "  - Client Port: $CLIENT_PORT"
    echo "  - Data Directory: $DATA_DIR"
    echo "  - Logs: $DATA_DIR/server.log"
    echo ""
    echo "Management Commands:"
    echo "  plumbpro start      - Start application"
    echo "  plumbpro stop       - Stop application"
    echo "  plumbpro status     - Check status"
    echo "  plumbpro logs       - View logs"
    echo "  plumbpro backup     - Backup database"
    echo ""
    echo "Documentation:"
    echo "  Setup Guide: $INSTALL_DIR/SETUP.md"
    echo "  Workflows: $INSTALL_DIR/WORKFLOW_AUTOMATION.md"
    echo "  Mobile Features: $INSTALL_DIR/MOBILE_FEATURES.md"
    echo "  AI Setup: $INSTALL_DIR/AI_PROVIDER_SETUP.md"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Save credentials
    cat > "$DATA_DIR/credentials.txt" << EOF
PlumbPro Inventory - Installation Details
========================================

Installation Date: $(date)

Database:
  Name: $DB_NAME
  User: $DB_USER
  Password: $DB_PASSWORD
  Host: $DB_HOST:$DB_PORT

Administrator Account:
  Email: $ADMIN_EMAIL
  Password: [set during installation]

Application:
  Server: http://localhost:$PORT
  Client: http://localhost:$CLIENT_PORT

IMPORTANT: Keep this file secure and delete after saving credentials elsewhere!
EOF

    chmod 600 "$DATA_DIR/credentials.txt"

    print_warning "Installation details saved to: $DATA_DIR/credentials.txt"
    print_warning "Please save your credentials and delete this file!"
    echo ""
}

# Run installation
main
