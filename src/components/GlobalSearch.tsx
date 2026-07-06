import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  FileText,
  ShoppingCart,
  Users,
  Package,
  ScanSearch,
  Receipt,
  Loader2,
  LayoutDashboard,
  BarChart3,
  BookOpen,
  ArrowDownCircle,
  ArrowUpCircle,
  Smartphone,
} from "lucide-react";
import {
  getBills,
  getPurchaseBills,
  getClients,
  getProducts,
  getInventoryUnits,
  getExpenses,
} from "@/lib/storage";
import type {
  Bill,
  PurchaseBill,
  Client,
  Product,
  InventoryUnit,
  Expense,
} from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "2-digit",
    });
  } catch { return ""; }
}
function c(haystack: string | undefined | null, needle: string) {
  return (haystack || "").toLowerCase().includes(needle);
}

// ── Badges ─────────────────────────────────────────────────────────────────
function PayBadge({ status }: { status: string }) {
  const cls =
    status === "paid"    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : status === "partial" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
    : status === "overdue"  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize leading-none ${cls}`}>
      {status}
    </span>
  );
}
function InvBadge({ status }: { status: string }) {
  const cls =
    status === "in_stock"  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : status === "sold"      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    : status === "returned"  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
    : status === "deadstock" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
function Dot() {
  return <span className="text-muted-foreground/50 mx-0.5">·</span>;
}

// ── Quick nav ───────────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { label: "Home / Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Sale Bills",        icon: FileText,         path: "/bills" },
  { label: "Purchase Bills",    icon: ShoppingCart,     path: "/purchases" },
  { label: "Parties",           icon: Users,            path: "/clients" },
  { label: "Products",          icon: Package,          path: "/products" },
  { label: "IMEI Timeline",     icon: ScanSearch,       path: "/imei-timeline" },
  { label: "Report",            icon: BarChart3,        path: "/report" },
  { label: "Passbook",          icon: BookOpen,         path: "/passbook" },
  { label: "Expenses",          icon: Receipt,          path: "/expenses" },
];

// ── Enriched types ──────────────────────────────────────────────────────────
interface ClientEnriched extends Client {
  totalSales: number;
  totalCollected: number;
  saleOutstanding: number;
  saleBillCount: number;
  totalPurchase: number;
  totalPaid: number;
  purchaseOutstanding: number;
  purchaseBillCount: number;
}

interface ProductEnriched extends Product {
  inStockCount: number;
  soldCount: number;
  returnedCount: number;
  deadCount: number;
  totalUnits: number;
}

interface UnitEnriched extends InventoryUnit {
  purchaseBillRef?: PurchaseBill;
  saleBillRef?: Bill;
}

// ── Props ───────────────────────────────────────────────────────────────────
interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

// ── Component ───────────────────────────────────────────────────────────────
export function GlobalSearch({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [bills, setBills] = useState<Bill[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<InventoryUnit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (!open) { setQuery(""); return; }
    setLoading(true);
    Promise.all([getBills(), getPurchaseBills(), getClients(), getProducts(), getInventoryUnits(), getExpenses()])
      .then(([b, pb, cl, p, iu, e]) => {
        setBills(b);
        setPurchaseBills(pb);
        setClients(cl);
        setProducts(p);
        setInventoryUnits(iu);
        setExpenses(e.filter(ex => ex.sourceType !== "purchase_bill_auto"));
      })
      .finally(() => setLoading(false));
  }, [open]);

  const q = query.toLowerCase().trim();
  const hasQuery = q.length >= 2;

  // ── Pre-compute lookup maps ─────────────────────────────────────────────
  const billsById = useMemo(() => new Map(bills.map(b => [b.id, b])), [bills]);
  const purchaseBillsById = useMemo(() => new Map(purchaseBills.map(b => [b.id, b])), [purchaseBills]);

  // ── Client financials (sales + purchases) ──────────────────────────────
  const clientFinancials = useMemo(() => {
    const map = new Map<string, {
      totalSales: number; totalCollected: number; saleOutstanding: number; saleBillCount: number;
      totalPurchase: number; totalPaid: number; purchaseOutstanding: number; purchaseBillCount: number;
    }>();
    const def = () => ({ totalSales:0, totalCollected:0, saleOutstanding:0, saleBillCount:0, totalPurchase:0, totalPaid:0, purchaseOutstanding:0, purchaseBillCount:0 });
    bills.forEach(b => {
      if (!b.clientId) return;
      const e = map.get(b.clientId) || def(); map.set(b.clientId, {
        ...e,
        totalSales: e.totalSales + (b.total || 0),
        totalCollected: e.totalCollected + (b.paidAmount || 0),
        saleOutstanding: e.saleOutstanding + (b.paymentStatus !== "paid" ? Math.max(0, (b.total||0)-(b.paidAmount||0)) : 0),
        saleBillCount: e.saleBillCount + 1,
      });
    });
    purchaseBills.forEach(b => {
      const cid = b.clientId; if (!cid) return;
      const e = map.get(cid) || def(); map.set(cid, {
        ...e,
        totalPurchase: e.totalPurchase + (b.total || 0),
        totalPaid: e.totalPaid + (b.paidAmount || 0),
        purchaseOutstanding: e.purchaseOutstanding + (b.paymentStatus !== "paid" ? Math.max(0, (b.total||0)-(b.paidAmount||0)) : 0),
        purchaseBillCount: e.purchaseBillCount + 1,
      });
    });
    return map;
  }, [bills, purchaseBills]);

  // ── Product inventory unit counts ───────────────────────────────────────
  const productUnitStats = useMemo(() => {
    const map = new Map<string, { inStockCount:number; soldCount:number; returnedCount:number; deadCount:number; totalUnits:number }>();
    inventoryUnits.forEach(u => {
      const e = map.get(u.productId) || { inStockCount:0, soldCount:0, returnedCount:0, deadCount:0, totalUnits:0 };
      map.set(u.productId, {
        inStockCount:   e.inStockCount   + (u.status === "in_stock" ? 1 : 0),
        soldCount:      e.soldCount      + (u.status === "sold" ? 1 : 0),
        returnedCount:  e.returnedCount  + (u.status === "returned" ? 1 : 0),
        deadCount:      e.deadCount      + (u.status === "deadstock" ? 1 : 0),
        totalUnits:     e.totalUnits + 1,
      });
    });
    return map;
  }, [inventoryUnits]);

  // ── Filtered results ─────────────────────────────────────────────────────
  const filteredBills = useMemo((): Bill[] => {
    if (!hasQuery) return [];
    return bills.filter(b =>
      c(b.billNumber, q) || c(b.client?.name, q) || c(b.client?.phone, q) ||
      c(String(b.total||""), q) || c(b.notes, q)
    ).slice(0, 6);
  }, [bills, q, hasQuery]);

  const filteredPurchase = useMemo((): PurchaseBill[] => {
    if (!hasQuery) return [];
    return purchaseBills.filter(b =>
      c(b.billNumber, q) || c(b.vendorName, q) || c(String(b.total||""), q) || c(b.notes, q)
    ).slice(0, 6);
  }, [purchaseBills, q, hasQuery]);

  const filteredClients = useMemo((): ClientEnriched[] => {
    if (!hasQuery) return [];
    return clients
      .filter(cl => c(cl.name,q) || c(cl.phone,q) || c(cl.billingAddress,q) || c(cl.gstin,q) || c(cl.email,q))
      .slice(0, 5)
      .map(cl => ({ ...cl, ...(clientFinancials.get(cl.id) || { totalSales:0,totalCollected:0,saleOutstanding:0,saleBillCount:0,totalPurchase:0,totalPaid:0,purchaseOutstanding:0,purchaseBillCount:0 }) }));
  }, [clients, q, hasQuery, clientFinancials]);

  const filteredProducts = useMemo((): ProductEnriched[] => {
    if (!hasQuery) return [];
    return products
      .filter(p => c(p.name,q) || c(p.model,q) || c(p.barcode,q) || c(p.storage,q) || c(p.color,q) || c(p.itemNo,q) || c(p.brand,q))
      .slice(0, 6)
      .map(p => ({ ...p, ...(productUnitStats.get(p.id) || { inStockCount:0, soldCount:0, returnedCount:0, deadCount:0, totalUnits:0 }) }));
  }, [products, q, hasQuery, productUnitStats]);

  const filteredUnits = useMemo((): UnitEnriched[] => {
    if (!hasQuery) return [];
    return inventoryUnits
      .filter(u =>
        c(u.imeiNumber, q) || c(u.serialNumber, q) ||
        c(u.productName, q) || c(u.vendorName, q) || c(u.model, q) || c(u.storage, q) || c(u.color, q)
      )
      .slice(0, 6)
      .map(u => ({
        ...u,
        purchaseBillRef: u.purchaseBillId ? purchaseBillsById.get(u.purchaseBillId) : undefined,
        saleBillRef:     u.soldBillId     ? billsById.get(u.soldBillId)             : undefined,
      }));
  }, [inventoryUnits, q, hasQuery, billsById, purchaseBillsById]);

  const filteredExpenses = useMemo((): Expense[] => {
    if (!hasQuery) return [];
    return expenses.filter(e => c(e.description,q) || c(e.category,q) || c(String(e.amount||""),q)).slice(0,5);
  }, [expenses, q, hasQuery]);

  const totalResults =
    filteredBills.length + filteredPurchase.length + filteredClients.length +
    filteredProducts.length + filteredUnits.length + filteredExpenses.length;

  const go = (path: string, state?: Record<string, unknown>) => { onOpenChange(false); navigate(path, state ? { state } : undefined); };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-xl max-w-2xl w-full gap-0 flex flex-col max-h-[90dvh]">
        <Command
          shouldFilter={false}
          className="flex flex-col min-h-0 flex-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
        <CommandInput
          placeholder="Search bills, parties, IMEI, mobile models, expenses…"
          value={query}
          onValueChange={setQuery}
        />

      <CommandList className="flex-1 overflow-y-auto min-h-0">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span>Loading all records…</span>
          </div>
        )}

        {/* Quick navigation when empty */}
        {!loading && !hasQuery && (
          <CommandGroup heading="Quick Navigate">
            {QUICK_LINKS.map(link => {
              const Icon = link.icon;
              return (
                <CommandItem key={link.path} value={link.label} onSelect={() => go(link.path)} className="gap-3">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span>{link.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* No results */}
        {!loading && hasQuery && totalResults === 0 && (
          <CommandEmpty>No results found for &quot;{query}&quot;</CommandEmpty>
        )}

        {/* ── SALE BILLS ─────────────────────────────────────────────────── */}
        {filteredBills.length > 0 && (
          <>
            <CommandGroup heading={`Sale Bills (${filteredBills.length})`}>
              {filteredBills.map(bill => {
                const balance = Math.max(0, (bill.total||0) - (bill.paidAmount||0));
                return (
                  <CommandItem
                    key={bill.id} value={`sale-${bill.id}`}
                    onSelect={() => go(`/bills/${bill.id}`)}
                    className="flex items-start gap-2.5 py-2 px-2"
                  >
                    <FileText className="mt-0.5 size-4 shrink-0 text-blue-500" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm">#{bill.billNumber || "—"}</span>
                        <Dot />
                        <span className="text-sm font-medium truncate max-w-[160px]">{bill.client?.name || "—"}</span>
                        <PayBadge status={bill.paymentStatus} />
                        {(bill as any).isGst && (
                          <span className="rounded px-1 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">GST</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                        <span>{fmtDate(bill.date || bill.createdAt)}</span>
                        <Dot />
                        <span className="font-medium text-foreground">{fmt(bill.total||0)}</span>
                        {bill.paidAmount > 0 && <><Dot /><span className="text-green-600">Paid {fmt(bill.paidAmount)}</span></>}
                        {balance > 0 && <><Dot /><span className="text-red-500">Due {fmt(balance)}</span></>}
                        {bill.client?.phone && <><Dot /><span>{bill.client.phone}</span></>}
                      </div>
                      {bill.items?.length > 0 && (
                        <p className="text-[11px] text-muted-foreground/70 truncate">
                          {bill.items.slice(0,3).map(i => i.productName).join(", ")}
                          {bill.items.length > 3 && ` +${bill.items.length - 3} more`}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* ── PURCHASE BILLS ─────────────────────────────────────────────── */}
        {filteredPurchase.length > 0 && (
          <>
            <CommandGroup heading={`Purchase Bills (${filteredPurchase.length})`}>
              {filteredPurchase.map(bill => {
                const balance = Math.max(0, (bill.total||0) - (bill.paidAmount||0));
                return (
                  <CommandItem
                    key={bill.id} value={`purchase-${bill.id}`}
                    onSelect={() => go("/purchases")}
                    className="flex items-start gap-2.5 py-2 px-2"
                  >
                    <ShoppingCart className="mt-0.5 size-4 shrink-0 text-orange-500" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm">#{bill.billNumber || "—"}</span>
                        <Dot />
                        <span className="text-sm font-medium truncate max-w-[160px]">{bill.vendorName || "—"}</span>
                        <PayBadge status={bill.paymentStatus} />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                        <span>{fmtDate(bill.billDate || bill.createdAt)}</span>
                        <Dot />
                        <span className="font-medium text-foreground">{fmt(bill.total||0)}</span>
                        {bill.paidAmount > 0 && <><Dot /><span className="text-green-600">Paid {fmt(bill.paidAmount)}</span></>}
                        {balance > 0 && <><Dot /><span className="text-red-500">Due {fmt(balance)}</span></>}
                      </div>
                      {bill.items?.length > 0 && (
                        <p className="text-[11px] text-muted-foreground/70 truncate">
                          {bill.items.slice(0,3).map(i => i.description).join(", ")}
                          {bill.items.length > 3 && ` +${bill.items.length - 3} more`}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* ── PARTIES / CLIENTS ──────────────────────────────────────────── */}
        {filteredClients.length > 0 && (
          <>
            <CommandGroup heading={`Parties (${filteredClients.length})`}>
              {filteredClients.map(cl => (
                <CommandItem
                  key={cl.id} value={`client-${cl.id}`}
                  onSelect={() => go("/clients", { selectedClientId: cl.id })}
                  className="flex items-start gap-2.5 py-2 px-2"
                >
                  <Users className="mt-0.5 size-4 shrink-0 text-violet-500" />
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Name + contact */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm">{cl.name}</span>
                      {cl.phone && <><Dot /><span className="text-xs text-muted-foreground">{cl.phone}</span></>}
                      {cl.gstin && <span className="text-[10px] font-mono text-muted-foreground/70 ml-1">GST: {cl.gstin}</span>}
                    </div>
                    {cl.billingAddress && (
                      <p className="text-[11px] text-muted-foreground/70 truncate">{cl.billingAddress.slice(0,60)}</p>
                    )}
                    {/* Financial summary row */}
                    {(cl.saleBillCount > 0 || cl.purchaseBillCount > 0) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {cl.saleBillCount > 0 && (
                          <div className="flex items-center gap-1 text-[11px]">
                            <ArrowUpCircle className="size-3 text-green-500 shrink-0" />
                            <span className="text-muted-foreground">{cl.saleBillCount} bills</span>
                            <Dot />
                            <span className="font-medium">{fmt(cl.totalSales)}</span>
                            {cl.totalCollected > 0 && <><Dot /><span className="text-green-600">Collected {fmt(cl.totalCollected)}</span></>}
                            {cl.saleOutstanding > 0 && <><Dot /><span className="text-red-500 font-semibold">Due {fmt(cl.saleOutstanding)}</span></>}
                          </div>
                        )}
                        {cl.purchaseBillCount > 0 && (
                          <div className="flex items-center gap-1 text-[11px]">
                            <ArrowDownCircle className="size-3 text-orange-500 shrink-0" />
                            <span className="text-muted-foreground">{cl.purchaseBillCount} purchases</span>
                            <Dot />
                            <span className="font-medium">{fmt(cl.totalPurchase)}</span>
                            {cl.purchaseOutstanding > 0 && <><Dot /><span className="text-red-500 font-semibold">Due {fmt(cl.purchaseOutstanding)}</span></>}
                          </div>
                        )}
                      </div>
                    )}
                    {cl.saleBillCount === 0 && cl.purchaseBillCount === 0 && (
                      <p className="text-[11px] text-muted-foreground/60">No transactions yet</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* ── PRODUCTS / MOBILE MODELS ───────────────────────────────────── */}
        {filteredProducts.length > 0 && (
          <>
            <CommandGroup heading={`Products / Models (${filteredProducts.length})`}>
              {filteredProducts.map(p => (
                <CommandItem
                  key={p.id} value={`product-${p.id}`}
                  onSelect={() => go("/products")}
                  className="flex items-start gap-2.5 py-2 px-2"
                >
                  <Smartphone className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {/* Model title */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-semibold text-sm">{p.name}</span>
                      {p.model   && <span className="text-xs text-muted-foreground">{p.model}</span>}
                      {p.storage && <span className="text-xs text-muted-foreground">{p.storage}</span>}
                      {p.color   && <span className="text-xs text-muted-foreground">{p.color}</span>}
                    </div>
                    {/* Pricing */}
                    <div className="flex items-center gap-1 text-xs flex-wrap">
                      <span className="text-muted-foreground">Buy:</span>
                      <span className="font-medium text-orange-600">{fmt(p.purchasePrice || 0)}</span>
                      <Dot />
                      <span className="text-muted-foreground">Sell:</span>
                      <span className="font-medium text-green-600">{fmt(p.sellingPrice || p.price || 0)}</span>
                      {p.purchasePrice > 0 && (p.sellingPrice || p.price || 0) > 0 && (
                        <>
                          <Dot />
                          <span className="text-muted-foreground">Margin:</span>
                          <span className="font-medium text-blue-600">
                            {fmt((p.sellingPrice || p.price || 0) - p.purchasePrice)}
                          </span>
                        </>
                      )}
                    </div>
                    {/* Stock breakdown */}
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {p.totalUnits > 0 ? (
                        <>
                          <span className="flex items-center gap-1 rounded-md bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400">
                            In Stock: {p.inStockCount}
                          </span>
                          {p.soldCount > 0 && (
                            <span className="flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                              Sold: {p.soldCount}
                            </span>
                          )}
                          {p.returnedCount > 0 && (
                            <span className="flex items-center gap-1 rounded-md bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-400">
                              Returned: {p.returnedCount}
                            </span>
                          )}
                          {p.deadCount > 0 && (
                            <span className="flex items-center gap-1 rounded-md bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-400">
                              Dead: {p.deadCount}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            Total: {p.totalUnits} units
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Stock: {p.stock ?? 0} {p.unit || "pcs"}
                        </span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* ── IMEI / INVENTORY UNITS ─────────────────────────────────────── */}
        {filteredUnits.length > 0 && (
          <>
            <CommandGroup heading={`IMEI / Device History (${filteredUnits.length})`}>
              {filteredUnits.map(unit => {
                const pb = unit.purchaseBillRef;
                const sb = unit.saleBillRef;
                return (
                  <CommandItem
                    key={unit.id} value={`imei-${unit.id}`}
                    onSelect={() => go("/imei-timeline", { selectedUnitId: unit.id })}
                    className="flex items-start gap-2.5 py-2 px-2"
                  >
                    <ScanSearch className="mt-1 size-4 shrink-0 text-cyan-500" />
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* IMEI + status */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-semibold text-xs">{unit.imeiNumber}</span>
                        <InvBadge status={unit.status} />
                      </div>
                      {/* Product details */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                        <Package className="size-3 shrink-0" />
                        <span className="font-medium text-foreground">{unit.productName}</span>
                        {unit.model   && <><Dot /><span>{unit.model}</span></>}
                        {unit.storage && <><Dot /><span>{unit.storage}</span></>}
                        {unit.color   && <><Dot /><span>{unit.color}</span></>}
                      </div>
                      {/* Purchase history */}
                      <div className="flex items-start gap-1 text-[11px] text-muted-foreground">
                        <ArrowDownCircle className="size-3 shrink-0 mt-0.5 text-orange-400" />
                        <span>
                          <span className="text-foreground/80 font-medium">Purchased</span>
                          {pb ? (
                            <>
                              {" "}from <span className="font-medium text-foreground">{pb.vendorName}</span>
                              {(pb.billDate || pb.createdAt) && <> on {fmtDate(pb.billDate || pb.createdAt)}</>}
                              {unit.purchasePrice && <> — Cost: <span className="font-semibold text-orange-600">{fmt(unit.purchasePrice)}</span></>}
                              {pb.billNumber && <> (Bill #{pb.billNumber})</>}
                            </>
                          ) : unit.vendorName ? (
                            <> from <span className="font-medium text-foreground">{unit.vendorName}</span>
                              {unit.purchasePrice && <> — Cost: <span className="font-semibold text-orange-600">{fmt(unit.purchasePrice)}</span></>}
                            </>
                          ) : " info not found"}
                        </span>
                      </div>
                      {/* Sale history */}
                      {unit.status === "sold" && (
                        <div className="flex items-start gap-1 text-[11px] text-muted-foreground">
                          <ArrowUpCircle className="size-3 shrink-0 mt-0.5 text-green-400" />
                          <span>
                            <span className="text-foreground/80 font-medium">Sold</span>
                            {sb ? (
                              <>
                                {" "}to <span className="font-medium text-foreground">{sb.client?.name || "—"}</span>
                                {sb.client?.phone && <> ({sb.client.phone})</>}
                                {unit.soldAt && <> on {fmtDate(unit.soldAt)}</>}
                                {unit.sellingPrice && <> — Sale: <span className="font-semibold text-green-600">{fmt(unit.sellingPrice)}</span></>}
                                {sb.billNumber && <> (Bill #{sb.billNumber})</>}
                              </>
                            ) : unit.soldAt ? (
                              <> on {fmtDate(unit.soldAt)}
                                {unit.sellingPrice && <> — Sale: <span className="font-semibold text-green-600">{fmt(unit.sellingPrice)}</span></>}
                              </>
                            ) : " — details not found"}
                          </span>
                        </div>
                      )}
                      {/* Profit if sold */}
                      {unit.status === "sold" && unit.purchasePrice && unit.sellingPrice && (
                        <div className="text-[11px]">
                          <span className="text-muted-foreground">Profit: </span>
                          <span className={`font-semibold ${unit.sellingPrice - unit.purchasePrice >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {fmt(unit.sellingPrice - unit.purchasePrice)}
                          </span>
                        </div>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* ── EXPENSES ──────────────────────────────────────────────────── */}
        {filteredExpenses.length > 0 && (
          <CommandGroup heading={`Expenses (${filteredExpenses.length})`}>
            {filteredExpenses.map(expense => (
              <CommandItem
                key={expense.id} value={`expense-${expense.id}`}
                onSelect={() => go("/expenses")}
                className="flex items-start gap-2.5 py-2 px-2"
              >
                <Receipt className="mt-0.5 size-4 shrink-0 text-rose-500" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{expense.category || "Expense"}</span>
                    <span className="text-sm font-bold text-rose-600 shrink-0">{fmt(expense.amount)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{fmtDate(expense.date)}</span>
                    {expense.description && <><Dot /><span className="truncate max-w-[200px]">{expense.description}</span></>}
                    <><Dot /><span className="capitalize">{expense.paymentMethod}</span></>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>

      {/* Footer */}
      <div className="flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground select-none">
        <span>↑↓ navigate</span>
        <span>↵ open</span>
        <span>Esc close</span>
        {!loading && hasQuery && (
          <span className="ml-auto font-medium">
            {totalResults} result{totalResults !== 1 ? "s" : ""}
          </span>
        )}
        {!loading && !hasQuery && (
          <span className="ml-auto opacity-60">Type 2+ chars to search</span>
        )}
      </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
