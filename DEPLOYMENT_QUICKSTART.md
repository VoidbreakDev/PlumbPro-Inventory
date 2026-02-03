# PlumbPro Inventory - Deployment Quick Start

## 🚀 Ready to Deploy?

Your application is now ready for desktop deployment! Here's what you have:

## ✅ What's Already Configured

### 1. **Electron Desktop App** (`desktop/`)
- ✅ Auto-updater (electron-updater)
- ✅ Embedded Node.js server
- ✅ Cross-platform builds (Windows, macOS, Linux)
- ✅ Code signing support
- ✅ macOS notarization

### 2. **CI/CD Pipeline** (`.github/workflows/`)
- ✅ Automated builds on GitHub Actions
- ✅ Multi-platform builds
- ✅ Automatic GitHub Releases

### 3. **Build Configuration**
- ✅ Windows Installer (NSIS)
- ✅ macOS DMG
- ✅ Linux AppImage
- ✅ Auto-update publishing

## 📦 Building Your First Release

### Step 1: Prepare Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your production values
nano .env
```

### Step 2: Run Preparation Script

```bash
# Make script executable
chmod +x scripts/prepare-deployment.sh

# Run preparation (replace with your version)
./scripts/prepare-deployment.sh v1.0.0
```

### Step 3: Build Locally (Test)

```bash
cd desktop

# Test the app
npm run dev

# Build for your current platform
npm run package
```

### Step 4: Create Release

#### Option A: Manual Build

```bash
cd desktop

# Build for specific platform
npm run package:win    # Windows
npm run package:mac    # macOS  
npm run package:linux  # Linux
npm run package:all    # All platforms
```

Find installers in: `desktop/release/{version}/`

#### Option B: GitHub Actions (Recommended)

1. **Push a tag**:
```bash
git tag v1.0.0
git push origin v1.0.0
```

2. **GitHub Actions automatically**:
   - Builds for all platforms
   - Creates a draft release
   - Uploads installers

3. **Publish the release** on GitHub

## 🔐 Code Signing (Required for Distribution)

### Windows

1. Purchase certificate from:
   - DigiCert
   - Sectigo
   - SSL.com

2. Set environment variables:
```bash
export WIN_CSC_LINK=/path/to/certificate.p12
export WIN_CSC_KEY_PASSWORD=your_password
```

### macOS

1. Join Apple Developer Program ($99/year)
2. Create certificates in Xcode
3. Set environment variables:
```bash
export APPLE_ID=your@email.com
export APPLE_APP_SPECIFIC_PASSWORD=your-app-password
export APPLE_TEAM_ID=YOUR_TEAM_ID
```

## 📋 Pre-Release Checklist

- [ ] Version updated in `desktop/package.json`
- [ ] `.env` configured for production
- [ ] All tests passing
- [ ] Frontend builds successfully
- [ ] Desktop app runs in dev mode
- [ ] Code signing certificates ready
- [ ] GitHub repository has `GH_TOKEN` secret
- [ ] README updated with latest features
- [ ] Changelog updated

## 🌐 Distribution Options

### 1. **GitHub Releases** (Easiest)
- Free
- Auto-updater works out of the box
- Version history

### 2. **Your Website**
- Host installers on your server
- Custom branding
- Full control

### 3. **App Stores**
- **Windows Store**: MSIX format
- **Mac App Store**: Additional sandboxing required
- **Snap Store**: For Linux

## 🔄 Auto-Updates

The app automatically:
1. Checks for updates on startup
2. Downloads updates in background
3. Prompts user to install
4. Installs on next restart

Configure in `desktop/electron-builder.yml`:
```yaml
publish:
  provider: github
  owner: your-github-username
  repo: your-repo-name
```

## 🐛 Troubleshooting

### Build Fails

```bash
# Clean everything
rm -rf node_modules dist desktop/dist desktop/release
rm -rf server/node_modules desktop/node_modules

# Reinstall
npm install
cd server && npm install && cd ..
cd desktop && npm install && cd ..

# Retry
npm run build
cd desktop && npm run package
```

### Code Signing Issues

**Windows**: Certificate must be in Current User > Personal store
**macOS**: Run `xcrun notarytool history` to check notarization status

### Server Won't Start

Check logs:
- Windows: `%APPDATA%/PlumbPro Inventory/logs/`
- macOS: `~/Library/Logs/PlumbPro Inventory/`
- Linux: `~/.config/PlumbPro Inventory/logs/`

## 📚 Next Steps

1. **Test the installer** on a clean machine
2. **Set up analytics** (optional)
3. **Configure error reporting** (Sentry, etc.)
4. **Create user documentation**
5. **Plan your release strategy**

## 🆘 Need Help?

- **Build Issues**: Check `DEPLOYMENT_GUIDE.md`
- **Electron Docs**: https://www.electronjs.org/docs
- **electron-builder**: https://www.electron.build

## 📁 Key Files

| File | Purpose |
|------|---------|
| `DEPLOYMENT_GUIDE.md` | Comprehensive deployment guide |
| `desktop/electron-builder.yml` | Build configuration |
| `.github/workflows/build-and-release.yml` | CI/CD pipeline |
| `scripts/prepare-deployment.sh` | Pre-build preparation |
| `.env.example` | Environment configuration template |

---

**You're ready to ship!** 🚢

Run `./scripts/prepare-deployment.sh` and follow the prompts to build your first release.
