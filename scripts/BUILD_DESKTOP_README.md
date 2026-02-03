# Building PlumbPro Desktop Apps

This folder contains scripts to build the desktop applications for Windows and macOS.

## Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **For macOS builds**: macOS machine with Xcode Command Line Tools
- **For Windows builds**: Windows machine

> **Note:** You cannot build Windows installers on macOS or vice versa without complex cross-compilation tools. Use the GitHub Actions workflow to build both automatically.

## Quick Build (Auto-Detect Platform)

### macOS / Linux
```bash
./scripts/build-desktop.sh
```

### Windows (Command Prompt or PowerShell)
```batch
scripts\build-desktop-win.bat
```

## Platform-Specific Build Scripts

### Windows (.exe installer)

Double-click or run in Command Prompt:
```batch
scripts\build-desktop-win.bat
```

Output location: `desktop/release/[version]/PlumbPro-Inventory-Setup-[version].exe`

### macOS (.dmg installer)

Run in Terminal:
```bash
./scripts/build-desktop-mac.sh
```

Output location: `desktop/release/[version]/PlumbPro-Inventory-[version]-[arch].dmg`

## Automated Build with GitHub Actions

The easiest way to build for both platforms is to use GitHub Actions:

### Option 1: Trigger Manually
1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **"Build Desktop Apps"** workflow
4. Click **"Run workflow"**
5. Enter a version number (e.g., `1.0.0`)
6. Click **Run**

### Option 2: Push a Tag
```bash
# Create and push a version tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

This will automatically:
- Build Windows installer on Windows runner
- Build macOS installer on macOS runner
- Create a draft GitHub Release with both installers attached

## What the Scripts Do

1. **Install frontend dependencies** (`npm install --legacy-peer-deps`)
2. **Build the React frontend** (`npm run build`)
3. **Install desktop dependencies** (`cd desktop && npm install`)
4. **Build the desktop app** using electron-builder

## Troubleshooting

### Build fails with "Cannot find module"
- Make sure you're running the script from the project root
- Try deleting `node_modules` and running again

### Windows: "npm is not recognized"
- Make sure Node.js is installed and added to your PATH
- Restart your terminal/Command Prompt after installing Node.js

### macOS: "Permission denied"
- Make the script executable: `chmod +x scripts/build-desktop-mac.sh`

### macOS: Notarization fails
- The default build doesn't sign/notarize. For distribution, you need:
  - Apple Developer ID
  - Signing certificates
  - Notarization credentials
  
  See [electron-builder docs](https://www.electron.build/code-signing) for details.

## File Structure

```
scripts/
├── build-desktop.sh          # Auto-detect platform and build
├── build-desktop-win.bat     # Windows build script
├── build-desktop-mac.sh      # macOS build script
└── BUILD_DESKTOP_README.md   # This file
```

## Release Checklist

Before releasing:
- [ ] Test the installer on a clean machine
- [ ] Verify auto-updater works (if configured)
- [ ] Check file size is reasonable (< 200MB)
- [ ] Update version number in `desktop/package.json`
- [ ] Create GitHub Release with release notes
