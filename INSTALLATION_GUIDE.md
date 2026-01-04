# PlumbPro Inventory - Installation Guide

## Quick Start

### Automated Installation (Recommended)

**macOS / Linux:**
```bash
chmod +x install.sh
./install.sh
```

**Windows (PowerShell as Administrator):**
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\install.ps1
```

The installer will:
- ✅ Automatically detect and install Node.js (if missing)
- ✅ Automatically detect and install PostgreSQL (if missing)
- ✅ Create and initialize database
- ✅ Install all dependencies
- ✅ Configure environment variables
- ✅ Create administrator account
- ✅ Build production frontend
- ✅ Set up system services (auto-start on boot)
- ✅ Create desktop shortcuts
- ✅ Install CLI management tool

---

## Detailed Installation Instructions

### System Requirements

**Minimum:**
- **OS**: Windows 10/11, macOS 11+, Ubuntu 20.04+ (or equivalent Linux)
- **RAM**: 2GB
- **Storage**: 500MB
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: 12.0 or higher

**Recommended:**
- **RAM**: 4GB or more
- **Storage**: 2GB (for logs and backups)
- **Node.js**: v20.10.0
- **PostgreSQL**: 15.x

---

## Installation Methods

### Method 1: Automated Installer (Easiest)

#### macOS Installation

1. **Download or Clone Repository:**
   ```bash
   git clone https://github.com/yourusername/PlumbPro-Inventory.git
   cd PlumbPro-Inventory
   ```

2. **Run Installer:**
   ```bash
   chmod +x install.sh
   ./install.sh
   ```

3. **Follow Prompts:**
   - Approve Node.js/PostgreSQL installation if needed
   - Enter database credentials (or use defaults)
   - Set server/client ports (or use defaults: 5000/3000)
   - Create administrator account
   - Wait for installation to complete

4. **Start Application:**
   ```bash
   ./plumbpro.sh start
   ```

5. **Access Application:**
   - Open browser to: `http://localhost:3000`
   - Login with your administrator credentials

#### Linux Installation

Same as macOS, but may require `sudo` for PostgreSQL commands:

```bash
chmod +x install.sh
./install.sh
```

The installer will:
- Install packages via `apt-get` (Ubuntu/Debian) or `yum` (RHEL/CentOS)
- Create systemd service for auto-start
- Configure firewall if needed

#### Windows Installation

1. **Open PowerShell as Administrator**
   - Right-click PowerShell → "Run as Administrator"

2. **Navigate to Installation Directory:**
   ```powershell
   cd "C:\Path\To\PlumbPro-Inventory"
   ```

3. **Allow Script Execution:**
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force
   ```

4. **Run Installer:**
   ```powershell
   .\install.ps1
   ```

5. **Follow Installation Wizard:**
   - Installer will download Node.js/PostgreSQL if needed
   - Configure database settings
   - Set application ports
   - Create admin account

6. **Start Application:**
   ```powershell
   .\plumbpro.ps1 start
   ```

7. **Access Application:**
   - Open browser to: `http://localhost:3000`

---

### Method 2: Manual Installation

For users who prefer full control over the installation process:

#### Step 1: Install Prerequisites

**Install Node.js:**
- **macOS**: `brew install node`
- **Linux**:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```
- **Windows**: Download from [nodejs.org](https://nodejs.org)

**Install PostgreSQL:**
- **macOS**: `brew install postgresql@15`
- **Linux**: `sudo apt-get install postgresql postgresql-contrib`
- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)

#### Step 2: Setup Database

```bash
# Create database
createdb plumbpro

# Create user
psql postgres -c "CREATE USER plumbpro_user WITH PASSWORD 'your_password';"

# Grant privileges
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE plumbpro TO plumbpro_user;"
psql plumbpro -c "GRANT ALL ON SCHEMA public TO plumbpro_user;"

# Initialize schema
psql -U plumbpro_user -d plumbpro -f server/src/db/schema.sql
psql -U plumbpro_user -d plumbpro -f server/src/db/mobile-schema.sql
psql -U plumbpro_user -d plumbpro -f server/src/db/workflow-schema.sql
psql -U plumbpro_user -d plumbpro -f server/src/db/workflow-templates.sql
```

#### Step 3: Configure Environment

Create `server/.env`:
```env
DATABASE_URL=postgresql://plumbpro_user:your_password@localhost:5432/plumbpro
PORT=5000
NODE_ENV=production
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your_random_64_character_secret_here
JWT_EXPIRES_IN=7d
ENABLE_NOTIFICATIONS=true

