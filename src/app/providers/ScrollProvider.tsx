"use client";

import { useEffect } from "react";

export default function ScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let lenis: any = null;
    let rafId: number;

    async function init() {
      try {
        const { default: Lenis } = await import("lenis");

        lenis = new Lenis({
          duration: 1.2,
          smoothWheel: true,
        });

        function raf(time: number) {
          lenis.raf(time);
          rafId = requestAnimationFrame(raf);
        }

        rafId = requestAnimationFrame(raf);
      } catch (e) {
        // Lenis non disponible ou contexte PWA standalone — scroll natif utilisé
        console.warn("Scroll fluide désactivé:", e);
      }
    }

    init();

    return () => {
      try {
        if (rafId) cancelAnimationFrame(rafId);
        if (lenis) lenis.destroy();
      } catch (e) {}
    };
  }, []);

  return <>{children}</>;
}