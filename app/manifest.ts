import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TG Teknik Üretim Takip",
    short_name: "TG Teknik",
    description:
      "TG Teknik imalat üretim takip sistemi — makine, operatör, takım, kalite kontrol ve teknik resim yönetimi.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    // 'any' lets the OS rotate freely — important for tablet landscape +
    // operators turning the device while measuring on the bench.
    orientation: "any",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: "tr",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      // Maskable variants first — Android adaptive launcher uses these.
      {
        src: "/icon-maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      // Regular icons for browser tab + general use.
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Üretim Formu",
        short_name: "Üretim",
        description: "Günlük vardiya üretim kaydı",
        url: "/production",
      },
      {
        name: "Dashboard",
        short_name: "Özet",
        description: "Makine durumu ve KPI'lar",
        url: "/dashboard",
      },
      {
        name: "Kalite Kontrol",
        short_name: "Kalite",
        description: "Ölçü kayıtları",
        url: "/quality",
      },
      {
        name: "Teknik Resimler",
        short_name: "Resim",
        description: "PDF + görsel + annotation",
        url: "/drawings",
      },
    ],
  };
}
