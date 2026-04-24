import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TG Teknik Üretim Takip",
    short_name: "TG Teknik",
    description:
      "TG Teknik imalat üretim takip sistemi — makine, operatör, takım ve üretim formları.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: "tr",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
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
        name: "Üretim Formu Ekle",
        short_name: "Üretim",
        url: "/production",
      },
      {
        name: "Dashboard",
        short_name: "Özet",
        url: "/dashboard",
      },
    ],
  };
}
