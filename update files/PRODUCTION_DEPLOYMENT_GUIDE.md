# Production Deployment Guide

This guide walks you through deploying PlumbPro Inventory to production with all security fixes applied.

## ✅ Pre-Deployment Checklist

### 1. Environment Setup

Create your production `.env` file in `server/.env`:

```env
# Database Configuration
DB_HOST=your-db-host.com
DB_PORT=5432
DB_NAME=plumbpro_inventory
DB_USER=plumbpro_user
DB_PASSWORD=your_very_secure_random_password

# Server Configuration
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com

# Security (Generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_here_min_32_chars_long
JWT_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=PlumbPro Inventory <noreply@yourdomain.com>

# AI Configuration (Optional)
GEMINI_API_KEY=your_gemini_key
```

### 2. Frontend Environment

Create `.env` in the root:

```env
VITE_API_URL=https://api.yourdomain.com/api
```

### 3. Security Verification

Run these checks before deploying:

```bash
# 1. Verify no .env files are tracked by git
git ls-files | grep -E "\.env$"
# Should return nothing

# 2. Verify security dependencies are installed
cd server && npm list helmet express-rate-limit

# 3. Test server starts without errors
npm start
```

## 🚀 Deployment Steps

### Option 1: Traditional VPS (DigitalOcean, AWS EC2, etc.)

1. **Setup Server:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install PM2 for process management
sudo npm install -g pm2
```

2. **Setup Database:**
```bash
sudo -u postgres psql

CREATE DATABASE plumbpro_inventory;
CREATE USER plumbpro_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE plumbpro_inventory TO plumbpro_user;
\q
```

3. **Deploy Application:**
```bash
# Clone repository
git clone https://github.com/yourusername/plumbpro-inventory.git
cd plumbpro-inventory

# Install dependencies
npm install
cd server && npm install

# Run migrations
npm run migrate

# Start server with PM2
pm2 start src/server.js --name plumbpro-api
pm2 save
pm2 startup
```

4. **Setup Nginx (Reverse Proxy):**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 2: Docker Deployment

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://plumbpro_user:${DB_PASSWORD}@db:5432/plumbpro_inventory
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=plumbpro_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=plumbpro_inventory
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
```

### Option 3: Railway/Render/Heroku (Platform-as-a-Service)

1. **Railway:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway add --database postgres
railway up
```

2. **Render:**
- Connect your GitHub repository
- Set environment variables in dashboard
- Deploy automatically on push

3. **Heroku:**
```bash
# Install Heroku CLI and login
heroku login

# Create app
heroku create plumbpro-inventory-api

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 32)

# Deploy
git push heroku main
```

## 🔒 SSL/HTTPS Setup

### Let's Encrypt (Free SSL)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal test
sudo certbot renew --dry-run
```

## 🧪 Post-Deployment Testing

### 1. Health Check
```bash
curl https://api.yourdomain.com/health
```

### 2. Authentication Test
```bash
# Register with strong password
curl -X POST https://api.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "fullName": "Test User"
  }'

# Login
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

### 3. Rate Limiting Test
```bash
# Should succeed
for i in {1..3}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://api.yourdomain.com/health
done

# Should eventually return 429 (Too Many Requests)
for i in {1..105}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://api.yourdomain.com/health
done
```

### 4. CORS Test
```bash
# From allowed origin (should succeed)
curl -H "Origin: https://yourdomain.com" \
  -I https://api.yourdomain.com/health

# From disallowed origin (should fail)
curl -H "Origin: https://evil.com" \
  -I https://api.yourdomain.com/health
```

### 5. Security Headers Test
```bash
curl -I https://api.yourdomain.com/health | grep -i "strict-transport\|x-frame\|x-content"
```

## 📊 Monitoring & Maintenance

### 1. Setup Log Rotation

```bash
# Install logrotate
sudo apt install logrotate -y

# Create config
sudo tee /etc/logrotate.d/plumbpro << EOF
/var/log/plumbpro/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### 2. Database Backups

```bash
# Create backup script
cat > /opt/backup-plumbpro.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/plumbpro"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -U plumbpro_user plumbpro_inventory > $BACKUP_DIR/backup_$DATE.sql
gzip $BACKUP_DIR/backup_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
EOF

chmod +x /opt/backup-plumbpro.sh

# Add to crontab (daily at 2 AM)
0 2 * * * /opt/backup-plumbpro.sh
```

### 3. Monitoring with PM2

```bash
# Setup PM2 monitoring
pm2 install pm2-server-monit

# View logs
pm2 logs plumbpro-api

# Monitor resources
pm2 monit

# Setup PM2 Plus (optional)
pm2 plus
```

## 🚨 Troubleshooting

### Issue: Server won't start
```bash
# Check logs
pm2 logs

# Verify environment variables
cat server/.env

# Test database connection
psql $DATABASE_URL -c "SELECT 1;"
```

### Issue: CORS errors
```bash
# Verify CORS_ORIGIN matches your frontend URL
echo $CORS_ORIGIN

# Check nginx headers
sudo nginx -t
sudo systemctl restart nginx
```

### Issue: Rate limiting too aggressive
```bash
# Adjust in server/.env
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100      # 100 requests

# Restart server
pm2 restart plumbpro-api
```

## 📈 Scaling Considerations

### When you need to scale:

1. **Database:**
   - Move to managed PostgreSQL (AWS RDS, Google Cloud SQL)
   - Setup read replicas
   - Enable connection pooling (PgBouncer)

2. **Application:**
   - Use Redis for session storage
   - Implement caching layer
   - Deploy multiple instances with load balancer

3. **Static Assets:**
   - Use CDN for frontend assets
   - Implement asset compression
   - Enable browser caching

## 🆘 Emergency Procedures

### If compromised:

1. **Immediate:**
```bash
# Stop server
pm2 stop plumbpro-api

# Rotate JWT secret
# Update server/.env with new secret
pm2 restart plumbpro-api
```

2. **Database:**
```sql
-- Revoke all existing tokens (force re-login)
UPDATE users SET updated_at = NOW();

-- Change database password
ALTER USER plumbpro_user WITH PASSWORD 'new_password';
```

3. **Investigate:**
```bash
# Check logs
cat /var/log/plumbpro/app.log | grep -i "error\|unauthorized"

# Check recent connections
netstat -tuln | grep 5000
```

---

**Your PlumbPro Inventory application is now production-ready with enterprise-grade security! 🚀**