# AI Configuration (optional)
AI_PROVIDER=auto
GEMINI_API_KEY=
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

Create `.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

#### Step 4: Install Dependencies

```bash
# Install server dependencies
cd server
npm install --production

# Install client dependencies
cd ..
npm install --production
```

#### Step 5: Create Admin User

```bash
cd server
node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createAdmin() {
    const hashedPassword = await bcrypt.hash('YourPassword123!', 10);
    const result = await pool.query(
        'INSERT INTO users (email, password, company) VALUES (\$1, \$2, \$3) RETURNING id, email',
        ['admin@yourcompany.com', hashedPassword, 'Your Company']
    );
    console.log('Admin created:', result.rows[0].email);
    await pool.end();
}

createAdmin();
"
```

#### Step 6: Build Frontend

```bash
npm run build
```

#### Step 7: Start Application

**Development Mode:**
```bash
# Terminal 1: Start server
cd server
npm start

# Terminal 2: Start client
npm run dev
```

**Production Mode:**
```bash
# Start server
cd server
NODE_ENV=production node src/server.js &

# Serve built frontend (use nginx or serve package)
npx serve -s dist -l 3000
```

---

## Post-Installation Configuration

### 1. Email Configuration (Optional)

Edit `server/.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM=PlumbPro Inventory <noreply@yourcompany.com>
```

**Gmail Setup:**
1. Enable 2FA on your Google account
2. Generate App Password: Google Account → Security → App Passwords
3. Use the 16-character app password in SMTP_PASSWORD

### 2. AI Provider Configuration

**Option A: Google Gemini (Free)**
1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add to `.env`: `GEMINI_API_KEY=your_key_here`

**Option B: Ollama (Local, Free)**
1. Install Ollama: [ollama.ai](https://ollama.ai)
2. Pull model: `ollama pull llama3`
3. Ensure `OLLAMA_URL=http://localhost:11434` in `.env`

See `AI_PROVIDER_SETUP.md` for complete AI configuration guide.

### 3. Mobile PWA Setup

The application is already PWA-enabled. To install on mobile:

**iOS:**
1. Open in Safari
2. Tap Share → "Add to Home Screen"

**Android:**
1. Open in Chrome
2. Tap menu → "Install app" or "Add to Home Screen"

---

## Management Commands

### Using the CLI Tool

**macOS/Linux:**
```bash
# Start application
./plumbpro.sh start

# Stop application
./plumbpro.sh stop

# Restart application
./plumbpro.sh restart

# Check status
./plumbpro.sh status

# View logs
./plumbpro.sh logs

# Backup database
./plumbpro.sh backup

# Update application
./plumbpro.sh update
```

**Windows:**
```powershell
# Start application
.\plumbpro.ps1 start

# Stop application
.\plumbpro.ps1 stop

# Restart application
.\plumbpro.ps1 restart

# Check status
.\plumbpro.ps1 status

# View logs
.\plumbpro.ps1 logs

# Backup database
.\plumbpro.ps1 backup

# Update application
.\plumbpro.ps1 update
```

### Service Management

**Linux (systemd):**
```bash
# Start service
sudo systemctl start plumbpro

# Stop service
sudo systemctl stop plumbpro

# Enable auto-start on boot
sudo systemctl enable plumbpro

# Disable auto-start
sudo systemctl disable plumbpro

# View logs
journalctl -u plumbpro -f
```

**macOS (LaunchAgent):**
```bash
# Stop service
launchctl unload ~/Library/LaunchAgents/com.plumbpro.server.plist

# Start service
launchctl load ~/Library/LaunchAgents/com.plumbpro.server.plist

# View logs
tail -f ~/.plumbpro/server.log
```

**Windows (Service):**
```powershell
# Start service
Start-Service PlumbProServer

# Stop service
Stop-Service PlumbProServer

# Restart service
Restart-Service PlumbProServer

# View service status
Get-Service PlumbProServer

# View logs
Get-Content "$env:APPDATA\PlumbPro\server.log" -Wait -Tail 50
```

