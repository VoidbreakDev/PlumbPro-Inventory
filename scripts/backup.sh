#!/bin/bash

# PlumbPro Inventory - Database Backup Script
# Usage: ./backup.sh [full|data|schema]
# Can be run manually or via cron

set -e

BACKUP_TYPE=${1:-full}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$PROJECT_DIR/server/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/server/.env" | xargs)
fi

# Configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-plumbpro_inventory}
DB_USER=${DB_USER:-plumbpro_user}
DB_PASSWORD=${DB_PASSWORD:-}
BACKUP_DIR=${BACKUP_DIR:-"/var/backups/plumbpro"}
RETENTION_DAYS=${RETENTION_DAYS:-30}
DATE=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "💾 PlumbPro Inventory Backup"
echo "================================"
echo "Type: $BACKUP_TYPE"
echo "Date: $(date)"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Build pg_dump options
PGDUMP_OPTS="-h $DB_HOST -p $DB_PORT -U $DB_USER"

if [ "$BACKUP_TYPE" == "schema" ]; then
    PGDUMP_OPTS="$PGDUMP_OPTS --schema-only"
    FILENAME="${DB_NAME}_schema_${DATE}.sql"
elif [ "$BACKUP_TYPE" == "data" ]; then
    PGDUMP_OPTS="$PGDUMP_OPTS --data-only"
    FILENAME="${DB_NAME}_data_${DATE}.sql"
else
    FILENAME="${DB_NAME}_full_${DATE}.sql"
fi

# Perform backup
echo "🔄 Creating backup..."
if PGPASSWORD="$DB_PASSWORD" pg_dump $PGDUMP_OPTS "$DB_NAME" > "$BACKUP_DIR/$FILENAME" 2>/dev/null; then
    echo -e "${GREEN}✓ Backup created: $FILENAME${NC}"
else
    echo -e "${RED}❌ Backup failed${NC}"
    exit 1
fi

# Compress backup
echo "🗜️  Compressing backup..."
gzip -f "$BACKUP_DIR/$FILENAME"
COMPRESSED="${FILENAME}.gz"
echo -e "${GREEN}✓ Compressed: $COMPRESSED${NC}"

# Calculate file size
FILESIZE=$(du -h "$BACKUP_DIR/$COMPRESSED" | cut -f1)
echo "📦 Size: $FILESIZE"

# Cleanup old backups
echo "🧹 Cleaning up old backups..."
DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
echo -e "${GREEN}✓ Removed $DELETED old backups${NC}"

# List recent backups
echo ""
echo "📁 Recent backups:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -5 || echo "  No backups found"

echo ""
echo -e "${GREEN}✅ Backup complete!${NC}"
echo "Location: $BACKUP_DIR/$COMPRESSED"

# Optional: Upload to S3 (if configured)
if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
    echo "☁️  Uploading to S3..."
    aws s3 cp "$BACKUP_DIR/$COMPRESSED" "s3://$S3_BUCKET/backups/"
    echo -e "${GREEN}✓ Uploaded to S3${NC}"
fi
