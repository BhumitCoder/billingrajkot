import { useEffect, useState } from "react";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";
import { dummyBankAccounts } from "@/lib/dummyData";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getBankAccounts,
  saveBankAccount,
  deleteBankAccount,
  getBills,
  getPurchaseBills,
  getPartyPayments,
  getExpenses,
} from "@/lib/storage";
import { BankAccount, Bill, PurchaseBill, PartyPayment, Expense } from "@/types";
import { toast } from "sonner";
import { BankStatement } from "@/components/BankStatement";
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  Building2,
  User,
  Hash,
  MapPin,
  QrCode,
  Loader2,
  FileText,
  Banknote,
  TrendingUp,
  TrendingDown,
  Wallet,
  Star,
} from "lucide-react";

function formatCurrency(amount: number) {
  return `₹${Math.abs(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface AccountBalance {
  credits: number;
  debits: number;
  balance: number;
}

interface CashBreakdown extends AccountBalance {
  cashBillIn: number;
  cashPartyIn: number;
  cashPurchaseOut: number;
  cashExpenseOut: number;
  cashPartyOut: number;
}

export default function BankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [statementAccount, setStatementAccount] = useState<BankAccount | null>(null);
  const [accountBalances, setAccountBalances] = useState<Record<string, AccountBalance>>({});
  const [cashBalance, setCashBalance] = useState<CashBreakdown>({ credits: 0, debits: 0, balance: 0, cashBillIn: 0, cashPartyIn: 0, cashPurchaseOut: 0, cashExpenseOut: 0, cashPartyOut: 0 });
  const [showCashBreakdown, setShowCashBreakdown] = useState(false);
  const [formData, setFormData] = useState<Partial<BankAccount>>({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    branchAndIFSC: "",
    upiId: "",
    isDefault: false,
  });

  const { locked, reloadKey } = useEncryptionLock();

  const loadAccounts = async () => {
    if (locked) { setAccounts(dummyBankAccounts); setLoading(false); return; }
    setLoading(true);
    try {
      const [accs, allBills, allPurchases, allPartyPay, allExpenses] = await Promise.all([
        getBankAccounts(),
        getBills(),
        getPurchaseBills(),
        getPartyPayments(),
        getExpenses(),
      ]);
      setAccounts(accs);
      computeBalances(accs, allBills as Bill[], allPurchases as PurchaseBill[], allPartyPay as PartyPayment[], allExpenses as Expense[]);
    } catch (error) {
      toast.error("Failed to load bank accounts");
    } finally {
      setLoading(false);
    }
  };

  const computeBalances = (
    accs: BankAccount[],
    bills: Bill[],
    purchaseBills: PurchaseBill[],
    partyPayments: PartyPayment[],
    expenses: Expense[]
  ) => {
    const bankMethods = ["Bank Transfer", "UPI", "Cheque"];

    // Exclude auto-synced purchase courier expenses — they are already
    // represented as purchase bill payments and would be double-counted.
    const realExpenses = expenses.filter((e) => (e as any).sourceType !== "purchase_bill_auto");

    // ── Per-bank-account balance ─────────────────────────────────────────────
    const balances: Record<string, AccountBalance> = {};
    accs.forEach((acc) => {
      // Credits: sale bill payments via this bank account
      // Use payments[] array for accuracy; fall back to bill-level for legacy bills
      const billCredits = bills.reduce((total, bill) => {
        const pmts = bill.payments || [];
        if (pmts.length > 0) {
          return total + pmts
            .filter((p) => (p as any).bankAccountId === acc.id || (bill.bankAccountId === acc.id && bankMethods.includes(p.method)))
            .reduce((s, p) => s + p.amount, 0);
        }
        if (bill.bankAccountId === acc.id) return total + (bill.paidAmount || 0);
        return total;
      }, 0);

      // Credits: party payments collected via this bank account
      const partyCredits = partyPayments
        .filter((p) => p.type === "collected" && p.bankAccountId === acc.id && bankMethods.includes(p.method))
        .reduce((s, p) => s + p.amount, 0);

      // Debits: real expenses paid from this bank account (exclude auto-synced)
      const expenseDebits = realExpenses
        .filter((e) => e.paymentMethod === "Bank" && e.bankAccountId === acc.id)
        .reduce((s, e) => s + e.amount, 0);

      // Debits: purchase bill payments via this bank account
      const purchaseDebits = purchaseBills.reduce((total, bill) => {
        const pmts = bill.payments || [];
        if (pmts.length > 0) {
          return total + pmts
            .filter((p) => (p as any).bankAccountId === acc.id || (bill.bankAccountId === acc.id && bankMethods.includes(p.method)))
            .reduce((s, p) => s + Math.abs(p.amount), 0);
        }
        if (bill.bankAccountId === acc.id) return total + (bill.paidAmount || 0);
        return total;
      }, 0);

      // Debits: party payments sent via this bank account
      const partyDebits = partyPayments
        .filter((p) => p.type === "sent" && p.bankAccountId === acc.id && bankMethods.includes(p.method))
        .reduce((s, p) => s + p.amount, 0);

      const credits = billCredits + partyCredits;
      const debits = expenseDebits + purchaseDebits + partyDebits;
      balances[acc.id] = { credits, debits, balance: (acc.openingBalance ?? 0) + credits - debits };
    });
    setAccountBalances(balances);

    // ── Cash balance ─────────────────────────────────────────────────────────
    // Cash in: use payments[] array if available (accurate); else fall back to bill-level
    const cashBillIn = bills.reduce((total, bill) => {
      const pmts = bill.payments || [];
      if (pmts.length > 0) {
        return total + pmts.filter((p) => p.method === "Cash").reduce((s, p) => s + p.amount, 0);
      }
      if (bill.paymentType === "Cash" || (bill.modeOfPayment as string) === "Cash") {
        return total + (bill.paidAmount || 0);
      }
      return total;
    }, 0);

    // Cash in: party payments collected in Cash
    const cashPartyIn = partyPayments
      .filter((p) => p.type === "collected" && p.method === "Cash")
      .reduce((s, p) => s + p.amount, 0);

    // Cash out: purchase bill payments made in Cash
    const cashPurchaseOut = purchaseBills
      .flatMap((b) => (b.payments || []).filter((p) => p.method === "Cash"))
      .reduce((s, p) => s + Math.abs(p.amount), 0);

    // Cash out: real expenses paid in Cash (auto-synced courier already in purchaseOut)
    const cashExpenseOut = realExpenses
      .filter((e) => e.paymentMethod === "Cash")
      .reduce((s, e) => s + e.amount, 0);

    // Cash out: party payments sent in Cash
    const cashPartyOut = partyPayments
      .filter((p) => p.type === "sent" && p.method === "Cash")
      .reduce((s, p) => s + p.amount, 0);

    const totalCashIn = cashBillIn + cashPartyIn;
    const totalCashOut = cashPurchaseOut + cashExpenseOut + cashPartyOut;
    setCashBalance({ credits: totalCashIn, debits: totalCashOut, balance: totalCashIn - totalCashOut, cashBillIn, cashPartyIn, cashPurchaseOut, cashExpenseOut, cashPartyOut });
  };

  useEffect(() => {
    loadAccounts();
  }, [locked, reloadKey]);

  const handleOpenDialog = (account?: BankAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData(account);
    } else {
      setEditingAccount(null);
      setFormData({
        bankName: "",
        accountHolder: "",
        accountNumber: "",
        branchAndIFSC: "",
        upiId: "",
        isDefault: accounts.length === 0,
        openingBalance: 0,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) { toast.error("Unable to save. Check your connection."); return; }
    setSaving(true);
    try {
      const accountData: BankAccount = {
        id: editingAccount?.id || Math.random().toString(36).substr(2, 9),
        bankName: formData.bankName || "",
        accountHolder: formData.accountHolder || "",
        accountNumber: formData.accountNumber || "",
        branchAndIFSC: formData.branchAndIFSC || "",
        upiId: formData.upiId || "",
        isDefault: formData.isDefault || false,
        openingBalance: formData.openingBalance ?? 0,
      };

      if (accountData.isDefault) {
        for (const acc of accounts) {
          if (acc.id !== accountData.id && acc.isDefault) {
            await saveBankAccount({ ...acc, isDefault: false });
          }
        }
      }

      await saveBankAccount(accountData);
      toast.success(editingAccount ? "Account updated" : "Account added");
      setIsDialogOpen(false);
      loadAccounts();
    } catch (error) {
      toast.error("Failed to save account");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this account?")) return;
    if (locked) { toast.error("Unable to save. Check your connection."); return; }
    try {
      await deleteBankAccount(id);
      toast.success("Account deleted");
      loadAccounts();
    } catch (error) {
      toast.error("Failed to delete account");
    }
  };

  const totalBankBalance = Object.values(accountBalances).reduce((s, b) => s + b.balance, 0);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-slate-50/40 p-3 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Bank & Cash</h1>
              <p className="text-xs text-muted-foreground">Current balances from all transactions</p>
            </div>
          </div>
          <Button size="sm" onClick={() => handleOpenDialog()} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border/70 bg-background/70 p-3 sm:p-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Cash on Hand */}
              <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/20 dark:border-emerald-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                      <Banknote className="h-4.5 w-4.5 text-emerald-700 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Cash on Hand</p>
                      <p className={`text-xl font-bold ${cashBalance.balance >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {formatCurrency(cashBalance.balance)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100 dark:border-emerald-900">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Cash In</p>
                      <p className="text-xs font-semibold text-emerald-700">{formatCurrency(cashBalance.credits)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Cash Out</p>
                      <p className="text-xs font-semibold text-red-600">{formatCurrency(cashBalance.debits)}</p>
                    </div>
                  </div>
                  {/* Breakdown toggle */}
                  <button
                    className="mt-2 w-full text-[10px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 pt-1 border-t border-emerald-100 dark:border-emerald-900"
                    onClick={() => setShowCashBreakdown((v) => !v)}
                  >
                    {showCashBreakdown ? "▲ Hide breakdown" : "▼ Show breakdown"}
                  </button>
                  {showCashBreakdown && (
                    <div className="mt-2 space-y-1 text-[11px]">
                      <p className="font-semibold text-emerald-700 text-[10px] uppercase tracking-wide">Cash In</p>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Sale bill payments</span>
                        <span className="font-mono text-emerald-700">+{formatCurrency(cashBalance.cashBillIn)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Party payments collected</span>
                        <span className="font-mono text-emerald-700">+{formatCurrency(cashBalance.cashPartyIn)}</span>
                      </div>
                      <p className="font-semibold text-red-600 text-[10px] uppercase tracking-wide pt-1">Cash Out</p>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Purchase bill payments</span>
                        <span className="font-mono text-red-600">−{formatCurrency(cashBalance.cashPurchaseOut)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Expenses</span>
                        <span className="font-mono text-red-600">−{formatCurrency(cashBalance.cashExpenseOut)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Party payments sent</span>
                        <span className="font-mono text-red-600">−{formatCurrency(cashBalance.cashPartyOut)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Total Bank Balance */}
              <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-background dark:from-blue-950/20 dark:border-blue-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                      <Building2 className="h-4.5 w-4.5 text-blue-700 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Total Bank</p>
                      <p className={`text-xl font-bold ${totalBankBalance >= 0 ? "text-blue-700" : "text-red-700"}`}>
                        {formatCurrency(totalBankBalance)}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-2 border-t border-blue-100 dark:border-blue-900">
                    {accounts.length} bank {accounts.length === 1 ? "account" : "accounts"}
                  </p>
                </CardContent>
              </Card>

              {/* Total Balance (Cash + Bank) */}
              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-background dark:from-purple-950/20 dark:border-purple-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40">
                      <Wallet className="h-4.5 w-4.5 text-purple-700 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Total Balance</p>
                      <p className={`text-xl font-bold ${cashBalance.balance + totalBankBalance >= 0 ? "text-purple-700" : "text-red-700"}`}>
                        {formatCurrency(cashBalance.balance + totalBankBalance)}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-2 border-t border-purple-100 dark:border-purple-900">
                    Cash + All Banks
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Bank Account Cards */}
            {accounts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No bank accounts found</h3>
                  <p className="text-muted-foreground mb-4">Add your first bank account to track bank balance</p>
                  <Button onClick={() => handleOpenDialog()} variant="outline">
                    Add Account
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-0.5">
                  Bank Accounts
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {accounts.map((account) => {
                    const bal = accountBalances[account.id] ?? { credits: 0, debits: 0, balance: 0 };
                    return (
                      <Card key={account.id} className={`border transition-shadow hover:shadow-md ${account.isDefault ? "border-primary/40 bg-primary/5" : "border-border/70"}`}>
                        <CardContent className="p-4">
                          {/* Top: Bank name + balance */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${account.isDefault ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                                <Building2 className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-semibold text-sm truncate">{account.bankName}</p>
                                  {account.isDefault && (
                                    <Star className="h-3 w-3 text-primary fill-primary shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{account.accountHolder}</p>
                              </div>
                            </div>
                            {/* Balance */}
                            <div className="text-right shrink-0">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Balance</p>
                              <p className={`text-lg font-bold leading-tight ${bal.balance >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                {formatCurrency(bal.balance)}
                              </p>
                            </div>
                          </div>

                          {/* Credit / Debit row */}
                          <div className="grid grid-cols-3 gap-2 mb-3 rounded-lg bg-muted/40 p-2">
                            {(account.openingBalance ?? 0) > 0 && (
                              <div className="flex items-center gap-1.5 col-span-3 pb-1.5 mb-0.5 border-b border-border/40">
                                <Banknote className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <div>
                                  <p className="text-[10px] text-muted-foreground">Opening</p>
                                  <p className="text-xs font-semibold text-foreground">{formatCurrency(account.openingBalance!)}</p>
                                </div>
                              </div>
                            )}
                            <div className={`flex items-center gap-1.5 ${(account.openingBalance ?? 0) > 0 ? "" : "col-span-1"}`}>
                              <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <div>
                                <p className="text-[10px] text-muted-foreground">Credits</p>
                                <p className="text-xs font-semibold text-emerald-700">{formatCurrency(bal.credits)}</p>
                              </div>
                            </div>
                            <div className={`flex items-center gap-1.5 ${(account.openingBalance ?? 0) > 0 ? "" : "col-span-1"}`}>
                              <TrendingDown className="h-3.5 w-3.5 text-red-600 shrink-0" />
                              <div>
                                <p className="text-[10px] text-muted-foreground">Debits</p>
                                <p className="text-xs font-semibold text-red-700">{formatCurrency(bal.debits)}</p>
                              </div>
                            </div>
                          </div>

                          {/* Account details */}
                          <div className="space-y-1 mb-3">
                            {account.accountNumber && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Hash className="h-3 w-3 shrink-0" />
                                <span>A/c: ····{account.accountNumber.slice(-4)}</span>
                              </div>
                            )}
                            {account.branchAndIFSC && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{account.branchAndIFSC}</span>
                              </div>
                            )}
                            {account.upiId && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <QrCode className="h-3 w-3 shrink-0" />
                                <span className="truncate">{account.upiId}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-2 border-t border-border/60">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-8 text-xs gap-1.5"
                              onClick={() => setStatementAccount(account)}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Statement
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenDialog(account)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(account.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="dialog-form-content sm:max-w-[500px]">
          <form onSubmit={handleSubmit} className="dialog-form-body">
            <DialogHeader className="dialog-form-header">
              <DialogTitle>
                {editingAccount ? "Edit Bank Account" : "Add Bank Account"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName" className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" />
                    Bank Name *
                  </Label>
                  <Input
                    id="bankName"
                    required
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="e.g. HDFC Bank"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountHolder" className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    Account Holder Name *
                  </Label>
                  <Input
                    id="accountHolder"
                    required
                    value={formData.accountHolder}
                    onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountNumber" className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5" />
                    Account Number *
                  </Label>
                  <Input
                    id="accountNumber"
                    required
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branchAndIFSC" className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Branch & IFSC *
                  </Label>
                  <Input
                    id="branchAndIFSC"
                    required
                    value={formData.branchAndIFSC}
                    onChange={(e) => setFormData({ ...formData, branchAndIFSC: e.target.value })}
                    placeholder="e.g. Mumbai & HDFC0001234"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="upiId" className="flex items-center gap-2">
                  <QrCode className="h-3.5 w-3.5" />
                  UPI ID (for Scan & Pay QR)
                </Label>
                <Input
                  id="upiId"
                  value={formData.upiId}
                  onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                  placeholder="e.g. name@bank"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="openingBalance" className="flex items-center gap-2">
                  <Banknote className="h-3.5 w-3.5" />
                  Opening Balance
                </Label>
                <Input
                  id="openingBalance"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.openingBalance ?? ""}
                  onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
                <p className="text-[11px] text-muted-foreground">
                  Balance already in this account when it was added to the app. This is added to all calculated balances.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                />
                <Label htmlFor="isDefault" className="text-sm font-medium leading-none cursor-pointer">
                  Set as default account
                </Label>
              </div>
            </div>
            <DialogFooter className="dialog-form-footer">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingAccount ? "Update Account" : "Add Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {statementAccount && (
        <BankStatement
          account={statementAccount}
          isOpen={!!statementAccount}
          onClose={() => setStatementAccount(null)}
        />
      )}
    </div>
  );
}
