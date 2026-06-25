#!/bin/sh
# start.sh - Launch both backend service and frontend UI

# Start the Express API in the background on port 4000
echo "Starting backend service on port 4000..."
PORT=4000 pnpm --filter @itr/service start &
BACKEND_PID=$!

# Start the Next.js UI in the foreground on the port provided by Render (default 3000)
# Render exposes the $PORT variable, which Next.js will pick up automatically.
echo "Starting UI service on port ${PORT:-3000}..."
pnpm --filter @itr/ui start &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID
wait $FRONTEND_PID
