# Cleanup Initial Sample Data

## Issue

If you loaded the app before the database sync was set up, you might have **sample contacts with simple IDs** (like `c1`, `c2`, `s1`, `s2`) in your state. These IDs don't work with the database, which requires UUID format.

When you try to edit or delete these old contacts, you get:
```
Failed to save contact: Request failed with status code 500
Error: invalid input syntax for type uuid: "c1"
```

---

## Solution: Clear Old Data and Start Fresh

### Option 1: Clear Browser Data (Recommended)

The easiest fix is to refresh the page and let the app load fresh data from the database:

1. **Open browser console** (F12 or right-click → Inspect)
2. **Run this command:**
   ```javascript
   localStorage.clear();
   location.reload();
   ```
3. **Result:** App will reload with empty data from database
4. **Add new contacts** through the UI - they'll get proper UUIDs ✅

---

### Option 2: Delete Only PlumbPro Data

If you want to keep other localStorage data:

```javascript
// Clear only PlumbPro data
localStorage.removeItem('plumbpro-contacts');
localStorage.removeItem('plumbpro-inventory');
localStorage.removeItem('plumbpro-jobs');
localStorage.removeItem('plumbpro-movements');
localStorage.removeItem('plumbpro-templates');

// Reload
location.reload();
```

---

### Option 3: Manual Cleanup (If You Have Important Data)

If you've added important data that you want to keep:

1. **Find contacts with database UUIDs:**
   - New contacts you created have long UUIDs like: `58561a13-a1bd-47a1-a0fe-4bbfd3123cec`
   - Old sample contacts have short IDs like: `c1`, `c2`, `s1`, `s2`

2. **Only the new contacts work** with edit/delete

3. **Delete old sample contacts** by refreshing the page:
   ```javascript
   location.reload();
   ```

4. **Re-add any data** you need through the UI

---

## After Cleanup

After clearing the data, the app will:

✅ Load from database (empty if you just started)
✅ Show no sample data
✅ Let you add new contacts with proper UUIDs
✅ Edit and delete work correctly
✅ Multi-device sync works perfectly

### Add Your Real Data

Now add your actual contacts, inventory, and jobs through the UI:

1. **Contacts Tab** → Add New Contact → Fill details → Save
2. **Inventory Tab** → Add Item → Fill details → Save
3. **Job Planning** → New Job → Fill details → Save

All new data will:
- Get proper UUID primary keys
- Save to database
- Sync across devices
- Support edit/delete operations ✅

---

## Why This Happened

The app was originally designed to start with sample data (INITIAL_CONTACTS, INITIAL_INVENTORY, etc.) using simple IDs like `c1`, `i1`, `j1`.

When we added database sync, the database uses **UUID primary keys** (like `58561a13-a1bd-47a1-a0fe-4bbfd3123cec`), which are incompatible with the simple IDs.

The fix:
- App now starts with **empty arrays** instead of sample data
- All new data created through the UI gets proper UUIDs
- Database operations work correctly

---

## Verification

After cleanup, check that it works:

### 1. Create a Contact
```
Contacts → Add New Contact → Fill details → Save
Console: ✅ Contact created in database: [long-uuid]
```

### 2. Edit the Contact
```
Click the contact → Edit → Change name → Save
Console: ✅ Contact updated in database: [long-uuid]
```

### 3. Delete the Contact
```
Click delete → Confirm
Console: ✅ Contact deleted from database: [long-uuid]
```

All operations should work without 500 errors!

---

## Summary

✅ Run `localStorage.clear(); location.reload();` in browser console
✅ App reloads with empty data
✅ Add new data through the UI
✅ Everything gets proper UUIDs
✅ Edit and delete work correctly
✅ Multi-device sync ready to test

**Clear your data and start fresh - it's the easiest way to fix the issue!** 🎉
