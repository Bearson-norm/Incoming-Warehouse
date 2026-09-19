import { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { Vendor, Packaging } from '../types';
import { toast } from 'sonner';
import { Database, Plus, Edit, Trash2, Package } from 'lucide-react';

export default function Databases() {
  const { t } = useI18n();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  const [isPackagingDialogOpen, setIsPackagingDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editingPackaging, setEditingPackaging] = useState<{ vendorId: string; packaging: Packaging | null }>({ vendorId: '', packaging: null });
  
  const [vendorName, setVendorName] = useState('');
  const [packagingType, setPackagingType] = useState('');
  const [tareWeight, setTareWeight] = useState('');

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = () => {
    const savedVendors = localStorage.getItem('vendors');
    if (savedVendors) {
      setVendors(JSON.parse(savedVendors));
    }
  };

  const saveVendors = (updatedVendors: Vendor[]) => {
    localStorage.setItem('vendors', JSON.stringify(updatedVendors));
    setVendors(updatedVendors);
  };

  const handleAddVendor = () => {
    setEditingVendor(null);
    setVendorName('');
    setIsVendorDialogOpen(true);
  };

  const handleEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setVendorName(vendor.name);
    setIsVendorDialogOpen(true);
  };

  const handleSaveVendor = () => {
    if (!vendorName.trim()) {
      toast.error(t('pleaseFillAllFields'));
      return;
    }

    let updatedVendors: Vendor[];
    
    if (editingVendor) {
      updatedVendors = vendors.map(v => 
        v.id === editingVendor.id ? { ...v, name: vendorName } : v
      );
      toast.success(t('vendorUpdated'));
    } else {
      const newVendor: Vendor = {
        id: Date.now().toString(),
        name: vendorName,
        packagings: [],
      };
      updatedVendors = [...vendors, newVendor];
      toast.success(t('vendorAdded'));
    }

    saveVendors(updatedVendors);
    setIsVendorDialogOpen(false);
    setVendorName('');
  };

  const handleDeleteVendor = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus vendor ini?')) {
      const updatedVendors = vendors.filter(v => v.id !== id);
      saveVendors(updatedVendors);
      toast.success(t('vendorDeleted'));
    }
  };

  const handleAddPackaging = (vendorId: string) => {
    setEditingPackaging({ vendorId, packaging: null });
    setPackagingType('');
    setTareWeight('');
    setIsPackagingDialogOpen(true);
  };

  const handleEditPackaging = (vendorId: string, packaging: Packaging) => {
    setEditingPackaging({ vendorId, packaging });
    setPackagingType(packaging.type);
    setTareWeight(packaging.tareWeight.toString());
    setIsPackagingDialogOpen(true);
  };

  const handleSavePackaging = () => {
    if (!packagingType.trim() || !tareWeight) {
      toast.error(t('pleaseFillAllFields'));
      return;
    }

    const updatedVendors = vendors.map(vendor => {
      if (vendor.id !== editingPackaging.vendorId) return vendor;

      let updatedPackagings: Packaging[];

      if (editingPackaging.packaging) {
        updatedPackagings = vendor.packagings.map(p =>
          p.id === editingPackaging.packaging!.id
            ? { ...p, type: packagingType, tareWeight: parseFloat(tareWeight) }
            : p
        );
      } else {
        const newPackaging: Packaging = {
          id: Date.now().toString(),
          type: packagingType,
          tareWeight: parseFloat(tareWeight),
        };
        updatedPackagings = [...vendor.packagings, newPackaging];
      }

      return { ...vendor, packagings: updatedPackagings };
    });

    saveVendors(updatedVendors);
    setIsPackagingDialogOpen(false);
    toast.success(editingPackaging.packaging ? t('packagingUpdated') : t('packagingAdded'));
  };

  const handleDeletePackaging = (vendorId: string, packagingId: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus kemasan ini?')) {
      const updatedVendors = vendors.map(vendor => {
        if (vendor.id !== vendorId) return vendor;
        return {
          ...vendor,
          packagings: vendor.packagings.filter(p => p.id !== packagingId),
        };
      });
      saveVendors(updatedVendors);
      toast.success(t('packagingDeleted'));
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl mb-2">{t('databases')}</h1>
        <p className="text-gray-600">Kelola vendor dan jenis kemasan</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              {t('vendorList')}
            </span>
            <Button onClick={handleAddVendor}>
              <Plus className="w-4 h-4 mr-2" />
              {t('addVendor')}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vendors.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {vendors.map((vendor) => (
                <AccordionItem key={vendor.id} value={vendor.id}>
                  <AccordionTrigger
                    className="hover:no-underline"
                    rightSlot={
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditVendor(vendor)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteVendor(vendor.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    }
                  >
                    {vendor.name}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Daftar Kemasan
                        </h4>
                        <Button
                          size="sm"
                          onClick={() => handleAddPackaging(vendor.id)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {t('addPackaging')}
                        </Button>
                      </div>
                      {vendor.packagings.length > 0 ? (
                        <div className="space-y-2">
                          {vendor.packagings.map((packaging) => (
                            <div
                              key={packaging.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div>
                                <span className="font-medium">{packaging.type}</span>
                                <span className="text-sm text-gray-500 ml-2">
                                  (Tare: {packaging.tareWeight} kg)
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditPackaging(vendor.id, packaging)}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeletePackaging(vendor.id, packaging.id)}
                                >
                                  <Trash2 className="w-3 h-3 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">
                          Belum ada kemasan untuk vendor ini
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Database className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Belum ada vendor</p>
              <p className="text-sm mt-2">Tambahkan vendor untuk memulai</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vendor Dialog */}
      <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVendor ? t('edit') + ' ' + t('vendor') : t('addVendor')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('vendorName')}</Label>
              <Input
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="PT Supplier ABC"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVendorDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveVendor}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Packaging Dialog */}
      <Dialog open={isPackagingDialogOpen} onOpenChange={setIsPackagingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPackaging.packaging ? t('edit') + ' ' + t('packaging') : t('addPackaging')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('packagingType')}</Label>
              <Input
                value={packagingType}
                onChange={(e) => setPackagingType(e.target.value)}
                placeholder="Karung 50kg"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('tareWeight')} (kg)</Label>
              <Input
                type="number"
                step="0.01"
                value={tareWeight}
                onChange={(e) => setTareWeight(e.target.value)}
                placeholder="0.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPackagingDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSavePackaging}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
