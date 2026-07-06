import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  Client,
  CompanyProfile,
  Bill,
  PurchaseBill,
  BillReturn,
  PurchaseReturn,
  PartyPayment,
} from "@/types";

function fmtDate(d: string) {
  try {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, "0")}/${String(
      dt.getMonth() + 1,
    ).padStart(2, "0")}/${dt.getFullYear()}`;
  } catch {
    return d || "-";
  }
}

function Rs(n: number) {
  return `Rs.${Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const S = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 30,
    paddingBottom: 44,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1.5,
    borderBottomColor: "#334155",
    paddingBottom: 10,
    marginBottom: 14,
  },
  coName: { fontSize: 15, fontWeight: "bold", color: "#0f172a" },
  coSub: { fontSize: 8, color: "#64748b", marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  headerLabel: { fontSize: 7.5, color: "#64748b" },
  headerDate: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 1,
  },

  /* ── Party info box ── */
  partyBox: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
  },
  partyName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 3,
  },
  partyLine: { fontSize: 8, color: "#475569", marginBottom: 1.5 },
  balanceBox: {
    alignItems: "flex-end",
    justifyContent: "center",
    paddingLeft: 12,
  },
  balLabel: { fontSize: 7.5, color: "#64748b", marginBottom: 2 },
  balAmount: { fontSize: 13, fontWeight: "bold" },
  balNote: { fontSize: 7, color: "#64748b", marginTop: 2 },

  /* ── Summary row ── */
  summaryRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 14,
  },
  summaryCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  sumLabel: { fontSize: 7, color: "#64748b", marginBottom: 3 },
  sumValue: { fontSize: 10, fontWeight: "bold", color: "#0f172a" },
  sumSub: { fontSize: 6.5, color: "#94a3b8", marginTop: 2 },

  /* ── Section heading ── */
  sectionHead: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 5,
    marginTop: 12,
    paddingBottom: 3,
    borderBottomWidth: 0.8,
    borderBottomColor: "#cbd5e1",
  },

  /* ── Table ── */
  table: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  thead: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  th: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#475569",
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  thR: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#475569",
    paddingVertical: 5,
    paddingHorizontal: 7,
    textAlign: "right",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  rowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  td: {
    fontSize: 8,
    color: "#1e293b",
    paddingVertical: 4.5,
    paddingHorizontal: 7,
  },
  tdM: {
    fontSize: 7.5,
    color: "#64748b",
    paddingVertical: 4.5,
    paddingHorizontal: 7,
  },
  tdR: {
    fontSize: 8,
    color: "#1e293b",
    paddingVertical: 4.5,
    paddingHorizontal: 7,
    textAlign: "right",
  },
  tdRB: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1e293b",
    paddingVertical: 4.5,
    paddingHorizontal: 7,
    textAlign: "right",
  },
  tdGreen: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#166534",
    paddingVertical: 4.5,
    paddingHorizontal: 7,
    textAlign: "right",
  },
  tdRed: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#991b1b",
    paddingVertical: 4.5,
    paddingHorizontal: 7,
    textAlign: "right",
  },
  totals: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
  },
  empty: {
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 10,
  },

  /* ── Footer ── */
  footer: {
    position: "absolute",
    left: 30,
    right: 30,
    bottom: 14,
    borderTopWidth: 0.7,
    borderTopColor: "#cbd5e1",
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerTxt: { fontSize: 6.5, color: "#94a3b8" },
});

