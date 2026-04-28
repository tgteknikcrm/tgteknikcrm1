"use client";

import { useEffect, useState } from "react";

/**
 * Renders children only on the client (after mount). Useful for wrapping
 * components whose render output can drift between SSR and hydration —
 * particularly Radix dialogs whose internal useId() counter shifts when
 * earlier server-rendered subtrees differ slightly.
 *
 * The fallback is rendered during SSR + initial client render so the
 * surrounding layout doesn't jump.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return <>{mounted ? children : fallback}</>;
}
