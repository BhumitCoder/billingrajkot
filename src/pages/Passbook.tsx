import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getBills,
  getPurchaseBills,
  getExpenses,
  getBillReturns,
  getProducts,
  getPartyPayments,
  getClients,
} from "@/lib/storage";
import { Bill, PurchaseBill, Expense, BillReturn, Product, PartyPayment, Client } from "@/types";
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Calendar,
  Filter,
  Download,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/billUtils";
import * as XLSX from "xlsx";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";
import { dummyPassbookEntries } from "@/lib/dummyData";

interface PassbookEntry {
  id: string;
  date: string;
  type: "sale" | "purchase" | "expense" | "return" | "payment";
  description: string;
  partyName?: string;
  paymentMethod?: string;
  amount: number;
  balance: number;
  details: any;
  category?: string;
}

const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Card",
  "Bank Transfer",
  "Cheque",
  "Other",
] as const;

const normalizePaymentMethod = (method?: string) => {
  const normalized = method?.trim().toLowerCase() || "";

  if (!normalized) return "Other";
  if (normalized.includes("cash")) return "Cash";
  if (normalized.includes("upi")) return "UPI";
  if (normalized.includes("card")) return "Card";
  if (
    normalized.includes("bank") ||
    normalized.includes("transfer") ||
    normalized.includes("neft") ||
    normalized.includes("rtgs") ||
    normalized.includes("imps")
  ) {
    return "Bank Transfer";
  }
  if (normalized.includes("cheque") || normalized.includes("check")) {
    return "Cheque";
  }
  return "Other";
};

