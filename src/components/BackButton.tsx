"use client";

import { useRouter, usePathname } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  // Pages où on ne veut pas afficher la flèche
  const hiddenPages = [
    "/",
  ];

  if (hiddenPages.includes(pathname)) {
    return null;
  }

  return (
    <button
      onClick={() => router.back()}
      className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-[#00572D] dark:bg-green-700 text-white shadow-lg flex items-center justify-center"
    >
      ←
    </button>
  );
}