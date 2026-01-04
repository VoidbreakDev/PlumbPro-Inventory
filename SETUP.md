# PlumbPro Inventory - Complete Setup Guide

This guide will walk you through setting up the PlumbPro Inventory system with backend, database, and frontend integration.

## Architecture Overview

The application now consists of three main components:

1. **Frontend** - React + TypeScript + Vite (Port 3000)
2. **Backend API** - Node.js + Express (Port 5000)
3. **Database** - PostgreSQL

```
┌─────────────┐         ┌─────────────┐         ┌──────────────┐
│   Frontend  │  HTTP   │  Backend    │   SQL   │  PostgreSQL  │
│  (React)    │ ◄─────► │  (Express)  │ ◄─────► │   Database   │
│  Port 3000  │         │  Port 5000  │         │              │
└─────────────┘         └─────────────┘         └──────────────┘
       │
       │ Offline Storage
       ▼
┌─────────────┐
│ IndexedDB   │
│ (Browser)   │
└─────────────┘
```

## Prerequisites

Install the following before starting:

### 1. Node.js (v18 or higher)

**macOS** (using Homebrew):
```bash
brew install node
```

**Windows** (using Chocolatey):
```bash
choco install nodejs
```

**Or download from**: https://nodejs.org/

Verify installation:
```bash
node --version  # Should be v18+
npm --version
```

### 2. PostgreSQL (v14 or higher)

**macOS** (using Homebrew):
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Windows** (using Chocolatey):
```bash
choco install postgresql
```

**Or download from**: https://www.postgresql.org/download/

Verify installation:
```bash
psql --version  # Should be 14+
```

### 3. Google Gemini API Key

Get a free API key from: https://ai.google.dev/

## Part 1: Database Setup

### Step 1: Start PostgreSQL

**macOS**:
```bash
brew services start postgresql@14
```

**Windows**:
PostgreSQL should start automatically as a service.

### Step 2: Create Database

```bash
# Connect to PostgreSQL (may require password)
psql -U postgres

# Inside psql shell:
CREATE DATABASE plumbpro_inventory;

# Verify database was created
\l

# Exit psql
\q
```

If you get a password prompt and don't know the password:
```bash
# macOS: Set or reset password
psql postgres
ALTER USER postgres PASSWORD 'newpassword';
\q
```

## Part 2: Backend Setup

### Step 1: Install Dependencies

```bash
cd server
npm install
```

### Step 2: Configure Environment

Create `.env` file:
```bash
cp .env.example .env
```

Edit `server/.env` with your settings:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration (UPDATE THESE!)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=plumbpro_inventory
DB_USER=postgres
DB_PASSWORD=your_actual_postgres_password

# JWT Configuration (CHANGE THIS!)
JWT_SECRET=change_this_to_a_random_long_string_for_security
JWT_EXPIRES_IN=7d

# Google Gemini AI (ADD YOUR KEY!)
GEMINI_API_KEY=your_gemini_api_key_here

# CORS
CORS_ORIGIN=http://localhost:3000
```

**Important**: Generate a secure JWT secret:
```bash
# macOS/Linux
openssl rand -base64 32

# Or use this simple method
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 3: Run Database Migration

```bash
npm run migrate
```

You should see:
```
✅ Database migration completed successfully!
📊 Tables created:
   - users
   - contacts
   - inventory_items
   ...
```

### Step 4: Seed Database (Optional but Recommended)

```bash
npm run seed
```

This creates demo data including:
- Demo user: `demo@plumbpro.com` / `demo123`
- Sample suppliers and plumbers
- Sample inventory items
- Sample job template

### Step 5: Start Backend Server

```bash
npm run dev
```

You should see:
```
🚀 PlumbPro Inventory Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Server running on port 5000
🌍 Environment: development
🔗 API Base URL: http://localhost:5000/api
❤️  Health Check: http://localhost:5000/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Database connected successfully
```

**Test the server**:
```bash
# In a new terminal
curl http://localhost:5000/health
```

Should return:
```json
{"status":"ok","timestamp":"...","uptime":...}
```

## Part 3: Frontend Setup

### Step 1: Install Dependencies

```bash
# From project root
cd ..  # Go back to root if you're in server/
npm install
```

### Step 2: Configure Environment

Create `.env` file in the root directory:

```bash
# Create .env in root
echo "VITE_API_URL=http://localhost:5000/api" > .env
```

Your `.env` should contain:
```env
VITE_API_URL=http://localhost:5000/api
```

### Step 3: Start Frontend

```bash
npm run dev
```

