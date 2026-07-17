"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadUser();

    // ✅ Écouter les changements de session (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          fetchRole(session.user.id);
        } else {
          setRole(null);
          setIsLoggedIn(false);
          setLoaded(true);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setRole(null);
        setIsLoggedIn(false);
        setLoaded(true);
        return;
      }

      await fetchRole(session.user.id);
    } catch {
      setRole(null);
      setIsLoggedIn(false);
      setLoaded(true);
    }
  }

  async function fetchRole(userId: string) {
    try {
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .single();

      if (data?.role) {
        setRole(data.role);
        setIsLoggedIn(true);
      } else {
        setRole(null);
        setIsLoggedIn(false);
      }
    } catch {
      setRole(null);
      setIsLoggedIn(false);
    } finally {
      setLoaded(true);
    }
  }

  function getMenus() {
    // Admin
    if (isLoggedIn && role === "admin") {
      return [
        { name: "Accueil", icon: "🏠", href: "/" },
        { name: "Carte", icon: "🗺️", href: "/map" },
        { name: "Admin", icon: "⚙️", href: "/dashboard/admin" },
      ];
    }

    // Pharmacie
    if (isLoggedIn && role === "pharmacy") {
      return [
        { name: "Accueil", icon: "🏠", href: "/" },
        { name: "Carte", icon: "🗺️", href: "/map" },
        { name: "Commandes", icon: "📦", href: "/dashboard/pharmacy/orders" },
        { name: "Pharmacie", icon: "/pharmacie.png", href: "/dashboard/pharmacy", isImage: true },
      ];
    }

    // Livreur
    if (isLoggedIn && role === "driver") {
      return [
        { name: "Accueil", icon: "🏠", href: "/" },
        { name: "Missions", icon: "📋", href: "/dashboard/driver" },
        { name: "En cours", icon: "🚀", href: "/dashboard/driver" },
        { name: "Gains", icon: "💰", href: "/dashboard/driver" },
      ];
    }

    // Utilisateur connecté
    if (isLoggedIn && role === "user") {
      return [
        { name: "Accueil", icon: "🏠", href: "/" },
        { name: "Carte", icon: "🗺️", href: "/map" },
        { name: "Commandes", icon: "📋", href: "/reservations" },
        { name: "Compte", icon: "👤", href: "/dashboard/user" },
      ];
    }

    // Non connecté
    return [
      { name: "Accueil", icon: "🏠", href: "/" },
      { name: "Carte", icon: "🗺️", href: "/map" },
      { name: "Connexion", icon: "🔐", href: "/login" },
      { name: "Inscription", icon: "✏️", href: "/register" },
    ];
  }

  const menus = getMenus();

  // Masquer sur login/register
  const hiddenPaths = ["/login", "/register"];
  const shouldHide = hiddenPaths.some((p) => pathname.startsWith(p));
  if (shouldHide) return null;

  // ✅ Tant que le chargement n'est pas terminé, afficher les menus de base
  if (!loaded) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-[#00572D] dark:bg-gray-900 border-t border-transparent dark:border-gray-700 shadow-lg z-50 transition-colors">
        <div className="grid grid-cols-4 h-16">
          {[
            { name: "Accueil", icon: "🏠", href: "/" },
            { name: "Carte", icon: "🗺️", href: "/map" },
            { name: "Connexion", icon: "🔐", href: "/login" },
            { name: "Inscription", icon: "✏️", href: "/register" },
          ].map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="flex flex-col items-center justify-center text-xs text-green-200 dark:text-gray-400"
            >
              <span className="text-xl mb-1">{menu.icon}</span>
              <span className="text-[10px] sm:text-xs">{menu.name}</span>
            </Link>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-[#00572D] dark:bg-gray-900 border-t border-transparent dark:border-gray-700 shadow-lg z-50 transition-colors">
        <div
          className="grid h-16"
          style={{ gridTemplateColumns: `repeat(${menus.length}, 1fr)` }}
        >
          {menus.map((menu) => {
            const isActive =
              pathname === menu.href ||
              (menu.href !== "/" && pathname.startsWith(menu.href));

            return (
              <Link
                key={`${menu.name}-${menu.href}`}
                href={menu.href}
                className={`flex flex-col items-center justify-center text-xs transition-colors ${
                  isActive
                    ? "text-white font-bold"
                    : "text-green-200 dark:text-gray-400"
                }`}
              >
                {(menu as any).isImage ? (
                  <img
                    src={menu.icon}
                    alt={menu.name}
                    className="w-6 h-6 object-contain mb-1"
                  />
                ) : (
                  <span className="text-xl mb-1">{menu.icon}</span>
                )}
                <span className="text-[10px] sm:text-xs">{menu.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* MODAL PHARMACIE */}
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