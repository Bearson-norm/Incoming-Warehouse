import { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import api from '../services/api';
import { toast } from 'sonner';
import { Database, Plus, Edit, Trash2, Package, Hash } from 'lucide-react';
import { RmCode, Vendor } from '../types/weighing';

export default function Databases() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rmCodes, setRmCodes] = useState<RmCode[]>([]);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  const [isPackagingDialogOpen, setIsPackagingDialogOpen] = useState(false);
  const [isRmDialogOpen, setIsRmDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editingPackaging, setEditingPackaging] = useState<{
    vendorId: number;
    packaging: { id: number; name: string; tareWeight: number | null } | null;
  }>({ vendorId: 0, packaging: null });
  const [editingRm, setEditingRm] = useState<RmCode | null>(null);

  const [vendorName, setVendorName] = useState('');
  const [packagingType, setPackagingType] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [rmCode, setRmCode] = useState('');
  const [rmName, setRmName] = useState('');

  const load = async () => {
    try {
      const [vendorRes, rmRes] = await Promise.all([
        api.get<Vendor[]>('/vendors'),
        api.get<RmCode[]>('/rm-codes'),
      ]);
      setVendors(vendorRes.data);
      setRmCodes(rmRes.data);
    } catch {
      toast.error(t('failedToLoadDatabase'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveVendor = async () => {
    if (!vendorName.trim()) {
      toast.error(t('pleaseFillAllFields'));
      return;
    }
    try {
      if (editingVendor) {
        await api.patch(`/vendors/${editingVendor.id}`, { name: vendorName.trim() });
        toast.success(t('vendorUpdated'));
      } else {
        await api.post('/vendors', { name: vendorName.trim() });
        toast.success(t('vendorAdded'));
      }
      setIsVendorDialogOpen(false);
      setVendorName('');
      setEditingVendor(null);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('pleaseFillAllFields'));
    }
  };

  const handleDeleteVendor = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await api.delete(`/vendors/${id}`);
      toast.success(t('vendorDeleted'));
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('pleaseFillAllFields'));
    }
  };

  const handleSavePackaging = async () => {
    if (!packagingType.trim() || !tareWeight) {
      toast.error(t('pleaseFillAllFields'));
      return;
    }
    const tare = parseFloat(tareWeight);
    if (Number.isNaN(tare)) {
      toast.error(t('pleaseFillAllFields'));
      return;
    }
    try {
      if (editingPackaging.packaging) {
        await api.patch(`/packagings/${editingPackaging.packaging.id}`, {
          name: packagingType.trim(),
          tareWeight: tare,
        });
        toast.success(t('packagingUpdated'));
      } else {
        await api.post('/packagings', {
          vendorId: editingPackaging.vendorId,
          name: packagingType.trim(),
          tareWeight: tare,
        });
        toast.success(t('packagingAdded'));
      }
      setIsPackagingDialogOpen(false);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('pleaseFillAllFields'));
    }
  };

  const handleDeletePackaging = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await api.delete(`/packagings/${id}`);
      toast.success(t('packagingDeleted'));
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('pleaseFillAllFields'));
    }
  };

  const handleSaveRm = async () => {
    if (!rmCode.trim()) {
      toast.error(t('pleaseFillAllFields'));
      return;
    }
    try {
      if (editingRm) {
        await api.patch(`/rm-codes/${editingRm.id}`, {
          code: rmCode.trim(),
          name: rmName.trim() || undefined,
        });
        toast.success(t('rmCodeUpdated'));
      } else {
        await api.post('/rm-codes', {
          code: rmCode.trim(),
          name: rmName.trim() || undefined,
        });
        toast.success(t('rmCodeAdded'));
      }
      setIsRmDialogOpen(false);
      setRmCode('');
      setRmName('');
      setEditingRm(null);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('pleaseFillAllFields'));
    }
  };

  const handleDeleteRm = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await api.delete(`/rm-codes/${id}`);
      toast.success(t('rmCodeDeleted'));
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('pleaseFillAllFields'));
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto bg-[#f5ebe0] min-h-full">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl brown-gradient-animated flex items-center justify-center shadow-md brown-glow-animated">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#3e2723]">{t('databases')}</h1>
            <p className="text-sm text-[#8d6e63]">{t('databasesSubtitle')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <Card className="border-2 border-[#d7ccc8] shadow-md bg-[#fff8f0]">
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span className="flex items-center gap-2 text-[#3e2723]">
                <Package className="w-4 h-4" />
                {t('vendorList')}
              </span>
              {isAdmin && (
                <Button
                  size="sm"
                  className="brown-gradient-animated text-white"
                  onClick={() => {
                    setEditingVendor(null);
                    setVendorName('');
                    setIsVendorDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('addVendor')}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {vendors.length > 0 ? (
              <Accordion type="single" collapsible className="w-full">
                {vendors.map((vendor) => (
                  <AccordionItem key={vendor.id} value={String(vendor.id)}>
                    <AccordionTrigger
                      className="hover:no-underline"
                      rightSlot={
                        isAdmin ? (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingVendor(vendor);
                                setVendorName(vendor.name);
                                setIsVendorDialogOpen(true);
                              }}
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
                        ) : null
                      }
                    >
                      {vendor.name}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-sm text-[#5d4037]">{t('packaging')}</h4>
                          {isAdmin && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setEditingPackaging({ vendorId: vendor.id, packaging: null });
                                setPackagingType('');
                                setTareWeight('');
                                setIsPackagingDialogOpen(true);
                              }}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              {t('addPackaging')}
                            </Button>
                          )}
                        </div>
                        {(vendor.packagings || []).length > 0 ? (
                          <div className="space-y-2">
                            {(vendor.packagings || []).map((packaging) => (
                              <div
                                key={packaging.id}
                                className="flex items-center justify-between p-3 bg-[#f5ebe0] rounded-lg"
                              >
                                <div>
                                  <span className="font-medium text-sm">{packaging.name}</span>
                                  <span className="text-xs text-[#8d6e63] ml-2">
                                    ({t('tare')}: {packaging.tareWeight ?? '-'} kg)
                                  </span>
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditingPackaging({ vendorId: vendor.id, packaging });
                                        setPackagingType(packaging.name);
                                        setTareWeight(
                                          packaging.tareWeight != null
                                            ? String(packaging.tareWeight)
                                            : '',
                                        );
                                        setIsPackagingDialogOpen(true);
                                      }}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeletePackaging(packaging.id)}
                                    >
                                      <Trash2 className="w-3 h-3 text-red-500" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-[#a1887f] text-center py-4">
                            {t('noPackaging')}
                          </p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <p className="text-sm text-[#8d6e63] text-center py-8">{t('noVendors')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-[#d7ccc8] shadow-md bg-[#fff8f0]">
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span className="flex items-center gap-2 text-[#3e2723]">
                <Hash className="w-4 h-4" />
                {t('rmCodeList')}
              </span>
              {isAdmin && (
                <Button
                  size="sm"
                  className="brown-gradient-animated text-white"
                  onClick={() => {
                    setEditingRm(null);
                    setRmCode('');
                    setRmName('');
                    setIsRmDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('addRmCode')}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {rmCodes.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('rmCode')}</TableHead>
                    <TableHead>{t('rmName')}</TableHead>
                    {isAdmin && <TableHead className="text-right">{t('actions')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rmCodes.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-sm">{row.code}</TableCell>
                      <TableCell className="text-sm">{row.name || '-'}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingRm(row);
                                setRmCode(row.code);
                                setRmName(row.name || '');
                                setIsRmDialogOpen(true);
                              }}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteRm(row.id)}
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-[#8d6e63] text-center py-8">{t('noRmCodes')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVendor ? `${t('edit')} ${t('vendor')}` : t('addVendor')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('vendorName')}</Label>
            <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVendorDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveVendor}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPackagingDialogOpen} onOpenChange={setIsPackagingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPackaging.packaging
                ? `${t('edit')} ${t('packaging')}`
                : t('addPackaging')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('packagingType')}</Label>
              <Input
                value={packagingType}
                onChange={(e) => setPackagingType(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('tareWeight')} (kg)</Label>
              <Input
                type="number"
                step="0.01"
                value={tareWeight}
                onChange={(e) => setTareWeight(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPackagingDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSavePackaging}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRmDialogOpen} onOpenChange={setIsRmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRm ? `${t('edit')} ${t('rmCode')}` : t('addRmCode')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('rmCode')}</Label>
              <Input value={rmCode} onChange={(e) => setRmCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('rmName')}</Label>
              <Input value={rmName} onChange={(e) => setRmName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRmDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveRm}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