---

## Updating PlumbPro Inventory

### Automated Update

```bash
# macOS/Linux
./plumbpro.sh update

# Windows
.\plumbpro.ps1 update
```

### Manual Update

```bash
# Stop application
./plumbpro.sh stop  # or .\plumbpro.ps1 stop

# Backup database first!
./plumbpro.sh backup  # or .\plumbpro.ps1 backup

# Pull latest code
git pull origin main

# Update dependencies
cd server && npm install
cd .. && npm install

# Run database migrations (if any)
psql -U plumbpro_user -d plumbpro -f server/src/db/migrations/latest.sql

# Rebuild frontend
npm run build

# Restart application
./plumbpro.sh start  # or .\plumbpro.ps1 start
```

---

## Backup & Restore

### Creating Backups

**Automated (Recommended):**
```bash
./plumbpro.sh backup  # or .\plumbpro.ps1 backup
```

**Manual:**
```bash
# Backup database
pg_dump postgresql://plumbpro_user:password@localhost:5432/plumbpro > backup.sql

# Backup uploaded files (if any)
tar -czf files-backup.tar.gz server/uploads

# Backup configuration
tar -czf config-backup.tar.gz server/.env .env ~/.plumbpro
```

### Restoring from Backup

```bash
# Stop application
./plumbpro.sh stop

# Restore database
psql postgresql://plumbpro_user:password@localhost:5432/plumbpro < backup.sql

# Restore files
tar -xzf files-backup.tar.gz

# Start application
./plumbpro.sh start
```

---

## Uninstallation

### Automated Uninstall

**macOS/Linux:**
```bash
chmod +x uninstall.sh
./uninstall.sh
```

**Windows (PowerShell as Administrator):**
```powershell
# Create and run uninstaller
.\uninstall.ps1
```

### Manual Uninstall

**1. Stop Services:**
```bash
# macOS/Linux
./plumbpro.sh stop
# or
sudo systemctl stop plumbpro  # Linux
launchctl unload ~/Library/LaunchAgents/com.plumbpro.server.plist  # macOS

# Windows
Stop-Service PlumbProServer
```

**2. Remove Database:**
```bash
# macOS/Linux
dropdb plumbpro
psql postgres -c "DROP USER plumbpro_user;"

# Windows
psql -U postgres -c "DROP DATABASE plumbpro;"
psql -U postgres -c "DROP USER plumbpro_user;"
```

**3. Remove Files:**
```bash
# Remove installation directory
cd ..
rm -rf PlumbPro-Inventory

# Remove data directory
rm -rf ~/.plumbpro  # macOS/Linux
# or
Remove-Item -Recurse -Force "$env:APPDATA\PlumbPro"  # Windows

# Remove service (Linux)
sudo systemctl disable plumbpro
sudo rm /etc/systemd/system/plumbpro.service
sudo systemctl daemon-reload

# Remove service (macOS)
rm ~/Library/LaunchAgents/com.plumbpro.server.plist

# Remove service (Windows)
.\nssm.exe remove PlumbProServer confirm
```

---

## Troubleshooting

### Installation Issues

**Problem: "Node.js not found"**
- **Solution**: Ensure Node.js v18+ is installed and in your PATH
- **Verify**: `node --version`

**Problem: "PostgreSQL connection failed"**
- **Solution**: Check PostgreSQL is running
- **Verify**: `psql --version` and `pg_isready`
- **macOS**: `brew services list`
- **Linux**: `sudo systemctl status postgresql`
- **Windows**: Check Services panel

**Problem: "Permission denied" on scripts**
- **Solution macOS/Linux**: `chmod +x install.sh`
- **Solution Windows**: Run PowerShell as Administrator

**Problem: "Port already in use"**
- **Solution**: Change port in `.env` files or stop conflicting service
- **Find process**: `lsof -i :5000` (macOS/Linux) or `netstat -ano | findstr :5000` (Windows)

### Runtime Issues

**Problem: "Database migration failed"**
- **Solution**: Check database user permissions
- **Fix**:
  ```sql
  GRANT ALL ON SCHEMA public TO plumbpro_user;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO plumbpro_user;
  ```

