import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#111827",
    paddingBottom: 15,
  },
  companyName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  reportTitle: {
    fontSize: 14,
    marginTop: 5,
    color: "#374151",
  },
  period: {
    fontSize: 9,
    marginTop: 5,
    color: "#6b7280",
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "bold",
    backgroundColor: "#f3f4f6",
    padding: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#111827",
    color: "#111827",
    marginBottom: 8,
  },
  subsectionHeader: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#374151",
    marginTop: 10,
    marginBottom: 5,
  },
  table: {
    width: "auto",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRowHeader: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderBottomColor: "#d1d5db",
    borderBottomWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontWeight: "bold",
  },
  tableCellLabel: {
    flex: 2,
    textAlign: "left",
    color: "#4b5563",
    fontSize: 9,
  },
  tableCellValue: {
    flex: 1,
    textAlign: "right",
    fontWeight: "bold",
    color: "#111827",
    fontSize: 9,
  },
  tableCell: {
    flex: 1,
    textAlign: "left",
    fontSize: 8,
    color: "#374151",
  },
  tableCellRight: {
    flex: 1,
    textAlign: "right",
    fontSize: 8,
    color: "#374151",
  },
  summaryBox: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#374151",
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: "bold",
  },
  profit: {
    color: "#059669",
  },
  loss: {
    color: "#dc2626",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 7,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  divider: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  rankBadge: {
    width: 20,
    textAlign: "center",
    fontSize: 8,
    fontWeight: "bold",
  },
  productName: {
    flex: 3,
    fontSize: 8,
    color: "#374151",
  },
  metric: {
    flex: 1,
    textAlign: "right",
    fontSize: 8,
    color: "#374151",
  },
});

interface DashboardPDFProps {
  stats: any;
  chartData: any;
  productAnalytics: any;
  clientAnalytics: any;
  bills: any[];
  purchaseBills: any[];
  company?: any;
  dateRange: { start: string; end: string };
}

