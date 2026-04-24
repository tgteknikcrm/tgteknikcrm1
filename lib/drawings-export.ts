// Browser-only helpers for exporting/sharing annotated drawings.
// Uses Fabric.js canvas + jsPDF (lazy loaded).

export async function canvasToPng(
  fabricCanvas: import("fabric").Canvas,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const dataUrl = fabricCanvas.toDataURL({
    format: "png",
    multiplier: 2, // higher resolution for export
  });
  return {
    dataUrl,
    width: fabricCanvas.getWidth(),
    height: fabricCanvas.getHeight(),
  };
}

export async function downloadCanvasAsPdf(
  fabricCanvas: import("fabric").Canvas,
  fileName: string,
) {
  const { jsPDF } = await import("jspdf");
  const { dataUrl, width, height } = await canvasToPng(fabricCanvas);
  const orientation = width >= height ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "px",
    format: [width, height],
    compress: true,
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

// Convert an arbitrary image URL into a single-page PDF and download it.
// Used when the user wants the original (non-annotated) image as PDF.
export async function downloadImageUrlAsPdf(url: string, fileName: string) {
  const { jsPDF } = await import("jspdf");
  const img = await loadHtmlImage(url);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const orientation = w >= h ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "px",
    format: [w, h],
    compress: true,
  });
  pdf.addImage(img, "PNG", 0, 0, w, h);
  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

// Try to share via the Web Share API; on failure, return a flag so the
// caller can fall back to a download or wa.me link.
export async function tryShareFile(
  blob: Blob,
  fileName: string,
  text?: string,
): Promise<boolean> {
  const file = new File([blob], fileName, { type: blob.type });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (
    nav.canShare &&
    nav.share &&
    nav.canShare({ files: [file] })
  ) {
    try {
      await nav.share({ files: [file], title: fileName, text });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// Convert a data URL to a Blob (used for share/download).
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function whatsappLinkForUrl(url: string, message?: string): string {
  const text = message ? `${message}\n${url}` : url;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// Trigger a browser download for an arbitrary URL or data URL.
export function downloadUrl(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}
