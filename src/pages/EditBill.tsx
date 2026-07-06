import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBills } from '@/lib/storage';
import { Bill } from '@/types';
import { BillForm } from '@/components/BillForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function EditBill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState<Bill | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  useEffect(() => {
    const loadBill = async () => {
      if (id) {
        const bills = await getBills();
        const foundBill = bills.find((b) => b.id === id);
        if (foundBill) {
          setBill(foundBill);
        } else {
          navigate('/bills');
        }
      }
    };
    loadBill();
  }, [id, navigate]);

  if (!bill) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-background p-2 shadow-sm sm:p-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setDiscardConfirmOpen(true)} className="h-10 w-10 shrink-0 rounded-lg bg-background">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">Edit Bill</h1>
            <p className="text-sm text-muted-foreground truncate">{bill.billNumber}</p>
          </div>
          </div>
          <div className="hidden rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground sm:block">
            Update Mode
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-2xl border border-border/70 bg-background/60 p-2 sm:p-3">
        <div className="h-full overflow-y-auto pr-1 sm:pr-2">
          <BillForm bill={bill} isEdit />
        </div>
      </div>

      <AlertDialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              All unsaved changes will be lost. Are you sure you want to go back without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => navigate(`/bills/${bill.id}`)}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
