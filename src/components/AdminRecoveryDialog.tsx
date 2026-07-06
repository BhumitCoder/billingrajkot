import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Eye, EyeOff, ShieldCheck, KeyRound, Copy, CheckCheck, XCircle, Loader2, ShieldOff,
} from "lucide-react";
import { decryptRecoveryBlob } from "@/lib/crypto";
import { getKeyRecoveryBlob } from "@/lib/storage";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type State = "checking" | "no-encryption" | "ready" | "recovered";

export function AdminRecoveryDialog({ open, onOpenChange }: Props) {
  const [state, setState] = useState<State>("checking");
  const [adminKey, setAdminKey] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveredKey, setRecoveredKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setState("checking");
    setAdminKey(""); setError(""); setRecoveredKey(null); setCopied(false);

    getKeyRecoveryBlob().then((blob) => {
      setState(blob ? "ready" : "no-encryption");
    });
  }, [open]);

  const handleRecover = async () => {
    setError("");
    if (!adminKey.trim()) { setError("Enter the admin master key"); return; }

    setRecovering(true);
    try {
      const blob = await getKeyRecoveryBlob();
      if (!blob) { setState("no-encryption"); setRecovering(false); return; }
      const userKey = await decryptRecoveryBlob(blob, adminKey.trim());
      setRecoveredKey(userKey);
      setState("recovered");
    } catch {
      setError("Wrong admin master key — decryption failed.");
    } finally {
      setRecovering(false);
    }
  };

  const handleCopy = async () => {
    if (!recoveredKey) return;
    await navigator.clipboard.writeText(recoveredKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Key copied to clipboard.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <KeyRound className="h-4 w-4 text-primary" />
            Admin Key Recovery
          </DialogTitle>
        </DialogHeader>

        {/* Checking */}
        {state === "checking" && (
          <div className="flex items-center justify-center gap-3 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking…
          </div>
        )}

        {/* No encryption configured */}
        {state === "no-encryption" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-3">
              <ShieldOff className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">No encryption set</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This client has not configured an encryption key yet. There is nothing to recover.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" className="h-9 text-sm" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        )}

        {/* Admin key input */}
        {state === "ready" && (
          <div className="space-y-4">
            <DialogDescription className="text-xs">
              Enter the admin master key to decrypt and reveal the user's original encryption key.
            </DialogDescription>
            <div className="space-y-1.5">
              <Label className="text-xs">Admin master key</Label>
              <div className="relative">
                <Input
                  type={showAdmin ? "text" : "password"}
                  placeholder="Enter admin master key…"
                  value={adminKey}
                  onChange={(e) => { setAdminKey(e.target.value); setError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRecover(); }}
                  className="pr-9 text-sm"
                  autoComplete="current-password"
                  autoFocus
                />
                <button type="button" onClick={() => setShowAdmin(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showAdmin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2">
                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-px" />
                <p className="text-[11px] text-destructive leading-snug">{error}</p>
              </div>
            )}
            <Button onClick={handleRecover} disabled={recovering} className="w-full h-9 text-sm">
              {recovering
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />Decrypting…</>
                : "Recover Key"}
            </Button>
          </div>
        )}

        {/* Recovered */}
        {state === "recovered" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-xs font-medium text-green-700 dark:text-green-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              Recovery successful
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">User's encryption key</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={recoveredKey ?? ""}
                  readOnly
                  className="text-sm font-mono bg-muted"
                />
                <Button variant="outline" size="icon" onClick={handleCopy} className="h-9 w-9 shrink-0">
                  {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Share this key with the user so they can restore access.
              </p>
            </div>
            <Button variant="outline" className="w-full h-9 text-sm" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
