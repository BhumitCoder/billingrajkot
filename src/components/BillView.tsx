import React, { useRef, useEffect, useState, useLayoutEffect } from "react";
import { Bill, SampleBill, BankAccount } from "@/types";
import {
  formatCurrency,
  formatDate,
  numberToWords,
  formatToTwoDecimals,
} from "@/lib/billUtils";
import { getCompanyProfile, getBankAccounts } from "@/lib/storage";
import { Button } from "./ui/button";
import { Download, Printer, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
} from "@react-pdf/renderer";
import QRCode from "qrcode";
import { Font } from "@react-pdf/renderer";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "@/lib/firebase";

Font.register({
  family: "Inter",
  src: "/fonts/Inter-VariableFont_opsz,wght.ttf",
});

interface BillViewProps {
  bill: Bill;
}

type BillLike =
  | (Bill & {
    bankAccount?: BankAccount;
  })
  | (SampleBill & {
    returnComment?: string;
    bankAccount?: BankAccount;
  });

const mmToPt = (mm: number) => mm * 2.83465;

const getDeviceDetails = (item: any) => {
  const parts: string[] = [];
  if (item?.itemNo) parts.push(`Item: ${item.itemNo}`);
  if (item?.model) parts.push(`Model: ${item.model}`);
  if (item?.imeiNumber) parts.push(`IMEI: ${item.imeiNumber}`);
  if (item?.storage || item?.color) {
    parts.push(
      `${item.storage || "-"}` + (item.color ? ` / ${item.color}` : ""),
    );
  }
  return parts;
};

// ─── Unified PDF styles ───────────────────────────────────────────────────────
const P = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 7.5,
    padding: mmToPt(5),
    lineHeight: 1.4,
    color: "#000",
    backgroundColor: "#fff",
  },
  border1: { borderWidth: 1, borderStyle: "solid", borderColor: "#000" },
  border2: { borderWidth: 2, borderStyle: "solid", borderColor: "#000" },
  borderRight: {
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "#000",
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#000",
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: "#000",
  },
  borderLeft: {
    borderLeftWidth: 1,
    borderLeftStyle: "solid",
    borderLeftColor: "#000",
  },
  row: { flexDirection: "row" },
  col2: { flexDirection: "row" },
  flex1: { flex: 1 },
  w50: { width: "50%" },
  w100: { width: "100%" },
  textRight: { textAlign: "right" },
  textCenter: { textAlign: "center" },
  textLeft: { textAlign: "left" },
  bold: { fontWeight: "bold" },
  sm: { fontSize: 7.5 },
  md: { fontSize: 9 },
  lg: { fontSize: 11 },
  xl: { fontSize: 14 },
  gray: { color: "#6b7280" },
  p1: { padding: 3 },
  p2: { padding: mmToPt(2) },
  p3: { padding: mmToPt(3) },
  mb1: { marginBottom: 3 },
  mb2: { marginBottom: 6 },
  mb3: { marginBottom: mmToPt(3) },
  mt1: { marginTop: 3 },
  mt2: { marginTop: 6 },
  pr2: { paddingRight: 6 },
  pb1: { paddingBottom: 3 },
  pt1: { paddingTop: 3 },
  tableHeaderRow: { flexDirection: "row", color: "#fff" },
  tableRow: { flexDirection: "row" },
  tableRowAlt: { flexDirection: "row", backgroundColor: "#f3f4f6" },
  tableCell: { padding: 4, fontSize: 7.5 },
  centerItems: { alignItems: "center", justifyContent: "center" },
  sigBox: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomStyle: "dashed",
    borderBottomColor: "#9ca3af",
  },
  sigImage: {
    width: 120,
    height: 32,
    objectFit: "contain",
  },
  sigBoxSolid: { height: 40 },
});

