# PlumbPro Inventory - Deployment Guide

## Overview

This guide covers deploying PlumbPro Inventory as a desktop application for Windows, macOS, and Linux.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Desktop Application                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Electron   │  │   Frontend   │  │   Auto-      │       │
│  │    Shell     │──│   (React)    │  │   Updater    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                                                   │
│         │ IPC                                               │
│         ▼                                                   │
│  ┌──────────────────────────────────┐                      │
│  │     Embedded Node.js Server      │                      │
│  │  ┌──────────┐    ┌──────────┐   │                      │
│  │  │ Express  │────│ PostgreSQL│   │                      │
│  │  │   API    │    │  (Local) │   │                      │
│  │  └──────────┘    └──────────┘   │                      │
│  └──────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### For Building

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **Git**: For version control

### For Code Signing (Required for distribution)

#### Windows
- **EV Code Signing Certificate** (Recommended) or OV Certificate
- From: DigiCert, Sectigo, or similar

#### macOS
- **Apple Developer Account** ($99/year)
- **Developer ID Application Certificate**
- **Notarization** configured

## Project Structure

```
PlumbPro-Inventory/
├── desktop/                    # Electron application
│   ├── main/                   # Main process
│   ├── server/                 # Embedded server
│   ├── resources/              # Icons, assets
│   ├── dist/                   # Build output
│   └── release/                # Packaged apps
├── server/                     # Backend API
│   ├── src/
│   └── migrations/
├── dist/                       # Frontend build
├── package.json
└── electron-builder.yml
```

## Quick Start - Development

### 1. Install Dependencies

```bash
# Root dependencies (frontend)
npm install

# Server dependencies
cd server && npm install && cd ..

# Desktop dependencies
cd desktop && npm install && cd ..
```

### 2. Build Frontend

```bash
npm run build
```

### 3. Run Desktop App (Development)

```bash
cd desktop
npm run dev
```

## Building for Production

### All Platforms

```bash
cd desktop
npm run package:all
```

### Windows Only

```bash
cd desktop
npm run package:win
```

Output: `desktop/release/{version}/PlumbPro-Inventory-Setup-{version}.exe`

### macOS Only

```bash
cd desktop
npm run package:mac
```

Output: `desktop/release/{version}/PlumbPro-Inventory-{version}.dmg`

### Linux Only

```bash
cd desktop
npm run package:linux
```

Output: `desktop/release/{version}/PlumbPro-Inventory-{version}.AppImage`

## Code Signing Setup

### Windows Code Signing

1. **Purchase Certificate**: Get an EV or OV code signing certificate
2. **Install Certificate**: Import to Windows Certificate Store
3. **Configure Environment Variables**:

```bash
export WIN_CSC_LINK=/path/to/certificate.p12
export WIN_CSC_KEY_PASSWORD=your_password
```

4. **Update electron-builder.yml**:

```yaml
win:
  certificateFile: ${env.WIN_CSC_LINK}
  certificatePassword: ${env.WIN_CSC_KEY_PASSWORD}
```

### macOS Code Signing

1. **Join Apple Developer Program**: https://developer.apple.com/programs/
2. **Create Certificates**:
   - Developer ID Application
   - Developer ID Installer

3. **Configure Notarization**:

```bash
export APPLE_ID=your@email.com
export APPLE_APP_SPECIFIC_PASSWORD=your-app-password
export APPLE_TEAM_ID=YOUR_TEAM_ID
```

4. **Update electron-builder.yml**:

```yaml
mac:
  identity: "Developer ID Application: Your Name (TEAM_ID)"
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist

afterSign: "scripts/notarize.js"
```

## Database Setup for First Install

### Automatic (Default)

The embedded server automatically:
1. Creates local PostgreSQL database on first run
2. Runs all migrations
3. Seeds default data

### Manual Database Setup

If using external PostgreSQL:

```bash
# Create database
createdb plumbpro_inventory

# Run migrations
cd server
npm run migrate

# Seed data (optional)
npm run seed
```

## Auto-Updater Configuration

### GitHub Releases (Default)

1. **Create GitHub Repository**
2. **Set Environment Variables**:

```bash
export GH_TOKEN=your_github_personal_access_token
```

3. **Publish Release**:

```bash
cd desktop
npm run release
```

### Custom Update Server

Update `electron-builder.yml`:

