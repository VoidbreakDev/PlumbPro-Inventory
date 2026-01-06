#!/bin/bash

echo "🛑 Stopping PlumbPro servers..."

# Kill processes on port 3000 (frontend)
echo "Stopping frontend (port 3000)..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ Frontend stopped"
else
  echo "⚠️  No frontend process found on port 3000"
fi

# Kill processes on port 5001 (backend)
echo "Stopping backend (port 5001)..."
lsof -ti:5001 | xargs kill -9 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ Backend stopped"
else
  echo "⚠️  No backend process found on port 5001"
fi

echo "✅ All servers stopped"
