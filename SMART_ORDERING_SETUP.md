# Smart Ordering Setup Guide

## Current Status

The Smart Ordering feature is **fully implemented** but requires a Google Gemini API key to function.

## What Smart Ordering Does

The AI-powered Smart Ordering feature analyzes:
- ✅ Your current inventory levels
- ✅ Items below or near reorder levels
- ✅ Upcoming scheduled jobs
- ✅ Items allocated to jobs
- ✅ Historical usage patterns

Then provides intelligent suggestions for:
- Which items to reorder
- How many units to order
- Why each item is recommended

## Setup Instructions

### Step 1: Get a Free Gemini API Key

1. **Go to Google AI Studio**
   - Visit: https://makersuite.google.com/app/apikey
   - Or: https://aistudio.google.com/apikey

2. **Sign in with Google Account**
   - Use your personal or business Google account

3. **Create API Key**
   - Click "Create API Key"
   - Choose "Create API key in new project" (recommended)
   - Copy the generated key (starts with `AIza...`)

4. **Important Notes**
   - The key is free to use with generous limits
   - Gemini 2.0 Flash: 15 requests per minute, 1 million tokens per day
   - Perfect for small to medium businesses
   - No credit card required

### Step 2: Add API Key to Settings

**Option A: Via Web Interface (Recommended)**
1. Open PlumbPro Inventory
2. Go to **Settings** (gear icon or bottom nav)
3. Click **AI Integration** in the sidebar
4. Paste your API key in **"Gemini API Key"** field
5. Click **Save Changes**

**Option B: Via Environment File**
1. Open `server/.env`
2. Find the line: `GEMINI_API_KEY=`
3. Add your key: `GEMINI_API_KEY=AIzaSyC...your-key-here`
4. Save the file
5. Restart the backend server: `npm run dev` (in server folder)

### Step 3: Test Smart Ordering

1. Navigate to **Smart Ordering** page
2. Click **"Generate Order Suggestions"** button
3. Wait 5-10 seconds while AI analyzes your data
4. Review the AI-generated suggestions

## How It Works

### Backend Process (server/src/routes/smartOrdering.js)

1. **Fetch Data**
   - Retrieves all inventory items
   - Gets upcoming jobs (scheduled & in-progress)
   - Includes allocated items per job

2. **Build AI Prompt**
   - Formats inventory data (name, quantity, reorder level)
   - Formats job data (title, type, date, items)
   - Adds analysis instructions

3. **Call Gemini AI**
   - Sends prompt to Gemini 2.0 Flash model
   - Requests structured JSON response
   - Parses AI suggestions

4. **Return Results**
   - Sends suggestions to frontend
   - Each suggestion includes: itemId, itemName, quantity, reason

### AI Analysis Factors

The AI considers:
1. **Low Stock Items** - Below or at reorder level
2. **Job Requirements** - Items needed for upcoming jobs
3. **Usage Patterns** - Based on job types and history
4. **Safety Stock** - Maintains buffer for common items
5. **Seasonal Demand** - Adjusts for time of year
6. **Common Sense** - Professional plumbing knowledge

## Troubleshooting

### Error: "Failed to generate suggestions"

**Cause**: No API key configured or invalid key

**Solution**:
1. Check Settings → AI Integration
2. Verify API key is entered correctly
3. Test key at: https://makersuite.google.com/app/prompts
4. Make sure key starts with `AIza`
5. Check for extra spaces or line breaks

### Error: "Rate limit exceeded"

**Cause**: Too many requests in short time

**Solution**:
- Free tier: 15 requests/minute
- Wait 60 seconds and try again
- Consider upgrading to paid tier if needed

### No Suggestions Returned

**Possible Causes**:
1. **No low stock items** - All inventory is healthy
2. **No upcoming jobs** - Nothing scheduled
3. **All jobs picked** - Stock already allocated

**Solution**:
- This is normal if inventory is well-stocked
- Create some jobs with scheduled dates
- Manually lower some item quantities to test

### Suggestions Don't Make Sense

**Solutions**:
1. **Update inventory data** - Ensure quantities are accurate
2. **Add more jobs** - AI needs context from job schedule
3. **Check job types** - Make sure job types are descriptive
4. **Review reorder levels** - Set appropriate thresholds

## API Usage & Costs

### Free Tier Limits
- **15 requests/minute**
- **1,500 requests/day**
- **1 million tokens/day**

For a small business:
- 1 suggestion request ≈ 5,000 tokens
- Can generate ~200 suggestions per day
- Completely free for typical usage

### Paid Tier (if needed)
- **$0.075** per 1 million input tokens
- **$0.30** per 1 million output tokens
- For 1,000 suggestions/month: ~$0.38/month
- Extremely affordable even at scale

## Advanced Configuration

### Using Ollama (Local AI) Instead

If you prefer 100% local/private AI:

1. **Install Ollama**
   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.com/install.sh | sh

   # Windows
   # Download from https://ollama.com/download
   ```

2. **Pull a Model**
   ```bash
   ollama pull llama3
   ```

3. **Update Settings**
   - Go to Settings → AI Integration
   - Set "Default AI Provider" to "Ollama (Local)"
   - Set "Feature-Specific: Purchase Orders" to "Ollama"

4. **Update Backend Code**
   - Modify `server/src/routes/smartOrdering.js`
   - Replace Gemini call with Ollama API call
   - Point to: http://localhost:11434/api/generate

### Custom AI Prompts

To modify AI behavior, edit the prompt in:
`server/src/routes/smartOrdering.js` (lines 57-84)

You can adjust:
- Analysis priorities
- Suggestion format
- Stock level thresholds
- Response style

## Security Best Practices

### API Key Security
✅ **DO:**
- Store key in `.env` file (server-side only)
- Add `.env` to `.gitignore`
- Use environment variables
- Rotate keys periodically

❌ **DON'T:**
- Commit keys to Git
- Expose keys in frontend code
- Share keys publicly
- Use same key across projects

### Production Deployment
- Use environment variables on hosting platform
- Enable HTTPS for all API calls
- Set up API key rotation schedule
- Monitor usage in Google Cloud Console

## Alternative: Backend-Stored Settings

Currently, AI settings are stored in browser localStorage. For multi-user setups, you may want to:

1. **Add settings to database**
   - Create `user_settings` table
   - Store API key encrypted
   - Per-user or organization-wide

2. **Update backend**
   - Load key from database instead of .env
   - Allow admins to configure via UI
   - Audit key usage per user

3. **Benefits**
   - Centralized management
   - Multi-user support
   - Usage tracking
   - Automatic key rotation

## Support

### Getting Help
1. Check this guide first
2. Review error messages in browser console
3. Test API key at Google AI Studio
4. Verify backend logs: `npm run dev` output

### Common Questions

**Q: Is my data sent to Google?**
A: Yes, inventory and job names are sent to Gemini API for analysis. No personal/customer data is included.

**Q: Can I use this offline?**
A: No, Smart Ordering requires internet to call Gemini API. Switch to Ollama for offline use.

**Q: How accurate are the suggestions?**
A: Very accurate for standard plumbing scenarios. Improve by adding detailed job descriptions and accurate inventory data.

**Q: Can I customize suggestions?**
A: Yes, modify the AI prompt in backend code to adjust analysis logic.

---

**Version**: 6.1.0.4
**Last Updated**: January 2026
**Required**: Google Gemini API Key (free)
