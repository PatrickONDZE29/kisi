"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SplashScreen from "@/components/SplashScreen";
import PageTransition from "@/components/PageTransition";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showSplash, setShowSplash] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const already = sessionStorage.getItem("splash_done");
      if (already) {
        setShowSplash(false);
        return;
      }
      const timer = setTimeout(() => {
        try {
          sessionStorage.setItem("splash_done", "true");
        } catch (e) {}
        setShowSplash(false);
      }, 2500);
      return () => clearTimeout(timer);
    } catch (e) {
      setShowSplash(false);
    }
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <PageTransition key={pathname}>
      {children}
    </PageTransition>
  );
}