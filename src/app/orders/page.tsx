"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  pending_payment: {
    label: "En attente de paiement",
    emoji: "⏳",
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
  },
  payment_confirmed: {
    label: "Paiement confirmé",
    emoji: "✅",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
  preparing: {
    label: "Préparation en cours",
    emoji: "📦",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  ready: {
    label: "Commande prête",
    emoji: "🎁",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  driver_assigned: {
    label: "Livreur affecté",
    emoji: "🏍️",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
  },
  driver_arrived_at_pharmacy: {
    label: "Livreur à la pharmacie",
    emoji: "🏥",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
  },
  picked_up: {
    label: "Commande récupérée",
    emoji: "📬",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
  on_the_way: {
    label: "Livreur en route",
    emoji: "🚀",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
  driver_arrived: {
    label: "Livreur arrivé",
    emoji: "📍",
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-900/20",
  },
  delivered: {
    label: "Livraison effectuée",
    emoji: "🎉",
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/30",
  },
  cancelled: {
    label: "Annulée",
    emoji: "❌",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/20",
  },
};

function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[status] || {
      label: status,
      emoji: "❓",
      color: "text-gray-500",
      bg: "bg-gray-50 dark:bg-gray-800",
    }
  );
}

// Barre de progression des statuts
const PROGRESS_STEPS = [
  "payment_confirmed",
  "preparing",
  "ready",
  "driver_assigned",
  "picked_up",
  "on_the_way",
  "delivered",
];

function getProgressIndex(status: string) {
  const idx = PROGRESS_STEPS.indexOf(status);
  return idx >= 0 ? idx : -1;
}

export default function OrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [orderEvents, setOrderEvents] = useState<any[]>([]);
  const [driverProfile, setDriverProfile] = useState<any | null>(null);
  const [orderAddress, setOrderAddress] = useState<any | null>(null);
  const [tab, setTab] = useState<"active" | "delivered" | "cancelled">("active");

  useEffect(() => {
    loadOrders();

    // Écouter les changements en temps réel
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        () => {
          loadOrders();
          if (selectedOrder) {
            loadOrderDetail(selectedOrder.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadOrders() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        pharmacies(name, logo_url, city)
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error.message);
      setLoading(false);
      return;
    }

    setOrders(data || []);
    setLoading(false);
  }

  async function loadOrderDetail(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    setSelectedOrder(order);

    // Items
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    setOrderItems(items || []);

    // Events
    const { data: events } = await supabase
      .from("delivery_events")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    setOrderEvents(events || []);

    // Driver
    if (order.driver_id) {
      const { data: driver } = await supabase
        .from("driver_profiles")
        .select("*")
        .eq("id", order.driver_id)
        .single();

      setDriverProfile(driver);
    } else {
      setDriverProfile(null);
    }

    // Address
    if (order.address_id) {
      const { data: addr } = await supabase
        .from("addresses")
        .select("*")
        .eq("id", order.address_id)
        .single();

      setOrderAddress(addr);
    } else {
      setOrderAddress(null);
    }
  }

  function closeDetail() {
    setSelectedOrder(null);
    setOrderItems([]);
    setOrderEvents([]);
    setDriverProfile(null);
    setOrderAddress(null);
  }

  const filteredOrders = orders.filter((o) => {
    if (tab === "active")
      return !["delivered", "cancelled"].includes(o.status);
    if (tab === "delivered") return o.status === "delivered";
    if (tab === "cancelled") return o.status === "cancelled";
    return true;
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl">
          <p className="text-[#00572D] dark:text-green-400 font-bold">
            Chargement...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* HEADER */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
            📦 Mes commandes
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {orders.length} commande{orders.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-5">
          {(["active", "delivered", "cancelled"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition border-2 ${
                tab === t
                  ? "bg-[#00572D] text-white border-[#00572D]"
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
              }`}
            >
              {t === "active" && "🔄 En cours"}
              {t === "delivered" && "✅ Livrées"}
              {t === "cancelled" && "❌ Annulées"}
            </button>
          ))}
        </div>

        {/* LISTE */}
        {filteredOrders.length === 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 text-center shadow-sm">
            <div className="text-5xl mb-3">
              {tab === "active" ? "📦" : tab === "delivered" ? "✅" : "❌"}
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Aucune commande{" "}
              {tab === "active"
                ? "en cours"
                : tab === "delivered"
                ? "livrée"
                : "annulée"}
            </p>
            {tab === "active" && (
              <Link
                href="/search"
                className="inline-block mt-4 bg-[#00572D] text-white px-5 py-2.5 rounded-xl font-bold text-sm"
              >
                Rechercher un médicament
              </Link>
            )}
          </div>
        )}

        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const cfg = getStatusConfig(order.status);
            const pharmacy = order.pharmacies;
            const progressIdx = getProgressIndex(order.status);

            return (
              <button
                key={order.id}
                onClick={() => loadOrderDetail(order.id)}
                className="w-full text-left bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all overflow-hidden"
              >
                {/* Badge statut */}
                <div className={`px-4 py-2 flex items-center justify-between ${cfg.bg}`}>
                  <span className={`text-xs font-bold ${cfg.color}`}>
                    {cfg.emoji} {cfg.label}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {new Date(order.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="p-4">
                  {/* Pharmacie */}
                  <div className="flex items-center gap-3 mb-3">
                    {pharmacy?.logo_url && (
                      <img
                        src={pharmacy.logo_url}
                        alt={pharmacy.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700"
                      />
                    )}
                    <div>
                      <p className="font-bold text-sm text-black dark:text-white">
                        🏥 {pharmacy?.name || "Pharmacie"}
                      </p>
                      {pharmacy?.city && (
                        <p className="text-xs text-gray-400">
                          📍 {pharmacy.city}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Barre de progression */}
                  {progressIdx >= 0 && order.status !== "cancelled" && (
                    <div className="flex gap-1 mb-3">
                      {PROGRESS_STEPS.map((_, idx) => (
                        <div
                          key={idx}
                          className={`flex-1 h-1.5 rounded-full transition-all ${
                            idx <= progressIdx
                              ? "bg-[#00572D]"
                              : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Montants */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-400">Total payé</p>
                      <p className="font-bold text-[#00572D] dark:text-green-400">
                        {(order.total || 0).toLocaleString()} FCFA
                      </p>
                    </div>

                    <div className="text-right">
                      {order.delivery_fee > 0 && (
                        <p className="text-xs text-gray-400">
                          🚚 {(order.delivery_fee || 0).toLocaleString()} FCFA
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        💊 {(order.subtotal || 0).toLocaleString()} FCFA
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========== MODAL DÉTAIL COMMANDE ========== */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-gray-900 dark:text-white w-full sm:w-[92%] sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
              <div>
                <h2 className="text-lg font-bold">📦 Détail commande</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(selectedOrder.created_at).toLocaleDateString(
                    "fr-FR",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                </p>
              </div>
              <button
                onClick={closeDetail}
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Content scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Statut */}
              {(() => {
                const cfg = getStatusConfig(selectedOrder.status);
                return (
                  <div className={`${cfg.bg} rounded-xl p-3 text-center`}>
                    <p className={`text-lg font-bold ${cfg.color}`}>
                      {cfg.emoji} {cfg.label}
                    </p>
                  </div>
                );
              })()}

              {/* Barre de progression */}
              {getProgressIndex(selectedOrder.status) >= 0 &&
                selectedOrder.status !== "cancelled" && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {PROGRESS_STEPS.map((step, idx) => {
                        const currentIdx = getProgressIndex(
                          selectedOrder.status
                        );
                        const stepCfg = getStatusConfig(step);
                        return (
                          <div
                            key={idx}
                            className={`flex-1 h-2 rounded-full transition-all ${
                              idx <= currentIdx
                                ? "bg-[#00572D]"
                                : "bg-gray-200 dark:bg-gray-700"
                            }`}
                            title={stepCfg.label}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-400">
                      <span>Payé</span>
                      <span>Préparation</span>
                      <span>Prête</span>
                      <span>Livreur</span>
                      <span>Récupéré</span>
                      <span>En route</span>
                      <span>Livré</span>
                    </div>
                  </div>
                )}

              {/* Pharmacie */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="font-bold text-sm text-[#00572D] dark:text-green-400">
                  🏥 {selectedOrder.pharmacies?.name || "Pharmacie"}
                </p>
                {selectedOrder.pharmacies?.city && (
                  <p className="text-xs text-gray-400 mt-1">
                    📍 {selectedOrder.pharmacies.city}
                  </p>
                )}
              </div>

              {/* Produits */}
              <div>
                <p className="font-bold text-sm mb-2">💊 Produits</p>
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-xl"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {item.medicine_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.quantity} × {item.price.toLocaleString()} FCFA
                        </p>
                      </div>
                      <p className="font-bold text-sm text-[#00572D] dark:text-green-400">
                        {item.subtotal.toLocaleString()} FCFA
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Montants */}
              <div className="bg-[#00572D] rounded-xl p-4 text-white space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-200">Médicaments</span>
                  <span className="font-bold">
                    {(selectedOrder.subtotal || 0).toLocaleString()} FCFA
                  </span>
                </div>
                {selectedOrder.delivery_fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-200">Livraison</span>
                    <span className="font-bold">
                      {(selectedOrder.delivery_fee || 0).toLocaleString()} FCFA
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-green-600">
                  <span>Total</span>
                  <span>
                    {(selectedOrder.total || 0).toLocaleString()} FCFA
                  </span>
                </div>
              </div>

              {/* Adresse */}
              {orderAddress && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="font-bold text-sm mb-1">📍 Adresse</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {orderAddress.full_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    📞 {orderAddress.phone}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {orderAddress.address_line}
                    {orderAddress.district && `, ${orderAddress.district}`}
                  </p>
                  <p className="text-xs text-gray-400">{orderAddress.city}</p>
                  {orderAddress.notes && (
                    <p className="text-xs text-gray-400 mt-1 italic">
                      📝 {orderAddress.notes}
                    </p>
                  )}
                </div>
              )}

              {/* Livreur */}
              {driverProfile && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="font-bold text-sm mb-2">🏍️ Livreur</p>
                  <div className="flex items-center gap-3">
                    {driverProfile.photo_url ? (
                      <img
                        src={driverProfile.photo_url}
                        alt={driverProfile.full_name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-[#00572D]"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#00572D] flex items-center justify-center text-white text-lg font-bold">
                        {driverProfile.full_name?.charAt(0) || "?"}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-sm">
                        {driverProfile.full_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        📞 {driverProfile.phone}
                      </p>
                      {driverProfile.vehicle_type && (
                        <p className="text-xs text-gray-400">
                          🏍️ {driverProfile.vehicle_type}{" "}
                          {driverProfile.vehicle_brand || ""}{" "}
                          {driverProfile.vehicle_plate || ""}
                        </p>
                      )}
                      {driverProfile.rating && (
                        <p className="text-xs text-yellow-500 mt-1">
                          ⭐ {driverProfile.rating}/5
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bouton suivi GPS */}
                  {["picked_up", "on_the_way", "driver_arrived"].includes(
                    selectedOrder.status
                  ) && (
                    <Link
                      href={`/orders/${selectedOrder.id}/tracking`}
                      className="block mt-3 bg-[#00572D] text-white text-center py-2.5 rounded-xl font-bold text-sm"
                    >
                      📍 Suivre le livreur en direct
                    </Link>
                  )}
                </div>
              )}

              {/* OTP */}
              {selectedOrder.pickup_otp &&
                !selectedOrder.pickup_otp_verified &&
                ["ready", "driver_assigned", "driver_arrived_at_pharmacy"].includes(
                  selectedOrder.status
                ) && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 text-center">
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-1">
                      Code de remise pharmacie → livreur
                    </p>
                    <p className="text-3xl font-black tracking-widest text-yellow-700 dark:text-yellow-400">
                      {selectedOrder.pickup_otp}
                    </p>
                  </div>
                )}

              {/* Journal des événements */}
              {orderEvents.length > 0 && (
                <div>
                  <p className="font-bold text-sm mb-2">📋 Historique</p>
                  <div className="space-y-2">
                    {orderEvents.map((event) => {
                      const evtCfg = getStatusConfig(event.status);
                      return (
                        <div
                          key={event.id}
                          className="flex items-start gap-3 text-sm"
                        >
                          <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs shrink-0 mt-0.5">
                            {evtCfg.emoji}
                          </div>
                          <div>
                            <p className="font-medium text-xs">
                              {event.label || evtCfg.label}
                            </p>
                            {event.note && (
                              <p className="text-xs text-gray-400">
                                {event.note}
                              </p>
                            )}
                            <p className="text-[10px] text-gray-400">
                              {new Date(event.created_at).toLocaleString(
                                "fr-FR"
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t dark:border-gray-700">
              <button
                onClick={closeDetail}
                className="w-full bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}