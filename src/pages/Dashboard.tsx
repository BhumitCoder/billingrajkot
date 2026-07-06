import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getBills,
  getProducts,
  getClients,
  getPurchaseBills,
  getDeadstock,
  getBillReturns,
  getExpenses,
  getNotesByDate,
  updateNoteStatus,
  getCompanyProfile,
  getInventoryUnits,
  getInventoryTransactions,
  getPartyPayments,
} from "@/lib/storage";
import {
  Bill,
  PurchaseBill,
  Product,
  DeadstockItem,
  Expense,
  Note,
} from "@/types";
import {
  formatCurrency,
  formatDate,
  roundToTwoDecimals,
} from "@/lib/billUtils";
import { calculateProductInventoryCostSummary } from "@/lib/productCosting";
import { toast } from "sonner";
import { format } from "date-fns";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FileText,
  Package,
  Users,
  AlertCircle,
  Plus,
  Eye,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  Receipt,
  CreditCard,
  Filter,
  ChevronDown,
  ChevronUp,
  BarChart3,
  DollarSign,
  Calculator,
  Percent,
  Calendar,
  Clock,
  Award,
  Target,
  Activity,
  Star,
  TrendingUp as TrendingUpIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  StickyNote,
  Circle,
  CheckCircle,
  LayoutDashboard,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

