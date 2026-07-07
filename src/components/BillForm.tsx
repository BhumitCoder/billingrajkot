import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Switch } from "./ui/switch";
import { BankAccount, Bill, BillItem, Client, CompanyProfile, InventoryUnit, Product } from "@/types";
import { getCurrentUser } from "@/pages/Auth";
import {
  getBills,
  getClients,
  getProducts,
  saveBill,
  getBillCounter,
  incrementBillCounter,
  getCompanyProfile,
  validateBillStock,
  getInventoryUnits,
  getBankAccounts,
} from "@/lib/storage";
import {
  calculateBillTotals,
  generateBillNumber,
  calculateDueDate,
  getPaymentStatus,
  roundToTwoDecimals,
  formatCurrency,
} from "@/lib/billUtils";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ChevronDown,
  UserPlus,
  Check,
  Smartphone,
  ChevronsUpDown,
  ScanBarcode,
  Wrench,
  AlertTriangle,
  ImagePlus,
  X,
} from "lucide-react";
import { cn, generateId } from "@/lib/utils";
import { compressFile } from "@/lib/imageCompression";
import { uploadBillCustomerImage } from "@/lib/firebaseService";
import { ClientForm } from "./ClientForm";
import { BarcodeScannerDialog } from "./BarcodeScannerDialog";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";
import { dummyClients, dummyProducts, dummyBankAccounts, dummyCompanyProfile } from "@/lib/dummyData";

interface BillFormProps {
  bill?: Bill;
  isEdit?: boolean;
}

function normalizeImei(imei: string): string {
  return imei.replace(/\s+/g, "").trim();
}

function getCurrentSellingRate(
  product?: Product | null,
  inventoryUnit?: InventoryUnit | null,
): number {
  if (inventoryUnit && Number(inventoryUnit.sellingPrice || 0) > 0) {
    return Number(inventoryUnit.sellingPrice || 0);
  }
  if (product && Number(product.sellingPrice || 0) > 0) {
    return Number(product.sellingPrice || 0);
  }
  return 0;
}

