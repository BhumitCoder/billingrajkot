import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  getPurchaseBills,
  getProducts,
  getInventoryUnits,
  savePurchaseBill,
  saveProduct,
  saveVendor,
  saveClient,
  deletePurchaseBill,
  updatePurchaseBillPayment,
  deletePurchaseBillPayment,
  savePurchaseReturn,
  deletePurchaseReturn,
  addPurchaseItemsToInventory,
  validatePurchaseBillImeis,
  isPurchaseBillDuplicate,
  updatePurchaseBillOverdueStatus,
  isPurchaseBillInventoryAdded,
  updatePurchaseBill,
  syncBillPricesToInventory,
  InventoryItemInput,
  getCompanyProfile,
  incrementSnCounter,
  getVendors,
  getClients,
  getBankAccounts,
  getPartyPayments,
  savePartyPayment,
  deletePartyPayment,
} from "@/lib/storage";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";
import { dummyPurchaseBills } from "@/lib/dummyData";
import { extractBillFromImage } from "@/lib/aiExtractor";
import {
  PurchaseBill,
  PurchaseBillItem,
  AIExtractionError,
  ProductConflict,
  Vendor,
  Client,
  BankAccount,
  PaymentMethod,
  PartyPayment,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { PaymentDialog } from "@/components/PaymentDialog";
import {
  formatCurrency,
  formatDate,
  calculateSellingPriceFromCommission,
  roundToTwoDecimals,
} from "@/lib/billUtils";
import { PurchaseReturnForm } from "@/components/PurchaseReturnForm";
import {
  RotateCcw,
  Upload,
  Camera,
  Search,
  Eye,
  Trash2,
  Loader2,
  FileText,
  CheckCircle,
  Clock,
  ImageIcon,
  PackagePlus,
  AlertTriangle,
  Edit2,
  Save,
  X,
  AlertCircle,
  Image,
  IndianRupee,
  Calendar,
  BookOpen,
  Download,
  MoreVertical,
  Plus,
  Filter,
  Receipt,
  SlidersHorizontal,
  ChevronDown,
  User,
  Truck,
  Wallet,
  Landmark,
  Printer,
  Wrench,
  CreditCard,
  ImagePlus,
  Check,
  FileSpreadsheet,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { PurchaseBillPDF } from "@/components/PurchaseBillPDF";
import { Textarea } from "@/components/ui/textarea";
import { ConflictResolutionDialog } from "@/components/ConflictResolutionDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";

const STORAGE_OPTIONS = ["32", "64", "128", "256", "512", "1TB", "2TB"];
import { compressFile, getBase64SizeKB } from "@/lib/imageCompression";
import { uploadPurchaseBillVendorImage, updatePurchaseBillImages, uploadPurchaseBillInvoice, updatePurchaseBillInvoice } from "@/lib/firebaseService";
import { toast as sonnerToast } from "sonner";
import { downloadImage } from "@/lib/utils";
import { ProductAutocomplete } from "@/components/ProductAutocomplete";
import { ProductForm } from "@/components/ProductForm";
import { printBarcodeStickers, downloadBarcodesPDF } from "@/components/BarcodeStickerSheet";
import type { InventoryUnit } from "@/types";

function PurchaseBills() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [filteredBills, setFilteredBills] = useState<PurchaseBill[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 10;
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedBill, setSelectedBill] = useState<PurchaseBill | null>(null);
  const [viewImageBill, setViewImageBill] = useState<PurchaseBill | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedBillForHistory, setSelectedBillForHistory] =
    useState<PurchaseBill | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedBillForReturn, setSelectedBillForReturn] =
    useState<PurchaseBill | null>(null);

  const openHistoryDialog = (bill: PurchaseBill) => {
    setSelectedBillForHistory(bill);
    setHistoryDialogOpen(true);
  };

  const getPurchaseHistory = (bill: PurchaseBill) => {
    const history: any[] = [];

    // Add payments
    if (bill.payments && bill.payments.length > 0) {
      bill.payments.forEach((payment) => {
        const isReturnPayment = payment.amount < 0;
        history.push({
          id: `payment-${payment.id}`,
          date: payment.date,
          type: isReturnPayment ? "return_payment" : "purchase_payment",
          description: isReturnPayment
            ? `Return Payment from Vendor (${payment.method})${payment.note ? ` - ${payment.note}` : ""}`
            : `Purchase Payment to Vendor (${payment.method})${payment.note ? ` - ${payment.note}` : ""}`,
          amount: Math.abs(payment.amount),
          quantity: 0,
        });
      });
    }

    // Sort by date descending
    return history.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  };

  const normalizeVariantPart = (value?: string) =>
    (value || "").toString().trim().toLowerCase();

  const normalizeImei = (value?: string) =>
    (value || "").toString().replace(/\s+/g, "").toLowerCase();

  // Check if an IMEI exists in the system in ANY status (in_stock, sold, returned, etc.).
  // Returns { unit, foundAs, isBlocking } or null.
  // isBlocking = true means device is currently in possession (can't re-purchase).
  // isBlocking = false means device was previously processed (sold/returned) — warn only.
  const checkImeiConflict = (imei: string): { unit: any; foundAs: string; isBlocking: boolean } | null => {
    const norm = normalizeImei(imei);
    if (!norm) return null;
    let bestMatch: { unit: any; foundAs: string; isBlocking: boolean } | null = null;
    for (const u of inventoryUnits as any[]) {
      let foundAs: string | null = null;
      if (normalizeImei(u.imeiNormalized || u.imeiNumber) === norm) foundAs = "IMEI";
      else if (u.serialNumber && normalizeImei(u.serialNumber) === norm) foundAs = "SN";
      if (!foundAs) continue;
      const isBlocking = u.status === "in_stock" || u.status === "reserved";
      // Prefer blocking match over non-blocking
      if (!bestMatch || isBlocking) {
        bestMatch = { unit: u, foundAs, isBlocking };
      }
      if (isBlocking) break; // no need to keep looking
    }
    return bestMatch;
  };

  const buildVariantKey = (item: {
    description?: string;
    name?: string;
    model?: string;
  }) =>
    [
      normalizeVariantPart(item.description || item.name),
      normalizeVariantPart(item.model),
    ].join("|");

  const isVariantSensitiveItem = (item: {
    model?: string;
    storage?: string;
    color?: string;
    itemNo?: string;
  }) =>
    Boolean(
      normalizeVariantPart(item.model) ||
      normalizeVariantPart(item.storage) ||
      normalizeVariantPart(item.color) ||
      normalizeVariantPart(item.itemNo),
    );

  const findExistingProductForPurchaseItem = (item: PurchaseBillItem) => {
    const variantSensitive = isVariantSensitiveItem(item);
    const variantKey = buildVariantKey(item);

    if (variantSensitive) {
      const variantMatch = products.find(
        (p) => buildVariantKey(p) === variantKey,
      );
      if (variantMatch) return variantMatch;
    }

    return products.find(
      (p) =>
        p.name.toLowerCase().trim() === item.description.toLowerCase().trim(),
    );
  };

  const extractNumericBillNumber = (value?: string): number | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const num = Number.parseInt(trimmed, 10);
      return Number.isFinite(num) ? num : null;
    }
    const matches = trimmed.match(/\d+/g);
    if (!matches || matches.length === 0) return null;
    const num = Number.parseInt(matches[matches.length - 1], 10);
    return Number.isFinite(num) ? num : null;
  };

  const getNextPurchaseBillNumber = (): string => {
    const maxNumber = bills.reduce((max, bill) => {
      const parsed = extractNumericBillNumber(bill.billNumber);
      return parsed !== null ? Math.max(max, parsed) : max;
    }, 0);
    return String(maxNumber + 1);
  };

  const validatePhoneItemRules = (
    items: Array<{
      description?: string;
      quantity: number;
      imeiNumber?: string;
      imeiListText?: string;
      productId?: string;
      vendorId?: string;
      isNewProduct?: boolean;
    }>,
    opts?: {
      checkAgainstProducts?: boolean;
      requireInventoryFields?: boolean;
      allowListQuantity?: boolean;
    },
  ): string | null => {
    const seenImeis = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const lineLabel = item.description?.trim()
        ? item.description.trim()
        : `Item ${i + 1}`;
      const normalizedImei = normalizeImei(item.imeiNumber);

      if (opts?.requireInventoryFields) {
        if (!item.vendorId) {
          return `${lineLabel}: vendor is required before adding to inventory.`;
        }
        if (item.isNewProduct === false && !item.productId) {
          return `${lineLabel}: select a product for "Update Stock" or switch to "Create New".`;
        }
      }

      if (!normalizedImei) continue;

      if (!opts?.allowListQuantity && Number(item.quantity) !== 1) {
        return `${lineLabel}: quantity must be 1 when IMEI/Serial is provided.`;
      }

      if (seenImeis.has(normalizedImei)) {
        return `${lineLabel}: duplicate IMEI/Serial in this bill (${item.imeiNumber}).`;
      }
      seenImeis.add(normalizedImei);

      if (opts?.checkAgainstProducts) {
        const existing = products.find(
          (p) => normalizeImei((p as any).imeiNumber) === normalizedImei,
        );
        if (existing) {
          return `${lineLabel}: IMEI/Serial already exists in inventory (${existing.name}).`;
        }
      }
    }
    return null;
  };

  const validateRequiredPurchaseItemFields = (
    items: Array<{
      description?: string;
      imeiNumber?: string;
      storage?: string;
      color?: string;
      amount?: number;
    }>,
  ): string | null => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const lineLabel = item.description?.trim()
        ? item.description.trim()
        : `Item ${i + 1}`;

      if (!item.description?.trim()) {
        return `Item ${i + 1}: Model/description is required.`;
      }

      if (!String(item.imeiNumber || "").trim()) {
        return `${lineLabel}: IMEI/Serial is required.`;
      }

      if (!String(item.storage || "").trim()) {
        return `${lineLabel}: storage is required.`;
      }

      if (!String(item.color || "").trim()) {
        return `${lineLabel}: color is required.`;
      }

      if (!(Number(item.amount) > 0)) {
        return `${lineLabel}: amount must be greater than 0.`;
      }
    }

    return null;
  };

  const splitImeiList = (raw?: string): string[] => {
    if (!raw) return [];
    return Array.from(
      new Set(
        raw
          .split(/[\n,;]+/g)
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    );
  };

  const getInventoryRowImeis = (item: {
    imeiNumber?: string;
    imeiListText?: string;
  }): string[] => {
    const list = splitImeiList(item.imeiListText || "");
    if (list.length > 0) return list;
    const single = (item.imeiNumber || "").trim();
    return single ? [single] : [];
  };

  const isSerializedInventoryRow = (item: {
    productId?: string;
    imeiNumber?: string;
    imeiListText?: string;
  }): boolean => {
    return getInventoryRowImeis(item).length > 0;
  };

  const getAvailableStockForBill = (bill: PurchaseBill) => {
    if (!bill || !products) return 0;
    const billProductIds = new Set(
      bill.items
        .map((item) => {
          const p = findExistingProductForPurchaseItem(item);
          return p?.id;
        })
        .filter(Boolean),
    );

    const inStockByProduct = inventoryUnits.reduce<Record<string, number>>((acc, u) => {
      if ((u.status === "in_stock" || u.status === "reserved" || u.status === "returned") && u.productId) {
        acc[u.productId] = (acc[u.productId] || 0) + 1;
      }
      return acc;
    }, {});
    return products
      .filter((p) => billProductIds.has(p.id))
      .reduce((sum, p) => {
        const stock = (p.trackingType || "standard") === "serialized"
          ? (inStockByProduct[p.id] || 0)
          : Math.max(0, p.stock || 0);
        return sum + stock;
      }, 0);
  };

  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [transactionAmount, setTransactionAmount] = useState<string>("");

  const [editingReturn, setEditingReturn] = useState<any>(null);

  const { locked, reloadKey } = useEncryptionLock();

  const handleEditTransaction = (entry: any) => {
    if (entry.type === "payment") {
      setEditingTransaction(entry);
      setTransactionAmount(entry.amount.toString());
    } else if (entry.type === "return") {
      const returnObj = selectedBillForHistory?.returns?.find(
        (r) => `return-${r.id}` === entry.id,
      );
      if (returnObj && selectedBillForHistory) {
        setEditingReturn(returnObj);
        setSelectedBillForReturn(selectedBillForHistory);
        setReturnDialogOpen(true);
      }
    }
  };

  const saveEditedTransaction = async () => {
    if (!editingTransaction || !selectedBillForHistory) return;
    setIsUpdatingTransaction(editingTransaction.id);
    try {
      const amount = parseFloat(transactionAmount);
      if (isNaN(amount)) return;

      const paymentId = editingTransaction.id.replace("payment-", "");
      await updatePurchaseBillPayment(
        selectedBillForHistory.id,
        amount,
        editingTransaction.method || "Cash",
        editingTransaction.note,
        editingTransaction.date,
        paymentId,
      );

      toast({ title: "Success", description: "Payment updated successfully" });
      setEditingTransaction(null);
      await loadBills();
      // Update history dialog view
      const updatedBill = bills.find((b) => b.id === selectedBillForHistory.id);
      if (updatedBill) setSelectedBillForHistory(updatedBill);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update payment",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingTransaction(null);
    }
  };

  const handleDeleteTransaction = async (entry: any) => {
    if (!selectedBillForHistory) return;
    setIsUpdatingTransaction(entry.id);
    try {
      if (entry.type === "payment") {
        const paymentId = entry.id.replace("payment-", "");
        await deletePurchaseBillPayment(selectedBillForHistory.id, paymentId);
        toast({ title: "Deleted", description: "Payment removed" });
      } else if (entry.type === "return") {
        const returnId = entry.id.replace("return-", "");
        await deletePurchaseReturn(returnId, selectedBillForHistory.id);
        toast({
          title: "Deleted",
          description: "Return removed and stock reverted",
        });
      }
      await loadBills();
      const updatedBill = bills.find((b) => b.id === selectedBillForHistory.id);
      if (updatedBill) setSelectedBillForHistory(updatedBill);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete transaction",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingTransaction(null);
    }
  };
  const [editedBill, setEditedBill] = useState<PurchaseBill | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [vendorIdImages, setVendorIdImages] = useState<[string, string]>(["", ""]);
  const [vendorIdUploading, setVendorIdUploading] = useState<[boolean, boolean]>([false, false]);
  const [vendorIdSaving, setVendorIdSaving] = useState(false);
  const [vendorPreviewImage, setVendorPreviewImage] = useState<{ src: string; label: string } | null>(null);
  const vendorIdInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const [detailInvoiceUploading, setDetailInvoiceUploading] = useState(false);
  const detailInvoiceInputRef = useRef<HTMLInputElement>(null);

  const [selectedBillForPayment, setSelectedBillForPayment] =
    useState<PurchaseBill | null>(null);
  const [loadingPayment, setLoadingPayment] = useState<string | null>(null);
  const [loadingInventory, setLoadingInventory] = useState<string | null>(null);
  const [savingEditedBill, setSavingEditedBill] = useState(false);
  const [productConflicts, setProductConflicts] = useState<ProductConflict[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingTransaction, setIsUpdatingTransaction] = useState<
    string | null
  >(null);
  const [pendingInventoryBill, setPendingInventoryBill] =
    useState<PurchaseBill | null>(null);
  const [pendingInventoryItems, setPendingInventoryItems] = useState<
    InventoryItemInput[]
  >([]);
  const [lastInventoryError, setLastInventoryError] = useState<string | null>(
    null,
  );

  // Inventory dialog state
  const [inventoryDialogBill, setInventoryDialogBill] =
    useState<PurchaseBill | null>(null);
  const [inventoryItems, setInventoryItems] = useState<
    {
      description: string;
      itemNo?: string;
      model?: string;
      imeiNumber?: string;
      imeiListText?: string;
      storage?: string;
      color?: string;
      hsnCode: string;
      quantity: number;
      unit: string;
      purchasePrice: number;
      gstRate: number;
      weight: number;
      weightUnit: string;
      barcode?: string;
      batteryHealth?: string;
      warranty?: string;
      vendorId?: string;
      productId?: string;
      isNewProduct?: boolean;
    }[]
  >([]);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [snPrefix, setSnPrefix] = useState("");
  const [snCounterBase, setSnCounterBase] = useState(0);
  // Ref, not state: the Alt+W "add item" keyboard shortcut is registered in a useEffect
  // that doesn't re-bind on every keystroke, so a stale closure would keep reading the
  // same snLocalCounter value via useState and hand out the same SN repeatedly. A ref's
  // .current is always current regardless of which closure reads it.
  const snLocalCounterRef = useRef(0);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [parties, setParties] = useState<Client[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  // Collect payment on create
  const [collectPaymentOnCreate, setCollectPaymentOnCreate] = useState(false);
  const [vendorAdvancePayments, setVendorAdvancePayments] = useState<PartyPayment[]>([]);
  const vendorAdvanceAmount = vendorAdvancePayments.reduce((s, p) => s + p.amount, 0);
  const [createPayment, setCreatePayment] = useState<{
    amount: string;
    method: PaymentMethod;
    bankAccountId: string;
    date: string;
    note: string;
  }>({ amount: "", method: "Cash", bankAccountId: "", date: new Date().toISOString().split("T")[0], note: "" });

  const [products, setProducts] = useState<any[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<any[]>([]);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [createProductForIndex, setCreateProductForIndex] = useState<number | null>(null);
  const [manualCreateOpen, setManualCreateOpen] = useState(false);
  const [manualDiscardConfirmOpen, setManualDiscardConfirmOpen] = useState(false);
  const [repairCosts, setRepairCosts] = useState<Array<{ itemIndex: number; amount: number; notes: string }>>([]);
  const [editRepairCosts, setEditRepairCosts] = useState<Array<{ itemIndex: number; amount: number; notes: string }>>([]);
  const [includeManualBillNotes, setIncludeManualBillNotes] = useState(false);
  const manualImageInputRef = useRef<HTMLInputElement>(null);
  const [manualInvoiceFile, setManualInvoiceFile] = useState<File | null>(null);
  const manualInvoiceInputRef = useRef<HTMLInputElement>(null);
  const [invoiceUploading, setInvoiceUploading] = useState(false);
  const [manualVendorMode, setManualVendorMode] = useState<"select" | "create">(
    "select",
  );
  const [manualVendorForm, setManualVendorForm] = useState({
    name: "",
    address: "",
    gstin: "",
    phone: "",
    email: "",
    openingBalance: "",
    openingBalanceType: "receivable",
    creditLimit: "",
  });
  const [manualBill, setManualBill] = useState<{
    billImage: string;
    clientId?: string;
    vendorId?: string;
    vendorName: string;
    vendorAddress?: string;
    vendorGstin?: string;
    billNumber?: string;
    billDate: string;
    dueDate?: string;
    paymentTerms?: number;
    notes?: string;
    courierCharges?: number;
    expenseAmount?: number;
    paymentMode?: string;
    isInvoice?: boolean;
    items: PurchaseBillItem[];
  }>({
    billImage: "",
    clientId: undefined,
    vendorId: undefined,
    vendorName: "",
    vendorAddress: "",
    vendorGstin: "",
    billNumber: getNextPurchaseBillNumber(),
    billDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    paymentTerms: 0,
    notes: "",
    courierCharges: 0,
    expenseAmount: 0,
    paymentMode: "Cash",
    isInvoice: false,
    items: [
      {
        description: "",
        hsnCode: "",
        itemNo: "",
        model: "",
        imeiNumber: "",
        storage: "",
        color: "",
        quantity: 1,
        unit: "pcs",
        rate: 0,
        sellingPrice: 0,
        amount: 0,
        gstRate: 0,
        gstAmount: 0,
        whereToBuy: "",
      },
    ],
  });

  useEffect(() => {
    // Update overdue status on load
    updatePurchaseBillOverdueStatus().catch(console.error);
    loadBills();
    loadCompanyProfile();
    loadProducts();
    loadVendors();

    // Check for ID in URL to open detailed view
    const params = new URLSearchParams(window.location.search);
    const billId = params.get("id");
    if (billId) {
      const fetchAndOpenBill = async () => {
        const data = await getPurchaseBills();
        const bill = data.find((b) => b.id === billId);
        if (bill) {
          setSelectedBill(bill);
        }
      };
      fetchAndOpenBill();
    }
  }, [locked, reloadKey]);

  // Sync vendor ID images when detail dialog opens/changes
  useEffect(() => {
    if (selectedBill) {
      setVendorIdImages([
        selectedBill.vendorImages?.[0] || "",
        selectedBill.vendorImages?.[1] || "",
      ]);
    } else {
      setVendorIdImages(["", ""]);
      setVendorPreviewImage(null);
    }
  }, [selectedBill?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      // Ctrl+S: save bill (works even from input fields)
      if (e.ctrlKey && !e.altKey && !e.metaKey && e.code === "KeyS") {
        if (manualCreateOpen) { e.preventDefault(); handleSaveManualBill(); }
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code === "KeyA" && !inInput) { e.preventDefault(); setManualCreateOpen(true); }
      if (e.code === "KeyW" && manualCreateOpen) { e.preventDefault(); addManualItemRow(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [manualCreateOpen]);

  const loadVendors = async () => {
    const data = await getVendors();
    setVendors(data);
    const clientData = await getClients();
    setParties(clientData);
    const bankData = await getBankAccounts();
    setBankAccounts(bankData);
  };

  const loadProducts = async () => {
    const [data, units] = await Promise.all([getProducts(), getInventoryUnits()]);
    setProducts(data);
    setInventoryUnits(units);
  };

  const formatErrorForUser = (error: unknown) => {
    try {
      const e = error as any;
      const basic =
        typeof e?.message === "string"
          ? e.message
          : typeof error === "string"
            ? error
            : "Unknown error";

      const meta: any = {};
      if (e?.code) meta.code = e.code;
      if (e?.name) meta.name = e.name;
      if (e?.stack) meta.stack = e.stack;

      return [
        `Message: ${basic}`,
        meta.code ? `Code: ${meta.code}` : null,
        meta.name ? `Name: ${meta.name}` : null,
        `Online: ${typeof navigator !== "undefined" ? navigator.onLine : "unknown"}`,
        `UserAgent: ${typeof navigator !== "undefined" ? navigator.userAgent : "unknown"
        }`,
        meta.stack ? `\nStack:\n${meta.stack}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    } catch {
      return "Unknown error (failed to format error details)";
    }
  };

  const snAutoGenerate = companyProfile?.snAutoGenerate !== false;

  const loadCompanyProfile = async () => {
    const profile = await getCompanyProfile();
    setCompanyProfile(profile);
    if (profile?.snPrefix) {
      setSnPrefix(profile.snPrefix);
      // snCounterBase is derived exclusively in the useEffect below
      // (scanning actual bills) to prevent stale settings from overriding real data
    }
  };

  useEffect(() => {
    filterAndSortBills();
  }, [bills, searchTerm, statusFilter, sortBy]);

  // Safeguard: always derive snCounterBase from the highest SN in existing bills
  // for the current prefix. This protects against settings being wiped/reset.
  useEffect(() => {
    if (companyProfile === null) return; // not loaded yet
    const prefix = companyProfile.snPrefix as string | undefined;
    if (!prefix) return;

    let maxFromBills = 0;
    for (const bill of bills) {
      for (const item of (bill.items || []) as PurchaseBillItem[]) {
        const sn = (item.serialNumber || "").trim();
        if (sn.toUpperCase().startsWith(`${prefix.toUpperCase()}-`)) {
          const numStr = sn.slice(prefix.length + 1);
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxFromBills) {
            maxFromBills = num;
          }
        }
      }
    }

    const settingsCounter = (companyProfile.snCounter as number) ?? 0;
    // Actual bill data is ground truth: if any bills exist with this prefix,
    // their highest number is authoritative. Only fall back to settingsCounter
    // when no bills have been assigned SNs for this prefix yet.
    const effectiveCounter = maxFromBills > 0 ? maxFromBills : settingsCounter;

    setSnCounterBase(effectiveCounter);
  }, [bills, companyProfile]);

  const exportPurchasesToExcel = () => {
    if (filteredBills.length === 0) {
      toast({ title: "No bills to export", variant: "destructive" });
      return;
    }
    const rows = filteredBills.map((b) => {
      const items = (b.items || []).map((i) => `${i.description || ""} x${i.quantity}`).join(", ");
      const paymentMethods = (b.payments || []).filter((p) => p.amount > 0).map((p) => `${p.method} ₹${p.amount.toFixed(2)}`).join(", ");
      const totalReturns = (b.returns || []).reduce((s, r) => s + (r.totalReturnValue || 0), 0);
      const netTotal = Math.max(0, b.total - totalReturns);
      const balanceDue = Math.max(0, netTotal - (b.paidAmount || 0));
      return {
        "Bill #": b.billNumber || "",
        "Bill Date": b.billDate ? new Date(b.billDate).toLocaleDateString("en-IN") : "",
        "Due Date": b.dueDate ? new Date(b.dueDate).toLocaleDateString("en-IN") : "",
        "Vendor Name": b.vendorName || "",
        "Vendor Address": b.vendorAddress || "",
        "Items": items,
        "Subtotal (₹)": b.subtotal || 0,
        "Courier Charges (₹)": b.courierCharges || 0,
        "Extra Expense (₹)": b.expenseAmount || 0,
        "Total (₹)": b.total || 0,
        "Returns (₹)": totalReturns,
        "Net Total (₹)": netTotal,
        "Paid (₹)": b.paidAmount || 0,
        "Balance Due (₹)": balanceDue,
        "Payment Status": b.paymentStatus || "",
        "Payment Method(s)": paymentMethods,
        "Inventory Added": b.itemsAddedToInventory ? "Yes" : "No",
        "Notes": b.notes || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 22 },
      { wch: 40 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 30 }, { wch: 16 }, { wch: 20 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchase Bills");
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Purchase_Bills_${dateStr}.xlsx`);
    toast({ title: `Exported ${filteredBills.length} bills` });
  };

  const loadBills = async (): Promise<PurchaseBill[]> => {
    if (locked) { setBills(dummyPurchaseBills); setPage(1); setLoading(false); return dummyPurchaseBills; }
    setLoading(true);
    const data = await getPurchaseBills();
    setBills(data);
    setPage(1);
    setLoading(false);
    return data;
  };

  const stats = (() => {
    const scopedBills = filteredBills;
    const totalPurchase = scopedBills.reduce((sum, b) => {
      const totalReturns =
        b.returns?.reduce((s, r) => s + r.totalReturnValue, 0) || 0;

      return sum + (b.total - totalReturns); // ✅ Net Purchase
    }, 0);

    const totalPaid = scopedBills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);

    const totalReturns = scopedBills.reduce(
      (sum, b) =>
        sum + (b.returns?.reduce((s, r) => s + r.totalReturnValue, 0) || 0),
      0,
    );

    const totalReturnCollected = scopedBills.reduce(
      (sum, b) =>
        sum +
        (b.payments
          ?.filter((p) => p.amount < 0)
          .reduce((s, p) => s + Math.abs(p.amount), 0) || 0),
      0,
    );

    const amountRemaining = scopedBills.reduce((sum, b) => {
      const totalReturns =
        b.returns?.reduce((s, r) => s + r.totalReturnValue, 0) || 0;

      const netTotal = b.total - totalReturns;

      return sum + (netTotal - (b.paidAmount || 0));
    }, 0);
    const totalCourier = scopedBills.reduce(
      (sum, b) => sum + Number(b.courierCharges || 0),
      0,
    );
    const totalExtraExpense = scopedBills.reduce(
      (sum, b) => sum + Number(b.expenseAmount || 0),
      0,
    );
    const paymentMethodTotals = scopedBills.reduce(
      (acc, b: any) => {
        if (Array.isArray(b.payments) && b.payments.length > 0) {
          b.payments.forEach((p: any) => {
            const method = String(p.method || "Other");
            acc[method] = (acc[method] || 0) + Number(p.amount || 0);
          });
        } else if ((b.paidAmount || 0) > 0) {
          const method = String(b.paymentMethod || b.paymentType || "Other");
          acc[method] = (acc[method] || 0) + Number(b.paidAmount || 0);
        }
        return acc;
      },
      {} as Record<string, number>,
    );
    const totalCashPaid = Number(paymentMethodTotals["Cash"] || 0);
    const totalBankPaid =
      Number(paymentMethodTotals["Bank Transfer"] || 0) +
      Number(paymentMethodTotals["Cheque"] || 0) +
      Number(paymentMethodTotals["UPI"] || 0);

    return {
      totalPurchase,
      totalPaid,
      amountRemaining,
      totalReturns,
      totalReturnCollected,
      totalCourier,
      totalExtraExpense,
      totalCashPaid,
      totalBankPaid,
    };
  })();

  const filterAndSortBills = () => {
    let filtered = [...bills];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (bill) =>
          bill.vendorName.toLowerCase().includes(term) ||
          bill.billNumber?.toLowerCase().includes(term) ||
          bill.items.some((item) =>
            item.description.toLowerCase().includes(term),
          ),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((bill) => {
        if (statusFilter === "overpaid") {
          const netTotal =
            bill.total -
            (bill.returns?.reduce((sum, r) => sum + r.totalReturnValue, 0) ||
              0);
          return netTotal - (bill.paidAmount || 0) < 0;
        }
        return bill.paymentStatus === statusFilter;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "date-asc":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "amount-desc":
          return b.total - a.total;
        case "amount-asc":
          return a.total - b.total;
        case "vendor":
          return a.vendorName.localeCompare(b.vendorName);
        case "due-date":
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        default:
          return 0;
      }
    });

    setFilteredBills(filtered);
  };

  useEffect(() => {
    setPage(1);
  }, [filteredBills.length, searchTerm, statusFilter, sortBy]);

  // Warn the user before leaving the page if the manual-create form is open and has data.
  // This protects against accidental navigation, PWA service-worker reloads, etc.
  useEffect(() => {
    if (!manualCreateOpen) return;
    const hasData =
      manualBill.items.some(
        (item) =>
          (item.description?.trim()) ||
          String((item as any).imeiNumber || "").trim() ||
          Number(item.rate) > 0,
      ) ||
      manualBill.billNumber?.trim() ||
      manualBill.vendorName?.trim();

    if (!hasData) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [manualCreateOpen, manualBill]);

  // Fetch vendor's unreconciled advance whenever vendor changes in the create form
  useEffect(() => {
    const vid = manualBill.clientId || manualBill.vendorId;
    if (!vid || !manualCreateOpen) { setVendorAdvancePayments([]); return; }
    let cancelled = false;
    getPartyPayments().then((payments) => {
      if (cancelled) return;
      const advance = payments
        .filter((p) => p.partyId === vid && p.type === "sent")
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setVendorAdvancePayments(advance);
    }).catch(() => setVendorAdvancePayments([]));
    return () => { cancelled = true; };
  }, [manualBill.clientId, manualBill.vendorId, manualCreateOpen]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedBills = filteredBills.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const statusLabelMap: Record<string, string> = {
    all: "All Status",
    paid: "Paid",
    pending: "Pending",
    overdue: "Overdue",
    overpaid: "Overpaid",
  };
  const sortLabelMap: Record<string, string> = {
    "date-desc": "Date (Newest)",
    "date-asc": "Date (Oldest)",
    "due-date": "Due Date",
    "amount-desc": "Amount (High to Low)",
    "amount-asc": "Amount (Low to High)",
    vendor: "Vendor Name",
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setIsCompressing(true);

    toast({
      title: "Processing Image",
      description: "Optimizing image for AI processing...",
    });

    try {
      const compressedBase64 = await compressFile(file, 900);
      const sizeKB = getBase64SizeKB(compressedBase64);

      if (sizeKB > 1000) {
        toast({
          title: "Image Too Large",
          description: `Image is ${sizeKB.toFixed(
            0,
          )} KB. Please try a different photo.`,
          variant: "destructive",
        });
        setIsCompressing(false);
        return;
      }

      await processImage(compressedBase64);
    } catch (error) {
      console.error("Error processing image:", error);
      toast({
        title: "Error",
        description: "Failed to process image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCompressing(false);
    }

    e.target.value = "";
  };

  const processImage = async (imageBase64: string) => {
    setIsExtracting(true);

    try {
      toast({
        title: "Processing",
        description: "AI is extracting bill information...",
      });

      const extracted = await extractBillFromImage(imageBase64);

      // Check for duplicate bill
      if (
        extracted.billNumber &&
        (await isPurchaseBillDuplicate(
          extracted.billNumber,
          extracted.vendorName,
        ))
      ) {
        toast({
          title: "Duplicate Bill",
          description: `Bill #${extracted.billNumber} from ${extracted.vendorName} already exists`,
          variant: "destructive",
        });
        setIsExtracting(false);
        return;
      }

      // Calculate due date from payment terms if not provided
      let dueDate = extracted.dueDate;
      if (!dueDate && extracted.paymentTerms && extracted.billDate) {
        const billDate = new Date(extracted.billDate);
        billDate.setDate(billDate.getDate() + extracted.paymentTerms);
        dueDate = billDate.toISOString();
      }

      // H5: atomically reserve SN range before assigning so no two sessions collide
      let snFirstNum = snCounterBase + snLocalCounterRef.current + 1;
      if (snPrefix && snAutoGenerate && extracted.items.length > 0) {
        try {
          snFirstNum = await incrementSnCounter(extracted.items.length, snCounterBase + snLocalCounterRef.current);
          setSnCounterBase(snFirstNum + extracted.items.length - 1);
          snLocalCounterRef.current = 0;
        } catch (snErr) {
          console.error("Failed to atomically reserve SN range:", snErr);
        }
      }
      const normalizedItems = extracted.items.map((item, idx) => ({
        ...item,
        serialNumber: (snPrefix && snAutoGenerate)
          ? `${snPrefix}-${String(snFirstNum + idx).padStart(2, "0")}`
          : "",
        hsnCode: "",
        gstRate: 0,
        gstAmount: 0,
      }));
      const subtotal = normalizedItems.reduce(
        (sum, item) => sum + (item.amount || 0),
        0,
      );
      const newBill: PurchaseBill = {
        id: crypto.randomUUID(),
        billImage: imageBase64,
        clientId: parties.find(
          (p) =>
            p.name.toLowerCase().trim() ===
            extracted.vendorName.toLowerCase().trim(),
        )?.id,
        vendorName: extracted.vendorName,
        vendorAddress: extracted.vendorAddress,
        vendorGstin: extracted.vendorGstin,
        billNumber: extracted.billNumber || getNextPurchaseBillNumber(),
        billDate: extracted.billDate
          ? new Date(extracted.billDate).toISOString()
          : new Date().toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        paymentTerms: extracted.paymentTerms,
        items: normalizedItems,
        subtotal,
        totalTax: 0,
        total: subtotal,
        paymentStatus: "pending",
        paidAmount: 0,
        payments: [],
        extractedRawText: extracted.rawText,
        extractionErrors: extracted.errors,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Block creation if any IMEI/serial is already in stock
      const aiImeiErrors = await validatePurchaseBillImeis(newBill.items);
      if (aiImeiErrors.length > 0) {
        toast({
          title: "IMEI / Serial Conflict",
          description: aiImeiErrors.join("\n"),
          variant: "destructive",
        });
        return;
      }

      await savePurchaseBill(newBill);

      // Auto-apply vendor advance (same as manual create path)
      const aiVendorId = newBill.clientId || newBill.vendorId;
      if (aiVendorId) {
        await applyVendorAdvanceToBill(newBill.id, aiVendorId, newBill.total);
      }

      let needsInventoryDialog = false;
      try {
        await autoAddBillToInventory(newBill);
      } catch (inventoryError) {
        console.error("Auto inventory add failed:", inventoryError);
        needsInventoryDialog = true;
      }
      const loadedBills = await loadBills();

      // Show warnings if any
      if (needsInventoryDialog) {
        toast({
          title: "Bill Saved — Action Needed",
          description: "Could not auto-add items to inventory. Please complete the inventory step.",
          variant: "destructive",
        });
      } else if (extracted.errors.length > 0) {
        toast({
          title: "Bill Extracted with Warnings",
          description: `${extracted.errors.length} issue(s) found. Please review and fix.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Success",
          description: "Bill extracted and inventory updated!",
        });
      }

      // Open the detail view — use refreshed bill so itemsAddedToInventory is current
      const refreshedNewBill = loadedBills.find((b) => b.id === newBill.id) || newBill;
      setSelectedBill(refreshedNewBill);

      if (needsInventoryDialog) {
        setTimeout(() => handleAddToInventory(refreshedNewBill), 800);
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to process bill",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const resetManualCreate = (firstSN?: string) => {
    // When closing (no firstSN provided), reset SN local counter
    if (firstSN === undefined) {
      snLocalCounterRef.current = 0;
    }
    setManualVendorMode("select");
    setManualVendorForm({
      name: "",
      address: "",
      gstin: "",
      phone: "",
      email: "",
      openingBalance: "",
      openingBalanceType: "receivable",
      creditLimit: "",
    });
    setRepairCosts([]);
    setCollectPaymentOnCreate(false);
    setIncludeManualBillNotes(false);
    setManualInvoiceFile(null);
    setCreatePayment({ amount: "", method: "Cash", bankAccountId: "", date: new Date().toISOString().split("T")[0], note: "" });
    setManualBill({
      billImage: "",
      clientId: undefined,
      vendorId: undefined,
      vendorName: "",
      vendorAddress: "",
      vendorGstin: "",
      billNumber: getNextPurchaseBillNumber(),
      billDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      paymentTerms: 0,
      notes: "",
      courierCharges: 0,
      expenseAmount: 0,
      paymentMode: "Cash",
      isInvoice: false,
      items: [
        {
          description: "",
          hsnCode: "",
          itemNo: "",
          model: "",
          serialNumber: firstSN || "",
          imeiNumber: "",
          storage: "",
          color: "",
          quantity: 1,
          unit: "pcs",
          rate: 0,
          amount: 0,
          gstRate: 0,
          gstAmount: 0,
          whereToBuy: "",
        },
      ],
    });
  };

  const openManualCreate = () => {
    // Compute first SN synchronously only if auto-generate is on
    const firstSN = (snPrefix && snAutoGenerate) ? `${snPrefix}-${String(snCounterBase + 1).padStart(2, "0")}` : "";
    if (firstSN) snLocalCounterRef.current = 1;
    resetManualCreate(firstSN);
    setManualCreateOpen(true);
  };

  const updateManualItem = (
    index: number,
    field: keyof PurchaseBillItem,
    value: any,
  ) => {
    const items = [...manualBill.items];
    const item = { ...items[index] };
    const normalizedValue =
      field === "description" && typeof value === "string"
        ? value.toUpperCase()
        : value;
    (item as any)[field] = normalizedValue;
    item.quantity = 1;
    item.unit = "pcs";

    if (field === "quantity" || field === "rate") {
      item.amount = item.quantity * item.rate;
      item.gstRate = 0;
      item.gstAmount = 0;
      if (field === "rate") {
        (item as any).sellingPrice =
          calculateSellingPriceFromCommission(
            Number(item.rate) || 0,
            companyProfile?.commissionSettings,
          ) + (Number((item as any).repairCost) || 0);
      }
    }

    items[index] = item;
    setManualBill((prev) => ({ ...prev, items }));
  };

  const handleManualProductSelect = (index: number, product: any) => {
    const items = [...manualBill.items];
    const item = { ...items[index] };

    const modelName = (product.model || product.name || "").toUpperCase();
    item.description = modelName;
    item.rate = product.purchasePrice ?? item.rate;
    (item as any).sellingPrice =
      (Number((product as any).sellingPrice || 0) > 0
        ? Number((product as any).sellingPrice || 0)
        : calculateSellingPriceFromCommission(
          Number(item.rate) || 0,
          companyProfile?.commissionSettings,
        )
      ) + (Number((item as any).repairCost) || 0);
    item.hsnCode = "";
    item.gstRate = 0;
    item.unit = "pcs";
    item.itemNo = product.itemNo || item.itemNo || "";
    item.model = modelName || item.model || "";
    item.imeiNumber = product.imeiNumber || item.imeiNumber || "";
    item.storage = product.storage || item.storage || "";
    item.color = product.color || item.color || "";

    if (normalizeImei(item.imeiNumber)) {
      item.quantity = 1;
      item.unit = "pcs";
    }
    item.amount = item.quantity * item.rate;
    item.gstAmount = 0;

    items[index] = item;
    setManualBill((prev) => ({ ...prev, items }));
  };

  const handleCreateProductFromManualItem = (index: number) => {
    setCreateProductForIndex(index);
    setCreateProductOpen(true);
  };

  const handleEnterWithText = async (index: number, text: string) => {
    const normalizedText = text.toUpperCase();
    const newProduct = {
      id: crypto.randomUUID(),
      name: normalizedText,
      model: normalizedText,
      variantKey: normalizedText.toLowerCase().trim(),
      trackingType: "serialized" as const,
      itemNo: "",
      imeiNumber: "",
      storage: "",
      color: "",
      barcode: "",
      unit: "pcs",
      price: 0,
      purchasePrice: 0,
      sellingPrice: 0,
      stock: 0,
      whereToBuy: "",
      vendorId: "",
      weight: 0,
      weightUnit: "g" as const,
      createdAt: new Date().toISOString(),
      imageUrl: "",
    };
    await saveProduct(newProduct);
    setProducts((prev) => [...prev, newProduct]);
    handleManualProductSelect(index, newProduct);
  };

  const getNextSN = (): string => {
    if (!snPrefix || !snAutoGenerate) return "";
    const n = snCounterBase + snLocalCounterRef.current + 1;
    snLocalCounterRef.current += 1;
    return `${snPrefix}-${String(n).padStart(2, "0")}`;
  };

  const addManualItemRow = () => {
    const sn = getNextSN();
    setManualBill((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          description: "",
          hsnCode: "",
          itemNo: "",
          model: "",
          serialNumber: sn,
          imeiNumber: "",
          storage: "",
          color: "",
          quantity: 1,
          unit: "pcs",
          rate: 0,
          sellingPrice: 0,
          amount: 0,
          gstRate: 0,
          gstAmount: 0,
          whereToBuy: prev.vendorName || "",
        },
      ],
    }));
  };

  const removeManualItemRow = (index: number) => {
    setManualBill((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleManualImageSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setIsCompressing(true);
    try {
      const compressedBase64 = await compressFile(file, 900);
      const sizeKB = getBase64SizeKB(compressedBase64);
      if (sizeKB > 1000) {
        toast({
          title: "Image Too Large",
          description: `Image is ${sizeKB.toFixed(0)} KB. Please try another image.`,
          variant: "destructive",
        });
        return;
      }

      setManualBill((prev) => ({ ...prev, billImage: compressedBase64 }));
      toast({
        title: "Image Added",
        description: "Image attached successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process image",
        variant: "destructive",
      });
    } finally {
      setIsCompressing(false);
      e.target.value = "";
    }
  };

  // Shared helper — fetches party payments for a vendor and applies them FIFO to a bill
  const applyVendorAdvanceToBill = async (billId: string, vendorId: string, billTotal: number) => {
    const allPayments = await getPartyPayments();
    const advances = allPayments
      .filter((p) => p.partyId === vendorId && p.type === "sent")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (!advances.length) return;
    let remaining = billTotal;
    for (const pp of advances) {
      if (remaining < 0.5) break;
      const allocate = Math.min(pp.amount, remaining);
      try {
        await updatePurchaseBillPayment(billId, allocate, pp.method, pp.note || "Applied from advance payment", pp.date, undefined, pp.bankAccountId);
        remaining -= allocate;
        if (pp.amount - allocate < 0.5) {
          await deletePartyPayment(pp.id);
        } else {
          await deletePartyPayment(pp.id);
          await savePartyPayment({ ...pp, id: crypto.randomUUID(), amount: pp.amount - allocate });
        }
      } catch (err) {
        console.error("Failed to apply advance payment:", err);
      }
    }
  };

  const handleSaveManualBill = async () => {
    if (isSaving) return;
    if (locked) { toast({ title: "Error", description: "Unable to save. Check your connection.", variant: "destructive" }); return; }
    setIsSaving(true);

    try {
      // M13: refresh inventory units from Firestore before IMEI conflict check
      const freshUnits = await getInventoryUnits();
      setInventoryUnits(freshUnits);
      let finalClientId = manualBill.clientId;
      let finalVendorId = manualBill.vendorId;
      let finalVendorName = manualBill.vendorName?.trim() || "";
      let finalVendorAddress = manualBill.vendorAddress?.trim() || "";
      let finalVendorGstin = manualBill.vendorGstin?.trim() || "";

      if (manualVendorMode === "select") {
        if (!finalClientId) {
          toast({
            title: "Party Required",
            description: "Please select a party or switch to Create Party.",
            variant: "destructive",
          });
          return;
        }

        const selectedParty = parties.find((p) => p.id === finalClientId);
        if (!selectedParty) {
          toast({
            title: "Invalid Party",
            description: "Selected party was not found.",
            variant: "destructive",
          });
          return;
        }

        finalVendorName = selectedParty.name;
        finalVendorAddress = selectedParty.billingAddress || "";
        finalVendorGstin = "";
      } else {
        const name = manualVendorForm.name.trim();
        if (!name) {
          toast({
            title: "Party Name Required",
            description: "Enter party name to create a new party.",
            variant: "destructive",
          });
          return;
        }

        const newClient: Client = {
          id: crypto.randomUUID(),
          name,
          billingAddress: manualVendorForm.address.trim(),
          phone: manualVendorForm.phone.trim(),
          email: manualVendorForm.email.trim(),
          openingBalance: Math.abs(parseFloat(manualVendorForm.openingBalance) || 0),
          openingBalanceType: (manualVendorForm.openingBalanceType || "receivable") as any,
          creditLimit: parseFloat(manualVendorForm.creditLimit) || 0,
          createdAt: new Date().toISOString(),
        };

        await saveClient(newClient);
        await loadVendors();
        finalClientId = newClient.id;
        finalVendorName = newClient.name;
        finalVendorAddress = newClient.billingAddress;
        finalVendorGstin = "";
      }

      const mappedItems = manualBill.items.map((item) => {
          const description = item.description.trim();
          const quantity = 1;
          const rate = Number(item.rate) || 0;
          const sellingPriceRaw = Number((item as any).sellingPrice);
          const sellingPrice =
            Number.isFinite(sellingPriceRaw) && sellingPriceRaw > 0
              ? roundToTwoDecimals(sellingPriceRaw)
              : calculateSellingPriceFromCommission(
                rate,
                companyProfile?.commissionSettings,
              ) + (Number((item as any).repairCost) || 0);
          const amount = quantity * rate;
          return {
            ...item,
            description,
            quantity,
            rate,
            sellingPrice,
            hsnCode: "",
            gstRate: 0,
            amount,
            gstAmount: 0,
            unit: "pcs",
            whereToBuy: item.whereToBuy || finalVendorName,
          };
        });

      // Apply repair costs from separate repairCosts state into item fields
      for (const rc of repairCosts) {
        if (rc.itemIndex >= 0 && rc.itemIndex < mappedItems.length && rc.amount > 0) {
          (mappedItems[rc.itemIndex] as any).repairCost = rc.amount;
          if (rc.notes.trim()) (mappedItems[rc.itemIndex] as any).repairCostNotes = rc.notes.trim();
        }
      }

      // Completely blank rows (no description AND no IMEI AND no price) are silently dropped.
      // Partially-filled rows (e.g. IMEI entered but no model name) are kept so validation
      // can surface a clear error instead of silently losing the device.
      const isBlankRow = (item: typeof mappedItems[0]) =>
        !item.description &&
        !String((item as any).imeiNumber || "").trim() &&
        !String((item as any).serialNumber || "").trim() &&
        !(Number(item.rate) > 0);

      const cleanedItems = mappedItems.filter((item) => !isBlankRow(item));

      if (cleanedItems.length < mappedItems.length) {
        const dropped = mappedItems.length - cleanedItems.length;
        console.info(`${dropped} completely blank row(s) removed before save.`);
      }

      const manualValidationError = validatePhoneItemRules(cleanedItems, {
        checkAgainstProducts: false,
      });
      if (manualValidationError) {
        toast({
          title: "Invalid Item Data",
          description: manualValidationError,
          variant: "destructive",
        });
        return;
      }

      const manualRequiredFieldsError =
        validateRequiredPurchaseItemFields(cleanedItems);
      if (manualRequiredFieldsError) {
        toast({
          title: "Missing Item Details",
          description: manualRequiredFieldsError,
          variant: "destructive",
        });
        return;
      }

      if (cleanedItems.length === 0) {
        toast({
          title: "Items Required",
          description: "Add at least one valid item with quantity greater than 0.",
          variant: "destructive",
        });
        return;
      }

      const subtotal = cleanedItems.reduce((sum, item) => sum + item.amount, 0);
      const totalTax = 0;
      const courierChargesNum = manualBill.courierCharges || 0;
      const expenseNum = manualBill.expenseAmount || 0;
      const total = subtotal + courierChargesNum + expenseNum;

      const finalBillNumber = manualBill.billNumber?.trim() || getNextPurchaseBillNumber();
      if (
        finalBillNumber &&
        (await isPurchaseBillDuplicate(
          finalBillNumber,
          finalVendorName,
        ))
      ) {
        toast({
          title: "Duplicate Bill",
          description: `Bill #${finalBillNumber} from ${finalVendorName} already exists.`,
          variant: "destructive",
        });
        return;
      }

      const _nowPB = new Date();
      let billDateIso: string;
      if (manualBill.billDate) {
        const [_y, _m, _d] = manualBill.billDate.split("-").map(Number);
        billDateIso = new Date(_y, _m - 1, _d, _nowPB.getHours(), _nowPB.getMinutes(), _nowPB.getSeconds(), _nowPB.getMilliseconds()).toISOString();
      } else {
        billDateIso = _nowPB.toISOString();
      }

      let dueDateIso: string | undefined;
      if (manualBill.dueDate) {
        dueDateIso = new Date(manualBill.dueDate).toISOString();
      } else if ((manualBill.paymentTerms || 0) > 0) {
        const d = new Date(billDateIso);
        d.setDate(d.getDate() + (manualBill.paymentTerms || 0));
        dueDateIso = d.toISOString();
      }

      // H5: atomically reserve SN range and reassign SNs before saving
      if (snPrefix && snAutoGenerate) {
        const autoItems = cleanedItems.filter((item) =>
          (item.serialNumber || "").toUpperCase().startsWith(`${snPrefix.toUpperCase()}-`)
        );
        if (autoItems.length > 0) {
          try {
            const firstNum = await incrementSnCounter(autoItems.length, snCounterBase);
            let snIdx = 0;
            cleanedItems.forEach((item) => {
              if ((item.serialNumber || "").toUpperCase().startsWith(`${snPrefix.toUpperCase()}-`)) {
                (item as any).serialNumber = `${snPrefix}-${String(firstNum + snIdx).padStart(2, "0")}`;
                snIdx++;
              }
            });
            setSnCounterBase(firstNum + autoItems.length - 1);
            snLocalCounterRef.current = 0;
          } catch (snErr) {
            console.error("Failed to atomically reserve SN range:", snErr);
          }
        }
      }

      const now = new Date().toISOString();
      const newBillId = crypto.randomUUID();

      let invoiceFileUrl: string | undefined;
      let invoiceStoragePath: string | undefined;
      let invoiceFileName: string | undefined;
      let invoiceFileType: string | undefined;
      if (manualBill.isInvoice && manualInvoiceFile) {
        try {
          setInvoiceUploading(true);
          const uploaded = await uploadPurchaseBillInvoice(newBillId, manualInvoiceFile);
          invoiceFileUrl = uploaded.url;
          invoiceStoragePath = uploaded.storagePath;
          invoiceFileName = manualInvoiceFile.name;
          invoiceFileType = manualInvoiceFile.type;
        } catch (err) {
          console.error("Failed to upload invoice:", err);
          toast({
            title: "Invoice upload failed",
            description: "Bill will be saved without the invoice file.",
            variant: "destructive",
          });
        } finally {
          setInvoiceUploading(false);
        }
      }

      const newBill: PurchaseBill = {
        id: newBillId,
        billImage: manualBill.billImage || "",
        clientId: finalClientId,
        vendorId: finalVendorId,
        vendorName: finalVendorName,
        vendorAddress: finalVendorAddress,
        vendorGstin: finalVendorGstin,
        billNumber: finalBillNumber,
        billDate: billDateIso,
        dueDate: dueDateIso,
        paymentTerms: manualBill.paymentTerms || 0,
        notes: manualBill.notes?.trim() || undefined,
        courierCharges: courierChargesNum,
        expenseAmount: expenseNum,
        items: cleanedItems,
        subtotal,
        totalTax,
        total,
        paymentStatus: "pending",
        paidAmount: 0,
        payments: [],
        extractionErrors: [],
        isInvoice: !!manualBill.isInvoice,
        invoiceFileUrl,
        invoiceStoragePath,
        invoiceFileName,
        invoiceFileType,
        createdAt: now,
        updatedAt: now,
      };

      // Block creation if any IMEI/serial is already in stock
      const imeiErrors = await validatePurchaseBillImeis(cleanedItems);
      if (imeiErrors.length > 0) {
        toast({
          title: "IMEI / Serial Conflict",
          description: imeiErrors.join("\n"),
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      await savePurchaseBill(newBill);

      // Auto-apply any existing vendor advance to this bill (oldest payments first)
      const advanceVendorId = finalClientId || finalVendorId;
      if (advanceVendorId) {
        await applyVendorAdvanceToBill(newBillId, advanceVendorId, total);
      }

      // Record vendor payment now if requested
      if (collectPaymentOnCreate) {
        const payAmt = parseFloat(createPayment.amount);
        if (payAmt > 0) {
          if (createPayment.method !== "Cash" && !createPayment.bankAccountId) {
            toast({
              title: "Bank account required",
              description: "Please select a bank account for this payment method.",
              variant: "destructive",
            });
            setIsSaving(false);
            return;
          }
          try {
            await updatePurchaseBillPayment(
              newBillId,
              payAmt,
              createPayment.method as PaymentMethod,
              createPayment.note || undefined,
              createPayment.date ? (() => { const _n = new Date(); const [_y, _m, _d] = createPayment.date.split("-").map(Number); return new Date(_y, _m - 1, _d, _n.getHours(), _n.getMinutes(), _n.getSeconds(), _n.getMilliseconds()).toISOString(); })() : undefined,
              undefined,
              createPayment.method === "Cash" ? undefined : createPayment.bankAccountId || undefined,
            );
          } catch (payErr) {
            console.error("Vendor payment record failed:", payErr);
          }
        }
      }

      let needsInventoryDialog = false;
      try {
        await autoAddBillToInventory(newBill);
      } catch (inventoryError) {
        console.error("Auto inventory add failed:", inventoryError);
        needsInventoryDialog = true;
      }
      await loadBills();
      setManualCreateOpen(false);
      resetManualCreate();
      // Refresh bill to get updated payment
      const refreshed = (await getPurchaseBills()).find((b) => b.id === newBillId) || newBill;
      setSelectedBill(refreshed);

      if (needsInventoryDialog) {
        toast({
          title: "Bill Created — Action Needed",
          description: "Could not auto-add items to inventory. Please complete the inventory step.",
          variant: "destructive",
        });
        setTimeout(() => handleAddToInventory(refreshed), 800);
      } else {
        toast({
          title: "Success",
          description: "Purchase bill created and inventory updated",
        });
      }
    } catch (error) {
      console.error("Error creating purchase bill manually:", error);
      toast({
        title: "Error",
        description: "Failed to create purchase bill",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (locked) { toast({ title: "Error", description: "Unable to save. Check your connection.", variant: "destructive" }); return; }
    setIsDeleting(id);
    try {
      await deletePurchaseBill(id);
      await loadBills();
      toast({
        title: "Deleted",
        description: "Purchase bill deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting bill:", error);
      toast({
        title: "Error",
        description: "Failed to delete bill",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handlePaymentCollected = async (
    amount: number,
    type: any,
    note?: string,
    date?: string,
    bankAccountId?: string,
  ) => {
    if (selectedBillForPayment) {
      setLoadingPayment(selectedBillForPayment.id);
      try {
        // Handle negative amount for overpayment collection
        const actualAmount = amount;

        await updatePurchaseBillPayment(
          selectedBillForPayment.id,
          actualAmount,
          type,
          note,
          date,
          undefined,
          bankAccountId,
        );
        const refreshedBills = await loadBills();
        const refreshedBill = refreshedBills.find(
          (b) => b.id === selectedBillForPayment.id,
        );
        if (refreshedBill) {
          setSelectedBill(refreshedBill);
          setSelectedBillForPayment(refreshedBill);
        }
        toast({
          title:
            actualAmount < 0 ? "Overpayment Collected" : "Payment Recorded",
          description: `${actualAmount < 0 ? "Collected" : "Recorded"} ${formatCurrency(Math.abs(actualAmount))} via ${type}.`,
        });
      } catch (error) {
        console.error("Error collecting payment:", error);
        toast({
          title: "Error",
          description: "Failed to record payment",
          variant: "destructive",
        });
      } finally {
        setLoadingPayment(null);
      }
    }
  };

  const openPaymentDialog = (bill: PurchaseBill) => {
    setSelectedBillForPayment(bill);
    setPaymentDialogOpen(true);
  };

  const handleTogglePayment = async (bill: PurchaseBill) => {
    // Legacy support or fallback
    openPaymentDialog(bill);
  };

  const buildInventoryInputsFromBill = (bill: PurchaseBill): InventoryItemInput[] =>
    bill.items.map((item) => ({
      description: item.description,
      hsnCode: "",
      itemNo: (item as any).itemNo || "",
      model: (item as any).model || "",
      imeiNumber: (item as any).imeiNumber || "",
      serialNumber: (item as any).serialNumber || "",
      storage: (item as any).storage || "",
      color: (item as any).color || "",
      batteryHealth: (item as any).batteryHealth || undefined,
      warranty: (item as any).warranty || undefined,
      // IMEI/serial items are always 1 unit each; non-serialized items use the actual bill quantity.
      quantity: ((item as any).imeiNumber || (item as any).serialNumber) ? 1 : (item.quantity || 1),
      unit: "pcs",
      purchasePrice: Number(item.rate) || 0,
      sellingPrice:
        Number((item as any).sellingPrice || 0) > 0
          ? Number((item as any).sellingPrice || 0)
          : calculateSellingPriceFromCommission(
            Number(item.rate) || 0,
            companyProfile?.commissionSettings,
          ) + (Number((item as any).repairCost) || 0),
      repairCost: Number((item as any).repairCost || 0) || undefined,
      gstRate: 0,
      vendorId: bill.vendorId || "",
    }));

  const autoAddBillToInventory = async (bill: PurchaseBill): Promise<void> => {
    const isAdded = await isPurchaseBillInventoryAdded(bill.id);
    if (bill.itemsAddedToInventory || isAdded) return;
    const itemsInput = buildInventoryInputsFromBill(bill);
    if (itemsInput.length === 0) return;
    const result = await addPurchaseItemsToInventory(bill, itemsInput);
    if (result.conflicts && result.conflicts.length > 0) {
      throw new Error("Some items could not be auto-mapped to inventory.");
    }
  };

  const handleAddToInventory = async (bill: PurchaseBill) => {
    // Check if already added using the storage function
    const isAdded = await isPurchaseBillInventoryAdded(bill.id);
    if (bill.itemsAddedToInventory || isAdded) {
      toast({
        title: "Already Added",
        description: `Items were added to inventory on ${formatDate(
          bill.inventoryAddedAt || bill.createdAt,
        )}`,
        variant: "destructive",
      });
      return;
    }

    // Open dialog to confirm inventory mapping details before add
    const products = await getProducts();
    const items = bill.items.map((item) => {
      const itemVariantSensitive = isVariantSensitiveItem(item);
      const itemVariantKey = buildVariantKey(item);
      const existingProduct = itemVariantSensitive
        ? products.find((p) => buildVariantKey(p) === itemVariantKey)
        : products.find(
          (p) =>
            p.name.toLowerCase() === item.description.toLowerCase() ||
            p.hsnCode === item.hsnCode,
        );

      return {
        description: item.description,
        itemNo: (item as any).itemNo || "",
        model: (item as any).model || "",
        imeiNumber: (item as any).imeiNumber || "",
        serialNumber: (item as any).serialNumber || "",
        imeiListText: (item as any).imeiNumber || "",
        storage: (item as any).storage || "",
        color: (item as any).color || "",
        hsnCode: item.hsnCode || "",
        barcode: "", // Added barcode field for inventory addition
        quantity: 1,
        unit: "pcs",
        purchasePrice: item.rate,
        sellingPrice:
          Number((item as any).sellingPrice || 0) > 0
            ? Number((item as any).sellingPrice || 0)
            : calculateSellingPriceFromCommission(
              Number(item.rate) || 0,
              companyProfile?.commissionSettings,
            ) + (Number((item as any).repairCost) || 0),
        gstRate: item.gstRate || 0,
        whereToBuy: (item as any).whereToBuy || bill.vendorName || "",
        weight: (item as any).weight || 0,
        weightUnit: (item as any).weightUnit || "g",
        vendorId: bill.clientId || bill.vendorId || "",
        productId: existingProduct?.id,
        isNewProduct: !existingProduct,
      };
    });

    setInventoryItems(items);
    setInventoryDialogBill(bill);

    // Update the bill object itself if vendor is selected in the inventory items
    // This ensures that when confirmAddToInventory is called, the bill already has the vendor
    if (items.length > 0 && items[0].vendorId) {
      const party = parties.find((p) => p.id === items[0].vendorId);
      if (party) {
        setSelectedBill({
          ...bill,
          clientId: party.id,
          vendorName: party.name,
          vendorAddress: party.billingAddress || "",
        });
      }
    }
  };

  const confirmAddToInventory = async (
    conflictResolutions?: Map<string, string>,
  ) => {
    if (!inventoryDialogBill) return;

    setLoadingInventory(inventoryDialogBill.id);
    try {
      // First update the bill with the selected vendor if it has changed
      // Use the vendor from the first inventory item as they should be consistent
      const firstItemVendorId = inventoryItems[0]?.vendorId;
      if (firstItemVendorId) {
        const party = parties.find((p) => p.id === firstItemVendorId);
        if (party) {
          const updatedBill = {
            ...inventoryDialogBill,
            clientId: party.id,
            vendorName: party.name,
            vendorAddress: party.billingAddress || "",
          };
          await updatePurchaseBill(updatedBill);
          // Update the local bills state
          setBills((prev) =>
            prev.map((b) => (b.id === updatedBill.id ? updatedBill : b)),
          );
          // If this bill is currently selected, update that too
          if (selectedBill && selectedBill.id === updatedBill.id) {
            setSelectedBill(updatedBill);
          }
        }
      }

      const inventoryValidationError = validatePhoneItemRules(inventoryItems, {
        checkAgainstProducts: true,
        requireInventoryFields: true,
        allowListQuantity: true,
      });
      if (inventoryValidationError) {
        toast({
          title: "Invalid Inventory Data",
          description: inventoryValidationError,
          variant: "destructive",
        });
        setLoadingInventory(null);
        return;
      }

      for (let i = 0; i < inventoryItems.length; i += 1) {
        const row = inventoryItems[i];
        const rowImeis = getInventoryRowImeis(row);
        const rowLabel = row.description?.trim() || `Item ${i + 1}`;
        if (isSerializedInventoryRow(row)) {
          if (rowImeis.length === 0) {
            toast({
              title: "Serialized IMEI Required",
              description: `${rowLabel}: add IMEI list for serialized item.`,
              variant: "destructive",
            });
            setLoadingInventory(null);
            return;
          }
          if (Number(row.quantity) !== rowImeis.length) {
            toast({
              title: "IMEI Count Mismatch",
              description: `${rowLabel}: quantity ${row.quantity} must match ${rowImeis.length} IMEI entries.`,
              variant: "destructive",
            });
            setLoadingInventory(null);
            return;
          }
        }
      }

      const itemsInput: InventoryItemInput[] = inventoryItems.flatMap((item) => {
        const rowImeis = getInventoryRowImeis(item);
        const serialized = isSerializedInventoryRow(item);
        const base = {
          description: item.description,
          itemNo: item.itemNo || "",
          model: item.model || "",
          storage: item.storage || "",
          color: item.color || "",
          batteryHealth: item.batteryHealth || undefined,
          warranty: item.warranty || undefined,
          hsnCode: item.hsnCode,
          barcode: item.barcode,
          vendorId: item.vendorId,
          purchasePrice: item.purchasePrice,
          sellingPrice:
            Number((item as any).sellingPrice || 0) > 0
              ? Number((item as any).sellingPrice || 0)
              : calculateSellingPriceFromCommission(
                Number(item.purchasePrice) || 0,
                companyProfile?.commissionSettings,
              ) + (Number((item as any).repairCost) || 0),
          gstRate: item.gstRate,
          productId: item.productId,
          isNewProduct: item.isNewProduct,
          whereToBuy: item.isNewProduct
            ? (inventoryDialogBill as any).vendorName
            : undefined,
          weight: item.weight,
          weightUnit: item.weightUnit,
        };
        if (!serialized) {
          return [
            {
              ...base,
              imeiNumber: "",
              quantity: item.quantity,
              unit: item.unit,
            },
          ] satisfies InventoryItemInput[];
        }
        return rowImeis.map(
          (imei) =>
            ({
              ...base,
              imeiNumber: imei,
              quantity: 1,
              unit: "pcs",
            }) satisfies InventoryItemInput,
        );
      });

      const seenInputImeis = new Set<string>();
      for (const inputItem of itemsInput) {
        const normalizedImei = normalizeImei(inputItem.imeiNumber);
        if (!normalizedImei) continue;
        if (seenInputImeis.has(normalizedImei)) {
          toast({
            title: "Duplicate IMEI",
            description: `Duplicate IMEI/Serial found in inventory entries: ${inputItem.imeiNumber}`,
            variant: "destructive",
          });
          setLoadingInventory(null);
          return;
        }
        seenInputImeis.add(normalizedImei);
      }

      const result = await addPurchaseItemsToInventory(
        inventoryDialogBill,
        itemsInput,
        conflictResolutions,
      );

      // Check if there are conflicts
      if (result.conflicts && result.conflicts.length > 0) {
        // Store the data for later use
        setPendingInventoryBill(inventoryDialogBill);
        setPendingInventoryItems(itemsInput);
        setProductConflicts(result.conflicts);
        setInventoryDialogBill(null); // Close inventory mapping dialog
        setLoadingInventory(null);
        return;
      }

      // Fetch newly added units for barcode printing
      setInventoryDialogBill(null);
      setInventoryItems([]);

      toast({
        title: "Added to Inventory",
        description: `${result.added} new product(s), ${result.updated} updated`,
      });


      // Reload bills and inventory units so barcode print/download sees the new units.
      try {
        await Promise.all([loadBills(), loadProducts()]);
      } catch (reloadErr) {
        const details = formatErrorForUser(reloadErr);
        setLastInventoryError(details);
        toast({
          title: "Added, but refresh failed",
          description:
            "Inventory was updated, but the list couldn't refresh. Open details and copy the error if it keeps happening.",
          variant: "destructive",
        });
      }

      // Update selectedBill state if it matches
      if (selectedBill && selectedBill.id === inventoryDialogBill.id) {
        setSelectedBill({
          ...selectedBill,
          itemsAddedToInventory: true,
          inventoryAddedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error adding to inventory:", error);
      const details = formatErrorForUser(error);
      setLastInventoryError(details);
      toast({
        title: "Error",
        description:
          "Failed to add items to inventory. Tap 'Details' to copy the error.",
        variant: "destructive",
      });
    } finally {
      setLoadingInventory(null);
    }
  };

  const handleConflictCancel = () => {
    setProductConflicts([]);
    setPendingInventoryBill(null);
    setPendingInventoryItems([]);
  };

  const handleConflictResolution = async (resolutions: Map<string, string>) => {
    if (!pendingInventoryBill || !pendingInventoryItems) return;

    setLoadingInventory(pendingInventoryBill.id);
    try {
      const conflictValidationError = validatePhoneItemRules(
        pendingInventoryItems,
        {
          checkAgainstProducts: true,
          requireInventoryFields: true,
        },
      );
      if (conflictValidationError) {
        toast({
          title: "Invalid Inventory Data",
          description: conflictValidationError,
          variant: "destructive",
        });
        return;
      }

      const result = await addPurchaseItemsToInventory(
        pendingInventoryBill,
        pendingInventoryItems,
        resolutions,
      );

      await loadBills();

      if (selectedBill && selectedBill.id === pendingInventoryBill.id) {
        setSelectedBill({
          ...selectedBill,
          itemsAddedToInventory: true,
          inventoryAddedAt: new Date().toISOString(),
        });
      }

      setProductConflicts([]);
      setPendingInventoryBill(null);
      setPendingInventoryItems([]);

      toast({
        title: "Added to Inventory",
        description: `${result.added} new product(s), ${result.updated} updated`,
      });
    } catch (error) {
      console.error("Error adding to inventory:", error);
      toast({
        title: "Error",
        description: "Failed to add items to inventory",
        variant: "destructive",
      });
    } finally {
      setLoadingInventory(null);
    }
  };

  const startEditing = (bill: PurchaseBill) => {
    const clone: PurchaseBill = JSON.parse(JSON.stringify(bill));
    // Auto-fill item-level "Bought from" with Vendor Name if missing
    clone.items = (clone.items || []).map((it) => ({
      ...it,
      whereToBuy:
        (it as any).whereToBuy && String((it as any).whereToBuy).trim()
          ? (it as any).whereToBuy
          : clone.vendorName || "",
    }));
    setEditedBill(clone);
    // Populate editRepairCosts from existing repairCost fields on items
    setEditRepairCosts(
      (clone.items || []).reduce<Array<{ itemIndex: number; amount: number; notes: string }>>((acc, item, idx) => {
        const cost = Number((item as any).repairCost || 0);
        if (cost > 0) acc.push({ itemIndex: idx, amount: cost, notes: (item as any).repairCostNotes || "" });
        return acc;
      }, [])
    );
    setIsEditing(true);
  };

  const addEditedItemRow = () => {
    if (!editedBill) return;
    const newItem: PurchaseBillItem = {
      description: "",
      hsnCode: "",
      itemNo: "",
      model: "",
      imeiNumber: "",
      storage: "",
      color: "",
      quantity: 1,
      unit: "pcs",
      rate: 0,
      sellingPrice: 0,
      amount: 0,
      gstRate: 0,
      gstAmount: 0,
      whereToBuy: editedBill.vendorName || "",
      weight: 0,
      hasError: false,
    };
    setEditedBill({ ...editedBill, items: [...editedBill.items, newItem] });
  };

  const removeEditedItemRow = (index: number) => {
    if (!editedBill) return;
    const items = editedBill.items.filter((_, i) => i !== index);
    setEditedBill({ ...editedBill, items });
  };

  const saveEditedBill = async () => {
    if (!editedBill) return;

    setSavingEditedBill(true);
    try {
      // M13: refresh inventory units so IMEI conflict and sync logic sees current state
      const freshUnits = await getInventoryUnits();
      setInventoryUnits(freshUnits);
      const normalizedItems = (editedBill.items || [])
        .map((item) => {
          const description = (item.description || "").trim();
          const quantity = 1;
          const rate = Number(item.rate) || 0;
          const sellingPriceRaw = Number((item as any).sellingPrice);
          const sellingPrice =
            Number.isFinite(sellingPriceRaw) && sellingPriceRaw > 0
              ? roundToTwoDecimals(sellingPriceRaw)
              : calculateSellingPriceFromCommission(
                rate,
                companyProfile?.commissionSettings,
              ) + (Number((item as any).repairCost) || 0);
          const amount = quantity * rate;
          return {
            ...item,
            description,
            quantity: 1,
            unit: "pcs",
            rate,
            sellingPrice,
            hsnCode: "",
            gstRate: 0,
            amount,
            gstAmount: 0,
            hasError: false,
            errorMessage: undefined,
          };
        })
        .filter((item) => item.description && item.quantity > 0);

      // Apply repair costs from editRepairCosts state into normalized item fields
      for (const rc of editRepairCosts) {
        if (rc.itemIndex >= 0 && rc.itemIndex < normalizedItems.length && rc.amount > 0) {
          (normalizedItems[rc.itemIndex] as any).repairCost = rc.amount;
          if (rc.notes.trim()) (normalizedItems[rc.itemIndex] as any).repairCostNotes = rc.notes.trim();
        }
      }
      // Clear repairCost from items not in editRepairCosts
      normalizedItems.forEach((item, idx) => {
        if (!editRepairCosts.some((rc) => rc.itemIndex === idx && rc.amount > 0)) {
          delete (item as any).repairCost;
          delete (item as any).repairCostNotes;
        }
      });

      const editedValidationError = validatePhoneItemRules(normalizedItems, {
        checkAgainstProducts: false,
      });
      if (editedValidationError) {
        toast({
          title: "Invalid Item Data",
          description: editedValidationError,
          variant: "destructive",
        });
        return;
      }

      const editedRequiredFieldsError =
        validateRequiredPurchaseItemFields(normalizedItems);
      if (editedRequiredFieldsError) {
        toast({
          title: "Missing Item Details",
          description: editedRequiredFieldsError,
          variant: "destructive",
        });
        return;
      }

      if (normalizedItems.length === 0) {
        toast({
          title: "Items Required",
          description: "Add at least one valid item with quantity greater than 0.",
          variant: "destructive",
        });
        return;
      }

      // Recalculate totals — preserve courier and extra charges from the bill
      const subtotal = normalizedItems.reduce(
        (sum, item) => sum + item.amount,
        0,
      );
      const courierCharges = Number(editedBill.courierCharges) || 0;
      const expenseAmount = Number(editedBill.expenseAmount) || 0;
      const totalTax = 0;
      const total = subtotal + courierCharges + expenseAmount;

      // H14: warn if payment integrity is affected by total change
      const prevTotal = editedBill.total || 0;
      const paidSoFar = editedBill.paidAmount || 0;
      if (Math.abs(total - prevTotal) > 0.01 && paidSoFar > 0) {
        if (paidSoFar > total) {
          const ok = window.confirm(
            `The new total (${formatCurrency(total)}) is less than what has already been paid (${formatCurrency(paidSoFar)}).\n\nThe bill will show an overpaid status. Continue?`
          );
          if (!ok) return;
        } else if (paidSoFar < total) {
          const ok = window.confirm(
            `Total changed from ${formatCurrency(prevTotal)} to ${formatCurrency(total)}.\n\nPaid so far: ${formatCurrency(paidSoFar)} — outstanding balance will update to ${formatCurrency(total - paidSoFar)}. Continue?`
          );
          if (!ok) return;
        }
      }

      const updatedBill: PurchaseBill = {
        ...editedBill,
        items: normalizedItems,
        subtotal,
        totalTax,
        total,
        extractionErrors: [], // Clear errors after manual fix
        updatedAt: new Date().toISOString(),
      };

      await updatePurchaseBill(updatedBill);
      await syncBillPricesToInventory(updatedBill);
      const [, syncedUnits] = await Promise.all([loadBills(), getInventoryUnits()]);
      setInventoryUnits(syncedUnits);
      if (selectedBill && selectedBill.id === updatedBill.id) {
        setSelectedBill(updatedBill);
      }
      setIsEditing(false);
      setEditedBill(null);
      setEditRepairCosts([]);

      toast({
        title: "Saved",
        description: "Bill updated successfully",
      });
    } catch (error) {
      console.error("Error saving edited bill:", error);
      toast({
        title: "Error",
        description: "Failed to save bill",
        variant: "destructive",
      });
    } finally {
      setSavingEditedBill(false);
    }
  };

  const updateEditedItem = (
    index: number,
    field: keyof PurchaseBillItem,
    value: any,
  ) => {
    if (!editedBill) return;

    const items = [...editedBill.items];
    const item = { ...items[index] };

    const normalizedValue =
      field === "description" && typeof value === "string"
        ? value.toUpperCase()
        : value;
    (item as any)[field] = normalizedValue;
    item.quantity = 1;
    item.unit = "pcs";

    // Recalculate amount
    if (field === "quantity" || field === "rate") {
      item.amount = item.quantity * item.rate;
      item.gstRate = 0;
      item.gstAmount = 0;
      if (field === "rate") {
        (item as any).sellingPrice =
          calculateSellingPriceFromCommission(
            Number(item.rate) || 0,
            companyProfile?.commissionSettings,
          ) + (Number((item as any).repairCost) || 0);
      }
    }

    // Clear error flag after edit
    item.hasError = false;
    item.errorMessage = undefined;

    items[index] = item;
    setEditedBill({ ...editedBill, items });
  };

  const handleProductSelect = (index: number, product: any) => {
    if (!editedBill) return;
    const items = [...editedBill.items];
    const item = { ...items[index] };

    const modelName = (product.model || product.name || "").toUpperCase();
    item.description = modelName;
    item.hsnCode = "";
    item.itemNo = product.itemNo || item.itemNo || "";
    item.model = modelName || item.model || "";
    item.imeiNumber = product.imeiNumber || item.imeiNumber || "";
    item.storage = product.storage || item.storage || "";
    item.color = product.color || item.color || "";

    // Update rate if available (assuming purchasePrice is the buying rate)
    if (product.purchasePrice) item.rate = product.purchasePrice;
    (item as any).sellingPrice =
      (Number((product as any).sellingPrice || 0) > 0
        ? Number((product as any).sellingPrice || 0)
        : calculateSellingPriceFromCommission(
          Number(item.rate) || 0,
          companyProfile?.commissionSettings,
        )
      ) + (Number((item as any).repairCost) || 0);

    item.gstRate = 0;

    // Update Unit
    item.unit = "pcs";
    if (normalizeImei(item.imeiNumber)) {
      item.quantity = 1;
      item.unit = "pcs";
    }

    // Recalculate amounts
    item.amount = item.quantity * item.rate;
    item.gstAmount = 0;

    // Clear error flag after edit
    item.hasError = false;
    item.errorMessage = undefined;

    items[index] = item;
    setEditedBill({ ...editedBill, items });
  };

  const isOverdue = (bill: PurchaseBill) => {
    if (bill.paymentStatus === "paid" || !bill.dueDate) return false;
    const dueDate = new Date(bill.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  const getDaysUntilDue = (bill: PurchaseBill) => {
    if (!bill.dueDate || bill.paymentStatus === "paid") return null;
    const dueDate = new Date(bill.dueDate);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPaymentStatusBadge = (bill: PurchaseBill) => {
    const isOverdueVal = isOverdue(bill);
    const status = bill.paymentStatus;
    const paidAmount = bill.paidAmount || 0;
    const netTotal =
      bill.total -
      (bill.returns?.reduce((sum, r) => sum + r.totalReturnValue, 0) || 0);
    const remaining = netTotal - paidAmount;

    if (remaining < 0) {
      return (
        <Badge variant="default" className="bg-orange-600 hover:bg-orange-700">
          <IndianRupee className="h-3 w-3 mr-1" /> Overpaid
        </Badge>
      );
    }

    if (remaining === 0) {
      return (
        <Badge
          variant="default"
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle className="h-3 w-3 mr-1" /> Paid
        </Badge>
      );
    }

    if (paidAmount > 0) {
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-400">
          <Clock className="h-3 w-3 mr-1" /> Partial (
          {formatCurrency(paidAmount)})
        </Badge>
      );
    }

    if (isOverdueVal || status === "overdue") {
      return (
        <Badge variant="destructive" className="animate-pulse">
          <AlertCircle className="h-3 w-3 mr-1" /> Overdue
        </Badge>
      );
    }

    const daysUntilDue = getDaysUntilDue(bill);
    if (daysUntilDue !== null && daysUntilDue <= 3) {
      return (
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-800 border-amber-300"
        >
          <Clock className="h-3 w-3 mr-1" /> Due in {daysUntilDue} day(s)
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" /> Pending
      </Badge>
    );
  };

  const manualSubtotal = manualBill.items.reduce(
    (sum, item) => sum + (item.amount || 0),
    0,
  );
  const manualTaxTotal = 0;
  const manualGrandTotal = manualSubtotal + (manualBill.courierCharges || 0) + (manualBill.expenseAmount || 0);
  const manualPreviewDueDate = (() => {
    if (manualBill.dueDate) return manualBill.dueDate;
    const billDate = manualBill.billDate;
    const terms = manualBill.paymentTerms || 0;
    if (!billDate || terms <= 0) return "";
    const d = new Date(billDate);
    if (Number.isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + terms);
    return d.toISOString().split("T")[0];
  })();
  const manualSelectedVendor = vendors.find((v) => v.id === manualBill.vendorId);
  const manualSelectedParty = parties.find((p) => p.id === manualBill.clientId);

  if (loading) {
    return (
      <div className="min-h-screen">
        <LoadingSpinner
          size="xl"
          text="Loading products..."
          fullScreen
          contentAreaOnly
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <datalist id="purchase-storage-options">
        {STORAGE_OPTIONS.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-background p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Receipt className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">Purchase</h1>
          </div>

          <input
            ref={manualImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleManualImageSelect}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="flex items-center gap-1.5">
            {/* <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-full items-center gap-2 rounded-xl bg-background lg:w-auto"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Manage
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 max-h-[60vh] overflow-y-auto overscroll-contain"
              >
                <DropdownMenuLabel>Bill Type</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setGstFilter("all")}>
                  {gstFilter === "all" ? "* " : ""}All Bills
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGstFilter("gst")}>
                  {gstFilter === "gst" ? "* " : ""}Tax Bills
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGstFilter("non-gst")}>
                  {gstFilter === "non-gst" ? "* " : ""}Non-Tax Bills
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Payment Status</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  {statusFilter === "all" ? "* " : ""}All Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("paid")}>
                  {statusFilter === "paid" ? "* " : ""}Paid
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>
                  {statusFilter === "pending" ? "* " : ""}Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("overdue")}>
                  {statusFilter === "overdue" ? "* " : ""}Overdue
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("overpaid")}>
                  {statusFilter === "overpaid" ? "* " : ""}Overpaid
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Sort</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSortBy("date-desc")}>
                  {sortBy === "date-desc" ? "* " : ""}Date (Newest)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("date-asc")}>
                  {sortBy === "date-asc" ? "* " : ""}Date (Oldest)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("due-date")}>
                  {sortBy === "due-date" ? "* " : ""}Due Date
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("amount-desc")}>
                  {sortBy === "amount-desc" ? "* " : ""}Amount (High to Low)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("amount-asc")}>
                  {sortBy === "amount-asc" ? "* " : ""}Amount (Low to High)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("vendor")}>
                  {sortBy === "vendor" ? "* " : ""}Vendor Name
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setGstFilter("all");
                    setStatusFilter("all");
                    setSortBy("date-desc");
                    setSearchTerm("");
                  }}
                >
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Reset All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              className="h-10 w-full items-center gap-2 rounded-xl bg-background lg:w-auto"
            >
              <FileText className="h-4 w-4" />
              {filteredBills.length} Bills
            </Button> */}

            <Button
              variant="outline"
              size="sm"
              className="h-8 items-center gap-1.5 rounded-lg bg-background px-2.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
              onClick={exportPurchasesToExcel}
              title="Download filtered bills as Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg px-2.5 text-xs"
              onClick={openManualCreate}
              disabled={isExtracting || isCompressing || loading}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Item
            </Button>
            {/* <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg px-2.5 text-xs"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isExtracting || isCompressing || loading}
            >
              {isCompressing ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="mr-1 h-3.5 w-3.5" />
              )}
              {isCompressing ? "..." : "Camera"}
            </Button>
            <Button
              size="sm"
              className="h-8 rounded-lg px-2.5 text-xs shadow-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting || isCompressing || loading}
            >
              {isCompressing || isExtracting ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1 h-3.5 w-3.5" />
              )}
              {isExtracting ? "Extracting..." : "Upload"}
            </Button> */}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2">
        <div className="h-full overflow-y-auto space-y-3 pr-1">

          {/* Summary Tiles */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Card className="rounded-xl border-primary/30">
              <CardContent className="px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Purchase
                </p>
                <p className="mt-1 text-sm font-bold leading-tight tabular-nums">
                  {formatCurrency(stats.totalPurchase)}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-emerald-300/60">
              <CardContent className="px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Paid
                </p>
                <p className="mt-1 text-sm font-bold leading-tight text-emerald-700 tabular-nums">
                  {formatCurrency(stats.totalPaid)}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-amber-300/60">
              <CardContent className="px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Pending
                </p>
                <p className="mt-1 text-sm font-bold leading-tight text-amber-700 tabular-nums">
                  {formatCurrency(stats.amountRemaining)}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-rose-300/60">
              <CardContent className="px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Returns
                </p>
                <p className="mt-1 text-sm font-bold leading-tight text-rose-700 tabular-nums">
                  {formatCurrency(stats.totalReturns)}
                </p>
                <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Return Collected
                </p>
                <p className="mt-1 text-sm font-bold leading-tight text-blue-700 tabular-nums">
                  {formatCurrency(stats.totalReturnCollected)}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-sky-300/60">
              <CardContent className="px-3 py-2.5">
                <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Truck className="h-3 w-3" />
                  Courier
                </p>
                <p className="mt-1 text-sm font-bold leading-tight text-sky-700 tabular-nums">
                  {formatCurrency(stats.totalCourier)}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-indigo-300/60">
              <CardContent className="px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Extra Expense
                </p>
                <p className="mt-1 text-sm font-bold leading-tight text-indigo-700 tabular-nums">
                  {formatCurrency(stats.totalExtraExpense)}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-emerald-300/60">
              <CardContent className="px-3 py-2.5">
                <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Wallet className="h-3 w-3" />
                  Cash Paid
                </p>
                <p className="mt-1 text-sm font-bold leading-tight text-emerald-700 tabular-nums">
                  {formatCurrency(stats.totalCashPaid)}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-cyan-300/60">
              <CardContent className="px-3 py-2.5">
                <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Landmark className="h-3 w-3" />
                  Bank/UPI Paid
                </p>
                <p className="mt-1 text-sm font-bold leading-tight text-cyan-700 tabular-nums">
                  {formatCurrency(stats.totalBankPaid)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-1 overflow-hidden border border-border/70 bg-gradient-to-r from-background via-slate-50/60 to-sky-50/40 dark:via-background dark:to-slate-900/20">
            <CardContent className="p-3 sm:p-5">
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/80 px-3 py-3 text-left transition hover:bg-background"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Search & Filters</p>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {statusLabelMap[statusFilter]} - {sortLabelMap[sortBy]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="h-8 rounded-lg px-3 text-xs font-semibold">
                    {filteredBills.length} Results
                  </Badge>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {showFilters && (
                <div className="mx-auto mt-3 w-full max-w-4xl space-y-3">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search vendor, bill number, items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-12 rounded-2xl border border-border/70 bg-white pl-12 text-base shadow-sm transition focus-visible:ring-2 focus-visible:ring-primary/30 dark:bg-background/90"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-9 w-[170px] rounded-xl bg-background/90">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="overpaid">Overpaid</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-9 w-[200px] rounded-xl bg-background/90">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date-desc">Date (Newest)</SelectItem>
                        <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                        <SelectItem value="due-date">Due Date</SelectItem>
                        <SelectItem value="amount-desc">Amount (High to Low)</SelectItem>
                        <SelectItem value="amount-asc">Amount (Low to High)</SelectItem>
                        <SelectItem value="vendor">Vendor Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Loading State */}
          {isExtracting && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="mt-3 text-foreground font-medium">
                  AI is analyzing your bill...
                </p>
                <p className="text-sm text-muted-foreground">
                  Extracting vendor info, items, amounts, and validating
                  calculations
                </p>
              </CardContent>
            </Card>
          )}

          {/* Bills List */}
          {filteredBills.length === 0 && !isExtracting ? (
            <Card className="border-2 border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  No purchase bills found
                </p>
                <p className="text-sm text-muted-foreground">
                  Upload a Image or create a bill manually to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pagedBills.map((bill) => (
                <Card
                  key={bill.id}
                  className={`group overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${isOverdue(bill) || bill.paymentStatus === "overdue"
                      ? "border-rose-200/70 bg-gradient-to-br from-rose-50/60 via-background to-background"
                      : bill.paymentStatus === "paid"
                        ? "border-emerald-200/70 bg-gradient-to-br from-emerald-50/60 via-background to-background"
                        : "border-sky-200/70 bg-gradient-to-br from-sky-50/70 via-background to-background"
                    }`}
                >
                  <CardContent className="p-2.5">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      {/* Image Thumbnail */}
                      <div
                        className="h-20 w-full cursor-pointer overflow-hidden rounded-xl bg-muted sm:w-20"
                        onClick={() => {
                          if (bill.billImage) setViewImageBill(bill);
                        }}
                      >
                        {bill.billImage ? (
                          <img
                            src={bill.billImage}
                            alt="Bill"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>

                      {/* Bill Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-foreground truncate">
                              {bill.vendorName}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {bill.billNumber
                                ? `#${bill.billNumber}`
                                : "No bill number"}{" "}
                              • {formatDate(bill.billDate || bill.createdAt)}
                            </p>
                            {bill.dueDate && (
                              <p
                                className={`text-xs mt-1 ${isOverdue(bill)
                                    ? "text-destructive font-medium"
                                    : "text-muted-foreground"
                                  }`}
                              >
                                Due: {formatDate(bill.dueDate)}
                                {bill.paymentTerms
                                  ? ` (${bill.paymentTerms} days)`
                                  : ""}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div
                              className={`cursor-pointer ${loadingPayment === bill.id
                                  ? "opacity-50 pointer-events-none"
                                  : ""
                                }`}
                              onClick={() => openPaymentDialog(bill)}
                            >
                              {loadingPayment === bill.id ? (
                                <Badge variant="secondary">
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />{" "}
                                  Updating...
                                </Badge>
                              ) : (
                                <div className="flex flex-col gap-1 items-end">
                                  {getPaymentStatusBadge(bill)}
                                  {bill.paymentStatus !== "paid" && (
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                      Paid: {formatCurrency(bill.paidAmount || 0)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {bill.extractionErrors &&
                              bill.extractionErrors.length > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-amber-600 border-amber-400"
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" />{" "}
                                  {bill.extractionErrors.length} issue(s)
                                </Badge>
                              )}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <PackagePlus className="h-3.5 w-3.5" />
                            <span>{bill.items.length} item(s)</span>
                          </div>
                          {bill.itemsAddedToInventory && (
                            <Badge
                              variant="outline"
                              className="text-emerald-600 border-emerald-500 bg-emerald-50/50 h-5 text-[11px]"
                            >
                              <PackagePlus className="h-3 w-3 mr-1" /> In Inventory
                            </Badge>
                          )}
                        </div>

                        <div className="mt-4 flex flex-col justify-between gap-4 border-t pt-4 sm:flex-row sm:items-center">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
                                Total:
                              </span>
                              <p className="text-[10px] sm:text-base font-black text-foreground">
                                {formatCurrency(
                                  bill.total -
                                  (bill.returns?.reduce(
                                    (sum, r) => sum + r.totalReturnValue,
                                    0,
                                  ) || 0),
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
                                Remaining:
                              </span>
                              <p
                                className={`text-sm sm:text-base font-black text-foreground ${bill.total -
                                    (bill.returns?.reduce(
                                      (sum, r) => sum + r.totalReturnValue,
                                      0,
                                    ) || 0) -
                                    (bill.paidAmount || 0) <
                                    0
                                    ? "text-red-600"
                                    : "text-black-600"
                                  }`}
                              >
                                {formatCurrency(
                                  bill.total -
                                  (bill.returns?.reduce(
                                    (sum, r) => sum + r.totalReturnValue,
                                    0,
                                  ) || 0) -
                                  (bill.paidAmount || 0),
                                )}
                              </p>
                            </div>
                            {bill.returns && bill.returns.length > 0 && (
                              <p className="text-[11px] sm:text-xs text-orange-600 font-bold">
                                Ret:{" "}
                                {formatCurrency(
                                  bill.returns.reduce(
                                    (sum, r) => sum + r.totalReturnValue,
                                    0,
                                  ),
                                )}
                              </p>
                            )}
                            {bill.paidAmount > 0 &&
                              bill.payments &&
                              bill.payments.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(
                                    bill.payments.reduce(
                                      (acc, p) => {
                                        acc[p.method] =
                                          (acc[p.method] || 0) + p.amount;
                                        return acc;
                                      },
                                      {} as Record<string, number>,
                                    ),
                                  ).map(([method, amount]) => (
                                    <Badge
                                      key={method}
                                      variant="outline"
                                      className={`text-[10px] sm:text-[11px] px-2 py-0 h-5 flex items-center gap-1 font-bold ${amount < 0
                                          ? "bg-green-50 border-green-200 text-green-700"
                                          : "bg-red-50 border-red-200 text-red-700"
                                        }`}
                                    >
                                      <span>{method}:</span>
                                      <span>
                                        {formatCurrency(Math.abs(amount))}
                                      </span>
                                    </Badge>
                                  ))}
                                </div>
                              )}
                          </div>

                          <div className="flex items-center justify-end gap-2 self-end sm:self-auto">
                            {bill.vendorImages?.[0] && (
                              <Button variant="outline" size="sm" className="h-8 rounded-lg bg-background/80 px-1.5 text-[10px] gap-1 hover:bg-primary/5" title="Download Vendor ID Front"
                                onClick={(e) => { e.stopPropagation(); downloadImage(bill.vendorImages![0], `vendor-id-front-${bill.billNumber || bill.id}.jpg`); }}>
                                <Download className="h-3 w-3" />F
                              </Button>
                            )}
                            {bill.vendorImages?.[1] && (
                              <Button variant="outline" size="sm" className="h-8 rounded-lg bg-background/80 px-1.5 text-[10px] gap-1 hover:bg-primary/5" title="Download Vendor ID Back"
                                onClick={(e) => { e.stopPropagation(); downloadImage(bill.vendorImages![1], `vendor-id-back-${bill.billNumber || bill.id}.jpg`); }}>
                                <Download className="h-3 w-3" />B
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 rounded-lg bg-background/80 p-0 hover:bg-primary/5"
                              onClick={() => setSelectedBill(bill)}
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 rounded-lg bg-background/80 p-0 hover:bg-primary/5"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => openPaymentDialog(bill)}
                                  disabled={(() => {
                                    const totalReturns = (
                                      bill.returns || []
                                    ).reduce(
                                      (sum, r) => sum + r.totalReturnValue,
                                      0,
                                    );
                                    const netTotal = bill.total - totalReturns;
                                    const isOverpaid =
                                      (bill.paidAmount || 0) > netTotal;
                                    return (
                                      bill.paymentStatus === "paid" && !isOverpaid
                                    );
                                  })()}
                                  className="gap-2"
                                >
                                  <IndianRupee className="h-4 w-4" />
                                  Pay Now
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedBillForReturn(bill);
                                    setReturnDialogOpen(true);
                                  }}
                                  className="gap-2 text-orange-600 focus:text-orange-600"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Purchase Return
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => openHistoryDialog(bill)}
                                  className="gap-2"
                                >
                                  <Clock className="h-4 w-4" />
                                  Transaction History
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => setViewImageBill(bill)}
                                  className="gap-2"
                                  disabled={!bill.billImage}
                                >
                                  <ImageIcon className="h-4 w-4" />
                                  {bill.billImage ? "View Image" : "No Image"}
                                </DropdownMenuItem>

                                {bill.isInvoice && bill.invoiceFileUrl && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => window.open(bill.invoiceFileUrl, "_blank", "noopener,noreferrer")}
                                      className="gap-2"
                                    >
                                      <FileText className="h-4 w-4" />
                                      View Invoice
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        downloadImage(
                                          bill.invoiceFileUrl!,
                                          bill.invoiceFileName || `invoice-${bill.billNumber || bill.id}`,
                                        )
                                      }
                                      className="gap-2"
                                    >
                                      <Download className="h-4 w-4" />
                                      Download Invoice
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {!bill.itemsAddedToInventory && (
                                  <DropdownMenuItem
                                    onClick={() => handleAddToInventory(bill)}
                                    className="gap-2 text-blue-600 focus:text-blue-600"
                                  >
                                    <PackagePlus className="h-4 w-4" />
                                    Add to Inventory
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      onSelect={(e) => e.preventDefault()}
                                      className="gap-2 text-destructive focus:text-destructive"
                                      disabled={bill.itemsAddedToInventory}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete Bill
                                      {bill.itemsAddedToInventory && (
                                        <span className="text-[10px] ml-auto opacity-70">
                                          (In Inventory)
                                        </span>
                                      )}
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Delete Purchase Bill?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This action cannot be undone and will remove
                                        all associated payment and return records.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(bill.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        disabled={!!isDeleting}
                                      >
                                        {isDeleting === bill.id ? (
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : null}
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredBills.length > pageSize && (
                <div className="mt-6 flex flex-col items-start justify-between gap-2 px-2 sm:flex-row sm:items-center">
                  <p className="text-xs text-muted-foreground">
                    Showing {(currentPage - 1) * pageSize + 1} to{" "}
                    {Math.min(currentPage * pageSize, filteredBills.length)} of{" "}
                    {filteredBills.length}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Create Dialog */}
          <Dialog
            open={manualCreateOpen}
            onOpenChange={(open) => {
              if (!open) {
                setManualDiscardConfirmOpen(true);
              } else {
                setManualCreateOpen(true);
              }
            }}
          >
            <DialogContent
              className="w-[100vw] sm:w-[95vw] lg:w-[92vw] max-w-6xl
          h-[100vh] sm:h-[92vh] max-h-[100vh] sm:max-h-[92vh]
          left-0 top-0 translate-x-0 translate-y-0
          sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]
          rounded-none sm:rounded-xl p-0 sm:p-0 flex flex-col gap-0"
            >
              <DialogHeader className="px-4 sm:px-6 py-4 border-b bg-background sticky top-0 z-10 pt-[calc(env(safe-area-inset-top)+1rem)]">
                <DialogTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-base font-semibold">New Purchase Bill</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Quick flow: Vendor, Bill Details, Items, Save
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                  <div className="xl:col-span-8 space-y-4">
                    {/* <Card className="border-primary/20 bg-primary/[0.03]">
              <CardContent className="pt-4">
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                  <Badge variant="outline" className="px-2 py-1">
                    1 Vendor
                  </Badge>
                  <Badge variant="outline" className="px-2 py-1">
                    2 Bill Info
                  </Badge>
                  <Badge variant="outline" className="px-2 py-1">
                    3 Items
                  </Badge>
                  <Badge variant="outline" className="px-2 py-1">
                    4 Review and Save
                  </Badge>
                </div>
              </CardContent>
            </Card> */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">1. Party</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-lg border bg-muted/30 p-1">
                          <Button
                            type="button"
                            size="sm"
                            tabIndex={-1}
                            variant={manualVendorMode === "select" ? "default" : "outline"}
                            onClick={() => setManualVendorMode("select")}
                          >
                            Select Party
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            tabIndex={-1}
                            variant={manualVendorMode === "create" ? "default" : "outline"}
                            onClick={() => setManualVendorMode("create")}
                          >
                            Create Party
                          </Button>
                        </div>

                        {manualVendorMode === "select" ? (
                          <div className="space-y-1">
                            <Label>Party *</Label>
                            <Select
                              value={manualBill.clientId || ""}
                              onValueChange={(val) => {
                                if (val === "__create_party__") {
                                  setManualVendorMode("create");
                                  return;
                                }
                                const party = parties.find((p) => p.id === val);
                                setManualBill((prev) => ({
                                  ...prev,
                                  clientId: val,
                                  vendorName: party?.name || "",
                                  vendorAddress: party?.billingAddress || "",
                                  vendorGstin: "",
                                  items: prev.items.map((it) => ({
                                    ...it,
                                    whereToBuy: it.whereToBuy || party?.name || "",
                                  })),
                                }));
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select party" />
                              </SelectTrigger>
                              <SelectContent>
                                {parties.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                                <SelectItem value="__create_party__">
                                  + Create new party
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label>Party Name *</Label>
                              <Input
                                value={manualVendorForm.name}
                                onChange={(e) =>
                                  setManualVendorForm((prev) => ({
                                    ...prev,
                                    name: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Phone</Label>
                              <Input
                                value={manualVendorForm.phone}
                                onChange={(e) =>
                                  setManualVendorForm((prev) => ({
                                    ...prev,
                                    phone: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Email</Label>
                              <Input
                                value={manualVendorForm.email}
                                onChange={(e) =>
                                  setManualVendorForm((prev) => ({
                                    ...prev,
                                    email: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <Label>Address</Label>
                              <Textarea
                                rows={2}
                                value={manualVendorForm.address}
                                onChange={(e) =>
                                  setManualVendorForm((prev) => ({
                                    ...prev,
                                    address: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Opening Balance</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={manualVendorForm.openingBalance}
                                onChange={(e) =>
                                  setManualVendorForm((prev) => ({
                                    ...prev,
                                    openingBalance: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Opening Type</Label>
                              <Select
                                value={manualVendorForm.openingBalanceType}
                                onValueChange={(val) =>
                                  setManualVendorForm((prev) => ({
                                    ...prev,
                                    openingBalanceType: val as any,
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="receivable">Receivable</SelectItem>
                                  <SelectItem value="payable">Payable</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label>Credit Limit</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={manualVendorForm.creditLimit}
                                onChange={(e) =>
                                  setManualVendorForm((prev) => ({
                                    ...prev,
                                    creditLimit: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">2. Bill Details</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label>Bill Number</Label>
                          <Input
                            value={manualBill.billNumber || ""}
                            onChange={(e) =>
                              setManualBill((prev) => ({
                                ...prev,
                                billNumber: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Bill Date *</Label>
                          <Input
                            type="date"
                            value={manualBill.billDate}
                            onChange={(e) => {
                              const billDate = e.target.value;
                              setManualBill((prev) => {
                                let dueDate = prev.dueDate || "";
                                if ((prev.paymentTerms || 0) > 0 && billDate) {
                                  const d = new Date(billDate);
                                  d.setDate(d.getDate() + (prev.paymentTerms || 0));
                                  dueDate = d.toISOString().split("T")[0];
                                }
                                return {
                                  ...prev,
                                  billDate,
                                  dueDate,
                                };
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Payment Terms (Days)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={manualBill.paymentTerms || 0}
                            onChange={(e) => {
                              const paymentTerms = parseInt(e.target.value, 10) || 0;
                              setManualBill((prev) => {
                                const billDate = prev.billDate || new Date().toISOString().split("T")[0];
                                let dueDate = prev.dueDate || "";
                                if (billDate) {
                                  const d = new Date(billDate);
                                  d.setDate(d.getDate() + paymentTerms);
                                  dueDate = d.toISOString().split("T")[0];
                                }
                                return {
                                  ...prev,
                                  paymentTerms,
                                  dueDate,
                                };
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2 lg:col-span-4">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-border accent-primary"
                              checked={includeManualBillNotes}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setIncludeManualBillNotes(checked);
                                if (!checked) {
                                  setManualBill((prev) => ({ ...prev, notes: "" }));
                                }
                              }}
                            />
                            <span className="text-sm font-medium">Add Notes</span>
                          </label>
                          {includeManualBillNotes && (
                            <Textarea
                              rows={2}
                              placeholder="Write notes..."
                              value={manualBill.notes || ""}
                              onChange={(e) =>
                                setManualBill((prev) => ({
                                  ...prev,
                                  notes: e.target.value,
                                }))
                              }
                            />
                          )}
                        </div>
                        <div className="space-y-2 md:col-span-2 lg:col-span-4">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-border accent-primary"
                              checked={!!manualBill.isInvoice}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setManualBill((prev) => ({ ...prev, isInvoice: checked }));
                                if (!checked) setManualInvoiceFile(null);
                              }}
                            />
                            <span className="text-sm font-medium">Have vendor's original invoice? (secondhand purchase)</span>
                          </label>
                          {manualBill.isInvoice && (
                            <div className="flex items-center gap-2">
                              <input
                                ref={manualInvoiceInputRef}
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) setManualInvoiceFile(file);
                                  e.target.value = "";
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => manualInvoiceInputRef.current?.click()}
                                className="gap-2"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                {manualInvoiceFile ? "Change File" : "Upload Invoice (Image/PDF)"}
                              </Button>
                              {manualInvoiceFile && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <FileText className="h-3.5 w-3.5" />
                                  {manualInvoiceFile.name}
                                  <button
                                    type="button"
                                    onClick={() => setManualInvoiceFile(null)}
                                    className="ml-1 text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label>Payment Mode</Label>
                          <Select
                            value={manualBill.paymentMode || "Cash"}
                            onValueChange={(v) =>
                              setManualBill((prev) => ({ ...prev, paymentMode: v }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                              <SelectItem value="UPI">UPI</SelectItem>
                              <SelectItem value="Cheque">Cheque</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Courier Charges (₹)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={manualBill.courierCharges || ""}
                            onChange={(e) =>
                              setManualBill((prev) => ({
                                ...prev,
                                courierCharges: parseFloat(e.target.value) || 0,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Expense (₹)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={manualBill.expenseAmount || ""}
                            onChange={(e) =>
                              setManualBill((prev) => ({
                                ...prev,
                                expenseAmount: parseFloat(e.target.value) || 0,
                              }))
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span>3. Items</span>
                          <Button type="button" variant="outline" size="sm" onClick={addManualItemRow}>
                            <PackagePlus className="h-4 w-4 mr-2" />
                            Add Item
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {manualBill.items.map((item, index) => (
                          <div key={index} className="rounded-lg border p-3 bg-muted/10 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">Item {index + 1}</p>
                              {manualBill.items.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => removeManualItemRow(index)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Remove
                                </Button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label>Model *</Label>
                                <ProductAutocomplete
                                  products={products}
                                  value={item.description}
                                  onChange={(val) =>
                                    updateManualItem(index, "description", val)
                                  }
                                  onSelect={(product) =>
                                    handleManualProductSelect(index, product)
                                  }
                                  onCreateProduct={() =>
                                    handleCreateProductFromManualItem(index)
                                  }
                                  onEnterWithText={(text) =>
                                    handleEnterWithText(index, text)
                                  }
                                  placeholder="Model name"
                                  type="name"
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Serial No. (SN)</Label>
                                <Input
                                  value={(item as any).serialNumber || ""}
                                  readOnly={snAutoGenerate}
                                  onChange={!snAutoGenerate ? (e) => updateManualItem(index, "serialNumber" as any, e.target.value) : undefined}
                                  placeholder={snAutoGenerate ? (snPrefix ? `e.g. ${snPrefix}-01` : "Set SN prefix in Settings") : "Enter SN manually"}
                                  className={`font-mono select-all ${snAutoGenerate ? "bg-muted cursor-default" : ""}`}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>IMEI 1</Label>
                                {(() => {
                                  const c = checkImeiConflict((item as any).imeiNumber || "");
                                  return (
                                    <>
                                      <Input
                                        value={(item as any).imeiNumber || ""}
                                        onChange={(e) => updateManualItem(index, "imeiNumber" as any, e.target.value)}
                                        placeholder="Primary IMEI"
                                        className={c ? (c.isBlocking ? "border-red-500 focus-visible:ring-red-500" : "border-orange-400 focus-visible:ring-orange-400") : ""}
                                      />
                                      {c && (
                                        <p className={`text-xs mt-0.5 ${c.isBlocking ? "text-red-600" : "text-orange-600"}`}>
                                          ⚠ {c.isBlocking
                                            ? `Already in stock as ${c.foundAs} — purchased from "${c.unit.vendorName || "unknown"}". Sell it first.`
                                            : `Previously in system as ${c.foundAs} (${c.unit.status}) — purchased from "${c.unit.vendorName || "unknown"}". Verify this is the same device.`}
                                        </p>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                              <div className="space-y-1">
                                <Label>Storage</Label>
                                <Input
                                  value={(item as any).storage || ""}
                                  list="purchase-storage-options"
                                  onChange={(e) =>
                                    updateManualItem(index, "storage" as any, e.target.value)
                                  }
                                  placeholder="Storage"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Color</Label>
                                <Input
                                  value={(item as any).color || ""}
                                  onChange={(e) =>
                                    updateManualItem(index, "color" as any, e.target.value)
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Battery Health <span className="text-muted-foreground font-normal text-xs">(iPhone only)</span></Label>
                                <Input
                                  value={(item as any).batteryHealth || ""}
                                  onChange={(e) =>
                                    updateManualItem(index, "batteryHealth" as any, e.target.value)
                                  }
                                  placeholder="e.g. 87%"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Warranty</Label>
                                <Input
                                  value={(item as any).warranty || ""}
                                  onChange={(e) =>
                                    updateManualItem(index, "warranty" as any, e.target.value)
                                  }
                                  placeholder="e.g. 1 Year, 6 Months"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Rate *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.rate}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (String(Math.round(val)).length >= 10) {
                                      toast({ title: "Invalid Rate", description: "This looks like an IMEI/barcode, not a price. Please enter the correct rate.", variant: "destructive" });
                                      return;
                                    }
                                    updateManualItem(index, "rate", val);
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Selling Price</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={(item as any).sellingPrice || 0}
                                  onChange={(e) =>
                                    updateManualItem(
                                      index,
                                      "sellingPrice" as any,
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm bg-background border rounded-md px-3 py-2">
                              <div className="text-muted-foreground">
                                Purchase Price:{" "}
                                <span className="font-semibold text-foreground">
                                  {formatCurrency(item.rate || 0)}
                                </span>
                              </div>
                              {!!((item as any).sellingPrice || 0) && (
                                <div className="text-muted-foreground">
                                  Selling Price:{" "}
                                  <span className="font-semibold text-foreground">
                                    {formatCurrency((item as any).sellingPrice || 0)}
                                  </span>
                                </div>
                              )}
                              <div className="text-muted-foreground">
                                Amount: <span className="font-semibold text-foreground">{formatCurrency(item.amount || 0)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* ── Repair Cost Card ─────────────────────────────── */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-amber-600" />
                            4. Repair Cost
                            <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                          </span>
                          {manualBill.items.some((it) => it.description.trim()) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const defaultIdx = manualBill.items.findIndex((it) => it.description.trim());
                                setRepairCosts((prev) => [...prev, { itemIndex: defaultIdx >= 0 ? defaultIdx : 0, amount: 0, notes: "" }]);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Repair Cost
                            </Button>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {repairCosts.length === 0 && (
                          <p className="text-sm text-muted-foreground">No repair costs added. Click "Add Repair Cost" if a device needed repair after purchase.</p>
                        )}
                        {repairCosts.map((rc, rcIdx) => {
                          const validItems = manualBill.items.filter((it) => it.description.trim());
                          const isSingle = validItems.length <= 1;
                          return (
                            <div key={rcIdx} className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg border bg-amber-50/30">
                              {/* Device selector — hidden when only 1 device */}
                              {!isSingle && (
                                <select
                                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm flex-1 min-w-[140px]"
                                  value={rc.itemIndex}
                                  onChange={(e) => {
                                    const updated = [...repairCosts];
                                    updated[rcIdx] = { ...rc, itemIndex: Number(e.target.value) };
                                    setRepairCosts(updated);
                                  }}
                                >
                                  {manualBill.items.map((it, i) =>
                                    it.description.trim() ? (
                                      <option key={i} value={i}>
                                        {it.description} {(it as any).imeiNumber ? `(${(it as any).imeiNumber})` : (it as any).serialNumber ? `(SN: ${(it as any).serialNumber})` : ""}
                                      </option>
                                    ) : null
                                  )}
                                </select>
                              )}
                              {isSingle && (
                                <div className="flex-1 min-w-[140px] h-9 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground truncate">
                                  {manualBill.items[rc.itemIndex]?.description || "Device"}
                                </div>
                              )}
                              <div className="flex items-center gap-1 w-32 shrink-0">
                                <IndianRupee className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                  placeholder="Amount"
                                  value={rc.amount || ""}
                                  onChange={(e) => {
                                    const newAmount = Number(e.target.value) || 0;
                                    const updated = [...repairCosts];
                                    updated[rcIdx] = { ...rc, amount: newAmount };
                                    setRepairCosts(updated);
                                    // Recalculate selling price based on effective cost (rate + repair)
                                    const itemRate = Number(manualBill.items[rc.itemIndex]?.rate) || 0;
                                    updateManualItem(rc.itemIndex, "sellingPrice" as any,
                                      calculateSellingPriceFromCommission(itemRate, companyProfile?.commissionSettings) + newAmount);
                                  }}
                                />
                              </div>
                              <input
                                type="text"
                                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                                placeholder="Notes (e.g. screen repair)"
                                value={rc.notes}
                                onChange={(e) => {
                                  const updated = [...repairCosts];
                                  updated[rcIdx] = { ...rc, notes: e.target.value };
                                  setRepairCosts(updated);
                                }}
                              />
                              <button
                                type="button"
                                className="h-9 w-9 flex items-center justify-center rounded-md border border-input hover:bg-destructive/10 text-destructive shrink-0"
                                onClick={() => setRepairCosts((prev) => prev.filter((_, i) => i !== rcIdx))}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                        {repairCosts.length > 0 && (
                          <div className="flex justify-end text-sm text-amber-700 font-medium pt-1">
                            Total Repair Cost: {formatCurrency(repairCosts.reduce((s, r) => s + (r.amount || 0), 0))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                  </div>
                  <div className="xl:col-span-4 space-y-4">
                    <Card className="xl:sticky xl:top-4">
                      {/* <CardHeader className="pb-1">
                  <CardTitle className="text-base">4. Review</CardTitle>
                </CardHeader> */}
                      <CardContent className="space-y-4">
                        <div className="rounded-md bg-muted/30 p-2 text-sm">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Party</p>
                          <p className="font-semibold mt-1">
                            {manualVendorMode === "create"
                              ? manualVendorForm.name || "New party"
                              : manualSelectedParty?.name || "Not selected"}
                          </p>
                        </div>

                        <div className="rounded-md bg-muted/30 p-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bill Date</span>
                            <span className="font-medium">{manualBill.billDate || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Payment Terms (Days)</span>
                            <span className="font-medium">
                              {manualBill.paymentTerms || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Due Date</span>
                            <span className="font-medium">
                              {manualPreviewDueDate || "-"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bill Number</span>
                            <span className="font-medium">{manualBill.billNumber || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Items</span>
                            <span className="font-medium">{manualBill.items.length}</span>
                          </div>
                        </div>

                        <div className="rounded-md border p-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-medium">{formatCurrency(manualSubtotal)}</span>
                          </div>
                          {(manualBill.courierCharges || 0) > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Courier</span>
                              <span className="font-medium">{formatCurrency(manualBill.courierCharges || 0)}</span>
                            </div>
                          )}
                          {(manualBill.expenseAmount || 0) > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Expense</span>
                              <span className="font-medium">{formatCurrency(manualBill.expenseAmount || 0)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-base font-bold pt-2 border-t">
                            <span>Total</span>
                            <span className="text-primary">{formatCurrency(manualGrandTotal)}</span>
                          </div>
                        </div>

                        <div className="rounded-md border p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Image
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => manualImageInputRef.current?.click()}
                                disabled={isCompressing}
                              >
                                {isCompressing ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="mr-2 h-4 w-4" />
                                )}
                                {manualBill.billImage ? "Replace" : "Upload"}
                              </Button>
                              {manualBill.billImage && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setManualBill((prev) => ({ ...prev, billImage: "" }))
                                  }
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          </div>

                          {manualBill.billImage ? (
                            <img
                              src={manualBill.billImage}
                              alt="Bill preview"
                              className="h-36 w-full rounded-md border object-cover"
                            />
                          ) : (
                            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                              No image attached
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
              {/* Record Vendor Payment Section */}
              <div className="shrink-0 border-t bg-muted/20 px-4 sm:px-6 py-3">
                {(() => {
                  const advanceFull = vendorAdvanceAmount > 0.5 && manualGrandTotal > 0.5 && vendorAdvanceAmount >= manualGrandTotal - 0.5;
                  const advancePartial = vendorAdvanceAmount > 0.5 && !advanceFull;
                  const remaining = Math.max(0, manualGrandTotal - vendorAdvanceAmount);
                  if (advanceFull) {
                    return (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5 text-xs text-emerald-800 space-y-0.5">
                        <p className="font-semibold flex items-center gap-1">✓ Bill fully covered by advance</p>
                        <p>Rs.{vendorAdvanceAmount.toLocaleString("en-IN")} advance will be auto-applied on save — no payment needed.</p>
                      </div>
                    );
                  }
                  return (
                    <>
                      {advancePartial && (
                        <div className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 text-xs text-emerald-800">
                          <span className="font-medium">✓ Rs.{vendorAdvanceAmount.toLocaleString("en-IN")} advance will be auto-applied.</span>
                          {" "}Remaining balance: <span className="font-semibold">Rs.{remaining.toLocaleString("en-IN")}</span> — check below to pay now.
                        </div>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border accent-primary"
                          checked={collectPaymentOnCreate}
                          onChange={(e) => setCollectPaymentOnCreate(e.target.checked)}
                        />
                        <span className="text-sm font-medium">Pay Vendor Now</span>
                      </label>
                    </>
                  );
                })()}
                {collectPaymentOnCreate && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={createPayment.amount}
                        onChange={(e) => setCreatePayment((p) => ({ ...p, amount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Method</Label>
                      <Select
                        value={createPayment.method}
                        onValueChange={(v) => setCreatePayment((p) => ({ ...p, method: v as PaymentMethod, bankAccountId: v === "Cash" ? "" : p.bankAccountId }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {createPayment.method !== "Cash" && (
                      <div className="space-y-1">
                        <Label className="text-xs">Bank Account *</Label>
                        {bankAccounts.length === 0 ? (
                          <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
                            No bank accounts. Add in <strong>Bank &amp; Cash</strong> section.
                          </p>
                        ) : (
                          <Select
                            value={createPayment.bankAccountId}
                            onValueChange={(v) => setCreatePayment((p) => ({ ...p, bankAccountId: v }))}
                          >
                            <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                            <SelectContent>
                              {bankAccounts.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
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
                        value={createPayment.date}
                        onChange={(e) => setCreatePayment((p) => ({ ...p, date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1 col-span-2 sm:col-span-4">
                      <Label className="text-xs">Note (optional)</Label>
                      <Input
                        value={createPayment.note}
                        onChange={(e) => setCreatePayment((p) => ({ ...p, note: e.target.value }))}
                        placeholder="Vendor payment note..."
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="shrink-0 border-t bg-background px-4 sm:px-6 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
                <div className="flex items-center justify-end gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      tabIndex={-1}
                      onClick={() => setManualDiscardConfirmOpen(true)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveManualBill}
                      loading={isSaving}
                      disabled={isSaving || manualBill.items.some((item: any) =>
                        checkImeiConflict(item.imeiNumber || "")?.isBlocking
                      )}
                      title={manualBill.items.some((item: any) =>
                        checkImeiConflict(item.imeiNumber || "")?.isBlocking
                      ) ? "Cannot save — one or more IMEIs are already in stock" : undefined}
                    >
                      Create Purchase Bill
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Image View Dialog */}
          <Dialog
            open={!!viewImageBill}
            onOpenChange={() => setViewImageBill(null)}
          >
            <DialogContent
              className="w-[100vw] sm:w-[90vw] lg:w-[85vw] max-w-4xl
          h-[100vh] sm:h-[90vh] max-h-[100vh] sm:max-h-[90vh]
          left-0 top-0 translate-x-0 translate-y-0
          sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]
          rounded-none sm:rounded-lg
          p-0 sm:p-0 flex flex-col gap-0"
            >
              <DialogHeader className="px-6 sm:px-8 py-5 border-b shrink-0 bg-background sticky top-0 z-10 pt-[calc(env(safe-area-inset-top)+1rem)]">
                <DialogTitle>Original Image</DialogTitle>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                {viewImageBill?.billImage ? (
                  <img
                    src={viewImageBill.billImage}
                    alt="Bill"
                    className="w-full rounded-lg"
                  />
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                    No Image uploaded for this purchase bill.
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Detail View Dialog */}
          {/* Detail View Dialog */}
          <Dialog
            open={!!selectedBill}
            onOpenChange={() => {
              setSelectedBill(null);
              setIsEditing(false);
              setEditedBill(null);
              setEditRepairCosts([]);
            }}
          >
            <DialogContent
              className="w-[100vw] sm:w-[90vw] lg:w-[85vw] xl:w-[80vw] max-w-[1800px]
          h-[100vh] sm:h-[90vh] max-h-[100vh] sm:max-h-[90vh]
          left-0 top-0 translate-x-0 translate-y-0
          sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]
          rounded-none sm:rounded-lg
          p-0 sm:p-0 flex flex-col gap-0"
            >
              {/* Fixed Header */}
              <DialogHeader className="px-6 sm:px-8 py-4 border-b shrink-0 bg-background sticky top-0 z-10 pt-[calc(env(safe-area-inset-top)+1rem)]">
                <DialogTitle className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <span className="text-base sm:text-lg font-bold">
                    Extracted Bill Details
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedBill && !isEditing && (
                      <>
                        <PDFDownloadLink
                          document={<PurchaseBillPDF bill={selectedBill} />}
                          fileName={`Bill_${selectedBill.billNumber || selectedBill.id}.pdf`}
                        >
                          {({ loading }) => (
                            <Button
                              variant="outline"
                              size="default"
                              disabled={loading}
                            >
                              {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Download className="h-4 w-4 mr-2" />
                              )}
                              Download PDF
                            </Button>
                          )}
                        </PDFDownloadLink>
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => startEditing(selectedBill)}
                        >
                          <Edit2 className="h-4 w-4 mr-2" /> Edit
                        </Button>
                      </>
                    )}
                    {isEditing && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => {
                            setIsEditing(false);
                            setEditedBill(null);
                            setEditRepairCosts([]);
                          }}
                        >
                          <X className="h-4 w-4 mr-2" /> Cancel
                        </Button>
                        <Button
                          size="default"
                          onClick={saveEditedBill}
                          loading={savingEditedBill}
                        >
                          <Save className="h-4 w-4 mr-2" /> Save
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Scrollable Content */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                {/* Extraction Errors Alert */}
                {selectedBill?.extractionErrors &&
                  selectedBill.extractionErrors.length > 0 &&
                  !isEditing && (
                    <Card className="border-amber-400 bg-amber-50 dark:bg-amber-950/20 mb-6">
                      <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="space-y-2 flex-1">
                            <p className="font-semibold text-base text-amber-800 dark:text-amber-200">
                              AI detected potential issues:
                            </p>
                            <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                              {selectedBill.extractionErrors.map((error, i) => (
                                <li
                                  key={i}
                                  className="flex flex-col lg:flex-row lg:items-start gap-2"
                                >
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${error.severity === "error"
                                        ? "bg-destructive/20 text-destructive"
                                        : "bg-amber-200 text-amber-800"
                                      }`}
                                  >
                                    {error.severity.toUpperCase()}
                                  </span>
                                  <div className="flex-1">
                                    <span className="block text-sm">
                                      {error.message}
                                    </span>
                                    {error.suggestion && (
                                      <span className="block text-xs text-amber-600 mt-1">
                                        Suggestion: {error.suggestion}
                                      </span>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3 border-amber-400 text-amber-700"
                              onClick={() => startEditing(selectedBill)}
                            >
                              <Edit2 className="h-4 w-4 mr-2" /> Fix Issues
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                {(isEditing ? editedBill : selectedBill) && (
                  <div className="space-y-6">
                    {/* Vendor Information */}
                    <Card className="overflow-hidden shadow-sm">
                      <CardHeader className="bg-muted/40 px-5 py-3.5">
                        <CardTitle className="text-sm sm:text-base font-semibold">
                          Vendor Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-5 px-5 pb-5">
                        {isEditing ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            <div className="space-y-1.5 md:col-span-2 xl:col-span-3">
                              <Label className="text-sm font-medium">Vendor</Label>
                              <Select
                                value={editedBill?.clientId || ""}
                                onValueChange={(val) => {
                                  const party = parties.find((p) => p.id === val);
                                  setEditedBill((prev) =>
                                    prev
                                      ? {
                                        ...prev,
                                        clientId: val,
                                        vendorName:
                                          party?.name || prev.vendorName,
                                        vendorAddress:
                                          party?.billingAddress || prev.vendorAddress,
                                      }
                                      : null,
                                  );
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Vendor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {parties.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">
                                Vendor Name (Override)
                              </Label>
                              <Input
                                value={editedBill?.vendorName || ""}
                                onChange={(e) =>
                                  setEditedBill((prev) =>
                                    prev
                                      ? { ...prev, vendorName: e.target.value }
                                      : null,
                                  )
                                }
                                className="h-10 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">
                                Bill Number
                              </Label>
                              <Input
                                value={editedBill?.billNumber || ""}
                                onChange={(e) =>
                                  setEditedBill((prev) =>
                                    prev
                                      ? { ...prev, billNumber: e.target.value }
                                      : null,
                                  )
                                }
                                className="h-10 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">
                                Bill Date
                              </Label>
                              <Input
                                type="date"
                                value={editedBill?.billDate?.split("T")[0] || ""}
                                onChange={(e) => {
                                  const newDate = new Date(e.target.value);
                                  const now = new Date();
                                  newDate.setHours(
                                    now.getHours(),
                                    now.getMinutes(),
                                    now.getSeconds(),
                                    now.getMilliseconds(),
                                  );
                                  setEditedBill((prev) =>
                                    prev
                                      ? { ...prev, billDate: newDate.toISOString() }
                                      : null,
                                  );
                                }}
                                className="h-10 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">
                                Due Date
                              </Label>
                              <Input
                                type="date"
                                value={editedBill?.dueDate?.split("T")[0] || ""}
                                onChange={(e) => {
                                  const newDate = new Date(e.target.value);
                                  const now = new Date();
                                  newDate.setHours(
                                    now.getHours(),
                                    now.getMinutes(),
                                    now.getSeconds(),
                                    now.getMilliseconds(),
                                  );
                                  setEditedBill((prev) =>
                                    prev
                                      ? { ...prev, dueDate: newDate.toISOString() }
                                      : null,
                                  );
                                }}
                                className="h-10 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">
                                Payment Terms (Days)
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                value={editedBill?.paymentTerms || ""}
                                onChange={(e) =>
                                  setEditedBill((prev) =>
                                    prev
                                      ? {
                                        ...prev,
                                        paymentTerms:
                                          parseInt(e.target.value) || 0,
                                      }
                                      : null,
                                  )
                                }
                                className="h-10 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5 md:col-span-2 xl:col-span-3">
                              <Label className="text-sm font-medium">Address</Label>
                              <Textarea
                                value={editedBill?.vendorAddress || ""}
                                onChange={(e) =>
                                  setEditedBill((prev) =>
                                    prev
                                      ? { ...prev, vendorAddress: e.target.value }
                                      : null,
                                  )
                                }
                                rows={3}
                                className="resize-none text-sm"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
                            <div className="space-y-4">
                              <div>
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                  Vendor Name
                                </span>
                                <p className="font-semibold text-lg mt-1 break-words">
                                  {selectedBill?.vendorName}
                                </p>
                              </div>
                              {selectedBill?.vendorAddress && (
                                <div>
                                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                    Address
                                  </span>
                                  <p className="mt-1 whitespace-pre-line break-words">
                                    {selectedBill.vendorAddress}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="space-y-4">
                              <div>
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                  Bill Number
                                </span>
                                <p className="mt-1 font-semibold text-base">
                                  {selectedBill?.billNumber || "—"}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                  Bill Date
                                </span>
                                <p className="mt-1">
                                  {formatDate(selectedBill?.billDate)}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                  Due Date
                                </span>
                                <p
                                  className={`mt-1 font-medium ${isOverdue(selectedBill)
                                      ? "text-destructive"
                                      : ""
                                    }`}
                                >
                                  {formatDate(selectedBill?.dueDate)}{" "}
                                  {selectedBill?.paymentTerms
                                    ? `(${selectedBill.paymentTerms} days)`
                                    : ""}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Payment History */}
                    <Card className="overflow-hidden shadow-sm">
                      <CardHeader className="bg-muted/40 px-5 py-3.5">
                        <CardTitle className="text-sm sm:text-base font-semibold flex items-center justify-between">
                          <span>Payment History</span>
                          <Badge
                            variant={
                              (isEditing ? editedBill : selectedBill)
                                ?.paymentStatus === "paid"
                                ? "default"
                                : "secondary"
                            }
                            className="text-sm py-1 px-3"
                          >
                            {(isEditing
                              ? editedBill
                              : selectedBill
                            )?.paymentStatus.toUpperCase()}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-5 px-5 pb-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                          <div className="space-y-1.5 p-4 bg-muted/20 rounded-lg border">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                              Total Amount
                            </span>
                            <p className="text-lg sm:text-xl font-bold text-foreground">
                              {formatCurrency(
                                (isEditing ? editedBill : selectedBill)?.total || 0,
                              )}
                            </p>
                          </div>
                          <div className="space-y-1.5 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900">
                            <span className="text-xs text-emerald-700 dark:text-emerald-300 uppercase tracking-wider font-semibold">
                              Total Paid
                            </span>
                            <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(
                                (isEditing ? editedBill : selectedBill)
                                  ?.paidAmount || 0,
                              )}
                            </p>
                          </div>
                          <div className="space-y-1.5 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900">
                            <span className="text-xs text-blue-700 dark:text-blue-300 uppercase tracking-wider font-semibold">
                              Payment Breakdown
                            </span>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {Object.entries(
                                (isEditing
                                  ? editedBill
                                  : selectedBill
                                )?.payments?.reduce(
                                  (acc, p) => {
                                    acc[p.method] = (acc[p.method] || 0) + p.amount;
                                    return acc;
                                  },
                                  {} as Record<string, number>,
                                ) || {},
                              ).map(([method, amount]) => (
                                <Badge
                                  key={method}
                                  variant="secondary"
                                  className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-none text-xs"
                                >
                                  {method}: {formatCurrency(amount)}
                                </Badge>
                              ))}
                              {((isEditing ? editedBill : selectedBill)?.payments
                                ?.length || 0) === 0 && (
                                  <span className="text-xs text-muted-foreground italic">
                                    No payments yet
                                  </span>
                                )}
                            </div>
                          </div>
                        </div>

                        {((isEditing ? editedBill : selectedBill)?.payments
                          ?.length || 0) > 0 ? (
                          <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/60">
                                <tr>
                                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                                    Date
                                  </th>
                                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                                    Method
                                  </th>
                                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                                    Amount
                                  </th>
                                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                                    Note
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {(isEditing
                                  ? editedBill
                                  : selectedBill
                                )?.payments?.map((payment, i) => (
                                  <tr key={payment.id || i} className="border-t">
                                    <td className="px-4 py-3 text-sm">
                                      {formatDate(payment.date)}
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge variant="outline" className="text-xs">
                                        {payment.method}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold">
                                      {formatCurrency(payment.amount)}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground text-sm">
                                      {payment.note || "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-muted/10 rounded-lg border border-dashed">
                            <p className="text-sm text-muted-foreground">
                              No payments recorded yet.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Items Table */}
                    <Card className="overflow-hidden shadow-sm">
                      <CardHeader className="bg-muted/40 px-5 py-3.5">
                        <CardTitle className="text-sm sm:text-base font-semibold flex items-center justify-between">
                          <span>Items</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-normal text-muted-foreground">
                              {
                                (isEditing
                                  ? editedBill?.items
                                  : selectedBill?.items
                                )?.length
                              }{" "}
                              item(s)
                            </span>
                            {isEditing && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addEditedItemRow}
                              >
                                <PackagePlus className="h-4 w-4 mr-2" />
                                Add Item
                              </Button>
                            )}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/60">
                              <tr>
                                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide sticky left-0 bg-muted/60">
                                  #
                                </th>
                                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide min-w-[250px]">
                                  Description
                                </th>
                                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                                  Qty
                                </th>
                                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                                  Rate
                                </th>
                                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                                  Selling
                                </th>
                                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                                  Amount
                                </th>
                                {isEditing && (
                                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                                    Actions
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {(isEditing
                                ? editedBill?.items
                                : [...(selectedBill?.items || [])].sort((a, b) => {
                                    const n = (s?: string) => { const m = (s || "").match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; };
                                    return n((a as any).serialNumber) - n((b as any).serialNumber);
                                  })
                              )?.map((item, index) => (
                                <tr
                                  key={index}
                                  className={`border-t ${item.hasError
                                      ? "bg-amber-50 dark:bg-amber-900/20"
                                      : ""
                                    }`}
                                >
                                  <td className="px-4 py-3 font-medium sticky left-0 bg-background text-sm">
                                    {index + 1}
                                  </td>
                                  <td className="px-4 py-3 max-w-md">
                                    {isEditing ? (
                                      <div className="space-y-2">
                                        <ProductAutocomplete
                                          products={products}
                                          value={item.description}
                                          onChange={(val) =>
                                            updateEditedItem(
                                              index,
                                              "description",
                                              val,
                                            )
                                          }
                                          onSelect={(product) =>
                                            handleProductSelect(index, product)
                                          }
                                          placeholder="Model name"
                                          type="name"
                                          className="h-9 text-sm"
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                          <Input
                                            value={(item as any).serialNumber || ""}
                                            readOnly={snAutoGenerate}
                                            onChange={!snAutoGenerate ? (e) => updateEditedItem(index, "serialNumber" as any, e.target.value) : undefined}
                                            className={`h-8 text-sm font-mono ${snAutoGenerate ? "bg-muted cursor-default" : ""}`}
                                            placeholder={snAutoGenerate ? "SN (auto)" : "Enter SN"}
                                          />
                                          <Input
                                            value={(item as any).imeiNumber || ""}
                                            onChange={(e) =>
                                              updateEditedItem(
                                                index,
                                                "imeiNumber" as any,
                                                e.target.value,
                                              )
                                            }
                                            className="h-8 text-sm"
                                            placeholder="IMEI 1"
                                          />
                                          <Input
                                            value={(item as any).storage || ""}
                                            list="purchase-storage-options"
                                            onChange={(e) =>
                                              updateEditedItem(
                                                index,
                                                "storage" as any,
                                                e.target.value,
                                              )
                                            }
                                            className="h-8 text-sm"
                                            placeholder="Storage"
                                          />
                                          <Input
                                            value={(item as any).color || ""}
                                            onChange={(e) =>
                                              updateEditedItem(
                                                index,
                                                "color" as any,
                                                e.target.value,
                                              )
                                            }
                                            className="h-8 text-sm"
                                            placeholder="Color"
                                          />
                                          <Input
                                            value={(item as any).batteryHealth || ""}
                                            onChange={(e) =>
                                              updateEditedItem(
                                                index,
                                                "batteryHealth" as any,
                                                e.target.value,
                                              )
                                            }
                                            className="h-8 text-sm"
                                            placeholder="Battery Health (e.g. 87%)"
                                          />
                                          <Input
                                            value={(item as any).warranty || ""}
                                            onChange={(e) =>
                                              updateEditedItem(
                                                index,
                                                "warranty" as any,
                                                e.target.value,
                                              )
                                            }
                                            className="h-8 text-sm"
                                            placeholder="Warranty (e.g. 1 Year)"
                                          />
                                          <Input
                                            value={(item as any).whereToBuy || ""}
                                            onChange={(e) =>
                                              updateEditedItem(
                                                index,
                                                "whereToBuy" as any,
                                                e.target.value,
                                              )
                                            }
                                            className="h-8 text-sm"
                                            placeholder="Bought from (optional)"
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="font-medium break-words text-sm">
                                          {item.description}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {[
                                            (item as any).serialNumber ? `SN: ${(item as any).serialNumber}` : null,
                                            (item as any).model ? `Model: ${(item as any).model}` : null,
                                            (item as any).imeiNumber ? `IMEI 1: ${(item as any).imeiNumber}` : null,
                                            (item as any).storage || (item as any).color
                                              ? `${(item as any).storage || "-"}${(item as any).color ? ` / ${(item as any).color}` : ""}`
                                              : null,
                                            (item as any).batteryHealth ? `Battery: ${(item as any).batteryHealth}` : null,
                                            (item as any).warranty ? `Warranty: ${(item as any).warranty}` : null,
                                          ]
                                            .filter(Boolean)
                                            .map((line, idx) => (
                                              <div key={idx}>{line}</div>
                                            ))}
                                        </div>
                                        {(item as any).whereToBuy && (
                                          <div className="text-xs text-muted-foreground mt-1">
                                            Bought from: {(item as any).whereToBuy}
                                          </div>
                                        )}
                                        {item.hasError && (
                                          <p className="text-xs text-amber-600 mt-1">
                                            {item.errorMessage}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className="font-medium text-sm">1 pcs</span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {isEditing ? (
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={item.rate}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 0;
                                          if (String(Math.round(val)).length >= 10) {
                                            toast({ title: "Invalid Rate", description: "This looks like an IMEI/barcode, not a price. Please enter the correct rate.", variant: "destructive" });
                                            return;
                                          }
                                          updateEditedItem(index, "rate", val);
                                        }}
                                        className="h-9 w-28 text-right text-sm"
                                      />
                                    ) : (
                                      <span className="text-sm">
                                        {formatCurrency(item.rate)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {isEditing ? (
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={(item as any).sellingPrice || 0}
                                        onChange={(e) =>
                                          updateEditedItem(
                                            index,
                                            "sellingPrice" as any,
                                            parseFloat(e.target.value) || 0,
                                          )
                                        }
                                        className="h-9 w-28 text-right text-sm"
                                      />
                                    ) : (
                                      <span className="text-sm">
                                        {formatCurrency((item as any).sellingPrice || 0)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold text-sm">
                                    {formatCurrency(item.amount)}
                                  </td>
                                  {isEditing && (
                                    <td className="px-4 py-3 text-right">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeEditedItemRow(index)}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Repair Cost Section (edit mode) */}
                    {isEditing && editedBill && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm sm:text-base font-semibold flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <Wrench className="h-4 w-4 text-amber-600" />
                              Repair Cost
                              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                            </span>
                            {editedBill.items.some((it) => it.description.trim()) && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const defaultIdx = editedBill.items.findIndex((it) => it.description.trim());
                                  setEditRepairCosts((prev) => [...prev, { itemIndex: defaultIdx >= 0 ? defaultIdx : 0, amount: 0, notes: "" }]);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Repair Cost
                              </Button>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {editRepairCosts.length === 0 && (
                            <p className="text-sm text-muted-foreground">No repair costs. Click "Add Repair Cost" to add one.</p>
                          )}
                          {editRepairCosts.map((rc, rcIdx) => {
                            const validItems = editedBill.items.filter((it) => it.description.trim());
                            const isSingle = validItems.length <= 1;
                            return (
                              <div key={rcIdx} className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg border bg-amber-50/30">
                                {!isSingle && (
                                  <select
                                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm flex-1 min-w-[140px]"
                                    value={rc.itemIndex}
                                    onChange={(e) => {
                                      const updated = [...editRepairCosts];
                                      updated[rcIdx] = { ...rc, itemIndex: Number(e.target.value) };
                                      setEditRepairCosts(updated);
                                    }}
                                  >
                                    {editedBill.items.map((it, i) =>
                                      it.description.trim() ? (
                                        <option key={i} value={i}>
                                          {it.description} {(it as any).imeiNumber ? `(${(it as any).imeiNumber})` : (it as any).serialNumber ? `(SN: ${(it as any).serialNumber})` : ""}
                                        </option>
                                      ) : null
                                    )}
                                  </select>
                                )}
                                {isSingle && (
                                  <div className="flex-1 min-w-[140px] h-9 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground truncate">
                                    {editedBill.items[rc.itemIndex]?.description || "Device"}
                                  </div>
                                )}
                                <div className="flex items-center gap-1 w-32 shrink-0">
                                  <IndianRupee className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                    placeholder="Amount"
                                    value={rc.amount || ""}
                                    onChange={(e) => {
                                      const newAmount = Number(e.target.value) || 0;
                                      const updated = [...editRepairCosts];
                                      updated[rcIdx] = { ...rc, amount: newAmount };
                                      setEditRepairCosts(updated);
                                      // Recalculate selling price based on effective cost (rate + repair)
                                      const itemRate = Number((editedBill?.items[rc.itemIndex] as any)?.rate) || 0;
                                      updateEditedItem(rc.itemIndex, "sellingPrice" as any,
                                        calculateSellingPriceFromCommission(itemRate, companyProfile?.commissionSettings) + newAmount);
                                    }}
                                  />
                                </div>
                                <input
                                  type="text"
                                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                                  placeholder="Notes (e.g. screen repair)"
                                  value={rc.notes}
                                  onChange={(e) => {
                                    const updated = [...editRepairCosts];
                                    updated[rcIdx] = { ...rc, notes: e.target.value };
                                    setEditRepairCosts(updated);
                                  }}
                                />
                                <button
                                  type="button"
                                  className="h-9 w-9 flex items-center justify-center rounded-md border border-input hover:bg-destructive/10 text-destructive shrink-0"
                                  onClick={() => setEditRepairCosts((prev) => prev.filter((_, i) => i !== rcIdx))}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            );
                          })}
                          {editRepairCosts.length > 0 && (
                            <div className="flex justify-end text-sm text-amber-700 font-medium pt-1">
                              Total Repair Cost: {formatCurrency(editRepairCosts.reduce((s, r) => s + (r.amount || 0), 0))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Inventory Units Section */}
                    {!isEditing && selectedBill && (() => {
                      const snNum = (sn?: string) => { const m = (sn || "").match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; };
                      const billUnits = (inventoryUnits as InventoryUnit[])
                        .filter((u) => (u as any).purchaseBillId === selectedBill.id)
                        .sort((a, b) => snNum(a.serialNumber) - snNum(b.serialNumber));
                      if (billUnits.length === 0) return null;
                      return (
                        <Card className="overflow-hidden shadow-sm border-2 border-emerald-200 bg-emerald-50/5">
                          <CardHeader className="bg-emerald-100/30 px-5 py-3.5">
                            <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2 text-emerald-700">
                              <PackagePlus className="h-5 w-5" />
                              Inventory Units
                              <span className="ml-auto text-xs font-normal text-muted-foreground">
                                {billUnits.length} unit(s)
                              </span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-emerald-100/40">
                                  <tr>
                                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">#</th>
                                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide min-w-[180px]">Product</th>
                                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">IMEI / SN</th>
                                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Status</th>
                                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Cost</th>
                                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Print</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-100">
                                  {billUnits.map((unit, idx) => (
                                    <tr key={unit.id} className="hover:bg-emerald-50/30">
                                      <td className="px-4 py-2.5 text-muted-foreground">{idx + 1}</td>
                                      <td className="px-4 py-2.5">
                                        <div className="font-medium text-sm">
                                          {unit.model || unit.productName || "—"}
                                        </div>
                                        {(unit.storage || unit.color) && (
                                          <div className="text-xs text-muted-foreground">
                                            {[unit.storage, unit.color].filter(Boolean).join(" / ")}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5 font-mono text-xs">
                                        {unit.imeiNumber
                                          ? <span>{unit.imeiNumber}</span>
                                          : unit.serialNumber
                                            ? <span className="text-muted-foreground">SN: {unit.serialNumber}</span>
                                            : <span className="text-muted-foreground">—</span>
                                        }
                                        {unit.serialNumber && unit.imeiNumber && (
                                          <div className="text-muted-foreground">SN: {unit.serialNumber}</div>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                          unit.status === "in_stock"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : unit.status === "sold"
                                              ? "bg-blue-100 text-blue-700"
                                              : unit.status === "returned"
                                                ? "bg-orange-100 text-orange-700"
                                                : "bg-muted text-muted-foreground"
                                        }`}>
                                          {unit.status === "in_stock" ? "In Stock" : unit.status === "sold" ? "Sold" : unit.status === "returned" ? "Returned" : unit.status || "—"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-right">
                                        {unit.purchasePrice != null ? (
                                          <div>
                                            <div className="text-sm font-medium">
                                              {formatCurrency((unit.purchasePrice || 0) + (unit.repairCost || 0))}
                                            </div>
                                            {unit.repairCost ? (
                                              <div className="text-xs text-amber-600 flex items-center justify-end gap-0.5">
                                                <Wrench className="h-3 w-3" />
                                                +{formatCurrency(unit.repairCost)}
                                              </div>
                                            ) : null}
                                          </div>
                                        ) : <span className="text-muted-foreground">—</span>}
                                      </td>
                                      <td className="px-4 py-2.5 text-right">
                                        <button
                                          className="inline-flex items-center justify-center rounded-md p-1.5 hover:bg-emerald-100 text-emerald-700 disabled:opacity-40"
                                          title={unit.status === "returned" ? "Returned — cannot print" : "Print barcode"}
                                          disabled={(!unit.imeiNumber && !unit.serialNumber) || unit.status === "returned"}
                                          onClick={() => printBarcodeStickers([unit])}
                                        >
                                          <Printer className="h-4 w-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}

                    {/* Purchase Returns Section */}
                    {selectedBill?.returns && selectedBill.returns.length > 0 && (
                      <Card className="overflow-hidden shadow-sm border-2 border-orange-200 bg-orange-50/5">
                        <CardHeader className="bg-orange-100/30 px-5 py-3.5">
                          <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2 text-orange-600">
                            <RotateCcw className="h-5 w-5" />
                            Purchase Returns
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-orange-100/50">
                                <tr>
                                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                                    Item / Reason
                                  </th>
                                  <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                                    Qty
                                  </th>
                                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                                    Date
                                  </th>
                                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                                    Value
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-orange-100">
                                {selectedBill.returns.map((ret) =>
                                  ret.items.map((item, idx) => (
                                    <tr
                                      key={`${ret.id}-${idx}`}
                                      className="hover:bg-orange-100/10"
                                    >
                                      <td className="px-4 py-3">
                                        <div className="space-y-1">
                                          <p className="font-semibold text-sm text-foreground">
                                            {item.description}
                                          </p>
                                          {ret.notes && (
                                            <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                                              <BookOpen className="h-3 w-3" />{" "}
                                              {ret.notes}
                                            </p>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <Badge
                                          variant="outline"
                                          className="text-orange-600 border-orange-200 bg-orange-100/50 font-semibold text-xs"
                                        >
                                          -{item.quantity}
                                        </Badge>
                                      </td>
                                      <td className="px-4 py-3 text-right text-muted-foreground text-sm">
                                        {formatDate(ret.returnDate)}
                                      </td>
                                      <td className="px-4 py-3 text-right font-semibold text-orange-600">
                                        -
                                        {formatCurrency(
                                          item.quantity * item.rate,
                                        )}
                                      </td>
                                    </tr>
                                  )),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Totals Summary */}
                    <Card className="shadow-sm">
                      <CardHeader className="bg-muted/40 px-5 py-3.5">
                        <CardTitle className="text-sm sm:text-base font-semibold">
                          Bill Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-5 px-5 pb-5">
                        {(() => {
                          const currentBill = isEditing ? editedBill : selectedBill;
                          const originalBill = selectedBill;

                          const subtotal =
                            currentBill?.items?.reduce(
                              (sum, item) => sum + (item.amount || 0),
                              0,
                            ) || 0;
                          const courier = currentBill?.courierCharges || 0;
                          const expense = currentBill?.expenseAmount || 0;
                          const grossTotal = subtotal + courier + expense;

                          const returnsTotal =
                            selectedBill?.returns?.reduce(
                              (sum, r) => sum + (r.totalReturnValue || 0),
                              0,
                            ) || 0;

                          const netTotal = grossTotal - returnsTotal;
                          const paidAmount = currentBill?.paidAmount || 0;
                          const balance = netTotal - paidAmount;

                          const originalSubtotal =
                            originalBill?.items?.reduce(
                              (sum, item) => sum + (item.amount || 0),
                              0,
                            ) || 0;
                          const originalGrossTotal =
                            originalSubtotal +
                            (originalBill?.courierCharges || 0) +
                            (originalBill?.expenseAmount || 0);
                          const originalNetTotal = originalGrossTotal - returnsTotal;
                          const netChange = netTotal - originalNetTotal;

                          return (
                            <div className="max-w-lg ml-auto space-y-2.5">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Items Subtotal</span>
                                <span className="font-semibold">
                                  {formatCurrency(subtotal)}
                                </span>
                              </div>
                              {courier > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Courier Charges</span>
                                  <span className="font-semibold">
                                    {formatCurrency(courier)}
                                  </span>
                                </div>
                              )}
                              {expense > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Extra Expenses</span>
                                  <span className="font-semibold">
                                    {formatCurrency(expense)}
                                  </span>
                                </div>
                              )}

                              <div className="flex justify-between text-sm border-t pt-2">
                                <span className="text-muted-foreground">Gross Bill Total</span>
                                <span className="font-semibold">
                                  {formatCurrency(grossTotal)}
                                </span>
                              </div>

                              {returnsTotal > 0 && (
                                <div className="flex justify-between text-sm text-red-600">
                                  <span>- Returns</span>
                                  <span className="font-semibold">
                                    {formatCurrency(returnsTotal)}
                                  </span>
                                </div>
                              )}

                              <div className="flex justify-between text-base sm:text-lg border-t pt-2 font-bold">
                                <span>Net Bill Total</span>
                                <span className="text-primary">
                                  {formatCurrency(netTotal)}
                                </span>
                              </div>

                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total Paid</span>
                                <span className="font-semibold text-emerald-600">
                                  {formatCurrency(paidAmount)}
                                </span>
                              </div>

                              <div className="flex justify-between text-sm border-t pt-2">
                                <span className="text-muted-foreground">
                                  {balance >= 0 ? "Balance Due" : "Overpaid Amount"}
                                </span>
                                <span
                                  className={`font-semibold ${balance >= 0 ? "text-orange-600" : "text-blue-600"}`}
                                >
                                  {formatCurrency(Math.abs(balance))}
                                </span>
                              </div>

                              {isEditing && (
                                <div className="flex justify-between text-sm border-t pt-2">
                                  <span className="text-muted-foreground">
                                    Change vs Saved Bill
                                  </span>
                                  <span
                                    className={`font-semibold ${netChange > 0 ? "text-amber-600" : netChange < 0 ? "text-emerald-600" : "text-muted-foreground"}`}
                                  >
                                    {netChange > 0 ? "+" : ""}
                                    {formatCurrency(netChange)}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
              {/* Sticky footer actions (always visible on mobile) */}
              {!isEditing && selectedBill && (
                <div className="shrink-0 border-t bg-background px-6 sm:px-8 py-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                  <div className="flex flex-col lg:flex-row gap-3 justify-end">
                    {/* <Badge variant="secondary" className="py-2 px-4 text-sm">
                      <PackagePlus className="h-4 w-4 mr-2" />
                      Added to Inventory
                    </Badge> */}
                    {/* Repair Units button removed — app enforces required fields on entry,
                        status changes automatically on sale/return, and purchase bills
                        auto-sync to inventory on save, so this repair path is never needed.
                    <Button
                      variant="outline"
                      size="default"
                      disabled={repairingInventory}
                      onClick={async () => {
                        if (!selectedBill) return;
                        setRepairingInventory(true);
                        try {
                          const result = await repairInventoryFromBill(selectedBill);
                          console.log("[RepairInventory] Log:\n" + result.log.join("\n"));
                          const updatedBill = { ...selectedBill, itemsAddedToInventory: true, inventoryAddedAt: new Date().toISOString() };
                          setSelectedBill(updatedBill);
                          setBills((prev) => prev.map((b) => b.id === selectedBill.id ? updatedBill : b));
                          toast({
                            title: result.created > 0 || result.restored > 0
                              ? `Fixed: ${result.restored} unit(s) repaired, badge updated`
                              : "Inventory verified — badge updated",
                          });
                        } catch (err) {
                          console.error(err);
                          toast({ title: "Repair Failed", description: "Could not repair inventory units.", variant: "destructive" });
                        } finally {
                          setRepairingInventory(false);
                        }
                      }}
                    >
                      {repairingInventory ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Repairing...</>
                      ) : (
                        <><PackagePlus className="h-4 w-4 mr-2" />Repair Units</>
                      )}
                    </Button>
                    */}
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => {
                        if (!selectedBill) return;
                        const snN = (sn?: string) => { const m = (sn || "").match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; };
                        const billUnits = (inventoryUnits as InventoryUnit[])
                          .filter((u) => (u as any).purchaseBillId === selectedBill.id && u.imeiNumber && u.status !== "returned")
                          .sort((a, b) => snN(a.serialNumber) - snN(b.serialNumber));
                        if (billUnits.length === 0) {
                          toast({ title: "No barcodes", description: "No IMEI units found for this bill." });
                        } else {
                          downloadBarcodesPDF(billUnits);
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Barcodes
                    </Button>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => {
                        if (!selectedBill) return;
                        const snN = (sn?: string) => { const m = (sn || "").match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; };
                        const billUnits = (inventoryUnits as InventoryUnit[])
                          .filter((u) => (u as any).purchaseBillId === selectedBill.id && u.imeiNumber && u.status !== "returned")
                          .sort((a, b) => snN(a.serialNumber) - snN(b.serialNumber));
                        if (billUnits.length === 0) {
                          toast({ title: "No barcodes", description: "No IMEI units found for this bill." });
                        } else {
                          printBarcodeStickers(billUnits);
                        }
                      }}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Print Barcodes
                    </Button>
                    {selectedBill.billImage ? (
                      <Button
                        variant="outline"
                        size="default"
                        onClick={() => setViewImageBill(selectedBill)}
                      >
                        <Image className="h-4 w-4 mr-2" />
                        View Original Bill
                      </Button>
                    ) : (
                      <Button variant="outline" size="default" disabled>
                        <Image className="h-4 w-4 mr-2" />
                        No Image
                      </Button>
                    )}
                    {selectedBill.isInvoice && selectedBill.invoiceFileUrl && (
                      <>
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => window.open(selectedBill.invoiceFileUrl, "_blank", "noopener,noreferrer")}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Invoice
                        </Button>
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() =>
                            downloadImage(
                              selectedBill.invoiceFileUrl!,
                              selectedBill.invoiceFileName || `invoice-${selectedBill.billNumber || selectedBill.id}`,
                            )
                          }
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Invoice
                        </Button>
                      </>
                    )}
                    {!(selectedBill.isInvoice && selectedBill.invoiceFileUrl) && (
                      <>
                        <input
                          ref={detailInvoiceInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file || !selectedBill) return;
                            setDetailInvoiceUploading(true);
                            try {
                              const uploaded = await uploadPurchaseBillInvoice(selectedBill.id, file);
                              await updatePurchaseBillInvoice(selectedBill.id, {
                                invoiceFileUrl: uploaded.url,
                                invoiceStoragePath: uploaded.storagePath,
                                invoiceFileName: file.name,
                                invoiceFileType: file.type,
                                isInvoice: true,
                              });
                              const updated: PurchaseBill = {
                                ...selectedBill,
                                isInvoice: true,
                                invoiceFileUrl: uploaded.url,
                                invoiceStoragePath: uploaded.storagePath,
                                invoiceFileName: file.name,
                                invoiceFileType: file.type,
                              };
                              setSelectedBill(updated);
                              setBills((prev) => prev.map((b) => (b.id === selectedBill.id ? updated : b)));
                              sonnerToast.success("Invoice attached");
                            } catch {
                              sonnerToast.error("Failed to upload invoice");
                            } finally {
                              setDetailInvoiceUploading(false);
                            }
                          }}
                        />
                        <Button
                          variant="outline"
                          size="default"
                          disabled={detailInvoiceUploading}
                          onClick={() => detailInvoiceInputRef.current?.click()}
                        >
                          {detailInvoiceUploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Attach Invoice
                        </Button>
                      </>
                    )}
                    <Button
                      size="default"
                      variant={
                        selectedBill.paymentStatus === "paid"
                          ? "secondary"
                          : "default"
                      }
                      onClick={() => handleTogglePayment(selectedBill)}
                    >
                      {selectedBill.paymentStatus === "paid"
                        ? "Mark as Pending"
                        : "Mark as Paid"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Vendor ID Photos — compact strip, always visible */}
              {selectedBill && (
                <div className="shrink-0 border-t border-border/50 bg-background px-6 sm:px-8 py-2.5">
                  <div className="flex items-center gap-3">
                    {/* Icon + label */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <p className="text-xs font-semibold whitespace-nowrap">Vendor ID</p>
                    </div>

                    {/* Slots */}
                    <div className="flex flex-1 items-center gap-2 min-w-0">
                      {(["Front", "Back"] as const).map((side, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className={[
                            "shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            idx === 0
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
                          ].join(" ")}>
                            {side}
                          </span>

                          {vendorIdImages[idx] ? (
                            <div
                              className="group relative h-10 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 cursor-zoom-in"
                              onClick={() => setVendorPreviewImage({ src: vendorIdImages[idx], label: `ID ${side}` })}
                            >
                              <img src={vendorIdImages[idx]} alt={`Vendor ID ${side}`} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Download className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          ) : (
                            <label className="flex h-10 w-16 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all">
                              {vendorIdUploading[idx]
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                : <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
                              }
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={vendorIdInputRefs[idx]}
                                disabled={vendorIdUploading[idx]}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setVendorIdUploading((prev) => { const n: [boolean, boolean] = [...prev] as [boolean, boolean]; n[idx] = true; return n; });
                                  try {
                                    const compressed = await compressFile(file, 900);
                                    setVendorIdImages((prev) => { const n: [string, string] = [...prev] as [string, string]; n[idx] = compressed; return n; });
                                  } catch {
                                    sonnerToast.error("Failed to process image");
                                  } finally {
                                    setVendorIdUploading((prev) => { const n: [boolean, boolean] = [...prev] as [boolean, boolean]; n[idx] = false; return n; });
                                    e.target.value = "";
                                  }
                                }}
                              />
                            </label>
                          )}

                          {vendorIdImages[idx] && (
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="Download"
                                onClick={() => downloadImage(vendorIdImages[idx], `vendor-id-${side.toLowerCase()}-${selectedBill.billNumber || selectedBill.id}.jpg`)}
                              >
                                <Download className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Remove"
                                onClick={() => setVendorIdImages((prev) => { const n: [string, string] = [...prev] as [string, string]; n[idx] = ""; return n; })}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Unsaved + Save */}
                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                      {(vendorIdImages[0] !== (selectedBill.vendorImages?.[0] || "") || vendorIdImages[1] !== (selectedBill.vendorImages?.[1] || "")) && (
                        <span className="hidden sm:inline text-[10px] text-amber-600 font-medium">Unsaved</span>
                      )}
                      <Button
                        size="sm"
                        className="h-7 rounded-lg px-2.5 text-xs"
                        disabled={vendorIdSaving || vendorIdUploading.some(Boolean)}
                        onClick={async () => {
                          if (!selectedBill) return;
                          setVendorIdSaving(true);
                          try {
                            const uploaded = await Promise.all(
                              (["front", "back"] as const).map(async (side, i) => {
                                const img = vendorIdImages[i] || "";
                                if (img.startsWith("data:")) {
                                  return await uploadPurchaseBillVendorImage(selectedBill.id, img, side);
                                }
                                return img;
                              })
                            );
                            const finalImages = uploaded as [string, string];
                            await updatePurchaseBillImages(selectedBill.id, finalImages);
                            setVendorIdImages(finalImages);
                            const updated = { ...selectedBill, vendorImages: finalImages.filter(Boolean) };
                            setSelectedBill(updated);
                            setBills((prev) => prev.map((b) => b.id === selectedBill.id ? updated : b));
                            sonnerToast.success("Vendor ID photos saved");
                          } catch {
                            sonnerToast.error("Failed to save photos");
                          } finally {
                            setVendorIdSaving(false);
                          }
                        }}
                      >
                        {vendorIdSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Vendor ID Lightbox */}
              {vendorPreviewImage && (
                <div
                  className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                  onClick={() => setVendorPreviewImage(null)}
                >
                  <div className="relative mx-4 max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between rounded-t-2xl bg-black/60 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-white/80" />
                        <span className="text-sm font-semibold text-white">{vendorPreviewImage.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-medium text-white transition-colors"
                          onClick={(e) => { e.stopPropagation(); downloadImage(vendorPreviewImage.src, `vendor-${vendorPreviewImage.label.toLowerCase().replace(" ", "-")}-${selectedBill?.billNumber || ""}.jpg`); }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                        <button
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
                          onClick={() => setVendorPreviewImage(null)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <img
                      src={vendorPreviewImage.src}
                      alt={vendorPreviewImage.label}
                      className="w-full rounded-b-2xl object-contain max-h-[75vh]"
                    />
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Inventory Dialog - Confirm Inventory Mapping */}
          <Dialog
            open={!!inventoryDialogBill}
            onOpenChange={(open) => !open && setInventoryDialogBill(null)}
          >
            <DialogContent className="dialog-form-content max-w-2xl">
              <DialogHeader className="dialog-form-header">
                <DialogTitle className="flex items-center gap-2">
                  <PackagePlus className="h-5 w-5 text-emerald-600" />
                  Add to Inventory
                </DialogTitle>
              </DialogHeader>

              <div className="dialog-form-body space-y-4">
                {lastInventoryError && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">Inventory error details</div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                lastInventoryError,
                              );
                              toast({
                                title: "Copied",
                                description: "Error details copied to clipboard",
                              });
                            } catch {
                              toast({
                                title: "Copy failed",
                                description:
                                  "Could not copy automatically. Please screenshot this section.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Copy
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLastInventoryError(null)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
                      {lastInventoryError}
                    </pre>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Confirm IMEI and product mapping for each row. Purchase rate will be
                  saved as cost only.
                </p>

                <div className="space-y-3">
                  {inventoryItems.map((item, index) => {
                    const rowImeis = getInventoryRowImeis(item);
                    const serializedRow = isSerializedInventoryRow(item);
                    const imeiCountMismatch =
                      serializedRow && Number(item.quantity) !== rowImeis.length;
                    return (
                      <div key={index} className="border rounded-lg p-3 bg-muted/30">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-sm">{item.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} {item.unit}
                            </p>
                            {serializedRow ? (
                              <p
                                className={`text-xs mt-1 ${imeiCountMismatch
                                    ? "text-amber-600"
                                    : "text-emerald-600"
                                  }`}
                              >
                                IMEI entries: {rowImeis.length}
                                {imeiCountMismatch
                                  ? ` (must match qty ${item.quantity})`
                                  : ""}
                              </p>
                            ) : null}
                            {((item.model || item.imeiNumber || item.storage || item.color || (item as any).serialNumber) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {(item as any).serialNumber ? `SN: ${(item as any).serialNumber} | ` : ""}
                                {item.model ? `Model: ${item.model} | ` : ""}
                                {item.imeiNumber ? `IMEI 1: ${item.imeiNumber} | ` : ""}
                                {item.storage || "-"}
                                {item.color ? ` / ${item.color}` : ""}
                              </p>
                            )) || null}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            Purchase
                          </Badge>
                        </div>

                        <details className="rounded-md border border-dashed bg-background/60 p-2">
                          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                            IMEI List (one per line, comma, or semicolon)
                          </summary>
                          <div className="mt-2 space-y-2">
                            <Textarea
                              rows={3}
                              value={item.imeiListText || item.imeiNumber || ""}
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                newItems[index].imeiListText = e.target.value;
                                const parsed = getInventoryRowImeis(newItems[index]);
                                newItems[index].imeiNumber = parsed[0] || "";
                                if (parsed.length > 0) {
                                  newItems[index].unit = "pcs";
                                }
                                setInventoryItems(newItems);
                              }}
                              placeholder="350108720225827&#10;350108720225828"
                              className="text-xs"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              Parsed IMEI count: {rowImeis.length}
                            </p>
                          </div>
                        </details>

                        {/* Matching Option */}
                        <div className="mt-2 p-2 bg-background/50 rounded-md border border-dashed">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 px-1">
                            Inventory Action
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={item.isNewProduct ? "default" : "outline"}
                              size="sm"
                              className="flex-1 h-8 text-xs py-0"
                              onClick={() => {
                                const newItems = [...inventoryItems];
                                newItems[index].isNewProduct = true;
                                setInventoryItems(newItems);
                              }}
                            >
                              Create New
                            </Button>
                            <Button
                              type="button"
                              variant={!item.isNewProduct ? "default" : "outline"}
                              size="sm"
                              className="flex-1 h-8 text-xs py-0"
                              onClick={() => {
                                const newItems = [...inventoryItems];
                                newItems[index].isNewProduct = false;
                                setInventoryItems(newItems);
                              }}
                            >
                              Update Stock
                            </Button>
                          </div>

                          {/* Product Selector for Update Stock */}
                          {!item.isNewProduct && (
                            <div className="mt-2 space-y-1">
                              <Label className="text-[10px] px-1">
                                Selected Product
                              </Label>
                              <Select
                                value={item.productId || ""}
                                onValueChange={(val) => {
                                  const newItems = [...inventoryItems];
                                  newItems[index].productId = val;
                                  const selectedProduct = products.find(
                                    (p) => p.id === val,
                                  );
                                  if (selectedProduct) {
                                    newItems[index].hsnCode =
                                      selectedProduct.hsnCode || "";
                                  }
                                  setInventoryItems(newItems);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select Product" />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map((p) => (
                                    <SelectItem
                                      key={p.id}
                                      value={p.id}
                                      className="text-xs"
                                    >
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {!item.productId && !item.isNewProduct && (
                            <p className="text-[10px] text-amber-600 mt-1 px-1">
                              No matching product found by name. Please select one
                              manually.
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold">Vendor *</Label>
                            <Select
                              value={item.vendorId}
                              onValueChange={(val) => {
                                const newItems = [...inventoryItems];
                                newItems[index].vendorId = val;
                                setInventoryItems(newItems);
                              }}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select vendor" />
                              </SelectTrigger>
                              <SelectContent>
                                {parties.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold">
                              Weight (optional)
                            </Label>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                step="0.01"
                                className="h-9 flex-1"
                                value={item.weight}
                                onChange={(e) => {
                                  const newItems = [...inventoryItems];
                                  newItems[index].weight =
                                    parseFloat(e.target.value) || 0;
                                  setInventoryItems(newItems);
                                }}
                                placeholder="0.00"
                              />
                              <Select
                                value={item.weightUnit}
                                onValueChange={(val) => {
                                  const newItems = [...inventoryItems];
                                  newItems[index].weightUnit = val;
                                  setInventoryItems(newItems);
                                }}
                              >
                                <SelectTrigger className="h-9 w-16 px-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="g">g</SelectItem>
                                  <SelectItem value="kg">kg</SelectItem>
                                  <SelectItem value="mg">mg</SelectItem>
                                  <SelectItem value="ct">ct</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Model</Label>
                            <Input
                              value={item.model || ""}
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                newItems[index].model = e.target.value;
                                setInventoryItems(newItems);
                              }}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">IMEI 1</Label>
                            {(() => {
                              const c = checkImeiConflict(item.imeiNumber || "");
                              return (
                                <>
                                  <Input
                                    value={item.imeiNumber || ""}
                                    onChange={(e) => {
                                      const newItems = [...inventoryItems];
                                      newItems[index].imeiNumber = e.target.value;
                                      if (!newItems[index].imeiListText) {
                                        newItems[index].imeiListText = e.target.value;
                                      }
                                      if (normalizeImei(e.target.value)) {
                                        newItems[index].unit = "pcs";
                                      }
                                      setInventoryItems(newItems);
                                    }}
                                    className={`h-9 ${c ? (c.isBlocking ? "border-red-500 focus-visible:ring-red-500" : "border-orange-400 focus-visible:ring-orange-400") : ""}`}
                                    placeholder="Primary IMEI"
                                  />
                                  {c && (
                                    <p className={`text-xs mt-0.5 ${c.isBlocking ? "text-red-600" : "text-orange-600"}`}>
                                      ⚠ {c.isBlocking
                                        ? `Already in stock as ${c.foundAs} — purchased from "${c.unit.vendorName || "unknown"}". Sell it first.`
                                        : `Previously in system as ${c.foundAs} (${c.unit.status}) — purchased from "${c.unit.vendorName || "unknown"}". Verify this is the same device.`}
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Storage</Label>
                            <Input
                              value={item.storage || ""}
                              list="purchase-storage-options"
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                newItems[index].storage = e.target.value;
                                setInventoryItems(newItems);
                              }}
                              className="h-9"
                              placeholder="Storage"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Color</Label>
                            <Input
                              value={item.color || ""}
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                newItems[index].color = e.target.value;
                                setInventoryItems(newItems);
                              }}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              Battery Health
                              <span className="text-muted-foreground font-normal">(iPhone only)</span>
                            </Label>
                            <Input
                              value={item.batteryHealth || ""}
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                newItems[index].batteryHealth = e.target.value;
                                setInventoryItems(newItems);
                              }}
                              className="h-9"
                              placeholder="e.g. 87%"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Warranty</Label>
                            <Input
                              value={item.warranty || ""}
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                newItems[index].warranty = e.target.value;
                                setInventoryItems(newItems);
                              }}
                              className="h-9"
                              placeholder="e.g. 1 Year, 6 Months"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              Purchase Price
                            </Label>
                            <div className="text-sm font-medium bg-muted px-3 py-2 rounded">
                              ₹{item.purchasePrice.toFixed(2)}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Barcode (Optional)</Label>
                            <Input
                              placeholder="Scan or type barcode"
                              value={item.barcode || ""}
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                newItems[index].barcode = e.target.value;
                                setInventoryItems(newItems);
                              }}
                              className="h-9"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="dialog-form-footer flex gap-2 justify-end pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setInventoryDialogBill(null)}
                    disabled={!!loadingInventory}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => confirmAddToInventory()}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={!!loadingInventory}
                  >
                    {loadingInventory ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <PackagePlus className="h-4 w-4 mr-2" />
                    )}
                    Add to Inventory
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          {/* Purchase Bill Discard Confirmation */}
          <AlertDialog open={manualDiscardConfirmOpen} onOpenChange={setManualDiscardConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard Purchase Bill?</AlertDialogTitle>
                <AlertDialogDescription>
                  All entered data will be lost. Are you sure you want to close without saving?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Continue Editing</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => {
                    setManualDiscardConfirmOpen(false);
                    setManualCreateOpen(false);
                    resetManualCreate();
                  }}
                >
                  Discard
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <ConflictResolutionDialog
            conflicts={productConflicts}
            onResolve={handleConflictResolution}
            onCancel={handleConflictCancel}
            resolving={loading}
          />
          {selectedBillForPayment && (
            <PaymentDialog
              bill={selectedBillForPayment as any}
              open={paymentDialogOpen}
              onOpenChange={setPaymentDialogOpen}
              onPaymentCollected={handlePaymentCollected}
            />
          )}
          <PurchaseReturnForm
            open={returnDialogOpen}
            onOpenChange={(open) => {
              setReturnDialogOpen(open);
              if (!open) setEditingReturn(null);
            }}
            bill={selectedBillForReturn!}
            onSuccess={loadBills}
            editReturn={editingReturn}
          />
          <ProductForm
            open={createProductOpen}
            onOpenChange={(open) => {
              setCreateProductOpen(open);
              if (!open) {
                setCreateProductForIndex(null);
              }
            }}
            onSuccess={(newProduct) => {
              setProducts((prev) => [...prev, newProduct]);
              if (createProductForIndex !== null) {
                handleManualProductSelect(createProductForIndex, newProduct);
              }
              setCreateProductForIndex(null);
              setCreateProductOpen(false);
            }}
          />
          {/* Transaction History Dialog */}
          <Dialog
            open={historyDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                setHistoryDialogOpen(false);
                setEditingTransaction(null);
              }
            }}
          >
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
              <DialogHeader className="p-8 border-b shrink-0 bg-primary text-primary-foreground">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-3">
                      <div className="p-2 bg-background/20 rounded-lg backdrop-blur-sm">
                        <Clock className="h-6 w-6 text-primary-foreground" />
                      </div>
                      Transaction History
                    </DialogTitle>
                    {selectedBillForHistory && (
                      <p className="text-primary-foreground/80 font-medium">
                        Bill #{selectedBillForHistory.billNumber || "N/A"} •{" "}
                        {selectedBillForHistory.vendorName}
                      </p>
                    )}
                  </div>
                  {selectedBillForHistory && (
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-primary-foreground/70 uppercase font-bold tracking-widest opacity-80">
                        Remaining Balance
                      </p>
                      <p className="text-lg font-black text-primary-foreground">
                        {formatCurrency(
                          selectedBillForHistory.total -
                          (selectedBillForHistory.returns?.reduce(
                            (sum, r) => sum + r.totalReturnValue,
                            0,
                          ) || 0) -
                          selectedBillForHistory.paidAmount,
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto bg-background">
                {selectedBillForHistory && (
                  <div className="p-6 space-y-6">
                    {/* Summary Info Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <Card className="p-4 border shadow-sm">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">
                          Total Bill
                        </p>
                        <p className="text-lg font-bold">
                          {formatCurrency(selectedBillForHistory.total)}
                        </p>
                      </Card>
                      <Card className="p-4 border shadow-sm">
                        <p className="text-[10px] text-orange-600 dark:text-orange-400 uppercase font-bold mb-1">
                          Returns
                        </p>
                        <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                          -
                          {formatCurrency(
                            selectedBillForHistory.returns?.reduce(
                              (sum, r) => sum + r.totalReturnValue,
                              0,
                            ) || 0,
                          )}
                        </p>
                      </Card>
                      <Card className="p-4 border shadow-sm">
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold mb-1">
                          Total Paid
                        </p>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(selectedBillForHistory.paidAmount)}
                        </p>
                      </Card>
                      <Card className="p-4 border shadow-sm bg-accent/50 border-accent">
                        <p className="text-[10px] text-accent-foreground uppercase font-bold mb-1">
                          Net Payable
                        </p>
                        <p className="text-lg font-black text-accent-foreground">
                          {formatCurrency(
                            selectedBillForHistory.total -
                            (selectedBillForHistory.returns?.reduce(
                              (sum, r) => sum + r.totalReturnValue,
                              0,
                            ) || 0),
                          )}
                        </p>
                      </Card>
                      <Card className="p-4 border shadow-sm bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900">
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold mb-1">
                          Available Stock
                        </p>
                        <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                          {getAvailableStockForBill(selectedBillForHistory)} Units
                        </p>
                      </Card>
                    </div>

                    {/* Timeline Table */}
                    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                      <table className="w-full border-collapse">
                        <thead className="bg-muted border-b border-border">
                          <tr>
                            <th className="text-left p-4 font-bold text-xs uppercase text-muted-foreground">
                              Date
                            </th>
                            <th className="text-left p-4 font-bold text-xs uppercase text-muted-foreground">
                              Type
                            </th>
                            <th className="text-left p-4 font-bold text-xs uppercase text-muted-foreground">
                              Details
                            </th>
                            <th className="text-right p-4 font-bold text-xs uppercase text-muted-foreground">
                              Qty
                            </th>
                            <th className="text-right p-4 font-bold text-xs uppercase text-muted-foreground">
                              Amount
                            </th>
                            <th className="p-4 font-bold text-xs uppercase text-muted-foreground text-center">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {getPurchaseHistory(selectedBillForHistory).map(
                            (entry: any) => (
                              <tr
                                key={entry.id}
                                className="hover:bg-muted/50 transition-colors group"
                              >
                                <td className="p-4">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    {formatDate(entry.date)}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <Badge
                                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${entry.type === "purchase_payment"
                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                                      }`}
                                  >
                                    {entry.type === "purchase_payment"
                                      ? "Payment"
                                      : "Return"}
                                  </Badge>
                                </td>
                                <td className="p-4">
                                  <p className="text-sm font-medium text-foreground max-w-[250px] leading-relaxed">
                                    {entry.description}
                                  </p>
                                </td>
                                <td className="p-4 text-right">
                                  <span className="text-sm font-bold tabular-nums">
                                    {entry.quantity || "—"}
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <span
                                    className={`font-black tabular-nums text-sm ${entry.type === "purchase_payment"
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-green-600 dark:text-green-400"
                                      }`}
                                  >
                                    {entry.type === "purchase_payment" ? "-" : "+"}
                                    {formatCurrency(entry.amount)}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  {entry.type !== "purchase" && (
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                                        onClick={() => handleEditTransaction(entry)}
                                        disabled={
                                          isUpdatingTransaction === entry.id
                                        }
                                      >
                                        {isUpdatingTransaction === entry.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Edit2 className="h-4 w-4" />
                                        )}
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            disabled={
                                              isUpdatingTransaction === entry.id
                                            }
                                          >
                                            {isUpdatingTransaction === entry.id ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Trash2 className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-2xl">
                                          <AlertDialogHeader>
                                            <AlertDialogTitle className="text-base font-bold">
                                              Delete Transaction?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                              This will permanently remove this{" "}
                                              {entry.type} entry and update the bill
                                              balance.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel
                                              className="rounded-xl"
                                              disabled={
                                                isUpdatingTransaction === entry.id
                                              }
                                            >
                                              Cancel
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() =>
                                                handleDeleteTransaction(entry)
                                              }
                                              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                              disabled={
                                                isUpdatingTransaction === entry.id
                                              }
                                            >
                                              {isUpdatingTransaction ===
                                                entry.id ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              ) : null}
                                              Delete Forever
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Inline Edit Section */}
              {editingTransaction && (
                <div className="p-6 border-t bg-muted shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 max-w-2xl mx-auto">
                    <div className="space-y-2 flex-1">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Update Amount
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                          ₹
                        </span>
                        <Input
                          type="number"
                          value={transactionAmount}
                          onChange={(e) => setTransactionAmount(e.target.value)}
                          className="pl-8 h-12 rounded-xl text-lg font-bold"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setEditingTransaction(null)}
                        className="h-12 px-6 rounded-xl"
                        disabled={!!isUpdatingTransaction}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={saveEditedTransaction}
                        className="h-12 px-8 rounded-xl font-bold"
                        disabled={!!isUpdatingTransaction}
                      >
                        {isUpdatingTransaction ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-6 border-t bg-white shrink-0 flex justify-between items-center">
                <div className="text-xs text-muted-foreground italic">
                  * Click edit icon to modify individual payments
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setHistoryDialogOpen(false)}
                  className="px-8 rounded-xl font-bold"
                >
                  Close History
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        
        </div>
      </div>
    </div>
  );
}

export default PurchaseBills;