const fmtDate = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getDate().toString().padStart(2, "0")}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getFullYear()}`;
};

const addressLines = (address: string) =>
  (address || "")
    .split(",")
    .map((l) => l.trim())
    .join("\n");

// ─── BillPDF ─────────────────────────────────────────────────────────────────
export const BillPDF = ({
  bill,
  company,
  qrDataURL,
  isSample,
  bankAccountOverride,
}: {
  bill: BillLike;
  company: any;
  qrDataURL: string;
  isSample?: boolean;
  bankAccountOverride?: BankAccount | null;
}) => {
  const displayBankAccount = bill.bankAccount || bankAccountOverride || null;
  const themeColor = company.themeColor || "#1e40af";
  const effectiveSignature = (bill as any).isGst
    ? (company?.signatureGst || company?.signature || null)
    : (company?.signature || null);
  const signatureSrc = effectiveSignature
    ? ({ uri: String(effectiveSignature) } as any)
    : null;

  const slW = 30;
  const qtyW = 35;
  const unitW = 32;
  const rateW = 65;
  const amtW = 65;

  const bdr = (extra?: object) => ({
    borderWidth: 1,
    borderStyle: "solid" as const,
    borderColor: "#000",
    ...extra,
  });
  const bdrT0 = { borderTopWidth: 0 };
  const bdrB = { borderBottomWidth: 1, borderBottomStyle: "solid" as const, borderBottomColor: "#000" };
  const bdrR = { borderRightWidth: 1, borderRightStyle: "solid" as const, borderRightColor: "#000" };

  const MIN_PDF_ROWS = 10;
  const pdfFillerCount = Math.max(0, MIN_PDF_ROWS - bill.items.length);
  const footerMinHeight = mmToPt(48);
  const footerSignatureAreaMinHeight = mmToPt(18);
  const footerCertificationAreaMinHeight = mmToPt(24);
  const totalQty = bill.items.reduce((s, it) => s + it.quantity, 0);
  const commonUnit = bill.items.length > 0 ? (bill.items[0].unit || "NOS").toUpperCase() : "NOS";
  const bankName = displayBankAccount?.bankName || company.bankDetails?.bankName || "";
  const bankBranch = displayBankAccount?.branchAndIFSC || company.bankDetails?.branchAndIFSC || "";
  const bankAccNo = displayBankAccount?.accountNumber || company.bankDetails?.accountNumber || "";
  const bankIfsc = displayBankAccount?.branchAndIFSC || company.bankDetails?.branchAndIFSC || "";
  const bankUpi = displayBankAccount?.upiId || company.upiId || "";

  return (
    <Document>
      <Page size="A4" style={[P.page, { flexDirection: "column" }]}>

        {/* ── HEADER ── */}
        <View style={{ borderWidth: 2, borderStyle: "solid", borderColor: "#000" }}>
          <View style={[P.row, { padding: mmToPt(3), alignItems: "flex-start", justifyContent: "space-between" }]}>
            {/* Left: company name + address */}
            <View style={[P.flex1, { paddingRight: 8, flexDirection: "column" }]}>
              <View style={{ marginBottom: 6 }}>
                <Text style={[P.bold, { fontSize: 18, color: 'black', letterSpacing: 0.5 }]}>
                  {String(company.name || "").toUpperCase()}
                </Text>
              </View>
              <View style={{ marginTop: 6 }}>
                <Text style={[P.sm, { lineHeight: 1.5, color: "#333" }]}>
                  {String(company.address || "").split(",").filter(s => s.trim()).map(s => s.trim()).join("\n")}
                </Text>
              </View>
            </View>
            {/* Right: logo + contact */}
            <View style={{ alignItems: "flex-end" }}>
              {company.logo && (
                <Image
                  src={company.logo}
                  style={{ width: company.logoWidth ?? company.logoSize ?? 50, height: company.logoHeight ?? company.logoSize ?? 50, objectFit: "contain", marginBottom: 4 }}
                />
              )}
              {(bill as any).isGst && (
                <Text style={[P.bold, { fontSize: 9, color: "#1e40af", marginBottom: 3, letterSpacing: 0.5 }]}>TAX INVOICE</Text>
              )}
              <Text style={P.sm}><Text style={P.bold}>Tel : </Text>{company.phone}</Text>
              {company.email && <Text style={P.sm}><Text style={P.bold}>Email : </Text>{company.email}</Text>}
              {(bill as any).isGst && company.gstin && (
                <Text style={P.sm}><Text style={P.bold}>GSTIN : </Text>{company.gstin}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── CUSTOMER DETAILS + INVOICE INFO ── */}
        <View style={P.row}>
          {/* Left: Customer Detail */}
          <View
            style={[
              {
                width: "50%",
                ...bdrR,
                ...bdrB,
                borderLeftWidth: 1,
                borderLeftStyle: "solid",
                borderLeftColor: "#000",
              },
            ]}
          >
            <View style={[{ padding: 4, backgroundColor: "#f0f0f0", ...bdrB }]}>
              <Text style={[P.bold, P.sm]}>Customer Detail</Text>
            </View>
            <View style={{ padding: 4 }}>
              <View style={[P.row, { marginBottom: 2 }]}>
                <Text style={[P.bold, P.sm, { width: 44 }]}>M/S</Text>
                <Text style={[P.sm, P.flex1, P.bold]}>{bill.client?.name ?? "Unknown Client"}</Text>
              </View>
              {(bill.client?.billingAddress?.trim() || (bill.client as any)?.shippingAddress?.trim()) && (
                <View style={[P.row, { marginBottom: 2 }]}>
                  <Text style={[P.bold, P.sm, { width: 44 }]}>Address</Text>
                  <Text style={[P.sm, P.flex1, { lineHeight: 1.5 }]}>
                    {bill.client.billingAddress?.trim() || (bill.client as any).shippingAddress?.trim() || ""}
                  </Text>
                </View>
              )}
              {bill.client.phone && (
                <View style={[P.row, { marginBottom: 2 }]}>
                  <Text style={[P.bold, P.sm, { width: 44 }]}>Phone</Text>
                  <Text style={P.sm}>{bill.client.phone}</Text>
                </View>
              )}
              {(bill as any).placeOfSupply && (
                <View style={P.row}>
                  <Text style={[P.bold, P.sm, { width: 44 }]}>{"Place of\nSupply"}</Text>
                  <Text style={[P.sm, P.flex1]}>{(bill as any).placeOfSupply}</Text>
                </View>
              )}
              {(bill as any).isGst && (bill.client as any)?.gstin && (
                <View style={[P.row, { marginTop: 2 }]}>
                  <Text style={[P.bold, P.sm, { width: 44 }]}>GSTIN</Text>
                  <Text style={P.sm}>{(bill.client as any).gstin}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Right: Invoice metadata */}
          <View
            style={[
              P.flex1,
              {
                borderRightWidth: 1,
                borderRightStyle: "solid",
                borderRightColor: "#000",
              },
            ]}
          >
            {/* Invoice No + Invoice Date */}
            <View style={[P.row, bdrB]}>
              <View style={[P.flex1, { padding: 4, ...bdrR }]}>
                <Text style={[P.bold, P.sm]}>Invoice No.</Text>
                <Text style={P.sm}>{bill.billNumber}</Text>
              </View>
              <View style={[P.flex1, { padding: 4 }]}>
                <Text style={[P.bold, P.sm, P.textRight]}>Invoice Date</Text>
                <Text style={[P.sm, P.textRight]}>{fmtDate(bill.date)}</Text>
              </View>
            </View>
            {/* Due Date */}
            <View style={P.row}>
              <View
                style={[
                  P.flex1,
                  {
                    padding: 4,
                    ...bdrR,
                  },
                ]}
              >
                <Text style={[P.bold, P.sm]}>Due Date</Text>
              </View>
              <View
                style={[
                  P.flex1,
                  {
                    padding: 4,
                  },
                ]}
              >
                <Text style={[P.sm, P.textRight]}>{fmtDate(bill.dueDate)}</Text>
              </View>
            </View>
            {bill.deliveryNote && (
              <View style={[P.row, bdrB]}>
                <View style={[P.flex1, { padding: 4, ...bdrR }]}>
                  <Text style={[P.bold, P.sm]}>Delivery Note</Text>
                </View>
                <View style={[P.flex1, { padding: 4 }]}>
                  <Text style={[P.sm, P.textRight]}>{bill.deliveryNote}</Text>
                </View>
              </View>
            )}
            {bill.modeOfPayment && (
              <View style={P.row}>
                <View style={[P.flex1, { padding: 4, ...bdrR }]}>
                  <Text style={[P.bold, P.sm]}>Payment Mode</Text>
                </View>
                <View style={[P.flex1, { padding: 4 }]}>
                  <Text style={[P.sm, P.textRight]}>{bill.modeOfPayment}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ── ITEMS TABLE ── */}
        <View>
          {/* Header row */}
          <View style={[P.row, bdr(), { backgroundColor: themeColor }]}>
            <Text style={[P.tableCell, P.bold, P.textCenter, { width: slW, color: "#fff", ...bdrR }]}>{"Sr.No."}</Text>
            <Text style={[P.tableCell, P.bold, { flex: 1, color: "#fff", ...bdrR }]}>Name of Product / Service</Text>
            <Text style={[P.tableCell, P.bold, P.textCenter, { width: qtyW, color: "#fff", ...bdrR }]}>Qty</Text>
            <Text style={[P.tableCell, P.bold, P.textCenter, { width: unitW, color: "#fff", ...bdrR }]}>Unit</Text>
            <Text style={[P.tableCell, P.bold, P.textCenter, { width: rateW, color: "#fff", ...bdrR }]}>Rate</Text>
            <Text style={[P.tableCell, P.bold, P.textRight, { width: amtW, color: "#fff" }]}>Amount</Text>
          </View>

          {/* Item rows */}
          {bill.items.map((item, i) => (
            <View key={i} style={[P.row, bdr(bdrT0), { backgroundColor: i % 2 === 0 ? "#fff" : "#f9fafb" }]}>
              <Text style={[P.tableCell, P.textCenter, { width: slW, ...bdrR }]}>{i + 1}</Text>
              <View style={[P.tableCell, { flex: 1, ...bdrR }]}>
                <Text>{item.productName}</Text>
                {getDeviceDetails(item).map((d, idx) => (
                  <Text key={idx} style={{ fontSize: 6.5, color: "#4b5563" }}>{d}</Text>
                ))}
              </View>
              <Text style={[P.tableCell, P.textCenter, { width: qtyW, ...bdrR }]}>{item.quantity}</Text>
              <Text style={[P.tableCell, P.textCenter, { width: unitW, ...bdrR }]}>{item.unit}</Text>
              <Text style={[P.tableCell, P.textRight, { width: rateW, ...bdrR }]}>{formatCurrency(item.ratePerUnit)}</Text>
              <Text style={[P.tableCell, P.textRight, { width: amtW }]}>{formatCurrency(item.amount)}</Text>
            </View>
          ))}

          {/* Single filler block — column dividers only, no horizontal row lines */}
          {pdfFillerCount > 0 && (
            <View style={[P.row, {
              borderLeftWidth: 1, borderLeftStyle: "solid", borderLeftColor: "#000",
              borderRightWidth: 1, borderRightStyle: "solid", borderRightColor: "#000",
              borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#000",
              height: mmToPt(pdfFillerCount * 6),
            }]}>
              <View style={{ width: slW, height: "100%", ...bdrR }} />
              <View style={{ flex: 1, height: "100%", ...bdrR }} />
              <View style={{ width: qtyW, height: "100%", ...bdrR }} />
              <View style={{ width: unitW, height: "100%", ...bdrR }} />
              <View style={{ width: rateW, height: "100%", ...bdrR }} />
              <View style={{ width: amtW, height: "100%" }} />
            </View>
          )}

          {/* Total row */}
          <View style={[P.row, P.bold, bdr(bdrT0), { backgroundColor: "#f3f4f6" }]}>
            <Text style={[P.tableCell, P.textRight, P.bold, { flex: 1, ...bdrR }]}>Total</Text>
            <Text style={[P.tableCell, P.textCenter, P.bold, { width: qtyW, ...bdrR }]}>{totalQty} {commonUnit}</Text>
            <Text style={[P.tableCell, { width: unitW, ...bdrR }]}>{" "}</Text>
            <Text style={[P.tableCell, { width: rateW, ...bdrR }]}>{" "}</Text>
            <Text style={[P.tableCell, P.textRight, P.bold, { width: amtW }]}>{formatCurrency(bill.subtotal)}</Text>
          </View>
        </View>

        {/* ── FOOTER: two columns ── */}
        <View style={[P.row, bdr(bdrT0), { minHeight: footerMinHeight, alignItems: "stretch" }]} wrap={false}>
          {/* LEFT column */}
          <View style={[{ width: "58%", ...bdrR, flexDirection: "column", minHeight: footerMinHeight }]}>

            {/* Total in words */}
            <View style={[{ padding: 5, ...bdrB }]}>
              <Text style={[P.bold, P.sm, { marginBottom: 2 }]}>Total in words</Text>
              <Text style={[P.sm, { lineHeight: 1.4 }]}>
                {String(numberToWords(Math.round(bill.total))).toUpperCase()} RUPEES ONLY
              </Text>
            </View>

            {/* Bank Details — GST bills only */}
            {(bill as any).isGst && (bankName || bankAccNo) && (
              <View style={[{ padding: 5, ...bdrB }]}>
                <Text style={[P.bold, P.sm, { marginBottom: 3 }]}>Bank Details</Text>
                <View style={P.row}>
                  <View style={P.flex1}>
                    {bankName && (
                      <View style={[P.row, { marginBottom: 1.5 }]}>
                        <Text style={[P.bold, P.sm, { width: 60 }]}>Name</Text>
                        <Text style={P.sm}>{bankName}</Text>
                      </View>
                    )}
                    {bankBranch && (
                      <View style={[P.row, { marginBottom: 1.5 }]}>
                        <Text style={[P.bold, P.sm, { width: 60 }]}>Branch</Text>
                        <Text style={[P.sm, P.flex1]}>{bankBranch.split(" ")[0]}</Text>
                      </View>
                    )}
                    {bankAccNo && (
                      <View style={[P.row, { marginBottom: 1.5 }]}>
                        <Text style={[P.bold, P.sm, { width: 60 }]}>Acc. Number</Text>
                        <Text style={P.sm}>{bankAccNo}</Text>
                      </View>
                    )}
                    {bankIfsc && (
                      <View style={[P.row, { marginBottom: 1.5 }]}>
                        <Text style={[P.bold, P.sm, { width: 60 }]}>IFSC</Text>
                        <Text style={P.sm}>{bankIfsc}</Text>
                      </View>
                    )}
                    {bankUpi && (
                      <View style={P.row}>
                        <Text style={[P.bold, P.sm, { width: 60 }]}>UPI ID</Text>
                        <Text style={P.sm}>{bankUpi}</Text>
                      </View>
                    )}
                  </View>
                  {qrDataURL && (
                    <View style={{ alignItems: "center", marginLeft: 6 }}>
                      <Image src={qrDataURL} style={{ width: 48, height: 48 }} />
                      <Text style={[{ fontSize: 6, color: "#555", marginTop: 2 }]}>Pay using UPI</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Terms and Conditions */}
            {(bill.notes || company.defaultNote) && (
              <View style={[{ padding: 5, ...bdrB }]}>
                <Text style={[P.bold, P.sm, { marginBottom: 2 }]}>Terms and Conditions</Text>
                <Text style={[P.sm, { lineHeight: 1.5 }]}>
                  {bill.notes || company.defaultNote}
                </Text>
              </View>
            )}

            {/* Return History */}
            {bill.returnComment && (
              <View style={[{ padding: 5, ...bdrB }]}>
                <Text style={[P.bold, P.sm, { marginBottom: 2 }]}>Return History</Text>
                <Text style={P.sm}>{bill.returnComment}</Text>
              </View>
            )}

            {/* Payment History */}
            {bill.payments && bill.payments.length > 0 && (
              <View style={[{ padding: 5, ...bdrB }]}>
                <Text style={[P.bold, P.sm, { marginBottom: 2 }]}>Payment History</Text>
                {bill.payments.map((payment, i) => (
                  <View key={i} style={[P.row, { justifyContent: "space-between", marginBottom: 1 }]}>
                    <Text style={[P.sm, { flex: 1, paddingRight: 4 }]}>
                      {payment.method} ({fmtDate(payment.date)})
                    </Text>
                    <Text style={[P.sm, P.bold]}>{formatCurrency(payment.amount)}</Text>
                  </View>
                ))}
                <View style={[P.row, { justifyContent: "space-between", marginTop: 3, paddingTop: 3, borderTopWidth: 0.5, borderTopStyle: "solid", borderTopColor: "#d1d5db" }]}>
                  <Text style={[P.bold, P.sm]}>Total Paid</Text>
                  <Text style={[P.bold, P.sm]}>{formatCurrency(bill.paidAmount)}</Text>
                </View>
              </View>
            )}

            {/* Customer Signature — centered in remaining left column space */}
            <View
              style={{
                minHeight: footerSignatureAreaMinHeight,
                padding: 5,
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              <Text style={[P.bold, P.sm, { marginBottom: 4, textAlign: "center" }]}>Customer Signature</Text>
              <View
                style={{
                  width: "100%",
                  height: 28,
                  borderBottomWidth: 1,
                  borderBottomStyle: "dashed",
                  borderBottomColor: "#9ca3af",
                }}
              />
              <Text style={{ fontSize: 6.5, color: "#6b7280", textAlign: "center", marginTop: 2, width: "100%" }}>{bill.client?.name ?? ""}</Text>
            </View>
          </View>

          {/* RIGHT column */}
          <View style={[P.flex1, { minHeight: footerMinHeight }]}>
            {/* Amount summary */}
            <View style={[{ padding: 5, ...bdrB }]}>
              <View style={[P.row, { justifyContent: "space-between", marginBottom: 2 }]}>
                <Text style={P.sm}>Taxable Amount</Text>
                <Text style={[P.sm, P.bold]}>{formatCurrency(bill.subtotal)}</Text>
              </View>
              {bill.discount !== undefined && bill.discount > 0 && (
                <View style={[P.row, { justifyContent: "space-between", marginBottom: 2 }]}>
                  <Text style={[P.sm, { color: "#b91c1c" }]}>
                    Discount{bill.discountType === "percentage" ? ` (${bill.discount}%)` : ""}
                  </Text>
                  <Text style={[P.sm, P.bold, { color: "#b91c1c" }]}>-{formatCurrency(bill.discount)}</Text>
                </View>
              )}
              {bill.courierCharges !== undefined && bill.courierCharges > 0 && (
                <View style={[P.row, { justifyContent: "space-between", marginBottom: 2 }]}>
                  <Text style={P.sm}>Courier Charges</Text>
                  <Text style={[P.sm, P.bold]}>{formatCurrency(bill.courierCharges)}</Text>
                </View>
              )}
              {(bill as any).otherCharges !== undefined && (bill as any).otherCharges > 0 && (
                <View style={[P.row, { justifyContent: "space-between", marginBottom: 2 }]}>
                  <Text style={P.sm}>Other Charges</Text>
                  <Text style={[P.sm, P.bold]}>{formatCurrency((bill as any).otherCharges)}</Text>
                </View>
              )}
              {(bill as any).isGst && (bill as any).cgst > 0 && (
                <View style={[P.row, { justifyContent: "space-between", marginBottom: 2 }]}>
                  <Text style={[P.sm, { color: "#1e40af" }]}>CGST ({((bill as any).gstRate ?? 0) / 2}%)</Text>
                  <Text style={[P.sm, P.bold, { color: "#1e40af" }]}>{formatCurrency((bill as any).cgst)}</Text>
                </View>
              )}
              {(bill as any).isGst && (bill as any).sgst > 0 && (
                <View style={[P.row, { justifyContent: "space-between", marginBottom: 2 }]}>
                  <Text style={[P.sm, { color: "#1e40af" }]}>SGST ({((bill as any).gstRate ?? 0) / 2}%)</Text>
                  <Text style={[P.sm, P.bold, { color: "#1e40af" }]}>{formatCurrency((bill as any).sgst)}</Text>
                </View>
              )}
              <View style={[P.row, { justifyContent: "space-between", borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "#000", paddingTop: 3, marginTop: 2 }]}>
                <Text style={[P.bold, { fontSize: 8 }]}>
                  {(bill as any).isGst ? "Total Amount (Inc. Tax)" : "Total Amount"}
                </Text>
                <Text style={[P.bold, { fontSize: 9 }]}>{formatCurrency(bill.total)}</Text>
              </View>
              <Text style={[P.sm, P.textRight, { color: "#6b7280", fontSize: 6.5 }]}>(E & O.E.)</Text>
            </View>

            {/* Certification + Signature — centered in remaining right column space */}
            <View
              style={{
                minHeight: footerCertificationAreaMinHeight,
                padding: 5,
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              <Text style={[P.sm, { lineHeight: 1.4, textAlign: "center" }]}>
                {isSample
                  ? "This is a SAMPLE BILL for demonstration purposes only. Not valid for actual transactions."
                  : "Certified that the particulars given above are true and correct."}
              </Text>
              {!signatureSrc && (
                <Text style={[P.bold, P.sm, { marginTop: 4, textAlign: "center" }]}>For {company.name}</Text>
              )}
              <View style={{ minHeight: 36, width: "100%", alignItems: "center", justifyContent: "center", marginVertical: 4 }}>
                {signatureSrc ? (
                  <Image src={signatureSrc} style={{ width: 140, height: 44, objectFit: "contain" }} />
                ) : null}
              </View>
              <Text style={[P.bold, P.sm, { textAlign: "center" }]}>Authorised Signatory</Text>
            </View>
          </View>
        </View>

        {/* Computer generated note — outside the bill border, centered */}
        <Text style={[{ fontSize: 6, color: "#6b7280", marginTop: 8, textAlign: "center" }]}>
          {"This is a computer generated invoice no signature required."}
        </Text>

      </Page>
    </Document>
  );
};

// ─── BillView (HTML preview) ──────────────────────────────────────────────────
export function BillView({ bill }: BillViewProps) {
  const billRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [company, setCompany] = useState<any>(null);
  const [defaultBankAccount, setDefaultBankAccount] =
    useState<BankAccount | null>(null);
  const [scale, setScale] = useState(1);
  const [qrDataURL, setQrDataURL] = useState<string>("");

  // A4 size in px at 96dpi: 210mm x 297mm = 794 x 1122
  const A4_WIDTH_PX = 794;
  const A4_HEIGHT_PX = 1122;

  useEffect(() => {
    getCompanyProfile().then(setCompany);
    getBankAccounts()
      .then((accounts) => {
        const resolved =
          accounts.find((account) => account.isDefault) ||
          accounts[0] ||
          null;
        setDefaultBankAccount(resolved);
      })
      .catch(() => setDefaultBankAccount(null));
  }, []);

  useEffect(() => {
    const upiId = (
      bill.bankAccount?.upiId ||
      defaultBankAccount?.upiId ||
      company?.upiId ||
      ""
    ).trim();
    if (!upiId) {
      setQrDataURL("");
      return;
    }
    const amount = Number(bill.total || 0).toFixed(2);
    const upiPayUri =
      `upi://pay?pa=${encodeURIComponent(upiId)}` +
      `&pn=${encodeURIComponent(company?.name || "")}` +
      `&am=${encodeURIComponent(amount)}` +
      `&cu=INR` +
      `&tn=${encodeURIComponent(`${bill.billType === "international" ? "Proforma" : ""} Invoice ${bill.billNumber}`)}`;

    QRCode.toDataURL(upiPayUri, { width: 220, margin: 1 })
      .then(setQrDataURL)
      .catch(() => setQrDataURL(""));
  }, [
    company?.upiId,
    company?.name,
    bill.total,
    bill.billNumber,
    bill.bankAccount?.upiId,
    defaultBankAccount?.upiId,
  ]);

  useLayoutEffect(() => {
    const calculateScale = () => {
      if (!containerRef.current) return;
      const horizontalPadding = 24;
      const verticalPadding = 24;
      const rect = containerRef.current.getBoundingClientRect();
      const baseWidth = rect.width || window.innerWidth || 0;
      const baseHeight = rect.height || window.innerHeight || 0;
      const availableWidth = Math.max(0, baseWidth - horizontalPadding);
      const availableHeight = Math.max(0, baseHeight - verticalPadding);

      const widthScale = availableWidth / A4_WIDTH_PX;
      const heightScale = availableHeight / A4_HEIGHT_PX;
      const nextScale = Math.min(widthScale, heightScale, 1);
      setScale(Math.max(0.25, nextScale));
    };

    let rafId: number | null = null;
    const schedule = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        calculateScale();
      });
    };

    schedule();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(schedule)
        : null;
    if (containerRef.current && ro) ro.observe(containerRef.current);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", schedule);
      vv.addEventListener("scroll", schedule);
    }
    const timeoutId = window.setTimeout(schedule, 250);
    const retryUntilReadyId = window.setInterval(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      schedule();
      if (rect.width > 0 && rect.height > 0) {
        window.clearInterval(retryUntilReadyId);
      }
    }, 120);
    const retryStopId = window.setTimeout(() => {
      window.clearInterval(retryUntilReadyId);
    }, 1600);
    if (document.fonts?.ready) {
      document.fonts.ready.then(schedule).catch(() => { });
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      if (vv) {
        vv.removeEventListener("resize", schedule);
        vv.removeEventListener("scroll", schedule);
      }
      window.clearTimeout(timeoutId);
      window.clearInterval(retryUntilReadyId);
      window.clearTimeout(retryStopId);
    };
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @media print {
        body * { visibility: hidden; }
        #bill-print, #bill-print * { visibility: visible; }
        #bill-print {
          position: absolute; left: 0; top: 0;
          width: 210mm !important; min-height: 297mm !important;
          max-width: 210mm !important; margin: 0 !important;
          padding: 5mm !important; box-shadow: none !important;
          font-size: 10px !important; transform: none !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #bill-print table { border-collapse: collapse !important; }
        @page { size: A4; margin: 0; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handlePrint = () => window.print();

  const resolveSignatureForPdf = async (
    signature?: string,
  ): Promise<string | null> => {
    if (!signature) return null;
    let signatureUrl = signature.trim();
    if (!signatureUrl) return null;

    // Firebase Storage path (legacy case) -> resolve public URL
    if (
      !signatureUrl.startsWith("data:") &&
      !/^https?:\/\//i.test(signatureUrl)
    ) {
      try {
        signatureUrl = await getDownloadURL(ref(storage, signatureUrl));
      } catch (err) {
        console.warn("Failed to resolve Firebase signature path", err);
        return null;
      }
    }

    // Rasterize to PNG before passing to PDF renderer to prevent tiling/repeat artifacts.
    try {
      const response = await fetch(signatureUrl, { mode: "cors" });
      if (!response.ok) return signatureUrl;
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      try {
        const pngDataUrl = await new Promise<string>((resolve, reject) => {
          const img = new window.Image();
          img.onload = () => {
            try {
              const width = Math.max(1, img.naturalWidth || 0);
              const height = Math.max(1, img.naturalHeight || 0);
              const canvas = document.createElement("canvas");
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                reject(new Error("Failed to create canvas context"));
                return;
              }
              ctx.clearRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL("image/png"));
            } catch (drawErr) {
              reject(drawErr);
            }
          };
          img.onerror = () =>
            reject(new Error("Failed to load signature image"));
          img.src = objectUrl;
        });

        return pngDataUrl || signatureUrl;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      console.warn("Failed to convert signature image to PNG data URL", err);
      return signatureUrl;
    }
  };

  const handleDownloadPDF = async () => {
    toast.info("Generating PDF...");
    try {
      const upiId = (
        bill.bankAccount?.upiId ||
        defaultBankAccount?.upiId ||
        company?.upiId ||
        ""
      ).trim();
      const qrToUse = upiId
        ? qrDataURL ||
        (await QRCode.toDataURL(
          `upi://pay?pa=${encodeURIComponent(upiId)}` +
          `&pn=${encodeURIComponent(company?.name || "")}` +
          `&am=${encodeURIComponent(Number(bill.total || 0).toFixed(2))}` +
          `&cu=INR` +
          `&tn=${encodeURIComponent(
            `${bill.billType === "international" ? "Proforma" : ""} Invoice ${bill.billNumber}`,
          )}`,
          { width: 220, margin: 1 },
        ))
        : "";

      // Resolve signature and logo for PDF embedding
      // Pick correct signature: GST bill uses signatureGst (falls back to signature)
      const isGstBill = !!(bill as any).isGst;
      const rawSignature = isGstBill
        ? (company?.signatureGst || company?.signature)
        : company?.signature;
      const signatureForPdf = await resolveSignatureForPdf(rawSignature);
      const gstSignatureForPdf = company?.signatureGst
        ? await resolveSignatureForPdf(company.signatureGst)
        : null;
      const logoForPdf = await resolveSignatureForPdf(company?.logo);

      const isSampleBill = "isSample" in bill && bill.isSample;

      // Pass resolved signature and logo inside company object
      const companyForPdf = {
        ...company,
        ...(signatureForPdf ? { signature: signatureForPdf } : {}),
        ...(gstSignatureForPdf ? { signatureGst: gstSignatureForPdf } : {}),
        ...(logoForPdf ? { logo: logoForPdf } : {}),
      };

      const blob = await pdf(
        <BillPDF
          bill={bill}
          company={companyForPdf}
          qrDataURL={qrToUse}
          isSample={isSampleBill}
          bankAccountOverride={defaultBankAccount}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bill_${bill.billNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully");
    } catch (err) {
      console.error("PDF generation failed", err);
      toast.error("Failed to generate PDF");
    }
  };

  const handleShareWhatsApp = () => {
    const phone = bill.client?.phone?.replace(/\D/g, "");
    if (!phone) {
      toast.error("Client phone number not available");
      return;
    }
    const text = encodeURIComponent(
      `Hello ${bill.client?.name ?? ""}, please find your bill ${bill.billNumber} here: ${window.location.origin}/view/bill/${bill.id}`,
    );
    window.open(`https://wa.me/+91${phone}?text=${text}`, "_blank");
  };

  const isInternational = bill.billType === "international";
  const resolvedBankAccount = bill.bankAccount || defaultBankAccount || null;
  const resolvedUpiId = (
    resolvedBankAccount?.upiId ||
    company?.upiId ||
    ""
  ).trim();

  const formatAddress = (address: string) => {
    if (!address) return null;
    return address.split(",").map((line, i, arr) => (
      <span key={i}>
        {line.trim()}
        {i < arr.length - 1 && <br />}
      </span>
    ));
  };

  if (!company)
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Please setup company profile first
      </div>
    );

  const isSampleBill = "isSample" in bill && bill.isSample;
  // Use GST-specific signature for GST bills, fall back to default signature
  const screenSignature = (bill as any).isGst
    ? (company?.signatureGst || company?.signature || null)
    : (company?.signature || null);
  const scaledWidth = A4_WIDTH_PX * scale;
  const scaledHeight = A4_HEIGHT_PX * scale;

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* ── Action buttons ── */}
      {/* <div className="sticky top-0 z-10dark:border-slate-700 print:hidden">
        <div className="flex flex-wrap items-center justify-center gap-2 p-3 max-w-4xl mx-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none text-xs sm:text-sm touch-manipulation gap-1.5 min-w-[120px]"
            onClick={handleShareWhatsApp}
          >
            <MessageCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
            <span className="truncate">WhatsApp</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none text-xs sm:text-sm touch-manipulation gap-1.5 min-w-[120px]"
            onClick={handleDownloadPDF}
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Download PDF</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none text-xs sm:text-sm touch-manipulation gap-1.5 min-w-[100px]"
            onClick={handlePrint}
          >
            <Printer className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Print</span>
          </Button>
        </div>
      </div> */}

      {/* ── Bill container — centers the scaled bill ── */}
      <div
        ref={containerRef}
        className="flex-1 w-full overflow-hidden"
        style={{
          // Smooth momentum scrolling for any nested scrollable content.
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className="flex h-full w-full items-start justify-center p-3 sm:p-4">
          <div
            style={{
              width: `${scaledWidth}px`,
              height: `${scaledHeight}px`,
            }}
          >
            <div
              ref={billRef}
              id="bill-print"
              className="bg-white shadow-2xl text-black"
              style={{
                width: `${A4_WIDTH_PX}px`,
                minWidth: `${A4_WIDTH_PX}px`,
                maxWidth: `${A4_WIDTH_PX}px`,
                minHeight: `${A4_HEIGHT_PX}px`, // A4 at 96dpi
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                fontFamily: "Inter, Arial, sans-serif",
                padding: "19px", // ~5mm at 96dpi
                boxSizing: "border-box",
                fontSize: "10px",
                lineHeight: "1.4",
                color: "black",
              }}
            >
              {isInternational ? (
                <div>
                  <div className="border border-black mb-3 p-2">
                    <p className="text-[10px] font-bold text-center leading-snug">
                      SUPPLY MEANT FOR EXPORT UNDER BOND OR LETTER OF
                      UNDERTAKING
                      <br />
                      WITHOUT PAYMENT OF ITax
                    </p>
                    <p className="text-[11px] font-bold text-center mt-1">
                      PARFORMA INVOICE
                    </p>
                  </div>

                  <div className="border border-black mb-3">
                    <div className="flex gap-3 p-2">
                      <div className="w-1/2">
                        <p className="font-bold text-[10px] mb-1">Exporter</p>
                        <p className="text-[10px] font-semibold">
                          {String(company.name || "").toUpperCase()}
                        </p>
                        <div className="text-[10px] leading-relaxed">
                          {formatAddress(company.address)}
                        </div>
                        <p className="text-[10px] mt-1">
                          <strong>TEL:</strong> {company.phone || "N.A."}
                        </p>
                        <p className="text-[10px]">
                          <strong>Tax NO:</strong> {company.gstin || "N.A."}
                        </p>
                      </div>
                      <div className="w-1/2 text-right">
                        <p className="text-[10px]">
                          <strong>Invoice No. & Date:</strong> {bill.billNumber}{" "}
                          {formatDate(bill.date)}
                        </p>
                        <p className="text-[10px] mt-0.5">
                          <strong>Buyer's Order No. & Date:</strong> Not
                          Applicable
                        </p>
                        <div className="mt-2">
                          <p className="font-bold text-[10px]">
                            Buyers (If other than consignee)
                          </p>
                          <p className="text-[10px] font-semibold">
                            {(bill.client?.name ?? "").toUpperCase()}
                          </p>
                          <div className="text-[10px] leading-relaxed">
                            {formatAddress(bill.client.billingAddress)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-black p-2 text-[10px]">
                      <p>
                        <strong>Country Of Origin Of Goods:</strong>{" "}
                        {bill.internationalDetails?.countryOfOrigin || "INDIA"}
                      </p>
                      <p className="text-right">
                        <strong>Country Of Final Destination:</strong>{" "}
                        {bill.internationalDetails?.countryOfFinalDestination ||
                          "HONG KONG"}
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] font-bold text-center mb-2">
                    Shipping &amp; Export Details
                  </p>
                  {bill.internationalDetails && (
                    <div className="border border-black/60 mb-3 p-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                        {bill.internationalDetails.preCarriageBy && (
                          <p>
                            <strong>Pre-Carriage By:</strong>{" "}
                            {bill.internationalDetails.preCarriageBy}
                          </p>
                        )}
                        {bill.internationalDetails.vesselsFlightNo && (
                          <p>
                            <strong>Vessels/Flight No.:</strong>{" "}
                            {bill.internationalDetails.vesselsFlightNo}
                          </p>
                        )}
                        {bill.internationalDetails
                          .placeOfReceiptByPreCarriage && (
                            <p>
                              <strong>Place Of Receipt:</strong>{" "}
                              {
                                bill.internationalDetails
                                  .placeOfReceiptByPreCarriage
                              }
                            </p>
                          )}
                        {bill.internationalDetails.finalDestination && (
                          <p>
                            <strong>Final Destination:</strong>{" "}
                            {bill.internationalDetails.finalDestination}
                          </p>
                        )}
                        {bill.internationalDetails.portOfLoading && (
                          <p>
                            <strong>Port of Loading:</strong>{" "}
                            {bill.internationalDetails.portOfLoading}
                          </p>
                        )}
                        {bill.internationalDetails.portOfDischarge && (
                          <p>
                            <strong>Port of Discharge:</strong>{" "}
                            {bill.internationalDetails.portOfDischarge}
                          </p>
                        )}
                        {bill.internationalDetails.countryOfOrigin && (
                          <p>
                            <strong>Country Of Origin:</strong>{" "}
                            {bill.internationalDetails.countryOfOrigin}
                          </p>
                        )}
                        {bill.internationalDetails
                          .countryOfFinalDestination && (
                            <p>
                              <strong>Country Of Destination:</strong>{" "}
                              {
                                bill.internationalDetails
                                  .countryOfFinalDestination
                              }
                            </p>
                          )}
                      </div>
                    </div>
                  )}

                  <div className="border border-black mb-3">
                    <table className="w-full border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-gray-100 border-b border-black">
                          <th
                            className="p-1.5 text-center border-r border-black"
                            style={{ width: "18%" }}
                          >
                            Sl
                          </th>
                          <th
                            className="p-1.5 text-left border-r border-black"
                            style={{ width: "34%" }}
                          >
                            Description of Goods
                          </th>
                          <th
                            className="p-1.5 text-center border-r border-black"
                            style={{ width: "12%" }}
                          ></th>
                          <th
                            className="p-1.5 text-center border-r border-black"
                            style={{ width: "10%" }}
                          >
                            Qty
                          </th>
                          <th
                            className="p-1.5 text-center border-r border-black"
                            style={{ width: "8%" }}
                          >
                            Unit
                          </th>
                          <th
                            className="p-1.5 text-right border-r border-black"
                            style={{ width: "10%" }}
                          >
                            Rate
                          </th>
                          <th
                            className="p-1.5 text-right"
                            style={{ width: "12%" }}
                          >
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bill.items.map((item, index) => (
                          <tr key={index} className="border-b border-black/10">
                            <td className="p-1.5 text-center border-r border-black/10">
                              {index + 1}
                            </td>
                            <td className="p-1.5 border-r border-black/10">
                              <div>{item.productName}</div>
                              {getDeviceDetails(item).map((detail, idx) => (
                                <div
                                  key={idx}
                                  className="text-[9px] text-gray-600 mt-0.5"
                                >
                                  {detail}
                                </div>
                              ))}
                              {bill.internationalDetails?.grossWeight && (
                                <div className="text-[9px] text-gray-600 mt-0.5">
                                  GW: {bill.internationalDetails.grossWeight} kg
                                  | NW:{" "}
                                  {bill.internationalDetails.netWeight || "N/A"}{" "}
                                  kg
                                </div>
                              )}
                            </td>
                            <td className="p-1.5 text-center border-r border-black/10"></td>
                            <td className="p-1.5 text-center border-r border-black/10">
                              {item.quantity}
                            </td>
                            <td className="p-1.5 text-center border-r border-black/10">
                              {item.unit || "PCS"}
                            </td>
                            <td className="p-1.5 text-right border-r border-black/10">
                              {formatCurrency(item.ratePerUnit)}
                            </td>
                            <td className="p-1.5 text-right">
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-black bg-gray-50">
                          <td className="p-1.5 text-right font-bold">
                            Subtotal
                          </td>
                          <td className="p-1.5 text-right font-bold">
                            {formatCurrency(bill.subtotal)}
                          </td>
                        </tr>
                        {bill.discount !== undefined && bill.discount > 0 && (
                          <tr className="border-t border-black text-red-600">
                            <td className="p-1.5 text-right font-bold">
                              Discount
                              {bill.discountType === "percentage"
                                ? ` (${bill.discount}%)`
                                : ""}
                            </td>
                            <td className="p-1.5 text-right font-bold">
                              -{formatCurrency(bill.discount)}
                            </td>
                          </tr>
                        )}
                        {bill.courierCharges !== undefined &&
                          bill.courierCharges > 0 && (
                            <tr className="border-t border-black">
                              <td className="p-1.5 text-right font-bold">
                                Courier Charges
                              </td>
                              <td className="p-1.5 text-right font-bold">
                                {formatCurrency(bill.courierCharges)}
                              </td>
                            </tr>
                          )}

                        <tr className="border-t border-black bg-gray-200">
                          <td className="p-2 text-right font-bold">TOTAL</td>
                          <td className="p-2 text-right font-bold">
                            {formatCurrency(bill.total)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="border border-black mb-3 p-2">
                    <p className="font-bold text-[10px] mb-1">DECLARATION:</p>
                    <p className="text-[10px] leading-relaxed">
                      THE DIAMONDS HEREIN INVOICED ARE EXCLUSIVELY OF LAB GROWN
                      DIAMOND BASED ON PERSONAL KNOWLEDGE AND/OR WRITTEN
                      GUARANTEES PROVIDED BY THE SUPPLIER OF THESE DIAMONDS.
                    </p>
                    <p className="text-[10px] leading-relaxed mt-1">
                      TOTAL US DOLLARS : {numberToWords(Math.round(bill.total))}
                    </p>
                    <p className="text-[10px] leading-relaxed mt-1">
                      WE INTEND TO CLAIM BENEFIT UNDER RoDTEP SCHEME AS
                      APPLICABLE
                    </p>
                    <p className="text-[10px] leading-relaxed mt-1">
                      The diamonds herein invoiced have been purchased from
                      legitimate sources not involved in funding conflict and in
                      compliance with United Nations resolutions. The seller
                      hereby guarantees that the supplier of these diamonds is
                      conflict free, based on personal knowledge and/or written
                      guarantees provided by the supplier of these diamonds.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-0 pt-1">
                    {(bill as any).isGst && (resolvedBankAccount?.bankName || company.bankDetails?.bankName) && (
                      <div className="pr-2">
                        <p className="font-bold text-[10px] mb-1">
                          PAYMENT INSTRUCTIONS:
                        </p>
                        <div className="text-[10px] space-y-0.5 mt-1">
                          {(resolvedBankAccount?.accountHolder || company.bankDetails?.accountHolder) && (
                            <p>
                              <strong>A/c Holder:</strong>{" "}
                              {resolvedBankAccount?.accountHolder ||
                                company.bankDetails?.accountHolder}
                            </p>
                          )}
                          {(resolvedBankAccount?.bankName || company.bankDetails?.bankName) && (
                            <p>
                              <strong>Bank Name:</strong>{" "}
                              {resolvedBankAccount?.bankName ||
                                company.bankDetails?.bankName}
                            </p>
                          )}
                          {(resolvedBankAccount?.accountNumber || company.bankDetails?.accountNumber) && (
                            <p>
                              <strong>A/c Number:</strong>{" "}
                              {resolvedBankAccount?.accountNumber ||
                                company.bankDetails?.accountNumber}
                            </p>
                          )}
                          {(resolvedBankAccount?.branchAndIFSC || company.bankDetails?.branchAndIFSC) && (
                            <p>
                              <strong>Branch & IFSC:</strong>{" "}
                              {resolvedBankAccount?.branchAndIFSC ||
                                company.bankDetails?.branchAndIFSC}
                            </p>
                          )}
                        </div>
                        {resolvedUpiId && qrDataURL && (
                          <div className="mt-2 flex flex-col items-center w-[55px]">
                            <img
                              src={qrDataURL}
                              alt="Scan & Pay QR"
                              className="w-[55px] h-[55px]"
                            />
                            <p className="text-[10px] text-gray-700 text-center mt-1">
                              Scan & Pay
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col items-center justify-center pl-2 text-center">
                      <p className="text-[10px]">
                        Signature & Date: {formatDate(new Date().toISOString())}
                      </p>
                      {!screenSignature && (
                        <p className="text-[10px] font-bold mt-1">
                          FOR {String(company.name || "").toUpperCase()}
                        </p>
                      )}
                      {screenSignature ? (
                        <img
                          src={screenSignature}
                          alt="Authorised Signature"
                          className="h-12 w-32 object-contain mx-auto my-1"
                        />
                      ) : (
                        <div className="h-10" />
                      )}
                      {!screenSignature && (
                        <p className="text-[10px]">Proprietor</p>
                      )}
                      <p className="text-[10px] font-bold">Authorised Signatory</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── HEADER ── */}
                  <div className="border-2 border-black">
                    <div className="flex justify-between items-start gap-3 p-3">
                      {/* Left: Company name + address */}
                      <div className="flex-1">
                        <h1
                          className="font-bold text-[18px] tracking-wide mb-1"
                          style={{ color: 'black' }}
                        >
                          {String(company.name || "").toUpperCase()}
                        </h1>
                        <div className="text-[10px] leading-relaxed text-black">
                          {formatAddress(company.address)}
                        </div>
                      </div>
                      {/* Right: Logo + contact */}
                      <div className="flex flex-col items-end gap-1">
                        {company.logo && (
                          <img
                            src={company.logo}
                            alt={company.name}
                            style={{
                              width: company.logoWidth ?? company.logoSize ?? 50,
                              height: company.logoHeight ?? company.logoSize ?? 50,
                            }}
                            className="object-contain mb-1"
                          />
                        )}
                        {(bill as any).isGst && (
                          <p className="text-[9px] font-bold tracking-widest" style={{ color: "#1e40af" }}>TAX INVOICE</p>
                        )}
                        <p className="text-[10px]"><strong>Tel : </strong>{company.phone}</p>
                        {company.email && <p className="text-[10px]"><strong>Email : </strong>{company.email}</p>}
                        {(bill as any).isGst && company.gstin && (
                          <p className="text-[10px]"><strong>GSTIN : </strong>{company.gstin}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── CUSTOMER DETAILS + INVOICE INFO ── */}
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid black", marginBottom: "8px", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        {/* Left: Customer Detail */}
                        <td style={{ width: "50%", borderRight: "1px solid black", verticalAlign: "top" }}>
                          <div style={{ backgroundColor: "#f0f0f0", padding: "4px 6px", borderBottom: "1px solid black" }}>
                            <p className="text-[10px] font-bold">Customer Detail</p>
                          </div>
                          <div style={{ padding: "4px 6px" }} className="space-y-1">
                            <div className="flex gap-2">
                              <span className="text-[10px] font-bold shrink-0" style={{ width: "44px" }}>M/S</span>
                              <span className="text-[10px] font-bold">{bill.client?.name ?? ""}</span>
                            </div>
                            {(bill.client.billingAddress?.trim() || (bill.client as any).shippingAddress?.trim()) && (
                              <div className="flex gap-2">
                                <span className="text-[10px] font-bold shrink-0" style={{ width: "44px" }}>Address</span>
                                <span className="text-[10px] leading-relaxed">
                                  {formatAddress(bill.client.billingAddress?.trim() || (bill.client as any).shippingAddress?.trim() || "")}
                                </span>
                              </div>
                            )}
                            {bill.client.phone && (
                              <div className="flex gap-2">
                                <span className="text-[10px] font-bold shrink-0" style={{ width: "44px" }}>Phone</span>
                                <span className="text-[10px]">{bill.client.phone}</span>
                              </div>
                            )}
                            {(bill as any).placeOfSupply && (
                              <div className="flex gap-2">
                                <span className="text-[10px] font-bold shrink-0 leading-tight" style={{ width: "44px" }}>Place of Supply</span>
                                <span className="text-[10px]">{(bill as any).placeOfSupply}</span>
                              </div>
                            )}
                            {(bill as any).isGst && (bill.client as any)?.gstin && (
                              <div className="flex gap-2">
                                <span className="text-[10px] font-bold shrink-0" style={{ width: "44px" }}>GSTIN</span>
                                <span className="text-[10px]">{(bill.client as any).gstin}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Right: Invoice metadata */}
                        <td style={{ verticalAlign: "top" }}>
                          {/* Invoice No + Invoice Date */}
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                              <tr style={{ borderBottom: "1px solid black" }}>
                                <td style={{ padding: "4px 6px", borderRight: "1px solid black", width: "50%" }}>
                                  <p className="text-[10px] font-bold">Invoice No.</p>
                                  <p className="text-[10px]">{bill.billNumber}</p>
                                </td>
                                <td style={{ padding: "4px 6px", textAlign: "right" }}>
                                  <p className="text-[10px] font-bold">Invoice Date</p>
                                  <p className="text-[10px]">{formatDate(bill.date)}</p>
                                </td>
                              </tr>
                              {/* Due Date */}
                              <tr>
                                <td style={{ padding: "4px 6px", borderRight: "1px solid black" }}>
                                  <p className="text-[10px] font-bold">Due Date</p>
                                </td>
                                <td style={{ padding: "4px 6px", textAlign: "right" }}>
                                  <p className="text-[10px]">{formatDate(bill.dueDate)}</p>
                                </td>
                              </tr>
                              {bill.deliveryNote && (
                                <tr style={{ borderBottom: "1px solid black" }}>
                                  <td style={{ padding: "4px 6px", borderRight: "1px solid black" }}>
                                    <p className="text-[10px] font-bold">Delivery Note</p>
                                  </td>
                                  <td style={{ padding: "4px 6px", textAlign: "right" }}>
                                    <p className="text-[10px]">{bill.deliveryNote}</p>
                                  </td>
                                </tr>
                              )}
                              {bill.modeOfPayment && (
                                <tr>
                                  <td style={{ padding: "4px 6px", borderRight: "1px solid black" }}>
                                    <p className="text-[10px] font-bold">Payment Mode</p>
                                  </td>
                                  <td style={{ padding: "4px 6px", textAlign: "right" }}>
                                    <p className="text-[10px]">{bill.modeOfPayment}</p>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* ── ITEMS TABLE ── */}
                  <div className="mb-0">
                    {(() => {
                      const MIN_ROWS = 10;
                      const fillerCount = Math.max(0, MIN_ROWS - bill.items.length);
                      return (
                        <table className="w-full border-collapse text-[10px]">
                          <thead>
                            <tr style={{ backgroundColor: company.themeColor, color: "white" }}>
                              <th className="border border-black p-1.5 text-center" style={{ width: "28px" }}>
                                Sr.No.
                              </th>
                              <th className="border border-black p-1.5 text-left">
                                Name of Product / Service
                              </th>
                              <th className="border border-black p-1.5 text-center" style={{ width: "46px" }}>Qty</th>
                              <th className="border border-black p-1.5 text-center" style={{ width: "40px" }}>Unit</th>
                              <th className="border border-black p-1.5 text-center" style={{ width: "80px" }}>Rate</th>
                              <th className="border border-black p-1.5 text-right" style={{ width: "90px" }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bill.items.map((item, index) => (
                              <tr key={index} className={index % 2 === 0 ? "" : "bg-gray-50"}>
                                <td className="border border-black p-1.5 text-center">{index + 1}</td>
                                <td className="border border-black p-1.5">
                                  <div>{item.productName}</div>
                                  {getDeviceDetails(item).map((detail, idx) => (
                                    <div key={idx} className="text-[9px] text-gray-600 mt-0.5">{detail}</div>
                                  ))}
                                </td>
                                <td className="border border-black p-1.5 text-center">{item.quantity}</td>
                                <td className="border border-black p-1.5 text-center">{item.unit}</td>
                                <td className="border border-black p-1.5 text-right">{formatCurrency(item.ratePerUnit)}</td>
                                <td className="border border-black p-1.5 text-right">{formatCurrency(item.amount)}</td>
                              </tr>
                            ))}
                            {/* Filler rows — column dividers visible, no horizontal row lines */}
                            {Array.from({ length: fillerCount }).map((_, i) => (
                              <tr key={`filler-${i}`} style={{ height: "22px" }}>
                                <td style={{ borderLeft: "1px solid black", borderRight: "1px solid black" }}></td>
                                <td style={{ borderRight: "1px solid black" }}></td>
                                <td style={{ borderRight: "1px solid black" }}></td>
                                <td style={{ borderRight: "1px solid black" }}></td>
                                <td style={{ borderRight: "1px solid black" }}></td>
                                <td style={{ borderRight: "1px solid black" }}></td>
                              </tr>
                            ))}
                            {/* Total row */}
                            <tr className="font-semibold bg-gray-100">
                              <td className="border border-black p-1.5 text-right font-bold" colSpan={2}>Total</td>
                              <td className="border border-black p-1.5 text-center font-bold">
                                {bill.items.reduce((s, it) => s + it.quantity, 0)}{" "}
                                {(bill.items[0]?.unit || "NOS").toUpperCase()}
                              </td>
                              <td className="border border-black p-1.5" colSpan={2}></td>
                              <td className="border border-black p-1.5 text-right font-bold">
                                {formatCurrency(bill.subtotal)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>

                  {/* ── FOOTER: two columns ── */}
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid black", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        {/* LEFT column */}
                        <td style={{ width: "58%", borderRight: "1px solid black", verticalAlign: "top", height: "1px" }}>
                        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

                          {/* Total in words */}
                          <div style={{ padding: "6px", borderBottom: "1px solid black" }}>
                            <p className="text-[10px] font-bold" style={{ marginBottom: "2px" }}>Total in words</p>
                            <p className="text-[10px] leading-snug">
                              {String(numberToWords(Math.round(bill.total))).toUpperCase()} RUPEES ONLY
                            </p>
                          </div>

                          {/* Bank Details — GST bills only */}
                          {(bill as any).isGst && (resolvedBankAccount?.bankName || company.bankDetails?.bankName) && (
                            <div style={{ padding: "6px", borderBottom: "1px solid black" }}>
                              <p className="text-[10px] font-bold" style={{ marginBottom: "4px" }}>Bank Details</p>
                              <div className="flex items-start gap-2">
                                <div className="flex-1 space-y-0.5">
                                  {(resolvedBankAccount?.bankName || company.bankDetails?.bankName) && (
                                    <div className="flex gap-2">
                                      <span className="text-[10px] font-bold w-[64px] shrink-0">Name</span>
                                      <span className="text-[10px]">{resolvedBankAccount?.bankName || company.bankDetails?.bankName}</span>
                                    </div>
                                  )}
                                  {(resolvedBankAccount?.branchAndIFSC || company.bankDetails?.branchAndIFSC) && (
                                    <div className="flex gap-2">
                                      <span className="text-[10px] font-bold w-[64px] shrink-0">Branch</span>
                                      <span className="text-[10px]">{(resolvedBankAccount?.branchAndIFSC || company.bankDetails?.branchAndIFSC || "").split(" ")[0]}</span>
                                    </div>
                                  )}
                                  {(resolvedBankAccount?.accountNumber || company.bankDetails?.accountNumber) && (
                                    <div className="flex gap-2">
                                      <span className="text-[10px] font-bold w-[64px] shrink-0">Acc. Number</span>
                                      <span className="text-[10px]">{resolvedBankAccount?.accountNumber || company.bankDetails?.accountNumber}</span>
                                    </div>
                                  )}
                                  {(resolvedBankAccount?.branchAndIFSC || company.bankDetails?.branchAndIFSC) && (
                                    <div className="flex gap-2">
                                      <span className="text-[10px] font-bold w-[64px] shrink-0">IFSC</span>
                                      <span className="text-[10px]">{resolvedBankAccount?.branchAndIFSC || company.bankDetails?.branchAndIFSC}</span>
                                    </div>
                                  )}
                                  {resolvedUpiId && (
                                    <div className="flex gap-2">
                                      <span className="text-[10px] font-bold w-[64px] shrink-0">UPI ID</span>
                                      <span className="text-[10px]">{resolvedUpiId}</span>
                                    </div>
                                  )}
                                </div>
                                {resolvedUpiId && qrDataURL && (
                                  <div className="flex flex-col items-center shrink-0">
                                    <img src={qrDataURL} alt="UPI QR" className="w-[50px] h-[50px]" />
                                    <p className="text-[8px] text-gray-600 mt-0.5 text-center">Pay using UPI</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Terms and Conditions */}
                          {(bill.notes || company.defaultNote) && (
                            <div style={{ padding: "6px", borderBottom: "1px solid black" }}>
                              <p className="text-[10px] font-bold" style={{ marginBottom: "2px" }}>Terms and Conditions</p>
                              <p className="text-[10px] leading-relaxed whitespace-pre-wrap">
                                {bill.notes || company.defaultNote}
                              </p>
                            </div>
                          )}

                          {/* Return History */}
                          {bill.returnComment && (
                            <div style={{ padding: "6px", borderBottom: "1px solid black" }}>
                              <p className="text-[10px] font-bold" style={{ marginBottom: "2px" }}>Return History</p>
                              <p className="text-[10px] whitespace-pre-wrap">{bill.returnComment}</p>
                            </div>
                          )}

                          {/* Payment History */}
                          {bill.payments && bill.payments.length > 0 && (
                            <div style={{ padding: "6px", borderBottom: "1px solid black" }}>
                              <p className="text-[10px] font-bold" style={{ marginBottom: "4px" }}>Payment History</p>
                              <div className="space-y-0.5">
                                {bill.payments.map((payment, index) => (
                                  <div key={payment.id || index} className="flex justify-between text-[9px] border-b border-gray-100 pb-0.5 last:border-0">
                                    <span className="flex-1 pr-2">{payment.method} ({formatDate(payment.date)})</span>
                                    <span className="font-semibold shrink-0">{formatCurrency(payment.amount)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-between text-[9px] mt-1 pt-1 border-t border-gray-300">
                                <span className="font-semibold">Total Paid</span>
                                <span className="font-bold">{formatCurrency(bill.paidAmount)}</span>
                              </div>
                            </div>
                          )}

                          {/* Customer Signature — centered in remaining space */}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6px" }}>
                            <p className="text-[10px] font-bold text-center" style={{ marginBottom: "4px" }}>Customer Signature</p>
                            <div style={{ width: "100%", height: "30px", borderBottom: "1px dashed #9ca3af" }}></div>
                            <p className="text-[9px] text-gray-600 text-center mt-0.5">{bill.client?.name ?? ""}</p>
                          </div>
                          </div>
                        </td>

                        {/* RIGHT column */}
                        <td style={{ verticalAlign: "top", height: "1px" }}>
                          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                          {/* Amount summary */}
                          <div style={{ padding: "6px", borderBottom: "1px solid black" }}>
                            <div className="flex justify-between text-[10px] mb-1">
                              <span>Taxable Amount</span>
                              <span className="font-bold">{formatCurrency(bill.subtotal)}</span>
                            </div>
                            {bill.discount !== undefined && bill.discount > 0 && (
                              <div className="flex justify-between text-[10px] mb-1 text-red-700">
                                <span>Discount{bill.discountType === "percentage" ? ` (${bill.discount}%)` : ""}</span>
                                <span className="font-bold">-{formatCurrency(bill.discount)}</span>
                              </div>
                            )}
                            {bill.courierCharges !== undefined && bill.courierCharges > 0 && (
                              <div className="flex justify-between text-[10px] mb-1">
                                <span>Courier Charges</span>
                                <span className="font-bold">{formatCurrency(bill.courierCharges)}</span>
                              </div>
                            )}
                            {(bill as any).otherCharges !== undefined && (bill as any).otherCharges > 0 && (
                              <div className="flex justify-between text-[10px] mb-1">
                                <span>Other Charges</span>
                                <span className="font-bold">{formatCurrency((bill as any).otherCharges)}</span>
                              </div>
                            )}
                            {(bill as any).isGst && (bill as any).cgst > 0 && (
                              <div className="flex justify-between text-[10px] mb-1 text-blue-700">
                                <span>CGST ({((bill as any).gstRate ?? 0) / 2}%)</span>
                                <span className="font-bold">{formatCurrency((bill as any).cgst)}</span>
                              </div>
                            )}
                            {(bill as any).isGst && (bill as any).sgst > 0 && (
                              <div className="flex justify-between text-[10px] mb-1 text-blue-700">
                                <span>SGST ({((bill as any).gstRate ?? 0) / 2}%)</span>
                                <span className="font-bold">{formatCurrency((bill as any).sgst)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-[10px] font-bold border-t border-black pt-1 mt-1">
                              <span>{(bill as any).isGst ? "Total Amount (Inc. Tax)" : "Total Amount"}</span>
                              <span>{formatCurrency(bill.total)}</span>
                            </div>
                            <p className="text-[8px] text-gray-500 text-right mt-0.5">(E & O.E.)</p>
                          </div>

                          {/* Certification + Signature — vertically & horizontally centered */}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6px", textAlign: "center" }}>
                            <p className="text-[10px] leading-relaxed text-center">
                              {isSampleBill
                                ? "This is a SAMPLE BILL for demonstration purposes only. Not valid for actual transactions."
                                : "Certified that the particulars given above are true and correct."}
                            </p>
                            {!screenSignature && (
                              <p className="text-[10px] font-bold mt-1.5 text-center">For {company.name}</p>
                            )}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "4px 0" }}>
                              {screenSignature ? (
                                <img src={screenSignature} alt="Authorised Signature" style={{ height: "46px", width: "150px" }} className="object-contain" />
                              ) : null}
                            </div>
                            <p className="text-[10px] font-bold text-center">Authorised Signatory</p>
                          </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-[8px] text-gray-500 text-center mt-2">
                    This is a computer generated invoice no signature required.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
