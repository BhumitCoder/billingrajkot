import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { PartyLedgerPDF } from "@/components/PartyLedgerPDF";
import { BusinessReportPDF } from "@/components/BusinessReportPDF";
import { DeviceReportPDF, type DevicePDFRow, type ModelSummaryRow } from "@/components/DeviceReportPDF";
import {
  getBills,
  getPurchaseBills,
  getProducts,
  getClients,
  getVendors,
  getExpenses,
  getPartyPayments,
  getBillReturns,
  getPurchaseReturns,
  getCompanyProfile,
  getInventoryUnits,
} from "@/lib/storage";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";
import {
  Bill,
  PurchaseBill,
  Product,
  Client,
  Vendor,
  Expense,
  PartyPayment,
  BillReturn,
  PurchaseReturn,
  CompanyProfile,
  InventoryUnit,
} from "@/types";
import {
  TrendingUp,
  TrendingDown,
  Package,
  CreditCard,
  Wallet,
  ShoppingCart,
  FileText,
  Search,
  BookOpen,
  ArrowUpCircle,
  ArrowDownCircle,
  CalendarDays,
  Download,
  Loader2,
  BarChart3,
  Users,
  Receipt,
  ChevronLeft,
  ChevronRight,
  X,
  Smartphone,
} from "lucide-react";

