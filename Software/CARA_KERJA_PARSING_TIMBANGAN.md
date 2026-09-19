# Cara Kerja Parsing Timbangan

Dokumen ini menjelaskan secara detail bagaimana sistem parsing timbangan bekerja untuk menghasilkan angka yang akurat sesuai dengan display pada instrumen penimbangan.

## Daftar Isi

1. [Overview](#overview)
2. [Arsitektur Parsing](#arsitektur-parsing)
3. [Parsing Timbangan AND EK-15KL](#parsing-timbangan-and-ek-15kl)
4. [Parsing Timbangan Vibra](#parsing-timbangan-vibra)
5. [Validasi dan Error Handling](#validasi-dan-error-handling)
6. [Konversi Unit](#konversi-unit)
7. [Contoh Alur Kerja](#contoh-alur-kerja)

---

## Overview

Sistem parsing timbangan dirancang untuk:
- **Membaca data mentah** dari port serial timbangan
- **Membersihkan data** dari karakter yang tidak valid
- **Mengekstrak nilai berat** dengan akurat
- **Mengkonversi ke gram** untuk konsistensi
- **Mengembalikan hasil** yang sesuai dengan display instrumen

### Model Timbangan yang Didukung

1. **AND EK-15KL** - Format: `ST,+000140.7  g` atau `US,+000140.7  g`
2. **Vibra** - Format: `+000140.7  G  S` atau `-000017.0  K  I`
3. **Generic** - Format fleksibel dengan auto-detection

---

## Arsitektur Parsing

### Entry Point: `parseWeightSmart()`

Fungsi utama yang menentukan parser mana yang akan digunakan berdasarkan:
- Konfigurasi model timbangan (`scaleConfig.model`)
- Format data yang diterima (auto-detection)
- Prefix yang terdeteksi (`ST,` atau `US,` untuk AND)

```javascript
function parseWeightSmart(raw) {
  // 1. Cek model timbangan dari konfigurasi
  // 2. Coba parser sesuai model
  // 3. Auto-detect format jika model tidak cocok
  // 4. Fallback ke parser alternatif
}
```

### Flow Diagram

```
Raw Data dari Serial Port
    ↓
parseWeightSmart(raw)
    ↓
    ├─→ Model = 'and-ek15kl'? → parseAndEk15kl()
    ├─→ Model = 'vibra'? → VIBRA_REGEX
    ├─→ Contains 'ST,' or 'US,'? → parseAndEk15kl()
    └─→ Fallback → DECIMAL_REGEX
    ↓
Return { weight: grams, unit: 'g', ... }
```

---

## Parsing Timbangan AND EK-15KL

### Format Data

**Format Lengkap (5 bagian):**
```
ST,-000000.8  g,11:06:00,03/12/2025,36
│  │          │ │        │          │
│  │          │ │        │          └─ Additional value
│  │          │ │        └─ Tanggal (DD/MM/YYYY)
│  │          │ └─ Waktu (HH:MM:SS)
│  │          └─ Unit (g/kg/lb/oz)
│  └─ Nilai berat dengan leading zeros
└─ Status (ST = Stable, US = Unstable)
```

**Format Sederhana (2 bagian):**
```
ST,+000140.7  g
│  │          │
│  │          └─ Unit
│  └─ Nilai berat
└─ Status
```

### Langkah-langkah Parsing

#### 1. Pembersihan Data (Data Cleaning)

```javascript
// Hapus karakter newline
cleaned = raw.replace(/[\r\n]/g, '').trim();

// Hapus karakter kontrol yang tidak valid
cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

// Hapus karakter '?' yang muncul karena encoding error
cleaned = cleaned.replace(/\?([A-Za-z0-9\s,\.\-\+])/g, '$1');
cleaned = cleaned.replace(/([A-Za-z0-9\s,\.\-\+])\?/g, '$1');
```

**Tujuan:** Menghilangkan karakter yang dapat mengganggu parsing, seperti:
- Karakter kontrol (null bytes, control characters)
- Encoding errors (karakter `?` yang muncul karena masalah encoding)
- Whitespace yang tidak perlu

#### 2. Split Berdasarkan Koma

```javascript
const parts = cleaned.split(',');

// Format lengkap: 5 bagian
if (parts.length >= 5) {
  status = parts[0].trim();        // "ST" atau "US"
  weightRaw = parts[1].trim();     // "+000140.7  g"
  time = parts[2].trim();          // "11:06:00"
  date = parts[3].trim();          // "03/12/2025"
  additionalValue = parts[4].trim(); // "36"
}

// Format sederhana: 2 bagian
else if (parts.length >= 2) {
  status = parts[0].trim();        // "ST" atau "US"
  weightRaw = parts[1].trim();     // "+000140.7  g"
}
```

**Mengapa Split Method?**
- Lebih reliable untuk format AND yang menggunakan koma sebagai delimiter
- Memisahkan bagian-bagian data dengan jelas
- Menghindari masalah dengan regex yang kompleks

#### 3. Validasi Kelengkapan Data

**Validasi 1: Data Tidak Lengkap (Ends with Decimal)**
```javascript
const endsWithDecimalOnly = /\.\s*$/.test(weightRaw.trim());

if (endsWithDecimalOnly) {
  // Reject: Data seperti "ST,+000442." tidak lengkap
  return null;
}
```

**Contoh Data yang Ditolak:**
- `ST,+000442.` ❌ (tidak ada unit atau digit desimal)
- `+000442. ` ❌ (hanya titik desimal di akhir)

**Contoh Data yang Diterima:**
- `ST,+000442.3  g` ✅
- `+000442  g` ✅ (tanpa desimal juga valid)

**Validasi 2: Data Tanpa Prefix (Truncated Data)**
```javascript
// Reject data tanpa prefix jika nilainya terlalu kecil (< 20g)
if (tempWeightValue < 20) {
  return null; // Kemungkinan besar data terpotong
}

// Reject jika nilai < 50g dan tidak memiliki leading zeros
if (tempWeightValue < 50 && !cleaned.match(/^[+\-]?0+\d/)) {
  return null; // Kemungkinan truncation
}
```

**Tujuan:** Mencegah data terpotong seperti `8.1  g` dari `ST,+000138.1  g` diterima.

#### 4. Ekstraksi Nilai Berat dengan Regex

**Pattern Regex:**
```javascript
const weightMatch = weightRaw.match(/([+\-]?)(0*\d+\.?\d*)\s*(kg|g|lb|oz)?/i);
```

**Penjelasan Pattern:**
- `([+\-]?)` - Capture tanda positif/negatif (opsional)
- `(0*\d+\.?\d*)` - Capture angka dengan leading zeros, titik desimal opsional
- `\s*` - Whitespace opsional
- `(kg|g|lb|oz)?` - Unit (opsional, default 'g')

**Contoh Parsing:**
```
Input: "+000140.7  g"
  → signStr: "+"
  → numStr: "000140.7"
  → fullNumStr: "+000140.7"
  → weightValue: 140.7
  → weightUnit: "G"
```

#### 5. Deteksi dan Perbaikan Parsing Error (Leading Zeros)

**Masalah:** Kadang angka dengan leading zeros seperti `000964.0` bisa terparsing sebagai `64` atau `964` tergantung regex.

**Solusi: Multi-Pattern Detection**

```javascript
// Deteksi jika angka yang terparsing terlalu pendek
const isSuspiciouslyShort = 
  (numStrWithoutLeadingZeros.length < 3 && weightRaw.length > 10) || 
  (numStrWithoutLeadingZeros.length < 2 && weightRaw.length > 15) ||
  (weightValue > 0 && weightValue < 100 && weightRaw.length > 15);

if (isSuspiciouslyShort) {
  // Coba 5 pattern berbeda untuk menemukan angka yang lebih panjang
  // Pattern 1: 3+ digits dengan optional decimal
  // Pattern 2: 3+ digits dengan decimal point
  // Pattern 3: Angka dimulai 1-9 diikuti 2+ digits
  // Pattern 4: 2+ digits dengan optional decimal
  // Pattern 5: Extract semua digit berturut-turut
}
```

**Contoh Perbaikan:**
```
Input: "+000964.0  g"
  → Initial parse: numStr = "64" (salah!)
  → Detected: suspiciously short
  → Try Pattern 1: "964.0" ✅
  → Corrected: weightValue = 964.0
```

#### 6. Validasi Nilai yang Masuk Akal

```javascript
// Reject jika nilai terlalu besar (> 10000g = 10kg)
if (weightValue > 10000) {
  // Coba re-parse dengan menghapus leading zeros
  const cleanedNumStr = numStr.replace(/^0+/, '') || '0';
  const reParsedValue = parseFloat(signStr + cleanedNumStr);
  
  if (reParsedValue <= 10000 && reParsedValue > 0) {
    weightValue = reParsedValue; // Gunakan nilai yang diperbaiki
  } else {
    return null; // Reject jika masih tidak masuk akal
  }
}
```

**Tujuan:** Mencegah nilai yang tidak masuk akal seperti `999999` gram diterima.

#### 7. Konversi ke Gram dan Return

```javascript
// Nilai sudah dalam gram (tidak perlu konversi jika unit = 'g')
let weightGrams = weightValue;

// Konversi jika unit = 'KG'
if (weightUnit === 'KG' || weightUnit.includes('KG')) {
  weightGrams = weightGrams * 1000; // kg to gram
}

return {
  weight: weightGrams,      // Selalu dalam gram
  unit: 'g',                 // Unit output selalu gram
  originalUnit: weightUnit,  // Unit asli dari timbangan
  stable: true,              // Status stabilitas
  raw: cleaned               // Data mentah yang sudah dibersihkan
};
```

**Mengapa Langsung ke Gram?**
- Menghindari konversi ganda (server → kg → UI → gram)
- Lebih akurat dan konsisten
- UI langsung menggunakan nilai tanpa konversi

---

## Parsing Timbangan Vibra

### Format Data

```
+000140.7  G  S
│          │  │
│          │  └─ Status (S = Stable, I = Instable)
│          └─ Unit (G = Gram, K = Kilogram)
└─ Nilai berat dengan leading zeros
```

### Regex Pattern

```javascript
const VIBRA_REGEX = /^([+-]?)(\d{6}\.\d)\s+([GK])\s+([SI])/i;
```

**Penjelasan Pattern:**
- `^([+-]?)` - Tanda positif/negatif di awal (opsional)
- `(\d{6}\.\d)` - 6 digit, titik desimal, 1 digit desimal
- `\s+([GK])` - Whitespace, lalu unit (G atau K)
- `\s+([SI])` - Whitespace, lalu status (S atau I)

### Proses Parsing

```javascript
const vibra = VIBRA_REGEX.exec(raw);
if (vibra) {
  const sign = vibra[1] === '-' ? -1 : 1;  // Tanda negatif = -1, positif = 1
  const value = parseFloat(vibra[2]);       // Nilai numerik
  const unit = vibra[3];                    // Unit (G atau K)
  const stable = vibra[4] === 'S';         // Status stabilitas
  
  // Konversi ke gram
  const grams = unit === 'G' 
    ? value * sign           // Jika gram, langsung kali sign
    : value * sign * 1000;   // Jika kg, kali 1000 lalu kali sign
  
  return { 
    weight: grams, 
    unit: 'g', 
    originalUnit: unit, 
    stable: stable 
  };
}
```

**Contoh Parsing:**
```
Input: "+000140.7  G  S"
  → sign: 1 (positif)
  → value: 140.7
  → unit: "G"
  → stable: true
  → grams: 140.7 * 1 = 140.7
  → Return: { weight: 140.7, unit: 'g', originalUnit: 'G', stable: true }
```

---

## Validasi dan Error Handling

### 1. Validasi Data Tidak Lengkap

**Kasus 1: Data Berakhir dengan Titik Desimal**
```javascript
// Reject: "ST,+000442."
if (endsWithDecimalOnly) {
  return null; // Frontend akan menggunakan nilai sebelumnya
}
```

**Kasus 2: Data Terpotong (Truncated)**
```javascript
// Reject: "8.1  g" dari "ST,+000138.1  g"
if (tempWeightValue < 20 && !hasPrefix) {
  return null;
}
```

### 2. Validasi Nilai yang Masuk Akal

```javascript
// Reject nilai terlalu besar (kemungkinan parsing error)
if (weightValue > 10000) {
  // Coba perbaiki dengan menghapus leading zeros
  // Jika masih > 10000, reject
}
```

### 3. Validasi Parsing Gagal

```javascript
// Reject jika parsing menghasilkan NaN
if (isNaN(weightValue)) {
  return null;
}
```

### 4. Fallback Mechanism

Jika parser utama gagal, sistem akan mencoba:

1. **Split Method** (untuk AND) → **Regex Method** (fallback)
2. **Vibra Parser** → **AND Parser** → **Decimal Parser**
3. **Auto-detection** berdasarkan prefix (`ST,` atau `US,`)

---

## Konversi Unit

### Prinsip: Selalu Return dalam Gram

Semua parser mengembalikan nilai dalam **gram** untuk konsistensi:

```javascript
// AND EK-15KL
let weightGrams = weightValue;  // Sudah dalam gram
if (weightUnit === 'KG') {
  weightGrams = weightGrams * 1000;  // Konversi kg → gram
}

// Vibra
const grams = unit === 'G' 
  ? value * sign           // Gram langsung
  : value * sign * 1000;   // Kilogram → gram

// Return
return { weight: weightGrams, unit: 'g', ... };
```

### Keuntungan

1. **Tidak Ada Konversi Ganda:** Server langsung kirim gram, UI langsung pakai
2. **Lebih Akurat:** Menghindari error konversi (misalnya: 0.2005 kg → 200.5 g)
3. **Konsisten:** Semua parser return format yang sama

### Contoh Konversi

**Sebelum (dengan konversi ganda):**
```
Timbangan: "ST,+000200.5  g"
  → Server parse: 200.5 gram
  → Server convert: 200.5 * 0.001 = 0.2005 kg
  → Kirim ke UI: { weight: 0.2005, unit: 'kg' }
  → UI convert: 0.2005 * 1000 = 200.5 gram ✅
```

**Sekarang (langsung gram):**
```
Timbangan: "ST,+000200.5  g"
  → Server parse: 200.5 gram
  → Kirim ke UI: { weight: 200.5, unit: 'g' }
  → UI: Langsung pakai 200.5 gram ✅
```

---

## Contoh Alur Kerja

### Contoh 1: AND EK-15KL - Format Lengkap

```
1. Raw Data: "ST,+000140.7  g,11:06:00,03/12/2025,36\r\n"
   
2. Cleaning:
   → Hapus \r\n: "ST,+000140.7  g,11:06:00,03/12/2025,36"
   → Hapus control chars: (tidak ada)
   → Hapus encoding errors: (tidak ada)
   
3. Split:
   → parts[0] = "ST"
   → parts[1] = "+000140.7  g"
   → parts[2] = "11:06:00"
   → parts[3] = "03/12/2025"
   → parts[4] = "36"
   
4. Extract Weight:
   → weightRaw = "+000140.7  g"
   → Regex match: signStr = "+", numStr = "000140.7", unit = "g"
   → weightValue = 140.7
   
5. Validation:
   → ✅ Tidak ends with decimal
   → ✅ Memiliki prefix "ST"
   → ✅ Nilai masuk akal (140.7 < 10000)
   
6. Conversion:
   → weightGrams = 140.7 (sudah gram)
   
7. Return:
   {
     weight: 140.7,
     unit: 'g',
     originalUnit: 'G',
     stable: true,
     raw: "ST,+000140.7  g,11:06:00,03/12/2025,36"
   }
```

### Contoh 2: AND EK-15KL - Nilai Negatif

```
1. Raw Data: "ST,-000000.8  g\r\n"
   
2. Cleaning: "ST,-000000.8  g"
   
3. Split:
   → parts[0] = "ST"
   → parts[1] = "-000000.8  g"
   
4. Extract Weight:
   → weightRaw = "-000000.8  g"
   → Regex match: signStr = "-", numStr = "000000.8", unit = "g"
   → weightValue = -0.8
   
5. Validation:
   → ✅ Valid (menerima nilai negatif)
   
6. Conversion:
   → weightGrams = -0.8
   
7. Return:
   {
     weight: -0.8,
     unit: 'g',
     originalUnit: 'G',
     stable: true,
     raw: "ST,-000000.8  g"
   }
```

### Contoh 3: Vibra Scale

```
1. Raw Data: "+000140.7  G  S\r\n"
   
2. Cleaning: "+000140.7  G  S"
   
3. Regex Match:
   → VIBRA_REGEX.exec() → ["+000140.7  G  S", "+", "000140.7", "G", "S"]
   → sign = 1 (positif)
   → value = 140.7
   → unit = "G"
   → stable = true
   
4. Conversion:
   → grams = 140.7 * 1 = 140.7 (karena unit = 'G')
   
5. Return:
   {
     weight: 140.7,
     unit: 'g',
     originalUnit: 'G',
     stable: true
   }
```

### Contoh 4: Data Terpotong (Ditolak)

```
1. Raw Data: "8.1  g"  (terpotong dari "ST,+000138.1  g")
   
2. Cleaning: "8.1  g"
   
3. Split:
   → parts.length = 1 (tidak ada koma)
   → parts[0] = "8.1  g"
   
4. Validation:
   → ❌ Tidak ada prefix "ST," atau "US,"
   → ❌ Nilai terlalu kecil (8.1 < 20)
   → ❌ Kemungkinan besar data terpotong
   
5. Return: null
   
6. Frontend: Menggunakan nilai sebelumnya (tidak update)
```

### Contoh 5: Perbaikan Parsing Error (Leading Zeros)

```
1. Raw Data: "ST,+000964.0  g"
   
2. Initial Parse:
   → weightMatch: numStr = "64" (salah! seharusnya "964")
   
3. Detection:
   → numStrWithoutLeadingZeros = "64"
   → isSuspiciouslyShort = true (64 < 100, raw length > 15)
   
4. Correction:
   → Try Pattern 1: longerMatch = "964.0" ✅
   → correctedWeightValue = 964.0
   
5. Validation:
   → ✅ Nilai masuk akal (964 < 10000)
   
6. Return:
   {
     weight: 964.0,
     unit: 'g',
     originalUnit: 'G',
     stable: true,
     raw: "ST,+000964.0  g"
   }
```

---

## Kesimpulan

Sistem parsing timbangan dirancang dengan:

1. **Multi-layer Validation:** Validasi di setiap tahap untuk memastikan akurasi
2. **Error Correction:** Deteksi dan perbaikan parsing error otomatis
3. **Format Flexibility:** Mendukung berbagai format (lengkap, sederhana, dengan/tanpa prefix)
4. **Unit Consistency:** Semua output dalam gram untuk menghindari konversi ganda
5. **Robustness:** Menolak data tidak lengkap atau terpotong

Dengan mekanisme ini, sistem dapat menghasilkan angka yang **akurat sesuai dengan display pada instrumen penimbangan**.

---

## Referensi

- **File Implementasi:** `server.js` - Fungsi `parseAndEk15kl()` dan `parseWeightSmart()`
- **Dokumentasi Terkait:**
  - `SCALE_PARSING_FIX.md` - Perbaikan parsing yang telah dilakukan
  - `SCALE_UNIT_TO_GRAMS.md` - Perubahan unit ke gram
  - `TRUNCATION_PREVENTION_FIX.md` - Pencegahan data terpotong
  - `SCALE_PARSING_LEADING_ZEROS_FIX.md` - Perbaikan leading zeros
