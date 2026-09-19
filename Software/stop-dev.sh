#!/bin/bash

# Script untuk menghentikan semua services

echo "Stopping Incoming Warehouse services..."

# Kill processes by PID files
if [ -f /tmp/incoming-warehouse-api.pid ]; then
    API_PID=$(cat /tmp/incoming-warehouse-api.pid)
    if kill -0 $API_PID 2>/dev/null; then
        kill $API_PID
        echo "✅ Stopped API Server (PID: $API_PID)"
    fi
    rm /tmp/incoming-warehouse-api.pid
fi

if [ -f /tmp/incoming-warehouse-web.pid ]; then
    WEB_PID=$(cat /tmp/incoming-warehouse-web.pid)
    if kill -0 $WEB_PID 2>/dev/null; then
        kill $WEB_PID
        echo "✅ Stopped Web UI (PID: $WEB_PID)"
    fi
    rm /tmp/incoming-warehouse-web.pid
fi

if [ -f /tmp/incoming-warehouse-gateway.pid ]; then
    GATEWAY_PID=$(cat /tmp/incoming-warehouse-gateway.pid)
    if kill -0 $GATEWAY_PID 2>/dev/null; then
        kill $GATEWAY_PID
        echo "✅ Stopped Gateway (PID: $GATEWAY_PID)"
    fi
    rm /tmp/incoming-warehouse-gateway.pid
fi

# Also kill any remaining npm processes
pkill -f "npm run start:dev" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null

echo "Done!"
