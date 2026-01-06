# Database Sync Implementation - Multi-Device Real-Time Sync

## Overview

PlumbPro Inventory now uses **PostgreSQL database** for data persistence instead of browser localStorage. This enables:

✅ **Real-time multi-device sync** - Changes on desktop appear on mobile (and vice versa)
✅ **Persistent data** - Data stored in centralized database
✅ **Automatic sync** - All CRUD operations automatically save to database
✅ **Fallback support** - Falls back to localStorage if database connection fails

---

## What Changed?

### Before (localStorage only)
- Data stored per-device in browser localStorage
- Changes on desktop don't appear on mobile
- No real-time sync between devices
- Data lost if browser cache cleared

### After (Database sync)
- Data stored in PostgreSQL database
- Changes sync across all devices
- Real-time updates when you refresh the page
- Centralized data storage

---

## How It Works

### On App Load (Desktop & Mobile)
1. App fetches data from database API endpoints
2. If database has data, it's loaded into the app
3. If database connection fails, falls back to localStorage
4. Console shows logs: `🔄 Loading data from database...`

### On Data Changes (Add/Edit/Delete)
1. User makes a change (e.g., adds a contact, adjusts stock)
2. App saves to database via API call
3. Local state updates immediately for fast UI
4. Console shows logs: `✅ Contact created in database: xyz`
5. On other devices, refresh to see the changes

### Database API Endpoints Used
- **Contacts**: `POST/PUT/DELETE /api/contacts`
- **Inventory**: `POST/PUT/DELETE /api/inventory`, `POST /api/inventory/:id/adjust`
- **Jobs**: `POST/PUT/DELETE /api/jobs`, `POST /api/jobs/:id/pick`
- **Templates**: `POST/PUT/DELETE /api/templates`
- **Movements**: `GET /api/movements` (auto-created by backend)

---

## Testing Multi-Device Sync

