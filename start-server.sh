#!/bin/bash

# Start server script - runs in background and survives terminal close
echo "🚀 Starting Voice AI Workshop Server..."

# Kill any existing server
pkill -f "node.*server.js" 2>/dev/null || true

# Start server with nohup
cd "$(dirname "$0")"
nohup npm start > server.log 2>&1 &

echo "✅ Server starting in background (PID: $!)"
echo "📝 Logs: $(pwd)/server.log"
echo ""
echo "To view logs: tail -f server.log"
echo "To stop server: pkill -f 'node.*server.js'"
