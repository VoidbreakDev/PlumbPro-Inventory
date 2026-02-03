#!/usr/bin/env bash

# Stop PlumbPro Inventory servers
# This script works with both bash and zsh

# Get the directory where this script is located (works in both bash and zsh)
if [ -n "$BASH_SOURCE" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$BASH_SOURCE")" && pwd)"
elif [ -n "$ZSH_VERSION" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
else
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

cd "$SCRIPT_DIR"

echo "🛑 Stopping PlumbPro servers..."
echo ""

# Function to kill processes on a port
kill_port() {
    local port=$1
    local name=$2
    
    echo "Stopping $name (port $port)..."
    
    if lsof -Pi ":$port" -sTCP:LISTEN -t &> /dev/null; then
        local pids=$(lsof -ti:$port)
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -9 2>/dev/null
            echo "✅ $name stopped"
        else
            echo "⚠️  Could not find PID for $name"
        fi
    else
        echo "ℹ️  No $name process found on port $port"
    fi
}

# Kill by port
kill_port 5173 "Frontend"
kill_port 5001 "Backend"

# Also kill by process pattern as fallback
echo ""
echo "🧹 Cleaning up any remaining Node processes..."
pkill -f "node.*server.js" 2>/dev/null && echo "   Cleaned up server.js processes" || true
pkill -f "vite" 2>/dev/null && echo "   Cleaned up vite processes" || true
pkill -f "nodemon" 2>/dev/null && echo "   Cleaned up nodemon processes" || true

echo ""
echo "✅ All servers stopped"

# Verify ports are free
echo ""
echo "Verifying ports are free..."
if lsof -Pi :5173 -sTCP:LISTEN -t &> /dev/null; then
    echo "⚠️  Warning: Port 5173 is still in use"
else
    echo "✅ Port 5173 is free"
fi

if lsof -Pi :5001 -sTCP:LISTEN -t &> /dev/null; then
    echo "⚠️  Warning: Port 5001 is still in use"
else
    echo "✅ Port 5001 is free"
fi
