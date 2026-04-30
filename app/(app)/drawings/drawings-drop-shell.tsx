"use client";

import { useState } from "react";
import { DropZone } from "@/components/app/drop-zone";
import { UploadDialog } from "./upload-dialog";
import type { Job, Product } from "@/lib/supabase/types";

/**
 * Wraps the drawings page in a full-page drop zone. Dropping a PDF or
 * image anywhere on the page opens the existing UploadDialog with the
 * file pre-selected, so the user only needs to fill in the metadata.
 *
 * Whitelist mirrors the dialog's `<input accept>` so we reject e.g. a
 * dropped .exe before any upload work happens.
 */
export function DrawingsDropShell({
  jobs,
  products = [],
  children,
}: {
  jobs: Job[];
  products?: Product[];
  children: React.ReactNode;
}) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <DropZone
      accept={[
        "image/",
        "application/pdf",
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".dwg",
        ".dxf",
      ]}
      maxSize={25 * 1024 * 1024}
      multiple={false}
      hint="Teknik resmi buraya bırak — yükleme penceresi açılacak"
      onFiles={(files) => {
        const f = files[0];
        if (!f) return;
        setPendingFile(f);
        setDialogOpen(true);
      }}
    >
      {children}
      {/* Hidden second instance: only mounted while we have a pending
          drop, so the user gets pre-filled file + still has the manual
          "Yükle" button up top. */}
      {pendingFile && (
        <UploadDialog
          jobs={jobs}
          products={products}
          prefillFile={pendingFile}
          externalOpen={dialogOpen}
          onExternalOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) setPendingFile(null);
          }}
        />
      )}
    </DropZone>
  );
}
