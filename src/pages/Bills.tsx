import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  getBills,
  deleteBill,
  updateBillPayment,
} from "@/lib/storage";
import { Bill, PaymentMethod } from "@/types";
import { formatCurrency, formatDate } from "@/lib/billUtils";
import * as XLSX from "xlsx";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Filter,
  IndianRupee,
  Loader2,
  Calendar,
  User,
  Receipt,
  FileText,
  Share2,
  MessageCircle,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  Truck,
  Wallet,
  Landmark,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";
import { dummyBills } from "@/lib/dummyData";
import { PaymentDialog } from "@/components/PaymentDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadImage } from "@/lib/utils";

export default function Bills() {
  const location = useLocation();
  const navigate = useNavigate();
  const resolveTabFromPath = (_pathname: string): string => "all";
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gstFilter, setGstFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [activeTab, setActiveTab] = useState(() =>
    resolveTabFromPath(location.pathname),
  );
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 10;
  const { locked, reloadKey } = useEncryptionLock();

  useEffect(() => {
    loadData();
  }, [locked, reloadKey]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "KeyA") { e.preventDefault(); navigate("/bills/new"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedDate, statusFilter, gstFilter, sortBy, activeTab]);

  useEffect(() => {
    setActiveTab(resolveTabFromPath(location.pathname));
  }, [location.pathname]);

  const loadData = async () => {
    if (locked) { setBills(dummyBills); setLoading(false); return; }
    try {
      setLoading(true);
      const allBills = await getBills();
      setBills(allBills);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const getFilteredBills = () => {
    let filtered = [...bills];

    // Date filter first: then search works on selected-date bills
    if (selectedDate) {
      filtered = filtered.filter((bill) => {
        const d = new Date(bill.date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}` === selectedDate;
      });
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (bill) =>
          bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (bill.client?.name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (bill.client?.phone && bill.client.phone.includes(searchTerm)),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((bill) => bill.paymentStatus === statusFilter);
    }

    // GST filter
    if (gstFilter === "gst") {
      filtered = filtered.filter((bill) => (bill as any).isGst === true);
    } else if (gstFilter === "non-gst") {
      filtered = filtered.filter((bill) => !(bill as any).isGst);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case "date-asc":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "amount-desc":
          return b.total - a.total;
        case "amount-asc":
          return a.total - b.total;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredBills = getFilteredBills();
  const pendingCount = filteredBills.filter(
    (bill) => bill.paymentStatus === "pending" || bill.paymentStatus === "partial",
  ).length;
  const paidCount = filteredBills.filter(
    (bill) => bill.paymentStatus === "paid",
  ).length;
  const overdueCount = filteredBills.filter(
    (bill) => bill.paymentStatus === "overdue",
  ).length;
  const totalSales = filteredBills.reduce((sum, bill) => sum + bill.total, 0);
  const totalPaid = filteredBills.reduce(
    (sum, bill) => sum + (bill.paidAmount || 0),
    0,
  );
  const totalPending = filteredBills.reduce(
    (sum, bill) => sum + Math.max(0, bill.total - (bill.paidAmount || 0)),
    0,
  );
  const totalReturn = filteredBills.reduce(
    (sum, bill) => sum + (bill.returnedAmount || 0),
    0,
  );
  const totalCourier = filteredBills.reduce(
    (sum, bill) => sum + (bill.courierCharges || 0),
    0,
  );
  const paymentMethods = filteredBills.reduce(
    (acc, bill) => {
      const b = bill as any;
      if (b.payments && Array.isArray(b.payments) && b.payments.length > 0) {
        b.payments.forEach((p: any) => {
          const method = p.method || "Other";
          acc[method] = (acc[method] || 0) + (Number(p.amount) || 0);
        });
      } else if (b.paidAmount > 0) {
        const method = b.paymentMethod || b.paymentType || "Other";
        acc[method] = (acc[method] || 0) + (Number(b.paidAmount) || 0);
      }
      return acc;
    },
    {} as Record<string, number>,
  );
  const totalCashCollected = paymentMethods["Cash"] || 0;
  const totalBankCollected =
    (paymentMethods["Bank Transfer"] || 0) +
    (paymentMethods["Cheque"] || 0) +
    (paymentMethods["UPI"] || 0);
  const tabLabelMap: Record<string, string> = {
    all: "All Bills",
  };
  const pageTitleMap: Record<string, string> = {
    all: "All Bills",
  };
  const pageSubtitleMap: Record<string, string> = {
    all: "Manage and track all invoices",
  };
  const createBillLabelMap: Record<string, string> = {
    all: "Create Bill",
  };
  const createBillPathMap: Record<string, string> = {
    all: "/bills/new",
  };
  const statusLabelMap: Record<string, string> = {
    all: "All Status",
    paid: "Paid",
    pending: "Pending",
    partial: "Partial",
    overdue: "Overdue",
    overpaid: "Overpaid",
  };
  const sortLabelMap: Record<string, string> = {
    "date-desc": "Date (Newest)",
    "date-asc": "Date (Oldest)",
    "amount-desc": "Amount (High to Low)",
    "amount-asc": "Amount (Low to High)",
  };
  const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedBills = filteredBills.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const handleDelete = async (id: string) => {
    if (locked) { toast.error("Unable to save. Check your connection."); return; }
    setDeletingId(id);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await deleteBill(id);
      await loadData();
      toast.success("Bill deleted successfully");
    } catch (err) {
      console.error("Error deleting bill:", err);
      toast.error("Failed to delete bill");
    } finally {
      setDeletingId(null);
    }
  };

  const handlePaymentCollected = async (
    amount: number,
    type: PaymentMethod,
    note?: string,
    date?: string,
    bankAccountId?: string,
  ) => {
    if (selectedBill) {
      try {
        await updateBillPayment(selectedBill.id, amount, type, note, date, bankAccountId);
        await loadData();
        toast.success(
          `Payment of ${formatCurrency(amount)} via ${type} collected successfully`,
        );
      } catch (err) {
        console.error("Error recording payment:", err);
        toast.error("Failed to record payment. Please try again.");
      }
    }
  };

  const openPaymentDialog = (bill: Bill) => {
    setSelectedBill(bill);
    setPaymentDialogOpen(true);
  };

  const exportSalesToExcel = () => {
    if (filteredBills.length === 0) {
      toast.error("No bills to export");
      return;
    }
    const rows = filteredBills.map((b) => {
      const items = (b.items || []).map((i) => `${i.productName} x${i.quantity}`).join(", ");
      const paymentMethods = (b.payments || []).map((p) => `${p.method} ₹${p.amount.toFixed(2)}`).join(", ");
      const balanceDue = Math.max(0, b.total - (b.paidAmount || 0));
      return {
        "Bill #": b.billNumber || "",
        "Date": b.date ? new Date(b.date).toLocaleDateString("en-IN") : "",
        "Due Date": b.dueDate ? new Date(b.dueDate).toLocaleDateString("en-IN") : "",
        "Client Name": b.client?.name || "",
        "Client Phone": b.client?.phone || "",
        "Items": items,
        "Subtotal (₹)": b.subtotal || 0,
        "Discount (₹)": b.discount || 0,
        "Courier Charges (₹)": b.courierCharges || 0,
        "Other Charges (₹)": b.otherCharges || 0,
        "Total (₹)": b.total || 0,
        "Paid (₹)": b.paidAmount || 0,
        "Balance Due (₹)": balanceDue,
        "Payment Status": b.paymentStatus || "",
        "Payment Method(s)": paymentMethods,
        "Notes": b.notes || "",
        "GST Bill": (b as any).isGst ? "Yes" : "No",
        "GST Rate": (b as any).gstRate ? `${(b as any).gstRate}%` : "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    // Column widths
    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 14 },
      { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 },
      { wch: 20 }, { wch: 10 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Bills");
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Sales_Bills_${dateStr}.xlsx`);
    toast.success(`Exported ${filteredBills.length} bills`);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      paid: "default",
      pending: "secondary",
      partial: "secondary",
      overdue: "destructive",
      overpaid: "default",
    };

    const labels: Record<string, string> = {
      paid: "Paid",
      pending: "Pending",
      partial: "Partial",
      overdue: "Overdue",
      overpaid: "Overpaid",
    };

    const extraClass =
      status === "partial"
        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
        : status === "overpaid"
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          : "";

    return (
      <Badge
        variant={variants[status] ?? "secondary"}
        className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium ${extraClass}`}
      >
        {labels[status] ?? status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <LoadingSpinner
        size="xl"
        text="Loading bills..."
        fullScreen
        contentAreaOnly
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-background p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Receipt className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">
              {pageTitleMap[activeTab] || "Sales"}
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 items-center gap-1.5 rounded-lg bg-background px-2.5 text-xs"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Filter</span>
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 max-h-[60vh] overflow-y-auto overscroll-contain"
            >
                <DropdownMenuLabel>Bill Type</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setActiveTab("all")}>
                  {activeTab === "all" ? "* " : ""}All Bills
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>GST Type</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setGstFilter("all")}>
                  {gstFilter === "all" ? "* " : ""}All Bills
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGstFilter("gst")}>
                  {gstFilter === "gst" ? "* " : ""}GST Bills
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGstFilter("non-gst")}>
                  {gstFilter === "non-gst" ? "* " : ""}Non-GST Bills
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Payment Status</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  {statusFilter === "all" ? "* " : ""}All Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("paid")}>
                  {statusFilter === "paid" ? "* " : ""}Paid
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>
                  {statusFilter === "pending" ? "* " : ""}Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("partial")}>
                  {statusFilter === "partial" ? "* " : ""}Partial
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("overdue")}>
                  {statusFilter === "overdue" ? "* " : ""}Overdue
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("overpaid")}>
                  {statusFilter === "overpaid" ? "* " : ""}Overpaid
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Sort</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSortBy("date-desc")}>
                  {sortBy === "date-desc" ? "* " : ""}Date (Newest)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("date-asc")}>
                  {sortBy === "date-asc" ? "* " : ""}Date (Oldest)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("amount-desc")}>
                  {sortBy === "amount-desc" ? "* " : ""}Amount (High to Low)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("amount-asc")}>
                  {sortBy === "amount-asc" ? "* " : ""}Amount (Low to High)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setActiveTab("all");
                    setStatusFilter("all");
                    setGstFilter("all");
                    setSortBy("date-desc");
                    setSearchTerm("");
                    setSelectedDate("");
                  }}
                >
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Reset All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              className="h-8 items-center gap-1.5 rounded-lg bg-background px-2.5 text-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              {filteredBills.length}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 items-center gap-1.5 rounded-lg bg-background px-2.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
              onClick={exportSalesToExcel}
              title="Download filtered bills as Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Link to="/bills/new">
              <Button size="sm" className="h-8 rounded-lg px-3 text-xs shadow-sm">
                <Plus className="mr-1 h-3.5 w-3.5" />
                New Sale
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-2xl border border-border/70 bg-background/60 p-2 sm:p-3">
      <div className="h-full overflow-y-auto space-y-4 pr-1 sm:pr-2">

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="mb-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {tabLabelMap[activeTab]} - {statusLabelMap[statusFilter]} - {sortLabelMap[sortBy]}
              {selectedDate ? ` - ${selectedDate}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px]">
                Pending {pendingCount}
              </Badge>
              <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px]">
                Paid {paidCount}
              </Badge>
              <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px]">
                Overdue {overdueCount}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Card className="rounded-xl border-primary/30">
            <CardContent className="px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sales</p>
              <p className="mt-1 text-sm font-bold tabular-nums">{formatCurrency(totalSales)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-emerald-300/60">
            <CardContent className="px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Paid</p>
              <p className="mt-1 text-sm font-bold text-emerald-700 tabular-nums">{formatCurrency(totalPaid)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-amber-300/60">
            <CardContent className="px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Pending</p>
              <p className="mt-1 text-sm font-bold text-amber-700 tabular-nums">{formatCurrency(totalPending)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-rose-300/60">
            <CardContent className="px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Returns</p>
              <p className="mt-1 text-sm font-bold text-rose-700 tabular-nums">{formatCurrency(totalReturn)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-sky-300/60">
            <CardContent className="px-3 py-2.5">
              <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <Truck className="h-3 w-3" />
                Courier
              </p>
              <p className="mt-1 text-sm font-bold text-sky-700 tabular-nums">{formatCurrency(totalCourier)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-emerald-300/60">
            <CardContent className="px-3 py-2.5">
              <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <Wallet className="h-3 w-3" />
                Cash Collected
              </p>
              <p className="mt-1 text-sm font-bold text-emerald-700 tabular-nums">{formatCurrency(totalCashCollected)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-cyan-300/60">
            <CardContent className="px-3 py-2.5">
              <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <Landmark className="h-3 w-3" />
                Bank Collected
              </p>
              <p className="mt-1 text-sm font-bold text-cyan-700 tabular-nums">{formatCurrency(totalBankCollected)}</p>
            </CardContent>
          </Card>
        </div>
        <Card className="mb-3 overflow-hidden border border-border/70 shadow-sm">
          <CardContent className="p-2">
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-left transition hover:border-primary/30"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Filter className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-xs font-semibold">Search & Filters</p>
                <p className="truncate text-[10px] text-muted-foreground hidden sm:block">
                  {statusLabelMap[statusFilter]} · {sortLabelMap[sortBy]}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="secondary" className="h-5 rounded-md px-2 text-[10px] font-semibold">
                  {filteredBills.length}
                </Badge>
                <ChevronDown
                  className={`h-5 w-5 transition-transform ${showFilters ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {showFilters && (
              <div className="mt-2 space-y-2 rounded-xl border border-border/60 bg-background/70 p-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Bill #, client, phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-9 rounded-lg pl-9 text-sm"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="h-9 rounded-lg text-sm"
                      />
                      {selectedDate && (
                        <Button
                          variant="outline"
                          className="h-9 rounded-lg px-2.5 text-xs"
                          onClick={() => setSelectedDate("")}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg bg-background text-xs">
                        {tabLabelMap[activeTab]}
                        <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      <DropdownMenuItem onClick={() => setActiveTab("all")}>All Bills</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg bg-background text-xs">
                        {statusLabelMap[statusFilter]}
                        <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Status</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter("paid")}>Paid</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter("pending")}>Pending</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter("partial")}>Partial</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter("overdue")}>Overdue</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter("overpaid")}>Overpaid</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-8 rounded-lg text-xs ${gstFilter !== "all" ? "border-blue-400 bg-blue-50 text-blue-700 font-semibold" : "bg-background"}`}
                      >
                        {gstFilter === "gst" ? "GST" : gstFilter === "non-gst" ? "Non-GST" : "All GST"}
                        <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuItem onClick={() => setGstFilter("all")}>
                        {gstFilter === "all" ? "* " : ""}All Bills
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setGstFilter("gst")}>
                        {gstFilter === "gst" ? "* " : ""}GST Bills
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setGstFilter("non-gst")}>
                        {gstFilter === "non-gst" ? "* " : ""}Non-GST Bills
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg bg-background text-xs">
                        {sortLabelMap[sortBy].split(" ")[0]}
                        <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem onClick={() => setSortBy("date-desc")}>Date (Newest)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy("date-asc")}>Date (Oldest)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy("amount-desc")}>Amount ↓</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy("amount-asc")}>Amount ↑</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg px-2.5 text-xs"
                    onClick={() => {
                      setActiveTab("all");
                      setStatusFilter("all");
                      setGstFilter("all");
                      setSortBy("date-desc");
                      setSearchTerm("");
                      setSelectedDate("");
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>


        <TabsContent value={activeTab} className="mt-0">
          <div className="space-y-3">
            {filteredBills.length === 0 ? (
              <Card className="border-2 border-dashed">
                <CardContent className="text-center py-12">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium text-foreground mb-2">
                    No bills found
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {searchTerm || selectedDate || statusFilter !== "all"
                      ? "No bills match your search or filters."
                      : "Get started by creating your first sale"}
                  </p>
                  {!searchTerm && !selectedDate && statusFilter === "all" && (
                    <Link to="/bills/new">
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Sale
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : (
              pagedBills.map((bill) => (
                <Card
                  key={bill.id}
                  className={`group overflow-hidden rounded-2xl border shadow-sm ring-1 ring-transparent transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:ring-primary/10 ${
                    bill.paymentStatus === "paid"
                      ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-background to-background"
                      : bill.paymentStatus === "overdue"
                        ? "border-rose-200/80 bg-gradient-to-br from-rose-50/70 via-background to-background"
                        : "border-sky-200/80 bg-gradient-to-br from-sky-50/80 via-background to-background"
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{bill.client?.name ?? "Unknown Client"}</p>
                              {bill.client?.phone && (
                                <p className="text-[11px] text-muted-foreground">{bill.client.phone}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">{bill.billNumber}</span>
                            {(bill as any).isGst && (
                              <span className="rounded border border-blue-300 bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-700">GST</span>
                            )}
                            {getStatusBadge(bill.paymentStatus)}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="min-w-0 rounded-lg border border-border/60 bg-background/90 px-2 py-1.5">
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Date</p>
                            <p className="truncate text-[10px] font-medium">{formatDate(bill.date)}</p>
                          </div>
                          <div className="min-w-0 rounded-lg border border-emerald-200/60 bg-emerald-50/50 px-2 py-1.5">
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Paid</p>
                            <p className="truncate text-[10px] font-bold text-emerald-700">{formatCurrency(bill.paidAmount)}</p>
                          </div>
                          <div className="min-w-0 rounded-lg border border-sky-200/60 bg-sky-50/50 px-2 py-1.5">
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Total</p>
                            <p className="truncate text-[10px] font-bold">{formatCurrency(bill.total)}</p>
                          </div>
                        </div>
                        {(bill.returnedAmount || 0) > 0 && (
                          <div className="flex items-center gap-1 rounded-lg border border-rose-200/60 bg-rose-50/50 px-2 py-1 mt-2">
                            <span className="text-[9px] uppercase tracking-wide text-rose-600">Returned</span>
                            <span className="ml-auto text-[10px] font-bold text-rose-700">-{formatCurrency(bill.returnedAmount || 0)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                        {bill.paymentStatus !== "paid" ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => openPaymentDialog(bill)}
                            className="h-8 gap-1 rounded-lg px-3 text-xs shadow-sm"
                          >
                            <IndianRupee className="h-3 w-3" />
                            Collect
                          </Button>
                        ) : (
                          <Badge variant="default" className="h-6 rounded-full bg-green-600 px-2 text-[10px] text-white">
                            Paid
                          </Badge>
                        )}

                        <div className="flex gap-1 rounded-lg border border-border/60 bg-background/90 p-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 rounded-md p-0 bg-background/80 hover:bg-primary/5"
                            title="Share on WhatsApp"
                            onClick={() => {
                              const phone = bill.client?.phone?.replace(/\D/g, "");
                              if (!phone) {
                                toast.error("Client phone number not available");
                                return;
                              }
                              // Direct share link for public bill view page
                              const billLink = `${window.location.origin}/view/bill/${bill.id}`;
                              const text = encodeURIComponent(`Hello ${bill.client?.name ?? ""}, please find your bill ${bill.billNumber} here: ${billLink}`);
                              window.open(`https://wa.me/+91${phone}?text=${text}`, "_blank");
                            }}
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 rounded-md p-0 bg-background/80 hover:bg-primary/5"
                            title="Share Bill"
                            onClick={() => {
                              const publicUrl = `${window.location.origin}/view/bill/${bill.id}`;
                              if (navigator.share) {
                                navigator.share({
                                  title: `Bill ${bill.billNumber}`,
                                  text: `Check out bill ${bill.billNumber} for ${bill.client?.name ?? ""}`,
                                  url: publicUrl,
                                }).catch(console.error);
                              } else {
                                navigator.clipboard.writeText(publicUrl);
                                toast.success("Link copied to clipboard");
                              }
                            }}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </Button>
                          <Link to={`/bills/${bill.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 rounded-md p-0 bg-background/80 hover:bg-primary/5"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          {bill.customerImages?.[0] && (
                            <Button variant="outline" size="sm" className="h-7 rounded-md px-1.5 text-[10px] bg-background/80 hover:bg-primary/5 gap-0.5" title="Download ID Front"
                              onClick={() => downloadImage(bill.customerImages![0], `id-front-${bill.billNumber}.jpg`)}>
                              <Download className="h-3 w-3" />F
                            </Button>
                          )}
                          {bill.customerImages?.[1] && (
                            <Button variant="outline" size="sm" className="h-7 rounded-md px-1.5 text-[10px] bg-background/80 hover:bg-primary/5 gap-0.5" title="Download ID Back"
                              onClick={() => downloadImage(bill.customerImages![1], `id-back-${bill.billNumber}.jpg`)}>
                              <Download className="h-3 w-3" />B
                            </Button>
                          )}
                          <Link to={`/bills/${bill.id}/edit`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 rounded-md p-0 bg-background/80 hover:bg-primary/5"
                              disabled={bill.paymentStatus === "paid"}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 rounded-lg p-0 text-destructive bg-background/80 hover:bg-destructive/10"
                                disabled={
                                  deletingId === bill.id || bill.paidAmount > 0
                                }
                              >
                                {deletingId === bill.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Bill</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(bill.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {filteredBills.length > pageSize && (
            <div className="flex items-center justify-between mt-6 px-2">
              <p className="text-xs text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, filteredBills.length)} of{" "}
                {filteredBills.length}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedBill && (
        <PaymentDialog
          bill={selectedBill}
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          onPaymentCollected={handlePaymentCollected}
        />
      )}
      </div>
      </div>
    </div>
  );
}

