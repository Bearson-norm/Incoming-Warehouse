import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../contexts/I18nContext";
import { useAuthStore } from "../store/authStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import api from "../services/api";
import { toast } from "sonner";
import {
  Cloud,
  User,
  RefreshCw,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { CloudScale, CloudStatus, CloudWeighReading } from "../types/weighing";
import { CloudLpnTrace } from "../components/cloud/CloudLpnTrace";
import { CloudMasterDataManager } from "../components/cloud/CloudMasterDataManager";
import { SearchableSelect } from "../components/SearchableSelect";

interface CloudReadingGroup {
  poNumber: string;
  latestIncomingAt: string;
  count: number;
  items: CloudWeighReading[];
}

interface CloudReadingsResponse {
  items: CloudWeighReading[];
  groups?: CloudReadingGroup[];
  total: number;
  limit: number;
  offset: number;
  capped?: boolean;
}

function dayStartIso(value: string): string {
  return new Date(value).toISOString();
}

function dayEndExclusiveIso(value: string): string {
  const end = new Date(value);
  end.setDate(end.getDate() + 1);
  return end.toISOString();
}

const PAGE_SIZE = 25;

export default function CloudServer() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [scales, setScales] = useState<CloudScale[]>([]);
  const [groups, setGroups] = useState<CloudReadingGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [capped, setCapped] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [filterScaleId, setFilterScaleId] = useState("");
  const [filterUsername, setFilterUsername] = useState("");
  const [filterPo, setFilterPo] = useState("");
  const [appliedPo, setAppliedPo] = useState("");
  const [filterLpn, setFilterLpn] = useState("");
  const [appliedLpn, setAppliedLpn] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [newScaleName, setNewScaleName] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, scalesRes, readingsRes] = await Promise.all([
        api.get<CloudStatus>("/cloud/status"),
        api.get<CloudScale[]>("/cloud/scales", {
          params: isAdmin ? { includeInactive: true } : undefined,
        }),
        api.get<CloudReadingsResponse>("/cloud/readings", {
          params: {
            groupBy: "po",
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
            ...(filterScaleId ? { scaleId: Number(filterScaleId) } : {}),
            ...(filterUsername ? { username: filterUsername } : {}),
            ...(appliedPo.trim() ? { poNumber: appliedPo.trim() } : {}),
            ...(appliedLpn.trim() ? { packageUid: appliedLpn.trim() } : {}),
            ...(fromDate ? { from: dayStartIso(fromDate) } : {}),
            ...(toDate ? { to: dayEndExclusiveIso(toDate) } : {}),
          },
        }),
      ]);
      setStatus(statusRes.data);
      setScales(scalesRes.data);
      setGroups(readingsRes.data.groups || []);
      setCapped(Boolean(readingsRes.data.capped));
      setTotal(readingsRes.data.total);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || (error as Error).message;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [appliedLpn, appliedPo, filterScaleId, filterUsername, fromDate, isAdmin, page, toDate]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const setFilter = (setter: (value: string) => void, value: string) => {
    setPage(1);
    setter(value);
  };

  const handleCreateScale = async () => {
    const name = newScaleName.trim();
    if (!name) {
      toast.error(t("pleaseFillAllFields"));
      return;
    }
    try {
      await api.post("/cloud/scales", { name });
      setNewScaleName("");
      toast.success(t("scaleAdded"));
      await loadAll();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || (error as Error).message;
      toast.error(message);
    }
  };

  const handleDeactivateScale = async (id: number) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await api.delete(`/cloud/scales/${id}`);
      toast.success(t("scaleDeleted"));
      await loadAll();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || (error as Error).message;
      toast.error(message);
    }
  };

  const handleRetrySync = async () => {
    setRetrying(true);
    try {
      const { data } = await api.post<{
        retried: number;
        synced: number;
        failed: number;
      }>("/cloud/sync/retry");
      toast.success(`${t("syncStatus")}: ${data.synced}/${data.retried}`);
      await loadAll();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || (error as Error).message;
      toast.error(message);
    } finally {
      setRetrying(false);
    }
  };

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto bg-[#f5ebe0] min-h-full">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl brown-gradient-animated flex items-center justify-center shadow-md">
            <Cloud className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#3e2723]">
              {t("cloudServer")}
            </h1>
            <p className="text-sm text-[#8d6e63]">{t("cloudServerSubtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#d7ccc8] bg-[#fff8f0] px-4 py-2">
          <User className="w-4 h-4 text-[#6d4c41]" />
          <span className="text-sm font-semibold text-[#3e2723]">
            {user?.username}
          </span>
          <span className="text-xs text-[#8d6e63] capitalize">
            ({user?.role})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="border-[#d7ccc8] bg-[#fff8f0]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {status?.online ? (
                <Wifi className="w-4 h-4 text-green-600" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              {t("cloudConnection")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1 text-[#5d4037]">
            <p>{status?.online ? t("cloudOnline") : t("cloudOffline")}</p>
            {status?.serverUrl && (
              <p className="text-xs break-all text-[#8d6e63]">
                {status.serverUrl}
              </p>
            )}
            {status?.stationId && (
              <p className="text-xs text-[#8d6e63]">
                {t("stationId")}: {status.stationId}
              </p>
            )}
            {status?.activeScales != null && (
              <p className="text-xs">
                {t("activeScales")}: {status.activeScales}
              </p>
            )}
            {status?.totalReadings != null && (
              <p className="text-xs">
                {t("totalCloudReadings")}: {status.totalReadings}
              </p>
            )}
            {status?.unsyncedReadings != null && (
              <p className="text-xs">
                Antrean lokal: {status.unsyncedReadings} reading ·{" "}
                {status.unsyncedTraceEvents || 0} event
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#d7ccc8] bg-[#fff8f0] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("filters")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 min-w-[160px]">
              <Label className="text-xs">{t("scale")}</Label>
              <SearchableSelect
                value={filterScaleId}
                onValueChange={(value) => setFilter(setFilterScaleId, value)}
                options={scales.filter((scale) => scale.isActive).map((scale) => ({ value: String(scale.id), label: scale.name }))}
                placeholder={t("allScales")}
                className="h-9"
              />
            </div>
            {isAdmin && (
              <div className="space-y-1 min-w-[160px]">
                <Label className="text-xs">{t("username")}</Label>
                <Input
                  value={filterUsername}
                  onChange={(e) => setFilter(setFilterUsername, e.target.value)}
                  className="h-9"
                  placeholder={t("username")}
                />
              </div>
            )}
            <div className="space-y-1 min-w-[140px]">
              <Label className="text-xs">{t("poNumber")}</Label>
              <Input
                value={filterPo}
                onChange={(e) => setFilterPo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setFilter(setAppliedPo, filterPo);
                }}
                className="h-9 font-mono"
                placeholder={t("poNumber")}
              />
            </div>
            <div className="space-y-1 min-w-[140px]">
              <Label className="text-xs">{t("lpn")}</Label>
              <Input
                value={filterLpn}
                onChange={(e) => setFilterLpn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setFilter(setAppliedLpn, filterLpn);
                }}
                className="h-9 font-mono"
                placeholder={t("lpn")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("dateFrom")}</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFilter(setFromDate, e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("dateTo")}</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setFilter(setToDate, e.target.value)}
                className="h-9"
              />
            </div>
            <Button
              variant="outline"
              className="h-9"
              onClick={() => {
                const unchanged =
                  filterPo === appliedPo && filterLpn === appliedLpn && page === 1;
                setAppliedPo(filterPo);
                setAppliedLpn(filterLpn);
                setPage(1);
                if (unchanged) void loadAll();
              }}
              disabled={loading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              {t("refresh")}
            </Button>
            <Button
              variant="outline"
              className="h-9"
              onClick={() => void handleRetrySync()}
              disabled={retrying}
            >
              <RotateCcw
                className={`w-4 h-4 mr-2 ${retrying ? "animate-spin" : ""}`}
              />
              {t("retrySync")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <CloudLpnTrace />

      {isAdmin && <CloudMasterDataManager />}

      {isAdmin && (
        <Card className="border-[#d7ccc8] bg-[#fff8f0] mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t("manageScales")}</CardTitle>
            <CardDescription>{t("manageScalesHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input
                value={newScaleName}
                onChange={(e) => setNewScaleName(e.target.value)}
                placeholder={t("scaleName")}
                className="max-w-xs h-10"
              />
              <Button
                onClick={() => void handleCreateScale()}
                className="h-10 brown-gradient-animated text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("addScale")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {scales.map((scale) => (
                <div
                  key={scale.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    scale.isActive
                      ? "border-[#d7ccc8] bg-white"
                      : "border-gray-200 bg-gray-50 opacity-60"
                  }`}
                >
                  <span>{scale.name}</span>
                  {scale.isActive && (
                    <button
                      type="button"
                      onClick={() => void handleDeactivateScale(scale.id)}
                      className="text-red-500 hover:text-red-700"
                      aria-label={t("delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {scales.length === 0 && (
                <p className="text-sm text-[#8d6e63]">{t("noScales")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-[#d7ccc8] bg-[#fff8f0]">
        <CardHeader>
          <CardTitle className="text-base">{t("cloudReadings")}</CardTitle>
          <CardDescription>
            {total} {t("totalRecords")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {capped && (
            <p className="mb-3 text-xs text-[#8d6e63]">{t("readingsCapped")}</p>
          )}
          {groups.length === 0 && !loading ? (
            <p className="py-8 text-center text-[#8d6e63]">{t("noCloudReadings")}</p>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => {
                const groupKey = group.poNumber || "__none__";
                const open = !collapsed[groupKey];
                return (
                  <div key={groupKey} className="rounded-lg border border-[#d7ccc8] bg-white">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      onClick={() =>
                        setCollapsed((current) => ({
                          ...current,
                          [groupKey]: !current[groupKey],
                        }))
                      }
                    >
                      <ChevronDown className={`h-4 w-4 text-[#6d4c41] ${open ? "" : "-rotate-90"}`} />
                      <span className="font-semibold text-[#3e2723]">
                        {group.poNumber || t("noPoGroup")}
                      </span>
                      <span className="rounded-full bg-[#f5ebe0] px-2 py-0.5 text-xs text-[#6d4c41]">
                        {t("poGroupCount").split("{count}").join(String(group.count))}
                      </span>
                      <span className="ml-auto text-xs text-[#8d6e63]">
                        {t("poGroupLatest")}: {formatDate(group.latestIncomingAt)}
                      </span>
                    </button>
                    {open && (
                      <div className="overflow-x-auto px-2 pb-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("date")}</TableHead>
                              <TableHead>{t("scale")}</TableHead>
                              <TableHead>{t("username")}</TableHead>
                              <TableHead>{t("lpn")}</TableHead>
                              <TableHead>{t("flowType")}</TableHead>
                              <TableHead>{t("gross")}</TableHead>
                              <TableHead>{t("net")}</TableHead>
                              <TableHead>{t("status")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.items.map((reading) => (
                              <TableRow key={reading.id}>
                                <TableCell className="whitespace-nowrap text-xs">
                                  {formatDate(reading.capturedAt)}
                                </TableCell>
                                <TableCell>{reading.scaleName}</TableCell>
                                <TableCell>{reading.username}</TableCell>
                                <TableCell className="font-mono text-xs">
                                  {reading.packageUid || "—"}
                                </TableCell>
                                <TableCell className="capitalize">
                                  {reading.flowType}
                                </TableCell>
                                <TableCell>
                                  {reading.grossWeight ?? reading.weight} {reading.unit}
                                </TableCell>
                                <TableCell>{reading.netWeight ?? "—"}</TableCell>
                                <TableCell className="capitalize">
                                  {reading.weightStatus || "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eaded3] pt-4 text-sm">
            <span className="text-[#8d6e63]">Halaman {page} dari {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page === 1}>
                Sebelumnya
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={loading || page >= totalPages}>
                Berikutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
