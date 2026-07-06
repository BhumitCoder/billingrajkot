import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  getBills,
  getBillReturns,
  getInventoryTransactions,
  getInventoryUnits,
  getPurchaseBills,
} from "@/lib/storage";
import { formatCurrency, formatDate } from "@/lib/billUtils";
import {
  Bill,
  BillReturn,
  InventoryTransaction,
  InventoryUnit,
  PurchaseBill,
} from "@/types";
import {
  Search,
  Smartphone,
  Receipt,
  ShoppingCart,
  Clock3,
  RotateCcw,
  PackageCheck,
  PackageX,
} from "lucide-react";

type DeviceEvent = {
  id: string;
  date: string;
  type: "purchase" | "sale" | "return" | "inventory" | "status";
  title: string;
  subtitle?: string;
  amount?: number;
  linkTo?: string;
  detailLines?: string[];
};

const normalizeImei = (value?: string) =>
  (value || "").toString().replace(/\s+/g, "").trim().toLowerCase();

const EVENT_ORDER: Record<DeviceEvent["type"], number> = {
  purchase: 0,
  inventory: 1,
  sale: 2,
  return: 3,
  status: 4,
};

export default function IMEITimeline() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [billReturns, setBillReturns] = useState<BillReturn[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [u, pb, sb, br, tx] = await Promise.all([
          getInventoryUnits(),
          getPurchaseBills(),
          getBills(),
          getBillReturns(),
          getInventoryTransactions(),
        ]);
        const navState = location.state as { selectedUnitId?: string } | null;
        if (navState?.selectedUnitId) {
          setSelectedUnitId(navState.selectedUnitId);
        }
        const sortedUnits = [...u].sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime(),
        );
        setUnits(sortedUnits);
        setPurchaseBills(pb);
        setBills(sb);
        setBillReturns(br);
        setTransactions(tx);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const imeiUnits = useMemo(
    () =>
      units.filter((u) =>
        Boolean(normalizeImei(u.imeiNormalized || u.imeiNumber)) || Boolean(u.serialNumber),
      ),
    [units],
  );

  const filteredUnits = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return imeiUnits;
    return imeiUnits.filter((u) =>
      [
        u.imeiNumber,
        u.imeiNormalized,
        u.serialNumber,
        u.productName,
        u.variantKey,
        u.vendorName,
        u.status,
        u.purchaseBillId,
        u.soldBillId,
        u.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [query, imeiUnits]);

  const selectedUnit = useMemo(() => {
    if (!filteredUnits.length) return null;
    if (selectedUnitId) {
      const found = filteredUnits.find((u) => u.id === selectedUnitId);
      if (found) return found;
    }
    return filteredUnits[0];
  }, [filteredUnits, selectedUnitId]);

  useEffect(() => {
    if (!selectedUnit) {
      setSelectedUnitId("");
      return;
    }
    if (selectedUnitId !== selectedUnit.id) {
      setSelectedUnitId(selectedUnit.id);
    }
  }, [selectedUnit, selectedUnitId]);

  // Scroll selected unit into view when it changes (e.g. from GlobalSearch navigation)
  useEffect(() => {
    if (!selectedUnitId) return;
    const el = itemRefs.current[selectedUnitId];
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [selectedUnitId, loading]);

  const events = useMemo(() => {
    if (!selectedUnit) return [] as DeviceEvent[];
    const selectedImei = normalizeImei(
      selectedUnit.imeiNormalized || selectedUnit.imeiNumber,
    );
    const selectedDisplayName = [
      selectedUnit.productName,
      selectedUnit.model,
      selectedUnit.storage,
      selectedUnit.color,
    ]
      .filter(Boolean)
      .join(" | ");
    const list: DeviceEvent[] = [];
    const seenEventIds = new Set<string>();
    const pushEvent = (event: DeviceEvent) => {
      if (seenEventIds.has(event.id)) return;
      seenEventIds.add(event.id);
      list.push(event);
    };

    if (selectedUnit.purchaseBillId) {
      const pb = purchaseBills.find((b) => b.id === selectedUnit.purchaseBillId);
      if (pb) {
        pushEvent({
          id: `purchase-bill-${pb.id}`,
          date: pb.billDate || pb.createdAt,
          type: "purchase",
          title: "Purchased",
          subtitle: `Vendor: ${pb.vendorName}${pb.billNumber ? ` | Bill #${pb.billNumber}` : ""}`,
          amount: selectedUnit.purchasePrice || pb.total,
          linkTo: `/purchases?id=${pb.id}`,
          detailLines: [
            selectedDisplayName || "Device entry",
            selectedUnit.imeiNumber ? `IMEI: ${selectedUnit.imeiNumber}` : "",
            selectedUnit.purchasePrice
              ? `Buy Price: ${formatCurrency(selectedUnit.purchasePrice)}`
              : "",
            selectedUnit.sellingPrice
              ? `Sell Price: ${formatCurrency(selectedUnit.sellingPrice)}`
              : "",
            `Bill: ${selectedUnit.withBill === false ? "Without Bill" : "With Bill"}`,
          ].filter(Boolean),
        });
      }
    }

    if (selectedUnit.soldBillId) {
      const sb = bills.find((b) => b.id === selectedUnit.soldBillId);
      if (sb) {
        const soldItem = sb.items.find(
          (i) =>
            normalizeImei(i.imeiNumber) === selectedImei,
        );
        pushEvent({
          id: `sale-bill-${sb.id}`,
          date: sb.date || sb.createdAt,
          type: "sale",
          title: "Sold",
          subtitle: `Client: ${sb.client?.name || "N/A"} | Bill #${sb.billNumber}`,
          amount: soldItem?.ratePerUnit || sb.total,
          linkTo: `/bills/${sb.id}`,
          detailLines: [
            soldItem?.model || selectedUnit.model || selectedUnit.productName,
            soldItem?.imeiNumber ? `IMEI: ${soldItem.imeiNumber}` : "",
            soldItem?.storage || soldItem?.color
              ? [soldItem?.storage, soldItem?.color].filter(Boolean).join(" / ")
              : "",
            typeof soldItem?.purchasePrice === "number"
              ? `Cost: ${formatCurrency(soldItem.purchasePrice)}`
              : "",
          ].filter(Boolean),
        });
      }
    }

    billReturns.forEach((billReturn) => {
      const matchedReturnItem = (billReturn.items || []).find((item) => {
        if (
          item.inventoryUnitId &&
          selectedUnit.id &&
          item.inventoryUnitId === selectedUnit.id
        ) {
          return true;
        }
        return normalizeImei(item.imeiNumber) === selectedImei;
      });

      if (!matchedReturnItem) {
        return;
      }

      const originalBill = bills.find((bill) => bill.id === billReturn.billId);
      const originalSoldItem = originalBill?.items.find(
        (item) =>
          (matchedReturnItem.inventoryUnitId &&
            item.inventoryUnitId === matchedReturnItem.inventoryUnitId) ||
          normalizeImei(item.imeiNumber) === normalizeImei(matchedReturnItem.imeiNumber),
      );

      pushEvent({
        id: `return-${billReturn.id}-${matchedReturnItem.inventoryUnitId || matchedReturnItem.imeiNumber || matchedReturnItem.productId}`,
        date: billReturn.returnDate || billReturn.createdAt,
        type: "return",
        title:
          matchedReturnItem.condition === "good"
            ? "Returned Good"
            : "Returned Bad",
        subtitle: `Client: ${billReturn.clientName} | Bill #${billReturn.billNumber}`,
        amount:
          typeof originalSoldItem?.ratePerUnit === "number"
            ? originalSoldItem.ratePerUnit
            : undefined,
        linkTo: originalBill ? `/bills/${originalBill.id}` : undefined,
        detailLines: [
          selectedDisplayName || matchedReturnItem.productName,
          matchedReturnItem.imeiNumber
            ? `IMEI: ${matchedReturnItem.imeiNumber}`
            : "",
          matchedReturnItem.condition === "good"
            ? "Moved back to inventory"
            : "Moved to deadstock",
          matchedReturnItem.returnReason
            ? `Reason: ${matchedReturnItem.returnReason}`
            : "",
          billReturn.refundPaidAmount
            ? `Refund Paid: ${formatCurrency(billReturn.refundPaidAmount)}`
            : "",
        ].filter(Boolean),
      });
    });

    const matchingTransactions = transactions.filter((t) => {
      if (t.inventoryUnitId && t.inventoryUnitId === selectedUnit.id) return true;
      return normalizeImei(t.imeiNumber) === selectedImei;
    });

    const saleTxWithBill = matchingTransactions.find(
      (t) => t.type === "sale" && t.billId,
    );
    if (
      saleTxWithBill?.billId &&
      !seenEventIds.has(`sale-bill-${saleTxWithBill.billId}`)
    ) {
      const sb = bills.find((b) => b.id === saleTxWithBill.billId);
      if (sb) {
        const soldItem =
          sb.items.find(
            (i) =>
              (saleTxWithBill.inventoryUnitId &&
                i.inventoryUnitId === saleTxWithBill.inventoryUnitId) ||
              normalizeImei(i.imeiNumber) === selectedImei,
          ) ||
          sb.items.find((i) => i.productId === selectedUnit.productId);
        pushEvent({
          id: `sale-bill-${sb.id}`,
          date: sb.date || sb.createdAt,
          type: "sale",
          title: "Sold",
          subtitle: `Client: ${sb.client?.name || "N/A"} | Bill #${sb.billNumber}`,
          amount: soldItem?.ratePerUnit || saleTxWithBill.sellingPrice || sb.total,
          linkTo: `/bills/${sb.id}`,
          detailLines: [
            soldItem?.model || selectedUnit.model || selectedUnit.productName,
            soldItem?.imeiNumber || saleTxWithBill.imeiNumber
              ? `IMEI: ${soldItem?.imeiNumber || saleTxWithBill.imeiNumber}`
              : "",
            soldItem?.storage || soldItem?.color
              ? [soldItem?.storage, soldItem?.color].filter(Boolean).join(" / ")
              : "",
            typeof soldItem?.purchasePrice === "number"
              ? `Cost: ${formatCurrency(soldItem.purchasePrice)}`
              : saleTxWithBill.purchasePrice
                ? `Cost: ${formatCurrency(saleTxWithBill.purchasePrice)}`
                : "",
            soldItem?.ratePerUnit || saleTxWithBill.sellingPrice
              ? `Sold Price: ${formatCurrency(
                  soldItem?.ratePerUnit || saleTxWithBill.sellingPrice || 0,
                )}`
              : "",
          ].filter(Boolean),
        });
      }
    }

    const purchaseTxWithBill = matchingTransactions.find(
      (t) => t.type === "purchase" && t.billId,
    );
    if (
      purchaseTxWithBill?.billId &&
      !seenEventIds.has(`purchase-bill-${purchaseTxWithBill.billId}`)
    ) {
      const pb = purchaseBills.find((b) => b.id === purchaseTxWithBill.billId);
      if (pb) {
        pushEvent({
          id: `purchase-bill-${pb.id}`,
          date: pb.billDate || pb.createdAt,
          type: "purchase",
          title: "Purchased",
          subtitle: `Vendor: ${pb.vendorName}${pb.billNumber ? ` | Bill #${pb.billNumber}` : ""}`,
          amount:
            purchaseTxWithBill.purchasePrice || selectedUnit.purchasePrice || pb.total,
          linkTo: `/purchases?id=${pb.id}`,
          detailLines: [
            selectedDisplayName || "Device entry",
            purchaseTxWithBill.imeiNumber || selectedUnit.imeiNumber
              ? `IMEI: ${purchaseTxWithBill.imeiNumber || selectedUnit.imeiNumber}`
              : "",
            purchaseTxWithBill.purchasePrice || selectedUnit.purchasePrice
              ? `Buy Price: ${formatCurrency(
                  purchaseTxWithBill.purchasePrice || selectedUnit.purchasePrice || 0,
                )}`
              : "",
            selectedUnit.sellingPrice
              ? `Sell Price: ${formatCurrency(selectedUnit.sellingPrice)}`
              : "",
            `Bill: ${selectedUnit.withBill === false ? "Without Bill" : "With Bill"}`,
          ].filter(Boolean),
        });
      }
    }

    matchingTransactions.forEach((t) => {
      if (
        (t.type === "purchase" && t.billId) ||
        (t.type === "sale" && t.billId) ||
        (t.type === "return" && t.billReturnId)
      ) {
        return;
      }

      const inventoryLabel =
        t.type === "purchase_return"
          ? "Purchase Return"
          : t.type === "return"
            ? "Inventory Return"
            : `Inventory ${t.type.replace(/_/g, " ")}`;
      pushEvent({
        id: `tx-${t.id}`,
        date: t.date,
        type: "inventory",
        title: inventoryLabel,
        subtitle: `${t.model || t.itemNo || selectedUnit.productName || t.productId}`,
        amount: t.sellingPrice || t.purchasePrice,
        detailLines: [
          t.imeiNumber ? `IMEI: ${t.imeiNumber}` : "",
          t.storage || t.color
            ? [t.storage, t.color].filter(Boolean).join(" / ")
            : "",
          t.purchasePrice ? `Buy: ${formatCurrency(t.purchasePrice)}` : "",
          t.sellingPrice ? `Sell: ${formatCurrency(t.sellingPrice)}` : "",
          `Txn Type: ${t.type.replace(/_/g, " ")}`,
        ].filter(Boolean),
      });
    });

    pushEvent({
      id: `status-${selectedUnit.id}`,
      date: selectedUnit.updatedAt || selectedUnit.createdAt,
      type: "status",
      title: `Current status: ${selectedUnit.status.replace(/_/g, " ")}`,
      subtitle: "Latest unit state",
      detailLines: [
        selectedDisplayName || "Device entry",
        selectedUnit.imeiNumber ? `IMEI: ${selectedUnit.imeiNumber}` : "",
        selectedUnit.notes ? `Notes: ${selectedUnit.notes}` : "",
      ].filter(Boolean),
    });

    return list.sort(
      (a, b) => {
        const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (timeDiff !== 0) {
          return timeDiff;
        }
        return EVENT_ORDER[a.type] - EVENT_ORDER[b.type];
      },
    );
  }, [selectedUnit, purchaseBills, bills, billReturns, transactions]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <LoadingSpinner
          size="xl"
          text="Loading IMEI timeline..."
          fullScreen
          contentAreaOnly
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-background p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Smartphone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight">IMEI Timeline</h1>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-12">
        <Card className="min-h-0 overflow-hidden lg:col-span-4 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Devices</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search IMEI / model / bill..."
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto space-y-2">
            {filteredUnits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No IMEI units found.</p>
            ) : (
              filteredUnits.map((u) => (
                <button
                  key={u.id}
                  ref={(el) => { itemRefs.current[u.id] = el; }}
                  type="button"
                  onClick={() => setSelectedUnitId(u.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedUnit?.id === u.id
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/30"
                  }`}
                >
                  <p className="truncate text-sm font-semibold">
                    {u.productName || "Unknown"}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {u.serialNumber && u.serialNumber === u.imeiNumber
                      ? `SN: ${u.serialNumber}`
                      : u.serialNumber
                        ? `SN: ${u.serialNumber}${u.imeiNumber ? ` | IMEI: ${u.imeiNumber}` : ""}`
                        : u.imeiNumber}
                    {""}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">
                      {u.status.replace(/_/g, " ").toUpperCase()}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(u.updatedAt || u.createdAt)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-h-0 overflow-hidden lg:col-span-8 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Timeline</CardTitle>
            {selectedUnit ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                {selectedUnit.serialNumber && (
                  <p>
                    <span className="font-semibold text-foreground">SN:</span>{" "}
                    <span className="font-mono">{selectedUnit.serialNumber}</span>
                  </p>
                )}
                {selectedUnit.imeiNumber && selectedUnit.imeiNumber !== selectedUnit.serialNumber && (
                  <p>
                    <span className="font-semibold text-foreground">IMEI 1:</span>{" "}
                    <span className="font-mono">{selectedUnit.imeiNumber}</span>
                  </p>
                )}
                <p>
                  <span className="font-semibold text-foreground">Product:</span>{" "}
                  {selectedUnit.productName}
                </p>
                <p>
                  <span className="font-semibold text-foreground">Variant:</span>{" "}
                  {[selectedUnit.model, selectedUnit.storage, selectedUnit.color]
                    .filter(Boolean)
                    .join(" / ") || "-"}
                </p>
                <p>
                  <span className="font-semibold text-foreground">Status:</span>{" "}
                  {selectedUnit.status.replace(/_/g, " ")}
                </p>
                <p>
                  <span className="font-semibold text-foreground">Bill:</span>{" "}
                  {selectedUnit.withBill === false ? "Without Bill" : "With Bill"}
                </p>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto">
            {!selectedUnit ? (
              <p className="text-sm text-muted-foreground">
                Select a device to view timeline.
              </p>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No timeline events available for this IMEI yet.
              </p>
            ) : (
              <div className="space-y-3">
                {events.map((e) => (
                  <div key={e.id} className="rounded-xl border border-border/60 p-3">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {e.type === "purchase" ? (
                          <ShoppingCart className="h-4 w-4 text-emerald-600" />
                        ) : e.type === "sale" ? (
                          <Receipt className="h-4 w-4 text-blue-600" />
                        ) : e.type === "return" ? (
                          <RotateCcw className="h-4 w-4 text-amber-600" />
                        ) : e.type === "status" ? (
                          <PackageCheck className="h-4 w-4 text-violet-600" />
                        ) : (
                          <Smartphone className="h-4 w-4 text-slate-600" />
                        )}
                        <p className="text-sm font-semibold">{e.title}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {e.type}
                      </Badge>
                    </div>
                    {e.subtitle ? (
                      <p className="text-xs text-muted-foreground">{e.subtitle}</p>
                    ) : null}
                    {e.detailLines && e.detailLines.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {e.detailLines.map((line, index) => (
                          <p
                            key={`${e.id}-detail-${index}`}
                            className="text-xs text-muted-foreground"
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Clock3 className="h-3 w-3" />
                        {formatDate(e.date)}
                      </span>
                      {typeof e.amount === "number" ? (
                        <span className="font-medium">{formatCurrency(e.amount)}</span>
                      ) : null}
                    </div>
                    {e.linkTo ? (
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => navigate(e.linkTo!)}
                        >
                          {e.type === "purchase" ? (
                            <ShoppingCart className="mr-1 h-3 w-3" />
                          ) : (
                            <Receipt className="mr-1 h-3 w-3" />
                          )}
                          Open Document
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

