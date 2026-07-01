"use client";

import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const already = sessionStorage.getItem("splash_done");

    if (already) {
      setShow(false);
      return;
    }

    const timer = setTimeout(() => {
      sessionStorage.setItem("splash_done", "true");
      setShow(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white dark:bg-gray-900">
      
      <div className="flex flex-col items-center text-center">

        {/* 💊 LOGO */}
        <img
          src="/icon-512.png"
          alt="KISI"
          className="w-24 h-24 animate-pulse"
        />

        {/* 🟢 NOM APP */}
        <h1 className="mt-4 text-3xl font-bold text-[#00572D] tracking-wide">
          KISI
        </h1>

        {/* 📝 SLOGAN */}
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">
          Votre pharmacie à portée de main
        </p>

      </div>
    </div>
  );
}