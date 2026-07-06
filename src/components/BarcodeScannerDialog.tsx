import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  ScanBarcode,
  CheckCircle2,
  XCircle,
  Usb,
  Bluetooth,
  Wifi,
  RotateCcw,
  Loader2,
  Unplug,
} from "lucide-react";
import type { InventoryUnit, Product } from "@/types";

// ── Types ──────────────────────────────────────────────────────
type Phase = "detecting" | "ready" | "reviewing";
type ScannerStatus = "checking" | "connected" | "not_found" | "not_supported";

interface Props {
  open: boolean;
  onClose: () => void;
  inventoryUnits: InventoryUnit[];
  products: Product[];
  alreadyAddedUnitIds: string[];
  onAddItem: (unit: InventoryUnit, product: Product) => void;
}

// ── Helpers ────────────────────────────────────────────────────
const norm = (s: string) => (s || "").replace(/\s+/g, "").toLowerCase();

function findUnit(
  raw: string,
  units: InventoryUnit[],
  excludeIds: string[],
): InventoryUnit | null {
  const n = norm(raw);
  return (
    units.find(
      (u) =>
        u.status === "in_stock" &&
        !excludeIds.includes(u.id) &&
        (norm(u.imeiNumber || "") === n ||
          norm(u.serialNumber || "") === n),
    ) ?? null
  );
}