interface Props {
  party: Client;
  transactions: {
    date: string;
    type: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
  salesBills: Bill[];
  purchaseBills: PurchaseBill[];
  saleReturns: BillReturn[];
  purchaseReturns: PurchaseReturn[];
  partyPayments: PartyPayment[];
  openingBalance?: number;
  stats: {
    totalSales: number;
    totalPurchases: number;
    totalCollected: number;
    totalSent: number;
    netBalance: number;
    totalReceivable: number;
    totalPayable: number;
  };
  companyProfile?: CompanyProfile | null;
}

export function PartyLedgerPDF({
  party,
  salesBills,
  purchaseBills,
  saleReturns,
  purchaseReturns,
  partyPayments,
  openingBalance = 0,
  stats,
  companyProfile,
}: Props) {
  const now = new Date();
  const generatedAt =
    fmtDate(now.toISOString()) +
    "  " +
    now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const coName = companyProfile?.name || "Ibell";

  const netBal = stats.netBalance;
  const owesYou = netBal >= 0;

  // All payments combined (simple flat list)
  const allPayments = [
    ...salesBills.flatMap((b) =>
      (b.payments || []).map((p) => ({
        date: p.date || b.date,
        desc: `Received — Sale Bill #${b.billNumber || "-"}`,
        method: p.method,
        amount: p.amount,
        dir: "in" as const,
      })),
    ),
    ...purchaseBills.flatMap((b) =>
      (b.payments || [])
        .filter((p) => p.amount > 0)
        .map((p) => ({
          date: p.date || b.billDate || b.createdAt,
          desc: `Paid — Purchase Bill #${b.billNumber || "-"}`,
          method: p.method,
          amount: p.amount,
          dir: "out" as const,
        })),
    ),
    ...partyPayments.map((p) => ({
      date: p.date,
      desc:
        p.type === "collected"
          ? "Manual Payment Received"
          : "Manual Payment Sent",
      method: p.method,
      amount: p.amount,
      dir: (p.type === "collected" ? "in" : "out") as "in" | "out",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalPaymentsIn = allPayments
    .filter((p) => p.dir === "in")
    .reduce((s, p) => s + p.amount, 0);
  const totalPaymentsOut = allPayments
    .filter((p) => p.dir === "out")
    .reduce((s, p) => s + p.amount, 0);
  const totalSaleReturns = saleReturns.reduce(
    (s, r) => s + r.totalReturnValue,
    0,
  );
  const totalPurchaseReturns = purchaseReturns.reduce(
    (s, r) => s + r.totalReturnValue,
    0,
  );

  const Header = () => (
    <View style={S.header} fixed>
      <View>
        <Text style={S.coName}>{coName}</Text>
        <Text style={S.coSub}>Party Account Statement</Text>
      </View>
      <View style={S.headerRight}>
        <Text style={S.headerLabel}>Generated on</Text>
        <Text style={S.headerDate}>{generatedAt}</Text>
      </View>
    </View>
  );

  const Footer = () => (
    <View style={S.footer} fixed>
      <Text style={S.footerTxt}>
        {coName} | Party: {party.name}
      </Text>
      <Text
        style={S.footerTxt}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={S.page}>
        <Header />

        {/* ── Party Info ── */}
        <View style={S.partyBox}>
          <View style={{ flex: 1 }}>
            <Text style={S.partyName}>{party.name}</Text>
            {party.phone ? (
              <Text style={S.partyLine}>Phone: {party.phone}</Text>
            ) : null}
            {party.billingAddress ? (
              <Text style={S.partyLine}>Address: {party.billingAddress}</Text>
            ) : null}
            {party.email ? (
              <Text style={S.partyLine}>Email: {party.email}</Text>
            ) : null}
            {Math.abs(openingBalance || 0) > 0 ? (
              <Text style={S.partyLine}>
                Opening Balance: {Rs(Math.abs(openingBalance || 0))}
              </Text>
            ) : null}
          </View>
          <View style={S.balanceBox}>
            <Text style={S.balLabel}>NET BALANCE</Text>
            <Text
              style={[S.balAmount, { color: owesYou ? "#166534" : "#991b1b" }]}
            >
              {Rs(Math.abs(netBal))}
            </Text>
            <Text style={S.balNote}>
              {owesYou ? "Party owes you" : "You owe party"}
            </Text>
          </View>
        </View>

        {/* ── Summary ── */}
        <View style={S.summaryRow}>
          <View style={S.summaryCell}>
            <Text style={S.sumLabel}>TOTAL SALES</Text>
            <Text style={[S.sumValue, { color: "#166534" }]}>
              {Rs(stats.totalSales)}
            </Text>
            <Text style={S.sumSub}>{salesBills.length} bills</Text>
          </View>
          <View style={S.summaryCell}>
            <Text style={S.sumLabel}>TOTAL PURCHASES</Text>
            <Text style={[S.sumValue, { color: "#1d4ed8" }]}>
              {Rs(stats.totalPurchases)}
            </Text>
            <Text style={S.sumSub}>{purchaseBills.length} bills</Text>
          </View>
          <View style={S.summaryCell}>
            <Text style={S.sumLabel}>AMOUNT RECEIVED</Text>
            <Text style={[S.sumValue, { color: "#166534" }]}>
              {Rs(totalPaymentsIn)}
            </Text>
            <Text style={S.sumSub}>From party</Text>
          </View>
          <View style={S.summaryCell}>
            <Text style={S.sumLabel}>AMOUNT PAID</Text>
            <Text style={[S.sumValue, { color: "#991b1b" }]}>
              {Rs(totalPaymentsOut)}
            </Text>
            <Text style={S.sumSub}>To party</Text>
          </View>
          <View style={[S.summaryCell, { borderRightWidth: 0 }]}>
            <Text style={S.sumLabel}>OUTSTANDING</Text>
            <Text
              style={[
                S.sumValue,
                { color: stats.totalReceivable > 0 ? "#b45309" : "#64748b" },
              ]}
            >
              {Rs(stats.totalReceivable)}
            </Text>
            <Text style={S.sumSub}>To collect</Text>
          </View>
        </View>

        {/* ── Sales Bills ── */}
        <Text style={S.sectionHead}>Sales Bills ({salesBills.length})</Text>
        {salesBills.length === 0 ? (
          <Text style={S.empty}>No sales bills.</Text>
        ) : (
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.th, { width: 22 }]}>#</Text>
              <Text style={[S.th, { width: 58 }]}>Date</Text>
              <Text style={[S.th, { width: 64 }]}>Bill No.</Text>
              <Text style={[S.th, { flex: 1 }]}>Items</Text>
              <Text style={[S.thR, { width: 78 }]}>Bill Amount</Text>
              <Text style={[S.thR, { width: 74 }]}>Paid</Text>
              <Text style={[S.thR, { width: 74 }]}>Balance Due</Text>
              <Text style={[S.th, { width: 52 }]}>Status</Text>
            </View>
            {[...salesBills]
              .sort(
                (a, b) =>
                  new Date(b.date || b.createdAt).getTime() -
                  new Date(a.date || a.createdAt).getTime(),
              )
              .map((bill, i) => {
                const due = Math.max(
                  0,
                  (bill.total || 0) - (bill.paidAmount || 0),
                );
                const items = (bill.items || [])
                  .map((it) => it.productName)
                  .join(", ");
                return (
                  <View key={bill.id} style={i % 2 === 0 ? S.row : S.rowAlt}>
                    <Text style={[S.tdM, { width: 22 }]}>{i + 1}</Text>
                    <Text style={[S.tdM, { width: 58 }]}>
                      {fmtDate(bill.date || bill.createdAt)}
                    </Text>
                    <Text style={[S.td, { width: 64 }]}>
                      {bill.billNumber || "-"}
                    </Text>
                    <Text style={[S.tdM, { flex: 1 }]} numberOfLines={1}>
                      {items || "-"}
                    </Text>
                    <Text style={[S.tdRB, { width: 78 }]}>
                      {Rs(bill.total || 0)}
                    </Text>
                    <Text style={[S.tdGreen, { width: 74 }]}>
                      {Rs(bill.paidAmount || 0)}
                    </Text>
                    <Text style={[due > 0 ? S.tdRed : S.tdR, { width: 74 }]}>
                      {Rs(due)}
                    </Text>
                    <Text style={[S.tdM, { width: 52, fontSize: 7 }]}>
                      {bill.paymentStatus}
                    </Text>
                  </View>
                );
              })}
            <View style={S.totals}>
              <Text style={[S.th, { width: 22 }]}></Text>
              <Text style={[S.th, { width: 58 }]}></Text>
              <Text style={[S.th, { width: 64 }]}></Text>
              <Text style={[S.th, { flex: 1 }]}>
                Total ({salesBills.length} bills)
              </Text>
              <Text style={[S.thR, { width: 78 }]}>
                {Rs(salesBills.reduce((s, b) => s + (b.total || 0), 0))}
              </Text>
              <Text style={[S.thR, { width: 74 }]}>
                {Rs(salesBills.reduce((s, b) => s + (b.paidAmount || 0), 0))}
              </Text>
              <Text style={[S.thR, { width: 74 }]}>
                {Rs(stats.totalReceivable)}
              </Text>
              <Text style={[S.th, { width: 52 }]}></Text>
            </View>
          </View>
        )}

        {/* ── Sale Returns ── */}
        {saleReturns.length > 0 && (
          <>
            <Text style={S.sectionHead}>
              Sale Returns ({saleReturns.length})
            </Text>
            <View style={S.table}>
              <View style={S.thead}>
                <Text style={[S.th, { width: 58 }]}>Date</Text>
                <Text style={[S.th, { width: 64 }]}>Bill No.</Text>
                <Text style={[S.th, { flex: 1 }]}>Items Returned</Text>
                <Text style={[S.thR, { width: 88 }]}>Return Value</Text>
              </View>
              {saleReturns.map((ret, i) => (
                <View key={ret.id} style={i % 2 === 0 ? S.row : S.rowAlt}>
                  <Text style={[S.tdM, { width: 58 }]}>
                    {fmtDate(ret.returnDate || ret.createdAt)}
                  </Text>
                  <Text style={[S.td, { width: 64 }]}>
                    {ret.billNumber || "-"}
                  </Text>
                  <Text style={[S.tdM, { flex: 1 }]} numberOfLines={1}>
                    {ret.items.map((it) => it.productName).join(", ") || "-"}
                  </Text>
                  <Text style={[S.tdRed, { width: 88 }]}>
                    -{Rs(ret.totalReturnValue)}
                  </Text>
                </View>
              ))}
              <View style={S.totals}>
                <Text style={[S.th, { flex: 1 }]}>Total Sale Returns</Text>
                <Text style={[S.thR, { width: 88 }]}>
                  -{Rs(totalSaleReturns)}
                </Text>
              </View>
            </View>
          </>
        )}

        <Footer />
      </Page>

      <Page size="A4" style={S.page}>
        <Header />

        {/* ── Purchase Bills ── */}
        <Text style={[S.sectionHead, { marginTop: 0 }]}>
          Purchase Bills ({purchaseBills.length})
        </Text>
        {purchaseBills.length === 0 ? (
          <Text style={S.empty}>No purchase bills.</Text>
        ) : (
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.th, { width: 22 }]}>#</Text>
              <Text style={[S.th, { width: 58 }]}>Date</Text>
              <Text style={[S.th, { width: 64 }]}>Bill No.</Text>
              <Text style={[S.th, { flex: 1 }]}>Items</Text>
              <Text style={[S.thR, { width: 78 }]}>Bill Amount</Text>
              <Text style={[S.thR, { width: 74 }]}>Paid</Text>
              <Text style={[S.thR, { width: 74 }]}>Balance Due</Text>
              <Text style={[S.th, { width: 52 }]}>Status</Text>
            </View>
            {[...purchaseBills]
              .sort(
                (a, b) =>
                  new Date(b.billDate || b.createdAt).getTime() -
                  new Date(a.billDate || a.createdAt).getTime(),
              )
              .map((bill, i) => {
                const due = Math.max(
                  0,
                  (bill.total || 0) - (bill.paidAmount || 0),
                );
                const items = (bill.items || [])
                  .map((it) => it.description)
                  .join(", ");
                return (
                  <View key={bill.id} style={i % 2 === 0 ? S.row : S.rowAlt}>
                    <Text style={[S.tdM, { width: 22 }]}>{i + 1}</Text>
                    <Text style={[S.tdM, { width: 58 }]}>
                      {fmtDate(bill.billDate || bill.createdAt)}
                    </Text>
                    <Text style={[S.td, { width: 64 }]}>
                      {bill.billNumber || "-"}
                    </Text>
                    <Text style={[S.tdM, { flex: 1 }]} numberOfLines={1}>
                      {items || "-"}
                    </Text>
                    <Text style={[S.tdRB, { width: 78 }]}>
                      {Rs(bill.total || 0)}
                    </Text>
                    <Text style={[S.tdGreen, { width: 74 }]}>
                      {Rs(bill.paidAmount || 0)}
                    </Text>
                    <Text style={[due > 0 ? S.tdRed : S.tdR, { width: 74 }]}>
                      {Rs(due)}
                    </Text>
                    <Text style={[S.tdM, { width: 52, fontSize: 7 }]}>
                      {bill.paymentStatus}
                    </Text>
                  </View>
                );
              })}
            <View style={S.totals}>
              <Text style={[S.th, { width: 22 }]}></Text>
              <Text style={[S.th, { width: 58 }]}></Text>
              <Text style={[S.th, { width: 64 }]}></Text>
              <Text style={[S.th, { flex: 1 }]}>
                Total ({purchaseBills.length} bills)
              </Text>
              <Text style={[S.thR, { width: 78 }]}>
                {Rs(purchaseBills.reduce((s, b) => s + (b.total || 0), 0))}
              </Text>
              <Text style={[S.thR, { width: 74 }]}>
                {Rs(purchaseBills.reduce((s, b) => s + (b.paidAmount || 0), 0))}
              </Text>
              <Text style={[S.thR, { width: 74 }]}>
                {Rs(stats.totalPayable)}
              </Text>
              <Text style={[S.th, { width: 52 }]}></Text>
            </View>
          </View>
        )}

        {/* ── Purchase Returns ── */}
        {purchaseReturns.length > 0 && (
          <>
            <Text style={S.sectionHead}>
              Purchase Returns ({purchaseReturns.length})
            </Text>
            <View style={S.table}>
              <View style={S.thead}>
                <Text style={[S.th, { width: 58 }]}>Date</Text>
                <Text style={[S.th, { width: 64 }]}>Bill No.</Text>
                <Text style={[S.th, { flex: 1 }]}>Items Returned</Text>
                <Text style={[S.thR, { width: 88 }]}>Return Value</Text>
              </View>
              {purchaseReturns.map((ret, i) => (
                <View key={ret.id} style={i % 2 === 0 ? S.row : S.rowAlt}>
                  <Text style={[S.tdM, { width: 58 }]}>
                    {fmtDate(ret.returnDate || ret.createdAt)}
                  </Text>
                  <Text style={[S.td, { width: 64 }]}>
                    {ret.billNumber || "-"}
                  </Text>
                  <Text style={[S.tdM, { flex: 1 }]} numberOfLines={1}>
                    {ret.items
                      .map((it) => it.description || it.productName)
                      .join(", ") || "-"}
                  </Text>
                  <Text style={[S.tdGreen, { width: 88 }]}>
                    +{Rs(ret.totalReturnValue)}
                  </Text>
                </View>
              ))}
              <View style={S.totals}>
                <Text style={[S.th, { flex: 1 }]}>Total Purchase Returns</Text>
                <Text style={[S.thR, { width: 88 }]}>
                  +{Rs(totalPurchaseReturns)}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ── Payment History ── */}
        <Text style={S.sectionHead}>
          Payment History ({allPayments.length})
        </Text>
        {allPayments.length === 0 ? (
          <Text style={S.empty}>No payments recorded.</Text>
        ) : (
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.th, { width: 58 }]}>Date</Text>
              <Text style={[S.th, { flex: 2 }]}>Description</Text>
              <Text style={[S.th, { width: 72 }]}>Method</Text>
              <Text style={[S.thR, { width: 88 }]}>Amount</Text>
            </View>
            {allPayments.map((p, i) => (
              <View key={i} style={i % 2 === 0 ? S.row : S.rowAlt}>
                <Text style={[S.tdM, { width: 58 }]}>{fmtDate(p.date)}</Text>
                <Text style={[S.td, { flex: 2 }]} numberOfLines={1}>
                  {p.desc}
                </Text>
                <Text style={[S.tdM, { width: 72 }]}>{p.method}</Text>
                <Text
                  style={[p.dir === "in" ? S.tdGreen : S.tdRed, { width: 88 }]}
                >
                  {p.dir === "in" ? "+" : "-"}
                  {Rs(p.amount)}
                </Text>
              </View>
            ))}
            <View style={S.totals}>
              <Text style={[S.th, { flex: 1 }]}>Total Received</Text>
              <Text style={[S.thR, { width: 88 }]}>+{Rs(totalPaymentsIn)}</Text>
            </View>
            <View style={S.totals}>
              <Text style={[S.th, { flex: 1 }]}>Total Paid</Text>
              <Text style={[S.thR, { width: 88 }]}>
                -{Rs(totalPaymentsOut)}
              </Text>
            </View>
          </View>
        )}

        {/* ── Final Balance Box ── */}
        <View
          style={{
            marginTop: 14,
            borderWidth: 1.5,
            borderColor: owesYou ? "#16a34a" : "#dc2626",
            borderRadius: 4,
            padding: 12,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: owesYou ? "#f0fdf4" : "#fef2f2",
          }}
        >
          <View>
            <Text style={{ fontSize: 9, color: "#64748b", marginBottom: 3 }}>
              Account Summary for {party.name}
            </Text>
            <Text style={{ fontSize: 8, color: "#64748b" }}>
              Total Sales: {Rs(stats.totalSales)} | Total Purchase:{" "}
              {Rs(stats.totalPurchases)}
            </Text>
            <Text style={{ fontSize: 8, color: "#64748b", marginTop: 1 }}>
              Amount Received: {Rs(totalPaymentsIn)} | Amount Paid:{" "}
              {Rs(totalPaymentsOut)}
            </Text>
            {(totalSaleReturns > 0 || totalPurchaseReturns > 0) && (
              <Text style={{ fontSize: 8, color: "#64748b", marginTop: 1 }}>
                Sale Returns: {Rs(totalSaleReturns)} | Purchase Returns:{" "}
                {Rs(totalPurchaseReturns)}
              </Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 8, color: "#64748b", marginBottom: 4 }}>
              NET BALANCE
            </Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "bold",
                color: owesYou ? "#166534" : "#991b1b",
              }}
            >
              {Rs(Math.abs(netBal))}
            </Text>
            <Text
              style={{
                fontSize: 8,
                color: owesYou ? "#166534" : "#991b1b",
                marginTop: 3,
                fontWeight: "bold",
              }}
            >
              {owesYou ? "Party owes you" : "You owe party"}
            </Text>
          </View>
        </View>

        <Footer />
      </Page>
    </Document>
  );
}
