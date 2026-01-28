# PlumbPro Inventory - Windows Installation Script
# Requires PowerShell 5.1+ and Administrator privileges

#Requires -RunAsAdministrator

[CmdletBinding()]
param(
    [switch]$SkipDependencies,
    [switch]$Unattended
)

$ErrorActionPreference = "Stop"
$VERSION = "3.0.0"

# Paths
$INSTALL_DIR = Get-Location
$DATA_DIR = "$env:APPDATA\PlumbPro"
$LOG_FILE = "$DATA_DIR\install.log"

###############################################################################
# Utility Functions
###############################################################################

function Write-Header {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
    Write-Host "  PlumbPro Inventory Installer v$VERSION" -ForegroundColor Blue
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host "▶ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "[$timestamp] $Message" | Out-File -Append -FilePath $LOG_FILE
}

###############################################################################
# Prerequisite Checks
###############################################################################

function Test-Node {
    Write-Step "Checking for Node.js..."

    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        $version = & node --version
        $major = [int]($version -replace 'v(\d+)\..*', '$1')

        if ($major -ge 18) {
            Write-Success "Node.js $version found"
            Write-Log "Node.js version: $version"
            return $true
        }
        else {
            Write-Warning "Node.js version $version is too old (need v18+)"
            return $false
        }
    }
    else {
        Write-Warning "Node.js not found"
        return $false
    }
}

