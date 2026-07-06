import JsBarcode from "jsbarcode";
import jsPDF from "jspdf";
import type { InventoryUnit } from "@/types";

const W_MM = 50.8; // 2 inches
const H_MM = 25.4; // 1 inch

function getLabel(unit: InventoryUnit): string {
  return [unit.model || unit.productName, unit.storage, unit.color]
    .filter(Boolean)
    .join(" | ");
}

function toBarcodeDataURL(value: string): string | null {
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value, { format: "CODE128", width: 2, height: 35, displayValue: false, margin: 0 });
    return canvas.toDataURL("image/png");
  } catch { return null; }
}

// Parse any common date format → "dd-mm-yy"
function fmtWarrantyDate(raw: string): string {
  const s = raw.trim();
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    return `${d.padStart(2, "0")}-${mo.padStart(2, "0")}-${y.slice(-2)}`;
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    const [, y, mo, d] = m2;
    return `${d}-${mo}-${y.slice(2)}`;
  }
  const m3 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m3) {
    const [, d, mo, y] = m3;
    return `${d.padStart(2, "0")}-${mo.padStart(2, "0")}-${y.slice(-2)}`;
  }
  return s.length > 10 ? s.slice(0, 10) : s;
}

function renderStickerPage(doc: jsPDF, unit: InventoryUnit) {
  const val = unit.imeiNumber?.trim() || unit.serialNumber?.trim() || "";
  const label = getLabel(unit);
  const cx = W_MM / 2;
  const lx = 3;           // left-column x (left-aligned)
  const rx = W_MM - 3;    // right-column x (right-aligned)

  const barcodeH = 9;
  const barcodeY = 5.5;
  const ROW_GAP    = 3.0;
  const INFO_SIZE  = 7;

  // ── Model name ────────────────────────────────────────────────
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text(
    label.length > 32 ? label.slice(0, 30) + "…" : label,
    cx, 4, { align: "center" },
  );

  // ── Barcode ───────────────────────────────────────────────────
  if (val) {
    const img = toBarcodeDataURL(val);
    if (img) doc.addImage(img, "PNG", 2, barcodeY, W_MM - 4, barcodeH);
  }

  // ── IMEI 1 (centred, bold monospace) ─────────────────────────
  const imei1Y = barcodeY + barcodeH + 2.2;
  doc.setFontSize(7);
  doc.setFont("courier", "bold");
  doc.text(val, cx, imei1Y, { align: "center" });

  let rowY = imei1Y + ROW_GAP;

  // ── Two-column info block ─────────────────────────────────────
  //   LEFT  → row 1: SN: ...
  //            row 2: BH: ...%
  //   RIGHT → row 1: W-Date
  //            row 2: dd-mm-yy  (date on its own line)

  const sn = unit.imeiNumber?.trim() && unit.serialNumber?.trim()
    ? unit.serialNumber.trim()
    : null;
  const bh  = unit.batteryHealth?.trim() || null;
  const wd  = unit.warranty ? fmtWarrantyDate(unit.warranty) : null;

  doc.setFont("helvetica", "bold");

  // Left column — SN row 1, BH row 2 (larger font for readability)
  doc.setFontSize(9);
  if (sn) {
    doc.text(`SN: ${sn}`, lx, rowY, { align: "left" });
  }
  if (bh) {
    doc.text(`BH: ${bh}%`, lx, rowY + ROW_GAP, { align: "left" });
  }

  // Right column — "W-Date" label row 1, date value row 2 (keep original size)
  doc.setFontSize(INFO_SIZE);
  if (wd) {
    doc.text("W-Date", rx, rowY, { align: "right" });
    doc.text(wd,    rx, rowY + ROW_GAP, { align: "right" });
  }
}

// ── PRINT ─────────────────────────────────────────────────────
export function printBarcodeStickers(units: InventoryUnit[]) {
  const doc = new jsPDF({ unit: "mm", format: [W_MM, H_MM], orientation: "landscape" });
  units.forEach((unit, i) => {
    if (i > 0) doc.addPage([W_MM, H_MM]);
    renderStickerPage(doc, unit);
  });
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

// ── DOWNLOAD PDF ──────────────────────────────────────────────
export function downloadBarcodesPDF(units: InventoryUnit[]) {
  const doc = new jsPDF({ unit: "mm", format: [W_MM, H_MM], orientation: "landscape" });
  units.forEach((unit, i) => {
    if (i > 0) doc.addPage([W_MM, H_MM]);
    renderStickerPage(doc, unit);
  });
  doc.save(`stickers_${units.length}.pdf`);
}
