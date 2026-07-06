import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { PurchaseBill } from "@/types";
import { formatDate } from "@/lib/billUtils";

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1f2937",
    backgroundColor: "#ffffff",
  },

  // Header Styles
  headerContainer: {
    marginBottom: 35,
  },
  companyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 3,
    borderBottomColor: "#2563eb",
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginBottom: 4,
  },
  companyTagline: {
    fontSize: 10,
    color: "#6b7280",
    fontStyle: "italic",
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#374151",
    textAlign: "right",
    marginBottom: 8,
  },
  billDetails: {
    textAlign: "right",
  },
  billDetailRow: {
    fontSize: 10,
    color: "#4b5563",
    marginBottom: 3,
  },
  billNumber: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1e3a8a",
  },

  // Status Badge
  statusBadge: {
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  statusPaid: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  statusPending: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  statusText: {
    fontSize: 9,
    fontWeight: "bold",
  },

  // Vendor Section
  vendorSection: {
    marginBottom: 25,
    backgroundColor: "#f9fafb",
    padding: 18,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
  },
  vendorTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  vendorName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  vendorDetail: {
    fontSize: 10,
    color: "#4b5563",
    marginBottom: 4,
    lineHeight: 1.4,
  },

  // Table Styles
  table: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e3a8a",
    padding: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  tableRowAlt: {
    backgroundColor: "#f9fafb",
  },
  tableText: {
    fontSize: 9,
    color: "#374151",
  },
  tableTextBold: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111827",
  },

  // Column widths for items table
  colDescription: { width: "38%" },
  colQty: { width: "15%", textAlign: "center" },
  colRate: { width: "17%", textAlign: "right" },
  colTax: { width: "12%", textAlign: "center" },
  colAmount: { width: "18%", textAlign: "right" },

  // Summary Section
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 15,
    marginBottom: 25,
  },
  summaryBox: {
    width: "48%",
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d1d5db",
  },
  summaryLabel: {
    fontSize: 10,
    color: "#6b7280",
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#374151",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: "#1e3a8a",
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1e3a8a",
  },
  totalValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1e3a8a",
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 6,
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    borderRadius: 4,
  },

  // Returns Table
  returnsHeader: {
    backgroundColor: "#ea580c",
  },
  returnsRow: {
    backgroundColor: "#fff7ed",
  },
  colReturnDesc: { width: "40%" },
  colReturnQty: { width: "15%", textAlign: "center" },
  colReturnDate: { width: "20%", textAlign: "center" },
  colReturnValue: { width: "25%", textAlign: "right" },

  // Payment Section
  paymentSection: {
    marginTop: 20,
    marginBottom: 25,
  },
  paymentHeader: {
    backgroundColor: "#475569",
  },
  paymentRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  colPaymentDate: { width: "30%" },
  colPaymentMethod: { width: "30%" },
  colPaymentAmount: { width: "40%", textAlign: "right" },

  // Footer
  footer: {
    position: "absolute",
    bottom: 35,
    left: 50,
    right: 50,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 1.5,
  },
  footerBold: {
    fontSize: 9,
    color: "#6b7280",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 3,
  },
});