export default function Passbook() {
  const { locked, reloadKey } = useEncryptionLock();

  const [entries, setEntries] = useState<PassbookEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<PassbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    loadPassbookData();
  }, [locked, reloadKey]);

  useEffect(() => {
    applyFilters();
    setPage(1);
  }, [entries, filterType, filterCategory, dateRange, sortOrder]);

  const loadPassbookData = async () => {
    if (locked) { setEntries(dummyPassbookEntries as any); setLoading(false); return; }
    setLoading(true);
    try {
      const [bills, purchaseBills, expenses, returns, products, partyPayments, clients] =
        await Promise.all([
          getBills(),
          getPurchaseBills(),
          getExpenses(),
          getBillReturns(),
          getProducts(),
          getPartyPayments(),
          getClients(),
        ]);

      // Build a quick name lookup for party payments
      const clientMap: Record<string, string> = {};
      (clients as Client[]).forEach((c) => { clientMap[c.id] = c.name; });

      const visibleExpenses = expenses.filter(
        (expense) => (expense as any).sourceType !== "purchase_bill_auto",
      );

      // Calculate inventory value
      const totalInv = products.reduce((sum, product) => {
        const stock = product.stock || 0;
        const price = product.purchasePrice || product.price || 0;
        return sum + stock * price;
      }, 0);
      setInventoryValue(totalInv);

      const allEntries: PassbookEntry[] = [];

      // Add sales (positive amounts for received payments)
      bills.forEach((bill) => {
        const partyName = bill.client?.name || "Unknown Party";
        const gstNote = (bill as any).isGst && (bill as any).totalTax > 0
          ? ` [GST ₹${Math.round((bill as any).totalTax).toLocaleString("en-IN")}]`
          : "";
        if (bill.payments && bill.payments.length > 0) {
          bill.payments.filter((p) => p.method !== "Advance Adjustment").forEach((payment) => {
            allEntries.push({
              id: `payment-${payment.id}`,
              date: payment.date,
              type: "payment",
              description: `Sale Bill #${bill.billNumber}${gstNote}${payment.note ? ` — ${payment.note}` : ""}`,
              partyName,
              paymentMethod: payment.method,
              amount: payment.amount,
              balance: 0,
              details: { ...bill, currentPayment: payment },
            });
          });
        } else if (bill.paidAmount && bill.paidAmount > 0) {
          allEntries.push({
            id: `payment-legacy-${bill.id}`,
            date: bill.date,
            type: "payment",
            description: `Sale Bill #${bill.billNumber}${gstNote}`,
            partyName,
            paymentMethod: bill.modeOfPayment || bill.paymentType || undefined,
            amount: bill.paidAmount,
            balance: 0,
            details: bill,
          });
        }
      });

      // Add purchases (negative amounts for money spent)
      purchaseBills.forEach((purchase) => {
        const partyName = purchase.vendorName || "Unknown Party";
        if (purchase.payments && purchase.payments.length > 0) {
          purchase.payments.filter((p) => p.method !== "Advance Adjustment").forEach((payment) => {
            const isReturnPayment = payment.amount < 0;
            allEntries.push({
              id: `purchase-payment-${payment.id}`,
              date: payment.date,
              type: isReturnPayment ? "return" : "purchase",
              description: isReturnPayment
                ? `Purchase Return — Bill #${purchase.billNumber || "N/A"}`
                : `Purchase Bill #${purchase.billNumber || "N/A"}`,
              partyName,
              paymentMethod: payment.method,
              amount: payment.amount < 0 ? Math.abs(payment.amount) : -payment.amount,
              balance: 0,
              details: { ...purchase, currentPayment: payment },
            });
          });
        }
      });

      // Add party-level payments (collected/sent independent of specific bills)
      (partyPayments as PartyPayment[]).forEach((pp) => {
        const partyName = clientMap[pp.partyId] || "Unknown Party";
        const isCollected = pp.type === "collected";
        allEntries.push({
          id: `party-pay-${pp.id}`,
          date: pp.date,
          type: "payment",
          description: isCollected
            ? `Party Payment Received${pp.note ? ` — ${pp.note}` : ""}`
            : `Party Payment Sent${pp.note ? ` — ${pp.note}` : ""}`,
          partyName,
          paymentMethod: pp.method,
          amount: isCollected ? pp.amount : -pp.amount,
          balance: 0,
          details: pp,
        });
      });

      // Add expenses (negative amounts for money spent)
      visibleExpenses.forEach((expense) => {
        allEntries.push({
          id: `expense-${expense.id}`,
          date: expense.date,
          type: "expense",
          description: expense.description,
          amount: -expense.amount,
          balance: 0,
          details: expense,
          category: expense.category,
        });
      });

      // Add sales returns (only when actual cash refund was given)
      returns.forEach((returnItem) => {
        // Use actual refundPaidAmount; default to 0 (no cash movement) if not recorded
        const refundPaidAmount =
          typeof returnItem.refundPaidAmount === "number"
            ? returnItem.refundPaidAmount
            : 0;
        // Only add an entry when cash actually moved (refund was given)
        if (refundPaidAmount > 0) {
          allEntries.push({
            id: `return-${returnItem.id}`,
            date: returnItem.returnDate,
            type: "return",
            description: `Sales Return Refund - Bill #${returnItem.billNumber} - ${returnItem.clientName}`,
            amount: -refundPaidAmount,
            balance: 0,
            details: returnItem,
          });
        }
      });

      // Sort by date (Oldest to Newest) and calculate running balance
      const sortedEntries = allEntries.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.id.localeCompare(b.id);
      });

      let runningBalance = 0;
      const entriesWithBalance = sortedEntries.map((entry) => {
        runningBalance += entry.amount;
        return {
          ...entry,
          balance: runningBalance,
        };
      });

      const displayEntries =
        sortOrder === "asc"
          ? [...entriesWithBalance]
          : [...entriesWithBalance].reverse();
      setEntries(displayEntries);
    } catch (error) {
      console.error("Error loading passbook data:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...entries];

    if (filterType !== "all") {
      filtered = filtered.filter((entry) => entry.type === filterType);
    }

    if (filterCategory !== "all") {
      filtered = filtered.filter(
        (entry) => entry.category === filterCategory,
      );
    }

    // ── Running balance: compute across ALL entries in chronological order ──
    // This ensures that when a date filter is applied, the balance shown for
    // each visible entry is the TRUE cumulative total (including prior dates).
    const allSorted = [...entries].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.id.localeCompare(b.id);
    });
    let cumulativeBalance = 0;
    const balanceById: Record<string, number> = {};
    allSorted.forEach((entry) => {
      cumulativeBalance += entry.amount;
      balanceById[entry.id] = cumulativeBalance;
    });

    // Apply date filters — end date uses end-of-day so entries from that day are included
    if (dateRange.start) {
      filtered = filtered.filter(
        (entry) => new Date(entry.date) >= new Date(dateRange.start),
      );
    }
    if (dateRange.end) {
      const endOfDay = new Date(dateRange.end + "T23:59:59.999");
      filtered = filtered.filter(
        (entry) => new Date(entry.date) <= endOfDay,
      );
    }

    // Attach the pre-computed cumulative balance to each visible entry
    const filteredWithBalance = filtered.map((entry) => ({
      ...entry,
      balance: balanceById[entry.id] ?? 0,
    }));

    filteredWithBalance.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) {
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      }
      return sortOrder === "asc"
        ? a.id.localeCompare(b.id)
        : b.id.localeCompare(a.id);
    });

    setFilteredEntries(filteredWithBalance);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sale":
      case "payment":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "purchase":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case "expense":
        return <Minus className="h-4 w-4 text-orange-600" />;
      case "return":
        return <ArrowUpDown className="h-4 w-4 text-blue-600" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "sale":
      case "payment":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "purchase":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "expense":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "return":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const totalIncome = entries
    .filter((e) => e.amount > 0 && e.type === "payment")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalPurchases = entries
    .filter((e) => e.type === "purchase")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const totalExpensesOnly = entries
    .filter((e) => e.type === "expense")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const totalOutflow = entries
    .filter(
      (e) =>
        (e.amount < 0 && e.type !== "return") ||
        (e.type === "return" && e.amount < 0),
    )
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const totalPurchaseReturns = entries
    .filter((e) => e.type === "return" && e.amount > 0)
    .reduce((sum, e) => sum + e.amount, 0);
  const cashIn = entries
    .filter(
      (e) => e.type === "payment" || (e.type === "return" && e.amount > 0),
    )
    .reduce((sum, e) => sum + e.amount, 0);
  const cashOut = Math.abs(
    entries
      .filter(
        (e) =>
          e.type === "purchase" ||
          e.type === "expense" ||
          (e.type === "return" && e.amount < 0),
      )
      .reduce((sum, e) => sum + e.amount, 0),
  );
  const netBalance = cashIn - cashOut;

  const paymentMethodTotals = entries
    .filter((e) => e.type === "payment")
    .reduce(
      (acc, entry) => {
        const rawMethod =
          entry.details?.currentPayment?.method ||
          entry.details?.paymentType ||
          entry.details?.modeOfPayment;
        const method = normalizePaymentMethod(rawMethod);
        acc[method] = (acc[method] || 0) + entry.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

  const categories = [
    ...new Set(entries.filter((e) => e.category).map((e) => e.category!)),
  ];

  const exportToExcel = () => {
    const data = filteredEntries.map((entry) => ({
      Date: formatDate(entry.date),
      Type: entry.type.charAt(0).toUpperCase() + entry.type.slice(1),
      Description: entry.description,
      Amount: entry.amount,
      Category: entry.category || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Passbook");
    XLSX.writeFile(wb, "passbook.xlsx");
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <LoadingSpinner
          size="xl"
          text="Loading products..."
          fullScreen
          contentAreaOnly
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-background p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">Passbook</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            className="h-8 rounded-lg px-2.5 text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2 sm:p-4">
        <div className="h-full overflow-y-auto space-y-4 pr-1 sm:pr-2">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Card
              className={`${netBalance >= 0 ? "border-primary/20 bg-primary/5" : "border-destructive/20 bg-destructive/5"}`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-2.5 py-2">
                <CardTitle
                  className={`text-[10px] font-semibold tracking-wide uppercase sm:text-xs ${netBalance >= 0 ? "text-primary" : "text-destructive"}`}
                >
                  Net Balance
                </CardTitle>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${netBalance >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}
                >
                  <BookOpen
                    className={`h-3.5 w-3.5 ${netBalance >= 0 ? "text-primary" : "text-destructive"}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="px-2.5 pt-0 pb-2.5">
                <div
                  className={`mb-0.5 text-sm font-bold leading-tight sm:text-xl ${netBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                >
                  {formatCurrency(netBalance)}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Current account balance
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/70">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-2.5 py-2">
                <CardTitle className="text-[10px] font-semibold tracking-wide uppercase text-emerald-600 sm:text-xs">
                  Total Income
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                  <Plus className="h-3.5 w-3.5 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent className="px-2.5 pt-0 pb-2.5">
                <div className="mb-0.5 text-sm font-bold leading-tight text-emerald-600 sm:text-xl">
                  {formatCurrency(totalIncome)}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Actual cash received
                </p>
              </CardContent>
            </Card>

            <Card className="border-rose-200 bg-rose-50/70">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-2.5 py-2">
                <CardTitle className="text-[10px] font-semibold tracking-wide uppercase text-rose-600 sm:text-xs">
                  Total Outflow
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100">
                  <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                </div>
              </CardHeader>
              <CardContent className="px-2.5 pt-0 pb-2.5">
                <div className="mb-0.5 text-sm font-bold leading-tight text-rose-600 sm:text-xl">
                  {formatCurrency(totalOutflow)}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Purchases + Expenses
                </p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/70">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-2.5 py-2">
                <CardTitle className="text-[10px] font-semibold tracking-wide uppercase text-amber-600 sm:text-xs">
                  Total Inventory
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                  <BookOpen className="h-3.5 w-3.5 text-amber-600" />
                </div>
              </CardHeader>
              <CardContent className="px-2.5 pt-0 pb-2.5">
                <div className="mb-0.5 text-sm font-bold leading-tight text-amber-600 sm:text-xl">
                  {formatCurrency(inventoryValue)}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Stock value in hand
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/70">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-2.5 py-2">
                <CardTitle className="text-[10px] font-semibold tracking-wide uppercase text-blue-600 sm:text-xs">
                  Purchase Returns
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                  <ArrowUpDown className="h-3.5 w-3.5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent className="px-2.5 pt-0 pb-2.5">
                <div className="mb-0.5 text-sm font-bold leading-tight text-blue-600 sm:text-xl">
                  {formatCurrency(totalPurchaseReturns)}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Collected/remaining returns
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Collections by Payment Mode */}
          <Card className="border-border/70">
            <CardHeader className="px-3 pb-1.5 pt-3 sm:px-4">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Collections by Payment Mode
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-1.5 sm:px-4 sm:pb-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
                {PAYMENT_METHODS.map(
                  (method) => (
                    <div
                      key={method}
                      className="rounded-lg border border-border/70 bg-background/80 p-2.5 sm:p-3"
                    >
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {method}
                      </p>
                      <p className="mt-1 text-sm font-bold leading-tight sm:text-base">
                        {formatCurrency(
                          paymentMethodTotals[method as any] || 0,
                        )}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card className="border-border/70">
            <CardHeader className="border-b bg-muted/30 px-3 py-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Filter className="h-3.5 w-3.5 text-primary" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="sale">Sales (+)</SelectItem>
                      <SelectItem value="payment">Collections (+)</SelectItem>
                      <SelectItem value="purchase">Purchases (-)</SelectItem>
                      <SelectItem value="expense">Expenses (-)</SelectItem>
                      <SelectItem value="return">Returns (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Category</Label>
                  <Select
                    value={filterCategory}
                    onValueChange={setFilterCategory}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">From</Label>
                  <Input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, start: e.target.value })
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, end: e.target.value })
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                  }
                  className="h-8 gap-1.5 text-xs"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {sortOrder === "asc" ? "Old to New" : "New to Old"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilterType("all");
                    setFilterCategory("all");
                    setDateRange({ start: "", end: "" });
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card className="border-border/70">
            <CardHeader className="border-b bg-muted/20 pb-3">
              <CardTitle className="text-base sm:text-lg">
                Transaction History
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {filteredEntries.length}{" "}
                {filteredEntries.length === 1 ? "entry" : "entries"}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {filteredEntries.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm font-medium text-foreground mb-1">
                    No transactions found
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Try adjusting your filters
                  </p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[850px] border-collapse">
                    <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/55">
                      <tr className="border-b">
                        <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                          Date
                        </th>
                        <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                          Type
                        </th>
                        <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                          Description
                        </th>
                        <th className="text-right p-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                          Amount
                        </th>
                        <th className="text-right p-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((entry) => (
                        <tr
                          key={entry.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-4 align-top">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-primary/60" />
                              <span className="text-sm font-medium whitespace-nowrap">
                                {formatDate(entry.date)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 align-top">
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center ${entry.amount >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                              >
                                {getTypeIcon(entry.type)}
                              </div>
                              <Badge
                                className={`text-[10px] font-bold uppercase tracking-tighter ${getTypeBadgeColor(entry.type)}`}
                              >
                                {entry.type}
                              </Badge>
                            </div>
                          </td>
                          <td className="p-4 align-top max-w-[320px]">
                            <p className="text-sm font-semibold text-foreground leading-tight">
                              {entry.description}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {entry.partyName && (
                                <span className="text-[11px] font-medium text-primary/80 bg-primary/8 border border-primary/20 rounded px-1.5 py-0.5">
                                  {entry.partyName}
                                </span>
                              )}
                              {entry.paymentMethod && (
                                <span className="text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                                  {entry.paymentMethod}
                                </span>
                              )}
                              {entry.category && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] py-0 h-4 px-1.5 font-normal bg-muted/50"
                                >
                                  {entry.category}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-right align-top">
                            <div className="flex flex-col items-end">
                              <span
                                className={`font-bold text-base tabular-nums ${entry.amount >= 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                {entry.amount >= 0 ? "+" : ""}
                                {formatCurrency(entry.amount)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-right align-top">
                            <span
                              className={`font-bold text-sm tabular-nums ${entry.balance >= 0 ? "text-primary" : "text-destructive"}`}
                            >
                              {formatCurrency(entry.balance)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {filteredEntries.length > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t px-4 py-3 mt-1">
                  <p className="text-xs text-muted-foreground">
                    Showing{" "}
                    <span className="font-medium text-foreground">
                      {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredEntries.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-foreground">{filteredEntries.length}</span>{" "}
                    entries
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="px-2 text-xs text-muted-foreground tabular-nums">
                      {page} / {Math.ceil(filteredEntries.length / PAGE_SIZE)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      disabled={page >= Math.ceil(filteredEntries.length / PAGE_SIZE)}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
