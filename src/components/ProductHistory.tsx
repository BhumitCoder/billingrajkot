// import { useEffect, useState } from "react";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { Badge } from "@/components/ui/badge";
// import { Product, Bill, PurchaseBill, BillReturn } from "@/types";
// import {
//   getBills,
//   getPurchaseBills,
//   getBillReturns,
//   getProductTransactions,
// } from "@/lib/storage";
// import {
//   Calendar,
//   TrendingUp,
//   TrendingDown,
//   Package,
//   DollarSign,
//   BarChart3,
//   RotateCcw,
// } from "lucide-react";

// interface ProductHistoryProps {
//   product: Product;
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
// }

// interface PurchaseHistoryItem {
//   id: string;
//   date: string;
//   vendorName: string;
//   quantity: number;
//   unit: string;
//   purchasePrice: number;
//   totalAmount: number;
//   billNumber?: string;
//   addedToInventory?: boolean;
// }

// interface SalesHistoryItem {
//   id: string;
//   date: string;
//   clientName: string;
//   quantity: number;
//   unit: string;
//   sellingPrice: number;
//   totalAmount: number;
//   billNumber: string;
// }

// interface ReturnHistoryItem {
//   id: string;
//   date: string;
//   clientName: string;
//   quantity: number;
//   unit: string;
//   condition: "good" | "bad";
//   returnReason?: string;
//   billNumber: string;
//   returnId: string;
// }

// export function ProductHistory({
//   product,
//   open,
//   onOpenChange,
// }: ProductHistoryProps) {
//   const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryItem[]>(
//     []
//   );
//   const [salesHistory, setSalesHistory] = useState<SalesHistoryItem[]>([]);
//   const [returnHistory, setReturnHistory] = useState<ReturnHistoryItem[]>([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     if (open && product) {
//       loadHistory();
//     }
//   }, [open, product]);

//   const loadHistory = async () => {
//     setLoading(true);
//     try {
//       const [bills, purchaseBills, billReturns, transactions] =
//         await Promise.all([
//           getBills(),
//           getPurchaseBills(),
//           getBillReturns(),
//           getProductTransactions(product.id),
//         ]);

//       // Find purchase history - match by product ID from transactions
//       const purchases: PurchaseHistoryItem[] = [];

//       // First, get purchases from transactions that have billId
//       transactions.forEach((transaction) => {
//         if (transaction.billId && transaction.purchasePrice) {
//           // Find the corresponding purchase bill
//           const bill = purchaseBills.find((b) => b.id === transaction.billId);
//           if (bill) {
//             purchases.push({
//               id: transaction.id,
//               date: transaction.date,
//               vendorName: bill.vendorName,
//               quantity: transaction.quantity,
//               unit: product.unit,
//               purchasePrice: transaction.purchasePrice,
//               totalAmount: transaction.quantity * transaction.purchasePrice,
//               billNumber: bill.billNumber,
//               addedToInventory: bill.itemsAddedToInventory || false,
//             });
//           }
//         }
//       });

//       // Add manual stock additions from transactions (those without billId)
//       transactions.forEach((transaction) => {
//         if (!transaction.billId && transaction.purchasePrice) {
//           purchases.push({
//             id: transaction.id,
//             date: transaction.date,
//             vendorName: "Manual Addition",
//             quantity: transaction.quantity,
//             unit: product.unit,
//             purchasePrice: transaction.purchasePrice,
//             totalAmount: transaction.quantity * transaction.purchasePrice,
//             billNumber: undefined,
//             addedToInventory: true,
//           });
//         }
//       });

//       // If no transactions found, fall back to matching by name and HSN code
//       // This is for legacy data or purchases before transaction tracking
//       if (purchases.length === 0) {
//         purchaseBills.forEach((bill) => {
//           bill.items.forEach((item) => {
//             // Exact match by name (case-insensitive)
//             const exactNameMatch =
//               item.description.toLowerCase().trim() ===
//               product.name.toLowerCase().trim();
//             // Match by HSN code if both exist
//             const hsnMatch =
//               item.hsnCode &&
//               product.hsnCode &&
//               item.hsnCode.trim() === product.hsnCode.trim();

//             // Only include if there's an exact name match OR HSN match
//             if (exactNameMatch || hsnMatch) {
//               purchases.push({
//                 id: `${bill.id}-${item.description}`,
//                 date: bill.billDate || bill.createdAt,
//                 vendorName: bill.vendorName,
//                 quantity: item.quantity,
//                 unit: item.unit,
//                 purchasePrice: item.rate,
//                 totalAmount: item.amount,
//                 billNumber: bill.billNumber,
//                 addedToInventory: bill.itemsAddedToInventory || false,
//               });
//             }
//           });
//         });
//       }

//       // Find sales history - match by productId
//       const sales: SalesHistoryItem[] = [];
//       bills.forEach((bill) => {
//         bill.items.forEach((item) => {
//           if (item.productId === product.id) {
//             sales.push({
//               id: bill.id,
//               date: bill.date,
//               clientName: bill.client.name,
//               quantity: item.quantity,
//               unit: item.unit,
//               sellingPrice: item.ratePerUnit,
//               totalAmount: item.amount,
//               billNumber: bill.billNumber,
//             });
//           }
//         });
//       });

//       // Find return history - match by productId
//       const returns: ReturnHistoryItem[] = [];
//       billReturns.forEach((billReturn) => {
//         billReturn.items.forEach((item) => {
//           if (item.productId === product.id) {
//             returns.push({
//               id: `${billReturn.id}-${item.productId}`,
//               date: billReturn.returnDate || billReturn.createdAt,
//               clientName: billReturn.clientName,
//               quantity: item.quantity,
//               unit: product.unit,
//               condition: item.condition,
//               returnReason: item.returnReason,
//               billNumber: billReturn.billNumber,
//               returnId: billReturn.id,
//             });
//           }
//         });
//       });

