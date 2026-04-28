"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register in production — avoids dev-server caching surprises.
    if (window.location.hostname === "localhost") return;

    const url = "/sw.js";
    navigator.serviceWorker
      .register(url, { scope: "/" })
      .catch(() => {
        // Silent: SW failure shouldn't break the app.
      });
  }, []);

  return null;
}
