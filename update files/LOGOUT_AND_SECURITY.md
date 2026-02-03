# Logout & Security Features

## Overview

PlumbPro Inventory now includes comprehensive security features to protect user accounts:
- **Manual Logout Button** - Logout anytime from the sidebar
- **Auto-Logout on Inactivity** - Automatic logout after 30 minutes of inactivity
- **Activity Detection** - Monitors user activity to reset the timer
- **Warning Notifications** - Warns users 2 minutes before auto-logout

---

## Manual Logout

### Location

The logout button is located in the **left sidebar navigation**, at the bottom above the collapse button.

### Desktop View

**Expanded Sidebar:**
```
┌─────────────────┐
│ Logged in as    │
│ John Smith      │
│ john@email.com  │
│                 │
│ [🚪] Logout     │ ← Click to logout
│ [×]  Collapse   │
└─────────────────┘
```

**Collapsed Sidebar:**
```
┌───┐
│ 🚪│ ← Hover shows "Logout"
│ × │
└───┘
```

### Mobile View

On mobile devices, the logout button appears in the **mobile bottom navigation** when you tap the menu icon.

### How to Logout Manually

1. **Desktop:**
   - Look at the bottom of the left sidebar
   - Click the **"Logout"** button with the door icon
   - Confirm the action if prompted

2. **Mobile:**
   - Tap the menu icon in bottom navigation
   - Find the logout button in the menu
   - Tap to logout

### What Happens on Logout

1. ✅ **Session cleared** - JWT token removed from localStorage
2. ✅ **User data cleared** - User info removed from localStorage
3. ✅ **State reset** - All app state cleared (inventory, jobs, contacts, etc.)
4. ✅ **Redirect to login** - Automatically shows login screen
5. ✅ **Local storage cleared** - All cached data removed

**After logout:**
- Cannot access the app without logging in again
- Must re-enter credentials
- Data will be re-synced from server on next login

---

## Auto-Logout on Inactivity

### How It Works

The app monitors user activity and automatically logs you out after **30 minutes of inactivity** to protect your account.

**Activity Detection:**

The system monitors these user actions:
- 🖱️ **Mouse movements**
- 🖱️ **Mouse clicks**
- ⌨️ **Keyboard presses**
- 📜 **Page scrolling**
- 👆 **Touch interactions** (mobile)

**Any activity resets the 30-minute timer.**

### Timeline

```
User Activity ──────────────────────────────────────────> Time
                    ↓
              28 minutes (warning)
                    ↓
           "2 minutes until logout"
                    ↓
              30 minutes (logout)
                    ↓
           "Logged out due to inactivity"
```

### Warning Notification

**2 minutes before auto-logout:**

A warning toast notification appears:

```
⚠️  You will be logged out in 2 minutes due to inactivity
```

**What to do:**
- Move your mouse
- Click anywhere
- Type something
- Scroll the page
- Any activity will **reset the timer** and clear the warning

### Auto-Logout Notification

**When auto-logout occurs:**

An error toast notification appears:

```
❌ You have been logged out due to inactivity
```

The login screen is then displayed.

---

## Configuration

### Changing the Timeout Duration

The auto-logout timeout is configured in `App.tsx`:

```typescript
useAutoLogout({
  timeout: 30 * 60 * 1000, // 30 minutes in milliseconds
  onLogout: () => {
    logout();
    toast.error('You have been logged out due to inactivity');
  }
});
```

**To change the timeout:**

```typescript
// 15 minutes
timeout: 15 * 60 * 1000

// 60 minutes (1 hour)
timeout: 60 * 60 * 1000

// 5 minutes (for testing)
timeout: 5 * 60 * 1000
```

### Changing Warning Time

The warning appears **2 minutes** before logout by default. This is configured in `hooks/useAutoLogout.ts`:

```typescript
// Show warning 2 minutes before auto-logout
const warningTime = timeout - (2 * 60 * 1000); // 2 minutes before
```

**To change warning time:**

```typescript
// 5 minutes before
const warningTime = timeout - (5 * 60 * 1000);

// 1 minute before
const warningTime = timeout - (1 * 60 * 1000);
```

### Disabling Auto-Logout

To disable auto-logout entirely, comment out the hook in `App.tsx`:

```typescript
// Auto-logout disabled
// useAutoLogout({
//   timeout: 30 * 60 * 1000,
//   onLogout: () => {
//     logout();
//     toast.error('You have been logged out due to inactivity');
//   }
// });
```

⚠️ **Not recommended for production** - Auto-logout is a security best practice.

