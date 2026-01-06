# Smart Ordering Debug Guide

I've added comprehensive debug logging to help troubleshoot the API key issue. Follow these steps:

## Step 1: Save API Key in Settings

1. Open the app in your browser (http://localhost:3000)
2. Go to **Settings** → **AI Integration**
3. Enter your Gemini API key in the "Gemini API Key" field
4. Click **Save Changes**
5. You should see an alert: "Settings saved successfully!"

**Check Browser Console:**
- You should see: `✅ Settings saved to localStorage:` with your settings object
- You should see: `🔑 Gemini API Key: AIza...` (first 10 characters)

## Step 2: Verify localStorage

1. Open Browser DevTools (F12 or Right-click → Inspect)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click on **Local Storage** → **http://localhost:3000**
4. Find the key `plumbpro-settings`
5. Click on it to view the value

**What to check:**
- Does the `ai.geminiApiKey` field exist?
- Is it set to your actual API key?
- Is the key the correct length (should be around 39 characters, starting with "AIza")?

## Step 3: Test Smart Ordering

1. Go to **Ordering** page
2. Open Browser Console (F12)
3. Click **Generate Order Suggestions**

**Check Browser Console - Frontend Logs:**
- `📦 localStorage plumbpro-settings:` - Shows the raw localStorage value
- `⚙️ Parsed settings:` - Shows the parsed settings object
- `🔑 Gemini API Key found:` - Shows if the key was found and its length
- `🚀 Sending API request with key:` - Shows YES or NO

**Check Backend Logs - Terminal/Server Console:**
- `🔍 Backend received request body:` - Shows what the backend received
  - `hasGeminiApiKey:` - Should be `true`
  - `geminiApiKeyLength:` - Should be ~39
  - `geminiApiKeyPreview:` - Should show first 10 characters
  - `finalApiKey:` - Should show the key being used

## Common Issues & Solutions

### Issue: localStorage doesn't save the key
**Symptoms:**
- Alert shows "Settings saved" but key isn't in localStorage
- localStorage is empty or missing the `ai` field

**Solution:**
- Check if browser has localStorage enabled
- Try clearing all localStorage: `localStorage.clear()` in console, then try again
- Check for browser extensions that might block localStorage

### Issue: Key is saved but not sent to backend
**Symptoms:**
- localStorage has the key
- Frontend logs show the key
- Backend logs show `hasGeminiApiKey: false`

**Solution:**
- Check Network tab in DevTools
- Look for POST request to `/api/smart-ordering/suggestions`
- Check the Request Payload - does it include `geminiApiKey`?

### Issue: Backend receives empty/undefined key
**Symptoms:**
- Frontend sends the key
- Backend shows `geminiApiKeyLength: 0`

**Solution:**
- Check if the key has spaces or newlines
- Verify the key format (should start with "AIza")
- Try copying the key again from Google AI Studio

### Issue: Invalid API key error
**Symptoms:**
- Backend receives the key
- But Gemini API returns 401 or 403 error

**Solution:**
- Verify the key is correct at https://makersuite.google.com/app/apikey
- Make sure the key has the Gemini API enabled
- Try generating a new API key

## Quick Test Commands

Run these in Browser Console to test:

```javascript
// Check localStorage
const settings = JSON.parse(localStorage.getItem('plumbpro-settings'));
console.log('Settings:', settings);
console.log('API Key:', settings?.ai?.geminiApiKey);

// Manually save a test key
localStorage.setItem('plumbpro-settings', JSON.stringify({
  ai: { geminiApiKey: 'YOUR_KEY_HERE' }
}));

// Clear all settings
localStorage.removeItem('plumbpro-settings');
```

## Still Not Working?

If you've tried all the above and it still doesn't work, provide me with:

1. Screenshot of localStorage showing the `plumbpro-settings` value
2. Browser console logs when clicking "Generate Order Suggestions"
3. Backend/server console logs from the same action
4. What error message you see in the UI
