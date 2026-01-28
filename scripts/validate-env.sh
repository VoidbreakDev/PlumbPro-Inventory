#!/bin/bash

# PlumbPro Inventory - Environment Validation Script
# Checks that all required environment variables and configurations are set

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo "🔍 PlumbPro Inventory - Environment Validation"
echo "=============================================="
echo ""

# Check file exists
check_file() {
    local file=$1
    local required=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} File exists: $file"
        return 0
    else
        if [ "$required" == "required" ]; then
            echo -e "${RED}✗${NC} Missing required file: $file"
            ((ERRORS++))
            return 1
        else
            echo -e "${YELLOW}⚠${NC} Missing optional file: $file"
            ((WARNINGS++))
            return 1
        fi
    fi
}

# Check environment variable
check_env_var() {
    local file=$1
    local var=$2
    local required=$3
    local min_length=$4
    
    if grep -q "^${var}=" "$file" 2>/dev/null; then
        local value=$(grep "^${var}=" "$file" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        
        if [ -z "$value" ]; then
            if [ "$required" == "required" ]; then
                echo -e "${RED}✗${NC} $var is empty (required)"
                ((ERRORS++))
            else
                echo -e "${YELLOW}⚠${NC} $var is empty (optional)"
                ((WARNINGS++))
            fi
            return
        fi
        
        if [ -n "$min_length" ] && [ ${#value} -lt $min_length ]; then
            echo -e "${RED}✗${NC} $var is too short (min $min_length chars)"
            ((ERRORS++))
            return
        fi
        
        # Mask sensitive values
        if [[ "$var" == *PASSWORD* ]] || [[ "$var" == *SECRET* ]] || [[ "$var" == *KEY* ]]; then
            local masked="${value:0:4}****${value: -4}"
            echo -e "${GREEN}✓${NC} $var is set ($masked)"
        else
            echo -e "${GREEN}✓${NC} $var is set ($value)"
        fi
    else
        if [ "$required" == "required" ]; then
            echo -e "${RED}✗${NC} $var is missing (required)"
            ((ERRORS++))
        else
            echo -e "${YELLOW}⚠${NC} $var is missing (optional)"
            ((WARNINGS++))
        fi
    fi
}

# Check command exists
check_command() {
    local cmd=$1
    local required=$2
    
    if command -v $cmd &> /dev/null; then
        local version=$($cmd --version 2>/dev/null | head -1 || echo "installed")
        echo -e "${GREEN}✓${NC} $cmd: $version"
    else
        if [ "$required" == "required" ]; then
            echo -e "${RED}✗${NC} $cmd not found (required)"
            ((ERRORS++))
        else
            echo -e "${YELLOW}⚠${NC} $cmd not found (optional)"
            ((WARNINGS++))
        fi
    fi
}

# Check directory structure
check_directory() {
    local dir=$1
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} Directory exists: $dir"
    else
        echo -e "${YELLOW}⚠${NC} Directory missing: $dir"
        ((WARNINGS++))
    fi
}

echo -e "${BLUE}📁 File Structure${NC}"
echo "------------------"
check_file "$PROJECT_DIR/package.json" required
check_file "$PROJECT_DIR/server/package.json" required
check_file "$PROJECT_DIR/server/.env" required
check_file "$PROJECT_DIR/.env" optional
check_file "$PROJECT_DIR/docker-compose.yml" optional
check_file "$PROJECT_DIR/Dockerfile" optional
echo ""

echo -e "${BLUE}🔐 Backend Environment (server/.env)${NC}"
echo "-------------------------------------"
if [ -f "$PROJECT_DIR/server/.env" ]; then
    check_env_var "$PROJECT_DIR/server/.env" "DB_HOST" required
    check_env_var "$PROJECT_DIR/server/.env" "DB_PORT" optional
    check_env_var "$PROJECT_DIR/server/.env" "DB_NAME" required
    check_env_var "$PROJECT_DIR/server/.env" "DB_USER" required
    check_env_var "$PROJECT_DIR/server/.env" "DB_PASSWORD" required 8
    check_env_var "$PROJECT_DIR/server/.env" "JWT_SECRET" required 32
    check_env_var "$PROJECT_DIR/server/.env" "JWT_EXPIRES_IN" optional
    check_env_var "$PROJECT_DIR/server/.env" "CORS_ORIGIN" required
    check_env_var "$PROJECT_DIR/server/.env" "NODE_ENV" optional
    check_env_var "$PROJECT_DIR/server/.env" "GEMINI_API_KEY" optional
else
    echo -e "${RED}✗ server/.env not found${NC}"
    ((ERRORS++))
fi
echo ""

echo -e "${BLUE}🌐 Frontend Environment (.env)${NC}"
echo "-------------------------------"
if [ -f "$PROJECT_DIR/.env" ]; then
    check_env_var "$PROJECT_DIR/.env" "VITE_API_URL" required
else
    echo -e "${YELLOW}⚠ .env not found (will use defaults)${NC}"
fi
echo ""

echo -e "${BLUE}🔧 System Dependencies${NC}"
echo "----------------------"
check_command "node" required
check_command "npm" required
check_command "psql" optional
check_command "docker" optional
check_command "docker-compose" optional
check_command "pm2" optional
echo ""

echo -e "${BLUE}📂 Required Directories${NC}"
echo "-----------------------"
check_directory "$PROJECT_DIR/dist"
check_directory "$PROJECT_DIR/server/uploads"
check_directory "$PROJECT_DIR/logs"
echo ""

# Node version check
echo -e "${BLUE}📋 Node.js Version${NC}"
echo "------------------"
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
if [ "$NODE_MAJOR" -ge 18 ]; then
    echo -e "${GREEN}✓${NC} Node.js v$NODE_VERSION (supported)"
else
    echo -e "${RED}✗${NC} Node.js v$NODE_VERSION (requires v18+)"
    ((ERRORS++))
fi
echo ""

# Check git security
echo -e "${BLUE}🔒 Git Security Check${NC}"
echo "---------------------"
if [ -d "$PROJECT_DIR/.git" ]; then
    if git ls-files | grep -q "\.env$"; then
        echo -e "${RED}✗${NC} .env files tracked in git!"
        echo "  Run: git rm --cached server/.env .env"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓${NC} No .env files in git"
    fi
else
    echo -e "${YELLOW}⚠${NC} Not a git repository"
fi
echo ""

# Summary
echo "=============================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Environment is ready.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warnings. Environment is usable but could be improved.${NC}"
    exit 0
else
    echo -e "${RED}❌ $ERRORS errors, $WARNINGS warnings. Please fix errors before deploying.${NC}"
    exit 1
fi
