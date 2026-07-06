import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getBills,
  getExpenses,
  getProducts,
  getExpos,
  saveExpo,
  transferStockToExpo,
  endExpoAndReturnStock,
  getInventoryUnits,
} from "@/lib/storage";
import { Bill, Expense, Product, Expo, InventoryUnit } from "@/types";
import { formatCurrency, formatDate } from "@/lib/billUtils";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Package,
  Download,
  ArrowLeft,
  Loader2,
  Plus,
  Send,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export default function ExpoDashboard() {
  const { expoId } = useParams<{ expoId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [expo, setExpo] = useState<Expo | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<InventoryUnit[]>([]);

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferData, setTransferData] = useState({
    productId: "",
    quantity: 0,
  });

  const loadData = async () => {
    if (!expoId) return;
    setLoading(true);
    try {
      const [allExpos, allBills, allExpenses, allProducts, allUnits] = await Promise.all([
        getExpos(),
        getBills(),
        getExpenses(),
        getProducts(),
        getInventoryUnits(),
      ]);

      const currentExpo = allExpos.find(e => e.id === expoId);
      if (currentExpo) {
        setExpo(currentExpo);
        setBills(allBills.filter(b => b.expoId === expoId));
        setExpenses(allExpenses.filter(e => e.expoId === expoId));
        setProducts(allProducts);
        setInventoryUnits(allUnits);
      }
    } catch (error) {
      toast.error("Failed to load expo data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [expoId]);

  const handleTransferStock = async () => {
    if (!expoId || !transferData.productId || transferData.quantity <= 0) {
      toast.error("Please select a product and valid quantity");
      return;
    }

    try {
      await transferStockToExpo(expoId, transferData.productId, transferData.quantity);
      toast.success("Stock transferred successfully");
      setIsTransferOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to transfer stock");
    }
  };

  const handleEndExpo = async () => {
    if (!expoId) return;
    if (!confirm("Are you sure you want to end this expo? Remaining stock will be returned to main inventory.")) return;

    try {
      await endExpoAndReturnStock(expoId);
      toast.success("Expo ended and stock returned");
      loadData();
    } catch (error) {
      toast.error("Failed to end expo");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!expo) return <div>Expo not found</div>;

  const totalSales = bills.reduce((sum, b) => sum + b.total, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCollected = bills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
  const receivable = totalSales - totalCollected;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-primary" />
              {expo.name}
            </h1>
            <p className="text-muted-foreground">
              Status: <Badge variant={expo.status === "active" ? "default" : "secondary"}>{expo.status}</Badge>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {expo.status === "active" && (
            <>
              <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Stock
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Transfer Stock to Expo</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <select 
                        className="w-full p-2 border rounded"
                        value={transferData.productId}
                        onChange={(e) => setTransferData({ ...transferData, productId: e.target.value })}
                      >
                        <option value="">Select Product</option>
                        {products.map(p => {
                          const inStockCount = inventoryUnits.filter(u =>
                            u.productId === p.id &&
                            (u.status === "in_stock" || u.status === "reserved" || u.status === "returned")
                          ).length;
                          const available = (p.trackingType || "standard") === "serialized"
                            ? inStockCount
                            : Math.max(0, p.stock || 0);
                          return (
                            <option key={p.id} value={p.id}>{p.name} (Available: {available})</option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input 
                        type="number" 
                        value={transferData.quantity}
                        onChange={(e) => setTransferData({ ...transferData, quantity: Number(e.target.value) })}
                      />
                    </div>
                    <Button onClick={handleTransferStock} className="w-full">Transfer</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="destructive" onClick={handleEndExpo} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                End Expo
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalSales)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalCollected)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Receivable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(receivable)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stock Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Initial</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.keys(expo.initialStocks || {}).map((pid) => {
                  const product = products.find(p => p.id === pid);
                  return (
                    <TableRow key={pid}>
                      <TableCell>{product?.name || pid}</TableCell>
                      <TableCell className="text-right">{expo.initialStocks[pid]}</TableCell>
                      <TableCell className="text-right">{expo.soldStocks?.[pid] || 0}</TableCell>
                      <TableCell className="text-right font-bold">{expo.remainingStocks?.[pid] || 0}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell>{bill.billNumber}</TableCell>
                    <TableCell>{bill.client?.name ?? ""}</TableCell>
                    <TableCell className="text-right">{formatCurrency(bill.total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(bill.paidAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
