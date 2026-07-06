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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Product, Bill, PurchaseBill, BillReturn, InventoryUnit } from "@/types";
import {
  getBills,
  getPurchaseBills,
  getBillReturns,
  getPurchaseReturns,
  getProductTransactions,
  getInventoryUnits,
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
  ArrowLeft,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

interface ProductHistoryScreenProps {
  product: Product;
  onBack: () => void;
}

interface PurchaseHistoryItem {
  id: string;
  date: string;
  vendorName: string;
  inventoryUnitId?: string;
  itemNo?: string;
  model?: string;
  imeiNumber?: string;
  storage?: string;
  color?: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  totalAmount: number;
  billNumber?: string;
  addedToInventory?: boolean;
  isReturn?: boolean;
  currentStatus?: InventoryUnit["status"];
}

interface SalesHistoryItem {
  id: string;
  date: string;
  clientName: string;
  inventoryUnitId?: string;
  itemNo?: string;
  model?: string;
  imeiNumber?: string;
  storage?: string;
  color?: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  totalAmount: number;
  billNumber: string;
}

interface ReturnHistoryItem {
  id: string;
  date: string;
  clientName: string;
  inventoryUnitId?: string;
  itemNo?: string;
  model?: string;
  imeiNumber?: string;
  storage?: string;
  color?: string;
  quantity: number;
  unit: string;
  condition: "good" | "bad";
  returnReason?: string;
  billNumber: string;
  returnId: string;
}

export function ProductHistoryScreen({
  product,
  onBack,
}: ProductHistoryScreenProps) {
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryItem[]>(
    [],
  );
  const [salesHistory, setSalesHistory] = useState<SalesHistoryItem[]>([]);
  const [returnHistory, setReturnHistory] = useState<ReturnHistoryItem[]>([]);
  const [inventoryUnitsForProduct, setInventoryUnitsForProduct] = useState<
    InventoryUnit[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusSort, setStatusSort] = useState<"none" | "asc" | "desc">("none");

  useEffect(() => {
    if (product) {
      loadHistory();
    }
  }, [product]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const [
        bills,
        purchaseBills,
        billReturns,
        purchaseReturns,
        transactions,
        inventoryUnits,
      ] =
        await Promise.all([
          getBills(),
          getPurchaseBills(),
          getBillReturns(),
          getPurchaseReturns(),
          getProductTransactions(product.id),
          getInventoryUnits(),
        ]);

      const normalizeImei = (value?: string) =>
        (value || "").toString().replace(/\s+/g, "").toLowerCase();
      const productUnits = inventoryUnits.filter((u) => u.productId === product.id);
      setInventoryUnitsForProduct(productUnits);
      const unitStatusById = new Map(
        productUnits.map((u) => [u.id, u.status] as const),
      );
      const unitStatusByImei = new Map(
        productUnits
          .map((u) => [
            normalizeImei(u.imeiNumber || u.serialNumber),
            u.status,
          ] as const)
          .filter(([key]) => Boolean(key)),
      );
      const unitPurchasePriceByImei = new Map(
        productUnits
          .map((u) => [
            normalizeImei(u.imeiNumber || u.serialNumber),
            Number(u.purchasePrice || 0),
          ] as const)
          .filter(([key, price]) => Boolean(key) && Number(price) > 0),
      );
      const unitSellingPriceByImei = new Map(
        productUnits
          .map((u) => [
            normalizeImei(u.imeiNumber || u.serialNumber),
            Number(u.sellingPrice || 0),
          ] as const)
          .filter(([key, price]) => Boolean(key) && Number(price) > 0),
      );

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
            const normalizedTxnImei = normalizeImei(
              transaction.imeiNumber || product.imeiNumber || "",
            );
            purchases.push({
              id: transaction.id,
              date: transaction.date,
              vendorName: bill.vendorName,
              inventoryUnitId: transaction.inventoryUnitId,
              itemNo: transaction.itemNo || product.itemNo || "",
              model: transaction.model || product.model || "",
              imeiNumber: transaction.imeiNumber || product.imeiNumber || "",
              storage: transaction.storage || product.storage || "",
              color: transaction.color || product.color || "",
              quantity: transaction.quantity,
              unit: product.unit,
              purchasePrice: transaction.purchasePrice,
              sellingPrice:
                Number(transaction.sellingPrice || 0) ||
                Number(unitSellingPriceByImei.get(normalizedTxnImei) || 0) ||
                Number(product.sellingPrice || product.price || 0),
              totalAmount: transaction.quantity * transaction.purchasePrice,
              billNumber: bill.billNumber,
              addedToInventory: bill.itemsAddedToInventory || false,
              currentStatus:
                unitStatusById.get(transaction.inventoryUnitId || "") ||
                unitStatusByImei.get(normalizeImei(transaction.imeiNumber)),
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
          const normalizedTxnImei = normalizeImei(
            transaction.imeiNumber || product.imeiNumber || "",
          );
          purchases.push({
            id: transaction.id,
            date: transaction.date,
            vendorName: "Manual Addition",
            inventoryUnitId: transaction.inventoryUnitId,
            itemNo: transaction.itemNo || product.itemNo || "",
            model: transaction.model || product.model || "",
            imeiNumber: transaction.imeiNumber || product.imeiNumber || "",
            storage: transaction.storage || product.storage || "",
            color: transaction.color || product.color || "",
            quantity: transaction.quantity,
            unit: product.unit,
            purchasePrice: transaction.purchasePrice,
            sellingPrice:
              Number(transaction.sellingPrice || 0) ||
              Number(unitSellingPriceByImei.get(normalizedTxnImei) || 0) ||
              Number(product.sellingPrice || product.price || 0),
            totalAmount: transaction.quantity * transaction.purchasePrice,
            billNumber: undefined,
            addedToInventory: true,
            currentStatus:
              unitStatusById.get(transaction.inventoryUnitId || "") ||
              unitStatusByImei.get(normalizeImei(transaction.imeiNumber)),
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
                inventoryUnitId: (item as any).inventoryUnitId,
                itemNo: (item as any).itemNo || product.itemNo || "",
                model: (item as any).model || product.model || "",
                imeiNumber: (item as any).imeiNumber || product.imeiNumber || "",
                storage: (item as any).storage || product.storage || "",
                color: (item as any).color || product.color || "",
                quantity: item.quantity,
                unit: item.unit,
                purchasePrice: item.rate,
                sellingPrice:
                  Number((item as any).sellingPrice || 0) ||
                  Number(product.sellingPrice || product.price || 0),
                totalAmount: item.amount,
                billNumber: bill.billNumber,
                addedToInventory: bill.itemsAddedToInventory || false,
                currentStatus:
                  unitStatusById.get((item as any).inventoryUnitId || "") ||
                  unitStatusByImei.get(normalizeImei((item as any).imeiNumber)),
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
            const normalizedItemImei = normalizeImei(
              item.imeiNumber || product.imeiNumber || "",
            );
            const resolvedPurchasePrice =
              Number((item as any).purchasePrice || 0) ||
              Number(unitPurchasePriceByImei.get(normalizedItemImei) || 0) ||
              Number(product.purchasePrice || 0);
            sales.push({
              id: bill.id,
              date: bill.date,
              clientName: bill.client?.name ?? "",
              inventoryUnitId: item.inventoryUnitId,
              itemNo: item.itemNo || product.itemNo || "",
              model: item.model || product.model || "",
              imeiNumber: item.imeiNumber || product.imeiNumber || "",
              storage: item.storage || product.storage || "",
              color: item.color || product.color || "",
              quantity: item.quantity,
              unit: item.unit,
              purchasePrice: resolvedPurchasePrice,
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
          const isMatch =
            itemProductId === currentProductId && itemProductId !== "";

          if (isMatch) {
            const returnItem: ReturnHistoryItem = {
              id: `${billReturn.id}-${item.productId}`,
              date: billReturn.returnDate || billReturn.createdAt,
              clientName: billReturn.clientName,
              inventoryUnitId: item.inventoryUnitId,
              itemNo: item.itemNo || product.itemNo || "",
              model: item.model || product.model || "",
              imeiNumber: item.imeiNumber || product.imeiNumber || "",
              storage: item.storage || product.storage || "",
              color: item.color || product.color || "",
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
          const isMatch =
            item.description.toLowerCase().trim() ===
            product.name.toLowerCase().trim();

          if (isMatch) {
            purchases.push({
              id: `p-return-${pReturn.id}-${item.description}`,
              date: pReturn.returnDate || pReturn.createdAt,
              vendorName: `Purchase Return: ${pReturn.vendorName}`,
              quantity: -item.quantity, // Negative quantity for return
              unit: (item as any).unit || product.unit,
              purchasePrice: item.rate,
              sellingPrice:
                Number((item as any).sellingPrice || 0) ||
                Number(product.sellingPrice || product.price || 0),
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
    const normalizeLookupValue = (value?: string) =>
      (value || "").toString().replace(/\s+/g, "").trim().toLowerCase();
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
    const totalSalesCostValue = salesHistory.reduce(
      (sum, item) => sum + item.quantity * Number(item.purchasePrice || 0),
      0,
    );

    const unmatchedSales = [...salesHistory]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((sale) => ({
        ...sale,
        remainingQuantity: Number(sale.quantity || 0),
      }));

    let totalReturnedSalesValue = 0;
    let totalReturnedCostValue = 0;

    returnHistory.forEach((returnItem) => {
      let remainingReturnQty = Number(returnItem.quantity || 0);
      if (remainingReturnQty <= 0) {
        return;
      }

      const saleMatch = unmatchedSales.find((sale) => {
        if (sale.remainingQuantity <= 0) return false;
        if (
          returnItem.inventoryUnitId &&
          sale.inventoryUnitId &&
          returnItem.inventoryUnitId === sale.inventoryUnitId
        ) {
          return true;
        }
        if (
          normalizeLookupValue(returnItem.imeiNumber) &&
          normalizeLookupValue(sale.imeiNumber) ===
            normalizeLookupValue(returnItem.imeiNumber)
        ) {
          return true;
        }
        return (
          normalizeLookupValue(sale.model) === normalizeLookupValue(returnItem.model) &&
          normalizeLookupValue(sale.storage) === normalizeLookupValue(returnItem.storage) &&
          normalizeLookupValue(sale.color) === normalizeLookupValue(returnItem.color)
        );
      });

      if (!saleMatch) {
        return;
      }

      const matchedQty = Math.min(remainingReturnQty, saleMatch.remainingQuantity);
      saleMatch.remainingQuantity -= matchedQty;
      totalReturnedSalesValue += matchedQty * Number(saleMatch.sellingPrice || 0);
      totalReturnedCostValue += matchedQty * Number(saleMatch.purchasePrice || 0);
      remainingReturnQty -= matchedQty;
    });

    // Overall weighted average purchase price
    const overallAvgPurchasePrice =
      totalPurchased > 0
        ? totalPurchaseValue / totalPurchased
        : product.purchasePrice || 0;

    const netSalesValue = Math.max(0, totalSalesValue - totalReturnedSalesValue);
    const netCostOfGoodsSold = Math.max(
      0,
      totalSalesCostValue - totalReturnedCostValue,
    );

    // Weighted average selling price after returns
    const averageSellingPrice =
      totalSold - totalReturned > 0
        ? netSalesValue / (totalSold - totalReturned)
        : product.sellingPrice || product.price || 0;

    const netSold = Math.max(0, totalSold - totalReturned);
    const costOfGoodsSold =
      netSold > 0
        ? netCostOfGoodsSold
        : 0;

    const isSerializedProduct = (product.trackingType || "standard") === "serialized";
    const inStockUnits = inventoryUnitsForProduct.filter(
      (unit) => unit.status === "in_stock",
    );
    const inStockQty = Number(product.stock || 0);
    const fallbackAvgCost =
      overallAvgPurchasePrice > 0
        ? overallAvgPurchasePrice
        : Number(product.purchasePrice || 0);

    const serializedUnitValue = inStockUnits.reduce(
      (sum, unit) => sum + Number(unit.purchasePrice ?? fallbackAvgCost),
      0,
    );
    const missingSerializedUnits = Math.max(0, inStockQty - inStockUnits.length);

    // Remaining inventory value should follow current stock, regardless of payment status
    const totalAssets = isSerializedProduct
      ? serializedUnitValue + missingSerializedUnits * fallbackAvgCost
      : inStockQty * fallbackAvgCost;

    // Average buy price of current remaining stock
    const averagePurchasePrice = isSerializedProduct
      ? inStockQty > 0
        ? totalAssets / inStockQty
        : fallbackAvgCost
      : inStockQty > 0
        ? totalAssets / inStockQty
        : fallbackAvgCost;

    // Profit calculations
    const totalProfit = netSalesValue - costOfGoodsSold;
    const profitMargin =
      averageSellingPrice > 0 && netSold > 0 && costOfGoodsSold > 0
        ? ((averageSellingPrice - costOfGoodsSold / netSold) /
          (costOfGoodsSold / netSold)) *
        100
        : 0;

    // Additional details: Total weight in stock
    const totalStockWeight = inStockQty * (Number(product.weight) || 0);

    const currentStock = isSerializedProduct
      ? Math.max(inStockQty, inStockUnits.length)
      : inStockQty;

    return {
      currentStock,
      totalPurchased,
      totalSold,
      totalReturned,
      totalReturnedGood,
      totalReturnedBad,
      netSold,
      totalPurchaseValue,
      totalSalesValue: netSalesValue,
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

  const getPurchaseStatusKey = (item: PurchaseHistoryItem) => {
    return item.currentStatus === "sold" ? "sold" : "in_stock";
  };

  const getPurchaseStatusLabel = (item: PurchaseHistoryItem) =>
    getPurchaseStatusKey(item) === "sold" ? "Sold" : "In Stock";

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

  const formatCurrencyRs = (amount: number) => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absAmount);
    return isNegative ? `-Rs. ${formatted}` : `Rs. ${formatted}`;
  };

  const filteredPurchases = purchaseHistory
    .filter((item) => {
      const searchStr = searchTerm.toLowerCase();
      const vendorMatch = (item.vendorName || "")
        .toLowerCase()
        .includes(searchStr);
      const billMatch = (item.billNumber || "").toLowerCase().includes(searchStr);
      const deviceMatch =
        (item.itemNo || "").toLowerCase().includes(searchStr) ||
        (item.model || "").toLowerCase().includes(searchStr) ||
        (item.imeiNumber || "").toLowerCase().includes(searchStr) ||
        (item.storage || "").toLowerCase().includes(searchStr) ||
        (item.color || "").toLowerCase().includes(searchStr);

      const matchesSearch = vendorMatch || billMatch || deviceMatch;

      const itemDate = new Date(item.date);
      const matchesStartDate = !startDate || itemDate >= new Date(startDate);
      const matchesEndDate = !endDate || itemDate <= new Date(endDate);
      const matchesStatus =
        statusFilter === "all" || getPurchaseStatusKey(item) === statusFilter;
      return matchesSearch && matchesStartDate && matchesEndDate && matchesStatus;
    })
    .sort((a, b) => {
      if (statusSort === "none") return 0;
      const aStatus = getPurchaseStatusKey(a);
      const bStatus = getPurchaseStatusKey(b);
      return statusSort === "asc"
        ? aStatus.localeCompare(bStatus)
        : bStatus.localeCompare(aStatus);
    });

  const filteredSales = salesHistory.filter((item) => {
    const searchStr = searchTerm.toLowerCase();
    const clientMatch = (item.clientName || "")
      .toLowerCase()
      .includes(searchStr);
    const billMatch = (item.billNumber || "").toLowerCase().includes(searchStr);
    const deviceMatch =
      (item.itemNo || "").toLowerCase().includes(searchStr) ||
      (item.model || "").toLowerCase().includes(searchStr) ||
      (item.imeiNumber || "").toLowerCase().includes(searchStr) ||
      (item.storage || "").toLowerCase().includes(searchStr) ||
      (item.color || "").toLowerCase().includes(searchStr);

    const matchesSearch = clientMatch || billMatch || deviceMatch;

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
    const deviceMatch =
      (item.itemNo || "").toLowerCase().includes(searchStr) ||
      (item.model || "").toLowerCase().includes(searchStr) ||
      (item.imeiNumber || "").toLowerCase().includes(searchStr) ||
      (item.storage || "").toLowerCase().includes(searchStr) ||
      (item.color || "").toLowerCase().includes(searchStr);

    const matchesSearch = clientMatch || billMatch || reasonMatch || deviceMatch;

    const itemDate = new Date(item.date);
    const matchesStartDate = !startDate || itemDate >= new Date(startDate);
    const matchesEndDate = !endDate || itemDate <= new Date(endDate);
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  const sanitizeFileName = (value: string) =>
    value.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_");

  const downloadLedgerExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();

      const summaryData = [
        ["Product Full Ledger"],
        ["Product Name", product.name],
        ["Unit", product.unit || "-"],
        ["Color", product.color || "-"],
        ["Storage", product.storage || "-"],
        ["Generated On", formatDate(new Date().toISOString())],
        ["Date Filter From", startDate || "All"],
        ["Date Filter To", endDate || "All"],
        [],
        ["Metric", "Value"],
        ["Current Stock", `${Number(stats.currentStock).toFixed(2)} ${product.unit || ""}`],
        ["Total Purchased", Number(stats.totalPurchased).toFixed(2)],
        ["Total Sold", Number(stats.totalSold).toFixed(2)],
        ["Total Returned", Number(stats.totalReturned).toFixed(2)],
        ["Assets Value", formatCurrencyRs(stats.totalAssets)],
        ["Average Buy Price", formatCurrencyRs(stats.averagePurchasePrice)],
        ["Average Sell Price", formatCurrencyRs(stats.averageSellingPrice)],
        ["Profit Margin", `${stats.profitMargin.toFixed(2)}%`],
      ];

      const purchasesData = [
        ["Date", "Vendor", "Bill No", "IMEI", "Color", "Storage", "Unit", "Price/Unit", "Total", "Status"],
        ...filteredPurchases.map((item) => [
          formatDate(item.date),
          item.vendorName || "-",
          item.billNumber || "-",
          item.imeiNumber || "-",
          item.color || "-",
          item.storage || "-",
          item.unit || "-",
          item.purchasePrice,
          item.totalAmount,
          getPurchaseStatusLabel(item),
        ]),
      ];

      const salesData = [
        ["Date", "Client", "Bill No", "IMEI", "Color", "Storage", "Unit", "Price/Unit", "Total"],
        ...filteredSales.map((item) => [
          formatDate(item.date),
          item.clientName || "-",
          item.billNumber || "-",
          item.imeiNumber || "-",
          item.color || "-",
          item.storage || "-",
          item.unit || "-",
          item.sellingPrice,
          item.totalAmount,
        ]),
      ];

      const returnsData = [
        ["Date", "Client", "Bill No", "IMEI", "Color", "Storage", "Unit", "Condition", "Reason"],
        ...filteredReturns.map((item) => [
          formatDate(item.date),
          item.clientName || "-",
          item.billNumber || "-",
          item.imeiNumber || "-",
          item.color || "-",
          item.storage || "-",
          item.unit || "-",
          item.condition === "good" ? "Good - Back to Inventory" : "Bad - Deadstock",
          item.returnReason || "-",
        ]),
      ];

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryData), "Summary");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(purchasesData), "Purchases");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(salesData), "Sales");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(returnsData), "Returns");

      XLSX.writeFile(
        workbook,
        `${sanitizeFileName(product.name || "Product")}_Full_Ledger.xlsx`,
      );
      toast.success("Product ledger Excel downloaded");
    } catch (error) {
      console.error("Excel ledger download error:", error);
      toast.error("Failed to download Excel ledger");
    }
  };

  const downloadLedgerPDF = () => {
    try {
      const doc = new jsPDF("p", "mm", "a4");

      doc.setFontSize(18);
      doc.setTextColor(20);
      doc.text("PRODUCT FULL LEDGER", 14, 16);

      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text(`Product: ${product.name}`, 14, 23);
      doc.text(`Generated: ${formatDate(new Date().toISOString())}`, 14, 28);
      doc.text(`Filters: ${startDate || "All"} to ${endDate || "All"}`, 14, 38);

      autoTable(doc, {
        startY: 42,
        head: [["Summary", "Value"]],
        body: [
          ["Current Stock", `${Number(product.stock).toFixed(2)} ${product.unit || ""}`],
          ["Total Purchased", Number(stats.totalPurchased).toFixed(2)],
          ["Total Sold", Number(stats.totalSold).toFixed(2)],
          ["Total Returned", Number(stats.totalReturned).toFixed(2)],
          ["Assets Value", formatCurrencyRs(stats.totalAssets)],
          ["Average Buy Price", formatCurrencyRs(stats.averagePurchasePrice)],
          ["Average Sell Price", formatCurrencyRs(stats.averageSellingPrice)],
          ["Profit Margin", `${stats.profitMargin.toFixed(2)}%`],
        ],
        theme: "grid",
        headStyles: { fillColor: [55, 65, 81] },
        styles: { fontSize: 9 },
      });

      let nextY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 95;

      autoTable(doc, {
        startY: nextY,
        head: [["Purchase Transactions", "", "", "", "", "", "", "", "", ""]],
        body: [
          ["Date", "Vendor", "Bill No", "IMEI", "Color", "Storage", "Unit", "Price/Unit", "Total", "Status"],
          ...filteredPurchases.map((item) => [
            formatDate(item.date),
            item.vendorName || "-",
            item.billNumber || "-",
            item.imeiNumber || "-",
            item.color || "-",
            item.storage || "-",
            item.unit || "-",
            formatCurrencyRs(item.purchasePrice),
            formatCurrencyRs(item.totalAmount),
            getPurchaseStatusLabel(item),
          ]),
        ],
        theme: "grid",
        headStyles: { fillColor: [15, 118, 110] },
        styles: { fontSize: 8 },
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === 0) {
            data.cell.styles.fillColor = [224, 242, 254];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.halign = "center";
          }
        },
      });

      nextY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : nextY + 60;

      autoTable(doc, {
        startY: nextY,
        head: [["Sales Transactions", "", "", "", "", "", "", "", ""]],
        body: [
          ["Date", "Client", "Bill No", "IMEI", "Color", "Storage", "Unit", "Price/Unit", "Total"],
          ...filteredSales.map((item) => [
            formatDate(item.date),
            item.clientName || "-",
            item.billNumber || "-",
            item.imeiNumber || "-",
            item.color || "-",
            item.storage || "-",
            item.unit || "-",
            formatCurrencyRs(item.sellingPrice),
            formatCurrencyRs(item.totalAmount),
          ]),
        ],
        theme: "grid",
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 8 },
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === 0) {
            data.cell.styles.fillColor = [224, 242, 254];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.halign = "center";
          }
        },
      });

      nextY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : nextY + 50;

      autoTable(doc, {
        startY: nextY,
        head: [["Return Transactions", "", "", "", "", "", "", "", ""]],
        body: [
          ["Date", "Client", "Bill No", "IMEI", "Color", "Storage", "Unit", "Condition", "Reason"],
          ...filteredReturns.map((item) => [
            formatDate(item.date),
            item.clientName || "-",
            item.billNumber || "-",
            item.imeiNumber || "-",
            item.color || "-",
            item.storage || "-",
            item.unit || "-",
            item.condition === "good" ? "Good - Back to Inventory" : "Bad - Deadstock",
            item.returnReason || "-",
          ]),
        ],
        theme: "grid",
        headStyles: { fillColor: [217, 119, 6] },
        styles: { fontSize: 8 },
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === 0) {
            data.cell.styles.fillColor = [255, 237, 213];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.halign = "center";
          }
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 260;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("All currency values are shown in Rs.", 14, finalY + 8);

      doc.save(`${sanitizeFileName(product.name || "Product")}_Full_Ledger.pdf`);
      toast.success("Product ledger PDF downloaded");
    } catch (error) {
      console.error("PDF ledger download error:", error);
      toast.error("Failed to download PDF ledger");
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
      <div className="relative flex h-full min-h-0 flex-col rounded-[28px] border border-border/70 bg-background p-3 shadow-sm sm:p-5 lg:p-6">
        <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-slate-50/40 p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={onBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
                <Package className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">
                  {product.name}
                </h2>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Product Full Ledger
                </p>
                {/* <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-primary/10 px-2 py-0 text-[10px] font-semibold leading-5 text-primary">
                    
                  </span>
                  <span className="rounded-md bg-muted px-2 py-0 text-[10px] font-semibold leading-5 text-muted-foreground">
                    
                  </span>
                </div> */}
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 rounded-xl border border-border/70 bg-muted/30 p-2 lg:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-xl px-4 text-sm"
                onClick={downloadLedgerExcel}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-xl px-4 text-sm"
                onClick={downloadLedgerPDF}
              >
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex-1 min-h-0 rounded-2xl border border-border/70 bg-background/60 p-2 sm:p-3">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading history...
            </div>
          ) : (
            <div className="h-full overflow-y-auto space-y-4 px-1 pb-1 pr-1 sm:px-2 sm:pr-2">
              <div className="space-y-4 py-2">
                {/* Product Info & Summary */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Card className="border-border/70 bg-gradient-to-r from-background to-primary/5 md:col-span-2">
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center gap-2 pt-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Info className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Product Profile
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-border/70 bg-background/80 p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            Unit
                          </p>
                          <p className="mt-1 text-sm font-semibold uppercase">
                            {product.unit || "-"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-background/80 p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            Source
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold">
                            {product.whereToBuy || "Direct"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
                    <CardContent className="p-3 flex flex-col justify-center h-full">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">
                        Current Stock
                      </p>
                      <div className="text-2xl font-black text-primary">
                        {Number(stats.currentStock).toFixed(2)}{" "}
                        <span className="text-xs font-normal uppercase">
                          {product.unit}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Total Weight:{" "}
                        {stats.totalStockWeight
                          ? stats.totalStockWeight.toFixed(2)
                          : "0"}{" "}
                        {product.weightUnit || ""}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Card className="border-emerald-200 bg-emerald-50/70">
                    <CardContent className="p-3 m-2 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">
                        Assets Value
                      </p>
                      <p className="text-lg font-bold text-emerald-600">
                        {formatCurrency(stats.totalAssets)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-200 bg-slate-50/70">
                    <CardContent className="p-3 m-2 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">
                        Avg Buy Price
                      </p>
                      <p className="text-lg font-bold">
                        {formatCurrency(stats.averagePurchasePrice)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-blue-200 bg-blue-50/70">
                    <CardContent className="p-3 m-2 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">
                        Avg Sell Price
                      </p>
                      <p className="text-lg font-bold text-blue-600">
                        {formatCurrency(stats.averageSellingPrice)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-orange-200 bg-orange-50/70">
                    <CardContent className="p-3 m-2 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">
                        Profit Margin
                      </p>
                      <p
                        className={`text-lg font-bold ${stats.profitMargin > 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {stats.profitMargin.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Business Analytics Mini */}
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 md:grid-cols-4">
                  <div className="rounded-lg border border-border/60 bg-background/80 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">
                      Total Bought
                    </p>
                    <p className="text-sm font-semibold">
                      {Number(stats.totalPurchased).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">
                      Total Sold
                    </p>
                    <p className="text-sm font-semibold">
                      {Number(stats.totalSold).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">
                      Returns
                    </p>
                    <p className="text-sm font-semibold text-orange-600">
                      {Number(stats.totalReturned).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">
                      Turnover
                    </p>
                    <p className="text-sm font-semibold">
                      {stats.totalPurchased > 0
                        ? (
                          (stats.totalSold / stats.totalPurchased) *
                          100
                        ).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>
                </div>

                {/* Filters Area */}
                <div className="rounded-xl border border-border/70 bg-background/80 p-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by vendor, client, bill no..."
                      className="h-9 pl-9 text-xs sm:text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="mt-2 overflow-x-auto pb-1">
                    <div className="flex min-w-max items-center gap-2">
                      <Input
                        type="date"
                        className="h-8 w-[145px] text-xs sm:h-9 sm:text-sm"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                      <span className="text-[11px] text-muted-foreground sm:text-xs">
                        to
                      </span>
                      <Input
                        type="date"
                        className="h-8 w-[145px] text-xs sm:h-9 sm:text-sm"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="h-8 w-[170px] rounded-md border border-input bg-background px-2 text-xs sm:h-9 sm:text-sm"
                      >
                        <option value="all">All Status</option>
                        <option value="in_stock">In Stock</option>
                        <option value="sold">Sold</option>
                      </select>
                      <select
                        value={statusSort}
                        onChange={(e) =>
                          setStatusSort(
                            e.target.value as "none" | "asc" | "desc",
                          )
                        }
                        className="h-8 w-[170px] rounded-md border border-input bg-background px-2 text-xs sm:h-9 sm:text-sm"
                      >
                        <option value="none">Sort: Default</option>
                        <option value="asc">Sort: Status A-Z</option>
                        <option value="desc">Sort: Status Z-A</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* History Tabs */}
                <Tabs defaultValue="purchases" className="w-full">
                  <div className="overflow-x-auto scrollbar-hide pb-1">
                    <TabsList className="inline-flex h-10 w-full min-w-fit rounded-lg border border-border/70 bg-muted/40 p-1">
                      <TabsTrigger
                        value="purchases"
                        className="min-w-[150px] flex-1 rounded-md px-4 py-2 text-xs data-[state=active]:bg-background"
                      >
                        Purchase Transaction ({filteredPurchases.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="sales"
                        className="min-w-[100px] flex-1 rounded-md px-4 py-2 text-xs data-[state=active]:bg-background"
                      >
                        Sales ({filteredSales.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="returns"
                        className="min-w-[100px] flex-1 rounded-md px-4 py-2 text-xs data-[state=active]:bg-background"
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
                      <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
                        <div className="overflow-x-auto">
                          <table
                            className="w-full border-collapse"
                            style={{ minWidth: "820px" }}
                          >
                            <thead className="bg-muted/70">
                              <tr>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Date
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Vendor
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Bill No
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  IMEI
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Color
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Storage
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Purchase Price
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Selling Price
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Status
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredPurchases.map((item, index) => (
                                <tr
                                  key={`${item.id}-${index}`}
                                  className={`border-b hover:bg-muted/30 ${item.quantity < 0 ? "bg-red-50/30" : ""
                                    }`}
                                >
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center">
                                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                      <span className="whitespace-nowrap">
                                        {formatDate(item.date)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium text-center">
                                    <div className="flex flex-col items-center">
                                      <span>{item.vendorName}</span>
                                      {item.quantity < 0 && (
                                        <span className="text-[10px] text-red-500 font-normal">
                                          Purchase Return
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center">
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
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center whitespace-nowrap">
                                    {item.imeiNumber || "-"}
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center whitespace-nowrap">
                                    {item.color}
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center whitespace-nowrap">
                                    {item.storage}
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center whitespace-nowrap">
                                    {formatCurrency(item.purchasePrice)}
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center whitespace-nowrap text-emerald-600">
                                    {formatCurrency(item.sellingPrice)}
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center">
                                    <Badge
                                      variant={
                                        getPurchaseStatusKey(item) === "sold"
                                          ? "secondary"
                                          : "default"
                                      }
                                      className={`text-[10px] sm:text-xs ${
                                        getPurchaseStatusKey(item) === "sold"
                                          ? "bg-blue-100 text-blue-700 border-blue-200"
                                          : "bg-emerald-600"
                                      }`}
                                    >
                                      {getPurchaseStatusLabel(item)}
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
                      <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
                        <div className="overflow-x-auto">
                          <table
                            className="w-full border-collapse"
                            style={{ minWidth: "760px" }}
                          >
                            <thead className="bg-muted/70">
                              <tr>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Date
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Client
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Bill No
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Device
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Qty
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Purchase Price
                                </th>
                                <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                  Selling Price
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredSales.map((item, index) => (
                                <tr
                                  key={`${item.id}-${index}`}
                                  className="border-b hover:bg-muted/30"
                                >
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center">
                                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                      <span className="whitespace-nowrap">
                                        {formatDate(item.date)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium text-center">
                                    {item.clientName}
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] sm:text-xs"
                                    >
                                      {item.billNumber}
                                    </Badge>
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center">
                                    <div className="flex flex-col items-center">
                                      <span className="font-medium">
                                        {item.model || "-"}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {item.imeiNumber || "-"}
                                      </span>
                                      {(item.storage || item.color) && (
                                        <span className="text-muted-foreground">
                                          {item.storage || "-"}
                                          {item.color ? ` / ${item.color}` : ""}
                                        </span>
                                      )}
                                      {(item as any).batteryHealth && (
                                        <span className="text-amber-600 text-[10px]">Batt: {(item as any).batteryHealth}</span>
                                      )}
                                      {(item as any).warranty && (
                                        <span className="text-blue-600 text-[10px]">Warranty: {(item as any).warranty}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center whitespace-nowrap">
                                    {item.quantity} {item.unit}
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center text-slate-700 whitespace-nowrap">
                                    {formatCurrency(item.purchasePrice)}
                                  </td>
                                  <td className="p-3 sm:p-4 text-xs sm:text-sm text-center font-semibold text-emerald-600 whitespace-nowrap">
                                    {formatCurrency(item.sellingPrice)}
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
                        <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
                          <div className="overflow-x-auto">
                            <table
                              className="w-full border-collapse"
                              style={{ minWidth: "640px" }}
                            >
                              <thead className="bg-muted/70">
                                <tr>
                                  <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                    Date
                                  </th>
                                  <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                    Client
                                  </th>
                                  <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                    Bill No
                                  </th>
                                  <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                    Device
                                  </th>
                                  <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
                                    Condition
                                  </th>
                                  <th className="h-10 px-3 sm:px-4 text-center font-medium text-xs sm:text-sm">
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
                                    <td className="p-3 sm:p-4 text-xs sm:text-sm text-center">
                                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                        <span className="whitespace-nowrap">
                                          {formatDate(item.date)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium text-center">
                                      {item.clientName}
                                    </td>
                                    <td className="p-3 sm:p-4 text-xs sm:text-sm text-center">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] sm:text-xs"
                                      >
                                        {item.billNumber}
                                      </Badge>
                                    </td>
                                    <td className="p-3 sm:p-4 text-xs sm:text-sm text-center">
                                      <div className="flex flex-col items-center">
                                        <span className="font-medium tracking-wide">
                                          {item.model || item.itemNo || "-"}
                                        </span>
                                        <span className="text-muted-foreground text-[11px] sm:text-xs">
                                          {item.imeiNumber || "-"}
                                        </span>
                                        {(item.storage || item.color) && (
                                          <span className="text-muted-foreground text-[11px] sm:text-xs">
                                            {item.storage || "-"}
                                            {item.color
                                              ? ` / ${item.color}`
                                              : ""}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3 sm:p-4 text-xs sm:text-sm text-center">
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
                                    <td className="p-3 sm:p-4 text-xs sm:text-sm text-muted-foreground text-center">
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
        </div>
      </div>
    </div>
  );
}