function fmtPrice(n?: number) {
  if (!n) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// ── Scanner detection via Web HID API ─────────────────────────
async function detectHIDScanner(): Promise<{
  status: ScannerStatus;
  name: string | null;
}> {
  if (!("hid" in navigator)) return { status: "not_supported", name: null };
  try {
    const devices: any[] = await (navigator as any).hid.getDevices();
    if (devices.length > 0) {
      return {
        status: "connected",
        name: devices[0].productName || "USB HID Device",
      };
    }
    return { status: "not_found", name: null };
  } catch {
    return { status: "not_found", name: null };
  }
}

async function requestHIDScanner(): Promise<string | null> {
  if (!("hid" in navigator)) return null;
  try {
    const devices: any[] = await (navigator as any).hid.requestDevice({
      filters: [],
    });
    if (devices.length > 0)
      return devices[0].productName || "USB HID Device";
  } catch {
    /* user cancelled */
  }
  return null;
}

// ── Component ──────────────────────────────────────────────────
export function BarcodeScannerDialog({
  open,
  onClose,
  inventoryUnits,
  products,
  alreadyAddedUnitIds,
  onAddItem,
}: Props) {
  const [phase, setPhase] = useState<Phase>("detecting");
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("checking");
  const [scannerName, setScannerName] = useState<string | null>(null);
  const [scanValue, setScanValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scannedUnit, setScannedUnit] = useState<InventoryUnit | null>(null);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  // Track inter-keystroke timing to detect scanner (vs manual typing)
  const keyTimesRef = useRef<number[]>([]);
  const lastKeyTimeRef = useRef<number>(0);

  // ── Reset & detect on open ─────────────────────────────────
  useEffect(() => {
    if (!open) {
      // Reset all state when closed
      setPhase("detecting");
      setScannerStatus("checking");
      setScannerName(null);
      setScanValue("");
      setError(null);
      setScannedUnit(null);
      setScannedProduct(null);
      keyTimesRef.current = [];
      lastKeyTimeRef.current = 0;
      return;
    }
    (async () => {
      const result = await detectHIDScanner();
      setScannerStatus(result.status);
      setScannerName(result.name);
      setPhase("ready");
    })();
  }, [open]);

  // ── Focus input when ready ─────────────────────────────────
  useEffect(() => {
    if (phase === "ready" && open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [phase, open]);

  // ── Connect scanner (first-time HID authorisation) ─────────
  const handleConnectScanner = async () => {
    const name = await requestHIDScanner();
    if (name) {
      setScannerName(name);
      setScannerStatus("connected");
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Disconnect scanner (revoke HID permission) ─────────────
  const handleDisconnectScanner = async () => {
    if (!("hid" in navigator)) return;
    try {
      const devices: any[] = await (navigator as any).hid.getDevices();
      for (const device of devices) {
        if (device.forget) await device.forget();
      }
    } catch { /* ignore */ }
    setScannerName(null);
    setScannerStatus("not_found");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Process scanned / typed value ─────────────────────────
  const processValue = (raw: string) => {
    const trimmed = raw.trim();
    setScanValue("");
    keyTimesRef.current = [];
    lastKeyTimeRef.current = 0;
    setError(null);
    if (!trimmed) return;

    const unit = findUnit(trimmed, inventoryUnits, alreadyAddedUnitIds);
    if (!unit) {
      if (alreadyAddedUnitIds.some((id) => {
        const u = inventoryUnits.find((u) => u.id === id);
        return u && norm(u.imeiNumber || "") === norm(trimmed);
      })) {
        setError("This device is already added to the bill");
      } else {
        setError(`No in-stock device found for barcode: ${trimmed}`);
      }
      return;
    }

    const product = products.find((p) => p.id === unit.productId);
    if (!product) {
      setError("Product not found for this device");
      return;
    }

    setScannedUnit(unit);
    setScannedProduct(product);
    setPhase("reviewing");
  };

  // ── Input handlers ─────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const now = Date.now();
    if (lastKeyTimeRef.current > 0) {
      keyTimesRef.current.push(now - lastKeyTimeRef.current);
    }
    lastKeyTimeRef.current = now;

    const val = e.target.value;
    setScanValue(val);

    // Auto-submit if scanner detected (fast input: avg < 30ms/char)
    if (val.length >= 8 && keyTimesRef.current.length >= 4) {
      const recent = keyTimesRef.current.slice(-4);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      if (avg < 30) {
        // Scanner mode — wait a tick for remaining chars then submit
        setTimeout(() => {
          setScanValue((cur) => { processValue(cur); return ""; });
        }, 60);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      processValue(scanValue);
    }
  };

  // ── Confirm — add device to bill ───────────────────────────
  const handleConfirm = () => {
    if (!scannedUnit || !scannedProduct) return;
    onAddItem(scannedUnit, scannedProduct);
    // Back to ready for next scan
    setPhase("ready");
    setScannedUnit(null);
    setScannedProduct(null);
    setError(null);
  };

  // ── Rescan ─────────────────────────────────────────────────
  const handleRescan = () => {
    setPhase("ready");
    setScannedUnit(null);
    setScannedProduct(null);
    setError(null);
    setScanValue("");
    keyTimesRef.current = [];
    lastKeyTimeRef.current = 0;
  };

  // ── Scanner status badge ───────────────────────────────────
  const StatusBadge = () => {
    // USB scanner explicitly authorised via Web HID
    if (scannerStatus === "connected")
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
              <Usb className="size-3.5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-emerald-700 leading-tight">USB Scanner Connected</p>
              <p className="text-[11px] text-emerald-600 truncate">{scannerName}</p>
            </div>
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
          </div>
          {"hid" in navigator && (
            <button
              onClick={handleDisconnectScanner}
              className="flex items-center gap-1.5 text-[11px] text-destructive/70 hover:text-destructive transition-colors px-1"
            >
              <Unplug className="size-3" />
              Disconnect scanner
            </button>
          )}
        </div>
      );

    // All other cases (Bluetooth, wireless dongle, USB not yet authorised, not supported)
    // — all of them inject keystrokes at the OS level so they work without Web HID
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-1.5">
          <ScanBarcode className="size-3.5 shrink-0" />
          <span className="font-medium">Ready to scan</span>
          <span className="text-blue-500 ml-1">— point scanner at barcode</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground px-1">
          <span className="flex items-center gap-1"><Usb className="size-3" /> USB</span>
          <span className="flex items-center gap-1"><Bluetooth className="size-3" /> Bluetooth</span>
          <span className="flex items-center gap-1"><Wifi className="size-3" /> Wireless dongle</span>
          {"hid" in navigator && (
            <button
              onClick={handleConnectScanner}
              className="ml-auto text-blue-600 underline underline-offset-2 hover:text-blue-700 font-medium"
            >
              Authorise USB
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ScanBarcode className="size-4 text-primary" />
            Barcode Scanner
          </DialogTitle>
        </DialogHeader>

        {/* ── DETECTING ── */}
        {phase === "detecting" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Checking for scanner...</p>
          </div>
        )}

        {/* ── READY ── */}
        {phase === "ready" && (
          <div className="space-y-3">
            <StatusBadge />

            {/* Scan input */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Scan the barcode or type the IMEI / serial number and press Enter
              </p>
              <div className="relative">
                <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-primary/60" />
                <input
                  ref={inputRef}
                  value={scanValue}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Scan or type IMEI..."
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full h-10 pl-9 pr-3 text-sm font-mono border-2 border-primary/30 rounded-xl bg-primary/5 outline-none focus:border-primary/60 focus:ring-0 transition-colors"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <XCircle className="size-3.5 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── REVIEWING ── */}
        {phase === "reviewing" && scannedUnit && scannedProduct && (
          <div className="space-y-3">
            {/* Scanned badge */}
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-semibold text-emerald-600">Device Scanned</span>
              <Badge variant="outline" className="text-[10px] ml-auto">In Stock</Badge>
            </div>

            {/* Device details card */}
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2.5">
              {/* Name */}
              <div>
                <p className="text-sm font-bold leading-tight">
                  {[scannedUnit.model || scannedProduct.name, scannedUnit.storage, scannedUnit.color]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {scannedProduct.name !== (scannedUnit.model || scannedProduct.name) && (
                  <p className="text-xs text-muted-foreground mt-0.5">{scannedProduct.name}</p>
                )}
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div>
                  <span className="text-muted-foreground">IMEI 1</span>
                  <p className="font-mono font-semibold">{scannedUnit.imeiNumber || "—"}</p>
                </div>
                {scannedUnit.serialNumber && (
                  <div>
                    <span className="text-muted-foreground">Serial No.</span>
                    <p className="font-mono font-semibold">{scannedUnit.serialNumber}</p>
                  </div>
                )}
                {scannedUnit.batteryHealth && (
                  <div>
                    <span className="text-muted-foreground">Battery Health</span>
                    <p className="font-semibold">{scannedUnit.batteryHealth}</p>
                  </div>
                )}
                {scannedUnit.warranty && (
                  <div>
                    <span className="text-muted-foreground">Warranty</span>
                    <p className="font-semibold">{scannedUnit.warranty}</p>
                  </div>
                )}
                {scannedUnit.vendorName && (
                  <div>
                    <span className="text-muted-foreground">Vendor</span>
                    <p className="font-semibold truncate">{scannedUnit.vendorName}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Purchase Price</span>
                  <p className="font-semibold">{fmtPrice(scannedUnit.purchasePrice)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Selling Price</span>
                  <p className="font-semibold text-primary">
                    {fmtPrice(
                      scannedUnit.sellingPrice && scannedUnit.sellingPrice > 0
                        ? scannedUnit.sellingPrice
                        : scannedProduct.sellingPrice,
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/5"
                onClick={handleRescan}
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                Not Correct
              </Button>
              <Button className="flex-1" onClick={handleConfirm}>
                <CheckCircle2 className="size-3.5 mr-1.5" />
                Correct — Add
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
