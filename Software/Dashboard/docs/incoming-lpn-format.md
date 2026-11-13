# Format LPN — Incoming (metode internal)

## Template (satu barang)

```
{Reference}-{RmCode}-{Batch}
```

- **Reference**: input operator; trim, uppercase; karakter `/` **dipertahankan** (sesuai `LPN_REGEX`).
- **RmCode**: kode RM dari master (`RmCode.code`), uppercase.
- **Batch**: input operator; uppercase; spasi dihapus.

Contoh: `WRMPM/IN/13010-PMSTK00297-11469`

Segmen unique acak (`UniqueShort` + `YYYY`) **tidak** dipakai lagi.

## Template (timbang batch, N ≥ 2)

```
{Reference}-{RmCode}-{Batch}-{n}
```

`n` = urutan kedatangan 1…N (`batchSequence`). Semua item berbagi base yang sama; hanya suffix yang berbeda.

Contoh N = 4:

- `WRMPM/IN/13010-PMSTK00297-11469-1`
- `WRMPM/IN/13010-PMSTK00297-11469-2`
- `WRMPM/IN/13010-PMSTK00297-11469-3`
- `WRMPM/IN/13010-PMSTK00297-11469-4`

## Batas

- Panjang total LPN **maks. 64 karakter** (kolom `packageUid`).
- Jika melebihi batas, segmen **Batch** lalu **Reference** dipotong dari kanan hingga muat.
- Untuk batch, ruang suffix `-${N}` dicadangkan saat compose base.
- Karakter diizinkan per segmen: huruf, angka, `/`, `_`, `-`; LPN harus diawali huruf/angka.

## Uniqueness

- Indeks DB pada `WeighSession.packageUid` (flow `incoming`), case-insensitive.
- Tanpa kode acak, kedatangan baru dengan Reference/RM/Batch yang sama akan bentrok (batch juga bentrok di `-1`…`-N` yang sama). Ubah nomor batch atau referensi untuk kedatangan berikutnya.

## Metadata sesi (`labelMetadata`)

| Field | Keterangan |
|-------|------------|
| `labelProductNumber` | LPN penuh (sama dengan `packageUid`) |
| `referenceOdoo`, `batch`, `arrivalAt`, `expiredDate` | Data cetak |
| `vendorName`, `skuName` | Snapshot tampilan |
| `lpnUniqueSegment` | Legacy; tidak di-set untuk LPN internal baru |

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
