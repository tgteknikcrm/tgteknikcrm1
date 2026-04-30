"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Generic multi-select hook for list pages.
 *
 *   const sel = useBulkSelection(rowIds);
 *   sel.has(id)          → bool
 *   sel.toggle(id)       → flip one
 *   sel.toggleRange(id)  → shift-select (anchor → id)
 *   sel.allSelected      → bool
 *   sel.someSelected     → bool (intermediate)
 *   sel.selectAll()      → mark every visible row
 *   sel.clear()          → empty
 *   sel.size             → count
 *   sel.ids              → string[]  (stable ref)
 *
 * Anchor + shift-select: clicking row A then shift-clicking row B
 * toggles every row between them. Matches the spreadsheet / file
 * manager mental model.
 */
export function useBulkSelection(visibleIds: string[]) {
  const [set, setSet] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);

  const has = useCallback((id: string) => set.has(id), [set]);

  const toggle = useCallback((id: string) => {
    setAnchor(id);
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleRange = useCallback(
    (id: string) => {
      // Shift+click: select inclusive range from anchor → id.
      if (!anchor) {
        toggle(id);
        return;
      }
      const a = visibleIds.indexOf(anchor);
      const b = visibleIds.indexOf(id);
      if (a === -1 || b === -1) {
        toggle(id);
        return;
      }
      const [from, to] = a < b ? [a, b] : [b, a];
      setSet((prev) => {
        const next = new Set(prev);
        for (let i = from; i <= to; i++) next.add(visibleIds[i]);
        return next;
      });
    },
    [anchor, visibleIds, toggle],
  );

  const selectAll = useCallback(() => {
    setSet(new Set(visibleIds));
  }, [visibleIds]);

  const clear = useCallback(() => {
    setSet(new Set());
    setAnchor(null);
  }, []);

  const ids = useMemo(() => Array.from(set), [set]);
  const size = set.size;
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => set.has(id));
  const someSelected = size > 0 && !allSelected;

  return {
    has,
    toggle,
    toggleRange,
    selectAll,
    clear,
    ids,
    size,
    allSelected,
    someSelected,
  };
}

export type BulkSelectionApi = ReturnType<typeof useBulkSelection>;
