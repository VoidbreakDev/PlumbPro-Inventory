#!/usr/bin/env bash

# Start PlumbPro Inventory servers
# This script works with both bash and zsh

set -e  # Exit on error

# Get the directory where this script is located (works in both bash and zsh)
if [ -n "$BASH_SOURCE" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$BASH_SOURCE")" && pwd)"
elif [ -n "$ZSH_VERSION" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
else
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

# Change to project root
cd "$SCRIPT_DIR"

echo "🚀 Starting PlumbPro servers..."
echo "📁 Project directory: $SCRIPT_DIR"
echo ""

# Check if required commands exist
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm not found. Please install Node.js."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Error: node not found. Please install Node.js."
    exit 1
fi

# Check if server directory exists
if [ ! -d "server" ]; then
    echo "❌ Error: 'server' directory not found in $SCRIPT_DIR"
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found in $SCRIPT_DIR"
    exit 1
fi

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi ":$port" -sTCP:LISTEN -t &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Stop any existing servers first
echo "🧹 Cleaning up any existing processes..."
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

# Check if ports are now free
if check_port 5001; then
    echo "⚠️  Warning: Port 5001 is still in use. Trying to free it..."
    lsof -ti:5001 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

if check_port 5173; then
    echo "⚠️  Warning: Port 5173 is still in use. Trying to free it..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

echo ""
echo "🔧 Starting backend server..."
cd server
PORT=5001 \
DB_NAME=plumbpro \
DB_PASSWORD=5D39gvUSxZAMGusmELAL \
JWT_SECRET=plumbpro_secret_key_2026 \
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo "   Backend PID: $BACKEND_PID"
echo "   Waiting for backend to be ready..."

# Wait for backend to actually start (up to 30 seconds)
for i in {1..30}; do
    if check_port 5001; then
        echo "✅ Backend is ready on port 5001"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo "❌ Backend failed to start within 30 seconds"
        echo "   Check backend.log for errors: tail -f backend.log"
        exit 1
    fi
done

echo ""
echo "🔧 Starting frontend server..."
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
echo "   Waiting for frontend to be ready..."

# Wait for frontend to actually start (up to 30 seconds)
for i in {1..30}; do
    if check_port 5173; then
        echo "✅ Frontend is ready on port 5173"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo "❌ Frontend failed to start within 30 seconds"
        echo "   Check frontend.log for errors: tail -f frontend.log"
        exit 1
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 PlumbPro Inventory is running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 Frontend:  http://localhost:5173"
echo "🔌 Backend:   http://localhost:5001/api"
echo "❤️  Health:    http://localhost:5001/health"
echo ""
echo "View logs:"
echo "  Backend:  tail -f backend.log"
echo "  Frontend: tail -f frontend.log"
echo ""
echo "Stop servers: ./stop-servers.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
