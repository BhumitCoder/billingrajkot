import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getBills, getCompanyProfile, getBankAccounts } from '@/lib/storage';
import { BankAccount, Bill, EWayBillDetails } from '@/types';
import { BillView, BillPDF } from '@/components/BillView';
import { EWayBillPDF } from '@/components/EWayBillPDF';
import { EWayBillDialog } from '@/components/EWayBillDialog';
import { Button } from '@/components/ui/button';
import { storage } from '@/lib/firebase';
import { ArrowLeft, Edit, Download, Printer, MessageCircle, Loader2, ImagePlus, X, CreditCard, Check } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { getDownloadURL, ref } from 'firebase/storage';
import QRCode from "qrcode";
import { toast } from 'sonner';
import { updateBillImages, uploadBillCustomerImage } from '@/lib/firebaseService';
import { downloadImage } from '@/lib/utils';
import { compressFile } from '@/lib/imageCompression';

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState<Bill | null>(null);
  const [generating, setGenerating] = useState(false);
  const [ewayDialogOpen, setEwayDialogOpen] = useState(false);
  const [defaultBankAccount, setDefaultBankAccount] =
    useState<BankAccount | null>(null);
  const [idImages, setIdImages] = useState<[string, string]>(["", ""]);
  const [idUploading, setIdUploading] = useState<[boolean, boolean]>([false, false]);
  const [idSaving, setIdSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; label: string } | null>(null);
  const idInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  useEffect(() => {
    const loadBill = async () => {
      if (id) {
        const [bills, bankAccounts] = await Promise.all([
          getBills(),
          getBankAccounts(),
        ]);
        const foundBill = bills.find((b) => b.id === id);
        const resolvedDefault =
          bankAccounts.find((account) => account.isDefault) ||
          bankAccounts[0] ||
          null;
        setDefaultBankAccount(resolvedDefault);
        if (foundBill) {
          setBill(foundBill);
          setIdImages([foundBill.customerImages?.[0] || "", foundBill.customerImages?.[1] || ""]);
        } else {
          navigate('/bills');
        }
      }
    };
    loadBill();
  }, [id, navigate]);

  const handleGenerateEBill = async (action: 'download' | 'share') => {
    if (!bill) return;
    try {
      setGenerating(true);
      const company = await getCompanyProfile();

      const resolveSignatureForPdf = async (signature?: string): Promise<string | null> => {
        if (!signature) return null;
        let signatureUrl = signature.trim();
        if (!signatureUrl) return null;
        if (signatureUrl.startsWith("data:")) return signatureUrl;
        if (!/^https?:\/\//i.test(signatureUrl)) {
          try {
            signatureUrl = await getDownloadURL(ref(storage, signatureUrl));
          } catch {
            return null;
          }
        }
        try {
          const response = await fetch(signatureUrl, { mode: "cors" });
          if (!response.ok) return signatureUrl;
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("Failed to read signature"));
            reader.readAsDataURL(blob);
          });
          return dataUrl || signatureUrl;
        } catch {
          return signatureUrl;
        }
      };

      let qrDataURL = "";
      const upiId = (
        bill.bankAccount?.upiId ||
        defaultBankAccount?.upiId ||
        company.upiId ||
        ""
      ).trim();
      if (upiId) {
        const amount = Number(bill.total || 0).toFixed(2);
        const upiLink =
          `upi://pay?pa=${encodeURIComponent(upiId)}` +
          `&pn=${encodeURIComponent(company.name || "")}` +
          `&am=${encodeURIComponent(amount)}` +
          `&cu=INR` +
          `&tn=${encodeURIComponent(`Invoice ${bill.billNumber}`)}`;
        qrDataURL = await QRCode.toDataURL(upiLink, { width: 220, margin: 1 });
      }

      const signatureForPdf = await resolveSignatureForPdf(company?.signature);
      const companyForPdf = signatureForPdf ? { ...company, signature: signatureForPdf } : company;

      const blob = await pdf(
        <BillPDF 
          bill={bill} 
          company={companyForPdf} 
          qrDataURL={qrDataURL} 
          bankAccountOverride={defaultBankAccount}
        />
      ).toBlob();
      
      const file = new File([blob], `${bill.billNumber}.pdf`, { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      if (action === 'download') {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${bill.billNumber}.pdf`;
        link.click();
        toast.success('E-bill downloaded successfully');
      } else if (action === 'share') {
        if (navigator.share) {
          await navigator.share({
            title: `Bill ${bill.billNumber}`,
            text: `Please find the e-bill for ${bill.billNumber}`,
            files: [file]
          });
        } else {
          const phone = bill.client?.phone?.replace(/\D/g, "");
          const billLink = `${window.location.origin}/view/bill/${bill.id}`;
          const text = encodeURIComponent(`Hello ${bill.client?.name ?? ""}, please find your bill ${bill.billNumber} here: ${billLink}`);
          window.open(`https://wa.me/+91${phone}?text=${text}`, "_blank");
        }
      }
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating E-bill:', error);
      toast.error('Failed to generate E-bill');
    } finally {
      setGenerating(false);
    }
  };

  if (!bill) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-background p-2 shadow-sm print:hidden sm:p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/bills')} className="h-10 shrink-0 rounded-lg bg-background px-3">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">{bill.billNumber}</h1>
              <p className="text-sm text-muted-foreground">Bill details and actions</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 rounded-lg border border-border/60 bg-muted/20 p-1.5 lg:w-auto lg:justify-end">
          {/* place here */}
            <Button variant="outline" onClick={() => handleGenerateEBill('download')} disabled={generating} className="h-10 rounded-lg bg-background">
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              E-Bill
            </Button>
            {bill.customerImages?.[0] && (
              <button
                onClick={() => downloadImage(bill.customerImages![0], `id-front-${bill.billNumber}.jpg`)}
                className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted/40 transition-colors">
                <Download className="h-4 w-4" /> ID Front
              </button>
            )}
            {bill.customerImages?.[1] && (
              <button
                onClick={() => downloadImage(bill.customerImages![1], `id-back-${bill.billNumber}.jpg`)}
                className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted/40 transition-colors">
                <Download className="h-4 w-4" /> ID Back
              </button>
            )}
            <Button
              variant="outline"
              className="h-10 w-10 rounded-lg p-0 bg-background"
              title="Share on WhatsApp"
              onClick={() => {
                const phone = bill.client?.phone?.replace(/\D/g, "");
                if (!phone) { toast.error("Client phone number not available"); return; }
                const billLink = `${window.location.origin}/view/bill/${bill.id}`;
                const text = encodeURIComponent(`Hello ${bill.client?.name ?? ""}, please find your bill ${bill.billNumber} here: ${billLink}`);
                window.open(`https://wa.me/+91${phone}?text=${text}`, "_blank");
              }}
            >
              <MessageCircle className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              variant="outline"
              className="h-10 w-10 rounded-lg p-0 bg-background"
              title="Print Bill"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Link to={`/bills/${bill.id}/edit`}>
              <Button className="h-10 rounded-lg">
                <Edit className="h-4 w-4 mr-2" />
                Edit Bill
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-2xl border border-border/70 bg-background/60 p-2 sm:p-3">
        <div className="h-full overflow-y-auto pr-1 sm:pr-2">
          <BillView bill={bill} />
        </div>
      </div>

      {/* Customer ID Verification — compact strip */}
      <div className="shrink-0 rounded-2xl border border-border/70 bg-background overflow-hidden print:hidden">
        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* Icon + title */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <CreditCard className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-xs font-semibold whitespace-nowrap">Customer ID</p>
          </div>

          {/* Slots */}
          <div className="flex flex-1 items-center gap-2 min-w-0">
            {(["Front", "Back"] as const).map((side, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                {/* Badge label */}
                <span className={[
                  "shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  idx === 0
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
                ].join(" ")}>
                  {side}
                </span>

                {idImages[idx] ? (
                  /* Thumbnail */
                  <div className="group relative h-10 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 cursor-zoom-in"
                    onClick={() => setPreviewImage({ src: idImages[idx], label: `ID ${side}` })}>
                    <img src={idImages[idx]} alt={`ID ${side}`} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Download className="h-3 w-3 text-white" />
                    </div>
                  </div>
                ) : (
                  /* Upload slot */
                  <label className="flex h-10 w-16 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all">
                    {idUploading[idx]
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      : <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={idInputRefs[idx]}
                      disabled={idUploading[idx]}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIdUploading((prev) => { const n: [boolean, boolean] = [...prev] as [boolean, boolean]; n[idx] = true; return n; });
                        try {
                          const compressed = await compressFile(file, 900);
                          setIdImages((prev) => { const n: [string, string] = [...prev] as [string, string]; n[idx] = compressed; return n; });
                        } catch {
                          toast.error("Failed to process image");
                        } finally {
                          setIdUploading((prev) => { const n: [boolean, boolean] = [...prev] as [boolean, boolean]; n[idx] = false; return n; });
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                )}

                {/* Per-slot actions when image exists */}
                {idImages[idx] && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Download"
                      onClick={() => downloadImage(idImages[idx], `id-${side.toLowerCase()}-${bill.billNumber}.jpg`)}
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remove"
                      onClick={() => setIdImages((prev) => { const n: [string, string] = [...prev] as [string, string]; n[idx] = ""; return n; })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Unsaved + Save */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {(idImages[0] !== (bill.customerImages?.[0] || "") || idImages[1] !== (bill.customerImages?.[1] || "")) && (
              <span className="hidden sm:inline text-[10px] text-amber-600 font-medium">Unsaved</span>
            )}
            <Button
              size="sm"
              className="h-7 rounded-lg px-2.5 text-xs"
              disabled={idSaving || idUploading.some(Boolean)}
              onClick={async () => {
                if (!bill) return;
                setIdSaving(true);
                try {
                  const uploaded = await Promise.all(
                    (["front", "back"] as const).map(async (side, i) => {
                      const img = idImages[i] || "";
                      if (img.startsWith("data:")) {
                        return await uploadBillCustomerImage(bill.id, img, side);
                      }
                      return img;
                    })
                  );
                  const finalImages = uploaded as [string, string];
                  await updateBillImages(bill.id, finalImages);
                  setIdImages(finalImages);
                  setBill((prev) => prev ? { ...prev, customerImages: [...finalImages] } : prev);
                  toast.success("ID photos saved");
                } catch {
                  toast.error("Failed to save photos");
                } finally {
                  setIdSaving(false);
                }
              }}
            >
              {idSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative mx-4 max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between rounded-t-2xl bg-black/60 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-white/80" />
                <span className="text-sm font-semibold text-white">{previewImage.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-medium text-white transition-colors"
                  onClick={(e) => { e.stopPropagation(); downloadImage(previewImage.src, `${previewImage.label.toLowerCase().replace(" ", "-")}-${bill.billNumber}.jpg`); }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
                  onClick={() => setPreviewImage(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Image */}
            <img
              src={previewImage.src}
              alt={previewImage.label}
              className="w-full rounded-b-2xl object-contain max-h-[75vh]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
