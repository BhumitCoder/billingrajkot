import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { getClients, saveClient, deleteClient, migrateVendorsToParties, getBills } from "@/lib/storage";
import { Client } from "@/types";
import { Plus, Edit, Trash2, Users, Eye, Search, Phone, BadgeCheck, AlertTriangle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";
import { dummyClients } from "@/lib/dummyData";
import { ClientDetailScreen } from "@/components/ClientDetailScreen";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { OverdueBillsDialog } from "@/components/OverdueBillsDialog";

const emptyForm = {
  name: "",
  phone: "",
  billingAddress: "",
  gstin: "",
  openingBalance: "",
  openingBalanceType: "receivable",
  creditLimit: "",
};

export default function Clients() {
  const location = useLocation();
  const navStateHandled = useRef(false);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [partyBalances, setPartyBalances] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isOpen, setIsOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState(emptyForm);
  const { locked, reloadKey } = useEncryptionLock();

  useEffect(() => {
    // Migrate existing vendors to parties once
    const migrationKey = "vendorMigrationDone_v1";
    if (!localStorage.getItem(migrationKey)) {
      migrateVendorsToParties().then(() => {
        localStorage.setItem(migrationKey, "1");
      }).catch(console.error);
    }
    loadClients();
  }, [locked, reloadKey]);

  const loadClients = async () => {
    if (locked) { setClients(dummyClients); setPartyBalances({}); setLoading(false); return; }
    try {
      setLoading(true);
      const [data, allSales] = await Promise.all([
        getClients(),
        getBills(),
      ]);
      setClients(data);
      setPage(1);

      // Auto-open client from GlobalSearch navigation (run only once)
      if (!navStateHandled.current) {
        navStateHandled.current = true;
        const navState = location.state as { selectedClientId?: string } | null;
        if (navState?.selectedClientId) {
          const found = data.find((c) => c.id === navState.selectedClientId);
          if (found) setViewingClient(found);
        }
      }

      // Compute sales credit used per party:
      // opening balance type decides receivable/payable offset.
      const balances: Record<string, number> = {};
      data.forEach((c) => {
        const salesOutstanding = allSales
          .filter((b) => b.clientId === c.id)
          .reduce((s, b) => {
            // bill.total is already reduced by updateBillAfterReturn after any return,
            // so use it directly — no need to subtract b.returns (which is never populated).
            const netTotal = Math.max(0, b.total || 0);
            return s + Math.max(0, netTotal - (b.paidAmount || 0));
          }, 0);
        const openingAmt = Math.abs(c.openingBalance || 0);
        // "receivable" = party owes you (Debit/positive), "payable" = you owe party (Credit/negative).
        const openingIsPayable = (c.openingBalanceType || "receivable") === "payable";
        const openingSigned = openingIsPayable ? -openingAmt : openingAmt;
        balances[c.id] = salesOutstanding + openingSigned;
      });
      setPartyBalances(balances);
    } catch (error) {
      toast.error("Failed to load parties");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) { toast.error("Unable to save. Check your connection."); return; }
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const openingAmt = parseFloat(formData.openingBalance) || 0;
      const client: Client = {
        id: editingClient?.id || crypto.randomUUID(),
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        billingAddress: formData.billingAddress.trim(),
        gstin: formData.gstin.trim().toUpperCase(),
        openingBalance: Math.abs(openingAmt),
        openingBalanceType: (formData.openingBalanceType || "receivable") as any,
        creditLimit: parseFloat(formData.creditLimit) || 0,
        state: editingClient?.state || "",
        createdAt: editingClient?.createdAt || new Date().toISOString(),
      };
      await saveClient(client);
      await loadClients();
      setIsOpen(false);
      resetForm();
      toast.success(editingClient ? "Party updated" : "Party added");
    } catch (error) {
      toast.error("Failed to save party");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    const balAmt = Math.abs(client.openingBalance || 0);
    setFormData({
      name: client.name,
      phone: client.phone || "",
      billingAddress: client.billingAddress || "",
      gstin: client.gstin || "",
      openingBalance: balAmt ? String(balAmt) : "",
      openingBalanceType: client.openingBalanceType || "receivable",
      creditLimit: client.creditLimit ? String(client.creditLimit) : "",
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (locked) { toast.error("Unable to save. Check your connection."); return; }
    try {
      await deleteClient(id);
      await loadClients();
      toast.success("Party deleted");
    } catch (err) {
      console.error("Error deleting client:", err);
      toast.error("Failed to delete party");
    }
  };

  const resetForm = () => {
    setEditingClient(null);
    setFormData(emptyForm);
  };

  const filteredClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.gstin || "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedClients = filteredClients.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  if (loading) {
    return <LoadingSpinner size="xl" text="Loading parties..." fullScreen contentAreaOnly />;
  }

  if (viewingClient) {
    return (
      <ClientDetailScreen client={viewingClient} onBack={() => setViewingClient(null)} />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-background p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold leading-tight">Party</h1>
            <p className="text-[11px] text-muted-foreground">
              {clients.length} {clients.length === 1 ? "party" : "parties"}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400"
            onClick={() => setOverdueOpen(true)}
            title="View overdue collections"
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            Overdue
          </Button>
          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 px-3 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Party
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? "Edit Party" : "Add Party"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Party / Client name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Mobile Number</Label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Mobile number"
                    maxLength={15}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Textarea
                    value={formData.billingAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, billingAddress: e.target.value })
                    }
                    placeholder="Full address"
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>GST No. / GSTIN</Label>
                  <Input
                    value={formData.gstin}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        gstin: e.target.value.toUpperCase().slice(0, 15),
                      })
                    }
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    className={formData.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstin) ? "border-red-400 focus-visible:ring-red-400" : ""}
                  />
                  {formData.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstin) && (
                    <p className="text-[10px] text-red-500">Invalid GSTIN format. Expected: 22AAAAA0000A1Z5</p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Opening Balance (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.openingBalance}
                      onChange={(e) =>
                        setFormData({ ...formData, openingBalance: e.target.value })
                      }
                      placeholder="0.00"
                      className="flex-1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Opening Type</Label>
                    <Select
                      value={formData.openingBalanceType}
                      onValueChange={(val) =>
                        setFormData({ ...formData, openingBalanceType: val as any })
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
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Receivable = party owes you · Payable = you owe party.
                </p>
                <div className="space-y-1.5">
                  <Label>Credit Limit (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.creditLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, creditLimit: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setIsOpen(false); resetForm(); }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : editingClient ? "Update" : "Add"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border/70 bg-background/70 p-2 space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone or tax ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {clients.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-muted-foreground mb-4">No parties added yet</p>
              <Button onClick={() => setIsOpen(true)}>Add your first party</Button>
            </CardContent>
          </Card>
        ) : filteredClients.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No parties found</p>
              <Button variant="outline" className="mt-3" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {pagedClients.map((client) => {
                const liveBalance = partyBalances[client.id] ?? 0;
                const creditLimit = client.creditLimit || 0;
                const isOverLimit = creditLimit > 0 && liveBalance >= creditLimit;
                return (
                <Card
                  key={client.id}
                  className={`shadow-sm hover:shadow-md transition-shadow ${isOverLimit ? "border-red-400 bg-red-50 dark:bg-red-950/20" : "border-border/70 bg-background"}`}
                >
                  <CardContent className="p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-semibold text-sm ${isOverLimit ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary"}`}>
                          {isOverLimit ? <AlertTriangle className="h-4 w-4" /> : client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm truncate">{client.name}</p>
                            {isOverLimit && (
                              <span className="shrink-0 text-[10px] font-semibold bg-red-100 text-red-700 border border-red-300 rounded px-1 py-0.5">
                                Over Limit
                              </span>
                            )}
                          </div>
                          {client.phone && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Phone className="size-3" /> {client.phone}
                            </p>
                          )}
                          {client.billingAddress && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {client.billingAddress}
                            </p>
                          )}
                          {client.gstin && (
                            <p className="text-[11px] text-muted-foreground">
                              GSTIN: {client.gstin}
                            </p>
                          )}
                          <div className="flex gap-2 mt-0.5 flex-wrap">
                            {(client.openingBalance || 0) !== 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                Opening Cr: ₹{Math.abs(client.openingBalance || 0).toLocaleString("en-IN")}
                              </span>
                            )}
                            {creditLimit > 0 && (
                              <span className={`text-[10px] font-medium ${isOverLimit ? "text-red-600" : "text-muted-foreground"}`}>
                                Credit Limit: ₹{creditLimit.toLocaleString("en-IN")}
                                {isOverLimit && ` · Sales Due: ₹${Math.round(liveBalance).toLocaleString("en-IN")}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => setViewingClient(client)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => handleEdit(client)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Party</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {client.name}?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(client.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
              })}
            </div>

            {/* Pagination */}
            {filteredClients.length > pageSize && (
              <div className="flex items-center justify-between border-t pt-3">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <OverdueBillsDialog open={overdueOpen} onClose={() => setOverdueOpen(false)} />
    </div>
  );
}

