import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "TG Teknik — Üretim Takip",
    template: "%s | TG Teknik",
  },
  description:
    "TG Teknik imalat üretim takip sistemi — makine, operatör, takım, üretim formları ve teknik resim yönetimi.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TG Teknik",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased min-h-screen bg-background text-foreground`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
