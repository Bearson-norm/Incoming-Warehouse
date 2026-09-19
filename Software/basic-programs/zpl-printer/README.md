# Basic Program: ZPL Printer

Program dasar untuk mencetak label thermal menggunakan ZPL (Zebra Programming Language) commands.

## 📋 Fitur

- ✅ Generate ZPL commands dari data JavaScript
- ✅ Support 3 metode print:
  - Windows RAW Printing (Win32 API)
  - Network TCP/IP (Port 9100)
  - Serial COM Port (USB)
- ✅ Konversi otomatis: Millimeter → Dots (pixels)
- ✅ Support: Text, Barcode Code 128, QR Code, Box/Border
- ✅ Customizable label size dan DPI

## 🚀 Instalasi

```bash
cd basic-programs/zpl-printer
npm install
```

## ⚙️ Konfigurasi

Edit file `print.js` dan sesuaikan konfigurasi:

```javascript
const CONFIG = {
  method: 'windows-raw', // 'windows-raw', 'network-tcp', 'serial-com'
  
  // Windows RAW
  printerName: 'Xprinter XP-420B',
  
  // Network TCP/IP
  printerIP: '192.168.1.100',
  networkPort: 9100,
  
  // Serial COM
  comPort: 'COM3',
  baudRate: 9600,
  
  // Label settings
  labelWidth: 100,  // mm
  labelHeight: 72,  // mm
  dpi: 203          // Dots per inch
};
```

## ▶️ Menjalankan

### Test Print

```bash
node print.js
```

### Contoh Penggunaan

```bash
node example-usage.js
```

## 📝 Cara Menggunakan

### 1. Import Module

```javascript
const { printLabel, generateZPL } = require('./print');
```

### 2. Print Label

```javascript
const data = {
  productName: 'PRODUCT ABC',
  weight: '170.5',
  barcode: '123456789012',
  qrCode: 'https://example.com/product/123'
};

printLabel(data);
```

### 3. Generate ZPL tanpa Print

```javascript
const zpl = generateZPL(data);
console.log(zpl); // Output ZPL command string
```

## 🖨️ Metode Print

### Windows RAW Printing

**Requirements:**
- Windows OS
- Printer sudah terinstall di Windows
- Nama printer harus sesuai

**Cara kerja:**
- Menggunakan Win32 API via PowerShell
- Data dikirim sebagai RAW (tidak diformat)
- Langsung ke printer tanpa driver formatting

### Network TCP/IP

**Requirements:**
- Printer terhubung ke jaringan
- IP address printer diketahui
- Port 9100 terbuka (standard ZPL port)

**Cara kerja:**
- TCP socket connection ke `printerIP:9100`
- ZPL string dikirim sebagai UTF-8 text
- Langsung ke printer tanpa driver

### Serial COM Port

**Requirements:**
- Printer terhubung via USB (terdeteksi sebagai COM Port)
- COM Port dan baud rate diketahui

**Cara kerja:**
- Serial Port connection
- ZPL string dikirim sebagai serial data
- Baud rate biasanya 9600

## 📐 ZPL Commands

Program menggunakan ZPL commands berikut:

| Command | Fungsi | Contoh |
|---------|--------|--------|
| `^XA` | Start of label | `^XA` |
| `^XZ` | End of label | `^XZ` |
| `^LL` | Label Length (height) | `^LL575` |
| `^PW` | Print Width | `^PW799` |
| `^FO` | Field Origin (X, Y) | `^FO20,20` |
| `^FD` | Field Data (content) | `^FDProduct Name^FS` |
| `^FS` | Field Separator | `^FS` |
| `^A0` | Font specification | `^A0N,30,30` |
| `^BC` | Barcode Code 128 | `^BCN,50,Y,Y,N` |
| `^BQ` | QR Code | `^BQN,2,5` |
| `^GB` | Graphic Box | `^GB780,555,2,B,0^FS` |

## 🔧 Customisasi

### Custom Label Size

Edit `CONFIG` di `print.js`:

```javascript
labelWidth: 100,  // mm
labelHeight: 72,  // mm
dpi: 203          // DPI printer
```

### Custom ZPL Layout

Edit fungsi `generateZPL()` di `print.js` untuk mengubah layout label.

### Custom Parsing

Jika perlu custom parsing data, edit fungsi `generateZPL()`.

## 📝 Format Data

Input data untuk `printLabel()`:

```javascript
{
  productName: string,  // Nama produk
  weight: string,       // Berat (dalam gram)
  barcode: string,     // Barcode (Code 128)
  qrCode: string        // QR Code content
}
```

## 🐛 Troubleshooting

**Windows RAW: Printer tidak print**
- Pastikan nama printer sudah benar
- Cek printer sudah terinstall di Windows
- Cek printer status (online/offline)
- Coba print test page dari Windows

**Network TCP: Connection timeout**
- Cek IP address printer sudah benar
- Cek printer terhubung ke jaringan
- Cek port 9100 tidak diblokir firewall
- Ping IP printer untuk test koneksi

**Serial COM: Port tidak terbuka**
- Pastikan COM Port sudah benar
- Pastikan printer sudah terhubung
- Cek tidak ada program lain yang menggunakan port
- Cek baud rate sesuai setting printer

**Label tidak sesuai ukuran**
- Cek konfigurasi labelWidth, labelHeight, dan DPI
- Pastikan setting di printer sesuai
- Cek konversi mm ke dots sudah benar

## 📚 Referensi

- [ZPL Programming Guide](https://www.zebra.com/us/en/support-downloads/knowledge-articles/attachments/knowledgearticles/AN/How-to-Identify-ZPL-Commands.html)
- [ZPL Command Reference](https://www.zebra.com/us/en/support-downloads/knowledge-articles/attachments/knowledgearticles/AN/ZPL-Programming-Guide.html)

## 💡 Tips

1. **Test dengan generate ZPL dulu** sebelum print untuk melihat command yang dihasilkan
2. **Gunakan Network TCP** jika printer support, lebih reliable
3. **Windows RAW** paling mudah jika printer sudah terinstall
4. **Serial COM** berguna untuk printer USB yang tidak terdeteksi sebagai network printer
5. **Customize layout** sesuai kebutuhan dengan edit `generateZPL()`
