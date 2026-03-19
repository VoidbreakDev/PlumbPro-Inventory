#!/bin/bash

# PlumbPro Inventory - Production Startup Script
# Usage: ./start-production.sh [environment]
# Environments: local (default), pm2

set -e

ENVIRONMENT=${1:-local}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting PlumbPro Inventory - Production Mode"
echo "Environment: $ENVIRONMENT"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
check_env() {
    if [ ! -f "$PROJECT_DIR/server/.env" ]; then
        echo -e "${RED}❌ Error: server/.env file not found${NC}"
        echo "Please create it from the example:"
        echo "  cp server/.env.example server/.env"
        exit 1
    fi
}

# Validate environment variables
validate_env() {
    local required_vars=("JWT_SECRET" "DB_PASSWORD")
    local missing=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$PROJECT_DIR/server/.env" || \
           grep "^${var}=" "$PROJECT_DIR/server/.env" | grep -q "^${var}=$"; then
            missing+=("$var")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        echo -e "${RED}❌ Missing required environment variables:${NC}"
        printf '  - %s\n' "${missing[@]}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Environment variables validated${NC}"
}

# Database health check
check_database() {
    echo "🔍 Checking database connection..."
    
    # Source environment variables
    export $(grep -v '^#' "$PROJECT_DIR/server/.env" | xargs)
    
    if command -v psql &> /dev/null; then
        if PGPASSWORD="$DB_PASSWORD" psql -h "${DB_HOST:-localhost}" -U "${DB_USER:-plumbpro_user}" -d "${DB_NAME:-plumbpro_inventory}" -c "SELECT 1" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Database connection successful${NC}"
        else
            echo -e "${YELLOW}⚠️  Database connection failed. Attempting to run migrations...${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  psql not found, skipping database check${NC}"
    fi
}

# Run database migrations
run_migrations() {
    echo "🔄 Running database migrations..."
    cd "$PROJECT_DIR/server"
    
    if [ -f "src/migrations.js" ]; then
        npm run migrate
    else
        echo -e "${YELLOW}⚠️  No migrations script found${NC}"
    fi
}

# Build frontend
build_frontend() {
    echo "🏗️  Building frontend..."
    cd "$PROJECT_DIR"
    
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing frontend dependencies..."
        npm ci
    fi
    
    npm run build
    echo -e "${GREEN}✓ Frontend build complete${NC}"
}

# Start with PM2
start_pm2() {
    echo "🚀 Starting with PM2..."
    
    if ! command -v pm2 &> /dev/null; then
        echo -e "${RED}❌ PM2 not found. Installing...${NC}"
        npm install -g pm2
    fi
    
    cd "$PROJECT_DIR/server"
    
    # Check if already running
    if pm2 list | grep -q "plumbpro-api"; then
        echo "🔄 Restarting existing PM2 process..."
        pm2 restart plumbpro-api
    else
        echo "▶️  Starting new PM2 process..."
        pm2 start src/server.js --name plumbpro-api
        pm2 save
    fi
    
    echo -e "${GREEN}✓ Server running with PM2${NC}"
    echo "View logs: pm2 logs plumbpro-api"
    echo "Monitor: pm2 monit"
}

# Start locally (development)
start_local() {
    echo "💻 Starting locally..."
    cd "$PROJECT_DIR/server"
    
    echo "▶️  Starting server..."
    npm start &
    SERVER_PID=$!
    
    echo -e "${GREEN}✓ Server started (PID: $SERVER_PID)${NC}"
    echo "Press Ctrl+C to stop"
    
    # Wait for interrupt
    trap "kill $SERVER_PID; exit" INT
    wait $SERVER_PID
}

# Main execution
case $ENVIRONMENT in
    local)
        check_env
        validate_env
        check_database || run_migrations
        build_frontend
        start_local
        ;;
    pm2)
        check_env
        validate_env
        check_database || run_migrations
        build_frontend
        start_pm2
        ;;
    *)
        echo "Usage: $0 [local|pm2]"
        echo ""
        echo "Environments:"
        echo "  local  - Run locally (development mode)"
        echo "  pm2    - Run with PM2 process manager"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ PlumbPro Inventory is running!${NC}"
echo "Health Check: http://localhost:5001/health"
