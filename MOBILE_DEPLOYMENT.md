# Mobile Deployment Guide - PlumbPro Inventory

## Overview
PlumbPro Inventory is now a fully functional Progressive Web App (PWA) that can be installed on mobile devices and used offline in the warehouse.

## Features Implemented

### ✅ Progressive Web App (PWA)
- **Installable**: Can be installed on iOS and Android home screens
- **Offline-First**: Works without internet connection
- **Native Feel**: Full-screen app experience with no browser chrome
- **Fast**: Service worker caches assets for instant loading

### ✅ Mobile-Optimized UI
- **Responsive Design**: Adapts to any screen size
- **Bottom Navigation**: Easy thumb-friendly navigation
- **Touch Gestures**: Optimized tap targets and swipe interactions
- **Safe Area Support**: Works perfectly on notched devices (iPhone X+)

### ✅ Mobile Stock Counting
- **Quick Adjust**: Fast +/- buttons for small adjustments
- **Bulk Count**: Set exact counts with numeric keypad
- **Search**: Quickly find items by name, category, or code
- **Real-time Updates**: Changes sync immediately
- **Offline Capable**: Count stock without internet

### ✅ Barcode Scanner (Placeholder)
- Infrastructure ready for barcode scanning
- Camera access prepared
- Can be integrated with libraries like `@zxing/browser`

## Installation Instructions

### For iOS (iPhone/iPad)

1. **Open in Safari** (must use Safari, not Chrome)
   - Navigate to: `http://your-server:3000`

2. **Add to Home Screen**
   - Tap the Share button (square with arrow pointing up)
   - Scroll down and tap "Add to Home Screen"
   - Name it "PlumbPro" and tap "Add"

3. **Launch the App**
   - Find the PlumbPro icon on your home screen
   - Tap to launch in full-screen mode

### For Android

1. **Open in Chrome**
   - Navigate to: `http://your-server:3000`

2. **Install the App**
   - Tap the menu (three dots)
   - Select "Add to Home screen" or "Install app"
   - Tap "Install" in the prompt

3. **Launch the App**
   - Find PlumbPro in your app drawer
   - Tap to launch

## Using the Mobile Stock Counter

### Quick Access
When viewing the Inventory page on mobile, tap the **floating blue button** (bottom right) to open the Stock Counter.

### Quick Adjustments
- Use **+** and **-** buttons for fast adjustments (±1)
- Changes save immediately
- No confirmation needed for speed

### Setting Exact Counts
1. Tap **"Set Count"** on any item
2. Enter the exact quantity with the number pad
3. Use quick adjustment buttons (±1, ±5, ±10)
4. Tap **"Update Count"** to save

### Search & Filter
- Tap the search bar at top
- Type item name, category, or supplier code
- Results filter instantly

### Offline Mode
- Continue counting even without internet
- All changes queue locally
- Auto-sync when connection returns

## Deployment Options

### Option 1: Local Network (Easiest for Warehouse)

**Setup:**
```bash
# Find your computer's local IP
ipconfig getifaddr en0  # macOS/Linux
ipconfig  # Windows - look for IPv4 Address

# Your IP might be something like: 192.168.1.100
```

**Access from phone:**
- Connect phone to same WiFi network
- Open browser to: `http://192.168.1.100:3000`
- Follow installation instructions above

**Pros:**
- No internet required
- Fast and secure
- Free

**Cons:**
- Only works on same network
- Computer must be running

### Option 2: Cloud Deployment (Best for Remote Access)

**Recommended Services:**

1. **Vercel** (Free tier available)
   ```bash
   npm install -g vercel
   vercel deploy
   ```

2. **Netlify** (Free tier available)
   ```bash
   npm install -g netlify-cli
   netlify deploy
   ```

3. **Railway** (Free tier available)
   ```bash
   # Push to GitHub, connect to Railway
   ```

**Pros:**
- Access from anywhere
- HTTPS by default (required for some PWA features)
- Professional URL

**Cons:**
- Requires internet
- Some services have usage limits

### Option 3: VPS/Self-Hosted

Deploy to your own server:
```bash
# Build the app
npm run build

# Serve with nginx, Apache, or node server
```

## Testing Checklist

### Before Going Live
- [ ] Test on actual warehouse WiFi
- [ ] Verify offline mode works
- [ ] Test on both iOS and Android
- [ ] Check all counting functions
- [ ] Test with actual inventory items
- [ ] Train team on mobile interface

### Mobile Responsiveness
- [ ] Bottom navigation visible
- [ ] All buttons easily tappable
- [ ] Text readable without zooming
- [ ] No horizontal scrolling
- [ ] Safe areas respected on notched phones

### Offline Functionality
- [ ] App loads when offline
- [ ] Can view inventory offline
- [ ] Stock counting works offline
- [ ] Changes sync when back online

## Future Enhancements

### Barcode Scanning
To add real barcode scanning:

1. **Install scanner library:**
   ```bash
   npm install @zxing/browser
   ```

2. **Update MobileStockCountView.tsx:**
   - Replace scanner placeholder with actual camera
   - Implement barcode detection
   - Match barcodes to inventory items

3. **Test thoroughly:**
   - Different barcode formats
   - Various lighting conditions
   - Camera permissions

### Additional Mobile Features
- **Voice input** for hands-free counting
- **Photo upload** for damage documentation
- **GPS tagging** for location tracking
- **Push notifications** for low stock alerts
- **Batch operations** for bulk updates

## Troubleshooting

### App Won't Install
- **iOS**: Must use Safari browser
- **Android**: Enable "Unknown Sources" if needed
- **Both**: Clear browser cache and try again

### Offline Mode Not Working
- Check service worker registration in DevTools
- Verify manifest.json is accessible
- Ensure HTTPS (or localhost) for service workers

### Slow Performance
- Clear app cache and reinstall
- Check network speed
- Reduce number of inventory items loaded

### Touch Targets Too Small
- UI is optimized for 44×44pt minimum
- Report specific buttons that are too small
- May need adjustment for accessibility

## Security Considerations

### For Local Network Use
- Network is private, no extra security needed
- Consider adding PIN protection in Settings

### For Internet Deployment
- **Always use HTTPS** in production
- Implement proper authentication
- Add rate limiting
- Regular security updates
- Backup data regularly

## Support & Feedback

For issues or feature requests:
1. Check this guide first
2. Test on latest browser version
3. Document steps to reproduce
4. Include device and OS version

## Performance Tips

### For Best Mobile Experience
- Keep inventory under 10,000 items
- Use search instead of scrolling
- Close unused browser tabs
- Restart app weekly
- Clear cache if slow

### Battery Optimization
- Screen brightness at 50-70%
- Close app when done
- Disable unnecessary notifications
- Use airplane mode if offline testing

---

**Version**: 6.1.0.4
**Last Updated**: January 2026
**Mobile Support**: iOS 13+, Android 8+
