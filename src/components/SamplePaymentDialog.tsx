import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SampleBill, PaymentMethod } from "@/types";
import { formatCurrency } from "@/lib/billUtils";
import { Loader2 } from "lucide-react";

interface SamplePaymentDialogProps {
  bill: SampleBill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentCollected: (amount: number, type: PaymentMethod, note?: string) => void;
}

export function SamplePaymentDialog({
  bill,
  open,
  onOpenChange,
  onPaymentCollected,
}: SamplePaymentDialogProps) {
  const pendingAmount = bill.total - bill.paidAmount;
  const [paymentAmount, setPaymentAmount] = useState(pendingAmount.toString());
  const [paymentType, setPaymentType] = useState<PaymentMethod>("Cash");
  const [paymentNote, setPaymentNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 800));

    const amount = parseFloat(paymentAmount);
    onPaymentCollected(amount, paymentType, paymentNote);
    setLoading(false);
    onOpenChange(false);
    setPaymentNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-form-content max-w-[95vw] sm:max-w-md">
        <DialogHeader className="dialog-form-header">
          <DialogTitle className="text-base sm:text-lg">
            Collect Payment (Sample)
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm break-words">
            Bill: {bill.billNumber} • Client: {bill.client?.name ?? ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="dialog-form-body space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">Total Amount:</span>
              <span className="font-semibold break-words">
                {formatCurrency(bill.total)}
              </span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">Paid Amount:</span>
              <span className="font-semibold break-words">
                {formatCurrency(bill.paidAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm sm:text-base pt-2 border-t">
              <span className="font-semibold">Pending Amount:</span>
              <span className="font-bold text-warning break-words">
                {formatCurrency(pendingAmount)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-amount" className="text-sm">
              Payment Amount
            </Label>
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={pendingAmount}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              disabled={loading}
              autoFocus
              className="text-sm sm:text-base"
            />
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Maximum: {formatCurrency(pendingAmount)}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPaymentAmount(pendingAmount.toString())}
                disabled={loading}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                Full Payment
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-type" className="text-sm">Payment Type</Label>
            <Select
              value={paymentType}
              onValueChange={(value: any) => setPaymentType(value)}
              disabled={loading}
            >
              <SelectTrigger id="payment-type">
                <SelectValue placeholder="Select payment type" />
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

          <div className="space-y-2">
            <Label htmlFor="payment-note" className="text-sm">Note (Optional)</Label>
            <Input
              id="payment-note"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Enter payment reference or note"
              disabled={loading}
              className="text-sm"
            />
          </div>

          <DialogFooter className="dialog-form-footer gap-2 flex-col sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto text-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              className="w-full sm:w-auto text-sm"
            >
              Collect Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}