function Install-Node {
    Write-Step "Installing Node.js..."

    $installerUrl = "https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi"
    $installerPath = "$env:TEMP\node-installer.msi"

    Write-Step "Downloading Node.js installer..."
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath

    Write-Step "Running installer..."
    Start-Process msiexec.exe -ArgumentList "/i `"$installerPath`" /quiet /norestart" -Wait

    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    Remove-Item $installerPath
    Write-Success "Node.js installed successfully"
}

function Test-PostgreSQL {
    Write-Step "Checking for PostgreSQL..."

    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if ($psql) {
        $version = & psql --version
        Write-Success "PostgreSQL found: $version"
        Write-Log "PostgreSQL version: $version"
        return $true
    }
    else {
        Write-Warning "PostgreSQL not found"
        return $false
    }
}

function Install-PostgreSQL {
    Write-Step "Installing PostgreSQL..."

    $installerUrl = "https://get.enterprisedb.com/postgresql/postgresql-15.5-1-windows-x64.exe"
    $installerPath = "$env:TEMP\postgresql-installer.exe"

    Write-Step "Downloading PostgreSQL installer..."
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath

    Write-Step "Running installer (this may take a few minutes)..."
    Write-Warning "Please follow the installer prompts and remember the password you set!"

    Start-Process $installerPath -Wait

    # Add to PATH
    $pgPath = "C:\Program Files\PostgreSQL\15\bin"
    if (Test-Path $pgPath) {
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        if ($currentPath -notlike "*$pgPath*") {
            [Environment]::SetEnvironmentVariable("Path", "$currentPath;$pgPath", "Machine")
        }
    }

    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    Remove-Item $installerPath
    Write-Success "PostgreSQL installed successfully"
}

###############################################################################
# Database Setup
###############################################################################

function Setup-Database {
    Write-Step "Setting up PostgreSQL database..."

    Write-Host ""
    Write-Host "Database Configuration:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━"

    if (-not $Unattended) {
        $script:DB_NAME = Read-Host "Database name [plumbpro]"
        if ([string]::IsNullOrWhiteSpace($DB_NAME)) { $script:DB_NAME = "plumbpro" }

        $script:DB_USER = Read-Host "Database user [plumbpro_user]"
        if ([string]::IsNullOrWhiteSpace($DB_USER)) { $script:DB_USER = "plumbpro_user" }

        $script:DB_PASSWORD = Read-Host "Database password (leave empty for random)" -AsSecureString
        if ($DB_PASSWORD.Length -eq 0) {
            $script:DB_PASSWORD = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 20 | ForEach-Object { [char]$_ })
            Write-Success "Generated secure password"
        }
        else {
            $script:DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DB_PASSWORD))
        }

        $script:DB_HOST = Read-Host "Database host [localhost]"
        if ([string]::IsNullOrWhiteSpace($DB_HOST)) { $script:DB_HOST = "localhost" }

        $script:DB_PORT = Read-Host "Database port [5432]"
        if ([string]::IsNullOrWhiteSpace($DB_PORT)) { $script:DB_PORT = "5432" }
    }
    else {
        $script:DB_NAME = "plumbpro"
        $script:DB_USER = "plumbpro_user"
        $script:DB_PASSWORD = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 20 | ForEach-Object { [char]$_ })
        $script:DB_HOST = "localhost"
        $script:DB_PORT = "5432"
    }

    Write-Log "Database configuration: $DB_NAME @ $DB_HOST:$DB_PORT"

    # Create database and user
    Write-Step "Creating database and user..."

    $env:PGPASSWORD = "postgres"  # Default postgres password

    & psql -U postgres -c "CREATE DATABASE $DB_NAME;" 2>$null
    & psql -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>$null
    & psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>$null
    & psql -U postgres -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>$null

    Write-Success "Database created: $DB_NAME"

    # Initialize schema
    Write-Step "Initializing database schema..."

    $env:PGPASSWORD = $DB_PASSWORD

    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$INSTALL_DIR\server\src\db\schema.sql" 2>&1 | Out-File -Append $LOG_FILE
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$INSTALL_DIR\server\src\db\mobile-schema.sql" 2>&1 | Out-File -Append $LOG_FILE
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$INSTALL_DIR\server\src\db\workflow-schema.sql" 2>&1 | Out-File -Append $LOG_FILE
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$INSTALL_DIR\server\src\db\workflow-templates.sql" 2>&1 | Out-File -Append $LOG_FILE

    Remove-Item Env:\PGPASSWORD

    Write-Success "Database schema initialized"

    # Save connection string
    $script:DB_URL = "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
}

###############################################################################
# Application Setup
###############################################################################

function Install-Dependencies {
    Write-Step "Installing application dependencies..."

    # Backend
    Write-Step "Installing server dependencies..."
    Set-Location "$INSTALL_DIR\server"
    & npm install --production 2>&1 | Out-File -Append $LOG_FILE
    Write-Success "Server dependencies installed"

    # Frontend
    Write-Step "Installing client dependencies..."
    Set-Location $INSTALL_DIR
    & npm install --production 2>&1 | Out-File -Append $LOG_FILE
    Write-Success "Client dependencies installed"
}

function Create-EnvFile {
    Write-Step "Creating environment configuration..."

    Write-Host ""
    Write-Host "Application Configuration:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if (-not $Unattended) {
        $script:PORT = Read-Host "Server port [5000]"
        if ([string]::IsNullOrWhiteSpace($PORT)) { $script:PORT = "5000" }

        $script:CLIENT_PORT = Read-Host "Client port [3000]"
        if ([string]::IsNullOrWhiteSpace($CLIENT_PORT)) { $script:CLIENT_PORT = "3000" }
    }
    else {
        $script:PORT = "5000"
        $script:CLIENT_PORT = "3000"
    }

    # Generate JWT secret
    $JWT_SECRET = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object { [char]$_ })

    # Create server .env
    @"
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
"@ | Out-File -Encoding UTF8 "$INSTALL_DIR\server\.env"

    # Create client .env
    @"
VITE_API_URL=http://localhost:$PORT/api
"@ | Out-File -Encoding UTF8 "$INSTALL_DIR\.env"

    Write-Success "Environment files created"

    # Save configuration
    New-Item -ItemType Directory -Force -Path $DATA_DIR | Out-Null

    @"
{
  "version": "$VERSION",
  "installDate": "$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')",
  "databaseUrl": "$DB_URL",
  "serverPort": $PORT,
  "clientPort": $CLIENT_PORT,
  "installDir": "$INSTALL_DIR"
}
"@ | Out-File -Encoding UTF8 "$DATA_DIR\config.json"
}

function Create-AdminUser {
    Write-Step "Creating administrator account..."

    Write-Host ""
    Write-Host "Administrator Account Setup:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if (-not $Unattended) {
        do {
            $script:ADMIN_EMAIL = Read-Host "Email"
        } while ($ADMIN_EMAIL -notmatch '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

        do {
            $ADMIN_PASSWORD = Read-Host "Password (min 8 characters)" -AsSecureString
            $ADMIN_PASSWORD_TEXT = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ADMIN_PASSWORD))
        } while ($ADMIN_PASSWORD_TEXT.Length -lt 8)

        $ADMIN_PASSWORD_CONFIRM = Read-Host "Confirm password" -AsSecureString
        $ADMIN_PASSWORD_CONFIRM_TEXT = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ADMIN_PASSWORD_CONFIRM))

        while ($ADMIN_PASSWORD_TEXT -ne $ADMIN_PASSWORD_CONFIRM_TEXT) {
            Write-Error "Passwords do not match"
            $ADMIN_PASSWORD = Read-Host "Password" -AsSecureString
            $ADMIN_PASSWORD_TEXT = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ADMIN_PASSWORD))
            $ADMIN_PASSWORD_CONFIRM = Read-Host "Confirm password" -AsSecureString
            $ADMIN_PASSWORD_CONFIRM_TEXT = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ADMIN_PASSWORD_CONFIRM))
        }

        $script:COMPANY_NAME = Read-Host "Company name (optional)"
    }
    else {
        $script:ADMIN_EMAIL = "admin@plumbpro.local"
        $ADMIN_PASSWORD_TEXT = "PlumbPro123!"
        $script:COMPANY_NAME = "PlumbPro"
    }

    # Create admin user
    Set-Location "$INSTALL_DIR\server"

    @"
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
"@ | Out-File -Encoding UTF8 "create-admin.js"

    & node create-admin.js $ADMIN_EMAIL $ADMIN_PASSWORD_TEXT $COMPANY_NAME 2>&1 | Out-File -Append $LOG_FILE
    Remove-Item "create-admin.js"

    Write-Success "Administrator account created: $ADMIN_EMAIL"

    Set-Location $INSTALL_DIR
}

###############################################################################
# Windows Service
###############################################################################

function Create-WindowsService {
    Write-Step "Creating Windows service..."

    # Install NSSM (Non-Sucking Service Manager) if not present
    $nssmPath = "$INSTALL_DIR\nssm.exe"

    if (-not (Test-Path $nssmPath)) {
        Write-Step "Downloading NSSM..."
        $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
        $nssmZip = "$env:TEMP\nssm.zip"
        Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip
        Expand-Archive $nssmZip -DestinationPath $env:TEMP -Force
        Copy-Item "$env:TEMP\nssm-2.24\win64\nssm.exe" $nssmPath
        Remove-Item $nssmZip
    }

    # Create service
    $nodePath = (Get-Command node).Source
    $serverPath = "$INSTALL_DIR\server\src\server.js"

    & $nssmPath install PlumbProServer $nodePath $serverPath
    & $nssmPath set PlumbProServer AppDirectory "$INSTALL_DIR\server"
    & $nssmPath set PlumbProServer AppStdout "$DATA_DIR\server.log"
    & $nssmPath set PlumbProServer AppStderr "$DATA_DIR\server-error.log"
    & $nssmPath set PlumbProServer AppEnvironmentExtra "NODE_ENV=production"
    & $nssmPath set PlumbProServer DisplayName "PlumbPro Inventory Server"
    & $nssmPath set PlumbProServer Description "PlumbPro Inventory Management System Server"
    & $nssmPath set PlumbProServer Start SERVICE_AUTO_START

    Write-Success "Windows service created"
}

###############################################################################
# Desktop Shortcuts
###############################################################################

function Create-DesktopShortcut {
    Write-Step "Creating desktop shortcut..."

    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\PlumbPro Inventory.lnk")
    $Shortcut.TargetPath = "http://localhost:$CLIENT_PORT"
    $Shortcut.IconLocation = "$INSTALL_DIR\public\favicon.ico"
    $Shortcut.Description = "PlumbPro Inventory Management"
    $Shortcut.Save()

    Write-Success "Desktop shortcut created"
}

function Create-StartMenuShortcut {
    Write-Step "Creating Start Menu shortcuts..."

    $startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\PlumbPro Inventory"
    New-Item -ItemType Directory -Force -Path $startMenuPath | Out-Null

    $WshShell = New-Object -comObject WScript.Shell

    # Main application
    $Shortcut = $WshShell.CreateShortcut("$startMenuPath\PlumbPro Inventory.lnk")
    $Shortcut.TargetPath = "http://localhost:$CLIENT_PORT"
    $Shortcut.IconLocation = "$INSTALL_DIR\public\favicon.ico"
    $Shortcut.Save()

    # Management console
    $Shortcut = $WshShell.CreateShortcut("$startMenuPath\PlumbPro Management.lnk")
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-NoExit -File `"$INSTALL_DIR\plumbpro.ps1`""
    $Shortcut.Save()

    Write-Success "Start Menu shortcuts created"
}

