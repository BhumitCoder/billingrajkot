import React from "react";
import { Bill, EWayBillDetails } from "@/types";
import {
  formatCurrency,
  formatDate,
} from "@/lib/billUtils";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

Font.register({
  family: "Inter",
  src: "/fonts/Inter-VariableFont_opsz,wght.ttf",
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 9,
    padding: 20,
    lineHeight: 1.5,
    color: "#000",
  },
  header: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    textDecoration: "underline",
  },
  section: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#000",
  },
  sectionTitle: {
    backgroundColor: "#eee",
    padding: 4,
    fontWeight: "bold",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  lastRow: {
    flexDirection: "row",
  },
  col: {
    flex: 1,
    padding: 4,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  lastCol: {
    flex: 1,
    padding: 4,
  },
  bold: {
    fontWeight: "bold",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeader: {
    backgroundColor: "#eee",
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  cellSl: { width: "10%", padding: 4, borderRightWidth: 1, borderColor: "#000", textAlign: "center" },
  cellDesc: { flex: 1, padding: 4, borderRightWidth: 1, borderColor: "#000" },
  cellHsn: { width: "15%", padding: 4, borderRightWidth: 1, borderColor: "#000", textAlign: "center" },
  cellQty: { width: "10%", padding: 4, borderRightWidth: 1, borderColor: "#000", textAlign: "center" },
  cellUnit: { width: "10%", padding: 4, borderRightWidth: 1, borderColor: "#000", textAlign: "center" },
  cellValue: { width: "20%", padding: 4, textAlign: "right" },
});

export const EWayBillPDF = ({
  bill,
  company,
  ewayDetails,
}: {
  bill: Bill;
  company: any;
  ewayDetails: EWayBillDetails;
}) => {
  const ewayBillDisplayNo =
    String(bill?.billNumber || "").trim() ||
    String(ewayDetails?.transDocNo || "").trim() ||
    "N/A";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>FORM Tax EWB-01</Text>
        <Text style={{ textAlign: "center", marginBottom: 10 }}>(See Rule 138)</Text>
        <Text style={{ fontWeight: "bold", marginBottom: 5 }}>
          E-Way Bill No: {ewayBillDisplayNo}
        </Text>
        <Text style={{ fontWeight: "bold", marginBottom: 10 }}>E-Way Bill Date: {formatDate(bill.date)}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PART-A</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.bold}>TaxIN of Supplier</Text>
              <Text>{company.gstin}</Text>
            </View>
            <View style={styles.lastCol}>
              <Text style={styles.bold}>Place of Dispatch</Text>
              <Text>{company.address}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.bold}>TaxIN of Recipient</Text>
              <Text>{bill.client.gstin}</Text>
            </View>
            <View style={styles.lastCol}>
              <Text style={styles.bold}>Place of Delivery</Text>
              <Text>{bill.client.shippingAddress || bill.client.billingAddress}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.bold}>Document No.</Text>
              <Text>{bill.billNumber}</Text>
            </View>
            <View style={styles.lastCol}>
              <Text style={styles.bold}>Document Date</Text>
              <Text>{formatDate(bill.date)}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.bold}>Value of Goods</Text>
              <Text>{formatCurrency(bill.subtotal)}</Text>
            </View>
            <View style={styles.lastCol}>
              <Text style={styles.bold}>HSN Code</Text>
              <Text>{bill.items[0]?.hsnCode || "N/A"}</Text>
            </View>
          </View>
          <View style={styles.lastRow}>
            <View style={styles.col}>
              <Text style={styles.bold}>Reason for Transportation</Text>
              <Text>Outward Supply</Text>
            </View>
            <View style={styles.lastCol}>
              <Text style={styles.bold}>Approx. Distance (km)</Text>
              <Text>{ewayDetails.approxDistance || ""}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PART-B</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.bold}>Mode</Text>
              <Text>{ewayDetails.modeOfTransport || "Road"}</Text>
            </View>
            <View style={styles.lastCol}>
              <Text style={styles.bold}>Vehicle / Trans Doc No.</Text>
              <Text>{ewayDetails.vehicleNumber || ewayDetails.transDocNo || ""}</Text>
            </View>
          </View>
          <View style={styles.lastRow}>
            <View style={styles.col}>
              <Text style={styles.bold}>Transporter Name / ID</Text>
              <Text>{ewayDetails.transporterName || ""} / {ewayDetails.transporterId || ""}</Text>
            </View>
            <View style={styles.lastCol}>
              <Text style={styles.bold}>Vehicle Type</Text>
              <Text>{ewayDetails.vehicleType || "Regular"}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { borderBottomWidth: 0 }]}>
          <Text style={styles.sectionTitle}>Item Details</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.cellSl}>Sl.</Text>
            <Text style={styles.cellDesc}>Product Description</Text>
            <Text style={styles.cellHsn}>HSN</Text>
            <Text style={styles.cellQty}>Qty</Text>
            <Text style={styles.cellUnit}>Unit</Text>
            <Text style={styles.cellValue}>Taxable Value</Text>
          </View>
          {bill.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.cellSl}>{i + 1}</Text>
              <Text style={styles.cellDesc}>{item.productName}</Text>
              <Text style={styles.cellHsn}>{item.hsnCode}</Text>
              <Text style={styles.cellQty}>{item.quantity}</Text>
              <Text style={styles.cellUnit}>{item.unit}</Text>
              <Text style={styles.cellValue}>{formatCurrency(item.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={styles.bold}>Total Taxable Value: {formatCurrency(bill.subtotal)}</Text>
          <Text style={styles.bold}>Total Tax Amount: {formatCurrency(bill.totalTax)}</Text>
          <Text style={[styles.bold, { fontSize: 12, marginTop: 5 }]}>Total Invoice Value: {formatCurrency(bill.total)}</Text>
        </View>
      </Page>
    </Document>
  );
};
