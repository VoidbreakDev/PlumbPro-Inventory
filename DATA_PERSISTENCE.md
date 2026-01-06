# Data Persistence in PlumbPro Inventory

## Overview

All application data is now automatically saved to browser localStorage and persists across:
- Page refreshes
- Browser restarts
- Tab closures
- Navigation between pages

## What Gets Saved

### 1. Contacts
- **Key**: `plumbpro-contacts`
- **Data**: All suppliers and customers (name, company, email, phone, type)
- **Updates**: Automatically saved when you add, edit, or delete contacts

### 2. Inventory
- **Key**: `plumbpro-inventory`
- **Data**: All inventory items (name, category, quantity, price, supplier, etc.)
- **Updates**: Automatically saved when you add, edit, or adjust stock

### 3. Jobs
- **Key**: `plumbpro-jobs`
- **Data**: All jobs and their details (title, date, status, allocated items, etc.)
- **Updates**: Automatically saved when you create, edit, or update jobs

### 4. Stock Movements
- **Key**: `plumbpro-movements`
- **Data**: All stock in/out movements (type, quantity, date, reason)
- **Updates**: Automatically saved when stock adjustments are made

### 5. Job Templates
- **Key**: `plumbpro-templates`
- **Data**: Reusable job templates with pre-allocated items
- **Updates**: Automatically saved when you create, edit, or delete templates

### 6. Settings
- **Key**: `plumbpro-settings`
- **Data**: User preferences, theme, AI API keys, company info
- **Updates**: Saved when you click "Save Changes" in Settings

## How It Works

The app uses React's `useEffect` hooks to:
1. **Load data on startup**: Reads from localStorage when the app loads
2. **Auto-save changes**: Automatically saves to localStorage whenever data changes
3. **Fallback to defaults**: Uses initial sample data if localStorage is empty (first time use)

## Browser localStorage Limits

- **Storage Size**: ~5-10MB per domain (varies by browser)
- **Current Usage**: With typical data, you'll use ~1-2MB
- **Monitoring**: Check localStorage usage in Browser DevTools → Application/Storage tab

## Clearing Data

### Clear All Data
To reset the app to factory defaults, run this in browser console:
```javascript
localStorage.clear();
location.reload();
```

### Clear Specific Data
```javascript
// Clear only contacts
localStorage.removeItem('plumbpro-contacts');

// Clear only inventory
localStorage.removeItem('plumbpro-inventory');

// Clear only jobs
localStorage.removeItem('plumbpro-jobs');

// Clear only movements
localStorage.removeItem('plumbpro-movements');

// Clear only templates
localStorage.removeItem('plumbpro-templates');

// Clear only settings
localStorage.removeItem('plumbpro-settings');
```

## Exporting/Backing Up Data

### Export All Data
Run this in browser console to get all your data as JSON:
```javascript
const backup = {
  contacts: JSON.parse(localStorage.getItem('plumbpro-contacts')),
  inventory: JSON.parse(localStorage.getItem('plumbpro-inventory')),
  jobs: JSON.parse(localStorage.getItem('plumbpro-jobs')),
  movements: JSON.parse(localStorage.getItem('plumbpro-movements')),
  templates: JSON.parse(localStorage.getItem('plumbpro-templates')),
  settings: JSON.parse(localStorage.getItem('plumbpro-settings'))
};
console.log(JSON.stringify(backup, null, 2));
```

Copy the output and save to a file for backup.

### Import/Restore Data
```javascript
// Paste your backup JSON here
const backup = {
  contacts: [...],
  inventory: [...],
  // ... rest of your data
};

// Restore all data
Object.keys(backup).forEach(key => {
  localStorage.setItem(`plumbpro-${key}`, JSON.stringify(backup[key]));
});

// Reload the page
location.reload();
```

## Important Notes

### Privacy & Security
- All data is stored **locally** in your browser
- **No data is sent to any server** (except API calls for Smart Ordering)
- Data is **not synchronized** between devices or browsers
- If you clear browser data, your PlumbPro data will be deleted

### Moving to Another Device
To transfer your data to another device:
1. Export your data using the console commands above
2. Save the JSON to a file
3. On the new device, import the data using the restore commands

### Browser Compatibility
- ✅ Chrome/Edge/Brave: Full support
- ✅ Firefox: Full support
- ✅ Safari: Full support
- ✅ Mobile browsers: Full support (iOS Safari, Chrome Mobile, etc.)

### Private/Incognito Mode
⚠️ **Warning**: In private/incognito mode, localStorage is cleared when you close the browser. Your data will not persist between sessions.

## Future: Database Integration

Currently, PlumbPro uses browser localStorage for simplicity. In the future, you may want to:
- Connect to the PostgreSQL database for multi-device sync
- Enable user authentication for secure access
- Implement cloud backup/restore

The backend already has database routes ready - they just need to be connected to the frontend API calls.
