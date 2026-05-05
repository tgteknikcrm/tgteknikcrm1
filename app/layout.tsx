import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/app/sw-register";
import "./globals.css";

// Google Sans — site genelinde tek tip, modern Material 3 dili.
// Not: 'latin-ext' Türkçe karakterler için, normal/medium/bold ağırlıkları
// arayüz için yeterli.
const googleSans = Google_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
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
      <head>
        {/* Pre-paint theme: read tg.theme from localStorage, fall back to system
            preference. Runs synchronously before first paint to avoid FOUC. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('tg.theme');var d=m==='dark'||(!m&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${googleSans.variable} font-sans antialiased min-h-screen bg-background text-foreground`}>
        {children}
        <Toaster position="top-right" richColors />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
