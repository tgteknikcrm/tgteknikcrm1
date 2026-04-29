"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tg.notifications.enabled";

/**
 * Browser-level notifier for messaging.
 *
 * Subscribes to `messages` INSERT events globally. When a message
 * lands that wasn't authored by me AND the tab is hidden (or user
 * isn't on /messages), plays a short ping and shows a desktop
 * notification — provided the user has opted in.
 *
 * The toggle button lives in the topbar so users can mute easily.
 */
export function MessageNotifier() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const myUserIdRef = useRef<string | null>(null);

  // Stash my user id once so the realtime callback can filter out my
  // own messages without an extra fetch each time.
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      myUserIdRef.current = data.user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const ch = supabase
      .channel("global-message-notifier")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m = payload.new as {
            author_id: string | null;
            body: string | null;
            conversation_id: string;
          };
          if (!m || m.author_id === myUserIdRef.current) return;

          // Don't ping when the user is actively reading the same conv.
          const onMessages =
            typeof window !== "undefined" &&
            window.location.pathname.startsWith("/messages");
          const tabVisible =
            typeof document !== "undefined" &&
            document.visibilityState === "visible";
          if (onMessages && tabVisible) return;

          // Sound
          try {
            audioRef.current?.play().catch(() => {});
          } catch {
            /* autoplay blocked; silent */
          }

          // Desktop notification
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification("Yeni mesaj", {
                body: m.body ?? "[Dosya]",
                icon: "/icon",
                tag: m.conversation_id,
              });
            } catch {
              /* some browsers throw on Notification w/o ServiceWorker */
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [enabled]);

  async function toggle() {
    if (enabled) {
      setEnabled(false);
      localStorage.setItem(STORAGE_KEY, "0");
      return;
    }
    // Opt-in flow: ask for permission, then enable.
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      try {
        const r = await Notification.requestPermission();
        if (r !== "granted") return;
      } catch {
        return;
      }
    }
    setEnabled(true);
    localStorage.setItem(STORAGE_KEY, "1");
  }

  return (
    <>
      {/* short "ding" — base64 to avoid an extra public asset */}
      <audio
        ref={audioRef}
        preload="auto"
        src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "size-9 transition hover:scale-105",
          enabled && "text-primary",
        )}
        onClick={toggle}
        title={enabled ? "Bildirimleri kapat" : "Bildirimleri aç"}
        aria-label={enabled ? "Bildirimleri kapat" : "Bildirimleri aç"}
      >
        {enabled ? <Bell className="size-5" /> : <BellOff className="size-5" />}
      </Button>
    </>
  );
}
