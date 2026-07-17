"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function PharmacyDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [pharmacy, setPharmacy] = useState<any>(null);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [newReservationsCount, setNewReservationsCount] = useState(0);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userData?.role !== "pharmacy") { setLoading(false); return; }

    setAuthorized(true);

    const { data: pharmacyData } = await supabase
      .from("pharmacies")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (pharmacyData) {
      setPharmacy(pharmacyData);
      await loadCounts(pharmacyData.id);

      // ✅ Configurer TOUS les .on() AVANT .subscribe()
      supabase
        .channel("pharmacy-dashboard-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `pharmacy_id=eq.${pharmacyData.id}`,
          },
          () => loadCounts(pharmacyData.id)
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "reservations",
            filter: `pharmacy_id=eq.${pharmacyData.id}`,
          },
          () => loadCounts(pharmacyData.id)
        )
        .subscribe(); // ✅ subscribe() en dernier
    }

    setLoading(false);
  }

  async function loadCounts(pharmacyId: string) {
    const { count: ordersCount } = await supabase
      .from("orders")
      .select("id", { count: "exact" })
      .eq("pharmacy_id", pharmacyId)
      .eq("status", "payment_confirmed");

    const { count: resCount } = await supabase
      .from("reservations")
      .select("id", { count: "exact" })
      .eq("pharmacy_id", pharmacyId)
      .eq("status", "pending");

    setNewOrdersCount(ordersCount || 0);
    setNewReservationsCount(resCount || 0);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 transition-colors">
        <p className="text-[#00572D] dark:text-green-400 font-bold">Chargement...</p>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 p-6 transition-colors">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-8 text-center max-w-sm">
          <h1 className="text-xl font-bold text-red-600 dark:text-red-400">Accès refusé</h1>
          <p className="mt-3 text-gray-600 dark:text-gray-300 text-sm">
            Veuillez créer un compte pharmacie pour accéder à cet espace.
          </p>
        </div>
      </main>
    );
  }

  const totalNotifications = newOrdersCount + newReservationsCount;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28 transition-colors">
      <div className="max-w-md mx-auto px-4 pt-6">

        {/* EN-TÊTE */}
        <div className="bg-[#00572D] dark:bg-green-900 text-white rounded-3xl p-5 shadow-lg mb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {pharmacy?.logo_url ? (
                <img
                  src={pharmacy.logo_url}
                  alt={pharmacy.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-white/30"
                />
              ) : (
                <img
                  src="/pharmacie.png"
                  alt="Pharmacie"
                  className="w-14 h-14 object-contain"
                />
              )}
              <div>
                <h1 className="text-lg font-bold">{pharmacy?.name || "Espace Pharmacie"}</h1>
                <p className="text-green-100 text-xs">📍 {pharmacy?.city || "Ville non renseignée"}</p>
                <p className={`text-xs font-bold mt-0.5 ${pharmacy?.is_open ? "text-green-300" : "text-red-300"}`}>
                  {pharmacy?.is_open ? "🟢 Ouverte" : "🔴 Fermée"}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl font-bold text-xs transition"
            >
              🚪 Déco
            </button>
          </div>
        </div>

        {/* ALERTE NOUVELLES COMMANDES */}
        {totalNotifications > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-3 mb-4 text-center">
            <p className="text-sm font-bold text-yellow-700 dark:text-yellow-400">
              🔔 {totalNotifications} nouvelle{totalNotifications > 1 ? "s" : ""} action{totalNotifications > 1 ? "s" : ""} requise{totalNotifications > 1 ? "s" : ""}
            </p>
            {newOrdersCount > 0 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                💳 {newOrdersCount} commande{newOrdersCount > 1 ? "s" : ""} payée{newOrdersCount > 1 ? "s" : ""} à traiter
              </p>
            )}
            {newReservationsCount > 0 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                📋 {newReservationsCount} réservation{newReservationsCount > 1 ? "s" : ""} en attente
              </p>
            )}
          </div>
        )}

        {/* MODULES */}
        <div className="grid grid-cols-2 gap-3">

          {/* COMMANDES PAYÉES */}
          <Link
            href="/dashboard/pharmacy/orders"
            className="relative bg-[#00572D] dark:bg-green-900 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 text-white p-5 rounded-2xl text-center shadow-md"
          >
            {newOrdersCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                {newOrdersCount}
              </span>
            )}
            <div className="text-3xl mb-2">💳</div>
            <p className="text-sm font-bold">Commandes</p>
            <p className="text-xs font-normal mt-1 text-green-100">Achats en ligne</p>
          </Link>

          {/* RÉSERVATIONS */}
          <Link
            href="/dashboard/pharmacy/reservations"
            className="relative bg-[#00572D] dark:bg-green-900 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 text-white p-5 rounded-2xl text-center shadow-md"
          >
            {newReservationsCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                {newReservationsCount}
              </span>
            )}
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm font-bold">Réservations</p>
            <p className="text-xs font-normal mt-1 text-green-100">Sans paiement</p>
          </Link>

          {/* MÉDICAMENTS */}
          <Link
            href="/dashboard/pharmacy/stocks"
            className="bg-[#00572D] dark:bg-green-900 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 text-white p-5 rounded-2xl text-center shadow-md"
          >
            <div className="text-3xl mb-2">💊</div>
            <p className="text-sm font-bold">Médicaments</p>
            <p className="text-xs font-normal mt-1 text-green-100">Gérer le stock</p>
          </Link>

          {/* PROFIL */}
          <Link
            href="/dashboard/pharmacy/profile"
            className="bg-[#00572D] dark:bg-green-900 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 text-white p-5 rounded-2xl text-center shadow-md"
          >
            <div className="text-3xl mb-2">👤</div>
            <p className="text-sm font-bold">Profil</p>
            <p className="text-xs font-normal mt-1 text-green-100">Informations</p>
          </Link>

          {/* PARAMÈTRES */}
          <Link
            href="/dashboard/pharmacy/settings"
            className="bg-[#00572D] dark:bg-green-900 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 text-white p-5 rounded-2xl text-center shadow-md col-span-2"
          >
            <div className="text-3xl mb-2">⚙️</div>
            <p className="text-sm font-bold">Paramètres</p>
            <p className="text-xs font-normal mt-1 text-green-100">Logo & sécurité</p>
          </Link>

        </div>

        {/* FONCTIONNALITÉS */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 mt-5 shadow-sm">
          <h2 className="text-base font-bold text-[#00572D] dark:text-green-400 mb-3">
            Fonctionnalités disponibles
          </h2>
          <ul className="space-y-1.5 text-sm text-black dark:text-gray-200">
            <li>✅ Gestion du profil pharmacie</li>
            <li>✅ Gestion des médicaments et stocks</li>
            <li>✅ Réception et gestion des commandes payées</li>
            <li>✅ Réception et gestion des réservations</li>
            <li>✅ Workflow complet de livraison</li>
            <li>✅ Remise OTP au livreur</li>
            <li>✅ Notifications temps réel</li>
          </ul>
        </div>

      </div>
    </main>
  );
}