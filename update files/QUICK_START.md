# PlumbPro Inventory - Quick Start Guide

**Get up and running in 10 minutes!**

## Prerequisites Check

Before starting, ensure you have:
- [ ] Node.js 18+ installed (`node --version`)
- [ ] PostgreSQL 14+ installed (`psql --version`)
- [ ] A Gemini API key from https://ai.google.dev/

## 5-Step Setup

### Step 1: Clone & Install (2 min)

```bash
cd PlumbPro-Inventory

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### Step 2: Database Setup (2 min)

```bash
# Create PostgreSQL database
psql -U postgres
CREATE DATABASE plumbpro_inventory;
\q

# Run migrations
cd server
npm run migrate

# Seed demo data
npm run seed
cd ..
```

### Step 3: Configure Environment (1 min)

**Backend** - Create `server/.env`:
```bash
cd server
cp .env.example .env
```

Edit `server/.env` and set:
- `DB_PASSWORD=your_postgres_password`
- `JWT_SECRET=any_random_long_string`
- `GEMINI_API_KEY=your_api_key`

**Frontend** - Create `.env`:
```bash
cd ..
echo "VITE_API_URL=http://localhost:5000/api" > .env
```

### Step 4: Start Backend (1 min)

```bash
cd server
npm run dev
```

**Look for:**
```
✅ Database connected successfully
📡 Server running on port 5000
```

### Step 5: Start Frontend (1 min)

Open a **new terminal**:
```bash
npm run dev
```

**Browser opens to:** http://localhost:3000

## First Login (1 min)

1. See the login screen
2. Use demo credentials:
   - Email: `demo@plumbpro.com`
   - Password: `demo123`
3. Click "Sign In"

**You're in!** 🎉

## Quick Test

After logging in, verify everything works:

1. **Dashboard** - See inventory value and low stock alerts
2. **Inventory** - View 8 pre-loaded items
3. **Jobs** - See 1 sample job
4. **Smart Ordering** - Click "Generate Order Suggestions"
5. **Stock History** - View movement log

All working? **Success!**

## Common Issues

### "Database connection failed"
```bash
# Check PostgreSQL is running
pg_isready

# If not running (macOS):
brew services start postgresql@14
```

### "Port already in use"
```bash
# Find and kill process on port 5000
lsof -i :5000
kill -9 <PID>
```

### "Invalid credentials"
```bash
# Re-run seed script
cd server
npm run seed
```

### "Cannot connect to backend"
- Ensure backend is running on port 5000
- Check `.env` has correct API URL
- Test: `curl http://localhost:5000/health`

## File Structure Quick Reference

```
PlumbPro-Inventory/
├── server/              # Backend
│   ├── src/
│   │   ├── routes/     # API endpoints
│   │   └── db/         # Database files
│   └── .env            # Backend config (CREATE THIS)
├── lib/                 # Frontend utilities
├── store/               # State management
├── views/               # UI components
└── .env                 # Frontend config (CREATE THIS)
```

## Next Steps

Now that it's running:

1. **Explore the demo data**
   - View inventory items
   - Check job schedules
   - Review contacts

2. **Try creating something**
   - Add a new inventory item
   - Create a new job
   - Allocate materials

3. **Test AI features**
   - Generate smart order suggestions
   - See AI reasoning

4. **Create your own account**
   - Logout
   - Register with your email
   - Build your own inventory

## Environment Variables Cheat Sheet

**Backend** (`server/.env`):
```env
PORT=5000
DB_HOST=localhost
DB_NAME=plumbpro_inventory
DB_USER=postgres
DB_PASSWORD=yourpassword        # ← CHANGE THIS
JWT_SECRET=randomsecretkey      # ← CHANGE THIS
GEMINI_API_KEY=your_key_here    # ← CHANGE THIS
CORS_ORIGIN=http://localhost:3000
```

**Frontend** (`.env`):
```env
VITE_API_URL=http://localhost:5000/api
```

## Useful Commands

```bash
# Backend
cd server
npm run dev          # Start development server
npm run migrate      # Reset database schema
npm run seed         # Reload demo data

# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Database
psql -U postgres -d plumbpro_inventory
SELECT * FROM users;               # View users
SELECT * FROM inventory_items;     # View inventory
\dt                                # List tables
\q                                 # Quit
```

## Testing the API

```bash
# Health check
curl http://localhost:5000/health

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@plumbpro.com","password":"demo123"}'

# Get inventory (replace TOKEN)
curl http://localhost:5000/api/inventory \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Production Deployment Quick Tips

When ready for production:

1. **Frontend:** Deploy to Vercel
   ```bash
   npm run build
   # Upload dist/ to Vercel
   ```

2. **Backend:** Deploy to Railway
   - Connect GitHub repo
   - Add PostgreSQL addon
   - Set environment variables

3. **Database:** Use managed PostgreSQL
   - Railway Postgres
   - AWS RDS
   - Supabase

## Getting Help

- **Detailed setup:** See `SETUP.md`
- **API docs:** See `server/README.md`
- **Architecture:** See `INTEGRATION_SUMMARY.md`

## Success Checklist

- [ ] PostgreSQL running
- [ ] Database created
- [ ] Backend running on :5000
- [ ] Frontend running on :3000
- [ ] Can login with demo credentials
- [ ] Dashboard shows data
- [ ] Can create new items
- [ ] AI suggestions work

All checked? **You're ready to go!** 🚀

---

**Total setup time:** ~10 minutes
**Demo login:** demo@plumbpro.com / demo123
**Support:** Check SETUP.md for detailed troubleshooting