const formatCurrency = (amount: number) => {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${amount < 0 ? "-" : ""}Rs. ${formatted}`;
};

const formatDate = (date: string) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const DashboardPDF = ({
  stats,
  chartData,
  productAnalytics,
  clientAnalytics,
  bills,
  purchaseBills,
  company,
  dateRange,
}: DashboardPDFProps) => (
  <Document>
    {/* PAGE 1: EXECUTIVE SUMMARY */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.companyName}>{company?.name || "Ibell"}</Text>
        <Text style={styles.reportTitle}>Dashboard Executive Summary</Text>
        <Text style={styles.period}>
          Period: {dateRange.start ? formatDate(dateRange.start) : "All Time"} -{" "}
          {dateRange.end ? formatDate(dateRange.end) : "Present"}
        </Text>
        <Text style={styles.period}>
          Generated:{" "}
          {new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      {/* Financial Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>FINANCIAL OVERVIEW</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Collected</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalCollected ?? stats.paidSubtotal ?? 0)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Revenue</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalRevenue)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Pending Collection</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(
                stats.pendingCollection ?? stats.pendingAmount ?? 0,
              )}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Discount Given</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalDiscount)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Sale Courier Charges</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalSaleCourier || 0)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Purchases</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalPurchases)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Purchase Courier Charges</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalPurchaseCourier || 0)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Purchase Extra Expenses</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalPurchaseExtraExpense || 0)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Gross Profit</Text>
            <Text
              style={[
                styles.tableCellValue,
                stats.grossProfit >= 0 ? styles.profit : styles.loss,
              ]}
            >
              {formatCurrency(stats.grossProfit)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>
              Current Gross Profit (Collected Only)
            </Text>
            <Text
              style={[
                styles.tableCellValue,
                (stats.currentGrossProfit ?? 0) >= 0
                  ? styles.profit
                  : styles.loss,
              ]}
            >
              {formatCurrency(stats.currentGrossProfit ?? 0)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>
              Total Net Profit (with expected profits)
            </Text>
            <Text
              style={[
                styles.tableCellValue,
                stats.profit >= 0 ? styles.profit : styles.loss,
              ]}
            >
              {formatCurrency(stats.profit)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>
              Expected Profit (from pending collection)
            </Text>
            <Text
              style={[
                styles.tableCellValue,
                (stats.expectedProfit ?? 0) >= 0 ? styles.profit : styles.loss,
              ]}
            >
              {formatCurrency(stats.expectedProfit ?? 0)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>
              Current Net Profit (After All Deductions)
            </Text>
            <Text
              style={[
                styles.tableCellValue,
                (stats.currentNetProfit ?? 0) >= 0
                  ? styles.profit
                  : styles.loss,
              ]}
            >
              {formatCurrency(stats.currentNetProfit ?? 0)}
            </Text>
          </View>
          {(stats.gstCollected ?? 0) > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>
                GST Collected (Output Tax — payable to govt.)
              </Text>
              <Text style={[styles.tableCellValue, { color: "#4f46e5" }]}>
                {formatCurrency(stats.gstCollected ?? 0)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Cost Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>COST BREAKDOWN</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Cost of Goods Sold (COGS)</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalCOGS)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Operational Expenses</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalExpenses)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Deadstock Loss</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.deadstockLoss)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Costs</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(
                stats.totalCOGS + stats.totalExpenses + stats.deadstockLoss,
              )}
            </Text>
          </View>
        </View>
      </View>

      {/* Key Metrics */}
      <View style={styles.summaryBox}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Profit Margin</Text>
          <Text style={styles.summaryValue}>
            {stats.totalCOGS > 0
              ? ((stats.grossProfit / stats.totalCOGS) * 100).toFixed(2)
              : "0.00"}
            %
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>ROI (Return on Investment)</Text>
          <Text style={styles.summaryValue}>
            {stats.totalCOGS > 0
              ? ((stats.profit / stats.totalCOGS) * 100).toFixed(2)
              : "N/A"}
            %
          </Text>
        </View>
      </View>

      {/* Tax Analysis */}
      <View style={styles.section}></View>

      <Text style={styles.footer}>
        {company?.name || "Ibell"} | Page 1 of 4
      </Text>
    </Page>

    {/* PAGE 2: PAYMENT STATUS & INVENTORY */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.companyName}>{company?.name || "Ibell"}</Text>
        <Text style={styles.reportTitle}>
          Payment Status & Inventory Analysis
        </Text>
      </View>

      {/* Payment Status */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>PAYMENT STATUS BREAKDOWN</Text>
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={styles.tableCellLabel}>Status</Text>
            <Text style={styles.tableCellValue}>Amount (Total)</Text>
            <Text style={styles.tableCellValue}>Amount (Net)</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Paid</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalCollected ?? stats.paidSubtotal ?? 0)}
            </Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalCollected ?? stats.paidSubtotal ?? 0)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Pending</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(
                chartData.paymentBreakdown.find(
                  (p: any) => p.name === "Pending",
                )?.value || 0,
              )}
            </Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.pendingSubtotal)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Overdue</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(
                chartData.paymentBreakdown.find(
                  (p: any) => p.name === "Overdue",
                )?.value || 0,
              )}
            </Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.overdueSubtotal)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Pending Receivable</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.pendingAmount)}
            </Text>
            <Text style={styles.tableCellValue}>-</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Cash Collected (Sales)</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalCashCollected || 0)}
            </Text>
            <Text style={styles.tableCellValue}>-</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>
              Bank/UPI Collected (Sales)
            </Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalBankCollected || 0)}
            </Text>
            <Text style={styles.tableCellValue}>-</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Cash Paid (Purchases)</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalPurchaseCashPaid || 0)}
            </Text>
            <Text style={styles.tableCellValue}>-</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Bank/UPI Paid (Purchases)</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.totalPurchaseBankPaid || 0)}
            </Text>
            <Text style={styles.tableCellValue}>-</Text>
          </View>
        </View>
      </View>

      {/* Inventory & Returns */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>INVENTORY & RETURNS</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Current Inventory Value</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.inventoryValue)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Products in Stock</Text>
            <Text style={styles.tableCellValue}>{stats.totalProducts}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Returns</Text>
            <Text style={styles.tableCellValue}>{stats.totalReturns}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Deadstock Loss</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.deadstockLoss)}
            </Text>
          </View>
        </View>
      </View>

      {/* Business Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>BUSINESS METRICS</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Sales Bills</Text>
            <Text style={styles.tableCellValue}>{stats.totalBills}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Purchase Bills</Text>
            <Text style={styles.tableCellValue}>
              {stats.totalPurchaseBills}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Clients</Text>
            <Text style={styles.tableCellValue}>{stats.totalClients}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Overdue Bills Count</Text>
            <Text style={styles.tableCellValue}>{stats.overdueBills}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Pending Purchases Payable</Text>
            <Text style={styles.tableCellValue}>
              {formatCurrency(stats.pendingPurchases)}
            </Text>
          </View>
        </View>
      </View>

      {/* Sales vs Purchases Trend */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>SALES VS PURCHASES TREND</Text>
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Period</Text>
            <Text style={styles.tableCellRight}>Sales</Text>
            <Text style={styles.tableCellRight}>Purchases</Text>
            <Text style={styles.tableCellRight}>Profit</Text>
          </View>
          {chartData.monthlySpendVsSales.slice(0, 8).map((row: any) => {
            const profitRow = chartData.monthlyProfit.find(
              (p: any) => p.period === row.period,
            );
            return (
              <View key={row.period} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>
                  {row.period}
                </Text>
                <Text style={styles.tableCellRight}>
                  {formatCurrency(row.sales)}
                </Text>
                <Text style={styles.tableCellRight}>
                  {formatCurrency(row.purchases)}
                </Text>
                <Text
                  style={[
                    styles.tableCellRight,
                    (profitRow?.profit || 0) >= 0 ? styles.profit : styles.loss,
                  ]}
                >
                  {formatCurrency(profitRow?.profit || 0)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <Text style={styles.footer}>
        {company?.name || "Ibell"} | Page 2 of 4
      </Text>
    </Page>

    {/* PAGE 3: PRODUCT PERFORMANCE */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.companyName}>{company?.name || "Ibell"}</Text>
        <Text style={styles.reportTitle}>Product Performance Analysis</Text>
      </View>

      {/* Top Products by Revenue */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>TOP PRODUCTS BY REVENUE</Text>
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={styles.rankBadge}>#</Text>
            <Text style={styles.productName}>Product Name</Text>
            <Text style={styles.metric}>Revenue</Text>
            <Text style={styles.metric}>Qty</Text>
            <Text style={styles.metric}>Profit</Text>
            <Text style={styles.metric}>Margin</Text>
          </View>
          {productAnalytics.topProductsByRevenue
            .slice(0, 10)
            .map((product: any, index: number) => (
              <View key={product.productId} style={styles.tableRow}>
                <Text style={styles.rankBadge}>{index + 1}</Text>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.metric}>
                  {formatCurrency(product.revenue)}
                </Text>
                <Text style={styles.metric}>{product.quantity.toFixed(2)}</Text>
                <Text
                  style={[
                    styles.metric,
                    product.profit >= 0 ? styles.profit : styles.loss,
                  ]}
                >
                  {formatCurrency(product.profit)}
                </Text>
                <Text style={styles.metric}>{product.margin.toFixed(1)}%</Text>
              </View>
            ))}
        </View>
      </View>

      {/* Top Products by Profit Margin */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>TOP PRODUCTS BY PROFIT MARGIN</Text>
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={styles.rankBadge}>#</Text>
            <Text style={styles.productName}>Product Name</Text>
            <Text style={styles.metric}>Margin</Text>
            <Text style={styles.metric}>Profit</Text>
            <Text style={styles.metric}>Revenue</Text>
          </View>
          {productAnalytics.topProductsByProfit
            .slice(0, 8)
            .map((product: any, index: number) => (
              <View key={product.productId} style={styles.tableRow}>
                <Text style={styles.rankBadge}>{index + 1}</Text>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.metric}>{product.margin.toFixed(1)}%</Text>
                <Text
                  style={[
                    styles.metric,
                    product.profit >= 0 ? styles.profit : styles.loss,
                  ]}
                >
                  {formatCurrency(product.profit)}
                </Text>
                <Text style={styles.metric}>
                  {formatCurrency(product.revenue)}
                </Text>
              </View>
            ))}
        </View>
      </View>

      {/* Products with Returns */}
      {productAnalytics.mostReturnedProducts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PRODUCTS WITH MOST RETURNS</Text>
          <View style={styles.table}>
            <View style={styles.tableRowHeader}>
              <Text style={styles.rankBadge}>#</Text>
              <Text style={styles.productName}>Product Name</Text>
              <Text style={styles.metric}>Returns</Text>
              <Text style={styles.metric}>Rate</Text>
              <Text style={styles.metric}>Value</Text>
            </View>
            {productAnalytics.mostReturnedProducts
              .slice(0, 8)
              .map((product: any, index: number) => (
                <View key={product.productId} style={styles.tableRow}>
                  <Text style={styles.rankBadge}>{index + 1}</Text>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.metric}>
                    {product.returnQuantity.toFixed(2)}
                  </Text>
                  <Text style={[styles.metric, styles.loss]}>
                    {product.returnRate.toFixed(1)}%
                  </Text>
                  <Text style={[styles.metric, styles.loss]}>
                    {formatCurrency(product.returnValue)}
                  </Text>
                </View>
              ))}
          </View>
        </View>
      )}

      <Text style={styles.footer}>
        {company?.name || "Ibell"} | Page 3 of 4
      </Text>
    </Page>

    {/* PAGE 4: CLIENT ANALYSIS */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.companyName}>{company?.name || "Ibell"}</Text>
        <Text style={styles.reportTitle}>Client Performance Analysis</Text>
      </View>

      {/* Top Clients by Revenue */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>TOP CLIENTS BY REVENUE</Text>
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={styles.rankBadge}>#</Text>
            <Text style={styles.productName}>Client Name</Text>
            <Text style={styles.metric}>Revenue</Text>
            <Text style={styles.metric}>Orders</Text>
            <Text style={styles.metric}>Avg Bill</Text>
            <Text style={styles.metric}>Pending</Text>
          </View>
          {clientAnalytics.topClientsByRevenue
            .slice(0, 10)
            .map((client: any, index: number) => (
              <View key={client.clientId} style={styles.tableRow}>
                <Text style={styles.rankBadge}>{index + 1}</Text>
                <Text style={styles.productName}>{client.name}</Text>
                <Text style={[styles.metric, styles.profit]}>
                  {formatCurrency(client.revenue)}
                </Text>
                <Text style={styles.metric}>{client.billCount}</Text>
                <Text style={styles.metric}>
                  {formatCurrency(client.avgBillValue)}
                </Text>
                <Text
                  style={[
                    styles.metric,
                    client.pendingAmount > 0 ? styles.loss : {},
                  ]}
                >
                  {formatCurrency(client.pendingAmount)}
                </Text>
              </View>
            ))}
        </View>
      </View>

      {/* Most Active Clients */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>
          MOST ACTIVE CLIENTS (BY ORDERS)
        </Text>
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={styles.rankBadge}>#</Text>
            <Text style={styles.productName}>Client Name</Text>
            <Text style={styles.metric}>Orders</Text>
            <Text style={styles.metric}>Revenue</Text>
            <Text style={styles.metric}>Avg Bill</Text>
          </View>
          {clientAnalytics.topClientsByOrders
            .slice(0, 8)
            .map((client: any, index: number) => (
              <View key={client.clientId} style={styles.tableRow}>
                <Text style={styles.rankBadge}>{index + 1}</Text>
                <Text style={styles.productName}>{client.name}</Text>
                <Text style={styles.metric}>{client.billCount}</Text>
                <Text style={styles.metric}>
                  {formatCurrency(client.revenue)}
                </Text>
                <Text style={styles.metric}>
                  {formatCurrency(client.avgBillValue)}
                </Text>
              </View>
            ))}
        </View>
      </View>

      {/* Clients with Returns */}
      {clientAnalytics.clientReturnStats.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CLIENTS WITH RETURNS</Text>
          <View style={styles.table}>
            <View style={styles.tableRowHeader}>
              <Text style={styles.rankBadge}>#</Text>
              <Text style={styles.productName}>Client Name</Text>
              <Text style={styles.metric}>Returns</Text>
              <Text style={styles.metric}>Rate</Text>
              <Text style={styles.metric}>Value</Text>
            </View>
            {clientAnalytics.clientReturnStats
              .slice(0, 8)
              .map((client: any, index: number) => (
                <View key={client.clientId} style={styles.tableRow}>
                  <Text style={styles.rankBadge}>{index + 1}</Text>
                  <Text style={styles.productName}>{client.name}</Text>
                  <Text style={styles.metric}>{client.returnCount}</Text>
                  <Text style={[styles.metric, styles.loss]}>
                    {client.returnRate.toFixed(1)}%
                  </Text>
                  <Text style={[styles.metric, styles.loss]}>
                    {formatCurrency(client.returnValue)}
                  </Text>
                </View>
              ))}
          </View>
        </View>
      )}

      <Text style={styles.footer}>
        {company?.name || "Ibell"} | Page 4 of 4 | Report generated on{" "}
        {new Date().toLocaleDateString("en-IN")}
      </Text>
    </Page>
  </Document>
);
