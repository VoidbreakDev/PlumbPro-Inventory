# AI Provider Setup Guide

## Overview

PlumbPro Inventory supports **multiple AI providers** with flexible configuration. You can use different providers for different features to optimize for cost, privacy, and performance.

---

## 🤖 **Supported Providers**

| Provider | Type | Cost | Privacy | Speed | Best For |
|----------|------|------|---------|-------|----------|
| **Ollama** | Local | FREE | 100% Private | Medium | Development, Privacy |
| **Google Gemini** | Cloud | FREE* | Sends to Google | Fast | Production (Free Tier) |
| **OpenAI** | Cloud | Paid | Sends to OpenAI | Fast | Production (High Quality) |
| **Anthropic Claude** | Cloud | Paid | Sends to Anthropic | Fast | Production (Long Context) |

*Free tier: 60 requests/minute

---

## 🎯 **Recommended Setup (Hybrid)**

### **Best Balance: Ollama + Gemini**

**Use Ollama (Local/Free) for:**
- ✅ Natural language search
- ✅ Template generation
- ✅ Job completion checks

**Use Gemini (Cloud/Free) for:**
- ✅ Demand forecasting
- ✅ Anomaly detection
- ✅ Purchase order generation
- ✅ Business insights

**Why This Works:**
- **Zero cost** (both free)
- **Privacy** for routine tasks (Ollama)
- **Accuracy** for critical tasks (Gemini)
- **No rate limit issues** (Ollama handles bulk)

---

## 📥 **Setup Instructions**

### **Option 1: Ollama (Recommended for Development)**

**What is Ollama?**
- Runs AI models locally on your server
- Completely free and private
- No API keys needed
- Works offline

**Installation:**

**macOS:**
```bash
# Download and install from website
open https://ollama.com/download

# Or use Homebrew
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
```powershell
# Download installer from https://ollama.com/download
```

**Download AI Model:**
```bash
# Download Llama 3 (recommended, ~4GB)
ollama pull llama3

# Or download smaller/faster model
ollama pull llama3:8b

# Or larger/more capable model
ollama pull llama3:70b
```

**Start Ollama:**
```bash
# Ollama runs automatically as a service
# Or start manually:
ollama serve
```

**Test It:**
```bash
# Test if working
ollama run llama3 "Hello, how are you?"
```

**Configure PlumbPro:**
```env
# server/.env
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

**Done!** Ollama is ready to use.

---

### **Option 2: Google Gemini (Recommended for Production)**

**What is Gemini?**
- Google's latest AI model
- Free tier: 60 requests/minute
- Fast and accurate
- Already integrated

**Get API Key:**

1. Visit: https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key

**Configure:**
```env
# server/.env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_actual_api_key_here
```

**Free Tier Limits:**
- 60 requests per minute
- 1,500 requests per day
- Sufficient for most small-medium businesses

---

### **Option 3: OpenAI (For Maximum Quality)**

**What is OpenAI?**
- ChatGPT maker
- Very high quality
- Costs money ($0.01-0.03 per request)

**Get API Key:**

1. Visit: https://platform.openai.com/
2. Create account
3. Go to API Keys section
4. Create new key
5. Add billing info

**Configure:**
```env
# server/.env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your_key_here
OPENAI_MODEL=gpt-4o-mini  # Cheapest, still great
# OPENAI_MODEL=gpt-4  # Best quality, expensive
```

**Pricing (GPT-4o-mini):**
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens
- Typical request: ~$0.002 (1/5 of a penny)

---

### **Option 4: Anthropic Claude (For Long Context)**

**What is Claude?**
- Made by Anthropic
- Excellent for complex analysis
- Similar pricing to OpenAI

**Get API Key:**

1. Visit: https://console.anthropic.com/
2. Create account
3. Get API key
4. Add billing

**Configure:**
```env
# server/.env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your_key_here
ANTHROPIC_MODEL=claude-3-haiku-20240307  # Fastest/cheapest
# ANTHROPIC_MODEL=claude-3-sonnet-20240229  # Balanced
# ANTHROPIC_MODEL=claude-3-opus-20240229  # Most capable
```

---

## ⚙️ **Feature-Specific Configuration**

You can use different providers for different features!

**Example Hybrid Setup:**

