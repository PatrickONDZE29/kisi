"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    if (data) setRole(data.role);
  }

  const menus = [
    { name: "Accueil",      icon: "🏠",            href: "/" },
    { name: "Carte",        icon: "🗺️",            href: "/map" },
    { name: "Réservations", icon: "📋",            href: "/reservations" },
    { name: "Pharmacie",    icon: "/pharmacie.png", href: "/dashboard/pharmacy", isImage: true },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-[#00572D] dark:bg-gray-900 border-t border-transparent dark:border-gray-700 shadow-lg z-50 transition-colors">
        <div className="grid grid-cols-4 h-16">

          {menus.map((menu) => {
            const active = pathname === menu.href;

            if (menu.name === "Pharmacie") {
              if (role === "pharmacy") {
                return (
                  <Link
                    key={menu.href}
                    href={menu.href}
                    className={`flex flex-col items-center justify-center text-xs transition-colors ${
                      active ? "text-white font-bold" : "text-green-200 dark:text-gray-400"
                    }`}
                  >
                    <img src={menu.icon} alt={menu.name} className="w-6 h-6 object-contain mb-1" />
                    <span>{menu.name}</span>
                  </Link>
                );
              }

              return (
                <button
                  key={menu.name}
                  onClick={() => setShowModal(true)}
                  className={`flex flex-col items-center justify-center text-xs transition-colors ${
                    active ? "text-white font-bold" : "text-green-200 dark:text-gray-400"
                  }`}
                >
                  <img src={menu.icon} alt={menu.name} className="w-6 h-6 object-contain mb-1" />
                  <span>{menu.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={menu.href}
                href={menu.href}
                className={`flex flex-col items-center justify-center text-xs transition-colors ${
                  active ? "text-white font-bold" : "text-green-200 dark:text-gray-400"
                }`}
              >
                <span className="text-xl">{menu.icon}</span>
                <span>{menu.name}</span>
              </Link>
            );
          })}

        </div>
      </nav>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-sm transition-colors">

            <h2 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
              ⚠️ Espace Pharmacie
            </h2>

            <p className="text-gray-600 dark:text-gray-300 mt-3">
              Cet espace est réservé aux pharmacies.
            </p>

            <div className="space-y-3 mt-6">

              <button
                onClick={() => {
                  setShowModal(false);
                  router.push("/register?role=pharmacy");
                }}
                className="w-full bg-[#00572D] dark:bg-green-700 text-white text-center py-3 rounded-xl font-bold hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
              >
                Créer un compte pharmacie
              </button>

              <button
                onClick={() => {
                  setShowModal(false);
                  router.push("/login");
                }}
                className="w-full border-2 border-[#00572D] dark:border-green-500 text-[#00572D] dark:text-green-400 text-center py-3 rounded-xl font-bold hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
              >
                Se connecter
              </button>

              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-gray-200 dark:bg-gray-700 py-3 rounded-xl font-bold text-gray-700 dark:text-gray-200 hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
              >
                Fermer
              </button>

            </div>

          </div>
        </div>
      )}
    </>
  );
}