The app will start at: http://localhost:3000

## Part 4: First Login

1. Open browser to http://localhost:3000
2. You should see the login screen
3. Use demo credentials:
   - **Email**: demo@plumbpro.com
   - **Password**: demo123
4. Click "Sign In"

After login, the app will:
- Fetch all data from the backend
- Store it locally in IndexedDB for offline access
- Display the dashboard with your inventory

## Verification Checklist

Test that everything works:

- [ ] PostgreSQL is running
- [ ] Database `plumbpro_inventory` exists
- [ ] Backend server is running on port 5000
- [ ] Health check returns `{"status":"ok"}`
- [ ] Frontend is running on port 3000
- [ ] Can log in with demo credentials
- [ ] Dashboard shows inventory data
- [ ] Can view inventory items
- [ ] Can view jobs
- [ ] Can view contacts

## Troubleshooting

### Problem: "Database connection failed"

**Solution**:
1. Check PostgreSQL is running: `pg_isready`
2. Verify credentials in `server/.env`
3. Test connection: `psql -U postgres -d plumbpro_inventory`

### Problem: "Port 5000 already in use"

**Solution**:
1. Find process: `lsof -i :5000` (macOS/Linux) or `netstat -ano | findstr :5000` (Windows)
2. Kill process or change port in `server/.env`

### Problem: "CORS error in browser"

**Solution**:
1. Ensure backend is running
2. Check `CORS_ORIGIN` in `server/.env` matches frontend URL
3. Restart backend server

### Problem: "Invalid credentials" when logging in

**Solution**:
1. Ensure seed script ran successfully
2. Check backend logs for errors
3. Try resetting database:
   ```bash
   cd server
   npm run migrate  # Recreates tables
   npm run seed     # Recreates demo user
   ```

### Problem: Frontend shows "Network Error"

**Solution**:
1. Check backend is running on port 5000
2. Check `VITE_API_URL` in `.env` is correct
3. Test backend: `curl http://localhost:5000/health`
4. Check browser console for specific error

### Problem: "Cannot find module" errors

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Do the same in server/
cd server
rm -rf node_modules package-lock.json
npm install
```

## Features Now Available

With the backend integrated, you now have:

### ✅ **User Authentication**
- Secure JWT-based login
- Multi-user support
- Role-based permissions

### ✅ **Data Persistence**
- All data saved to PostgreSQL
- Survives page refresh
- Multi-device access

### ✅ **Offline Support**
- Data cached in browser (IndexedDB)
- Works without internet (after first sync)
- Auto-sync when back online

### ✅ **Auto-save**
- All changes immediately saved to database
- No manual save button needed
- Instant sync across tabs

### ✅ **Secure AI Integration**
- API key stored securely on backend
- No exposure in browser
- Server-side processing

### ✅ **Complete Audit Trail**
- All stock movements logged
- User actions tracked
- Timestamps on all changes

### ✅ **Multi-tenancy**
- Each user sees only their data
- Data isolation between companies
- Scalable architecture

## Next Steps

Now that your system is running:

1. **Create your own account** (instead of using demo)
2. **Add your inventory items**
3. **Set up your suppliers and workers**
4. **Create job templates** for common tasks
5. **Schedule jobs** and allocate materials
6. **Try the AI smart ordering** feature

## Production Deployment

For production deployment, see the separate deployment guide:
- Set `NODE_ENV=production`
- Use a managed PostgreSQL service (AWS RDS, Heroku Postgres, etc.)
- Deploy backend to a server (Heroku, Railway, DigitalOcean)
- Deploy frontend to Vercel, Netlify, or similar
- Set up SSL/HTTPS
- Use environment-specific API URLs

## Getting Help

If you encounter issues:

1. Check the logs:
   - Backend logs in the terminal where you ran `npm run dev`
   - Frontend logs in browser DevTools Console
   - Database logs: `tail -f /usr/local/var/log/postgresql@14.log` (macOS)

2. Common log locations:
   - Backend: Terminal output
   - Frontend: Browser Console (F12)
   - PostgreSQL: System logs

3. Review the API documentation in `server/README.md`

4. Check the database directly:
   ```bash
   psql -U postgres -d plumbpro_inventory
   SELECT * FROM users;
   SELECT * FROM inventory_items LIMIT 5;
   ```

## Support

For issues and questions:
- Review this setup guide
- Check `server/README.md` for API documentation
- Review error messages in logs
- Check database connectivity

---

**Congratulations!** Your PlumbPro Inventory system is now running with full backend integration, authentication, and offline support.
