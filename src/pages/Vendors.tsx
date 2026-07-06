import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  getVendors,
  saveVendor,
  deleteVendor,
  getPurchaseBills,
} from "@/lib/storage";
import { Vendor, PurchaseBill } from "@/types";
import {
  Plus,
  Edit,
  Trash2,
  Store,
  Eye,
  Search,
  Receipt,
  History,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  TrendingDown,
  BadgeCheck,
  MapPin,
  Phone,
  Mail,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/billUtils";
import { Badge } from "@/components/ui/badge";
import { pdf } from "@react-pdf/renderer";
import { VendorLedgerPDF } from "@/components/VendorLedgerPDF";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function Vendors() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [viewingVendor, setViewingVendor] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorPage, setVendorPage] = useState(1);
  const VENDOR_PAGE_SIZE = 20;
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState({
    start: "",
    end: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    loadVendors();
    loadPurchaseBills();
  }, []);

  // Reload purchase bills whenever vendor detail view opens
  useEffect(() => {
    if (viewingVendor) {
      loadPurchaseBills();
    }
  }, [viewingVendor]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const data = await getVendors();
      setVendors(data);
    } catch (error) {
      console.error("Error loading vendors:", error);
      toast.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseBills = async () => {
    try {
      const data = await getPurchaseBills();
      setPurchaseBills(data);
    } catch (error) {
      console.error("Error loading purchase bills:", error);
    }
  };

  const getVendorTransactions = (vendorId: string, vendorName: string) => {
    const term = vendorName.toLowerCase().trim();
    const vendorBills = purchaseBills.filter(
      (b) =>
        (b.vendorId && b.vendorId === vendorId) ||
        (b.vendorName && b.vendorName.toLowerCase().trim() === term),
    );
    const transactions: any[] = [];

    vendorBills.forEach((bill) => {
      if (bill.payments) {
        bill.payments.forEach((payment) => {
          const isReturnPayment = payment.amount < 0;

          transactions.push({
            id: `pay-${payment.id}`,
            date: payment.date,
            displayDate: payment.date,
            type: isReturnPayment ? "Return Payment" : "Purchase Payment",
            reference: isReturnPayment
              ? `Return Payment from Vendor - Bill #${bill.billNumber || ""}`
              : `Purchase Payment to Vendor - Bill #${bill.billNumber || ""}`,
            amount: Math.abs(payment.amount),
            method: payment.method,
            billId: bill.id,
            isRefund: isReturnPayment,
          });
        });
      }
    });

    return transactions
      .filter((tx) => {
        const matchesSearch =
          tx.reference
            .toLowerCase()
            .includes(historySearchQuery.toLowerCase()) ||
          tx.type.toLowerCase().includes(historySearchQuery.toLowerCase());

        let matchesDate = true;
        if (dateFilter.start || dateFilter.end) {
          const txDate = new Date(tx.date);
          if (dateFilter.start) {
            const startDate = new Date(dateFilter.start);
            startDate.setHours(0, 0, 0, 0);
            if (txDate < startDate) matchesDate = false;
          }
          if (dateFilter.end) {
            const endDate = new Date(dateFilter.end);
            endDate.setHours(23, 59, 59, 999);
            if (txDate > endDate) matchesDate = false;
          }
        }

        return matchesSearch && matchesDate;
      })
      .sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  };

  const getVendorStats = (vendorId: string, vendorName: string) => {
    const term = vendorName.toLowerCase().trim();
    const vendorBills = purchaseBills.filter(
      (b) =>
        (b.vendorId && b.vendorId === vendorId) ||
        (b.vendorName && b.vendorName.toLowerCase().trim() === term),
    );

    let totalPurchase = 0;
    let totalPaid = 0;
    let totalReturn = 0;

    vendorBills.forEach((bill) => {
      totalPurchase += bill.total;
      totalPaid += bill.paidAmount || 0;
      if (bill.returns) {
        bill.returns.forEach((r) => (totalReturn += r.totalReturnValue), 0);
      }
    });

    const pendingAmount = totalPurchase - totalPaid - totalReturn;

    return {
      totalPurchase,
      totalPaid,
      pendingAmount,
      totalReturn,
      billCount: vendorBills.length,
    };
  };

  const downloadExcel = (vendor: Vendor) => {
    try {
      const transactions = getVendorTransactions(vendor.id, vendor.name);

      const data = transactions.map((tx) => ({
        Date: formatDate(tx.date),
        Type: tx.type,
        Reference: tx.reference,
        Method: tx.method || "-",
        Amount: tx.amount,
        Direction: tx.type === "Purchase" ? "DR" : "CR",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vendor Ledger");
      XLSX.writeFile(wb, `${vendor.name}_Ledger.xlsx`);
      toast.success("Excel ledger downloaded");
    } catch (error) {
      console.error("Excel download error:", error);
      toast.error("Failed to download Excel");
    }
  };

  const downloadPDF = async (vendor: Vendor) => {
    try {
      const transactions = getVendorTransactions(vendor.id, vendor.name);
      const stats = getVendorStats(vendor.id, vendor.name);

      const doc = (
        <VendorLedgerPDF
          vendor={vendor}
          transactions={transactions}
          stats={stats}
        />
      );
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${vendor.name}_Ledger.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("PDF ledger downloaded");
    } catch (error) {
      console.error("PDF download error:", error);
      toast.error("Failed to download PDF");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const vendor: Vendor = {
        id: editingVendor?.id || crypto.randomUUID(),
        name: formData.name.trim(),
        address: formData.address.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        createdAt: editingVendor?.createdAt || new Date().toISOString(),
      };

      await saveVendor(vendor);
      await loadVendors();
      setIsOpen(false);
      resetForm();
      toast.success(editingVendor ? "Vendor updated" : "Vendor added");
    } catch (error) {
      console.error("Error saving vendor:", error);
      toast.error("Failed to save vendor");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      address: vendor.address,
      phone: vendor.phone,
      email: vendor.email,
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteVendor(id);
    await loadVendors();
    toast.success("Vendor deleted");
  };

  const resetForm = () => {
    setEditingVendor(null);
    setFormData({
      name: "",
      address: "",
      phone: "",
      email: "",
    });
  };

  const filteredVendors = vendors
    .filter(
      (v) =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.phone.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );

  const pagedVendors = filteredVendors.slice(
    (vendorPage - 1) * VENDOR_PAGE_SIZE,
    vendorPage * VENDOR_PAGE_SIZE,
  );
  const vendorTotalPages = Math.ceil(filteredVendors.length / VENDOR_PAGE_SIZE);

  if (loading)
    return (
      <LoadingSpinner
        size="xl"
        text="Loading vendors..."
        fullScreen
        contentAreaOnly
      />
    );

  if (viewingVendor) {
    const stats = getVendorStats(viewingVendor.id, viewingVendor.name);

    return (
      <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
        <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-emerald-500/20 bg-gradient-to-br from-background via-background to-emerald-500/10 p-3 shadow-sm sm:p-5 lg:p-6">
          <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent" />
          <div className="relative flex h-full min-h-0 flex-col">
            <div className="rounded-2xl border border-border/70 bg-background/90 p-3 backdrop-blur sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-border/70 bg-background/90 sm:h-10 sm:w-10"
                    onClick={() => setViewingVendor(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0">
                    <h1 className="truncate text-lg font-semibold leading-tight sm:text-2xl">
                      {viewingVendor.name}
                    </h1>
                    <p className="text-xs text-muted-foreground sm:text-sm">
                      Performance overview and transaction history
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => downloadExcel(viewingVendor)}
                    className="h-9 w-9 sm:h-10 sm:w-10"
                    title="Export Excel"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => downloadPDF(viewingVendor)}
                    className="h-9 w-9 sm:h-10 sm:w-10"
                    title="Export PDF"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex-1 min-h-0 rounded-2xl border border-border/70 bg-background/60 p-2 sm:p-3">
              <div className="h-full overflow-y-auto space-y-5 pr-1 sm:pr-2">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="bg-primary/5 border-primary/20 shadow-sm">
                    <CardContent className="p-3">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Purchases
                      </p>
                      <p className="text-lg font-bold truncate">
                        {formatCurrency(stats.totalPurchase)}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {stats.billCount} Bills
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-emerald-50 border-emerald-100 shadow-sm">
                    <CardContent className="p-3">
                      <p className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider">
                        Paid
                      </p>
                      <p className="text-lg font-bold text-emerald-700 truncate">
                        {formatCurrency(stats.totalPaid)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-orange-50 border-orange-100 shadow-sm">
                    <CardContent className="p-3">
                      <p className="text-[10px] text-orange-600 uppercase font-bold tracking-wider">
                        Pending
                      </p>
                      <p className="text-lg font-bold text-orange-700 truncate">
                        {formatCurrency(stats.pendingAmount)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 border-blue-100 shadow-sm">
                    <CardContent className="p-3">
                      <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider">
                        Returns
                      </p>
                      <p className="text-lg font-bold text-blue-700 truncate">
                        {formatCurrency(stats.totalReturn)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-xl bg-muted/30 space-y-3">
                    <div className="flex items-start gap-3">
                      <Store className="h-5 w-5 text-primary mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Vendor Info
                        </p>
                        <p className="font-bold text-base truncate">
                          {viewingVendor.name}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {viewingVendor.address || "No address provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-xl bg-muted/30 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Contact Details
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center justify-between py-1 border-b border-dashed border-muted-foreground/20">
                        <span className="text-sm text-muted-foreground">
                          Phone
                        </span>
                        <span className="text-sm font-bold">
                          {viewingVendor.phone || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-muted-foreground">
                          Email
                        </span>
                        <span className="text-sm font-bold truncate ml-4">
                          {viewingVendor.email || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Tabs defaultValue="bills" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-muted/50 rounded-lg">
                    <TabsTrigger
                      value="bills"
                      className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Purchase Bills</span>
                      <span className="sm:hidden">Bills</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="transactions"
                      className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      <History className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Transactions</span>
                      <span className="sm:hidden">History</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="bills"
                    className="mt-4 focus-visible:outline-none"
                  >
                    <div className="space-y-3">
                      {(() => {
                        const term = viewingVendor.name.toLowerCase().trim();
                        const filteredBills = purchaseBills.filter(
                          (b) =>
                            (b.vendorId && b.vendorId === viewingVendor.id) ||
                            (b.vendorName &&
                              b.vendorName.toLowerCase().trim() === term),
                        );

                        if (filteredBills.length === 0) {
                          return (
                            <div className="text-center py-10 border-2 border-dashed rounded-xl">
                              <Receipt className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                              <p className="text-muted-foreground font-medium">
                                No purchase bills found
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-1 gap-3">
                            {filteredBills.map((bill) => {
                              const totalReturns = (bill.returns || []).reduce(
                                (sum, r) => sum + r.totalReturnValue,
                                0,
                              );
                              const netTotal = bill.total - totalReturns;
                              const paidAmount = bill.paidAmount || 0;
                              const remainingAmount = netTotal - paidAmount;

                              let currentStatus = bill.paymentStatus;
                              if (remainingAmount < 0)
                                currentStatus = "overpaid";
                              else if (remainingAmount === 0)
                                currentStatus = "paid";
                              else if (paidAmount > 0)
                                currentStatus = "partial";
                              else if (
                                bill.dueDate &&
                                new Date(bill.dueDate) < new Date()
                              )
                                currentStatus = "overdue";
                              else currentStatus = "pending";

                              return (
                                <Card
                                  key={bill.id}
                                  className="overflow-hidden border-muted-foreground/10 hover:border-primary/30 transition-colors shadow-none"
                                >
                                  <div className="p-4 sm:p-5">
                                    <div className="flex justify-between items-start mb-3">
                                      <div className="min-w-0">
                                        <p className="font-bold text-sm truncate">
                                          #{bill.billNumber || "N/A"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {formatDate(
                                            bill.billDate || bill.createdAt,
                                          )}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                          {bill.items
                                            .slice(0, 2)
                                            .map((it) =>
                                              [
                                                (it as any).model ||
                                                  it.description,
                                                (it as any).imeiNumber,
                                              ]
                                                .filter(Boolean)
                                                .join(" / "),
                                            )
                                            .join(" | ") || "No device details"}
                                        </p>
                                      </div>
                                      <Badge
                                        variant={
                                          currentStatus === "paid"
                                            ? "default"
                                            : currentStatus === "overdue" ||
                                                currentStatus === "overpaid"
                                              ? "destructive"
                                              : currentStatus === "partial"
                                                ? "secondary"
                                                : "outline"
                                        }
                                        className="text-[10px] px-2 py-0"
                                      >
                                        {currentStatus.toUpperCase()}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">
                                          Net Total
                                        </p>
                                        <p className="text-sm font-bold">
                                          {formatCurrency(netTotal)}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">
                                          Paid
                                        </p>
                                        <p className="text-sm font-bold text-emerald-600">
                                          {formatCurrency(paidAmount)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t flex justify-between items-center">
                                      <div className="text-[10px] text-muted-foreground italic">
                                        Balance:{" "}
                                        {formatCurrency(remainingAmount)}
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs font-bold text-primary px-3"
                                        onClick={() =>
                                          navigate(`/purchases?id=${bill.id}`)
                                        }
                                      >
                                        Details
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="transactions"
                    className="mt-4 focus-visible:outline-none"
                  >
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search payments..."
                            value={historySearchQuery}
                            onChange={(e) =>
                              setHistorySearchQuery(e.target.value)
                            }
                            className="pl-9 h-10"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={dateFilter.start}
                            onChange={(e) =>
                              setDateFilter({
                                ...dateFilter,
                                start: e.target.value,
                              })
                            }
                            className="h-10 text-xs sm:text-sm"
                          />
                          <Input
                            type="date"
                            value={dateFilter.end}
                            onChange={(e) =>
                              setDateFilter({
                                ...dateFilter,
                                end: e.target.value,
                              })
                            }
                            className="h-10 text-xs sm:text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        {(() => {
                          const transactions = getVendorTransactions(
                            viewingVendor.id,
                            viewingVendor.name,
                          );

                          if (transactions.length === 0) {
                            return (
                              <div className="text-center py-10 border-2 border-dashed rounded-xl">
                                <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-muted-foreground font-medium">
                                  No transaction history found
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div className="grid grid-cols-1 gap-3">
                              {transactions.map((tx) => (
                                <Card
                                  key={tx.id}
                                  className="shadow-none border-muted-foreground/10"
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                      <div className="flex gap-3 min-w-0">
                                        <div
                                          className={cn(
                                            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                                            tx.isRefund
                                              ? "bg-blue-100 text-blue-600"
                                              : "bg-emerald-100 text-emerald-600",
                                          )}
                                        >
                                          {tx.isRefund ? (
                                            <RotateCcw className="h-5 w-5" />
                                          ) : (
                                            <TrendingDown className="h-5 w-5" />
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-bold text-sm truncate">
                                            {tx.type}
                                          </p>
                                          <p className="text-xs text-muted-foreground line-clamp-1">
                                            {tx.reference}
                                          </p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <Badge
                                              variant="outline"
                                              className="text-[9px] font-mono px-1.5 h-4"
                                            >
                                              {tx.method || "CASH"}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground font-medium">
                                              {formatDate(tx.date)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p
                                          className={cn(
                                            "text-base font-bold",
                                            tx.isRefund
                                              ? "text-blue-600"
                                              : "text-emerald-600",
                                          )}
                                        >
                                          {tx.isRefund ? "+" : "-"}
                                          {formatCurrency(tx.amount)}
                                        </p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-slate-50/40 p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">
                  Vendors
                </h1>
                <p className="text-sm text-muted-foreground">Manage your supply chain</p>
              </div>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 rounded-xl border border-border/70 bg-muted/30 p-2 lg:w-auto">
              <Dialog
                open={isOpen}
                onOpenChange={(open) => {
                  setIsOpen(open);
                  if (!open) resetForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="h-10 rounded-xl px-3 text-sm">
                    <Plus className="h-5 w-5 mr-2" />
                    Add Vendor
                  </Button>
                </DialogTrigger>
                <DialogContent className="dialog-form-content sm:max-w-[500px]">
                  <DialogHeader className="dialog-form-header">
                    <DialogTitle>
                      {editingVendor ? "Edit Vendor" : "Add Vendor"}
                    </DialogTitle>
                  </DialogHeader>
                <form
                  onSubmit={handleSubmit}
                  className="dialog-form-body space-y-4"
                >
                  <div className="space-y-2">
                    <Label>Vendor Name *</Label>
                    <Input
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="dialog-form-footer flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" loading={saving}>
                      {editingVendor ? "Update" : "Add"} Vendor
                    </Button>
                  </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2 sm:p-4">
        <div className="h-full overflow-y-auto space-y-5 pr-1 sm:pr-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setVendorPage(1); }}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVendors.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-2xl text-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Store className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    No vendors yet
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add your first vendor to get started
                  </p>
                </div>
                <Button size="sm" onClick={() => setIsOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vendor
                </Button>
              </div>
            )}
            {pagedVendors.map((vendor) => (
              <Card
                key={vendor.id}
                className="group relative overflow-hidden border-border/70 bg-gradient-to-br from-background via-background to-emerald-500/5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />
                <CardHeader className="relative pb-3">
                  <CardTitle className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/20">
                        <Store className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold leading-tight">
                          {vendor.name}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Vendor Profile
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 rounded-xl border border-border/60 bg-background/85 p-1 backdrop-blur">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-700"
                        onClick={() => setViewingVendor(vendor)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-700"
                        onClick={() => handleEdit(vendor)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {vendor.name}?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(vendor.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative space-y-3 pt-0 text-sm">
                  {vendor.address && (
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        Address
                      </p>
                      <p className="text-sm leading-relaxed text-foreground/90">
                        {vendor.address}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2 rounded-xl border border-border/60 bg-background/70 p-3">
                    {vendor.phone && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          Phone
                        </span>
                        <span className="truncate text-xs font-medium">
                          {vendor.phone}
                        </span>
                      </div>
                    )}
                    {vendor.email && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          Email
                        </span>
                        <span className="max-w-[65%] truncate text-xs font-medium">
                          {vendor.email}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Vendor Pagination */}
          {vendorTotalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-3 mt-2">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-medium text-foreground">
                  {(vendorPage - 1) * VENDOR_PAGE_SIZE + 1}–{Math.min(vendorPage * VENDOR_PAGE_SIZE, filteredVendors.length)}
                </span>{" "}
                of <span className="font-medium text-foreground">{filteredVendors.length}</span> vendors
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={vendorPage === 1} onClick={() => setVendorPage((p) => p - 1)}>Previous</Button>
                <span className="px-2 text-xs text-muted-foreground tabular-nums">{vendorPage} / {vendorTotalPages}</span>
                <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={vendorPage >= vendorTotalPages} onClick={() => setVendorPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
