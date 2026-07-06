import { BillItem, CompanyProfile } from "@/types";

/**
 * Round a number to 2 decimal places, fixing floating point precision issues
 * @param num - The number to round
 * @returns The number rounded to 2 decimal places
 */
export const roundToTwoDecimals = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Format a number to always show 2 decimal places
 * @param num - The number to format
 * @returns The formatted string with 2 decimal places
 */
export const formatToTwoDecimals = (num: number): string => {
  return roundToTwoDecimals(num).toFixed(2);
};

/**
 * Calculate selling price based on purchase price and commission settings
 * @param purchasePrice - The purchase price of the item
 * @param commissionSettings - Commission settings from company profile
 * @returns The calculated selling price
 */
export const calculateSellingPriceFromCommission = (
  purchasePrice: number,
  commissionSettings?: CompanyProfile["commissionSettings"]
): number => {
  if (!commissionSettings) {
    // Default to 20% markup if no commission settings
    return roundToTwoDecimals(purchasePrice * 1.2);
  }

  if (commissionSettings.commissionType === "percentage") {
    // Percentage-based: sellingPrice = purchasePrice * (1 + commissionRate/100)
    const commissionRate = commissionSettings.defaultCommissionRate || 0;
    return roundToTwoDecimals(purchasePrice * (1 + commissionRate / 100));
  } else {
    // Fixed amount: sellingPrice = purchasePrice + fixedCommissionAmount
    const fixedAmount = commissionSettings.fixedCommissionAmount || 0;
    return roundToTwoDecimals(purchasePrice + fixedAmount);
  }
};

export const calculateBillTotals = (
  items: BillItem[],
  company?: CompanyProfile | null,
  otherCharges: number = 0,
  discount: number = 0,
  discountType: "amount" | "percentage" = "amount",
  isGst: boolean = false,
  gstRate: number = 0,
) => {
  // Round all amounts to 2 decimals to avoid floating point precision issues
  const subtotal = roundToTwoDecimals(
    items.reduce((sum, item) => sum + roundToTwoDecimals(item.amount), 0)
  );
  const otherChargesRounded = roundToTwoDecimals(otherCharges);

  // Calculate discount
  let discountAmount = 0;
  if (discount > 0) {
    if (discountType === "percentage") {
      // Apply discount on subtotal before tax
      discountAmount = roundToTwoDecimals((subtotal * discount) / 100);
    } else {
      // Fixed amount discount
      discountAmount = roundToTwoDecimals(discount);
      // Ensure discount doesn't exceed subtotal
      if (discountAmount > subtotal) {
        discountAmount = subtotal;
      }
    }
  }

  const subtotalAfterDiscount = roundToTwoDecimals(subtotal - discountAmount);

  // GST calculation: CGST + SGST (each = half of gstRate applied to taxable amount)
  let cgst = 0;
  let sgst = 0;
  let totalTax = 0;
  if (isGst && gstRate > 0) {
    cgst = roundToTwoDecimals((subtotalAfterDiscount * gstRate) / 100 / 2);
    sgst = roundToTwoDecimals((subtotalAfterDiscount * gstRate) / 100 / 2);
    totalTax = roundToTwoDecimals(cgst + sgst);
  }

  const rawTotal = roundToTwoDecimals(
    subtotalAfterDiscount + totalTax + otherChargesRounded
  );

  // Round off removed per client requirement: total is the exact calculated amount
  const roundedTotal = rawTotal;
  const roundOff = 0;

  return { subtotal, totalTax, cgst, sgst, discount: discountAmount, roundOff, total: roundedTotal };
};

export const numberToWords = (num: number): string => {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  if (num === 0) return "Zero";

  const crores = Math.floor(num / 10000000);
  const lakhs = Math.floor((num % 10000000) / 100000);
  const thousands = Math.floor((num % 100000) / 1000);
  const hundreds = Math.floor((num % 1000) / 100);
  const remainder = Math.floor(num % 100);

  let words = "";

  if (crores > 0) {
    words += convertTwoDigits(crores) + " Crore ";
  }
  if (lakhs > 0) {
    words += convertTwoDigits(lakhs) + " Lakh ";
  }
  if (thousands > 0) {
    words += convertTwoDigits(thousands) + " Thousand ";
  }
  if (hundreds > 0) {
    words += ones[hundreds] + " Hundred ";
  }
  if (remainder > 0) {
    if (remainder < 10) {
      words += ones[remainder];
    } else if (remainder < 20) {
      words += teens[remainder - 10];
    } else {
      words += tens[Math.floor(remainder / 10)] + " " + ones[remainder % 10];
    }
  }

  const decimal = Math.round((num % 1) * 100);
  if (decimal > 0) {
    words += " and " + convertTwoDigits(decimal) + " paise";
  }

  return words.trim() + " Only";

  function convertTwoDigits(n: number): string {
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    return tens[Math.floor(n / 10)] + " " + ones[n % 10];
  }
};

export const formatCurrency = (amount: number): string => {
  const roundedAmount = roundToTwoDecimals(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundedAmount).replace("₹", "Rs. ").replace("INR", "Rs. ");
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
};

export const generateBillNumber = (
  counter: number,
  companyPrefix: string,
  type?: string
): string => {
  const year = new Date().getFullYear();
  const paddedCounter = counter.toString().padStart(3, "0");

  if (type === "sample") {
    return `SMP-${year}-${paddedCounter}`;
  }

  if (type === "gst") {
    return `GST-${year}-${paddedCounter}`;
  }

  return `INV-${year}-${paddedCounter}`;
};

export const calculateDueDate = (
  billDate: string,
  paymentTerms: number
): string => {
  const date = new Date(billDate);
  date.setDate(date.getDate() + paymentTerms);
  return date.toISOString().split("T")[0];
};

export const getPaymentStatus = (
  dueDate: string,
  paidAmount: number,
  total: number
): "paid" | "pending" | "overdue" | "partial" | "overpaid" => {
  if (paidAmount > total) return "overpaid";
  if (paidAmount >= total) return "paid";
  if (paidAmount > 0) {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today ? "overdue" : "partial";
  }
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today ? "overdue" : "pending";
};
