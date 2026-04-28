import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/app/sw-register";
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
    "TG Teknik imalat üretim takip sistemi — makine, operatör, takım, kalite kontrol ve teknik resim yönetimi.",
  applicationName: "TG Teknik",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TG Teknik",
  },
  formatDetection: {
    // Don't auto-link phone numbers / addresses on iOS — clashes with our
    // explicit Türkçe phone fields and looks ugly.
    telephone: false,
    address: false,
    email: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  // Allow zoom for accessibility, but cap to keep UI usable.
  maximumScale: 5,
  // Extends the viewport into the device's notch/safe area on iOS.
  // Combine with env(safe-area-inset-*) in CSS for proper padding.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased min-h-screen bg-background text-foreground`}>
        {children}
        <Toaster position="top-right" richColors />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