### Step 1: Desktop - Add a Contact
1. Open PlumbPro on desktop browser (http://localhost:3000)
2. Go to **Contacts** tab
3. Click **Add New Contact**
4. Fill in details:
   - Name: `Test Sync Contact`
   - Email: `sync@test.com`
   - Phone: `555-1234`
   - Type: `Supplier`
5. Click **Save Changes**
6. Check browser console - you should see:
   ```
   ✅ Contact created in database: c-xyz123
   ```

### Step 2: Mobile - Verify Sync
1. Open PlumbPro on mobile browser (http://YOUR-NETWORK-IP:3000)
2. Refresh the page (pull down to refresh)
3. Go to **Contacts** tab
4. **You should see** `Test Sync Contact` appear!
5. Check mobile browser console - you should see:
   ```
   🔄 Loading data from database...
   ✅ Loaded contacts from database: X
   ```

### Step 3: Mobile - Make a Change
1. On mobile, edit the contact you just created
2. Change the phone number to `555-9999`
3. Save the contact
4. Check console: `✅ Contact updated in database: c-xyz123`

### Step 4: Desktop - Verify Reverse Sync
1. Return to desktop browser
2. Refresh the page
3. Go to **Contacts** tab
4. Click on `Test Sync Contact` - phone should now be `555-9999`

### Step 5: Test Inventory Sync
1. On **desktop**, go to **Inventory** tab
2. Adjust stock for any item (e.g., add +10 units)
3. Save the adjustment
4. On **mobile**, refresh and check - stock should update!

### Step 6: Test Job Sync
1. On **mobile**, go to **Job Planning** tab
2. Create a new job with any details
3. On **desktop**, refresh - new job should appear!

---

## Migration from localStorage to Database

### Option 1: Fresh Start (Recommended for Testing)
1. Clear your browser localStorage:
   ```javascript
   localStorage.clear();
   location.reload();
   ```
2. App will load with empty data
3. Start adding new data - it will save to database

### Option 2: Migrate Existing localStorage Data
If you have important data in localStorage that you want to migrate to the database:

1. **Export your localStorage data** (run in browser console):
   ```javascript
   const backup = {
     contacts: JSON.parse(localStorage.getItem('plumbpro-contacts') || '[]'),
     inventory: JSON.parse(localStorage.getItem('plumbpro-inventory') || '[]'),
     jobs: JSON.parse(localStorage.getItem('plumbpro-jobs') || '[]'),
     templates: JSON.parse(localStorage.getItem('plumbpro-templates') || '[]')
   };
   console.log(JSON.stringify(backup, null, 2));
   ```

2. **Copy the output** and save to a file

3. **Manually re-add the data** through the UI:
   - Add contacts one by one (they'll save to database)
   - Add inventory items one by one
   - Add jobs one by one
   - Add templates one by one

4. **Clear localStorage** once migration is complete:
   ```javascript
   localStorage.clear();
   ```

---

## Console Logging

The app now has comprehensive logging to help you track database sync:

### Loading Data
```
🔄 Loading data from database...
✅ Loaded contacts from database: 5
✅ Loaded inventory from database: 12
✅ Loaded jobs from database: 3
```

### Creating Data
```
✅ Contact created in database: c-1736287564000
✅ Inventory item created in database: inv-1736287600000
✅ Job created in database: j-1736287650000
```

### Updating Data
```
✅ Contact updated in database: c-123
✅ Inventory item updated in database: inv-456
✅ Stock adjusted in database: inv-789
```

### Deleting Data
```
✅ Contact deleted from database: c-123
✅ Template deleted from database: t-456
```

### Errors
```
❌ Failed to load contacts from database: Network error
📦 Loaded contacts from localStorage fallback
```

---

## Fallback Behavior

If the database connection fails, the app will:

1. **Attempt database load** on startup
2. **Fall back to localStorage** if database fails
3. **Continue working** with localStorage data
4. **Show error toast** to notify user
5. **Log error** to console for debugging

This ensures the app works even if:
- Backend server is offline
- Database connection fails
- Network is unavailable

---

## Updated Files

### `App.tsx`
- Replaced localStorage load/save with database API calls
- Updated all handlers to use async/await database operations
- Added comprehensive error handling and logging
- Fallback to localStorage if database fails

**Key Changes:**
- `handleSaveEditContact` → now saves to database
- `handleDeleteContact` → now deletes from database
- `handleSaveEditItem` → now saves to database
- `handleSaveNewItem` → now creates in database
- `handleManualAdjustment` → now adjusts via API
- `handleMobileStockUpdate` → now syncs to database
- `handleCreateJob` → now creates in database
- `handleConfirmPick` → now picks via API
- `handleAddTemplate`, `handleUpdateTemplate`, `handleDeleteTemplate` → now use database

### `lib/api.ts`
- Already had all necessary API functions
- No changes needed - all endpoints ready!

### `.env`
- Already configured with correct API URL:
  ```
  VITE_API_URL=http://localhost:5001/api
  ```

---

## Troubleshooting

### Issue: Changes don't appear on other device
**Solution:**
1. Check both servers are running:
   ```bash
   lsof -ti:3000  # Frontend should return PID
   lsof -ti:5001  # Backend should return PID
   ```
2. Refresh the page on the other device (data loads on mount)
3. Check browser console for error messages
4. Verify network IP is correct for mobile access

### Issue: "Failed to load data from database" error
**Solution:**
1. Verify backend server is running on port 5001
2. Check backend logs: `tail -f backend.log`
3. Ensure database is running (PostgreSQL)
4. Check authentication is disabled in backend routes (for testing)

### Issue: Data appears on one device but not the other
**Solution:**
1. Ensure you're refreshing the page (data loads on mount)
2. Check network connectivity between devices
3. Verify both devices are using the same backend URL
4. Check browser console for API errors

### Issue: Console shows localStorage fallback
**Solution:**
1. This means database connection failed
2. Check backend server is running
3. Check database connection in backend
4. Review backend logs for errors

---

## Production Checklist

Before deploying to production:

- [ ] Re-enable authentication in backend routes
- [ ] Remove debug console logs (or use environment-based logging)
- [ ] Set up proper database connection pooling
- [ ] Configure CORS for production domains
- [ ] Set up SSL/TLS for API endpoints
- [ ] Implement proper error handling and retry logic
- [ ] Add data validation on backend
- [ ] Set up database backups
- [ ] Configure environment variables for production
- [ ] Test with multiple concurrent users

---

## Benefits of Database Sync

### For Warehouse Workers
- Make stock changes on mobile while in the warehouse
- Changes immediately visible on desktop for office staff
- Real-time inventory tracking

### For Office Staff
- Create jobs on desktop
- Workers see them instantly on mobile
- Coordinated job planning and execution

### For Multi-Location Teams
- All team members see the same data
- No more "out of sync" issues
- Centralized inventory management

---

## Next Steps

1. **Test the sync** using the steps above
2. **Verify all operations** work correctly
3. **Monitor console logs** for any errors
4. **Report any issues** you encounter
5. **Enjoy real-time multi-device sync!** 🎉

---

## Support

If you encounter any issues:

1. Check browser console for error messages
2. Check backend logs: `tail -f backend.log`
3. Verify both servers are running
4. Test database connection manually
5. Report the error with console logs for debugging
