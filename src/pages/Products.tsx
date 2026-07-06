import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  getProducts,
  saveProduct,
  deleteProduct,
  getCompanyProfile,
  addStockToProduct,
  getVendors,
  getProductTransactions,
  getInventoryTransactions,
  getInventoryUnits,
  getBillReturns,
  getPurchaseBills,
  syncBillPricesToInventory,
} from "@/lib/storage";
import { CompanyProfile, InventoryUnit, Product, Vendor } from "@/types";
import {
  Plus,
  Edit,
  Trash2,
  Package,
  History,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Percent,
  Calculator,
  PlusCircle,
  Search,
  Download,
  FileSpreadsheet,
  FileText as FilePdf,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ProductHistoryScreen } from "@/components/ProductHistoryScreen";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  calculateSellingPriceFromCommission,
  formatCurrency,
  roundToTwoDecimals,
} from "@/lib/billUtils";
import { calculateProductInventoryCostSummary } from "@/lib/productCosting";
import { Checkbox } from "@/components/ui/checkbox";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { format } from "date-fns";
import { ProductsPDF } from "@/components/ProductsPDF";
import { ProductForm } from "@/components/ProductForm";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";
import { dummyProducts } from "@/lib/dummyData";

const normalizeMasterPart = (value?: string) =>
  (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const buildMasterKey = (name?: string, model?: string) =>
  `${normalizeMasterPart(name)}|${normalizeMasterPart(model)}`;

const normalizeDeviceLookup = (value?: string) =>
  (value || "").toString().trim().toLowerCase().replace(/\s+/g, "");

export default function Products() {
  type StockSortOrder =
    | "none"
    | "stock-low-to-high"
    | "stock-high-to-low"
    | "value-high-to-low"
    | "value-low-to-high"
    | "name-asc"
    | "name-desc";
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<InventoryUnit[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(
    null,
  );
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [addingStock, setAddingStock] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedStockVendorId, setSelectedStockVendorId] =
    useState<string>("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [stockFormData, setStockFormData] = useState({
    quantity: "",
    purchasePrice: "",
  });
  const [unitDetailsProductId, setUnitDetailsProductId] = useState<
    string | null
  >(null);
  const [averagePrices, setAveragePrices] = useState<Record<string, number>>(
    {},
  );
  const [currentAveragePrices, setCurrentAveragePrices] = useState<
    Record<string, number>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [avgPriceFilter, setAvgPriceFilter] = useState<string>("all");
  const [resyncingPrices, setResyncingPrices] = useState(false);

  const handleResyncPrices = async () => {
    setResyncingPrices(true);
    try {
      const [allProducts, bills] = await Promise.all([
        getProducts(),
        getPurchaseBills(),
      ]);

      // Sort bills oldest → newest so the latest bill's rate wins
      const sortedBills = [...(bills as any[])].sort(
        (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
      );

      // Build map: productId → exact rate from the most recent bill with a valid price
      const billRates = new Map<string, number>();
      for (const bill of sortedBills) {
        for (const item of (bill.items || [])) {
          const rate = Number(item.rate) || 0;
          if (!rate || String(Math.round(rate)).length >= 10) continue; // skip IMEI-like rates
          const desc = (item.description || "").toLowerCase().trim();
          const product = allProducts.find(p => p.name.toLowerCase().trim() === desc);
          if (product) billRates.set(product.id, rate);
        }
      }

      // Fix every product whose purchasePrice looks like an IMEI (>= 10 digits)
      let fixed = 0;
      for (const product of allProducts) {
        const currentPrice = product.purchasePrice || 0;
        if (String(Math.round(currentPrice)).length < 10) continue; // price is fine
        const correctPrice = billRates.get(product.id);
        if (correctPrice) {
          await saveProduct({ ...product, purchasePrice: correctPrice });
          fixed++;
        }
      }

      await loadProducts();
      toast.success(
        fixed > 0
          ? `Fixed ${fixed} product(s) using exact bill rates. Inventory value updated.`
          : "No invalid prices found — all products look correct.",
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to fix prices. Please try again.");
    } finally {
      setResyncingPrices(false);
    }
  };

  const [formData, setFormData] = useState({
    name: "",
    unit: "pcs",
    purchasePrice: "",
    stock: "",
    whereToBuy: "",
    weight: "",
  });
  const [addInitialStock, setAddInitialStock] = useState(false);
  const [initialStockData, setInitialStockData] = useState({
    quantity: "",
    purchasePrice: "",
  });
  const [stockSortOrder, setStockSortOrder] = useState<StockSortOrder>("none");
  const [salesReturnUnitIds, setSalesReturnUnitIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [salesReturnImeis, setSalesReturnImeis] = useState<Set<string>>(
    () => new Set(),
  );
  const [unitDetailsTab, setUnitDetailsTab] = useState<
    "purchase" | "sell" | "sales_return"
  >("purchase");
  const [unitDetailsSearch, setUnitDetailsSearch] = useState("");
  const [unitDetailsSort, setUnitDetailsSort] = useState<
    "latest" | "oldest" | "imei_asc" | "imei_desc"
  >("latest");

  const { locked, reloadKey } = useEncryptionLock();

  // Helper: get effective purchase price for a product (avg if available, else product price)
  const getEffectivePrice = (product: Product) =>
    currentAveragePrices[product.id] || product.purchasePrice || 0;

  // Helper: compute stock value inline — no extra state needed

  const getEffectiveStock = (product: Product) => {
    if ((product.trackingType || "standard") !== "serialized") {
      return product.stock || 0;
    }

    const itemWiseStock = inventorySummaryByProduct[product.id]?.inStock || 0;
    return Math.max(product.stock || 0, itemWiseStock);
  };

  const getStockValue = (product: Product) =>
    getEffectiveStock(product) * getEffectivePrice(product);

  useEffect(() => {
    loadProducts();
    loadCompanyProfile();
    loadVendors();
  }, [locked, reloadKey]);

  useEffect(() => {
    if (products.length > 0) {
      void loadAveragePrices(products);
    }
  }, [avgPriceFilter]);

  const loadAveragePrices = async (productsList: Product[]) => {
    const prices: Record<string, number> = {};
    const currentPrices: Record<string, number> = {};

    const allBillReturns = await getBillReturns();

    // Fetch all transactions in parallel — avoids N sequential DB calls
    const allTransactions = await Promise.all(
      productsList.map((p) => getProductTransactions(p.id)),
    );

    productsList.forEach((product, index) => {
      const transactions = allTransactions[index] || [];
      const effectiveStock =
        (product.trackingType || "standard") === "serialized"
          ? Math.max(
              product.stock || 0,
              inventorySummaryByProduct[product.id]?.inStock || 0,
            )
          : product.stock || 0;
      const costSummary = calculateProductInventoryCostSummary({
        productId: product.id,
        fallbackUnitCost: Number(product.purchasePrice || 0),
        transactions,
        billReturns: allBillReturns,
        inventoryUnits,
        effectiveStock,
      });

      prices[product.id] = costSummary.currentAverageCost;
      currentPrices[product.id] = costSummary.currentAverageCost;
    });

    setAveragePrices(prices);
    setCurrentAveragePrices(currentPrices);
  };

  const loadCompanyProfile = async () => {
    const profile = await getCompanyProfile();
    setCompanyProfile(profile);
  };

  const loadProducts = async () => {
    if (locked) { setProducts(dummyProducts); setInventoryUnits([]); setLoading(false); return; }
    try {
      setLoading(true);
      const [productsData, unitsData, inventoryTxns] = await Promise.all([
        getProducts(),
        getInventoryUnits(),
        getInventoryTransactions(),
      ]);
      const returnedUnitIds = new Set<string>();
      const returnedImeis = new Set<string>();
      for (const txn of inventoryTxns) {
        if (txn.type !== "return") continue;
        if (txn.inventoryUnitId) {
          returnedUnitIds.add(txn.inventoryUnitId);
        }
        const normalizedTxnImei = normalizeDeviceLookup(txn.imeiNumber);
        if (normalizedTxnImei) {
          returnedImeis.add(normalizedTxnImei);
        }
      }
      setProducts(productsData);
      setInventoryUnits(unitsData);
      setSalesReturnUnitIds(returnedUnitIds);
      setSalesReturnImeis(returnedImeis);
      await loadAveragePrices(productsData);
      setPage(1);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try {
      const data = await getVendors();
      setVendors(data);
    } catch (error) {
      console.error("Error loading vendors:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) { toast.error("Unable to save. Check your connection."); return; }
    setSaving(true);
    try {
      const purchasePriceNum = parseFloat(formData.purchasePrice) || 0;
      const weightNum = parseFloat(formData.weight) || 0;

      const product: Product = {
        id: editingProduct?.id || crypto.randomUUID(),
        name: formData.name,
        unit: "pcs",
        price: 0,
        purchasePrice: purchasePriceNum,
        sellingPrice: 0,
        stock: editingProduct?.stock || 0,
        whereToBuy: formData.whereToBuy,
        weight: weightNum,
        createdAt: editingProduct?.createdAt || new Date().toISOString(),
      };

      await saveProduct(product);

      if (addInitialStock && !editingProduct) {
        const quantityNum = parseFloat(initialStockData.quantity) || 0;
        const initPurchasePriceNum =
          parseFloat(initialStockData.purchasePrice) || 0;
        if (quantityNum > 0 && initPurchasePriceNum > 0) {
          await addStockToProduct(
            product.id,
            quantityNum,
            initPurchasePriceNum,
          );
          toast.success("Product created and initial stock added");
        } else {
          toast.warning(
            "Invalid initial stock details; product created without stock",
          );
        }
      } else {
        toast.success(editingProduct ? "Product updated" : "Product added");
      }

      await loadProducts();
      setIsOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setAddInitialStock(false);
    setFormData({
      name: product.name,
      unit: "pcs",
      purchasePrice: currentAveragePrices[product.id]
        ? Number(currentAveragePrices[product.id]).toFixed(2)
        : "",
      stock: product.stock ? String(product.stock) : "",
      whereToBuy: product.whereToBuy || "",
      weight: product.weight ? String(product.weight) : "",
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (locked) { toast.error("Unable to save. Check your connection."); return; }
    try {
      await deleteProduct(id);
      await loadProducts();
      toast.success("Product deleted");
    } catch (err) {
      console.error("Error deleting product:", err);
      toast.error("Failed to delete product");
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setAddInitialStock(false);
    setInitialStockData({ quantity: "", purchasePrice: "" });
    setFormData({
      name: "",
      unit: "pcs",
      purchasePrice: "",
      stock: "",
      whereToBuy: "",
      weight: "",
    });
  };

  const resetStockForm = () => {
    setSelectedProductId("");
    setSelectedStockVendorId("");
    setStockFormData({
      quantity: "",
      purchasePrice: "",
    });
  };

  const handleStockProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const selectedProduct = products.find((p) => p.id === productId);
    setSelectedStockVendorId(selectedProduct?.vendorId || "");
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast.error("Please select a product");
      return;
    }
    const quantityNum = parseFloat(stockFormData.quantity) || 0;
    const purchasePriceNum = parseFloat(stockFormData.purchasePrice) || 0;
    const selectedProduct = products.find((p) => p.id === selectedProductId);

    if (quantityNum <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (purchasePriceNum <= 0) {
      toast.error("Purchase price must be greater than 0");
      return;
    }
    if (vendors.length > 0 && !selectedStockVendorId) {
      toast.error("Please select a vendor");
      return;
    }

    setAddingStock(true);
    try {
      if (selectedProduct && selectedStockVendorId) {
        const selectedVendor = vendors.find(
          (v) => v.id === selectedStockVendorId,
        );
        if (
          selectedProduct.vendorId !== selectedStockVendorId ||
          (selectedVendor && selectedProduct.whereToBuy !== selectedVendor.name)
        ) {
          await saveProduct({
            ...selectedProduct,
            vendorId: selectedStockVendorId,
            whereToBuy:
              selectedVendor?.name || selectedProduct.whereToBuy || "",
          });
        }
      }

      await addStockToProduct(selectedProductId, quantityNum, purchasePriceNum);
      await loadProducts();
      await loadAveragePrices();
      setIsAddStockOpen(false);
      resetStockForm();
      toast.success("Stock added successfully");
    } catch (error) {
      console.error("Error adding stock:", error);
      toast.error("Failed to add stock");
    } finally {
      setAddingStock(false);
    }
  };

  const handleCreateProductAndAddStock = async () => {
    if (!formData.name) {
      toast.error("Please fill in product name");
      return;
    }
    const quantityNum = parseFloat(stockFormData.quantity) || 0;
    const purchasePriceNum = parseFloat(stockFormData.purchasePrice) || 0;

    if (quantityNum <= 0 || purchasePriceNum <= 0) {
      toast.error("Please enter quantity and purchase price");
      return;
    }

    setSaving(true);
    try {
      const weightNum = parseFloat(formData.weight) || 0;

      const product: Product = {
        id: crypto.randomUUID(),
        name: formData.name,
        unit: "pcs",
        price: 0,
        purchasePrice: purchasePriceNum,
        sellingPrice: 0,
        stock: 0,
        whereToBuy: formData.whereToBuy,
        weight: weightNum,
        createdAt: new Date().toISOString(),
      };

      await saveProduct(product);
      await addStockToProduct(product.id, quantityNum, purchasePriceNum);
      await loadProducts();
      await loadAveragePrices();
      setIsOpen(false);
      setIsAddStockOpen(false);
      resetForm();
      resetStockForm();
      toast.success("Product created and stock added");
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error("Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  const inventorySummaryByProduct = useMemo(() => {
    const map: Record<
      string,
      {
        totalUnits: number;
        inStock: number;
        sold: number;
        deadstock: number;
        imeiSearchBlob: string;
        units: InventoryUnit[];
      }
    > = {};
    const productsById = new Set(products.map((p) => p.id));
    const productIdByMasterKey = new Map<string, string>();

    for (const product of products) {
      const key = buildMasterKey(product.name, product.model);
      if (!key || productIdByMasterKey.has(key)) continue;
      productIdByMasterKey.set(key, product.id);
    }

    const resolveUnitProductId = (unit: InventoryUnit): string | null => {
      if (unit.productId && productsById.has(unit.productId)) {
        return unit.productId;
      }
      const fallbackKey = buildMasterKey(unit.productName, unit.model);
      return productIdByMasterKey.get(fallbackKey) || null;
    };

    for (const unit of inventoryUnits) {
      const key = resolveUnitProductId(unit);
      if (!key) continue;
      if (!map[key]) {
        map[key] = {
          totalUnits: 0,
          inStock: 0,
          sold: 0,
          deadstock: 0,
          imeiSearchBlob: "",
          units: [],
        };
      }
      map[key].totalUnits += 1;
      if (unit.status === "in_stock" || unit.status === "reserved") map[key].inStock += 1;
      if (unit.status === "sold") map[key].sold += 1;
      if (unit.status === "deadstock") map[key].deadstock += 1;
      if (unit.imeiNumber) {
        map[key].imeiSearchBlob += ` ${unit.imeiNumber}`;
      }
      map[key].units.push(unit);
    }
    return map;
  }, [inventoryUnits, products]);

  const filteredProducts = products
    .filter((product) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();
      const inventorySummary = inventorySummaryByProduct[product.id];
      return (
        product.name.toLowerCase().includes(query) ||
        (product.unit && product.unit.toLowerCase().includes(query)) ||
        (product.model && product.model.toLowerCase().includes(query)) ||
        (product.barcode && product.barcode.toLowerCase().includes(query)) ||
        (product.storage && product.storage.toLowerCase().includes(query)) ||
        (product.color && product.color.toLowerCase().includes(query)) ||
        ((product.trackingType || "standard").toLowerCase().includes(query)) ||
        (product.whereToBuy && product.whereToBuy.toLowerCase().includes(query)) ||
        (inventorySummary?.imeiSearchBlob || "").toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (stockSortOrder === "stock-low-to-high")
        return getEffectiveStock(a) - getEffectiveStock(b);
      if (stockSortOrder === "stock-high-to-low")
        return getEffectiveStock(b) - getEffectiveStock(a);
      if (stockSortOrder === "name-asc") return a.name.localeCompare(b.name);
      if (stockSortOrder === "name-desc") return b.name.localeCompare(a.name);
      if (stockSortOrder === "value-high-to-low")
        return getStockValue(b) - getStockValue(a);
      if (stockSortOrder === "value-low-to-high")
        return getStockValue(a) - getStockValue(b);
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const unitDetailsProduct = useMemo(
    () => products.find((p) => p.id === unitDetailsProductId) || null,
    [products, unitDetailsProductId],
  );

  const unitDetailsRows = useMemo(() => {
    if (!unitDetailsProduct) return [] as InventoryUnit[];
    const summary = inventorySummaryByProduct[unitDetailsProduct.id];
    const units = summary?.units || [];
    return [...units].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime(),
    );
  }, [inventorySummaryByProduct, unitDetailsProduct]);

  const unitDetailsCounts = useMemo(() => {
    const salesReturnCount = unitDetailsRows.filter((unit) => {
      if (salesReturnUnitIds.has(unit.id)) return true;
      const lookup = normalizeDeviceLookup(
        unit.imeiNormalized || unit.imeiNumber || unit.serialNumber,
      );
      return lookup ? salesReturnImeis.has(lookup) : false;
    }).length;
    const soldCount = unitDetailsRows.filter((unit) => unit.status === "sold").length;
    return {
      purchase: unitDetailsRows.length,
      sell: soldCount,
      sales_return: salesReturnCount,
    };
  }, [unitDetailsRows, salesReturnUnitIds, salesReturnImeis]);

  const filteredUnitDetailsRows = useMemo(() => {
    const searched = unitDetailsRows.filter((unit) => {
      if (!unitDetailsSearch.trim()) return true;
      const needle = unitDetailsSearch.trim().toLowerCase();
      const haystack = [
        unit.imeiNumber,
        unit.serialNumber,
        unit.model,
        unit.storage,
        unit.color,
        unit.status,
        unit.productName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    const tabbed = searched.filter((unit) => {
      if (unitDetailsTab === "purchase") return true;
      if (unitDetailsTab === "sell") return unit.status === "sold";
      if (salesReturnUnitIds.has(unit.id)) return true;
      const lookup = normalizeDeviceLookup(
        unit.imeiNormalized || unit.imeiNumber || unit.serialNumber,
      );
      return lookup ? salesReturnImeis.has(lookup) : false;
    });

    return [...tabbed].sort((a, b) => {
      if (unitDetailsSort === "oldest") {
        return (
          new Date(a.updatedAt || a.createdAt || 0).getTime() -
          new Date(b.updatedAt || b.createdAt || 0).getTime()
        );
      }
      if (unitDetailsSort === "imei_asc") {
        return (a.imeiNumber || a.serialNumber || "").localeCompare(
          b.imeiNumber || b.serialNumber || "",
        );
      }
      if (unitDetailsSort === "imei_desc") {
        return (b.imeiNumber || b.serialNumber || "").localeCompare(
          a.imeiNumber || a.serialNumber || "",
        );
      }
      return (
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
    });
  }, [
    unitDetailsRows,
    unitDetailsSearch,
    unitDetailsTab,
    unitDetailsSort,
    salesReturnUnitIds,
    salesReturnImeis,
  ]);

  const unitDetailsStats = useMemo(() => {
    const stats = {
      total: filteredUnitDetailsRows.length,
      inStock: 0,
      sold: 0,
      deadstock: 0,
    };
    for (const unit of filteredUnitDetailsRows) {
      if (unit.status === "in_stock") stats.inStock += 1;
      else if (unit.status === "sold") stats.sold += 1;
      else if (unit.status === "deadstock") stats.deadstock += 1;
    }
    return stats;
  }, [filteredUnitDetailsRows]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const calculateStatistics = () => {
    if (products.length === 0) {
      return {
        totalProducts: 0,
        totalStock: 0,
        averagePurchasePrice: 0,
        averageWithCommission: 0,
        totalInventoryValue: 0,
        totalValueWithCommission: 0,
        totalProfitPotential: 0,
        averageMargin: 0,
        averageMarginPercent: 0,
      };
    }

    const totalStock = products.reduce(
      (sum, p) => sum + getEffectiveStock(p),
      0,
    );

    const totalPurchaseValue = products.reduce(
      (sum, p) => sum + getStockValue(p),
      0,
    );

    const averagePurchasePrice =
      totalStock > 0 ? totalPurchaseValue / totalStock : 0;

    const averageWithCommission = calculateSellingPriceFromCommission(
      averagePurchasePrice,
      companyProfile?.commissionSettings,
    );

    const totalInventoryValue = totalPurchaseValue;

    const totalValueWithCommission = products.reduce((sum, p) => {
      const commissionPrice = calculateSellingPriceFromCommission(
        getEffectivePrice(p),
        companyProfile?.commissionSettings,
      );
      return sum + getEffectiveStock(p) * commissionPrice;
    }, 0);

    const totalProfitPotential = totalValueWithCommission - totalInventoryValue;

    const averageMargin = averageWithCommission - averagePurchasePrice;
    const averageMarginPercent =
      averagePurchasePrice > 0
        ? (averageMargin / averagePurchasePrice) * 100
        : 0;

    return {
      totalProducts: products.length,
      totalStock,
      averagePurchasePrice,
      averageWithCommission,
      totalInventoryValue,
      totalValueWithCommission,
      totalProfitPotential,
      averageMargin,
      averageMarginPercent,
    };
  };

  const stats = calculateStatistics();

  const handleDownloadExcel = () => {
    const formatCurr = (amount: number) => `₹${amount.toFixed(2)}`;
    const workbook = XLSX.utils.book_new();

    const summaryData = [
      ["INVENTORY SUMMARY"],
      ["Company:", companyProfile?.name || "Company Name"],
      ["Generated:", format(new Date(), "dd-MM-yyyy HH:mm:ss")],
      [],
      ["Total Products", stats.totalProducts],
      ["Total Stock", stats.totalStock.toFixed(2)],
      ["Inventory Value", formatCurr(stats.totalInventoryValue)],
      ["Profit Potential", formatCurr(stats.totalProfitPotential)],
      ["Average Margin %", `${stats.averageMarginPercent.toFixed(2)}%`],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet["!cols"] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    const productsData = [
      [
        "Product Name",
        "Unit",
        "Stock",
        "Purchase Price",
        "Stock Value",
      ],
    ];
    products.forEach((p) => {
      const currentAvg = getEffectivePrice(p);
      productsData.push([
        p.name,
        p.unit,
        String(getEffectiveStock(p)),
        String(currentAvg),
        String(getStockValue(p)),
      ]);
    });
    const productsSheet = XLSX.utils.aoa_to_sheet(productsData);
    productsSheet["!cols"] = [
      { wch: 30 },
      { wch: 8 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(workbook, productsSheet, "All Products");

    const topValueData = [["Rank", "Product", "Stock", "Value"]];
    [...products]
      .sort((a, b) => getStockValue(b) - getStockValue(a))
      .slice(0, 20)
      .forEach((p, i) => {
        topValueData.push([
          String(i + 1),
          p.name,
          String(getEffectiveStock(p)),
          String(getStockValue(p)),
        ]);
      });
    const topValueSheet = XLSX.utils.aoa_to_sheet(topValueData);
    topValueSheet["!cols"] = [
      { wch: 8 },
      { wch: 30 },
      { wch: 12 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(workbook, topValueSheet, "Top by Value");

    XLSX.writeFile(
      workbook,
      `Inventory_${format(new Date(), "dd-MM-yyyy")}.xlsx`,
    );
    toast.success("Excel downloaded successfully");
  };

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

  if (historyProduct) {
    return (
      <ProductHistoryScreen
        product={historyProduct}
        onBack={() => setHistoryProduct(null)}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-background p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">Items</h1>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg px-3 text-xs"
              onClick={handleResyncPrices}
              disabled={resyncingPrices}
              title="Re-sync all product prices from purchase bills"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${resyncingPrices ? "animate-spin" : ""}`} />
              {resyncingPrices ? "Fixing..." : "Fix Prices"}
            </Button>
            <ProductForm
              open={isOpen}
              onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) resetForm();
              }}
              onSuccess={() => {
                loadProducts();
              }}
              product={editingProduct}
            />
            {/* <Button
              size="sm"
              className="h-8 rounded-lg px-3 text-xs"
              onClick={() => setIsOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Item
            </Button> */}

            <Dialog
              open={isAddStockOpen}
              onOpenChange={(open) => {
                setIsAddStockOpen(open);
                if (!open) resetStockForm();
              }}
            >
              <DialogTrigger asChild>
                {/* <Button size="sm" variant="outline" className="page-header-btn">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Stock
                  </Button> */}
              </DialogTrigger>
              <DialogContent className="dialog-form-content sm:max-w-[500px]">
                <DialogHeader className="dialog-form-header">
                  <DialogTitle>Add Stock</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={handleAddStock}
                  className="dialog-form-body space-y-4"
                >
                  <div className="space-y-2">
                    <Label>Select Product *</Label>
                    <Select
                      value={selectedProductId}
                      onValueChange={handleStockProductChange}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProductId && (
                      <p className="text-xs text-muted-foreground">
                        Current stock:{" "}
                        {products.find((p) => p.id === selectedProductId)
                          ?.stock || 0}{" "}
                        {products.find((p) => p.id === selectedProductId)
                          ?.unit || ""}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Vendor *</Label>
                    <Select
                      value={selectedStockVendorId}
                      onValueChange={setSelectedStockVendorId}
                      disabled={!selectedProductId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Quantity *</Label>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={stockFormData.quantity}
                        onChange={(e) =>
                          setStockFormData({
                            ...stockFormData,
                            quantity: e.target.value,
                          })
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Purchase Price *</Label>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={stockFormData.purchasePrice}
                        onChange={(e) =>
                          setStockFormData({
                            ...stockFormData,
                            purchasePrice: e.target.value,
                          })
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Product not found?
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setIsAddStockOpen(false);
                        setIsOpen(true);
                      }}
                    >
                      Create New Product
                    </Button>
                  </div>

                  <div className="dialog-form-footer flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAddStockOpen(false);
                        resetStockForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={addingStock || !selectedProductId}
                    >
                      {addingStock ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Stock"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="default">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <PDFDownloadLink
                    document={
                      <ProductsPDF
                        products={products}
                        stats={stats}
                        averagePrices={averagePrices}
                        currentAveragePrices={currentAveragePrices}
                        stockValues={Object.fromEntries(
                          products.map((p) => [p.id, getStockValue(p)]),
                        )}
                        companyProfile={companyProfile}
                      />
                    }
                    fileName={`Inventory_Report_${new Date().toISOString().split("T")[0]}.pdf`}
                    className="flex items-center w-full px-2 py-1.5 text-sm cursor-pointer"
                  >
                    {({ loading }: { loading: boolean }) => (
                      <>
                        <FilePdf className="h-4 w-4 mr-2" />
                        {loading ? "Preparing..." : "PDF"}
                      </>
                    )}
                  </PDFDownloadLink>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2">
        <div className="h-full overflow-y-auto space-y-5 pr-1 sm:pr-2">
          <div className="flex flex-col gap-2">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search by name, model, IMEI, color..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full border-border/70 pl-9 text-sm focus-visible:border-border/70 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={stockSortOrder}
                onValueChange={(value) =>
                  setStockSortOrder(value as StockSortOrder)
                }
              >
                <SelectTrigger className="h-9 flex-1 min-w-[130px] text-sm">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default</SelectItem>
                  <SelectItem value="name-asc">Name: A → Z</SelectItem>
                  <SelectItem value="name-desc">Name: Z → A</SelectItem>
                  <SelectItem value="stock-low-to-high">
                    Stock: Low → High
                  </SelectItem>
                  <SelectItem value="stock-high-to-low">
                    Stock: High → Low
                  </SelectItem>
                  <SelectItem value="value-high-to-low">
                    Value: High → Low
                  </SelectItem>
                  <SelectItem value="value-low-to-high">
                    Value: Low → High
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={avgPriceFilter}
                onValueChange={setAvgPriceFilter}
              >
                <SelectTrigger className="h-9 flex-1 min-w-[130px] text-sm">
                  <SelectValue placeholder="Avg Price" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time Avg</SelectItem>
                  <SelectItem value="last3">Last 3 Bills</SelectItem>
                  <SelectItem value="last5">Last 5 Bills</SelectItem>
                  <SelectItem value="1month">Last 1 Month</SelectItem>
                  <SelectItem value="3month">Last 3 Months</SelectItem>
                  <SelectItem value="6month">Last 6 Months</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex sm:hidden items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 px-3">
                      <Download className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDownloadExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <PDFDownloadLink
                        document={
                          <ProductsPDF
                            products={products}
                            stats={stats}
                            averagePrices={averagePrices}
                            currentAveragePrices={currentAveragePrices}
                            stockValues={Object.fromEntries(
                              products.map((p) => [p.id, getStockValue(p)]),
                            )}
                            companyProfile={companyProfile}
                          />
                        }
                        fileName={`Inventory_Report_${new Date().toISOString().split("T")[0]}.pdf`}
                        className="flex items-center w-full px-2 py-1.5 text-sm cursor-pointer"
                      >
                        {({ loading }: { loading: boolean }) => (
                          <>
                            <FilePdf className="h-4 w-4 mr-2" />
                            {loading ? "Preparing..." : "PDF"}
                          </>
                        )}
                      </PDFDownloadLink>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex sm:hidden items-center gap-2">
              <ProductForm
                open={isOpen}
                onOpenChange={(open) => {
                  setIsOpen(open);
                  if (!open) resetForm();
                }}
                onSuccess={() => {
                  loadProducts();
                }}
                product={editingProduct}
              />
              <Button
                size="sm"
                className="flex-1 h-9"
                onClick={() => setIsOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create
              </Button>

              <Dialog
                open={isAddStockOpen}
                onOpenChange={(open) => {
                  setIsAddStockOpen(open);
                  if (!open) resetStockForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="flex-1 h-9">
                    <PlusCircle className="h-4 w-4 mr-1.5" />
                    Add Stock
                  </Button>
                </DialogTrigger>
                <DialogContent className="dialog-form-content sm:max-w-[500px]">
                  <DialogHeader className="dialog-form-header">
                    <DialogTitle>Add Stock</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={handleAddStock}
                    className="dialog-form-body space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Select Product *</Label>
                      <Select
                        value={selectedProductId}
                        onValueChange={handleStockProductChange}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedProductId && (
                        <p className="text-xs text-muted-foreground">
                          Current stock:{" "}
                          {products.find((p) => p.id === selectedProductId)
                            ?.stock || 0}{" "}
                          {products.find((p) => p.id === selectedProductId)
                            ?.unit || ""}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Vendor *</Label>
                      <Select
                        value={selectedStockVendorId}
                        onValueChange={setSelectedStockVendorId}
                        disabled={!selectedProductId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Quantity *</Label>
                        <Input
                          required
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={stockFormData.quantity}
                          onChange={(e) =>
                            setStockFormData({
                              ...stockFormData,
                              quantity: e.target.value,
                            })
                          }
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Purchase Price *</Label>
                        <Input
                          required
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={stockFormData.purchasePrice}
                          onChange={(e) =>
                            setStockFormData({
                              ...stockFormData,
                              purchasePrice: e.target.value,
                            })
                          }
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Product not found?
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setIsAddStockOpen(false);
                          setIsOpen(true);
                        }}
                      >
                        Create New Product
                      </Button>
                    </div>

                    <div className="dialog-form-footer flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddStockOpen(false);
                          resetStockForm();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={addingStock || !selectedProductId}
                      >
                        {addingStock ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          "Add Stock"
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {searchQuery && (
              <p className="text-xs text-muted-foreground">
                {filteredProducts.length}{" "}
                {filteredProducts.length === 1 ? "product" : "products"} found
              </p>
            )}
          </div>

          {products.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-blue-200 bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:border-blue-800">
                <CardContent className="flex h-full min-h-[124px] flex-col justify-between p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Products
                    </p>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-bold leading-none">{stats.totalProducts}</p>
                    <p className="text-xs text-muted-foreground">
                      {roundToTwoDecimals(stats.totalStock).toFixed(2)} total stock
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 dark:border-emerald-800">
                <CardContent className="flex h-full min-h-[124px] flex-col justify-between p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Inventory Value
                    </p>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-bold leading-none text-emerald-600">
                      {formatCurrency(stats.totalInventoryValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">At purchase price</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-gradient-to-br from-purple-500/10 to-purple-600/5 dark:border-purple-800">
                <CardContent className="flex h-full min-h-[124px] flex-col justify-between p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      With Commission
                    </p>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
                      <Calculator className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-bold leading-none text-purple-600">
                      {formatCurrency(stats.totalValueWithCommission)}
                    </p>
                    <p className="text-xs text-muted-foreground">Potential selling value</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-200 bg-gradient-to-br from-orange-500/10 to-orange-600/5 dark:border-orange-800">
                <CardContent className="flex h-full min-h-[124px] flex-col justify-between p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Profit Potential
                    </p>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
                      <TrendingUp className="h-5 w-5 text-orange-600" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-bold leading-none text-orange-600">
                      {formatCurrency(stats.totalProfitPotential)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stats.averageMarginPercent > 0
                        ? `${roundToTwoDecimals(stats.averageMarginPercent).toFixed(1)}% margin`
                        : "No margin"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {products.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">
                  No products added yet
                </p>
                <Button onClick={() => setIsOpen(true)}>
                  Add your first product
                </Button>
              </CardContent>
            </Card>
          ) : filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">
                  No products found matching your search
                </p>
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Clear Search
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pagedProducts.map((product) => {
                const purchasePrice = roundToTwoDecimals(
                  product.purchasePrice || 0,
                );
                const currentAvgPurchasePrice = roundToTwoDecimals(
                  getEffectivePrice(product),
                );
                const productVendorName =
                  vendors.find((v) => v.id === product.vendorId)?.name ||
                  product.whereToBuy ||
                  "N/A";
                const trackingType = product.trackingType || "standard";
                const unitSummary = inventorySummaryByProduct[product.id] || {
                  totalUnits: 0,
                  inStock: 0,
                  sold: 0,
                  deadstock: 0,
                  imeiSearchBlob: "",
                  units: [],
                };
                const imeiInStock = unitSummary.inStock;
                const imeiSold = unitSummary.sold;
                const imeiDeadstock = unitSummary.deadstock;
                const effectiveStock =
                  trackingType === "serialized" ? imeiInStock : product.stock;
                const stockStateLabel =
                  effectiveStock <= 0
                    ? "Out of stock"
                    : effectiveStock < 5
                      ? "Low stock"
                      : "Healthy stock";
                const stockStateClass =
                  effectiveStock <= 0
                    ? "bg-red-100 text-red-700"
                    : effectiveStock < 5
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700";
                // Computed inline — no state lookup needed
                const stockValue = roundToTwoDecimals(
                  effectiveStock * currentAvgPurchasePrice,
                );
                const stockValueWithCommission = roundToTwoDecimals(
                  effectiveStock *
                  calculateSellingPriceFromCommission(
                    currentAvgPurchasePrice,
                    companyProfile?.commissionSettings,
                  ),
                );
                const profitPotential = roundToTwoDecimals(
                  stockValueWithCommission - stockValue,
                );

                return (
                  <Card
                    key={product.id}
                    className="group relative overflow-hidden border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl"
                  >
                    <div className="pointer-events-none absolute -right-14 -top-14 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
                    <div className="pointer-events-none absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl" />

                    <div className="relative flex gap-3 p-4 pb-3">
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted/50">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-bold leading-tight line-clamp-2">
                            {product.name}
                          </h3>
                          <div className="flex flex-shrink-0 gap-1 rounded-xl border border-border/60 bg-background/85 p-1 backdrop-blur">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                              onClick={() => handleEdit(product)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Product
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete{" "}
                                    {product.name}?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(product.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-semibold ${trackingType === "serialized"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-slate-100 text-slate-700"
                              }`}
                          >
                            {trackingType === "serialized"
                              ? "IMEI Tracked"
                              : "Standard"}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-semibold ${stockStateClass}`}
                          >
                            {stockStateLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <CardContent className="relative space-y-3 pt-0">
                      <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Product Master
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* <div className="rounded-md bg-background/70 p-2">
                              <p className="text-muted-foreground">Unit</p>
                              <p className="font-medium">{product.unit || "pcs"}</p>
                            </div> */}
                          {/* <div className="rounded-md bg-background/70 p-2">
                              <p className="text-muted-foreground">Vendor</p>
                              <p className="truncate font-medium">{productVendorName}</p>
                            </div> */}
                          <div className="rounded-md bg-background/70 p-2">
                            <p className="text-muted-foreground">Avg Purchase</p>
                            <p className="font-medium">
                              {formatCurrency(
                                averagePrices[product.id] || purchasePrice,
                              )}
                            </p>
                          </div>
                        </div>


                      </div>

                      {currentAvgPurchasePrice > 0 && (
                        <div className="space-y-2 rounded-xl border border-emerald-200/50 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                              Current Avg Price
                            </span>
                            <span className="font-medium">
                              {formatCurrency(currentAvgPurchasePrice)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Stock Value
                            </span>
                            <span className="font-medium">
                              {formatCurrency(stockValue)}
                            </span>
                          </div>
                          {companyProfile?.commissionSettings && (
                            <>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Profit Potential
                                </span>
                                <span className="font-medium text-emerald-600">
                                  {formatCurrency(profitPotential)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Margin %</span>
                                <span className="font-medium">
                                  {roundToTwoDecimals(stats.averageMarginPercent).toFixed(2)}%
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-border/70 bg-background/90 hover:bg-primary/5"
                        onClick={() => {
                          setHistoryProduct(product);
                        }}
                      >
                        <History className="h-4 w-4 mr-2" />
                        View Detailed History
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          <Dialog
            open={Boolean(unitDetailsProductId)}
            onOpenChange={(open) => {
              if (!open) {
                setUnitDetailsProductId(null);
                setUnitDetailsSearch("");
                setUnitDetailsSort("latest");
                setUnitDetailsTab("purchase");
              }
            }}
          >
            <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:w-[96vw]">
              <DialogHeader className="border-b border-border bg-gradient-to-r from-primary/5 via-cyan-500/5 to-transparent px-4 py-3 sm:px-5">
                <DialogTitle className="text-base font-semibold sm:text-lg">
                  Device Details
                </DialogTitle>
                {unitDetailsProduct && (
                  <p className="text-sm text-muted-foreground">
                    {unitDetailsProduct.name}
                    {unitDetailsProduct.model ? ` | ${unitDetailsProduct.model}` : ""}
                  </p>
                )}
              </DialogHeader>
              <div className="space-y-3 overflow-y-auto p-3 sm:p-5">
                <div className="space-y-2">
                  <Tabs
                    value={unitDetailsTab}
                    onValueChange={(value) =>
                      setUnitDetailsTab(
                        value as "purchase" | "sell" | "sales_return",
                      )
                    }
                    className="w-full"
                  >
                    <TabsList className="grid h-auto w-full grid-cols-3 p-1">
                      <TabsTrigger value="purchase" className="text-xs sm:text-sm">
                        Purchase ({unitDetailsCounts.purchase})
                      </TabsTrigger>
                      <TabsTrigger value="sell" className="text-xs sm:text-sm">
                        Sell ({unitDetailsCounts.sell})
                      </TabsTrigger>
                      <TabsTrigger value="sales_return" className="text-xs sm:text-sm">
                        Sales Return ({unitDetailsCounts.sales_return})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_220px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={unitDetailsSearch}
                        onChange={(e) => setUnitDetailsSearch(e.target.value)}
                        placeholder="Search IMEI, serial, model, color..."
                        className="pl-9"
                      />
                    </div>
                    <Select
                      value={unitDetailsSort}
                      onValueChange={(value) =>
                        setUnitDetailsSort(
                          value as "latest" | "oldest" | "imei_asc" | "imei_desc",
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sort devices" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="latest">Latest first</SelectItem>
                        <SelectItem value="oldest">Oldest first</SelectItem>
                        <SelectItem value="imei_asc">IMEI A-Z</SelectItem>
                        <SelectItem value="imei_desc">IMEI Z-A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {filteredUnitDetailsRows.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">Total</p>
                        <p className="text-base font-semibold">{unitDetailsStats.total}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">In Stock</p>
                        <p className="text-base font-semibold text-emerald-700">
                          {unitDetailsStats.inStock}
                        </p>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">Sold</p>
                        <p className="text-base font-semibold text-blue-700">
                          {unitDetailsStats.sold}
                        </p>
                      </div>
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">Deadstock</p>
                        <p className="text-base font-semibold text-rose-700">
                          {unitDetailsStats.deadstock}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 md:hidden">
                      {filteredUnitDetailsRows.map((unit) => (
                        <div
                          key={unit.id}
                          className="space-y-2 rounded-lg border border-border/70 bg-background px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-mono text-[11px] leading-tight break-all">
                              {unit.imeiNumber || unit.serialNumber || "-"}
                            </p>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${unit.status === "in_stock"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : unit.status === "sold"
                                    ? "bg-blue-100 text-blue-700"
                                    : unit.status === "deadstock"
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-slate-100 text-slate-700"
                                }`}
                            >
                              {unit.status.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-xs font-medium leading-tight">
                            {[
                              unit.model || unitDetailsProduct?.model,
                              unit.storage || unitDetailsProduct?.storage,
                              unit.color || unitDetailsProduct?.color,
                            ]
                              .filter(Boolean)
                              .join(" / ") ||
                              unitDetailsProduct?.name ||
                              "-"}
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                            <p>
                              P.Price:{" "}
                              {formatCurrency(
                                unit.purchasePrice ??
                                unitDetailsProduct?.purchasePrice ??
                                0,
                              )}
                            </p>
                            <p>
                              S.Price:{" "}
                              {formatCurrency(
                                unit.sellingPrice ??
                                unitDetailsProduct?.sellingPrice ??
                                0,
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden max-h-[58vh] overflow-auto rounded-lg border border-border/70 md:block">
                      <table className="w-full min-w-[760px] text-xs">
                        <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="px-3 py-2 font-semibold">IMEI/Serial</th>
                            <th className="px-3 py-2 font-semibold">Device</th>
                            <th className="px-3 py-2 font-semibold">P.Price</th>
                            <th className="px-3 py-2 font-semibold">S.Price</th>
                            <th className="px-3 py-2 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUnitDetailsRows.map((unit, index) => (
                            <tr
                              key={unit.id}
                              className={`align-top ${index % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                            >
                              <td className="px-3 py-2 font-mono">
                                {unit.imeiNumber || unit.serialNumber || "-"}
                              </td>
                              <td className="px-3 py-2">
                                {[
                                  unit.model || unitDetailsProduct?.model,
                                  unit.storage || unitDetailsProduct?.storage,
                                  unit.color || unitDetailsProduct?.color,
                                ]
                                  .filter(Boolean)
                                  .join(" / ") ||
                                  unitDetailsProduct?.name ||
                                  "-"}
                              </td>
                              <td className="px-3 py-2">
                                {formatCurrency(
                                  unit.purchasePrice ??
                                  unitDetailsProduct?.purchasePrice ??
                                  0,
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {formatCurrency(
                                  unit.sellingPrice ??
                                  unitDetailsProduct?.sellingPrice ??
                                  0,
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${unit.status === "in_stock"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : unit.status === "sold"
                                        ? "bg-blue-100 text-blue-700"
                                        : unit.status === "deadstock"
                                          ? "bg-rose-100 text-rose-700"
                                          : "bg-slate-100 text-slate-700"
                                    }`}
                                >
                                  {unit.status.replace("_", " ")}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      {unitDetailsProduct &&
                      (unitDetailsProduct.stock || 0) > 0 &&
                      (unitDetailsProduct.trackingType || "standard") ===
                        "serialized"
                        ? "Stock exists, but item-wise IMEI/details were not added for this product."
                        : "No inventory units available for this product."}
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

