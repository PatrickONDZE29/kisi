"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

// =====================================================
// CONFIG STATUTS
// =====================================================
const STATUS_CONFIG: Record<string, {
  label: string;
  emoji: string;
  color: string;
  bg: string;
}> = {
  // Réservations
  pending: {
    label: "En attente",
    emoji: "⏳",
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
  },
  accepted: {
    label: "Acceptée",
    emoji: "✅",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
  rejected: {
    label: "Refusée",
    emoji: "❌",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/20",
  },
  // Commandes
  payment_confirmed: {
    label: "Paiement confirmé",
    emoji: "💳",
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
    label: "Prête",
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
    label: "Livrée",
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
  return STATUS_CONFIG[status] || {
    label: status,
    emoji: "❓",
    color: "text-gray-500",
    bg: "bg-gray-50 dark:bg-gray-800",
  };
}

// Statuts "en cours de livraison" → affiche le livreur
const DELIVERY_STATUSES = [
  "picked_up",
  "on_the_way",
  "driver_arrived",
];

// Barre de progression pour les commandes
const ORDER_STEPS = [
  "payment_confirmed",
  "preparing",
  "ready",
  "driver_assigned",
  "picked_up",
  "on_the_way",
  "delivered",
];

function getProgressIndex(status: string) {
  return ORDER_STEPS.indexOf(status);
}

// =====================================================
// PAGE PRINCIPALE
// =====================================================
export default function ReservationsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedType, setSelectedType] = useState<"reservation" | "order" | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [driverProfile, setDriverProfile] = useState<any | null>(null);
  const [orderAddress, setOrderAddress] = useState<any | null>(null);
  const [tab, setTab] = useState<"active" | "history">("active");

  useEffect(() => {
    loadAll();

    // Écouter les changements temps réel
    const channel = supabase
      .channel("reservations-orders-realtime")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "orders",
      }, () => {
        loadAll();
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "reservations",
      }, () => {
        loadAll();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    // Charger réservations
    const { data: resData } = await supabase
      .from("reservations")
      .select(`
        *,
        pharmacies(name, city, logo_url),
        medicines(name, description, image_url)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setReservations(resData || []);

    // Charger commandes
    const { data: ordData } = await supabase
      .from("orders")
      .select(`
        *,
        pharmacies(name, city, logo_url),
        driver_profiles(id, full_name, phone, photo_url, vehicle_type, vehicle_brand, vehicle_plate, rating)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setOrders(ordData || []);
    setLoading(false);
  }

  async function openOrderDetail(order: any) {
    setSelectedItem(order);
    setSelectedType("order");

    // Items
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    setOrderItems(items || []);

    // Adresse
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

    // Livreur
    if (order.driver_profiles) {
      setDriverProfile(order.driver_profiles);
    } else {
      setDriverProfile(null);
    }
  }

  function openReservationDetail(reservation: any) {
    setSelectedItem(reservation);
    setSelectedType("reservation");
    setOrderItems([]);
    setDriverProfile(null);
    setOrderAddress(null);
  }

  function closeDetail() {
    setSelectedItem(null);
    setSelectedType(null);
    setOrderItems([]);
    setDriverProfile(null);
    setOrderAddress(null);
  }

  // Filtrer actifs / historique
  const activeReservations = reservations.filter(
    (r) => !["rejected", "delivered"].includes(r.status)
  );
  const historyReservations = reservations.filter(
    (r) => ["rejected", "delivered"].includes(r.status)
  );
  const activeOrders = orders.filter(
    (o) => !["delivered", "cancelled"].includes(o.status)
  );
  const historyOrders = orders.filter(
    (o) => ["delivered", "cancelled"].includes(o.status)
  );

  const activeItems = [
    ...activeOrders.map((o) => ({ ...o, _type: "order" })),
    ...activeReservations.map((r) => ({ ...r, _type: "reservation" })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const historyItems = [
    ...historyOrders.map((o) => ({ ...o, _type: "order" })),
    ...historyReservations.map((r) => ({ ...r, _type: "reservation" })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const displayedItems = tab === "active" ? activeItems : historyItems;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl">
          <p className="text-[#00572D] dark:text-green-400 font-bold">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      <div className="max-w-2xl mx-auto px-4 pt-6">

        {/* HEADER */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-xl mb-5">
          <h1 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
            📋 Mes commandes
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {activeItems.length} en cours · {historyItems.length} terminée(s)
          </p>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setTab("active")}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition border-2 ${
              tab === "active"
                ? "bg-[#00572D] text-white border-[#00572D]"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
            }`}
          >
            🔄 En cours
            {activeItems.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {activeItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition border-2 ${
              tab === "history"
                ? "bg-[#00572D] text-white border-[#00572D]"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
            }`}
          >
            📚 Historique
          </button>
        </div>

        {/* LISTE */}
        {displayedItems.length === 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 text-center shadow-sm">
            <div className="text-5xl mb-3">
              {tab === "active" ? "📋" : "📚"}
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {tab === "active"
                ? "Aucune commande en cours"
                : "Aucun historique"}
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

        <div className="space-y-3">
          {displayedItems.map((item) => {
            const cfg = getStatusConfig(item.status);
            const isOrder = item._type === "order";
            const progressIdx = isOrder ? getProgressIndex(item.status) : -1;

            return (
              <button
                key={`${item._type}-${item.id}`}
                onClick={() =>
                  isOrder
                    ? openOrderDetail(item)
                    : openReservationDetail(item)
                }
                className="w-full text-left bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all overflow-hidden"
              >
                {/* Badge statut */}
                <div className={`px-4 py-2 flex items-center justify-between ${cfg.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${cfg.color}`}>
                      {cfg.emoji} {cfg.label}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isOrder
                        ? "bg-[#00572D]/10 text-[#00572D] dark:text-green-400"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    }`}>
                      {isOrder ? "Commande" : "Réservation"}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {new Date(item.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="p-4">
                  {/* Pharmacie */}
                  <div className="flex items-center gap-2 mb-2">
                    {item.pharmacies?.logo_url && (
                      <img
                        src={item.pharmacies.logo_url}
                        alt={item.pharmacies.name}
                        className="w-8 h-8 rounded-full object-cover border border-gray-100"
                      />
                    )}
                    <div>
                      <p className="font-bold text-sm dark:text-white">
                        🏥 {item.pharmacies?.name || "Pharmacie"}
                      </p>
                      {item.pharmacies?.city && (
                        <p className="text-xs text-gray-400">📍 {item.pharmacies.city}</p>
                      )}
                    </div>
                  </div>

                  {/* Réservation : médicament */}
                  {!isOrder && item.medicines && (
                    <div className="flex items-center gap-3 mt-2">
                      {item.medicines.image_url && (
                        <img
                          src={item.medicines.image_url}
                          alt={item.medicines.name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium dark:text-white">
                          💊 {item.medicines.name}
                        </p>
                        {item.medicines.description && (
                          <p className="text-xs text-gray-400 line-clamp-1">
                            {item.medicines.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Commande : montant + progression */}
                  {isOrder && (
                    <>
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-bold text-[#00572D] dark:text-green-400">
                          {(item.total || 0).toLocaleString()} FCFA
                        </p>
                        {item.driver_profiles && DELIVERY_STATUSES.includes(item.status) && (
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                            🏍️ {item.driver_profiles.full_name}
                          </span>
                        )}
                      </div>

                      {progressIdx >= 0 && item.status !== "cancelled" && (
                        <div className="flex gap-1 mt-2">
                          {ORDER_STEPS.map((_, idx) => (
                            <div
                              key={idx}
                              className={`flex-1 h-1 rounded-full transition-all ${
                                idx <= progressIdx
                                  ? "bg-[#00572D]"
                                  : "bg-gray-200 dark:bg-gray-700"
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========== MODAL DÉTAIL ========== */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-gray-900 dark:text-white w-full sm:w-[92%] sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
              <div>
                <h2 className="text-lg font-bold">
                  {selectedType === "order" ? "📦 Détail commande" : "📋 Détail réservation"}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(selectedItem.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <button
                onClick={closeDetail}
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Statut */}
              {(() => {
                const cfg = getStatusConfig(selectedItem.status);
                return (
                  <div className={`${cfg.bg} rounded-xl p-3 text-center`}>
                    <p className={`text-lg font-bold ${cfg.color}`}>
                      {cfg.emoji} {cfg.label}
                    </p>
                  </div>
                );
              })()}

              {/* Barre progression (commandes) */}
              {selectedType === "order" && getProgressIndex(selectedItem.status) >= 0 && selectedItem.status !== "cancelled" && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {ORDER_STEPS.map((step, idx) => {
                      const currentIdx = getProgressIndex(selectedItem.status);
                      return (
                        <div
                          key={step}
                          className={`flex-1 h-2 rounded-full transition-all ${
                            idx <= currentIdx ? "bg-[#00572D]" : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-400">
                    <span>Payé</span>
                    <span>Prépa</span>
                    <span>Prête</span>
                    <span>Livreur</span>
                    <span>Récupéré</span>
                    <span>Route</span>
                    <span>Livré</span>
                  </div>
                </div>
              )}

              {/* Pharmacie */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 flex items-center gap-3">
                {selectedItem.pharmacies?.logo_url && (
                  <img
                    src={selectedItem.pharmacies.logo_url}
                    alt={selectedItem.pharmacies.name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  />
                )}
                <div>
                  <p className="font-bold text-sm text-[#00572D] dark:text-green-400">
                    🏥 {selectedItem.pharmacies?.name}
                  </p>
                  {selectedItem.pharmacies?.city && (
                    <p className="text-xs text-gray-400">📍 {selectedItem.pharmacies.city}</p>
                  )}
                </div>
              </div>

              {/* RÉSERVATION : médicament */}
              {selectedType === "reservation" && selectedItem.medicines && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="font-bold text-sm mb-2 dark:text-white">💊 Médicament</p>
                  <div className="flex items-start gap-3">
                    {selectedItem.medicines.image_url && (
                      <img
                        src={selectedItem.medicines.image_url}
                        alt={selectedItem.medicines.name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-[#00572D]/20"
                      />
                    )}
                    <div>
                      <p className="font-bold text-sm dark:text-white">{selectedItem.medicines.name}</p>
                      {selectedItem.medicines.description && (
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{selectedItem.medicines.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* COMMANDE : produits */}
              {selectedType === "order" && orderItems.length > 0 && (
                <div>
                  <p className="font-bold text-sm mb-2 dark:text-white">💊 Produits</p>
                  <div className="space-y-2">
                    {orderItems.map((oi) => (
                      <div
                        key={oi.id}
                        className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-xl"
                      >
                        <div className="flex items-center gap-2">
                          {oi.medicine_image_url && (
                            <img
                              src={oi.medicine_image_url}
                              alt={oi.medicine_name}
                              className="w-10 h-10 rounded-full object-cover border border-gray-200"
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium dark:text-white">{oi.medicine_name}</p>
                            <p className="text-xs text-gray-400">
                              {oi.quantity} × {(oi.price || 0).toLocaleString()} FCFA
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-sm text-[#00572D] dark:text-green-400">
                          {(oi.subtotal || 0).toLocaleString()} FCFA
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Montants (commandes) */}
              {selectedType === "order" && (
                <div className="bg-[#00572D] rounded-xl p-4 text-white space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-200">Médicaments</span>
                    <span className="font-bold">{(selectedItem.subtotal || 0).toLocaleString()} FCFA</span>
                  </div>
                  {selectedItem.delivery_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-200">Livraison</span>
                      <span className="font-bold">{(selectedItem.delivery_fee || 0).toLocaleString()} FCFA</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-green-600">
                    <span>Total payé</span>
                    <span>{(selectedItem.total || 0).toLocaleString()} FCFA</span>
                  </div>
                </div>
              )}

              {/* Adresse de livraison */}
              {orderAddress && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="font-bold text-sm mb-1 dark:text-white">📍 Adresse de livraison</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{orderAddress.full_name}</p>
                  <p className="text-xs text-gray-400">📞 {orderAddress.phone}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {orderAddress.address_line}
                    {orderAddress.district && `, ${orderAddress.district}`}
                  </p>
                  <p className="text-xs text-gray-400">{orderAddress.city}</p>
                  {orderAddress.notes && (
                    <p className="text-xs text-gray-400 mt-1 italic">📝 {orderAddress.notes}</p>
                  )}
                </div>
              )}

              {/* Livreur */}
              {driverProfile && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="font-bold text-sm mb-2 dark:text-white">🏍️ Livreur</p>
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
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm dark:text-white">{driverProfile.full_name}</p>
                      <p className="text-xs text-gray-400">📞 {driverProfile.phone}</p>
                      {driverProfile.vehicle_type && (
                        <p className="text-xs text-gray-400">
                          🏍️ {driverProfile.vehicle_type} {driverProfile.vehicle_brand || ""} {driverProfile.vehicle_plate || ""}
                        </p>
                      )}
                      {driverProfile.rating && (
                        <p className="text-xs text-yellow-500">⭐ {driverProfile.rating}/5</p>
                      )}
                    </div>
                    <a
                      href={`tel:${driverProfile.phone}`}
                      className="w-10 h-10 rounded-full bg-[#00572D] flex items-center justify-center text-white text-lg shrink-0"
                    >
                      📞
                    </a>
                  </div>

                  {/* Bouton suivi GPS */}
                  {DELIVERY_STATUSES.includes(selectedItem.status) && (
                    <Link
                      href={`/orders/${selectedItem.id}/tracking`}
                      className="block mt-3 bg-[#00572D] text-white text-center py-2.5 rounded-xl font-bold text-sm"
                    >
                      📍 Suivre le livreur en direct
                    </Link>
                  )}
                </div>
              )}

              {/* OTP (si commande prête et livreur assigné) */}
              {selectedType === "order" &&
                selectedItem.pickup_otp &&
                !selectedItem.pickup_otp_verified &&
                ["ready", "driver_assigned", "driver_arrived_at_pharmacy"].includes(selectedItem.status) && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 text-center">
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-1">
                      Code de remise à la pharmacie
                    </p>
                    <p className="text-3xl font-black tracking-widest text-yellow-700 dark:text-yellow-400">
                      {selectedItem.pickup_otp}
                    </p>
                  </div>
                )}

              {/* Paiement (commandes) */}
              {selectedType === "order" && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="font-bold text-sm mb-1 dark:text-white">💳 Paiement</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedItem.payment_provider === "airtel" ? "Airtel Money" : selectedItem.payment_provider === "mtn" ? "MTN MoMo" : "Mobile Money"}
                  </p>
                  <p className={`text-xs font-bold mt-1 ${
                    selectedItem.payment_status === "paid"
                      ? "text-green-600 dark:text-green-400"
                      : "text-yellow-600 dark:text-yellow-400"
                  }`}>
                    {selectedItem.payment_status === "paid" ? "✅ Payé" : "⏳ En attente"}
                  </p>
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