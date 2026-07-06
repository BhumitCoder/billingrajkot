import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  getBills,
  getReturnedQuantity,
  processBillReturn,
  getBillReturns,
  getDeadstock,
  getProducts,
  getProductTransactions,
  getPurchaseBills,
  getInventoryUnits,
} from "@/lib/storage";
import { formatCurrency, formatDate } from "@/lib/billUtils";
import {
  Bill,
  BillReturn,
  DeadstockItem,
  BillItem,
  PaymentMethod,
  InventoryUnit,
} from "@/types";
import {
  RotateCcw,
  Search,
  Package,
  PackageX,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Clock,
  IndianRupee,
  Boxes,
} from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";
import { dummyBills } from "@/lib/dummyData";

interface ReturnItemForm {
  productId: string;
  productName: string;
  inventoryUnitId?: string;
  imeiNumber?: string;
  serialNumber?: string;
  maxQuantity: number;
  quantity: number;
  condition: "good" | "bad";
  returnReason: string;
  costPrice: number;
}

const normalizeImei = (value?: string) =>
  (value || "").toString().replace(/\s+/g, "").trim().toLowerCase();

const buildReturnTrackingKey = (item: {
  productId: string;
  inventoryUnitId?: string;
  imeiNumber?: string;
}) => {
  if (item.inventoryUnitId) return `unit:${item.inventoryUnitId}`;
  const imei = normalizeImei(item.imeiNumber);
  if (imei) return `imei:${imei}`;
  return `product:${item.productId}`;
};

const findMatchedBillItemForReturn = (
  bill: Bill | null,
  item: {
    productId: string;
    inventoryUnitId?: string;
    imeiNumber?: string;
  },
) =>
  bill?.items.find(
    (billItem) =>
      Boolean(item.inventoryUnitId) &&
      Boolean(billItem.inventoryUnitId) &&
      billItem.inventoryUnitId === item.inventoryUnitId,
  ) ||
  bill?.items.find(
    (billItem) =>
      normalizeImei(item.imeiNumber) &&
      normalizeImei(billItem.imeiNumber) === normalizeImei(item.imeiNumber),
  ) ||
  bill?.items.find((billItem) => billItem.productId === item.productId);