// ── Format helpers ──────────────────────────────────────────────
function fmt(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(dateStr: string) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(dateStr: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(dateStr: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

function toEpochMs(value?: string, fallback?: string): number {
  const primary = value ? new Date(value).getTime() : NaN;
  if (Number.isFinite(primary)) return primary;
  const secondary = fallback ? new Date(fallback).getTime() : NaN;
  if (Number.isFinite(secondary)) return secondary;
  return 0;
}

// ── Reusable table shell ────────────────────────────────────────
function ReportTable({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/60 border-b">
            {headers.map((h, i) => (
              <th
                key={i}
                className={`px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[11px] ${
                  i === 0 ? "text-left" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No data found
        </div>
      )}
    </div>
  );
}

// ── Status badge ────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
      : status === "overdue"
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
      : status === "partial"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400";
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 capitalize ${cls}`}>
      {status}
    </Badge>
  );
}

// ── Build party ledger transactions (mirrors ClientDetailScreen logic) ──
function buildPartyLedgerTransactions(
  salesBills: Bill[],
  purchBills: PurchaseBill[],
  saleReturns: BillReturn[],
  purchReturns: PurchaseReturn[],
  partyPayments: PartyPayment[],
  openingSigned: number,
) {
  type Entry = {
    date: string;
    createdAt: string;
    type: string;
    ref: string;
    debit: number;
    credit: number;
  };

  const entries: Entry[] = [
    ...salesBills.map((b) => ({
      date: b.date,
      createdAt: b.createdAt,
      type: "Sale",
      ref: b.billNumber || "-",
      debit: b.total + (b.returnedAmount || 0),
      credit: 0,
    })),
    ...purchBills.map((b) => ({
      date: b.billDate || b.createdAt,
      createdAt: b.createdAt,
      type: "Purchase",
      ref: b.billNumber || "-",
      debit: 0,
      credit: b.total,
    })),
    ...saleReturns.map((r) => ({
      date: r.returnDate || r.createdAt,
      createdAt: r.createdAt,
      type: "Sale Return",
      ref: r.billNumber || "-",
      debit: 0,
      credit: r.totalReturnValue,
    })),
    ...purchReturns.map((r) => ({
      date: r.returnDate || r.createdAt,
      createdAt: r.createdAt,
      type: "Purchase Return",
      ref: r.billNumber || "-",
      debit: r.totalReturnValue,
      credit: 0,
    })),
    ...salesBills.flatMap((b) =>
      (b.payments || []).map((p) => ({
        date: p.date || b.date,
        createdAt: p.date && p.date.length > 10 ? p.date : b.createdAt,
        type: `Payment Collected (${p.method})`,
        ref: b.billNumber || "-",
        debit: 0,
        credit: p.amount,
      }))
    ),
    ...purchBills.flatMap((b) =>
      (b.payments || [])
        .filter((p) => p.amount > 0)
        .map((p) => ({
          date: p.date || b.billDate || b.createdAt,
          createdAt: p.date && p.date.length > 10 ? p.date : b.createdAt,
          type: `Payment Sent (${p.method})`,
          ref: b.billNumber || "-",
          debit: p.amount,
          credit: 0,
        }))
    ),
    ...partyPayments.map((p) => ({
      date: p.date,
      createdAt: p.createdAt,
      type:
        p.type === "collected"
          ? `Party Payment Collected (${p.method})`
          : `Party Payment Sent (${p.method})`,
      ref: p.note || "-",
      debit: p.type === "sent" ? p.amount : 0,
      credit: p.type === "collected" ? p.amount : 0,
    })),
  ].sort((a, b) => {
    const da = toEpochMs(a.date, a.createdAt);
    const db = toEpochMs(b.date, b.createdAt);
    if (da !== db) return da - db;
    return toEpochMs(a.createdAt, a.date) - toEpochMs(b.createdAt, b.date);
  });

  let running = openingSigned;
  return entries.map((e) => {
    running = running + e.debit - e.credit;
    return { date: e.date, type: e.type, reference: e.ref, debit: e.debit, credit: e.credit, balance: running };
  });
}

export default function Report() {
  const [loading, setLoading] = useState(true);
  const [rawBills, setBills] = useState<Bill[]>([]);
  const [rawPurchaseBills, setPurchaseBills] = useState<PurchaseBill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rawExpenses, setExpenses] = useState<Expense[]>([]);
  const [rawPartyPayments, setPartyPayments] = useState<PartyPayment[]>([]);
  const [rawBillReturns, setBillReturns] = useState<BillReturn[]>([]);
  const [rawPurchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [inventoryUnits, setInventoryUnits] = useState<InventoryUnit[]>([]);
  const [partySearch, setPartySearch] = useState("");
  const [selectedParty, setSelectedParty] = useState<Client | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [preparingMainPdf, setPreparingMainPdf] = useState(false);
  const [preparingPartyPdf, setPreparingPartyPdf] = useState(false);
  const [preparingRowPdfId, setPreparingRowPdfId] = useState<string | null>(null);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [deviceDateFrom, setDeviceDateFrom] = useState("");
  const [deviceDateTo, setDeviceDateTo] = useState("");
  const [preparingDevicePdf, setPreparingDevicePdf] = useState(false);
  const [dayBookDate, setDayBookDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { locked, reloadKey } = useEncryptionLock();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (locked) {
        setBills([]);
        setPurchaseBills([]);
        setExpenses([]);
        setPartyPayments([]);
        setBillReturns([]);
        setPurchaseReturns([]);
        setLoading(false);
        return;
      }
      try {
        const [b, pb, p, c, v, e, pp, br, pr, cp, iu] = await Promise.all([
          getBills(),
          getPurchaseBills(),
          getProducts(),
          getClients(),
          getVendors(),
          getExpenses(),
          getPartyPayments(),
          getBillReturns(),
          getPurchaseReturns(),
          getCompanyProfile(),
          getInventoryUnits(),
        ]);
        setBills(b);
        setPurchaseBills(pb);
        setProducts(p);
        setClients(c);
        setVendors(v);
        setExpenses(e.filter((ex) => ex.sourceType !== "purchase_bill_auto"));
        setPartyPayments(pp);
        setBillReturns(br);
        setPurchaseReturns(pr);
        setCompanyProfile(cp);
        setInventoryUnits(iu);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [locked, reloadKey]);

  // ── Date-range filter ──────────────────────────────────────────
  const inRange = (dateStr?: string | null) => {
    if (!dateFrom && !dateTo) return true;
    if (!dateStr) return true;
    const d = new Date(dateStr).getTime();
    const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const to = dateTo ? new Date(dateTo + "T23:59:59.999").getTime() : Infinity;
    return d >= from && d <= to;
  };
  const bills = rawBills.filter((b) => inRange(b.date || b.createdAt));
  const purchaseBills = rawPurchaseBills.filter((b) => inRange(b.billDate || b.createdAt));
  const expenses = rawExpenses.filter((e) => inRange(e.date || e.createdAt));
  const partyPayments = rawPartyPayments.filter((p) => inRange((p as any).date || p.createdAt));
  const billReturns = rawBillReturns.filter((r) => inRange((r as any).date || r.createdAt));
  const purchaseReturns = rawPurchaseReturns.filter((r) => inRange((r as any).date || r.createdAt));
  const isFiltered = !!(dateFrom || dateTo);

  // ── Day Book date helper ────────────────────────────────────────
  const isOnDayBookDate = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const target = new Date(dayBookDate + "T00:00:00");
    return (
      d.getDate() === target.getDate() &&
      d.getMonth() === target.getMonth() &&
      d.getFullYear() === target.getFullYear()
    );
  };
  const todayStr = new Date().toISOString().slice(0, 10);
  const isDayBookToday = dayBookDate === todayStr;

  // ── Net totals ─────────────────────────────────────────────────
  // GST-inclusive total (used for receivables — customer owes full amount)
  const netSaleTotal = (b: Bill) =>
    Math.max(0, (b.total || 0) - ((b.returns || []).reduce((s, r) => s + (r.totalReturnValue || 0), 0)));
  const netPurchaseTotal = (b: PurchaseBill) =>
    Math.max(0, (b.total || 0) - ((b.returns || []).reduce((s, r) => s + (r.totalReturnValue || 0), 0)));
  // Taxable revenue only (used for P&L — excludes GST collected for government)
  const netSaleRevenue = (b: Bill) => {
    const returns = (b.returns || []).reduce((s, r) => s + (r.totalReturnValue || 0), 0);
    const gstTax = (b as any).isGst ? ((b as any).totalTax || 0) : 0;
    return Math.max(0, (b.total || 0) - returns - gstTax);
  };

  const totalSell = bills.reduce((s, b) => s + netSaleRevenue(b), 0);
  const totalGstCollected = bills.reduce(
    (s, b) => s + ((b as any).isGst ? ((b as any).totalTax || 0) : 0), 0
  );
  const totalPurchase = purchaseBills.reduce((s, b) => s + netPurchaseTotal(b), 0);
  const totalReceivable = bills
    .filter((b) => b.paymentStatus !== "paid")
    .reduce((s, b) => s + Math.max(0, netSaleTotal(b) - (b.paidAmount || 0)), 0);
  const totalPayable = purchaseBills
    .filter((b) => b.paymentStatus !== "paid")
    .reduce((s, b) => s + Math.max(0, netPurchaseTotal(b) - (b.paidAmount || 0)), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const grossProfit = totalSell - totalPurchase;
  const netProfit = grossProfit - totalExpenses;

  // ── Cash / Bank ────────────────────────────────────────────────
  const cashReceived = bills.reduce((s, b) => {
    const payments = b.payments || [];
    const totalFwd = payments.reduce((a, p) => a + (p.amount || 0), 0);
    const cashFwd = payments.filter((p) => p.method === "Cash").reduce((a, p) => a + (p.amount || 0), 0);
    const refundTotal = Math.max(0, totalFwd - (b.paidAmount || 0));
    const cashRefund = totalFwd > 0 ? refundTotal * (cashFwd / totalFwd) : 0;
    return s + Math.max(0, cashFwd - cashRefund);
  }, 0);
  const bankReceived = bills.reduce((s, b) => {
    const payments = b.payments || [];
    const totalFwd = payments.reduce((a, p) => a + (p.amount || 0), 0);
    const bankFwd = payments.filter((p) => p.method !== "Cash").reduce((a, p) => a + (p.amount || 0), 0);
    const refundTotal = Math.max(0, totalFwd - (b.paidAmount || 0));
    const bankRefund = totalFwd > 0 ? refundTotal * (bankFwd / totalFwd) : 0;
    return s + Math.max(0, bankFwd - bankRefund);
  }, 0);
  const cashPaid = purchaseBills.reduce(
    (s, b) => s + (b.payments || []).filter((p) => p.method === "Cash").reduce((a, p) => a + (p.amount || 0), 0),
    0,
  );
  const bankPaid = purchaseBills.reduce(
    (s, b) => s + (b.payments || []).filter((p) => p.method !== "Cash").reduce((a, p) => a + (p.amount || 0), 0),
    0,
  );

  // ── Stock ──────────────────────────────────────────────────────
  // Build in-stock unit count per product for serialized items
  const inStockUnitsByProduct = inventoryUnits.reduce<Record<string, number>>((acc, u) => {
    if ((u.status === "in_stock" || u.status === "reserved" || u.status === "returned") && u.productId) {
      acc[u.productId] = (acc[u.productId] || 0) + 1;
    }
    return acc;
  }, {});

  // For serialized products use the InventoryUnit count; for standard use p.stock
  const getEffectiveStock = (p: Product): number => {
    if ((p.trackingType || "standard") === "serialized") {
      return inStockUnitsByProduct[p.id] || 0;
    }
    return Math.max(0, p.stock || 0);
  };

  const stockValue = products.reduce((s, p) => s + getEffectiveStock(p) * (p.purchasePrice || 0), 0);
  const stockItems = products.filter((p) => getEffectiveStock(p) > 0);

  // ── Device (IMEI) Report ────────────────────────────────────────
  const billsById = useMemo(() => new Map(rawBills.map((b) => [b.id, b])), [rawBills]);
  const purchaseBillsById = useMemo(() => new Map(rawPurchaseBills.map((b) => [b.id, b])), [rawPurchaseBills]);

  const deviceRecords = useMemo(() =>
    inventoryUnits.map((unit) => {
      const purchBill = unit.purchaseBillId ? purchaseBillsById.get(unit.purchaseBillId) : undefined;
      const saleBill = unit.soldBillId ? billsById.get(unit.soldBillId) : undefined;
      // Actual sale price from bill item (most accurate)
      let salePrice = unit.sellingPrice || 0;
      if (saleBill) {
        const item = saleBill.items?.find(
          (i) =>
            (i.inventoryUnitId && i.inventoryUnitId === unit.id) ||
            (i.imeiNumber && unit.imeiNumber && i.imeiNumber === unit.imeiNumber),
        );
        if (item) salePrice = item.ratePerUnit || Math.round((item.amount || 0) / Math.max(1, item.quantity || 1));
      }
      const purchasePrice = unit.purchasePrice || 0;
      const profit = salePrice - purchasePrice;
      const purchaseDate = purchBill?.billDate || purchBill?.createdAt || unit.createdAt;
      const saleDate = unit.soldAt || saleBill?.date;
      return { unit, purchBill, saleBill, customerName: saleBill?.client?.name ?? null, salePrice, purchasePrice, profit, purchaseDate, saleDate };
    }),
    [inventoryUnits, billsById, purchaseBillsById],
  );

  const filteredDeviceRecords = useMemo(() =>
    deviceRecords
      .filter((r) => {
        const dateRef = r.purchaseDate;
        if (deviceDateFrom && dateRef && new Date(dateRef).getTime() < new Date(deviceDateFrom).getTime()) return false;
        if (deviceDateTo && dateRef && new Date(dateRef).getTime() > new Date(deviceDateTo + "T23:59:59.999").getTime()) return false;
        if (deviceSearch.trim().length >= 2) {
          const q = deviceSearch.toLowerCase();
          return (
            (r.unit.imeiNumber || "").includes(q) ||
            (r.unit.productName || "").toLowerCase().includes(q) ||
            (r.unit.model || "").toLowerCase().includes(q) ||
            (r.unit.storage || "").toLowerCase().includes(q) ||
            (r.unit.color || "").toLowerCase().includes(q) ||
            (r.unit.vendorName || "").toLowerCase().includes(q) ||
            (r.customerName || "").toLowerCase().includes(q) ||
            (r.unit.itemNo || "").toLowerCase().includes(q) ||
            (r.purchBill?.billNumber || "").toLowerCase().includes(q) ||
            (r.saleBill?.billNumber || "").toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const da = a.saleDate ? new Date(a.saleDate).getTime() : a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
        const db = b.saleDate ? new Date(b.saleDate).getTime() : b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
        return db - da;
      }),
    [deviceRecords, deviceDateFrom, deviceDateTo, deviceSearch],
  );

  const deviceStats = useMemo(() => {
    const fd = filteredDeviceRecords;
    return {
      total: fd.length,
      inStock: fd.filter((r) => r.unit.status === "in_stock" || r.unit.status === "reserved").length,
      sold: fd.filter((r) => r.unit.status === "sold").length,
      returned: fd.filter((r) => r.unit.status === "returned").length,
      dead: fd.filter((r) => r.unit.status === "deadstock").length,
      totalPurchaseCost: fd.reduce((s, r) => s + r.purchasePrice, 0),
      totalSaleRevenue: fd.filter((r) => r.unit.status === "sold").reduce((s, r) => s + r.salePrice, 0),
      totalProfit: fd.filter((r) => r.unit.status === "sold").reduce((s, r) => s + r.profit, 0),
    };
  }, [filteredDeviceRecords]);

  const modelSummary: ModelSummaryRow[] = useMemo(() => {
    const map = new Map<string, ModelSummaryRow>();
    filteredDeviceRecords.forEach((r) => {
      const key = r.unit.productName || "Unknown";
      if (!map.has(key)) map.set(key, { productName: key, total: 0, inStock: 0, sold: 0, totalBuyCost: 0, totalSaleRevenue: 0, totalProfit: 0 });
      const e = map.get(key)!;
      e.total++;
      e.totalBuyCost += r.purchasePrice;
      if (r.unit.status === "in_stock" || r.unit.status === "reserved") e.inStock++;
      if (r.unit.status === "sold") { e.sold++; e.totalSaleRevenue += r.salePrice; e.totalProfit += r.profit; }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredDeviceRecords]);

  const devicePDFRows: DevicePDFRow[] = useMemo(() =>
    filteredDeviceRecords.map((r) => ({
      imei: r.unit.imeiNumber || "-",
      productName: r.unit.productName || "-",
      model: r.unit.model,
      storage: r.unit.storage,
      color: r.unit.color,
      itemNo: r.unit.itemNo,
      vendorName: r.unit.vendorName,
      purchaseDate: r.purchaseDate,
      purchaseBillNo: r.purchBill?.billNumber,
      purchasePrice: r.purchasePrice,
      customerName: r.customerName ?? undefined,
      saleDate: r.saleDate,
      saleBillNo: r.saleBill?.billNumber,
      salePrice: r.salePrice,
      profit: r.profit,
      status: r.unit.status,
    })),
    [filteredDeviceRecords],
  );

  // ── Full party statements (sales + purchases) ──────────────────
  const partyStatements = clients.map((c) => {
    const clientSalesBills = bills.filter((b) => b.clientId === c.id);
    const clientPurchBills = purchaseBills.filter((b) => b.clientId === c.id);
    const clientPayments = partyPayments.filter((p) => p.partyId === c.id);
    const clientSaleReturns = billReturns.filter((r) => clientSalesBills.some((b) => b.id === r.billId));
    const clientPurchReturns = purchaseReturns.filter((r) => clientPurchBills.some((b) => b.id === r.purchaseBillId));

    const totalSales = clientSalesBills.reduce((s, b) => s + (b.total || 0), 0);
    const totalSaleCollected = clientSalesBills.reduce((s, b) => s + (b.paidAmount || 0), 0);
    const totalPurchases = clientPurchBills.reduce((s, b) => s + (b.total || 0), 0);
    const totalPurchasePaid = clientPurchBills.reduce((s, b) => s + (b.paidAmount || 0), 0);

    const openingAmt = Math.abs(c.openingBalance || 0);
    // "receivable" = party owes you (Debit/positive), "payable" = you owe party (Credit/negative).
    const openingIsPayable = (c.openingBalanceType || "receivable") === "payable";
    const openingSigned = openingIsPayable ? -openingAmt : openingAmt;

    const saleOutstanding = Math.max(0, totalSales - totalSaleCollected);
    const purchaseOutstanding = Math.max(0, totalPurchases - totalPurchasePaid);

    // Build ledger transactions for PDF
    const transactions = buildPartyLedgerTransactions(
      clientSalesBills,
      clientPurchBills,
      clientSaleReturns,
      clientPurchReturns,
      clientPayments,
      openingSigned,
    );
    const lastBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : openingSigned;
    const netBalance = lastBalance;

    const totalCollected = clientSalesBills.flatMap((b) => b.payments || []).reduce((s, p) => s + (p.amount || 0), 0) +
      clientPayments.filter((p) => p.type === "collected").reduce((s, p) => s + (p.amount || 0), 0);
    const totalSent = clientPurchBills.flatMap((b) => b.payments || []).reduce((s, p) => s + (p.amount || 0), 0) +
      clientPayments.filter((p) => p.type === "sent").reduce((s, p) => s + (p.amount || 0), 0);

    return {
      client: c,
      salesBills: clientSalesBills,
      purchBills: clientPurchBills,
      payments: clientPayments,
      saleReturns: clientSaleReturns,
      purchReturns: clientPurchReturns,
      totalSales,
      totalSaleCollected,
      totalPurchases,
      totalPurchasePaid,
      saleOutstanding,
      purchaseOutstanding,
      netBalance,
      totalCollected,
      totalSent,
      transactions,
      openingSigned,
    };
  });

  const filteredParties = partyStatements.filter(
    (p) =>
      (p.client?.name ?? "").toLowerCase().includes(partySearch.toLowerCase()) ||
      (p.client.phone || "").includes(partySearch),
  );

  // ── Monthly analysis ───────────────────────────────────────────
  const monthlyData = (() => {
    const map: Record<string, { sales: number; purchase: number; expenses: number }> = {};
    bills.forEach((b) => {
      const d = new Date(b.date || b.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { sales: 0, purchase: 0, expenses: 0 };
      map[key].sales += b.total || 0;
    });
    purchaseBills.forEach((b) => {
      const d = new Date(b.billDate || b.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { sales: 0, purchase: 0, expenses: 0 };
      map[key].purchase += b.total || 0;
    });
    expenses.forEach((e) => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { sales: 0, purchase: 0, expenses: 0 };
      map[key].expenses += e.amount || 0;
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a)) // newest first
      .map(([key, data]) => ({
        label: new Date(key + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
        ...data,
        profit: data.sales - data.purchase - data.expenses,
      }));
  })();

  // ── Day Book ───────────────────────────────────────────────────
  const todaySales = rawBills.filter((b) => isOnDayBookDate(b.date || b.createdAt));
  const todayPurchases = rawPurchaseBills.filter((b) => isOnDayBookDate(b.billDate || b.createdAt));
  const todayExpenses = rawExpenses.filter((e) => isOnDayBookDate(e.date));
  const todaySaleTotal = todaySales.reduce((s, b) => s + netSaleTotal(b), 0);
  const todayPurchaseTotal = todayPurchases.reduce((s, b) => s + netPurchaseTotal(b), 0);
  const todayExpenseTotal = todayExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const todayCashIn = todaySales.reduce((s, b) => {
    const payments = b.payments || [];
    const totalFwd = payments.reduce((a, p) => a + (p.amount || 0), 0);
    const cashFwd = payments.filter((p) => p.method === "Cash").reduce((a, p) => a + (p.amount || 0), 0);
    const refundTotal = Math.max(0, totalFwd - (b.paidAmount || 0));
    const cashRefund = totalFwd > 0 ? refundTotal * (cashFwd / totalFwd) : 0;
    return s + Math.max(0, cashFwd - cashRefund);
  }, 0);
  const todayCashOut =
    todayPurchases.reduce(
      (s, b) =>
        s + (b.payments || []).filter((p) => p.method === "Cash").reduce((a, p) => a + (p.amount || 0), 0),
      0,
    ) + todayExpenseTotal;

  type DayEntry = {
    time: string;
    type: "sale" | "purchase" | "expense";
    label: string;
    ref: string;
    amount: number;
  };
  const dayEntries: DayEntry[] = [
    ...todaySales.map((b) => ({
      time: b.createdAt,
      type: "sale" as const,
      label: b.client?.name || "Unknown",
      ref: b.billNumber,
      amount: b.total || 0,
    })),
    ...todayPurchases.map((b) => ({
      time: b.createdAt,
      type: "purchase" as const,
      label: b.vendorName || "Unknown",
      ref: b.billNumber || "-",
      amount: b.total || 0,
    })),
    ...todayExpenses.map((e) => ({
      time: e.createdAt,
      type: "expense" as const,
      label: e.description || e.category,
      ref: e.category,
      amount: e.amount,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  if (loading) return <LoadingSpinner fullScreen contentAreaOnly />;

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // ── Selected party details ─────────────────────────────────────
  const selectedStmt = selectedParty
    ? partyStatements.find((p) => p.client.id === selectedParty.id)
    : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-muted/10">
      <div className="w-full px-2 sm:px-4 py-3 pb-6 space-y-3">

        {/* Page Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
          <div>
            <h1 className="text-base font-bold leading-tight">Business Report</h1>
            <p className="text-xs text-muted-foreground">{today}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Date range filter */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPreparingMainPdf(false); }}
                className="h-8 px-2 text-xs border border-border/60 rounded-md bg-background"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPreparingMainPdf(false); }}
                className="h-8 px-2 text-xs border border-border/60 rounded-md bg-background"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); setPreparingMainPdf(false); }}
                  className="h-8 w-8 flex items-center justify-center rounded-md border border-border/60 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  title="Clear filter"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            {!preparingMainPdf ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreparingMainPdf(true)}
                className="gap-2 border-border/80 shrink-0"
              >
                <Download className="size-3.5" />
                <span className="text-xs font-medium">
                  {isFiltered ? "Download Filtered Report" : "Download Full Report"}
                </span>
              </Button>
            ) : (
              <PDFDownloadLink
                key={`pdf-${dateFrom}-${dateTo}-${bills.length}-${purchaseBills.length}`}
                document={
                  <BusinessReportPDF
                    bills={bills}
                    purchaseBills={purchaseBills}
                    expenses={expenses}
                    clients={clients}
                    companyProfile={companyProfile}
                  />
                }
                fileName={isFiltered
                  ? `Report_${dateFrom || "all"}_to_${dateTo || "all"}.pdf`
                  : `Business_Full_Report_${new Date().toISOString().slice(0, 10)}.pdf`}
              >
                {({ loading: pdfLoading }) => (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pdfLoading}
                    className="gap-2 border-border/80 shrink-0"
                  >
                    {pdfLoading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    <span className="text-xs font-medium">
                      {pdfLoading ? "Preparing PDF…" : "Click to Download"}
                    </span>
                  </Button>
                )}
              </PDFDownloadLink>
            )}
          </div>
        </div>

        {/* Active filter badge */}
        {isFiltered && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <CalendarDays className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-[11px] text-blue-700 dark:text-blue-400 flex-1">
              Filtered: {dateFrom ? fmtDate(dateFrom) : "–"} → {dateTo ? fmtDate(dateTo) : "–"} &nbsp;·&nbsp; {bills.length} sale bills &nbsp;·&nbsp; {purchaseBills.length} purchase bills
            </span>
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); setPreparingMainPdf(false); }}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline shrink-0"
            >
              Clear
            </button>
          </div>
        )}

        {/* Top Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/20">
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-green-700/80 dark:text-green-400">Total Sale</p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-400 mt-0.5 leading-tight">
                    {fmt(totalSell)}
                  </p>
                  <p className="text-[11px] text-green-600/70 dark:text-green-500 mt-1">
                    {bills.length} bills
                  </p>
                </div>
                <div className="h-9 w-9 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <TrendingUp className="size-4 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/40 dark:to-sky-950/20">
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-700/80 dark:text-blue-400">Total Purchase</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400 mt-0.5 leading-tight">
                    {fmt(totalPurchase)}
                  </p>
                  <p className="text-[11px] text-blue-600/70 dark:text-blue-500 mt-1">
                    {purchaseBills.length} bills
                  </p>
                </div>
                <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <ShoppingCart className="size-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/20">
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-700/80 dark:text-orange-400">Receivable</p>
                  <p className="text-lg font-bold text-orange-700 dark:text-orange-400 mt-0.5 leading-tight">
                    {fmt(partyStatements.filter((s) => s.netBalance > 0).reduce((sum, s) => sum + s.netBalance, 0))}
                  </p>
                  <p className="text-[11px] text-orange-600/70 dark:text-orange-500 mt-1">
                    {partyStatements.filter((s) => s.netBalance > 0).length} parties
                  </p>
                </div>
                <div className="h-9 w-9 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                  <CreditCard className="size-4 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/20">
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-red-700/80 dark:text-red-400">Payable</p>
                  <p className="text-lg font-bold text-red-700 dark:text-red-400 mt-0.5 leading-tight">
                    {fmt(partyStatements.filter((s) => s.netBalance < 0).reduce((sum, s) => sum + Math.abs(s.netBalance), 0))}
                  </p>
                  <p className="text-[11px] text-red-600/70 dark:text-red-500 mt-1">
                    {partyStatements.filter((s) => s.netBalance < 0).length} parties
                  </p>
                </div>
                <div className="h-9 w-9 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                  <TrendingDown className="size-4 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Net Profit bar */}
        <Card className={`border-0 shadow-sm ${netProfit >= 0 ? "bg-gradient-to-r from-green-50 to-emerald-50/60 dark:from-green-950/30 dark:to-emerald-950/10" : "bg-gradient-to-r from-red-50 to-rose-50/60 dark:from-red-950/30 dark:to-rose-950/10"}`}>
          <CardContent className="p-3 flex items-center gap-4">
            <BarChart3 className={`size-5 shrink-0 ${netProfit >= 0 ? "text-green-500" : "text-red-500"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium">Net Profit (Sales − Purchase − Expenses)</p>
              <p className={`text-lg font-bold leading-tight ${netProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                {fmt(netProfit)}
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0 text-right">
              <div>
                <p className="text-[10px] text-muted-foreground">Gross Profit</p>
                <p className={`text-sm font-semibold ${grossProfit >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(grossProfit)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Expenses</p>
                <p className="text-sm font-semibold text-orange-600">{fmt(totalExpenses)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Margin</p>
                <p className="text-sm font-semibold">{totalSell > 0 ? ((netProfit / totalSell) * 100).toFixed(1) : "0.0"}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GST Collected indicator */}
        {totalGstCollected > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
              GST Collected (Output Tax — payable to government):
            </span>
            <span className="text-[13px] font-bold text-blue-700 dark:text-blue-400">
              {fmt(totalGstCollected)}
            </span>
            <span className="text-[10px] text-blue-500 dark:text-blue-500 ml-1">
              (excluded from above profit)
            </span>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="daybook" className="w-full">
          <div className="sticky top-0 z-10 bg-muted/10 pt-1 pb-2">
            <TabsList className="flex w-full h-auto flex-wrap gap-1 p-1 bg-background border border-border/60 rounded-xl shadow-sm">
              {[
                { value: "daybook", label: "Day Book" },
                { value: "devices", label: "Devices" },
                { value: "analysis", label: "Analysis" },
                { value: "stock", label: "Stock" },
                { value: "receivable", label: "Receivable" },
                { value: "payable", label: "Payable" },
                { value: "party", label: "Party" },
                { value: "cash", label: "Cash" },
                { value: "bank", label: "Bank" },
                { value: "sales", label: "Sales" },
                { value: "purchase", label: "Purchase" },
              ].map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="text-xs px-3 py-1.5 flex-1 min-w-[60px] rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ── DAY BOOK ──────────────────────────────── */}
          <TabsContent value="daybook" className="mt-3 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold">
                    {new Date(dayBookDate + "T12:00:00").toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isDayBookToday ? "Today's transactions" : "Selected day transactions"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const d = new Date(dayBookDate + "T12:00:00");
                    d.setDate(d.getDate() - 1);
                    setDayBookDate(d.toISOString().slice(0, 10));
                  }}
                  className="h-7 w-7 rounded-md border border-border/60 flex items-center justify-center hover:bg-muted/50"
                  title="Previous day"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <input
                  type="date"
                  value={dayBookDate}
                  max={todayStr}
                  onChange={(e) => e.target.value && setDayBookDate(e.target.value)}
                  className="h-7 px-2 text-xs border border-border/60 rounded-md bg-background"
                />
                <button
                  onClick={() => {
                    const d = new Date(dayBookDate + "T12:00:00");
                    d.setDate(d.getDate() + 1);
                    const next = d.toISOString().slice(0, 10);
                    if (next <= todayStr) setDayBookDate(next);
                  }}
                  disabled={isDayBookToday}
                  className="h-7 w-7 rounded-md border border-border/60 flex items-center justify-center hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Next day"
                >
                  <ChevronRight className="size-4" />
                </button>
                {!isDayBookToday && (
                  <button
                    onClick={() => setDayBookDate(todayStr)}
                    className="h-7 px-2.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border border-green-200/70 dark:border-green-800/50 bg-green-50/50 dark:bg-green-950/20">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowUpCircle className="size-3.5 text-green-600" />
                    <p className="text-[11px] font-medium text-green-700 dark:text-green-400">
                      {isDayBookToday ? "Sale Today" : "Sale"}
                    </p>
                  </div>
                  <p className="text-base font-bold text-green-700 dark:text-green-400">{fmt(todaySaleTotal)}</p>
                  <p className="text-[11px] text-green-600/70 mt-0.5">{todaySales.length} bills</p>
                </CardContent>
              </Card>
              <Card className="border border-blue-200/70 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowDownCircle className="size-3.5 text-blue-600" />
                    <p className="text-[11px] font-medium text-blue-700 dark:text-blue-400">
                      {isDayBookToday ? "Purchase Today" : "Purchase"}
                    </p>
                  </div>
                  <p className="text-base font-bold text-blue-700 dark:text-blue-400">{fmt(todayPurchaseTotal)}</p>
                  <p className="text-[11px] text-blue-600/70 mt-0.5">{todayPurchases.length} bills</p>
                </CardContent>
              </Card>
              <Card className="border border-green-200/70 dark:border-green-800/50 bg-green-50/30 dark:bg-green-950/10">
                <CardContent className="p-3">
                  <p className="text-[11px] font-medium text-green-700 dark:text-green-400 mb-1">Cash In</p>
                  <p className="text-base font-bold text-green-700 dark:text-green-400">{fmt(todayCashIn)}</p>
                </CardContent>
              </Card>
              <Card className="border border-red-200/70 dark:border-red-800/50 bg-red-50/30 dark:bg-red-950/10">
                <CardContent className="p-3">
                  <p className="text-[11px] font-medium text-red-700 dark:text-red-400 mb-1">Cash Out</p>
                  <p className="text-base font-bold text-red-700 dark:text-red-400">{fmt(todayCashOut)}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {isDayBookToday ? "Net Cash (Today)" : "Net Cash"}
                  </p>
                  <p className={`text-xl font-bold mt-0.5 ${todayCashIn - todayCashOut >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {fmt(todayCashIn - todayCashOut)}
                  </p>
                </div>
                <BookOpen className="size-7 text-primary/40" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-4 py-3 border-b">
                <CardTitle className="text-sm font-semibold">
                  {isDayBookToday
                    ? "All Transactions Today"
                    : `All Transactions — ${new Date(dayBookDate + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {dayEntries.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    {isDayBookToday ? "No transactions today" : "No transactions on this day"}
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {dayEntries.map((entry, i) => (
                      <div key={i} className="flex items-center px-4 py-2.5 hover:bg-muted/30 transition-colors">
                        <div
                          className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mr-3 ${
                            entry.type === "sale"
                              ? "bg-green-100 dark:bg-green-900/40"
                              : entry.type === "purchase"
                              ? "bg-blue-100 dark:bg-blue-900/40"
                              : "bg-red-100 dark:bg-red-900/40"
                          }`}
                        >
                          {entry.type === "sale" ? (
                            <ArrowUpCircle className="size-3.5 text-green-600" />
                          ) : entry.type === "purchase" ? (
                            <ArrowDownCircle className="size-3.5 text-blue-600" />
                          ) : (
                            <TrendingDown className="size-3.5 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium truncate">{entry.label}</p>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 shrink-0 border-0 ${
                                entry.type === "sale"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                                  : entry.type === "purchase"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                              }`}
                            >
                              {entry.type === "sale" ? "Sale" : entry.type === "purchase" ? "Purchase" : "Expense"}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {entry.ref} · {fmtTime(entry.time)}
                          </p>
                        </div>
                        <p
                          className={`text-sm font-semibold shrink-0 ml-3 ${
                            entry.type === "sale" ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {entry.type === "sale" ? "+" : "-"}
                          {fmt(entry.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ANALYSIS ──────────────────────────────── */}
          <TabsContent value="analysis" className="mt-3 space-y-4">
            {/* Profit Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-0 bg-green-50 dark:bg-green-950/20">
                <CardContent className="p-3 text-center">
                  <p className="text-[11px] text-green-700 dark:text-green-400 font-medium mb-1">Total Sales</p>
                  <p className="text-base font-bold text-green-700 dark:text-green-400">{fmt(totalSell)}</p>
                  <p className="text-[11px] text-muted-foreground">{bills.length} bills</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-blue-50 dark:bg-blue-950/20">
                <CardContent className="p-3 text-center">
                  <p className="text-[11px] text-blue-700 dark:text-blue-400 font-medium mb-1">Total Purchase</p>
                  <p className="text-base font-bold text-blue-700 dark:text-blue-400">{fmt(totalPurchase)}</p>
                  <p className="text-[11px] text-muted-foreground">{purchaseBills.length} bills</p>
                </CardContent>
              </Card>
              <Card className={`border-0 ${grossProfit >= 0 ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                <CardContent className="p-3 text-center">
                  <p className={`text-[11px] font-medium mb-1 ${grossProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>Gross Profit</p>
                  <p className={`text-base font-bold ${grossProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{fmt(grossProfit)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {totalSell > 0 ? ((grossProfit / totalSell) * 100).toFixed(1) : "0.0"}% margin
                  </p>
                </CardContent>
              </Card>
              <Card className={`border-0 ${netProfit >= 0 ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                <CardContent className="p-3 text-center">
                  <p className={`text-[11px] font-medium mb-1 ${netProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>Net Profit</p>
                  <p className={`text-base font-bold ${netProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{fmt(netProfit)}</p>
                  <p className="text-[11px] text-muted-foreground">After expenses</p>
                </CardContent>
              </Card>
            </div>

            {/* Month-wise Analysis */}
            <Card>
              <CardHeader className="px-4 py-3 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Month-wise Analysis</CardTitle>
                <p className="text-xs text-muted-foreground">{monthlyData.length} months</p>
              </CardHeader>
              <CardContent className="p-0">
                <ReportTable
                  headers={["Month", "Sales", "Purchase", "Expenses", "Gross Profit", "Net Profit", "Margin"]}
                  empty={monthlyData.length === 0}
                >
                  {monthlyData.map((m, i) => {
                    const gross = m.sales - m.purchase;
                    const net = m.profit;
                    const margin = m.sales > 0 ? ((net / m.sales) * 100).toFixed(1) : "0.0";
                    return (
                      <tr key={m.label} className={`border-b ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                        <td className="px-3 py-2.5 font-semibold text-xs">{m.label}</td>
                        <td className="px-3 py-2.5 text-right text-green-700 dark:text-green-400 font-medium">{fmt(m.sales)}</td>
                        <td className="px-3 py-2.5 text-right text-blue-700 dark:text-blue-400 font-medium">{fmt(m.purchase)}</td>
                        <td className="px-3 py-2.5 text-right text-orange-600 dark:text-orange-400">{fmt(m.expenses)}</td>
                        <td className={`px-3 py-2.5 text-right font-semibold ${gross >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(gross)}</td>
                        <td className={`px-3 py-2.5 text-right font-semibold ${net >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(net)}</td>
                        <td className={`px-3 py-2.5 text-right text-[11px] ${parseFloat(margin) >= 0 ? "text-green-700" : "text-red-700"}`}>{margin}%</td>
                      </tr>
                    );
                  })}
                  {monthlyData.length > 0 && (
                    <tr className="border-t-2 border-border bg-muted/40 font-bold">
                      <td className="px-3 py-2.5 text-xs font-bold">TOTAL</td>
                      <td className="px-3 py-2.5 text-right text-green-700 font-bold">{fmt(totalSell)}</td>
                      <td className="px-3 py-2.5 text-right text-blue-700 font-bold">{fmt(totalPurchase)}</td>
                      <td className="px-3 py-2.5 text-right text-orange-600 font-bold">{fmt(totalExpenses)}</td>
                      <td className={`px-3 py-2.5 text-right font-bold ${grossProfit >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(grossProfit)}</td>
                      <td className={`px-3 py-2.5 text-right font-bold ${netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(netProfit)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] ${netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {totalSell > 0 ? ((netProfit / totalSell) * 100).toFixed(1) : "0.0"}%
                      </td>
                    </tr>
                  )}
                </ReportTable>
              </CardContent>
            </Card>

            {/* Top Parties */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-green-600" />
                    <CardTitle className="text-sm">Top 10 by Sales</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ReportTable headers={["Party", "Sales", "Collected", "Due"]} empty={partyStatements.filter((p) => p.totalSales > 0).length === 0}>
                    {[...partyStatements]
                      .filter((p) => p.totalSales > 0)
                      .sort((a, b) => b.totalSales - a.totalSales)
                      .slice(0, 10)
                      .map((p, i) => (
                        <tr key={p.client.id} className={`border-b ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                          <td className="px-3 py-2 font-medium max-w-[100px] truncate">
                            <span className="text-muted-foreground text-[10px] mr-1">{i + 1}.</span>
                            {p.client?.name ?? ""}
                          </td>
                          <td className="px-3 py-2 text-right text-green-700 font-semibold">{fmt(p.totalSales)}</td>
                          <td className="px-3 py-2 text-right">{fmt(p.totalSaleCollected)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${p.saleOutstanding > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                            {fmt(p.saleOutstanding)}
                          </td>
                        </tr>
                      ))}
                  </ReportTable>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-blue-600" />
                    <CardTitle className="text-sm">Top 10 by Purchase</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ReportTable headers={["Party", "Purchase", "Paid", "Due"]} empty={partyStatements.filter((p) => p.totalPurchases > 0).length === 0}>
                    {[...partyStatements]
                      .filter((p) => p.totalPurchases > 0)
                      .sort((a, b) => b.totalPurchases - a.totalPurchases)
                      .slice(0, 10)
                      .map((p, i) => (
                        <tr key={p.client.id} className={`border-b ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                          <td className="px-3 py-2 font-medium max-w-[100px] truncate">
                            <span className="text-muted-foreground text-[10px] mr-1">{i + 1}.</span>
                            {p.client?.name ?? ""}
                          </td>
                          <td className="px-3 py-2 text-right text-blue-700 font-semibold">{fmt(p.totalPurchases)}</td>
                          <td className="px-3 py-2 text-right">{fmt(p.totalPurchasePaid)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${p.purchaseOutstanding > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                            {fmt(p.purchaseOutstanding)}
                          </td>
                        </tr>
                      ))}
                  </ReportTable>
                </CardContent>
              </Card>
            </div>

            {/* Payment Mode Breakdown */}
            <Card>
              <CardHeader className="px-4 py-3 border-b">
                <CardTitle className="text-sm">Payment Mode Analysis</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(() => {
                  const modeMap: Record<string, { in: number; out: number }> = {};
                  bills.forEach((b) =>
                    (b.payments || []).forEach((p) => {
                      if (!modeMap[p.method]) modeMap[p.method] = { in: 0, out: 0 };
                      modeMap[p.method].in += p.amount;
                    })
                  );
                  purchaseBills.forEach((b) =>
                    (b.payments || []).forEach((p) => {
                      if (!modeMap[p.method]) modeMap[p.method] = { in: 0, out: 0 };
                      modeMap[p.method].out += p.amount;
                    })
                  );
                  const modes = Object.entries(modeMap).sort(([, a], [, b]) => (b.in + b.out) - (a.in + a.out));
                  return (
                    <ReportTable headers={["Mode", "Received (Sales)", "Paid (Purchase)", "Net"]} empty={modes.length === 0}>
                      {modes.map(([mode, data], i) => (
                        <tr key={mode} className={`border-b ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                          <td className="px-3 py-2.5 font-medium">{mode}</td>
                          <td className="px-3 py-2.5 text-right text-green-700 font-semibold">+{fmt(data.in)}</td>
                          <td className="px-3 py-2.5 text-right text-red-600 font-semibold">-{fmt(data.out)}</td>
                          <td className={`px-3 py-2.5 text-right font-bold ${data.in - data.out >= 0 ? "text-green-700" : "text-red-700"}`}>
                            {fmt(data.in - data.out)}
                          </td>
                        </tr>
                      ))}
                    </ReportTable>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Expense Category Breakdown */}
            {expenses.length > 0 && (
              <Card>
                <CardHeader className="px-4 py-3 border-b">
                  <CardTitle className="text-sm">Expense Breakdown by Category</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {(() => {
                    const catMap: Record<string, number> = {};
                    expenses.forEach((e) => {
                      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
                    });
                    const cats = Object.entries(catMap).sort(([, a], [, b]) => b - a);
                    return (
                      <ReportTable headers={["Category", "Amount", "% of Total"]} empty={cats.length === 0}>
                        {cats.map(([cat, amt], i) => (
                          <tr key={cat} className={`border-b ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                            <td className="px-3 py-2.5 font-medium">{cat || "Uncategorized"}</td>
                            <td className="px-3 py-2.5 text-right text-orange-600 font-semibold">{fmt(amt)}</td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground text-[11px]">
                              {totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(1) : "0.0"}%
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 bg-muted/40">
                          <td className="px-3 py-2.5 font-bold text-xs">TOTAL</td>
                          <td className="px-3 py-2.5 text-right font-bold text-orange-600">{fmt(totalExpenses)}</td>
                          <td className="px-3 py-2.5 text-right font-bold">100%</td>
                        </tr>
                      </ReportTable>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── STOCK ────────────────────────────────── */}
          <TabsContent value="stock" className="mt-3 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-0 shadow-sm bg-primary/5">
                <CardContent className="p-4 text-center">
                  <Package className="size-5 mx-auto mb-1.5 text-primary" />
                  <p className="text-xl font-bold">{products.reduce((s, p) => s + getEffectiveStock(p), 0)}</p>
                  <p className="text-xs text-muted-foreground">Items in Stock</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-primary/5">
                <CardContent className="p-4 text-center">
                  <Wallet className="size-5 mx-auto mb-1.5 text-primary" />
                  <p className="text-base font-bold leading-tight">{fmt(stockValue)}</p>
                  <p className="text-xs text-muted-foreground">Stock Value</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-orange-50 dark:bg-orange-950/20">
                <CardContent className="p-4 text-center">
                  <TrendingDown className="size-5 mx-auto mb-1.5 text-orange-500" />
                  <p className="text-xl font-bold text-orange-600">
                    {products.filter((p) => { const q = getEffectiveStock(p); return q > 0 && q <= 5; }).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Low Stock ≤5</p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader className="px-4 py-3 border-b">
                <CardTitle className="text-sm">Stock Details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ReportTable
                  headers={["Item", "Qty", "Buy Price", "Sell Price", "Value"]}
                  empty={stockItems.length === 0}
                >
                  {stockItems
                    .sort((a, b) => getEffectiveStock(b) - getEffectiveStock(a))
                    .map((p) => {
                      const qty = getEffectiveStock(p);
                      return (
                        <tr key={p.id} className="border-b hover:bg-muted/30">
                          <td className="px-3 py-2.5 text-left">
                            <p className="font-medium">{p.name}</p>
                            {p.model && <p className="text-muted-foreground text-[11px]">{p.model}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Badge
                              variant={qty <= 5 ? "destructive" : "secondary"}
                              className="text-[11px]"
                            >
                              {qty} {p.unit}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">
                            {fmt(p.purchasePrice || 0)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">
                            {fmt(p.sellingPrice || p.price || 0)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold">
                            {fmt(qty * (p.purchasePrice || 0))}
                          </td>
                        </tr>
                      );
                    })}
                </ReportTable>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── RECEIVABLE ──────────────────────────── */}
          <TabsContent value="receivable" className="mt-3 space-y-4">
            <Card className="border-0 shadow-sm bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Total Receivable</p>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-400 mt-0.5">
                    {fmt(partyStatements.filter((s) => s.netBalance > 0).reduce((sum, s) => sum + s.netBalance, 0))}
                  </p>
                  <p className="text-[11px] text-orange-600/70 mt-1">
                    {partyStatements.filter((s) => s.netBalance > 0).length} parties with outstanding balance
                  </p>
                </div>
                <CreditCard className="size-8 text-orange-300" />
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-sm">
              <CardHeader className="px-4 py-3 border-b bg-muted/15">
                <CardTitle className="text-sm">
                  Party-wise Receivable —{" "}
                  {partyStatements.filter((s) => s.netBalance > 0).length} parties
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {partyStatements.filter((s) => s.netBalance > 0).length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">All collections are clear</div>
                ) : (
                  <table className="w-full min-w-[400px] text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b">
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">#</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Party</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Phone</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Net to Collect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...partyStatements]
                        .filter((s) => s.netBalance > 0)
                        .sort((a, b) => b.netBalance - a.netBalance)
                        .map((s, i) => (
                          <tr key={s.client.id} className="border-b hover:bg-muted/20">
                            <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2.5 font-medium">{s.client.name}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{s.client.phone || "—"}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-orange-600">
                              {fmt(s.netBalance)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-orange-50/60 dark:bg-orange-950/20">
                        <td colSpan={3} className="px-4 py-2.5 font-semibold text-sm">Total</td>
                        <td className="px-4 py-2.5 text-right font-bold text-orange-700">
                          {fmt(partyStatements.filter((s) => s.netBalance > 0).reduce((sum, s) => sum + s.netBalance, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PAYABLE ─────────────────────────────── */}
          <TabsContent value="payable" className="mt-3 space-y-4">
            <Card className="border-0 shadow-sm bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-red-700 dark:text-red-400">Total Payable</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-0.5">
                    {fmt(partyStatements.filter((s) => s.netBalance < 0).reduce((sum, s) => sum + Math.abs(s.netBalance), 0))}
                  </p>
                  <p className="text-[11px] text-red-600/70 mt-1">
                    {partyStatements.filter((s) => s.netBalance < 0).length} parties with outstanding balance
                  </p>
                </div>
                <TrendingDown className="size-8 text-red-300" />
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-sm">
              <CardHeader className="px-4 py-3 border-b bg-muted/15">
                <CardTitle className="text-sm">
                  Party-wise Payable —{" "}
                  {partyStatements.filter((s) => s.netBalance < 0).length} parties
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {partyStatements.filter((s) => s.netBalance < 0).length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No pending payments</div>
                ) : (
                  <table className="w-full min-w-[400px] text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b">
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">#</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Party / Vendor</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Phone</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Net to Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...partyStatements]
                        .filter((s) => s.netBalance < 0)
                        .sort((a, b) => a.netBalance - b.netBalance)
                        .map((s, i) => (
                          <tr key={s.client.id} className="border-b hover:bg-muted/20">
                            <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2.5 font-medium">{s.client.name}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{s.client.phone || "—"}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-red-600">
                              {fmt(Math.abs(s.netBalance))}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-red-50/60 dark:bg-red-950/20">
                        <td colSpan={3} className="px-4 py-2.5 font-semibold text-sm">Total</td>
                        <td className="px-4 py-2.5 text-right font-bold text-red-700">
                          {fmt(partyStatements.filter((s) => s.netBalance < 0).reduce((sum, s) => sum + Math.abs(s.netBalance), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PARTY STATEMENT ─────────────────────── */}
          <TabsContent value="party" className="mt-3 space-y-4">
            <Card className="border border-border/60 shadow-sm">
              <CardHeader className="px-4 py-3 border-b bg-muted/20">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm">Party-wise Ledger Report</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {partyStatements.filter((p) => p.totalSales > 0 || p.totalPurchases > 0).length} active parties
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search party by name or phone..."
                    value={partySearch}
                    onChange={(e) => {
                      setPartySearch(e.target.value);
                      setSelectedParty(null);
                    }}
                    className="pl-9 h-10"
                  />
                </div>
              </CardContent>
            </Card>

            {selectedParty && selectedStmt ? (
              <div className="space-y-4">
                {/* Party header */}
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => { setSelectedParty(null); setPreparingPartyPdf(false); }}
                    className="text-xs text-primary underline underline-offset-2"
                  >
                    ← Back to Party List
                  </button>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{selectedParty.name}</p>
                    {!preparingPartyPdf ? (
                      <Button variant="outline" size="sm" onClick={() => setPreparingPartyPdf(true)} className="gap-1.5">
                        <Download className="size-3" />
                        <span className="text-xs">Download PDF</span>
                      </Button>
                    ) : (
                      <PDFDownloadLink
                        document={
                          <PartyLedgerPDF
                            party={selectedParty}
                            transactions={selectedStmt.transactions}
                            salesBills={selectedStmt.salesBills}
                            purchaseBills={selectedStmt.purchBills}
                            saleReturns={selectedStmt.saleReturns}
                            purchaseReturns={selectedStmt.purchReturns}
                            partyPayments={selectedStmt.payments}
                            openingBalance={selectedStmt.openingSigned}
                            stats={{
                              totalSales: selectedStmt.totalSales,
                              totalPurchases: selectedStmt.totalPurchases,
                              totalCollected: selectedStmt.totalCollected,
                              totalSent: selectedStmt.totalSent,
                              netBalance: selectedStmt.netBalance,
                              totalReceivable: selectedStmt.saleOutstanding,
                              totalPayable: selectedStmt.purchaseOutstanding,
                            }}
                            companyProfile={companyProfile}
                          />
                        }
                        fileName={`${selectedParty.name.replace(/\s+/g, "_")}_Report.pdf`}
                      >
                        {({ loading: pdfLoading }) => (
                          <Button variant="outline" size="sm" disabled={pdfLoading} className="gap-1.5">
                            {pdfLoading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                            <span className="text-xs">{pdfLoading ? "Preparing…" : "Click to Download"}</span>
                          </Button>
                        )}
                      </PDFDownloadLink>
                    )}
                  </div>
                </div>

                {/* Party KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="border-0 bg-green-50 dark:bg-green-950/20">
                    <CardContent className="p-3">
                      <p className="text-[11px] text-green-700 font-medium">Total Sales</p>
                      <p className="text-base font-bold text-green-700">{fmt(selectedStmt.totalSales)}</p>
                      <p className="text-[11px] text-muted-foreground">{selectedStmt.salesBills.length} bills</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 bg-blue-50 dark:bg-blue-950/20">
                    <CardContent className="p-3">
                      <p className="text-[11px] text-blue-700 font-medium">Total Purchase</p>
                      <p className="text-base font-bold text-blue-700">{fmt(selectedStmt.totalPurchases)}</p>
                      <p className="text-[11px] text-muted-foreground">{selectedStmt.purchBills.length} bills</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 bg-orange-50 dark:bg-orange-950/20">
                    <CardContent className="p-3">
                      <p className="text-[11px] text-orange-700 font-medium">Sale Outstanding</p>
                      <p className="text-base font-bold text-orange-700">{fmt(selectedStmt.saleOutstanding)}</p>
                      <p className="text-[11px] text-muted-foreground">To receive</p>
                    </CardContent>
                  </Card>
                  <Card className={`border-0 ${selectedStmt.netBalance >= 0 ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                    <CardContent className="p-3">
                      <p className={`text-[11px] font-medium ${selectedStmt.netBalance >= 0 ? "text-green-700" : "text-red-700"}`}>Net Balance</p>
                      <p className={`text-base font-bold ${selectedStmt.netBalance >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(Math.abs(selectedStmt.netBalance))}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedStmt.netBalance >= 0 ? "Party owes you" : "You owe party"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Sales bills */}
                {selectedStmt.salesBills.length > 0 && (
                  <Card>
                    <CardHeader className="px-4 py-3 border-b bg-green-50/50 dark:bg-green-950/10">
                      <div className="flex items-center gap-2">
                        <Receipt className="size-4 text-green-600" />
                        <CardTitle className="text-sm">Sales Bills ({selectedStmt.salesBills.length})</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ReportTable headers={["Date", "Bill#", "Total", "Paid", "Balance", "Status"]}>
                        {[...selectedStmt.salesBills]
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((bill) => {
                            const bal = Math.max(0, (bill.total || 0) - (bill.paidAmount || 0));
                            return (
                              <tr key={bill.id} className="border-b hover:bg-muted/20">
                                <td className="px-3 py-2.5 text-left text-muted-foreground">{fmtDate(bill.date)}</td>
                                <td className="px-3 py-2.5 text-right font-medium">{bill.billNumber || "-"}</td>
                                <td className="px-3 py-2.5 text-right">{fmt(bill.total || 0)}</td>
                                <td className="px-3 py-2.5 text-right text-green-700">{fmt(bill.paidAmount || 0)}</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-orange-600">{fmt(bal)}</td>
                                <td className="px-3 py-2.5 text-right"><StatusBadge status={bill.paymentStatus} /></td>
                              </tr>
                            );
                          })}
                        <tr className="border-t-2 bg-muted/30 font-bold">
                          <td className="px-3 py-2.5 text-left text-xs font-bold" colSpan={2}>TOTAL</td>
                          <td className="px-3 py-2.5 text-right font-bold">{fmt(selectedStmt.totalSales)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-green-700">{fmt(selectedStmt.totalSaleCollected)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-orange-600">{fmt(selectedStmt.saleOutstanding)}</td>
                          <td></td>
                        </tr>
                      </ReportTable>
                    </CardContent>
                  </Card>
                )}

                {/* Purchase bills */}
                {selectedStmt.purchBills.length > 0 && (
                  <Card>
                    <CardHeader className="px-4 py-3 border-b bg-blue-50/50 dark:bg-blue-950/10">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="size-4 text-blue-600" />
                        <CardTitle className="text-sm">Purchase Bills ({selectedStmt.purchBills.length})</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ReportTable headers={["Date", "Bill#", "Total", "Paid", "Balance", "Status"]}>
                        {[...selectedStmt.purchBills]
                          .sort((a, b) => new Date(b.billDate || b.createdAt).getTime() - new Date(a.billDate || a.createdAt).getTime())
                          .map((bill) => {
                            const bal = Math.max(0, (bill.total || 0) - (bill.paidAmount || 0));
                            return (
                              <tr key={bill.id} className="border-b hover:bg-muted/20">
                                <td className="px-3 py-2.5 text-left text-muted-foreground">{fmtDate(bill.billDate || bill.createdAt)}</td>
                                <td className="px-3 py-2.5 text-right font-medium">{bill.billNumber || "-"}</td>
                                <td className="px-3 py-2.5 text-right">{fmt(bill.total || 0)}</td>
                                <td className="px-3 py-2.5 text-right text-green-700">{fmt(bill.paidAmount || 0)}</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-red-600">{fmt(bal)}</td>
                                <td className="px-3 py-2.5 text-right"><StatusBadge status={bill.paymentStatus} /></td>
                              </tr>
                            );
                          })}
                        <tr className="border-t-2 bg-muted/30 font-bold">
                          <td className="px-3 py-2.5 text-left text-xs font-bold" colSpan={2}>TOTAL</td>
                          <td className="px-3 py-2.5 text-right font-bold">{fmt(selectedStmt.totalPurchases)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-green-700">{fmt(selectedStmt.totalPurchasePaid)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-red-600">{fmt(selectedStmt.purchaseOutstanding)}</td>
                          <td></td>
                        </tr>
                      </ReportTable>
                    </CardContent>
                  </Card>
                )}

                {/* Full Ledger */}
                {(selectedStmt.transactions.length > 0 || selectedStmt.openingSigned !== 0) && (
                  <Card>
                    <CardHeader className="px-4 py-3 border-b">
                      <CardTitle className="text-sm">Full Ledger ({selectedStmt.transactions.length} entries)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      <table className="w-full min-w-[680px] text-xs">
                        <thead>
                          <tr className="bg-muted/40 border-b">
                            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Date</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Particulars</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Ref</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Debit</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Credit</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Opening Balance — always first chronological entry */}
                          {selectedStmt.openingSigned !== 0 && (
                            <tr className="border-b bg-amber-50/60 dark:bg-amber-950/20">
                              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">—</td>
                              <td className="px-3 py-2 font-semibold text-amber-700 dark:text-amber-400">Opening Balance</td>
                              <td className="px-3 py-2 text-muted-foreground">—</td>
                              <td className="px-3 py-2 text-right font-medium">
                                {selectedStmt.openingSigned > 0 ? fmt(selectedStmt.openingSigned) : "-"}
                              </td>
                              <td className="px-3 py-2 text-right font-medium">
                                {selectedStmt.openingSigned < 0 ? fmt(Math.abs(selectedStmt.openingSigned)) : "-"}
                              </td>
                              <td className={`px-3 py-2 text-right font-semibold ${selectedStmt.openingSigned >= 0 ? "text-orange-600" : "text-green-700"}`}>
                                {fmt(Math.abs(selectedStmt.openingSigned))}{" "}
                                <span className="text-[10px] text-muted-foreground">{selectedStmt.openingSigned >= 0 ? "Dr" : "Cr"}</span>
                              </td>
                            </tr>
                          )}
                          {[...selectedStmt.transactions].reverse().map((t, i) => (
                            <tr key={i} className={`border-b hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(t.date)}</td>
                              <td className="px-3 py-2 max-w-[200px] truncate">{t.type}</td>
                              <td className="px-3 py-2 text-muted-foreground">{t.reference}</td>
                              <td className="px-3 py-2 text-right">{t.debit > 0 ? fmt(t.debit) : "-"}</td>
                              <td className="px-3 py-2 text-right">{t.credit > 0 ? fmt(t.credit) : "-"}</td>
                              <td className={`px-3 py-2 text-right font-semibold ${t.balance >= 0 ? "text-orange-600" : "text-green-700"}`}>
                                {fmt(Math.abs(t.balance))}{" "}
                                <span className="text-[10px] text-muted-foreground">{t.balance >= 0 ? "Dr" : "Cr"}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                )}

                {selectedStmt.salesBills.length === 0 && selectedStmt.purchBills.length === 0 && (
                  <div className="py-10 text-center text-sm text-muted-foreground">No transactions for this party.</div>
                )}
              </div>
            ) : (
              <Card className="border border-border/60 shadow-sm">
                <CardHeader className="px-4 py-3 border-b bg-muted/15">
                  <CardTitle className="text-sm">Party Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  {filteredParties.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">No parties found</div>
                  ) : (
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b">
                          <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Party</th>
                          <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Phone</th>
                          <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Opening Bal.</th>
                          <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Sales</th>
                          <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Purchase</th>
                          <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Receivable</th>
                          <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Payable</th>
                          <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Net Balance</th>
                          <th className="px-4 py-3 text-center font-semibold text-muted-foreground">PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredParties.map((stmt) => (
                          <tr
                            key={stmt.client.id}
                            className="border-b hover:bg-muted/20 cursor-pointer"
                            onClick={() => setSelectedParty(stmt.client)}
                          >
                            <td className="px-4 py-3 font-medium">{stmt.client?.name ?? ""}</td>
                            <td className="px-4 py-3 text-muted-foreground">{stmt.client.phone || "-"}</td>
                            <td className={`px-4 py-3 text-right font-medium ${stmt.openingSigned > 0 ? "text-green-700" : stmt.openingSigned < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                              {stmt.openingSigned !== 0 ? (
                                <>{fmt(Math.abs(stmt.openingSigned))}{" "}<span className="text-[10px] text-muted-foreground">{stmt.openingSigned > 0 ? "Dr" : "Cr"}</span></>
                              ) : "-"}
                            </td>
                            <td className="px-4 py-3 text-right text-green-700 font-medium">{fmt(stmt.totalSales)}</td>
                            <td className="px-4 py-3 text-right text-blue-700 font-medium">{fmt(stmt.totalPurchases)}</td>
                            <td className="px-4 py-3 text-right text-orange-600">{fmt(stmt.saleOutstanding)}</td>
                            <td className="px-4 py-3 text-right text-red-600">{fmt(stmt.purchaseOutstanding)}</td>
                            <td className={`px-4 py-3 text-right font-semibold ${stmt.netBalance >= 0 ? "text-green-700" : "text-red-700"}`}>
                              {fmt(Math.abs(stmt.netBalance))}{" "}
                              <span className="text-[10px] text-muted-foreground">{stmt.netBalance >= 0 ? "Dr" : "Cr"}</span>
                            </td>
                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              {preparingRowPdfId !== stmt.client.id ? (
                                <button
                                  className="p-1.5 rounded hover:bg-muted/60 transition-colors"
                                  title={`Download ${stmt.client?.name ?? ""} PDF`}
                                  onClick={() => setPreparingRowPdfId(stmt.client.id)}
                                >
                                  <Download className="size-3.5 text-muted-foreground hover:text-primary" />
                                </button>
                              ) : (
                                <PDFDownloadLink
                                  document={
                                    <PartyLedgerPDF
                                      party={stmt.client}
                                      transactions={stmt.transactions}
                                      salesBills={stmt.salesBills}
                                      purchaseBills={stmt.purchBills}
                                      saleReturns={stmt.saleReturns}
                                      purchaseReturns={stmt.purchReturns}
                                      partyPayments={stmt.payments}
                                      openingBalance={stmt.openingSigned}
                                      stats={{
                                        totalSales: stmt.totalSales,
                                        totalPurchases: stmt.totalPurchases,
                                        totalCollected: stmt.totalCollected,
                                        totalSent: stmt.totalSent,
                                        netBalance: stmt.netBalance,
                                        totalReceivable: stmt.saleOutstanding,
                                        totalPayable: stmt.purchaseOutstanding,
                                      }}
                                      companyProfile={companyProfile}
                                    />
                                  }
                                  fileName={`${(stmt.client?.name ?? "Client").replace(/\s+/g, "_")}_Ledger.pdf`}
                                >
                                  {({ loading: pdfLoading }) => (
                                    <button
                                      className="p-1.5 rounded hover:bg-muted/60 transition-colors"
                                      title={pdfLoading ? "Preparing PDF…" : "Click to Download"}
                                      disabled={pdfLoading}
                                    >
                                      {pdfLoading ? (
                                        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                                      ) : (
                                        <Download className="size-3.5 text-primary" />
                                      )}
                                    </button>
                                  )}
                                </PDFDownloadLink>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── CASH ─────────────────────────────────── */}
          <TabsContent value="cash" className="mt-3 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-0 bg-green-50 dark:bg-green-950/20">
                <CardContent className="p-4 text-center">
                  <p className="text-[11px] text-green-700 dark:text-green-400 font-medium mb-1">Cash In</p>
                  <p className="text-base font-bold text-green-700 dark:text-green-400">{fmt(cashReceived)}</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-red-50 dark:bg-red-950/20">
                <CardContent className="p-4 text-center">
                  <p className="text-[11px] text-red-700 dark:text-red-400 font-medium mb-1">Cash Out</p>
                  <p className="text-base font-bold text-red-700 dark:text-red-400">{fmt(cashPaid)}</p>
                </CardContent>
              </Card>
              <Card className={`border-0 ${cashReceived - cashPaid >= 0 ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                <CardContent className="p-4 text-center">
                  <p className="text-[11px] text-muted-foreground font-medium mb-1">Net Cash</p>
                  <p className={`text-base font-bold ${cashReceived - cashPaid >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {fmt(cashReceived - cashPaid)}
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader className="px-4 py-3 border-b">
                <CardTitle className="text-sm">Cash Receipts (Sales)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ReportTable
                  headers={["Date", "Party", "Bill#", "Amount"]}
                  empty={bills.flatMap((b) => (b.payments || []).filter((p) => p.method === "Cash")).length === 0}
                >
                  {bills
                    .flatMap((b) =>
                      (b.payments || [])
                        .filter((p) => p.method === "Cash")
                        .map((p) => ({ date: p.date, party: b.client?.name || "-", bill: b.billNumber || "-", amount: p.amount, id: p.id })),
                    )
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((tx) => (
                      <tr key={tx.id} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2.5 text-left text-muted-foreground">{fmtDate(tx.date)}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{tx.party}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{tx.bill}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-green-600">+{fmt(tx.amount)}</td>
                      </tr>
                    ))}
                </ReportTable>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="px-4 py-3 border-b">
                <CardTitle className="text-sm">Cash Payments (Purchases)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ReportTable
                  headers={["Date", "Party/Vendor", "Bill#", "Amount"]}
                  empty={purchaseBills.flatMap((b) => (b.payments || []).filter((p) => p.method === "Cash")).length === 0}
                >
                  {purchaseBills
                    .flatMap((b) =>
                      (b.payments || [])
                        .filter((p) => p.method === "Cash")
                        .map((p) => ({ date: p.date, party: b.vendorName || "-", bill: b.billNumber || "-", amount: p.amount, id: p.id })),
                    )
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((tx) => (
                      <tr key={tx.id} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2.5 text-left text-muted-foreground">{fmtDate(tx.date)}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{tx.party}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{tx.bill}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-red-600">-{fmt(tx.amount)}</td>
                      </tr>
                    ))}
                </ReportTable>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BANK ─────────────────────────────────── */}
          <TabsContent value="bank" className="mt-3 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-0 bg-green-50 dark:bg-green-950/20">
                <CardContent className="p-4 text-center">
                  <p className="text-[11px] text-green-700 dark:text-green-400 font-medium mb-1">Bank In</p>
                  <p className="text-base font-bold text-green-700 dark:text-green-400">{fmt(bankReceived)}</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-red-50 dark:bg-red-950/20">
                <CardContent className="p-4 text-center">
                  <p className="text-[11px] text-red-700 dark:text-red-400 font-medium mb-1">Bank Out</p>
                  <p className="text-base font-bold text-red-700 dark:text-red-400">{fmt(bankPaid)}</p>
                </CardContent>
              </Card>
              <Card className={`border-0 ${bankReceived - bankPaid >= 0 ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                <CardContent className="p-4 text-center">
                  <p className="text-[11px] text-muted-foreground font-medium mb-1">Net Bank</p>
                  <p className={`text-base font-bold ${bankReceived - bankPaid >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {fmt(bankReceived - bankPaid)}
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader className="px-4 py-3 border-b">
                <CardTitle className="text-sm">Bank/UPI Receipts (Sales)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ReportTable
                  headers={["Date", "Party", "Bill#", "Mode", "Amount"]}
                  empty={bills.flatMap((b) => (b.payments || []).filter((p) => p.method !== "Cash")).length === 0}
                >
                  {bills
                    .flatMap((b) =>
                      (b.payments || [])
                        .filter((p) => p.method !== "Cash")
                        .map((p) => ({ date: p.date, party: b.client?.name || "-", bill: b.billNumber || "-", method: p.method, amount: p.amount, id: p.id })),
                    )
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((tx) => (
                      <tr key={tx.id} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2.5 text-left text-muted-foreground">{fmtDate(tx.date)}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{tx.party}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{tx.bill}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{tx.method}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-green-600">+{fmt(tx.amount)}</td>
                      </tr>
                    ))}
                </ReportTable>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="px-4 py-3 border-b">
                <CardTitle className="text-sm">Bank/UPI Payments (Purchases)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ReportTable
                  headers={["Date", "Party/Vendor", "Bill#", "Mode", "Amount"]}
                  empty={purchaseBills.flatMap((b) => (b.payments || []).filter((p) => p.method !== "Cash")).length === 0}
                >
                  {purchaseBills
                    .flatMap((b) =>
                      (b.payments || [])
                        .filter((p) => p.method !== "Cash")
                        .map((p) => ({ date: p.date, party: b.vendorName || "-", bill: b.billNumber || "-", method: p.method, amount: p.amount, id: p.id })),
                    )
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((tx) => (
                      <tr key={tx.id} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2.5 text-left text-muted-foreground">{fmtDate(tx.date)}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{tx.party}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{tx.bill}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{tx.method}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-red-600">-{fmt(tx.amount)}</td>
                      </tr>
                    ))}
                </ReportTable>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TOTAL SALES ──────────────────────────── */}
          <TabsContent value="sales" className="mt-3 space-y-4">
            <Card className="border-0 shadow-sm bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-700 dark:text-green-400">Total Sales</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-0.5">{fmt(totalSell)}</p>
                  <p className="text-[11px] text-green-600/70 mt-1">
                    {bills.length} bills · Collected:{" "}
                    {fmt(bills.reduce((s, b) => s + (b.paidAmount || 0), 0))} · Pending: {fmt(totalReceivable)}
                  </p>
                </div>
                <FileText className="size-8 text-green-300" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="px-4 py-3 border-b">
                <CardTitle className="text-sm">All Sales Bills ({bills.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ReportTable
                  headers={["Date", "Client", "Bill#", "Items", "Total", "Paid", "Balance", "Status"]}
                  empty={bills.length === 0}
                >
                  {bills
                    .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
                    .map((bill) => {
                      const bal = Math.max(0, (bill.total || 0) - (bill.paidAmount || 0));
                      return (
                        <tr key={bill.id} className="border-b hover:bg-muted/30">
                          <td className="px-3 py-2.5 text-left text-muted-foreground whitespace-nowrap">{fmtDate(bill.date || bill.createdAt)}</td>
                          <td className="px-3 py-2.5 text-right font-medium max-w-[100px] truncate">{bill.client?.name || "-"}</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{bill.billNumber || "-"}</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{(bill.items || []).length}</td>
                          <td className="px-3 py-2.5 text-right font-semibold">{fmt(bill.total || 0)}</td>
                          <td className="px-3 py-2.5 text-right text-green-700">{fmt(bill.paidAmount || 0)}</td>
                          <td className={`px-3 py-2.5 text-right font-semibold ${bal > 0 ? "text-orange-600" : "text-muted-foreground"}`}>{fmt(bal)}</td>
                          <td className="px-3 py-2.5 text-right"><StatusBadge status={bill.paymentStatus} /></td>
                        </tr>
                      );
                    })}
                </ReportTable>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── DEVICES ──────────────────────────────── */}
          <TabsContent value="devices" className="mt-3 space-y-4">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  placeholder="Search IMEI, model, vendor, customer…"
                  value={deviceSearch}
                  onChange={(e) => { setDeviceSearch(e.target.value); setPreparingDevicePdf(false); }}
                  className="w-full h-8 pl-8 pr-3 text-xs border border-border/60 rounded-md bg-background"
                />
              </div>
              <input
                type="date"
                value={deviceDateFrom}
                onChange={(e) => { setDeviceDateFrom(e.target.value); setPreparingDevicePdf(false); }}
                className="h-8 px-2 text-xs border border-border/60 rounded-md bg-background"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={deviceDateTo}
                onChange={(e) => { setDeviceDateTo(e.target.value); setPreparingDevicePdf(false); }}
                className="h-8 px-2 text-xs border border-border/60 rounded-md bg-background"
              />
              {(deviceDateFrom || deviceDateTo || deviceSearch) && (
                <button
                  onClick={() => { setDeviceDateFrom(""); setDeviceDateTo(""); setDeviceSearch(""); setPreparingDevicePdf(false); }}
                  className="h-8 w-8 flex items-center justify-center rounded-md border border-border/60 hover:bg-muted/50 text-muted-foreground"
                  title="Clear filters"
                >
                  <X className="size-3.5" />
                </button>
              )}
              {/* PDF download */}
              {!preparingDevicePdf ? (
                <Button variant="outline" size="sm" onClick={() => setPreparingDevicePdf(true)} className="gap-2 ml-auto shrink-0">
                  <Download className="size-3.5" />
                  <span className="text-xs">Download Report</span>
                </Button>
              ) : (
                <PDFDownloadLink
                  document={
                    <DeviceReportPDF
                      devices={devicePDFRows}
                      modelSummary={modelSummary}
                      dateFrom={deviceDateFrom}
                      dateTo={deviceDateTo}
                      companyName={companyProfile?.name}
                      stats={{
                        total: deviceStats.total,
                        inStock: deviceStats.inStock,
                        sold: deviceStats.sold,
                        totalPurchaseCost: deviceStats.totalPurchaseCost,
                        totalSaleRevenue: deviceStats.totalSaleRevenue,
                        totalProfit: deviceStats.totalProfit,
                      }}
                    />
                  }
                  fileName={`Device_Report${deviceDateFrom ? `_${deviceDateFrom}` : ""}${deviceDateTo ? `_to_${deviceDateTo}` : ""}.pdf`}
                >
                  {({ loading: pdfLoading }) => (
                    <Button variant="outline" size="sm" disabled={pdfLoading} className="gap-2 ml-auto shrink-0">
                      {pdfLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                      <span className="text-xs">{pdfLoading ? "Preparing PDF…" : "Click to Download"}</span>
                    </Button>
                  )}
                </PDFDownloadLink>
              )}
            </div>

            {/* Summary KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {[
                { label: "Total", value: deviceStats.total, cls: "text-foreground", bg: "" },
                { label: "In Stock", value: deviceStats.inStock, cls: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/20" },
                { label: "Sold", value: deviceStats.sold, cls: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/20" },
                { label: "Returned", value: deviceStats.returned, cls: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/20" },
                { label: "Deadstock", value: deviceStats.dead, cls: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20" },
                { label: "Buy Cost", value: fmt(deviceStats.totalPurchaseCost), cls: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20" },
                { label: "Sale Revenue", value: fmt(deviceStats.totalSaleRevenue), cls: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/20" },
              ].map((c, i) => (
                <Card key={i} className={`border-0 shadow-sm ${c.bg}`}>
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{c.label}</p>
                    <p className={`text-sm font-bold ${c.cls}`}>{c.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Profit summary strip */}
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${deviceStats.totalProfit >= 0 ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"}`}>
              <Smartphone className={`size-4 shrink-0 ${deviceStats.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`} />
              <span className="text-xs font-medium text-muted-foreground">Total Profit on sold devices:</span>
              <span className={`text-sm font-bold ${deviceStats.totalProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                {deviceStats.totalProfit >= 0 ? "+" : ""}{fmt(deviceStats.totalProfit)}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">{deviceStats.sold} devices sold · {deviceStats.inStock} in stock</span>
            </div>

            {/* Model-wise Summary */}
            <Card>
              <CardHeader className="px-4 py-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Smartphone className="size-4 text-primary" />
                  Model-wise Summary ({modelSummary.length} models)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ReportTable
                  headers={["Model / Product", "Total", "In Stock", "Sold", "Buy Cost", "Sale Revenue", "Profit / Loss"]}
                  empty={modelSummary.length === 0}
                >
                  {modelSummary.map((m, i) => (
                    <tr key={i} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-2.5 text-left font-medium">{m.productName}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{m.total}</td>
                      <td className="px-3 py-2.5 text-right text-blue-600 dark:text-blue-400 font-medium">{m.inStock}</td>
                      <td className="px-3 py-2.5 text-right text-green-600 dark:text-green-400 font-medium">{m.sold}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{fmt(m.totalBuyCost)}</td>
                      <td className="px-3 py-2.5 text-right text-green-600 dark:text-green-400">{fmt(m.totalSaleRevenue)}</td>
                      <td className={`px-3 py-2.5 text-right font-bold ${m.totalProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                        {m.totalProfit >= 0 ? "+" : ""}{fmt(m.totalProfit)}
                      </td>
                    </tr>
                  ))}
                </ReportTable>
              </CardContent>
            </Card>

            {/* Device-wise Details */}
            <Card>
              <CardHeader className="px-4 py-3 border-b">
                <CardTitle className="text-sm">
                  Device-wise Details ({filteredDeviceRecords.length} devices)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[900px]">
                    <thead>
                      <tr className="bg-muted/60 border-b">
                        {["Status", "IMEI / Device", "Model", "Vendor", "Buy Date", "Buy Price", "Customer", "Sale Date", "Sale Price", "Profit"].map((h, i) => (
                          <th key={i} className={`px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[11px] ${i === 0 || i === 1 ? "text-left" : "text-right"}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeviceRecords.length === 0 ? (
                        <tr><td colSpan={10} className="py-10 text-center text-sm text-muted-foreground">No devices found</td></tr>
                      ) : (
                        filteredDeviceRecords.map((r, i) => {
                          const isSold = r.unit.status === "sold";
                          const isStock = r.unit.status === "in_stock" || r.unit.status === "reserved";
                          const statusCls = isSold
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                            : isStock
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                            : r.unit.status === "deadstock"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400";
                          return (
                            <tr key={r.unit.id} className={`border-b hover:bg-muted/30 ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                              <td className="px-3 py-2.5 text-left">
                                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ${statusCls}`}>
                                  {r.unit.status.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-left">
                                <div className="font-mono text-[11px] font-medium">{r.unit.imeiNumber || "-"}</div>
                                {r.purchBill?.billNumber && <div className="text-[10px] text-muted-foreground">#{r.purchBill.billNumber}</div>}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="font-medium">{r.unit.productName || "-"}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {[r.unit.model, r.unit.storage, r.unit.color].filter(Boolean).join(" / ") || ""}
                                </div>
                                {r.unit.batteryHealth && (
                                  <div className="text-[10px] text-amber-600">Batt: {r.unit.batteryHealth}</div>
                                )}
                                {r.unit.warranty && (
                                  <div className="text-[10px] text-blue-600">Warranty: {r.unit.warranty}</div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right text-muted-foreground">{r.unit.vendorName || "-"}</td>
                              <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">{fmtDate(r.purchaseDate || "")}</td>
                              <td className="px-3 py-2.5 text-right font-medium">{fmt(r.purchasePrice)}</td>
                              <td className="px-3 py-2.5 text-right">
                                {isSold ? (
                                  <>
                                    <div className="font-medium">{r.customerName || "-"}</div>
                                    {r.saleBill?.billNumber && <div className="text-[10px] text-muted-foreground">#{r.saleBill.billNumber}</div>}
                                  </>
                                ) : <span className="text-muted-foreground">-</span>}
                              </td>
                              <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                                {isSold && r.saleDate ? fmtDate(r.saleDate) : "-"}
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium text-green-700 dark:text-green-400">
                                {isSold ? fmt(r.salePrice) : "-"}
                              </td>
                              <td className={`px-3 py-2.5 text-right font-bold ${isSold ? (r.profit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400") : "text-muted-foreground"}`}>
                                {isSold ? `${r.profit >= 0 ? "+" : ""}${fmt(r.profit)}` : "-"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TOTAL PURCHASE ───────────────────────── */}
          <TabsContent value="purchase" className="mt-3 space-y-4">
            <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Total Purchase</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-0.5">{fmt(totalPurchase)}</p>
                  <p className="text-[11px] text-blue-600/70 mt-1">
                    {purchaseBills.length} bills · Paid:{" "}
                    {fmt(purchaseBills.reduce((s, b) => s + (b.paidAmount || 0), 0))} · Pending: {fmt(totalPayable)}
                  </p>
                </div>
                <ShoppingCart className="size-8 text-blue-300" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="px-4 py-3 border-b">
                <CardTitle className="text-sm">All Purchase Bills ({purchaseBills.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ReportTable
                  headers={["Date", "Party/Vendor", "Bill#", "Items", "Total", "Paid", "Balance", "Status"]}
                  empty={purchaseBills.length === 0}
                >
                  {purchaseBills
                    .sort((a, b) => new Date(b.billDate || b.createdAt).getTime() - new Date(a.billDate || a.createdAt).getTime())
                    .map((bill) => {
                      const bal = Math.max(0, (bill.total || 0) - (bill.paidAmount || 0));
                      return (
                        <tr key={bill.id} className="border-b hover:bg-muted/30">
                          <td className="px-3 py-2.5 text-left text-muted-foreground whitespace-nowrap">
                            {fmtDate(bill.billDate || bill.createdAt)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium max-w-[100px] truncate">{bill.vendorName || "-"}</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{bill.billNumber || "-"}</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{(bill.items || []).length}</td>
                          <td className="px-3 py-2.5 text-right font-semibold">{fmt(bill.total || 0)}</td>
                          <td className="px-3 py-2.5 text-right text-green-700">{fmt(bill.paidAmount || 0)}</td>
                          <td className={`px-3 py-2.5 text-right font-semibold ${bal > 0 ? "text-red-600" : "text-muted-foreground"}`}>{fmt(bal)}</td>
                          <td className="px-3 py-2.5 text-right"><StatusBadge status={bill.paymentStatus} /></td>
                        </tr>
                      );
                    })}
                </ReportTable>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
