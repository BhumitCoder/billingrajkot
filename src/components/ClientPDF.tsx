import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { Client, Bill, BillReturn } from "@/types";

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
});

interface ClientPDFProps {
  client: Client;
  bills: Bill[];
  returns: BillReturn[];
  analytics: {
    totalBills: number;
    totalRevenue: number;
    pendingAmount: number;
    totalReturns: number;
    totalReturnValue: number;
    averageBillValue: number;
    paidBills: number;
    pendingBills: number;
    paymentRate: string;
    returnRate: string;
    netRevenue: number;
  };
  companyProfile?: any;
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
    month: "long",
    year: "numeric",
  });
};

export const ClientPDF = ({
  client,
  bills,
  returns,
  analytics,
  companyProfile,
}: ClientPDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.companyName}>
          {companyProfile?.name || "CLIENT REPORT"}
        </Text>
        <Text style={styles.reportTitle}>
          Client Data Sheet - {client.name}
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

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>CLIENT INFORMATION</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Client Name</Text>
            <Text style={styles.tableCellValue}>{client.name}</Text>
          </View>
          {client.email && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Email</Text>
              <Text style={styles.tableCellValue}>{client.email}</Text>
            </View>
          )}
          {client.phone && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Phone</Text>
              <Text style={styles.tableCellValue}>{client.phone}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>BUSINESS ANALYTICS</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Bills</Text>
            <Text style={styles.tableCellValue}>{analytics.totalBills}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Revenue (Paid)</Text>
            <Text style={[styles.tableCellValue, styles.profit]}>
              {formatCurrency(analytics.totalRevenue)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Pending Amount</Text>
            <Text style={[styles.tableCellValue, styles.loss]}>
              {formatCurrency(analytics.pendingAmount)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Net Revenue</Text>
            <Text style={[styles.tableCellValue, styles.profit]}>
              {formatCurrency(analytics.netRevenue)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Payment Rate</Text>
            <Text style={styles.tableCellValue}>{analytics.paymentRate}%</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>RECENT BILLS</Text>
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Bill No</Text>
            <Text style={styles.tableCell}>Date</Text>
            <Text style={styles.tableCellRight}>Total</Text>
            <Text style={styles.tableCellRight}>Status</Text>
          </View>
          {bills.slice(0, 15).map((bill) => (
            <View key={bill.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>
                {bill.billNumber}
              </Text>
              <Text style={styles.tableCell}>{formatDate(bill.date)}</Text>
              <Text style={styles.tableCellRight}>
                {formatCurrency(bill.total)}
              </Text>
              <Text
                style={[
                  styles.tableCellRight,
                  bill.paymentStatus === "paid" ? styles.profit : styles.loss,
                ]}
              >
                {bill.paymentStatus.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>RETURNS</Text>
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Bill No</Text>
            <Text style={styles.tableCell}>Date</Text>
            <Text style={styles.tableCellRight}>Return Value</Text>
          </View>
          {returns.length === 0 ? (
            <View style={styles.tableRow}>
              <Text
                style={[styles.tableCell, { flex: 3, textAlign: "center" }]}
              >
                No returns found
              </Text>
            </View>
          ) : (
            returns.slice(0, 10).map((ret) => (
              <View key={ret.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>
                  {ret.billNumber}
                </Text>
                <Text style={styles.tableCell}>{formatDate(ret.returnDate)}</Text>
                <Text style={[styles.tableCellRight, styles.loss]}>
                  {formatCurrency(ret.totalReturnValue)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      <Text style={styles.footer}>
        {companyProfile?.name || "Company"} | Generated on{" "}
        {new Date().toLocaleDateString("en-IN")}
      </Text>
    </Page>
  </Document>
);
