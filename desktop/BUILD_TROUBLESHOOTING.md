# Build Troubleshooting Guide

## Error: `ERR_ELECTRON_BUILDER_CANNOT_EXECUTE` on macOS

This error occurs when electron-builder's native tools fail to execute. Here are the solutions:

### Solution 1: Use the Fixed Build Script (Recommended)

```bash
cd desktop
npm run package:mac:fix
```

This script:
- Fixes app-builder permissions
- Clears electron-builder cache
- Sets correct environment variables
- Builds only for your architecture (ARM64)

### Solution 2: Manual Fix

1. **Fix permissions:**
```bash
cd desktop
chmod +x node_modules/app-builder-bin/mac/app-builder_arm64
chmod +x node_modules/app-builder-bin/mac/app-builder_amd64
```

2. **Clear cache:**
```bash
rm -rf ~/Library/Caches/electron-builder
rm -rf desktop/dist
rm -rf desktop/release
```

3. **Rebuild native modules:**
```bash
cd desktop
npm run postinstall
```

4. **Try building again:**
```bash
npm run package:mac
```

### Solution 3: Full Clean Rebuild

```bash
# From project root
rm -rf node_modules
rm -rf server/node_modules
rm -rf desktop/node_modules
rm -rf ~/Library/Caches/electron-builder

npm install
cd server && npm install && cd ..
cd desktop && npm install && cd ..

npm run build
cd desktop && npm run package:mac
```

### Solution 4: Build for Current Architecture Only

The error often happens when building universal binaries. Edit `electron-builder.yml`:

```yaml
mac:
  target:
    - target: dmg
      arch: [arm64]  # Change from [x64, arm64] to just [arm64]
```

### Solution 5: Use Rosetta (Intel Compatibility)

If you're on Apple Silicon but need x64 builds:

```bash
arch -x86_64 npm run package:mac
```

### Common Causes

1. **Missing Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

2. **Node version incompatibility**
   - Recommended: Node.js 18.x or 20.x
   - Check: `node -v`

3. **Corrupted node_modules**
   - Delete and reinstall (see Solution 3)

4. **Insufficient memory**
   - Electron builds require ~4GB RAM
   - Close other applications

### Verify the Fix

After applying fixes, verify:

```bash
cd desktop

# Check app-builder exists
ls -la node_modules/app-builder-bin/mac/

# Should show executable permissions (-rwxr-xr-x)

# Try building
npm run package:mac
```

### Still Not Working?

1. **Check macOS version** (needs 10.15+)
   ```bash
   sw_vers -productVersion
   ```

2. **Check architecture**
   ```bash
   uname -m  # Should be arm64 for Apple Silicon
   ```

3. **Try verbose logging**
   ```bash
   DEBUG=electron-builder npm run package:mac
   ```

4. **Check for antivirus interference**
   - Some antivirus software blocks app-builder
   - Temporarily disable or whitelist the project directory

### Alternative: Build in CI/CD

If local builds keep failing, use GitHub Actions:

```bash
# Push a tag
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will build automatically
# Download the DMG from the release page
```

## Other Common Errors

### "Cannot find module 'electron'"

```bash
cd desktop
npm install
```

### "Application entry file 'dist/main/index.js' does not exist"

```bash
cd desktop
npm run build
```

### "ENOENT: no such file or directory" for frontend assets

Make sure to build the frontend first:
```bash
# From project root
npm run build  # Builds frontend to dist/
cd desktop
npm run package:mac
```

## Getting Help

If none of these solutions work:

1. Check full logs: `DEBUG=electron-builder npm run package:mac 2>&1 | tee build.log`
2. Create a GitHub issue with the build.log attached
3. Include your system info: `node -v`, `npm -v`, `uname -a`
