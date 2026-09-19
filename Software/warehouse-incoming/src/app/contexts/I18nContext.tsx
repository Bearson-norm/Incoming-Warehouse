import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'id' | 'en';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  id: {
    // Auth
    login: 'Masuk',
    username: 'Nama Pengguna',
    password: 'Kata Sandi',
    logout: 'Keluar',
    
    // Navigation
    home: 'Beranda',
    recordingAction: 'Recording Action',
    recordDocuments: 'Dokumen Rekaman',
    databases: 'Database',
    setting: 'Pengaturan',
    
    // Home
    dashboard: 'Dashboard',
    weighingResults: 'Hasil Penimbangan',
    selectTimePeriod: 'Pilih Periode Waktu',
    today: 'Hari Ini',
    thisWeek: 'Minggu Ini',
    thisMonth: 'Bulan Ini',
    custom: 'Kustom',
    totalRecords: 'Total Rekaman',
    totalWeight: 'Total Berat',
    byVendor: 'Berdasarkan Vendor',
    
    // Recording Action
    vendor: 'Vendor',
    selectVendor: 'Pilih Vendor',
    packaging: 'Kemasan',
    selectPackaging: 'Pilih Kemasan',
    referenceOdoo: 'Referensi Odoo',
    batch: 'Batch',
    labelProductNumber: 'Nomor Label Produk',
    confirmConfig: 'Konfirmasi Konfigurasi',
    tare: 'Tare',
    gross: 'Kotor',
    net: 'Netto',
    start: 'Mulai',
    savePrint: 'Simpan & Cetak',
    waitingForConfig: 'Menunggu Konfigurasi',
    weighingInProgress: 'Penimbangan Berlangsung',
    currentWeight: 'Berat Saat Ini',
    stable: 'Stabil',
    unstable: 'Tidak Stabil',
    
    // Record Documents
    search: 'Cari',
    searchByDate: 'Cari berdasarkan Tanggal',
    searchByMaterial: 'Cari berdasarkan Material',
    searchByVendor: 'Cari berdasarkan Vendor',
    date: 'Tanggal',
    time: 'Waktu',
    material: 'Material',
    weight: 'Berat',
    actions: 'Aksi',
    print: 'Cetak',
    delete: 'Hapus',
    noRecords: 'Tidak Ada Rekaman',
    
    // Databases
    vendorList: 'Daftar Vendor',
    addVendor: 'Tambah Vendor',
    vendorName: 'Nama Vendor',
    packagingType: 'Jenis Kemasan',
    tareWeight: 'Berat Tare',
    edit: 'Edit',
    save: 'Simpan',
    cancel: 'Batal',
    addPackaging: 'Tambah Kemasan',
    
    // Setting
    language: 'Bahasa',
    selectLanguage: 'Pilih Bahasa',
    indonesian: 'Bahasa Indonesia',
    english: 'English',
    
    // Messages
    loginSuccess: 'Login Berhasil',
    loginFailed: 'Login Gagal',
    invalidCredentials: 'Username atau Password Salah',
    recordSaved: 'Rekaman Tersimpan',
    recordDeleted: 'Rekaman Dihapus',
    vendorAdded: 'Vendor Ditambahkan',
    vendorUpdated: 'Vendor Diperbarui',
    pleaseFillAllFields: 'Mohon Isi Semua Field',
    waitForStableWeight: 'Tunggu hingga berat stabil dan sesuai tare',
  },
  en: {
    // Auth
    login: 'Login',
    username: 'Username',
    password: 'Password',
    logout: 'Logout',
    
    // Navigation
    home: 'Home',
    recordingAction: 'Recording Action',
    recordDocuments: 'Record Documents',
    databases: 'Databases',
    setting: 'Setting',
    
    // Home
    dashboard: 'Dashboard',
    weighingResults: 'Weighing Results',
    selectTimePeriod: 'Select Time Period',
    today: 'Today',
    thisWeek: 'This Week',
    thisMonth: 'This Month',
    custom: 'Custom',
    totalRecords: 'Total Records',
    totalWeight: 'Total Weight',
    byVendor: 'By Vendor',
    
    // Recording Action
    vendor: 'Vendor',
    selectVendor: 'Select Vendor',
    packaging: 'Packaging',
    selectPackaging: 'Select Packaging',
    referenceOdoo: 'Odoo Reference',
    batch: 'Batch',
    labelProductNumber: 'Label Product Number',
    confirmConfig: 'Confirm Configuration',
    tare: 'Tare',
    gross: 'Gross',
    net: 'Net',
    start: 'Start',
    savePrint: 'Save & Print',
    waitingForConfig: 'Waiting for Configuration',
    weighingInProgress: 'Weighing in Progress',
    currentWeight: 'Current Weight',
    stable: 'Stable',
    unstable: 'Unstable',
    
    // Record Documents
    search: 'Search',
    searchByDate: 'Search by Date',
    searchByMaterial: 'Search by Material',
    searchByVendor: 'Search by Vendor',
    date: 'Date',
    time: 'Time',
    material: 'Material',
    weight: 'Weight',
    actions: 'Actions',
    print: 'Print',
    delete: 'Delete',
    noRecords: 'No Records',
    
    // Databases
    vendorList: 'Vendor List',
    addVendor: 'Add Vendor',
    vendorName: 'Vendor Name',
    packagingType: 'Packaging Type',
    tareWeight: 'Tare Weight',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    addPackaging: 'Add Packaging',
    
    // Setting
    language: 'Language',
    selectLanguage: 'Select Language',
    indonesian: 'Bahasa Indonesia',
    english: 'English',
    
    // Messages
    loginSuccess: 'Login Successful',
    loginFailed: 'Login Failed',
    invalidCredentials: 'Invalid Username or Password',
    recordSaved: 'Record Saved',
    recordDeleted: 'Record Deleted',
    vendorAdded: 'Vendor Added',
    vendorUpdated: 'Vendor Updated',
    pleaseFillAllFields: 'Please Fill All Fields',
    waitForStableWeight: 'Wait for stable weight matching tare',
  },
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('id');

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage) {
      setLanguageState(savedLanguage);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.id] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
