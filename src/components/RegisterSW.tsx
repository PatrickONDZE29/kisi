"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => {
        console.log("✅ SW enregistré :", registration.scope);

        // 🔥 vérifie les updates automatiquement
        registration.onupdatefound = () => {
          const newWorker = registration.installing;

          if (!newWorker) return;

          newWorker.onstatechange = () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              console.log("🔄 Nouvelle version disponible");
            }
          };
        };
      })
      .catch((err) => {
        console.error("❌ SW error :", err);
      });
  }, []);

  return null;
}