"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Smartphone, Share, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "tg.pwa.installDismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "android" | "ios" | "desktop" | null;

function detectMode(): Mode {
  if (typeof window === "undefined") return null;
  // Already installed?
  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari sets navigator.standalone when launched from home screen
    (window.navigator as Navigator & { standalone?: boolean }).standalone
  ) {
    return null;
  }
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  if (isIos) return "ios";
  if (isAndroid) return "android";
  return "desktop";
}

export function PwaInstallPrompt() {
  const [mode, setMode] = useState<Mode>(null);
  const [bipEvent, setBipEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMode(detectMode());
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");

    const onBip = (e: Event) => {
      e.preventDefault();
      setBipEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    const onInstalled = () => {
      setBipEvent(null);
      setMode(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function onInstallClick() {
    if (mode === "ios") {
      setShowIosSheet(true);
      return;
    }
    if (bipEvent) {
      await bipEvent.prompt();
      const { outcome } = await bipEvent.userChoice;
      if (outcome === "accepted") {
        setBipEvent(null);
      }
    }
  }

  // Don't render if already installed, dismissed, or on desktop without prompt
  if (!mode || dismissed) return null;
  // Android needs the captured beforeinstallprompt event; if browser didn't
  // fire it (unsupported / already installed / criteria not met), hide.
  if (mode === "android" && !bipEvent) return null;
  // Desktop only shows if browser fired the install event.
  if (mode === "desktop" && !bipEvent) return null;

  return (
    <>
      <div
        className={cn(
          // Mobile: clears the SearchFab (which sits at bottom-[50px] right-[50px], ~h-12)
          // Desktop sm+: floating top-right of FAB
          "fixed z-30 left-3 right-3 bottom-[120px] sm:left-auto sm:right-[50px] sm:bottom-[120px] sm:max-w-xs",
          "rounded-xl border bg-card shadow-lg p-3",
          "flex items-start gap-3",
        )}
      >
        <div className="size-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Smartphone className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">
            Ana Ekrana Ekle
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tablet ya da telefonda hızlı erişim için uygulama olarak kur.
          </p>
          <div className="flex gap-1.5 mt-2">
            <Button size="sm" onClick={onInstallClick} className="h-7 px-2.5 text-xs">
              <Download className="size-3.5" /> Kur
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={dismiss}
              className="h-7 px-2.5 text-xs"
            >
              Daha Sonra
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground transition shrink-0 -mt-1 -mr-1"
          aria-label="Kapat"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* iOS instructions — Safari has no install API so we walk through it */}
      <Dialog open={showIosSheet} onOpenChange={setShowIosSheet}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>iPhone / iPad'e Ekle</DialogTitle>
            <DialogDescription>
              Safari'de aşağıdaki adımları izle, ana ekrana eklensin.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="size-7 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center shrink-0">
                1
              </span>
              <span>
                Safari'nin altında veya üstünde{" "}
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Share className="size-4" /> Paylaş
                </span>{" "}
                tuşuna bas.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="size-7 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <span>
                Aşağı kaydır,{" "}
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Plus className="size-4" /> Ana Ekrana Ekle
                </span>{" "}
                seçeneğini bul.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="size-7 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <span>
                Sağ üstte <strong>Ekle</strong>'ye dokun. TG Teknik artık ana
                ekranında — uygulama gibi açılır.
              </span>
            </li>
          </ol>
          <div className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">İpucu:</strong> Bu işlem Safari
            tarayıcısında çalışır. Chrome veya başka tarayıcı kullanıyorsan önce
            Safari'de aç.
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
