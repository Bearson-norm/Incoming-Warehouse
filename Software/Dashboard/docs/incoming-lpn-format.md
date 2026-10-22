# Format LPN — Incoming (metode internal)

## Template

```
{UniqueShort}{YYYY}-{Reference}-{RmCode}-{Batch}
```

- **UniqueShort**: 4 karakter hex acak (uppercase), digabung dengan **YYYY** (tahun kalender, timezone `Asia/Jakarta`).
- **Reference**: input operator; trim, uppercase; karakter `/` **dipertahankan** (sesuai `LPN_REGEX`).
- **RmCode**: kode RM dari master (`RmCode.code`), uppercase.
- **Batch**: input operator; uppercase; spasi dihapus.

Contoh: `A3F72026-WRMPM/IN/13010-PMSTK00297-11469`

## Batas

- Panjang total LPN **maks. 64 karakter** (kolom `packageUid`).
- Jika melebihi batas, segmen **Batch** lalu **Reference** dipotong dari kanan hingga muat.
- Karakter diizinkan per segmen: huruf, angka, `/`, `_`, `-`; LPN harus diawali huruf/angka.

## Uniqueness

- Segmen unik acak + indeks DB pada `WeighSession.packageUid` (flow `incoming`).
- Server melakukan retry compose hingga 5 kali jika terjadi konflik.

## Metadata sesi (`labelMetadata`)

| Field | Keterangan |
|-------|------------|
| `lpnUniqueSegment` | Segmen pertama (`UniqueShort` + `YYYY`) |
| `labelProductNumber` | LPN penuh (sama dengan `packageUid`) |
| `referenceOdoo`, `batch`, `arrivalAt`, `expiredDate` | Data cetak |
| `vendorName`, `skuName` | Snapshot tampilan |

## Cetak label

Layout cetak **tidak** menampilkan baris PO / Adj (hanya header, nomor label produk, tabel info, dan QR).

### Ukuran kertas (default)

Stiker **78 × 100 mm**, orientasi **landscape** (`@page`: `78mm 100mm landscape`). Area konten label **100 × 78 mm**. Preset di `printLabelConfig` (localStorage); font/QR sedikit diperkecil agar muat.

### QR

| QR | Isi |
|----|-----|
| LPN | `labelProductNumber` |
| SKU | Kode RM (nilai QR); nama RM di tabel |
| NETTO | Berat netto dalam gram, 2 desimal (tanpa suffix `g`) |

Batch hanya ditampilkan di tabel, tidak di-QR.