###############################################################################
# CLI Tool
###############################################################################

function Create-CLITool {
    Write-Step "Creating CLI management tool..."

    @'
param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "restart", "status", "logs", "backup", "update")]
    [string]$Command
)

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$DATA_DIR = "$env:APPDATA\PlumbPro"

switch ($Command) {
    "start" {
        Write-Host "Starting PlumbPro Inventory..." -ForegroundColor Green
        Start-Service PlumbProServer
        Start-Process "http://localhost:3000"
        Write-Host "Application started" -ForegroundColor Green
    }
    "stop" {
        Write-Host "Stopping PlumbPro Inventory..." -ForegroundColor Yellow
        Stop-Service PlumbProServer
        Write-Host "Application stopped" -ForegroundColor Green
    }
    "restart" {
        Write-Host "Restarting PlumbPro Inventory..." -ForegroundColor Yellow
        Restart-Service PlumbProServer
        Write-Host "Application restarted" -ForegroundColor Green
    }
    "status" {
        $service = Get-Service PlumbProServer -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq "Running") {
            Write-Host "✓ Server is running" -ForegroundColor Green
        } else {
            Write-Host "✗ Server is not running" -ForegroundColor Red
        }
    }
    "logs" {
        Get-Content "$DATA_DIR\server.log" -Wait -Tail 50
    }
    "backup" {
        Write-Host "Creating backup..." -ForegroundColor Yellow
        $backupFile = "$DATA_DIR\backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"
        $env:DATABASE_URL = (Get-Content "$SCRIPT_DIR\server\.env" | Select-String "DATABASE_URL").Line.Split("=")[1]
        pg_dump $env:DATABASE_URL | Out-File $backupFile
        Write-Host "Backup created: $backupFile" -ForegroundColor Green
    }
    "update" {
        Write-Host "Updating PlumbPro Inventory..." -ForegroundColor Yellow
        Set-Location $SCRIPT_DIR
        git pull
        Set-Location server
        npm install
        Set-Location $SCRIPT_DIR
        npm install
        & $MyInvocation.MyCommand.Path restart
        Write-Host "Update complete" -ForegroundColor Green
    }
    default {
        Write-Host "PlumbPro Inventory CLI" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Usage: .\plumbpro.ps1 <command>"
        Write-Host ""
        Write-Host "Commands:" -ForegroundColor Yellow
        Write-Host "  start    - Start the application"
        Write-Host "  stop     - Stop the application"
        Write-Host "  restart  - Restart the application"
        Write-Host "  status   - Check if running"
        Write-Host "  logs     - View server logs"
        Write-Host "  backup   - Create database backup"
        Write-Host "  update   - Update to latest version"
    }
}
'@ | Out-File -Encoding UTF8 "$INSTALL_DIR\plumbpro.ps1"

    Write-Success "CLI tool created"
}

