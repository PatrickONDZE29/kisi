"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// =====================================================
// BANDEAU COMMANDES PHARMACIE
// =====================================================
function PharmacyOrdersBanner({
  pharmacyId,
  pharmacyName,
}: {
  pharmacyId: string;
  pharmacyName: string;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    loadAll();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`pharmacy-banner-${pharmacyId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `pharmacy_id=eq.${pharmacyId}`,
      }, () => loadAll())
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "reservations",
        filter: `pharmacy_id=eq.${pharmacyId}`,
      }, () => loadAll())
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [pharmacyId]);

  async function loadAll() {
    // Nouvelles commandes payées
    const { data: ordersData } = await supabase
      .from("orders")
      .select("id, user_id, total, created_at, profiles(full_name)")
      .eq("pharmacy_id", pharmacyId)
      .eq("status", "payment_confirmed")
      .order("created_at", { ascending: false })
      .limit(10);

    // Nouvelles réservations en attente
    const { data: resData } = await supabase
      .from("reservations")
      .select("id, customer_name, medicine_id, created_at, medicines(name)")
      .eq("pharmacy_id", pharmacyId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);

    setOrders(ordersData || []);
    setReservations(resData || []);
  }

  const allItems = [
    ...orders.map(o => ({
      id: o.id,
      label: `💳 ${o.total?.toLocaleString() || "—"} FCFA — Commande payée`,
      sub: `il y a ${getTimeAgo(o.created_at)}`,
      type: "order",
      href: "/dashboard/pharmacy/orders",
    })),
    ...reservations.map(r => ({
      id: r.id,
      label: `📋 ${r.customer_name || "Client"} — ${(r.medicines as any)?.name || "Médicament"}`,
      sub: `il y a ${getTimeAgo(r.created_at)}`,
      type: "reservation",
      href: "/dashboard/pharmacy/reservations",
    })),
  ].sort((a, b) => 0);

  if (allItems.length === 0) return null;

  // Dupliquer pour défilement infini
  const items = [...allItems, ...allItems, ...allItems];

  return (
    <div className="w-full overflow-hidden bg-[#00572D] rounded-2xl shadow-lg border border-green-700 mb-5">
      {/* Header */}
      <div className="px-4 py-2 flex items-center gap-2 border-b border-green-700">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
        <p className="text-xs font-bold text-white">
          🔔 {allItems.length} nouvelle{allItems.length > 1 ? "s" : ""} action{allItems.length > 1 ? "s" : ""} — {pharmacyName}
        </p>
      </div>

      {/* Bandeau défilant */}
      <div className="relative overflow-hidden py-2.5 px-1">
        <div
          className="flex gap-3"
          style={{
            animation: `pharmacyScroll ${Math.max(15, items.length * 5)}s linear infinite`,
            width: "max-content",
          }}
        >
          {items.map((item, idx) => (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => router.push(item.href)}
              className="inline-flex items-center gap-2 bg-green-700/60 hover:bg-green-600/80 px-3 py-1.5 rounded-xl transition shrink-0 active:scale-95"
            >
              <span className="w-2 h-2 bg-red-400 rounded-full shrink-0 animate-pulse" />
              <div className="text-left">
                <p className="text-xs font-bold text-white whitespace-nowrap">{item.label}</p>
                <p className="text-[10px] text-green-200 whitespace-nowrap">{item.sub}</p>
              </div>
              <span className="text-[10px] text-green-200">→</span>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pharmacyScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
      `}</style>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "quelques secondes";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}j`;
}

// =====================================================
// DASHBOARD PHARMACIE
// =====================================================
export default function PharmacyDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [pharmacy, setPharmacy] = useState<any>(null);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [newReservationsCount, setNewReservationsCount] = useState(0);
  const [togglingDuty, setTogglingDuty] = useState(false);

  const channelRef = useRef<any>(null);

  useEffect(() => {
    checkAccess();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
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

      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = supabase
        .channel(`pharmacy-dashboard-${pharmacyData.id}`)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `pharmacy_id=eq.${pharmacyData.id}`,
        }, () => loadCounts(pharmacyData.id))
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `pharmacy_id=eq.${pharmacyData.id}`,
        }, () => loadCounts(pharmacyData.id))
        .subscribe();

      channelRef.current = channel;
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

  // ✅ Toggle pharmacie de garde
  async function toggleDuty() {
    if (!pharmacy) return;
    setTogglingDuty(true);

    const newStatus = !pharmacy.is_open;

    const { error } = await supabase
      .from("pharmacies")
      .update({ is_open: newStatus })
      .eq("id", pharmacy.id);

    if (error) {
      console.error("Erreur toggle de garde:", error.message);
      setTogglingDuty(false);
      return;
    }

    setPharmacy({ ...pharmacy, is_open: newStatus });
    setTogglingDuty(false);
  }

  async function handleLogout() {
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
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

        {/* ✅ BANDEAU DÉFILANT NOUVELLES COMMANDES */}
        {pharmacy && (
          <PharmacyOrdersBanner
            pharmacyId={pharmacy.id}
            pharmacyName={pharmacy.name || "Pharmacie"}
          />
        )}

        {/* EN-TÊTE */}
        <div className="bg-[#00572D] dark:bg-green-900 text-white rounded-3xl p-5 shadow-lg mb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {pharmacy?.logo_url ? (
                <img src={pharmacy.logo_url} alt={pharmacy.name} className="w-14 h-14 rounded-full object-cover border-2 border-white/30" />
              ) : (
                <img src="/pharmacie.png" alt="Pharmacie" className="w-14 h-14 object-contain" />
              )}
              <div>
                <h1 className="text-lg font-bold">{pharmacy?.name || "Espace Pharmacie"}</h1>
                <p className="text-green-100 text-xs">📍 {pharmacy?.city || "Ville non renseignée"}</p>
                <p className={`text-xs font-bold mt-0.5 ${pharmacy?.is_open ? "text-green-300" : "text-red-300"}`}>
                  {pharmacy?.is_open ? "🟢 De garde" : "🔴 Pas de garde"}
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

        {/* ✅ CARTE PHARMACIE DE GARDE */}
        <div className={`rounded-2xl p-4 shadow-sm mb-5 border-2 ${
          pharmacy?.is_open
            ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
            : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
              pharmacy?.is_open ? "bg-green-100 dark:bg-green-900/40" : "bg-gray-100 dark:bg-gray-800"
            }`}>
              🏥
            </div>
            <div>
              <p className="font-bold text-sm dark:text-white">Pharmacie de garde</p>
              <p className={`text-xs ${pharmacy?.is_open ? "text-green-700 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}>
                {pharmacy?.is_open
                  ? "✅ Vous êtes actuellement pharmacie de garde"
                  : "⭕ Vous n'êtes pas pharmacie de garde"}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {pharmacy?.is_open
              ? "Votre pharmacie est visible comme pharmacie de garde sur la carte et dans la liste des pharmacies ouvertes."
              : "Activez le mode garde pour apparaître dans la liste des pharmacies de garde disponibles."}
          </p>

          <button
            onClick={toggleDuty}
            disabled={togglingDuty}
            className={`w-full p-3 rounded-xl font-bold text-sm transition disabled:opacity-60 ${
              pharmacy?.is_open
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-[#00572D] hover:bg-green-800 text-white"
            }`}
          >
            {togglingDuty
              ? "Mise à jour..."
              : pharmacy?.is_open
              ? "🔴 Me retirer de la garde"
              : "🟢 Me déclarer pharmacie de garde"}
          </button>
        </div>

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
            <li>✅ Gestion de la pharmacie de garde</li>
          </ul>
        </div>

      </div>
    </main>
  );
}