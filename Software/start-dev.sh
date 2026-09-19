#!/bin/bash

# Quick Start Script untuk Development
# Menjalankan API, Web UI, dan Gateway secara bersamaan

# Colors
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo ""
echo "========================================"
echo -e "${CYAN}  Incoming Warehouse System${NC}"
echo -e "${CYAN}  Starting All Services...${NC}"
echo "========================================"
echo ""

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0
    else
        return 1
    fi
}

# Check if API port is available
if check_port 4123; then
    echo -e "${YELLOW}⚠️  Port 4123 already in use. API might already be running.${NC}"
fi

# Start API Server
echo -e "${YELLOW}🚀 Starting API Server...${NC}"
cd "$SCRIPT_DIR/Dashboard/api" || exit 1
npm run start:dev > /dev/null 2>&1 &
API_PID=$!
echo "   API Server PID: $API_PID"

# Wait for API server to be ready
echo -e "${GRAY}⏳ Waiting for API server to be ready...${NC}"
MAX_ATTEMPTS=30
ATTEMPT=0
API_READY=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ] && [ "$API_READY" = false ]; do
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
    if curl -s --connect-timeout 2 http://localhost:4123/api/health > /dev/null 2>&1; then
        API_READY=true
        echo -e "${GREEN}✅ API Server is ready!${NC}"
    else
        echo "   Attempt $ATTEMPT/$MAX_ATTEMPTS - API not ready yet..."
    fi
done

if [ "$API_READY" = false ]; then
    echo -e "${YELLOW}⚠️  API server might not be ready yet, but continuing...${NC}"
fi

# Start Web UI
echo -e "${YELLOW}🌐 Starting Web UI...${NC}"
cd "$SCRIPT_DIR/Dashboard/web" || exit 1
npm run dev > /dev/null 2>&1 &
WEB_PID=$!
echo "   Web UI PID: $WEB_PID"

# Wait a bit
sleep 2

# Ask about Gateway
START_GATEWAY=false
if [ "$1" != "--no-gateway" ]; then
    echo ""
    read -p "Apakah Anda ingin menjalankan Gateway untuk timbangan? (Y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        START_GATEWAY=true
        
        # Check if Gateway is configured
        if [ ! -f "$SCRIPT_DIR/Gateway/app/config.json" ]; then
            echo ""
            echo -e "${YELLOW}⚠️  Gateway belum dikonfigurasi!${NC}"
            echo "   Jalankan: cd Gateway/app && ./scripts/setup-gateway.sh"
            echo "   Atau konfigurasi via Web UI di http://localhost:4124 setelah Gateway berjalan"
            echo ""
        fi
        
        echo -e "${YELLOW}⚖️  Starting Gateway...${NC}"
        cd "$SCRIPT_DIR/Gateway/app" || exit 1
        npm run dev > /dev/null 2>&1 &
        GATEWAY_PID=$!
        echo "   Gateway PID: $GATEWAY_PID"
    fi
fi

echo ""
echo "========================================"
echo -e "${GREEN}  System is Starting...${NC}"
echo "========================================"
echo ""
echo -e "${CYAN}📍 Services:${NC}"
echo -e "${WHITE}   API Server:  http://localhost:4123${NC}"
echo -e "${WHITE}   Web UI:      http://localhost:4234${NC}"
if [ "$START_GATEWAY" = true ]; then
    echo -e "${WHITE}   Gateway:     http://localhost:4124 (Config UI)${NC}"
fi
echo ""
echo -e "${YELLOW}🔐 Login Credentials:${NC}"
echo -e "${WHITE}   Username: admin${NC}"
echo -e "${WHITE}   Password: admin123${NC}"
echo ""
if [ "$START_GATEWAY" = true ]; then
    echo -e "${YELLOW}💡 Gateway Tips:${NC}"
    echo -e "${WHITE}   - Konfigurasi Gateway: http://localhost:4124${NC}"
    echo -e "${WHITE}   - Pastikan timbangan terhubung sebelum menggunakan Gateway${NC}"
fi
echo "========================================"
echo ""
echo -e "${GRAY}Services are running in background.${NC}"
echo -e "${GRAY}To stop services, run: pkill -f 'npm run'${NC}"
echo ""

# Save PIDs to file for easy stopping
echo "$API_PID" > /tmp/incoming-warehouse-api.pid
echo "$WEB_PID" > /tmp/incoming-warehouse-web.pid
if [ "$START_GATEWAY" = true ]; then
    echo "$GATEWAY_PID" > /tmp/incoming-warehouse-gateway.pid
fi

echo -e "${GRAY}PIDs saved to /tmp/incoming-warehouse-*.pid${NC}"
echo ""
