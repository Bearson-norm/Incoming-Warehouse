# Basic Programs - IoT Scales

Folder ini berisi program-program dasar untuk:
1. **Koneksi Timbangan ke WebSocket** - Membaca data dari timbangan dan mengirim via WebSocket
2. **ZPL Printer** - Mencetak label thermal menggunakan ZPL commands

## 📁 Struktur Folder

```
basic-programs/
├── scale-websocket/     # Program koneksi timbangan ke WebSocket
│   ├── server.js        # Server WebSocket + Serial Port reader
│   ├── client-example.html  # Contoh client HTML/JavaScript
│   ├── package.json
│   └── README.md
│
└── zpl-printer/         # Program ZPL printer
    ├── print.js         # Main print function
    ├── example-usage.js # Contoh penggunaan
    ├── package.json
    └── README.md
```

## 🚀 Quick Start

### 1. Scale to WebSocket

```bash
cd scale-websocket
npm install
# Edit server.js: sesuaikan COM Port
npm start
```

Client connect ke: `ws://localhost:3001/ws/scale`

### 2. ZPL Printer

```bash
cd zpl-printer
npm install
# Edit print.js: sesuaikan konfigurasi printer
node print.js
```

## 📋 Fitur

### Scale to WebSocket
- ✅ Serial Port reading (COM Port)
- ✅ Real-time WebSocket broadcasting
- ✅ Multiple client support
- ✅ Auto-reconnect
- ✅ HTML client example

### ZPL Printer
- ✅ Windows RAW printing
- ✅ Network TCP/IP printing
- ✅ Serial COM printing
- ✅ ZPL command generation
- ✅ Customizable label layout

## 🔧 Requirements

### Scale to WebSocket
- Node.js
- Serial Port library
- WebSocket library
- Timbangan dengan Serial Port output

### ZPL Printer
- Node.js
- Windows OS (untuk Windows RAW method)
- ZPL-compatible thermal printer
- Network/Serial connection ke printer

## 📝 Catatan

Program-program ini adalah **basic/standalone** version yang bisa digunakan sebagai:
- Starting point untuk development
- Reference untuk memahami cara kerja
- Testing tool untuk hardware
- Learning material

Untuk versi lengkap dengan fitur lengkap, lihat file utama di root project:
- `server.js` - Full server dengan database, API, dll
- `printer_command_nodejs/` - Full ZPL printer implementation

## 🐛 Troubleshooting

Lihat README.md di masing-masing folder untuk troubleshooting spesifik.

## 📚 Dokumentasi

- `PROMPT_PENJELASAN_SISTEM.md` - Dokumentasi lengkap sistem
- `docs/WEIGHT_DISPLAY_FLOW.md` - Alur data timbangan
- `printer_command_nodejs/PROMPT_PRINCIPLES.md` - Prinsip ZPL printing
