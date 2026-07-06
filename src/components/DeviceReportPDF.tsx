import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

function Rs(n: number) {
  return `Rs.${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtD(d?: string) {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "-";
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
  } catch { return "-"; }
}

export interface DevicePDFRow {
  imei: string;
  productName: string;
  model?: string;
  storage?: string;
  color?: string;
  itemNo?: string;
  vendorName?: string;
  purchaseDate?: string;
  purchaseBillNo?: string;
  purchasePrice: number;
  customerName?: string;
  saleDate?: string;
  saleBillNo?: string;
  salePrice: number;
  profit: number;
  status: string;
}

export interface ModelSummaryRow {
  productName: string;
  total: number;
  inStock: number;
  sold: number;
  totalBuyCost: number;
  totalSaleRevenue: number;
  totalProfit: number;
}

interface Props {
  devices: DevicePDFRow[];
  modelSummary: ModelSummaryRow[];
  dateFrom?: string;
  dateTo?: string;
  companyName?: string;
  stats: {
    total: number;
    inStock: number;
    sold: number;
    totalPurchaseCost: number;
    totalSaleRevenue: number;
    totalProfit: number;
  };
}

const S = StyleSheet.create({
  page: { paddingTop: 22, paddingHorizontal: 22, paddingBottom: 32, fontFamily: "Helvetica", fontSize: 7.5, color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#cbd5e1", paddingBottom: 7, marginBottom: 9 },
  coName: { fontSize: 12, fontWeight: "bold" },
  title: { fontSize: 10, fontWeight: "bold", color: "#1e40af" },
  sub: { fontSize: 7, color: "#64748b", marginTop: 1 },
  statsRow: { flexDirection: "row", marginBottom: 9 },
  statBox: { flex: 1, marginHorizontal: 2, backgroundColor: "#f8fafc", borderWidth: 0.5, borderColor: "#e2e8f0", borderRadius: 3, padding: 5, alignItems: "center" },
  statLabel: { fontSize: 6, color: "#64748b", marginBottom: 1 },
  statVal: { fontSize: 8.5, fontWeight: "bold" },
  sectionTitle: { fontSize: 8, fontWeight: "bold", color: "#334155", marginBottom: 4, marginTop: 8, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f1f5f9", paddingVertical: 4, paddingHorizontal: 3, borderBottomWidth: 0.5, borderBottomColor: "#cbd5e1" },
  row: { flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 3, borderBottomWidth: 0.3, borderBottomColor: "#f1f5f9" },
  rowAlt: { backgroundColor: "#f9fafb" },
  th: { fontSize: 6.5, fontWeight: "bold", color: "#475569" },
  td: { fontSize: 6.5, color: "#334155" },
  tdm: { fontSize: 6, color: "#64748b" },
  green: { color: "#16a34a", fontWeight: "bold" },
  red: { color: "#dc2626", fontWeight: "bold" },
  blue: { color: "#2563eb" },
  orange: { color: "#ea580c" },
  right: { textAlign: "right" },
  center: { textAlign: "center" },
  footer: { position: "absolute", bottom: 12, left: 22, right: 22, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.3, borderTopColor: "#cbd5e1", paddingTop: 3 },
  footerText: { fontSize: 6, color: "#94a3b8" },
  // Device table columns (landscape A4 = 841pt wide, minus 44 margins = 797pt)
  dc1: { width: "11%" },
  dc2: { width: "15%" },
  dc3: { width: "9%" },
  dc4: { width: "7%" },
  dc5: { width: "8%", textAlign: "right" },
  dc6: { width: "10%" },
  dc7: { width: "7%" },
  dc8: { width: "8%", textAlign: "right" },
  dc9: { width: "8%", textAlign: "right" },
  dc10: { width: "7%" },
  // Model summary columns
  mc1: { width: "28%" },
  mc2: { width: "10%", textAlign: "center" },
  mc3: { width: "10%", textAlign: "center" },
  mc4: { width: "10%", textAlign: "center" },
  mc5: { width: "14%", textAlign: "right" },
  mc6: { width: "14%", textAlign: "right" },
  mc7: { width: "14%", textAlign: "right" },
});

export function DeviceReportPDF({ devices, modelSummary, dateFrom, dateTo, companyName, stats }: Props) {
  const now = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const period = dateFrom || dateTo
    ? `${dateFrom ? fmtD(dateFrom) : "All"} — ${dateTo ? fmtD(dateTo) : "All"}`
    : "All Time";

  const statCards = [
    { label: "Total Devices", value: String(stats.total), styleVal: {} },
    { label: "In Stock", value: String(stats.inStock), styleVal: S.blue },
    { label: "Sold", value: String(stats.sold), styleVal: S.green },
    { label: "Total Buy Cost", value: Rs(stats.totalPurchaseCost), styleVal: S.red },
    { label: "Total Sale Revenue", value: Rs(stats.totalSaleRevenue), styleVal: S.green },
    { label: "Total Profit", value: (stats.totalProfit >= 0 ? "+" : "") + Rs(stats.totalProfit), styleVal: stats.totalProfit >= 0 ? S.green : S.red },
  ];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.coName}>{companyName || "Business"}</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={S.title}>Device Inventory Report</Text>
            <Text style={S.sub}>Period: {period}  ·  Generated: {now}</Text>
          </View>
        </View>

        {/* Summary Stats */}
        <View style={S.statsRow}>
          {statCards.map((sc, i) => (
            <View key={i} style={S.statBox}>
              <Text style={S.statLabel}>{sc.label}</Text>
              <Text style={[S.statVal, sc.styleVal]}>{sc.value}</Text>
            </View>
          ))}
        </View>

        {/* Model-wise Summary */}
        {modelSummary.length > 0 && (
          <>
            <Text style={S.sectionTitle}>Model-wise Summary ({modelSummary.length} models)</Text>
            <View style={S.tableHeader}>
              <Text style={[S.th, S.mc1]}>Model / Product</Text>
              <Text style={[S.th, S.mc2]}>Total</Text>
              <Text style={[S.th, S.mc3]}>In Stock</Text>
              <Text style={[S.th, S.mc4]}>Sold</Text>
              <Text style={[S.th, S.mc5]}>Buy Cost</Text>
              <Text style={[S.th, S.mc6]}>Sale Revenue</Text>
              <Text style={[S.th, S.mc7]}>Profit / Loss</Text>
            </View>
            {modelSummary.map((m, i) => (
              <View key={i} style={[S.row, i % 2 === 1 ? S.rowAlt : {}]} wrap={false}>
                <Text style={[S.td, S.mc1]}>{m.productName}</Text>
                <Text style={[S.td, S.mc2]}>{m.total}</Text>
                <Text style={[S.td, S.mc3, S.blue]}>{m.inStock}</Text>
                <Text style={[S.td, S.mc4, S.green]}>{m.sold}</Text>
                <Text style={[S.td, S.mc5]}>{Rs(m.totalBuyCost)}</Text>
                <Text style={[S.td, S.mc6, S.green]}>{Rs(m.totalSaleRevenue)}</Text>
                <Text style={[S.td, S.mc7, m.totalProfit >= 0 ? S.green : S.red]}>
                  {(m.totalProfit >= 0 ? "+" : "") + Rs(m.totalProfit)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Device-wise Details */}
        <Text style={[S.sectionTitle, { marginTop: 10 }]}>Device-wise Details ({devices.length} devices)</Text>
        <View style={S.tableHeader}>
          <Text style={[S.th, S.dc1]}>IMEI</Text>
          <Text style={[S.th, S.dc2]}>Model / Device</Text>
          <Text style={[S.th, S.dc3]}>Vendor</Text>
          <Text style={[S.th, S.dc4]}>Buy Date</Text>
          <Text style={[S.th, S.dc5]}>Buy Price</Text>
          <Text style={[S.th, S.dc6]}>Customer</Text>
          <Text style={[S.th, S.dc7]}>Sale Date</Text>
          <Text style={[S.th, S.dc8]}>Sale Price</Text>
          <Text style={[S.th, S.dc9]}>Profit</Text>
          <Text style={[S.th, S.dc10]}>Status</Text>
        </View>
        {devices.map((d, i) => (
          <View key={i} style={[S.row, i % 2 === 1 ? S.rowAlt : {}]} wrap={false}>
            <View style={S.dc1}>
              <Text style={S.td}>{d.imei}</Text>
            </View>
            <View style={S.dc2}>
              <Text style={S.td}>{d.productName}</Text>
              {(d.model || d.storage || d.color) && (
                <Text style={S.tdm}>{[d.model, d.storage, d.color].filter(Boolean).join(" / ")}</Text>
              )}
            </View>
            <Text style={[S.td, S.dc3]}>{d.vendorName || "-"}</Text>
            <Text style={[S.td, S.dc4]}>{fmtD(d.purchaseDate)}</Text>
            <Text style={[S.td, S.dc5]}>{Rs(d.purchasePrice)}</Text>
            <View style={S.dc6}>
              <Text style={S.td}>{d.customerName || "-"}</Text>
              {d.saleBillNo && <Text style={S.tdm}>#{d.saleBillNo}</Text>}
            </View>
            <Text style={[S.td, S.dc7]}>{fmtD(d.saleDate)}</Text>
            <Text style={[S.td, S.dc8]}>{d.status === "sold" ? Rs(d.salePrice) : "-"}</Text>
            <Text style={[S.td, S.dc9, d.status === "sold" ? (d.profit >= 0 ? S.green : S.red) : S.tdm]}>
              {d.status === "sold" ? (d.profit >= 0 ? "+" : "") + Rs(d.profit) : "-"}
            </Text>
            <Text style={[
              S.td, S.dc10,
              d.status === "sold" ? S.green :
              d.status === "in_stock" || d.status === "reserved" ? S.blue :
              d.status === "deadstock" ? S.red : S.orange,
            ]}>
              {d.status.replace(/_/g, " ")}
            </Text>
          </View>
        ))}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>{companyName || "Device Report"}</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