import { exportDashboardToExcel } from "@/lib/exportDashboardToExcel";
import { DashboardPDF } from "@/components/DashboardPDF";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { FileSpreadsheet, FileIcon } from "lucide-react";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>([]);
  const [billsInRange, setBillsInRange] = useState<Bill[]>([]);
  const [stats, setStats] = useState({
    totalBills: 0,
    totalProducts: 0,
    totalClients: 0,
    totalRevenue: 0,
    totalCollected: 0,
    pendingAmount: 0,
    overdueBills: 0,
    totalPurchases: 0,
    totalPurchaseBills: 0,
    pendingPurchases: 0,
    profit: 0,
    grossProfit: 0,
    currentGrossProfit: 0,
    totalCOGS: 0,
    deadstockLoss: 0,
    totalReturns: 0,
    totalSaleReturnValue: 0,
    totalPurchaseReturnValue: 0,
    totalGrossSales: 0,
    inventoryValue: 0,
    paidSubtotal: 0,
    pendingSubtotal: 0,
    overdueSubtotal: 0,
    totalExpenses: 0,
    totalDiscount: 0,
    pendingCollection: 0,
    expectedProfit: 0,
    currentNetProfit: 0,
    totalSaleCourier: 0,
    totalCashCollected: 0,
    totalBankCollected: 0,
    totalPurchaseCourier: 0,
    totalPurchaseExtraExpense: 0,
    totalPurchaseCashPaid: 0,
    totalPurchaseBankPaid: 0,
    gstCollected: 0,
    gstInCollected: 0,
  });
  const [chartData, setChartData] = useState({
    monthlySpendVsSales: [] as {
      period: string;
      sales: number;
      purchases: number;
    }[],
    monthlyProfit: [] as { period: string; profit: number }[],
    paymentBreakdown: [] as { name: string; value: number }[],
  });
  const [productAnalytics, setProductAnalytics] = useState({
    topProductsByRevenue: [] as Array<{
      productId: string;
      name: string;
      revenue: number;
      quantity: number;
      profit: number;
      margin: number;
    }>,
    topProductsByQuantity: [] as Array<{
      productId: string;
      name: string;
      revenue: number;
      quantity: number;
      profit: number;
      margin: number;
    }>,
    topProductsByProfit: [] as Array<{
      productId: string;
      name: string;
      revenue: number;
      quantity: number;
      profit: number;
      margin: number;
    }>,
    mostReturnedProducts: [] as Array<{
      productId: string;
      name: string;
      returnQuantity: number;
      returnRate: number;
      totalSold: number;
      returnValue: number;
    }>,
  });
  const [clientAnalytics, setClientAnalytics] = useState({
    topClientsByRevenue: [] as Array<{
      clientId: string;
      name: string;
      revenue: number;
      billCount: number;
      avgBillValue: number;
      pendingAmount: number;
    }>,
    topClientsByOrders: [] as Array<{
      clientId: string;
      name: string;
      revenue: number;
      billCount: number;
      avgBillValue: number;
      pendingAmount: number;
    }>,
    clientReturnStats: [] as Array<{
      clientId: string;
      name: string;
      returnCount: number;
      returnValue: number;
      returnRate: number;
    }>,
  });
  const [selectedYear, setSelectedYear] = useState<"all" | number>("all");
  const [selectedMonth, setSelectedMonth] = useState<"all" | number>("all");
  const [granularity, setGranularity] = useState<"month" | "week" | "day">(
    "month",
  );
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState({
    start: "",
    end: "",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [todayNotes, setTodayNotes] = useState<Note[]>([]);

  const { locked, reloadKey } = useEncryptionLock();

  // Load today's notes separately - runs on mount and when component is visible
  useEffect(() => {
    const loadTodayNotes = async () => {
      try {
        const today = new Date();
        const todayStr = format(today, "yyyy-MM-dd");
        const notes = await getNotesByDate(todayStr);
        const activeNotes = notes.filter((n) => !n.isDone);
        setTodayNotes(activeNotes);
      } catch (error) {
        console.error("Error loading today notes:", error);
        toast.error("Failed to load today's notes");
      }
    };

    loadTodayNotes();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadTodayNotes();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", loadTodayNotes);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", loadTodayNotes);
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [locked, reloadKey, selectedYear, selectedMonth, dateRange, granularity]);

  const loadData = async () => {
    if (locked) {
      // Show plausible dummy numbers when encryption-locked
      setStats((s) => ({
        ...s,
        totalRevenue: 420000,
        totalGrossSales: 420000,
        profit: 38500,
        grossProfit: 45000,
        currentNetProfit: 38500,
        totalExpenses: 12400,
        pendingAmount: 67000,
        pendingCollection: 67000,
        totalBills: 48,
        totalClients: 23,
        totalProducts: 31,
        overdueBills: 4,
        totalPurchases: 310000,
        totalPurchaseBills: 19,
        pendingPurchases: 28000,
      }));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [
        allBills,
        products,
        clients,
        allPurchaseBills,
        deadstock,
        allReturns,
        allExpenses,
        company,
        inventoryUnits,
        allInventoryTransactions,
        allPartyPayments,
      ] = await Promise.all([
        getBills(),
        getProducts(),
        getClients(),
        getPurchaseBills(),
        getDeadstock(),
        getBillReturns(),
        getExpenses(),
        getCompanyProfile(),
        getInventoryUnits(),
        getInventoryTransactions(),
        getPartyPayments(),
      ]);

      // Build per-product transaction map once — avoids N Firestore reads
      const allTransactionsByProduct: Record<string, any[]> = {};
      for (const t of allInventoryTransactions) {
        if (!t.productId) continue;
        if (!allTransactionsByProduct[t.productId]) allTransactionsByProduct[t.productId] = [];
        allTransactionsByProduct[t.productId].push(t);
      }
      // Pre-sort each product's transactions by date
      for (const pid of Object.keys(allTransactionsByProduct)) {
        allTransactionsByProduct[pid].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
      setCompanyProfile(company);

      const yearSet = new Set<number>();
      allBills.forEach((b) => {
        if (b.date) yearSet.add(new Date(b.date).getFullYear());
      });
      allPurchaseBills.forEach((pb) => {
        const dateStr = pb.createdAt || pb.billDate || pb.id;
        if (dateStr) yearSet.add(new Date(dateStr).getFullYear());
      });
      const years = Array.from(yearSet).sort();
      setAvailableYears(years);

      const filterByYearMonth = (dateStr: string, bill?: any) => {
        const d = new Date(dateStr);
        if (selectedYear !== "all" && d.getFullYear() !== selectedYear)
          return false;
        if (selectedMonth !== "all" && d.getMonth() + 1 !== selectedMonth)
          return false;
        if (dateRange.start && new Date(dateStr) < new Date(dateRange.start))
          return false;
        if (dateRange.end && new Date(dateStr) > new Date(dateRange.end + "T23:59:59"))
          return false;
        return true;
      };

      const filteredBillsInRange = allBills.filter((b) =>
        filterByYearMonth(b.date, b),
      );
      setBillsInRange(filteredBillsInRange);
      const purchaseBillsInRange = allPurchaseBills.filter((pb) =>
        filterByYearMonth(pb.createdAt || pb.billDate || pb.id),
      );
      const purchaseBillOverheadFactorById: Record<string, number> = {};
      allPurchaseBills.forEach((pb) => {
        if (!pb?.id) return;
        const subtotal = Math.max(0, Number(pb.subtotal || 0));
        const extraCost = Math.max(
          0,
          Number(pb.courierCharges || 0) + Number(pb.expenseAmount || 0),
        );
        purchaseBillOverheadFactorById[pb.id] =
          subtotal > 0 ? 1 + extraCost / subtotal : 1;
      });
      const getEffectivePurchasePrice = (transaction: any): number => {
        const rawPrice = Number(transaction?.purchasePrice || 0);
        if (rawPrice <= 0) return 0;
        const factor = transaction?.billId
          ? Number(purchaseBillOverheadFactorById[transaction.billId] || 1)
          : 1;
        return roundToTwoDecimals(rawPrice * (factor > 0 ? factor : 1));
      };
      const returnsInRange = allReturns.filter((ret) => {
        if (
          !dateRange.start &&
          !dateRange.end &&
          selectedYear === "all" &&
          selectedMonth === "all"
        ) {
          return true;
        }
        return filterByYearMonth(ret.returnDate || ret.createdAt);
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const getBillFinancials = (bill: Bill) => {
        const billReturns =
          bill.returns?.reduce(
            (sum, r) => sum + (r.totalReturnValue || 0),
            0,
          ) || 0;
        const safeTotal = Math.max(0, bill.total || 0);
        const discount = Math.max(0, bill.discount || 0);
        const subtotalAfterDiscount = Math.max(
          0,
          (bill.subtotal || 0) - discount,
        );
        const returnsBase = Math.max(0, subtotalAfterDiscount);
        const safeReturns = Math.max(0, Math.min(billReturns, returnsBase));
        const returnRatio = returnsBase > 0 ? safeReturns / returnsBase : 0;
        const netTotal = roundToTwoDecimals(
          Math.max(0, safeTotal - billReturns),
        );
        const netSubtotalAfterDiscount = roundToTwoDecimals(
          subtotalAfterDiscount * (1 - returnRatio),
        );
        const netTax = 0;
        const paidRaw = Math.max(0, bill.paidAmount || 0);
        const recognizedPaid = roundToTwoDecimals(Math.min(paidRaw, netTotal));
        const pending = roundToTwoDecimals(
          Math.max(0, netTotal - recognizedPaid),
        );
        const paymentRatio = netTotal > 0 ? recognizedPaid / netTotal : 0;
        const dueDate = bill.dueDate ? new Date(bill.dueDate) : null;
        if (dueDate) dueDate.setHours(0, 0, 0, 0);
        const isOverdue = Boolean(dueDate && dueDate < today && pending > 0);
        return {
          netTotal,
          netSubtotalAfterDiscount,
          netTax,
          recognizedPaid,
          pending,
          paymentRatio,
          isOverdue,
        };
      };

      const totalBilledRevenue = roundToTwoDecimals(
        filteredBillsInRange.reduce(
          (sum, bill) => sum + getBillFinancials(bill).netTotal,
          0,
        ),
      );
      const totalCollected = roundToTwoDecimals(
        filteredBillsInRange.reduce(
          (sum, bill) => sum + getBillFinancials(bill).recognizedPaid,
          0,
        ),
      );
      const totalRevenue = totalCollected;

      const pendingAmount = roundToTwoDecimals(
        filteredBillsInRange.reduce(
          (sum, bill) => sum + getBillFinancials(bill).pending,
          0,
        ),
      );
      const overdueBills = filteredBillsInRange.filter(
        (b) => getBillFinancials(b).isOverdue,
      ).length;

      const totalPurchases = roundToTwoDecimals(
        purchaseBillsInRange.reduce((sum, bill) => {
          const returns =
            bill.returns?.reduce((rSum, r) => rSum + r.totalReturnValue, 0) ||
            0;
          return sum + ((bill.total || 0) - returns);
        }, 0),
      );
      const pendingPurchases = roundToTwoDecimals(
        purchaseBillsInRange
          .filter((b) => b.paymentStatus !== "paid" && b.paymentStatus !== "overpaid")
          .reduce((sum, bill) => {
            const returns =
              bill.returns?.reduce((rSum, r) => rSum + r.totalReturnValue, 0) ||
              0;
            return sum + Math.max(0, (bill.total || 0) - returns - (bill.paidAmount || 0));
          }, 0),
      );

      // Gross sale amount (original billed, before returns) — bill.total is already reduced,
      // so add back bill.returnedAmount to get the original total.
      const totalGrossSales = roundToTwoDecimals(
        filteredBillsInRange.reduce(
          (sum, b) => sum + (b.total || 0) + ((b as any).returnedAmount || 0),
          0,
        ),
      );
      // Total VALUE of sale returns in the selected period
      const totalSaleReturnValue = roundToTwoDecimals(
        returnsInRange.reduce((sum, r) => sum + (r.totalReturnValue || 0), 0),
      );
      // Total VALUE of purchase returns (embedded in each purchase bill)
      const totalPurchaseReturnValue = roundToTwoDecimals(
        purchaseBillsInRange.reduce(
          (sum, bill) =>
            sum +
            (bill.returns?.reduce(
              (rSum, r) => rSum + (r.totalReturnValue || 0),
              0,
            ) || 0),
          0,
        ),
      );

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      const getBucketKeyLabel = (dateStr: string) => {
        const d = new Date(dateStr);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();

        if (granularity === "day") {
          const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const label = `${String(day).padStart(2, "0")} ${monthNames[month - 1]}`;
          return { key, label };
        }

        if (granularity === "week") {
          const firstJan = new Date(year, 0, 1);
          const pastDays = Math.floor(
            (d.getTime() - firstJan.getTime()) / (1000 * 60 * 60 * 24),
          );
          const week = Math.floor((pastDays + firstJan.getDay()) / 7) + 1;
          const key = `${year}-W${String(week).padStart(2, "0")}`;
          const label = `W${week} ${monthNames[month - 1]}`;
          return { key, label };
        }

        const key = `${year}-${String(month).padStart(2, "0")}`;
        const label = `${monthNames[month - 1]} '${year.toString().slice(2)}`;
        return { key, label };
      };

      const productById: Record<string, Product> = {};
      products.forEach((p) => {
        productById[p.id] = p;
      });
      const normalizeText = (value?: string) =>
        String(value || "").trim().toLowerCase();
      const normalizeLooseText = (value?: string) =>
        normalizeText(value).replace(/[^a-z0-9]/g, "");
      const getNameKeys = (value?: string): string[] => {
        const strict = normalizeText(value);
        const loose = normalizeLooseText(value);
        const keys = [strict, loose].filter(Boolean);
        return Array.from(new Set(keys));
      };
      const productIdByName: Record<string, string> = {};
      products.forEach((p) => {
        const keys = [
          ...getNameKeys(p.name),
          ...getNameKeys([p.name, p.model, p.storage, p.color].filter(Boolean).join(" ")),
        ];
        keys.forEach((key) => {
          if (key && !productIdByName[key]) {
            productIdByName[key] = p.id;
          }
        });
      });
      const purchaseHistoryByProductId: Record<
        string,
        { date: number; quantity: number; unitCost: number }[]
      > = {};
      const purchaseHistoryByName: Record<
        string,
        { date: number; quantity: number; unitCost: number }[]
      > = {};
      allPurchaseBills.forEach((pb) => {
        const billDate = new Date(pb.createdAt || pb.billDate || pb.id).getTime();
        if (Number.isNaN(billDate)) return;
        const subtotal = Math.max(0, Number(pb.subtotal || 0));
        const extraCost = Math.max(
          0,
          Number(pb.courierCharges || 0) + Number(pb.expenseAmount || 0),
        );
        const overheadFactor = subtotal > 0 ? 1 + extraCost / subtotal : 1;

        (pb.items || []).forEach((item: any) => {
          const quantity = Math.max(0, Number(item.quantity || 0));
          if (quantity <= 0) return;
          const baseUnitPrice = Math.max(
            0,
            Number(
              item.purchasePrice ||
                item.rate ||
                (item.amount && quantity > 0 ? item.amount / quantity : 0),
            ),
          );
          if (baseUnitPrice <= 0) return;
          const unitCost = roundToTwoDecimals(baseUnitPrice * overheadFactor);
          const itemName = item.description || item.productName || "";
          const nameKeys = getNameKeys(itemName);
          const matchProductId =
            item.productId ||
            nameKeys.map((k) => productIdByName[k]).find(Boolean);
          if (matchProductId) {
            if (!purchaseHistoryByProductId[matchProductId]) {
              purchaseHistoryByProductId[matchProductId] = [];
            }
            purchaseHistoryByProductId[matchProductId].push({
              date: billDate,
              quantity,
              unitCost,
            });
          }
          nameKeys.forEach((key) => {
            if (!key) return;
            if (!purchaseHistoryByName[key]) {
              purchaseHistoryByName[key] = [];
            }
            purchaseHistoryByName[key].push({
              date: billDate,
              quantity,
              unitCost,
            });
          });
        });
      });
      const getWeightedAverageFromHistory = (
        entries: { date: number; quantity: number; unitCost: number }[],
        saleDate: string,
      ): number => {
        if (entries.length === 0) return 0;
        const saleDateTime = new Date(saleDate).getTime();
        if (Number.isNaN(saleDateTime)) return 0;
        // Include same-timestamp/same-day records to avoid dropping landed cost.
        let relevantEntries = entries.filter((e) => e.date <= saleDateTime);
        if (relevantEntries.length === 0) {
          // Fallback for old/inconsistent timestamps: use all history.
          relevantEntries = entries;
        }
        const totalQty = relevantEntries.reduce((sum, e) => sum + e.quantity, 0);
        const totalValue = relevantEntries.reduce(
          (sum, e) => sum + e.quantity * e.unitCost,
          0,
        );
        return totalQty > 0 ? roundToTwoDecimals(totalValue / totalQty) : 0;
      };
      const getAverageCostFromPurchaseBills = (
        productId: string,
        saleDate: string,
      ): number => {
        return getWeightedAverageFromHistory(
          purchaseHistoryByProductId[productId] || [],
          saleDate,
        );
      };
      const getAverageCostFromPurchaseBillsByName = (
        productName: string,
        saleDate: string,
      ): number => {
        const keys = getNameKeys(productName);
        for (const key of keys) {
          const result = getWeightedAverageFromHistory(
            purchaseHistoryByName[key] || [],
            saleDate,
          );
          if (result > 0) return result;
        }
        return 0;
      };

      const productTransactionsMap: Record<string, any[]> = allTransactionsByProduct;

      const getHistoricalAverageCost = (
        productId: string,
        saleDate: string,
      ): number => {
        const product = productById[productId];
        if (!product) return 0;

        const transactions = productTransactionsMap[productId];
        if (!transactions || transactions.length === 0) {
          const purchaseBillCost = getAverageCostFromPurchaseBills(
            productId,
            saleDate,
          );
          if (purchaseBillCost > 0) return purchaseBillCost;
          return product.purchasePrice || product.price || 0;
        }

        const saleDateTime = new Date(saleDate).getTime();
        const purchaseBillCost = getAverageCostFromPurchaseBills(
          productId,
          saleDate,
        );
        const priorPurchaseTransactions = transactions.filter((t) => {
          if (t.type !== "purchase" || !t.purchasePrice) return false;
          const tDate = new Date(t.date).getTime();
          return !Number.isNaN(tDate) && tDate <= saleDateTime;
        });
        const hasLinkedOverheadAwarePurchases = priorPurchaseTransactions.some(
          (t) =>
            Boolean(t.billId) &&
            Number(purchaseBillOverheadFactorById[t.billId] || 0) > 0,
        );
        if (
          purchaseBillCost > 0 &&
          !hasLinkedOverheadAwarePurchases
        ) {
          return purchaseBillCost;
        }
        let totalPurchaseValue = 0;
        let totalPurchaseQuantity = 0;
        let currentInventory = 0;
        let currentInventoryValue = 0;

        for (const transaction of transactions) {
          const transactionDate = new Date(transaction.date).getTime();

          if (transactionDate <= saleDateTime) {
            if (transaction.type === "purchase" && transaction.purchasePrice) {
              const effectivePurchasePrice =
                getEffectivePurchasePrice(transaction);
              const purchaseValue =
                transaction.quantity * effectivePurchasePrice;
              currentInventory += transaction.quantity;
              currentInventoryValue += purchaseValue;
              totalPurchaseValue += purchaseValue;
              totalPurchaseQuantity += transaction.quantity;
            } else if (transaction.type === "sale") {
              if (currentInventory > 0) {
                const averageCostAtSale =
                  currentInventoryValue / currentInventory;
                const saleValue = transaction.quantity * averageCostAtSale;
                currentInventory -= transaction.quantity;
                currentInventoryValue -= saleValue;
              } else {
                currentInventory = Math.max(
                  0,
                  currentInventory - transaction.quantity,
                );
              }
            } else if (transaction.type === "return") {
              const returnItem = allReturns.find(
                (r) =>
                  r.id === transaction.billReturnId ||
                  r.id === transaction.billId,
              );
              const returnItemData = returnItem?.items.find(
                (i) => i.productId === productId,
              );

              if (returnItemData && returnItemData.condition === "good") {
                if (currentInventory > 0) {
                  const avgCost = currentInventoryValue / currentInventory;
                  currentInventory += transaction.quantity;
                  currentInventoryValue += transaction.quantity * avgCost;
                } else {
                  const lastPurchase = transactions
                    .filter(
                      (t) =>
                        t.type === "purchase" &&
                        t.purchasePrice &&
                        new Date(t.date).getTime() <= transactionDate,
                    )
                    .slice(-1)[0];
                  if (lastPurchase && lastPurchase.purchasePrice) {
                    const effectiveLastPurchasePrice =
                      getEffectivePurchasePrice(lastPurchase);
                    currentInventory += transaction.quantity;
                    currentInventoryValue +=
                      transaction.quantity * effectiveLastPurchasePrice;
                  }
                }
              }
            } else if (
              transaction.type === "purchase_return" &&
              transaction.purchasePrice
            ) {
              const effectivePurchasePrice =
                getEffectivePurchasePrice(transaction);
              const returnValue =
                Math.abs(transaction.quantity) * effectivePurchasePrice;
              currentInventory = Math.max(
                0,
                currentInventory - Math.abs(transaction.quantity),
              );
              currentInventoryValue = Math.max(
                0,
                currentInventoryValue - returnValue,
              );
            }
          }
        }

        if (currentInventory > 0) {
          return roundToTwoDecimals(currentInventoryValue / currentInventory);
        } else if (totalPurchaseQuantity > 0) {
          return roundToTwoDecimals(totalPurchaseValue / totalPurchaseQuantity);
        } else {
          if (purchaseBillCost > 0) return purchaseBillCost;
          return roundToTwoDecimals(
            product.purchasePrice || product.price || 0,
          );
        }
      };

      const stockValues: Record<string, number> = {};
      const inventoryInStockByProduct = inventoryUnits.reduce(
        (acc, unit) => {
          if (unit.status !== "in_stock" || !unit.productId) return acc;
          acc[unit.productId] = (acc[unit.productId] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      for (const product of products) {
        const effectiveStock =
          (product.trackingType || "standard") === "serialized"
            ? Math.max(product.stock || 0, inventoryInStockByProduct[product.id] || 0)
            : product.stock || 0;
        const transactions = allTransactionsByProduct[product.id] || [];
        const costSummary = calculateProductInventoryCostSummary({
          productId: product.id,
          fallbackUnitCost: Number(product.purchasePrice || 0),
          transactions,
          billReturns: allReturns,
          inventoryUnits,
          effectiveStock,
        });

        stockValues[product.id] = costSummary.effectiveValue;
      }

      const inventoryValue = roundToTwoDecimals(
        Object.values(stockValues).reduce((sum, val) => sum + val, 0),
      );

      const getStrictSoldItemCost = (item: any, product?: Product) => {
        const explicitItemCost = Number(item.purchasePrice || 0);
        if (explicitItemCost > 0) {
          return roundToTwoDecimals(explicitItemCost);
        }
        const productCost = Number(product?.purchasePrice || product?.price || 0);
        return roundToTwoDecimals(productCost);
      };

      const buckets: Record<
        string,
        { label: string; sales: number; purchases: number; profit: number }
      > = {};

      let totalCOGS = 0;
      let realizedCOGS = 0;
      filteredBillsInRange.forEach((bill) => {
        const { key, label } = getBucketKeyLabel(bill.date);
        if (!buckets[key])
          buckets[key] = { label, sales: 0, purchases: 0, profit: 0 };
        const financials = getBillFinancials(bill);

        const sales = roundToTwoDecimals(financials.netTotal);
        let billCogs = 0;
        (bill.items || []).forEach((item) => {
          const resolvedProductId =
            item.productId ||
            getNameKeys(item.productName || item.description)
              .map((k) => productIdByName[k])
              .find(Boolean);
          const product = resolvedProductId
            ? productById[resolvedProductId]
            : undefined;
          const costPrice = getStrictSoldItemCost(item, product);
          billCogs += roundToTwoDecimals(item.quantity * costPrice);
        });

        const billDiscount = Math.max(0, bill.discount || 0);
        const subtotalAfterDiscount = Math.max(0, (bill.subtotal || 0) - billDiscount);
        const totalReturns =
          bill.returns?.reduce((sum, r) => sum + (r.totalReturnValue || 0), 0) || 0;
        const safeReturns = Math.max(0, Math.min(totalReturns, subtotalAfterDiscount));
        const returnRatio =
          subtotalAfterDiscount > 0
            ? Math.min(1, Math.max(0, safeReturns / subtotalAfterDiscount))
            : 0;
        const netBillCogs = roundToTwoDecimals(billCogs * (1 - returnRatio));
        const recognizedBillCogs = roundToTwoDecimals(
          netBillCogs * financials.paymentRatio,
        );
        totalCOGS += netBillCogs;
        realizedCOGS += recognizedBillCogs;

        const billGst = (bill as any).isGst ? ((bill as any).totalTax || 0) : 0;
        buckets[key].sales += roundToTwoDecimals(sales - billGst);
        buckets[key].profit += roundToTwoDecimals(sales - billGst - netBillCogs);
      });

      purchaseBillsInRange.forEach((pb) => {
        const { key, label } = getBucketKeyLabel(
          pb.createdAt || pb.billDate || pb.id,
        );
        if (!buckets[key])
          buckets[key] = { label, sales: 0, purchases: 0, profit: 0 };
        const returns =
          pb.returns?.reduce(
            (rSum, r) => rSum + (r.totalReturnValue || 0),
            0,
          ) || 0;
        buckets[key].purchases += roundToTwoDecimals(
          Math.max(0, (pb.total || 0) - returns),
        );
      });

      const bucketKeys = Object.keys(buckets).sort();
      const monthlySpendVsSales = bucketKeys.map((k) => ({
        period: buckets[k].label,
        sales: roundToTwoDecimals(buckets[k].sales),
        purchases: roundToTwoDecimals(buckets[k].purchases),
      }));
      const monthlyProfit = bucketKeys.map((k) => ({
        period: buckets[k].label,
        profit: roundToTwoDecimals(buckets[k].profit),
      }));

      const paidSubtotalValue = roundToTwoDecimals(
        filteredBillsInRange.reduce((sum, bill) => {
          const financials = getBillFinancials(bill);
          return sum + financials.recognizedPaid;
        }, 0),
      );
      const pendingSubtotalValue = roundToTwoDecimals(
        filteredBillsInRange.reduce((sum, b) => {
          const financials = getBillFinancials(b);
          if (financials.isOverdue || financials.pending <= 0) return sum;
          return sum + financials.pending;
        }, 0),
      );
      const overdueSubtotalValue = roundToTwoDecimals(
        filteredBillsInRange.reduce((sum, b) => {
          const financials = getBillFinancials(b);
          if (!financials.isOverdue || financials.pending <= 0) return sum;
          return sum + financials.pending;
        }, 0),
      );

      const totalPending = roundToTwoDecimals(
        filteredBillsInRange
          .filter((b) => {
            const f = getBillFinancials(b);
            return !f.isOverdue && f.pending > 0;
          })
          .reduce((sum, b) => sum + getBillFinancials(b).pending, 0),
      );
      const totalPaid = roundToTwoDecimals(totalCollected);
      const totalOverdue = roundToTwoDecimals(
        filteredBillsInRange
          .filter((b) => getBillFinancials(b).isOverdue)
          .reduce((sum, b) => sum + getBillFinancials(b).pending, 0),
      );
      const paymentBreakdown = [
        { name: "Paid", value: totalPaid },
        { name: "Pending", value: totalPending },
        { name: "Overdue", value: totalOverdue },
      ].filter((item) => item.value > 0);

      const deadstockLoss = roundToTwoDecimals(
        deadstock.reduce(
          (sum, item) =>
            sum + (item.expenseTracked ? 0 : item.costPrice * item.quantity),
          0,
        ),
      );

      const expensesInRange = allExpenses.filter(
        (e) =>
          filterByYearMonth(e.date) &&
          e.sourceType !== "purchase_bill_auto",
      );
      const totalExpenses = roundToTwoDecimals(
        expensesInRange.reduce((sum, expense) => sum + expense.amount, 0),
      );

      const gstCollected = roundToTwoDecimals(
        filteredBillsInRange
          .filter((b) => (b as any).isGst)
          .reduce((sum, b) => sum + ((b as any).totalTax || 0), 0),
      );

      const gstInCollected = roundToTwoDecimals(
        filteredBillsInRange
          .filter((b) => (b as any).isGst)
          .reduce((sum, b) => {
            const fin = getBillFinancials(b);
            return sum + roundToTwoDecimals(((b as any).totalTax || 0) * fin.paymentRatio);
          }, 0),
      );

      const grossProfit = roundToTwoDecimals(
        totalRevenue + pendingAmount - gstCollected - totalCOGS,
      );
      const currentGrossProfit = roundToTwoDecimals((totalCollected - gstInCollected) - realizedCOGS);
      const profit = roundToTwoDecimals(
        grossProfit - deadstockLoss - totalExpenses,
      );
      const currentNetProfit = roundToTwoDecimals(
        currentGrossProfit - deadstockLoss - totalExpenses,
      );
      const expectedProfit =
        pendingAmount > 0
          ? roundToTwoDecimals(profit - currentNetProfit)
          : 0;


      const totalDiscount = roundToTwoDecimals(
        filteredBillsInRange.reduce(
          (sum, bill) => sum + (bill.discount || 0),
          0,
        ),
      );
      const totalSaleCourier = roundToTwoDecimals(
        filteredBillsInRange.reduce(
          (sum, bill) => sum + Number(bill.courierCharges || 0),
          0,
        ),
      );
      const paymentMethodTotals = filteredBillsInRange.reduce(
        (acc, bill) => {
          const b = bill as any;
          if (Array.isArray(b.payments) && b.payments.length > 0) {
            b.payments.forEach((p: any) => {
              const method = p.method || "Other";
              acc[method] = (acc[method] || 0) + Number(p.amount || 0);
            });
          } else if ((b.paidAmount || 0) > 0) {
            const method = b.paymentMethod || b.paymentType || "Other";
            acc[method] = (acc[method] || 0) + Number(b.paidAmount || 0);
          }
          return acc;
        },
        {} as Record<string, number>,
      );
      const totalCashCollected = roundToTwoDecimals(
        Number(paymentMethodTotals["Cash"] || 0),
      );
      const totalBankCollected = roundToTwoDecimals(
        Number(paymentMethodTotals["Bank Transfer"] || 0) +
          Number(paymentMethodTotals["UPI"] || 0) +
          Number(paymentMethodTotals["Cheque"] || 0),
      );
      const totalPurchaseCourier = roundToTwoDecimals(
        purchaseBillsInRange.reduce(
          (sum, bill) => sum + Number(bill.courierCharges || 0),
          0,
        ),
      );
      const totalPurchaseExtraExpense = roundToTwoDecimals(
        purchaseBillsInRange.reduce(
          (sum, bill) => sum + Number(bill.expenseAmount || 0),
          0,
        ),
      );
      const purchasePaymentMethodTotals = purchaseBillsInRange.reduce(
        (acc, bill) => {
          const b = bill as any;
          if (Array.isArray(b.payments) && b.payments.length > 0) {
            b.payments.forEach((p: any) => {
              const method = p.method || "Other";
              const amount = Number(p.amount || 0);
              if (amount > 0) {
                acc[method] = (acc[method] || 0) + amount;
              }
            });
          } else if ((b.paidAmount || 0) > 0) {
            const method = b.paymentMethod || b.paymentType || "Other";
            acc[method] = (acc[method] || 0) + Number(b.paidAmount || 0);
          }
          return acc;
        },
        {} as Record<string, number>,
      );
      const totalPurchaseCashPaid = roundToTwoDecimals(
        Number(purchasePaymentMethodTotals["Cash"] || 0),
      );
      const totalPurchaseBankPaid = roundToTwoDecimals(
        Number(purchasePaymentMethodTotals["Bank Transfer"] || 0) +
          Number(purchasePaymentMethodTotals["UPI"] || 0) +
          Number(purchasePaymentMethodTotals["Cheque"] || 0),
      );

      setStats({
        totalBills: filteredBillsInRange.length,
        totalProducts: products.length,
        totalClients: clients.length,
        totalRevenue,
        totalCollected,
        pendingAmount,
        overdueBills,
        totalPurchases,
        totalPurchaseBills: purchaseBillsInRange.length,
        pendingPurchases,
        profit,
        grossProfit,
        currentGrossProfit,
        totalCOGS,
        deadstockLoss,
        totalReturns: returnsInRange.length,
        totalSaleReturnValue,
        totalPurchaseReturnValue,
        totalGrossSales,
        inventoryValue,
        paidSubtotal: roundToTwoDecimals(paidSubtotalValue),
        pendingSubtotal: roundToTwoDecimals(pendingSubtotalValue),
        overdueSubtotal: roundToTwoDecimals(overdueSubtotalValue),
        totalExpenses,
        totalDiscount,
        pendingCollection: pendingAmount,
        expectedProfit,
        currentNetProfit,
        totalSaleCourier,
        totalCashCollected,
        totalBankCollected,
        totalPurchaseCourier,
        totalPurchaseExtraExpense,
        totalPurchaseCashPaid,
        totalPurchaseBankPaid,
        gstCollected,
        gstInCollected,
      });

      setChartData({
        monthlySpendVsSales,
        monthlyProfit,
        paymentBreakdown,
      });

      const sortedBills = filteredBillsInRange.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      setBills(sortedBills.slice(0, 5));

      const sortedPurchaseBills = purchaseBillsInRange.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setPurchaseBills(sortedPurchaseBills.slice(0, 5));

      // ============ PRODUCT ANALYTICS ============
      const productStats: Record<
        string,
        {
          productId: string;
          name: string;
          revenue: number;
          quantity: number;
          cost: number;
          profit: number;
          margin: number;
          returnQuantity: number;
          totalSold: number;
          returnValue: number;
        }
      > = {};

      filteredBillsInRange.forEach((bill) => {
        const financials = getBillFinancials(bill);
        const discountAmount = bill.discount || 0;
        const billSubtotal = bill.subtotal;
        const discountRatio =
          billSubtotal > 0 ? discountAmount / billSubtotal : 0;

        (bill.items || []).forEach((item) => {
          const resolvedProductId =
            item.productId ||
            getNameKeys(item.productName || item.description)
              .map((k) => productIdByName[k])
              .find(Boolean);
          const product = resolvedProductId
            ? productById[resolvedProductId]
            : undefined;
          if (!resolvedProductId || !product) return;

          if (!productStats[resolvedProductId]) {
            productStats[resolvedProductId] = {
              productId: resolvedProductId,
              name: item.productName,
              revenue: 0,
              quantity: 0,
              cost: 0,
              profit: 0,
              margin: 0,
              returnQuantity: 0,
              totalSold: 0,
              returnValue: 0,
            };
          }

          const costPrice = getStrictSoldItemCost(item, product);
          const itemCost = roundToTwoDecimals(item.quantity * costPrice);
          const itemDiscount = roundToTwoDecimals(item.amount * discountRatio);
          const itemRevenue = roundToTwoDecimals(item.amount - itemDiscount);
          const recognizedItemRevenue = itemRevenue;
          const recognizedItemCost = itemCost;
          const itemProfit = roundToTwoDecimals(
            recognizedItemRevenue - recognizedItemCost,
          );

          productStats[resolvedProductId].revenue += recognizedItemRevenue;
          productStats[resolvedProductId].quantity += item.quantity;
          productStats[resolvedProductId].cost += recognizedItemCost;
          productStats[resolvedProductId].profit += itemProfit;
          productStats[resolvedProductId].totalSold += item.quantity;
        });
      });

      returnsInRange.forEach((returnItem) => {
        (returnItem.items || []).forEach((returnItemData) => {
          const product = products.find(
            (p) =>
              p.id === returnItemData.productId ||
              p.name === returnItemData.productName,
          );
          if (!product) return;

          const productId = returnItemData.productId || product.id;

          if (!productStats[productId]) {
            productStats[productId] = {
              productId: productId,
              name: returnItemData.productName,
              revenue: 0,
              quantity: 0,
              cost: 0,
              profit: 0,
              margin: 0,
              returnQuantity: 0,
              totalSold: 0,
              returnValue: 0,
            };
          }

          const returnDate = returnItem.returnDate || returnItem.createdAt;
          const costPrice = getHistoricalAverageCost(product.id, returnDate);
          productStats[productId].returnQuantity += returnItemData.quantity;
          productStats[productId].returnValue += roundToTwoDecimals(
            returnItemData.quantity * costPrice,
          );
        });
      });

      Object.values(productStats).forEach((stat) => {
        stat.margin =
          stat.cost > 0
            ? roundToTwoDecimals((stat.profit / stat.cost) * 100)
            : 0;
      });

      const topProductsByRevenue = Object.values(productStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((p) => ({
          productId: p.productId,
          name: p.name,
          revenue: p.revenue,
          quantity: p.quantity,
          profit: p.profit,
          margin: p.margin,
        }));

      const topProductsByQuantity = Object.values(productStats)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10)
        .map((p) => ({
          productId: p.productId,
          name: p.name,
          revenue: p.revenue,
          quantity: p.quantity,
          profit: p.profit,
          margin: p.margin,
        }));

      const topProductsByProfit = Object.values(productStats)
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10)
        .map((p) => ({
          productId: p.productId,
          name: p.name,
          revenue: p.revenue,
          quantity: p.quantity,
          profit: p.profit,
          margin: p.margin,
        }));

      const mostReturnedProducts = Object.values(productStats)
        .filter((p) => p.returnQuantity > 0)
        .map((p) => ({
          productId: p.productId,
          name: p.name,
          returnQuantity: p.returnQuantity,
          // totalSold from bill.items is already post-return (quantities reduced);
          // add returnQuantity back to get original sold quantity for an accurate rate
          returnRate:
            (p.totalSold + p.returnQuantity) > 0
              ? (p.returnQuantity / (p.totalSold + p.returnQuantity)) * 100
              : 0,
          totalSold: p.totalSold + p.returnQuantity,
          returnValue: p.returnValue,
        }))
        .sort((a, b) => b.returnQuantity - a.returnQuantity)
        .slice(0, 10);

      setProductAnalytics({
        topProductsByRevenue,
        topProductsByQuantity,
        topProductsByProfit,
        mostReturnedProducts,
      });

      // ============ CLIENT ANALYTICS ============
      const clientStats: Record<
        string,
        {
          clientId: string;
          name: string;
          revenue: number;
          billCount: number;
          paidAmount: number;
          pendingAmount: number;
          returnCount: number;
          returnValue: number;
        }
      > = {};

      filteredBillsInRange.forEach((bill) => {
        const financials = getBillFinancials(bill);
        if (!clientStats[bill.clientId]) {
          clientStats[bill.clientId] = {
            clientId: bill.clientId,
            name: bill.client?.name ?? "",
            revenue: 0,
            billCount: 0,
            paidAmount: 0,
            pendingAmount: 0,
            returnCount: 0,
            returnValue: 0,
          };
        }

        clientStats[bill.clientId].revenue += financials.recognizedPaid;
        clientStats[bill.clientId].billCount += 1;
        clientStats[bill.clientId].paidAmount += financials.recognizedPaid;
        clientStats[bill.clientId].pendingAmount += financials.pending;
      });

      returnsInRange.forEach((returnItem) => {
        const client = clients.find((c) => c.name === returnItem.clientName);
        if (!client) return;

        if (!clientStats[client.id]) {
          clientStats[client.id] = {
            clientId: client.id,
            name: client.name,
            revenue: 0,
            billCount: 0,
            paidAmount: 0,
            pendingAmount: 0,
            returnCount: 0,
            returnValue: 0,
          };
        }

        clientStats[client.id].returnCount += 1;
        clientStats[client.id].returnValue += roundToTwoDecimals(
          returnItem.totalReturnValue,
        );
      });

      // Recompute pendingAmount to mirror ClientDetailScreen "To Receive" exactly:
      // gross receivable (opening + sale bills - party collected) minus gross payable (opening + purchase bills - party sent)
      clients.forEach((c) => {
        if (!clientStats[c.id]) return;

        // Opening balance
        const openingAmt = Math.abs(c.openingBalance || 0);
        const openingIsPayable = (c.openingBalanceType || "receivable") === "payable";
        const openingReceivable = openingIsPayable ? 0 : openingAmt;
        const openingPayable = openingIsPayable ? openingAmt : 0;

        // Party payments (all-time, not date-filtered)
        const partyPayCollected = allPartyPayments
          .filter((p) => p.partyId === c.id && p.type === "collected")
          .reduce((s, p) => s + (p.amount || 0), 0);
        const partyPaySent = allPartyPayments
          .filter((p) => p.partyId === c.id && p.type === "sent")
          .reduce((s, p) => s + (p.amount || 0), 0);

        // Sale receivable — exact ClientDetailScreen formula:
        // restore original pre-return total via returnedAmount, then subtract BillReturns collection
        const clientSaleBills = allBills.filter((b) => b.clientId === c.id);
        const clientBillIds = new Set(clientSaleBills.map((b) => b.id));
        const totalSales = clientSaleBills.reduce(
          (s, b) => s + (b.total || 0) + (b.returnedAmount || 0), 0,
        );
        const totalSaleReturnValue = allReturns
          .filter((r) => clientBillIds.has(r.billId))
          .reduce((s, r) => s + (r.totalReturnValue || 0), 0);
        const billsPaymentsCollected = clientSaleBills.reduce(
          (s, b) => s + (b.paidAmount || 0), 0,
        );
        const totalCollected = billsPaymentsCollected + partyPayCollected;
        const newSalesReceivable = totalSales - totalSaleReturnValue - totalCollected;
        const grossReceivable = openingReceivable + Math.max(0, newSalesReceivable);

        // Purchase payable (client may also be a vendor)
        const cName = c.name.toLowerCase().trim();
        const purchPending = allPurchaseBills
          .filter((b) => b.clientId === c.id || (!b.clientId && b.vendorName?.toLowerCase().trim() === cName))
          .reduce((s, b) => {
            const ret = b.returns?.reduce((r, rv) => r + (rv.totalReturnValue || 0), 0) || 0;
            return s + Math.max(0, (b.total || 0) - ret - (b.paidAmount || 0));
          }, 0);
        const newPurchasePayable = purchPending - partyPaySent;
        const grossPayable = openingPayable + Math.max(0, newPurchasePayable);

        clientStats[c.id].pendingAmount = roundToTwoDecimals(
          Math.max(0, grossReceivable - grossPayable),
        );
      });

      const topClientsByRevenue = Object.values(clientStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((c) => ({
          clientId: c.clientId,
          name: c.name,
          revenue: c.revenue,
          billCount: c.billCount,
          avgBillValue:
            c.billCount > 0 ? roundToTwoDecimals(c.revenue / c.billCount) : 0,
          pendingAmount: c.pendingAmount,
        }));

      const topClientsByOrders = Object.values(clientStats)
        .sort((a, b) => b.billCount - a.billCount)
        .slice(0, 10)
        .map((c) => ({
          clientId: c.clientId,
          name: c.name,
          revenue: c.revenue,
          billCount: c.billCount,
          avgBillValue:
            c.billCount > 0 ? roundToTwoDecimals(c.revenue / c.billCount) : 0,
          pendingAmount: c.pendingAmount,
        }));

      const clientReturnStats = Object.values(clientStats)
        .filter((c) => c.returnCount > 0)
        .map((c) => {
          const totalBills = c.billCount;
          const returnRate =
            totalBills > 0 ? (c.returnCount / totalBills) * 100 : 0;
          return {
            clientId: c.clientId,
            name: c.name,
            returnCount: c.returnCount,
            returnValue: c.returnValue,
            returnRate,
          };
        })
        .sort((a, b) => b.returnCount - a.returnCount)
        .slice(0, 10);

      setClientAnalytics({
        topClientsByRevenue,
        topClientsByOrders,
        clientReturnStats,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      paid: "default",
      pending: "secondary",
      overdue: "destructive",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {status}
      </Badge>
    );
  };

  const getRenderBillFinancials = (bill: Bill) => {
    const billReturns =
      bill.returns?.reduce((sum, r) => sum + (r.totalReturnValue || 0), 0) || 0;
    const safeTotal = Math.max(0, bill.total || 0);
    const safeReturns = Math.max(0, Math.min(billReturns, safeTotal));
    const netTotal = Math.max(0, safeTotal - safeReturns);
    const recognizedPaid = Math.min(
      Math.max(0, bill.paidAmount || 0),
      netTotal,
    );
    const pending = Math.max(0, netTotal - recognizedPaid);
    const dueDate = bill.dueDate ? new Date(bill.dueDate) : null;
    if (dueDate) dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = Boolean(dueDate && dueDate < today && pending > 0);
    return {
      pending: roundToTwoDecimals(pending),
      isOverdue,
    };
  };

  const exportToExcel = () => {
    exportDashboardToExcel(
      stats,
      chartData,
      productAnalytics,
      clientAnalytics,
      billsInRange,
      purchaseBills.slice(0, 50),
      companyProfile,
      dateRange,
    );
    toast.success("Excel report generated successfully");
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <LoadingSpinner
          size="xl"
          text="Loading dashboard data..."
          fullScreen
          contentAreaOnly
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 rounded-2xl border border-border/70 bg-background p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">Dashboard</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 items-center gap-1.5 rounded-lg bg-background px-2.5 text-xs"
              onClick={exportToExcel}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <PDFDownloadLink
              document={
                <DashboardPDF
                  stats={stats}
                  chartData={chartData}
                  productAnalytics={productAnalytics}
                  clientAnalytics={clientAnalytics}
                  bills={billsInRange.slice(0, 50)}
                  purchaseBills={purchaseBills.slice(0, 50)}
                  company={companyProfile}
                  dateRange={dateRange}
                />
              }
              fileName={`Dashboard_Report_${format(new Date(), "dd-MM-yyyy")}.pdf`}
              onClick={() => toast.success("Generating PDF report...")}
            >
              {({ loading }) => (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 items-center gap-1.5 rounded-lg bg-background px-2.5 text-xs"
                  disabled={loading}
                >
                  <FileIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{loading ? "..." : "PDF"}</span>
                </Button>
              )}
            </PDFDownloadLink>
            <Link to="/bills/new">
              <Button size="sm" className="h-8 rounded-lg px-3 text-xs shadow-sm">
                <Plus className="mr-1 h-3.5 w-3.5" />
                New Sale
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── SINGLE SCROLL CONTAINER ── everything below scrolls together */}
      <Card className="min-h-0 flex-1 overflow-hidden border border-border/70 bg-background/60 shadow-none">
        <CardContent className="h-full min-h-0 overflow-y-auto p-1 pb-4 sm:p-1.5 sm:pb-6">
          <div className="flex flex-col gap-1.5">
            {/* Filters & Date Range — scrolls with the rest of the page */}
            <div className="w-full max-w-full overflow-hidden rounded-xl border border-border/70 bg-background/80">
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="w-full p-2 sm:p-2.5 flex items-center justify-between hover:bg-muted/50 transition-colors touch-manipulation"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <h3 className="font-semibold text-xs sm:text-sm md:text-base truncate">
                      Filters & Date Range
                    </h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {selectedYear !== "all" ||
                      selectedMonth !== "all" ||
                      dateRange.start ||
                      dateRange.end
                        ? "Active filters applied"
                        : "Click to configure filters"}
                    </p>
                  </div>
                </div>
                {filtersOpen ? (
                  <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              {filtersOpen && (
                <div className="p-2 sm:p-2.5 pt-0 border-t bg-muted/30 w-full max-w-full overflow-x-hidden">
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Year
                        </Label>
                        <Select
                          value={
                            selectedYear === "all"
                              ? "all"
                              : String(selectedYear)
                          }
                          onValueChange={(val: string) =>
                            setSelectedYear(
                              val === "all" ? "all" : parseInt(val, 10),
                            )
                          }
                        >
                          <SelectTrigger className="w-full h-10">
                            <SelectValue placeholder="Select Year" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Years</SelectItem>
                            {availableYears.map((y) => (
                              <SelectItem key={y} value={String(y)}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Month</Label>
                        <Select
                          value={
                            selectedMonth === "all"
                              ? "all"
                              : String(selectedMonth)
                          }
                          onValueChange={(val: string) =>
                            setSelectedMonth(
                              val === "all" ? "all" : parseInt(val, 10),
                            )
                          }
                        >
                          <SelectTrigger className="w-full h-10">
                            <SelectValue placeholder="Select Month" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Months</SelectItem>
                            {[
                              "Jan",
                              "Feb",
                              "Mar",
                              "Apr",
                              "May",
                              "Jun",
                              "Jul",
                              "Aug",
                              "Sep",
                              "Oct",
                              "Nov",
                              "Dec",
                            ].map((name, idx) => (
                              <SelectItem key={idx + 1} value={String(idx + 1)}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          View By
                        </Label>
                        <Select
                          value={granularity}
                          onValueChange={(val: "month" | "week" | "day") =>
                            setGranularity(val)
                          }
                        >
                          <SelectTrigger className="w-full h-10">
                            <SelectValue placeholder="Select View" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="month">By Month</SelectItem>
                            <SelectItem value="week">By Week</SelectItem>
                            <SelectItem value="day">By Day</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Receipt className="h-4 w-4" />
                          Bill Type
                        </Label>
                        <Input
                          value="All Bills"
                          readOnly
                          className="w-full h-10 text-sm bg-muted"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-end w-full">
                      <div className="space-y-2 w-full">
                        <Label
                          htmlFor="start-date"
                          className="text-xs sm:text-sm font-medium"
                        >
                          From Date
                        </Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={dateRange.start}
                          onChange={(e) =>
                            setDateRange({
                              ...dateRange,
                              start: e.target.value,
                            })
                          }
                          className="w-full h-9 sm:h-10 text-sm"
                        />
                      </div>

                      <div className="space-y-2 w-full">
                        <Label
                          htmlFor="end-date"
                          className="text-xs sm:text-sm font-medium"
                        >
                          To Date
                        </Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={dateRange.end}
                          onChange={(e) =>
                            setDateRange({ ...dateRange, end: e.target.value })
                          }
                          className="w-full h-9 sm:h-10 text-sm"
                        />
                      </div>

                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedYear("all");
                          setSelectedMonth("all");
                          setGranularity("month");
                          setDateRange({ start: "", end: "" });
                        }}
                        className="w-full h-9 sm:h-10 text-xs sm:text-sm touch-manipulation"
                      >
                        Clear All Filters
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── All dashboard content — same scroll as filters above ── */}
            <div className="space-y-4 p-1 sm:p-1.5 lg:p-2 pr-1 sm:pr-2">
              {todayNotes.length > 0 && (
                <Card className="border-2 shadow-md bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 w-full max-w-full overflow-hidden">
                  <CardHeader className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-3 sm:pb-4">
                    <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base md:text-lg">
                      <StickyNote className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                      Today's Notes ({todayNotes.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    <div className="space-y-2 sm:space-y-3">
                      {todayNotes.map((note) => (
                        <div
                          key={note.id}
                          className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 border rounded-lg bg-background hover:bg-accent/50 transition-colors w-full"
                        >
                          <button
                            onClick={async () => {
                              try {
                                await updateNoteStatus(note.id, true);
                                const today = new Date();
                                const todayStr = format(today, "yyyy-MM-dd");
                                const notes = await getNotesByDate(todayStr);
                                setTodayNotes(notes.filter((n) => !n.isDone));
                                toast.success("Note marked as done");
                              } catch (error) {
                                console.error("Error updating note:", error);
                                toast.error("Failed to update note");
                              }
                            }}
                            className="mt-0.5 sm:mt-1 flex-shrink-0 hover:scale-110 transition-transform touch-manipulation"
                            aria-label="Mark as done"
                            title="Mark as done"
                          >
                            <Circle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap break-words">
                              {note.content}
                            </p>
                          </div>
                          <Link to="/notes" className="flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs sm:text-sm touch-manipulation"
                            >
                              View All
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Business Insights Summary */}
              {productAnalytics.topProductsByRevenue.length > 0 ||
              clientAnalytics.topClientsByRevenue.length > 0 ? (
                <Card className="border-2 shadow-lg bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 w-full max-w-full overflow-hidden">
                  <CardHeader className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-3 sm:pb-4">
                    <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
                      <Target className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-purple-600 flex-shrink-0" />
                      Key Business Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
                      {productAnalytics.topProductsByRevenue.length > 0 && (
                        <div className="p-3 sm:p-4 bg-background rounded-lg border w-full">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                            <Package className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600 flex-shrink-0" />
                            <span className="text-xs sm:text-sm font-medium text-muted-foreground break-words">
                              Best Selling Product
                            </span>
                          </div>
                          <p className="font-bold text-sm sm:text-base md:text-lg truncate break-words">
                            {productAnalytics.topProductsByRevenue[0]?.name}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground break-words mt-1">
                            Revenue:{" "}
                            {formatCurrency(
                              productAnalytics.topProductsByRevenue[0]
                                ?.revenue || 0,
                            )}
                          </p>
                        </div>
                      )}
                      {productAnalytics.topProductsByProfit.length > 0 && (
                        <div className="p-3 sm:p-4 bg-background rounded-lg border w-full">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                            <TrendingUpIcon className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 flex-shrink-0" />
                            <span className="text-xs sm:text-sm font-medium text-muted-foreground break-words">
                              Highest Profit Margin
                            </span>
                          </div>
                          <p className="font-bold text-sm sm:text-base md:text-lg truncate break-words">
                            {productAnalytics.topProductsByProfit[0]?.name}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground break-words mt-1">
                            Margin:{" "}
                            {productAnalytics.topProductsByProfit[0]?.margin.toFixed(
                              1,
                            )}
                            %
                          </p>
                        </div>
                      )}
                      {clientAnalytics.topClientsByRevenue.length > 0 && (
                        <div className="p-3 sm:p-4 bg-background rounded-lg border w-full">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                            <Star className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600 flex-shrink-0" />
                            <span className="text-xs sm:text-sm font-medium text-muted-foreground break-words">
                              Top Client
                            </span>
                          </div>
                          <p className="font-bold text-sm sm:text-base md:text-lg truncate break-words">
                            {clientAnalytics.topClientsByRevenue[0]?.name}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground break-words mt-1">
                            Revenue:{" "}
                            {formatCurrency(
                              clientAnalytics.topClientsByRevenue[0]?.revenue ||
                                0,
                            )}
                          </p>
                        </div>
                      )}
                      {clientAnalytics.topClientsByOrders.length > 0 && (
                        <div className="p-3 sm:p-4 bg-background rounded-lg border w-full">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                            <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 flex-shrink-0" />
                            <span className="text-xs sm:text-sm font-medium text-muted-foreground break-words">
                              Most Active Client
                            </span>
                          </div>
                          <p className="font-bold text-sm sm:text-base md:text-lg truncate break-words">
                            {clientAnalytics.topClientsByOrders[0]?.name}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground break-words mt-1">
                            {clientAnalytics.topClientsByOrders[0]?.billCount}{" "}
                            orders
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Financial Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full max-w-full">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 w-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                    <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400 truncate pr-2">
                      Pending Collection
                    </CardTitle>
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-blue-500 flex-shrink-0" />
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    <div className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 break-words">
                      {formatCurrency(stats.pendingCollection)}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                      <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0" />
                      <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground break-words">
                        Unpaid receivables
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 w-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                    <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium text-emerald-600 dark:text-emerald-400 truncate pr-2">
                      Total Sales (Gross)
                    </CardTitle>
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-emerald-500 flex-shrink-0" />
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    <div className="text-base sm:text-base font-bold text-emerald-600 dark:text-emerald-400 break-words">
                      {formatCurrency(stats.totalGrossSales)}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                      <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500 flex-shrink-0" />
                      <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground break-words">
                        {stats.totalSaleReturnValue > 0
                          ? `Net: ${formatCurrency(stats.totalRevenue + stats.pendingAmount)} (after ${formatCurrency(stats.totalSaleReturnValue)} returns)`
                          : `Collected: ${formatCurrency(stats.totalRevenue)}`}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20 w-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                    <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium text-red-600 dark:text-red-400 truncate pr-2">
                      Total Discount
                    </CardTitle>
                    <Percent className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-red-500 flex-shrink-0" />
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    <div className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 break-words">
                      {formatCurrency(stats.totalDiscount)}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                      <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
                      <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground break-words">
                        Total discount given
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {stats.gstCollected > 0 && (
                  <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20 w-full">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                      <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate pr-2">
                        GST Collected
                      </CardTitle>
                      <Percent className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-indigo-500 flex-shrink-0" />
                    </CardHeader>
                    <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                      <div className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400 break-words">
                        {formatCurrency(stats.gstCollected)}
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                        <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-500 flex-shrink-0" />
                        <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground break-words">
                          CGST + SGST on GST bills
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20 w-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                    <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium text-orange-600 dark:text-orange-400 truncate pr-2">
                      Total Purchases
                    </CardTitle>
                    <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-orange-500 flex-shrink-0" />
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    <div className="text-base sm:text-lg font-bold text-orange-600 dark:text-orange-400 break-words">
                      {formatCurrency(stats.totalPurchases)}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                      <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500 flex-shrink-0" />
                      <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">
                        {stats.totalPurchaseBills} bills
                        {stats.totalPurchaseReturnValue > 0
                          ? ` • Returns: ${formatCurrency(stats.totalPurchaseReturnValue)}`
                          : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={`bg-gradient-to-br w-full ${stats.grossProfit >= 0 ? "from-blue-500/10 to-blue-600/5 border-blue-500/20" : "from-red-500/10 to-red-600/5 border-red-500/20"}`}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                    <CardTitle
                      className={`text-[10px] sm:text-xs md:text-sm font-medium truncate pr-2 ${stats.grossProfit >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}
                    >
                      {stats.grossProfit >= 0 ? "Gross Profit" : "Gross Loss"}
                    </CardTitle>
                    {stats.grossProfit >= 0 ? (
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-blue-500 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-red-500 flex-shrink-0" />
                    )}
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    <div
                      className={`text-base sm:text-lg font-bold ${stats.grossProfit >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"} break-words`}
                    >
                      {stats.grossProfit >= 0 ? "" : "-"}
                      {formatCurrency(Math.abs(stats.grossProfit))}
                    </div>
                    <div className="flex flex-col gap-1 mt-1.5 sm:mt-2">
                      <span className="text-[10px] sm:text-xs text-muted-foreground break-words">
                        Revenue + pending collection - COGS (excl. expenses)
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={`bg-gradient-to-br w-full ${stats.expectedProfit >= 0 ? "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20" : "from-rose-500/10 to-rose-600/5 border-rose-500/20"}`}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                    <CardTitle
                      className={`text-[10px] sm:text-xs md:text-sm font-medium truncate pr-2 ${stats.expectedProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                    >
                      Expected Profit
                    </CardTitle>
                    <Target
                      className={`h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 flex-shrink-0 ${stats.expectedProfit >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                    />
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    <div
                      className={`text-base sm:text-lg font-bold break-words ${stats.expectedProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                    >
                      {stats.expectedProfit >= 0 ? "" : "-"}
                      {formatCurrency(Math.abs(stats.expectedProfit))}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                      <Calculator className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground break-words">
                        Net billed profit after costs, expenses, and losses
                      </span>
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* Inventory & Returns Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 w-full max-w-full">
                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 shadow-md w-full">
                  <CardContent className="pt-4 sm:pt-5 md:pt-6 px-3 sm:px-4 md:px-6 pb-4 sm:pb-5 md:pb-6">
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium text-purple-600 dark:text-purple-400 break-words">
                          Current Inventory Value
                        </p>
                        <p className="text-base sm:text-lg font-bold text-purple-600 dark:text-purple-400 break-words mt-1">
                          {formatCurrency(stats.inventoryValue)}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 break-words">
                          {stats.totalProducts} products in stock
                        </p>
                      </div>
                      <Package className="h-8 w-8 sm:h-10 sm:w-10 text-purple-500/30 flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20 shadow-md w-full">
                  <CardContent className="pt-4 sm:pt-5 md:pt-6 px-3 sm:px-4 md:px-6 pb-4 sm:pb-5 md:pb-6">
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium text-orange-600 dark:text-orange-400 break-words">
                          Sale Returns
                        </p>
                        <p className="text-base sm:text-lg font-bold text-orange-600 dark:text-orange-400 break-words mt-1">
                          {formatCurrency(stats.totalSaleReturnValue)}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 break-words">
                          {stats.totalReturns > 0
                            ? `${stats.totalReturns} sale returns`
                            : "No sale returns"}
                          {stats.totalPurchaseReturnValue > 0
                            ? ` • Purchase returns: ${formatCurrency(stats.totalPurchaseReturnValue)}`
                            : ""}
                        </p>
                      </div>
                      <RotateCcw className="h-8 w-8 sm:h-10 sm:w-10 text-orange-500/30 flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20 shadow-md w-full sm:col-span-2 md:col-span-1">
                  <CardContent className="pt-4 sm:pt-5 md:pt-6 px-3 sm:px-4 md:px-6 pb-4 sm:pb-5 md:pb-6">
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400 break-words">
                          Deadstock Loss
                        </p>
                        <p className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 break-words mt-1">
                          {formatCurrency(stats.deadstockLoss)}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 break-words">
                          Loss from damaged/defective items
                        </p>
                      </div>
                      <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 text-red-500/30 flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Pending Payments Summary */}
              {(stats.pendingAmount > 0 || stats.pendingPurchases > 0) && (
                <Card className="border-warning/30 bg-warning/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-warning">
                      <AlertCircle className="h-5 w-5" />
                      Pending Payments Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {stats.pendingAmount > 0 && (
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Receivable (from clients)
                            </p>
                            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(stats.pendingAmount)}
                            </p>
                          </div>
                          <ArrowUpRight className="h-8 w-8 text-emerald-500/30" />
                        </div>
                      )}
                      {stats.pendingPurchases > 0 && (
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Payable (to parties)
                            </p>
                            <p className="text-base font-bold text-rose-600 dark:text-rose-400">
                              {formatCurrency(stats.pendingPurchases)}
                            </p>
                          </div>
                          <ArrowDownRight className="h-8 w-8 text-rose-500/30" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Analytics / Charts */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4 w-full max-w-full">
                <Card className="xl:col-span-2 w-full max-w-full overflow-hidden">
                  <CardHeader className="pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                    <CardTitle className="text-sm sm:text-base md:text-lg break-words">
                      Revenue vs Purchase Spend (
                      {granularity === "month"
                        ? "Monthly"
                        : granularity === "week"
                          ? "Weekly"
                          : "Daily"}
                      )
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-3 md:px-4 lg:px-6 pb-3 sm:pb-4 md:pb-6 w-full max-w-full overflow-x-auto">
                    {chartData.monthlySpendVsSales.length === 0 ? (
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        No data yet
                      </p>
                    ) : (
                      <div className="w-full min-w-[300px] min-h-[220px] aspect-[16/7]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData.monthlySpendVsSales}>
                            <XAxis
                              dataKey="period"
                              tick={{ fontSize: 10 }}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis
                              tickFormatter={(v) =>
                                formatCurrency(v).replace("₹", "₹ ")
                              }
                              tick={{ fontSize: 10 }}
                              width={60}
                            />
                            <Tooltip
                              formatter={(v: number) => formatCurrency(v)}
                            />
                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                            <Bar
                              dataKey="sales"
                              name="Sales"
                              fill="#10b981"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="purchases"
                              name="Purchases"
                              fill="#f97316"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="w-full max-w-full overflow-hidden">
                  <CardHeader className="pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                    <CardTitle className="text-sm sm:text-base md:text-lg break-words">
                      Payment Status (Amount)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-3 md:px-4 lg:px-6 pb-3 sm:pb-4 md:pb-6 w-full max-w-full">
                    {chartData.paymentBreakdown.length === 0 ? (
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        No data yet
                      </p>
                    ) : (
                      <div className="w-full min-h-[220px] aspect-[16/7]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData.paymentBreakdown}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={60}
                              label={(entry) =>
                                `${entry.name}: ${formatCurrency(entry.value)}`
                              }
                            >
                              {chartData.paymentBreakdown.map((_, index) => (
                                <Cell
                                  key={index}
                                  fill={
                                    ["#10b981", "#f59e0b", "#ef4444"][index % 3]
                                  }
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v: number) => formatCurrency(v)}
                            />
                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="xl:col-span-3 w-full max-w-full overflow-hidden">
                  <CardHeader className="pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                    <CardTitle className="text-sm sm:text-base md:text-lg break-words">
                      Profit Trend (
                      {granularity === "month"
                        ? "Monthly"
                        : granularity === "week"
                          ? "Weekly"
                          : "Daily"}
                      )
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-3 md:px-4 lg:px-6 pb-3 sm:pb-4 md:pb-6 w-full max-w-full overflow-x-auto">
                    {chartData.monthlyProfit.length === 0 ? (
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        No data yet
                      </p>
                    ) : (
                      <div className="w-full min-w-[300px] min-h-[220px] aspect-[16/7]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData.monthlyProfit}>
                            <XAxis
                              dataKey="period"
                              tick={{ fontSize: 10 }}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis
                              tickFormatter={(v) =>
                                formatCurrency(v).replace("₹", "₹ ")
                              }
                              tick={{ fontSize: 10 }}
                              width={60}
                            />
                            <Tooltip
                              formatter={(v: number) => formatCurrency(v)}
                            />
                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                            <Line
                              type="monotone"
                              dataKey="profit"
                              name="Profit"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-full">
                <Card className="hover:shadow-md transition-shadow w-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                    <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium truncate pr-1">
                      Total Bills
                    </CardTitle>
                    <div className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-blue-600" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    <div className="text-base sm:text-lg font-bold break-words">
                      {stats.totalBills}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 break-words">
                      Sales invoices
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow w-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                    <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium truncate pr-1">
                      Pending Payments
                    </CardTitle>
                    <div className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-amber-600" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    <div className="text-base sm:text-lg font-bold text-amber-600 break-words">
                      {formatCurrency(stats.pendingAmount)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 break-words">
                      {stats.overdueBills} overdue bills
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow w-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                    <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium truncate pr-1">
                      Products
                    </CardTitle>
                    <div className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-purple-600" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    <div className="text-base sm:text-lg font-bold break-words">
                      {stats.totalProducts}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 break-words">
                      In inventory
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow w-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
                    <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium truncate pr-1">
                      Clients
                    </CardTitle>
                    <div className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-green-600" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    <div className="text-base sm:text-lg font-bold break-words">
                      {stats.totalClients}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 break-words">
                      Total customers
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Product Performance Analysis */}
              <div className="space-y-3 sm:space-y-4 w-full max-w-full">
                <Card className="border-2 shadow-lg w-full max-w-full overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-3 sm:pb-4">
                    <CardTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                      <Package className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-emerald-600 flex-shrink-0" />
                      Product Performance Analysis
                    </CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
                      Comprehensive insights into your product sales,
                      profitability, and returns
                    </p>
                  </CardHeader>
                  <CardContent className="pt-3 sm:pt-4 md:pt-6 space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6 w-full max-w-full overflow-x-hidden">
                    <div>
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                        <Award className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 flex-shrink-0" />
                        <h3 className="text-xs sm:text-sm font-semibold break-words">
                          Top Products by Revenue
                        </h3>
                      </div>
                      {productAnalytics.topProductsByRevenue.length === 0 ? (
                        <p className="text-xs sm:text-sm text-muted-foreground text-center py-3 sm:py-4">
                          No product sales data available
                        </p>
                      ) : (
                        <div className="space-y-2 w-full">
                          {productAnalytics.topProductsByRevenue
                            .slice(0, 5)
                            .map((product, index) => (
                              <div
                                key={product.productId}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors w-full"
                              >
                                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0 w-full sm:w-auto">
                                  <div
                                    className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 ${
                                      index === 0
                                        ? "bg-yellow-500 text-white"
                                        : index === 1
                                          ? "bg-gray-400 text-white"
                                          : index === 2
                                            ? "bg-amber-600 text-white"
                                            : "bg-muted text-foreground"
                                    }`}
                                  >
                                    {index + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-xs sm:text-sm truncate break-words">
                                      {product.name}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                                      <span>
                                        Qty: {product.quantity.toFixed(2)}
                                      </span>
                                      <span
                                        className={`${product.margin >= 0 ? "text-emerald-600" : "text-red-600"}`}
                                      >
                                        Margin: {product.margin.toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-left sm:text-right w-full sm:w-auto">
                                  <p className="font-bold text-xs sm:text-sm md:text-base text-emerald-600 break-words">
                                    {formatCurrency(product.revenue)}
                                  </p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground break-words">
                                    Profit: {formatCurrency(product.profit)}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                        <TrendingUpIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                        <h3 className="text-xs sm:text-sm font-semibold break-words">
                          Top Products by Profit Margin
                        </h3>
                      </div>
                      {productAnalytics.topProductsByProfit.length === 0 ? (
                        <p className="text-xs sm:text-sm text-muted-foreground text-center py-3 sm:py-4">
                          No profit data available
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full">
                          {productAnalytics.topProductsByProfit
                            .slice(0, 6)
                            .map((product) => (
                              <div
                                key={product.productId}
                                className="p-2.5 sm:p-3 border rounded-lg hover:bg-accent/50 transition-colors w-full"
                              >
                                <div className="flex items-start justify-between mb-2 gap-2">
                                  <p className="font-semibold text-xs sm:text-sm flex-1 truncate break-words">
                                    {product.name}
                                  </p>
                                  <Badge
                                    variant={
                                      product.margin >= 30
                                        ? "default"
                                        : product.margin >= 15
                                          ? "secondary"
                                          : "outline"
                                    }
                                    className="text-[10px] sm:text-xs flex-shrink-0"
                                  >
                                    {product.margin.toFixed(1)}%
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
                                  <div>
                                    <span className="text-muted-foreground break-words">
                                      Revenue:
                                    </span>
                                    <p className="font-medium break-words">
                                      {formatCurrency(product.revenue)}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground break-words">
                                      Profit:
                                    </span>
                                    <p
                                      className={`font-medium break-words ${product.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}
                                    >
                                      {formatCurrency(product.profit)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {productAnalytics.mostReturnedProducts.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0" />
                          <h3 className="text-xs sm:text-sm font-semibold break-words">
                            Products with Most Returns
                          </h3>
                        </div>
                        <div className="space-y-2 w-full">
                          {productAnalytics.mostReturnedProducts
                            .slice(0, 5)
                            .map((product) => (
                              <div
                                key={product.productId}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 border border-red-200 bg-red-50/50 dark:bg-red-950/20 rounded-lg w-full"
                              >
                                <div className="flex-1 min-w-0 w-full sm:w-auto">
                                  <p className="font-semibold text-xs sm:text-sm truncate break-words">
                                    {product.name}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                                    <span>
                                      Returned:{" "}
                                      {product.returnQuantity.toFixed(2)} units
                                    </span>
                                    <span>
                                      Total Sold: {product.totalSold.toFixed(2)}{" "}
                                      units
                                    </span>
                                    <span className="text-red-600 font-medium">
                                      Return Rate:{" "}
                                      {product.returnRate.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="text-left sm:text-right w-full sm:w-auto">
                                  <p className="font-bold text-xs sm:text-sm md:text-base text-red-600 break-words">
                                    {formatCurrency(product.returnValue)}
                                  </p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground break-words">
                                    Loss Value
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {productAnalytics.topProductsByRevenue.length > 0 && (
                      <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6 w-full max-w-full">
                        <div>
                          <h3 className="text-xs sm:text-sm font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2 break-words">
                            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                            Top 5 Products Revenue & Profit Comparison
                          </h3>
                          <Card className="w-full max-w-full overflow-hidden">
                            <CardContent className="pt-3 sm:pt-4 md:pt-6 px-2 sm:px-3 md:px-6 pb-3 sm:pb-4 md:pb-6 w-full max-w-full overflow-x-auto">
                              <div className="w-full min-w-[300px] min-h-[240px] aspect-[16/8]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart
                                    data={productAnalytics.topProductsByRevenue.slice(
                                      0,
                                      5,
                                    )}
                                  >
                                    <XAxis
                                      dataKey="name"
                                      tick={{ fontSize: 10 }}
                                      angle={-45}
                                      textAnchor="end"
                                      height={80}
                                    />
                                    <YAxis
                                      tickFormatter={(v) =>
                                        formatCurrency(v).replace("₹", "₹ ")
                                      }
                                      tick={{ fontSize: 10 }}
                                      width={60}
                                    />
                                    <Tooltip
                                      formatter={(v: number) =>
                                        formatCurrency(v)
                                      }
                                    />
                                    <Legend
                                      wrapperStyle={{ fontSize: "12px" }}
                                    />
                                    <Bar
                                      dataKey="revenue"
                                      name="Revenue"
                                      fill="#10b981"
                                      radius={[4, 4, 0, 0]}
                                    />
                                    <Bar
                                      dataKey="profit"
                                      name="Profit"
                                      fill="#3b82f6"
                                      radius={[4, 4, 0, 0]}
                                    />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {productAnalytics.topProductsByQuantity.length > 0 && (
                          <div>
                            <h3 className="text-xs sm:text-sm font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2 break-words">
                              <Activity className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                              Top 5 Products by Quantity Sold
                            </h3>
                            <Card className="w-full max-w-full overflow-hidden">
                              <CardContent className="pt-3 sm:pt-4 md:pt-6 px-2 sm:px-3 md:px-6 pb-3 sm:pb-4 md:pb-6 w-full max-w-full overflow-x-auto">
                                <div className="w-full min-w-[300px] min-h-[240px] aspect-[16/8]">
                                  <ResponsiveContainer
                                    width="100%"
                                    height="100%"
                                  >
                                    <BarChart
                                      data={productAnalytics.topProductsByQuantity.slice(
                                        0,
                                        5,
                                      )}
                                    >
                                      <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 10 }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                      />
                                      <YAxis
                                        tick={{ fontSize: 10 }}
                                        width={60}
                                      />
                                      <Tooltip />
                                      <Legend
                                        wrapperStyle={{ fontSize: "12px" }}
                                      />
                                      <Bar
                                        dataKey="quantity"
                                        name="Quantity Sold"
                                        fill="#8b5cf6"
                                        radius={[4, 4, 0, 0]}
                                      />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Client Performance Analysis */}
                <Card className="border-2 shadow-lg w-full max-w-full overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-b px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-3 sm:pb-4">
                    <CardTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                      <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-600 flex-shrink-0" />
                      Client Performance Analysis
                    </CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
                      Track your best clients, order patterns, and payment
                      behavior
                    </p>
                  </CardHeader>
                  <CardContent className="pt-3 sm:pt-4 md:pt-6 space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6 w-full max-w-full overflow-x-hidden">
                    <div>
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                        <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 flex-shrink-0" />
                        <h3 className="text-xs sm:text-sm font-semibold break-words">
                          Top Clients by Revenue
                        </h3>
                      </div>
                      {clientAnalytics.topClientsByRevenue.length === 0 ? (
                        <p className="text-xs sm:text-sm text-muted-foreground text-center py-3 sm:py-4">
                          No client sales data available
                        </p>
                      ) : (
                        <div className="space-y-2 w-full">
                          {clientAnalytics.topClientsByRevenue
                            .slice(0, 5)
                            .map((client, index) => (
                              <div
                                key={client.clientId}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors w-full"
                              >
                                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0 w-full sm:w-auto">
                                  <div
                                    className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 ${
                                      index === 0
                                        ? "bg-yellow-500 text-white"
                                        : index === 1
                                          ? "bg-gray-400 text-white"
                                          : index === 2
                                            ? "bg-amber-600 text-white"
                                            : "bg-muted text-foreground"
                                    }`}
                                  >
                                    {index === 0
                                      ? "🥇"
                                      : index === 1
                                        ? "🥈"
                                        : index === 2
                                          ? "🥉"
                                          : index + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-xs sm:text-sm truncate break-words">
                                      {client.name}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                                      <span>
                                        {client.billCount}{" "}
                                        {client.billCount === 1
                                          ? "order"
                                          : "orders"}
                                      </span>
                                      <span>
                                        Avg:{" "}
                                        {formatCurrency(client.avgBillValue)}
                                      </span>
                                      {client.pendingAmount > 0 && (
                                        <span className="text-amber-600">
                                          Pending:{" "}
                                          {formatCurrency(client.pendingAmount)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-left sm:text-right w-full sm:w-auto">
                                  <p className="font-bold text-xs sm:text-sm md:text-base text-blue-600 break-words">
                                    {formatCurrency(client.revenue)}
                                  </p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground break-words">
                                    Total Revenue
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                        <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 flex-shrink-0" />
                        <h3 className="text-xs sm:text-sm font-semibold break-words">
                          Most Active Clients (By Orders)
                        </h3>
                      </div>
                      {clientAnalytics.topClientsByOrders.length === 0 ? (
                        <p className="text-xs sm:text-sm text-muted-foreground text-center py-3 sm:py-4">
                          No order data available
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full">
                          {clientAnalytics.topClientsByOrders
                            .slice(0, 6)
                            .map((client) => (
                              <div
                                key={client.clientId}
                                className="p-2.5 sm:p-3 border rounded-lg hover:bg-accent/50 transition-colors w-full"
                              >
                                <div className="flex items-start justify-between mb-2 gap-2">
                                  <p className="font-semibold text-xs sm:text-sm flex-1 truncate break-words">
                                    {client.name}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] sm:text-xs flex-shrink-0"
                                  >
                                    {client.billCount} orders
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
                                  <div>
                                    <span className="text-muted-foreground break-words">
                                      Revenue:
                                    </span>
                                    <p className="font-medium break-words">
                                      {formatCurrency(client.revenue)}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground break-words">
                                      Avg Bill:
                                    </span>
                                    <p className="font-medium break-words">
                                      {formatCurrency(client.avgBillValue)}
                                    </p>
                                  </div>
                                </div>
                                {client.pendingAmount > 0 && (
                                  <div className="mt-2 pt-2 border-t">
                                    <span className="text-[10px] sm:text-xs text-amber-600 break-words">
                                      Pending:{" "}
                                      {formatCurrency(client.pendingAmount)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {clientAnalytics.clientReturnStats.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                          <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 flex-shrink-0" />
                          <h3 className="text-xs sm:text-sm font-semibold break-words">
                            Clients with Returns
                          </h3>
                        </div>
                        <div className="space-y-2 w-full">
                          {clientAnalytics.clientReturnStats
                            .slice(0, 5)
                            .map((client) => (
                              <div
                                key={client.clientId}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 border border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 rounded-lg w-full"
                              >
                                <div className="flex-1 min-w-0 w-full sm:w-auto">
                                  <p className="font-semibold text-xs sm:text-sm truncate break-words">
                                    {client.name}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                                    <span>
                                      {client.returnCount}{" "}
                                      {client.returnCount === 1
                                        ? "return"
                                        : "returns"}
                                    </span>
                                    <span className="text-orange-600 font-medium">
                                      Return Rate:{" "}
                                      {client.returnRate.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="text-left sm:text-right w-full sm:w-auto">
                                  <p className="font-bold text-xs sm:text-sm md:text-base text-orange-600 break-words">
                                    {formatCurrency(client.returnValue)}
                                  </p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground break-words">
                                    Return Value
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {clientAnalytics.topClientsByRevenue.length > 0 && (
                      <div className="mt-4 sm:mt-6">
                        <h3 className="text-xs sm:text-sm font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2 break-words">
                          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                          Top 5 Clients Revenue Comparison
                        </h3>
                        <Card className="w-full max-w-full overflow-hidden">
                          <CardContent className="pt-3 sm:pt-4 md:pt-6 px-2 sm:px-3 md:px-6 pb-3 sm:pb-4 md:pb-6 w-full max-w-full overflow-x-auto">
                            <div className="w-full min-w-[300px] min-h-[240px] aspect-[16/8]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={clientAnalytics.topClientsByRevenue.slice(
                                    0,
                                    5,
                                  )}
                                >
                                  <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10 }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                  />
                                  <YAxis
                                    tickFormatter={(v) =>
                                      formatCurrency(v).replace("₹", "₹ ")
                                    }
                                    tick={{ fontSize: 10 }}
                                    width={60}
                                  />
                                  <Tooltip
                                    formatter={(v: number) => formatCurrency(v)}
                                  />
                                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                                  <Bar
                                    dataKey="revenue"
                                    name="Total Revenue"
                                    fill="#3b82f6"
                                    radius={[4, 4, 0, 0]}
                                  />
                                  <Bar
                                    dataKey="avgBillValue"
                                    name="Avg Bill Value"
                                    fill="#8b5cf6"
                                    radius={[4, 4, 0, 0]}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6 w-full max-w-full">
                <Card className="w-full max-w-full overflow-hidden">
                  <CardHeader className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-3 sm:pb-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
                      <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base md:text-lg">
                        <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 flex-shrink-0" />
                        Recent Sales
                      </CardTitle>
                      <Link to="/bills" className="w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto text-xs sm:text-sm touch-manipulation"
                        >
                          View All
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    {bills.length === 0 ? (
                      <div className="text-center py-6 sm:py-8 text-muted-foreground">
                        <FileText className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
                        <p className="text-xs sm:text-sm break-words">
                          No sales bills yet
                        </p>
                        <Link to="/bills/new">
                          <Button
                            className="mt-2 sm:mt-3 text-xs sm:text-sm touch-manipulation"
                            size="sm"
                          >
                            Create Bill
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        {bills.map((bill) => (
                          <div
                            key={bill.id}
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors w-full"
                          >
                            <div className="flex-1 min-w-0 w-full sm:w-auto">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-xs sm:text-sm break-words">
                                  {bill.billNumber}
                                </span>
                                {getStatusBadge(bill.paymentStatus)}
                              </div>
                              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 break-words">
                                {bill.client?.name ?? ""} • {formatDate(bill.date)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                              <p className="font-semibold text-xs sm:text-sm md:text-base text-emerald-600 dark:text-emerald-400 break-words">
                                {formatCurrency(bill.total)}
                              </p>
                              <Link to={`/bills/${bill.id}`}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 sm:h-8 sm:w-8 touch-manipulation"
                                >
                                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="w-full max-w-full overflow-hidden">
                  <CardHeader className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-3 sm:pb-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
                      <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base md:text-lg">
                        <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 flex-shrink-0" />
                        Recent Purchases
                      </CardTitle>
                      <Link to="/purchases" className="w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto text-xs sm:text-sm touch-manipulation"
                        >
                          View All
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                    {purchaseBills.length === 0 ? (
                      <div className="text-center py-6 sm:py-8 text-muted-foreground">
                        <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
                        <p className="text-xs sm:text-sm break-words">
                          No purchase bills yet
                        </p>
                        <Link to="/purchases">
                          <Button
                            className="mt-2 sm:mt-3 text-xs sm:text-sm touch-manipulation"
                            size="sm"
                          >
                            Upload Bill
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        {purchaseBills.map((bill) => (
                          <div
                            key={bill.id}
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors w-full"
                          >
                            <div className="flex-1 min-w-0 w-full sm:w-auto">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-xs sm:text-sm truncate break-words">
                                  {bill.vendorName}
                                </span>
                                <Badge
                                  variant={
                                    bill.paymentStatus === "paid"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-[10px] sm:text-xs"
                                >
                                  {bill.paymentStatus}
                                </Badge>
                              </div>
                              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 break-words">
                                {bill.billNumber
                                  ? `#${bill.billNumber}`
                                  : "No bill no."}{" "}
                                • {formatDate(bill.billDate || bill.createdAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
                              <p className="font-semibold text-xs sm:text-sm md:text-base text-orange-600 dark:text-orange-400 break-words">
                                {formatCurrency(bill.total)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Period Analysis */}
              {chartData.monthlySpendVsSales.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Detailed{" "}
                      {granularity === "month"
                        ? "Monthly"
                        : granularity === "week"
                          ? "Weekly"
                          : "Daily"}{" "}
                      Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-3 md:px-4 lg:px-6 pb-3 sm:pb-4 md:pb-6 overflow-x-hidden w-full max-w-full">
                    <div
                      className="overflow-x-auto -mx-2 sm:-mx-3 md:mx-0 allow-horizontal-scroll w-full"
                      style={{ overscrollBehaviorX: "contain" }}
                    >
                      <table className="min-w-full text-[10px] sm:text-xs md:text-sm border border-border rounded-md overflow-hidden w-full">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left px-2 sm:px-2 md:px-3 py-1.5 sm:py-2 border-b border-border">
                              Period
                            </th>
                            <th className="text-right px-2 sm:px-2 md:px-3 py-1.5 sm:py-2 border-b border-border whitespace-nowrap">
                              Sales
                            </th>
                            <th className="text-right px-2 sm:px-2 md:px-3 py-1.5 sm:py-2 border-b border-border whitespace-nowrap">
                              Purchases
                            </th>
                            <th className="text-right px-2 sm:px-2 md:px-3 py-1.5 sm:py-2 border-b border-border whitespace-nowrap">
                              Profit
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {chartData.monthlySpendVsSales.map((row) => {
                            const profitRow = chartData.monthlyProfit.find(
                              (p) => p.period === row.period,
                            );
                            const profitVal = profitRow?.profit ?? 0;
                            return (
                              <tr
                                key={row.period}
                                className="odd:bg-background even:bg-muted/40"
                              >
                                <td className="px-2 sm:px-2 md:px-3 py-1 sm:py-1.5 border-b border-border break-words">
                                  {row.period}
                                </td>
                                <td className="px-2 sm:px-2 md:px-3 py-1 sm:py-1.5 border-b border-border text-right whitespace-nowrap">
                                  {formatCurrency(row.sales)}
                                </td>
                                <td className="px-2 sm:px-2 md:px-3 py-1 sm:py-1.5 border-b border-border text-right whitespace-nowrap">
                                  {formatCurrency(row.purchases)}
                                </td>
                                <td
                                  className={`px-2 sm:px-2 md:px-3 py-1 sm:py-1.5 border-b border-border text-right whitespace-nowrap ${profitVal >= 0 ? "text-emerald-600" : "text-red-600"}`}
                                >
                                  {profitVal >= 0 ? "" : "-"}
                                  {formatCurrency(Math.abs(profitVal))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground mt-2 break-words">
                      Periods are grouped by your selection above (year, month,
                      and view-by: month/week/day).
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Business Summary (Current Filter)</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs md:text-sm">
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Revenue vs Costs (
                      {granularity === "month"
                        ? "Monthly"
                        : granularity === "week"
                          ? "Weekly"
                          : "Daily"}
                      )
                    </p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Revenue
                      </span>
                      <span className="font-medium">
                        {formatCurrency(stats.totalRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">COGS</span>
                      <span className="font-medium">
                        {formatCurrency(stats.totalCOGS)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Expenses + Losses
                      </span>
                      <span className="font-medium">
                        {formatCurrency(
                          stats.totalExpenses + stats.deadstockLoss,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Courier</span>
                      <span className="font-medium">
                        {formatCurrency(stats.totalPurchaseCourier)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Extra Expense</span>
                      <span className="font-medium">
                        {formatCurrency(stats.totalPurchaseExtraExpense)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold">Payment Status (Amount)</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid</span>
                      <span className="font-medium text-emerald-600">
                        {formatCurrency(stats.totalCollected)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="font-medium text-amber-600">
                        {formatCurrency(stats.pendingSubtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Overdue</span>
                      <span className="font-medium text-red-600">
                        {formatCurrency(stats.overdueSubtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cash</span>
                      <span className="font-medium">
                        {formatCurrency(stats.totalCashCollected)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bank</span>
                      <span className="font-medium">
                        {formatCurrency(stats.totalBankCollected)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sale Courier</span>
                      <span className="font-medium">
                        {formatCurrency(stats.totalSaleCourier)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Cash Paid</span>
                      <span className="font-medium">
                        {formatCurrency(stats.totalPurchaseCashPaid)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Bank/UPI Paid</span>
                      <span className="font-medium">
                        {formatCurrency(stats.totalPurchaseBankPaid)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold">Profit Overview</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net Profit</span>
                      <span
                        className={`font-medium ${stats.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {stats.profit >= 0 ? "" : "-"}
                        {formatCurrency(Math.abs(stats.profit))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Deadstock Loss
                      </span>
                      <span className="font-medium text-red-600">
                        {formatCurrency(stats.deadstockLoss)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Bills / Purchases
                      </span>
                      <span className="font-medium">
                        {stats.totalBills} sales • {stats.totalPurchaseBills}{" "}
                        purchases
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Due Bills Section */}
              {(() => {
                const dueBills = billsInRange.filter(
                  (b) => getRenderBillFinancials(b).pending > 0,
                );
                const sortedDueBills = dueBills.sort((a, b) => {
                  const aOverdue = getRenderBillFinancials(a).isOverdue;
                  const bOverdue = getRenderBillFinancials(b).isOverdue;
                  if (aOverdue && !bOverdue) return -1;
                  if (!aOverdue && bOverdue) return 1;
                  return (
                    new Date(a.dueDate).getTime() -
                    new Date(b.dueDate).getTime()
                  );
                });

                return sortedDueBills.length > 0 ? (
                  <Card className="border-2 shadow-lg border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          Due Bills ({sortedDueBills.length})
                        </CardTitle>
                        <Link to="/bills">
                          <Button variant="outline" size="sm">
                            View All Bills
                          </Button>
                        </Link>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Bills with pending or overdue payments
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {sortedDueBills.slice(0, 10).map((bill) => {
                          const financials = getRenderBillFinancials(bill);
                          const isOverdue = financials.isOverdue;
                          const pendingAmount = financials.pending;
                          return (
                            <Link
                              key={bill.id}
                              to={`/bills/${bill.id}`}
                              className="block"
                            >
                              <div
                                className={`flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-all ${
                                  isOverdue
                                    ? "border-red-300 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50 dark:hover:bg-red-950/30"
                                    : "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/30"
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="font-semibold text-sm">
                                      {bill.client?.name ?? ""}
                                    </span>
                                    {getStatusBadge(
                                      isOverdue ? "overdue" : "pending",
                                    )}
                                    {isOverdue && (
                                      <Badge
                                        variant="destructive"
                                        className="text-xs"
                                      >
                                        Overdue
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                                    <span className="font-medium">
                                      Bill #{bill.billNumber}
                                    </span>
                                    <span>Due: {formatDate(bill.dueDate)}</span>
                                    {bill.paidAmount > 0 && (
                                      <span>
                                        Paid: {formatCurrency(bill.paidAmount)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 ml-4">
                                  <div className="text-right">
                                    <p
                                      className={`font-bold text-base ${isOverdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}
                                    >
                                      {formatCurrency(pendingAmount)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {isOverdue ? "Overdue" : "Pending"}
                                    </p>
                                  </div>
                                  <Eye className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                      {sortedDueBills.length > 10 && (
                        <div className="mt-4 text-center">
                          <Link to="/bills">
                            <Button variant="outline" size="sm">
                              View All {sortedDueBills.length} Due Bills
                            </Button>
                          </Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null;
              })()}

            </div>
            {/* end space-y-4 content div */}
          </div>
          {/* end flex flex-col gap-1.5 */}
        </CardContent>
      </Card>
    </div>
  );
}
