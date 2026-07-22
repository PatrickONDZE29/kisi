"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProviderTemp";

const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  payment_confirmed: { label: "Paiement confirmé", emoji: "✅", color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
  preparing: { label: "Préparation", emoji: "📦", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
  ready: { label: "Prête", emoji: "🎁", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
  driver_assigned: { label: "Vous êtes affecté", emoji: "🏍️", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  driver_arrived_at_pharmacy: { label: "Arrivé à la pharmacie", emoji: "🏥", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  picked_up: { label: "Récupérée", emoji: "📬", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
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
  const [activeMission, setActiveMission] = useState<any | null>(null);
  const [activeMissionItems, setActiveMissionItems] = useState<any[]>([]);
  const [activeMissionAddress, setActiveMissionAddress] = useState<any | null>(null);
  const [tab, setTab] = useState<"missions" | "active" | "history" | "profile">("missions");
  const [history, setHistory] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [loadingMissions, setLoadingMissions] = useState(false);

  const channelRef = useRef<any>(null);
  const refreshIntervalRef = useRef<any>(null);
  const driverProfileRef = useRef<any>(null);

  useEffect(() => {
    loadDriver();

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
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
    await loadActiveMission(driver.id);
    await loadHistory(driver.id);

    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`driver-missions-${driver.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
      }, () => {
        loadAvailableMissions();
        if (driverProfileRef.current) {
          loadActiveMission(driverProfileRef.current.id);
        }
      })
      .subscribe();

    channelRef.current = channel;

    refreshIntervalRef.current = setInterval(() => {
      loadAvailableMissions();
    }, 30000);
  }

  async function loadAvailableMissions() {
    setLoadingMissions(true);

    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        pharmacies(name, city, logo_url, latitude, longitude),
        addresses(*)
      `)
      .eq("status", "ready")
      .is("driver_id", null)
      .order("ready_at", { ascending: true });

    if (error) {
      console.error("loadAvailableMissions error:", error.message);
    }

    setAvailableMissions(data || []);
    setLoadingMissions(false);
  }

  async function loadActiveMission(driverId: string) {
    const { data } = await supabase
      .from("orders")
      .select("*, pharmacies(name, city, logo_url, phone), addresses(*)")
      .eq("driver_id", driverId)
      .in("status", ["driver_assigned", "driver_arrived_at_pharmacy", "picked_up", "on_the_way", "driver_arrived"])
      .maybeSingle();

    if (data) {
      setActiveMission(data);
      setActiveMissionAddress(data.addresses);

      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", data.id);

      setActiveMissionItems(items || []);
    } else {
      setActiveMission(null);
      setActiveMissionItems([]);
      setActiveMissionAddress(null);
    }
  }

  async function loadHistory(driverId: string) {
    const { data } = await supabase
      .from("orders")
      .select("*, pharmacies(name)")
      .eq("driver_id", driverId)
      .eq("status", "delivered")
      .order("delivered_at", { ascending: false })
      .limit(20);

    setHistory(data || []);
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

    if (newStatus) {
      showToast("Vous êtes maintenant disponible 🟢");
      startGPS();
    } else {
      showToast("Vous n'êtes plus disponible 🔴");
      stopGPS();
    }
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
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    const dp = driverProfileRef.current;
    if (dp) {
      supabase.from("driver_locations").upsert({
        driver_id: dp.id,
        latitude: 0,
        longitude: 0,
        is_online: false,
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

    setUpdating(true);

    const { error } = await supabase
      .from("orders")
      .update({
        driver_id: dp.id,
        status: "driver_assigned",
        driver_assigned_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("status", "ready")
      .is("driver_id", null);

    if (error) {
      showToast("Cette mission n'est plus disponible", "error");
      setUpdating(false);
      await loadAvailableMissions();
      return;
    }

    // Événement de livraison
    await supabase.from("delivery_events").insert({
      order_id: orderId,
      actor_type: "driver",
      actor_id: dp.id,
      status: "driver_assigned",
      label: `Livreur ${dp.full_name} affecté`,
    });

    // Notification client
    const order = availableMissions.find((o) => o.id === orderId);
    if (order?.user_id) {
      await supabase.from("notifications").insert({
        user_id: order.user_id,
        type: "delivery",
        title: "Livreur affecté 🏍️",
        body: `${dp.full_name} va récupérer votre commande.`,
        order_id: orderId,
      });
    }

    // ✅ Charger la mission active AVANT de changer d'onglet
    await loadActiveMission(dp.id);
    await loadAvailableMissions();

    setUpdating(false);
    startGPS();

    showToast("Mission acceptée ! 🏍️");

    // ✅ Basculer sur l'onglet En cours
    setTab("active");
  }

  async function updateMissionStatus(newStatus: string) {
    const dp = driverProfileRef.current;
    if (!activeMission || !dp) return;
    setUpdating(true);

    const updateData: any = { status: newStatus };
    if (newStatus === "picked_up") updateData.picked_up_at = new Date().toISOString();
    if (newStatus === "delivered") updateData.delivered_at = new Date().toISOString();

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", activeMission.id);

    if (error) { showToast(error.message, "error"); setUpdating(false); return; }

    const cfg = getStatusConfig(newStatus);

    await supabase.from("delivery_events").insert({
      order_id: activeMission.id,
      actor_type: "driver",
      actor_id: dp.id,
      status: newStatus,
      label: cfg.label,
    });

    let notifTitle = "";
    let notifBody = "";

    switch (newStatus) {
      case "driver_arrived_at_pharmacy":
        notifTitle = "Livreur à la pharmacie 🏥";
        notifBody = "Le livreur est arrivé à la pharmacie.";
        break;
      case "on_the_way":
        notifTitle = "Commande en route 🚀";
        notifBody = "Le livreur est en route vers vous.";
        break;
      case "driver_arrived":
        notifTitle = "Livreur arrivé 📍";
        notifBody = "Le livreur est arrivé à votre adresse.";
        break;
      case "delivered":
        notifTitle = "Livraison effectuée 🎉";
        notifBody = "Votre médicament a été livré. Merci d'avoir utilisé KISI !";
        break;
    }

    if (notifTitle) {
      await supabase.from("notifications").insert({
        user_id: activeMission.user_id,
        type: "delivery",
        title: notifTitle,
        body: notifBody,
        order_id: activeMission.id,
      });
    }

    if (newStatus === "delivered") {
      showToast("Livraison terminée ! 🎉");
      await loadHistory(dp.id);
      setActiveMission(null);
      setTab("missions");
    } else {
      showToast(`Statut mis à jour : ${cfg.label}`);
      await loadActiveMission(dp.id);
    }

    setUpdating(false);
  }

  function getMissionActions(): { label: string; emoji: string; status: string; color: string }[] {
    if (!activeMission) return [];
    switch (activeMission.status) {
      case "driver_assigned":
        return [{ label: "Arrivé à la pharmacie", emoji: "🏥", status: "driver_arrived_at_pharmacy", color: "bg-indigo-600" }];
      case "driver_arrived_at_pharmacy":
        return [];
      case "picked_up":
        return [{ label: "En route vers le client", emoji: "🚀", status: "on_the_way", color: "bg-orange-600" }];
      case "on_the_way":
        return [{ label: "Arrivé chez le client", emoji: "📍", status: "driver_arrived", color: "bg-teal-600" }];
      case "driver_arrived":
        return [{ label: "Livraison effectuée", emoji: "🎉", status: "delivered", color: "bg-green-600" }];
      default:
        return [];
    }
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
          <h2 className="text-xl font-bold text-[#00572D] dark:text-green-400">
            Compte en vérification
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            Votre compte livreur est en cours de vérification par l'équipe KISI.
            Vous serez notifié une fois activé.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 w-full bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl font-bold text-sm transition"
          >
            🚪 Déconnexion
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      <div className="max-w-lg mx-auto px-4 pt-6">

        {/* ✅ HEADER avec bouton Déconnexion bien visible */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-5">

          {/* Ligne 1 — nom + boutons */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[#00572D] dark:text-green-400 truncate">
                🏍️ {driverProfile.full_name}
              </h1>
              <p className="text-xs text-gray-400">
                ⭐ {driverProfile.rating}/5 · {driverProfile.total_deliveries} livraisons
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Bouton disponibilité */}
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

              {/* ✅ Bouton Déconnexion bien visible */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl font-bold text-xs transition whitespace-nowrap shadow-sm"
              >
                <span>🚪</span>
                <span>Déconnexion</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-[#00572D] dark:text-green-400">
                {driverProfile.total_deliveries}
              </p>
              <p className="text-[10px] text-gray-400">Livraisons</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-[#00572D] dark:text-green-400">
                {(driverProfile.total_earnings || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-400">FCFA gagnés</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-[#00572D] dark:text-green-400">
                ⭐ {driverProfile.rating}
              </p>
              <p className="text-[10px] text-gray-400">Note</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { key: "missions", label: "📋 Missions", count: availableMissions.length },
            { key: "active", label: "🚀 En cours", count: activeMission ? 1 : 0 },
            { key: "history", label: "📊 Historique", count: history.length },
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
                <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ========== MISSIONS DISPONIBLES ========== */}
        {tab === "missions" && (
          <div className="space-y-3">

            {!driverProfile.is_available && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
                <p className="text-xs text-yellow-700 dark:text-yellow-400 text-center font-semibold">
                  🔴 Vous êtes hors ligne
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center mt-1">
                  Activez votre disponibilité pour accepter des missions.
                </p>
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
                {loadingMissions ? (
                  <span className="w-3 h-3 border border-[#00572D] border-t-transparent rounded-full animate-spin inline-block" />
                ) : "🔄"}
                Actualiser
              </button>
            </div>

            {loadingMissions && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 text-center shadow-sm">
                <div className="w-6 h-6 border-2 border-[#00572D] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Chargement des missions...</p>
              </div>
            )}

            {!loadingMissions && availableMissions.length === 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 text-center shadow-sm">
                <div className="text-5xl mb-3">🔍</div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Aucune mission disponible</p>
                <p className="text-xs text-gray-400 mt-1">Les nouvelles missions apparaîtront ici automatiquement.</p>
              </div>
            )}

            {!loadingMissions && availableMissions.map((mission) => (
              <div key={mission.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  {mission.pharmacies?.logo_url ? (
                    <img src={mission.pharmacies.logo_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#00572D]/10 flex items-center justify-center text-lg">🏥</div>
                  )}
                  <div>
                    <p className="font-bold text-sm dark:text-white">🏥 {mission.pharmacies?.name || "Pharmacie"}</p>
                    <p className="text-xs text-gray-400">📍 {mission.pharmacies?.city || "—"}</p>
                  </div>
                  <div className="ml-auto">
                    <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded-full font-bold">
                      🎁 Prête
                    </span>
                  </div>
                </div>

                {mission.addresses && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5 mb-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      🏠 <span className="font-medium">{mission.addresses.address_line}</span>
                      {mission.addresses.district && `, ${mission.addresses.district}`}
                    </p>
                    <p className="text-xs text-gray-400">📍 {mission.addresses.city}</p>
                  </div>
                )}

                <div className="flex justify-between items-center mb-3 bg-green-50 dark:bg-green-900/10 rounded-xl p-2.5">
                  <div>
                    <p className="text-[10px] text-gray-400">Frais de livraison</p>
                    <p className="font-bold text-sm text-[#00572D] dark:text-green-400">
                      {(mission.delivery_fee || 0).toLocaleString()} FCFA
                    </p>
                  </div>
                  <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400">Votre gain estimé</p>
                    <p className="font-bold text-sm text-[#00572D] dark:text-green-400">
                      {(mission.driver_earning || 0).toLocaleString()} FCFA
                    </p>
                  </div>
                </div>

                {mission.ready_at && (
                  <p className="text-[10px] text-gray-400 mb-3 text-center">
                    🕒 Prête depuis {new Date(mission.ready_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}

                <button
                  onClick={() => acceptMission(mission.id)}
                  disabled={updating || !driverProfile.is_available}
                  className={`w-full p-3 rounded-xl font-bold text-sm transition ${
                    !driverProfile.is_available
                      ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      : "bg-[#00572D] text-white hover:bg-green-800 disabled:opacity-50"
                  }`}
                >
                  {updating
                    ? "Acceptation en cours..."
                    : !driverProfile.is_available
                    ? "🔴 Passez en ligne pour accepter"
                    : "✅ Accepter cette mission"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ========== MISSION ACTIVE ========== */}
        {tab === "active" && (
          <div>
            {!activeMission && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 text-center shadow-sm">
                <div className="text-5xl mb-3">🏍️</div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  Aucune mission en cours
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Acceptez une mission pour qu'elle apparaisse ici.
                </p>
              </div>
            )}

            {activeMission && (
              <div className="space-y-4">
                {(() => {
                  const cfg = getStatusConfig(activeMission.status);
                  return (
                    <div className={`${cfg.bg} rounded-xl p-3 text-center`}>
                      <p className={`text-lg font-bold ${cfg.color}`}>
                        {cfg.emoji} {cfg.label}
                      </p>
                    </div>
                  );
                })()}

                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                  <p className="font-bold text-sm text-[#00572D] dark:text-green-400 mb-1">
                    🏥 {activeMission.pharmacies?.name}
                  </p>
                  <p className="text-xs text-gray-400">📍 {activeMission.pharmacies?.city}</p>
                  {activeMission.pharmacies?.phone && (
                    <a
                      href={`tel:${activeMission.pharmacies.phone}`}
                      className="inline-block mt-2 text-xs text-[#00572D] dark:text-green-400 font-semibold"
                    >
                      📞 {activeMission.pharmacies.phone}
                    </a>
                  )}
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                  <p className="font-bold text-sm mb-2 dark:text-white">💊 Produits</p>
                  {activeMissionItems.length === 0 && (
                    <p className="text-xs text-gray-400">Aucun produit trouvé</p>
                  )}
                  {activeMissionItems.map((item) => (
                    <div key={item.id} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <p className="text-xs dark:text-gray-300">{item.medicine_name} × {item.quantity}</p>
                      <p className="text-xs font-bold text-[#00572D] dark:text-green-400">
                        {item.subtotal?.toLocaleString()} FCFA
                      </p>
                    </div>
                  ))}
                </div>

                {activeMissionAddress && (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                    <p className="font-bold text-sm mb-2 dark:text-white">🏠 Livrer à</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {activeMissionAddress.full_name}
                    </p>
                    <a
                      href={`tel:${activeMissionAddress.phone}`}
                      className="text-xs text-[#00572D] dark:text-green-400 font-semibold"
                    >
                      📞 {activeMissionAddress.phone}
                    </a>
                    <p className="text-xs text-gray-400 mt-1">
                      {activeMissionAddress.address_line}
                      {activeMissionAddress.district && `, ${activeMissionAddress.district}`}
                    </p>
                    <p className="text-xs text-gray-400">{activeMissionAddress.city}</p>
                    {activeMissionAddress.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">📝 {activeMissionAddress.notes}</p>
                    )}
                  </div>
                )}

                {activeMission.pickup_otp &&
                  !activeMission.pickup_otp_verified &&
                  ["driver_assigned", "driver_arrived_at_pharmacy"].includes(activeMission.status) && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-center">
                      <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-1">
                        Montrez ce code à la pharmacie pour récupérer la commande
                      </p>
                      <p className="text-4xl font-black tracking-[0.5em] text-yellow-700 dark:text-yellow-400">
                        {activeMission.pickup_otp}
                      </p>
                    </div>
                  )}

                <div className="bg-[#00572D] rounded-xl p-4 text-white">
                  <div className="flex justify-between">
                    <span className="text-green-200 text-sm">Votre gain</span>
                    <span className="font-bold text-lg">
                      {(activeMission.driver_earning || 0).toLocaleString()} FCFA
                    </span>
                  </div>
                </div>

                {getMissionActions().map((action) => (
                  <button
                    key={action.status}
                    onClick={() => updateMissionStatus(action.status)}
                    disabled={updating}
                    className={`w-full ${action.color} text-white p-3.5 rounded-xl font-bold text-sm disabled:opacity-50 transition`}
                  >
                    {updating ? "Mise à jour..." : `${action.emoji} ${action.label}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========== HISTORIQUE ========== */}
        {tab === "history" && (
          <div className="space-y-3">
            {history.length === 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 text-center shadow-sm">
                <div className="text-5xl mb-3">📊</div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Aucune livraison effectuée</p>
              </div>
            )}

            {history.map((order) => (
              <div key={order.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm dark:text-white">🏥 {order.pharmacies?.name}</p>
                    <p className="text-xs text-gray-400">
                      {order.delivered_at
                        ? new Date(order.delivered_at).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#00572D] dark:text-green-400">
                      +{(order.driver_earning || 0).toLocaleString()} FCFA
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">🎉 Livrée</p>
                  </div>
                </div>
              </div>
            ))}
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
    </main>
  );
}