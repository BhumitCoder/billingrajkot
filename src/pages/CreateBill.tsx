import { useState } from 'react';
import { BillForm } from '@/components/BillForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

export default function CreateBill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const billType = "domestic";
  const backPath = "/bills";
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden rounded-2xl bg-gradient-to-b from-muted/20 via-background to-background p-2 sm:gap-4 sm:p-4">
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-background/95 p-2 shadow-sm backdrop-blur sm:p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setDiscardConfirmOpen(true)} className="h-10 w-10 shrink-0 rounded-lg bg-background">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold leading-tight sm:text-2xl">
                {mode === "non-gst" ? "Create Bill" : "Create New Bill"}
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {mode === "non-gst"
                  ? "Create a bill"
                  : "Fill in details to create a professional invoice"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-2xl border border-border/70 bg-background/85 p-2 sm:p-3">
        <div className="h-full overflow-y-auto pr-1 sm:pr-2">
          <BillForm billType={billType} />
        </div>
      </div>

      <AlertDialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Sale Bill?</AlertDialogTitle>
            <AlertDialogDescription>
              All entered data will be lost. Are you sure you want to go back without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => navigate(backPath)}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
