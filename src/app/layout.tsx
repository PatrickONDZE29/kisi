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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00572D" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="KISI" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                if (typeof window === 'undefined') return;
                var stored = localStorage.getItem("theme");
                var prefersDark = false;
                try { prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches; } catch(e) {}
                var theme = stored || (prefersDark ? "dark" : "light");
                document.documentElement.classList.toggle("dark", theme === "dark");
              } catch (e) {}
            })();
          `}
        </Script>
      </head>

      <body suppressHydrationWarning className="bg-white dark:bg-gray-900 transition-colors">
        <CartProvider>
          <ToastProvider>
            <ScrollProvider>
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