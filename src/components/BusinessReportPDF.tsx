import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { Bill, PurchaseBill, Expense, Client, CompanyProfile } from "@/types";

function Rs(n: number) {
  return `Rs.${Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(d: string) {
  try {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
  } catch {
    return d;
  }
}

const S = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 42,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#0f172a",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 8,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  coName: { fontSize: 14, fontWeight: "bold", color: "#0f172a" },
  coMeta: { marginTop: 2, fontSize: 8, color: "#475569" },
  rightMeta: { alignItems: "flex-end" },
  rightLabel: { fontSize: 7, color: "#64748b" },
  rightValue: { fontSize: 10, fontWeight: "bold", marginTop: 1, color: "#0f172a" },

  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 6,
    marginTop: 12,
    color: "#0f172a",
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
    paddingLeft: 6,
  },

  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: "#dbe3ee",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  kpiCell: {
    width: "25%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5eaf2",
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  kpiLabel: { fontSize: 6.8, color: "#64748b", marginBottom: 2 },
  kpiValue: { fontSize: 9, fontWeight: "bold", color: "#0f172a" },
  kpiSub: { fontSize: 6.5, color: "#94a3b8", marginTop: 1 },

  table: {
    borderWidth: 1,
    borderColor: "#dbe3ee",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 10,
  },
  thead: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#dbe3ee",
  },
  th: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#334155",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  thRight: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#334155",
    paddingVertical: 5,
    paddingHorizontal: 6,
    textAlign: "right",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.7,
    borderBottomColor: "#e7ecf3",
    backgroundColor: "#ffffff",
  },
  rowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.7,
    borderBottomColor: "#e7ecf3",
    backgroundColor: "#f8fafd",
  },
  totalsRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderTopWidth: 1,
    borderTopColor: "#dbe3ee",
  },
  td: {
    fontSize: 7.8,
    color: "#0f172a",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tdMuted: {
    fontSize: 7.3,
    color: "#64748b",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tdRight: {
    fontSize: 7.8,
    color: "#0f172a",
    paddingVertical: 4,
    paddingHorizontal: 6,
    textAlign: "right",
  },
  tdRightBold: {
    fontSize: 7.8,
    fontWeight: "bold",
    color: "#0f172a",
    paddingVertical: 4,
    paddingHorizontal: 6,
    textAlign: "right",
  },
  tdGreen: {
    fontSize: 7.8,
    fontWeight: "bold",
    color: "#166534",
    paddingVertical: 4,
    paddingHorizontal: 6,
    textAlign: "right",
  },
  tdRed: {
    fontSize: 7.8,
    fontWeight: "bold",
    color: "#991b1b",
    paddingVertical: 4,
    paddingHorizontal: 6,
    textAlign: "right",
  },
  empty: { fontSize: 8, color: "#64748b", textAlign: "center", padding: 10 },
  footer: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 12,
    paddingTop: 3,
    borderTopWidth: 0.7,
    borderTopColor: "#dbe3ee",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerTxt: { fontSize: 6.5, color: "#64748b" },
  badge: {
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontSize: 6.5,
    fontWeight: "bold",
  },
});

interface Props {
  bills: Bill[];
  purchaseBills: PurchaseBill[];
  expenses: Expense[];
  clients: Client[];
  companyProfile?: CompanyProfile | null;
}

export function BusinessReportPDF({
  bills,
  purchaseBills,
  expenses,
  clients,
  companyProfile,
}: Props) {
  const now = new Date();
  const generatedAt = `${fmtDate(now.toISOString())} ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  const coName = companyProfile?.name || "Business Report";

  // ── Summary KPIs ─────────────────────────────────────────────
  const totalSalesGross = bills.reduce((s, b) => s + (b.total || 0), 0);
  // Exclude GST from revenue — it is collected for government, not business income
  const gstOnSales = bills.reduce((s, b) => s + ((b as any).isGst ? ((b as any).totalTax || 0) : 0), 0);
  const totalSales = totalSalesGross - gstOnSales; // taxable revenue only
  const totalPurchase = purchaseBills.reduce((s, b) => s + (b.total || 0), 0);
  const totalCollected = bills.reduce((s, b) => s + (b.paidAmount || 0), 0);
  const totalPaid = purchaseBills.reduce((s, b) => s + (b.paidAmount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalReceivable = bills.reduce((s, b) => s + Math.max(0, (b.total || 0) - (b.paidAmount || 0)), 0);
  const totalPayable = purchaseBills.reduce((s, b) => s + Math.max(0, (b.total || 0) - (b.paidAmount || 0)), 0);
  const grossProfit = totalSales - totalPurchase;
  const netProfit = totalSales - totalPurchase - totalExpenses;
  const grossMargin = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : "0.0";
  const netMargin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : "0.0";

  // ── Month-wise analysis ───────────────────────────────────────
  const monthMap: Record<string, { sales: number; purchase: number; expenses: number; collected: number; paid: number }> = {};
  bills.forEach((b) => {
    const d = new Date(b.date || b.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { sales: 0, purchase: 0, expenses: 0, collected: 0, paid: 0 };
    // Use taxable amount only (exclude GST from revenue)
    monthMap[key].sales += (b.total || 0) - ((b as any).isGst ? ((b as any).totalTax || 0) : 0);
    monthMap[key].collected += b.paidAmount || 0;
  });
  purchaseBills.forEach((b) => {
    const d = new Date(b.billDate || b.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { sales: 0, purchase: 0, expenses: 0, collected: 0, paid: 0 };
    monthMap[key].purchase += b.total || 0;
    monthMap[key].paid += b.paidAmount || 0;
  });
  expenses.forEach((e) => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { sales: 0, purchase: 0, expenses: 0, collected: 0, paid: 0 };
    monthMap[key].expenses += e.amount || 0;
  });
  const monthlyData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => ({
      label: new Date(key + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      ...data,
      profit: data.sales - data.purchase - data.expenses,
    }));

  // ── Party analysis ────────────────────────────────────────────
  const partyMap: Record<string, { name: string; phone: string; sales: number; purchase: number; collected: number; paid: number; billCount: number; purchaseCount: number }> = {};
  clients.forEach((c) => {
    partyMap[c.id] = { name: c.name, phone: c.phone || "", sales: 0, purchase: 0, collected: 0, paid: 0, billCount: 0, purchaseCount: 0 };
  });
  bills.forEach((b) => {
    if (b.clientId && partyMap[b.clientId]) {
      const billGst = (b as any).isGst ? ((b as any).totalTax || 0) : 0;
      partyMap[b.clientId].sales += (b.total || 0) - billGst;
      partyMap[b.clientId].collected += b.paidAmount || 0;
      partyMap[b.clientId].billCount += 1;
    }
  });
  purchaseBills.forEach((b) => {
    if (b.clientId && partyMap[b.clientId]) {
      partyMap[b.clientId].purchase += b.total || 0;
      partyMap[b.clientId].paid += b.paidAmount || 0;
      partyMap[b.clientId].purchaseCount += 1;
    }
  });
  const partyList = Object.values(partyMap)
    .filter((p) => p.sales > 0 || p.purchase > 0)
    .sort((a, b) => (b.sales + b.purchase) - (a.sales + a.purchase));

  const topSaleParties = [...partyList].sort((a, b) => b.sales - a.sales).slice(0, 15);
  const topPurchaseParties = [...partyList].sort((a, b) => b.purchase - a.purchase).slice(0, 15);

  // ── Payment mode analysis ─────────────────────────────────────
  const payModeMap: Record<string, { in: number; out: number }> = {};
  bills.forEach((b) =>
    (b.payments || []).forEach((p) => {
      if (!payModeMap[p.method]) payModeMap[p.method] = { in: 0, out: 0 };
      payModeMap[p.method].in += p.amount;
    })
  );
  purchaseBills.forEach((b) =>
    (b.payments || []).forEach((p) => {
      if (!payModeMap[p.method]) payModeMap[p.method] = { in: 0, out: 0 };
      payModeMap[p.method].out += p.amount;
    })
  );
  const payModes = Object.entries(payModeMap).sort(([, a], [, b]) => (b.in + b.out) - (a.in + a.out));

  // ── Expense categories ────────────────────────────────────────
  const expCatMap: Record<string, number> = {};
  expenses.forEach((e) => {
    expCatMap[e.category] = (expCatMap[e.category] || 0) + e.amount;
  });
  const expCats = Object.entries(expCatMap).sort(([, a], [, b]) => b - a);

  // ── Pending bills ─────────────────────────────────────────────
  const pendingSales = bills.filter((b) => b.paymentStatus !== "paid").sort((a, b) => new Date(a.dueDate || a.date).getTime() - new Date(b.dueDate || b.date).getTime());
  const pendingPurchases = purchaseBills.filter((b) => b.paymentStatus !== "paid").sort((a, b) => {
    if (!a.dueDate) return 1; if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const Header = ({ title }: { title: string }) => (
    <View style={S.header} fixed>
      <View>
        <Text style={S.coName}>{coName}</Text>
        <Text style={S.coMeta}>Full Business Report · {title}</Text>
        <Text style={S.coMeta}>Generated: {generatedAt}</Text>
      </View>
      <View style={S.rightMeta}>
        <Text style={S.rightLabel}>Net Profit</Text>
        <Text style={[S.rightValue, { color: netProfit >= 0 ? "#166534" : "#991b1b" }]}>{Rs(netProfit)}</Text>
        <Text style={S.rightLabel}>Margin: {netMargin}%</Text>
      </View>
    </View>
  );

  const Footer = () => (
    <View style={S.footer} fixed>
      <Text style={S.footerTxt}>{coName} | Business Report | {generatedAt}</Text>
      <Text style={S.footerTxt} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );

  return (
    <Document>
      {/* ── PAGE 1: Summary + Month Analysis ── */}
      <Page size="A4" style={S.page}>
        <Header title="Summary & Monthly Analysis" />

        {/* KPI Grid */}
        <View style={S.kpiGrid}>
          {[
            ["Taxable Sales (Excl. GST)", Rs(totalSales), `${bills.length} bills`],
            ...(gstOnSales > 0 ? [["GST Collected (Payable)", Rs(gstOnSales), "Output Tax"]] : []),
            ["Total Purchase", Rs(totalPurchase), `${purchaseBills.length} bills`],
            ["Gross Profit", Rs(grossProfit), `Margin: ${grossMargin}%`],
            ["Net Profit", Rs(netProfit), `Margin: ${netMargin}%`],
            ["Collected (Sales)", Rs(totalCollected), `Pending: ${Rs(totalReceivable)}`],
            ["Paid (Purchase)", Rs(totalPaid), `Pending: ${Rs(totalPayable)}`],
            ["Total Receivable", Rs(totalReceivable), `${pendingSales.length} pending bills`],
            ["Total Payable", Rs(totalPayable), `${pendingPurchases.length} pending bills`],
            ["Total Expenses", Rs(totalExpenses), `${expenses.length} entries`],
            ["Total Parties", `${partyList.length}`, `of ${clients.length} clients`],
            ["Cash In (Sales)", Rs(bills.flatMap((b) => (b.payments || []).filter((p) => p.method === "Cash")).reduce((s, p) => s + p.amount, 0)), "Cash payments received"],
            ["Bank In (Sales)", Rs(bills.flatMap((b) => (b.payments || []).filter((p) => p.method !== "Cash")).reduce((s, p) => s + p.amount, 0)), "Bank/UPI/Other received"],
          ].map(([label, value, sub], i) => (
            <View key={i} style={S.kpiCell}>
              <Text style={S.kpiLabel}>{label}</Text>
              <Text style={S.kpiValue}>{value}</Text>
              {sub ? <Text style={S.kpiSub}>{sub}</Text> : null}
            </View>
          ))}
        </View>

        {/* Monthly Analysis */}
        <Text style={S.sectionTitle}>Month-wise Business Analysis ({monthlyData.length} months)</Text>
        {monthlyData.length === 0 ? (
          <Text style={S.empty}>No data found.</Text>
        ) : (
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.th, { width: 60 }]}>Month</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Sales</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Purchase</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Expenses</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Gross Profit</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Net Profit</Text>
              <Text style={[S.thRight, { width: 50 }]}>Margin%</Text>
            </View>
            {monthlyData.map((m, i) => {
              const gross = m.sales - m.purchase;
              const net = m.profit;
              const margin = m.sales > 0 ? ((net / m.sales) * 100).toFixed(1) : "0.0";
              return (
                <View key={m.label} style={i % 2 === 0 ? S.row : S.rowAlt}>
                  <Text style={[S.td, { width: 60, fontWeight: "bold" }]}>{m.label}</Text>
                  <Text style={[S.tdGreen, { flex: 1 }]}>{Rs(m.sales)}</Text>
                  <Text style={[S.tdRed, { flex: 1 }]}>{Rs(m.purchase)}</Text>
                  <Text style={[S.tdRight, { flex: 1, color: "#92400e" }]}>{Rs(m.expenses)}</Text>
                  <Text style={[gross >= 0 ? S.tdGreen : S.tdRed, { flex: 1 }]}>{Rs(gross)}</Text>
                  <Text style={[net >= 0 ? S.tdGreen : S.tdRed, { flex: 1 }]}>{Rs(net)}</Text>
                  <Text style={[S.tdRight, { width: 50, color: net >= 0 ? "#166534" : "#991b1b" }]}>{margin}%</Text>
                </View>
              );
            })}
            <View style={S.totalsRow}>
              <Text style={[S.th, { width: 60 }]}>TOTAL</Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(totalSales)}</Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(totalPurchase)}</Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(totalExpenses)}</Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(grossProfit)}</Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(netProfit)}</Text>
              <Text style={[S.thRight, { width: 50 }]}>{netMargin}%</Text>
            </View>
          </View>
        )}

        <Footer />
      </Page>

      {/* ── PAGE 2: Party Analysis ── */}
      <Page size="A4" style={S.page}>
        <Header title="Party Analysis" />

        <Text style={[S.sectionTitle, { marginTop: 0 }]}>Top Parties by Sales ({topSaleParties.length})</Text>
        {topSaleParties.length === 0 ? (
          <Text style={S.empty}>No party data.</Text>
        ) : (
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.th, { width: 20 }]}>#</Text>
              <Text style={[S.th, { flex: 2 }]}>Party</Text>
              <Text style={[S.th, { width: 70 }]}>Phone</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Total Sales</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Collected</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Outstanding</Text>
              <Text style={[S.thRight, { width: 34 }]}>Bills</Text>
            </View>
            {topSaleParties.map((p, i) => (
              <View key={p.name + i} style={i % 2 === 0 ? S.row : S.rowAlt}>
                <Text style={[S.tdMuted, { width: 20 }]}>{i + 1}</Text>
                <Text style={[S.td, { flex: 2 }]}>{p.name}</Text>
                <Text style={[S.tdMuted, { width: 70 }]}>{p.phone || "-"}</Text>
                <Text style={[S.tdGreen, { flex: 1 }]}>{Rs(p.sales)}</Text>
                <Text style={[S.tdRight, { flex: 1 }]}>{Rs(p.collected)}</Text>
                <Text style={[p.sales - p.collected > 0 ? S.tdRed : S.tdRight, { flex: 1 }]}>{Rs(Math.max(0, p.sales - p.collected))}</Text>
                <Text style={[S.tdRight, { width: 34 }]}>{p.billCount}</Text>
              </View>
            ))}
            <View style={S.totalsRow}>
              <Text style={[S.th, { width: 20 }]}></Text>
              <Text style={[S.th, { flex: 2 }]}>TOTAL ({topSaleParties.length} parties)</Text>
              <Text style={[S.th, { width: 70 }]}></Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(topSaleParties.reduce((s, p) => s + p.sales, 0))}</Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(topSaleParties.reduce((s, p) => s + p.collected, 0))}</Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(topSaleParties.reduce((s, p) => s + Math.max(0, p.sales - p.collected), 0))}</Text>
              <Text style={[S.thRight, { width: 34 }]}>{topSaleParties.reduce((s, p) => s + p.billCount, 0)}</Text>
            </View>
          </View>
        )}

        <Text style={S.sectionTitle}>Top Parties by Purchase ({topPurchaseParties.length})</Text>
        {topPurchaseParties.length === 0 ? (
          <Text style={S.empty}>No purchase party data.</Text>
        ) : (
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.th, { width: 20 }]}>#</Text>
              <Text style={[S.th, { flex: 2 }]}>Party</Text>
              <Text style={[S.th, { width: 70 }]}>Phone</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Total Purchase</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Paid</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Outstanding</Text>
              <Text style={[S.thRight, { width: 34 }]}>Bills</Text>
            </View>
            {topPurchaseParties.map((p, i) => (
              <View key={p.name + i} style={i % 2 === 0 ? S.row : S.rowAlt}>
                <Text style={[S.tdMuted, { width: 20 }]}>{i + 1}</Text>
                <Text style={[S.td, { flex: 2 }]}>{p.name}</Text>
                <Text style={[S.tdMuted, { width: 70 }]}>{p.phone || "-"}</Text>
                <Text style={[S.tdRed, { flex: 1 }]}>{Rs(p.purchase)}</Text>
                <Text style={[S.tdRight, { flex: 1 }]}>{Rs(p.paid)}</Text>
                <Text style={[p.purchase - p.paid > 0 ? S.tdRed : S.tdRight, { flex: 1 }]}>{Rs(Math.max(0, p.purchase - p.paid))}</Text>
                <Text style={[S.tdRight, { width: 34 }]}>{p.purchaseCount}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Payment Mode Analysis */}
        <Text style={S.sectionTitle}>Payment Mode Breakdown</Text>
        <View style={S.table}>
          <View style={S.thead}>
            <Text style={[S.th, { flex: 1 }]}>Mode</Text>
            <Text style={[S.thRight, { flex: 1 }]}>Collected (Sales)</Text>
            <Text style={[S.thRight, { flex: 1 }]}>Paid (Purchase)</Text>
            <Text style={[S.thRight, { flex: 1 }]}>Net</Text>
          </View>
          {payModes.length === 0 ? (
            <View style={S.row}><Text style={[S.empty, { flex: 1 }]}>No payment data.</Text></View>
          ) : (
            payModes.map(([mode, data], i) => (
              <View key={mode} style={i % 2 === 0 ? S.row : S.rowAlt}>
                <Text style={[S.td, { flex: 1 }]}>{mode}</Text>
                <Text style={[S.tdGreen, { flex: 1 }]}>{Rs(data.in)}</Text>
                <Text style={[S.tdRed, { flex: 1 }]}>{Rs(data.out)}</Text>
                <Text style={[data.in - data.out >= 0 ? S.tdGreen : S.tdRed, { flex: 1 }]}>{Rs(data.in - data.out)}</Text>
              </View>
            ))
          )}
          <View style={S.totalsRow}>
            <Text style={[S.th, { flex: 1 }]}>TOTAL</Text>
            <Text style={[S.thRight, { flex: 1 }]}>{Rs(payModes.reduce((s, [, d]) => s + d.in, 0))}</Text>
            <Text style={[S.thRight, { flex: 1 }]}>{Rs(payModes.reduce((s, [, d]) => s + d.out, 0))}</Text>
            <Text style={[S.thRight, { flex: 1 }]}>{Rs(payModes.reduce((s, [, d]) => s + d.in - d.out, 0))}</Text>
          </View>
        </View>

        <Footer />
      </Page>

      {/* ── PAGE 3: All Sales Bills ── */}
      <Page size="A4" style={S.page}>
        <Header title="All Sales Bills" />

        <Text style={[S.sectionTitle, { marginTop: 0 }]}>Sales Bills ({bills.length} total)</Text>
        {bills.length === 0 ? (
          <Text style={S.empty}>No sales bills found.</Text>
        ) : (
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.th, { width: 20 }]}>#</Text>
              <Text style={[S.th, { width: 54 }]}>Date</Text>
              <Text style={[S.th, { flex: 2 }]}>Party</Text>
              <Text style={[S.th, { width: 56 }]}>Bill #</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Amount</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Paid</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Balance</Text>
              <Text style={[S.th, { width: 52 }]}>Status</Text>
            </View>
            {[...bills]
              .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
              .map((bill, i) => {
                const bal = Math.max(0, (bill.total || 0) - (bill.paidAmount || 0));
                return (
                  <View key={bill.id} style={i % 2 === 0 ? S.row : S.rowAlt}>
                    <Text style={[S.tdMuted, { width: 20 }]}>{i + 1}</Text>
                    <Text style={[S.tdMuted, { width: 54 }]}>{fmtDate(bill.date || bill.createdAt)}</Text>
                    <Text style={[S.td, { flex: 2 }]} numberOfLines={1}>{bill.client?.name || "-"}</Text>
                    <Text style={[S.tdMuted, { width: 56 }]}>{bill.billNumber || "-"}</Text>
                    <Text style={[S.tdRightBold, { flex: 1 }]}>{Rs(bill.total || 0)}</Text>
                    <Text style={[S.tdGreen, { flex: 1 }]}>{Rs(bill.paidAmount || 0)}</Text>
                    <Text style={[bal > 0 ? S.tdRed : S.tdRight, { flex: 1 }]}>{Rs(bal)}</Text>
                    <Text style={[S.td, { width: 52, fontSize: 6.5 }]}>{bill.paymentStatus}</Text>
                  </View>
                );
              })}
            <View style={S.totalsRow}>
              <Text style={[S.th, { width: 20 }]}></Text>
              <Text style={[S.th, { width: 54 }]}></Text>
              <Text style={[S.th, { flex: 2 }]}>GRAND TOTAL ({bills.length} bills)</Text>
              <Text style={[S.th, { width: 56 }]}></Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(totalSales)}</Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(totalCollected)}</Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(totalReceivable)}</Text>
              <Text style={[S.th, { width: 52 }]}></Text>
            </View>
          </View>
        )}

        <Footer />
      </Page>

      {/* ── PAGE 4: All Purchase Bills ── */}
      <Page size="A4" style={S.page}>
        <Header title="All Purchase Bills" />

        <Text style={[S.sectionTitle, { marginTop: 0 }]}>Purchase Bills ({purchaseBills.length} total)</Text>
        {purchaseBills.length === 0 ? (
          <Text style={S.empty}>No purchase bills found.</Text>
        ) : (
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.th, { width: 20 }]}>#</Text>
              <Text style={[S.th, { width: 54 }]}>Date</Text>
              <Text style={[S.th, { flex: 2 }]}>Party/Vendor</Text>
              <Text style={[S.th, { width: 56 }]}>Bill #</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Amount</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Paid</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Balance</Text>
              <Text style={[S.th, { width: 52 }]}>Status</Text>
            </View>
            {[...purchaseBills]
              .sort((a, b) => new Date(b.billDate || b.createdAt).getTime() - new Date(a.billDate || a.createdAt).getTime())
              .map((bill, i) => {
                const bal = Math.max(0, (bill.total || 0) - (bill.paidAmount || 0));
                return (
                  <View key={bill.id} style={i % 2 === 0 ? S.row : S.rowAlt}>
                    <Text style={[S.tdMuted, { width: 20 }]}>{i + 1}</Text>
                    <Text style={[S.tdMuted, { width: 54 }]}>{fmtDate(bill.billDate || bill.createdAt)}</Text>
                    <Text style={[S.td, { flex: 2 }]} numberOfLines={1}>{bill.vendorName || "-"}</Text>
                    <Text style={[S.tdMuted, { width: 56 }]}>{bill.billNumber || "-"}</Text>
                    <Text style={[S.tdRightBold, { flex: 1 }]}>{Rs(bill.total || 0)}</Text>
                    <Text style={[S.tdGreen, { flex: 1 }]}>{Rs(bill.paidAmount || 0)}</Text>
                    <Text style={[bal > 0 ? S.tdRed : S.tdRight, { flex: 1 }]}>{Rs(bal)}</Text>
                    <Text style={[S.td, { width: 52, fontSize: 6.5 }]}>{bill.paymentStatus}</Text>
                  </View>
                );
              })}
            <View style={S.totalsRow}>
              <Text style={[S.th, { width: 20 }]}></Text>
              <Text style={[S.th, { width: 54 }]}></Text>
              <Text style={[S.th, { flex: 2 }]}>GRAND TOTAL ({purchaseBills.length} bills)</Text>
              <Text style={[S.th, { width: 56 }]}></Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(totalPurchase)}</Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(totalPaid)}</Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(totalPayable)}</Text>
              <Text style={[S.th, { width: 52 }]}></Text>
            </View>
          </View>
        )}

        <Footer />
      </Page>

      {/* ── PAGE 5: Outstanding + Expenses ── */}
      <Page size="A4" style={S.page}>
        <Header title="Outstanding & Expenses" />

        {/* Pending Sales */}
        <Text style={[S.sectionTitle, { marginTop: 0 }]}>Pending Receivables ({pendingSales.length})</Text>
        {pendingSales.length === 0 ? (
          <Text style={S.empty}>No pending receivables.</Text>
        ) : (
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.th, { width: 54 }]}>Date</Text>
              <Text style={[S.th, { flex: 2 }]}>Party</Text>
              <Text style={[S.th, { width: 56 }]}>Bill #</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Total</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Paid</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Due</Text>
              <Text style={[S.th, { width: 54 }]}>Due Date</Text>
              <Text style={[S.th, { width: 46 }]}>Status</Text>
            </View>
            {pendingSales.map((bill, i) => {
              const bal = Math.max(0, (bill.total || 0) - (bill.paidAmount || 0));
              const over = bill.dueDate && new Date(bill.dueDate) < new Date();
              return (
                <View key={bill.id} style={i % 2 === 0 ? S.row : S.rowAlt}>
                  <Text style={[S.tdMuted, { width: 54 }]}>{fmtDate(bill.date || bill.createdAt)}</Text>
                  <Text style={[S.td, { flex: 2 }]} numberOfLines={1}>{bill.client?.name || "-"}</Text>
                  <Text style={[S.tdMuted, { width: 56 }]}>{bill.billNumber || "-"}</Text>
                  <Text style={[S.tdRightBold, { flex: 1 }]}>{Rs(bill.total || 0)}</Text>
                  <Text style={[S.tdRight, { flex: 1 }]}>{Rs(bill.paidAmount || 0)}</Text>
                  <Text style={[S.tdRed, { flex: 1 }]}>{Rs(bal)}</Text>
                  <Text style={[over ? S.tdRed : S.tdMuted, { width: 54 }]}>{bill.dueDate ? fmtDate(bill.dueDate) : "-"}</Text>
                  <Text style={[S.td, { width: 46, fontSize: 6.5 }]}>{bill.paymentStatus}</Text>
                </View>
              );
            })}
            <View style={S.totalsRow}>
              <Text style={[S.th, { flex: 1 }]}>Total Outstanding Receivable</Text>
              <Text style={[S.thRight, { width: 80 }]}>{Rs(pendingSales.reduce((s, b) => s + Math.max(0, (b.total || 0) - (b.paidAmount || 0)), 0))}</Text>
            </View>
          </View>
        )}

        {/* Pending Purchases */}
        <Text style={S.sectionTitle}>Pending Payables ({pendingPurchases.length})</Text>
        {pendingPurchases.length === 0 ? (
          <Text style={S.empty}>No pending payables.</Text>
        ) : (
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.th, { width: 54 }]}>Date</Text>
              <Text style={[S.th, { flex: 2 }]}>Party/Vendor</Text>
              <Text style={[S.th, { width: 56 }]}>Bill #</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Total</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Paid</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Due</Text>
              <Text style={[S.th, { width: 54 }]}>Due Date</Text>
              <Text style={[S.th, { width: 46 }]}>Status</Text>
            </View>
            {pendingPurchases.map((bill, i) => {
              const bal = Math.max(0, (bill.total || 0) - (bill.paidAmount || 0));
              const over = bill.dueDate && new Date(bill.dueDate) < new Date();
              return (
                <View key={bill.id} style={i % 2 === 0 ? S.row : S.rowAlt}>
                  <Text style={[S.tdMuted, { width: 54 }]}>{fmtDate(bill.billDate || bill.createdAt)}</Text>
                  <Text style={[S.td, { flex: 2 }]} numberOfLines={1}>{bill.vendorName || "-"}</Text>
                  <Text style={[S.tdMuted, { width: 56 }]}>{bill.billNumber || "-"}</Text>
                  <Text style={[S.tdRightBold, { flex: 1 }]}>{Rs(bill.total || 0)}</Text>
                  <Text style={[S.tdRight, { flex: 1 }]}>{Rs(bill.paidAmount || 0)}</Text>
                  <Text style={[S.tdRed, { flex: 1 }]}>{Rs(bal)}</Text>
                  <Text style={[over ? S.tdRed : S.tdMuted, { width: 54 }]}>{bill.dueDate ? fmtDate(bill.dueDate) : "-"}</Text>
                  <Text style={[S.td, { width: 46, fontSize: 6.5 }]}>{bill.paymentStatus}</Text>
                </View>
              );
            })}
            <View style={S.totalsRow}>
              <Text style={[S.th, { flex: 1 }]}>Total Outstanding Payable</Text>
              <Text style={[S.thRight, { width: 80 }]}>{Rs(pendingPurchases.reduce((s, b) => s + Math.max(0, (b.total || 0) - (b.paidAmount || 0)), 0))}</Text>
            </View>
          </View>
        )}

        {/* Expense Breakdown */}
        <Text style={S.sectionTitle}>Expense Breakdown by Category ({expenses.length} entries)</Text>
        {expCats.length === 0 ? (
          <Text style={S.empty}>No expenses recorded.</Text>
        ) : (
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.th, { flex: 2 }]}>Category</Text>
              <Text style={[S.thRight, { flex: 1 }]}>Total Amount</Text>
              <Text style={[S.thRight, { width: 60 }]}>% of Expenses</Text>
            </View>
            {expCats.map(([cat, amt], i) => (
              <View key={cat} style={i % 2 === 0 ? S.row : S.rowAlt}>
                <Text style={[S.td, { flex: 2 }]}>{cat || "Uncategorized"}</Text>
                <Text style={[S.tdRightBold, { flex: 1 }]}>{Rs(amt)}</Text>
                <Text style={[S.tdRight, { width: 60 }]}>
                  {totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(1) : "0.0"}%
                </Text>
              </View>
            ))}
            <View style={S.totalsRow}>
              <Text style={[S.th, { flex: 2 }]}>TOTAL EXPENSES</Text>
              <Text style={[S.thRight, { flex: 1 }]}>{Rs(totalExpenses)}</Text>
              <Text style={[S.thRight, { width: 60 }]}>100%</Text>
            </View>
          </View>
        )}

        <Footer />
      </Page>
    </Document>
  );
}
