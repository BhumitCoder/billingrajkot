import { useState, useEffect, useRef, useCallback } from "react";
import { getInventoryUnits } from "@/lib/firebaseService";
import type { InventoryUnit } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ScanBarcode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  PackageSearch,
  Loader2,
  Search,
  ClipboardCheck,
  Usb,
  Bluetooth,
  Wifi,
  Unplug,
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

// ── Types ──────────────────────────────────────────────────────
type Phase = "idle" | "loading" | "scanning" | "done";
type FeedbackType = "success" | "error" | "warning";
type ScannerStatus = "connected" | "not_found" | "not_supported";

interface Feedback {
  type: FeedbackType;
  message: string;
}

interface AuditSession {
  startedAt: string;
  scannedIds: string[];
}

const STORAGE_KEY = "stockAuditSession";
const norm = (s: string) => (s || "").replace(/\s+/g, "").toLowerCase();

function deviceLabel(u: InventoryUnit) {
  return [u.model || u.productName, u.storage, u.color].filter(Boolean).join(" | ");
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

// ── Component ──────────────────────────────────────────────────
export default function StockAudit() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [allUnits, setAllUnits] = useState<InventoryUnit[]>([]);
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [sessionStart, setSessionStart] = useState<string>("");
  const [scanValue, setScanValue] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [savedSession, setSavedSession] = useState<AuditSession | null>(null);

  // Scanner state
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("not_found");
  const [scannerName, setScannerName] = useState<string | null>(null);
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const keyTimesRef = useRef<number[]>([]);
  const lastKeyTimeRef = useRef<number>(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load saved session on mount ────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedSession(JSON.parse(raw));
    } catch { /* ignore */ }
    detectScanner();
  }, []);

  // ── Auto-focus input when scanning ────────────────────────
  useEffect(() => {
    if (phase === "scanning") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase]);

  // ── Scanner detection ──────────────────────────────────────
  const detectScanner = async () => {
    if (!("hid" in navigator)) {
      setScannerStatus("not_supported");
      return;
    }
    try {
      const devices: any[] = await (navigator as any).hid.getDevices();
      if (devices.length > 0) {
        setScannerStatus("connected");
        setScannerName(devices[0].productName || "USB HID Device");
      } else {
        setScannerStatus("not_found");
        setScannerName(null);
      }
    } catch {
      setScannerStatus("not_found");
      setScannerName(null);
    }
  };

  const handleConnectScanner = async () => {
    if (!("hid" in navigator)) return;
    try {
      const devices: any[] = await (navigator as any).hid.requestDevice({ filters: [] });
      if (devices.length > 0) {
        setScannerStatus("connected");
        setScannerName(devices[0].productName || "USB HID Device");
      }
    } catch { /* user cancelled */ }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleDisconnectScanner = async () => {
    if (!("hid" in navigator)) return;
    try {
      const devices: any[] = await (navigator as any).hid.getDevices();
      for (const device of devices) {
        if (device.forget) await device.forget();
      }
    } catch { /* ignore */ }
    setScannerStatus("not_found");
    setScannerName(null);
    setScannerDialogOpen(false);
  };

  // ── Show feedback briefly ──────────────────────────────────
  const showFeedback = useCallback((fb: Feedback) => {
    setFeedback(fb);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 2500);
  }, []);

  // ── Load inventory ─────────────────────────────────────────
  const loadInventory = async (): Promise<InventoryUnit[]> => {
    const all = await getInventoryUnits();
    return all.filter((u) => u.status === "in_stock");
  };

  // ── Start new audit ────────────────────────────────────────
  const startNewAudit = async () => {
    setPhase("loading");
    try {
      const units = await loadInventory();
      const now = new Date().toISOString();
      localStorage.removeItem(STORAGE_KEY);
      setAllUnits(units);
      setScannedIds(new Set());
      setSessionStart(now);
      setSavedSession(null);
      setSearchQuery("");
      setFeedback(null);
      setPhase("scanning");
    } catch {
      setPhase("idle");
    }
  };

  // ── Resume saved session ───────────────────────────────────
  const resumeSession = async () => {
    if (!savedSession) return;
    setPhase("loading");
    try {
      const units = await loadInventory();
      setAllUnits(units);
      setScannedIds(new Set(savedSession.scannedIds));
      setSessionStart(savedSession.startedAt);
      setSearchQuery("");
      setFeedback(null);
      setPhase("scanning");
    } catch {
      setPhase("idle");
    }
  };

  // ── Process scanned barcode ────────────────────────────────
  const processBarcode = useCallback((raw: string) => {
    const trimmed = raw.trim();
    keyTimesRef.current = [];
    lastKeyTimeRef.current = 0;
    if (!trimmed) return;

    const n = norm(trimmed);
    const unit = allUnits.find(
      (u) =>
        norm(u.imeiNumber || "") === n ||
        norm(u.serialNumber || "") === n,
    );

    if (!unit) {
      showFeedback({ type: "error", message: `Not found in stock: ${trimmed}` });
      return;
    }

    if (scannedIds.has(unit.id)) {
      showFeedback({ type: "warning", message: `Already scanned: ${deviceLabel(unit)}` });
      return;
    }

    const newScanned = new Set(scannedIds);
    newScanned.add(unit.id);
    setScannedIds(newScanned);

    const session: AuditSession = {
      startedAt: sessionStart,
      scannedIds: [...newScanned],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    showFeedback({ type: "success", message: `✓ ${deviceLabel(unit)}` });
  }, [allUnits, scannedIds, sessionStart, showFeedback]);

  // ── Input: keystroke timing detection ─────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const now = Date.now();
    if (lastKeyTimeRef.current > 0) {
      keyTimesRef.current.push(now - lastKeyTimeRef.current);
    }
    lastKeyTimeRef.current = now;

    const val = e.target.value;
    setScanValue(val);

    if (val.length >= 8 && keyTimesRef.current.length >= 4) {
      const recent = keyTimesRef.current.slice(-4);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      if (avg < 30) {
        setTimeout(() => {
          setScanValue((cur) => {
            processBarcode(cur);
            return "";
          });
        }, 60);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      processBarcode(scanValue);
      setScanValue("");
    }
  };

  const handleBlur = () => {
    if (phase === "scanning") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // ── Finish audit ───────────────────────────────────────────
  const finishAudit = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedSession(null);
    setPhase("done");
  };

  // ── Export missing as PDF ──────────────────────────────────
  const exportMissingPDF = () => {
    const missing = allUnits.filter((u) => !scannedIds.has(u.id));
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Stock Audit — Missing Devices", 14, 18);
    doc.setFontSize(9);
    doc.text(`Audit date: ${fmtDateTime(sessionStart)}   |   Scanned: ${scannedIds.size}   |   Missing: ${missing.length}`, 14, 26);

    (doc as any).autoTable({
      startY: 32,
      head: [["#", "Model / Name", "IMEI / SN", "Storage", "Color", "Battery", "Warranty"]],
      body: missing.map((u, i) => [
        i + 1,
        u.model || u.productName,
        u.imeiNumber || "—",
        u.storage || "—",
        u.color || "—",
        u.batteryHealth || "—",
        u.warranty || "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [239, 68, 68] },
    });

    doc.save(`audit_missing_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ── Derived ────────────────────────────────────────────────
  const remaining = allUnits.filter((u) => !scannedIds.has(u.id));
  const missing = remaining;

  const filteredRemaining = remaining.filter((u) => {
    if (!searchQuery) return true;
    const q = norm(searchQuery);
    return (
      norm(u.model || u.productName).includes(q) ||
      norm(u.imeiNumber || "").includes(q) ||
      norm(u.storage || "").includes(q) ||
      norm(u.color || "").includes(q)
    );
  });

  const feedbackClasses = feedback
    ? feedback.type === "success"
      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
      : feedback.type === "warning"
        ? "bg-amber-50 border-amber-300 text-amber-700"
        : "bg-red-50 border-red-300 text-red-700"
    : "";

  // ── Header subtitle ────────────────────────────────────────
  const headerSubtitle =
    phase === "scanning"
      ? `${scannedIds.size} scanned · ${remaining.length} remaining of ${allUnits.length}`
      : phase === "done"
        ? `Audit complete · ${scannedIds.size} scanned · ${missing.length} missing`
        : "Scan every device to audit your stock";

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-slate-50/40 p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          {/* Left: icon + title */}
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">
                Stock Audit
              </h1>
              <p className="text-sm text-muted-foreground">{headerSubtitle}</p>
            </div>
          </div>

          {/* Right: scanner badge + action */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Scanner connection badge */}
            <button
              onClick={() => setScannerDialogOpen(true)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-75 ${
                scannerStatus === "connected"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700"
                  : "bg-muted/50 border-border text-muted-foreground"
              }`}
            >
              <Usb className="size-3.5 shrink-0" />
              {scannerStatus === "connected" ? (
                <span className="truncate max-w-[110px]">{scannerName}</span>
              ) : (
                <span>Connect Scanner</span>
              )}
            </button>

            {/* Context action button */}
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-muted/30 p-2">
              {phase === "idle" && (
                <Button size="sm" onClick={startNewAudit} className="gap-1.5 h-9 px-4 text-xs">
                  <ScanBarcode className="size-3.5" />
                  Start New Audit
                </Button>
              )}
              {phase === "loading" && (
                <Button size="sm" disabled className="gap-1.5 h-9 px-4 text-xs">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading...
                </Button>
              )}
              {phase === "scanning" && (
                <Button
                  size="sm"
                  variant={remaining.length === 0 ? "default" : "outline"}
                  onClick={finishAudit}
                  className="gap-1.5 h-9 px-4 text-xs"
                >
                  <ClipboardCheck className="size-3.5" />
                  Finish Audit
                </Button>
              )}
              {phase === "done" && (
                <Button size="sm" variant="outline" onClick={startNewAudit} className="gap-1.5 h-9 px-4 text-xs">
                  <ScanBarcode className="size-3.5" />
                  New Audit
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Scanning stats row */}
        {phase === "scanning" && (
          <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
            <span className="flex items-center gap-1 bg-muted/60 rounded-lg px-2.5 py-1.5">
              <PackageSearch className="size-3.5 text-muted-foreground" />
              <span className="font-semibold">{allUnits.length}</span>
              <span className="text-muted-foreground">total</span>
            </span>
            <span className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1.5 text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              <span className="font-semibold">{scannedIds.size}</span>
              <span>scanned</span>
            </span>
            <span className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 border ${
              remaining.length === 0
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-700"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-700"
            }`}>
              <AlertTriangle className="size-3.5" />
              <span className="font-semibold">{remaining.length}</span>
              <span>remaining</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2 sm:p-4">
        <div className="h-full overflow-y-auto">

          {/* LOADING */}
          {phase === "loading" && (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading inventory...</p>
            </div>
          )}

          {/* IDLE */}
          {phase === "idle" && (
            <div className="flex h-full flex-col items-center justify-center gap-6 py-8">
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm text-muted-foreground max-w-sm">
                  Scan every device in your shop. Anything not scanned at the end is flagged as potentially missing.
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button size="lg" onClick={startNewAudit} className="gap-2">
                  <ScanBarcode className="size-4" />
                  Start New Audit
                </Button>

                {savedSession && (
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <RefreshCw className="size-3.5" />
                      <span>Saved session found</span>
                    </div>
                    <p className="text-xs font-medium">{fmtDateTime(savedSession.startedAt)}</p>
                    <p className="text-xs text-muted-foreground">{savedSession.scannedIds.length} devices scanned so far</p>
                    <Button variant="outline" className="w-full gap-2" onClick={resumeSession}>
                      <RefreshCw className="size-3.5" />
                      Resume Session
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SCANNING */}
          {phase === "scanning" && (
            <div className="flex flex-col gap-4">

              {/* Scan input */}
              <div className="rounded-2xl border-2 border-primary/30 bg-primary/[0.03] p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ScanBarcode className="size-4 text-primary" />
                  <span className="font-medium text-foreground">Scan device barcode</span>
                  <span className="text-muted-foreground">— USB, Bluetooth, or wireless scanner</span>
                </div>

                <input
                  ref={inputRef}
                  value={scanValue}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  placeholder="Scan barcode or type IMEI and press Enter..."
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full h-12 px-4 text-sm font-mono border-2 border-primary/30 rounded-xl bg-background outline-none focus:border-primary/70 focus:ring-0 transition-colors"
                />

                {feedback && (
                  <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${feedbackClasses}`}>
                    {feedback.type === "success" && <CheckCircle2 className="size-3.5 shrink-0" />}
                    {feedback.type === "warning" && <AlertTriangle className="size-3.5 shrink-0" />}
                    {feedback.type === "error" && <XCircle className="size-3.5 shrink-0" />}
                    {feedback.message}
                  </div>
                )}
              </div>

              {/* Remaining devices list */}
              {remaining.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">
                      Remaining — {remaining.length} device{remaining.length !== 1 ? "s" : ""}
                    </p>
                    <div className="relative w-48 sm:w-64">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border overflow-hidden">
                    <div className="overflow-y-auto max-h-[calc(100vh-480px)]">
                      {filteredRemaining.length === 0 ? (
                        <p className="text-center py-6 text-xs text-muted-foreground">No matching devices</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                            <tr className="border-b">
                              <th className="text-left px-3 py-2 text-xs font-semibold">Device</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold">IMEI</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold hidden sm:table-cell">Storage</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold hidden sm:table-cell">Color</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRemaining.map((u, i) => (
                              <tr
                                key={u.id}
                                className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                              >
                                <td className="px-3 py-2.5">
                                  <p className="text-xs font-medium">{u.model || u.productName}</p>
                                  {(u.batteryHealth || u.warranty) && (
                                    <p className="text-[10px] text-muted-foreground">
                                      {u.batteryHealth && `Batt: ${u.batteryHealth}`}
                                      {u.batteryHealth && u.warranty && " · "}
                                      {u.warranty && `Warranty: ${u.warranty}`}
                                    </p>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                                  {u.imeiNumber || u.serialNumber || "—"}
                                </td>
                                <td className="px-3 py-2.5 text-xs hidden sm:table-cell">{u.storage || "—"}</td>
                                <td className="px-3 py-2.5 text-xs hidden sm:table-cell">{u.color || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* All scanned */}
              {remaining.length === 0 && scannedIds.size > 0 && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <CheckCircle2 className="size-14 text-emerald-500" />
                  <p className="text-lg font-bold text-emerald-600">All {scannedIds.size} devices scanned!</p>
                  <p className="text-sm text-muted-foreground">Tap Finish to see the audit summary.</p>
                </div>
              )}
            </div>
          )}

          {/* DONE */}
          {phase === "done" && (
            <div className="space-y-5">

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border bg-muted/20 p-4 text-center">
                  <p className="text-2xl font-bold">{allUnits.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Stock</p>
                </div>
                <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{scannedIds.size}</p>
                  <p className="text-xs text-emerald-600 mt-1">Scanned ✓</p>
                </div>
                <div className={`rounded-xl border p-4 text-center ${
                  missing.length === 0
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200"
                    : "bg-red-50 dark:bg-red-950/20 border-red-200"
                }`}>
                  <p className={`text-2xl font-bold ${missing.length === 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {missing.length}
                  </p>
                  <p className={`text-xs mt-1 ${missing.length === 0 ? "text-emerald-600" : "text-red-600"}`}>
                    Missing
                  </p>
                </div>
              </div>

              {missing.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <CheckCircle2 className="size-12 text-emerald-500" />
                  <p className="text-lg font-semibold text-emerald-600">All devices accounted for!</p>
                  <p className="text-sm text-muted-foreground">Every in-stock device was scanned successfully.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-red-600 flex items-center gap-2">
                      <AlertTriangle className="size-4" />
                      {missing.length} Potentially Missing Device{missing.length !== 1 ? "s" : ""}
                    </h2>
                    <Button variant="outline" size="sm" onClick={exportMissingPDF} className="gap-1.5 text-xs">
                      <Download className="size-3.5" />
                      Export PDF
                    </Button>
                  </div>

                  <div className="rounded-xl border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="text-left px-3 py-2.5 text-xs font-semibold">#</th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold">Device</th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold">IMEI 1</th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold">Storage</th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold">Color</th>
                          </tr>
                        </thead>
                        <tbody>
                          {missing.map((u, i) => (
                            <tr key={u.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                              <td className="px-3 py-2.5">
                                <p className="text-xs font-semibold">{u.model || u.productName}</p>
                                {u.batteryHealth && <p className="text-[10px] text-amber-600">Batt: {u.batteryHealth}</p>}
                                {u.warranty && <p className="text-[10px] text-blue-600">Warranty: {u.warranty}</p>}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs">{u.imeiNumber || "—"}</td>
                              <td className="px-3 py-2.5 text-xs">{u.storage || "—"}</td>
                              <td className="px-3 py-2.5 text-xs">{u.color || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Scanner Connection Dialog ── */}
      <Dialog open={scannerDialogOpen} onOpenChange={setScannerDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Usb className="size-4 text-primary" />
              Barcode Scanner
            </DialogTitle>
          </DialogHeader>

          {scannerStatus === "connected" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
                  <Usb className="size-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-emerald-700">Connected</p>
                  <p className="text-xs text-emerald-600 truncate">{scannerName}</p>
                </div>
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground">
                This USB scanner is authorised via Web HID. Disconnecting will revoke the browser permission.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setScannerDialogOpen(false)}
                >
                  Close
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-1.5"
                  onClick={handleDisconnectScanner}
                >
                  <Unplug className="size-3.5" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                  <ScanBarcode className="size-3.5 shrink-0" />
                  <span className="font-medium">Ready to scan</span>
                  <span className="text-blue-500 ml-1">— point scanner at barcode</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground px-1">
                  <span className="flex items-center gap-1"><Usb className="size-3" /> USB</span>
                  <span className="flex items-center gap-1"><Bluetooth className="size-3" /> Bluetooth</span>
                  <span className="flex items-center gap-1"><Wifi className="size-3" /> Wireless</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Bluetooth and wireless scanners work automatically. Authorise a USB scanner via Web HID to see its connection status here.
              </p>
              {"hid" in navigator && (
                <Button className="w-full gap-2" onClick={handleConnectScanner}>
                  <Usb className="size-3.5" />
                  Authorise USB Scanner
                </Button>
              )}
              {scannerStatus === "not_supported" && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Web HID not supported in this browser. Use Chrome or Edge for USB scanner status.
                </p>
              )}
              <Button variant="outline" className="w-full" onClick={() => setScannerDialogOpen(false)}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
