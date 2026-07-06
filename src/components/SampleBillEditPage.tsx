import { getSampleBillById } from "@/lib/firebaseService";
import { SampleBill } from "@/types";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LoadingSpinner } from "./LoadingSpinner";
import { SampleBillForm } from "./SampleBillForm";

export function SampleBillEditPage() {
  const { id } = useParams();
  const [bill, setBill] = useState<SampleBill | null>(null);
  const [loading, setLoading] = useState(true);

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

  return <SampleBillForm bill={bill} isEdit={true} />;
}
