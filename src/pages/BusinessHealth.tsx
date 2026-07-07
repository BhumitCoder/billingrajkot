import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getBills,
  getProducts,
  getClients,
  getPurchaseBills,
  getDeadstock,
  getBillReturns,
  getExpenses,
  getVendors,
  getCreators,
  getPurchaseReturns,
  getProductTransactions,
  getInventoryUnits,
} from "@/lib/storage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Package,
  Users,
  DollarSign,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ShieldAlert,
  Zap,
  Percent,
  AlertCircle,
  Download,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  ArrowRight,
  Info,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
} from "lucide-react";
import { formatCurrency, roundToTwoDecimals } from "@/lib/billUtils";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  format,
  subDays,
  isWithinInterval,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import {
  PDFDownloadLink,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// Professional PDF Styles
const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: "#3b82f6",
    paddingBottom: 15,
  },
  headerMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#1e293b" },
  dateRange: { fontSize: 10, color: "#64748b", marginTop: 5 },
  section: { marginBottom: 25 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#0f172a",
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
    paddingLeft: 10,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 15 },
  metricCard: {
    width: "22%",
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  metricLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  metricValue: { fontSize: 14, fontWeight: "bold", color: "#0f172a" },
  scoreCard: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  scoreLabel: { fontSize: 11, fontWeight: "bold", color: "#334155" },
  scoreValue: { fontSize: 11, fontWeight: "bold" },
  progressBar: { height: 8, backgroundColor: "#e2e8f0", borderRadius: 4 },
  progressFill: { height: 8, borderRadius: 4 },
  table: { marginTop: 10, width: "100%" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    padding: 8,
    fontWeight: "bold",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  tableRow: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  colName: { flex: 3 },
  colValue: { flex: 1, textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    color: "#94a3b8",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
});

const HealthPDF = ({ data, dateRange }: any) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <View style={pdfStyles.header}>
        <View style={pdfStyles.headerMain}>
          <Text style={pdfStyles.title}>Business Health Report</Text>
          <Text style={{ fontSize: 12, fontWeight: "bold", color: "#3b82f6" }}>
            MAA
          </Text>
        </View>
        <Text style={pdfStyles.dateRange}>
          Analysis Period: {format(new Date(dateRange.start), "PPP")} -{" "}
          {format(new Date(dateRange.end), "PPP")}
        </Text>
      </View>

      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Executive Summary</Text>
        <View style={pdfStyles.grid}>
          <View style={[pdfStyles.metricCard, { borderLeftColor: "#10b981" }]}>
            <Text style={pdfStyles.metricLabel}>Total Sales</Text>
            <Text style={pdfStyles.metricValue}>
              {formatCurrency(data.summary.totalSales)}
            </Text>
          </View>
          <View style={[pdfStyles.metricCard, { borderLeftColor: "#3b82f6" }]}>
            <Text style={pdfStyles.metricLabel}>Total Profit</Text>
            <Text style={pdfStyles.metricValue}>
              {formatCurrency(data.summary.totalProfit)}
            </Text>
          </View>
          <View style={[pdfStyles.metricCard, { borderLeftColor: "#f59e0b" }]}>
            <Text style={pdfStyles.metricLabel}>Expenses</Text>
            <Text style={pdfStyles.metricValue}>
              {formatCurrency(data.summary.totalExpenses)}
            </Text>
          </View>
          <View style={[pdfStyles.metricCard, { borderLeftColor: "#ef4444" }]}>
            <Text style={pdfStyles.metricLabel}>Margin %</Text>
            <Text style={pdfStyles.metricValue}>{data.summary.avgMargin}%</Text>
          </View>
        </View>
      </View>

      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>
          Operational Performance Scores
        </Text>
        {[
          { label: "Cash Flow Stability", value: data.scores.cashFlow },
          {
            label: "Inventory Efficiency",
            value: data.scores.inventoryTurnover,
          },
          { label: "Profitability Health", value: data.scores.profitHealth },
          {
            label: "Credit Risk (Lower is Better)",
            value: 100 - data.scores.creditRisk,
          },
        ].map((score, i) => (
          <View key={i} style={pdfStyles.scoreCard}>
            <View style={pdfStyles.scoreHeader}>
              <Text style={pdfStyles.scoreLabel}>{score.label}</Text>
              <Text
                style={[
                  pdfStyles.scoreValue,
                  {
                    color:
                      score.value > 70
                        ? "#10b981"
                        : score.value > 40
                          ? "#f59e0b"
                          : "#ef4444",
                  },
                ]}
              >
                {roundToTwoDecimals(score.value)}%
              </Text>
            </View>
            <View style={pdfStyles.progressBar}>
              <View
                style={[
                  pdfStyles.progressFill,
                  {
                    width: `${roundToTwoDecimals(score.value)}%`,
                    backgroundColor:
                      score.value > 70
                        ? "#10b981"
                        : score.value > 40
                          ? "#f59e0b"
                          : "#ef4444",
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Financial Summary</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeader}>
            <Text style={pdfStyles.colName}>Description</Text>
            <Text style={pdfStyles.colValue}>Amount</Text>
          </View>
          <View style={pdfStyles.tableRow}>
            <Text style={pdfStyles.colName}>Sales Returns</Text>
            <Text style={pdfStyles.colValue}>
              {formatCurrency(data.summary.totalReturns)}
            </Text>
          </View>
          <View style={pdfStyles.tableRow}>
            <Text style={pdfStyles.colName}>Purchase Returns</Text>
            <Text style={pdfStyles.colValue}>
              {formatCurrency(data.summary.totalPurchaseReturns)}
            </Text>
          </View>
        </View>
      </View>

      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>User Performance</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeader}>
            <Text style={pdfStyles.colName}>User</Text>
            <Text style={pdfStyles.colValue}>Sales</Text>
          </View>
          {data.userAnalysis.map((u: any, i: number) => (
            <View key={i} style={pdfStyles.tableRow}>
              <Text style={pdfStyles.colName}>{u.name}</Text>
              <Text style={pdfStyles.colValue}>{formatCurrency(u.sales)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Top Clients</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeader}>
            <Text style={pdfStyles.colName}>Client</Text>
            <Text style={pdfStyles.colValue}>Total Value</Text>
          </View>
          {data.clientAnalysis.map((c: any, i: number) => (
            <View key={i} style={pdfStyles.tableRow}>
              <Text style={pdfStyles.colName}>{c.name}</Text>
              <Text style={pdfStyles.colValue}>{formatCurrency(c.sales)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Vendor Performance</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeader}>
            <Text style={pdfStyles.colName}>Vendor</Text>
            <Text style={pdfStyles.colValue}>Purchases</Text>
          </View>
          {data.vendorAnalysis.map((v: any, i: number) => (
            <View key={i} style={pdfStyles.tableRow}>
              <Text style={pdfStyles.colName}>{v.name}</Text>
              <Text style={pdfStyles.colValue}>
                {formatCurrency(v.purchases)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Expenses Detail</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeader}>
            <Text style={pdfStyles.colName}>Description</Text>
            <Text style={pdfStyles.colValue}>Amount</Text>
          </View>
          {data.expenses.map((e: any, i: number) => (
            <View key={i} style={pdfStyles.tableRow}>
              <Text style={pdfStyles.colName}>{e.description}</Text>
              <Text style={pdfStyles.colValue}>{formatCurrency(e.amount)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Risk Assessment</Text>
        <View style={{ gap: 8 }}>
          <Text>
            • Dead Stock Impact: {data.deadInventory} items currently inactive.
          </Text>
          <Text>
            • Margin Warnings: {data.lowMarginProds} products selling with
            &lt;10% markup.
          </Text>
          <Text>
            • Return Velocity:{" "}
            {data.tooManyRefunds
              ? "ALARMING - Refund rate exceeds threshold."
              : "Healthy - Return rates within normal parameters."}
          </Text>
          <Text>
            • Overstock Exposure: {data.stockTooHigh} items exceeding inventory
            limits.
          </Text>
        </View>
      </View>

      <Text style={pdfStyles.footer}>
        Generated on {format(new Date(), "PPP")} • Confidential Business
        Analysis
      </Text>
    </Page>
  </Document>
);

export default function BusinessHealth() {
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState<any>(null);
  const [filterMode, setFilterMode] = useState<"all" | "custom">("all");
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });

  const healthData = useMemo(() => {
    if (!rawData) return null;
    const {
      bills,
      products,
      clients,
      returns,
      expenses,
      purchases,
      productTransactionsMap,
      deadstock,
      inventoryUnits,
    } = rawData;

    const inStockByProduct = (inventoryUnits || []).reduce((acc: Record<string, number>, u: any) => {
      if ((u.status === "in_stock" || u.status === "reserved" || u.status === "returned") && u.productId) {
        acc[u.productId] = (acc[u.productId] || 0) + 1;
      }
      return acc;
    }, {});
    const getEffectiveStock = (p: any): number =>
      (p.trackingType || "standard") === "serialized"
        ? (inStockByProduct[p.id] || 0)
        : Math.max(0, p.stock || 0);

    const requestedStart = startOfDay(new Date(dateRange.start));
    const requestedEnd = endOfDay(new Date(dateRange.end));
    const inSelectedRange = (dateValue: string) => {
      if (filterMode === "all") return true;
      return isWithinInterval(new Date(dateValue), {
        start: requestedStart,
        end: requestedEnd,
      });
    };

    const filteredBills = bills.filter((b: any) => inSelectedRange(b.date));
    const filteredReturns = returns.filter((r: any) =>
      inSelectedRange(r.returnDate || r.createdAt),
    );
    const filteredExpenses = expenses.filter(
      (e: any) =>
        inSelectedRange(e.date) && e.sourceType !== "purchase_bill_auto",
    );
    const filteredPurchases = purchases.filter((p: any) =>
      inSelectedRange(p.createdAt || p.billDate || p.id),
    );
    const filteredPurchaseReturns = (rawData.purchaseReturns || []).filter(
      (r: any) => inSelectedRange(r.returnDate || r.createdAt),
    );
    const filteredDeadstock = (deadstock || []).filter((d: any) =>
      inSelectedRange(d.createdAt),
    );

    const allRelevantDates: Date[] = [
      ...filteredBills
        .map((b: any) => (b?.date ? new Date(b.date) : null))
        .filter(
          (d: Date | null): d is Date => !!d && !Number.isNaN(d.getTime()),
        ),
      ...filteredPurchases
        .map((p: any) =>
          p?.createdAt || p?.billDate || p?.id
            ? new Date(p.createdAt || p.billDate || p.id)
            : null,
        )
        .filter(
          (d: Date | null): d is Date => !!d && !Number.isNaN(d.getTime()),
        ),
    ];

    const computedStart =
      filterMode === "all" && allRelevantDates.length > 0
        ? startOfDay(
          new Date(Math.min(...allRelevantDates.map((d) => d.getTime()))),
        )
        : requestedStart;
    const computedEnd =
      filterMode === "all" && allRelevantDates.length > 0
        ? endOfDay(
          new Date(Math.max(...allRelevantDates.map((d) => d.getTime()))),
        )
        : requestedEnd;

    // Granular Analysis: User, Client, Vendor
    const userAnalysis: Record<string, any> = {};
    filteredBills.forEach((b) => {
      const user = b.createdBy || "System";
      if (!userAnalysis[user])
        userAnalysis[user] = { name: user, sales: 0, count: 0 };
      const paymentRatio = (b.paidAmount || 0) / (b.total || 1);
      const recognizedSales = (b.total || 0) * paymentRatio;
      userAnalysis[user].sales += recognizedSales;
      userAnalysis[user].count += 1;
    });

    const clientAnalysis: Record<string, any> = {};
    const clientsById: Record<string, any> = Object.fromEntries(
      (clients || []).map((c: any) => [c.id, c]),
    );
    filteredBills.forEach((b) => {
      const client =
        b.clientName ||
        b.client?.name ||
        clientsById[b.clientId]?.name ||
        "Walk-in Client";
      if (!clientAnalysis[client])
        clientAnalysis[client] = { name: client, sales: 0, count: 0 };
      const paymentRatio = (b.paidAmount || 0) / (b.total || 1);
      const recognizedSales = (b.total || 0) * paymentRatio;
      clientAnalysis[client].sales += recognizedSales;
      clientAnalysis[client].count += 1;
    });

    const vendorAnalysis: Record<string, any> = {};
    filteredPurchases.forEach((p) => {
      const vendor = p.vendorName || "Unknown";
      if (!vendorAnalysis[vendor])
        vendorAnalysis[vendor] = { name: vendor, purchases: 0, count: 0 };
      vendorAnalysis[vendor].purchases += p.total;
      vendorAnalysis[vendor].count += 1;
    });

    const productById = Object.fromEntries(
      products.map((p: any) => [p.id, p]),
    ) as Record<string, any>;
    const purchaseBillOverheadFactorById: Record<string, number> = {};
    (purchases || []).forEach((pb: any) => {
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

    const getHistoricalAverageCost = (
      productId: string,
      saleDate: string,
    ): number => {
      const product = productById[productId];
      if (!product) return 0;

      const transactions = (productTransactionsMap?.[productId] || []) as any[];
      if (!transactions.length) {
        return roundToTwoDecimals(product.purchasePrice || product.price || 0);
      }

      const saleDateTime = new Date(saleDate).getTime();
      let totalPurchaseValue = 0;
      let totalPurchaseQuantity = 0;
      let currentInventory = 0;
      let currentInventoryValue = 0;

      for (const transaction of transactions) {
        const transactionDate = new Date(transaction.date).getTime();
        if (transactionDate >= saleDateTime) continue;

        if (transaction.type === "purchase" && transaction.purchasePrice) {
          const purchaseValue =
            transaction.quantity * getEffectivePurchasePrice(transaction);
          currentInventory += transaction.quantity;
          currentInventoryValue += purchaseValue;
          totalPurchaseValue += purchaseValue;
          totalPurchaseQuantity += transaction.quantity;
          continue;
        }

        if (transaction.type === "sale") {
          if (currentInventory > 0) {
            const avgCost = currentInventoryValue / currentInventory;
            const soldValue = transaction.quantity * avgCost;
            currentInventory -= transaction.quantity;
            currentInventoryValue -= soldValue;
          } else {
            currentInventory = Math.max(
              0,
              currentInventory - transaction.quantity,
            );
          }
          continue;
        }

        if (transaction.type === "return") {
          const returnItem = (rawData.returns || []).find(
            (r: any) =>
              r.id === transaction.billReturnId || r.id === transaction.billId,
          );
          const returnItemData = returnItem?.items?.find(
            (i: any) => i.productId === productId,
          );
          if (returnItemData?.condition !== "good") continue;

          if (currentInventory > 0) {
            const avgCost = currentInventoryValue / currentInventory;
            currentInventory += transaction.quantity;
            currentInventoryValue += transaction.quantity * avgCost;
          } else {
            const lastPurchase = transactions
              .filter(
                (t: any) =>
                  t.type === "purchase" &&
                  t.purchasePrice &&
                  new Date(t.date).getTime() < transactionDate,
              )
              .slice(-1)[0];
            if (lastPurchase?.purchasePrice) {
              currentInventory += transaction.quantity;
              currentInventoryValue +=
                transaction.quantity * getEffectivePurchasePrice(lastPurchase);
            }
          }
        }
      }

      if (currentInventory > 0) {
        return roundToTwoDecimals(currentInventoryValue / currentInventory);
      }
      if (totalPurchaseQuantity > 0) {
        return roundToTwoDecimals(totalPurchaseValue / totalPurchaseQuantity);
      }
      return roundToTwoDecimals(product.purchasePrice || product.price || 0);
    };

    const getStrictSoldItemCost = (item: any) => {
      const explicitItemCost = Number(item.purchasePrice || 0);
      if (explicitItemCost > 0) {
        return roundToTwoDecimals(explicitItemCost);
      }
      const product = productById[item.productId];
      return roundToTwoDecimals(product?.purchasePrice || product?.price || 0);
    };

    // Executive Summary Metrics (single consistent net-profit logic)
    const totalSales = roundToTwoDecimals(
      filteredBills.reduce((s: number, b: any) => {
        const totalAmount = b.total || 1;
        const paymentRatio = (b.paidAmount || 0) / totalAmount;
        const recognizedSales = (b.total || 0) * paymentRatio;
        return s + recognizedSales;
      }, 0),
    );
    const totalExpenses = roundToTwoDecimals(
      filteredExpenses.reduce((s: number, e: any) => s + e.amount, 0),
    );
    const totalReturns = filteredReturns.reduce(
      (s: number, r: any) => s + (r.totalReturnValue || 0),
      0,
    );
    const totalPurchaseReturns = filteredPurchaseReturns.reduce(
      (s: number, r: any) => s + (r.totalReturnValue || 0),
      0,
    );
    // Strict COGS: sold quantity multiplied by stored item purchase price
    let rangeCogs = 0;
    filteredBills.forEach((b: any) => {
      let billCogs = 0;
      b.items.forEach((item: any) => {
        const cost = getStrictSoldItemCost(item);
        billCogs += roundToTwoDecimals(item.quantity * cost);
      });
      rangeCogs += roundToTwoDecimals(billCogs);
    });

    const deadstockLoss = roundToTwoDecimals(
      filteredDeadstock.reduce(
        (sum: number, item: any) =>
          sum +
          (item.expenseTracked
            ? 0
            : Number(item.costPrice || 0) * Number(item.quantity || 0)),
        0,
      ),
    );
    const totalProfit = roundToTwoDecimals(
      totalSales - rangeCogs - totalExpenses - deadstockLoss,
    );
    const avgMargin =
      totalSales > 0 ? roundToTwoDecimals((totalProfit / totalSales) * 100) : 0;

    // Trend Analysis
    const intervalStart =
      computedStart.getTime() <= computedEnd.getTime()
        ? computedStart
        : computedEnd;
    const intervalEnd =
      computedStart.getTime() <= computedEnd.getTime()
        ? computedEnd
        : computedStart;
    const dateInterval = eachDayOfInterval({
      start: intervalStart,
      end: intervalEnd,
    });
    const trendData = dateInterval.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayBills = filteredBills.filter((b: any) => {
        if (!b?.date) return false;
        const billDate = new Date(b.date);
        return !Number.isNaN(billDate.getTime()) && isSameDay(billDate, day);
      });
      const dayPurchases = filteredPurchases.filter((p: any) => {
        const value = p?.createdAt || p?.billDate || p?.id;
        if (!value) return false;
        const purchaseDate = new Date(value);
        return (
          !Number.isNaN(purchaseDate.getTime()) && isSameDay(purchaseDate, day)
        );
      });
      const daySales = roundToTwoDecimals(
        dayBills.reduce((s: number, b: any) => {
          const totalAmount = b.total || 1;
          const paymentRatio = (b.paidAmount || 0) / totalAmount;
          const recognizedSales = (b.total || 0) * paymentRatio;
          return s + recognizedSales;
        }, 0),
      );
      const dayCost = roundToTwoDecimals(
        dayBills.reduce((s: number, b: any) => {
          const billCogs = b.items.reduce((is: number, i: any) => {
            const cost = getStrictSoldItemCost(i);
            return is + i.quantity * cost;
          }, 0);
          return s + billCogs;
        }, 0),
      );
      const dayExpenses = roundToTwoDecimals(
        filteredExpenses
          .filter((e: any) => {
            if (!e?.date) return false;
            const expenseDate = new Date(e.date);
            return (
              !Number.isNaN(expenseDate.getTime()) &&
              isSameDay(expenseDate, day)
            );
          })
          .reduce((s: number, e: any) => s + (e.amount || 0), 0),
      );
      const dayDeadstockLoss = roundToTwoDecimals(
        filteredDeadstock
          .filter((d: any) => {
            if (!d?.createdAt) return false;
            const deadstockDate = new Date(d.createdAt);
            return (
              !Number.isNaN(deadstockDate.getTime()) &&
              isSameDay(deadstockDate, day)
            );
          })
          .reduce(
            (s: number, d: any) => s + (d.costPrice || 0) * (d.quantity || 0),
            0,
          ),
      );
      return {
        date: dayStr,
        sales: daySales,
        profit: roundToTwoDecimals(
          daySales - dayCost - dayExpenses - dayDeadstockLoss,
        ),
        purchases: roundToTwoDecimals(
          dayPurchases.reduce((s: number, p: any) => s + (p.total || 0), 0),
        ),
      };
    });

    // Score Calculations
    const turnover =
      totalSales /
      (products.reduce(
        (s: number, p: any) => s + getEffectiveStock(p) * (p.purchasePrice || 0),
        0,
      ) || 1);
    const creditRisk =
      (filteredBills.filter((b: any) => b.paymentStatus === "overdue").length /
        (filteredBills.length || 1)) *
      100;

    const activeClientsCount = clients.filter(
      (c: any) =>
        c.lastBillDate && new Date(c.lastBillDate) >= subDays(new Date(), 30),
    ).length;
    const ltv = activeClientsCount > 0 ? totalSales / activeClientsCount : 0;

    const categoryProfit: Record<string, number> = {};
    filteredBills.forEach((b: any) => {
      b.items.forEach((item: any) => {
        const prod = products.find((p: any) => p.id === item.productId);
        const cat = prod?.category || "Uncategorized";
        const cost = getHistoricalAverageCost(item.productId, b.date);
        const profit = item.amount - item.quantity * cost;
        categoryProfit[cat] = (categoryProfit[cat] || 0) + profit;
      });
    });

    const categoryData = Object.entries(categoryProfit).map(
      ([name, value]) => ({ name, value }),
    );

    return {
      summary: {
        totalSales,
        totalProfit,
        totalExpenses,
        avgMargin,
        ltv,
        totalReturns,
        totalPurchaseReturns,
        deadstockLoss,
      },
      scores: {
        cashFlow: Math.max(
          0,
          100 -
          (filteredBills.filter((b: any) => b.paymentStatus !== "paid")
            .length /
            (filteredBills.length || 1)) *
          50,
        ),
        inventoryTurnover: Math.min(100, turnover * 15),
        creditRisk: roundToTwoDecimals(creditRisk),
        profitHealth: Math.max(
          0,
          100 - (totalExpenses / (totalSales || 1)) * 100,
        ),
      },
      trendData,
      categoryData,
      userAnalysis: Object.values(userAnalysis).sort(
        (a, b) => b.sales - a.sales,
      ),
      clientAnalysis: Object.values(clientAnalysis)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10),
      vendorAnalysis: Object.values(vendorAnalysis)
        .sort((a, b) => b.purchases - a.purchases)
        .slice(0, 10),
      expenses: filteredExpenses,
      deadInventory: products.filter(
        (p: any) =>
          getEffectiveStock(p) > 0 &&
          !new Set(
            filteredBills.flatMap((b: any) =>
              b.items.map((i: any) => i.productId),
            ),
          ).has(p.id),
      ).length,
      lowMarginProds: products.filter(
        (p: any) => p.price < (p.purchasePrice || 0) * 1.1,
      ).length,
      topCustomer: clients.sort(
        (a: any, b: any) => (b.totalRevenue || 0) - (a.totalRevenue || 0),
      )[0],
      stockTooHigh: products.filter((p: any) => getEffectiveStock(p) > 100).length,
      tooManyRefunds:
        filteredReturns.length / (filteredBills.length || 1) > 0.1,
      customerSegments: [
        { name: "Active", value: activeClientsCount },
        {
          name: "At Risk",
          value: clients.filter(
            (c: any) =>
              c.lastBillDate &&
              new Date(c.lastBillDate) < subDays(new Date(), 30) &&
              new Date(c.lastBillDate) >= subDays(new Date(), 90),
          ).length,
        },
        {
          name: "Churned",
          value: clients.filter(
            (c: any) =>
              !c.lastBillDate ||
              new Date(c.lastBillDate) < subDays(new Date(), 90),
          ).length,
        },
      ],
    };
  }, [rawData, dateRange, filterMode]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [
          bills,
          products,
          clients,
          purchases,
          deadstock,
          returns,
          expenses,
          purchaseReturns,
          inventoryUnits,
        ] = await Promise.all([
          getBills(),
          getProducts(),
          getClients(),
          getPurchaseBills(),
          getDeadstock(),
          getBillReturns(),
          getExpenses(),
          getPurchaseReturns(),
          getInventoryUnits(),
        ]);

        const productTransactionsEntries = await Promise.all(
          products.map(async (product: any) => {
            const transactions = await getProductTransactions(product.id);
            const sorted = (transactions || []).sort(
              (a: any, b: any) =>
                new Date(a.date).getTime() - new Date(b.date).getTime(),
            );
            return [product.id, sorted] as const;
          }),
        );

        const productTransactionsMap = Object.fromEntries(
          productTransactionsEntries,
        );
        setRawData({
          bills,
          products,
          clients,
          purchases,
          deadstock,
          returns,
          expenses,
          purchaseReturns,
          productTransactionsMap,
          inventoryUnits,
        });
      } catch (e) {
        console.error("Failed to load health data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading || !healthData) {
    return (
      <div className="min-h-screen">
        <LoadingSpinner
          size="xl"
          text="Loading healthData data..."
          fullScreen
          contentAreaOnly
        />
      </div>
    );
  }

  const COLORS = ["#10b981", "#f59e0b", "#ef4444"];
  const applyQuickRange = (days: number) => {
    setFilterMode("custom");
    setDateRange({
      start: format(subDays(new Date(), days), "yyyy-MM-dd"),
      end: format(new Date(), "yyyy-MM-dd"),
    });
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className="shrink-0 rounded-2xl border border-border/70 bg-background p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">
                Business Health
              </h1>
              <p className="text-sm text-muted-foreground">
                Enterprise Performance & Risk Analytics
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start lg:w-auto lg:justify-end">
            <div className="flex w-full items-center gap-1 rounded-lg border border-border/70 bg-muted/20 p-1 sm:w-auto">
              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg px-2 sm:flex-none">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => {
                    setFilterMode("custom");
                    setDateRange({ ...dateRange, start: e.target.value });
                  }}
                  className="h-8 w-full min-w-0 border-0 bg-transparent p-0 text-xs focus-visible:ring-0 sm:w-[120px]"
                />
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg px-2 sm:flex-none">
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => {
                    setFilterMode("custom");
                    setDateRange({ ...dateRange, end: e.target.value });
                  }}
                  className="h-8 w-full min-w-0 border-0 bg-transparent p-0 text-xs focus-visible:ring-0 sm:w-[120px]"
                />
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-full items-center gap-2 rounded-lg bg-background sm:w-auto"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Manage ({filterMode === "all" ? "All" : "Date"})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Filter Mode</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setFilterMode("all")}>
                  Show All Data (Default)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Date Presets</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => applyQuickRange(7)}>
                  Apply Last 7 Days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyQuickRange(30)}>
                  Apply Last 30 Days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyQuickRange(90)}>
                  Apply Last 90 Days
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setFilterMode("custom");
                    setDateRange({
                      start: format(
                        new Date(new Date().getFullYear(), 0, 1),
                        "yyyy-MM-dd",
                      ),
                      end: format(new Date(), "yyyy-MM-dd"),
                    });
                  }}
                >
                  Apply YTD
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setFilterMode("custom");
                    setDateRange({
                      start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
                      end: format(new Date(), "yyyy-MM-dd"),
                    });
                  }}
                >
                  Reset Date Range
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <PDFDownloadLink
              document={<HealthPDF data={healthData} dateRange={dateRange} />}
              fileName={`BusinessHealth_${dateRange.start}_${dateRange.end}.pdf`}
            >
              {({ loading }) => (
                <Button
                  size="sm"
                  className="h-10 w-full items-center gap-2 rounded-lg px-4 shadow-sm sm:w-auto"
                  disabled={loading}
                >
                  <Download className="h-4 w-4" />
                  {loading ? "Generating..." : "Export Report"}
                </Button>
              )}
            </PDFDownloadLink>
          </div>
        </div>
      </div>

      <Card className="min-h-0 flex-1 overflow-hidden border border-border/70 bg-background/60 shadow-none">
        <CardContent className="flex h-full min-h-0 flex-col gap-1.5 p-1 sm:p-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Active Range:{" "}
              {filterMode === "all"
                ? "All Data"
                : `${dateRange.start} to ${dateRange.end}`}
            </p>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] bg-background/80">
                {filterMode === "all" ? "All Data Mode" : "Date Filter Mode"}
              </Badge>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1 sm:p-1.5 lg:p-2">
            <Tabs
              defaultValue="overview"
              className="space-y-4 pr-1 md:space-y-6 sm:pr-2"
            >
              <TabsList className="h-auto justify-start gap-1.5 overflow-x-auto rounded-2xl border border-border/70 bg-muted/30 p-1.5 scrollbar-none">
                <TabsTrigger
                  value="overview"
                  className="rounded-xl px-3 md:px-6 py-2 md:py-2.5 font-semibold text-xs md:text-sm data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all shrink-0"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="financials"
                  className="rounded-xl px-3 md:px-6 py-2 md:py-2.5 font-semibold text-xs md:text-sm data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all shrink-0"
                >
                  Financials
                </TabsTrigger>
                <TabsTrigger
                  value="inventory"
                  className="rounded-xl px-3 md:px-6 py-2 md:py-2.5 font-semibold text-xs md:text-sm data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all shrink-0"
                >
                  Inventory
                </TabsTrigger>
                <TabsTrigger
                  value="stakeholders"
                  className="rounded-xl px-3 md:px-6 py-2 md:py-2.5 font-semibold text-xs md:text-sm data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all shrink-0"
                >
                  Stakeholders
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="overview"
                className="space-y-6 focus-visible:outline-none focus-visible:ring-0"
              >
                {/* Executive Summary Cards */}
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <SummaryCard
                    title="Total Revenue"
                    value={formatCurrency(healthData.summary.totalSales)}
                    icon={DollarSign}
                    trend={`${healthData.trendData.length}d period`}
                    color="text-emerald-600 dark:text-emerald-400"
                    cardColor="from-emerald-500/10 to-emerald-600/5 border-emerald-500/20"
                    iconColor="text-emerald-500"
                    trendIcon={ArrowUpRight}
                  />
                  <SummaryCard
                    title="Net Profit"
                    value={formatCurrency(healthData.summary.totalProfit)}
                    icon={
                      healthData.summary.totalProfit >= 0
                        ? TrendingUp
                        : TrendingDown
                    }
                    trend={`${healthData.summary.avgMargin}% Margin`}
                    color={
                      healthData.summary.totalProfit >= 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-red-600 dark:text-red-400"
                    }
                    cardColor={
                      healthData.summary.totalProfit >= 0
                        ? "from-blue-500/10 to-blue-600/5 border-blue-500/20"
                        : "from-red-500/10 to-red-600/5 border-red-500/20"
                    }
                    iconColor={
                      healthData.summary.totalProfit >= 0
                        ? "text-blue-500"
                        : "text-red-500"
                    }
                    trendIcon={
                      healthData.summary.totalProfit >= 0
                        ? ArrowUpRight
                        : ArrowDownRight
                    }
                  />
                  <SummaryCard
                    title="Op. Expenses"
                    value={formatCurrency(healthData.summary.totalExpenses)}
                    icon={TrendingDown}
                    trend={`${roundToTwoDecimals((healthData.summary.totalExpenses / (healthData.summary.totalSales || 1)) * 100)}% of Rev`}
                    color="text-amber-600 dark:text-amber-400"
                    cardColor="from-amber-500/10 to-amber-600/5 border-amber-500/20"
                    iconColor="text-amber-500"
                    trendIcon={AlertCircle}
                  />
                  <SummaryCard
                    title="Client LTV"
                    value={formatCurrency(healthData.summary.ltv)}
                    icon={Users}
                    trend="Per Active Client"
                    color="text-purple-600 dark:text-purple-400"
                    cardColor="from-purple-500/10 to-purple-600/5 border-purple-500/20"
                    iconColor="text-purple-500"
                    trendIcon={Users}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                  {/* Primary Health Matrix */}
                  <Card className="lg:col-span-2 shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 px-4 md:px-6 py-3 md:py-4">
                      <div className="space-y-0.5 md:space-y-1">
                        <CardTitle className="text-base md:text-lg font-semibold">
                          Health Score Matrix
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Real-time operational efficiency scores
                        </CardDescription>
                      </div>
                      <div className="p-1.5 md:p-2 bg-white rounded-lg border shadow-sm">
                        <Activity className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
                      {[
                        {
                          label: "Cash Flow Stability",
                          value: healthData.scores.cashFlow,
                          desc: "Payment collection efficiency",
                          icon: DollarSign,
                        },
                        {
                          label: "Inventory Velocity",
                          value: healthData.scores.inventoryTurnover,
                          desc: "Stock movement rate",
                          icon: Package,
                        },
                        {
                          label: "Profitability Index",
                          value: healthData.scores.profitHealth,
                          desc: "Revenue vs Expense ratio",
                          icon: Percent,
                        },
                        {
                          label: "Credit Health",
                          value: 100 - healthData.scores.creditRisk,
                          desc: "Lower overdue transaction rate",
                          icon: ShieldAlert,
                        },
                      ].map((score, i) => (
                        <div
                          key={i}
                          className="space-y-2 md:space-y-3 p-3 md:p-4 rounded-xl bg-slate-50/50 border border-slate-100 transition-all hover:border-primary/20 hover:bg-white hover:shadow-md"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <score.icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-400" />
                              <span className="text-xs md:text-sm font-medium text-slate-700">
                                {score.label}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "text-[10px] md:text-sm font-semibold px-1.5 md:px-2 py-0.5 rounded-lg",
                                score.value > 70
                                  ? "text-emerald-600 bg-emerald-50"
                                  : score.value > 40
                                    ? "text-amber-600 bg-amber-50"
                                    : "text-rose-600 bg-rose-50",
                              )}
                            >
                              {roundToTwoDecimals(score.value)}%
                            </span>
                          </div>
                          <Progress
                            value={score.value}
                            className="h-1.5 md:h-2"
                          />
                          <p className="text-[8px] md:text-[10px] text-slate-400 uppercase tracking-wider">
                            {score.desc}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Strategic Roadmap */}
                  <Card className="shadow-sm border-slate-200">
                    <CardHeader className="border-b bg-slate-50/50 px-4 md:px-6 py-3 md:py-4">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 md:h-5 md:w-5 text-amber-500 fill-amber-500" />
                        <CardTitle className="text-base md:text-lg font-semibold">
                          Strategic Roadmap
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
                      {healthData.deadInventory > 0 && (
                        <div className="p-3 md:p-4 rounded-xl bg-rose-50 border border-rose-100">
                          <p className="text-xs md:text-sm leading-relaxed text-rose-900">
                            Liquidate{" "}
                            <span className="font-semibold text-rose-700">
                              {healthData.deadInventory} items
                            </span>{" "}
                            via clearance to unlock working capital.
                          </p>
                        </div>
                      )}
                      {healthData.summary.avgMargin < 15 && (
                        <div className="p-3 md:p-4 rounded-xl bg-amber-50 border border-amber-100">
                          <p className="text-xs md:text-sm leading-relaxed text-amber-900">
                            Current margin (
                            <span className="font-semibold text-amber-700">
                              {healthData.summary.avgMargin}%
                            </span>
                            ) is below target. Review unit economics.
                          </p>
                        </div>
                      )}
                      <div className="p-3 md:p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                        <p className="text-xs md:text-sm leading-relaxed text-emerald-900">
                          Prioritize engagement with{" "}
                          <span className="font-semibold text-emerald-700">
                            {(healthData.topCustomer as any)?.name ||
                              "top clients"}
                          </span>{" "}
                          to stabilize LTV.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent
                value="financials"
                className="space-y-6 focus-visible:outline-none focus-visible:ring-0"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Revenue Trend */}
                  <Card className="shadow-sm border-slate-200">
                    <CardHeader className="px-6 py-4 border-b bg-slate-50/50">
                      <CardTitle className="text-lg font-semibold">
                        Growth Dynamics
                      </CardTitle>
                      <CardDescription>
                        Recognized Revenue vs Net Profit trajectories
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={healthData.trendData}>
                          <defs>
                            <linearGradient
                              id="colorSales"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#3b82f6"
                                stopOpacity={0.1}
                              />
                              <stop
                                offset="95%"
                                stopColor="#3b82f6"
                                stopOpacity={0}
                              />
                            </linearGradient>
                            <linearGradient
                              id="colorProfit"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#10b981"
                                stopOpacity={0.1}
                              />
                              <stop
                                offset="95%"
                                stopColor="#10b981"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#f1f5f9"
                          />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val) => `₹${val / 1000}k`}
                          />
                          <RechartsTooltip
                            contentStyle={{
                              borderRadius: "12px",
                              border: "none",
                              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                            }}
                            itemStyle={{ fontSize: "12px" }}
                          />
                          <Area
                            type="monotone"
                            dataKey="sales"
                            name="Revenue"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorSales)"
                          />
                          <Area
                            type="monotone"
                            dataKey="profit"
                            name="Net Profit"
                            stroke="#10b981"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorProfit)"
                          />
                          <Legend
                            verticalAlign="top"
                            height={36}
                            iconType="circle"
                            wrapperStyle={{
                              paddingBottom: "20px",
                              fontSize: "12px",
                            }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Expense Breakdown */}
                  <Card className="shadow-sm border-slate-200 overflow-hidden">
                    <CardHeader className="px-4 md:px-6 py-3 md:py-4 border-b bg-slate-50/50">
                      <CardTitle className="text-lg font-semibold">
                        Burn Analysis
                      </CardTitle>
                      <CardDescription>
                        Categorized operational expenditures
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 md:p-5 rounded-2xl bg-rose-50 border border-rose-100 shadow-sm">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="p-2.5 md:p-3 bg-white rounded-xl text-rose-600 shadow-sm">
                            <TrendingDown className="h-5 w-5 md:h-6 md:w-6" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-rose-400 tracking-widest">
                              Total OpEx
                            </p>
                            <p className="text-xl md:text-2xl font-semibold text-rose-700">
                              {formatCurrency(healthData.summary.totalExpenses)}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="w-fit bg-white text-rose-700 border-rose-200"
                        >
                          Burn Rate
                        </Badge>
                      </div>

                      <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 md:pr-2 scrollbar-thin">
                        {healthData.expenses.length > 0 ? (
                          healthData.expenses.map((exp: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-start justify-between gap-3 p-3 md:p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-700 break-words">
                                  {exp.description}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {format(new Date(exp.date), "dd MMM yyyy")}
                                </p>
                              </div>
                              <p className="text-sm font-medium text-rose-600 whitespace-nowrap">
                                -{formatCurrency(exp.amount)}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-center py-8 text-sm text-slate-400 italic">
                            No expenses recorded in this period
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent
                value="inventory"
                className="space-y-6 focus-visible:outline-none focus-visible:ring-0"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Inventory Risks */}
                  <Card className="shadow-sm border-slate-200">
                    <CardHeader className="px-6 py-4 border-b bg-slate-50/50">
                      <CardTitle className="text-lg font-semibold">
                        Stock Hazards
                      </CardTitle>
                      <CardDescription>
                        Critical inventory alert levels
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <RiskRow
                        icon={XCircle}
                        label="Dead Inventory"
                        count={healthData.deadInventory}
                        color="text-rose-500"
                      />
                      <RiskRow
                        icon={AlertTriangle}
                        label="Margin Risks"
                        count={healthData.lowMarginProds}
                        color="text-amber-500"
                      />
                      <RiskRow
                        icon={Package}
                        label="Overstocked Items"
                        count={healthData.stockTooHigh}
                        color="text-blue-500"
                      />
                      <RiskRow
                        icon={ShieldAlert}
                        label="Return Velocity"
                        status={healthData.tooManyRefunds ? "High" : "Optimal"}
                        color={
                          healthData.tooManyRefunds
                            ? "text-rose-500"
                            : "text-emerald-500"
                        }
                      />
                    </CardContent>
                  </Card>

                  {/* Returns Analysis */}
                  <Card className="lg:col-span-2 shadow-sm border-slate-200 overflow-hidden">
                    <CardHeader className="px-4 md:px-6 py-3 md:py-4 border-b bg-slate-50/50">
                      <CardTitle className="text-lg font-semibold">
                        Transaction Reversals
                      </CardTitle>
                      <CardDescription>
                        Net impact of returns and refunds
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                      <div className="p-4 md:p-5 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                        <p className="text-[10px] uppercase text-amber-500 tracking-widest mb-1">
                          Sales Returns
                        </p>
                        <p className="text-lg md:text-xl font-semibold text-amber-700 break-words">
                          {formatCurrency(healthData.summary.totalReturns)}
                        </p>
                        <p className="text-[9px] text-amber-400 mt-2 uppercase">
                          Rev leakage
                        </p>
                      </div>
                      <div className="p-4 md:p-5 rounded-2xl bg-blue-50 border border-blue-100 text-center">
                        <p className="text-[10px] uppercase text-blue-500 tracking-widest mb-1">
                          Purchase Returns
                        </p>
                        <p className="text-lg md:text-xl font-semibold text-blue-700 break-words">
                          {formatCurrency(
                            healthData.summary.totalPurchaseReturns,
                          )}
                        </p>
                        <p className="text-[9px] text-blue-400 mt-2 uppercase">
                          Cap recovery
                        </p>
                      </div>
                      <div className="p-4 md:p-5 rounded-2xl bg-slate-900 border border-slate-800 text-center shadow-lg sm:col-span-2 xl:col-span-1">
                        <p className="text-[10px] uppercase text-slate-400 tracking-widest mb-1">
                          Net Impact
                        </p>
                        <p className="text-lg md:text-xl font-semibold text-white break-words">
                          {formatCurrency(
                            healthData.summary.totalReturns -
                            healthData.summary.totalPurchaseReturns,
                          )}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-2 uppercase">
                          Total reversal
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent
                value="stakeholders"
                className="space-y-6 focus-visible:outline-none focus-visible:ring-0"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                  <Card className="border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-background">
                    <CardContent className="p-4 md:p-5">
                      <p className="text-[10px] uppercase tracking-widest text-amber-600/80">
                        Active Sellers
                      </p>
                      <p className="mt-1 text-2xl font-bold text-amber-700">
                        {healthData.userAnalysis.length}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Team members contributing sales
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-blue-200/70 bg-gradient-to-br from-blue-50/90 to-background">
                    <CardContent className="p-4 md:p-5">
                      <p className="text-[10px] uppercase tracking-widest text-blue-600/80">
                        Top 3 Concentration
                      </p>
                      <p className="mt-1 text-2xl font-bold text-blue-700">
                        {roundToTwoDecimals(
                          (healthData.clientAnalysis
                            .slice(0, 3)
                            .reduce((s: number, c: any) => s + c.sales, 0) /
                            (healthData.summary.totalSales || 1)) *
                          100,
                        )}
                        %
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Revenue share from top 3 clients
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-background">
                    <CardContent className="p-4 md:p-5">
                      <p className="text-[10px] uppercase tracking-widest text-emerald-600/80">
                        Avg Deal Size
                      </p>
                      <p className="mt-1 text-2xl font-bold text-emerald-700">
                        {formatCurrency(
                          healthData.userAnalysis[0]?.sales /
                          (healthData.userAnalysis[0]?.count || 1),
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Based on current top performer
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-indigo-200/70 bg-gradient-to-br from-indigo-50/90 to-background">
                    <CardContent className="p-4 md:p-5">
                      <p className="text-[10px] uppercase tracking-widest text-indigo-600/80">
                        Active Vendors
                      </p>
                      <p className="mt-1 text-2xl font-bold text-indigo-700">
                        {healthData.vendorAnalysis.length}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Suppliers with current-period purchases
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
                  <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-600 to-orange-600 text-white shadow-lg">
                    <div className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-white/10" />
                    <div className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-white/35" />
                    <CardHeader className="p-3 md:p-4 border-0">
                      <div className="rounded-2xl bg-white/14 ring-1 ring-white/25 px-3.5 md:px-4 py-3 md:py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-xl bg-white/20 ring-1 ring-white/35 flex items-center justify-center">
                              <Zap className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-lg md:text-xl leading-tight font-semibold tracking-tight text-white">
                                Sales Force
                              </CardTitle>
                              <CardDescription className="mt-0.5 text-sm text-white/85">
                                Contribution by team members
                              </CardDescription>
                            </div>
                          </div>
                          <Badge className="whitespace-nowrap rounded-md bg-black/15 text-white/95 border-white/30 px-2 py-0.5 text-xs font-medium tracking-wide">
                            {healthData.userAnalysis.length} Active
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 md:p-5 space-y-3">
                      {healthData.userAnalysis.length > 0 ? (
                        healthData.userAnalysis
                          .slice(0, 3)
                          .map((user: any, i: number) => {
                            const share =
                              (user.sales /
                                (healthData.summary.totalSales || 1)) *
                              100;
                            return (
                              <div
                                key={i}
                                className="rounded-xl bg-white/10 border border-white/20 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate">
                                      #{i + 1} {user.name}
                                    </p>
                                    <p className="text-[11px] text-white/80">
                                      {user.count} deals
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold">
                                      {formatCurrency(user.sales)}
                                    </p>
                                    <p className="text-[11px] text-white/80">
                                      {roundToTwoDecimals(share)}%
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-2 h-1.5 rounded-full bg-white/20 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-white"
                                    style={{
                                      width: `${Math.max(0, Math.min(100, share))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        <p className="text-center py-10 text-sm text-white/80 italic">
                          No stakeholder sales data in this period
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-lg">
                    <div className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-white/10" />
                    <div className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-white/35" />
                    <CardHeader className="p-3 md:p-4 border-0">
                      <div className="rounded-2xl bg-white/14 ring-1 ring-white/25 px-3.5 md:px-4 py-3 md:py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-xl bg-white/20 ring-1 ring-white/35 flex items-center justify-center">
                              <Users className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-lg md:text-xl leading-tight font-semibold tracking-tight text-white">
                                Key Accounts
                              </CardTitle>
                              <CardDescription className="mt-0.5 text-sm text-white/85">
                                Top clients by recognized revenue
                              </CardDescription>
                            </div>
                          </div>
                          <Badge className="whitespace-nowrap rounded-md bg-black/15 text-white/95 border-white/30 px-2 py-0.5 text-xs font-medium tracking-wide">
                            Top 10
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 md:p-5 space-y-3">
                      {healthData.clientAnalysis.length > 0 ? (
                        healthData.clientAnalysis
                          .slice(0, 3)
                          .map((client: any, i: number) => {
                            const avgTicket =
                              client.sales / (client.count || 1);
                            return (
                              <div
                                key={i}
                                className="rounded-xl bg-white/10 border border-white/20 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate">
                                      #{i + 1} {client.name}
                                    </p>
                                    <p className="text-[11px] text-white/80">
                                      {client.count} txns • Avg{" "}
                                      {formatCurrency(avgTicket)}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold">
                                      {formatCurrency(client.sales)}
                                    </p>
                                    <Badge className="mt-1 bg-white/20 text-white border-white/30 text-[10px]">
                                      Tier {i < 3 ? "A+" : "A"}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        <p className="text-center py-10 text-sm text-white/80 italic">
                          No client data in this period
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg">
                    <div className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-white/10" />
                    <div className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-white/35" />
                    <CardHeader className="p-3 md:p-4 border-0">
                      <div className="rounded-2xl bg-white/14 ring-1 ring-white/25 px-3.5 md:px-4 py-3 md:py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-xl bg-white/20 ring-1 ring-white/35 flex items-center justify-center">
                              <Package className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-lg md:text-xl leading-tight font-semibold tracking-tight text-white">
                                Prime Suppliers
                              </CardTitle>
                              <CardDescription className="mt-0.5 text-sm text-white/85">
                                Purchasing concentration by vendor
                              </CardDescription>
                            </div>
                          </div>
                          <Badge className="whitespace-nowrap rounded-md bg-black/15 text-white/95 border-white/30 px-2 py-0.5 text-xs font-medium tracking-wide">
                            Strategic
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 md:p-5 space-y-3">
                      {healthData.vendorAnalysis.length > 0 ? (
                        healthData.vendorAnalysis
                          .slice(0, 3)
                          .map((vendor: any, i: number) => (
                            <div
                              key={i}
                              className="rounded-xl bg-white/10 border border-white/20 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate">
                                    #{i + 1} {vendor.name}
                                  </p>
                                  <p className="text-[11px] text-white/80">
                                    {vendor.count} purchase orders
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold">
                                    {formatCurrency(vendor.purchases)}
                                  </p>
                                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-white/80 uppercase">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                                    Verified
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                      ) : (
                        <p className="text-center py-10 text-sm text-white/80 italic">
                          No vendor data in this period
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Business Analysis Expansion */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                  <Card className="shadow-sm border-emerald-200/70 overflow-hidden bg-gradient-to-br from-emerald-50/60 via-background to-background">
                    <CardHeader className="px-4 md:px-6 py-4 border-b bg-emerald-50/60">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-emerald-500/10">
                            <Activity className="h-5 w-5 text-emerald-500" />
                          </div>
                          <div>
                            <CardTitle className="text-base md:text-lg">
                              Market Segmentation
                            </CardTitle>
                            <CardDescription>
                              Client distribution by engagement health
                            </CardDescription>
                          </div>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">
                          Segments
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                        {healthData.customerSegments.map(
                          (segment: any, i: number) => {
                            const percentage = roundToTwoDecimals(
                              (segment.value /
                                (healthData.clientAnalysis.length || 1)) *
                              100,
                            );
                            const tone =
                              segment.name === "Active"
                                ? "from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-700"
                                : segment.name === "At Risk"
                                  ? "from-amber-50 to-amber-100/50 border-amber-200 text-amber-700"
                                  : "from-slate-50 to-slate-100/60 border-slate-200 text-slate-700";
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "rounded-2xl border bg-gradient-to-br p-4 md:p-5 transition-all hover:shadow-md",
                                  tone,
                                )}
                              >
                                <p className="text-[10px] uppercase tracking-widest opacity-80">
                                  {segment.name}
                                </p>
                                <p className="mt-2 text-3xl font-bold leading-none">
                                  {segment.value}
                                </p>
                                <p className="mt-2 text-[11px] uppercase tracking-wide opacity-80">
                                  Customers
                                </p>
                                <div className="mt-4">
                                  <Progress
                                    value={percentage}
                                    className="h-1.5"
                                  />
                                  <p className="mt-2 text-[11px] font-medium opacity-90">
                                    {percentage}% share
                                  </p>
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-blue-200/70 overflow-hidden bg-gradient-to-br from-blue-50/60 via-background to-background">
                    <CardHeader className="px-4 md:px-6 py-4 border-b bg-blue-50/60">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/10">
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                          </div>
                          <div>
                            <CardTitle className="text-base md:text-lg">
                              Strategic Insights
                            </CardTitle>
                            <CardDescription>
                              Actionable guidance from current period behavior
                            </CardDescription>
                          </div>
                        </div>
                        <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
                          Advisory
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
                      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 md:p-5">
                        <div className="flex items-start gap-3">
                          <Info className="h-4 w-4 md:h-5 md:w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm md:text-base font-semibold text-blue-900">
                              Revenue Concentration
                            </p>
                            <p className="text-xs md:text-sm text-blue-800 mt-1 leading-relaxed">
                              Top 3 clients contribute{" "}
                              <span className="font-bold">
                                {roundToTwoDecimals(
                                  (healthData.clientAnalysis
                                    .slice(0, 3)
                                    .reduce(
                                      (s: number, c: any) => s + c.sales,
                                      0,
                                    ) /
                                    (healthData.summary.totalSales || 1)) *
                                  100,
                                )}
                                %
                              </span>
                              . Prioritize risk balancing by adding mid-value
                              accounts.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 md:p-5">
                        <div className="flex items-start gap-3">
                          <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm md:text-base font-semibold text-emerald-900">
                              Sales Velocity
                            </p>
                            <p className="text-xs md:text-sm text-emerald-800 mt-1 leading-relaxed">
                              Avg deal size for{" "}
                              <span className="font-semibold">
                                {healthData.userAnalysis[0]?.name || "top rep"}
                              </span>{" "}
                              is{" "}
                              <span className="font-semibold">
                                {formatCurrency(
                                  healthData.userAnalysis[0]?.sales /
                                  (healthData.userAnalysis[0]?.count || 1),
                                )}
                              </span>
                              . Replicate this pattern through playbook sharing.
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  trend,
  color,
  cardColor,
  iconColor,
  trendIcon: TrendIcon,
}: any) {
  return (
    <Card className={cn("bg-gradient-to-br border w-full", cardColor)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
        <CardTitle
          className={cn(
            "text-[10px] sm:text-xs md:text-sm font-medium truncate pr-2",
            color,
          )}
        >
          {title}
        </CardTitle>
        <Icon
          className={cn(
            "h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 flex-shrink-0",
            iconColor,
          )}
        />
      </CardHeader>
      <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
        <div
          className={cn(
            "text-lg sm:text-xl md:text-2xl font-bold break-words",
            color,
          )}
        >
          {value}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
          {TrendIcon ? (
            <TrendIcon
              className={cn("h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0", iconColor)}
            />
          ) : null}
          <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground break-words">
            {trend}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskRow({ icon: Icon, label, count, status, color }: any) {
  return (
    <div className="flex items-center justify-between p-3 md:p-4 rounded-xl bg-muted/20 border border-transparent hover:border-muted/40 hover:bg-muted/30 transition-all group">
      <div className="flex items-center gap-3 md:gap-4">
        <div
          className={cn(
            "p-1.5 md:p-2 rounded-lg bg-background group-hover:scale-110 transition-transform",
            color,
          )}
        >
          <Icon className="h-4 w-4 md:h-5 md:w-5" />
        </div>
        <span className="text-xs md:text-sm font-medium text-foreground/80">
          {label}
        </span>
      </div>
      <span
        className={cn(
          "font-medium text-[10px] md:text-sm px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-background/50",
          color,
        )}
      >
        {count !== undefined ? count : status}
      </span>
    </div>
  );
}
