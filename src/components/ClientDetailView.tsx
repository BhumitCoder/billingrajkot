import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Client, Bill, BillReturn, InventoryTransaction, Product } from '@/types';
import { getBills, getBillReturns, getInventoryTransactions, getProducts, updateBillPayment } from '@/lib/storage';
import { formatCurrency } from '@/lib/billUtils';
import { 
  Calendar, TrendingUp, DollarSign, FileText, Package, 
  ArrowLeftRight, Filter, Search, Eye, X, RefreshCw, CreditCard, Loader2, Download, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ClientPDF } from './ClientPDF';
import { getCompanyProfile } from '@/lib/storage';
import { CompanyProfile } from '@/types';

interface ClientDetailViewProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullScreen?: boolean;
  onBack?: () => void;
}

export function ClientDetailView({ client, open, onOpenChange, fullScreen = false, onBack }: ClientDetailViewProps) {
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [returns, setReturns] = useState<BillReturn[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date-desc');
  
  // Payment collection
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<Bill | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    if (open && client) {
      loadData();
      loadProfile();
    }
  }, [open, client]);

  const loadProfile = async () => {
    const profile = await getCompanyProfile();
    if (profile) setCompanyProfile(profile);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [allBills, allReturns, allTransactions, allProducts] = await Promise.all([
        getBills(),
        getBillReturns(),
        getInventoryTransactions(),
        getProducts(),
      ]);

      setProducts(allProducts);

      // Filter bills for this client
      const clientBills = allBills.filter(bill => bill.clientId === client.id);
      setBills(clientBills);

      // Filter returns for this client
      const clientReturns = allReturns.filter(ret => ret.clientName === client.name);
      setReturns(clientReturns);

      // Filter inventory transactions for returns from this client's bills
      const clientBillIds = clientBills.map(b => b.id);
      const returnBillIds = clientReturns.map(r => r.billId);
      const relevantTransactions = allTransactions.filter(t => 
        clientBillIds.includes(t.billId) || returnBillIds.includes(t.billId)
      );
      setInventoryTransactions(relevantTransactions);
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort bills
  const filteredBills = bills.filter(bill => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const itemMatch = bill.items.some((it) =>
        [
          it.productName,
          it.itemNo || "",
          it.model || "",
          it.imeiNumber || "",
          it.storage || "",
          it.color || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchLower),
      );
      const matchesSearch = 
        bill.billNumber.toLowerCase().includes(searchLower) ||
        bill.date.toLowerCase().includes(searchLower) ||
        itemMatch;
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && bill.paymentStatus !== statusFilter) {
      return false;
    }

    // Date filter
    if (dateFilter !== 'all') {
      const billDate = new Date(bill.date);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dateFilter === 'today' && daysDiff !== 0) return false;
      if (dateFilter === 'week' && daysDiff > 7) return false;
      if (dateFilter === 'month' && daysDiff > 30) return false;
      if (dateFilter === 'year' && daysDiff > 365) return false;
    }

    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'date-desc':
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      case 'date-asc':
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      case 'amount-desc':
        return b.total - a.total;
      case 'amount-asc':
        return a.total - b.total;
      default:
        return 0;
    }
  });

  // Calculate analytics
  const totalBills = bills.length;
  const totalRevenue = bills.filter(b => b.paymentStatus === 'paid').reduce((sum, b) => sum + b.total, 0);
  const pendingAmount = bills.filter(b => b.paymentStatus !== 'paid').reduce((sum, b) => sum + (b.total - b.paidAmount), 0);
  const totalReturns = returns.length;
  const totalReturnValue = returns.reduce((sum, r) => sum + r.totalReturnValue, 0);
  const averageBillValue = totalBills > 0 ? bills.reduce((sum, b) => sum + b.total, 0) / totalBills : 0;
  const paidBills = bills.filter(b => b.paymentStatus === 'paid').length;
  const pendingBills = bills.filter(b => b.paymentStatus === 'pending').length;
  const overdueBills = bills.filter(b => b.paymentStatus === 'overdue').length;

  // Get return transactions (stock history)
  const returnTransactions = inventoryTransactions.filter(t => t.type === 'return');
  const returnTransactionsWithDetails = returnTransactions.map(transaction => {
    const relatedReturn = returns.find(
      (r) =>
        r.id === transaction.billReturnId ||
        r.id === transaction.billId ||
        r.billId === transaction.billId,
    );
    const relatedBill = bills.find(b => b.id === transaction.billId);
    const product = products.find(p => p.id === transaction.productId);
    return {
      ...transaction,
      returnInfo: relatedReturn,
      billInfo: relatedBill,
      productInfo: product,
    };
  });

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleViewBill = (billId: string) => {
    navigate(`/bills/${billId}`);
    onOpenChange(false);
  };

  const handleCollectPayment = (bill: Bill) => {
    setSelectedBillForPayment(bill);
    const pendingAmount = bill.total - bill.paidAmount;
    setPaymentAmount(pendingAmount.toString());
    setPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBillForPayment) return;

    setProcessingPayment(true);
    try {
      const amount = parseFloat(paymentAmount);
      if (amount <= 0 || amount > (selectedBillForPayment.total - selectedBillForPayment.paidAmount)) {
        toast.error('Invalid payment amount');
        return;
      }

      await updateBillPayment(selectedBillForPayment.id, amount, 'Cash');
      await loadData();
      toast.success(`Payment of ${formatCurrency(amount)} collected successfully`);
      setPaymentDialogOpen(false);
      setSelectedBillForPayment(null);
      setPaymentAmount('');
    } catch (error) {
      toast.error('Failed to process payment');
      console.error('Error processing payment:', error);
    } finally {
      setProcessingPayment(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('all');
    setSortBy('date-desc');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={fullScreen
        ? "max-w-none w-[calc(100%-1rem)] h-[calc(100vh-1rem)] overflow-hidden flex flex-col p-3 sm:p-4 md:p-5"
        : "max-w-[96vw] sm:max-w-4xl lg:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0"}>
        <DialogHeader className={fullScreen
          ? "rounded-2xl border border-border/70 bg-background/90 p-3 backdrop-blur sm:p-4 flex-shrink-0"
          : "px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b flex-shrink-0"}>
          <div className={`flex items-center justify-between ${fullScreen ? "" : "pr-8"}`}>
            <DialogTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2 break-words">
              {fullScreen && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9"
                  onClick={() => (onBack ? onBack() : onOpenChange(false))}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              Client Details - {client.name}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {!loading && (
                <PDFDownloadLink
                  document={
                    <ClientPDF 
                      client={client}
                      bills={bills}
                      returns={returns}
                      analytics={{
                        totalBills,
                        totalRevenue,
                        pendingAmount,
                        totalReturns,
                        totalReturnValue,
                        averageBillValue,
                        paidBills,
                        pendingBills,
                        paymentRate: totalBills > 0 ? ((paidBills / totalBills) * 100).toFixed(1) : '0',
                        returnRate: totalBills > 0 ? ((totalReturns / totalBills) * 100).toFixed(1) : '0',
                        netRevenue: totalRevenue - totalReturnValue
                      }}
                      companyProfile={companyProfile}
                    />
                  }
                  fileName={`${client.name.replace(/\s+/g, '_')}_Report.pdf`}
                >
                  {({ loading: pdfLoading }) => (
                    <Button variant="outline" size="sm" disabled={pdfLoading}>
                      {pdfLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Download Report
                    </Button>
                  )}
                </PDFDownloadLink>
              )}
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading client data...</div>
        ) : (
          <div className={fullScreen
            ? "mt-4 flex-1 min-h-0 rounded-2xl border border-border/70 bg-background/60 p-2 sm:p-3"
            : "flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6"}>
            <div className={fullScreen ? "h-full overflow-y-auto px-2 sm:px-3" : ""}>
              <div className="space-y-4 py-4">
            {/* Analytics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="border">
                <CardHeader className="pb-2 px-3 pt-3">
                  <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">Bills</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-lg sm:text-xl font-bold">{totalBills}</div>
                  <p className="text-[10px] text-muted-foreground">
                    {paidBills} paid, {pendingBills} pending
                  </p>
                </CardContent>
              </Card>

              <Card className="border">
                <CardHeader className="pb-2 px-3 pt-3">
                  <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">Revenue</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-lg sm:text-xl font-bold text-emerald-600 break-words">
                    {formatCurrency(totalRevenue)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">From paid bills</p>
                </CardContent>
              </Card>

              <Card className="border">
                <CardHeader className="pb-2 px-3 pt-3">
                  <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">Pending</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-lg sm:text-xl font-bold text-orange-600 break-words">
                    {formatCurrency(pendingAmount)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Outstanding</p>
                </CardContent>
              </Card>

              <Card className="border">
                <CardHeader className="pb-2 px-3 pt-3">
                  <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <ArrowLeftRight className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">Returns</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-lg sm:text-xl font-bold text-red-600">{totalReturns}</div>
                  <p className="text-[10px] text-muted-foreground break-words">
                    {formatCurrency(totalReturnValue)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Additional Stats */}
            <Card className="border">
              <CardHeader className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
                <CardTitle className="text-sm sm:text-base">Business Analytics</CardTitle>
                <CardDescription className="text-[10px] sm:text-xs">Key metrics for this client</CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Avg Bill</p>
                    <p className="text-sm sm:text-base font-semibold break-words">{formatCurrency(averageBillValue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Payment Rate</p>
                    <p className="text-sm sm:text-base font-semibold">
                      {totalBills > 0 ? ((paidBills / totalBills) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Return Rate</p>
                    <p className="text-sm sm:text-base font-semibold">
                      {totalBills > 0 ? ((totalReturns / totalBills) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Net Revenue</p>
                    <p className="text-sm sm:text-base font-semibold text-emerald-600 break-words">
                      {formatCurrency(totalRevenue - totalReturnValue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs for Bills, Returns, and Stock History */}
            <Tabs defaultValue="bills" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-auto p-1">
                <TabsTrigger value="bills" className="text-xs sm:text-sm px-2 sm:px-4 py-2">
                  Bills ({filteredBills.length})
                </TabsTrigger>
                <TabsTrigger value="returns" className="text-xs sm:text-sm px-2 sm:px-4 py-2">
                  Returns ({returns.length})
                </TabsTrigger>
                {/* <TabsTrigger value="stock-history" className="text-xs sm:text-sm px-2 sm:px-4 py-2">
                  <span className="hidden sm:inline">Stock History </span>
                  <span className="sm:hidden">Stock</span>
                  ({returnTransactions.length})
                </TabsTrigger> */}
              </TabsList>

              {/* Bills Tab */}
              <TabsContent value="bills" className="space-y-4">
                {/* Filters */}
                <Card>
                  <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <Filter className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      Filters
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <div className="space-y-2">
                        <Label>Search</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Bill no, model, IMEI..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Payment Status</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Date Range</Label>
                        <Select value={dateFilter} onValueChange={setDateFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="week">Last 7 Days</SelectItem>
                            <SelectItem value="month">Last 30 Days</SelectItem>
                            <SelectItem value="year">Last Year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Sort By</Label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="date-desc">Newest First</SelectItem>
                            <SelectItem value="date-asc">Oldest First</SelectItem>
                            <SelectItem value="amount-desc">Highest Amount</SelectItem>
                            <SelectItem value="amount-asc">Lowest Amount</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {(searchTerm || statusFilter !== 'all' || dateFilter !== 'all') && (
                      <div className="mt-4 flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={clearFilters}>
                          <X className="h-4 w-4 mr-2" />
                          Clear Filters
                        </Button>
                        <Button variant="ghost" size="sm" onClick={loadData}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Bills Table */}
                {filteredBills.length === 0 ? (
                  <Card>
                    <CardContent className="flex min-h-[220px] items-center justify-center text-center text-muted-foreground">
                      No bills found for this client
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0 overflow-x-auto">
                      <div className="min-w-full inline-block align-middle">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs sm:text-sm">Bill Number</TableHead>
                              <TableHead className="text-xs sm:text-sm">Date</TableHead>
                              <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Items</TableHead>
                              <TableHead className="text-right text-xs sm:text-sm">Total</TableHead>
                              <TableHead className="text-right text-xs sm:text-sm hidden md:table-cell">Paid</TableHead>
                              <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Status</TableHead>
                              <TableHead className="text-xs sm:text-sm">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredBills.map((bill) => (
                              <TableRow key={bill.id}>
                                <TableCell className="font-medium text-xs sm:text-sm">
                                  <span className="truncate block max-w-[100px] sm:max-w-none">{bill.billNumber}</span>
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm">
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="whitespace-nowrap">{formatDate(bill.date)}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm hidden sm:table-cell">
                                  <div className="space-y-1">
                                    <div>{bill.items.length} items</div>
                                    <div className="text-[11px] text-muted-foreground line-clamp-2">
                                      {bill.items
                                        .slice(0, 2)
                                        .map((it) =>
                                          [it.model || it.productName, it.imeiNumber]
                                            .filter(Boolean)
                                            .join(" • "),
                                        )
                                        .join(" | ")}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-semibold text-xs sm:text-sm whitespace-nowrap">
                                  {formatCurrency(bill.total)}
                                </TableCell>
                                <TableCell className="text-right text-xs sm:text-sm hidden md:table-cell whitespace-nowrap">
                                  {formatCurrency(bill.paidAmount)}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  <Badge
                                    variant={
                                      bill.paymentStatus === 'paid'
                                        ? 'default'
                                        : bill.paymentStatus === 'overdue'
                                        ? 'destructive'
                                        : 'secondary'
                                    }
                                    className="text-xs"
                                  >
                                    {bill.paymentStatus}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleViewBill(bill.id)}
                                      className="h-7 sm:h-8 px-2 sm:px-3 text-xs"
                                    >
                                      <Eye className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                      <span className="hidden sm:inline">View</span>
                                    </Button>
                                    {bill.paymentStatus !== 'paid' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCollectPayment(bill)}
                                        className="text-emerald-600 hover:text-emerald-700 h-7 sm:h-8 px-2 sm:px-3 text-xs"
                                      >
                                        <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                        <span className="hidden sm:inline">Pay</span>
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Returns Tab */}
              <TabsContent value="returns" className="space-y-4">
                {returns.length === 0 ? (
                  <Card>
                    <CardContent className="flex min-h-[220px] items-center justify-center text-center text-muted-foreground">
                      No returns found for this client
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0 overflow-x-auto">
                      <div className="min-w-full inline-block align-middle">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs sm:text-sm">Return Date</TableHead>
                              <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Bill Number</TableHead>
                              <TableHead className="text-xs sm:text-sm">Items Returned</TableHead>
                              <TableHead className="text-xs sm:text-sm">Total Value</TableHead>
                              <TableHead className="text-xs sm:text-sm">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {returns.map((ret) => (
                              <TableRow key={ret.id}>
                                <TableCell className="text-xs sm:text-sm">
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="whitespace-nowrap">{formatDate(ret.returnDate || ret.createdAt)}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium hidden sm:table-cell">
                                  <Badge variant="outline" className="text-xs">{ret.billNumber}</Badge>
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm">
                                  <div className="space-y-1">
                                    {ret.items.map((item, idx) => (
                                      <div key={idx} className="text-xs sm:text-sm break-words">
                                        {[item.productName, (item as any).model, (item as any).imeiNumber]
                                          .filter(Boolean)
                                          .join(" • ")}{" "}
                                        - {item.quantity} {item.condition === 'good' ? '(Good)' : '(Damaged)'}
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="font-semibold text-red-600 text-xs sm:text-sm whitespace-nowrap">
                                  {formatCurrency(ret.totalReturnValue)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewBill(ret.billId)}
                                    className="h-7 sm:h-8 px-2 sm:px-3 text-xs"
                                  >
                                    <Eye className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">View Bill</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Stock History Tab - Returns */}
              {/* <TabsContent value="stock-history" className="space-y-4">
                {returnTransactions.length === 0 ? (
                  <Card>
                    <CardContent className="flex min-h-[220px] items-center justify-center text-center text-muted-foreground">
                      No return transactions found for this client
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0 overflow-x-auto">
                      <div className="min-w-full inline-block align-middle">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs sm:text-sm">Date</TableHead>
                              <TableHead className="text-xs sm:text-sm">Product</TableHead>
                              <TableHead className="text-xs sm:text-sm">Quantity</TableHead>
                              <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Bill Number</TableHead>
                              <TableHead className="text-xs sm:text-sm hidden md:table-cell">Condition</TableHead>
                              <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {returnTransactionsWithDetails.map((transaction) => {
                              const returnItem = transaction.returnInfo?.items.find(
                                item => item.productId === transaction.productId
                              );
                              return (
                                <TableRow key={transaction.id}>
                                  <TableCell className="text-xs sm:text-sm">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                                      <span className="whitespace-nowrap">{formatDate(transaction.date)}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                                    {returnItem?.productName || transaction.productInfo?.name || 'Unknown Product'}
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm">
                                    <Badge variant="outline" className="text-xs">{transaction.quantity}</Badge>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <Badge variant="secondary" className="text-xs">
                                    {transaction.returnInfo?.billNumber || transaction.billInfo?.billNumber || 'N/A'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <Badge
                                    variant={returnItem?.condition === 'good' ? 'default' : 'destructive'}
                                    className="text-xs"
                                  >
                                    <span className="hidden sm:inline">
                                      {returnItem?.condition === 'good' ? 'Good - Back to Stock' : 'Damaged - Deadstock'}
                                    </span>
                                    <span className="sm:hidden">
                                      {returnItem?.condition === 'good' ? 'Good' : 'Bad'}
                                    </span>
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-xs sm:text-sm">
                                  {returnItem?.condition === 'good' ? (
                                    <span className="text-emerald-600">Restocked</span>
                                  ) : (
                                    <span className="text-red-600">Lost</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent> */}
            </Tabs>
              </div>
            </div>
          </div>
        )}

        {/* Payment Collection Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="dialog-form-content max-w-[95vw] sm:max-w-md">
            <DialogHeader className="dialog-form-header">
              <DialogTitle className="text-base sm:text-lg">Collect Payment</DialogTitle>
              <CardDescription className="text-xs sm:text-sm break-words">
                Bill: {selectedBillForPayment?.billNumber} • Client: {client.name}
              </CardDescription>
            </DialogHeader>
            <form onSubmit={handlePaymentSubmit} className="dialog-form-body space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-semibold break-words">
                    {selectedBillForPayment ? formatCurrency(selectedBillForPayment.total) : ''}
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Paid Amount:</span>
                  <span className="font-semibold break-words">
                    {selectedBillForPayment ? formatCurrency(selectedBillForPayment.paidAmount) : ''}
                  </span>
                </div>
                <div className="flex justify-between text-sm sm:text-base pt-2 border-t">
                  <span className="font-semibold">Pending Amount:</span>
                  <span className="font-bold text-orange-600 break-words">
                    {selectedBillForPayment
                      ? formatCurrency(selectedBillForPayment.total - selectedBillForPayment.paidAmount)
                      : ''}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-amount" className="text-sm">Payment Amount</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedBillForPayment ? selectedBillForPayment.total - selectedBillForPayment.paidAmount : 0}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  disabled={processingPayment}
                  autoFocus
                  className="text-sm sm:text-base"
                />
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Maximum:{' '}
                    {selectedBillForPayment
                      ? formatCurrency(selectedBillForPayment.total - selectedBillForPayment.paidAmount)
                      : ''}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (selectedBillForPayment) {
                        setPaymentAmount(
                          (selectedBillForPayment.total - selectedBillForPayment.paidAmount).toString()
                        );
                      }
                    }}
                    disabled={processingPayment}
                    className="w-full sm:w-auto text-xs sm:text-sm"
                  >
                    Full Payment
                  </Button>
                </div>
              </div>

              <div className="dialog-form-footer flex flex-col sm:flex-row gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPaymentDialogOpen(false);
                    setSelectedBillForPayment(null);
                    setPaymentAmount('');
                  }}
                  disabled={processingPayment}
                  className="w-full sm:w-auto text-sm"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={processingPayment} className="w-full sm:w-auto text-sm">
                  {processingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Collect Payment
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}