###############################################################################
# Build Frontend
###############################################################################

function Build-Frontend {
    Write-Step "Building production frontend..."

    Set-Location $INSTALL_DIR
    & npm run build 2>&1 | Out-File -Append $LOG_FILE

    Write-Success "Frontend built successfully"
}

###############################################################################
# Main Installation
###############################################################################

function Main {
    Write-Header

    # Create data directory
    New-Item -ItemType Directory -Force -Path $DATA_DIR | Out-Null
    New-Item -ItemType File -Force -Path $LOG_FILE | Out-Null

    Write-Log "Installation started"
    Write-Log "Installation directory: $INSTALL_DIR"

    # Check prerequisites
    if (-not $SkipDependencies) {
        if (-not (Test-Node)) {
            $install = Read-Host "Install Node.js? (Y/n)"
            if ($install -ne "n") {
                Install-Node
            }
            else {
                Write-Error "Node.js is required. Installation cancelled."
                exit 1
            }
        }

        if (-not (Test-PostgreSQL)) {
            $install = Read-Host "Install PostgreSQL? (Y/n)"
            if ($install -ne "n") {
                Install-PostgreSQL
            }
            else {
                Write-Error "PostgreSQL is required. Installation cancelled."
                exit 1
            }
        }
    }

    # Setup
    Setup-Database
    Install-Dependencies
    Create-EnvFile
    Create-AdminUser

    # Build
    Build-Frontend

    # Windows integration
    Create-WindowsService
    Create-CLITool
    Create-DesktopShortcut
    Create-StartMenuShortcut

    # Final steps
    Write-Log "Installation completed successfully"

    Write-Host ""
    Write-Header
    Write-Success "Installation Complete!"
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Next Steps:"
    Write-Host ""
    Write-Host "1. Start the application:" -ForegroundColor Yellow
    Write-Host "   .\plumbpro.ps1 start"
    Write-Host ""
    Write-Host "2. Access the application:" -ForegroundColor Yellow
    Write-Host "   http://localhost:$CLIENT_PORT"
    Write-Host ""
    Write-Host "3. Login with your credentials:" -ForegroundColor Yellow
    Write-Host "   Email: $ADMIN_EMAIL"
    Write-Host ""
    Write-Host "Configuration:" -ForegroundColor Cyan
    Write-Host "  - Database: $DB_NAME"
    Write-Host "  - Server Port: $PORT"
    Write-Host "  - Client Port: $CLIENT_PORT"
    Write-Host "  - Data Directory: $DATA_DIR"
    Write-Host ""
    Write-Host "Management Commands:" -ForegroundColor Cyan
    Write-Host "  .\plumbpro.ps1 start    - Start application"
    Write-Host "  .\plumbpro.ps1 stop     - Stop application"
    Write-Host "  .\plumbpro.ps1 status   - Check status"
    Write-Host "  .\plumbpro.ps1 logs     - View logs"
    Write-Host "  .\plumbpro.ps1 backup   - Backup database"
    Write-Host ""
    Write-Host "Windows Service:" -ForegroundColor Cyan
    Write-Host "  The PlumbPro Server service has been installed and will"
    Write-Host "  start automatically when Windows boots."
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
    Write-Host ""

    # Save credentials
    @"
PlumbPro Inventory - Installation Details
========================================

Installation Date: $(Get-Date)

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
"@ | Out-File -Encoding UTF8 "$DATA_DIR\credentials.txt"

    Write-Warning "Installation details saved to: $DATA_DIR\credentials.txt"
    Write-Warning "Please save your credentials and delete this file!"
    Write-Host ""
}

# Run installation
try {
    Main
}
catch {
    Write-Error "Installation failed: $_"
    Write-Log "ERROR: $_"
    exit 1
}