### Customizing Activity Events

You can customize which events trigger activity detection:

```typescript
useAutoLogout({
  timeout: 30 * 60 * 1000,
  onLogout: logout,
  events: [
    'mousedown',    // Mouse button press
    'mousemove',    // Mouse movement
    'keypress',     // Keyboard press
    'scroll',       // Page scroll
    'touchstart',   // Touch on mobile
    'click'         // Click events
  ]
});
```

**Add more events:**
```typescript
events: [
  ...defaultEvents,
  'wheel',        // Mouse wheel
  'touchmove',    // Touch drag
  'focus'         // Window focus
]
```

---

## Security Best Practices

### Why Auto-Logout?

✅ **Prevents unauthorized access** - If you leave your device unattended
✅ **Protects sensitive data** - Inventory, pricing, customer information
✅ **Meets compliance requirements** - Many industries require auto-logout
✅ **Reduces attack window** - Limits time for potential unauthorized access

### Recommendations

**For Desktop/Laptop Users:**
- 30 minutes is standard for business applications
- Always logout when leaving your desk
- Lock your computer when stepping away (even briefly)

**For Mobile/Tablet Users:**
- Enable device auto-lock (1-2 minutes)
- Use biometric authentication if available
- Keep device updated with security patches

**For Shared Devices:**
- Reduce timeout to 15 minutes
- Always logout manually when finished
- Never save passwords in browser

**For Public Computers:**
- Reduce timeout to 5 minutes
- Use private/incognito browsing mode
- Always logout manually
- Clear browser data after use

---

## User Information Display

### Sidebar User Section

When logged in, the sidebar shows:

```
┌─────────────────────┐
│ LOGGED IN AS       │
│ John Smith         │ ← Full name
│ john@example.com   │ ← Email address
└─────────────────────┘
```

**Information shown:**
- Full name from user profile
- Email address used to login
- Truncated if text is too long

**When sidebar is collapsed:**
- User info is hidden
- Only logout icon is visible

---

## Technical Implementation

### Components

**1. Manual Logout Button**
- Location: `App.tsx` sidebar section
- Uses: `useStore` logout function
- Icon: `LogOut` from lucide-react

**2. Auto-Logout Hook**
- File: `hooks/useAutoLogout.ts`
- Type: Custom React hook
- Features:
  - Configurable timeout
  - Activity detection
  - Warning system
  - Event cleanup

**3. Logout Function**
- File: `store/useStore.ts`
- Actions:
  - Removes auth token
  - Clears user data
  - Resets app state
  - Clears storage

### Data Flow

```
User Activity
    ↓
Activity Events (mouse, keyboard, etc.)
    ↓
useAutoLogout Hook
    ↓
Reset Timer
    ↓
28 min → Warning Event
    ↓
Toast Notification
    ↓
30 min → Logout Event
    ↓
useStore.logout()
    ↓
Clear localStorage
    ↓
Reset State
    ↓
Show LoginView
```

### Storage Management

**On Logout:**
```javascript
// Clear authentication
localStorage.removeItem('authToken');
localStorage.removeItem('user');

// Clear all cached data
storage.clearAll();

// Reset state
set({
  user: null,
  authToken: null,
  isAuthenticated: false,
  inventory: [],
  contacts: [],
  jobs: [],
  templates: [],
  movements: [],
  smartSuggestions: []
});
```

---

## Testing

### Manual Logout Test

**Desktop:**
1. Login to the app
2. Look at bottom of left sidebar
3. Click **"Logout"** button
4. **Expected:** Redirected to login screen

**Mobile:**
1. Login to the app
2. Tap menu icon in bottom nav
3. Find and tap logout button
4. **Expected:** Redirected to login screen

**Verify:**
- ✅ Shows login screen
- ✅ Cannot access app without login
- ✅ localStorage cleared (check DevTools)

### Auto-Logout Test

**Quick Test (5 minutes):**
1. Change timeout to 5 minutes in `App.tsx`:
   ```typescript
   timeout: 5 * 60 * 1000  // 5 minutes
   ```
2. Login to the app
3. Wait 3 minutes without any activity
4. **Expected:** Warning appears at 3 minutes
5. Continue waiting 2 more minutes
6. **Expected:** Auto-logout at 5 minutes

**Activity Detection Test:**
1. Login to the app
2. Wait 3 minutes
3. See warning notification
4. Move mouse or click
5. **Expected:** Warning disappears, timer resets
6. Wait another 3 minutes
7. **Expected:** Warning appears again

