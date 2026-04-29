"use client";

import { useEffect } from "react";
import { pingPresence } from "@/app/(app)/presence-actions";

const PING_INTERVAL_MS = 30_000;

/**
 * Mounts an invisible heartbeat that pings the server every 30s while
 * the tab is visible. Stops when the tab goes hidden so we don't burn
 * write quota on inactive users.
 *
 * Pair with `last_seen_at` reads on profiles to render "online now"
 * / "5 dk önce" badges in the messenger UI.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      if (document.visibilityState === "visible") void pingPresence();
    };
    // Fire immediately so a fresh tab is "online" right away.
    tick();
    timer = setInterval(tick, PING_INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return null;
}
