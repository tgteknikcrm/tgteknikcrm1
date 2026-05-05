"use client";

import { useEffect } from "react";

/**
 * Scrolls to (and pulses) the spec row matching `bubble` after page mount.
 * Used when navigating from a clicked annotation bubble on the drawing
 * viewer (`/quality/[id]?bubble=N`).
 */
export function SpecScroll({ bubble }: { bubble: number | null }) {
  useEffect(() => {
    if (bubble === null) return;
    const el = document.getElementById(`spec-${bubble}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add(
      "ring-2",
      "ring-primary",
      "ring-offset-2",
      "transition",
      "bg-primary/5",
    );
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
    }, 2500);
    return () => clearTimeout(t);
  }, [bubble]);

  return null;
}
