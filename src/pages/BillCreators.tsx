import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
} from "@/components/ui/alert-dialog";
import {
  getCompanyProfile,
  getBills,
  getSampleBills,
  saveCompanyProfile,
  getCreators,
  saveCreator,
  deleteCreator,
} from "@/lib/storage";
import {
  Bill,
  SampleBill,
  CompanyProfile,
  BillCreator,
  PaymentMethod,
} from "@/types";
import {
  User,
  Receipt,
  ArrowLeft,
  Search,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ArrowUpDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/billUtils";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function BillCreators() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creators, setCreators] = useState<BillCreator[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [creatorBills, setCreatorBills] = useState<(Bill | SampleBill)[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [billSearchTerm, setBillSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "client">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(
    null,
  );

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newCreatorName, setNewCreatorName] = useState("");
  const [newCreatorPassword, setNewCreatorPassword] = useState("");
  const [newCreatorPermissions, setNewCreatorPermissions] = useState<string[]>([
    "/",
    "/bills",
    "/sample-bill",
    "/products",
    "/clients",
    "/notes",
  ]);
  const [newCreatorType, setNewCreatorType] = useState<
    "Creator" | "Employee" | "CA" | "Expo"
  >("Creator");
  const [newExpoId, setNewExpoId] = useState("");
  const [editingCreator, setEditingCreator] = useState<BillCreator | null>(
    null,
  );
  const [editedCreatorName, setEditedCreatorName] = useState("");
  const [editedCreatorPassword, setEditedCreatorPassword] = useState("");
  const [editedCreatorType, setEditedCreatorType] = useState<
    "Creator" | "Employee" | "CA" | "Expo"
  >("Creator");
  const [editedExpoId, setEditedExpoId] = useState("");
  const [editedCreatorPermissions, setEditedCreatorPermissions] = useState<
    string[]
  >([]);
  const [creatorToDelete, setCreatorToDelete] = useState<BillCreator | null>(
    null,
  );
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const [profile, fetchedCreators, regularBills, sampleBills] =
        await Promise.all([
          getCompanyProfile(),
          getCreators(),
          getBills(),
          getSampleBills(),
        ]);

      if (profile) {
        setCompanyProfile(profile);
      }

      // Calculate admin bills count
      const allBills = [...regularBills, ...sampleBills];
      const adminBillsCount = allBills.filter(
        (b) => b.createdBy === "Admin",
      ).length;

      // Filter out 'Admin' from database if it exists (we add it manually for UI)
      const otherCreators = fetchedCreators.filter((c) => c.name !== "Admin");

      // Always include Admin at the top
      const displayCreators: any[] = [
        {
          id: "admin-static",
          name: "Admin",
          isStatic: true,
          billCount: adminBillsCount,
          createdAt: new Date(0).toISOString(),
        },
        ...otherCreators,
      ];

      setCreators(displayCreators);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleAddCreator = async () => {
    if (!newCreatorName.trim()) return;
    if (creators.some((c) => c.name === newCreatorName.trim())) {
      toast({ title: "Creator already exists", variant: "destructive" });
      return;
    }

    const newCreator: BillCreator = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCreatorName.trim(),
      password: newCreatorPassword.trim(),
      type: newCreatorType,
      expoId: newCreatorType === "Expo" ? newExpoId : undefined,
      permissions: newCreatorPermissions,
      createdAt: new Date().toISOString(),
    };

    await saveCreator(newCreator);
    setCreators([...creators, newCreator]);
    setNewCreatorName("");
    setNewCreatorPassword("");
    setNewCreatorPermissions([
      "/",
      "/bills",
      "/sample-bill",
      "/products",
      "/clients",
      "/notes",
    ]);
    setIsAddDialogOpen(false);
    toast({ title: "Creator added successfully" });
  };

  const handleEditCreator = async () => {
    if (!editedCreatorName.trim() || !editingCreator) return;
    if (
      creators.some(
        (c) =>
          c.name === editedCreatorName.trim() && c.id !== editingCreator.id,
      )
    ) {
      toast({ title: "Creator name already exists", variant: "destructive" });
      return;
    }

    const updatedCreator: BillCreator = {
      ...editingCreator,
      name: editedCreatorName.trim(),
      password: editedCreatorPassword.trim(),
      type: editedCreatorType,
      expoId: editedCreatorType === "Expo" ? editedExpoId : undefined,
      permissions: editedCreatorPermissions,
    };

    await saveCreator(updatedCreator);
    setCreators(
      creators.map((c) => (c.id === updatedCreator.id ? updatedCreator : c)),
    );
    setEditingCreator(null);
    setEditedCreatorName("");
    setEditedCreatorPassword("");
    setIsEditDialogOpen(false);
    toast({ title: "Creator updated successfully" });
  };

  const handleDeleteCreator = async () => {
    if (!creatorToDelete) return;
    await deleteCreator(creatorToDelete.id);
    setCreators(creators.filter((c) => c.id !== creatorToDelete.id));
    setCreatorToDelete(null);
    setIsDeleteDialogOpen(false);
    toast({ title: "Creator deleted successfully" });
  };

  const openEditDialog = (creator: BillCreator, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCreator(creator);
    setEditedCreatorName(creator.name);
    setEditedCreatorPassword(creator.password || "");
    setEditedCreatorType(creator.type || "Creator");
    setEditedExpoId(creator.expoId || "");
    setEditedCreatorPermissions(
      creator.permissions || [
        "/",
        "/bills",
        "/sample-bill",
        "/products",
        "/clients",
        "/notes",
      ],
    );
    setIsEditDialogOpen(true);
  };

  const togglePermission = (path: string, mode: "add" | "edit") => {
    if (mode === "add") {
      setNewCreatorPermissions((prev) =>
        prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
      );
    } else {
      setEditedCreatorPermissions((prev) =>
        prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
      );
    }
  };

  const PERMISSION_OPTIONS = [
    { path: "/", label: "Home" },
    { path: "/business-health", label: "Health" },
    { path: "/bills", label: "Bills" },
    { path: "/sample-bill", label: "Sample" },
    { path: "/purchases", label: "Buy" },
    { path: "/returns", label: "Returns" },
    { path: "/passbook", label: "Passbook" },
    { path: "/expenses", label: "Expenses" },
    { path: "/products", label: "Stock" },
    { path: "/clients", label: "Clients" },
    { path: "/vendors", label: "Vendors" },
    { path: "/files", label: "Files" },
    { path: "/notes", label: "Notes" },
    { path: "/ai-agent", label: "AI" },
    { path: "/bank-accounts", label: "Banks" },
    { path: "/bill-creators", label: "Users" },
    { path: "/settings", label: "Settings" },
  ];

  const openDeleteDialog = (creator: BillCreator, e: React.MouseEvent) => {
    e.stopPropagation();
    setCreatorToDelete(creator);
    setIsDeleteDialogOpen(true);
  };

  useEffect(() => {
    const loadCreatorBills = async () => {
      if (!selectedCreator) return;
      setLoading(true);
      const [regularBills, sampleBills] = await Promise.all([
        getBills(),
        getSampleBills(),
      ]);

      const allBills = [...regularBills, ...sampleBills];

      const creatorData = creators.find((c) => c.name === selectedCreator);
      const isExpo = creatorData?.type === "Expo";
      const expoId = creatorData?.expoId;

      const filtered = allBills
        .filter((bill) => {
          if (isExpo && expoId) {
            return (
              bill.createdBy === selectedCreator &&
              (bill as any).expoId === expoId
            );
          }
          return bill.createdBy === selectedCreator;
        })
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

      setCreatorBills(filtered);
      setLoading(false);
    };
    loadCreatorBills();
  }, [selectedCreator]);

  const filteredCreators = creators.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredAndSortedBills = creatorBills
    .filter((bill) => {
      const searchLower = billSearchTerm.toLowerCase();
      const itemMatch = bill.items.some((it) =>
        [
          it.productName,
          it.itemNo || "",
          it.model || "",
          it.imeiNumber || "",
          it.storage || "",
          it.color || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchLower),
      );
      return (
        bill.billNumber.toLowerCase().includes(searchLower) ||
        (bill.client?.name ?? "").toLowerCase().includes(searchLower) ||
        itemMatch
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === "date") {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === "amount") {
        comparison = a.total - b.total;
      } else if (sortBy === "client") {
        comparison = (a.client?.name ?? "").localeCompare(b.client?.name ?? "");
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

  if (selectedCreator) {
    const totalAmount = filteredAndSortedBills.reduce(
      (sum, bill) => sum + bill.total,
      0,
    );
    const totalPaid = filteredAndSortedBills.reduce(
      (sum, bill) => sum + (bill.paidAmount || 0),
      0,
    );
    const totalPending = totalAmount - totalPaid;

    const paymentMethods = filteredAndSortedBills.reduce(
      (acc, bill) => {
        const b = bill as any;
        if (b.payments && Array.isArray(b.payments)) {
          b.payments.forEach((p: any) => {
            const method = p.method || "Other";
            acc[method] = (acc[method] || 0) + p.amount;
          });
        } else if (b.paidAmount > 0) {
          // Fallback for bills without payments array but with paidAmount
          const method = b.paymentMethod || b.paymentType || "Other";
          acc[method] = (acc[method] || 0) + b.paidAmount;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const ALL_PAYMENT_METHODS: PaymentMethod[] = [
      "Cash",
      "UPI",
      "Bank Transfer",
      "Cheque",
      "Other",
    ];

    return (
      <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
        <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-slate-50/40 p-3 shadow-sm sm:p-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-border/70 bg-background/90 sm:h-10 sm:w-10"
              onClick={() => setSelectedCreator(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold leading-tight sm:text-2xl">
                Bills by {selectedCreator}
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Performance overview and bill history
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2 sm:p-4">
          <div className="h-full overflow-y-auto space-y-5 px-2 sm:px-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Card className="bg-primary/5 border-primary/20 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                    Total Billed
                  </p>
                  <h3 className="text-2xl font-bold text-primary">
                    {formatCurrency(totalAmount)}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {filteredAndSortedBills.length} bills
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-green-500/5 border-green-500/20 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                    Collected
                  </p>
                  <h3 className="text-2xl font-bold text-green-600">
                    {formatCurrency(totalPaid)}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total payments received
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-orange-500/5 border-orange-500/20 shadow-sm sm:col-span-2 xl:col-span-1">
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                    Pending
                  </p>
                  <h3 className="text-2xl font-bold text-orange-600">
                    {formatCurrency(totalPending)}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Outstanding balance
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-3 sm:p-4">
              <h2 className="text-base font-semibold sm:text-lg mb-3">
                Collected by Payment Method
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {ALL_PAYMENT_METHODS.map((method) => (
                  <Card
                    key={method}
                    className="bg-muted/30 border-border/50 shadow-none"
                  >
                    <CardContent className="p-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight truncate">
                        {method}
                      </p>
                      <h3 className="text-sm font-bold mt-1">
                        {formatCurrency(paymentMethods[method] || 0)}
                      </h3>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-3 sm:p-4">
              <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center">
                <div className="flex w-full gap-2">
                  <div className="relative w-full flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bills, model, IMEI..."
                className="h-10 w-full pl-10"
                value={billSearchTerm}
                onChange={(e) => setBillSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setSortBy("date");
                    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                  }}
                >
                  Sort by Date{" "}
                  {sortBy === "date" && (sortOrder === "desc" ? "↓" : "↑")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSortBy("amount");
                    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                  }}
                >
                  Sort by Amount{" "}
                  {sortBy === "amount" && (sortOrder === "desc" ? "↓" : "↑")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSortBy("client");
                    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                  }}
                >
                  Sort by Client{" "}
                  {sortBy === "client" && (sortOrder === "desc" ? "↓" : "↑")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredAndSortedBills.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    {billSearchTerm
                      ? "No bills match your search."
                      : "No bills found for this creator."}
                  </CardContent>
                </Card>
              ) : (
                filteredAndSortedBills.map((bill) => (
                  <Card
                    key={bill.id}
                    className="cursor-pointer border-border/70 bg-gradient-to-br from-background via-background to-primary/5 p-2 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                    onClick={() =>
                      navigate(
                        "isSample" in bill
                          ? `/sample-bills/${bill.id}`
                          : `/bills/${bill.id}`,
                      )
                    }
                  >
                    <CardContent className="space-y-2 p-0">
                      <div className="rounded-xl border border-border/70 bg-background/95 px-3 py-3 sm:px-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-bold sm:text-base">
                                {bill.billNumber}
                              </span>
                              {"isSample" in bill && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  Sample
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground sm:text-sm">
                              {bill.client?.name ?? ""}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                              {bill.items
                                .slice(0, 2)
                                .map((it) =>
                                  [it.model || it.productName, it.imeiNumber]
                                    .filter(Boolean)
                                    .join(" • "),
                                )
                                .join(" | ")}
                            </p>
                          </div>
                          <Badge
                            variant={
                              bill.paymentStatus === "paid"
                                ? "secondary"
                                : "outline"
                            }
                            className="w-fit"
                          >
                            {bill.paymentStatus}
                          </Badge>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3 sm:px-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-center">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              {new Date(bill.date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-left sm:text-center">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Type
                            </p>
                            <p className="text-xs font-semibold sm:text-sm">
                              {"isSample" in bill
                                ? "Sample Bill"
                                : "Regular Bill"}
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Amount
                            </p>
                            <p className="text-sm font-bold sm:text-base">
                              {formatCurrency(bill.total)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-slate-50/40 p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">
                Bill Creators
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage and view performance of bill creators
              </p>
            </div>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 rounded-xl border border-border/70 bg-muted/30 p-2 lg:w-auto">
            <Button
              size="sm"
              className="h-10 rounded-xl px-3 text-sm"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Creator
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2 sm:p-4">
        <div className="h-full overflow-y-auto space-y-5 pr-1 sm:pr-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search creators..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredCreators.map((creator) => (
              <Card
                key={creator.id}
                className="group relative cursor-pointer overflow-hidden border-border/70 bg-gradient-to-br from-background via-background to-sky-500/5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl"
                onClick={() => setSelectedCreator(creator.name)}
              >
                <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-sky-500/10 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
                <CardHeader className="relative pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 transition-colors group-hover:bg-primary/15">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="flex items-center gap-2 truncate text-base">
                        <span className="truncate">{creator.name}</span>
                        {creator.type && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-medium"
                          >
                            {creator.type}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        View bills and performance
                      </CardDescription>
                    </div>
                    <div className="flex gap-1 rounded-xl border border-border/60 bg-background/85 p-1 backdrop-blur">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        onClick={(e) => openEditDialog(creator, e)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => openDeleteDialog(creator, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative pt-0">
                  <div className="rounded-xl border border-border/60 bg-muted/25 p-2">
                    <Button
                      variant="secondary"
                      className="h-9 w-full justify-between rounded-lg bg-background text-primary shadow-sm hover:bg-background"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (creator.type === "Expo" && creator.expoId) {
                          navigate(`/expo-dashboard/${creator.expoId}`);
                        } else {
                          setSelectedCreator(creator.name);
                        }
                      }}
                    >
                      {creator.type === "Expo"
                        ? "View Expo Dashboard"
                        : "View History"}
                      <Receipt className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredCreators.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <p className="text-muted-foreground">No creators found.</p>
                <Button
                  className="mt-4"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Creator
                </Button>
              </div>
            )}
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent className="dialog-form-content max-w-md">
              <DialogHeader className="dialog-form-header">
                <DialogTitle>Add New Creator</DialogTitle>
                <DialogDescription>
                  Enter the name and password of the new bill creator.
                </DialogDescription>
              </DialogHeader>
              <div className="dialog-form-body space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Creator Name</Label>
                  <Input
                    id="name"
                    placeholder="Creator name"
                    value={newCreatorName}
                    onChange={(e) => setNewCreatorName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">User Type</Label>
                  <select
                    id="type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={newCreatorType}
                    onChange={(e) => setNewCreatorType(e.target.value as any)}
                  >
                    <option value="Creator">Creator</option>
                    <option value="Employee">Employee</option>
                    <option value="CA">CA</option>
                    <option value="Expo">Expo</option>
                  </select>
                </div>
                {newCreatorType === "Expo" && (
                  <div className="space-y-2">
                    <Label htmlFor="expoId">Expo ID</Label>
                    <Input
                      id="expoId"
                      placeholder="e.g. EXPO-001"
                      value={newExpoId}
                      onChange={(e) => setNewExpoId(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Password"
                      value={newCreatorPassword}
                      onChange={(e) => setNewCreatorPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddCreator()}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Permissions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PERMISSION_OPTIONS.map((opt) => (
                      <div
                        key={opt.path}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`new-perm-${opt.path}`}
                          checked={newCreatorPermissions.includes(opt.path)}
                          onCheckedChange={() =>
                            togglePermission(opt.path, "add")
                          }
                        />
                        <label
                          htmlFor={`new-perm-${opt.path}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {opt.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter className="dialog-form-footer">
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddCreator}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="dialog-form-content max-w-md">
              <DialogHeader className="dialog-form-header">
                <DialogTitle>Edit Creator</DialogTitle>
                <DialogDescription>
                  Update the creator's details.
                </DialogDescription>
              </DialogHeader>
              <div className="dialog-form-body space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Creator Name</Label>
                  <Input
                    id="edit-name"
                    placeholder="Creator name"
                    value={editedCreatorName}
                    onChange={(e) => setEditedCreatorName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">User Type</Label>
                  <select
                    id="edit-type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={editedCreatorType}
                    onChange={(e) =>
                      setEditedCreatorType(e.target.value as any)
                    }
                  >
                    <option value="Creator">Creator</option>
                    <option value="Employee">Employee</option>
                    <option value="CA">CA</option>
                    <option value="Expo">Expo</option>
                  </select>
                </div>
                {editedCreatorType === "Expo" && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-expoId">Expo ID</Label>
                    <Input
                      id="edit-expoId"
                      placeholder="e.g. EXPO-001"
                      value={editedExpoId}
                      onChange={(e) => setEditedExpoId(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="edit-password">New Password (optional)</Label>
                  <div className="relative">
                    <Input
                      id="edit-password"
                      type={showEditPassword ? "text" : "password"}
                      placeholder="New Password (optional)"
                      value={editedCreatorPassword}
                      onChange={(e) => setEditedCreatorPassword(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleEditCreator()
                      }
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                    >
                      {showEditPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Permissions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PERMISSION_OPTIONS.map((opt) => (
                      <div
                        key={opt.path}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`edit-perm-${opt.path}`}
                          checked={editedCreatorPermissions.includes(opt.path)}
                          onCheckedChange={() =>
                            togglePermission(opt.path, "edit")
                          }
                        />
                        <label
                          htmlFor={`edit-perm-${opt.path}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {opt.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter className="dialog-form-footer">
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleEditCreator}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Creator</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{creatorToDelete?.name}"?
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteCreator}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
