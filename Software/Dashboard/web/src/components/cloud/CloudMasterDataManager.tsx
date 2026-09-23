import { Fragment, useCallback, useEffect, useState } from "react";
import { Edit, History, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "../../services/api";
import {
  CloudMasterSnapshot,
  MasterDataAuditEvent,
  MasterEntityType,
  Packaging,
  RmCode,
  Vendor,
} from "../../types/weighing";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { useI18n } from "../../contexts/I18nContext";

type MasterRow = Vendor | Packaging | RmCode;

export function CloudMasterDataManager() {
  const { t } = useI18n();
  const [data, setData] = useState<CloudMasterSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [entityType, setEntityType] = useState<MasterEntityType>("vendor");
  const [editing, setEditing] = useState<MasterRow | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [vendorCloudId, setVendorCloudId] = useState("");
  const [tareWeight, setTareWeight] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<MasterDataAuditEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<CloudMasterSnapshot>("/cloud/master-data");
      setData(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (type: MasterEntityType, row?: MasterRow) => {
    setEntityType(type);
    setEditing(row || null);
    setName(row?.name || "");
    setCode(type === "rmCode" && row ? (row as RmCode).code : "");
    setVendorCloudId(
      type === "packaging" && row ? (row as Packaging).vendorCloudId || "" : "",
    );
    setTareWeight(
      type === "packaging" && row
        ? String((row as Packaging).tareWeight ?? "")
        : "",
    );
    setIssuedAt(
      type === "rmCode" && row
        ? new Date((row as RmCode).issuedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
    setReason("");
    setDialogOpen(true);
  };

  const save = async () => {
    if (reason.trim().length < 3) {
      toast.error("Alasan perubahan minimal 3 karakter.");
      return;
    }
    const body: Record<string, unknown> = {
      reason: reason.trim(),
      name: name.trim() || undefined,
    };
    if (entityType === "packaging") {
      body.vendorCloudId = vendorCloudId;
      body.tareWeight = tareWeight === "" ? undefined : Number(tareWeight);
    }
    if (entityType === "rmCode") {
      body.code = code.trim();
      body.issuedAt = new Date(`${issuedAt}T00:00:00`).toISOString();
    }
    try {
      if (editing) {
        await api.patch(`/cloud/master-data/${entityType}/${editing.cloudId}`, {
          ...body,
          expectedRevision: editing.revision,
        });
      } else {
        await api.post("/cloud/master-data", { ...body, entityType });
      }
      setDialogOpen(false);
      toast.success("Master data tersimpan dan audit event dibuat.");
      await load();
      await api.post("/cloud/master-data/sync").catch(() => undefined);
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error(t("revisionConflict"));
        setDialogOpen(false);
        await load();
        return;
      }
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const remove = async (type: MasterEntityType, row: MasterRow) => {
    const deleteReason = window
      .prompt("Alasan menonaktifkan data ini:")
      ?.trim();
    if (!deleteReason || deleteReason.length < 3) return;
    try {
      await api.delete(`/cloud/master-data/${type}/${row.cloudId}`, {
        data: { expectedRevision: row.revision, reason: deleteReason },
      });
      toast.success("Data dinonaktifkan; riwayat tetap dipertahankan.");
      await load();
    } catch (error: any) {
      toast.error(
        error.response?.status === 409
          ? "Revision conflict. Muat ulang lalu coba kembali."
          : error.response?.data?.message || error.message,
      );
      await load();
    }
  };

  const showHistory = async (type: MasterEntityType, row: MasterRow) => {
    try {
      const response = await api.get<MasterDataAuditEvent[]>(
        `/cloud/master-data/${type}/${row.cloudId}/history`,
      );
      setHistory(response.data);
      setHistoryOpen(true);
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const activeVendors = (data?.vendors || []).filter((row) => !row.deletedAt);
  const activePackagings = (data?.packagings || []).filter(
    (row) => !row.deletedAt,
  );
  const activeRmCodes = (data?.rmCodes || []).filter((row) => !row.deletedAt);
  const actions = (type: MasterEntityType, row: MasterRow) => (
    <div className="flex justify-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void showHistory(type, row)}
      >
        <History className="w-3.5 h-3.5" />
      </Button>
      <Button variant="outline" size="sm" onClick={() => openEditor(type, row)}>
        <Edit className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void remove(type, row)}
      >
        <Trash2 className="w-3.5 h-3.5 text-red-600" />
      </Button>
    </div>
  );

  return (
    <Card className="border-[#d7ccc8] bg-[#fff8f0] mb-6">
      <CardHeader>
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {t("editCloudDatabase")}
            </CardTitle>
            <CardDescription>{t("cloudMasterHint")}</CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Muat ulang
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Vendor dan kemasan</h3>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => openEditor("vendor")}>
                <Plus className="w-4 h-4 mr-1" /> Vendor
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openEditor("packaging")}
              >
                <Plus className="w-4 h-4 mr-1" /> Kemasan
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor / kemasan</TableHead>
                  <TableHead>Dibentuk</TableHead>
                  <TableHead>Terakhir diubah</TableHead>
                  <TableHead>Rev.</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeVendors.map((vendor) => (
                  <Fragment key={vendor.cloudId}>
                    <TableRow>
                      <TableCell className="font-semibold">
                        {vendor.name}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(vendor.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(vendor.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{vendor.revision}</TableCell>
                      <TableCell>{actions("vendor", vendor)}</TableCell>
                    </TableRow>
                    {activePackagings
                      .filter(
                        (row) =>
                          row.vendorCloudId === vendor.cloudId ||
                          row.vendorId === vendor.id,
                      )
                      .map((packaging) => (
                        <TableRow
                          key={packaging.cloudId}
                          className="bg-[#f8f1e9]"
                        >
                          <TableCell className="pl-8">
                            {packaging.name} · tare{" "}
                            {packaging.tareWeight ?? "—"} kg
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(packaging.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(packaging.updatedAt).toLocaleString()}
                          </TableCell>
                          <TableCell>{packaging.revision}</TableCell>
                          <TableCell>
                            {actions("packaging", packaging)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Daftar kode RM</h3>
            <Button size="sm" onClick={() => openEditor("rmCode")}>
              <Plus className="w-4 h-4 mr-1" /> RM
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Tanggal terbit</TableHead>
                <TableHead>Terakhir diubah</TableHead>
                <TableHead>Rev.</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeRmCodes.map((rm) => (
                <TableRow key={rm.cloudId}>
                  <TableCell className="font-mono">{rm.code}</TableCell>
                  <TableCell>{rm.name || "—"}</TableCell>
                  <TableCell>
                    {new Date(rm.issuedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(rm.updatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{rm.revision}</TableCell>
                  <TableCell>{actions("rmCode", rm)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit" : "Tambah"} {entityType}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {entityType === "packaging" && (
              <div>
                <Label>Vendor</Label>
                <Select value={vendorCloudId} onValueChange={setVendorCloudId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeVendors.map((vendor) => (
                      <SelectItem key={vendor.cloudId} value={vendor.cloudId}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {entityType === "rmCode" && (
              <div>
                <Label>Kode RM</Label>
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </div>
            )}
            <div>
              <Label>Nama</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            {entityType === "packaging" && (
              <div>
                <Label>Tare (kg)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={tareWeight}
                  onChange={(event) => setTareWeight(event.target.value)}
                />
              </div>
            )}
            {entityType === "rmCode" && (
              <div>
                <Label>Tanggal terbit</Label>
                <Input
                  type="date"
                  value={issuedAt}
                  onChange={(event) => setIssuedAt(event.target.value)}
                />
              </div>
            )}
            <div>
              <Label>{t("changeReason")}</Label>
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Contoh: pembaruan kontrak vendor"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void save()}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Riwayat perubahan</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {history.map((event) => (
              <div key={event.id} className="border rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <strong>
                    Rev. {event.revision} · {event.action}
                  </strong>
                  <span className="text-xs">
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </div>
                <p>
                  Oleh {event.actorUsername}: {event.reason}
                </p>
                <details className="mt-2 text-xs">
                  <summary>Before / after</summary>
                  <pre className="overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(
                      { before: event.beforeJson, after: event.afterJson },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
