/**
 * BASIC PROGRAM: Print Label dengan ZPL
 * 
 * Program ini mengirim ZPL commands ke printer thermal untuk mencetak label.
 * Support 3 metode: Windows RAW, Network TCP/IP, dan COM Serial.
 * 
 * Cara menggunakan:
 * 1. Install dependencies: npm install
 * 2. Pilih metode print (Windows/Network/Serial)
 * 3. Edit konfigurasi sesuai printer Anda
 * 4. Jalankan: node print.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const net = require('net');
const SerialPort = require('serialport');

// ==========================================
// KONFIGURASI
// ==========================================
const CONFIG = {
  // Metode print: 'windows-raw', 'network-tcp', 'serial-com'
  method: 'windows-raw',
  
  // Windows RAW
  printerName: 'Xprinter XP-420B', // Nama printer di Windows
  
  // Network TCP/IP
  printerIP: '192.168.1.100',
  networkPort: 9100,
  
  // Serial COM
  comPort: 'COM3',
  baudRate: 9600,
  
  // Label settings
  labelWidth: 100,  // mm
  labelHeight: 72, // mm
  dpi: 203         // Dots per inch
};

// ==========================================
// KONVERSI MM KE DOTS
// ==========================================
function mmToDots(mm, dpi = CONFIG.dpi) {
  const dotsPerMM = dpi / 25.4;
  return Math.round(mm * dotsPerMM);
}

// ==========================================
// GENERATE ZPL COMMAND
// ==========================================
function generateZPL(data) {
  const widthDots = mmToDots(CONFIG.labelWidth);
  const heightDots = mmToDots(CONFIG.labelHeight);
  
  // Data untuk label
  const productName = data.productName || 'PRODUCT NAME';
  const weight = data.weight || '0.0';
  const barcode = data.barcode || '123456789';
  const qrCode = data.qrCode || 'https://example.com';
  
  // ZPL Command
  let zpl = '';
  
  // Start label
  zpl += '^XA'; // Start of label format
  zpl += `^LL${heightDots}`; // Label Length (height)
  zpl += `^PW${widthDots}`; // Print Width
  
  // Product Name (Text)
  zpl += '^FO20,20'; // Field Origin (X, Y)
  zpl += '^A0N,30,30'; // Font: A0, Normal, height 30, width 30
  zpl += `^FD${productName}^FS`; // Field Data + Field Separator
  
  // Weight (Text)
  zpl += '^FO20,60';
  zpl += '^A0N,25,25';
  zpl += `^FDWeight: ${weight}g^FS`;
  
  // Barcode Code 128
  zpl += '^FO20,100';
  zpl += '^BCN,50,Y,Y,N'; // Barcode Code 128, Normal, height 50, print text
  zpl += `^FD${barcode}^FS`;
  
  // QR Code
  zpl += '^FO20,180';
  zpl += '^BQN,2,5'; // QR Code, Normal, model 2, size 5
  zpl += `^FD${qrCode}^FS`;
  
  // Box/Border
  zpl += '^FO10,10'; // Start position
  zpl += `^GB${widthDots - 20},${heightDots - 20},2,B,0^FS`; // Box: width, height, line thickness, black
  
  // End label
  zpl += '^XZ'; // End of label format
  
  return zpl;
}

// ==========================================
// METODE 1: WINDOWS RAW PRINTING
// ==========================================
function printWindowsRAW(zpl, callback) {
  console.log('🖨️  Method: Windows RAW Printing');
  console.log(`   Printer: ${CONFIG.printerName}`);
  
  // Create temp file
  const tempFile = path.join(os.tmpdir(), `zpl_${Date.now()}.prn`);
  fs.writeFileSync(tempFile, zpl, 'utf8');
  
  // PowerShell script untuk Windows Print API
  const psScript = `
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.ComponentModel;

public class RawPrinter {
  [DllImport("winspool.drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    
  [DllImport("winspool.drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    
  [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    
  [DllImport("winspool.drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    
  [DllImport("winspool.drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    
  [DllImport("winspool.drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    
  [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
}

[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
public class DOCINFOA {
  [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
  [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
  [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
}
"@

$printerName = "${CONFIG.printerName}"
$filePath = "${tempFile.replace(/\\/g, '\\\\')}"

$hPrinter = [IntPtr]::Zero
$di = New-Object DOCINFOA
$di.pDocName = "ZPL Label"
$di.pDataType = "RAW"

if ([RawPrinter]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero)) {
  try {
    if ([RawPrinter]::StartDocPrinter($hPrinter, 1, $di)) {
      if ([RawPrinter]::StartPagePrinter($hPrinter)) {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $pBytes = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
        [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $pBytes, $bytes.Length)
        
        $dwWritten = 0
        $success = [RawPrinter]::WritePrinter($hPrinter, $pBytes, $bytes.Length, [ref]$dwWritten)
        
        [System.Runtime.InteropServices.Marshal]::FreeHGlobal($pBytes)
        [RawPrinter]::EndPagePrinter($hPrinter)
      }
      [RawPrinter]::EndDocPrinter($hPrinter)
    }
  } finally {
    [RawPrinter]::ClosePrinter($hPrinter)
  }
  Write-Output "SUCCESS"
} else {
  $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  Write-Output "ERROR: $errorCode"
}
  `;
  
  // Execute PowerShell
  exec(`powershell -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '`"')}"`, (error, stdout, stderr) => {
    // Cleanup temp file
    setTimeout(() => {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }, 1000);
    
    if (error) {
      callback(error);
      return;
    }
    
    if (stdout.includes('ERROR')) {
      callback(new Error(stdout));
      return;
    }
    
    callback(null, { success: true, method: 'windows-raw' });
  });
}

// ==========================================
// METODE 2: NETWORK TCP/IP
// ==========================================
function printNetworkTCP(zpl, callback) {
  console.log('🖨️  Method: Network TCP/IP');
  console.log(`   IP: ${CONFIG.printerIP}:${CONFIG.networkPort}`);
  
  const socket = new net.Socket();
  let connected = false;
  
  socket.setTimeout(5000);
  
  socket.on('connect', () => {
    connected = true;
    console.log('   ✅ Connected to printer');
    socket.write(zpl, 'utf8', () => {
      socket.end();
    });
  });
  
  socket.on('close', () => {
    if (connected) {
      callback(null, { success: true, method: 'network-tcp' });
    }
  });
  
  socket.on('error', (error) => {
    callback(error);
  });
  
  socket.on('timeout', () => {
    socket.destroy();
    callback(new Error('Connection timeout'));
  });
  
  socket.connect(CONFIG.networkPort, CONFIG.printerIP);
}

// ==========================================
// METODE 3: SERIAL COM PORT
// ==========================================
function printSerialCOM(zpl, callback) {
  console.log('🖨️  Method: Serial COM Port');
  console.log(`   Port: ${CONFIG.comPort} (${CONFIG.baudRate} baud)`);
  
  const port = new SerialPort({
    path: CONFIG.comPort,
    baudRate: CONFIG.baudRate,
    autoOpen: false
  });
  
  port.open((err) => {
    if (err) {
      callback(err);
      return;
    }
    
    port.write(zpl, 'utf8', (err) => {
      if (err) {
        port.close();
        callback(err);
        return;
      }
      
      port.drain(() => {
        port.close();
        callback(null, { success: true, method: 'serial-com' });
      });
    });
  });
}

// ==========================================
// MAIN FUNCTION
// ==========================================
function printLabel(data) {
  console.log('📝 Generating ZPL command...');
  const zpl = generateZPL(data);
  console.log(`   ZPL length: ${zpl.length} characters`);
  console.log('');
  
  // Pilih metode print
  const method = CONFIG.method;
  
  switch (method) {
    case 'windows-raw':
      if (os.platform() !== 'win32') {
        console.error('❌ Windows RAW printing hanya support di Windows');
        return;
      }
      printWindowsRAW(zpl, (err, result) => {
        if (err) {
          console.error('❌ Print error:', err.message);
        } else {
          console.log('✅ Print berhasil!');
        }
      });
      break;
      
    case 'network-tcp':
      printNetworkTCP(zpl, (err, result) => {
        if (err) {
          console.error('❌ Print error:', err.message);
        } else {
          console.log('✅ Print berhasil!');
        }
      });
      break;
      
    case 'serial-com':
      printSerialCOM(zpl, (err, result) => {
        if (err) {
          console.error('❌ Print error:', err.message);
        } else {
          console.log('✅ Print berhasil!');
        }
      });
      break;
      
    default:
      console.error(`❌ Method tidak dikenal: ${method}`);
  }
}

// ==========================================
// TEST PRINT
// ==========================================
if (require.main === module) {
  console.log('🖨️  ZPL Printer - Basic Program');
  console.log('================================\n');
  
  // Data contoh
  const testData = {
    productName: 'PRODUCT ABC',
    weight: '170.5',
    barcode: '123456789012',
    qrCode: 'https://example.com/product/123'
  };
  
  console.log('Test Data:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('');
  
  // Print
  printLabel(testData);
}

module.exports = { printLabel, generateZPL, mmToDots, CONFIG };
