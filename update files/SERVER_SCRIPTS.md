# Server Management Scripts

Quick scripts to manage PlumbPro Inventory development servers.

## 🚀 Start Servers

```bash
./start-servers.sh
```

This will:
- Start the backend server on port 5001
- Start the frontend server on port 3000
- Run both in the background
- Create log files (`backend.log` and `frontend.log`)

**Access the app:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001/api

## 🛑 Stop Servers

```bash
./stop-servers.sh
```

This will:
- Stop the frontend server (port 3000)
- Stop the backend server (port 5001)
- Kill all processes on those ports

## 📋 View Logs

**Backend logs:**
```bash
tail -f backend.log
```

**Frontend logs:**
```bash
tail -f frontend.log
```

**Both logs at once:**
```bash
tail -f backend.log frontend.log
```

## 🔄 Restart Servers

```bash
./stop-servers.sh && ./start-servers.sh
```

## ⚠️ Troubleshooting

**Servers won't start:**
- Check if ports 3000 or 5001 are already in use
- Run `./stop-servers.sh` first to clear any stuck processes
- Check the log files for errors

**Port already in use:**
```bash
# Check what's using the port
lsof -i :3000
lsof -i :5001

# Kill specific process
kill -9 <PID>
```

**Fresh start:**
```bash
# Stop servers, clear logs, and restart
./stop-servers.sh
rm -f backend.log frontend.log
./start-servers.sh
```