**Problem: "Frontend not loading"**
- **Solution**: Check server is running and CORS_ORIGIN is correct
- **Verify**: `curl http://localhost:5000/health`

**Problem: "Email sending fails"**
- **Solution**: Verify SMTP credentials in `server/.env`
- **Test**: Check Gmail allows "Less secure apps" or use App Password

**Problem: "AI features not working"**
- **Solution**: Check AI provider configuration
- **Gemini**: Verify API key is valid
- **Ollama**: Ensure Ollama is running (`ollama serve`)

### Performance Issues

**Problem: "Slow database queries"**
- **Solution**: Vacuum and analyze database
  ```sql
  VACUUM ANALYZE;
  ```

**Problem: "High memory usage"**
- **Solution**: Increase PostgreSQL shared_buffers in `postgresql.conf`
- **Restart**: `sudo systemctl restart postgresql` (Linux)

**Problem: "Logs filling disk"**
- **Solution**: Rotate logs or clear old logs
  ```bash
  # Clear old logs (keep last 1000 lines)
  tail -n 1000 ~/.plumbpro/server.log > temp.log && mv temp.log ~/.plumbpro/server.log
  ```

---

## Advanced Configuration

### Nginx Reverse Proxy

For production deployments, use Nginx as reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/PlumbPro-Inventory/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL/HTTPS Setup

Use Let's Encrypt for free SSL:

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal (crontab)
0 0 * * * certbot renew --quiet
```

### Docker Deployment (Advanced)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: plumbpro
      POSTGRES_USER: plumbpro_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  server:
    build: ./server
    environment:
      DATABASE_URL: postgresql://plumbpro_user:${DB_PASSWORD}@postgres:5432/plumbpro
      PORT: 5000
      NODE_ENV: production
    ports:
      - "5000:5000"
    depends_on:
      - postgres

  client:
    build: .
    environment:
      VITE_API_URL: http://localhost:5000/api
    ports:
      - "3000:3000"
    depends_on:
      - server

volumes:
  postgres-data:
```

---

## Getting Help

### Documentation
- **Setup Guide**: `SETUP.md`
- **Workflow Automation**: `WORKFLOW_AUTOMATION.md`
- **Mobile Features**: `MOBILE_FEATURES.md`
- **AI Setup**: `AI_PROVIDER_SETUP.md`

### Common Solutions
1. Check installation logs: `~/.plumbpro/install.log`
2. Check server logs: `~/.plumbpro/server.log`
3. Verify environment configuration: `server/.env`
4. Test database connection: `psql $DATABASE_URL`

### Support Resources
- GitHub Issues: [Report bugs or request features]
- Documentation: [Read complete guides]
- Community: [Join discussions]

---

## Security Recommendations

1. **Change Default Passwords**: Update database and admin passwords after installation
2. **Enable Firewall**: Only expose necessary ports
3. **Use HTTPS**: Set up SSL certificate for production
4. **Regular Backups**: Automate daily database backups
5. **Update Regularly**: Keep PlumbPro and dependencies up to date
6. **Secure .env Files**: Set proper file permissions (`chmod 600 server/.env`)
7. **Use Strong JWT Secret**: Generate random 64+ character secret
8. **Enable CSRF Protection**: For production deployments
9. **Review Logs**: Monitor for suspicious activity
10. **Database Encryption**: Enable PostgreSQL SSL for remote connections

---

## Next Steps After Installation

1. **Login**: Access `http://localhost:3000` and login with admin credentials
2. **Configure Email**: Set up SMTP for notifications
3. **Setup AI**: Configure Gemini or Ollama for AI features
4. **Import Data**: Import existing inventory or contacts
5. **Create Workflows**: Set up automated workflows from templates
6. **Add Users**: Create accounts for your team
7. **Mobile Setup**: Install PWA on mobile devices
8. **Test Backup**: Verify backup process works
9. **Schedule Maintenance**: Set up automated backups and updates
10. **Review Documentation**: Read feature guides for full capabilities

---

## License & Credits

PlumbPro Inventory v3.0.0
Copyright © 2024-2026

Built with:
- Node.js
- PostgreSQL
- React 19
- TypeScript
- Express.js
- And many other amazing open-source projects

Thank you for choosing PlumbPro Inventory!
