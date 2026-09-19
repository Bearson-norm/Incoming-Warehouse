#!/bin/bash

# Script Bash untuk Setup Gateway
# Usage: ./scripts/setup-gateway.sh

echo "========================================"
echo "  Gateway Setup Helper"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Script harus dijalankan dari direktori Gateway/app"
    echo "   Jalankan: cd Gateway/app"
    exit 1
fi

# Step 1: Install dependencies
echo "📦 Step 1: Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Error: npm install failed"
        exit 1
    fi
else
    echo "   ✅ Dependencies sudah terinstall"
fi

# Step 2: Build project
echo ""
echo "🔨 Step 2: Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Error: Build failed"
    exit 1
fi
echo "   ✅ Build berhasil"

# Step 3: Detect serial ports
echo ""
echo "🔍 Step 3: Detecting serial ports..."
echo ""
npm run detect-ports
if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️  Warning: Tidak ada port serial yang ditemukan"
    echo "   Pastikan timbangan terhubung ke komputer"
fi

# Step 4: Check config file
echo ""
echo "⚙️  Step 4: Checking configuration..."
if [ ! -f "config.json" ]; then
    echo "   Creating config.json from example..."
    cp config.example.json config.json
    echo "   ✅ config.json created"
    echo ""
    echo "⚠️  IMPORTANT: Edit config.json dengan:"
    echo "   1. Port serial timbangan Anda (contoh: /dev/ttyUSB0, /dev/ttyACM0)"
    echo "   2. API key yang sama dengan GATEWAY_API_KEY di Dashboard/api/.env"
    echo ""
    echo "   Atau gunakan Web UI di http://localhost:4124 setelah menjalankan gateway"
else
    echo "   ✅ config.json sudah ada"
fi

# Step 5: Check API server
echo ""
echo "🌐 Step 5: Checking API server..."
if curl -s --connect-timeout 2 http://localhost:4123/api/health > /dev/null 2>&1; then
    echo "   ✅ API server berjalan di http://localhost:4123"
else
    echo "   ⚠️  API server tidak berjalan di http://localhost:4123"
    echo "   Pastikan API server berjalan sebelum menjalankan Gateway"
    echo "   Jalankan: cd Dashboard/api && npm run start:dev"
fi

# Summary
echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "📝 Next steps:"
echo "   1. Edit config.json dengan port serial dan API key yang benar"
echo "   2. Pastikan API server berjalan (cd Dashboard/api && npm run start:dev)"
echo "   3. Jalankan Gateway: npm run dev"
echo "   4. Atau gunakan Web UI di http://localhost:4124 untuk konfigurasi"
echo ""
