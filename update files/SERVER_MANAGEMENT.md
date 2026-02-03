# PlumbPro Inventory - Server Management

## Quick Start

### Start Both Servers
```bash
./start-servers.sh
```

This will start:
- **Frontend**: http://localhost:5173 (Vite React app)
- **Backend**: http://localhost:5001/api (Express API)

### Stop Both Servers
```bash
./stop-servers.sh
```

---

## Server Details

### Frontend Server
- **URL**: http://localhost:5173
- **Network**: http://192.168.1.115:5173 (accessible from mobile devices)
- **Framework**: React + Vite
- **Hot Reload**: Enabled
- **Log File**: `frontend.log`

### Backend Server
- **URL**: http://localhost:5001
- **API Base**: http://localhost:5001/api
- **Health Check**: http://localhost:5001/health
- **Framework**: Node.js + Express
- **Database**: PostgreSQL (`plumbpro`)
- **Log File**: `backend.log`

---

## Environment Variables

The backend requires these environment variables (automatically set by `start-servers.sh`):

| Variable | Value | Purpose |
|----------|-------|---------|
| `PORT` | `5001` | Backend server port |
| `DB_NAME` | `plumbpro` | PostgreSQL database name |
| `DB_PASSWORD` | `5D39gvUSxZAMGusmELAL` | Database password |
| `JWT_SECRET` | `plumbpro_secret_key_2026` | JWT token signing secret |

---

## Manual Server Management

### Start Frontend Only
```bash
npm run dev
```

### Start Backend Only
```bash
cd server
PORT=5001 DB_NAME=plumbpro DB_PASSWORD=5D39gvUSxZAMGusmELAL JWT_SECRET=plumbpro_secret_key_2026 npm run dev
```

### Check Running Servers
```bash
# Check frontend
curl http://localhost:5173

# Check backend health
curl http://localhost:5001/health
```

### View Logs
```bash
# Backend logs (real-time)
tail -f backend.log

# Frontend logs (real-time)
tail -f frontend.log

# View last 50 lines
tail -50 backend.log
tail -50 frontend.log
```

---

## Troubleshooting

### Port Already in Use

If you get "port already in use" errors:

```bash
# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9

# Kill process on port 5001 (backend)
lsof -ti:5001 | xargs kill -9
```

Or simply run:
```bash
./stop-servers.sh
```

### Backend Not Connecting to Database

1. Verify PostgreSQL is running:
```bash
pg_isready -h localhost -p 5432
```

2. Check database exists:
```bash
PGPASSWORD=5D39gvUSxZAMGusmELAL psql -U postgres -h localhost -l | grep plumbpro
```

3. Test database connection:
```bash
PGPASSWORD=5D39gvUSxZAMGusmELAL psql -U postgres -h localhost -d plumbpro -c "SELECT version();"
```

### Frontend Not Loading

1. Clear Vite cache:
```bash
rm -rf node_modules/.vite
```

2. Reinstall dependencies:
```bash
npm install
```

### View Errors

```bash
# Check for backend errors
grep -i "error" backend.log | tail -20

# Check for frontend errors
grep -i "error" frontend.log | tail -20
```

---

## Development Workflow

### Standard Development
1. Run `./start-servers.sh`
2. Open http://localhost:5173 in your browser
3. Make code changes (hot reload will update automatically)
4. View logs with `tail -f backend.log` or `tail -f frontend.log`
5. Stop with `./stop-servers.sh` when done

### After Code Changes
- **Frontend**: Changes auto-reload via Vite HMR
- **Backend**: Restart backend server:
  ```bash
  lsof -ti:5001 | xargs kill -9
  cd server && PORT=5001 DB_NAME=plumbpro DB_PASSWORD=5D39gvUSxZAMGusmELAL JWT_SECRET=plumbpro_secret_key_2026 npm run dev > ../backend.log 2>&1 &
  ```

### Mobile Testing
Access from mobile device on same network:
```
http://192.168.1.115:5173
```

---

## Port Reference

| Service | Port | Protocol |
|---------|------|----------|
| Frontend Dev Server | 5173 | HTTP |
| Backend API Server | 5001 | HTTP |
| PostgreSQL Database | 5432 | PostgreSQL |

---

## Script Details

### start-servers.sh
- Starts backend with all required environment variables
- Waits 2 seconds for backend initialization
- Starts frontend
- Displays URLs and log file locations
- Runs servers in background

### stop-servers.sh
- Kills processes on port 3000 (frontend)
- Kills processes on port 5001 (backend)
- Shows status messages
- Safe to run multiple times

---

## Logs Location

- **Backend**: `backend.log` (in project root)
- **Frontend**: `frontend.log` (in project root)

Both logs are created by the start script and contain all stdout/stderr output.

---

## API Endpoints

Once the backend is running, you can test the new supplier management APIs:

### Authentication
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@plumbpro.com","password":"demo123"}'
```

### Supplier Analytics (requires auth token)
```bash
# Get top performers
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/api/supplier-analytics/top-performers

# Get price alerts
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/api/price-alerts/summary
```

See the full API documentation in the project README for all 28+ endpoints.
