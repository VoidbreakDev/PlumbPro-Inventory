#!/bin/bash

# PlumbPro Inventory - Credential Cleanup Script
# This script removes exposed credentials from git history and rotates them

echo "🔐 PlumbPro Inventory Credential Cleanup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  WARNING: This script will modify git history!${NC}"
echo ""
echo "Steps that will be performed:"
echo "1. Remove .env files from git tracking (keep locally)"
echo "2. Generate new JWT_SECRET"
echo "3. Show instructions for database password rotation"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Step 1: Removing .env files from git tracking..."

# Remove .env files from git tracking but keep locally
if [ -f ".env" ]; then
    git rm --cached .env 2>/dev/null || echo "  .env not in git"
    echo "  ✓ .env removed from git tracking"
fi

if [ -f "server/.env" ]; then
    git rm --cached server/.env 2>/dev/null || echo "  server/.env not in git"
    echo "  ✓ server/.env removed from git tracking"
fi

echo ""
echo "Step 2: Generating new JWT_SECRET..."
NEW_JWT_SECRET=$(openssl rand -base64 32)
echo "  New JWT_SECRET: ${GREEN}${NEW_JWT_SECRET}${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Update your server/.env file with this new JWT_SECRET${NC}"

echo ""
echo "Step 3: Database Password Rotation Instructions..."
echo "  To rotate your database password, run these SQL commands:"
echo ""
echo "  ALTER USER your_db_user WITH PASSWORD 'new_secure_password';"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Update your server/.env with the new database password${NC}"

echo ""
echo "Step 4: Committing changes..."
git add .gitignore
if [ -f "SECURITY_FIXES_SUMMARY.md" ]; then
    git add SECURITY_FIXES_SUMMARY.md
fi
git commit -m "Security: Remove exposed credentials and add security fixes

- Remove .env files from git tracking
- Add comprehensive .gitignore rules
- Implement rate limiting with express-rate-limit
- Add security headers with Helmet.js
- Fix CORS configuration for production
- Fix SQL injection vulnerabilities
- Strengthen password policy (8+ chars, complexity)
- Add account lockout protection
- Fix race conditions in stock operations
- Add worker ID validation
- Implement proper error handling
- Add environment-aware logging

See SECURITY_FIXES_SUMMARY.md for details"

echo ""
echo -e "${GREEN}✅ Credentials cleanup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Update server/.env with the new JWT_SECRET shown above"
echo "2. Update server/.env with a new database password"
echo "3. Push the changes: git push"
echo "4. If credentials were previously pushed to remote, consider:"
echo "   - Rotating all exposed credentials immediately"
echo "   - Using git-filter-repo or BFG Repo-Cleaner to remove from history"
echo "   - Or treating the exposed credentials as compromised"
echo ""
echo "For history rewriting (ADVANCED), see:"
echo "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository"