const formatPDFCurrency = (amount: number) => {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${amount < 0 ? "-" : ""}Rs. ${formatted}`;
};

interface PurchaseBillPDFProps {
  bill: PurchaseBill;
}

export const PurchaseBillPDF: React.FC<PurchaseBillPDFProps> = ({ bill }) => {
  const totalReturnAmount =
    bill.returns?.reduce((s, r) => s + r.totalReturnValue, 0) || 0;
  const originalTotal = bill.total + totalReturnAmount;
  const balanceDue = bill.total - bill.paidAmount;
  const isPaid = bill.paymentStatus === "paid";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.companyHeader}>
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>Ibell</Text>
              <Text style={styles.companyTagline}>
                Ibell Invoice Management System
              </Text>
            </View>
            <View>
              <Text style={styles.invoiceTitle}>PURCHASE INVOICE</Text>
              <View style={styles.billDetails}>
                <Text style={styles.billDetailRow}>
                  <Text style={{ fontWeight: "bold" }}>Invoice Number: </Text>
                  <Text style={styles.billNumber}>
                    {bill.billNumber || "N/A"}
                  </Text>
                </Text>
                <Text style={styles.billDetailRow}>
                  <Text style={{ fontWeight: "bold" }}>Date: </Text>
                  {formatDate(bill.billDate || bill.createdAt)}
                </Text>
                {bill.dueDate && (
                  <Text style={styles.billDetailRow}>
                    <Text style={{ fontWeight: "bold" }}>Due Date: </Text>
                    {formatDate(bill.dueDate)}
                  </Text>
                )}
                {bill.paymentTerms && (
                  <Text style={styles.billDetailRow}>
                    <Text style={{ fontWeight: "bold" }}>Terms: </Text>
                    {bill.paymentTerms} days
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  isPaid ? styles.statusPaid : styles.statusPending,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    isPaid ? { color: "#166534" } : { color: "#92400e" },
                  ]}
                >
                  {isPaid ? "✓ PAID" : "PENDING"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Vendor Information */}
        <View style={styles.vendorSection}>
          <Text style={styles.vendorTitle}>Bill To / Vendor Information</Text>
          <Text style={styles.vendorName}>{bill.vendorName}</Text>
          {bill.vendorGstin && (
            <Text style={styles.vendorDetail}>
              <Text style={{ fontWeight: "bold" }}>TaxIN: </Text>
              {bill.vendorGstin}
            </Text>
          )}
          {bill.vendorAddress && (
            <Text style={styles.vendorDetail}>
              <Text style={{ fontWeight: "bold" }}>Address: </Text>
              {bill.vendorAddress}
            </Text>
          )}
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <Text style={styles.sectionTitle}>Itemized Bill</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDescription]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>
              Quantity
            </Text>
            <Text style={[styles.tableHeaderText, styles.colRate]}>Rate</Text>
            <Text style={[styles.tableHeaderText, styles.colTax]}>Tax %</Text>
            <Text style={[styles.tableHeaderText, styles.colAmount]}>
              Amount
            </Text>
          </View>
          {bill.items.map((item, index) => (
            <View
              key={index}
              style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
            >
              <View style={styles.colDescription}>
                <Text style={styles.tableTextBold}>{item.description}</Text>
              </View>
              <Text style={[styles.tableText, styles.colQty]}>
                {item.quantity} {item.unit}
              </Text>
              <Text style={[styles.tableTextBold, styles.colRate]}>
                {formatPDFCurrency(item.rate)}
              </Text>
              <Text style={[styles.tableText, styles.colTax]}></Text>
              <Text style={[styles.tableTextBold, styles.colAmount]}>
                {formatPDFCurrency(item.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>
                {formatPDFCurrency(bill.subtotal)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Tax (Tax)</Text>
              <Text style={styles.summaryValue}></Text>
            </View>
            {totalReturnAmount > 0 && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Original Bill Amount</Text>
                  <Text style={styles.summaryValue}>
                    {formatPDFCurrency(originalTotal)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: "#ea580c" }]}>
                    Less: Returns (incl. Tax)
                  </Text>
                  <Text style={[styles.summaryValue, { color: "#ea580c" }]}>
                    {formatPDFCurrency(totalReturnAmount)}
                  </Text>
                </View>
              </>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>NET AMOUNT</Text>
              <Text style={styles.totalValue}>
                {formatPDFCurrency(bill.total)}
              </Text>
            </View>
            <View
              style={[
                styles.balanceRow,
                { borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 8 },
              ]}
            >
              <Text
                style={[
                  styles.summaryLabel,
                  { color: "#059669", fontWeight: "bold" },
                ]}
              >
                Amount Paid
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: "#059669", fontSize: 11 },
                ]}
              >
                {formatPDFCurrency(bill.paidAmount)}
              </Text>
            </View>
            <View style={styles.balanceRow}>
              <Text
                style={[
                  styles.summaryLabel,
                  { fontWeight: "bold", fontSize: 11 },
                ]}
              >
                Balance Due
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color: balanceDue > 0 ? "#dc2626" : "#059669",
                    fontSize: 12,
                    fontWeight: "bold",
                  },
                ]}
              >
                {formatPDFCurrency(balanceDue)}
              </Text>
            </View>
          </View>
        </View>

        {/* Returns Section */}
        {bill.returns && bill.returns.length > 0 && (
          <View style={styles.table}>
            <Text style={[styles.sectionTitle, { color: "#ea580c" }]}>
              Purchase Returns
            </Text>
            <View style={[styles.tableHeader, styles.returnsHeader]}>
              <Text style={[styles.tableHeaderText, styles.colReturnDesc]}>
                Item / Reason
              </Text>
              <Text style={[styles.tableHeaderText, styles.colReturnQty]}>
                Qty
              </Text>
              <Text style={[styles.tableHeaderText, styles.colReturnDate]}>
                Return Date
              </Text>
              <Text style={[styles.tableHeaderText, styles.colReturnValue]}>
                Value (incl. Tax)
              </Text>
            </View>
            {bill.returns.map((ret, retIndex) => (
              <React.Fragment key={retIndex}>
                {ret.items.map((item, itemIndex) => {
                  const itemValue = item.quantity * item.rate;
                  return (
                    <View
                      key={`${retIndex}-${itemIndex}`}
                      style={[styles.tableRow, styles.returnsRow]}
                    >
                      <View style={styles.colReturnDesc}>
                        <Text style={styles.tableTextBold}>
                          {item.description}
                        </Text>
                        {ret.notes && (
                          <Text
                            style={[
                              styles.tableText,
                              {
                                fontSize: 8,
                                color: "#92400e",
                                marginTop: 2,
                                fontStyle: "italic",
                              },
                            ]}
                          >
                            Note: {ret.notes}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.tableText, styles.colReturnQty]}>
                        -{item.quantity}
                      </Text>
                      <Text style={[styles.tableText, styles.colReturnDate]}>
                        {formatDate(ret.returnDate)}
                      </Text>
                      <Text
                        style={[
                          styles.tableTextBold,
                          styles.colReturnValue,
                          { color: "#ea580c" },
                        ]}
                      >
                        {formatPDFCurrency(itemValue)}
                      </Text>
                    </View>
                  );
                })}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Payment History */}
        {bill.payments && bill.payments.length > 0 && (
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            <View style={[styles.tableHeader, styles.paymentHeader]}>
              <Text style={[styles.tableHeaderText, styles.colPaymentDate]}>
                Payment Date
              </Text>
              <Text style={[styles.tableHeaderText, styles.colPaymentMethod]}>
                Method
              </Text>
              <Text style={[styles.tableHeaderText, styles.colPaymentAmount]}>
                Amount
              </Text>
            </View>
            {bill.payments.map((payment, index) => (
              <View
                key={index}
                style={[
                  styles.paymentRow,
                  index % 2 === 1 && styles.tableRowAlt,
                ]}
              >
                <Text style={[styles.tableText, styles.colPaymentDate]}>
                  {formatDate(payment.date)}
                </Text>
                <Text style={[styles.tableText, styles.colPaymentMethod]}>
                  {payment.method}
                </Text>
                <Text
                  style={[
                    styles.tableTextBold,
                    styles.colPaymentAmount,
                    { color: "#059669" },
                  ]}
                >
                  {formatPDFCurrency(payment.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBold}>Ibell</Text>
          <Text style={styles.footerText}>Ibell Invoice Management System</Text>
          <Text style={[styles.footerText, { marginTop: 3 }]}>
            This is a computer-generated document. No signature required.
          </Text>
          <Text style={[styles.footerText, { marginTop: 2 }]}>
            Generated on{" "}
            {new Date().toLocaleDateString("en-IN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </Page>
    </Document>
  );
};
