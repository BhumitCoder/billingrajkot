import type { Bill, BillReturn, InventoryTransaction, InventoryUnit } from "@/types";
import { roundToTwoDecimals } from "@/lib/billUtils";

export type ProductCostEventType =
  | "purchase"
  | "sale"
  | "sale_return_good"
  | "purchase_return";

export interface ProductCostEvent {
  type: ProductCostEventType;
  date: string;
  quantity: number;
  unitCost?: number;
  sellingPrice?: number;
}

export interface ProductCostSummary {
  currentQuantity: number;
  currentValue: number;
  currentAverageCost: number;
  totalPurchasedQty: number;
  totalPurchaseValue: number;
  totalSoldQty: number;
  totalSalesValue: number;
  totalGoodReturnedQty: number;
  netSoldQty: number;
  costOfGoodsSold: number;
  averageSellingPrice: number;
  profitMargin: number;
}

export interface ProductInventoryCostSummary extends ProductCostSummary {
  effectiveStock: number;
  effectiveValue: number;
}

const EVENT_PRIORITY: Record<ProductCostEventType, number> = {
  purchase: 0,
  sale: 1,
  sale_return_good: 2,
  purchase_return: 3,
};

const toPositiveNumber = (value: number | undefined, fallback: number) => {
  const numericValue = Number(value || 0);
  return numericValue > 0 ? numericValue : fallback;
};

export const calculateProductCostSummary = (
  events: ProductCostEvent[],
  fallbackUnitCost: number,
): ProductCostSummary => {
  const sortedEvents = [...events].sort((a, b) => {
    const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return EVENT_PRIORITY[a.type] - EVENT_PRIORITY[b.type];
  });

  let currentQuantity = 0;
  let currentValue = 0;
  let totalPurchasedQty = 0;
  let totalPurchaseValue = 0;
  let totalSoldQty = 0;
  let totalSalesValue = 0;
  let totalGoodReturnedQty = 0;
  let costOfGoodsSold = 0;
  let lastKnownUnitCost = Number(fallbackUnitCost || 0);

  for (const event of sortedEvents) {
    const quantity = Math.abs(Number(event.quantity || 0));
    if (quantity <= 0) {
      continue;
    }

    const currentAverageCost =
      currentQuantity > 0
        ? currentValue / currentQuantity
        : lastKnownUnitCost || Number(fallbackUnitCost || 0);
    const resolvedUnitCost = toPositiveNumber(event.unitCost, currentAverageCost);

    if (event.type === "purchase") {
      currentQuantity += quantity;
      currentValue += quantity * resolvedUnitCost;
      totalPurchasedQty += quantity;
      totalPurchaseValue += quantity * resolvedUnitCost;
      lastKnownUnitCost = resolvedUnitCost;
      continue;
    }

    if (event.type === "sale") {
      const removableQuantity = Math.min(quantity, currentQuantity || quantity);
      const removableValue = removableQuantity * resolvedUnitCost;
      currentQuantity = Math.max(0, currentQuantity - removableQuantity);
      currentValue = Math.max(0, currentValue - removableValue);
      totalSoldQty += quantity;
      totalSalesValue += quantity * Number(event.sellingPrice || 0);
      costOfGoodsSold += quantity * resolvedUnitCost;
      lastKnownUnitCost = resolvedUnitCost;
      continue;
    }

    if (event.type === "sale_return_good") {
      currentQuantity += quantity;
      currentValue += quantity * resolvedUnitCost;
      totalGoodReturnedQty += quantity;
      costOfGoodsSold = Math.max(0, costOfGoodsSold - quantity * resolvedUnitCost);
      lastKnownUnitCost = resolvedUnitCost;
      continue;
    }

    const removableQuantity = Math.min(quantity, currentQuantity || quantity);
    const removableValue = removableQuantity * resolvedUnitCost;
    currentQuantity = Math.max(0, currentQuantity - removableQuantity);
    currentValue = Math.max(0, currentValue - removableValue);
    lastKnownUnitCost = resolvedUnitCost;
  }

  const currentAverageCost =
    currentQuantity > 0
      ? currentValue / currentQuantity
      : lastKnownUnitCost || Number(fallbackUnitCost || 0);
  const averageSellingPrice =
    totalSoldQty > 0 ? totalSalesValue / totalSoldQty : 0;
  const profitMargin =
    currentAverageCost > 0 && averageSellingPrice > 0
      ? ((averageSellingPrice - currentAverageCost) / currentAverageCost) * 100
      : 0;

  return {
    currentQuantity: roundToTwoDecimals(currentQuantity),
    currentValue: roundToTwoDecimals(currentValue),
    currentAverageCost: roundToTwoDecimals(currentAverageCost),
    totalPurchasedQty: roundToTwoDecimals(totalPurchasedQty),
    totalPurchaseValue: roundToTwoDecimals(totalPurchaseValue),
    totalSoldQty: roundToTwoDecimals(totalSoldQty),
    totalSalesValue: roundToTwoDecimals(totalSalesValue),
    totalGoodReturnedQty: roundToTwoDecimals(totalGoodReturnedQty),
    netSoldQty: roundToTwoDecimals(totalSoldQty - totalGoodReturnedQty),
    costOfGoodsSold: roundToTwoDecimals(costOfGoodsSold),
    averageSellingPrice: roundToTwoDecimals(averageSellingPrice),
    profitMargin: roundToTwoDecimals(profitMargin),
  };
};

