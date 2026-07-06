import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BankAccount, Bill } from "@/types";
import { getCompanyProfile, getBills, getBankAccounts } from "@/lib/storage";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { BillPDF, BillView } from "@/components/BillView";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "@/lib/firebase";

export default function BillViewPublic() {
  const { id } = useParams();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [defaultBankAccount, setDefaultBankAccount] =
    useState<BankAccount | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;

      const [billsData, companyData, bankAccounts] = await Promise.all([
        getBills(),
        getCompanyProfile(),
        getBankAccounts(),
      ]);

      const foundBill = billsData.find((b) => b.id === id);
      const resolvedDefault =
        bankAccounts.find((account) => account.isDefault) ||
        bankAccounts[0] ||
        null;

      setBill(foundBill || null);
      setCompany(companyData);
      setDefaultBankAccount(resolvedDefault);
      setLoading(false);
    };

    loadData();
  }, [id]);

  const resolveAssetForPdf = async (
    assetPath?: string,
  ): Promise<string | null> => {
    if (!assetPath) return null;
    let assetUrl = assetPath.trim();
    if (!assetUrl) return null;
    if (assetUrl.startsWith("data:")) return assetUrl;

    if (!/^https?:\/\//i.test(assetUrl)) {
      try {
        assetUrl = await getDownloadURL(ref(storage, assetUrl));
      } catch {
        return null;
      }
    }

    try {
      const response = await fetch(assetUrl, { mode: "cors" });
      if (!response.ok) return assetUrl;
      const blob = await response.blob();

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(blob);
      });

      return dataUrl || assetUrl;
    } catch {
      return assetUrl;
    }
  };

  const handleDownloadPDF = async () => {
    if (!bill || !company || generatingPdf) return;

    setGeneratingPdf(true);
    toast.info("Generating PDF...");

    try {
      const upiId = (
        bill.bankAccount?.upiId ||
        defaultBankAccount?.upiId ||
        company?.upiId ||
        ""
      ).trim();

      const qrToUse = upiId
        ? await QRCode.toDataURL(
            `upi://pay?pa=${encodeURIComponent(upiId)}` +
              `&pn=${encodeURIComponent(company?.name || "")}` +
              `&am=${encodeURIComponent(Number(bill.total || 0).toFixed(2))}` +
              `&cu=INR` +
              `&tn=${encodeURIComponent(`Invoice ${bill.billNumber}`)}`,
            { width: 220, margin: 1 },
          )
        : "";

      const signatureForPdf = await resolveAssetForPdf(company?.signature);
      const logoForPdf = await resolveAssetForPdf(company?.logo);

      const companyForPdf = {
        ...company,
        ...(signatureForPdf ? { signature: signatureForPdf } : {}),
        ...(logoForPdf ? { logo: logoForPdf } : {}),
      };

      const blob = await pdf(
        <BillPDF
          bill={bill}
          company={companyForPdf}
          qrDataURL={qrToUse}
          bankAccountOverride={defaultBankAccount}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Bill_${bill.billNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("PDF generation failed", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingSpinner size="xl" text="Loading bill..." fullScreen />
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Bill Not Found
          </h1>
          <p className="text-muted-foreground">
            The requested bill could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col gap-3 bg-background p-3 sm:p-4">
      <div className="sticky top-0 z-20 flex justify-center print:hidden">
        <div className="flex w-full max-w-6xl justify-end rounded-2xl border border-border/70 bg-background/95 p-2 shadow-sm backdrop-blur">
          <Button
            onClick={handleDownloadPDF}
            disabled={generatingPdf}
            variant="outline"
            className="h-10 rounded-lg bg-background px-4"
          >
            {generatingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-2xl border border-border/70 bg-background/60 p-2 sm:p-3">
        <BillView bill={bill} />
      </div>
    </div>
  );
}
