import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  getExpenses,
  saveExpense,
  deleteExpense,
  getBankAccounts,
} from "@/lib/storage";
import { getCompanyProfile } from "@/lib/storage";
import { Expense, CompanyProfile, BankAccount } from "@/types";

import {
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Loader2,
  Calendar,
  Tag,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/billUtils";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";
import { dummyExpenses } from "@/lib/dummyData";

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [loading, setLoading] = useState(true);

  const [isOpen, setIsOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(
    null,
  );

  const { locked, reloadKey } = useEncryptionLock();

  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString(),
    time: getCurrentTime(),
    amount: 0,
    description: "",
    category: "",
    paymentMethod: "Cash" as "Cash" | "Bank",
    bankAccountId: "",
  });

  // Load expenses and company profile on mount
  useEffect(() => {
    loadData();
  }, [locked, reloadKey]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "KeyA") { e.preventDefault(); setIsOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const loadData = async () => {
    if (locked) { setExpenses(dummyExpenses); setLoading(false); return; }
    setLoading(true);
    try {
      const [expensesData, profile, banks] = await Promise.all([
        getExpenses(),
        getCompanyProfile(),
        getBankAccounts(),
      ]);
      setExpenses(expensesData); // Already sorted by createdAt desc from Firestore
      setCompanyProfile(profile);
      setBankAccounts(banks);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) { toast.error("Unable to save. Check your connection."); return; }

    if (!formData.category || !formData.description || !formData.amount || isNaN(formData.amount) || formData.amount <= 0) {
      toast.error("Please fill all required fields correctly");
      return;
    }

    if (formData.paymentMethod === "Bank" && !formData.bankAccountId) {
      toast.error("Please select a bank account");
      return;
    }

    setSaving(true);
    try {
      const expense: Expense = {
        id: editingExpense?.id || crypto.randomUUID(),
        date: formData.date,
        time: formData.time,
        amount: formData.amount,
        description: formData.description,
        category: formData.category,
        paymentMethod: formData.paymentMethod,
        bankAccountId:
          formData.paymentMethod === "Bank"
            ? formData.bankAccountId
            : undefined,
        sourceType: editingExpense?.sourceType,
        createdAt: editingExpense?.createdAt || new Date().toISOString(),
      };

      await saveExpense(expense);
      await loadData();

      setIsOpen(false);
      setEditingExpense(null);
      resetForm();

      toast.success(
        editingExpense
          ? "Expense updated successfully"
          : "Expense added successfully",
      );
    } catch (error) {
      console.error("Error saving expense:", error);
      toast.error("Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      date: expense.date,
      time: expense.time,
      amount: expense.amount,
      description: expense.description,
      category: expense.category,
      paymentMethod: expense.paymentMethod || "Cash",
      bankAccountId: expense.bankAccountId || "",
    });
    setIsOpen(true);
  };

  const handleDelete = async (expenseId: string) => {
    if (locked) { toast.error("Unable to save. Check your connection."); return; }
    try {
      await deleteExpense(expenseId);
      await loadData();
      toast.success("Expense deleted successfully");
    } catch (error) {
      toast.error("Failed to delete expense");
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString(),
      time: getCurrentTime(),
      amount: 0,
      description: "",
      category: "",
      paymentMethod: "Cash",
      bankAccountId: "",
    });
  };

  // Calculations — show all expenses including auto-generated ones from purchase bills
  const visibleExpenses = expenses;

  const totalExpenses = visibleExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const thisMonthExpenses = visibleExpenses
    .filter((e) => {
      const expDate = new Date(e.date);
      const now = new Date();
      return (
        expDate.getMonth() === now.getMonth() &&
        expDate.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const expensesByCategory = visibleExpenses.reduce(
    (acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    },
    {} as Record<string, number>,
  );

  const availableCategories = companyProfile?.expenseCategories || [
    "Marketing",
    "Utilities",
    "Rent",
    "Office Supplies",
    "Transportation",
    "Communication",
    "Insurance",
    "Taxes",
    "Maintenance",
    "Miscellaneous",
  ];

  const filteredExpenses = visibleExpenses.filter((expense) => {
    const normalizedDate = expense.date.split("T")[0];
    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      !search ||
      expense.description.toLowerCase().includes(search) ||
      expense.category.toLowerCase().includes(search) ||
      (expense.paymentMethod || "Cash").toLowerCase().includes(search);

    const matchesStartDate =
      !filterStartDate || normalizedDate >= filterStartDate;
    const matchesEndDate = !filterEndDate || normalizedDate <= filterEndDate;

    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  const paginatedExpenses = filteredExpenses.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const totalPages = Math.ceil(filteredExpenses.length / pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterStartDate, filterEndDate]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStartDate("");
    setFilterEndDate("");
  };

  const hasActiveFilters =
    searchTerm.trim().length > 0 || !!filterStartDate || !!filterEndDate;

  if (loading) {
    return (
      <div className="min-h-screen">
        <LoadingSpinner
          size="xl"
          text="Loading expenses..."
          fullScreen
          contentAreaOnly
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
        {/* ================= HEADER ================= */}
        <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-slate-50/40 p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
                <DollarSign className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">
                  Expenses
                </h1>
                <p className="text-sm text-muted-foreground">
                  Track and manage your business expenses
                </p>
              </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 rounded-xl border border-border/70 bg-muted/30 p-2 lg:w-auto">
              <Dialog
                open={isOpen}
                onOpenChange={(open) => {
                  setIsOpen(open);
                  if (!open) {
                    setEditingExpense(null);
                    resetForm();
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="h-10 rounded-xl px-3 text-sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Expense
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingExpense ? "Edit Expense" : "Add New Expense"}
                    </DialogTitle>
                  </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date.split("T")[0]}
                        onChange={(e) => {
                          const _n = new Date();
                          const [_y, _m, _d] = e.target.value.split("-").map(Number);
                          const iso = new Date(_y, _m - 1, _d, _n.getHours(), _n.getMinutes(), _n.getSeconds(), _n.getMilliseconds()).toISOString();
                          setFormData({ ...formData, date: iso });
                        }}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Time</Label>
                      <Input
                        id="time"
                        type="time"
                        value={formData.time}
                        onChange={(e) =>
                          setFormData({ ...formData, time: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          className="pl-9"
                          placeholder="0.00"
                          value={formData.amount || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setFormData({
                              ...formData,
                              amount: isNaN(val) ? 0 : val,
                            });
                          }}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) =>
                          setFormData({ ...formData, category: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      placeholder="What was this expense for?"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Payment Method</Label>
                      <Select
                        value={formData.paymentMethod}
                        onValueChange={(value: "Cash" | "Bank") =>
                          setFormData({ ...formData, paymentMethod: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Bank">Bank Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.paymentMethod === "Bank" && (
                      <div className="space-y-2">
                        <Label htmlFor="bankAccount">Bank Account</Label>
                        <Select
                          value={formData.bankAccountId}
                          onValueChange={(value) =>
                            setFormData({ ...formData, bankAccountId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {bankAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.bankName} - {account.accountNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : editingExpense ? (
                        "Update Expense"
                      ) : (
                        "Add Expense"
                      )}
                    </Button>
                  </div>
                </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2 sm:p-4">
          <div className="h-full overflow-y-auto space-y-5 pr-1 sm:pr-2">
            {/* ================= PREMIUM SUMMARY TILES ================= */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* TOTAL EXPENSES */}
              <Card className="border-rose-200 bg-gradient-to-br from-rose-500/10 to-rose-600/5 dark:border-rose-800">
                <CardContent className="flex h-full min-h-[124px] flex-col justify-between p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10">
                      <DollarSign className="h-5 w-5 text-rose-600" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold leading-none text-rose-600">
                      {formatCurrency(totalExpenses)}
                    </p>
                    <p className="text-xs text-muted-foreground">{visibleExpenses.length} recorded transactions</p>
                    <p className="text-[10px] text-muted-foreground/70">Includes purchase bill auto-charges. Dashboard excludes these from overhead total.</p>
                  </div>
                </CardContent>
              </Card>

              {/* THIS MONTH */}
              <Card className="border-blue-200 bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:border-blue-800">
                <CardContent className="flex h-full min-h-[124px] flex-col justify-between p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-muted-foreground">This Month</p>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold leading-none text-blue-600">
                      {formatCurrency(thisMonthExpenses)}
                    </p>
                    <p className="text-xs text-muted-foreground">Current month spending</p>
                  </div>
                </CardContent>
              </Card>

              {/* CATEGORY COUNT */}
              <Card className="border-purple-200 bg-gradient-to-br from-purple-500/10 to-purple-600/5 dark:border-purple-800">
                <CardContent className="flex h-full min-h-[124px] flex-col justify-between p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-muted-foreground">Categories Used</p>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
                      <Tag className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold leading-none text-purple-600">
                      {Object.keys(expensesByCategory).length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Out of {availableCategories.length} available
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ================= EXPENSE LIST ================= */}
            <Card>
              <CardHeader>
                <CardTitle>Expense Records</CardTitle>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="relative md:col-span-2 mt-4">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by description, category, payment..."
                      className="pl-9"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="mt-4"
                  />
                  <Input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="mt-4"
                  />
                </div>
              
              </CardHeader>

              <CardContent>
                {paginatedExpenses.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="h-16 w-16 mx-auto mb-4 opacity-40" />
                    <p className="text-lg">
                      {hasActiveFilters
                        ? "No expenses match your filters"
                        : "No expenses recorded yet"}
                    </p>
                    <p className="text-sm mt-2">
                      {hasActiveFilters
                        ? "Try changing search text or date range"
                        : 'Click "Add Expense" to record your first expense'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paginatedExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="group flex items-center justify-between p-5 border border-border/60 rounded-xl bg-background hover:shadow-md hover:border-primary/40 transition-all duration-200"
                      >
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-medium text-foreground text-base">
                              {expense.description}
                            </span>

                            <span className="px-3 py-1 text-xs font-medium rounded-full bg-gradient-to-r from-primary/15 to-primary/5 text-primary border border-primary/20">
                              {expense.category}
                            </span>

                            <span
                              className={`px-3 py-1 text-xs font-medium rounded-full ${
                                expense.paymentMethod === "Bank"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {expense.paymentMethod || "Cash"}
                            </span>

                            {expense.sourceType === "purchase_bill_auto" && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                Auto · Purchase Bill
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-muted-foreground">
                            {formatDate(expense.date)} at {expense.time}
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <span className="font-semibold text-xl tracking-tight text-rose-600">
                            {formatCurrency(expense.amount)}
                          </span>

                          {expense.sourceType === "purchase_bill_auto" ? (
                            <span className="text-xs text-muted-foreground italic w-[72px] text-center">
                              Managed by bill
                            </span>
                          ) : (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(expense)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>

                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Expense
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this
                                    expense?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>

                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(expense.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-4 mt-8">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>

                    <span className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>

                    <Button
                      variant="outline"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
}