const normalizeImei = (value?: string) =>
  (value || "").toString().replace(/\s+/g, "").toLowerCase();

export const calculateProductInventoryCostSummary = ({
  productId,
  fallbackUnitCost,
  transactions,
  billReturns = [],
  inventoryUnits = [],
  effectiveStock,
}: {
  productId: string;
  fallbackUnitCost: number;
  transactions: InventoryTransaction[];
  billReturns?: BillReturn[];
  inventoryUnits?: InventoryUnit[];
  effectiveStock?: number;
}): ProductInventoryCostSummary => {
  const productTransactions = (transactions || []).filter(
    (transaction) => transaction.productId === productId,
  );

  const unitPurchasePriceById = new Map(
    inventoryUnits
      .filter((unit) => unit.productId === productId)
      .map((unit) => [unit.id, Number(unit.purchasePrice || 0)] as const),
  );
  const unitPurchasePriceByImei = new Map(
    inventoryUnits
      .filter((unit) => unit.productId === productId)
      .map(
        (unit) =>
          [
            normalizeImei(unit.imeiNormalized || unit.imeiNumber || unit.serialNumber),
            Number(unit.purchasePrice || 0),
          ] as const,
      )
      .filter(([imei]) => Boolean(imei)),
  );

  const saleCostByInventoryUnitId = new Map<string, number>();
  const saleCostByImei = new Map<string, number>();

  const events: ProductCostEvent[] = [];

  for (const transaction of productTransactions) {
    const quantity = Math.abs(Number(transaction.quantity || 0));
    if (quantity <= 0) {
      continue;
    }

    if (transaction.type === "purchase") {
      events.push({
        type: "purchase",
        date: transaction.date,
        quantity,
        unitCost: Number(transaction.purchasePrice || 0) || fallbackUnitCost,
      });
      continue;
    }

    if (transaction.type === "sale") {
      const unitCost = Number(transaction.purchasePrice || 0) || fallbackUnitCost;
      events.push({
        type: "sale",
        date: transaction.date,
        quantity,
        unitCost,
        sellingPrice: Number(transaction.sellingPrice || 0),
      });

      if (transaction.inventoryUnitId && unitCost > 0) {
        saleCostByInventoryUnitId.set(transaction.inventoryUnitId, unitCost);
      }

      const imeiKey = normalizeImei(transaction.imeiNumber);
      if (imeiKey && unitCost > 0) {
        saleCostByImei.set(imeiKey, unitCost);
      }
      continue;
    }

    if (transaction.type === "purchase_return") {
      events.push({
        type: "purchase_return",
        date: transaction.date,
        quantity,
        unitCost: Number(transaction.purchasePrice || 0) || fallbackUnitCost,
      });
    }
  }

  for (const billReturn of billReturns) {
    const returnItems = (billReturn.items || []).filter(
      (item) => item.productId === productId && item.condition === "good",
    );

    for (const item of returnItems) {
      const quantity = Math.abs(Number(item.quantity || 0));
      if (quantity <= 0) {
        continue;
      }

      const imeiKey = normalizeImei(item.imeiNumber);
      const unitCost =
        Number(
          (item.inventoryUnitId
            ? saleCostByInventoryUnitId.get(item.inventoryUnitId)
            : 0) ||
            (imeiKey ? saleCostByImei.get(imeiKey) : 0) ||
            (item.inventoryUnitId
              ? unitPurchasePriceById.get(item.inventoryUnitId)
              : 0) ||
            (imeiKey ? unitPurchasePriceByImei.get(imeiKey) : 0) ||
            fallbackUnitCost,
        ) || fallbackUnitCost;

      events.push({
        type: "sale_return_good",
        date: billReturn.returnDate || billReturn.createdAt,
        quantity,
        unitCost,
      });
    }
  }

  const baseSummary = calculateProductCostSummary(events, fallbackUnitCost);
  const resolvedEffectiveStock = Math.max(
    0,
    Number(
      effectiveStock !== undefined ? effectiveStock : baseSummary.currentQuantity,
    ) || 0,
  );
  const effectiveValue = roundToTwoDecimals(
    resolvedEffectiveStock * baseSummary.currentAverageCost,
  );

  return {
    ...baseSummary,
    effectiveStock: roundToTwoDecimals(resolvedEffectiveStock),
    effectiveValue,
  };
};
