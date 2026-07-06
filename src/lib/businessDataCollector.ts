import { getBills, getProducts, getClients, getPurchaseBills, getExpenses, getBillReturns, getDeadstock, getCompanyProfile, getInventoryUnits } from "./storage";

export const getBusinessDataForAI = async () => {
  try {
    const [
      bills,
      products,
      clients,
      purchaseBills,
      expenses,
      returns,
      deadstock,
      company,
      inventoryUnits,
    ] = await Promise.all([
      getBills(),
      getProducts(),
      getClients(),
      getPurchaseBills(),
      getExpenses(),
      getBillReturns(),
      getDeadstock(),
      getCompanyProfile(),
      getInventoryUnits(),
    ]);

    const inventoryInStockByProduct = inventoryUnits.reduce((acc: Record<string, number>, unit: any) => {
      if (unit.status !== "in_stock" || !unit.productId) return acc;
      acc[unit.productId] = (acc[unit.productId] || 0) + 1;
      return acc;
    }, {});

    // Format data for AI consumption - reducing size and focus on relevant business metrics
    const getNetBillTotal = (b: any) => {
      const returns = (b.returns || []).reduce(
        (sum: number, r: any) => sum + (r.totalReturnValue || 0),
        0,
      );
      // Exclude GST from revenue — it is collected for government, not business income
      const gstTax = b.isGst ? (b.totalTax || 0) : 0;
      return Math.max(0, (b.total || 0) - returns - gstTax);
    };

    const stats = {
      totalSales: bills.reduce((sum, b) => sum + getNetBillTotal(b), 0),
      totalCollected: bills.reduce(
        (sum, b) => sum + Math.min(b.paidAmount || 0, getNetBillTotal(b)),
        0,
      ),
      totalPurchases: purchaseBills.reduce((sum, b) => sum + b.total, 0),
      totalExpenses: expenses
        .filter((expense: any) => expense.sourceType !== "purchase_bill_auto")
        .reduce((sum, b) => sum + b.amount, 0),
      inventoryValue: products.reduce((sum, p) => {
        const effectiveStock =
          (p.trackingType || "standard") === "serialized"
            ? Math.max(p.stock || 0, inventoryInStockByProduct[p.id] || 0)
            : p.stock || 0;
        return sum + effectiveStock * (p.purchasePrice || 0);
      }, 0),
      netProfit: 0, // Calculated below
      gstLiability: bills
        .filter((b: any) => b.isGst)
        .reduce((sum: number, b: any) => sum + (b.totalTax || 0), 0),
    };
    stats.netProfit = stats.totalSales - stats.totalPurchases - stats.totalExpenses;

    const summary = {
      company: company ? { name: company.name, type: (company as any).businessType || 'Retail' } : { name: 'Generic Business', type: 'Retail' },
      stats,
      topPerformingProducts: (products || [])
        .map(p => ({ 
          name: p.name, 
          stock: p.stock, 
          sales: (bills || []).reduce((sum, b) => {
            const productItems = (b.items || []).filter(i => i.productName === p.name);
            return sum + productItems.reduce((isum, item) => isum + (item.amount || item.quantity * item.ratePerUnit), 0);
          }, 0)
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5),
      clientHealth: (clients || []).map(c => {
        const clientBills = (bills || []).filter(b => b.client?.id === c.id || (b as any).clientName === c.name);
        const total = clientBills.reduce((sum, b) => sum + b.total, 0);
        const paid = clientBills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
        return {
          name: c.name,
          totalSales: total,
          pending: total - paid,
          risk: (total - paid) > (total * 0.5) ? "High" : "Low"
        };
      }).sort((a, b) => b.totalSales - a.totalSales).slice(0, 8),
      monthlyTrends: Array.from({ length: 6 }).map((_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthYear = date.toLocaleString('default', { month: 'short', year: '2-digit' });
        const monthBills = (bills || []).filter(b => {
          const bDate = new Date(b.date);
          return bDate.getMonth() === date.getMonth() && bDate.getFullYear() === date.getFullYear();
        });
        return { month: monthYear, sales: monthBills.reduce((sum, b) => sum + b.total, 0) };
      }).reverse()
    };

    return summary;
  } catch (error) {
    console.error("Error collecting business data:", error);
    throw error;
  }
};
