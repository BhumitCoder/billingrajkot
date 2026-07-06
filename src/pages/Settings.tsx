import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { getCompanyProfile, saveCompanyProfile, companyProfileExists, repairBillCounters, getClients, getPurchaseBills, getPartyPayments, deletePurchaseBillPayment } from "@/lib/storage";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";
import { CompanyProfile } from "@/types";
import { toast } from "sonner";
import {
  Save,
  Upload,
  Loader2,
  Building2,
  Settings2,
  CreditCard,
  Receipt,
  Percent,
  DollarSign,
  Palette,
  FileText,
  Banknote,
  Mail,
  Phone,
  MapPin,
  Hash,
  SearchCheck,
  AlertTriangle,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { logout, checkSessionExpiry } from "@/pages/Auth";
import { useNavigate } from "react-router-dom";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { storage } from "@/lib/firebase";
import { dummyCompanyProfile } from "@/lib/dummyData";

export default function Settings() {
  const navigate = useNavigate();
  const { locked, reloadKey } = useEncryptionLock();
  const [saving, setSaving] = useState(false);
  const [sessionExpiry, setSessionExpiry] = useState<Date | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [uploadingGstSignature, setUploadingGstSignature] = useState(false);
  const [repairingCounters, setRepairingCounters] = useState(false);
  const [repairResult, setRepairResult] = useState<{ gst: number; nonGst: number } | null>(null);
  type AuditIssue = {
    clientId: string;
    name: string;
    overpaid: number;
    totalPurchases: number;
    totalBillPaid: number;
    remainingAdvance: number;
    overpaidBills: Array<{ billId: string; billNumber: string; excess: number; paymentsToRemove: Array<{ id: string; amount: number; method: string; date: string }> }>;
  };
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditFixing, setAuditFixing] = useState<string | null>(null);
  const [auditResults, setAuditResults] = useState<AuditIssue[] | null>(null);

  const runAdvanceAudit = async () => {
    setAuditRunning(true);
    setAuditResults(null);
    try {
      const [clients, purchaseBills, partyPayments] = await Promise.all([
        getClients(), getPurchaseBills(), getPartyPayments(),
      ]);
      const issues: AuditIssue[] = [];
      for (const client of clients) {
        const cBills = purchaseBills.filter(b => b.clientId === client.id || (b as any).vendorId === client.id);
        if (!cBills.length) continue;

        const totalPurchases = cBills.reduce((s, b) => {
          const ret = (b.returns || []).reduce((rs, r) => rs + (r.totalReturnValue || 0), 0);
          return s + b.total - ret;
        }, 0);
        const totalBillPaid = cBills.reduce((s, b) =>
          s + (b.payments || []).filter(p => p.method !== "Advance Adjustment").reduce((ps, p) => ps + p.amount, 0), 0);
        const remainingAdvance = partyPayments
          .filter(p => p.partyId === client.id && p.type === "sent")
          .reduce((s, p) => s + p.amount, 0);
        const overpaid = Math.round(totalBillPaid - totalPurchases);
        if (overpaid < 2) continue;

        // Find which specific bills are overpaid and which payments to remove
        const overpaidBills: AuditIssue["overpaidBills"] = [];
        for (const bill of cBills) {
          const returns = (bill.returns || []).reduce((rs, r) => rs + (r.totalReturnValue || 0), 0);
          const netTotal = bill.total - returns;
          const realPayments = (bill.payments || []).filter(p => p.method !== "Advance Adjustment");
          const billPaid = realPayments.reduce((s, p) => s + p.amount, 0);
          const excess = Math.round(billPaid - netTotal);
          if (excess < 2) continue;
          // Identify payments to remove (most recent first) until excess is covered
          const sorted = [...realPayments].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          const toRemove: typeof overpaidBills[0]["paymentsToRemove"] = [];
          let remaining = excess;
          for (const p of sorted) {
            if (remaining <= 0) break;
            toRemove.push({ id: p.id, amount: p.amount, method: p.method, date: p.date.split("T")[0] });
            remaining -= p.amount;
          }
          overpaidBills.push({ billId: bill.id, billNumber: bill.billNumber || bill.id, excess, paymentsToRemove: toRemove });
        }

        issues.push({ clientId: client.id, name: client.name, overpaid, totalPurchases, totalBillPaid, remainingAdvance, overpaidBills });
      }
      setAuditResults(issues);
    } catch {
      toast.error("Audit failed");
    } finally {
      setAuditRunning(false);
    }
  };

  const fixAuditIssue = async (issue: AuditIssue) => {
    setAuditFixing(issue.clientId);
    try {
      for (const bill of issue.overpaidBills) {
        for (const p of bill.paymentsToRemove) {
          await deletePurchaseBillPayment(bill.billId, p.id);
        }
      }
      toast.success(`Fixed ${issue.name} — removed ${issue.overpaidBills.reduce((s, b) => s + b.paymentsToRemove.length, 0)} extra payment(s)`);
      await runAdvanceAudit();
    } catch {
      toast.error("Fix failed");
    } finally {
      setAuditFixing(null);
    }
  };
  const [formData, setFormData] = useState<CompanyProfile>({
    id: "1",
    name: "",
    address: "",
    state: "",
    phone: "",
    email: "",
    logo: logo,
    signature: "",
    signatureGst: "",
    upiId: "",
    defaultUnit: "pcs",
    unitOptions: ["pcs"],
    bankDetails: {
      accountHolder: "",
      bankName: "",
      accountNumber: "",
      branchAndIFSC: "",
    },
    themeColor: "#2563eb",
    defaultNote: "",
    commissionSettings: {
      defaultCommissionRate: 5,
      commissionType: "percentage",
      fixedCommissionAmount: 0,
    },
    expenseCategories: [
      "Marketing",
      "Utilities",
      "Rent",
      "Office Supplies",
      "Transportation",
      "Communication",
      "Insurance",
      "Taxes",
      "Maintenance",
      "Miscellaneous",
    ],
    snPrefix: "",
    snCounter: 0,
    snAutoGenerate: true,
    logoSize: 60,
    logoWidth: 60,
    logoHeight: 60,
  });

  const [initialData, setInitialData] = useState<CompanyProfile | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const addressRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = addressRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [formData.address]);

  const getUploadErrorMessage = (error: any): string => {
    const base = error?.message || "Unknown upload error";
    const code = error?.code ? ` (${error.code})` : "";

    if (typeof error?.serverResponse === "string" && error.serverResponse.trim()) {
      try {
        const payload = JSON.parse(error.serverResponse);
        const serverMessage =
          payload?.error?.message ||
          payload?.error?.errors?.[0]?.message ||
          payload?.error?.status;
        if (serverMessage) {
          return `${serverMessage}${code}`;
        }
      } catch {
        return `${base}${code} - ${error.serverResponse}`;
      }
    }

    if (error?.code === "storage/unknown") {
      return `Storage upload failed. Check Firebase Storage bucket and CORS for localhost.${code}`;
    }

    return `${base}${code}`;
  };

  const uploadImageToStorage = async (
    filePath: string,
    file: File,
  ): Promise<string> => {
    const fileRef = ref(storage, filePath);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  };

  const REQUIRED_PROFILE_FIELDS: (keyof CompanyProfile)[] = ["name", "address", "phone", "email"];

  // Guards every write path (image uploads included) against persisting dummy or blank
  // data over the real encrypted profile — e.g. while locked, formData holds decoy values
  // (so the screen doesn't reveal that encryption is active), and if the initial fetch
  // failed/returned empty due to a network blip, formData would be blank in memory while
  // Firestore still holds the real profile. Saving blindly in either case would wipe it.
  const guardedSaveCompanyProfile = async (profile: CompanyProfile): Promise<void> => {
    if (locked) {
      throw new Error("Unable to save. Check your connection.");
    }
    const missingRequired = REQUIRED_PROFILE_FIELDS.some((f) => !String(profile[f] ?? "").trim());
    if (missingRequired && (await companyProfileExists())) {
      throw new Error(
        "Company Name, Address, Phone, and Email can't be blank — a profile already exists in Firestore and saving now would erase it. Reload the page (unlock sync first if prompted) before trying again.",
      );
    }
    await saveCompanyProfile(profile);
  };

  useEffect(() => {
    if (!initialData) return;

    // Create copies to compare
    const currentFormData = { ...formData };
    const referenceData = { ...initialData };

    // JSON.stringify can be unreliable for simple comparisons if key order changes
    // But for React state objects it's usually fine.
    // Let's use a slightly more robust check by comparing keys if needed,
    // but first let's ensure we're actually seeing the changes.
    const hasChanged =
      JSON.stringify(currentFormData) !== JSON.stringify(referenceData);

    console.log("Form check - Dirty:", hasChanged);
    setIsDirty(hasChanged);
  }, [formData, initialData]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file size should be less than 5MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    setUploadingLogo(true);

    try {
      // Create a reference to Firebase Storage
      const timestamp = Date.now();
      const fileName = `company-logos/${timestamp}_${file.name}`;
      // Upload file to Firebase Storage
      const downloadURL = await uploadImageToStorage(fileName, file);

      // Update form data with new logo URL
      const updatedProfile = {
        ...formData,
        logo: downloadURL,
      };

      // Save to Firestore immediately
      await guardedSaveCompanyProfile(updatedProfile);

      // Update local state
      setFormData(updatedProfile);

      toast.success("Logo uploaded successfully!");
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast.error(`Failed to upload logo: ${getUploadErrorMessage(error)}`);
    } finally {
      setUploadingLogo(false);
    }
  };

  // Optional: Delete old logo when uploading new one
  const handleLogoUploadWithCleanup = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file size should be less than 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    setUploadingLogo(true);

    try {
      // Delete old logo if it exists and is from Firebase Storage
      if (formData.logo && formData.logo.includes("firebase")) {
        try {
          const oldLogoRef = ref(storage, formData.logo);
          await deleteObject(oldLogoRef);
        } catch (error) {
          console.log("Old logo not found or already deleted");
        }
      }

      // Upload new logo
      const timestamp = Date.now();
      const fileName = `company-logos/${timestamp}_${file.name}`;
      const downloadURL = await uploadImageToStorage(fileName, file);

      const updatedProfile = {
        ...formData,
        logo: downloadURL,
      };

      await guardedSaveCompanyProfile(updatedProfile);
      setFormData(updatedProfile);

      toast.success("Logo uploaded successfully!");
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast.error(`Failed to upload logo: ${getUploadErrorMessage(error)}`);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSignatureUploadWithCleanup = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Signature file size should be less than 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    setUploadingSignature(true);

    try {
      if (formData.signature && formData.signature.includes("firebase")) {
        try {
          const oldSignatureRef = ref(storage, formData.signature);
          await deleteObject(oldSignatureRef);
        } catch {
          console.log("Old signature not found or already deleted");
        }
      }

      const timestamp = Date.now();
      const fileName = `company-signatures/${timestamp}_${file.name}`;
      const downloadURL = await uploadImageToStorage(fileName, file);

      const updatedProfile = {
        ...formData,
        signature: downloadURL,
      };

      await guardedSaveCompanyProfile(updatedProfile);
      setFormData(updatedProfile);

      toast.success("Signature uploaded successfully!");
    } catch (error: any) {
      console.error("Error uploading signature:", error);
      toast.error(`Failed to upload signature: ${getUploadErrorMessage(error)}`);
    } finally {
      setUploadingSignature(false);
      e.target.value = "";
    }
  };

  const handleGstSignatureUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Signature file size should be less than 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    setUploadingGstSignature(true);
    try {
      if (formData.signatureGst && formData.signatureGst.includes("firebase")) {
        try {
          const oldRef = ref(storage, formData.signatureGst);
          await deleteObject(oldRef);
        } catch {
          console.log("Old GST signature not found or already deleted");
        }
      }

      const timestamp = Date.now();
      const fileName = `company-signatures/gst_${timestamp}_${file.name}`;
      const downloadURL = await uploadImageToStorage(fileName, file);

      const updatedProfile = { ...formData, signatureGst: downloadURL };
      await guardedSaveCompanyProfile(updatedProfile);
      setFormData(updatedProfile);
      toast.success("GST signature uploaded successfully!");
    } catch (error: any) {
      console.error("Error uploading GST signature:", error);
      toast.error(`Failed to upload GST signature: ${getUploadErrorMessage(error)}`);
    } finally {
      setUploadingGstSignature(false);
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (locked) {
      // Show plausible dummy settings instead of blank/undecryptable data — keeps the
      // encrypted state invisible to anyone looking at the screen.
      setFormData(dummyCompanyProfile);
      setInitialData(dummyCompanyProfile);
      return;
    }
    const loadProfile = async () => {
      const profile = await getCompanyProfile();
      if (profile) {
        const fullProfile = {
          ...profile,
          upiId: profile.upiId || "",
          signature: profile.signature || "",
          defaultUnit: "pcs",
          unitOptions: ["pcs"],
          commissionSettings: profile.commissionSettings || {
            defaultCommissionRate: 5,
            commissionType: "percentage",
            fixedCommissionAmount: 0,
          },
          expenseCategories: profile.expenseCategories || [
            "Marketing",
            "Utilities",
            "Rent",
            "Office Supplies",
            "Transportation",
            "Communication",
            "Insurance",
            "Taxes",
            "Maintenance",
            "Miscellaneous",
          ],
          snPrefix: profile.snPrefix || "",
          snCounter: profile.snCounter ?? 0,
          snAutoGenerate: profile.snAutoGenerate !== false,
          logoSize: profile.logoSize ?? 60,
          logoWidth: profile.logoWidth ?? profile.logoSize ?? 60,
          logoHeight: profile.logoHeight ?? profile.logoSize ?? 60,
        };
        setFormData(fullProfile);
        setInitialData(fullProfile);
      }
    };
    loadProfile();

    // Load session expiry time
    const expiryTime = localStorage.getItem("sessionExpiry");
    if (expiryTime) {
      setSessionExpiry(new Date(parseInt(expiryTime, 10)));
    }

    // Update session expiry display every minute
    const interval = setInterval(() => {
      const expiry = localStorage.getItem("sessionExpiry");
      if (expiry) {
        setSessionExpiry(new Date(parseInt(expiry, 10)));
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [locked, reloadKey]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    // Reset SN counter when prefix changes
    const dataToSave = { ...formData };
    if (initialData && formData.snPrefix !== initialData.snPrefix) {
      dataToSave.snCounter = 0;
    }
    try {
      await guardedSaveCompanyProfile(dataToSave);
      setFormData(dataToSave);
      setInitialData(dataToSave);
      setIsDirty(false);
      toast.success("Settings saved successfully!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
    navigate("/auth", { replace: true });
  };

  const getSessionTimeRemaining = (): string => {
    if (!sessionExpiry) return "Unknown";
    const now = Date.now();
    const expiry = sessionExpiry.getTime();
    const remaining = expiry - now;

    if (remaining <= 0) return "Expired";

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const updateCommissionSettings = (field: string, value: any) => {
    setFormData({
      ...formData,
      commissionSettings: {
        ...formData.commissionSettings!,
        [field]: value,
      },
    });
  };


  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+64px)] right-4 z-[100] lg:bottom-6 lg:right-6">
        <Button
          onClick={() => handleSubmit()}
          loading={saving}
          size="lg"
          className="rounded-full h-12 px-5 shadow-2xl transition-all hover:scale-105 active:scale-95 bg-primary hover:bg-primary/90 text-primary-foreground gap-2 ring-4 ring-primary/20 duration-300"
        >
          <Save className="h-4 w-4" />
          <span className="font-semibold text-sm">Save</span>
        </Button>
      </div>

      {/* Header */}
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-background p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">Settings</h1>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2">
        <div className="h-full overflow-y-auto space-y-3 pb-24 w-full overflow-x-hidden">
            {/* Profile Card */}
            <Card className="overflow-hidden shadow-sm">
              {/* Banner */}
              <div className="h-16 bg-gradient-to-r from-primary/15 via-primary/8 to-purple-500/10" />

              <CardContent className="px-5 pb-5 -mt-8">
                {/* Top row: logo + company info */}
                <div className="flex gap-4 items-end">
                  {/* Logo */}
                  <div className="relative group shrink-0">
                    <div className="h-20 w-20 rounded-2xl border-4 border-background shadow-md overflow-hidden bg-muted/60 flex items-center justify-center">
                      <img
                        src={formData.logo || logo}
                        alt="Company Logo"
                        className="h-full w-full object-contain p-1.5"
                      />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUploadWithCleanup}
                      className="hidden"
                      id="logo-upload"
                      disabled={uploadingLogo}
                    />
                    <Label
                      htmlFor="logo-upload"
                      className={`cursor-pointer ${uploadingLogo ? "pointer-events-none" : ""}`}
                    >
                      <div className="absolute inset-0 bg-black/55 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                        {uploadingLogo
                          ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                          : <Upload className="h-5 w-5 text-white" />}
                      </div>
                    </Label>
                  </div>

                  {/* Company name + contacts */}
                  <div className="flex-1 min-w-0 pb-1 space-y-1">
                    <h2 className="text-base font-bold leading-tight truncate">
                      {formData.name || "Your Company"}
                    </h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {formData.email && (
                        <span className="flex items-center gap-1 min-w-0">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{formData.email}</span>
                        </span>
                      )}
                      {formData.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0" />
                          {formData.phone}
                        </span>
                      )}
                    </div>
                    {formData.address && (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0 mt-px" />
                        <span className="leading-snug">{formData.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Signatures row */}
                <div className="mt-4 pt-4 border-t flex gap-3">
                  {/* Non-GST Signature */}
                  <div className="flex-1 min-w-0">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Non-GST Signature</p>
                    <div className="rounded-xl border border-dashed bg-muted/30 p-2">
                      <div className="h-12 w-full rounded-lg bg-background flex items-center justify-center overflow-hidden">
                        {formData.signature
                          ? <img src={formData.signature} alt="Non-GST Signature" className="h-full w-full object-contain" />
                          : <span className="text-[10px] text-muted-foreground">No signature</span>}
                      </div>
                      <input type="file" accept="image/*" onChange={handleSignatureUploadWithCleanup} className="hidden" id="signature-upload" disabled={uploadingSignature} />
                      <Label htmlFor="signature-upload" className={`mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-lg border bg-background px-2 py-1 text-[11px] font-medium cursor-pointer hover:bg-muted transition-colors ${uploadingSignature ? "pointer-events-none opacity-60" : ""}`}>
                        {uploadingSignature ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Upload className="h-3 w-3" />{formData.signature ? "Change" : "Upload"}</>}
                      </Label>
                    </div>
                  </div>

                  {/* GST Signature */}
                  <div className="flex-1 min-w-0">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">GST Signature</p>
                    <div className="rounded-xl border border-dashed border-blue-300/70 dark:border-blue-700/50 bg-blue-50/30 dark:bg-blue-950/15 p-2">
                      <div className="h-12 w-full rounded-lg bg-background flex items-center justify-center overflow-hidden">
                        {formData.signatureGst
                          ? <img src={formData.signatureGst} alt="GST Signature" className="h-full w-full object-contain" />
                          : <span className="text-[10px] text-muted-foreground">{formData.signature ? "Uses Non-GST" : "No signature"}</span>}
                      </div>
                      <input type="file" accept="image/*" onChange={handleGstSignatureUpload} className="hidden" id="gst-signature-upload" disabled={uploadingGstSignature} />
                      <Label htmlFor="gst-signature-upload" className={`mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-lg border bg-background px-2 py-1 text-[11px] font-medium cursor-pointer hover:bg-muted transition-colors ${uploadingGstSignature ? "pointer-events-none opacity-60" : ""}`}>
                        {uploadingGstSignature ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Upload className="h-3 w-3" />{formData.signatureGst ? "Change" : "Upload"}</>}
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Company Information */}
              <Card className="border shadow-md hover:shadow-lg transition-shadow w-full max-w-full overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-purple-500/5 border-b px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-3 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                    Company Information
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm break-words">
                    Basic company details and contact information
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 sm:pt-5 md:pt-6 space-y-3 sm:space-y-4 p-4 sm:p-5 md:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs sm:text-sm">
                        <Hash className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                        Company Name *
                      </Label>
                      <Input
                        required
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="h-10 sm:h-11 text-sm"
                      />
                    </div>

                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Address *</Label>
                    <Textarea
                      ref={addressRef}
                      required
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      rows={2}
                      className="resize-none overflow-hidden text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">State *</Label>
                      <Input
                        required
                        value={formData.state}
                        onChange={(e) =>
                          setFormData({ ...formData, state: e.target.value })
                        }
                        placeholder="Gujarat"
                        className="h-10 sm:h-11 text-sm"
                      />
                    </div>


                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs sm:text-sm">
                        <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                        Phone *
                      </Label>
                      <Input
                        required
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        className="h-10 sm:h-11 text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs sm:text-sm">
                        <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                        Email *
                      </Label>
                      <Input
                        required
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        className="h-10 sm:h-11 text-sm"
                      />
                    </div>

                    {/* GSTIN */}
                    <div className="space-y-1.5">
                      <Label className="text-xs sm:text-sm font-medium">
                        GSTIN
                      </Label>
                      <Input
                        value={formData.gstin || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, gstin: e.target.value.toUpperCase().slice(0, 15) })
                        }
                        placeholder="22AAAAA0000A1Z5"
                        className={`h-10 sm:h-11 text-sm font-mono ${formData.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstin) ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                        maxLength={15}
                      />
                      {formData.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstin) && (
                        <p className="text-[10px] text-red-500">Invalid GSTIN format. Expected: 22AAAAA0000A1Z5</p>
                      )}
                      {(!formData.gstin || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstin)) && (
                        <p className="text-[10px] text-muted-foreground">Required for GST Tax Invoices. Leave blank if not registered.</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bank Details section removed - managed in Banks page */}

            

              {/* Commission Settings - NEW */}
              <Card className="border shadow-md hover:shadow-lg transition-shadow border-purple-200 dark:border-purple-800">
                <CardHeader className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Percent className="h-4 w-4 text-purple-600" />
                    Commission Settings
                  </CardTitle>
                  <CardDescription>
                    Set default commission rates for sales and transactions
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 md:pt-6 space-y-4 md:space-y-6 p-4 md:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        Commission Type *
                      </Label>
                      <Select
                        value={
                          formData.commissionSettings?.commissionType ||
                          "percentage"
                        }
                        onValueChange={(value: "percentage" | "fixed") =>
                          updateCommissionSettings("commissionType", value)
                        }
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">
                            <div className="flex items-center gap-2">
                              <Percent className="h-4 w-4" />
                              Percentage
                            </div>
                          </SelectItem>
                          <SelectItem value="fixed">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              Fixed Amount
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Choose how commission is calculated
                      </p>
                    </div>

                    {formData.commissionSettings?.commissionType ===
                    "percentage" ? (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Percent className="h-4 w-4" />
                          Default Commission Rate (%)
                        </Label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={
                              formData.commissionSettings
                                ?.defaultCommissionRate || 0
                            }
                            onChange={(e) =>
                              updateCommissionSettings(
                                "defaultCommissionRate",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="h-11 pr-8"
                            placeholder="5.00"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            %
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Default commission percentage applied to sales
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Fixed Commission Amount (₹)
                        </Label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={
                              formData.commissionSettings
                                ?.fixedCommissionAmount || 0
                            }
                            onChange={(e) =>
                              updateCommissionSettings(
                                "fixedCommissionAmount",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="h-11 pl-6"
                            placeholder="0.00"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            ₹
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Fixed commission amount per transaction
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <Percent className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground mb-1">
                          Commission Preview
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formData.commissionSettings?.commissionType ===
                          "percentage" ? (
                            <>
                              A commission of{" "}
                              <span className="font-semibold text-purple-600">
                                {formData.commissionSettings
                                  ?.defaultCommissionRate || 0}
                                %
                              </span>{" "}
                              will be applied to all sales by default.
                            </>
                          ) : (
                            <>
                              A fixed commission of{" "}
                              <span className="font-semibold text-purple-600">
                                ₹
                                {formData.commissionSettings
                                  ?.fixedCommissionAmount || 0}
                              </span>{" "}
                              will be applied per transaction by default.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Serial Number Settings */}
              <Card className="border shadow-md hover:shadow-lg transition-shadow w-full max-w-full overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-green-500/5 to-teal-500/5 border-b px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-3 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Hash className="h-4 w-4 text-green-600 flex-shrink-0" />
                    Serial Number (SN) Settings
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Auto-generate serial numbers for purchased items
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 sm:pt-5 space-y-3 sm:space-y-4 p-4 sm:p-5 md:p-6">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs sm:text-sm">
                      <Hash className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                      SN Prefix
                    </Label>
                    <Input
                      value={formData.snPrefix || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          snPrefix: e.target.value.toUpperCase().slice(0, 10),
                        })
                      }
                      placeholder="e.g. AM"
                      className="h-10 sm:h-11 uppercase max-w-xs"
                      maxLength={10}
                    />
                    <p className="text-xs text-muted-foreground">
                      Changing prefix will reset counter to 0 (new sequence starts from 01)
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Auto-generate SN on Purchase</Label>
                      <p className="text-xs text-muted-foreground">
                        When ON, SN is auto-assigned to each item during purchase
                      </p>
                    </div>
                    <Switch
                      checked={formData.snAutoGenerate !== false}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, snAutoGenerate: checked })
                      }
                      disabled={!formData.snPrefix}
                    />
                  </div>
                  {formData.snPrefix && (
                    <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-xs text-muted-foreground">
                        Next SN will be:{" "}
                        <span className="font-mono font-semibold text-green-700 dark:text-green-400 text-sm">
                          {formData.snPrefix}-{String((formData.snCounter ?? 0) + 1).padStart(2, "0")}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          (Counter: {formData.snCounter ?? 0})
                        </span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Billing Mode */}
              {/* <Card className="border shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border-b">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-blue-600" />
                    Billing Mode
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Non-tax billing mode for all invoices
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 md:pt-6 p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-1 flex-1">
                      <Label className="text-base">Tax on bills</Label>
                      <p className="text-sm text-muted-foreground">
                      </p>
                    </div>
                    <Switch
                      checked={false}
                      disabled
                    />
                  </div>
                </CardContent>
              </Card> */}

              {/* Bill Settings */}
              <Card className="border shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="bg-gradient-to-r from-orange-500/5 to-red-500/5 border-b">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <FileText className="h-5 w-5 text-orange-600" />
                    Bill Settings
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Customize bill appearance and default content
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 md:pt-6 space-y-4 md:space-y-6 p-4 md:p-6">
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Bill Header Color
                    </Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="relative flex-shrink-0">
                        <Input
                          type="color"
                          value={formData.themeColor}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              themeColor: e.target.value,
                            })
                          }
                          className="w-20 h-12 sm:w-24 cursor-pointer rounded-lg border-2 border-border"
                        />
                      </div>
                      <div className="flex-1 w-full sm:w-auto">
                        <Input
                          type="text"
                          value={formData.themeColor}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              themeColor: e.target.value,
                            })
                          }
                          className="h-11 font-mono w-full"
                          placeholder="#2563eb"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          This color will be used for bill headers and
                          highlights
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Logo Size */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Logo Size
                    </Label>
                    <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground w-12 shrink-0">Width</span>
                        <input
                          type="range"
                          min={20}
                          max={200}
                          step={4}
                          value={formData.logoWidth ?? formData.logoSize ?? 60}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              logoWidth: Number(e.target.value),
                            })
                          }
                          className="flex-1 accent-primary"
                        />
                        <span className="text-sm font-mono w-14 text-right shrink-0">
                          {formData.logoWidth ?? formData.logoSize ?? 60}px
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground w-12 shrink-0">Height</span>
                        <input
                          type="range"
                          min={20}
                          max={120}
                          step={4}
                          value={formData.logoHeight ?? formData.logoSize ?? 60}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              logoHeight: Number(e.target.value),
                            })
                          }
                          className="flex-1 accent-primary"
                        />
                        <span className="text-sm font-mono w-14 text-right shrink-0">
                          {formData.logoHeight ?? formData.logoSize ?? 60}px
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground flex-1">
                          Controls logo size in bills, PDFs, and sidebar
                        </p>
                        {formData.logo && (
                          <img
                            src={formData.logo}
                            alt="Logo preview"
                            style={{
                              width: formData.logoWidth ?? formData.logoSize ?? 60,
                              height: formData.logoHeight ?? formData.logoSize ?? 60,
                            }}
                            className="object-contain rounded-md border border-border shrink-0"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Default Bill Note</Label>
                    <Textarea
                      value={formData.defaultNote || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          defaultNote: e.target.value,
                        })
                      }
                      placeholder="Enter default note that will appear on all bills (e.g., Thank you for your business! Payment due within the mentioned terms.)"
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      This note will automatically appear on all new bills
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Expense Categories Settings */}
              <Card className="border shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="bg-gradient-to-r from-green-500/5 to-emerald-500/5 border-b">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Expense Categories
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Customize expense categories for better expense tracking
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 md:pt-6 space-y-4 md:space-y-6 p-4 md:p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <Label className="text-base">Expense Categories</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="default"
                        onClick={() => {
                          const newCategory = prompt(
                            "Enter new expense category:",
                          );
                          if (newCategory && newCategory.trim()) {
                            const trimmed = newCategory.trim();
                            const exists = (formData.expenseCategories || []).some(
                              (c) => c.toLowerCase() === trimmed.toLowerCase()
                            );
                            if (exists) {
                              alert(`"${trimmed}" already exists.`);
                              return;
                            }
                            setFormData({
                              ...formData,
                              expenseCategories: [
                                ...(formData.expenseCategories || []),
                                trimmed,
                              ],
                            });
                          }
                        }}
                        className="w-full sm:w-auto"
                      >
                        Add Category
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {(formData.expenseCategories || []).map(
                        (category, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border"
                          >
                            <span className="flex-1 text-sm font-medium">
                              {category}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updatedCategories = (
                                  formData.expenseCategories || []
                                ).filter((_, i) => i !== index);
                                setFormData({
                                  ...formData,
                                  expenseCategories: updatedCategories,
                                });
                              }}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            >
                              ×
                            </Button>
                          </div>
                        ),
                      )}
                    </div>

                    <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground mb-1">
                            Expense Categories Info
                          </p>
                          <p className="text-xs text-muted-foreground">
                            These categories will be available when adding
                            expenses. You can add, remove, or modify categories
                            as needed for your business.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bill Series Repair */}
              <Card className="border shadow-md hover:shadow-lg transition-shadow border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-b">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Hash className="h-5 w-5 text-blue-600" />
                    Bill Series Repair
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Sync bill number counters with actual bills in database. Run this if your CA reports gaps in GST or regular bill series (e.g. missing bill #2 between #1 and #3).
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 md:pt-6 p-4 md:p-6 space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-semibold mb-1">Why gaps happen</p>
                    <p>When a bill is deleted, its number is not reused — so the series skips that number. This button scans all existing bills, finds the highest GST and non-GST bill numbers, and resets the counters to continue from there. It does NOT change any bill data.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={repairingCounters}
                    onClick={async () => {
                      setRepairingCounters(true);
                      setRepairResult(null);
                      try {
                        const result = await repairBillCounters();
                        setRepairResult(result);
                        toast.success("Bill counters repaired successfully");
                      } catch {
                        toast.error("Failed to repair bill counters");
                      } finally {
                        setRepairingCounters(false);
                      }
                    }}
                    className="w-full sm:w-auto border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    {repairingCounters ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scanning bills...</>
                    ) : (
                      <><Hash className="mr-2 h-4 w-4" />Repair Bill Series</>
                    )}
                  </Button>
                  {repairResult && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3 text-sm">
                      <p className="font-semibold text-emerald-800 dark:text-emerald-300 mb-2">Counters updated</p>
                      <div className="space-y-1 text-emerald-700 dark:text-emerald-400 text-xs">
                        <p>GST bill series: last number is <strong>GST-{new Date().getFullYear()}-{String(repairResult.gst).padStart(3, "0")}</strong> → next will be <strong>GST-{new Date().getFullYear()}-{String(repairResult.gst + 1).padStart(3, "0")}</strong></p>
                        <p>Regular bill series: last number is <strong>INV-{new Date().getFullYear()}-{String(repairResult.nonGst).padStart(3, "0")}</strong> → next will be <strong>INV-{new Date().getFullYear()}-{String(repairResult.nonGst + 1).padStart(3, "0")}</strong></p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Advance Payment Audit */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <SearchCheck className="h-4 w-4 text-orange-500" />
                    Advance Payment Audit
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Finds parties where bill payments exceed total purchases — indicates a lost advance payment (caused by the Sync bug).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={runAdvanceAudit}
                    disabled={auditRunning}
                    className="w-full sm:w-auto border-orange-300 text-orange-700 hover:bg-orange-50"
                  >
                    {auditRunning ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scanning parties...</>
                    ) : (
                      <><SearchCheck className="mr-2 h-4 w-4" />Run Audit</>
                    )}
                  </Button>

                  {auditResults !== null && (
                    auditResults.length === 0 ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm text-emerald-700 flex items-center gap-2">
                        ✅ No anomalies found — no parties have duplicate/extra bill payments.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-orange-700 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {auditResults.length} party/parties with overpaid bills:
                        </p>
                        {auditResults.map((r) => (
                          <div key={r.clientId} className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-orange-800">{r.name}</p>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="h-6 text-[11px] px-2"
                                disabled={auditFixing === r.clientId}
                                onClick={() => fixAuditIssue(r)}
                              >
                                {auditFixing === r.clientId ? (
                                  <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Fixing...</>
                                ) : (
                                  "Remove Extra Payments"
                                )}
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-orange-700">
                              <span>Total Purchases:</span><span className="font-mono">Rs.{r.totalPurchases.toLocaleString("en-IN")}</span>
                              <span>Bill Payments Sent:</span><span className="font-mono">Rs.{r.totalBillPaid.toLocaleString("en-IN")}</span>
                              <span>Overpaid by:</span><span className="font-mono font-bold text-red-700">Rs.{r.overpaid.toLocaleString("en-IN")}</span>
                            </div>
                            {r.overpaidBills.map(b => (
                              <div key={b.billId} className="border border-orange-200 rounded p-2 space-y-1 bg-white/50">
                                <p className="font-medium text-orange-800">Bill #{b.billNumber} — excess Rs.{b.excess.toLocaleString("en-IN")}</p>
                                <p className="text-orange-600 text-[11px]">Will remove:</p>
                                {b.paymentsToRemove.map(p => (
                                  <p key={p.id} className="text-[11px] text-red-700 font-mono pl-2">
                                    − Rs.{p.amount.toLocaleString("en-IN")} ({p.method}) on {p.date}
                                  </p>
                                ))}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            </form>
          </div>
      </div>
    </div>
  );
}
