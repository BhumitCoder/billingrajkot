import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSampleBills,
  deleteSampleBill,
  updateSampleBillPayment,
} from "@/lib/storage";
import { SampleBill } from "@/types";
import { formatCurrency, formatDate } from "@/lib/billUtils";
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
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
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
import { SamplePaymentDialog } from "@/components/SamplePaymentDialog";

export default function SampleBills() {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<SampleBill[]>([]);
  const [filteredBills, setFilteredBills] = useState<SampleBill[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gstFilter, setGstFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<SampleBill | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    loadBills();
  }, []);

  useEffect(() => {
    filterAndSortBills();
  }, [bills, searchTerm, statusFilter, gstFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [filteredBills.length, searchTerm, statusFilter, gstFilter, sortBy]);

  const loadBills = async () => {
    try {
      setLoading(true);
      const allBills = await getSampleBills();
      setBills(allBills);
    } catch (error) {
      console.error("Error loading sample bills:", error);
      toast.error("Failed to load sample bills");
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortBills = () => {
    let filtered = [...bills];

    if (searchTerm) {
      filtered = filtered.filter(
        (bill) =>
          bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (bill.client?.name ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((bill) => bill.paymentStatus === statusFilter);
    }

    if (gstFilter !== "all") {
      if (gstFilter === "gst") {
        filtered = filtered.filter((bill) => bill.totalTax > 0);
      } else if (gstFilter === "non-gst") {
        filtered = filtered.filter((bill) => bill.totalTax === 0);
      }
    }

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

    setFilteredBills(filtered);
  };

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedBills = filteredBills.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalSales = filteredBills.reduce((sum, bill) => sum + bill.total, 0);
  const totalPaid = filteredBills.reduce((sum, bill) => sum + (bill.paidAmount || 0), 0);
  const totalPending = filteredBills.reduce(
    (sum, bill) => sum + (bill.total - (bill.paidAmount || 0)),
    0
  );
  const totalReturn = 0;
  const statusLabelMap: Record<string, string> = {
    all: "All Status",
    paid: "Paid",
    pending: "Pending",
    overdue: "Overdue",
  };
  const billTypeLabelMap: Record<string, string> = {
    all: "All Bills",
    gst: "Tax Bills",
    "non-gst": "Non-tax Bills",
  };
  const sortLabelMap: Record<string, string> = {
    "date-desc": "Date (Newest)",
    "date-asc": "Date (Oldest)",
    "amount-desc": "Amount (High to Low)",
    "amount-asc": "Amount (Low to High)",
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await deleteSampleBill(id);
    await loadBills();
    setDeletingId(null);
    toast.success("Sample bill deleted successfully");
  };

  const handlePaymentCollected = async (amount: number, type: "Cash" | "Bank Transfer" | "UPI" | "Cheque" | "Other") => {
    if (selectedBill) {
      await updateSampleBillPayment(selectedBill.id, amount, type);
      await loadBills();
      toast.success(
        `Payment of ${formatCurrency(amount)} via ${type} collected successfully`
      );
    }
  };

  const openPaymentDialog = (bill: SampleBill) => {
    setSelectedBill(bill);
    setPaymentDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      paid: "default",
      pending: "secondary",
      overdue: "destructive",
    } as const;

    const labels = {
      paid: "Paid",
      pending: "Pending",
      overdue: "Overdue",
    };

    return (
      <Badge
        variant={variants[status as keyof typeof variants]}
        className="text-xs"
      >
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  if (loading) {
    return (
      <LoadingSpinner size="xl" text="Loading Quotation Bill..." fullScreen contentAreaOnly />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-background p-2 shadow-sm sm:p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">
                Quotation Bill
              </h1>
              <p className="text-sm text-muted-foreground">
                Practice bills that do not affect inventory or finances
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col items-stretch gap-2 rounded-xl border border-border/60 bg-muted/20 p-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start lg:w-auto lg:justify-end">
           
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-full items-center gap-2 rounded-lg bg-background sm:w-auto"
            >
              <FileText className="h-4 w-4" />
              {filteredBills.length} Bills
            </Button>
            <Link to="/sample-bills/new" className="w-full sm:w-auto">
              <Button size="sm" className="h-10 w-full rounded-lg px-4 shadow-sm sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Create Quotation Bill
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
      <div className="h-full flex flex-col gap-4 overflow-hidden pr-1 sm:pr-2">


      {/* Info Banner
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4 pb-4 px-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Sample Bills are for practice only
              </p>
              <p className="text-xs text-blue-700 mt-1">
                These bills don't affect your inventory stock, financial
                calculations, or actual business data. Perfect for testing and
                demonstration purposes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card> */}

      <Card className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/60 shadow-sm">
        <CardContent className="h-full overflow-y-auto p-2 sm:p-3 space-y-3 pr-1 sm:pr-2">
        <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-slate-50/80 via-background to-sky-50/70 p-3 shadow-sm sm:p-5">
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/90 px-4 py-3 text-left transition hover:border-primary/30"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Filter className="h-4 w-4 text-primary" />
                </span>
                <p className="text-base font-semibold">Search & Filters</p>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {billTypeLabelMap[gstFilter]} - {statusLabelMap[statusFilter]} - {sortLabelMap[sortBy]}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-8 rounded-lg px-3 text-xs font-semibold">
                {filteredBills.length} Results
              </Badge>
              <ChevronDown className={`h-5 w-5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </div>
          </button>

          {showFilters && (
            <div className="mt-4 space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3 sm:p-4">
              <div className="grid gap-3 md:grid-cols-12">
                <div className="relative md:col-span-12">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Search Quotation Bill..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-12 rounded-xl border border-border/70 bg-white pl-12 text-base shadow-sm transition focus-visible:ring-2 focus-visible:ring-primary/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 rounded-xl border border-border/70 bg-background text-sm shadow-sm">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={gstFilter} onValueChange={setGstFilter}>
                  <SelectTrigger className="h-10 rounded-xl border border-border/70 bg-background text-sm shadow-sm">
                    <Receipt className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Bill Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Bills</SelectItem>
                    <SelectItem value="gst">Tax Bills</SelectItem>
                    <SelectItem value="non-gst">Non-tax Bills</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-10 rounded-xl border border-border/70 bg-background text-sm shadow-sm">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">Date (Newest)</SelectItem>
                    <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                    <SelectItem value="amount-desc">Amount (High to Low)</SelectItem>
                    <SelectItem value="amount-asc">Amount (Low to High)</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  className="h-10 rounded-xl px-3 text-sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setGstFilter("all");
                    setSortBy("date-desc");
                    setSearchTerm("");
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
          )}
        </div>
      {/* Bills List */}
      <div className="space-y-3">
        {filteredBills.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="text-center py-12">
              <Receipt className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium text-foreground mb-2">
                No Quotation Bill found
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Create practice bills for testing and demonstration
              </p>
              <Link to="/sample-bills/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Quotation Bill
                </Button>
              </Link>
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
              <CardContent className="p-3.5 pb-5 sm:p-4 sm:pb-6">
                <div className="space-y-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex min-h-[48px] items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 self-center text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium leading-none text-foreground/90">
                              {bill.client?.name ?? ""}
                            </p>
                            {bill.client.phone && (
                              <p className="mt-1 text-xs leading-none text-muted-foreground/80">
                                {bill.client.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1.5 self-center">
                        <span className="inline-flex h-8 items-center rounded-lg bg-foreground/[0.04] px-2.5 text-sm font-semibold tracking-tight">
                          {bill.billNumber}
                        </span>
                        {getStatusBadge(bill.paymentStatus)}
                        <Badge
                          variant="outline"
                          className="inline-flex h-8 items-center rounded-full border-primary/30 bg-primary/5 px-2 text-[10px] uppercase text-blue-600"
                        >
                          SAMPLE
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-border/60 bg-background/90 px-3 py-2.5 shadow-sm">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Date</p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDate(bill.date)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Paid</p>
                        <p className="mt-1 text-base font-bold text-foreground">
                          {formatCurrency(bill.paidAmount)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Pending</p>
                        <p className="mt-1 text-base font-bold text-foreground">
                          {formatCurrency(bill.total - bill.paidAmount)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-sky-200/60 bg-sky-50/50 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Bill Total</p>
                        <p className="mt-1 text-base font-bold text-foreground">
                          {formatCurrency(bill.total)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 border-y border-border/60 py-3 sm:flex-row sm:items-center sm:justify-between">
                    {bill.paymentStatus !== "paid" ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => openPaymentDialog(bill)}
                        className="h-9 w-full gap-1.5 rounded-xl px-4 text-sm shadow-sm sm:w-auto"
                      >
                        <IndianRupee className="h-3.5 w-3.5" />
                        Collect Payment
                      </Button>
                    ) : (
                      <Badge variant="default" className="h-7 w-fit rounded-full bg-green-600 text-white">
                        Paid
                      </Badge>
                    )}

                    <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-background/90 p-1.5">
                      <Link to={`/sample-bills/${bill.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 rounded-lg p-0 bg-background/80 hover:bg-primary/5"
                          title="View Bill"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Link to={`/sample-bills/${bill.id}/edit`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 rounded-lg p-0 bg-background/80 hover:bg-primary/5"
                          title="Edit Bill"
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
                            disabled={deletingId === bill.id}
                            title="Delete Bill"
                          >
                            {deletingId === bill.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-base sm:text-lg">
                              Delete Sample Bill
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm break-words">
                              Are you sure you want to delete sample bill{" "}
                              {bill.billNumber}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <AlertDialogCancel className="w-full sm:w-auto">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(bill.id)}
                              className="w-full sm:w-auto bg-destructive hover:bg-destructive/90"
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

        {filteredBills.length > pageSize && (
          <Card className="w-full max-w-full overflow-hidden">
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 md:px-6 pb-3 sm:pb-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                <p className="text-xs sm:text-sm font-medium text-foreground break-words text-center sm:text-left">
                  Showing {(currentPage - 1) * pageSize + 1} -{" "}
                  {Math.min(currentPage * pageSize, filteredBills.length)} of{" "}
                  {filteredBills.length} sample bills
                </p>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="gap-2 text-xs sm:text-sm touch-manipulation flex-1 sm:flex-none"
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-muted rounded-md">
                    <span className="text-xs sm:text-sm font-medium">
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="gap-2 text-xs sm:text-sm touch-manipulation flex-1 sm:flex-none"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
        </CardContent>
      </Card>

      {selectedBill && (
        <SamplePaymentDialog
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
