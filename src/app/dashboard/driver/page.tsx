"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProviderTemp";

const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  payment_confirmed: { label: "Commande reçue", emoji: "🆕", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
  preparing: { label: "Préparation en cours", emoji: "📦", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
  ready: { label: "Prête à récupérer", emoji: "🎁", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
  driver_assigned: { label: "Mission acceptée", emoji: "🏍️", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  driver_arrived_at_pharmacy: { label: "À la pharmacie", emoji: "🏥", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  picked_up: { label: "Colis récupéré", emoji: "📬", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
  on_the_way: { label: "En route", emoji: "🚀", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
  driver_arrived: { label: "Arrivé chez le client", emoji: "📍", color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-900/20" },
  delivered: { label: "Livrée", emoji: "🎉", color: "text-green-700", bg: "bg-green-100 dark:bg-green-900/30" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || { label: status, emoji: "❓", color: "text-gray-500", bg: "bg-gray-50" };
}

export default function DriverDashboard() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [availableMissions, setAvailableMissions] = useState<any[]>([]);
  const [activeMissions, setActiveMissions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  // ✅ Tab principal — missions / active / earnings / profile
  const [tab, setTab] = useState<"missions" | "active" | "earnings" | "profile">("missions");

  const [loadingMissions, setLoadingMissions] = useState(false);
  const [acceptingMissionId, setAcceptingMissionId] = useState<string | null>(null);
  const [updatingMissionId, setUpdatingMissionId] = useState<string | null>(null);

  // ✅ Accordion — ID de la mission dont les détails sont ouverts
  const [openDetailMissionId, setOpenDetailMissionId] = useState<string | null>(null);
  const [missionItems, setMissionItems] = useState<Record<string, any[]>>({});

  const [watchId, setWatchId] = useState<number | null>(null);
  const channelRef = useRef<any>(null);
  const refreshIntervalRef = useRef<any>(null);
  const driverProfileRef = useRef<any>(null);
  const accordionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    loadDriver();

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, []);

  async function handleLogout() {
    stopGPS();
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    await supabase.auth.signOut();
    router.push("/");
  }

  async function loadDriver() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: driver, error } = await supabase
      .from("driver_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error || !driver) {
      router.push("/register/driver/dossier");
      return;
    }

    setDriverProfile(driver);
    driverProfileRef.current = driver;
    setLoading(false);

    await loadAvailableMissions();
    await loadActiveMissions(driver.id);
    await loadHistory(driver.id);

    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`driver-missions-${driver.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        loadAvailableMissions();
        if (driverProfileRef.current) {
          loadActiveMissions(driverProfileRef.current.id);
          loadHistory(driverProfileRef.current.id);
        }
      })
      .subscribe();

    channelRef.current = channel;

    refreshIntervalRef.current = setInterval(() => {
      loadAvailableMissions();
      if (driverProfileRef.current) {
        loadActiveMissions(driverProfileRef.current.id);
      }
    }, 30000);
  }

  async function loadAvailableMissions() {
    setLoadingMissions(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`*, pharmacies(name, city, address, phone, logo_url, latitude, longitude), addresses(*)`)
      .eq("status", "ready")
      .is("driver_id", null)
      .order("ready_at", { ascending: true });

    if (error) console.error("loadAvailableMissions:", error.message);
    setAvailableMissions(data || []);
    setLoadingMissions(false);
  }

  async function loadActiveMissions(driverId: string) {
    const { data } = await supabase
      .from("orders")
      .select(`*, pharmacies(name, city, address, phone, logo_url, latitude, longitude), addresses(*)`)
      .eq("driver_id", driverId)
      .in("status", ["driver_assigned", "driver_arrived_at_pharmacy", "picked_up", "on_the_way", "driver_arrived"])
      .order("driver_assigned_at", { ascending: false });

    setActiveMissions(data || []);
  }

  async function loadHistory(driverId: string) {
    const { data } = await supabase
      .from("orders")
      .select("*, pharmacies(name)")
      .eq("driver_id", driverId)
      .eq("status", "delivered")
      .order("delivered_at", { ascending: false })
      .limit(30);

    setHistory(data || []);
  }

  // ✅ Charger les items d'une mission pour l'accordion
  async function loadMissionItems(missionId: string) {
    if (missionItems[missionId]) return; // déjà chargés

    const { data } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", missionId);

    setMissionItems(prev => ({ ...prev, [missionId]: data || [] }));
  }

  // ✅ Toggle accordion — ouvre/ferme les détails sous la carte
  async function toggleDetail(missionId: string) {
    if (openDetailMissionId === missionId) {
      setOpenDetailMissionId(null);
      return;
    }

    setOpenDetailMissionId(missionId);
    await loadMissionItems(missionId);

    // Scroll vers la carte après ouverture
    setTimeout(() => {
      const el = accordionRefs.current[missionId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  }

  async function toggleAvailability() {
    if (!driverProfile) return;
    const newStatus = !driverProfile.is_available;

    const { error } = await supabase
      .from("driver_profiles")
      .update({ is_available: newStatus })
      .eq("id", driverProfile.id);

    if (error) { showToast(error.message, "error"); return; }

    const updated = { ...driverProfile, is_available: newStatus };
    setDriverProfile(updated);
    driverProfileRef.current = updated;

    if (newStatus) { showToast("Vous êtes maintenant disponible 🟢"); startGPS(); }
    else { showToast("Vous n'êtes plus disponible 🔴"); stopGPS(); }
  }

  function startGPS() {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const dp = driverProfileRef.current;
        if (!dp) return;
        await supabase.from("driver_locations").upsert({
          driver_id: dp.id,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading || 0,
          speed: pos.coords.speed || 0,
          is_online: true,
          updated_at: new Date().toISOString(),
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    setWatchId(id);
  }

  function stopGPS() {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); setWatchId(null); }
    const dp = driverProfileRef.current;
    if (dp) {
      supabase.from("driver_locations").upsert({
        driver_id: dp.id, latitude: 0, longitude: 0, is_online: false,
        updated_at: new Date().toISOString(),
      });
    }
  }

  async function acceptMission(orderId: string) {
    const dp = driverProfileRef.current;
    if (!dp) return;

    if (!dp.is_available) {
      showToast("Activez votre disponibilité pour accepter une mission", "error");
      return;
    }

    setAcceptingMissionId(orderId);

    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update({
        driver_id: dp.id,
        status: "driver_assigned",
        driver_assigned_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("status", "ready")
      .is("driver_id", null)
      .select(`*, pharmacies(name, city, address, phone, logo_url, latitude, longitude), addresses(*)`)
      .single();

    if (error || !updatedOrder) {
      showToast("Cette mission n'est plus disponible", "error");
      setAcceptingMissionId(null);
      await loadAvailableMissions();
      return;
    }

    await supabase.from("delivery_events").insert({
      order_id: orderId,
      actor_type: "driver",
      actor_id: dp.id,
      status: "driver_assigned",
      label: `Livreur ${dp.full_name} a accepté la mission`,
    });

    if (updatedOrder.user_id) {
      await supabase.from("notifications").insert({
        user_id: updatedOrder.user_id,
        type: "delivery",
        title: "Livreur affecté 🏍️",
        body: `${dp.full_name} va récupérer votre commande (code : ${updatedOrder.pickup_otp}).`,
        order_id: orderId,
      });
    }

    setAvailableMissions(prev => prev.filter(m => m.id !== orderId));
    setActiveMissions(prev => [updatedOrder, ...prev]);
    setAcceptingMissionId(null);
    startGPS();
    showToast("Mission acceptée ! 🏍️");

    // ✅ Basculer sur l'onglet En cours
    setTab("active");
  }

  async function updateMissionStatus(orderId: string, newStatus: string) {
    const dp = driverProfileRef.current;
    if (!dp) return;

    setUpdatingMissionId(orderId);

    const updateData: any = { status: newStatus };
    if (newStatus === "picked_up") updateData.picked_up_at = new Date().toISOString();

    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select(`*, pharmacies(name, city, address, phone, logo_url, latitude, longitude), addresses(*)`)
      .single();

    if (error) { showToast(error.message, "error"); setUpdatingMissionId(null); return; }

    const cfg = getStatusConfig(newStatus);

    await supabase.from("delivery_events").insert({
      order_id: orderId,
      actor_type: "driver",
      actor_id: dp.id,
      status: newStatus,
      label: cfg.label,
    });

    const notifs: Record<string, { title: string; body: string }> = {
      driver_arrived_at_pharmacy: { title: "Livreur à la pharmacie 🏥", body: "Le livreur est arrivé à la pharmacie." },
      picked_up: { title: "Colis récupéré 📬", body: "Le livreur a récupéré votre commande. La livraison commence !" },
      on_the_way: { title: "En route ! 🚀", body: "Le livreur est en route vers vous." },
      driver_arrived: { title: "Livreur arrivé 📍", body: "Le livreur est à votre porte." },
    };

    const mission = activeMissions.find(m => m.id === orderId);
    if (mission?.user_id && notifs[newStatus]) {
      await supabase.from("notifications").insert({
        user_id: mission.user_id,
        type: "delivery",
        title: notifs[newStatus].title,
        body: notifs[newStatus].body,
        order_id: orderId,
      });
    }

    if (updatedOrder) {
      setActiveMissions(prev => prev.map(m => m.id === orderId ? updatedOrder : m));
    }

    showToast(`${cfg.emoji} ${cfg.label}`);
    setUpdatingMissionId(null);
  }

  function getMissionActions(mission: any): { label: string; emoji: string; status: string; color: string }[] {
    switch (mission.status) {
      case "driver_assigned":
        return [{ label: "Je suis arrivé à la pharmacie", emoji: "🏥", status: "driver_arrived_at_pharmacy", color: "bg-indigo-600" }];
      case "driver_arrived_at_pharmacy":
        return mission.pickup_otp_verified
          ? [{ label: "J'ai récupéré le colis", emoji: "📬", status: "picked_up", color: "bg-orange-600" }]
          : [];
      case "picked_up":
        return [{ label: "Je suis en route", emoji: "🚀", status: "on_the_way", color: "bg-orange-500" }];
      case "on_the_way":
        return [{ label: "Je suis arrivé chez le client", emoji: "📍", status: "driver_arrived", color: "bg-teal-600" }];
      default:
        return [];
    }
  }

  function openGoogleMaps(lat: any, lng: any, label?: string) {
    window.open(`https://maps.google.com/?q=${lat},${lng}&label=${encodeURIComponent(label || "")}`, "_blank");
  }

  // ✅ Calcul des gains pour l'onglet Gains
  function computeEarnings() {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayEarnings = history
      .filter(o => o.delivered_at && o.delivered_at.startsWith(todayStr))
      .reduce((s, o) => s + Number(o.driver_earning || 0), 0);

    const weekEarnings = history
      .filter(o => o.delivered_at && new Date(o.delivered_at) >= weekAgo)
      .reduce((s, o) => s + Number(o.driver_earning || 0), 0);

    const monthEarnings = history
      .filter(o => o.delivered_at && new Date(o.delivered_at) >= monthAgo)
      .reduce((s, o) => s + Number(o.driver_earning || 0), 0);

    const totalEarnings = Number(driverProfile?.total_earnings || 0);

    return { todayEarnings, weekEarnings, monthEarnings, totalEarnings };
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl">
          <p className="text-[#00572D] dark:text-green-400 font-bold">Chargement...</p>
        </div>
      </main>
    );
  }

  if (!driverProfile?.is_verified) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 text-center max-w-sm shadow-xl">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="text-xl font-bold text-[#00572D] dark:text-green-400">Compte en vérification</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            Votre compte livreur est en cours de vérification par l'équipe KISI.
          </p>
          <button onClick={handleLogout} className="mt-6 w-full bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl font-bold text-sm transition">
            🚪 Déconnexion
          </button>
        </div>
      </main>
    );
  }

  const earnings = computeEarnings();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      <div className="max-w-lg mx-auto px-4 pt-6">

        {/* HEADER */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[#00572D] dark:text-green-400 truncate">
                🏍️ {driverProfile.full_name}
              </h1>
              <p className="text-xs text-gray-400">⭐ {driverProfile.rating}/5 · {driverProfile.total_deliveries} livraisons</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={toggleAvailability}
                className={`px-3 py-2 rounded-xl font-bold text-xs transition whitespace-nowrap ${
                  driverProfile.is_available
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                }`}
              >
                {driverProfile.is_available ? "🟢 En ligne" : "🔴 Hors ligne"}
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl font-bold text-xs transition whitespace-nowrap shadow-sm"
              >
                <span>🚪</span>
                <span>Déconnexion</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-[#00572D] dark:text-green-400">{driverProfile.total_deliveries}</p>
              <p className="text-[10px] text-gray-400">Livraisons</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-[#00572D] dark:text-green-400">{(driverProfile.total_earnings || 0).toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">FCFA gagnés</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-[#00572D] dark:text-green-400">⭐ {driverProfile.rating}</p>
              <p className="text-[10px] text-gray-400">Note</p>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-5">
          {[
            { key: "missions", label: "📋 Missions", count: availableMissions.length },
            { key: "active", label: "🚀 En cours", count: activeMissions.length },
            { key: "earnings", label: "💰 Gains", count: 0 },
            { key: "profile", label: "👤 Profil", count: 0 },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`flex-1 py-2 rounded-xl font-bold text-[11px] transition border-2 ${
                tab === t.key
                  ? "bg-[#00572D] text-white border-[#00572D]"
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
              }`}
            >
              {t.label}
              {t.count > 0 && tab !== t.key && (
                <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ========== MISSIONS DISPONIBLES ========== */}
        {tab === "missions" && (
          <div className="space-y-3">
            {!driverProfile.is_available && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
                <p className="text-xs text-yellow-700 dark:text-yellow-400 text-center font-semibold">🔴 Vous êtes hors ligne</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center mt-1">Activez votre disponibilité pour accepter des missions.</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {availableMissions.length} mission{availableMissions.length !== 1 ? "s" : ""} disponible{availableMissions.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={loadAvailableMissions}
                disabled={loadingMissions}
                className="text-xs text-[#00572D] dark:text-green-400 font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                {loadingMissions ? <span className="w-3 h-3 border border-[#00572D] border-t-transparent rounded-full animate-spin inline-block" /> : "🔄"}
                Actualiser
              </button>
            </div>

            {loadingMissions && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 text-center shadow-sm">
                <div className="w-6 h-6 border-2 border-[#00572D] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Chargement...</p>
              </div>
            )}

            {!loadingMissions && availableMissions.length === 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 text-center shadow-sm">
                <div className="text-5xl mb-3">🔍</div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Aucune mission disponible</p>
                <p className="text-xs text-gray-400 mt-1">Les nouvelles missions apparaîtront ici automatiquement.</p>
              </div>
            )}

            {!loadingMissions && availableMissions.map((mission) => {
              const isAccepting = acceptingMissionId === mission.id;
              const isOpen = openDetailMissionId === mission.id;

              return (
                <div
                  key={mission.id}
                  ref={el => { accordionRefs.current[mission.id] = el; }}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                >
                  {/* Carte mission */}
                  <div className="p-4">
                    {/* Pharmacie */}
                    <div className="flex items-center gap-3 mb-3">
                      {mission.pharmacies?.logo_url ? (
                        <img src={mission.pharmacies.logo_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#00572D]/10 flex items-center justify-center text-lg">🏥</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm dark:text-white">🏥 {mission.pharmacies?.name || "Pharmacie"}</p>
                        <p className="text-xs text-gray-400">📍 {mission.pharmacies?.city || "—"}</p>
                      </div>
                      <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded-full font-bold shrink-0">
                        🎁 Prête
                      </span>
                    </div>

                    {/* Adresse */}
                    {mission.addresses && (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5 mb-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          🏠 <span className="font-medium">{mission.addresses.address_line}</span>
                          {mission.addresses.district && `, ${mission.addresses.district}`}
                        </p>
                        <p className="text-xs text-gray-400">📍 {mission.addresses.city}</p>
                      </div>
                    )}

                    {/* Montants */}
                    <div className="flex justify-between items-center mb-3 bg-green-50 dark:bg-green-900/10 rounded-xl p-2.5">
                      <div>
                        <p className="text-[10px] text-gray-400">Frais livraison</p>
                        <p className="font-bold text-sm text-[#00572D] dark:text-green-400">{(mission.delivery_fee || 0).toLocaleString()} FCFA</p>
                      </div>
                      <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Votre gain</p>
                        <p className="font-bold text-sm text-[#00572D] dark:text-green-400">{(mission.driver_earning || 0).toLocaleString()} FCFA</p>
                      </div>
                    </div>

                    {mission.ready_at && (
                      <p className="text-[10px] text-gray-400 mb-3 text-center">
                        🕒 Prête depuis {new Date(mission.ready_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}

                    {/* Boutons */}
                    <div className="flex gap-2">
                      {/* ✅ Bouton détails — accordion */}
                      <button
                        onClick={() => toggleDetail(mission.id)}
                        className={`flex-1 border-2 py-2.5 rounded-xl font-bold text-xs transition ${
                          isOpen
                            ? "border-[#00572D] bg-[#00572D]/5 text-[#00572D] dark:text-green-400"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {isOpen ? "▲ Masquer" : "📋 Détails"}
                      </button>

                      {/* Bouton accepter — loading indépendant */}
                      <button
                        onClick={() => acceptMission(mission.id)}
                        disabled={isAccepting || !driverProfile.is_available}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition ${
                          !driverProfile.is_available
                            ? "bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                            : "bg-[#00572D] text-white hover:bg-green-800 disabled:opacity-70"
                        }`}
                      >
                        {isAccepting ? (
                          <span className="flex items-center justify-center gap-1">
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            En cours...
                          </span>
                        ) : !driverProfile.is_available ? "🔴 Hors ligne" : "✅ Accepter"}
                      </button>
                    </div>
                  </div>

                  {/* ✅ ACCORDION — Détails sous la carte */}
                  {isOpen && (
                    <div className="border-t border-gray-100 dark:border-gray-800 px-4 pb-4 pt-3 space-y-3 bg-gray-50/50 dark:bg-gray-800/20">
                      {/* Pharmacie détail */}
                      <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">🏥 Pharmacie</p>
                        <p className="font-bold text-sm text-[#00572D] dark:text-green-400">{mission.pharmacies?.name}</p>
                        {mission.pharmacies?.address && (
                          <p className="text-xs text-gray-400">📍 {mission.pharmacies.address}, {mission.pharmacies?.city}</p>
                        )}
                        {mission.pharmacies?.phone && (
                          <a href={`tel:${mission.pharmacies.phone}`} className="text-xs text-[#00572D] dark:text-green-400 font-semibold block mt-1">
                            📞 {mission.pharmacies.phone}
                          </a>
                        )}
                        {mission.pharmacies?.latitude && mission.pharmacies?.longitude && (
                          <button
                            onClick={() => openGoogleMaps(mission.pharmacies.latitude, mission.pharmacies.longitude, mission.pharmacies.name)}
                            className="mt-2 w-full bg-[#00572D] text-white py-2 rounded-xl text-xs font-bold"
                          >
                            🗺️ Ouvrir dans Google Maps
                          </button>
                        )}
                      </div>

                      {/* Client détail */}
                      {mission.addresses && (
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">🏠 Client</p>
                          <p className="font-bold text-sm dark:text-white">{mission.addresses.full_name}</p>
                          <a href={`tel:${mission.addresses.phone}`} className="text-xs text-[#00572D] dark:text-green-400 font-semibold">
                            📞 {mission.addresses.phone}
                          </a>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {mission.addresses.address_line}
                            {mission.addresses.district && `, ${mission.addresses.district}`}
                          </p>
                          <p className="text-xs text-gray-400">{mission.addresses.city}</p>
                          {mission.addresses.notes && (
                            <p className="text-xs text-gray-400 mt-0.5 italic">📝 {mission.addresses.notes}</p>
                          )}
                          {mission.addresses.latitude && mission.addresses.longitude && (
                            <button
                              onClick={() => openGoogleMaps(mission.addresses.latitude, mission.addresses.longitude, mission.addresses.full_name)}
                              className="mt-2 w-full border-2 border-[#00572D] text-[#00572D] dark:text-green-400 py-2 rounded-xl text-xs font-bold"
                            >
                              🧭 Naviguer vers le client
                            </button>
                          )}
                        </div>
                      )}

                      {/* Code */}
                      {mission.pickup_otp && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-xl p-3 text-center">
                          <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400 mb-1">🔐 Code de récupération</p>
                          <p className="text-2xl font-black tracking-widest text-yellow-700 dark:text-yellow-400">
                            {mission.pickup_otp}
                          </p>
                        </div>
                      )}

                      {/* Médicaments */}
                      {missionItems[mission.id] && missionItems[mission.id].length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">
                            💊 {missionItems[mission.id].length} médicament{missionItems[mission.id].length > 1 ? "s" : ""}
                          </p>
                          <div className="space-y-1.5">
                            {missionItems[mission.id].map((item) => (
                              <div key={item.id} className="flex justify-between items-center bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                <div>
                                  <p className="text-xs font-medium dark:text-white">{item.medicine_name}</p>
                                  <p className="text-[10px] text-gray-400">Qté : {item.quantity}</p>
                                </div>
                                <p className="font-bold text-xs text-[#00572D] dark:text-green-400">
                                  {(item.subtotal || 0).toLocaleString()} FCFA
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {missionItems[mission.id] === undefined && (
                        <div className="text-center py-2">
                          <div className="w-4 h-4 border-2 border-[#00572D] border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ========== EN COURS ========== */}
        {tab === "active" && (
          <div className="space-y-4">
            {activeMissions.length === 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 text-center shadow-sm">
                <div className="text-5xl mb-3">🏍️</div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Aucune mission en cours</p>
                <p className="text-xs text-gray-400 mt-1">Acceptez une mission pour qu'elle apparaisse ici.</p>
              </div>
            )}

            {activeMissions.map((mission) => {
              const cfg = getStatusConfig(mission.status);
              const actions = getMissionActions(mission);
              const isUpdating = updatingMissionId === mission.id;
              const isOpen = openDetailMissionId === mission.id;

              return (
                <div
                  key={mission.id}
                  ref={el => { accordionRefs.current[mission.id] = el; }}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                >
                  {/* Statut */}
                  <div className={`${cfg.bg} px-4 py-2 flex items-center justify-between`}>
                    <span className={`text-xs font-bold ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(mission.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Code */}
                    {mission.pickup_otp && (
                      <div className={`rounded-xl p-3 text-center border-2 ${
                        mission.pickup_otp_verified
                          ? "bg-green-50 dark:bg-green-900/20 border-green-400"
                          : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400"
                      }`}>
                        <p className={`text-xs font-bold mb-1 ${
                          mission.pickup_otp_verified ? "text-green-700 dark:text-green-400" : "text-yellow-700 dark:text-yellow-400"
                        }`}>
                          {mission.pickup_otp_verified ? "✅ Code validé" : "🔐 Code à présenter à la pharmacie"}
                        </p>
                        <p className={`text-3xl font-black tracking-widest ${
                          mission.pickup_otp_verified ? "text-green-700 dark:text-green-400" : "text-yellow-700 dark:text-yellow-400"
                        }`}>
                          {mission.pickup_otp}
                        </p>
                      </div>
                    )}

                    {/* Pharmacie */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">🏥 Pharmacie</p>
                      <p className="font-bold text-sm text-[#00572D] dark:text-green-400">{mission.pharmacies?.name}</p>
                      {mission.pharmacies?.phone && (
                        <a href={`tel:${mission.pharmacies.phone}`} className="text-xs text-[#00572D] dark:text-green-400 font-semibold">
                          📞 {mission.pharmacies.phone}
                        </a>
                      )}
                      {mission.pharmacies?.latitude && mission.pharmacies?.longitude && (
                        <button
                          onClick={() => openGoogleMaps(mission.pharmacies.latitude, mission.pharmacies.longitude, mission.pharmacies.name)}
                          className="mt-2 w-full bg-[#00572D] text-white py-2 rounded-xl text-xs font-bold"
                        >
                          🗺️ Ouvrir dans Google Maps
                        </button>
                      )}
                    </div>

                    {/* Client */}
                    {mission.addresses && (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">🏠 Livrer à</p>
                        <p className="font-semibold text-sm dark:text-white">{mission.addresses.full_name}</p>
                        <a href={`tel:${mission.addresses.phone}`} className="text-xs text-[#00572D] dark:text-green-400 font-semibold">
                          📞 {mission.addresses.phone}
                        </a>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {mission.addresses.address_line}
                          {mission.addresses.district && `, ${mission.addresses.district}`}
                        </p>
                        <p className="text-xs text-gray-400">{mission.addresses.city}</p>
                        {mission.addresses.notes && (
                          <p className="text-xs text-gray-400 mt-0.5 italic">📝 {mission.addresses.notes}</p>
                        )}
                        {mission.addresses.latitude && mission.addresses.longitude && (
                          <button
                            onClick={() => openGoogleMaps(mission.addresses.latitude, mission.addresses.longitude, mission.addresses.full_name)}
                            className="mt-2 w-full border-2 border-[#00572D] text-[#00572D] dark:text-green-400 py-2 rounded-xl text-xs font-bold"
                          >
                            🧭 Naviguer vers le client
                          </button>
                        )}
                      </div>
                    )}

                    {/* Gain */}
                    <div className="bg-[#00572D] rounded-xl p-3 text-white flex justify-between items-center">
                      <span className="text-green-200 text-xs">Votre gain</span>
                      <span className="font-bold text-base">{(mission.driver_earning || 0).toLocaleString()} FCFA</span>
                    </div>

                    {/* Message attente client */}
                    {mission.status === "driver_arrived" && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-center">
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-400">📍 Vous êtes arrivé chez le client</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          En attente de la confirmation du client.
                        </p>
                        <p className="text-xs text-blue-500 dark:text-blue-400 mt-1 font-semibold animate-pulse">
                          ⏳ Le client doit confirmer la réception
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    {actions.map((action) => (
                      <button
                        key={action.status}
                        onClick={() => updateMissionStatus(mission.id, action.status)}
                        disabled={isUpdating}
                        className={`w-full ${action.color} text-white p-3 rounded-xl font-bold text-sm disabled:opacity-50 transition`}
                      >
                        {isUpdating ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Mise à jour...
                          </span>
                        ) : `${action.emoji} ${action.label}`}
                      </button>
                    ))}

                    {/* Accordion détails */}
                    <button
                      onClick={() => toggleDetail(mission.id)}
                      className={`w-full border-2 py-2 rounded-xl text-xs font-bold transition ${
                        isOpen
                          ? "border-[#00572D] bg-[#00572D]/5 text-[#00572D] dark:text-green-400"
                          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {isOpen ? "▲ Masquer les détails" : "📋 Voir tous les détails"}
                    </button>
                  </div>

                  {/* ✅ ACCORDION détails mission active */}
                  {isOpen && (
                    <div className="border-t border-gray-100 dark:border-gray-800 px-4 pb-4 pt-3 space-y-3 bg-gray-50/50 dark:bg-gray-800/20">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        N° commande : {mission.id.substring(0, 8).toUpperCase()}
                      </p>

                      {missionItems[mission.id] && missionItems[mission.id].length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">
                            💊 {missionItems[mission.id].length} médicament{missionItems[mission.id].length > 1 ? "s" : ""}
                          </p>
                          <div className="space-y-1.5">
                            {missionItems[mission.id].map((item) => (
                              <div key={item.id} className="flex justify-between items-center bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                <div>
                                  <p className="text-xs font-medium dark:text-white">{item.medicine_name}</p>
                                  <p className="text-[10px] text-gray-400">Qté : {item.quantity}</p>
                                </div>
                                <p className="font-bold text-xs text-[#00572D] dark:text-green-400">
                                  {(item.subtotal || 0).toLocaleString()} FCFA
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {missionItems[mission.id] === undefined && (
                        <div className="text-center py-2">
                          <div className="w-4 h-4 border-2 border-[#00572D] border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ========== GAINS ========== */}
        {tab === "earnings" && (
          <div className="space-y-4">
            {/* Total général */}
            <div className="bg-[#00572D] rounded-2xl p-5 text-white text-center">
              <p className="text-sm text-green-200 mb-1">💰 Gains totaux</p>
              <p className="text-4xl font-black">{earnings.totalEarnings.toLocaleString()}</p>
              <p className="text-green-200 text-sm mt-1">FCFA</p>
            </div>

            {/* Stats périodes */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Aujourd'hui", value: earnings.todayEarnings, emoji: "📅" },
                { label: "Cette semaine", value: earnings.weekEarnings, emoji: "📆" },
                { label: "Ce mois", value: earnings.monthEarnings, emoji: "🗓️" },
              ].map((s) => (
                <div key={s.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 text-center shadow-sm">
                  <div className="text-xl mb-1">{s.emoji}</div>
                  <p className="text-sm font-black text-[#00572D] dark:text-green-400">
                    {s.value.toLocaleString()}
                  </p>
                  <p className="text-[9px] text-gray-400">FCFA</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Stats livraisons */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <p className="font-bold text-sm mb-3 dark:text-white">📊 Statistiques</p>
              <div className="space-y-2">
                {[
                  { label: "Total livraisons", value: String(driverProfile.total_deliveries) },
                  { label: "Note moyenne", value: `⭐ ${driverProfile.rating}/5` },
                  {
                    label: "Gain moyen / livraison",
                    value: driverProfile.total_deliveries > 0
                      ? `${Math.round(earnings.totalEarnings / driverProfile.total_deliveries).toLocaleString()} FCFA`
                      : "—"
                  },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{row.label}</span>
                    <span className="text-sm font-bold text-[#00572D] dark:text-green-400">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Historique des paiements */}
            <div>
              <p className="font-bold text-sm dark:text-white mb-3">
                💳 Historique des paiements ({history.length})
              </p>

              {history.length === 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 text-center shadow-sm">
                  <div className="text-4xl mb-2">💰</div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Aucun paiement reçu pour le moment</p>
                </div>
              )}

              <div className="space-y-2">
                {history.map((order) => (
                  <div key={order.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-sm dark:text-white">🏥 {order.pharmacies?.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {order.delivered_at
                            ? new Date(order.delivered_at).toLocaleDateString("fr-FR", {
                                day: "numeric", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })
                            : "—"}
                        </p>
                        <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold mt-1 inline-block">
                          ✅ Paiement reçu
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-[#00572D] dark:text-green-400">
                          +{(order.driver_earning || 0).toLocaleString()} FCFA
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Net après commission</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== PROFIL ========== */}
        {tab === "profile" && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
            <div className="text-center">
              {driverProfile.photo_url ? (
                <img src={driverProfile.photo_url} alt="" className="w-20 h-20 rounded-full mx-auto object-cover border-4 border-[#00572D]" />
              ) : (
                <div className="w-20 h-20 rounded-full mx-auto bg-[#00572D] flex items-center justify-center text-white text-3xl font-bold">
                  {driverProfile.full_name?.charAt(0)}
                </div>
              )}
              <h2 className="font-bold text-lg mt-3 dark:text-white">{driverProfile.full_name}</h2>
              <p className="text-xs text-gray-400">📞 {driverProfile.phone}</p>
              {driverProfile.city && <p className="text-xs text-gray-400">📍 {driverProfile.city}</p>}
            </div>

            <div className="space-y-2">
              {[
                { label: "Véhicule", value: `${driverProfile.vehicle_type || "—"} ${driverProfile.vehicle_brand || ""}` },
                { label: "Plaque", value: driverProfile.vehicle_plate || "—" },
                { label: "Couleur", value: driverProfile.vehicle_color || "—" },
                {
                  label: "Statut",
                  value: driverProfile.is_verified ? "✅ Vérifié" : "⏳ En attente",
                  valueClass: driverProfile.is_verified ? "text-green-600" : "text-yellow-600",
                },
                { label: "Livraisons", value: String(driverProfile.total_deliveries) },
                {
                  label: "Gains totaux",
                  value: `${(driverProfile.total_earnings || 0).toLocaleString()} FCFA`,
                  valueClass: "text-[#00572D] dark:text-green-400",
                },
              ].map((row) => (
                <div key={row.label} className="flex justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{row.label}</span>
                  <span className={`text-sm font-bold dark:text-white ${row.valueClass || ""}`}>{row.value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleLogout}
              className="w-full bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl font-bold text-sm transition"
            >
              🚪 Déconnexion
            </button>
          </div>
        )}
      </div>

      {/* ✅ FOOTER NAVIGATION — 3 boutons interactifs */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#00572D] dark:bg-gray-900 border-t border-green-800 dark:border-gray-700 shadow-lg z-50">
        <div className="max-w-lg mx-auto grid grid-cols-3 h-16">
          {[
            { key: "missions", label: "Missions", emoji: "📋", count: availableMissions.length },
            { key: "active", label: "En cours", emoji: "🚀", count: activeMissions.length },
            { key: "earnings", label: "Gains", emoji: "💰", count: 0 },
          ].map((item) => {
            const isActive = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key as any)}
                className={`flex flex-col items-center justify-center text-xs relative transition-colors ${
                  isActive
                    ? "text-white font-bold"
                    : "text-green-200 dark:text-gray-400 hover:text-white"
                }`}
              >
                {/* Indicateur actif */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />
                )}

                {/* Badge count */}
                {item.count > 0 && !isActive && (
                  <span className="absolute top-2 right-6 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black">
                    {item.count > 9 ? "9+" : item.count}
                  </span>
                )}

                <span className="text-xl mb-0.5">{item.emoji}</span>
                <span className="text-[10px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}