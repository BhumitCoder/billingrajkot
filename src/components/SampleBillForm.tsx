import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { SampleBill, BillItem, Client, Product } from "@/types";
import {
  getClients,
  getProducts,
  saveSampleBill,
  getSampleBillCounter,
  getSampleBillCounter as getSampleBillCounterActual,
  incrementSampleBillCounter,
  getCompanyProfile,
  getCreators,
  getBankAccounts,
  saveBankAccount,
} from "@/lib/storage";
import {
  calculateBillTotals,
  generateBillNumber,
  calculateDueDate,
  getPaymentStatus,
  roundToTwoDecimals,
  formatToTwoDecimals,
} from "@/lib/billUtils";
import { toast } from "sonner";
import {
  Plus,
  Save,
  Loader2,
  Check,
  ChevronsUpDown,
  ArrowLeft,
  UserPlus,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ClientForm } from "./ClientForm";
import { ProductForm } from "./ProductForm";
import { BillCreator, BankAccount } from "@/types";

interface SampleBillFormProps {
  bill?: SampleBill;
  isEdit?: boolean;
}

export function SampleBillForm({ bill, isEdit = false }: SampleBillFormProps) {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [availableCreators, setAvailableCreators] = useState<BillCreator[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientComboOpen, setClientComboOpen] = useState(false);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [productComboOpenIndex, setProductComboOpenIndex] = useState<
    number | null
  >(null);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [createProductForIndex, setCreateProductForIndex] = useState<number | null>(
    null
  );
  const [createBankOpen, setCreateBankOpen] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [bankFormData, setBankFormData] = useState<Partial<BankAccount>>({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    branchAndIFSC: "",
    upiId: "",
    isDefault: false,
  });

  const [formData, setFormData] = useState({
    date: new Date().toISOString(),
    paymentTerms: 30,
    deliveryNote: "",
    modeOfPayment: "",
    placeOfSupply: "",
    notes: "",
    paidAmount: "",
    otherCharges: "",
    discount: "",
    discountType: "amount" as "amount" | "percentage",
    createdBy: "",
    bankAccountId: "",
  });

  const [companyProfile, setCompanyProfile] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      const [clientsData, productsData, companyData, creatorsData, banksData] = await Promise.all([
        getClients(),
        getProducts(),
        getCompanyProfile(),
        getCreators(),
        getBankAccounts(),
      ]);
      setClients(clientsData);
      setProducts(productsData);
      setCompanyProfile(companyData);
      setAvailableCreators(creatorsData);
      setBankAccounts(banksData);
      setGstEnabled(false);

      if (bill && isEdit) {
        setSelectedClient(bill.client);
        setBillItems(bill.items);
        setFormData({
          date: bill.date,
          paymentTerms: bill.paymentTerms,
          deliveryNote: bill.deliveryNote || "",
          modeOfPayment: bill.modeOfPayment || "",
          placeOfSupply: bill.placeOfSupply || "",
          notes: bill.notes || "",
          paidAmount: bill.paidAmount ? String(bill.paidAmount) : "",
          otherCharges: bill.otherCharges ? String(bill.otherCharges) : "",
          discount: bill.discount ? String(bill.discount) : "",
          discountType: bill.discountType || "amount",
          createdBy: bill.createdBy || "",
          bankAccountId: bill.bankAccountId || "",
        });
      }
    };
    loadData();
  }, [bill, isEdit]);


  const openCreateBankDialog = () => {
    setBankFormData({
      bankName: "",
      accountHolder: "",
      accountNumber: "",
      branchAndIFSC: "",
      upiId: "",
      isDefault: bankAccounts.length === 0,
    });
    setCreateBankOpen(true);
  };

  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBank(true);
    try {
      const newBank: BankAccount = {
        id: Math.random().toString(36).substr(2, 9),
        bankName: (bankFormData.bankName || "").trim(),
        accountHolder: (bankFormData.accountHolder || "").trim(),
        accountNumber: (bankFormData.accountNumber || "").trim(),
        branchAndIFSC: (bankFormData.branchAndIFSC || "").trim(),
        upiId: (bankFormData.upiId || "").trim(),
        isDefault: !!bankFormData.isDefault,
      };

      if (
        !newBank.bankName ||
        !newBank.accountHolder ||
        !newBank.accountNumber ||
        !newBank.branchAndIFSC
      ) {
        toast.error("Please fill all required bank fields");
        return;
      }

      if (newBank.isDefault) {
        for (const account of bankAccounts) {
          if (account.isDefault && account.id !== newBank.id) {
            await saveBankAccount({ ...account, isDefault: false });
          }
        }
      }

      await saveBankAccount(newBank);
      const refreshedBanks = await getBankAccounts();
      setBankAccounts(refreshedBanks);
      setFormData((prev) => ({ ...prev, bankAccountId: newBank.id }));
      setCreateBankOpen(false);
      toast.success("Bank account added");
    } catch (error) {
      toast.error("Failed to save bank account");
    } finally {
      setSavingBank(false);
    }
  };

  const applyProductToBillItem = (index: number, product: Product) => {
    const updated = [...billItems];
    const item = { ...updated[index] };
    item.productId = product.id;
    item.productName = product.name;
    item.unit = product.unit;
    item.ratePerUnit = product.sellingPrice || product.price || 0;
    item.amount = roundToTwoDecimals(item.quantity * item.ratePerUnit);
    item.cgst = 0;
    item.sgst = 0;
    item.igst = 0;
    updated[index] = item;
    setBillItems(updated);
  };

  const addItem = () => {
    setBillItems([
      ...billItems,
      {
        productId: "",
        productName: "",
        quantity: 1,
        unit: "kg",
        ratePerUnit: 0,
        amount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...billItems];
    const item = updated[index];

    if (field === "productId") {
      const product = products.find((p) => p.id === value);
      if (product) {
        item.productId = product.id;
        item.productName = product.name;
        item.unit = product.unit;
        item.ratePerUnit = product.sellingPrice || product.price || 0;
      }
    } else if (field === "quantity" || field === "ratePerUnit") {
      (item as any)[field] =
        typeof value === "string" ? parseFloat(value) || 0 : value;
    } else {
      (item as any)[field] = value;
    }

    item.amount = roundToTwoDecimals(item.quantity * item.ratePerUnit);
    item.cgst = 0;
    item.sgst = 0;
    item.igst = 0;

    updated[index] = item;
    setBillItems(updated);
  };

  useEffect(() => {
    if (billItems.length > 0) {
      const updated = billItems.map((item) => {
        const newItem = { ...item };
        newItem.cgst = 0;
        newItem.sgst = 0;
        newItem.igst = 0;
        return newItem;
      });
      setBillItems(updated);
    }
  }, []);

  const handleSubmit = async () => {
    if (!selectedClient) {
      toast.error("Please select a client");
      return;
    }

    if (billItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    const invalidItems = billItems.filter(
      (item) => !item.productId || !item.productName
    );
    if (invalidItems.length > 0) {
      toast.error("Please select a product for all items");
      return;
    }

    const zeroQuantityItems = billItems.filter((item) => item.quantity <= 0);
    if (zeroQuantityItems.length > 0) {
      toast.error("All items must have quantity greater than 0");
      return;
    }

    const zeroRateItems = billItems.filter((item) => item.ratePerUnit <= 0);
    if (zeroRateItems.length > 0) {
      toast.error("All items must have a valid rate");
      return;
    }

    if (!companyProfile) {
      toast.error("Please setup company profile first");
      navigate("/settings");
      return;
    }

    setSaving(true);
    try {
      const otherChargesNum = parseFloat(formData.otherCharges || "0") || 0;
      const discountValue = formData.discount?.trim() || "";
      const discountNum =
        discountValue === "" ? 0 : parseFloat(discountValue) || 0;
      const totals = calculateBillTotals(
        billItems,
        companyProfile,
        otherChargesNum,
        discountNum,
        formData.discountType
      );
      const dueDate = calculateDueDate(formData.date, formData.paymentTerms);
      const paidAmountNum = parseFloat(formData.paidAmount || "0") || 0;
      const paymentStatus = getPaymentStatus(
        dueDate,
        paidAmountNum,
        totals.total
      );
      const selectedBankAccount =
        bankAccounts.find((a) => a.id === formData.bankAccountId) ||
        bankAccounts.find((a) => a.isDefault) ||
        bankAccounts[0];

      let billCounter = 0;
      if (!isEdit) {
        billCounter = await incrementSampleBillCounter();
      } else {
        billCounter = await getSampleBillCounter();
      }

      const newBill: SampleBill = {
        id: bill?.id || crypto.randomUUID(),
        billNumber:
          bill?.billNumber ||
          generateBillNumber(
            billCounter,
            companyProfile.name.substring(0, 6).toUpperCase(),
            "sample"
          ),
        date: formData.date,
        clientId: selectedClient.id,
        client: selectedClient,
        items: billItems,
        subtotal: totals.subtotal,
        discount: discountNum > 0 ? totals.discount : 0,
        discountType: discountNum > 0 ? formData.discountType : "amount",
        otherCharges: otherChargesNum,
        roundOff: totals.roundOff,
        total: totals.total,
        paymentTerms: formData.paymentTerms,
        dueDate,
        paymentStatus,
        paidAmount: paidAmountNum,
        deliveryNote: formData.deliveryNote,
        modeOfPayment: formData.modeOfPayment,
        placeOfSupply: formData.placeOfSupply,
        notes: formData.notes,
        createdBy: formData.createdBy || undefined,
        payments: [],
        bankAccountId: selectedBankAccount?.id || "",
        bankAccount: selectedBankAccount || undefined,
        createdAt: bill?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSample: true,
      };

      await saveSampleBill(newBill);
      toast.success(
        isEdit
          ? "Sample bill updated successfully"
          : "Sample bill created successfully"
      );
      navigate(`/sample-bills/${newBill.id}`);
    } catch (error) {
      console.error("Error saving sample bill:", error);
      toast.error("Failed to save sample bill");
    } finally {
      setSaving(false);
    }
  };

  const otherChargesNum = parseFloat(formData.otherCharges || "0") || 0;
  const discountValue = formData.discount?.trim() || "";
  const discountNum = discountValue === "" ? 0 : parseFloat(discountValue) || 0;
  const totals = calculateBillTotals(
    billItems,
    companyProfile,
    otherChargesNum,
    discountNum,
    formData.discountType
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-background p-2 shadow-sm sm:p-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/sample-bills")}
            className="h-10 w-10 shrink-0 rounded-lg bg-background"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">
              {isEdit ? "Edit Quotation Bill" : "Create Quotation Bill"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? "Update quotation details without affecting live business data"
                : "Build a quotation bill without affecting live business data"}
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-2xl border border-border/70 bg-background/60 p-2 sm:p-3">
        <div className="h-full overflow-y-auto space-y-4 pr-1 sm:pr-2">
      <Card>
        <CardHeader>
          <CardTitle>Bill Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client Combobox */}
            <div className="space-y-2">
              <Label>Client *</Label>
              <Popover open={clientComboOpen} onOpenChange={setClientComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientComboOpen}
                    className="w-full justify-between"
                  >
                    {selectedClient ? selectedClient.name : "Select client..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search client..." />
                    <CommandList>
                      <CommandEmpty>
                        <div className="py-6 text-center">
                          <p className="text-sm text-muted-foreground mb-4">No client found.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCreateClientOpen(true);
                              setClientComboOpen(false);
                            }}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Create New Client
                          </Button>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setCreateClientOpen(true);
                            setClientComboOpen(false);
                          }}
                          className="flex items-center text-primary font-medium"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add New Client
                        </CommandItem>
                        {clients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.name}
                            onSelect={() => {
                              setSelectedClient(client);
                              setClientComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedClient?.id === client.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {client.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Bill Date *</Label>
              <Input
                type="date"
                value={formData.date.split("T")[0]}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  const now = new Date();
                  newDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
                  setFormData({ ...formData, date: newDate.toISOString() });
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Terms (Days) *</Label>
              <Input
                type="number"
                value={formData.paymentTerms}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    paymentTerms: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Bank Account (Optional)</Label>
              <Select
                value={formData.bankAccountId}
                onValueChange={(value) => {
                  if (value === "__add_new_bank__") {
                    openCreateBankDialog();
                    return;
                  }
                  setFormData({ ...formData, bankAccountId: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      bankAccounts.length > 0
                        ? "Select bank account for bill"
                        : "No bank accounts added"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">
                      No bank accounts found.
                    </div>
                  ) : (
                    bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.bankName} - {account.accountNumber}{" "}
                        {account.isDefault ? "(Default)" : ""}
                      </SelectItem>
                    ))
                  )}
                  <SelectItem value="__add_new_bank__">
                    + Add New Bank Account
                  </SelectItem>
                </SelectContent>
              </Select>
              {bankAccounts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No banks configured. Use "Add New Bank Account" to create one.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Place of Supply</Label>
              <Input
                value={formData.placeOfSupply}
                onChange={(e) =>
                  setFormData({ ...formData, placeOfSupply: e.target.value })
                }
                placeholder="Gujarat"
              />
            </div>

            <div className="space-y-2">
              <Label>Delivery Note</Label>
              <Input
                value={formData.deliveryNote}
                onChange={(e) =>
                  setFormData({ ...formData, deliveryNote: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Created By</Label>
              <Select
                value={formData.createdBy}
                onValueChange={(value) =>
                  setFormData({ ...formData, createdBy: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableCreators.map((creator) => (
                    <SelectItem key={creator.id} value={creator.name}>
                      {creator.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mode of Payment</Label>
              <Input
                value={formData.modeOfPayment}
                onChange={(e) =>
                  setFormData({ ...formData, modeOfPayment: e.target.value })
                }
                placeholder="Cash/Bank Transfer"
              />
            </div>


          </div>
        </CardContent>
      </Card>

      {/* Client Creation Dialog */}
      <ClientForm
        open={createClientOpen}
        onOpenChange={setCreateClientOpen}
        onSuccess={(newClient) => {
          setSelectedClient(newClient);
          setClients((prev) => [...prev, newClient]);
          setCreateClientOpen(false);
        }}
      />

      <ProductForm
        open={createProductOpen}
        onOpenChange={setCreateProductOpen}
        onSuccess={(newProduct) => {
          setProducts((prev) => [...prev, newProduct]);
          if (createProductForIndex !== null) {
            applyProductToBillItem(createProductForIndex, newProduct);
          }
          setCreateProductOpen(false);
          setCreateProductForIndex(null);
        }}
      />
      <Dialog open={createBankOpen} onOpenChange={setCreateBankOpen}>
        <DialogContent className="dialog-form-content sm:max-w-[500px]">
          <form onSubmit={handleCreateBank} className="dialog-form-body">
            <DialogHeader className="dialog-form-header">
              <DialogTitle>Add Bank Account</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sample-bank-name">Bank Name *</Label>
                  <Input
                    id="sample-bank-name"
                    required
                    value={bankFormData.bankName || ""}
                    onChange={(e) =>
                      setBankFormData((prev) => ({ ...prev, bankName: e.target.value }))
                    }
                    placeholder="e.g. HDFC Bank"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sample-bank-holder">Account Holder Name *</Label>
                  <Input
                    id="sample-bank-holder"
                    required
                    value={bankFormData.accountHolder || ""}
                    onChange={(e) =>
                      setBankFormData((prev) => ({
                        ...prev,
                        accountHolder: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sample-bank-number">Account Number *</Label>
                  <Input
                    id="sample-bank-number"
                    required
                    value={bankFormData.accountNumber || ""}
                    onChange={(e) =>
                      setBankFormData((prev) => ({
                        ...prev,
                        accountNumber: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sample-bank-ifsc">Branch & IFSC *</Label>
                  <Input
                    id="sample-bank-ifsc"
                    required
                    value={bankFormData.branchAndIFSC || ""}
                    onChange={(e) =>
                      setBankFormData((prev) => ({
                        ...prev,
                        branchAndIFSC: e.target.value,
                      }))
                    }
                    placeholder="e.g. Mumbai & HDFC0001234"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sample-bank-upi">UPI ID (Optional)</Label>
                <Input
                  id="sample-bank-upi"
                  value={bankFormData.upiId || ""}
                  onChange={(e) =>
                    setBankFormData((prev) => ({ ...prev, upiId: e.target.value }))
                  }
                  placeholder="e.g. name@bank"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="sample-bank-default"
                  type="checkbox"
                  checked={!!bankFormData.isDefault}
                  onChange={(e) =>
                    setBankFormData((prev) => ({ ...prev, isDefault: e.target.checked }))
                  }
                />
                <Label htmlFor="sample-bank-default">Set as default account</Label>
              </div>
            </div>
            <DialogFooter className="dialog-form-footer">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateBankOpen(false)}
                disabled={savingBank}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingBank}>
                {savingBank && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Bank Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold sm:text-lg">Bill Items</CardTitle>
          <Button onClick={addItem} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {billItems.map((item, index) => {
              const selectedProductIds = billItems
                .filter((_, i) => i !== index)
                .map((bi) => bi.productId)
                .filter((id) => id);

              const availableProducts = products.filter(
                (p) =>
                  !selectedProductIds.includes(p.id) || p.id === item.productId
              );

              return (
                <Card
                  key={index}
                  className="rounded-2xl border-border/70 bg-background shadow-sm transition-shadow hover:shadow-md"
                >
                  <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Item {index + 1}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                          Sample Mode
                        </span>
                        <Button
                          variant="outline"
                          className="h-8 rounded-lg border-red-200 px-3 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => removeItem(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
                      {/* Product Combobox */}
                      <div className="space-y-2 lg:col-span-6">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Product
                        </Label>
                        <Popover
                          open={productComboOpenIndex === index}
                          onOpenChange={(open) =>
                            setProductComboOpenIndex(open ? index : null)
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={productComboOpenIndex === index}
                              className="h-11 w-full justify-between rounded-xl"
                            >
                              {item.productName || "Select product..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search product..." />
                              <CommandList>
                                <CommandEmpty>
                                  <div className="py-6 text-center">
                                    <p className="text-sm text-muted-foreground mb-4">No product found.</p>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setCreateProductForIndex(index);
                                        setCreateProductOpen(true);
                                        setProductComboOpenIndex(null);
                                      }}
                                    >
                                      <PlusCircle className="h-4 w-4 mr-2" />
                                      Create New Product
                                    </Button>
                                  </div>
                                </CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    onSelect={() => {
                                      setCreateProductForIndex(index);
                                      setCreateProductOpen(true);
                                      setProductComboOpenIndex(null);
                                    }}
                                    className="flex items-center text-primary font-medium"
                                  >
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                    Add New Product
                                  </CommandItem>
                                  {availableProducts.map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      value={product.name}
                                      onSelect={() => {
                                        updateItem(
                                          index,
                                          "productId",
                                          product.id
                                        );
                                        setProductComboOpenIndex(null);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          item.productId === product.id
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{product.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          Stock:{" "}
                                          {product.stock % 1 === 0
                                            ? product.stock
                                            : product.stock.toFixed(2)}{" "}
                                          {product.unit}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2 lg:col-span-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Quantity
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            const roundedValue = Math.round(value * 100) / 100;
                            updateItem(index, "quantity", roundedValue);
                          }}
                          className="h-11 rounded-xl"
                        />
                        <p className="text-xs font-medium text-blue-600">
                          No stock validation (sample bill)
                        </p>
                      </div>

                      <div className="space-y-2 lg:col-span-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Rate
                        </Label>
                        <Input
                          type="number"
                          value={item.ratePerUnit}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "ratePerUnit",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="h-11 rounded-xl"
                        />
                      </div>

                        <div className="space-y-2 lg:col-span-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Tax %
                          </Label>
                          <Input
                            type="number"
                            value={item.gstRate}
                            onChange={(e) =>
                              updateItem(
                                index,
                                "gstRate",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-11 rounded-xl"
                          />
                        </div>

                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground sm:px-4">
                      <span className="font-semibold text-foreground">
                        Amount: Rs. {formatToTwoDecimals(item.amount)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="space-y-2">
            <Label>Discount</Label>
            <div className="flex gap-2">
              <Select
                value={formData.discountType}
                onValueChange={(value: "amount" | "percentage") =>
                  setFormData({ ...formData, discountType: value })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Amount (₹)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.discount}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, discount: value });
                }}
                placeholder="0.00"
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Other Charges (Freight, Packaging, etc.)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.otherCharges}
              onChange={(e) =>
                setFormData({ ...formData, otherCharges: e.target.value })
              }
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>Paid Amount</Label>
            <Input
              type="number"
              value={formData.paidAmount}
              onChange={(e) =>
                setFormData({ ...formData, paidAmount: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 text-right">
            <div className="flex justify-between text-lg">
              <span>Subtotal:</span>
              <span>₹{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span>Total Tax:</span>
            </div>
            {discountNum > 0 && totals.discount > 0 && (
              <div className="flex justify-between text-lg text-red-600">
                <span>
                  Discount{" "}
                  {formData.discountType === "percentage"
                    ? `(${formData.discount}%)`
                    : ""}
                  :
                </span>
                <span>-₹{formatToTwoDecimals(totals.discount)}</span>
              </div>
            )}
            {(parseFloat(String(formData.otherCharges)) || 0) > 0 && (
              <div className="flex justify-between text-lg">
                <span>Other Charges:</span>
                <span>
                  ₹{formatToTwoDecimals(parseFloat(String(formData.otherCharges)) || 0)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold border-t pt-2">
              <span>Total:</span>
              <span>₹{formatToTwoDecimals(totals.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button
          onClick={handleSubmit}
          size="lg"
          className="flex-1"
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {isEdit ? "Updating..." : "Creating..."}
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              {isEdit ? "Update Sample Bill" : "Create Sample Bill"}
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => navigate("/sample-bills")}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
        </div>
      </div>
    </div>
  );
}
