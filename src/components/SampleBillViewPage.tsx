import { getSampleBillById } from "@/lib/firebaseService";
import { SampleBill } from "@/types";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LoadingSpinner } from "./LoadingSpinner";
import { SampleBillView } from "./SampleBillView";
import { Button } from "./ui/button";
import { ArrowLeft, Edit, Receipt } from "lucide-react";

export function SampleBillViewPage() {
  const { id } = useParams();
  const [bill, setBill] = useState<SampleBill | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadBill = async () => {
      if (id) {
        const data = await getSampleBillById(id);
        setBill(data);
        setLoading(false);
      }
    };
    loadBill();
  }, [id]);

  if (loading) return <LoadingSpinner fullScreen contentAreaOnly />;
  if (!bill) return <div>Sample bill not found</div>;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-background p-2 shadow-sm sm:p-3 print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">
                Quotation Bill
              </h1>
              <p className="text-sm text-muted-foreground">
                View quotation details and share with your client
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 rounded-xl border border-border/60 bg-muted/20 p-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start lg:w-auto lg:justify-end">
            <Button
              variant="outline"
              onClick={() => navigate("/sample-bills")}
              className="h-10 w-full rounded-lg sm:w-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Bills
            </Button>
            <Link to={`/sample-bills/${bill.id}/edit`} className="w-full sm:w-auto">
              <Button className="h-10 w-full rounded-lg sm:w-auto">
                <Edit className="mr-2 h-4 w-4" />
                Edit Bill
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-2xl border border-border/70 bg-background/60 p-2 sm:p-3">
        <div className="h-full overflow-y-auto pr-1 sm:pr-2">
          <SampleBillView bill={bill} />
        </div>
      </div>
    </div>
  );
}