//       // Sort by date ascending for FIFO calculation, descending for display
//       const purchasesSortedForFIFO = [...purchases].sort(
//         (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
//       );
//       purchases.sort(
//         (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
//       );
//       sales.sort(
//         (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
//       );
//       returns.sort(
//         (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
//       );

//       setPurchaseHistory(purchases);
//       setSalesHistory(sales);
//       setReturnHistory(returns);
//     } catch (error) {
//       console.error("Error loading product history:", error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Calculate statistics using FIFO method
//   const calculateFIFO = () => {
//     const totalPurchased = purchaseHistory.reduce(
//       (sum, item) => sum + item.quantity,
//       0
//     );
//     const totalSold = salesHistory.reduce(
//       (sum, item) => sum + item.quantity,
//       0
//     );
//     const totalReturned = returnHistory.reduce(
//       (sum, item) => sum + item.quantity,
//       0
//     );
//     const totalReturnedGood = returnHistory
//       .filter((r) => r.condition === "good")
//       .reduce((sum, item) => sum + item.quantity, 0);
//     const totalReturnedBad = returnHistory
//       .filter((r) => r.condition === "bad")
//       .reduce((sum, item) => sum + item.quantity, 0);

//     const totalPurchaseValue = purchaseHistory.reduce(
//       (sum, item) => sum + item.totalAmount,
//       0
//     );
//     const totalSalesValue = salesHistory.reduce(
//       (sum, item) => sum + item.totalAmount,
//       0
//     );

//     // Overall weighted average purchase price
//     const overallAvgPurchasePrice =
//       totalPurchased > 0
//         ? totalPurchaseValue / totalPurchased
//         : product.purchasePrice || 0;

//     // Weighted average selling price
//     const averageSellingPrice =
//       totalSold > 0
//         ? totalSalesValue / totalSold
//         : product.sellingPrice || product.price || 0;

//     // Simple Weighted Average Method
//     // Net quantity sold (sales - good returns, as good returns go back to inventory)
//     const netSold = totalSold - totalReturnedGood;

//     // Cost of Goods Sold using weighted average
//     const costOfGoodsSold = netSold * overallAvgPurchasePrice;

//     // Remaining inventory value
//     const totalAssets = totalPurchaseValue - totalSalesValue;

//     // Average purchase price of remaining stock
//     const averagePurchasePrice =
//       product.stock > 0 ? totalAssets / product.stock : overallAvgPurchasePrice;

//     // Profit calculations
//     const totalProfit = totalSalesValue - costOfGoodsSold;
//     const profitMargin =
//       averageSellingPrice > 0 && overallAvgPurchasePrice > 0
//         ? ((averageSellingPrice - overallAvgPurchasePrice) /
//             overallAvgPurchasePrice) *
//           100
//         : 0;

//     return {
//       totalPurchased,
//       totalSold,
//       totalReturned,
//       totalReturnedGood,
//       totalReturnedBad,
//       netSold,
//       totalPurchaseValue,
//       totalSalesValue,
//       overallAvgPurchasePrice,
//       averageSellingPrice,
//       totalAssets,
//       averagePurchasePrice,
//       costOfGoodsSold,
//       totalProfit,
//       profitMargin,
//       remainingInventory: [],
//     };
//   };

//   const stats = calculateFIFO();

//   const formatDate = (dateString: string) => {
//     try {
//       return new Date(dateString).toLocaleDateString("en-IN", {
//         year: "numeric",
//         month: "short",
//         day: "numeric",
//       });
//     } catch {
//       return dateString;
//     }
//   };

//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-IN", {
//       style: "currency",
//       currency: "INR",
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     }).format(amount);
//   };

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="max-w-[96vw] sm:max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
//         <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b flex-shrink-0">
//           <DialogTitle className="text-base sm:text-lg md:text-xl pr-8 break-words">
//             Product History - {product.name}
//           </DialogTitle>
//         </DialogHeader>

//         {loading ? (
//           <div className="py-12 text-center text-muted-foreground text-sm">
//             Loading history...
//           </div>
//         ) : (
//           <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6">
//             <div className="space-y-4 py-4">
//               {/* Summary Cards */}
//               <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
//                 <Card className="border">
//                   <CardHeader className="pb-2 px-3 pt-3">
//                     <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
//                       <Package className="h-3 w-3 flex-shrink-0" />
//                       <span className="truncate">Stock</span>
//                     </CardTitle>
//                   </CardHeader>
//                   <CardContent className="px-3 pb-3">
//                     <div className="text-lg sm:text-xl font-bold">
//                       {Number(product.stock).toFixed(2)} {product.unit}
//                     </div>
//                   </CardContent>
//                 </Card>

//                 <Card className="border">
//                   <CardHeader className="pb-2 px-3 pt-3">
//                     <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
//                       <DollarSign className="h-3 w-3 flex-shrink-0" />
//                       <span className="truncate">Assets</span>
//                     </CardTitle>
//                   </CardHeader>
//                   <CardContent className="px-3 pb-3">
//                     <div className="text-lg sm:text-xl font-bold text-emerald-600 break-words">
//                       {formatCurrency(stats.totalAssets)}
//                     </div>
//                   </CardContent>
//                 </Card>

//                 <Card className="border">
//                   <CardHeader className="pb-2 px-3 pt-3">
//                     <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
//                       <TrendingUp className="h-3 w-3 flex-shrink-0" />
//                       <span className="truncate">Avg Buy</span>
//                     </CardTitle>
//                   </CardHeader>
//                   <CardContent className="px-3 pb-3">
//                     <div className="text-base sm:text-lg font-bold break-words">
//                       {formatCurrency(stats.averagePurchasePrice)}
//                     </div>
//                     <p className="text-[10px] text-muted-foreground">
//                       {Number(product.stock).toFixed(2)} {product.unit}
//                     </p>
//                   </CardContent>
//                 </Card>

