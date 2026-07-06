import { useState, useEffect } from "react";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";
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
  Eye, EyeOff, KeyRound, ShieldOff, ShieldCheck,
  AlertTriangle, XCircle, PhoneCall, ShieldAlert, Loader2,
} from "lucide-react";
import {
  setEncryptionKey,
  resetEncryptionState,
  isEncryptionConfigured,
  isEncryptionActive,
  isEncryptionKeyLoaded,
  verifyEncryptionKey,
  startEncryption,
  createRecoveryBlob,
} from "@/lib/crypto";
import { hasUnencryptedData, saveKeyRecoveryBlob, saveEncryptionConfig } from "@/lib/storage";
import { getVerifyToken } from "@/lib/crypto";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type DialogState = "loading" | "has-plain-data" | "no-key" | "key-set-inactive" | "active" | "locked";

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
      {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  );
}

export function EncryptionKeyDialog({ open, onOpenChange }: Props) {
  const { refresh: refreshLock } = useEncryptionLock();
  const [state, setState] = useState<DialogState>("loading");
  const [key, setKey] = useState("");
  const [confirm, setConfirm] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyError, setKeyError] = useState("");

  useEffect(() => {
    if (!open) return;
    setState("loading");
    setKey(""); setConfirm(""); setAdminKey(""); setKeyError("");

    const detect = async () => {
      if (isEncryptionActive() && !isEncryptionKeyLoaded()) { setState("locked"); return; }
      if (isEncryptionActive()) { setState("active"); return; }
      const plainDataExists = await hasUnencryptedData();
      if (plainDataExists) { setState("has-plain-data"); return; }
      setState(isEncryptionConfigured() ? "key-set-inactive" : "no-key");
    };
    detect();
  }, [open]);

  const handleSetKey = async () => {
    setKeyError("");
    if (!key.trim()) { setKeyError("DEK cannot be empty"); return; }
    if (key.length < 6) { setKeyError("DEK must be at least 6 characters"); return; }
    if (key !== confirm) { setKeyError("DEKs do not match"); return; }
    if (!adminKey.trim()) { setKeyError("Admin DEK is required"); return; }
    if (adminKey.length < 8) { setKeyError("Admin DEK must be at least 8 characters"); return; }

    setSaving(true);
    try {
      await setEncryptionKey(key.trim());
      const blob = await createRecoveryBlob(key.trim(), adminKey.trim());
      await saveKeyRecoveryBlob(blob);
      await saveEncryptionConfig(getVerifyToken(), false);
      toast.success("DEK saved successfully.");
      refreshLock();
      setKey(""); setConfirm(""); setAdminKey("");
      setState("key-set-inactive");
    } catch {
      toast.error("Failed to save DEK. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async () => {
    startEncryption();
    await saveEncryptionConfig(getVerifyToken(), true).catch(() => {});
    refreshLock();
    setState("active");
    toast.success("Sync started.");
  };

  const handleRemove = () => {
    resetEncryptionState();
    saveEncryptionConfig("", false).catch(() => {});
    refreshLock();
    setState("no-key");
    toast.success("DEK removed.");
  };

  const handleUnlock = async () => {
    if (!key.trim()) { setKeyError("Please enter your DEK"); return; }
    setSaving(true);
    try {
      const valid = await verifyEncryptionKey(key.trim());
      if (!valid) { setKeyError("Wrong DEK — try again."); return; }
      await setEncryptionKey(key.trim());
      // Persist encMeta to Firestore so future fresh browsers auto-restore
      await saveEncryptionConfig(getVerifyToken(), true).catch(() => {});
      refreshLock();
      toast.success("Unlocked. Data is now accessible.");
      setKey("");
      onOpenChange(false);
    } catch {
      setKeyError("Failed to unlock. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); onOpenChange(v); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-primary" />
              Sync Data
            </DialogTitle>
          </DialogHeader>

          {/* ── Loading ── */}
          {state === "loading" && (
            <div className="flex items-center justify-center py-8 gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Please wait…
            </div>
          )}

          {/* ── Locked ── */}
          {state === "locked" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                Enter your DEK to access your data
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your data is protected. Enter the DEK you set up to continue.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Your DEK</Label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder="Enter your DEK…"
                    value={key}
                    onChange={(e) => { setKey(e.target.value); setKeyError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleUnlock(); }}
                    className="pr-9 text-sm"
                    autoFocus
                  />
                  <EyeToggle show={showKey} onToggle={() => setShowKey(v => !v)} />
                </div>
              </div>
              {keyError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2">
                  <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-px" />
                  <p className="text-[11px] text-destructive leading-snug">{keyError}</p>
                </div>
              )}
              <Button onClick={handleUnlock} disabled={saving} className="w-full h-9 text-sm">
                {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Syncing...</> : "Sync"}
              </Button>
            </div>
          )}

          {/* ── Has existing plain data ── */}
          {state === "has-plain-data" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Existing data found</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    Data sync can only be set up on a fresh account with no existing records.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-3">
                <PhoneCall className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">Contact admin</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Ask the admin to clear the existing data. Once done, come back here to set up sync.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" className="h-9 text-sm" onClick={close}>Close</Button>
              </div>
            </div>
          )}

          {/* ── No DEK configured yet ── */}
          {state === "no-key" && (
            <div className="space-y-4">
              <DialogDescription className="text-xs">
                Set a DEK to protect your data. Once active, all new records will be secured.
              </DialogDescription>

              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <ShieldOff className="h-3.5 w-3.5 shrink-0" /> No DEK set
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Your DEK</Label>
                  <div className="relative">
                    <Input type={showKey ? "text" : "password"} placeholder="Min 6 characters…"
                      value={key} onChange={(e) => { setKey(e.target.value); setKeyError(""); }}
                      className="pr-9 text-sm" autoComplete="new-password" />
                    <EyeToggle show={showKey} onToggle={() => setShowKey(v => !v)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Confirm DEK</Label>
                  <Input type={showKey ? "text" : "password"} placeholder="Repeat DEK…"
                    value={confirm} onChange={(e) => { setConfirm(e.target.value); setKeyError(""); }}
                    className="text-sm" autoComplete="new-password" />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-background px-2 text-muted-foreground tracking-widest">Admin Recovery</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Admin DEK</Label>
                <div className="relative">
                  <Input type={showAdmin ? "text" : "password"} placeholder="Admin's DEK (min 8 chars)…"
                    value={adminKey} onChange={(e) => { setAdminKey(e.target.value); setKeyError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSetKey(); }}
                    className="pr-9 text-sm" autoComplete="new-password" />
                  <EyeToggle show={showAdmin} onToggle={() => setShowAdmin(v => !v)} />
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Only the admin knows this. Used to recover your DEK if you ever forget it.
                </p>
              </div>

              {keyError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2">
                  <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-px" />
                  <p className="text-[11px] text-destructive leading-snug">{keyError}</p>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-px" />
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                  Write down your DEK. Only the admin can recover it if lost.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSetKey} disabled={saving} className="h-9 text-sm">
                  {saving ? "Saving…" : "Save DEK"}
                </Button>
              </div>
            </div>
          )}

          {/* ── DEK saved, not started ── */}
          {state === "key-set-inactive" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                DEK saved — sync not started yet
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your DEK is saved. Click <strong>Start Sync</strong> to begin protecting your data.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleStart} className="flex-1 h-9 text-sm">Start Sync</Button>
                <Button variant="outline" onClick={handleRemove}
                  className="h-9 text-sm text-destructive border-destructive/30 hover:bg-destructive/10">
                  Remove DEK
                </Button>
              </div>
            </div>
          )}

          {/* ── Sync active ── */}
          {state === "active" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-xs font-medium text-green-700 dark:text-green-400">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                Sync active — data is protected
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your data is protected. All new records are secured automatically.
              </p>
              <Button variant="outline" onClick={close} className="w-full h-9 text-sm">Close</Button>
            </div>
          )}

        </DialogContent>
    </Dialog>
  );
}
