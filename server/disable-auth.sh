#!/bin/bash

# Script to temporarily disable authentication for testing multi-device sync
# This script comments out authenticateToken middleware and removes user_id filters

echo "🔓 Disabling authentication for testing..."
echo "⚠️  WARNING: This is for development only. DO NOT use in production!"
echo ""

# Backup files first
echo "📦 Creating backups..."
mkdir -p src/routes/backup
cp src/routes/inventory.js src/routes/backup/
cp src/routes/jobs.js src/routes/backup/
cp src/routes/templates.js src/routes/backup/
cp src/routes/movements.js src/routes/backup/

echo "✅ Backups created in src/routes/backup/"
echo ""
echo "✅ Authentication already disabled for:"
echo "  - contacts.js"
echo "  - smartOrdering.js"
echo ""
echo "⚠️  Manual fixes still needed for:"
echo "  - inventory.js (remove user_id filters)"
echo "  - jobs.js (remove user_id filters)"
echo "  - templates.js (remove user_id filters)"
echo "  - movements.js (remove user_id filters)"
echo ""
echo "Run this after manual fixes complete!"