//                 <Card className="border">
//                   <CardHeader className="pb-2 px-3 pt-3">
//                     <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
//                       <TrendingDown className="h-3 w-3 flex-shrink-0" />
//                       <span className="truncate">Avg Sell</span>
//                     </CardTitle>
//                   </CardHeader>
//                   <CardContent className="px-3 pb-3">
//                     <div className="text-base sm:text-lg font-bold text-blue-600 break-words">
//                       {formatCurrency(stats.averageSellingPrice)}
//                     </div>
//                     <p className="text-[10px] text-muted-foreground">
//                       {stats.totalSold} {product.unit}
//                     </p>
//                   </CardContent>
//                 </Card>
//               </div>

//               {/* Business Analytics */}
//               <Card className="border">
//                 <CardHeader className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
//                   <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
//                     <BarChart3 className="h-4 w-4 flex-shrink-0" />
//                     Business Analytics (Weighted Average Method)
//                   </CardTitle>
//                 </CardHeader>
//                 <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
//                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
//                     <div>
//                       <p className="text-[10px] sm:text-xs text-muted-foreground">
//                         Total Purchased
//                       </p>
//                       <p className="text-sm sm:text-base font-semibold">
//                         {Number(stats.totalPurchased).toFixed(2)} {product.unit}
//                       </p>
//                       <p className="text-[10px] text-muted-foreground">
//                         {formatCurrency(stats.totalPurchaseValue)}
//                       </p>
//                     </div>
//                     <div>
//                       <p className="text-[10px] sm:text-xs text-muted-foreground">
//                         Total Sold
//                       </p>
//                       <p className="text-sm sm:text-base font-semibold">
//                         {Number(stats.totalSold).toFixed(2)} {product.unit}
//                       </p>
//                       <p className="text-[10px] text-muted-foreground">
//                         {formatCurrency(stats.totalSalesValue)}
//                       </p>
//                       {stats.totalReturned > 0 && (
//                         <p className="text-[10px] text-orange-500 mt-0.5">
//                           Net: {Number(stats.netSold).toFixed(2)} {product.unit}
//                         </p>
//                       )}
//                     </div>
//                     <div>
//                       <p className="text-[10px] sm:text-xs text-muted-foreground">
//                         Profit Margin
//                       </p>
//                       <p
//                         className={`text-sm sm:text-base font-semibold ${
//                           stats.profitMargin > 0
//                             ? "text-emerald-600"
//                             : "text-red-600"
//                         }`}
//                       >
//                         {stats.profitMargin.toFixed(2)}%
//                       </p>
//                       <p className="text-[10px] text-muted-foreground">
//                         {formatCurrency(stats.totalProfit)}
//                       </p>
//                     </div>
//                     <div>
//                       <p className="text-[10px] sm:text-xs text-muted-foreground">
//                         Stock Turnover
//                       </p>
//                       <p className="text-sm sm:text-base font-semibold">
//                         {stats.totalPurchased > 0
//                           ? (
//                               (stats.totalSold / stats.totalPurchased) *
//                               100
//                             ).toFixed(1)
//                           : 0}
//                         %
//                       </p>
//                       <p className="text-[10px] text-muted-foreground">
//                         {Number(stats.totalSold).toFixed(2)} /{" "}
//                         {Number(stats.totalPurchased).toFixed(2)}
//                       </p>
//                     </div>
//                   </div>
//                 </CardContent>
//               </Card>

//               {/* History Tabs */}
//               <Tabs defaultValue="purchases" className="w-full">
//                 <div className="overflow-x-auto scrollbar-hide pb-1">
//                   <TabsList className="inline-flex h-9 w-full min-w-fit">
//                     <TabsTrigger
//                       value="purchases"
//                       className="text-xs px-4 py-2 flex-1 min-w-[120px]"
//                     >
//                       Purchases ({purchaseHistory.length})
//                     </TabsTrigger>
//                     <TabsTrigger
//                       value="sales"
//                       className="text-xs px-4 py-2 flex-1 min-w-[100px]"
//                     >
//                       Sales ({salesHistory.length})
//                     </TabsTrigger>
//                     <TabsTrigger
//                       value="returns"
//                       className="text-xs px-4 py-2 flex-1 min-w-[100px]"
//                     >
//                       Returns ({returnHistory.length})
//                     </TabsTrigger>
//                   </TabsList>
//                 </div>