```env
# Default for most features
AI_PROVIDER=auto

# Gemini API key
GEMINI_API_KEY=your_gemini_key

# Ollama settings
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Feature-specific overrides
AI_PROVIDER_FORECAST=gemini          # Needs accuracy
AI_PROVIDER_SEARCH=ollama            # Can be local
AI_PROVIDER_TEMPLATE=ollama          # Can be local
AI_PROVIDER_ANOMALY=gemini           # Needs accuracy
AI_PROVIDER_PURCHASE_ORDERS=gemini   # Needs accuracy
AI_PROVIDER_INSIGHTS=gemini          # Best analysis
AI_PROVIDER_JOB_COMPLETION=ollama    # Can be local
```

**Result:**
- Free features use Ollama (local)
- Critical features use Gemini (free cloud)
- Zero cost, maximum quality!

---

## 🔄 **Automatic Fallback**

If primary provider fails, system automatically falls back:

**Fallback Order:**
1. Primary provider (your choice)
2. Ollama (if available)
3. Gemini (if API key set)
4. OpenAI (if API key set)
5. Error (if all fail)

**Example:**
```
Request → Ollama (offline) → Falls back to Gemini → Success!
```

---

## 🧪 **Testing Your Setup**

**Check Provider Health:**

```bash
curl http://localhost:5000/api/ai/health
```

**Response:**
```json
{
  "gemini": { "status": "ok", "configured": true },
  "ollama": { "status": "ok", "configured": true, "models": ["llama3"] },
  "openai": { "status": "not_configured", "configured": false },
  "anthropic": { "status": "not_configured", "configured": false }
}
```

**Test Each Provider:**

```bash
# Test Ollama
curl http://localhost:11434/api/tags

# Test Gemini (replace YOUR_KEY)
curl -X POST https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-exp:generateContent?key=YOUR_KEY \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

---

## 💰 **Cost Comparison**

### **Per Month (100 requests/day)**

| Provider | Setup | Monthly Cost | Total/Year |
|----------|-------|--------------|------------|
| **Ollama** | One-time install | FREE | FREE |
| **Gemini** | API key | FREE | FREE |
| **OpenAI (GPT-4o-mini)** | API key + billing | ~$6 | ~$72 |
| **OpenAI (GPT-4)** | API key + billing | ~$60 | ~$720 |
| **Claude Haiku** | API key + billing | ~$7.50 | ~$90 |

### **Per Month (1000 requests/day)**

| Provider | Monthly Cost |
|----------|--------------|
| **Ollama** | FREE |
| **Gemini** | FREE (if under limit) |
| **OpenAI (GPT-4o-mini)** | ~$60 |
| **Claude Haiku** | ~$75 |

---

## 🎛️ **Configuration Examples**

### **Example 1: Zero Cost (Ollama Only)**

```env
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

**Pros:** Completely free, private
**Cons:** Requires local resources, slightly less accurate

---

### **Example 2: Zero Cost (Hybrid)**

```env
AI_PROVIDER=auto
GEMINI_API_KEY=your_key
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Smart features use Gemini (accurate)
AI_PROVIDER_FORECAST=gemini
AI_PROVIDER_ANOMALY=gemini
AI_PROVIDER_PURCHASE_ORDERS=gemini
AI_PROVIDER_INSIGHTS=gemini

# Routine features use Ollama (free)
AI_PROVIDER_SEARCH=ollama
AI_PROVIDER_TEMPLATE=ollama
AI_PROVIDER_JOB_COMPLETION=ollama
```

**Pros:** Best of both worlds, still free
**Cons:** Need to install Ollama

---

### **Example 3: Maximum Quality**

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini

# Fallback to Gemini if OpenAI down
GEMINI_API_KEY=your_gemini_key
```

**Pros:** Highest quality AI
**Cons:** Costs money (~$60/month for 1000 requests/day)

---

### **Example 4: Privacy First**

```env
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

**Pros:** 100% private, no data leaves server
**Cons:** Requires server resources (8GB+ RAM recommended)

---

## 🚀 **Quick Start Recommendations**

