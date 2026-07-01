"use client";

import dynamic from "next/dynamic";

// ⚠️ Fix obligatoire pour Leaflet + Next.js (SSR OFF)
const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
});

export default function MapPage() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">
        🗺️ Pharmacies autour de vous
      </h1>

      <Map />
    </main>
  );
}