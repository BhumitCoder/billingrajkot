import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { getUserPreference, setUserPreference } from "@/lib/storage";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkPWAStatus = async () => {
      // Check if already installed
      const isStandalone = window.matchMedia(
        "(display-mode: standalone)",
      ).matches;
      const isDismissed = await getUserPreference("pwa-install-dismissed");
      const isAlreadyInstalled = await getUserPreference("pwa-installed");

      if (isStandalone || isAlreadyInstalled === "true") {
        setIsInstalled(true);
        return;
      }

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);

        // Only show dialog if not dismissed before
        if (isDismissed !== "true") {
          setShowDialog(true);
        }
      };

      const handleAppInstalled = async () => {
        setIsInstalled(true);
        setShowDialog(false);
        await setUserPreference("pwa-installed", "true");
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
        window.removeEventListener(
          "beforeinstallprompt",
          handleBeforeInstallPrompt,
        );
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    };
    checkPWAStatus();
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
      await setUserPreference("pwa-installed", "true");
    }

    setDeferredPrompt(null);
    setShowDialog(false);
  };

  const handleDismiss = async () => {
    setShowDialog(false);
    await setUserPreference("pwa-install-dismissed", "true");
  };

  if (isInstalled) return null;

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Install MAA App
          </DialogTitle>
          <DialogDescription>
            Install MAA on your device for quick access and offline
            functionality. Get the full app experience!
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-4">
          <Button onClick={handleInstall} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Install Now
          </Button>
          <Button variant="outline" onClick={handleDismiss} className="w-full">
            <X className="h-4 w-4 mr-2" />
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