### **Just Starting Out?**
→ Use **Gemini** (easiest setup, free)
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key
```

### **Want Privacy?**
→ Use **Ollama** (local, free, private)
```env
AI_PROVIDER=ollama
```

### **Best Value?**
→ Use **Ollama + Gemini Hybrid** (free, smart)
```env
AI_PROVIDER=auto
GEMINI_API_KEY=your_key
OLLAMA_URL=http://localhost:11434
AI_PROVIDER_SEARCH=ollama
AI_PROVIDER_TEMPLATE=ollama
```

### **Production App?**
→ Use **OpenAI** (best quality, predictable cost)
```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_key
```

---

## 🔧 **Troubleshooting**

### **Ollama Not Working**

**Problem:** "Connection refused" or "Ollama offline"

**Solutions:**
1. Check if Ollama is running:
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. Start Ollama if not running:
   ```bash
   ollama serve
   ```

3. Pull model if not downloaded:
   ```bash
   ollama pull llama3
   ```

4. Check firewall settings

---

### **Gemini API Errors**

**Problem:** "API key not valid"

**Solutions:**
1. Check key is correct in `.env`
2. Verify key at https://makersuite.google.com/app/apikey
3. Create new key if needed
4. Check no extra spaces in `.env` file

**Problem:** "Rate limit exceeded"

**Solutions:**
1. You hit 60 requests/minute limit
2. Wait 1 minute
3. Or switch to Ollama for bulk operations
4. Or upgrade to paid Gemini plan

---

### **No Provider Available**

**Problem:** "No AI provider configured"

**Solutions:**
1. Set at least one provider in `.env`:
   - `GEMINI_API_KEY=...` OR
   - Install Ollama OR
   - `OPENAI_API_KEY=...`

2. Restart server after changing `.env`

---

## 📊 **Performance Comparison**

**Response Times (Typical):**

| Provider | Speed | Quality |
|----------|-------|---------|
| Ollama (local) | 2-5 sec | Good |
| Gemini | 1-2 sec | Excellent |
| OpenAI GPT-4o-mini | 1-2 sec | Excellent |
| OpenAI GPT-4 | 3-5 sec | Best |
| Claude Haiku | 1-2 sec | Excellent |

**Accuracy (Forecasting):**

| Provider | Forecast Accuracy |
|----------|-------------------|
| Ollama Llama 3 | 75-85% |
| Gemini | 85-92% |
| OpenAI GPT-4o-mini | 85-92% |
| OpenAI GPT-4 | 90-95% |
| Claude Sonnet | 88-94% |

---

## 🎓 **Advanced Configuration**

### **Load Balancing**

Use different providers for different times:

```javascript
// In your code
const provider = new Date().getHours() < 9 || new Date().getHours() > 17
  ? 'ollama'  // Use local during off-hours
  : 'gemini'; // Use cloud during business hours
```

### **Cost Optimization**

Monitor usage and switch providers:

```javascript
const requestCount = getRequestCount();

if (requestCount > 1000) {
  // Switch to local to save money
  return 'ollama';
}
```

### **A/B Testing**

Compare provider quality:

```env
# Test mode
AI_PROVIDER_FORECAST=gemini
AI_PROVIDER_FORECAST_TEST=ollama
```

---

## 📚 **Additional Resources**

**Ollama:**
- Website: https://ollama.com
- Models: https://ollama.com/library
- GitHub: https://github.com/ollama/ollama

**Google Gemini:**
- API Keys: https://makersuite.google.com/app/apikey
- Docs: https://ai.google.dev/docs
- Pricing: https://ai.google.dev/pricing

**OpenAI:**
- Platform: https://platform.openai.com/
- Docs: https://platform.openai.com/docs
- Pricing: https://openai.com/pricing

**Anthropic Claude:**
- Console: https://console.anthropic.com/
- Docs: https://docs.anthropic.com/
- Pricing: https://www.anthropic.com/pricing

---

## ✅ **Summary**

You now have **4 AI provider options**:

1. ✅ **Ollama** - Free, private, local
2. ✅ **Gemini** - Free cloud, accurate
3. ✅ **OpenAI** - Paid, highest quality
4. ✅ **Claude** - Paid, excellent for long context

**Recommended for most users:**
```env
AI_PROVIDER=auto
GEMINI_API_KEY=your_key  # For critical features
OLLAMA_URL=http://localhost:11434  # For routine features
```

**Cost:** FREE
**Quality:** Excellent
**Privacy:** Good (hybrid)
**Flexibility:** Maximum

Your PlumbPro system can now use the perfect AI provider for each task! 🎉