**Production Test (30 minutes):**
1. Login to the app
2. Leave it idle for 28 minutes
3. **Expected:** Warning at 28 minutes
4. Wait 2 more minutes
5. **Expected:** Auto-logout at 30 minutes

---

## Troubleshooting

### Issue: Logout button not visible

**Causes:**
- Sidebar is collapsed
- Not logged in
- Component not rendered

**Solutions:**
1. Expand the sidebar (click expand button)
2. Check you're logged in (should see user info)
3. Refresh the page

### Issue: Auto-logout not working

**Causes:**
- Hook not properly initialized
- Timer not starting
- Activity detection failing

**Solutions:**
1. Check console for errors
2. Verify `useAutoLogout` is called in `AppContent`
3. Check timeout value is correct
4. Test with shorter timeout (5 minutes)

### Issue: Warning not appearing

**Causes:**
- Toast system not working
- Event listener not attached
- Warning time misconfigured

**Solutions:**
1. Check toast notifications work elsewhere
2. Verify warning time calculation
3. Check browser console for errors
4. Test with shorter warning time

### Issue: Logged out too quickly

**Cause:** Timeout set too short

**Solution:**
1. Check timeout value in `App.tsx`
2. Ensure it's in milliseconds (30 * 60 * 1000 = 30 minutes)
3. Don't confuse with seconds (30 * 60 = 1800 seconds)

### Issue: Activity not resetting timer

**Causes:**
- Event listeners not attached
- Events not bubbling
- Browser preventing events

**Solutions:**
1. Check events array in hook config
2. Test different activity types
3. Check browser console for errors
4. Try adding more event types

---

## API Integration

### Logout Endpoint

While logout is handled client-side, you can add a server-side logout endpoint for:
- Blacklisting tokens
- Logging logout events
- Clearing server-side sessions

**Example endpoint:**

```javascript
// server/src/routes/auth.js
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Optional: Add token to blacklist
    // await blacklistToken(req.user.token);

    // Optional: Log logout event
    // await logUserActivity(req.user.userId, 'logout');

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});
```

**Frontend call:**

```typescript
logout: () => {
  // Optional: Call server logout endpoint
  api.post('/auth/logout').catch(() => {
    // Ignore errors, logout anyway
  });

  // Clear client-side data
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  storage.clearAll();

  set({ /* reset state */ });
}
```

---

## Compliance & Regulations

### Industry Standards

**PCI-DSS (Payment Card Industry):**
- Requires auto-logout after 15 minutes
- Applies if you handle payment information

**HIPAA (Healthcare):**
- Requires auto-logout
- No specific time, but 15-30 minutes is standard

**SOX (Financial):**
- Requires session timeout
- 15-30 minutes recommended

**GDPR (Privacy):**
- Requires appropriate security measures
- Auto-logout helps protect personal data

### Recommendations by Industry

| Industry | Timeout | Notes |
|----------|---------|-------|
| Healthcare | 15 min | Protects patient data |
| Finance | 15-30 min | Protects financial data |
| Retail | 30 min | Standard for POS systems |
| Education | 30-60 min | Longer sessions acceptable |
| Government | 15 min | Strict security requirements |

---

## Future Enhancements

### Potential Features

**1. Remember Me Option**
```typescript
// Extend session for trusted devices
useAutoLogout({
  timeout: rememberMe ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000
});
```

**2. Customizable Timeout per User**
```typescript
// User preference in settings
const userTimeout = user.preferences.sessionTimeout || 30 * 60 * 1000;
```

**3. Activity Log**
```typescript
// Track user sessions
await api.post('/activity/session-end', {
  reason: 'auto-logout',
  duration: sessionDuration
});
```

**4. Multi-Tab Sync**
```typescript
// Logout all tabs when one logs out
window.addEventListener('storage', (e) => {
  if (e.key === 'authToken' && !e.newValue) {
    logout();
  }
});
```

**5. Grace Period**
```typescript
// Allow user to extend session
const extendSession = () => {
  resetTimer();
  toast.success('Session extended');
};
```

---

## Summary

✅ **Manual logout button** - Click anytime to logout
✅ **Auto-logout** - 30 minutes of inactivity
✅ **Activity detection** - Mouse, keyboard, touch, scroll
✅ **Warning notification** - 2 minutes before logout
✅ **User info display** - Shows logged-in user
✅ **Security best practices** - Protects accounts
✅ **Configurable** - Easy to adjust timeouts
✅ **Mobile support** - Works on all devices

**Your account is now protected with industry-standard security features!** 🔒
