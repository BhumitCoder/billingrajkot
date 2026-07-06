import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Client,
  Bill,
  BillReturn,
  PurchaseBill,
  PurchaseReturn,
  PartyPayment,
  PaymentMethod,
  BankAccount,
  CompanyProfile,
} from "@/types";
import {
  getBills,
  getBillReturns,
  getPurchaseBills,
  getPurchaseReturns,
  getPartyPayments,
  savePartyPayment,
  deletePartyPayment,
  updateBillPayment,
  updatePurchaseBillPayment,
  getBankAccounts,
  getCompanyProfile,
} from "@/lib/storage";
import { formatCurrency } from "@/lib/billUtils";
import {
  ArrowLeft,
  Download,
  Plus,
  Loader2,
  Eye,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  FileText,
  RotateCcw,
  Wallet,
  BookOpen,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { PartyLedgerPDF } from "./PartyLedgerPDF";

interface ClientDetailScreenProps {
  client: Client;
  onBack: () => void;
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

// Use Rs. prefix instead of ₹ symbol in ledger
function fmtRs(n: number): string {
  return `Rs.${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Convert user-selected "YYYY-MM-DD" to full ISO timestamp with current local time
function dateToISO(dateStr: string): string {
  const now = new Date();
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).toISOString();
}

function toEpochMs(value?: string, fallback?: string): number {
  const primary = value ? new Date(value).getTime() : NaN;
  if (Number.isFinite(primary)) return primary;
  const secondary = fallback ? new Date(fallback).getTime() : NaN;
  if (Number.isFinite(secondary)) return secondary;
  return 0;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  "Cash",
  "Bank Transfer",
  "UPI",
  "Cheque",
  "Other",
];

export function ClientDetailScreen({
  client,
  onBack,
}: ClientDetailScreenProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ledgerPage, setLedgerPage] = useState(1);
  const LEDGER_PAGE_SIZE = 30;

  // Data
  const [salesBills, setSalesBills] = useState<Bill[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>([]);
  const [saleReturns, setSaleReturns] = useState<BillReturn[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [partyPayments, setPartyPayments] = useState<PartyPayment[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  // Party payment dialog
  const [partyPaymentOpen, setPartyPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PartyPayment | null>(null);
  const [payForm, setPayForm] = useState<{
    amount: string;
    type: "collected" | "sent";
    method: PaymentMethod;
    bankAccountId: string;
    date: string;
    note: string;
  }>({
    amount: "",
    type: "collected",
    method: "Cash",
    bankAccountId: "",
    date: new Date().toISOString().split("T")[0],
    note: "",
  });
  const [savingPayment, setSavingPayment] = useState(false);

  // Bill payment dialog (for sale bills)
  const [billPayOpen, setBillPayOpen] = useState(false);
  const [billPayBill, setBillPayBill] = useState<Bill | null>(null);
  const [billPayAmount, setBillPayAmount] = useState("");
  const [billPayMethod, setBillPayMethod] = useState<PaymentMethod>("Cash");
  const [billPayBankId, setBillPayBankId] = useState("");
  const [billPayNote, setBillPayNote] = useState("");
  const [processingBillPay, setProcessingBillPay] = useState(false);

  // View purchase bill detail dialog (from ledger)
  const [viewPurchaseId, setViewPurchaseId] = useState<string | null>(null);

  // Purchase bill payment dialog
  const [purBillPayOpen, setPurBillPayOpen] = useState(false);
  const [purBillPayBill, setPurBillPayBill] = useState<PurchaseBill | null>(null);
  const [purBillPayAmount, setPurBillPayAmount] = useState("");
  const [purBillPayMethod, setPurBillPayMethod] = useState<PaymentMethod>("Cash");
  const [purBillPayBankId, setPurBillPayBankId] = useState("");
  const [processingPurBillPay, setProcessingPurBillPay] = useState(false);

  // FIFO Collect Payment (sale bills — oldest first)
  const [fifoCollectOpen, setFifoCollectOpen] = useState(false);
  const [fifoCollectAmount, setFifoCollectAmount] = useState("");
  const [fifoCollectMethod, setFifoCollectMethod] = useState<PaymentMethod>("Cash");
  const [fifoCollectBankId, setFifoCollectBankId] = useState("");
  const [fifoCollectDate, setFifoCollectDate] = useState(new Date().toISOString().split("T")[0]);
  const [fifoCollectNote, setFifoCollectNote] = useState("");
  const [processingFifoCollect, setProcessingFifoCollect] = useState(false);

  // FIFO Pay to Party (purchase bills — oldest first)
  const [fifoPayOpen, setFifoPayOpen] = useState(false);
  const [fifoPayAmount, setFifoPayAmount] = useState("");
  const [fifoPayMethod, setFifoPayMethod] = useState<PaymentMethod>("Cash");
  const [fifoPayBankId, setFifoPayBankId] = useState("");
  const [fifoPayDate, setFifoPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [fifoPayNote, setFifoPayNote] = useState("");
  const [processingFifoPay, setProcessingFifoPay] = useState(false);
  const [reconcilingPayments, setReconcilingPayments] = useState(false);

  useEffect(() => {
    if (client) loadAll();
  }, [client]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [allSales, allPurchases, allSaleRet, allPurRet, allPartyPay, banks, profile] =
        await Promise.all([
          getBills(),
          getPurchaseBills(),
          getBillReturns(),
          getPurchaseReturns(),
          getPartyPayments(client.id),
          getBankAccounts(),
          getCompanyProfile(),
        ]);

      setSalesBills(
        allSales
          .filter((b) => b.clientId === client.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );

      // Match purchase bills by clientId OR by vendorName (for legacy)
      setPurchaseBills(
        allPurchases
          .filter(
            (b) =>
              b.clientId === client.id ||
              (!b.clientId &&
                b.vendorName?.toLowerCase().trim() ===
                  client.name.toLowerCase().trim())
          )
          .sort(
            (a, b) =>
              new Date(b.billDate || b.createdAt).getTime() -
              new Date(a.billDate || a.createdAt).getTime()
          )
      );

      const clientBillIds = allSales
        .filter((b) => b.clientId === client.id)
        .map((b) => b.id);

      setSaleReturns(
        allSaleRet
          .filter((r) => clientBillIds.includes(r.billId))
          .sort(
            (a, b) =>
              new Date(b.returnDate || b.createdAt).getTime() -
              new Date(a.returnDate || a.createdAt).getTime()
          )
      );

      const purBillIds = allPurchases
        .filter(
          (b) =>
            b.clientId === client.id ||
            (!b.clientId &&
              b.vendorName?.toLowerCase().trim() ===
                client.name.toLowerCase().trim())
        )
        .map((b) => b.id);

      setPurchaseReturns(
        allPurRet
          .filter((r) => purBillIds.includes(r.purchaseBillId))
          .sort(
            (a, b) =>
              new Date(b.returnDate || b.createdAt).getTime() -
              new Date(a.returnDate || a.createdAt).getTime()
          )
      );

      setPartyPayments(
        allPartyPay.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      );
      setBankAccounts(banks);
      if (profile) setCompanyProfile(profile);
    } catch (e) {
      console.error("Error loading party data:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── Summary Calculations ──────────────────────────────────────────────────

  // Use original bill total (before returns) to avoid double-counting with separate saleReturns entries
  const totalSales = salesBills.reduce((s, b) => s + b.total + (b.returnedAmount || 0), 0);
  const totalPurchases = purchaseBills.reduce((s, b) => s + b.total, 0);
  const totalSaleReturnValue = saleReturns.reduce(
    (s, r) => s + r.totalReturnValue,
    0
  );
  const totalPurchaseReturnValue = purchaseReturns.reduce(
    (s, r) => s + r.totalReturnValue,
    0
  );

  // Payments collected = payments received on SALE bills + party payments "collected"
  // Use payments[] (authoritative) instead of paidAmount (denormalized, can drift).
  const billsPaymentsCollected = salesBills.reduce(
    (s, b) => s + (b.payments || []).reduce((ps, p) => ps + p.amount, 0),
    0
  );
  const partyPayCollected = partyPayments
    .filter((p) => p.type === "collected")
    .reduce((s, p) => s + p.amount, 0);
  const totalCollected = billsPaymentsCollected + partyPayCollected;

  // Payments sent = payments made on PURCHASE bills + party payments "sent"
  // Use payments[] (authoritative) instead of paidAmount (denormalized, can drift).
  const billsPaymentsSent = purchaseBills.reduce(
    (s, b) => s + (b.payments || []).reduce((ps, p) => ps + p.amount, 0),
    0
  );
  // When a purchase return is processed on an already-paid bill, savePurchaseReturn clamps
  // paidAmount to the new effective total but leaves payments[] unchanged. The difference
  // represents cash the vendor holds as advance credit (to be offset against future bills).
  const totalPaidAmountsFromFields = purchaseBills.reduce((s, b) => s + (b.paidAmount || 0), 0);
  const vendorAdvanceCredit = Math.max(0, billsPaymentsSent - totalPaidAmountsFromFields);
  const partyPaySent = partyPayments
    .filter((p) => p.type === "sent")
    .reduce((s, p) => s + p.amount, 0);
  const totalSent = billsPaymentsSent + partyPaySent;

  const openingBalanceAmt = Math.abs(client.openingBalance || 0);
  // openingBalanceType: "receivable" = party owes you (Debit), "payable" = you owe party (Credit).
  const openingIsPayable = (client.openingBalanceType || "receivable") === "payable";
  const openingReceivable = openingIsPayable ? 0 : openingBalanceAmt;
  const openingPayable = openingIsPayable ? openingBalanceAmt : 0;
  // Ledger uses Debit(+) for receivable and Credit(-) for payable.
  const openingSigned = openingIsPayable ? -openingBalanceAmt : openingBalanceAmt;

  // New sales receivable = from new sale bills only (opening balance is separate)
  const newSalesReceivable = totalSales - totalSaleReturnValue - totalCollected;
  // New purchase payable = from new purchase bills only
  const newPurchasePayable = totalPurchases - totalPurchaseReturnValue - totalSent;

  const grossReceivable = openingReceivable + Math.max(0, newSalesReceivable);
  const grossPayable = openingPayable + Math.max(0, newPurchasePayable);
  // Net view (advance adjusts against receivable/payable)
  const totalReceivable = Math.max(0, grossReceivable - grossPayable);
  const totalPayable = Math.max(0, grossPayable - grossReceivable);

  // Keep these for compatibility with existing code below
  const salesOutstanding = totalReceivable;
  const purchasePayable = totalPayable;
  const newSalesCredit = newSalesReceivable;

  // Credit limit checks net receivable exposure after payable offset.
  const creditLimit = client.creditLimit || 0;
  const creditUsed = Math.max(0, totalReceivable - totalPayable);
  const creditAvailable =
    creditLimit > 0 ? Math.max(0, creditLimit - creditUsed) : 0;
  const isCreditLimitExceeded = creditLimit > 0 && creditAvailable <= 0;

  // ── Ledger entries ────────────────────────────────────────────────────────

  type LedgerEntry = {
    date: string;
    createdAt: string; // full timestamp for same-day tiebreaker
    id: string; // bill/payment id for view button
    billType: "sale" | "purchase" | "other"; // for view button routing
    type: string;
    ref: string;
    debit: number; // receivable increases (sale, purchase return)
    credit: number; // payable increases (purchase, sale return)
  };

  const ledgerEntries: LedgerEntry[] = [
    ...salesBills.map((b) => ({
      date: b.date,
      createdAt: b.createdAt,
      id: b.id,
      billType: "sale" as const,
      type: "Sale",
      ref: b.billNumber,
      // Use original bill total (before returns) — returns appear as separate "Sale Return" credit entries
      debit: b.total + (b.returnedAmount || 0),
      credit: 0,
    })),
    ...purchaseBills.map((b) => ({
      date: b.billDate || b.createdAt,
      createdAt: b.createdAt,
      id: b.id,
      billType: "purchase" as const,
      type: "Purchase",
      ref: b.billNumber || "-",
      debit: 0,
      credit: b.total,
    })),
    ...saleReturns.map((r) => ({
      date: r.returnDate || r.createdAt,
      createdAt: r.createdAt,
      id: r.id,
      billType: "other" as const,
      type: "Sale Return",
      ref: r.billNumber,
      debit: 0,
      credit: r.totalReturnValue,
    })),
    ...purchaseReturns.map((r) => ({
      date: r.returnDate || r.createdAt,
      createdAt: r.createdAt,
      id: r.id,
      billType: "other" as const,
      type: "Purchase Return",
      ref: r.billNumber || "-",
      debit: r.totalReturnValue,
      credit: 0,
    })),
    // Sale bill payments collected
    // If p.date is date-only (no time), use b.createdAt so payment sorts AFTER the sale entry
    // (stable sort preserves bill-before-payment array order when createdAt is equal)
    // "Advance Adjustment" payments are excluded from the ledger — they don't represent new cash,
    // they consume advance credit already counted in a prior payment entry.
    ...salesBills.flatMap((b) =>
      (b.payments || []).filter((p) => p.method !== "Advance Adjustment").map((p) => ({
        date: p.date || b.date,
        createdAt: (p.date && p.date.length > 10) ? p.date : b.createdAt,
        id: b.id,
        billType: "sale" as const,
        type: `Payment Collected (${p.method})`,
        ref: b.billNumber,
        debit: 0,
        credit: p.amount,
      }))
    ),
    // Purchase bill payments sent ("Advance Adjustment" excluded — same reason as sale side)
    ...purchaseBills.flatMap((b) =>
      (b.payments || [])
        .filter((p) => p.amount > 0 && p.method !== "Advance Adjustment")
        .map((p) => ({
          date: p.date || b.billDate || b.createdAt,
          createdAt: (p.date && p.date.length > 10) ? p.date : b.createdAt,
          id: b.id,
          billType: "purchase" as const,
          type: `Payment Sent (${p.method})`,
          ref: b.billNumber || "-",
          debit: p.amount,
          credit: 0,
        }))
    ),
    // Party-level payments
    ...partyPayments.map((p) => ({
      date: p.date,
      createdAt: p.createdAt,
      id: p.id,
      billType: "other" as const,
      type:
        p.type === "collected"
          ? `Party Payment Collected (${p.method})`
          : `Party Payment Sent (${p.method})`,
      ref: p.note || "-",
      debit: p.type === "sent" ? p.amount : 0,
      credit: p.type === "collected" ? p.amount : 0,
    })),
  ].sort((a, b) => {
    const dateA = toEpochMs(a.date, a.createdAt);
    const dateB = toEpochMs(b.date, b.createdAt);
    if (dateA !== dateB) return dateA - dateB;
    // Same date: use full createdAt timestamp as tiebreaker (newest last = bottom of same-day)
    return toEpochMs(a.createdAt, a.date) - toEpochMs(b.createdAt, b.date);
  });

  // Opening balance uses Debit(+) / Credit(-) based on type.
  const ledgerStartBalance = openingSigned;
  let runningBalance = ledgerStartBalance;
  const ledgerWithBalance = ledgerEntries.map((e) => {
    runningBalance = runningBalance + e.debit - e.credit;
    return { ...e, balance: runningBalance };
  });

  // Positive net = party owes you (Dr), negative net = you owe party (Cr)
  const netBalance = runningBalance;

  // toPay is the actual amount owed to the party, derived from the ledger (source of truth).
  // The formula-based totalPayable can diverge from the ledger when bill.paidAmount is out
  // of sync with bill.payments[] (e.g. bills marked paid at creation without real payment records).
  // Using ledger ensures TO PAY always agrees with Net Balance.
  const toPay = Math.max(0, -netBalance);

  // Statement style: opening first, then chronological entries.
  const ledgerDisplayEntries = ledgerWithBalance;

  // ── Party Payment handlers ────────────────────────────────────────────────

  const openAddPayment = () => {
    setEditingPayment(null);
    setPayForm({
      amount: "",
      type: "collected",
      method: "Cash",
      bankAccountId: "",
      date: new Date().toISOString().split("T")[0],
      note: "",
    });
    setPartyPaymentOpen(true);
  };

  const handleSavePartyPayment = async () => {
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSavingPayment(true);
    try {
      if (payForm.type === "sent" && !editingPayment) {
        // Auto-apply "sent" payments to outstanding purchase bills via FIFO.
        // This prevents double-counting: if the user also pays from PurchaseBills,
        // the bill's paidAmount already reflects this payment so the balance stays correct.
        const { allocations, unallocated } = computeFifoDistribution(purchaseBills as any, amt, true);

        for (const alloc of allocations) {
          await updatePurchaseBillPayment(
            alloc.billId,
            alloc.allocate,
            payForm.method,
            payForm.note || undefined,
            dateToISO(payForm.date),
            undefined,
            payForm.method === "Cash" ? undefined : payForm.bankAccountId || undefined,
          );
        }

        // Save any amount exceeding outstanding bills as an advance party payment
        if (unallocated > 0.01) {
          const advance: PartyPayment = {
            id: crypto.randomUUID(),
            partyId: client.id,
            amount: unallocated,
            type: "sent",
            method: payForm.method,
            bankAccountId: payForm.bankAccountId || undefined,
            date: dateToISO(payForm.date),
            note: payForm.note ? `${payForm.note} (advance)` : "Advance payment",
            createdAt: new Date().toISOString(),
          };
          await savePartyPayment(advance);
        }

        await loadAll();
        setPartyPaymentOpen(false);
        toast.success(
          allocations.length > 0
            ? `Payment of ${formatCurrency(amt)} applied to ${allocations.length} bill(s)`
            : `Advance payment of ${formatCurrency(amt)} recorded`
        );
      } else {
        // For "collected" payments or editing existing payments: standard partyPayment flow
        const p: PartyPayment = {
          id: editingPayment?.id || crypto.randomUUID(),
          partyId: client.id,
          amount: amt,
          type: payForm.type,
          method: payForm.method,
          bankAccountId: payForm.bankAccountId || undefined,
          date: dateToISO(payForm.date),
          note: payForm.note || undefined,
          createdAt: editingPayment?.createdAt || new Date().toISOString(),
        };
        await savePartyPayment(p);
        await loadAll();
        setPartyPaymentOpen(false);
        toast.success(
          `Payment ${payForm.type === "collected" ? "collected" : "sent"}: ${formatCurrency(amt)}`
        );
      }
    } catch (e) {
      toast.error("Failed to save payment");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePartyPayment = async (id: string) => {
    try {
      await deletePartyPayment(id);
      await loadAll();
      toast.success("Payment deleted");
    } catch {
      toast.error("Failed to delete payment");
    }
  };

  // ── Sale bill payment ─────────────────────────────────────────────────────

  const openBillPay = (bill: Bill) => {
    setBillPayBill(bill);
    const pending = Math.max(0, bill.total - bill.paidAmount);
    const advance = Math.min(saleAvailableAdvance, pending);
    const cashNeeded = Math.max(0, pending - advance);
    setBillPayAmount(cashNeeded > 0 ? cashNeeded.toFixed(2) : "");
    setBillPayMethod("Cash");
    setBillPayBankId("");
    setBillPayNote("");
    setBillPayOpen(true);
  };

  const handleBillPaySubmit = async () => {
    if (!billPayBill) return;
    const pending = Math.max(0, billPayBill.total - billPayBill.paidAmount);
    const advanceApply = Math.min(saleAvailableAdvance, pending);
    const cashAmt = parseFloat(billPayAmount) || 0;

    if (advanceApply + cashAmt <= 0) {
      toast.error("No payment to record");
      return;
    }
    if (cashAmt > 0 && billPayMethod !== "Cash" && !billPayBankId) {
      toast.error("Please select a bank account");
      return;
    }
    setProcessingBillPay(true);
    try {
      if (advanceApply > 0.5) {
        await updateBillPayment(billPayBill.id, advanceApply, "Advance Adjustment");
      }
      if (cashAmt > 0) {
        await updateBillPayment(
          billPayBill.id,
          cashAmt,
          billPayMethod,
          billPayNote || undefined,
          undefined,
          billPayMethod === "Cash" ? undefined : billPayBankId,
        );
      }
      await loadAll();
      setBillPayOpen(false);
      const msg = advanceApply > 0.5
        ? `${formatCurrency(advanceApply)} from advance${cashAmt > 0 ? ` + ${formatCurrency(cashAmt)} collected` : " — bill settled"}`
        : `${formatCurrency(cashAmt)} collected`;
      toast.success(msg);
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setProcessingBillPay(false);
    }
  };

  // ── Purchase bill payment ─────────────────────────────────────────────────

  const openPurBillPay = (bill: PurchaseBill) => {
    setPurBillPayBill(bill);
    const returns = (bill.returns || []).reduce((s, r) => s + r.totalReturnValue, 0);
    const pending = Math.max(0, bill.total - returns - bill.paidAmount);
    const advance = Math.min(purchaseAvailableAdvance, pending);
    const cashNeeded = Math.max(0, pending - advance);
    setPurBillPayAmount(cashNeeded > 0 ? cashNeeded.toFixed(2) : "");
    setPurBillPayMethod("Cash");
    setPurBillPayBankId("");
    setPurBillPayOpen(true);
  };

  const handlePurBillPaySubmit = async () => {
    if (!purBillPayBill) return;
    const returns = (purBillPayBill.returns || []).reduce((s, r) => s + r.totalReturnValue, 0);
    const pending = Math.max(0, purBillPayBill.total - returns - purBillPayBill.paidAmount);
    const advanceApply = Math.min(purchaseAvailableAdvance, pending);
    const cashAmt = parseFloat(purBillPayAmount) || 0;

    if (advanceApply + cashAmt <= 0) {
      toast.error("No payment to record");
      return;
    }
    if (cashAmt > 0 && purBillPayMethod !== "Cash" && !purBillPayBankId) {
      toast.error("Please select a bank account");
      return;
    }
    setProcessingPurBillPay(true);
    try {
      if (advanceApply > 0.5) {
        await updatePurchaseBillPayment(
          purBillPayBill.id, advanceApply, "Advance Adjustment",
          undefined, undefined, undefined, undefined,
        );
      }
      if (cashAmt > 0) {
        await updatePurchaseBillPayment(
          purBillPayBill.id,
          cashAmt,
          purBillPayMethod,
          undefined,
          undefined,
          undefined,
          purBillPayMethod === "Cash" ? undefined : purBillPayBankId,
        );
      }
      await loadAll();
      setPurBillPayOpen(false);
      const msg = advanceApply > 0.5
        ? `${formatCurrency(advanceApply)} from advance${cashAmt > 0 ? ` + ${formatCurrency(cashAmt)} sent` : " — bill settled"}`
        : `${formatCurrency(cashAmt)} sent`;
      toast.success(msg);
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setProcessingPurBillPay(false);
    }
  };

  // ── FIFO helpers ──────────────────────────────────────────────────────────

  // Distribute a payment amount across bills oldest-first (FIFO)
  const computeFifoDistribution = (
    bills: Array<{
      id: string;
      billNumber?: string;
      total: number;
      paidAmount: number;
      paymentStatus: string;
      date?: string;
      billDate?: string;
      createdAt: string;
      returns?: Array<{ totalReturnValue: number }>;
    }>,
    totalPayment: number,
    isPurchase = false,
  ) => {
    const unpaidBills = bills
      .filter((b) => b.paymentStatus !== "paid" && b.paymentStatus !== "overpaid")
      .sort((a, b) => {
        const dateA = new Date(
          isPurchase ? a.billDate || a.createdAt : a.date || a.createdAt,
        ).getTime();
        const dateB = new Date(
          isPurchase ? b.billDate || b.createdAt : b.date || b.createdAt,
        ).getTime();
        return dateA - dateB; // oldest first
      });

    let remaining = totalPayment;
    const allocations: Array<{
      billId: string;
      billNumber: string;
      date: string;
      outstanding: number;
      allocate: number;
      willBePaid: boolean;
    }> = [];

    for (const bill of unpaidBills) {
      if (remaining <= 0) break;
      const totalReturns = isPurchase
        ? (bill.returns || []).reduce((s, r) => s + (r.totalReturnValue || 0), 0)
        : 0;
      const netTotal = bill.total - totalReturns;
      const outstanding = netTotal - (bill.paidAmount || 0);
      if (outstanding <= 0) continue;
      const allocate = Math.min(remaining, outstanding);
      allocations.push({
        billId: bill.id,
        billNumber: bill.billNumber || "-",
        date: isPurchase ? bill.billDate || bill.createdAt : bill.date || bill.createdAt,
        outstanding,
        allocate,
        willBePaid: allocate >= outstanding,
      });
      remaining -= allocate;
    }

    return { allocations, unallocated: Math.max(0, remaining) };
  };

  // Total outstanding for sale bills
  const totalSaleOutstanding = salesBills
    .filter((b) => b.paymentStatus !== "paid" && b.paymentStatus !== "overpaid")
    .reduce((s, b) => s + Math.max(0, b.total - (b.paidAmount || 0)), 0);

  // Total outstanding for purchase bills (accounting for returns)
  const totalPurchaseOutstanding = purchaseBills
    .filter((b) => b.paymentStatus !== "paid" && b.paymentStatus !== "overpaid")
    .reduce((s, b) => {
      const totalReturns = (b.returns || []).reduce(
        (rs, r) => rs + (r.totalReturnValue || 0),
        0,
      );
      return s + Math.max(0, b.total - totalReturns - (b.paidAmount || 0));
    }, 0);

  // Advance credit available for each side.
  // toReceive = what customer still owes on sales (positive net balance).
  // Advance = gap between total bill outstanding and what ledger says is actually due.
  // When a party has pre-paid or overpaid, outstanding > toPay/toReceive — the difference
  // is advance credit that can settle new bills without any new bank movement.
  const toReceive = Math.max(0, netBalance);
  const purchaseAvailableAdvance = Math.max(0, totalPurchaseOutstanding - toPay);
  const saleAvailableAdvance = Math.max(0, totalSaleOutstanding - toReceive);

  const openFifoCollect = () => {
    setFifoCollectAmount("");
    setFifoCollectMethod("Cash");
    setFifoCollectBankId("");
    setFifoCollectDate(new Date().toISOString().split("T")[0]);
    setFifoCollectNote("");
    setFifoCollectOpen(true);
  };

  const handleFifoCollect = async () => {
    const amt = parseFloat(fifoCollectAmount);
    if (!amt || amt <= 0) {
      toast.error("Enter valid amount");
      return;
    }
    if (fifoCollectMethod !== "Cash" && !fifoCollectBankId) {
      toast.error("Select a bank account");
      return;
    }
    const { allocations } = computeFifoDistribution(salesBills as any, amt, false);
    if (allocations.length === 0) {
      toast.error("No outstanding sale bills to collect against");
      return;
    }
    setProcessingFifoCollect(true);
    try {
      for (const alloc of allocations) {
        await updateBillPayment(
          alloc.billId,
          alloc.allocate,
          fifoCollectMethod,
          fifoCollectNote || undefined,
          dateToISO(fifoCollectDate),
          fifoCollectMethod === "Cash" ? undefined : fifoCollectBankId,
        );
      }
      // After recording cash collection, apply any available advance credit to remaining outstanding bills.
      // The advance represents money the customer already gave us; bills receiving it need no new cash.
      if (saleAvailableAdvance > 0.5) {
        const fifoMap = new Map(allocations.map((a) => [a.billId, a.allocate]));
        let remainingAdv = saleAvailableAdvance;
        for (const bill of salesBills.filter((b) => b.paymentStatus !== "paid" && b.paymentStatus !== "overpaid")) {
          if (remainingAdv <= 0.5) break;
          const fifoAlloc = fifoMap.get(bill.id) || 0;
          const outstanding = Math.max(0, bill.total - (bill.paidAmount || 0) - fifoAlloc);
          if (outstanding <= 0.5) continue;
          const toApply = Math.min(remainingAdv, outstanding);
          await updateBillPayment(bill.id, toApply, "Advance Adjustment");
          remainingAdv -= toApply;
        }
      }
      await loadAll();
      setFifoCollectOpen(false);
      const totalAllocated = allocations.reduce((s, a) => s + a.allocate, 0);
      toast.success(
        `Collected ${formatCurrency(totalAllocated)} across ${allocations.length} bill(s)`,
      );
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setProcessingFifoCollect(false);
    }
  };

  const openFifoPay = () => {
    setFifoPayAmount(toPay > 0 ? toPay.toFixed(2) : "");
    setFifoPayMethod("Cash");
    setFifoPayBankId("");
    setFifoPayDate(new Date().toISOString().split("T")[0]);
    setFifoPayNote("");
    setFifoPayOpen(true);
  };

  // Reconcile: apply existing party "sent" payments to purchase bills via FIFO,
  // then remove those partyPayment records (they're now tracked in bill.payments).
  const handleReconcilePartyPayments = async () => {
    const sentPayments = partyPayments
      .filter((p) => p.type === "sent")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sentPayments.length === 0) {
      toast.error("No party payments to reconcile");
      return;
    }
    setReconcilingPayments(true);
    try {
      // Track in-memory bill state so each iteration sees updated paidAmounts
      // from prior iterations without needing extra Firestore reads.
      let currentBills = [...purchaseBills] as typeof purchaseBills;
      let reconciled = 0;
      let skipped = 0;
      for (const pp of sentPayments) {
        const { allocations } = computeFifoDistribution(currentBills as any, pp.amount, true);
        if (allocations.length === 0) {
          // No eligible unpaid bills — this payment is pure advance credit.
          // Do NOT delete it; it remains as a visible ledger entry until a new bill
          // is created or the user manually records a refund via Collect.
          skipped++;
          continue;
        }
        for (const alloc of allocations) {
          await updatePurchaseBillPayment(
            alloc.billId,
            alloc.allocate,
            pp.method,
            pp.note || "Reconciled from party payment",
            pp.date,
            undefined,
            pp.bankAccountId,
          );
          // Update local state so the next iteration sees this bill as partially/fully paid
          currentBills = currentBills.map((b) => {
            if (b.id !== alloc.billId) return b;
            const newPaid = (b.paidAmount || 0) + alloc.allocate;
            const totalReturns = (b.returns || []).reduce((rs, r) => rs + (r.totalReturnValue || 0), 0);
            const netTotal = b.total - totalReturns;
            return {
              ...b,
              paidAmount: newPaid,
              paymentStatus: newPaid >= netTotal ? "paid" : newPaid > 0 ? "partial" : b.paymentStatus,
            };
          });
        }
        await deletePartyPayment(pp.id);
        reconciled++;
      }
      await loadAll();
      if (reconciled > 0 && skipped > 0) {
        toast.success(`Reconciled ${reconciled} payment(s). ${skipped} skipped — no unpaid bills to apply to.`);
      } else if (reconciled > 0) {
        toast.success(`Reconciled ${reconciled} party payment(s) to purchase bills`);
      } else {
        toast.error("No payments reconciled — all bills are already paid. Use Collect if the vendor owes you a refund.");
      }
    } catch {
      toast.error("Reconciliation failed");
    } finally {
      setReconcilingPayments(false);
    }
  };

  const handleFifoPay = async () => {
    const amt = parseFloat(fifoPayAmount);
    if (!amt || amt <= 0) {
      toast.error("Enter valid amount");
      return;
    }
    if (fifoPayMethod !== "Cash" && !fifoPayBankId) {
      toast.error("Select a bank account");
      return;
    }
    const { allocations, unallocated } = computeFifoDistribution(purchaseBills as any, amt, true);
    setProcessingFifoPay(true);
    try {
      for (const alloc of allocations) {
        await updatePurchaseBillPayment(
          alloc.billId,
          alloc.allocate,
          fifoPayMethod,
          fifoPayNote || undefined,
          dateToISO(fifoPayDate),
          undefined,
          fifoPayMethod === "Cash" ? undefined : fifoPayBankId,
        );
      }
      // After recording cash payments, apply any available advance credit to remaining outstanding bills.
      if (purchaseAvailableAdvance > 0.5) {
        const fifoMap = new Map(allocations.map((a) => [a.billId, a.allocate]));
        let remainingAdv = purchaseAvailableAdvance;
        for (const bill of purchaseBills.filter((b) => b.paymentStatus !== "paid" && b.paymentStatus !== "overpaid")) {
          if (remainingAdv <= 0.5) break;
          const returns = (bill.returns || []).reduce((s, r) => s + r.totalReturnValue, 0);
          const fifoAlloc = fifoMap.get(bill.id) || 0;
          const outstanding = Math.max(0, bill.total - returns - (bill.paidAmount || 0) - fifoAlloc);
          if (outstanding <= 0.5) continue;
          const toApply = Math.min(remainingAdv, outstanding);
          await updatePurchaseBillPayment(
            bill.id, toApply, "Advance Adjustment",
            undefined, dateToISO(fifoPayDate), undefined, undefined,
          );
          remainingAdv -= toApply;
        }
      }
      // Record any amount that couldn't be applied to bills as a party payment (advance/settlement)
      const leftover = allocations.length === 0 ? amt : unallocated;
      if (leftover > 0.01) {
        const advance: PartyPayment = {
          id: crypto.randomUUID(),
          partyId: client.id,
          amount: leftover,
          type: "sent",
          method: fifoPayMethod,
          bankAccountId: fifoPayMethod === "Cash" ? undefined : fifoPayBankId || undefined,
          date: dateToISO(fifoPayDate),
          note: fifoPayNote
            ? allocations.length > 0 ? `${fifoPayNote} (advance)` : fifoPayNote
            : allocations.length > 0 ? "Advance payment" : "Party payment",
          createdAt: new Date().toISOString(),
        };
        await savePartyPayment(advance);
      }
      await loadAll();
      setFifoPayOpen(false);
      if (allocations.length > 0) {
        const totalAllocated = allocations.reduce((s, a) => s + a.allocate, 0);
        toast.success(
          `Paid ${formatCurrency(totalAllocated)} across ${allocations.length} bill(s)` +
          (leftover > 0.01 ? ` + ${formatCurrency(leftover)} recorded as advance` : ""),
        );
      } else {
        toast.success(`Payment of ${formatCurrency(amt)} recorded`);
      }
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setProcessingFifoPay(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
      pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
      partial: "bg-blue-100 text-blue-700 border-blue-200",
      overdue: "bg-red-100 text-red-700 border-red-200",
      overpaid: "bg-purple-100 text-purple-700 border-purple-200",
    };
    return (
      <Badge
        variant="outline"
        className={`text-[10px] capitalize ${colors[s] || ""}`}
      >
        {s}
      </Badge>
    );
  };

  // Build PDF data
  const pdfTransactions = ledgerWithBalance.map((e) => ({
    date: e.date,
    type: e.type,
    reference: e.ref,
    debit: e.debit,
    credit: e.credit,
    balance: e.balance,
  }));

  const allPaymentEntries = [...ledgerEntries]
    .filter((e) => e.type.includes("Payment"))
    .sort((a, b) => {
      const dateA = toEpochMs(a.date, a.createdAt);
      const dateB = toEpochMs(b.date, b.createdAt);
      if (dateA !== dateB) return dateB - dateA;
      return toEpochMs(b.createdAt, b.date) - toEpochMs(a.createdAt, a.date);
    });

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
      <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-primary/20 bg-gradient-to-br from-background via-background to-primary/10 p-3 shadow-sm sm:p-5 lg:p-6">
        <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex h-full min-h-0 flex-col gap-3">
          {/* Header */}
          <div className="rounded-2xl border border-border/70 bg-background/90 p-3 backdrop-blur sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={onBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-base sm:text-lg font-semibold leading-tight">
                    {client.name}
                  </h1>
                  {client.phone && (
                    <p className="text-xs text-muted-foreground">{client.phone}</p>
                  )}
                  {client.gstin && (
                    <p className="text-xs text-muted-foreground">GSTIN: {client.gstin}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!loading && (
                  <PDFDownloadLink
                    document={
                      <PartyLedgerPDF
                        party={client}
                        transactions={pdfTransactions}
                        salesBills={salesBills}
                        purchaseBills={purchaseBills}
                        saleReturns={saleReturns}
                        purchaseReturns={purchaseReturns}
                        partyPayments={partyPayments}
                        openingBalance={openingSigned}
                        stats={{
                          totalSales,
                          totalPurchases,
                          totalCollected,
                          totalSent,
                          netBalance,
                          totalReceivable,
                          totalPayable,
                        }}
                        companyProfile={companyProfile}
                      />
                    }
                    fileName={`${client.name.replace(/\s+/g, "_")}_Ledger.pdf`}
                  >
                    {({ loading: pdfLoading }) => (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pdfLoading}
                      >
                        {pdfLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        <span className="ml-1.5 hidden sm:inline">Ledger</span>
                      </Button>
                    )}
                  </PDFDownloadLink>
                )}
                {toReceive > 0.5 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={openFifoCollect}
                  >
                    <ArrowDownLeft className="h-3 w-3 mr-1" />
                    Collect
                  </Button>
                )}
                {(toPay > 0 || totalPurchaseOutstanding > 0) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                    onClick={openFifoPay}
                  >
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    Pay
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={openAddPayment}>
                  <Plus className="h-3 w-3 mr-1" />
                  Manual
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border/70 bg-background/60 p-2 sm:p-3">
              <div className="space-y-4 py-2">
                {/* Advance not yet applied to bills — prompt user to reconcile */}
                {purchaseAvailableAdvance > 0.5 && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2.5">
                    <span className="text-amber-600 shrink-0 text-base">⚠</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">Advance Not Applied to Bills</p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-500">
                        {formatCurrency(purchaseAvailableAdvance)} advance payment is sitting separately — bills still show as unpaid.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-7 text-xs border-amber-400 text-amber-800 hover:bg-amber-100"
                      onClick={handleReconcilePartyPayments}
                      disabled={reconcilingPayments}
                    >
                      {reconcilingPayments ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Apply Now
                    </Button>
                  </div>
                )}

                {/* Credit Limit Warning Banner — based on SALES OUTSTANDING only */}
                {isCreditLimitExceeded && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2.5">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400">Credit Limit Exceeded!</p>
                      <p className="text-[11px] text-red-600 dark:text-red-500">
                        Net outstanding {formatCurrency(creditUsed)} exceeds credit limit of {formatCurrency(creditLimit)}
                        {" "}— over by {formatCurrency(creditUsed - creditLimit)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">

                  {/* Total Sales */}
                  <Card className="border">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Sales</span>
                      </div>
                      <p className={`text-base font-bold break-words ${totalSales > 0 ? "text-emerald-700" : "text-muted-foreground"}`}>
                        {formatCurrency(totalSales)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{salesBills.length} bills</p>
                      {totalSaleReturnValue > 0 && (
                        <p className="text-[10px] text-orange-600">-{formatCurrency(totalSaleReturnValue)} returns</p>
                      )}
                    </CardContent>
                  </Card>


                  {/* Total Purchase */}
                  <Card className="border">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Purchase</span>
                      </div>
                      <p className={`text-base font-bold break-words ${totalPurchases > 0 ? "text-blue-700" : "text-muted-foreground"}`}>
                        {formatCurrency(totalPurchases)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{purchaseBills.length} bills</p>
                      {totalPurchaseReturnValue > 0 && (
                        <p className="text-[10px] text-orange-600">-{formatCurrency(totalPurchaseReturnValue)} returns</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* To Pay — uses ledger-derived toPay to stay in sync with Net Balance */}
                  <Card className={`border ${toPay > 0 ? "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20" : ""}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <ShoppingCart className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">To Pay</span>
                      </div>
                      <p className={`text-base font-bold break-words ${toPay > 0 ? "text-blue-700" : "text-muted-foreground"}`}>
                        {formatCurrency(toPay)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {toPay > 0 ? "You owe party" : "All paid"}
                      </p>
                      {openingPayable > 0 && (
                        <p className="text-[10px] text-orange-600">Incl. opening {formatCurrency(openingPayable)}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">{purchaseBills.length} bills</p>
                    </CardContent>
                  </Card>

                  {/* Net Balance */}
                  <Card className={`border ${netBalance > 0 ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20" : netBalance < 0 ? "border-red-300 bg-red-50 dark:bg-red-950/20" : "border-green-200 bg-green-50/50"}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Wallet className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Net Balance</span>
                      </div>
                      <p className={`text-base font-bold break-words ${netBalance > 0 ? "text-emerald-700" : netBalance < 0 ? "text-red-700" : "text-green-700"}`}>
                        {netBalance === 0 ? "₹0" : formatCurrency(Math.abs(netBalance))}
                      </p>
                      <p className={`text-[10px] font-semibold ${netBalance > 0 ? "text-emerald-600" : netBalance < 0 ? "text-red-600" : "text-green-600"}`}>
                        {netBalance > 0 ? "Party owes you" : netBalance < 0 ? "You owe party" : "✓ Settled"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="ledger" className="w-full">
                  <TabsList className="flex w-full h-auto p-1 gap-1 overflow-x-auto">
                    <TabsTrigger value="ledger" className="text-xs px-3 py-1.5 shrink-0">
                      <BookOpen className="h-3 w-3 mr-1" />
                      Ledger
                    </TabsTrigger>
                    <TabsTrigger value="sales" className="text-xs px-3 py-1.5 shrink-0">
                      <FileText className="h-3 w-3 mr-1" />
                      Sales ({salesBills.length})
                    </TabsTrigger>
                    <TabsTrigger value="purchases" className="text-xs px-3 py-1.5 shrink-0">
                      <ShoppingCart className="h-3 w-3 mr-1" />
                      Purchases ({purchaseBills.length})
                    </TabsTrigger>
                    <TabsTrigger value="returns" className="text-xs px-3 py-1.5 shrink-0">
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Returns ({saleReturns.length + purchaseReturns.length})
                    </TabsTrigger>
                    <TabsTrigger value="payments" className="text-xs px-3 py-1.5 shrink-0">
                      <Wallet className="h-3 w-3 mr-1" />
                      Payments ({allPaymentEntries.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Ledger Tab ── */}
                  <TabsContent value="ledger" className="mt-3">
                    <Card>
                      <CardHeader className="px-3 py-2 border-b">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Full Ledger</CardTitle>
                          <div className={`text-xs font-semibold px-2 py-1 rounded-full ${netBalance >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            Balance: {netBalance >= 0 ? "+" : ""}{formatCurrency(netBalance)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        {ledgerDisplayEntries.length === 0 && openingBalanceAmt === 0 ? (
                          <p className="text-center py-8 text-sm text-muted-foreground">No transactions yet</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="text-xs w-8"></TableHead>
                                <TableHead className="text-xs">Date</TableHead>
                                <TableHead className="text-xs">Particulars</TableHead>
                                <TableHead className="text-xs">Ref / Note</TableHead>
                                <TableHead className="text-xs text-right">Debit (Dr)</TableHead>
                                <TableHead className="text-xs text-right">Credit (Cr)</TableHead>
                                <TableHead className="text-xs text-right">Balance</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {/* Opening row first, then chronological transactions */}
                              {openingBalanceAmt > 0 && (
                                <TableRow className="border-b-2 bg-orange-50/60 dark:bg-orange-950/20">
                                  <TableCell className="text-xs p-1"></TableCell>
                                  <TableCell className="text-xs font-semibold text-muted-foreground" colSpan={2}>
                                    Opening Balance (B/F)
                                    <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                                      {openingIsPayable ? "Credit" : "Debit"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">�</TableCell>
                                  <TableCell className="text-xs text-right text-emerald-700 font-semibold">
                                    {openingIsPayable ? "-" : fmtRs(openingBalanceAmt)}
                                  </TableCell>
                                  <TableCell className="text-xs text-right text-red-700 font-semibold">
                                    {openingIsPayable ? fmtRs(openingBalanceAmt) : "-"}
                                  </TableCell>
                                  <TableCell className={`text-xs text-right font-bold ${openingIsPayable ? "text-red-700" : "text-emerald-700"}`}>
                                    {fmtRs(openingBalanceAmt)}{" "}
                                    <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${openingIsPayable ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                                      {openingIsPayable ? "Cr" : "Dr"}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              )}
                              {ledgerDisplayEntries.slice((ledgerPage - 1) * LEDGER_PAGE_SIZE, ledgerPage * LEDGER_PAGE_SIZE).map((e, i) => (
                                <TableRow key={i} className={i % 2 === 0 ? "bg-muted/10" : ""}>
                                  <TableCell className="text-xs p-1">
                                    {e.billType === "sale" ? (
                                      <Button variant="ghost" size="icon" className="h-6 w-6"
                                        onClick={() => navigate(`/bills/${e.id}`)}>
                                        <Eye className="h-3 w-3 text-emerald-600" />
                                      </Button>
                                    ) : e.billType === "purchase" ? (
                                      <Button variant="ghost" size="icon" className="h-6 w-6"
                                        onClick={() => setViewPurchaseId(e.id)}>
                                        <Eye className="h-3 w-3 text-blue-600" />
                                      </Button>
                                    ) : null}
                                  </TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(e.date)}</TableCell>
                                  <TableCell className="text-xs">
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${
                                        e.type === "Sale"
                                          ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                                          : e.type === "Purchase"
                                          ? "text-blue-700 border-blue-200 bg-blue-50"
                                          : e.type.includes("Return")
                                          ? "text-orange-700 border-orange-200 bg-orange-50"
                                          : e.type.includes("Collected")
                                          ? "text-purple-700 border-purple-200 bg-purple-50"
                                          : "text-teal-700 border-teal-200 bg-teal-50"
                                      }`}
                                    >
                                      {e.type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground truncate max-w-[90px]">{e.ref}</TableCell>
                                  <TableCell className="text-xs text-right text-emerald-700 font-medium">
                                    {e.debit > 0 ? fmtRs(e.debit) : "—"}
                                  </TableCell>
                                  <TableCell className="text-xs text-right text-red-700 font-medium">
                                    {e.credit > 0 ? fmtRs(e.credit) : "—"}
                                  </TableCell>
                                  <TableCell className={`text-xs text-right font-bold ${e.balance > 0 ? "text-emerald-700" : e.balance < 0 ? "text-red-700" : "text-muted-foreground"}`}>
                                    {e.balance === 0
                                      ? "Rs.0"
                                      : <span>{fmtRs(Math.abs(e.balance))}{" "}<span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${e.balance > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{e.balance > 0 ? "Dr" : "Cr"}</span></span>
                                    }
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                        {ledgerDisplayEntries.length > LEDGER_PAGE_SIZE && (
                          <div className="flex items-center justify-between border-t px-4 py-3">
                            <p className="text-xs text-muted-foreground">
                              Showing{" "}
                              <span className="font-medium text-foreground">
                                {(ledgerPage - 1) * LEDGER_PAGE_SIZE + 1}–{Math.min(ledgerPage * LEDGER_PAGE_SIZE, ledgerDisplayEntries.length)}
                              </span>{" "}
                              of{" "}
                              <span className="font-medium text-foreground">{ledgerDisplayEntries.length}</span> entries
                            </p>
                            <div className="flex items-center gap-1">
                              <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={ledgerPage === 1} onClick={() => setLedgerPage((p) => p - 1)}>
                                Previous
                              </Button>
                              <span className="px-2 text-xs text-muted-foreground tabular-nums">
                                {ledgerPage} / {Math.ceil(ledgerDisplayEntries.length / LEDGER_PAGE_SIZE)}
                              </span>
                              <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={ledgerPage >= Math.ceil(ledgerDisplayEntries.length / LEDGER_PAGE_SIZE)} onClick={() => setLedgerPage((p) => p + 1)}>
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* ── Sales Tab ── */}
                  <TabsContent value="sales" className="mt-3">
                    <Card>
                      <CardContent className="p-0 overflow-x-auto">
                        {salesBills.length === 0 ? (
                          <p className="text-center py-8 text-sm text-muted-foreground">No sales bills for this party</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Bill #</TableHead>
                                <TableHead className="text-xs">Date</TableHead>
                                <TableHead className="text-xs text-right">Total</TableHead>
                                <TableHead className="text-xs text-right">Paid</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {salesBills.map((b) => (
                                <TableRow key={b.id}>
                                  <TableCell className="text-xs font-medium">{b.billNumber}</TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(b.date)}</TableCell>
                                  <TableCell className="text-xs text-right font-semibold">{formatCurrency(b.total)}</TableCell>
                                  <TableCell className="text-xs text-right text-emerald-700">{formatCurrency(b.paidAmount || 0)}</TableCell>
                                  <TableCell>{statusBadge(b.paymentStatus)}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => navigate(`/bills/${b.id}`)}
                                      >
                                        <Eye className="h-3 w-3" />
                                      </Button>
                                      {b.paymentStatus !== "paid" && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-emerald-700"
                                          onClick={() => openBillPay(b)}
                                        >
                                          <CreditCard className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* ── Purchases Tab ── */}
                  <TabsContent value="purchases" className="mt-3">
                    <Card>
                      <CardContent className="p-0 overflow-x-auto">
                        {purchaseBills.length === 0 ? (
                          <p className="text-center py-8 text-sm text-muted-foreground">No purchase bills for this party</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Bill #</TableHead>
                                <TableHead className="text-xs">Date</TableHead>
                                <TableHead className="text-xs">Items</TableHead>
                                <TableHead className="text-xs text-right">Total</TableHead>
                                <TableHead className="text-xs text-right">Paid</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {purchaseBills.map((b) => (
                                <TableRow key={b.id}>
                                  <TableCell className="text-xs font-medium">{b.billNumber || "-"}</TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(b.billDate || b.createdAt)}</TableCell>
                                  <TableCell className="text-xs">{b.items.length} items</TableCell>
                                  <TableCell className="text-xs text-right font-semibold">{formatCurrency(b.total)}</TableCell>
                                  <TableCell className="text-xs text-right text-emerald-700">{formatCurrency(b.paidAmount || 0)}</TableCell>
                                  <TableCell>{statusBadge(b.paymentStatus)}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      {b.paymentStatus !== "paid" && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-blue-700"
                                          onClick={() => openPurBillPay(b)}
                                        >
                                          <CreditCard className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* ── Returns Tab ── */}
                  <TabsContent value="returns" className="mt-3 space-y-3">
                    {saleReturns.length > 0 && (
                      <Card>
                        <CardHeader className="px-3 py-2 border-b">
                          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Sale Returns</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Date</TableHead>
                                <TableHead className="text-xs">Bill #</TableHead>
                                <TableHead className="text-xs">Items</TableHead>
                                <TableHead className="text-xs text-right">Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {saleReturns.map((r) => (
                                <TableRow key={r.id}>
                                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.returnDate || r.createdAt)}</TableCell>
                                  <TableCell className="text-xs">{r.billNumber}</TableCell>
                                  <TableCell className="text-xs">
                                    {r.items.map((it, i) => (
                                      <div key={i} className="text-[10px] text-muted-foreground">
                                        {it.productName} ×{it.quantity}
                                      </div>
                                    ))}
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-semibold text-orange-700">{formatCurrency(r.totalReturnValue)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}
                    {purchaseReturns.length > 0 && (
                      <Card>
                        <CardHeader className="px-3 py-2 border-b">
                          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Purchase Returns</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Date</TableHead>
                                <TableHead className="text-xs">Ref</TableHead>
                                <TableHead className="text-xs">Items</TableHead>
                                <TableHead className="text-xs text-right">Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {purchaseReturns.map((r) => (
                                <TableRow key={r.id}>
                                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.returnDate || r.createdAt)}</TableCell>
                                  <TableCell className="text-xs">{r.billNumber || "-"}</TableCell>
                                  <TableCell className="text-xs">
                                    {r.items.map((it, i) => (
                                      <div key={i} className="text-[10px] text-muted-foreground">
                                        {it.productName} ×{it.quantity}
                                      </div>
                                    ))}
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-semibold text-blue-700">{formatCurrency(r.totalReturnValue)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}
                    {saleReturns.length === 0 && purchaseReturns.length === 0 && (
                      <Card>
                        <CardContent className="py-8 text-center text-sm text-muted-foreground">
                          No returns for this party
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* ── Payments Tab ── */}
                  <TabsContent value="payments" className="mt-3 space-y-3">
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border bg-emerald-50 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-xs text-muted-foreground">Collected</span>
                        </div>
                        <p className="text-base font-bold text-emerald-700">{formatCurrency(totalCollected)}</p>
                        <p className="text-[10px] text-muted-foreground">From party</p>
                      </div>
                      <div className="rounded-lg border bg-blue-50 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ArrowUpRight className="h-3.5 w-3.5 text-blue-600" />
                          <span className="text-xs text-muted-foreground">Sent</span>
                        </div>
                        <p className="text-base font-bold text-blue-700">{formatCurrency(totalSent)}</p>
                        <p className="text-[10px] text-muted-foreground">To party</p>
                      </div>
                    </div>

                    <Card>
                      <CardHeader className="px-3 py-2 border-b">
                        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                          All Payment Transactions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        {allPaymentEntries.length === 0 ? (
                          <p className="text-center py-4 text-xs text-muted-foreground">No payment transactions yet</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Date</TableHead>
                                <TableHead className="text-xs">Type</TableHead>
                                <TableHead className="text-xs">Ref / Note</TableHead>
                                <TableHead className="text-xs text-right">Debit</TableHead>
                                <TableHead className="text-xs text-right">Credit</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {allPaymentEntries.map((p, i) => (
                                <TableRow key={`${p.id}-${i}`}>
                                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(p.date)}</TableCell>
                                  <TableCell className="text-xs">
                                    <Badge variant="outline" className="text-[10px]">
                                      {p.type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">{p.ref}</TableCell>
                                  <TableCell className="text-xs text-right text-emerald-700 font-medium">
                                    {p.debit > 0 ? fmtRs(p.debit) : "—"}
                                  </TableCell>
                                  <TableCell className="text-xs text-right text-red-700 font-medium">
                                    {p.credit > 0 ? fmtRs(p.credit) : "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>

                    {/* Party-level payments */}
                    <Card>
                      <CardHeader className="px-3 py-2 border-b flex-row items-center justify-between">
                        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Independent Payments</CardTitle>
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={openAddPayment}>
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        {partyPayments.length === 0 ? (
                          <p className="text-center py-4 text-xs text-muted-foreground">No independent payments yet</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Date</TableHead>
                                <TableHead className="text-xs">Type</TableHead>
                                <TableHead className="text-xs">Method</TableHead>
                                <TableHead className="text-xs text-right">Amount</TableHead>
                                <TableHead className="text-xs">Note</TableHead>
                                <TableHead className="text-xs"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {partyPayments.map((p) => (
                                <TableRow key={p.id}>
                                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(p.date)}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${
                                        p.type === "collected"
                                          ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                                          : "text-blue-700 border-blue-200 bg-blue-50"
                                      }`}
                                    >
                                      {p.type === "collected" ? (
                                        <ArrowDownLeft className="h-2.5 w-2.5 mr-1" />
                                      ) : (
                                        <ArrowUpRight className="h-2.5 w-2.5 mr-1" />
                                      )}
                                      {p.type === "collected" ? "Collected" : "Sent"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">{p.method}</TableCell>
                                  <TableCell className="text-xs text-right font-semibold">{formatCurrency(p.amount)}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground truncate max-w-[80px]">{p.note || "-"}</TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-destructive"
                                      onClick={() => handleDeletePartyPayment(p.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Purchase Bill Detail View Dialog (from Ledger) */}
      {viewPurchaseId && (() => {
        const vb = purchaseBills.find(b => b.id === viewPurchaseId);
        if (!vb) return null;
        const outstanding = vb.total - (vb.paidAmount || 0);
        return (
          <Dialog open={!!viewPurchaseId} onOpenChange={(o) => { if (!o) setViewPurchaseId(null); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-sm">Purchase Bill Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-muted/30 rounded-lg p-3">
                  <div><span className="text-muted-foreground">Bill #</span><p className="font-semibold">{vb.billNumber || "—"}</p></div>
                  <div><span className="text-muted-foreground">Date</span><p className="font-semibold">{fmtDate(vb.billDate || vb.createdAt)}</p></div>
                  <div><span className="text-muted-foreground">Party</span><p className="font-semibold">{vb.vendorName}</p></div>
                  <div><span className="text-muted-foreground">Status</span><p>{statusBadge(vb.paymentStatus)}</p></div>
                </div>
                {vb.items.length > 0 && (
                  <div>
                    <p className="font-semibold mb-1 text-muted-foreground uppercase tracking-wide text-[10px]">Items</p>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left p-2 font-medium">Item</th>
                            <th className="text-right p-2 font-medium">Qty</th>
                            <th className="text-right p-2 font-medium">Rate</th>
                            <th className="text-right p-2 font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vb.items.map((item, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                              <td className="p-2">
                                <p className="font-medium">{item.description}</p>
                                {item.imeiNumber && <p className="text-[10px] text-muted-foreground">IMEI: {item.imeiNumber}</p>}
                                {item.model && <p className="text-[10px] text-muted-foreground">{item.model}{item.storage ? ` / ${item.storage}` : ""}{item.color ? ` / ${item.color}` : ""}</p>}
                                {(item as any).batteryHealth && <p className="text-[10px] text-amber-600">Batt: {(item as any).batteryHealth}</p>}
                                {(item as any).warranty && <p className="text-[10px] text-blue-600">Warranty: {(item as any).warranty}</p>}
                              </td>
                              <td className="p-2 text-right">{item.quantity} {item.unit}</td>
                              <td className="p-2 text-right">{fmtRs(item.rate)}</td>
                              <td className="p-2 text-right font-semibold">{fmtRs(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/30 rounded p-2 text-center">
                    <p className="text-muted-foreground text-[10px]">Total</p>
                    <p className="font-bold text-sm">{fmtRs(vb.total)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded p-2 text-center">
                    <p className="text-muted-foreground text-[10px]">Paid</p>
                    <p className="font-bold text-sm text-emerald-700">{fmtRs(vb.paidAmount || 0)}</p>
                  </div>
                  <div className={`rounded p-2 text-center ${outstanding > 0 ? "bg-red-50" : "bg-muted/30"}`}>
                    <p className="text-muted-foreground text-[10px]">Balance</p>
                    <p className={`font-bold text-sm ${outstanding > 0 ? "text-red-700" : "text-muted-foreground"}`}>{fmtRs(outstanding)}</p>
                  </div>
                </div>
                {vb.notes && <p className="text-muted-foreground italic text-[11px]">Note: {vb.notes}</p>}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Party Payment Dialog */}
      <Dialog open={partyPaymentOpen} onOpenChange={setPartyPaymentOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  variant={payForm.type === "collected" ? "default" : "outline"}
                  onClick={() => setPayForm((f) => ({ ...f, type: "collected" }))}
                >
                  <ArrowDownLeft className="h-3 w-3 mr-1" />
                  Collected (Cr)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  variant={payForm.type === "sent" ? "default" : "outline"}
                  onClick={() => setPayForm((f) => ({ ...f, type: "sent" }))}
                >
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  Sent (Dr)
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {payForm.type === "collected"
                  ? "Sale payment received -> Credit"
                  : "Purchase payment sent -> Debit"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount *</Label>
              <Input
                type="number"
                autoFocus
                placeholder="0"
                value={payForm.amount}
                onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleSavePartyPayment()}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Method</Label>
              <Select
                value={payForm.method}
                onValueChange={(v) =>
                  setPayForm((f) => ({
                    ...f,
                    method: v as PaymentMethod,
                    bankAccountId: v === "Cash" ? "" : f.bankAccountId,
                  }))
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {payForm.method !== "Cash" && (
              <div className="space-y-1">
                <Label className="text-xs">Bank Account *</Label>
                {bankAccounts.length === 0 ? (
                  <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
                    No bank accounts found. Add accounts in <strong>Bank &amp; Cash</strong> section first.
                  </p>
                ) : (
                  <Select
                    value={payForm.bankAccountId}
                    onValueChange={(v) => setPayForm((f) => ({ ...f, bankAccountId: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.bankName} — {b.accountHolder}
                          {b.accountNumber ? ` (${b.accountNumber.slice(-4)})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={payForm.date}
                onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note (optional)</Label>
              <Input
                className="h-8 text-xs"
                value={payForm.note}
                onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Bill settlement..."
                onKeyDown={(e) => e.key === "Enter" && handleSavePartyPayment()}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPartyPaymentOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSavePartyPayment}
                disabled={savingPayment}
              >
                {savingPayment ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sale Bill Payment Dialog */}
      <Dialog open={billPayOpen} onOpenChange={setBillPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              Collect Payment — {billPayBill?.billNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/40 p-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bill Total</span>
                <span className="font-medium">{formatCurrency(billPayBill?.total || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium text-emerald-700">{formatCurrency(billPayBill?.paidAmount || 0)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="font-medium">Pending</span>
                <span className="font-bold text-orange-600">
                  {formatCurrency(Math.max(0, (billPayBill?.total || 0) - (billPayBill?.paidAmount || 0)))}
                </span>
              </div>
            </div>
            {saleAvailableAdvance > 0.5 && billPayBill && (() => {
              const pending = Math.max(0, billPayBill.total - billPayBill.paidAmount);
              const adv = Math.min(saleAvailableAdvance, pending);
              return (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 text-xs space-y-1">
                  <div className="flex justify-between text-blue-700 font-medium">
                    <span>Advance credit from party</span>
                    <span>{formatCurrency(adv)}</span>
                  </div>
                  <p className="text-blue-500">
                    {adv >= pending
                      ? "Bill fully covered by advance — no cash needed."
                      : `Will be auto-applied. You only need to collect ${formatCurrency(pending - adv)}.`}
                  </p>
                </div>
              );
            })()}
            <div className="space-y-1">
              <Label className="text-xs">Amount *</Label>
              <Input
                type="number"
                autoFocus
                value={billPayAmount}
                onChange={(e) => setBillPayAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBillPaySubmit()}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Method</Label>
              <Select value={billPayMethod} onValueChange={(v) => setBillPayMethod(v as PaymentMethod)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {billPayMethod !== "Cash" && (
              <div className="space-y-1">
                <Label className="text-xs">Bank Account *</Label>
                {bankAccounts.length === 0 ? (
                  <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
                    No bank accounts found. Add in <strong>Bank &amp; Cash</strong> section.
                  </p>
                ) : (
                  <Select value={billPayBankId} onValueChange={setBillPayBankId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select bank account" /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.bankName} — {b.accountHolder}
                          {b.accountNumber ? ` (${b.accountNumber.slice(-4)})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Note (optional)</Label>
              <Input
                className="h-8 text-xs"
                value={billPayNote}
                onChange={(e) => setBillPayNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setBillPayOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleBillPaySubmit} disabled={processingBillPay}>
                {processingBillPay ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CreditCard className="h-3 w-3 mr-1" />}
                Collect
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* FIFO Collect Payment Dialog */}
      <Dialog open={fifoCollectOpen} onOpenChange={setFifoCollectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              Collect Payment — {client.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Sale Outstanding</span>
                <span className="font-bold text-emerald-700">{formatCurrency(totalSaleOutstanding)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unpaid Bills</span>
                <span className="font-medium">
                  {salesBills.filter((b) => b.paymentStatus !== "paid" && b.paymentStatus !== "overpaid").length}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Amount to Collect *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] text-emerald-700 px-1"
                  onClick={() => setFifoCollectAmount(totalSaleOutstanding.toFixed(2))}
                >
                  Full ({formatCurrency(totalSaleOutstanding)})
                </Button>
              </div>
              <Input
                type="number"
                autoFocus
                placeholder="0"
                value={fifoCollectAmount}
                onChange={(e) => setFifoCollectAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFifoCollect()}
              />
            </div>
            {/* Live preview */}
            {parseFloat(fifoCollectAmount) > 0 && (() => {
              const { allocations, unallocated } = computeFifoDistribution(
                salesBills as any,
                parseFloat(fifoCollectAmount),
                false,
              );
              return allocations.length > 0 ? (
                <div className="rounded-lg border bg-muted/30 p-2 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    Distribution (oldest bills first)
                  </p>
                  {allocations.map((a) => (
                    <div key={a.billId} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        #{a.billNumber} · {fmtDate(a.date)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-emerald-700">
                          {formatCurrency(a.allocate)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${a.willBePaid ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                          {a.willBePaid ? "PAID" : "partial"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {unallocated > 0 && (
                    <p className="text-[10px] text-orange-600 border-t pt-1 mt-1">
                      {formatCurrency(unallocated)} has no more bills to apply to
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-1">No outstanding bills found</p>
              );
            })()}
            <div className="space-y-1">
              <Label className="text-xs">Method</Label>
              <Select
                value={fifoCollectMethod}
                onValueChange={(v) => {
                  setFifoCollectMethod(v as PaymentMethod);
                  if (v === "Cash") setFifoCollectBankId("");
                }}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {fifoCollectMethod !== "Cash" && (
              <div className="space-y-1">
                <Label className="text-xs">Bank Account *</Label>
                {bankAccounts.length === 0 ? (
                  <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
                    No bank accounts found. Add in <strong>Bank &amp; Cash</strong> section.
                  </p>
                ) : (
                  <Select value={fifoCollectBankId} onValueChange={setFifoCollectBankId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select bank account" /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.bankName} — {b.accountHolder}
                          {b.accountNumber ? ` (${b.accountNumber.slice(-4)})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={fifoCollectDate}
                onChange={(e) => setFifoCollectDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note (optional)</Label>
              <Input
                className="h-8 text-xs"
                value={fifoCollectNote}
                onChange={(e) => setFifoCollectNote(e.target.value)}
                placeholder="e.g. Cash received..."
                onKeyDown={(e) => e.key === "Enter" && handleFifoCollect()}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setFifoCollectOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleFifoCollect}
                disabled={processingFifoCollect}
              >
                {processingFifoCollect ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <ArrowDownLeft className="h-3 w-3 mr-1" />
                )}
                Collect
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* FIFO Pay to Party Dialog */}
      <Dialog open={fifoPayOpen} onOpenChange={setFifoPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              Pay to Party — {client.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Net Amount to Pay</span>
                <span className="font-bold text-blue-700 text-sm">{formatCurrency(toPay)}</span>
              </div>
              {(purchaseAvailableAdvance > 0.5 || vendorAdvanceCredit > 0.5 || (openingBalanceAmt > 0.5 && !openingIsPayable && totalPurchaseOutstanding > toPay + 0.5)) && (
                <>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Bills outstanding</span>
                    <span>{formatCurrency(totalPurchaseOutstanding)}</span>
                  </div>
                  {purchaseAvailableAdvance > 0.5 && (
                    <div className="flex justify-between text-[10px] text-emerald-700">
                      <span>Advance already paid to party</span>
                      <span>− {formatCurrency(purchaseAvailableAdvance)}</span>
                    </div>
                  )}
                  {vendorAdvanceCredit > 0.5 && (
                    <div className="flex justify-between text-[10px] text-emerald-700">
                      <span>Advance credit with vendor</span>
                      <span>− {formatCurrency(vendorAdvanceCredit)}</span>
                    </div>
                  )}
                  {openingBalanceAmt > 0.5 && !openingIsPayable && (
                    <div className="flex justify-between text-[10px] text-emerald-700">
                      <span>Opening balance offset</span>
                      <span>− {formatCurrency(Math.min(openingBalanceAmt, totalPurchaseOutstanding))}</span>
                    </div>
                  )}
                </>
              )}
              {newSalesReceivable > 0.5 && newPurchasePayable > 0.5 && toPay > 0 && (
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Purchase − sales receivable offset</span>
                  <span>{formatCurrency(Math.max(0, newPurchasePayable))} − {formatCurrency(Math.max(0, newSalesReceivable))}</span>
                </div>
              )}
              {toPay === 0 && newSalesReceivable > 0.5 && (
                <div className="text-[10px] text-emerald-700">
                  Net balance is in your favour (party owes you more from sales)
                </div>
              )}
              <div className="flex justify-between pt-0.5 border-t border-blue-100">
                <span className="text-muted-foreground">Unpaid Bills</span>
                <span className="font-medium">
                  {purchaseBills.filter((b) => b.paymentStatus !== "paid" && b.paymentStatus !== "overpaid").length}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Amount to Pay *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] text-blue-700 px-1"
                  onClick={() => {
                    setFifoPayAmount(toPay.toFixed(2));
                  }}
                >
                  Full ({formatCurrency(toPay)})
                </Button>
              </div>
              <Input
                type="number"
                autoFocus
                placeholder="0"
                value={fifoPayAmount}
                onChange={(e) => setFifoPayAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFifoPay()}
              />
            </div>
            {/* Live preview */}
            {parseFloat(fifoPayAmount) > 0 && (() => {
              const { allocations, unallocated } = computeFifoDistribution(
                purchaseBills as any,
                parseFloat(fifoPayAmount),
                true,
              );
              return allocations.length > 0 ? (
                <div className="rounded-lg border bg-muted/30 p-2 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    Distribution (oldest bills first)
                  </p>
                  {allocations.map((a) => (
                    <div key={a.billId} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        #{a.billNumber} · {fmtDate(a.date)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-blue-700">
                          {formatCurrency(a.allocate)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${a.willBePaid ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                          {a.willBePaid ? "PAID" : "partial"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {unallocated > 0 && (
                    <p className="text-[10px] text-orange-600 border-t pt-1 mt-1">
                      {formatCurrency(unallocated)} has no more bills to apply to
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-1">All bills paid — amount will be recorded as party payment</p>
              );
            })()}
            <div className="space-y-1">
              <Label className="text-xs">Method</Label>
              <Select
                value={fifoPayMethod}
                onValueChange={(v) => {
                  setFifoPayMethod(v as PaymentMethod);
                  if (v === "Cash") setFifoPayBankId("");
                }}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {fifoPayMethod !== "Cash" && (
              <div className="space-y-1">
                <Label className="text-xs">Bank Account *</Label>
                {bankAccounts.length === 0 ? (
                  <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
                    No bank accounts found. Add in <strong>Bank &amp; Cash</strong> section.
                  </p>
                ) : (
                  <Select value={fifoPayBankId} onValueChange={setFifoPayBankId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select bank account" /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.bankName} — {b.accountHolder}
                          {b.accountNumber ? ` (${b.accountNumber.slice(-4)})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={fifoPayDate}
                onChange={(e) => setFifoPayDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note (optional)</Label>
              <Input
                className="h-8 text-xs"
                value={fifoPayNote}
                onChange={(e) => setFifoPayNote(e.target.value)}
                placeholder="e.g. Bill payment..."
                onKeyDown={(e) => e.key === "Enter" && handleFifoPay()}
              />
            </div>
            {partyPayments.filter((p) => p.type === "sent").length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
                <p className="font-medium text-amber-800 mb-1">
                  {partyPayments.filter((p) => p.type === "sent").length} old party payment(s) not yet applied to bills
                  {" "}({formatCurrency(partyPayments.filter((p) => p.type === "sent").reduce((s, p) => s + p.amount, 0))})
                </p>
                <p className="text-amber-700 mb-2 text-[10px]">
                  Apply these to purchase bills (oldest first) so bill statuses reflect actual payments.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs border-amber-400 text-amber-800 hover:bg-amber-100"
                  onClick={handleReconcilePartyPayments}
                  disabled={reconcilingPayments}
                >
                  {reconcilingPayments ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Apply to Bills & Sync
                </Button>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setFifoPayOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleFifoPay}
                disabled={processingFifoPay}
              >
                {processingFifoPay ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                )}
                Pay
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Purchase Bill Payment Dialog */}
      <Dialog open={purBillPayOpen} onOpenChange={setPurBillPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              Send Payment — {purBillPayBill?.billNumber || "Purchase Bill"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/40 p-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bill Total</span>
                <span className="font-medium">{formatCurrency(purBillPayBill?.total || 0)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="font-medium">Pending</span>
                <span className="font-bold text-orange-600">
                  {formatCurrency(Math.max(0, (purBillPayBill?.total || 0) - (purBillPayBill?.paidAmount || 0)))}
                </span>
              </div>
            </div>
            {purchaseAvailableAdvance > 0.5 && purBillPayBill && (() => {
              const returns = (purBillPayBill.returns || []).reduce((s, r) => s + r.totalReturnValue, 0);
              const pending = Math.max(0, purBillPayBill.total - returns - purBillPayBill.paidAmount);
              const adv = Math.min(purchaseAvailableAdvance, pending);
              return (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 text-xs space-y-1">
                  <div className="flex justify-between text-blue-700 font-medium">
                    <span>Advance credit with vendor</span>
                    <span>{formatCurrency(adv)}</span>
                  </div>
                  <p className="text-blue-500">
                    {adv >= pending
                      ? "Bill fully covered by advance — no cash needed."
                      : `Will be auto-applied. You only need to send ${formatCurrency(pending - adv)}.`}
                  </p>
                </div>
              );
            })()}
            <div className="space-y-1">
              <Label className="text-xs">Amount *</Label>
              <Input
                type="number"
                autoFocus
                value={purBillPayAmount}
                onChange={(e) => setPurBillPayAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePurBillPaySubmit()}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Method</Label>
              <Select value={purBillPayMethod} onValueChange={(v) => setPurBillPayMethod(v as PaymentMethod)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {purBillPayMethod !== "Cash" && (
              <div className="space-y-1">
                <Label className="text-xs">Bank Account *</Label>
                {bankAccounts.length === 0 ? (
                  <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
                    No bank accounts found. Add in <strong>Bank &amp; Cash</strong> section.
                  </p>
                ) : (
                  <Select value={purBillPayBankId} onValueChange={setPurBillPayBankId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select bank account" /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.bankName} — {b.accountHolder}
                          {b.accountNumber ? ` (${b.accountNumber.slice(-4)})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPurBillPayOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handlePurBillPaySubmit} disabled={processingPurBillPay}>
                {processingPurBillPay ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}