import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { toast } from "sonner";
import { Client } from "@/types";
import { saveClient } from "@/lib/storage";

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (client: Client) => void;
}

type OpeningBalanceType = NonNullable<Client["openingBalanceType"]>;

export function ClientForm({ open, onOpenChange, onSuccess }: ClientFormProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    billingAddress: "",
    gstin: "",
    openingBalance: "",
    openingBalanceType: "receivable" as OpeningBalanceType,
    creditLimit: "",
  });

  const reset = () =>
    setFormData({
      name: "",
      phone: "",
      billingAddress: "",
      gstin: "",
      openingBalance: "",
      openingBalanceType: "receivable" as OpeningBalanceType,
      creditLimit: "",
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const client: Client = {
        id: crypto.randomUUID(),
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        billingAddress: formData.billingAddress.trim(),
        gstin: formData.gstin.trim().toUpperCase(),
        openingBalance: Math.abs(parseFloat(formData.openingBalance) || 0),
        openingBalanceType: formData.openingBalanceType || "receivable",
        creditLimit: parseFloat(formData.creditLimit) || 0,
        state: "",
        createdAt: new Date().toISOString(),
      };
      await saveClient(client);
      onSuccess(client);
      onOpenChange(false);
      reset();
      toast.success("Party added successfully");
    } catch (error) {
      console.error("Error saving party:", error);
      toast.error("Failed to save party");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[100vw] sm:w-[90vw] lg:w-[560px] max-w-[100vw]
        h-[100vh] sm:h-auto max-h-[100vh]
        left-0 top-0 translate-x-0 translate-y-0
        sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]
        rounded-none sm:rounded-2xl p-0 overflow-hidden flex flex-col
        overflow-y-auto sm:overflow-visible"
      >
        <DialogHeader className="px-4 sm:px-5 py-4 border-b bg-gradient-to-r from-slate-50 to-white sticky top-0 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-semibold">
                P
              </div>
              <div>
                <DialogTitle className="text-base">Add New Party</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Create a party once and reuse across sales and purchases.
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-4 sm:px-5 py-4 space-y-4 flex-1 min-h-0 overflow-y-auto">
          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Basic Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Party / Client name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile Number</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="Mobile number"
                  maxLength={15}
                />
              </div>
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
              />
            </div>
          </div>

          <div className="rounded-lg border bg-background p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Financials
              </p>
              <span className="text-[10px] text-muted-foreground">Optional</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Opening Balance</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.openingBalance}
                  onChange={(e) =>
                    setFormData({ ...formData, openingBalance: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Opening Type</Label>
                <Select
                  value={formData.openingBalanceType}
                  onValueChange={(val) =>
                    setFormData({
                      ...formData,
                      openingBalanceType: val as OpeningBalanceType,
                    })
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
              <div className="space-y-1.5">
                <Label>Credit Limit</Label>
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
            </div>
            <p className="text-[11px] text-muted-foreground">
              Receivable = party owes you. Payable = you owe party.
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t sticky bottom-0 bg-background/95 backdrop-blur pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add Party"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

