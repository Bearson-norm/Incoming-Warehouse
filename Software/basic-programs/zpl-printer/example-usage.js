/**
 * CONTOH PENGGUNAAN: Print Label dengan ZPL
 * 
 * File ini menunjukkan berbagai cara menggunakan fungsi print
 */

const { printLabel, generateZPL, mmToDots } = require('./print');

// ==========================================
// CONTOH 1: Print Label Sederhana
// ==========================================
console.log('📝 Contoh 1: Print Label Sederhana');
const data1 = {
  productName: 'PRODUCT ABC',
  weight: '170.5',
  barcode: '123456789012',
  qrCode: 'https://example.com/product/123'
};

printLabel(data1);

// ==========================================
// CONTOH 2: Generate ZPL tanpa Print
// ==========================================
console.log('\n📝 Contoh 2: Generate ZPL Command');
const zpl = generateZPL({
  productName: 'TEST PRODUCT',
  weight: '100.0',
  barcode: '987654321',
  qrCode: 'https://test.com'
});

console.log('ZPL Command:');
console.log(zpl);
console.log('');

// ==========================================
// CONTOH 3: Custom Label Size
// ==========================================
console.log('📝 Contoh 3: Custom Label Size');
// Edit CONFIG di print.js untuk custom size
// Atau buat fungsi baru dengan parameter size

// ==========================================
// CONTOH 4: Print dengan Data dari Database
// ==========================================
console.log('\n📝 Contoh 4: Print dengan Data dari Database');
// Simulasi data dari database
const dbData = {
  id: 1,
  name: 'Ingredient A',
  weight: 250.5,
  workOrder: 'WO-2024-001',
  operator: 'John Doe'
};

const printData = {
  productName: dbData.name,
  weight: dbData.weight.toString(),
  barcode: dbData.workOrder,
  qrCode: `https://example.com/workorder/${dbData.workOrder}`
};

// Uncomment untuk print
// printLabel(printData);

// ==========================================
// CONTOH 5: Batch Print
// ==========================================
console.log('\n📝 Contoh 5: Batch Print');
const batchData = [
  { productName: 'Product 1', weight: '100.0', barcode: '111', qrCode: 'https://example.com/1' },
  { productName: 'Product 2', weight: '200.0', barcode: '222', qrCode: 'https://example.com/2' },
  { productName: 'Product 3', weight: '300.0', barcode: '333', qrCode: 'https://example.com/3' }
];

// Print dengan delay antar print
batchData.forEach((data, index) => {
  setTimeout(() => {
    console.log(`Printing ${index + 1}/${batchData.length}...`);
    // Uncomment untuk print
    // printLabel(data);
  }, index * 2000); // Delay 2 detik antar print
});

// ==========================================
// CONTOH 6: Konversi MM ke Dots
// ==========================================
console.log('\n📝 Contoh 6: Konversi MM ke Dots');
const widthMM = 100;
const heightMM = 72;
const dpi = 203;

console.log(`Label ${widthMM}mm x ${heightMM}mm pada ${dpi} DPI:`);
console.log(`Width: ${mmToDots(widthMM, dpi)} dots`);
console.log(`Height: ${mmToDots(heightMM, dpi)} dots`);
