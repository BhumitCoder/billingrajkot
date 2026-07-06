import React, { useRef, useEffect, useState } from "react";
import { SampleBill } from "@/types";
import {
  formatCurrency,
  formatDate,
  numberToWords,
  formatToTwoDecimals,
} from "@/lib/billUtils";
import { getCompanyProfile } from "@/lib/storage";
import { Button } from "./ui/button";
import { Download, Printer, MessageCircle, AlertCircle } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Card, CardContent } from "./ui/card";
import QRCode from "qrcode";

interface SampleBillViewProps {
  bill: SampleBill;
}

export function SampleBillView({ bill }: SampleBillViewProps) {
  const billRef = useRef<HTMLDivElement>(null);
  const [company, setCompany] = useState<any>(null);
  const [qrDataURL, setQrDataURL] = useState<string>("");

  useEffect(() => {
    const loadCompany = async () => {
      const companyData = await getCompanyProfile();
      setCompany(companyData);
    };
    loadCompany();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const upiId = (bill.bankAccount?.upiId || company?.upiId || "").trim();
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
      `&tn=${encodeURIComponent(`Sample Invoice ${bill.billNumber}`)}`;

    QRCode.toDataURL(upiPayUri, { margin: 1, width: 256 })
      .then((url) => {
        if (!cancelled) setQrDataURL(url);
      })
      .catch((err) => {
        console.error("Failed to generate UPI QR code:", err);
        if (!cancelled) setQrDataURL("");
      });
    return () => {
      cancelled = true;
    };
  }, [
    company?.upiId,
    company?.name,
    bill.total,
    bill.billNumber,
    bill.bankAccount?.upiId,
  ]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @media print {
        body * { visibility: hidden; }
        #sample-bill-print, #sample-bill-print * { visibility: visible; }
        #sample-bill-print { 
          position: absolute; 
          left: 0; 
          top: 0; 
          width: 210mm !important; 
          min-height: 297mm !important; 
          max-width: 210mm !important;
          margin: 0 !important;
          padding: 5mm !important;
          box-shadow: none !important;
          font-size: 10px !important;
          transform: none !important;
          transform-origin: unset !important;
          overflow: visible !important;
        }
          #sample-bill-print * {
          break-inside: avoid !important;
        }
        table { page-break-inside: avoid; }
        #sample-bill-print table {
          font-size: 9px !important;
        }
        #sample-bill-print th, #sample-bill-print td {
          padding: 1mm !important;
        }
        @page { 
          size: A4; 
          margin: 0; 
        }
      }
      @media screen and (max-width: 768px) {
        #sample-bill-print-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          display: flex;
          justify-content: center;
          padding: 10px;
        }
        #sample-bill-print {
          transform: scale(0.75);
          transform-origin: top center;
          margin-bottom: 20px;
        }
      }
      @media screen and (max-width: 480px) {
        #sample-bill-print {
          transform: scale(0.6);
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  const handleDownload = async () => {
    if (!billRef.current) return;

    const element = billRef.current;

    // Hide buttons before capture (in case any are visible)
    const buttons = document.querySelectorAll(".print\\:hidden");
    // Temporarily ensure no extra elements interfere

    try {
      const canvas = await html2canvas(element, {
        scale: 3, // Higher quality
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        width: element.scrollWidth,
        height: element.scrollHeight,
        onclone: (clonedDoc) => {
          // Ensure the cloned bill has exact A4 proportions and no scaling
          const clonedBill = clonedDoc.getElementById("sample-bill-print");
          if (clonedBill) {
            clonedBill.style.transform = "none !important";
            clonedBill.style.transformOrigin = "unset";
            clonedBill.style.width = "210mm";
            clonedBill.style.maxWidth = "210mm";
            clonedBill.style.minHeight = "297mm";
            clonedBill.style.margin = "0";
            clonedBill.style.padding = "5mm";
            clonedBill.style.boxShadow = "none";
            clonedBill.style.overflow = "visible";
          }
        },
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Canvas dimensions in mm
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;

      let finalWidth = pdfWidth;
      let finalHeight = pdfWidth / ratio;

      // If content is taller than A4, scale down to fit height
      if (finalHeight > pdfHeight) {
        finalHeight = pdfHeight;
        finalWidth = pdfHeight * ratio;
      }

      // Center the image
      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = (pdfHeight - finalHeight) / 2;

      pdf.addImage(
        imgData,
        "PNG",
        xOffset,
        yOffset,
        finalWidth,
        finalHeight,
        undefined,
        "SLOW", // Better quality than FAST
      );

      pdf.save(`${bill.billNumber}-SAMPLE.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
    }
  };

  const handlePrint = () => {
    // Force the browser to recalculate styles/layout before printing
    if (billRef.current) {
      void billRef.current.offsetHeight; // Clean way to trigger reflow
    }

    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleWhatsAppShare = () => {
    const clientPhone = bill.client.phone
      ? bill.client.phone.replace(/\D/g, "")
      : "";
    const clientName = bill.client?.name ?? "";
    const billNumber = bill.billNumber;
    const billTotal = bill.total;
    const billDate = formatDate(bill.date);

    const message = `Hi ${clientName},

📄 *Invoice Details*
━━━━━━━━━━━━━━━━━━━━
Invoice Number: ${billNumber}
Date: ${billDate}
Amount: ${formatCurrency(billTotal)}
Status: ${bill.paymentStatus.toUpperCase()}

⚠️ *This is a SAMPLE BILL for demonstration purposes only*

Thank you!`;

    const whatsappUrl = clientPhone
      ? `https://wa.me/+91${clientPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, "_blank");
  };

  if (!company) {
    return <div>Please setup company profile first</div>;
  }

  const formatAddress = (address: string) => {
    return address.split(",").map((line, i, arr) => (
      <span key={i}>
        {line.trim()}
        {i < arr.length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className="w-full max-w-full">
      <div className="mb-3 sm:mb-4 flex flex-wrap gap-2 print:hidden px-2 sm:px-0">
        <Button
          onClick={handleDownload}
          className="flex-1 sm:flex-none text-xs sm:text-sm touch-manipulation"
        >
          <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
          Download PDF
        </Button>
        <Button
          onClick={handlePrint}
          variant="outline"
          className="flex-1 sm:flex-none text-xs sm:text-sm touch-manipulation"
        >
          <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
          Print
        </Button>
        <Button
          onClick={handleWhatsAppShare}
          variant="outline"
          className="flex-1 sm:flex-none bg-green-50 hover:bg-green-100 text-green-700 border-green-200 text-xs sm:text-sm touch-manipulation"
        >
          <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
          WhatsApp Share
        </Button>
      </div>
      <div id="sample-bill-print-wrapper" className="w-full">
        <div
          ref={billRef}
          id="sample-bill-print"
          className="bg-white text-black shadow-lg mx-auto relative overflow-hidden"
          style={{
            width: "210mm",
            minWidth: "210mm",
            maxWidth: "210mm",
            minHeight: "297mm",
            padding: "10mm 8mm", // Slightly increased padding for better margins
            boxSizing: "border-box",
            fontSize: "10px",
            lineHeight: "1.4",
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            background: "white",
          }}
        >
          <div style={{ position: "relative", zIndex: 1 }}>
            <div>
              {/* Export / Proforma style (matches International PDF layout) */}
              <div className="border border-black mb-3 p-2">
                <p className="text-[10px] font-bold text-center leading-snug">
                  SUPPLY MEANT FOR EXPORT UNDER BOND OR LETTER OF UNDERTAKING
                  <br />
                  WITHOUT PAYMENT OF ITax
                </p>
                <p className="text-[11px] font-bold text-center mt-1">
                  PARFORMA INVOICE
                </p>
              </div>

              {/* Exporter + Invoice + Buyer */}
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
                    <p className="text-[10px]"></p>
                  </div>

                  <div className="w-1/2 text-right">
                    <p className="text-[10px]">
                      <strong>Invoice Number & Date:</strong> {bill.billNumber}{" "}
                      {formatDate(bill.date)}
                    </p>
                    <p className="text-[10px] mt-0.5">
                      <strong>Buyer's Order No. & Date:</strong> Not Applicable
                    </p>

                    <div className="mt-2">
                      <p className="font-bold text-[10px]">
                        Buyers (If other than consignee)
                      </p>
                      <p className="text-[10px] font-semibold">
                        {String(bill.client?.name || "").toUpperCase()}
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
                  </p>
                  <p className="text-right">
                    <strong>Country Of Final Destination:</strong> "HONG KONG"
                  </p>
                </div>
              </div>

              {/* Shipping & Export Details */}
              <p className="text-[10px] font-bold text-center mb-2">
                Shipping & Export Details
              </p>
              <div className="border border-black/60 mb-3 p-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                  <p>
                    <strong>Pre-Carriage By:</strong>{" "}
                  </p>
                  <p>
                    <strong>Vessels/Flight No.:</strong>{" "}
                  </p>
                  <p>
                    <strong>Place Of Receipt:</strong>{" "}
                  </p>
                  <p>
                    <strong>Final Destination:</strong>{" "}
                  </p>
                  <p>
                    <strong>Port of Loading:</strong>{" "}
                  </p>
                  <p>
                    <strong>Port of Discharge:</strong>{" "}
                  </p>
                  <p>
                    <strong>Country Of Origin:</strong>{" "}
                  </p>
                  <p>
                    <strong>Country Of Destination:</strong>{" "}
                  </p>
                </div>
              </div>

              {/* Items Table */}
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
                      <th className="p-1.5 text-right" style={{ width: "12%" }}>
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
                          <div className="text-[9px] text-gray-600 mt-0.5"></div>
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
                      <td className="p-1.5 text-right font-bold">Subtotal</td>
                      <td className="p-1.5 text-right font-bold">
                        {formatCurrency(bill.subtotal)}
                      </td>
                    </tr>
                    <tr className="border-t border-black bg-gray-200">
                      <td className="p-2 text-right font-bold">TOTAL</td>
                      <td className="p-2 text-right font-bold">
                        {formatCurrency(bill.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Declaration */}
              <div className="border border-black mb-3 p-2">
                <p className="font-bold text-[10px] mb-1">DECLARATION:</p>
                <p className="text-[10px] leading-relaxed">
                  THE DIAMONDS HEREIN INVOICED ARE EXCLUSIVELY OF LAB GROWN
                  DIAMOND BASED ON PERSONAL KNOWLEDGE AND/OR WRITTEN GUARANTEES
                  PROVIDED BY THE SUPPLIER OF THESE DIAMONDS.
                </p>
                <p className="text-[10px] leading-relaxed mt-1">
                  TOTAL US DOLLARS : {numberToWords(Math.round(bill.total))}
                </p>
                <p className="text-[10px] leading-relaxed mt-1">
                  WE INTEND TO CLAIM BENEFIT UNDER RoDTEP SCHEME AS APPLICABLE
                </p>
                <p className="text-[10px] leading-relaxed mt-1">
                  The diamonds herein invoiced have been purchased from
                  legitimate sources not involved in funding conflict and in
                  compliance with United Nations resolutions. The seller hereby
                  guarantees that the supplier of these diamonds is conflict
                  free, based on personal knowledge and/or written guarantees
                  provided by the supplier of these diamonds.
                </p>
              </div>

              {/* Payment + Signature */}
              <div className="grid grid-cols-2 gap-0 pt-1">
                <div className="pr-2">
                  <p className="font-bold text-[10px] mb-1">
                    PAYMENT INSTRUCTIONS:
                  </p>
                  <p className="text-[10px]">
                    {company.bankDetails?.accountHolder || "N.A."}
                  </p>
                  <p className="text-[10px]">
                    A/c No.: {company.bankDetails?.accountNumber || "N.A."}
                  </p>
                  <p className="text-[10px]">
                    Bank: {company.bankDetails?.bankName || "N.A."}
                  </p>
                  <p className="text-[10px]">
                    Branch & IFSC:{" "}
                    {company.bankDetails?.branchAndIFSC || "N.A."}
                  </p>
                  {qrDataURL && (
                    <div className="mt-2 flex items-center gap-2">
                      <img
                        src={qrDataURL}
                        alt="Scan & Pay QR"
                        className="w-[55px] h-[55px]"
                      />
                      <p className="text-[10px] text-gray-700">
                        Scan & Pay (UPI)
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-right pl-2">
                  <p className="text-[10px]">
                    Signature & Date: {formatDate(new Date().toISOString())}
                  </p>
                  <p className="text-[10px] font-bold mt-1">
                    FOR {String(company.name || "").toUpperCase()}
                  </p>
                  <div className="h-12" />
                  <p className="text-[10px]">Proprietor</p>
                </div>
              </div>
            </div>
            ) : (
            <>
              {/* Header */}
              <div className="border-2 border-black mb-2 sm:mb-3">
                <div className="flex flex-row justify-between items-start gap-3 p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {company.logo && (
                        <img
                          src={company.logo}
                          alt={company.name}
                          style={{ width: company.logoWidth ?? company.logoSize ?? 40, height: company.logoHeight ?? company.logoSize ?? 40 }}
                          className="object-contain flex-shrink-0"
                        />
                      )}
                      <h1
                        className="text-base font-bold break-words"
                        style={{ color: company.themeColor }}
                      >
                        {company.name}
                      </h1>
                    </div>
                    <div className="text-[10px] leading-relaxed mt-1 break-words">
                      {company.address.split(",").map((line, i) => (
                        <span key={i}>
                          {line.trim()}
                          {i < company.address.split(",").length - 1 && <br />}
                        </span>
                      ))}
                    </div>
                    <div className="text-[10px] mt-1 break-words">
                      <p></p>
                      <p>
                        <strong>State:</strong> {company.state},{" "}
                      </p>
                    </div>
                    <div className="text-[10px] mt-1 break-words">
                      <p>
                        <strong>Phone:</strong> {company.phone}
                      </p>
                      <p>
                        <strong>Email:</strong> {company.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <h2
                      className="text-lg font-bold mb-2 break-words"
                      style={{ color: company.themeColor }}
                    ></h2>
                    <div className="text-[10px] space-y-0.5 break-words">
                      <p>
                        <strong>Invoice No.:</strong> {bill.billNumber}
                      </p>
                      <p>
                        <strong>Date:</strong> {formatDate(bill.date)}
                      </p>
                      <p>
                        <strong>Due Date:</strong> {formatDate(bill.dueDate)}
                      </p>
                      {bill.deliveryNote && (
                        <p>
                          <strong>Delivery Note:</strong> {bill.deliveryNote}
                        </p>
                      )}
                      {bill.modeOfPayment && (
                        <p>
                          <strong>Payment Mode:</strong> {bill.modeOfPayment}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Details */}
              <div className="grid grid-cols-2 gap-0 mb-3">
                <div className="border border-black p-2">
                  <h3
                    className="font-bold text-[10px] mb-1 border-b border-black pb-1 break-words"
                    style={{ color: company.themeColor }}
                  >
                    Consignee (Ship to)
                  </h3>
                  <p className="font-semibold text-[11px] break-words">
                    {bill.client?.name ?? ""}
                  </p>
                  <div className="text-[10px] leading-relaxed mt-1 break-words">
                    {formatAddress(
                      bill.client.shippingAddress || bill.client.billingAddress,
                    )}
                  </div>
                  <div className="text-[10px] mt-1 break-words">
                    <p></p>
                    <p>
                      <strong>State:</strong> {bill.client.state},{" "}
                    </p>
                  </div>
                  {bill.client.phone && (
                    <p className="text-[10px] break-words">
                      <strong>Phone:</strong> {bill.client.phone}
                    </p>
                  )}
                </div>
                <div className="border border-black border-l-0 p-2">
                  <h3
                    className="font-bold text-[10px] mb-1 border-b border-black pb-1 break-words"
                    style={{ color: company.themeColor }}
                  >
                    Buyer (Bill to)
                  </h3>
                  <p className="font-semibold text-[11px] break-words">
                    {bill.client?.name ?? ""}
                  </p>
                  <div className="text-[10px] leading-relaxed mt-1 break-words">
                    {formatAddress(bill.client.billingAddress)}
                  </div>
                  <div className="text-[10px] mt-1 break-words">
                    <p></p>
                    <p>
                      <strong>State:</strong> {bill.client.state},{" "}
                    </p>
                  </div>
                  {bill.placeOfSupply && (
                    <p className="text-[10px] mt-1 break-words">
                      <strong>Place of Supply:</strong> {bill.placeOfSupply}
                    </p>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto mb-3">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr
                      style={{
                        backgroundColor: company.themeColor,
                        color: "white",
                      }}
                    >
                      <th
                        className="border border-black p-1.5 text-center"
                        style={{ width: "30px" }}
                      >
                        Sl
                      </th>
                      <th className="border border-black p-1.5 text-left">
                        Description of Goodsss
                      </th>

                      <th
                        className="border border-black p-1.5 text-center"
                        style={{ width: "50px" }}
                      >
                        Qty
                      </th>
                      <th
                        className="border border-black p-1.5 text-center"
                        style={{ width: "45px" }}
                      >
                        Unit
                      </th>
                      <th
                        className="border border-black p-1.5 text-center"
                        style={{ width: "60px" }}
                      >
                        Rate
                      </th>
                      <th
                        className="border border-black p-1.5 text-right"
                        style={{ width: "70px" }}
                      >
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.items.map((item, index) => (
                      <tr
                        key={`item-${index}`}
                        className={index % 2 === 0 ? "bg-gray-50" : ""}
                      >
                        <td className="border border-black p-1.5 text-center">
                          {index + 1}
                        </td>
                        <td className="border border-black p-1.5 break-words">
                          {item.productName}
                        </td>
                        <td className="border border-black p-1.5 text-center text-[9px]"></td>
                        <td className="border border-black p-1.5 text-center"></td>
                        <td className="border border-black p-1.5 text-center">
                          {item.quantity}
                        </td>
                        <td className="border border-black p-1.5 text-center">
                          {item.unit}
                        </td>
                        <td className="border border-black p-1.5 text-right whitespace-nowrap">
                          {formatCurrency(item.ratePerUnit)}
                        </td>
                        <td className="border border-black p-1.5 text-right whitespace-nowrap">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-semibold bg-gray-100">
                      <td className="border border-black p-1.5 text-right">
                        Subtotal
                      </td>
                      <td className="border border-black p-1.5 text-right whitespace-nowrap">
                        {formatCurrency(bill.subtotal)}
                      </td>
                    </tr>
                    {bill.discount !== undefined && bill.discount > 0 && (
                      <tr>
                        <td className="border border-black p-1.5 text-right text-red-600">
                          Discount{" "}
                          {bill.discountType === "percentage"
                            ? `(${bill.discount}%)`
                            : ""}
                        </td>
                        <td className="border border-black p-1.5 text-right whitespace-nowrap text-red-600">
                          -{formatCurrency(bill.discount)}
                        </td>
                      </tr>
                    )}
                    {bill.otherCharges !== undefined &&
                      bill.otherCharges > 0 && (
                        <tr>
                          <td className="border border-black p-1.5 text-right">
                            Other Charges
                          </td>
                          <td className="border border-black p-1.5 text-right whitespace-nowrap">
                            {formatCurrency(bill.otherCharges)}
                          </td>
                        </tr>
                      )}
                    <tr
                      className="font-bold"
                      style={{
                        backgroundColor: company.themeColor,
                        color: "white",
                      }}
                    >
                      <td className="border border-black p-1.5 text-right">
                        Grand Total
                      </td>
                      <td className="border border-black p-1.5 text-right whitespace-nowrap">
                        {formatCurrency(bill.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount in Words */}
              <div className="border border-black p-2.5 mb-3 bg-gray-50">
                <p className="text-[10px] break-words">
                  <strong>Amount Chargeable (in words):</strong>{" "}
                  <span className="font-semibold">
                    INR {numberToWords(bill.total)}
                  </span>
                </p>
              </div>

              {/* Notes */}
              {(bill.notes || company.defaultNote || bill.createdBy) && (
                <div className="border border-black p-2.5 mb-3">
                  <div className="grid grid-cols-2 gap-4">
                    {(bill.notes || company.defaultNote) && (
                      <div>
                        <h3
                          className="font-bold text-[10px] mb-1 break-words"
                          style={{ color: company.themeColor }}
                        >
                          Notes / Terms
                        </h3>
                        <p className="text-[10px] whitespace-pre-wrap break-words">
                          {bill.notes || company.defaultNote}
                        </p>
                      </div>
                    )}
                    {bill.createdBy && (
                      <div className="text-right">
                        <h3
                          className="font-bold text-[10px] mb-1 break-words"
                          style={{ color: company.themeColor }}
                        >
                          Created By
                        </h3>
                        <p className="text-[10px] font-semibold break-words">
                          {bill.createdBy}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer Grid */}
              <div className="grid grid-cols-2 gap-0 mt-3 border border-black">
                {/* Payment Information */}
                <div className="p-2 border-r border-black">
                  <h3
                    className="font-bold text-[10px] mb-1 border-b border-black pb-1 break-words"
                    style={{ color: company.themeColor }}
                  >
                    Payment Information
                  </h3>
                  <div className="text-[10px] space-y-0.5 mt-1 break-words">
                    <p>
                      <strong>Status:</strong>{" "}
                      {bill.paymentStatus.toUpperCase()}
                    </p>
                    <p>
                      <strong>Paid:</strong> {formatCurrency(bill.paidAmount)}
                    </p>
                  </div>
                </div>

                {/* Company Bank Details */}
                <div className="p-2">
                  <h3
                    className="font-bold text-[10px] mb-1 border-b border-black pb-1 break-words"
                    style={{ color: company.themeColor }}
                  >
                    Company Bank Details
                  </h3>
                  <div className="text-[10px] space-y-0.5 mt-1 break-words">
                    <p>
                      <strong>A/c Holder:</strong>{" "}
                      {bill.bankAccount?.accountHolder ||
                        company.bankDetails?.accountHolder ||
                        "N.A."}
                    </p>
                    <p>
                      <strong>Bank Name:</strong>{" "}
                      {bill.bankAccount?.bankName ||
                        company.bankDetails?.bankName ||
                        "N.A."}
                    </p>
                    <p>
                      <strong>A/c Number:</strong>{" "}
                      {bill.bankAccount?.accountNumber ||
                        company.bankDetails?.accountNumber ||
                        "N.A."}
                    </p>
                    <p>
                      <strong>Branch & IFSC:</strong>{" "}
                      {bill.bankAccount?.branchAndIFSC ||
                        company.bankDetails?.branchAndIFSC ||
                        "N.A."}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {qrDataURL && (
                      <>
                        <img
                          src={qrDataURL}
                          alt="Scan & Pay QR"
                          className="w-[50px] h-[50px] flex-shrink-0"
                        />
                        <p className="text-[9px] text-gray-600 break-words">
                          Scan & Pay
                          <br />
                          (UPI)
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Declaration - Spans full width */}
                <div className="col-span-2 border-t border-black p-2">
                  <h3
                    className="font-bold text-[10px] mb-1 border-b border-black pb-1 break-words"
                    style={{ color: company.themeColor }}
                  >
                    Declaration
                  </h3>
                  <p className="text-[9px] mt-1 leading-relaxed break-words">
                    This is a SAMPLE BILL for demonstration purposes only. Not
                    valid for actual transactions.
                  </p>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-0 border border-black border-t-0">
                <div className="p-3 border-r border-black">
                  <p className="text-[10px] font-bold mb-1 break-words">
                    Customer's Seal and Signature
                  </p>
                  <div className="h-12 border-b border-dashed border-gray-400"></div>
                  <p className="text-[9px] text-center mt-1 text-gray-600 break-words">
                    {bill.client?.name ?? ""}
                  </p>
                </div>
                <div className="p-3 text-right">
                  <p className="text-[10px] font-bold mb-1 break-words">
                    for {company.name}
                  </p>
                  <div className="h-12"></div>
                  <p className="text-[9px] border-t border-black pt-1 inline-block break-words">
                    Authorised Signatory
                  </p>
                </div>
              </div>
            </>
          </div>
        </div>
      </div>
    </div>
  );
}
