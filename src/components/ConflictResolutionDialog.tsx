import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { ProductConflict } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "./ui/badge";

interface ConflictResolutionDialogProps {
  conflicts: ProductConflict[];
  onResolve: (resolutions: Map<string, string>) => void;
  onCancel: () => void;
  resolving?: boolean;
}

export function ConflictResolutionDialog({
  conflicts,
  onResolve,
  onCancel,
  resolving = false,
}: ConflictResolutionDialogProps) {
  const [resolutions, setResolutions] = useState<Map<string, string>>(
    new Map()
  );

  const { toast } = useToast();
  const handleResolution = (itemKey: string, chosenName: string) => {
    setResolutions((prev) => new Map(prev).set(itemKey, chosenName));
  };

  const handleConfirm = () => {
    // Check if all conflicts are resolved
    const allResolved = conflicts.every((conflict) =>
      resolutions.has(conflict.item.id)
    );

    if (!allResolved) {
      toast({
        title: "Incomplete",
        description: "Please resolve all conflicts before continuing",
        variant: "destructive",
      });
      return;
    }

    onResolve(resolutions);
  };

  return (
    <Dialog open={conflicts.length > 0} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertCircle className="h-6 w-6 text-amber-600" />
            Product Name Conflicts Detected
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <p className="text-sm text-muted-foreground">
            The following items have the same 
            different names. Please choose which name to keep for each product.
          </p>

          {conflicts.map((conflict, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 bg-amber-50 dark:bg-amber-950/20"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-base">
                      {conflict.item.description}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Quantity to add: {conflict.item.quantity}{" "}
                      {conflict.item.unit}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Conflict #{index + 1}
                  </Badge>
                </div>

                <RadioGroup
                  value={resolutions.get(conflict.item.description) || ""}
                  onValueChange={(value) =>
                    handleResolution(conflict.item.description, value)
                  }
                  className="space-y-3 mt-4"
                >
                  <div className="flex items-start space-x-3 rounded-lg border-2 border-primary/20 p-3 hover:border-primary/40 transition-colors">
                    <RadioGroupItem
                      value={conflict.existingProduct.name}
                      id={`existing-${index}`}
                      className="mt-1"
                    />
                    <Label
                      htmlFor={`existing-${index}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium">
                        {conflict.existingProduct.name}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Existing product (Current stock:{" "}
                        {conflict.existingProduct.stock})
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border-2 border-primary/20 p-3 hover:border-primary/40 transition-colors">
                    <RadioGroupItem
                      value={conflict.item.description}
                      id={`new-${index}`}
                      className="mt-1"
                    />
                    <Label
                      htmlFor={`new-${index}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium">
                        {conflict.item.description}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        New name from uploaded bill
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          ))}

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onCancel} disabled={resolving}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              className="bg-emerald-600 hover:bg-emerald-700"
              loading={resolving}
            >
              Confirm and Add to Inventory
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