```yaml
publish:
  provider: generic
  url: https://your-update-server.com/updates
  channel: latest
```

## CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/build.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          npm install
          cd server && npm install && cd ..
          cd desktop && npm install && cd ..
      
      - name: Build frontend
        run: npm run build
      
      - name: Build and Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: |
          cd desktop
          npm run release
```

## Distribution Channels

### Direct Download

Host installers on your website:

```html
<a href="/download/windows">Download for Windows</a>
<a href="/download/mac">Download for Mac</a>
<a href="/download/linux">Download for Linux</a>
```

### App Stores

#### Windows Store (MSIX)

```bash
cd desktop
electron-builder --windows msix
```

#### Mac App Store

Requires additional entitlements and sandboxing. See `docs/mac-app-store.md`.

## Installer Customization

### Windows Installer (NSIS)

Edit `desktop/build/installer.nsh`:

```nsis
!macro customWelcomePage
  !insertMacro MUI_PAGE_WELCOME
!macroend

!macro customInstall
  ; Custom installation steps
  DetailPrint "Setting up PlumbPro Inventory..."
!macroend
```

### macOS DMG

Customize appearance in `electron-builder.yml`:

```yaml
dmg:
  iconSize: 100
  window:
    width: 600
    height: 400
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications
```

## Branding

### Icons

Replace icons in `desktop/resources/icons/`:

- **Windows**: `icon.ico` (256x256, multi-size)
- **macOS**: `icon.icns` (1024x1024)
- **Linux**: `icon.png` (512x512)

### Loading Screen

Create `desktop/resources/loading.html` for startup splash.

## Testing Installers

### Windows

```powershell
# Test silent install
.\PlumbPro-Inventory-Setup-1.0.0.exe /S

# Test uninstall
%LocalAppData%\Programs\PlumbPro-Inventory\Uninstall.exe /S
```

### macOS

```bash
# Mount DMG
hdiutil attach PlumbPro-Inventory-1.0.0.dmg

# Check signature
codesign -dv --verbose=4 /Volumes/PlumbPro\ Inventory/PlumbPro\ Inventory.app

# Check notarization
spctl -a -t exec -vv /Volumes/PlumbPro\ Inventory/PlumbPro\ Inventory.app
```

## Troubleshooting

### Build Issues

**Error: "Cannot find module 'electron'"**
```bash
cd desktop && npm install
```

**Error: "Electron failed to install"**
```bash
npm config set electron_mirror https://cdn.npm.taobao.org/dist/electron/
```

### Code Signing Issues

**Windows: "Certificate not found"**
- Ensure certificate is installed in Current User > Personal
- Check certificate hasn't expired
- Verify private key is exportable

**macOS: "Notarization failed"**
```bash
# Check notarization status
xcrun notarytool history --apple-id your@email.com

# View detailed log
xcrun notarytool log <submission-id> --apple-id your@email.com
```

### Runtime Issues

**Server won't start**
- Check port 5001 is available
- Review logs: `%APPDATA%/PlumbPro Inventory/logs/` (Windows)
- Review logs: `~/Library/Logs/PlumbPro Inventory/` (macOS)

**Database connection failed**
- Ensure PostgreSQL is installed (bundled with installer)
- Check database files exist in user data directory

## Security Considerations

1. **Code Signing**: Always sign your releases
2. **Auto-Updates**: Verify update signatures
3. **Database**: Use strong passwords in production
4. **API Keys**: Never hardcode API keys; use environment variables
5. **Logging**: Don't log sensitive information

## Versioning Strategy

Use Semantic Versioning (SemVer):

- **MAJOR**: Breaking changes (database migrations)
- **MINOR**: New features
- **PATCH**: Bug fixes

Format: `v1.2.3`

## Release Checklist

- [ ] Update version in `desktop/package.json`
- [ ] Update `CHANGELOG.md`
- [ ] Run full test suite
- [ ] Build for all platforms
- [ ] Test installers on clean VMs
- [ ] Sign all binaries
- [ ] Create GitHub release
- [ ] Upload to distribution servers
- [ ] Update website download links
- [ ] Send release notifications

## Support

For deployment issues:
- Review logs in user data directory
- Check [Troubleshooting](#troubleshooting) section
- Create GitHub issue with build logs

## License

MIT License - See LICENSE file
