#!/usr/bin/env node

/**
 * Script untuk mendeteksi port serial yang tersedia
 * Usage: node scripts/detect-ports.js
 */

import { SerialPort } from 'serialport';

async function detectPorts() {
  try {
    console.log('🔍 Mencari port serial yang tersedia...\n');
    
    const ports = await SerialPort.list();
    
    if (ports.length === 0) {
      console.log('⚠️  Tidak ada port serial yang ditemukan.');
      console.log('   Pastikan timbangan terhubung ke komputer via USB/Serial.\n');
      process.exit(1);
    }
    
    console.log(`✅ Ditemukan ${ports.length} port serial:\n`);
    
    ports.forEach((port, index) => {
      console.log(`${index + 1}. ${port.path}`);
      if (port.manufacturer) {
        console.log(`   Manufacturer: ${port.manufacturer}`);
      }
      if (port.vendorId) {
        console.log(`   Vendor ID: ${port.vendorId}`);
      }
      if (port.productId) {
        console.log(`   Product ID: ${port.productId}`);
      }
      console.log('');
    });
    
    console.log('💡 Tips:');
    console.log('   - Gunakan port yang sesuai dengan timbangan Anda');
    console.log('   - Copy nama port (contoh: COM3, COM9) ke config.json');
    console.log('   - Atau set "autoDetect": true di config.json untuk auto-detect\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

detectPorts();
