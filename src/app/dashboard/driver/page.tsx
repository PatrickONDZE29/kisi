"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    loadDriver();
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  async function loadDriver() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: driver } = await supabase
      .from("driver_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!driver) {
      router.push("/register/driver");
      return;
    }

    setDriverProfile(driver);

    // Charger missions disponibles
    await loadAvailableMissions(driver);

    // Charger mission active
    await loadActiveMission(driver.id);

    // Charger historique
    await loadHistory(driver.id);

    setLoading(false);

    // Écouter les nouvelles commandes prêtes
    supabase
      .channel("driver-missions")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        loadAvailableMissions(driver);
        loadActiveMission(driver.id);
      })
      .subscribe();
  }

  async function loadAvailableMissions(driver: any) {
    if (!driver.is_verified || !driver.is_available) {
      setAvailableMissions([]);
      return;
    }

    const { data } = await supabase
      .from("orders")
      .select("*, pharmacies(name, city, logo_url, latitude, longitude), addresses(*)")
      .eq("status", "ready")
      .is("driver_id", null)
      .order("ready_at", { ascending: true });

    setAvailableMissions(data || []);
  }

  async function loadActiveMission(driverId: string) {
    const { data } = await supabase
      .from("orders")
      .select("*, pharmacies(name, city, logo_url, phone), addresses(*)")
      .eq("driver_id", driverId)
      .in("status", ["driver_assigned", "driver_arrived_at_pharmacy", "picked_up", "on_the_way", "driver_arrived"])
      .single();

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

    setDriverProfile({ ...driverProfile, is_available: newStatus });

    if (newStatus) {
      showToast("Vous êtes maintenant disponible 🟢");
      startGPS();
      await loadAvailableMissions(driverProfile);
    } else {
      showToast("Vous n'êtes plus disponible 🔴");
      stopGPS();
    }
  }

  function startGPS() {
    if (!navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        if (!driverProfile) return;

        await supabase.from("driver_locations").upsert({
          driver_id: driverProfile.id,
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

    if (driverProfile) {
      supabase.from("driver_locations").upsert({
        driver_id: driverProfile.id,
        latitude: 0,
        longitude: 0,
        is_online: false,
        updated_at: new Date().toISOString(),
      });
    }
  }

  async function acceptMission(orderId: string) {
    if (!driverProfile) return;
    setUpdating(true);

    const { error } = await supabase
      .from("orders")
      .update({
        driver_id: driverProfile.id,
        status: "driver_assigned",
        driver_assigned_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("status", "ready")
      .is("driver_id", null);

    if (error) {
      showToast("Cette mission n'est plus disponible", "error");
      setUpdating(false);
      await loadAvailableMissions(driverProfile);
      return;
    }

    await supabase.from("delivery_events").insert({
      order_id: orderId,
      actor_type: "driver",
      actor_id: driverProfile.id,
      status: "driver_assigned",
      label: `Livreur ${driverProfile.full_name} affecté`,
    });

    const order = availableMissions.find((o) => o.id === orderId);
    if (order) {
      await supabase.from("notifications").insert({
        user_id: order.user_id,
        type: "delivery",
        title: "Livreur affecté 🏍️",
        body: `${driverProfile.full_name} va récupérer votre commande.`,
        order_id: orderId,
      });
    }

    showToast("Mission acceptée ! 🏍️");
    startGPS();
    await loadActiveMission(driverProfile.id);
    await loadAvailableMissions(driverProfile);
    setUpdating(false);
    setTab("active");
  }

  async function updateMissionStatus(newStatus: string) {
    if (!activeMission || !driverProfile) return;
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
      actor_id: driverProfile.id,
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
      await loadHistory(driverProfile.id);
      setActiveMission(null);
      setTab("missions");
    } else {
      showToast(`Statut mis à jour : ${cfg.label}`);
      await loadActiveMission(driverProfile.id);
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
            Votre compte livreur est en cours de vérification par l'équipe KISI. Vous serez notifié une fois activé.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      <div className="max-w-lg mx-auto px-4 pt-6">

        {/* Header + disponibilité */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-[#00572D] dark:text-green-400">
                🏍️ {driverProfile.full_name}
              </h1>
              <p className="text-xs text-gray-400">
                ⭐ {driverProfile.rating}/5 · {driverProfile.total_deliveries} livraisons
              </p>
            </div>

            <button
              onClick={toggleAvailability}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition ${
                driverProfile.is_available
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              }`}
            >
              {driverProfile.is_available ? "🟢 En ligne" : "🔴 Hors ligne"}
            </button>
          </div>

          {/* Stats rapides */}
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
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 text-center">
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  ⚠️ Activez votre disponibilité pour recevoir des missions.
                </p>
              </div>
            )}

            {driverProfile.is_available && availableMissions.length === 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 text-center shadow-sm">
                <div className="text-5xl mb-3">🔍</div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  Aucune mission disponible pour le moment
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Les nouvelles missions apparaîtront ici automatiquement.
                </p>
              </div>
            )}

            {availableMissions.map((mission) => (
              <div
                key={mission.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  {mission.pharmacies?.logo_url && (
                    <img src={mission.pharmacies.logo_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700" />
                  )}
                  <div>
                    <p className="font-bold text-sm dark:text-white">🏥 {mission.pharmacies?.name}</p>
                    <p className="text-xs text-gray-400">📍 {mission.pharmacies?.city}</p>
                  </div>
                </div>

                {mission.addresses && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 mb-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      🏠 Livrer à : {mission.addresses.address_line}, {mission.addresses.city}
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="text-xs text-gray-400">Frais de livraison</p>
                    <p className="font-bold text-[#00572D] dark:text-green-400">
                      {(mission.delivery_fee || 0).toLocaleString()} FCFA
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Votre gain</p>
                    <p className="font-bold text-[#00572D] dark:text-green-400">
                      {(mission.driver_earning || 0).toLocaleString()} FCFA
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => acceptMission(mission.id)}
                  disabled={updating}
                  className="w-full bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm disabled:opacity-50"
                >
                  {updating ? "Acceptation..." : "✅ Accepter cette mission"}
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
              </div>
            )}

            {activeMission && (
              <div className="space-y-4">
                {/* Statut */}
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

                {/* Pharmacie */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                  <p className="font-bold text-sm text-[#00572D] dark:text-green-400 mb-1">
                    🏥 {activeMission.pharmacies?.name}
                  </p>
                  <p className="text-xs text-gray-400">📍 {activeMission.pharmacies?.city}</p>
                  {activeMission.pharmacies?.phone && (
                    <p className="text-xs text-gray-400">📞 {activeMission.pharmacies.phone}</p>
                  )}
                </div>

                {/* Produits */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                  <p className="font-bold text-sm mb-2 dark:text-white">💊 Produits</p>
                  {activeMissionItems.map((item) => (
                    <div key={item.id} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <p className="text-xs dark:text-gray-300">{item.medicine_name} × {item.quantity}</p>
                      <p className="text-xs font-bold text-[#00572D] dark:text-green-400">{item.subtotal?.toLocaleString()} FCFA</p>
                    </div>
                  ))}
                </div>

                {/* Adresse de livraison */}
                {activeMissionAddress && (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                    <p className="font-bold text-sm mb-1 dark:text-white">🏠 Livrer à</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{activeMissionAddress.full_name}</p>
                    <p className="text-xs text-gray-400">📞 {activeMissionAddress.phone}</p>
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

                {/* OTP à montrer à la pharmacie */}
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

                {/* Gain */}
                <div className="bg-[#00572D] rounded-xl p-4 text-white">
                  <div className="flex justify-between">
                    <span className="text-green-200 text-sm">Votre gain</span>
                    <span className="font-bold text-lg">
                      {(activeMission.driver_earning || 0).toLocaleString()} FCFA
                    </span>
                  </div>
                </div>

                {/* Actions */}
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
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  Aucune livraison effectuée
                </p>
              </div>
            )}

            {history.map((order) => (
              <div
                key={order.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm dark:text-white">🏥 {order.pharmacies?.name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(order.delivered_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
              <div className="flex justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                <span className="text-sm text-gray-500 dark:text-gray-400">Véhicule</span>
                <span className="text-sm font-bold dark:text-white">
                  {driverProfile.vehicle_type} {driverProfile.vehicle_brand}
                </span>
              </div>
              <div className="flex justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                <span className="text-sm text-gray-500 dark:text-gray-400">Plaque</span>
                <span className="text-sm font-bold dark:text-white">{driverProfile.vehicle_plate || "—"}</span>
              </div>
              <div className="flex justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                <span className="text-sm text-gray-500 dark:text-gray-400">Couleur</span>
                <span className="text-sm font-bold dark:text-white">{driverProfile.vehicle_color || "—"}</span>
              </div>
              <div className="flex justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                <span className="text-sm text-gray-500 dark:text-gray-400">Vérifié</span>
                <span className={`text-sm font-bold ${driverProfile.is_verified ? "text-green-600" : "text-yellow-600"}`}>
                  {driverProfile.is_verified ? "✅ Oui" : "⏳ En attente"}
                </span>
              </div>
              <div className="flex justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                <span className="text-sm text-gray-500 dark:text-gray-400">Livraisons</span>
                <span className="text-sm font-bold dark:text-white">{driverProfile.total_deliveries}</span>
              </div>
              <div className="flex justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                <span className="text-sm text-gray-500 dark:text-gray-400">Gains totaux</span>
                <span className="text-sm font-bold text-[#00572D] dark:text-green-400">
                  {(driverProfile.total_earnings || 0).toLocaleString()} FCFA
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}