//                 <TabsContent value="purchases" className="mt-3">
//                   {purchaseHistory.length === 0 ? (
//                     <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
//                       No purchase history found for this product
//                     </div>
//                   ) : (
//                     <div className="border rounded-lg overflow-hidden">
//                       <div className="overflow-x-auto">
//                         <table
//                           className="w-full border-collapse"
//                           style={{ minWidth: "700px" }}
//                         >
//                           <thead className="bg-muted">
//                             <tr>
//                               <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
//                                 Date
//                               </th>
//                               <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
//                                 Vendor
//                               </th>
//                               <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
//                                 Bill No
//                               </th>
//                               <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
//                                 Qty
//                               </th>
//                               <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
//                                 Price/Unit
//                               </th>
//                               <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
//                                 Total
//                               </th>
//                               <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
//                                 Status
//                               </th>
//                             </tr>
//                           </thead>
//                           <tbody>
//                             {purchaseHistory.map((item, index) => (
//                               <tr
//                                 key={`${item.id}-${index}`}
//                                 className="border-b hover:bg-muted/30"
//                               >
//                                 <td className="p-3 sm:p-4 text-xs sm:text-sm">
//                                   <div className="flex items-center gap-1 sm:gap-2">
//                                     <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
//                                     <span className="whitespace-nowrap">
//                                       {formatDate(item.date)}
//                                     </span>
//                                   </div>
//                                 </td>
//                                 <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium">
//                                   {item.vendorName}
//                                 </td>
//                                 <td className="p-3 sm:p-4 text-xs sm:text-sm">
//                                   {item.billNumber ? (
//                                     <Badge
//                                       variant="outline"
//                                       className="text-[10px] sm:text-xs"
//                                     >
//                                       {item.billNumber}
//                                     </Badge>
//                                   ) : (
//                                     "-"
//                                   )}
//                                 </td>
//                                 <td className="p-3 sm:p-4 text-xs sm:text-sm text-right whitespace-nowrap">
//                                   {item.quantity} {item.unit}
//                                 </td>
//                                 <td className="p-3 sm:p-4 text-xs sm:text-sm text-right whitespace-nowrap">
//                                   {formatCurrency(item.purchasePrice)}
//                                 </td>
//                                 <td className="p-3 sm:p-4 text-xs sm:text-sm text-right font-semibold whitespace-nowrap">
//                                   {formatCurrency(item.totalAmount)}
//                                 </td>
//                                 <td className="p-3 sm:p-4 text-xs sm:text-sm">
//                                   <Badge
//                                     variant={
//                                       item.addedToInventory
//                                         ? "default"
//                                         : "secondary"
//                                     }
//                                     className="text-[10px] sm:text-xs bg-emerald-600"
//                                   >
//                                     {item.addedToInventory
//                                       ? "In Inventory"
//                                       : "Pending"}
//                                   </Badge>
//                                 </td>
//                               </tr>
//                             ))}
//                           </tbody>
//                         </table>
//                       </div>
//                     </div>
//                   )}
//                 </TabsContent>

//                 <TabsContent value="sales" className="mt-3">
//                   {salesHistory.length === 0 ? (
//                     <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
//                       No sales history found
//                     </div>
//                   ) : (
//                     <div className="border rounded-lg overflow-hidden">
//                       <div className="overflow-x-auto">
//                         <table
//                           className="w-full border-collapse"
//                           style={{ minWidth: "600px" }}
//                         >
//                           <thead className="bg-muted">
//                             <tr>
//                               <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
//                                 Date
//                               </th>
//                               <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
//                                 Client
//                               </th>
//                               <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
//                                 Bill No
//                               </th>
//                               <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
//                                 Qty
//                               </th>
//                               <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
//                                 Price/Unit
//                               </th>
//                               <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
//                                 Total
//                               </th>
//                             </tr>
//                           </thead>
//                           <tbody>
//                             {salesHistory.map((item, index) => (
//                               <tr
//                                 key={`${item.id}-${index}`}
//                                 className="border-b hover:bg-muted/30"
//                               >
//                                 <td className="p-3 sm:p-4 text-xs sm:text-sm">
//                                   <div className="flex items-center gap-1 sm:gap-2">
//                                     <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
//                                     <span className="whitespace-nowrap">
//                                       {formatDate(item.date)}
//                                     </span>
//                                   </div>
//                                 </td>
//                                 <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium">
//                                   {item.clientName}
//                                 </td>
//                                 <td className="p-3 sm:p-4 text-xs sm:text-sm">
//                                   <Badge
//                                     variant="outline"
//                                     className="text-[10px] sm:text-xs"
//                                   >
//                                     {item.billNumber}
//                                   </Badge>
//                                 </td>
//                                 <td className="p-3 sm:p-4 text-xs sm:text-sm text-right whitespace-nowrap">
//                                   {item.quantity} {item.unit}
//                                 </td>
//                                 <td className="p-3 sm:p-4 text-xs sm:text-sm text-right text-blue-600 whitespace-nowrap">
//                                   {formatCurrency(item.sellingPrice)}
//                                 </td>
//                                 <td className="p-3 sm:p-4 text-xs sm:text-sm text-right font-semibold text-emerald-600 whitespace-nowrap">
//                                   {formatCurrency(item.totalAmount)}
//                                 </td>
//                               </tr>
//                             ))}
//                           </tbody>
//                         </table>
//                       </div>
//                     </div>
//                   )}
//                 </TabsContent>

//                 <TabsContent value="returns" className="mt-3">
//                   {returnHistory.length === 0 ? (
//                     <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
//                       No return history found
//                     </div>
//                   ) : (
//                     <>
//                       <div className="border rounded-lg overflow-hidden">
//                         <div className="overflow-x-auto">
//                           <table
//                             className="w-full border-collapse"
//                             style={{ minWidth: "700px" }}
//                           >
//                             <thead className="bg-muted">
//                               <tr>
//                                 <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
//                                   Reason
//                                 </th>
//                               </tr>
//                             </thead>
//                             <tbody>
//                               {returnHistory.map((item, index) => (
//                                 <tr
//                                   key={`${item.id}-${index}`}
//                                   className="border-b hover:bg-muted/30"
//                                 >
//                                   <td className="p-3 sm:p-4 text-xs sm:text-sm">
//                                     <div className="flex items-center gap-1 sm:gap-2">
//                                       <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
//                                       <span className="whitespace-nowrap">
//                                         {formatDate(item.date)}
//                                       </span>
//                                     </div>
//                                   </td>
//                                   <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium">
//                                     {item.clientName}
//                                   </td>
//                                   <td className="p-3 sm:p-4 text-xs sm:text-sm">
//                                     <Badge
//                                       variant="outline"
//                                       className="text-[10px] sm:text-xs"
//                                     >
//                                       {item.billNumber}
//                                     </Badge>
//                                   </td>
//                                   <td className="p-3 sm:p-4 text-xs sm:text-sm text-right whitespace-nowrap">
//                                     {item.quantity} {item.unit}
//                                   </td>
//                                   <td className="p-3 sm:p-4 text-xs sm:text-sm">
//                                     <Badge
//                                       variant={
//                                         item.condition === "good"
//                                           ? "default"
//                                           : "destructive"
//                                       }
//                                       className="text-[10px] sm:text-xs bg-emerald-600"
//                                     >
//                                       {item.condition === "good"
//                                         ? "Good - Back to Inventory"
//                                         : "Bad - Deadstock"}
//                                     </Badge>
//                                   </td>
//                                   <td className="p-3 sm:p-4 text-xs sm:text-sm text-muted-foreground">
//                                     {item.returnReason || "-"}
//                                   </td>
//                                 </tr>
//                               ))}
//                             </tbody>
//                           </table>
//                         </div>
//                       </div>