// Sub-component for each item row (avoids hooks-in-loop violation)
function BillItemRow({
  item,
  index,
  products,
  inventoryUnits,
  availableUnits,
  onUpdate,
  onRemove,
  onSelectProduct,
  onSelectInventoryUnit,
  isLast,
  onAddItem,
}: {
  item: BillItem;
  index: number;
  products: Product[];
  inventoryUnits: InventoryUnit[];
  availableUnits: InventoryUnit[];
  onUpdate: (index: number, updates: Partial<BillItem>) => void;
  onRemove: (index: number) => void;
  onSelectProduct: (index: number, product: Product) => void;
  onSelectInventoryUnit: (index: number, unit: InventoryUnit) => void;
  isLast?: boolean;
  onAddItem?: () => void;
}) {
  const [productOpen, setProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const product = products.find((p) => p.id === item.productId);
  const isSerialized = product?.trackingType === "serialized";
  const selectedUnit = inventoryUnits.find((u) => u.id === item.inventoryUnitId);
  const searchText = productSearch.toLowerCase().trim();
  const normalizedSearch = normalizeImei(productSearch).toLowerCase();
  const filteredProducts = products.filter((p) => {
    if (!searchText) return true;
    const searchable = [
      p.name,
      p.model || "",
      p.storage || "",
      p.color || "",
      p.itemNo || "",
      p.barcode || "",
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(searchText);
  });
  const filteredImeiUnits = normalizedSearch
    ? inventoryUnits.filter((u) =>
        normalizeImei(u.imeiNumber).toLowerCase().includes(normalizedSearch) ||
        (u.serialNumber && u.serialNumber.toLowerCase().includes(normalizedSearch)),
      )
    : [];

  return (
    <div className="border rounded-lg p-2 space-y-1.5 bg-card">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-xs">
          Item {index + 1}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Product selection */}
      <div className="space-y-1">
        <Label className="text-xs">Product *</Label>
        <Popover open={productOpen} onOpenChange={setProductOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between text-xs h-8"
            >
              {item.productName ? (
                <span className="truncate">{item.productName}</span>
              ) : (
                <span className="text-muted-foreground">Select product...</span>
              )}
              <ChevronDown className="size-3.5 opacity-50 shrink-0 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search product or IMEI..."
                value={productSearch}
                onValueChange={setProductSearch}
              />
              <CommandList>
                <CommandEmpty>No products found</CommandEmpty>
                {filteredImeiUnits.length > 0 && (
                  <CommandGroup heading="Matching IMEI / SN">
                    {filteredImeiUnits.map((u) => (
                      <CommandItem
                        key={`imei-${u.id}`}
                        value={`${u.serialNumber || ""} ${u.imeiNumber} ${u.productName}`}
                        onSelect={() => {
                          onSelectInventoryUnit(index, u);
                          setProductOpen(false);
                          setProductSearch("");
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <Smartphone className="size-3 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs truncate">
                              {u.serialNumber ? `SN: ${u.serialNumber}` : ""}
                              {u.serialNumber && u.imeiNumber && u.imeiNumber !== u.serialNumber ? " | " : ""}
                              {u.imeiNumber && u.imeiNumber !== u.serialNumber ? `IMEI 1: ${u.imeiNumber}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {u.productName}
                              {u.model ? ` | ${u.model}` : ""}
                              {u.storage ? ` ${u.storage}` : ""}
                              {u.color ? ` ${u.color}` : ""}
                            </p>
                          </div>
                          {u.repairCost ? (
                            <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 border border-amber-200">
                              <Wrench className="h-2.5 w-2.5" />
                              {formatCurrency(u.repairCost)}
                            </span>
                          ) : null}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                <CommandGroup>
                  {filteredProducts.map((p) => (
                    <CommandItem
                      key={p.id}
                      onSelect={() => {
                        onSelectProduct(index, p);
                        setProductOpen(false);
                        setProductSearch("");
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {p.trackingType === "serialized" && (
                          <Smartphone className="size-3 text-primary shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{p.name}</p>
                          {p.model && (
                            <p className="text-xs text-muted-foreground">{p.model}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {p.stock}
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* IMEI for serialized */}
      {isSerialized && (
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Smartphone className="size-3" /> IMEI Number *
          </Label>
          {availableUnits.length > 0 ? (
            <Select
              value={item.imeiNumber || ""}
              onValueChange={(val) => {
                const unit = availableUnits.find((u) => u.imeiNumber === val);
                const selectedProduct = products.find((p) => p.id === item.productId);
                onUpdate(index, {
                  imeiNumber: val,
                  inventoryUnitId: unit?.id,
                  model: unit?.model || item.model,
                  storage: unit?.storage || item.storage,
                  color: unit?.color || item.color,
                  ratePerUnit: getCurrentSellingRate(selectedProduct, unit),
                });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select IMEI" />
              </SelectTrigger>
              <SelectContent>
                {availableUnits.map((u) => (
                  <SelectItem key={u.id} value={u.imeiNumber}>
                    <span className="font-mono text-xs">
                      {u.imeiNumber}
                    </span>
                    {u.model && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {u.model} {u.storage} {u.color}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="Enter IMEI manually"
              value={item.imeiNumber || ""}
              onChange={(e) => onUpdate(index, { imeiNumber: e.target.value })}
              className="font-mono text-xs h-8"
            />
          )}
        </div>
      )}

      {/* Repair cost reminder — shown when selected unit has a repair cost */}
      {selectedUnit?.repairCost ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <Wrench className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            <span className="font-semibold">Repair paid: {formatCurrency(selectedUnit.repairCost)}</span>
            {selectedUnit.purchasePrice ? (
              <span className="text-amber-700"> — Effective cost: {formatCurrency((selectedUnit.purchasePrice || 0) + selectedUnit.repairCost)}</span>
            ) : null}
          </span>
        </div>
      ) : null}

      {/* Qty, Rate, Amount */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Qty</Label>
          <Input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => onUpdate(index, { quantity: parseInt(e.target.value) || 1 })}
            className="h-8 text-xs"
            readOnly={isSerialized}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rate (₹)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={item.ratePerUnit || ""}
            onChange={(e) =>
              onUpdate(index, { ratePerUnit: parseFloat(e.target.value) || 0 })
            }
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && isLast) {
                e.preventDefault();
                onAddItem?.();
              }
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Amount</Label>
          <div className="h-8 flex items-center px-2 border rounded-md bg-muted text-xs font-medium">
            ₹{item.amount.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Loss warning — shown when selling below effective cost */}
      {(() => {
        const effectiveCost =
          (selectedUnit?.purchasePrice || item.purchasePrice || 0) +
          (selectedUnit?.repairCost || 0);
        const rate = item.ratePerUnit;
        if (effectiveCost > 0 && rate > 0 && rate < effectiveCost) {
          const loss = effectiveCost - rate;
          return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
              <span>
                <span className="font-semibold">Loss alert:</span>
                {" "}selling at {formatCurrency(rate)} — you lose{" "}
                <span className="font-bold">{formatCurrency(loss)}</span> on this device
                {selectedUnit?.repairCost ? " (includes repair cost)" : ""}
              </span>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}

export function BillForm({ bill, isEdit = false }: BillFormProps) {
  const navigate = useNavigate();
  const { locked } = useEncryptionLock();

  // Guard: prevent editing fully-paid bills
  useEffect(() => {
    if (bill && isEdit && bill.paymentStatus === "paid") {
      toast.error("Fully paid bills cannot be edited");
      navigate(`/bills/${bill.id}`);
    }
  }, [bill, isEdit, navigate]);

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<InventoryUnit[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientComboOpen, setClientComboOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [createClientOpen, setCreateClientOpen] = useState(false);

  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [originalBillItems, setOriginalBillItems] = useState<BillItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [billNumber, setBillNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [courierCharges, setCourierCharges] = useState("");
  const [paymentType, setPaymentType] = useState<string>("Cash");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [collectedAmount, setCollectedAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState<"amount" | "percentage">("amount");
  const [notes, setNotes] = useState("");
  const [isGst, setIsGst] = useState(false);
  const [gstRate, setGstRate] = useState(18);
  const [customerImages, setCustomerImages] = useState<[string, string]>(["", ""]);
  const [imageUploading, setImageUploading] = useState<[boolean, boolean]>([false, false]);

  const [scannerOpen, setScannerOpen] = useState(false);

  const selectedProductIdsKey = billItems.map((item) => item.productId || "").join("|");

  useEffect(() => {
    if (locked) {
      // Show plausible dummy data instead of blank/undecryptable data — keeps the
      // encrypted state invisible to anyone looking at the screen.
      setClients(dummyClients);
      setProducts(dummyProducts);
      setCompanyProfile(dummyCompanyProfile);
      setInventoryUnits([]);
      setBankAccounts(dummyBankAccounts);
      if (!isEdit) {
        setBillNumber(generateBillNumber(1, "AM"));
        setBillItems([{ productId: "", productName: "", quantity: 1, unit: "pcs", ratePerUnit: 0, amount: 0 }]);
      }
      return;
    }
    const loadData = async () => {
      const [clientsData, productsData, companyData, unitsData, banksData] = await Promise.all([
        getClients(),
        getProducts(),
        getCompanyProfile(),
        getInventoryUnits(),
        getBankAccounts(),
      ]);
      setClients(clientsData);
      setProducts(productsData);
      setCompanyProfile(companyData);
      setInventoryUnits(unitsData);
      setBankAccounts(banksData);

      if (bill && isEdit) {
        setSelectedClient(bill.client);
        setBillItems(bill.items.map((item) => ({ ...item })));
        setOriginalBillItems(JSON.parse(JSON.stringify(bill.items)));
        setBillNumber(bill.billNumber);
        setDate(bill.date.split("T")[0]);
        setDescription(bill.notes || "");
        setShowDescription(!!bill.notes);
        setCourierCharges(bill.courierCharges ? String(bill.courierCharges) : "");
        setPaymentType(bill.paymentType || "Cash");
        setSelectedBankAccountId(bill.bankAccountId || "");
        setCollectedAmount("");
        setDiscount(bill.discount ? String(bill.discount) : "");
        setDiscountType(bill.discountType || "amount");
        setNotes(bill.notes || "");
        setIsGst(bill.isGst || false);
        setGstRate(bill.gstRate || 18);
        setCustomerImages([
          bill.customerImages?.[0] || "",
          bill.customerImages?.[1] || "",
        ]);
      } else {
        // Auto-generate bill number preview
        const counter = await getBillCounter("bills");
        setBillNumber(
          generateBillNumber(
            counter + 1,
            (companyData?.name || "INV").substring(0, 6).toUpperCase(),
          ),
        );
        // Default first item row for new bills
        setBillItems([{ productId: "", productName: "", quantity: 1, unit: "pcs", ratePerUnit: 0, amount: 0 }]);
      }
    };
    loadData();
  }, [bill, isEdit, locked]);

  // Real-time invoice number preview when GST toggle changes (new bills only)
  useEffect(() => {
    if (isEdit || locked) return;
    const regen = async () => {
      const counterType = isGst ? "gst-bills" : "bills";
      const counter = await getBillCounter(counterType);
      const companyData = await getCompanyProfile();
      setBillNumber(
        generateBillNumber(
          counter + 1,
          (companyData?.name || "INV").substring(0, 6).toUpperCase(),
          isGst ? "gst" : undefined,
        ),
      );
    };
    regen();
  }, [isGst, isEdit, locked]);

  useEffect(() => {
    if (isEdit) return;
    setBillItems((prev) => {
      let changed = false;
      const synced = prev.map((item) => {
        if (!item.productId) return item;
        const product = products.find((p) => p.id === item.productId);
        const inventoryUnit =
          inventoryUnits.find((u) => u.id === item.inventoryUnitId) ||
          inventoryUnits.find(
            (u) =>
              item.imeiNumber &&
              normalizeImei(u.imeiNumber) === normalizeImei(item.imeiNumber),
          ) ||
          null;
        const sellingRate = getCurrentSellingRate(product, inventoryUnit);
        // Keep user-entered rate intact; only fill rate when it's empty/zero.
        if (sellingRate <= 0 || item.ratePerUnit > 0 || item.ratePerUnit === sellingRate) {
          return item;
        }
        changed = true;
        return {
          ...item,
          ratePerUnit: sellingRate,
          amount: roundToTwoDecimals((item.quantity || 0) * sellingRate),
        };
      });
      return changed ? synced : prev;
    });
  }, [products, inventoryUnits, selectedProductIdsKey, isEdit]);

  // Filtered clients by search
  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.phone || "").includes(clientSearch),
  );

  // Get available (in_stock) inventory units for a product.
  // currentUnitId: always include the unit already selected by THIS item,
  // so Radix Select can display the current value correctly.
  const getAvailableUnits = (productId: string, currentUnitId?: string) =>
    inventoryUnits.filter(
      (u) =>
        u.productId === productId &&
        u.status === "in_stock" &&
        (u.id === currentUnitId ||
          !billItems.some((bi) => bi.inventoryUnitId === u.id)),
    );

  const handleScannerAdd = (unit: InventoryUnit, product: Product) => {
    const rate = (unit.sellingPrice && unit.sellingPrice > 0) ? unit.sellingPrice : (product.sellingPrice || 0);
    setBillItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        unit: product.unit || "pcs",
        ratePerUnit: rate,
        amount: rate,
        quantity: 1,
        inventoryUnitId: unit.id,
        imeiNumber: unit.imeiNumber,
        serialNumber: unit.serialNumber || "",
        itemNo: unit.itemNo || product.itemNo || "",
        model: unit.model || product.model || "",
        storage: unit.storage || product.storage || "",
        color: unit.color || product.color || "",
        batteryHealth: unit.batteryHealth || undefined,
        warranty: unit.warranty || undefined,
      },
    ]);
    toast.success(`Added: ${[unit.model || product.name, unit.storage, unit.color].filter(Boolean).join(" | ")}`);
  };

  const addItem = () => {
    setBillItems((prev) => [
      ...prev,
      {
        productId: "",
        productName: "",
        quantity: 1,
        unit: "pcs",
        ratePerUnit: 0,
        amount: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setBillItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, updates: Partial<BillItem>) => {
    setBillItems((prev) => {
      const newItems = [...prev];
      const item = { ...newItems[index], ...updates };

      // Recalculate amounts
      item.amount = roundToTwoDecimals(item.quantity * item.ratePerUnit);

      newItems[index] = item;
      return newItems;
    });
  };

  const selectProduct = (index: number, product: Product) => {
    const unit = getAvailableUnits(product.id);
    const isSerialized = product.trackingType === "serialized";
    const defaultRate = getCurrentSellingRate(
      product,
      isSerialized && unit.length === 1 ? unit[0] : null,
    );
    updateItem(index, {
      productId: product.id,
      productName: product.name,
      unit: product.unit || "pcs",
      ratePerUnit: defaultRate,
      amount: defaultRate,
      quantity: 1,
      imeiNumber: isSerialized && unit.length === 1 ? unit[0].imeiNumber : "",
      inventoryUnitId: isSerialized && unit.length === 1 ? unit[0].id : undefined,
    });
  };

  const selectInventoryUnit = (index: number, inventoryUnit: InventoryUnit) => {
    const product = products.find((p) => p.id === inventoryUnit.productId);
    if (!product) {
      toast.error("Product not found for selected IMEI");
      return;
    }

    const duplicateRow = billItems.findIndex(
      (billItem, billItemIndex) =>
        billItemIndex !== index && billItem.inventoryUnitId === inventoryUnit.id,
    );
    if (duplicateRow !== -1) {
      toast.error(`IMEI already selected in item ${duplicateRow + 1}`);
      return;
    }

    const rate = getCurrentSellingRate(product, inventoryUnit);
    updateItem(index, {
      productId: product.id,
      productName: product.name,
      unit: product.unit || "pcs",
      ratePerUnit: rate,
      amount: rate,
      quantity: 1,
      inventoryUnitId: inventoryUnit.id,
      imeiNumber: inventoryUnit.imeiNumber,
      serialNumber: inventoryUnit.serialNumber || "",
      itemNo: inventoryUnit.itemNo || product.itemNo || "",
      model: inventoryUnit.model || product.model || "",
      storage: inventoryUnit.storage || product.storage || "",
      color: inventoryUnit.color || product.color || "",
    });
  };

  // Totals calculation
  const courierNum = parseFloat(courierCharges || "0") || 0;
  const discountNum = parseFloat(discount || "0") || 0;
  const collectedAmountNum = parseFloat(collectedAmount || "0") || 0;

  const totals = calculateBillTotals(
    billItems,
    companyProfile,
    courierNum,
    discountNum,
    discountType,
    isGst,
    gstRate,
  );
  const balanceAmount = roundToTwoDecimals(totals.total - collectedAmountNum);
  const commissionIncluded = roundToTwoDecimals(
    billItems.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      const cost = item.purchasePrice ?? product?.purchasePrice ?? 0;
      const lineCommission = (item.ratePerUnit - cost) * item.quantity;
      return sum + Math.max(0, lineCommission);
    }, 0),
  );

  const getOriginalQuantity = (productId: string) =>
    originalBillItems
      .filter((i) => i.productId === productId)
      .reduce((sum, i) => sum + i.quantity, 0);

  const handleSubmit = async () => {
    if (locked) { toast.error("Unable to save. Check your connection."); return; }
    if (!selectedClient) {
      toast.error("Please select a client");
      return;
    }
    if (billItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }
    const invalidItems = billItems.filter((i) => !i.productId || !i.productName);
    if (invalidItems.length > 0) {
      toast.error("Please select a product for all items");
      return;
    }
    const zeroQty = billItems.filter((i) => i.quantity <= 0);
    if (zeroQty.length > 0) {
      toast.error("All items must have quantity > 0");
      return;
    }
    const zeroRate = billItems.filter((i) => i.ratePerUnit <= 0);
    if (zeroRate.length > 0) {
      toast.error("All items must have a valid rate");
      return;
    }
    if (collectedAmountNum < 0) {
      toast.error("Collected amount cannot be negative");
      return;
    }

    // IMEI duplicate check
    const imeiList = billItems
      .map((i) => normalizeImei(i.imeiNumber || ""))
      .filter(Boolean);
    const dupImei = imeiList.find((imei, idx) => imeiList.indexOf(imei) !== idx);
    if (dupImei) {
      toast.error(`Duplicate IMEI: ${dupImei}`);
      return;
    }

    if (!companyProfile) {
      toast.error("Please setup company profile in Settings first");
      navigate("/settings");
      return;
    }

    // Credit limit warning only (do not block bill creation).
    if (!isEdit && (selectedClient.creditLimit || 0) > 0) {
      try {
        const allSales = await getBills();

        const salesOutstanding = allSales
          .filter((b) => b.clientId === selectedClient.id)
          .reduce((sum, b) => {
            const totalReturns = (b.returns || []).reduce(
              (rs, r) => rs + (r.totalReturnValue || 0),
              0,
            );
            const netTotal = Math.max(0, (b.total || 0) - totalReturns);
            return sum + Math.max(0, netTotal - (b.paidAmount || 0));
          }, 0);

        const newSaleOutstanding = Math.max(0, totals.total - collectedAmountNum);
        const creditLimit = selectedClient.creditLimit || 0;
        const creditUsedBefore = Math.max(0, salesOutstanding);
        const creditAvailable = Math.max(0, creditLimit - creditUsedBefore);
        const projectedCreditUsed = creditUsedBefore + newSaleOutstanding;

        if (projectedCreditUsed > creditLimit) {
          toast.warning(
            `Credit limit warning. Limit: ${creditLimit.toFixed(2)}, Available: ${creditAvailable.toFixed(2)}, This bill adds: ${newSaleOutstanding.toFixed(2)}`,
          );
        }
      } catch {
        toast.warning("Could not verify party credit limit. Bill will still be created.");
      }
    }

    setSaving(true);
    try {
      // Stock validation
      const stockItems = isEdit
        ? billItems
          .map((item) => ({
            productId: item.productId,
            quantity: Math.max(0, item.quantity - getOriginalQuantity(item.productId)),
          }))
          .filter((i) => i.quantity > 0)
        : billItems.map((i) => ({ productId: i.productId, quantity: i.quantity }));

      if (stockItems.length > 0) {
        const validation = await validateBillStock(stockItems);
        if (!validation.valid) {
          toast.error(`Insufficient stock: ${validation.errors.join(", ")}`);
          setSaving(false);
          return;
        }
      }

      const typeForCounter = isGst ? "gst-bills" : "bills";
      const counterVal = isEdit
        ? await getBillCounter(typeForCounter)
        : await incrementBillCounter(typeForCounter);

      const user = getCurrentUser();
      const creator = user.role === "admin" ? "Admin" : user.name || "Unknown";

      const finalBillNumber =
        bill?.billNumber ||
        generateBillNumber(
          counterVal,
          companyProfile.name.substring(0, 6).toUpperCase(),
          isGst ? "gst" : undefined,
        );

      const _now = new Date();
      const [_y, _m, _d] = date.split("-").map(Number);
      // On edit: if the user did not change the date, preserve the original timestamp
      // so we don't alter the exact time recorded. If the date was changed, use the new date.
      const originalDateStr = bill?.date ? bill.date.split("T")[0] : null;
      const billDate = isEdit && bill?.date && date === originalDateStr
        ? bill.date
        : new Date(
          _y,
          _m - 1,
          _d,
          _now.getHours(),
          _now.getMinutes(),
          _now.getSeconds(),
          _now.getMilliseconds(),
        ).toISOString();
      const dueDate = calculateDueDate(billDate, 30);
      const initialPaidAmount = isEdit ? bill?.paidAmount || 0 : collectedAmountNum;
      const paymentStatus =
        initialPaidAmount > totals.total
          ? "overpaid"
          : initialPaidAmount >= totals.total
            ? "paid"
            : initialPaidAmount > 0
              ? "partial"
              : getPaymentStatus(dueDate, 0, totals.total);
      const billBankAccountId = paymentType !== "Cash" ? (selectedBankAccountId || undefined) : undefined;
      const initialPayments =
        isEdit || initialPaidAmount <= 0
          ? bill?.payments || []
          : [
            {
              id: generateId(),
              amount: initialPaidAmount,
              method: paymentType as Bill["paymentType"],
              date: billDate,
              bankAccountId: billBankAccountId,
            },
          ];

      const newBill: Bill = {
        id: bill?.id || generateId(),
        billNumber: finalBillNumber,
        date: billDate,
        clientId: selectedClient.id,
        client: selectedClient,
        items: billItems,
        subtotal: totals.subtotal,
        discount: discountNum > 0 ? totals.discount : 0,
        discountType: discountNum > 0 ? discountType : "amount",
        courierCharges: courierNum,
        otherCharges: 0,
        roundOff: totals.roundOff,
        total: totals.total,
        isGst: isGst || undefined,
        gstRate: isGst ? gstRate : undefined,
        cgst: isGst ? totals.cgst : undefined,
        sgst: isGst ? totals.sgst : undefined,
        totalTax: isGst ? totals.totalTax : undefined,
        paymentTerms: 30,
        dueDate,
        paymentStatus,
        paidAmount: initialPaidAmount,
        paymentType: paymentType as any,
        bankAccountId: billBankAccountId,
        payments: initialPayments as Bill["payments"],
        notes: description || notes,
        customerImages: customerImages.some(Boolean) ? [...customerImages] : undefined,
        createdBy: isEdit ? bill?.createdBy : creator,
        createdAt: bill?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        originalItems: isEdit ? originalBillItems : undefined,
      };

      // Upload any base64 images to Firebase Storage and replace with URLs
      if (newBill.customerImages) {
        const uploaded = await Promise.all(
          (["front", "back"] as const).map(async (side, i) => {
            const img = newBill.customerImages![i] || "";
            if (img.startsWith("data:")) {
              return await uploadBillCustomerImage(newBill.id, img, side);
            }
            return img;
          })
        );
        newBill.customerImages = uploaded.some(Boolean) ? uploaded : undefined;
      }

      await saveBill(newBill);
      toast.success(isEdit ? "Bill updated successfully" : "Bill created successfully");
      navigate(`/bills/${newBill.id}`);
    } catch (error) {
      console.error("Error saving bill:", error);
      toast.error("Failed to save bill");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyA") {
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
          e.preventDefault(); addItem(); return;
        }
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyV") {
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
          e.preventDefault(); setScannerOpen(true); return;
        }
      }
      if (e.ctrlKey && !e.altKey && !e.metaKey && e.key === "Enter") {
        if (tag !== "TEXTAREA") {
          e.preventDefault(); handleSubmit(); return;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSubmit]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="w-full p-2 pb-4 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold">
            {isEdit ? "Edit Bill" : "New Sale Bill"}
          </h1>
        </div>

        {/* Client */}
        <Card>
          <CardContent className="p-2.5 space-y-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Client Name *</Label>
              <Popover open={clientComboOpen} onOpenChange={setClientComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between text-xs h-8"
                  >
                    {selectedClient ? (
                      <span className="truncate">{selectedClient.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Select client...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search by name or phone..."
                      value={clientSearch}
                      onValueChange={setClientSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-primary"
                          onClick={() => {
                            setClientComboOpen(false);
                            setCreateClientOpen(true);
                          }}
                        >
                          <UserPlus className="size-4 mr-2" /> Add new client
                        </Button>
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setClientComboOpen(false);
                            setCreateClientOpen(true);
                          }}
                          className="text-primary text-xs"
                        >
                          <UserPlus className="size-3.5 mr-2" /> Add new client
                        </CommandItem>
                        {filteredClients.map((c) => (
                          <CommandItem
                            key={c.id}
                            onSelect={() => {
                              setSelectedClient(c);
                              setClientComboOpen(false);
                              setClientSearch("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedClient?.id === c.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <div>
                              <p className="font-medium">{c.name}</p>
                              {c.phone && (
                                <p className="text-xs text-muted-foreground">{c.phone}</p>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Invoice Number & Date */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Invoice #</Label>
                <Input
                  value={billNumber}
                  readOnly
                  className="bg-muted text-xs h-8"
                  placeholder="Auto-generated"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>

            {/* GST Toggle */}
            {!isEdit && (
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="gst-toggle"
                  checked={isGst}
                  onCheckedChange={setIsGst}
                />
                <Label htmlFor="gst-toggle" className="text-xs font-medium cursor-pointer">
                  GST Invoice (Tax Invoice)
                </Label>
                {isGst && (
                  <Select
                    value={String(gstRate)}
                    onValueChange={(v) => setGstRate(Number(v))}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">GST 5%</SelectItem>
                      <SelectItem value="12">GST 12%</SelectItem>
                      <SelectItem value="18">GST 18%</SelectItem>
                      <SelectItem value="28">GST 28%</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="p-2.5 pb-1.5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Items</CardTitle>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setScannerOpen(true)}
                  className="h-7 text-xs"
                  title="USB Barcode Scanner"
                >
                  <ScanBarcode className="size-3 mr-1" />
                  Scan
                </Button>
                <Button size="sm" variant="outline" onClick={addItem} className="h-7 text-xs">
                  <Plus className="size-3 mr-1" /> Add Item
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2.5 pt-1.5 space-y-2">
            {billItems.length === 0 && (
              <div className="text-center py-3 text-muted-foreground text-xs border-2 border-dashed rounded-lg">
                No items added yet.{" "}
                <button onClick={addItem} className="text-primary underline">
                  Add item
                </button>
              </div>
            )}
            {billItems.map((item, index) => {
              const product = products.find((p) => p.id === item.productId);
              const isSerialized = product?.trackingType === "serialized";
              const avail = isSerialized ? getAvailableUnits(item.productId, item.inventoryUnitId) : [];
              const searchableUnits = inventoryUnits.filter(
                (unit) =>
                  unit.status === "in_stock" &&
                  !billItems.some(
                    (billItem, billItemIndex) =>
                      billItemIndex !== index && billItem.inventoryUnitId === unit.id,
                  ),
              );
              return (
                <BillItemRow
                  key={index}
                  index={index}
                  item={item}
                  products={products}
                  inventoryUnits={searchableUnits}
                  availableUnits={avail}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                  onSelectProduct={selectProduct}
                  onSelectInventoryUnit={selectInventoryUnit}
                  isLast={index === billItems.length - 1}
                  onAddItem={addItem}
                />
              );
            })}
          </CardContent>
        </Card>

        {/* Charges, Payment, Discount */}
        <Card>
          <CardContent className="p-2.5 space-y-2">
            <h3 className="text-xs font-semibold">Charges & Payment</h3>


            {/* Courier Charges */}
            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Courier (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={courierCharges}
                  onChange={(e) => setCourierCharges(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Payment Type & Discount */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Payment Mode</Label>
                <Select value={paymentType} onValueChange={(v) => { setPaymentType(v); if (v === "Cash") setSelectedBankAccountId(""); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    {/* <SelectItem value="Bank Transfer">Bank Transfer</SelectItem> */}
                    <SelectItem value="UPI">UPI</SelectItem>
                    {/* <SelectItem value="Cheque">Cheque</SelectItem> */}
                    {/* <SelectItem value="Other">Other</SelectItem> */}
                  </SelectContent>
                </Select>
              </div>
              {paymentType !== "Cash" && (
                <div className="space-y-1">
                  <Label className="text-xs">Bank Account</Label>
                  {bankAccounts.length === 0 ? (
                    <p className="text-xs text-destructive">No bank accounts</p>
                  ) : (
                    <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((b) => (
                          <SelectItem key={b.id} value={b.id} className="text-xs">
                            {b.bankName} — {b.accountHolder}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Discount</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Select
                    value={discountType}
                    onValueChange={(v) => setDiscountType(v as "amount" | "percentage")}
                  >
                    <SelectTrigger className="h-8 text-xs w-14">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">₹</SelectItem>
                      <SelectItem value="percentage">%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!isEdit && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Collected</span>
                    <span>Rs. {collectedAmountNum.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {balanceAmount >= 0 ? "Balance Due" : "Overpaid"}
                    </span>
                    <span className={balanceAmount >= 0 ? "" : "text-blue-600"}>
                      Rs. {Math.abs(balanceAmount).toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>
            {!isEdit && (
              <div className="space-y-1">
                <Label className="text-xs">Collected Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={collectedAmount}
                  onChange={(e) => setCollectedAmount(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                  checked={showDescription}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowDescription(checked);
                    if (!checked) setDescription("");
                  }}
                />
                <span className="text-xs font-medium">Add Description / Notes</span>
              </label>
              {showDescription && (
                <div className="space-y-1">
                  <Label className="text-xs">Description / Notes</Label>
                  <Textarea
                    placeholder="Add any notes or description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="text-xs resize-none"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer ID Photos */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <Label className="text-xs font-medium">Customer ID Photos <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="grid grid-cols-2 gap-2">
              {(["ID Front", "ID Back"] as const).map((label, idx) => (
                <div key={idx} className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
                  {customerImages[idx] ? (
                    <div className="relative">
                      <img
                        src={customerImages[idx]}
                        alt={label}
                        className="h-24 w-full rounded-lg object-cover border"
                      />
                      <button
                        type="button"
                        className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 text-destructive hover:bg-destructive/10"
                        onClick={() => setCustomerImages((prev) => {
                          const next: [string, string] = [...prev] as [string, string];
                          next[idx] = "";
                          return next;
                        })}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1 h-24 w-full rounded-lg border-2 border-dashed border-border cursor-pointer hover:bg-muted/30 transition-colors">
                      <ImagePlus className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground text-center px-1">
                        {imageUploading[idx] ? "Uploading…" : "Click to upload"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={imageUploading[idx]}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setImageUploading((prev) => {
                            const next: [boolean, boolean] = [...prev] as [boolean, boolean];
                            next[idx] = true;
                            return next;
                          });
                          try {
                            const compressed = await compressFile(file, 900);
                            setCustomerImages((prev) => {
                              const next: [string, string] = [...prev] as [string, string];
                              next[idx] = compressed;
                              return next;
                            });
                          } catch {
                            toast.error("Failed to process image");
                          } finally {
                            setImageUploading((prev) => {
                              const next: [boolean, boolean] = [...prev] as [boolean, boolean];
                              next[idx] = false;
                              return next;
                            });
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Total Summary */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-2.5 space-y-1.5">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              {courierNum > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Courier</span>
                  <span>₹{courierNum.toFixed(2)}</span>
                </div>
              )}
              {totals.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-₹{totals.discount.toFixed(2)}</span>
                </div>
              )}

              {isGst && totals.cgst > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>CGST ({gstRate / 2}%)</span>
                  <span>₹{totals.cgst.toFixed(2)}</span>
                </div>
              )}
              {isGst && totals.sgst > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>SGST ({gstRate / 2}%)</span>
                  <span>₹{totals.sgst.toFixed(2)}</span>
                </div>
              )}
              {totals.roundOff !== 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Round Off</span>
                  <span>{totals.roundOff > 0 ? "+" : ""}₹{totals.roundOff.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1.5 border-t">
                <span>Total</span>
                <span className="text-primary">₹{totals.total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button
          className="w-full h-9 text-sm font-semibold"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? "Saving..." : isEdit ? "Update Bill" : "Create Bill"}
        </Button>
      </div>

      {/* Create Client Dialog */}
      <ClientForm
        open={createClientOpen}
        onOpenChange={setCreateClientOpen}
        onSuccess={(newClient) => {
          setClients((prev) => [...prev, newClient]);
          setSelectedClient(newClient);
        }}
      />

      {/* Barcode Scanner Dialog */}
      <BarcodeScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        inventoryUnits={inventoryUnits}
        products={products}
        alreadyAddedUnitIds={billItems.map((b) => b.inventoryUnitId).filter(Boolean) as string[]}
        onAddItem={handleScannerAdd}
      />
    </div>
  );
}