export default function Returns() {
  const { toast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [returns, setReturns] = useState<BillReturn[]>([]);
  const [deadstock, setDeadstock] = useState<DeadstockItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 20;
  const [searchBill, setSearchBill] = useState("");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItemForm[]>([]);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "create" | "history" | "deadstock"
  >("create");
  const [returnedQuantities, setReturnedQuantities] = useState<
    Record<string, Record<string, number>>
  >({});
  const [processingReturn, setProcessingReturn] = useState(false);
  const [returnMode] = useState<"item_wise">("item_wise");
  const [customReturnAmount, setCustomReturnAmount] = useState("");
  const [refundPaidAmount, setRefundPaidAmount] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [collectPaidAmount, setCollectPaidAmount] = useState("");
  const [collectPaymentMethod, setCollectPaymentMethod] =
    useState<PaymentMethod>("Cash");
  const [productTransactionsMap, setProductTransactionsMap] = useState<
    Record<string, any[]>
  >({});
  const [purchaseBillOverheadFactorById, setPurchaseBillOverheadFactorById] =
    useState<Record<string, number>>({});
  const [inventoryUnitById, setInventoryUnitById] = useState<
    Record<string, InventoryUnit>
  >({});
  const [loading, setLoading] = useState(false);

  const { locked, reloadKey } = useEncryptionLock();

  useEffect(() => {
    loadData();
    loadProductTransactions();
  }, [locked, reloadKey]);

  // Load product transactions for historical cost calculation
  const loadProductTransactions = async () => {
    const products = await getProducts();
    const transactionsMap: Record<string, any[]> = {};

    await Promise.all(
      products.map(async (product) => {
        const transactions = await getProductTransactions(product.id);
        if (transactions && transactions.length > 0) {
          // Sort transactions by date
          transactionsMap[product.id] = transactions.sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );
        }
      })
    );

    setProductTransactionsMap(transactionsMap);
  };

  // Function to calculate historical average cost at a specific date
  // This uses weighted average method - calculates what the average cost was at that point in time
  // This is the industry-standard approach for accurate historical cost calculation
  const getHistoricalAverageCost = (
    productId: string,
    saleDate: string,
    product: any
  ): number => {
    if (!product) return 0;

    const transactions = productTransactionsMap[productId];
    if (!transactions || transactions.length === 0) {
      return product.purchasePrice || product.price || 0;
    }
    const getEffectivePurchasePrice = (transaction: any) => {
      const rawPrice = Number(transaction?.purchasePrice || 0);
      if (rawPrice <= 0) return 0;
      const factor = transaction?.billId
        ? Number(purchaseBillOverheadFactorById[transaction.billId] || 1)
        : 1;
      return rawPrice * (factor > 0 ? factor : 1);
    };

    const saleDateTime = new Date(saleDate).getTime();
    let totalPurchaseValue = 0;
    let totalPurchaseQuantity = 0;
    let currentInventory = 0; // Running inventory balance
    let currentInventoryValue = 0; // Running inventory value

    // Process all transactions chronologically up to (but not including) the sale date
    for (const transaction of transactions) {
      const transactionDate = new Date(transaction.date).getTime();

      // Only consider transactions before the sale date
      if (transactionDate <= saleDateTime) {
        if (transaction.type === "purchase" && transaction.purchasePrice) {
          // Add purchase to inventory
          const purchaseValue =
            transaction.quantity * getEffectivePurchasePrice(transaction);
          currentInventory += transaction.quantity;
          currentInventoryValue += purchaseValue;
          totalPurchaseValue += purchaseValue;
          totalPurchaseQuantity += transaction.quantity;
        } else if (transaction.type === "sale") {
          // Remove sale from inventory using weighted average cost
          if (currentInventory > 0) {
            const averageCostAtSale = currentInventoryValue / currentInventory;
            const saleValue = transaction.quantity * averageCostAtSale;
            currentInventory -= transaction.quantity;
            currentInventoryValue -= saleValue;
          } else {
            // No inventory, but sale occurred - use last known cost
            currentInventory = Math.max(
              0,
              currentInventory - transaction.quantity
            );
          }
        } else if (transaction.type === "return") {
          const returnRecord = returns.find(
            (r) =>
              r.id === transaction.billReturnId || r.id === transaction.billId,
          );
          const returnItem = returnRecord?.items.find(
            (ri) => ri.productId === productId,
          );
          // Only good returns go back to inventory cost basis.
          if (returnItem?.condition !== "good") {
            continue;
          }

          // Returns: good returns go back to inventory at their original cost
          if (currentInventory > 0) {
            const avgCost = currentInventoryValue / currentInventory;
            currentInventory += transaction.quantity;
            currentInventoryValue += transaction.quantity * avgCost;
          } else {
            // No current inventory, use last purchase price if available
            const lastPurchase = transactions
              .filter(
                (t) =>
                  t.type === "purchase" &&
                  t.purchasePrice &&
                  new Date(t.date).getTime() <= transactionDate
              )
              .slice(-1)[0];
            if (lastPurchase && lastPurchase.purchasePrice) {
              currentInventory += transaction.quantity;
              currentInventoryValue +=
                transaction.quantity * getEffectivePurchasePrice(lastPurchase);
            }
          }
        } else if (
          transaction.type === "purchase_return" &&
          transaction.purchasePrice
        ) {
          // Vendor returns reduce inventory/value at explicit purchase price.
          const returnQty = Math.abs(transaction.quantity);
          const returnValue =
            returnQty * getEffectivePurchasePrice(transaction);
          currentInventory = Math.max(0, currentInventory - returnQty);
          currentInventoryValue = Math.max(0, currentInventoryValue - returnValue);
        }
      }
    }

    // Calculate weighted average cost at the time of sale
    if (currentInventory > 0) {
      // Use the running average cost of available inventory
      return currentInventoryValue / currentInventory;
    } else if (totalPurchaseQuantity > 0) {
      // No inventory available, but we have purchase history - use overall average
      return totalPurchaseValue / totalPurchaseQuantity;
    } else {
      // Fallback to product default price
      return product.purchasePrice || product.price || 0;
    }
  };

  const loadData = async () => {
    if (locked) { setBills(dummyBills); setReturns([]); setDeadstock([]); setLoading(false); return; }
    setLoading(true);
    const [
      allBillsData,
      returnsData,
      deadstockData,
      purchaseBillsData,
      inventoryUnitsData,
    ] = await Promise.all([
      getBills(),
      getBillReturns(),
      getDeadstock(),
      getPurchaseBills(),
      getInventoryUnits(),
    ]);
    const allBills = allBillsData.filter(
      (b) =>
        b.paymentStatus === "paid" ||
        b.paymentStatus === "pending" ||
        b.paymentStatus === "overdue" ||
        b.paymentStatus === "partial" ||
        b.paymentStatus === "overpaid"
    );
    setBills(allBills);
    setReturns(returnsData);
    setDeadstock(deadstockData);
    setInventoryUnitById(
      Object.fromEntries(inventoryUnitsData.map((unit) => [unit.id, unit])),
    );
    const overheadFactorMap: Record<string, number> = {};
    purchaseBillsData.forEach((pb) => {
      if (!pb?.id) return;
      const subtotal = Math.max(0, Number(pb.subtotal || 0));
      const extraCost = Math.max(
        0,
        Number(pb.courierCharges || 0) + Number(pb.expenseAmount || 0),
      );
      overheadFactorMap[pb.id] = subtotal > 0 ? 1 + extraCost / subtotal : 1;
    });
    setPurchaseBillOverheadFactorById(overheadFactorMap);

    // Load returned quantities for all bills
    const quantities: Record<string, Record<string, number>> = {};
    for (const bill of allBills) {
      quantities[bill.id] = {};
      const billReturns = returnsData.filter((r) => r.billId === bill.id);
      for (const item of bill.items) {
        const key = buildReturnTrackingKey(item);
        if (key.startsWith("product:")) {
          if (quantities[bill.id][key] === undefined) {
            quantities[bill.id][key] = await getReturnedQuantity(
              bill.id,
              item.productId,
            );
          }
          continue;
        }

        const alreadyReturned = billReturns.some((r) =>
          r.items.some(
            (ri) =>
              (item.inventoryUnitId &&
                ri.inventoryUnitId &&
                ri.inventoryUnitId === item.inventoryUnitId) ||
              (!!item.imeiNumber &&
                !!ri.imeiNumber &&
                normalizeImei(ri.imeiNumber) === normalizeImei(item.imeiNumber)),
          ),
        );
        quantities[bill.id][key] = alreadyReturned ? 1 : 0;
      }
    }
    setReturnedQuantities(quantities);
    setLoading(false);
  };

  const normalizedSearchBill = searchBill.toLowerCase();
  const filteredBills = bills.filter(
    (bill) =>
      bill.billNumber.toLowerCase().includes(normalizedSearchBill) ||
      (bill.client?.name ?? "").toLowerCase().includes(normalizedSearchBill) ||
      bill.items.some((item) => {
        const inventoryUnit = item.inventoryUnitId
          ? inventoryUnitById[item.inventoryUnitId]
          : undefined;
        return (
          (item.imeiNumber || "").toLowerCase().includes(normalizedSearchBill) ||
          (item.serialNumber || "").toLowerCase().includes(normalizedSearchBill) ||
          (inventoryUnit?.serialNumber || "")
            .toLowerCase()
            .includes(normalizedSearchBill)
        );
      })
  );

  const handleSelectBill = async (bill: Bill) => {
    setSelectedBill(bill);

    // Initialize return items with available quantities
    const productsData = await getProducts();
    const itemsPromises = bill.items.map(async (item) => {
      const isSerialized = Boolean(item.inventoryUnitId || item.imeiNumber);
      let returnedQty = 0;
      if (isSerialized) {
        const alreadyReturned = returns.some((r) =>
          r.billId === bill.id &&
          r.items.some(
            (ri) =>
              (ri.inventoryUnitId && ri.inventoryUnitId === item.inventoryUnitId) ||
              (!!ri.imeiNumber &&
                !!item.imeiNumber &&
                ri.imeiNumber.replace(/\s+/g, "").toLowerCase() ===
                  item.imeiNumber.replace(/\s+/g, "").toLowerCase()),
          ),
        );
        returnedQty = alreadyReturned ? 1 : 0;
      } else {
        returnedQty = await getReturnedQuantity(bill.id, item.productId);
      }
      const product = productsData.find((p) => p.id === item.productId);

      // Use HISTORICAL average cost at the time of the original sale
      // This ensures return value calculations reflect the actual cost basis when the sale occurred
      const costPrice = product
        ? getHistoricalAverageCost(product.id, bill.date, product)
        : item.ratePerUnit; // Fallback to selling price if product not found

      return {
        productId: item.productId,
        productName: item.productName,
        inventoryUnitId: item.inventoryUnitId,
        imeiNumber: item.imeiNumber,
        serialNumber:
          item.serialNumber ||
          (item.inventoryUnitId
            ? inventoryUnitById[item.inventoryUnitId]?.serialNumber
            : undefined),
        // item.quantity already reflects remaining qty after previous returns (updateBillAfterReturn reduces it)
        // Do NOT subtract returnedQty again — that would double-count
        maxQuantity: isSerialized ? (returnedQty > 0 ? 0 : 1) : item.quantity,
        // Start unselected: user must actively pick which device(s) to return
        quantity: 0,
        condition: "good" as const,
        returnReason: "",
        costPrice: costPrice,
      };
    });

    const rawItems = (await Promise.all(itemsPromises)).filter(
      (item) => item.maxQuantity > 0
    );
    // Auto-select if there is only one returnable device
    const items = rawItems.map((item, _, arr) =>
      arr.length === 1 ? { ...item, quantity: item.maxQuantity } : item
    );

    setReturnItems(items);
    setCustomReturnAmount("");
    setRefundPaidAmount("");
    setRefundNote("");
    setCollectPaidAmount("");
    setCollectPaymentMethod("Cash");
    setShowReturnDialog(true);
  };

  const updateReturnItem = (
    index: number,
    updates: Partial<ReturnItemForm>
  ) => {
    setReturnItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  const toggleReturnSelection = (index: number, selected: boolean) => {
    const item = returnItems[index];
    if (!item) return;
    updateReturnItem(index, {
      quantity: selected ? Math.min(1, item.maxQuantity) : 0,
    });
  };

  const calculateReturnAmount = (bill: Bill | null, items: ReturnItemForm[]) =>
    items.reduce((sum, item) => {
      const matchedBillItem = findMatchedBillItemForReturn(bill, item);
      if (!matchedBillItem || matchedBillItem.quantity <= 0) return sum;
      const perUnit = (matchedBillItem.amount || 0) / matchedBillItem.quantity;
      return sum + item.quantity * perUnit;
    }, 0);

  const getProjectedReturnFinancials = (
    bill: Bill | null,
    items: ReturnItemForm[],
    amountOnlyReturn: number,
  ) => {
    if (!bill) {
      return {
        effectiveReturnAmount: 0,
        projectedTotal: 0,
        refundableLimit: 0,
        pendingAfterReturn: 0,
      };
    }

    const isItemWise = items.length > 0;
    const matchedBillItemIds = new Set<number>();
    const updatedItems = isItemWise
      ? bill.items
          .map((item, billItemIndex) => {
            const billItemIsSerialized = Boolean(
              item.inventoryUnitId || normalizeImei(item.imeiNumber),
            );
            const returnItem = items.find((returnEntry) => {
              if (matchedBillItemIds.has(billItemIndex)) return false;
              const returnItemIsSerialized = Boolean(
                returnEntry.inventoryUnitId || normalizeImei(returnEntry.imeiNumber),
              );

              if (billItemIsSerialized || returnItemIsSerialized) {
                if (returnEntry.inventoryUnitId && item.inventoryUnitId) {
                  return returnEntry.inventoryUnitId === item.inventoryUnitId;
                }
                if (
                  normalizeImei(returnEntry.imeiNumber) &&
                  normalizeImei(item.imeiNumber)
                ) {
                  return (
                    normalizeImei(returnEntry.imeiNumber) ===
                    normalizeImei(item.imeiNumber)
                  );
                }
                return false;
              }

              return returnEntry.productId === item.productId;
            });

            if (!returnItem) return item;

            matchedBillItemIds.add(billItemIndex);
            const newQuantity = item.quantity - returnItem.quantity;
            return {
              ...item,
              quantity: newQuantity,
              amount: newQuantity * item.ratePerUnit,
            };
          })
          .filter((item) => item.quantity > 0)
      : [...bill.items];

    const subtotal = updatedItems.reduce((sum, item) => sum + item.amount, 0);
    const discount = Math.min(Number(bill.discount || 0), subtotal);
    const courierCharges = Number(bill.courierCharges || 0);
    let gstTotal = 0;
    if ((bill as any).isGst && (bill as any).gstRate) {
      const taxable = Math.max(0, subtotal - discount);
      gstTotal = Math.round(taxable * (bill as any).gstRate / 100 * 100) / 100;
    }
    const rawTotal = Math.max(
      0,
      subtotal - discount + courierCharges + gstTotal - (isItemWise ? 0 : amountOnlyReturn),
    );
    // Round off removed per client requirement: total is the exact calculated amount
    const projectedTotal = rawTotal;
    const paidAmount = Number(bill.paidAmount || 0);
    const effectiveReturnAmount = isItemWise
      ? calculateReturnAmount(bill, items)
      : amountOnlyReturn;

    return {
      effectiveReturnAmount,
      projectedTotal,
      refundableLimit: Math.max(0, paidAmount - projectedTotal),
      pendingAfterReturn: Math.max(0, projectedTotal - paidAmount),
    };
  };

  const handleProcessReturn = async () => {
    if (locked) { toast({ title: "Error", description: "Unable to save. Check your connection.", variant: "destructive" }); return; }
    setProcessingReturn(true);
    const itemsToReturn = returnItems.filter((item) => item.quantity > 0);

    const projectedReturnFinancials = getProjectedReturnFinancials(
      selectedBill,
      itemsToReturn,
      0,
    );
    const effectiveReturnAmount = projectedReturnFinancials.effectiveReturnAmount;
    const refundPaid = parseFloat(refundPaidAmount || "0") || 0;
    const collectPaid = parseFloat(collectPaidAmount || "0") || 0;
    const billTotal = selectedBill?.total || 0;

    if (itemsToReturn.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to return",
        variant: "destructive",
      });
      setProcessingReturn(false);
      return;
    }

    if (effectiveReturnAmount > billTotal) {
      toast({
        title: "Invalid return value",
        description: "Return value cannot be greater than the bill value",
        variant: "destructive",
      });
      setProcessingReturn(false);
      return;
    }

    if (refundPaid < 0 || refundPaid > effectiveReturnAmount) {
      toast({
        title: "Invalid refund paid",
        description: "Refund paid must be between 0 and total return value",
        variant: "destructive",
      });
      setProcessingReturn(false);
      return;
    }

    if (refundPaid > projectedReturnFinancials.refundableLimit) {
      toast({
        title: "Invalid refund paid",
        description:
          projectedReturnFinancials.refundableLimit > 0
            ? `Refund paid cannot exceed refundable amount ${formatCurrency(projectedReturnFinancials.refundableLimit)}`
            : "This return only reduces pending amount. No refund is available.",
        variant: "destructive",
      });
      setProcessingReturn(false);
      return;
    }

    if (collectPaid < 0 || collectPaid > projectedReturnFinancials.pendingAfterReturn) {
      toast({
        title: "Invalid collect amount",
        description:
          projectedReturnFinancials.pendingAfterReturn > 0
            ? `Collect amount cannot exceed pending amount ${formatCurrency(projectedReturnFinancials.pendingAfterReturn)}`
            : "No pending amount is available to collect.",
        variant: "destructive",
      });
      setProcessingReturn(false);
      return;
    }

    // Validate quantities
    for (const item of itemsToReturn) {
      if (item.quantity > item.maxQuantity) {
        toast({
          title: "Invalid quantity",
          description: `${item.productName}: Cannot return more than sold quantity`,
          variant: "destructive",
        });
        return;
      }
      if ((item.inventoryUnitId || item.imeiNumber) && item.quantity !== 1) {
        toast({
          title: "Invalid quantity",
          description: `${item.productName}: IMEI/Serial returns must be quantity 1`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      await processBillReturn(selectedBill!.id, itemsToReturn, {
        returnMode,
        customReturnAmount: 0,
        refundPaidAmount: refundPaid,
        collectPaidAmount: collectPaid,
        collectPaymentMethod,
        refundNote,
      });

      const goodItems = itemsToReturn.filter((i) => i.condition === "good");
      const badItems = itemsToReturn.filter((i) => i.condition === "bad");

      toast({
        title: "Return processed successfully",
        description: `${goodItems.length} items returned to inventory, ${badItems.length} items added to deadstock`,
      });

      setShowReturnDialog(false);
      setSelectedBill(null);
      await loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process return",
        variant: "destructive",
      });
    } finally {
      setProcessingReturn(false);
    }
  };

  const totalDeadstockLoss = deadstock.reduce(
    (sum, item) => sum + item.quantity * item.costPrice,
    0
  );
  const totalGoodReturns = returns.reduce(
    (sum, r) =>
      sum +
      r.items
        .filter((i) => i.condition === "good")
        .reduce((itemSum, i) => itemSum + i.quantity, 0),
    0
  );
  const totalBadReturns = returns.reduce(
    (sum, r) =>
      sum +
      r.items
        .filter((i) => i.condition === "bad")
        .reduce((itemSum, i) => itemSum + i.quantity, 0),
    0
  );
  const returnableBills = bills.filter((bill) => {
    const billReturnedQty = returnedQuantities[bill.id] || {};
    const totalReturned = bill.items.reduce(
      (sum, item) =>
        sum + (billReturnedQty[buildReturnTrackingKey(item)] || 0),
      0
    );
    const totalSold = bill.items.reduce((sum, item) => sum + item.quantity, 0);
    return totalReturned < totalSold;
  }).length;
  const previewReturnItems = returnItems.filter((item) => item.quantity > 0);
  const previewReturnFinancials = getProjectedReturnFinancials(
    selectedBill,
    previewReturnItems,
    0,
  );
  const canRefundNow = previewReturnFinancials.refundableLimit > 0;
  const canCollectNow = previewReturnFinancials.pendingAfterReturn > 0;

  useEffect(() => {
    if (!canRefundNow && refundPaidAmount) {
      setRefundPaidAmount("");
    }
    if (!canCollectNow && collectPaidAmount) {
      setCollectPaidAmount("");
    }
  }, [canCollectNow, canRefundNow, collectPaidAmount, refundPaidAmount]);

  
  if (loading) {
    return (
      <div className="min-h-screen">
        <LoadingSpinner size="xl" text="Loading products..." fullScreen contentAreaOnly />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-slate-50/40 p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">
                Returns
              </h1>
              <p className="text-sm text-muted-foreground">
                Process sales returns and manage deadstock
              </p>
            </div>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 rounded-xl border border-border/70 bg-muted/30 p-2 lg:w-auto">
            <Button
              variant={activeTab === "create" ? "default" : "outline"}
              onClick={() => setActiveTab("create")}
              className="h-10 rounded-xl px-3 text-sm"
            >
              Process
            </Button>
            <Button
              variant={activeTab === "history" ? "default" : "outline"}
              onClick={() => { setActiveTab("history"); setHistoryPage(1); }}
              className="h-10 rounded-xl px-3 text-sm"
            >
              History
            </Button>
            <Button
              variant={activeTab === "deadstock" ? "default" : "outline"}
              onClick={() => setActiveTab("deadstock")}
              className="h-10 rounded-xl px-3 text-sm"
            >
              Deadstock
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2 sm:p-4">
      <div className="h-full overflow-y-auto space-y-5 pr-1 sm:pr-2">

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="border-slate-200 bg-gradient-to-br from-slate-100/70 to-slate-50 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              <Boxes className="h-3 w-3 text-slate-500" /> Total Returns
            </p>
            <p className="truncate text-lg font-bold text-slate-900 sm:text-xl dark:text-slate-100">
              {returns.length}
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-100/60 to-emerald-50 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              <Package className="h-3 w-3" /> Good Returns
            </p>
            <p className="truncate text-lg font-bold text-emerald-700 sm:text-xl dark:text-emerald-400">
              {totalGoodReturns} items
            </p>
            <p className="text-[11px] text-muted-foreground">Back to inventory</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-gradient-to-br from-orange-100/60 to-orange-50 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
              <Clock className="h-3 w-3" /> Returnable Bills
            </p>
            <p className="truncate text-lg font-bold text-orange-700 sm:text-xl dark:text-orange-400">
              {returnableBills}
            </p>
            <p className="text-[11px] text-muted-foreground">Ready to process</p>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-gradient-to-br from-rose-100/60 to-rose-50 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
              <PackageX className="h-3 w-3" /> Bad Returns
            </p>
            <p className="truncate text-lg font-bold text-rose-700 sm:text-xl dark:text-rose-400">
              {totalBadReturns} items
            </p>
            <p className="text-[11px] text-muted-foreground">Moved to deadstock</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-blue-200 bg-gradient-to-br from-blue-100/60 to-blue-50 shadow-sm lg:col-span-1">
          <CardContent className="p-3 sm:p-4">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              <IndianRupee className="h-3 w-3" /> Deadstock Loss
            </p>
            <p className="truncate text-lg font-bold text-blue-700 sm:text-xl dark:text-blue-400">
              {formatCurrency(totalDeadstockLoss)}
            </p>
            <p className="text-[11px] text-muted-foreground">{deadstock.length} items</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Return Tab */}
      {activeTab === "create" && (
        <Card>
          <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              Select Invoice for Return
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number, client name, IMEI, or SN..."
                value={searchBill}
                onChange={(e) => setSearchBill(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>

            <div className="space-y-2 max-h-[350px] sm:max-h-[400px] overflow-y-auto">
              {filteredBills.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-muted-foreground px-4">
                  <RotateCcw className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
                  <p className="text-sm sm:text-base">No invoices found</p>
                  <p className="text-xs sm:text-sm mt-1">
                    Create invoices to process returns
                  </p>
                </div>
              ) : (
                filteredBills.map((bill) => {
                  const billReturnedQty = returnedQuantities[bill.id] || {};
                  const totalReturned = bill.items.reduce(
                    (sum, item) =>
                      sum + (billReturnedQty[buildReturnTrackingKey(item)] || 0),
                    0
                  );
                  const totalSold = bill.items.reduce(
                    (sum, item) => sum + item.quantity,
                    0
                  );
                  const hasReturnableItems = totalReturned < totalSold;

                  return (
                    <div
                      key={bill.id}
                      className={`p-3 sm:p-4 border rounded-lg ${
                        hasReturnableItems
                          ? "hover:bg-accent/50 cursor-pointer"
                          : "opacity-50"
                      }`}
                      onClick={() =>
                        hasReturnableItems && handleSelectBill(bill)
                      }
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm sm:text-base">
                              {bill.billNumber}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {bill.client?.name ?? ""}
                            </Badge>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {formatDate(bill.date)} - {bill.items.length} items
                          </p>
                        </div>
                        <div className="text-left sm:text-right flex flex-row sm:flex-col gap-2 sm:gap-0 items-center sm:items-end">
                          <p className="font-semibold text-sm sm:text-base">
                            {formatCurrency(bill.total)}
                          </p>
                          {totalReturned > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-xs sm:mt-1"
                            >
                              {totalReturned}/{totalSold} returned
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <Card>
          <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">
              Return History
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            {returns.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <RotateCcw className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
                <p className="text-sm sm:text-base">No returns processed yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {returns.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE).map((ret) => (
                  <div key={ret.id} className="p-3 sm:p-4 border rounded-lg">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm sm:text-base">
                            {ret.billNumber}
                          </span>
                          <span className="text-muted-foreground text-xs sm:text-sm">
                            -
                          </span>
                          <span className="text-muted-foreground text-xs sm:text-sm truncate">
                            {ret.clientName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(ret.returnDate)}
                        </span>
                        {/* <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-600"
                          onClick={() => {
                            // Add edit logic here
                            toast({ title: "Edit feature", description: "Return edit is coming soon" });
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button> */}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {ret.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs sm:text-sm p-2 sm:p-3 bg-accent/30 rounded gap-2 sm:gap-0"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {item.condition === "good" ? (
                              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
                            )}
                            <span className="truncate">{item.productName}</span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className="whitespace-nowrap">
                              Qty: {item.quantity}
                            </span>
                            <Badge
                              variant={
                                item.condition === "good"
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {item.condition === "good"
                                ? "Inventory"
                                : "Deadstock"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* History Pagination */}
            {returns.length > HISTORY_PAGE_SIZE && (
              <div className="flex items-center justify-between border-t px-1 pt-3 mt-2">
                <p className="text-xs text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium text-foreground">
                    {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}–{Math.min(historyPage * HISTORY_PAGE_SIZE, returns.length)}
                  </span>{" "}
                  of <span className="font-medium text-foreground">{returns.length}</span> returns
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={historyPage === 1} onClick={() => setHistoryPage((p) => p - 1)}>Previous</Button>
                  <span className="px-2 text-xs text-muted-foreground tabular-nums">{historyPage} / {Math.ceil(returns.length / HISTORY_PAGE_SIZE)}</span>
                  <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={historyPage >= Math.ceil(returns.length / HISTORY_PAGE_SIZE)} onClick={() => setHistoryPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deadstock Tab */}
      {activeTab === "deadstock" && (
        <Card>
          <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0" />
              Deadstock (Loss)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            {deadstock.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <PackageX className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 sm:mb-3 opacity-50" />
                <p className="text-sm sm:text-base">No deadstock items</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deadstock.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 sm:p-4 border border-red-200 dark:border-red-900 rounded-lg bg-red-50/50 dark:bg-red-950/20"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm sm:text-base break-words">
                          {item.productName}
                        </span>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          Qty: {item.quantity} x{" "}
                          {formatCurrency(item.costPrice)}
                        </p>
                        <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 mt-1 break-words">
                          Reason: {item.reason}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-bold text-red-600 dark:text-red-400 text-base sm:text-lg">
                          -{formatCurrency(item.quantity * item.costPrice)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="pt-4 border-t mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm sm:text-base">
                      Total Loss
                    </span>
                    <span className="text-lg sm:text-xl font-bold text-red-600 dark:text-red-400 break-words">
                      {formatCurrency(totalDeadstockLoss)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Return Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="dialog-form-content max-w-[95vw] sm:max-w-xl">
          <DialogHeader className="dialog-form-header pb-1">
            <DialogTitle className="text-base font-semibold pr-8">
              Process Return
            </DialogTitle>
            {/* Bill summary strip */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-mono font-medium bg-muted px-2 py-0.5 rounded">
                #{selectedBill?.billNumber}
              </span>
              <span className="text-xs text-muted-foreground">
                {selectedBill?.client?.name}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                Bill: {formatCurrency(selectedBill?.total || 0)}
              </span>
            </div>
          </DialogHeader>

          <div className="dialog-form-body space-y-3">

            {/* Instruction */}
            <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg px-3 py-2">
              Tap a device card to select it for return. You can return one or more devices from this bill.
            </p>

            {returnItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <CheckCircle className="h-10 w-10 opacity-40" />
                <p className="text-sm">All items from this bill have already been returned</p>
              </div>
            ) : (
              <div className="space-y-2">
                {returnItems.map((item, index) => {
                  const selected = item.quantity > 0;
                  return (
                    <div
                      key={`${item.inventoryUnitId || item.imeiNumber || item.productId}-${index}`}
                      onClick={() => toggleReturnSelection(index, !selected)}
                      className={`relative rounded-xl border-2 cursor-pointer select-none transition-all duration-150 ${
                        selected
                          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-sm"
                          : "border-border/60 bg-background hover:border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="p-3">
                        {/* Top row: checkbox + product name + value */}
                        <div className="flex items-start gap-2.5">
                          {/* Checkbox circle */}
                          <div className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                            selected
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-muted-foreground/40 bg-background"
                          }`}>
                            {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-sm leading-snug break-words flex-1">
                                {item.productName}
                              </p>
                              {selected && (
                                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                                  {formatCurrency(
                                    (() => {
                                      const bi = findMatchedBillItemForReturn(selectedBill, item);
                                      return bi ? (bi.amount || 0) / bi.quantity : 0;
                                    })()
                                  )}
                                </span>
                              )}
                            </div>

                            {/* IMEI / SN */}
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              {item.imeiNumber && (
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  IMEI: {item.imeiNumber}
                                </span>
                              )}
                              {item.serialNumber && item.serialNumber !== item.imeiNumber && (
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  SN: {item.serialNumber}
                                </span>
                              )}
                              {!item.imeiNumber && !item.serialNumber && (
                                <span className="text-[11px] text-muted-foreground">
                                  Qty available: {item.maxQuantity}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Condition + reason — shown only when selected */}
                        {selected && (
                          <div className="mt-3 ml-7 space-y-2" onClick={(e) => e.stopPropagation()}>
                            {/* Condition pill toggle */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Condition:</span>
                              <button
                                type="button"
                                onClick={() => updateReturnItem(index, { condition: "good" })}
                                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                  item.condition === "good"
                                    ? "bg-emerald-500 text-white shadow-sm"
                                    : "bg-muted text-muted-foreground hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                                }`}
                              >
                                <Package className="h-3 w-3" />
                                Good — back to stock
                              </button>
                              <button
                                type="button"
                                onClick={() => updateReturnItem(index, { condition: "bad" })}
                                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                  item.condition === "bad"
                                    ? "bg-red-500 text-white shadow-sm"
                                    : "bg-muted text-muted-foreground hover:bg-red-100 dark:hover:bg-red-900/30"
                                }`}
                              >
                                <PackageX className="h-3 w-3" />
                                Bad — deadstock
                              </button>
                            </div>

                            {/* Reason — only for bad */}
                            {item.condition === "bad" && (
                              <div className="space-y-1">
                                <Textarea
                                  placeholder="Reason for damage / defect (optional)..."
                                  value={item.returnReason}
                                  onChange={(e) =>
                                    updateReturnItem(index, { returnReason: e.target.value })
                                  }
                                  rows={2}
                                  className="text-xs resize-none"
                                />
                                <p className="text-[11px] text-red-600 dark:text-red-400">
                                  Loss recorded: {formatCurrency(item.costPrice)}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Financial summary */}
            {previewReturnFinancials.effectiveReturnAmount > 0 && (
              <div className="rounded-xl border border-border/60 bg-muted/20 divide-y divide-border/50">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    {returnItems.filter(i => i.quantity > 0).length} device{returnItems.filter(i => i.quantity > 0).length !== 1 ? "s" : ""} selected for return
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(previewReturnFinancials.effectiveReturnAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-muted-foreground">New bill total</span>
                  <span className="text-xs font-medium">{formatCurrency(previewReturnFinancials.projectedTotal)}</span>
                </div>
                {previewReturnFinancials.pendingAfterReturn > 0 && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-muted-foreground">Pending after return</span>
                    <span className="text-xs font-medium text-orange-600">{formatCurrency(previewReturnFinancials.pendingAfterReturn)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Refund / Collect / Note */}
            {previewReturnFinancials.effectiveReturnAmount > 0 && (canRefundNow || canCollectNow) && (
              <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {canRefundNow && (
                    <div>
                      <Label className="text-xs">Refund Paid Now</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={refundPaidAmount}
                        onChange={(e) => setRefundPaidAmount(e.target.value)}
                        className="mt-1 h-8 text-sm"
                        placeholder="0"
                      />
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Max: {formatCurrency(previewReturnFinancials.refundableLimit)}
                      </p>
                    </div>
                  )}
                  {canCollectNow && (
                    <div>
                      <Label className="text-xs">Collect Pending Now</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={collectPaidAmount}
                        onChange={(e) => setCollectPaidAmount(e.target.value)}
                        className="mt-1 h-8 text-sm"
                        placeholder="0"
                      />
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Max: {formatCurrency(previewReturnFinancials.pendingAfterReturn)}
                      </p>
                    </div>
                  )}
                  {canCollectNow && (
                    <div>
                      <Label className="text-xs">Collection Mode</Label>
                      <Select
                        value={collectPaymentMethod}
                        onValueChange={(value) => setCollectPaymentMethod(value as PaymentMethod)}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs">
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
                  )}
                  <div>
                    <Label className="text-xs">Return Note (optional)</Label>
                    <Input
                      value={refundNote}
                      onChange={(e) => setRefundNote(e.target.value)}
                      className="mt-1 h-8 text-sm"
                      placeholder="e.g. screen damage"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="dialog-form-footer flex-col sm:flex-row gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => setShowReturnDialog(false)}
              className="w-full sm:w-auto text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleProcessReturn}
              disabled={
                processingReturn ||
                returnItems.filter((i) => i.quantity > 0).length === 0
              }
              className="w-full sm:w-auto text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {processingReturn ? (
                <>
                  <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Confirm Return ({returnItems.filter(i => i.quantity > 0).length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      </div>
    </div>
  );
}
