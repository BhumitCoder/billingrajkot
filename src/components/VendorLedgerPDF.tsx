import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Vendor } from '@/types';

// Define styles for PDF matching ClientPDF UI
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

interface VendorLedgerPDFProps {
  vendor: Vendor;
  transactions: any[];
  stats: {
    totalPurchase: number;
    totalPaid: number;
    pendingAmount: number;
    totalReturn: number;
    billCount: number;
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

export const VendorLedgerPDF = ({ vendor, transactions, stats, companyProfile }: VendorLedgerPDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.companyName}>
          {companyProfile?.name || "VENDOR LEDGER"}
        </Text>
        <Text style={styles.reportTitle}>
          Vendor Statement - {vendor.name}
        </Text>
        <Text style={styles.period}>
          Generated: {new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>VENDOR INFORMATION</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Vendor Name</Text>
            <Text style={styles.tableCellValue}>{vendor.name}</Text>
          </View>
          {vendor.phone && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Phone</Text>
              <Text style={styles.tableCellValue}>{vendor.phone}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>FINANCIAL SUMMARY</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Purchase</Text>
            <Text style={styles.tableCellValue}>{formatCurrency(stats.totalPurchase)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Paid</Text>
            <Text style={[styles.tableCellValue, styles.profit]}>{formatCurrency(stats.totalPaid)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Return</Text>
            <Text style={[styles.tableCellValue, styles.loss]}>{formatCurrency(stats.totalReturn)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Balance Due</Text>
            <Text style={[styles.tableCellValue, styles.loss]}>{formatCurrency(stats.pendingAmount)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>TRANSACTION HISTORY</Text>
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={[styles.tableCell, { flex: 1 }]}>Date</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>Type</Text>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Reference</Text>
            <Text style={styles.tableCellRight}>Debit</Text>
            <Text style={styles.tableCellRight}>Credit</Text>
          </View>
          {transactions.map((tx, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1 }]}>{formatDate(tx.date)}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{tx.type}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{tx.reference}</Text>
              <Text style={styles.tableCellRight}>
                {tx.type === 'Purchase' ? formatCurrency(tx.amount) : '-'}
              </Text>
              <Text style={styles.tableCellRight}>
                {tx.type !== 'Purchase' ? formatCurrency(tx.amount) : '-'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.footer}>
        {companyProfile?.name || "Company"} | Generated on {new Date().toLocaleDateString("en-IN")}
      </Text>
    </Page>
  </Document>
);