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

    // Enregistrement uniquement en production (évite conflits dev/Turbopack)
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker enregistré :", registration.scope);
      })
      .catch((err) => {
        console.error("Échec enregistrement Service Worker :", err);
      });
  }, []);

  return null;
}