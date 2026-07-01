import "./globals.css";
import Script from "next/script";

import BottomNav from "@/components/BottomNav";
import ThemeToggle from "@/components/ThemeToggle";
import BackButton from "@/components/BackButton";
import ClientLayout from "@/components/ClientLayout";
import InstallButton from "@/components/InstallButton";
import RegisterSW from "@/components/RegisterSW";
import { ToastProvider } from "@/components/ToastProviderTemp";
import { CartProvider } from "@/components/CartContext";
import ScrollProvider from "./providers/ScrollProvider";

export const metadata = {
  title: "KISI",
  description: "Votre pharmacie à portée de main",
  manifest: "/manifest.json",
  themeColor: "#00572D",
  appleWebApp: {
    capable: true,
    title: "KISI",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* PWA CORE */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00572D" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="KISI" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-512.png" />

        {/* VIEWPORT */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        {/* THEME INIT */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                if (typeof window === 'undefined') return;

                var stored = localStorage.getItem("theme");
                var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

                var theme = stored || (prefersDark ? "dark" : "light");

                document.documentElement.classList.toggle("dark", theme === "dark");
              } catch (e) {}
            })();
          `}
        </Script>
      </head>

      <body
        suppressHydrationWarning
        className="bg-white dark:bg-gray-900 transition-colors"
      >
        <CartProvider>
          <ToastProvider>
            <ScrollProvider>

              {/* 🔥 IMPORTANT: SW doit être chargé TOUT EN HAUT */}
              <RegisterSW />

              <ThemeToggle />
              <BackButton />
              <InstallButton />

              <ClientLayout>
                <main className="pb-24">{children}</main>
              </ClientLayout>

              <BottomNav />

            </ScrollProvider>
          </ToastProvider>
        </CartProvider>
      </body>
    </html>
  );
}