//                       {returnHistory.length > 0 && (
//                         <Card className="border mt-3">
//                           <CardHeader className="px-3 pt-3 pb-2">
//                             <CardTitle className="text-xs sm:text-sm">
//                               Return Summary
//                             </CardTitle>
//                           </CardHeader>
//                           <CardContent className="px-3 pb-3">
//                             <div className="grid grid-cols-3 gap-3">
//                               <div>
//                                 <p className="text-[10px] text-muted-foreground">
//                                   Total
//                                 </p>
//                                 <p className="text-sm font-semibold text-orange-600">
//                                   {stats.totalReturned} {product.unit}
//                                 </p>
//                               </div>
//                               <div>
//                                 <p className="text-[10px] text-muted-foreground">
//                                   Good
//                                 </p>
//                                 <p className="text-sm font-semibold text-emerald-600">
//                                   {stats.totalReturnedGood} {product.unit}
//                                 </p>
//                               </div>
//                               <div>
//                                 <p className="text-[10px] text-muted-foreground">
//                                   Bad
//                                 </p>
//                                 <p className="text-sm font-semibold text-red-600">
//                                   {stats.totalReturnedBad} {product.unit}
//                                 </p>
//                               </div>
//                             </div>
//                           </CardContent>
//                         </Card>
//                       )}
//                     </>
//                   )}
//                 </TabsContent>
//               </Tabs>
//             </div>
//           </div>
//         )}
//       </DialogContent>
//     </Dialog>
//   );
// }

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Product, Bill, PurchaseBill, BillReturn } from "@/types";
import {
  getBills,
  getPurchaseBills,
  getBillReturns,
  getPurchaseReturns,
  getProductTransactions,
} from "@/lib/storage";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  BarChart3,
  RotateCcw,
  Search,
  Info,
} from "lucide-react";

interface ProductHistoryProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PurchaseHistoryItem {
  id: string;
  date: string;
  vendorName: string;
  imeiNumber?: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  totalAmount: number;
  billNumber?: string;
  addedToInventory?: boolean;
  isReturn?: boolean;
}

interface SalesHistoryItem {
  id: string;
  date: string;
  clientName: string;
  quantity: number;
  unit: string;
  sellingPrice: number;
  totalAmount: number;
  billNumber: string;
}

interface ReturnHistoryItem {
  id: string;
  date: string;
  clientName: string;
  quantity: number;
  unit: string;
  condition: "good" | "bad";
  returnReason?: string;
  billNumber: string;
  returnId: string;
}

