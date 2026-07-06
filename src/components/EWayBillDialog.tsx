import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { EWayBillDetails } from "@/types";

interface EWayBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (details: EWayBillDetails) => void;
}

export function EWayBillDialog({
  open,
  onOpenChange,
  onGenerate,
}: EWayBillDialogProps) {
  const [details, setDetails] = useState<EWayBillDetails>({
    modeOfTransport: "Road",
    vehicleType: "Regular",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>E-Way Bill Details (Form Tax EWB-01)</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="distance" className="text-right text-xs">
              Dist (km)
            </Label>
            <Input
              id="distance"
              type="number"
              className="col-span-3"
              value={details.approxDistance || ""}
              onChange={(e) =>
                setDetails({ ...details, approxDistance: Number(e.target.value) })
              }
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="mode" className="text-right text-xs">
              Mode
            </Label>
            <Select
              value={details.modeOfTransport}
              onValueChange={(value: any) =>
                setDetails({ ...details, modeOfTransport: value })
              }
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Road">Road</SelectItem>
                <SelectItem value="Rail">Rail</SelectItem>
                <SelectItem value="Air">Air</SelectItem>
                <SelectItem value="Ship">Ship</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="vehicle" className="text-right text-xs">
              Vehicle No
            </Label>
            <Input
              id="vehicle"
              placeholder="e.g. KA01AB1234"
              className="col-span-3"
              value={details.vehicleNumber || ""}
              onChange={(e) =>
                setDetails({ ...details, vehicleNumber: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="transporter" className="text-right text-xs">
              Transporter
            </Label>
            <Input
              id="transporter"
              className="col-span-3"
              value={details.transporterName || ""}
              onChange={(e) =>
                setDetails({ ...details, transporterName: e.target.value })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onGenerate(details)}>Generate Official E-Way Bill</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
