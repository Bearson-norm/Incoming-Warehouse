import { useCallback, useEffect, useMemo, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { useI18n } from "../../contexts/I18nContext";
import { SearchableSelect } from "../SearchableSelect";

type MasterRow = Vendor | Packaging | RmCode;

type VendorLink = {
  vendorName?: string | null;
  vendorCloudId?: string | null;
  vendorId?: number | null;
};

function resolveVendorLabel(vendors: Vendor[], link: VendorLink): string {
  if (link.vendorName?.trim()) return link.vendorName.trim();
  if (link.vendorCloudId) {
    const byCloud = vendors.find((v) => v.cloudId === link.vendorCloudId);
    if (byCloud) return byCloud.name;
  }
  if (link.vendorId != null) {
    const vendorId = Number(link.vendorId);
    const byId = vendors.find(
      (v) => v.id === vendorId || String(v.id) === String(link.vendorId),
    );
    if (byId) return byId.name;
  }
  return "—";
}

function resolveVendorCloudId(vendors: Vendor[], link: VendorLink): string {
  if (link.vendorCloudId) return link.vendorCloudId;
  if (link.vendorId != null) {
    const vendorId = Number(link.vendorId);
    const byId = vendors.find(
      (v) => v.id === vendorId || String(v.id) === String(link.vendorId),
    );
    if (byId) return byId.cloudId;
  }
  return "";
}

type PackagingMeta = {
  grossWeightGr?: number;
  tareWeightGr?: number;
  source?: string;
};

function parsePackagingMetadata(metadata?: string | null): PackagingMeta {
  if (!metadata?.trim()) return {};
  try {
    return JSON.parse(metadata) as PackagingMeta;
  } catch {
    return {};
  }
}

function formatTareKg(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value} kg`;
}

function matchesQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

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
  const [prodArea, setProdArea] = useState("");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<MasterDataAuditEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleting, setDeleting] = useState<{ type: MasterEntityType; row: MasterRow } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [vendorQuery, setVendorQuery] = useState("");
  const [tareQuery, setTareQuery] = useState("");
  const [rmQuery, setRmQuery] = useState("");

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
    const vendors = (data?.vendors || []).filter((v) => !v.deletedAt);
    setEntityType(type);
    setEditing(row || null);
    setName(row?.name || "");
    setCode(type === "rmCode" && row ? (row as RmCode).code : "");
    setVendorCloudId(
      type === "packaging" && row
        ? resolveVendorCloudId(vendors, row as Packaging)
        : type === "rmCode" && row
          ? resolveVendorCloudId(vendors, row as RmCode)
          : "",
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
    setProdArea(
      type === "rmCode" && row ? (row as RmCode).prodArea || "" : "",
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
      body.vendorCloudId = vendorCloudId || undefined;
      body.prodArea = prodArea.trim() || undefined;
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

  const remove = async () => {
    if (!deleting) return;
    const reason = deleteReason.trim();
    if (reason.length < 3) {
      toast.error("Alasan penghapusan minimal 3 karakter.");
      return;
    }
    try {
      await api.delete(`/cloud/master-data/${deleting.type}/${deleting.row.cloudId}`, {
        data: { expectedRevision: deleting.row.revision, reason },
      });
      setDeleting(null);
      setDeleteReason("");
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

  const filteredVendors = useMemo(() => {
    return activeVendors.filter((v) => matchesQuery(v.name, vendorQuery));
  }, [activeVendors, vendorQuery]);

  const filteredPackagings = useMemo(() => {
    return [...activePackagings]
      .filter((p) => {
        const vendor = resolveVendorLabel(activeVendors, p);
        const meta = parsePackagingMetadata(p.metadata);
        const haystack = [
          vendor,
          p.name,
          formatTareKg(p.tareWeight),
          meta.grossWeightGr != null ? String(meta.grossWeightGr) : "",
          meta.source || "",
        ].join(" ");
        return matchesQuery(haystack, tareQuery);
      })
      .sort((a, b) => {
        const va = resolveVendorLabel(activeVendors, a);
        const vb = resolveVendorLabel(activeVendors, b);
        const byVendor = va.localeCompare(vb);
        if (byVendor !== 0) return byVendor;
        return a.name.localeCompare(b.name);
      });
  }, [activePackagings, activeVendors, tareQuery]);

  const filteredRmCodes = useMemo(() => {
    return [...activeRmCodes]
      .filter((rm) => {
        const vendor = resolveVendorLabel(activeVendors, rm);
        const haystack = [rm.code, rm.name || "", vendor, rm.prodArea || ""].join(
          " ",
        );
        return matchesQuery(haystack, rmQuery);
      })
      .sort((a, b) => {
        const va = resolveVendorLabel(activeVendors, a);
        const vb = resolveVendorLabel(activeVendors, b);
        const byVendor = va.localeCompare(vb);
        if (byVendor !== 0) return byVendor;
        return a.code.localeCompare(b.code);
      });
  }, [activeRmCodes, activeVendors, rmQuery]);
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
        onClick={() => {
          setDeleteReason("");
          setDeleting({ type, row });
        }}
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
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <h3 className="font-semibold">
              Vendor{" "}
              <span className="text-xs font-normal text-[#8d6e63]">
                ({filteredVendors.length}/{activeVendors.length})
              </span>
            </h3>
            <Button size="sm" onClick={() => openEditor("vendor")}>
              <Plus className="w-4 h-4 mr-1" /> Vendor
            </Button>
          </div>
          <Input
            value={vendorQuery}
            onChange={(e) => setVendorQuery(e.target.value)}
            placeholder="Cari vendor…"
            className="mb-2 max-w-md h-9 bg-white"
          />
          <div className="max-h-56 overflow-auto rounded-md border border-[#d7ccc8]">
            <Table>
              <TableHeader className="sticky top-0 bg-[#fff8f0] z-10">
                <TableRow>
                  <TableHead>Nama vendor</TableHead>
                  <TableHead>Terakhir diubah</TableHead>
                  <TableHead>Rev.</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-[#8d6e63] py-6">
                      Tidak ada vendor yang cocok.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVendors.map((vendor) => (
                    <TableRow key={vendor.cloudId}>
                      <TableCell className="font-medium">{vendor.name}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(vendor.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{vendor.revision}</TableCell>
                      <TableCell>{actions("vendor", vendor)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <h3 className="font-semibold">
              Standar tare jerigen{" "}
              <span className="text-xs font-normal text-[#8d6e63]">
                ({filteredPackagings.length}/{activePackagings.length})
              </span>
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openEditor("packaging")}
            >
              <Plus className="w-4 h-4 mr-1" /> Kemasan
            </Button>
          </div>
          <Input
            value={tareQuery}
            onChange={(e) => setTareQuery(e.target.value)}
            placeholder="Cari vendor, jenis jerigen, tare…"
            className="mb-2 max-w-md h-9 bg-white"
          />
          <div className="max-h-[360px] overflow-auto rounded-md border border-[#d7ccc8]">
            <Table>
              <TableHeader className="sticky top-0 bg-[#fff8f0] z-10">
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Jenis jerigen</TableHead>
                  <TableHead className="text-right">Tare</TableHead>
                  <TableHead className="text-right">Bruto (gr)</TableHead>
                  <TableHead>Terakhir diubah</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPackagings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-[#8d6e63] py-6">
                      Tidak ada data kemasan. Jalankan seed tare di server cloud jika perlu.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPackagings.map((packaging) => {
                    const meta = parsePackagingMetadata(packaging.metadata);
                    return (
                      <TableRow key={packaging.cloudId}>
                        <TableCell className="text-sm max-w-[200px]">
                          {resolveVendorLabel(activeVendors, packaging)}
                        </TableCell>
                        <TableCell className="text-sm">{packaging.name}</TableCell>
                        <TableCell className="text-sm text-right font-mono tabular-nums">
                          {formatTareKg(packaging.tareWeight)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono tabular-nums">
                          {meta.grossWeightGr != null ? meta.grossWeightGr : "—"}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(packaging.updatedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>{actions("packaging", packaging)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <h3 className="font-semibold">
              Daftar kode RM{" "}
              <span className="text-xs font-normal text-[#8d6e63]">
                ({filteredRmCodes.length}/{activeRmCodes.length})
              </span>
            </h3>
            <Button size="sm" onClick={() => openEditor("rmCode")}>
              <Plus className="w-4 h-4 mr-1" /> RM
            </Button>
          </div>
          <Input
            value={rmQuery}
            onChange={(e) => setRmQuery(e.target.value)}
            placeholder="Cari kode, nama, vendor, prod area…"
            className="mb-2 max-w-md h-9 bg-white"
          />
          <div className="max-h-[420px] overflow-auto rounded-md border border-[#d7ccc8]">
            <Table>
              <TableHeader className="sticky top-0 bg-[#fff8f0] z-10">
                <TableRow>
                  <TableHead className="w-[100px]">Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="w-[90px]">Area</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRmCodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-[#8d6e63] py-6">
                      Tidak ada kode RM yang cocok.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRmCodes.map((rm) => (
                    <TableRow key={rm.cloudId}>
                      <TableCell className="font-mono text-sm font-medium">
                        {rm.code}
                      </TableCell>
                      <TableCell className="text-sm max-w-[240px] truncate" title={rm.name || ""}>
                        {rm.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px]">
                        {resolveVendorLabel(activeVendors, rm)}
                      </TableCell>
                      <TableCell className="text-sm">{rm.prodArea || "—"}</TableCell>
                      <TableCell>{actions("rmCode", rm)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
            {(entityType === "packaging" || entityType === "rmCode") && (
              <div>
                <Label>Vendor</Label>
                <SearchableSelect
                  value={vendorCloudId}
                  onValueChange={setVendorCloudId}
                  options={activeVendors.map((vendor) => ({ value: vendor.cloudId, label: vendor.name }))}
                  placeholder="Ketik nama vendor"
                />
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
              <>
                <div>
                  <Label>Prod Area</Label>
                  <Input
                    value={prodArea}
                    onChange={(event) => setProdArea(event.target.value)}
                  />
                </div>
                <div>
                  <Label>Tanggal terbit</Label>
                  <Input
                    type="date"
                    value={issuedAt}
                    onChange={(event) => setIssuedAt(event.target.value)}
                  />
                </div>
              </>
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

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nonaktifkan data</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleting ? `Masukkan alasan untuk menonaktifkan ${deleting.row.name}.` : ""}
          </p>
          <div className="space-y-2">
            <Label htmlFor="delete-reason">Alasan</Label>
            <Input
              id="delete-reason"
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="Minimal 3 karakter"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => void remove()}>Nonaktifkan</Button>
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