export function ProductHistory({
  product,
  open,
  onOpenChange,
}: ProductHistoryProps) {
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryItem[]>(
    [],
  );
  const [salesHistory, setSalesHistory] = useState<SalesHistoryItem[]>([]);
  const [returnHistory, setReturnHistory] = useState<ReturnHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (open && product) {
      loadHistory();
    }
  }, [open, product]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const [bills, purchaseBills, billReturns, purchaseReturns, transactions] =
        await Promise.all([
          getBills(),
          getPurchaseBills(),
          getBillReturns(),
          getPurchaseReturns(),
          getProductTransactions(product.id),
        ]);

      // Find purchase history - match by product ID from transactions
      const purchases: PurchaseHistoryItem[] = [];

      // First, get purchases from transactions that have billId
      transactions.forEach((transaction) => {
        if (
          transaction.type === "purchase" &&
          transaction.billId &&
          transaction.purchasePrice
        ) {
          // Find the corresponding purchase bill
          const bill = purchaseBills.find((b) => b.id === transaction.billId);
          if (bill) {
            purchases.push({
              id: transaction.id,
              date: transaction.date,
              vendorName: bill.vendorName,
              imeiNumber: transaction.imeiNumber || "",
              quantity: transaction.quantity,
              unit: product.unit,
              purchasePrice: transaction.purchasePrice,
              totalAmount: transaction.quantity * transaction.purchasePrice,
              billNumber: bill.billNumber,
              addedToInventory: bill.itemsAddedToInventory || false,
            });
          }
        }
      });

      // Add manual stock additions from transactions (those without billId)
      transactions.forEach((transaction) => {
        if (
          transaction.type === "purchase" &&
          !transaction.billId &&
          transaction.purchasePrice
        ) {
          purchases.push({
            id: transaction.id,
            date: transaction.date,
            vendorName: "Manual Addition",
            imeiNumber: transaction.imeiNumber || "",
            quantity: transaction.quantity,
            unit: product.unit,
            purchasePrice: transaction.purchasePrice,
            totalAmount: transaction.quantity * transaction.purchasePrice,
            billNumber: undefined,
            addedToInventory: true,
          });
        }
      });

      // If no transactions found, fall back to matching by name
      // This is for legacy data or purchases before transaction tracking
      if (purchases.length === 0) {
        purchaseBills.forEach((bill) => {
          bill.items.forEach((item) => {
            // Exact match by name (case-insensitive)
            const exactNameMatch =
              item.description.toLowerCase().trim() ===
              product.name.toLowerCase().trim();

            // Only include if there's an exact name match
            if (exactNameMatch) {
              purchases.push({
                id: `${bill.id}-${item.description}`,
                date: bill.billDate || bill.createdAt,
                vendorName: bill.vendorName,
                imeiNumber: (item as any).imeiNumber || "",
                quantity: item.quantity,
                unit: item.unit,
                purchasePrice: item.rate,
                totalAmount: item.amount,
                billNumber: bill.billNumber,
                addedToInventory: bill.itemsAddedToInventory || false,
              });
            }
          });
        });
      }

      // Find sales history - match by productId
      const sales: SalesHistoryItem[] = [];
      bills.forEach((bill) => {
        bill.items.forEach((item) => {
          if (item.productId === product.id) {
            sales.push({
              id: bill.id,
              date: bill.date,
              clientName: bill.client?.name ?? "",
              quantity: item.quantity,
              unit: item.unit,
              sellingPrice: item.ratePerUnit,
              totalAmount: item.amount,
              billNumber: bill.billNumber,
            });
          }
        });
      });

      // Find return history - match by productId
      const returns: ReturnHistoryItem[] = [];
      billReturns.forEach((billReturn) => {
        const items = (billReturn as any).items || [];
        items.forEach((item: any) => {
          // Robust ID matching - handle both string and potential number types
          const itemProductId = String(item.productId || "");
          const currentProductId = String(product.id || "");
          const isMatch = itemProductId === currentProductId && itemProductId !== "";
          
          if (isMatch) {
            const returnItem: ReturnHistoryItem = {
              id: `${billReturn.id}-${item.productId}`,
              date: billReturn.returnDate || billReturn.createdAt,
              clientName: billReturn.clientName,
              quantity: Number(item.quantity),
              unit: product.unit,
              condition: item.condition,
              returnReason: item.returnReason,
              billNumber: billReturn.billNumber,
              returnId: billReturn.id,
            };
            returns.push(returnItem);
          }
        });
      });

      // Find purchase return history - match by productId and add to purchase history
      purchaseReturns.forEach((pReturn) => {
        pReturn.items.forEach((item) => {
          // Match by description since purchase returns might not have productId
          const isMatch = item.description.toLowerCase().trim() === product.name.toLowerCase().trim();
          
          if (isMatch) {
            purchases.push({
              id: `p-return-${pReturn.id}-${item.description}`,
              date: pReturn.returnDate || pReturn.createdAt,
              vendorName: `Purchase Return: ${pReturn.vendorName}`,
              quantity: -item.quantity, // Negative quantity for return
              unit: (item as any).unit || product.unit,
              purchasePrice: item.rate,
              totalAmount: -(item.quantity * item.rate),
              billNumber: pReturn.billNumber,
              addedToInventory: true,
              isReturn: true,
            });
          }
        });
      });

      // Sort by date ascending for FIFO calculation, descending for display
      const purchasesSortedForFIFO = [...purchases].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      purchases.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      sales.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      returns.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      setPurchaseHistory(purchases);
      setSalesHistory(sales);
      setReturnHistory(returns);
    } catch (error) {
      console.error("Error loading product history:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics using Weighted Average method
  const calculateStats = () => {
    const totalPurchased = purchaseHistory.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const totalSold = salesHistory.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const totalReturned = returnHistory.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const totalReturnedGood = returnHistory
      .filter((r) => r.condition === "good")
      .reduce((sum, item) => sum + item.quantity, 0);
    const totalReturnedBad = returnHistory
      .filter((r) => r.condition === "bad")
      .reduce((sum, item) => sum + item.quantity, 0);

    const totalPurchaseValue = purchaseHistory.reduce(
      (sum, item) => sum + item.totalAmount,
      0,
    );
    const totalSalesValue = salesHistory.reduce(
      (sum, item) => sum + item.totalAmount,
      0,
    );

    // Overall weighted average purchase price
    const overallAvgPurchasePrice =
      totalPurchased > 0
        ? totalPurchaseValue / totalPurchased
        : product.purchasePrice || 0;

    // Weighted average selling price
    const averageSellingPrice =
      totalSold > 0
        ? totalSalesValue / totalSold
        : product.sellingPrice || product.price || 0;

    // Simple Weighted Average Method
    // Net quantity sold (sales - good returns, as good returns go back to inventory)
    const netSold = totalSold - totalReturnedGood;

    // Cost of Goods Sold using weighted average
    const costOfGoodsSold = netSold * overallAvgPurchasePrice;

    // Remaining inventory value
    const totalAssets = totalPurchaseValue - totalSalesValue;

    // Average purchase price of remaining stock
    const averagePurchasePrice =
      product.stock > 0 ? totalAssets / product.stock : overallAvgPurchasePrice;

    // Profit calculations
    const totalProfit = totalSalesValue - costOfGoodsSold;
    const profitMargin =
      averageSellingPrice > 0 && overallAvgPurchasePrice > 0
        ? ((averageSellingPrice - overallAvgPurchasePrice) /
            overallAvgPurchasePrice) *
          100
        : 0;

    // Additional details: Total weight in stock
    const totalStockWeight = product.stock * (Number(product.weight) || 0);

    return {
      totalPurchased,
      totalSold,
      totalReturned,
      totalReturnedGood,
      totalReturnedBad,
      netSold,
      totalPurchaseValue,
      totalSalesValue,
      overallAvgPurchasePrice,
      averageSellingPrice,
      totalAssets,
      averagePurchasePrice,
      costOfGoodsSold,
      totalProfit,
      profitMargin,
      totalStockWeight,
      remainingInventory: [],
    };
  };

  const stats = calculateStats();

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    const formatted = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absAmount);
    return isNegative ? `-${formatted}` : formatted;
  };

  const filteredPurchases = purchaseHistory.filter((item) => {
    const searchStr = searchTerm.toLowerCase();
    const vendorMatch = (item.vendorName || "")
      .toLowerCase()
      .includes(searchStr);
    const billMatch = (item.billNumber || "").toLowerCase().includes(searchStr);

    const matchesSearch = vendorMatch || billMatch;

    const itemDate = new Date(item.date);
    const matchesStartDate = !startDate || itemDate >= new Date(startDate);
    const matchesEndDate = !endDate || itemDate <= new Date(endDate);
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  const filteredSales = salesHistory.filter((item) => {
    const searchStr = searchTerm.toLowerCase();
    const clientMatch = (item.clientName || "")
      .toLowerCase()
      .includes(searchStr);
    const billMatch = (item.billNumber || "").toLowerCase().includes(searchStr);

    const matchesSearch = clientMatch || billMatch;

    const itemDate = new Date(item.date);
    const matchesStartDate = !startDate || itemDate >= new Date(startDate);
    const matchesEndDate = !endDate || itemDate <= new Date(endDate);
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  const filteredReturns = returnHistory.filter((item) => {
    const searchStr = searchTerm.toLowerCase();
    const clientMatch = (item.clientName || "")
      .toLowerCase()
      .includes(searchStr);
    const billMatch = (item.billNumber || "").toLowerCase().includes(searchStr);
    const reasonMatch = (item.returnReason || "")
      .toLowerCase()
      .includes(searchStr);

    const matchesSearch = clientMatch || billMatch || reasonMatch;

    const itemDate = new Date(item.date);
    const matchesStartDate = !startDate || itemDate >= new Date(startDate);
    const matchesEndDate = !endDate || itemDate <= new Date(endDate);
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] sm:max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b flex-shrink-0">
          <DialogTitle className="text-base sm:text-lg md:text-xl pr-8 break-words">
            Product History - {product.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Loading history...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="space-y-4 py-4">
              {/* Product Info & Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="md:col-span-2 border shadow-sm">
                  <CardContent className="p-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">HSN</p>
                        
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Tax</p>
                        
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Unit</p>
                        <p className="text-sm font-semibold uppercase">{product.unit}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Weight</p>
                        <p className="text-sm font-semibold">{product.weight || "0"} {product.weightUnit || ""}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Source</p>
                        <p className="text-sm font-semibold truncate">{product.whereToBuy || "Direct"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border shadow-sm bg-primary/5">
                  <CardContent className="p-3 flex flex-col justify-center h-full">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Current Stock</p>
                    <div className="text-2xl font-black text-primary">
                      {Number(product.stock).toFixed(2)} <span className="text-xs font-normal uppercase">{product.unit}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Total Weight: {stats.totalStockWeight ? stats.totalStockWeight.toFixed(2) : "0"} {product.weightUnit || ""}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border shadow-sm">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Assets Valuesss</p>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(stats.totalAssets)}</p>
                  </CardContent>
                </Card>
                <Card className="border shadow-sm">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Avg Buy Price</p>
                    <p className="text-lg font-bold">{formatCurrency(stats.averagePurchasePrice)}</p>
                  </CardContent>
                </Card>
                <Card className="border shadow-sm">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Avg Sell Price</p>
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.averageSellingPrice)}</p>
                  </CardContent>
                </Card>
                <Card className="border shadow-sm">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Profit Margin</p>
                    <p className={`text-lg font-bold ${stats.profitMargin > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {stats.profitMargin.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Business Analytics Mini */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-muted/30 rounded-lg border text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Bought</p>
                  <p className="text-sm font-semibold">{Number(stats.totalPurchased).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Sold</p>
                  <p className="text-sm font-semibold">{Number(stats.totalSold).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Returns</p>
                  <p className="text-sm font-semibold text-orange-600">{Number(stats.totalReturned).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Turnover</p>
                  <p className="text-sm font-semibold">
                    {stats.totalPurchased > 0 ? ((stats.totalSold / stats.totalPurchased) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>

              {/* Filters Area */}
              <div className="flex flex-col sm:flex-row gap-2 bg-muted/10 p-2 rounded-md border border-dashed">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by vendor, client, bill no..."
                    className="pl-9 h-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    type="date"
                    className="h-9 w-auto text-xs"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="text-muted-foreground text-xs">to</span>
                  <Input
                    type="date"
                    className="h-9 w-auto text-xs"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* History Tabs */}
              <Tabs defaultValue="purchases" className="w-full">
                <div className="overflow-x-auto scrollbar-hide pb-1">
                  <TabsList className="inline-flex h-9 w-full min-w-fit">
                    <TabsTrigger
                      value="purchases"
                      className="text-xs px-4 py-2 flex-1 min-w-[150px]"
                    >
                      Purchase Transaction ({filteredPurchases.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="sales"
                      className="text-xs px-4 py-2 flex-1 min-w-[100px]"
                    >
                      Sales ({filteredSales.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="returns"
                      className="text-xs px-4 py-2 flex-1 min-w-[100px]"
                    >
                      Returns ({filteredReturns.length})
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="purchases" className="mt-3">
                  {filteredPurchases.length === 0 ? (
                    <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
                      No purchase transactions found matching the filters
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table
                          className="w-full border-collapse"
                          style={{ minWidth: "700px" }}
                        >
                          <thead className="bg-muted">
                            <tr>
                              <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
                                Date
                              </th>
                              <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
                                Vendor
                              </th>
                              <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
                                Bill No
                              </th>
                              <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
                                IMEI
                              </th>
                              <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
                                Qty
                              </th>
                              <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
                                Price/Unit
                              </th>
                              <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
                                Total
                              </th>
                              <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPurchases.map((item, index) => (
                              <tr
                                key={`${item.id}-${index}`}
                                className={`border-b hover:bg-muted/30 ${
                                  item.quantity < 0 ? "bg-red-50/30" : ""
                                }`}
                              >
                                <td className="p-3 sm:p-4 text-xs sm:text-sm">
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                    <span className="whitespace-nowrap">
                                      {formatDate(item.date)}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium">
                                  <div className="flex flex-col">
                                    <span>{item.vendorName}</span>
                                    {item.quantity < 0 && (
                                      <span className="text-[10px] text-red-500 font-normal">
                                        Purchase Return
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 sm:p-4 text-xs sm:text-sm">
                                  {item.billNumber ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] sm:text-xs"
                                    >
                                      {item.billNumber}
                                    </Badge>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="p-3 sm:p-4 text-xs sm:text-sm text-right whitespace-nowrap">
                                  {item.imeiNumber || "-"}
                                </td>
                                <td
                                  className={`p-3 sm:p-4 text-xs sm:text-sm text-right whitespace-nowrap ${
                                    item.quantity < 0
                                      ? "text-red-600 font-bold"
                                      : ""
                                  }`}
                                >
                                  {item.quantity} {item.unit}
                                </td>
                                <td className="p-3 sm:p-4 text-xs sm:text-sm text-right whitespace-nowrap">
                                  {formatCurrency(item.purchasePrice)}
                                </td>
                                <td
                                  className={`p-3 sm:p-4 text-xs sm:text-sm text-right font-semibold whitespace-nowrap ${
                                    item.totalAmount < 0 ? "text-red-600" : ""
                                  }`}
                                >
                                  {formatCurrency(item.totalAmount)}
                                </td>
                                <td className="p-3 sm:p-4 text-xs sm:text-sm">
                                  <Badge
                                    variant={
                                      item.isReturn
                                        ? "outline"
                                        : item.addedToInventory
                                        ? "default"
                                        : "secondary"
                                    }
                                    className={`text-[10px] sm:text-xs ${
                                      item.isReturn
                                        ? "text-red-600 border-red-200 bg-red-50"
                                        : item.addedToInventory
                                        ? "bg-emerald-600"
                                        : ""
                                    }`}
                                  >
                                    {item.isReturn
                                      ? "Returned to Vendor"
                                      : item.addedToInventory
                                      ? "In Inventory"
                                      : item.quantity < 0
                                        ? "Rejected/Bad"
                                        : "Pending"}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="sales" className="mt-3">
                  {filteredSales.length === 0 ? (
                    <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
                      No sales history found matching the filters
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table
                          className="w-full border-collapse"
                          style={{ minWidth: "600px" }}
                        >
                          <thead className="bg-muted">
                            <tr>
                              <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
                                Date
                              </th>
                              <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
                                Client
                              </th>
                              <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
                                Bill No
                              </th>
                              <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
                                Qty
                              </th>
                              <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
                                Price/Unit
                              </th>
                              <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSales.map((item, index) => (
                              <tr
                                key={`${item.id}-${index}`}
                                className="border-b hover:bg-muted/30"
                              >
                                <td className="p-3 sm:p-4 text-xs sm:text-sm">
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                    <span className="whitespace-nowrap">
                                      {formatDate(item.date)}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium">
                                  {item.clientName}
                                </td>
                                <td className="p-3 sm:p-4 text-xs sm:text-sm">
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] sm:text-xs"
                                  >
                                    {item.billNumber}
                                  </Badge>
                                </td>
                                <td className="p-3 sm:p-4 text-xs sm:text-sm text-right whitespace-nowrap">
                                  {item.quantity} {item.unit}
                                </td>
                                <td className="p-3 sm:p-4 text-xs sm:text-sm text-right text-blue-600 whitespace-nowrap">
                                  {formatCurrency(item.sellingPrice)}
                                </td>
                                <td className="p-3 sm:p-4 text-xs sm:text-sm text-right font-semibold text-emerald-600 whitespace-nowrap">
                                  {formatCurrency(item.totalAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="returns" className="mt-3">
                  {filteredReturns.length === 0 ? (
                    <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
                      No return history found matching the filters
                    </div>
                  ) : (
                    <>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table
                            className="w-full border-collapse"
                            style={{ minWidth: "700px" }}
                          >
                            <thead className="bg-muted">
                              <tr>
                                <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
                                  Date
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
                                  Client
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
                                  Bill No
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-right font-medium text-xs sm:text-sm">
                                  Qty
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
                                  Condition
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-left font-medium text-xs sm:text-sm">
                                  Reason
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredReturns.map((item, index) => (
                                <tr
                                  key={`${item.id}-${index}`}
                                  className="border-b hover:bg-muted/30"
                                >
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                      <span className="whitespace-nowrap">
                                        {formatDate(item.date)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium">
                                    {item.clientName}
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] sm:text-xs"
                                    >
                                      {item.billNumber}
                                    </Badge>
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-right whitespace-nowrap">
                                    {item.quantity} {item.unit}
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm">
                                    <Badge
                                      variant={
                                        item.condition === "good"
                                          ? "default"
                                          : "destructive"
                                      }
                                      className="text-[10px] sm:text-xs bg-emerald-600"
                                    >
                                      {item.condition === "good"
                                        ? "Good - Back to Inventory"
                                        : "Bad - Deadstock"}
                                    </Badge>
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-muted-foreground">
                                    {item.returnReason || "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {filteredReturns.length > 0 && (
                        <Card className="border mt-3">
                          <CardHeader className="px-3 pt-3 pb-2">
                            <CardTitle className="text-xs sm:text-sm">
                              Return Summary
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="px-3 pb-3">
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <p className="text-[10px] text-muted-foreground">
                                  Total
                                </p>
                                <p className="text-sm font-semibold text-orange-600">
                                  {filteredReturns.reduce(
                                    (sum, r) => sum + r.quantity,
                                    0,
                                  )}{" "}
                                  {product.unit}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">
                                  Good
                                </p>
                                <p className="text-sm font-semibold text-emerald-600">
                                  {filteredReturns
                                    .filter((r) => r.condition === "good")
                                    .reduce(
                                      (sum, r) => sum + r.quantity,
                                      0,
                                    )}{" "}
                                  {product.unit}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">
                                  Bad
                                </p>
                                <p className="text-sm font-semibold text-red-600">
                                  {filteredReturns
                                    .filter((r) => r.condition === "bad")
                                    .reduce(
                                      (sum, r) => sum + r.quantity,
                                      0,
                                    )}{" "}
                                  {product.unit}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
