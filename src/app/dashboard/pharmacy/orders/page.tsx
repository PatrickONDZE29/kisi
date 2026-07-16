"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProviderTemp";

const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
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
  return STATUS_CONFIG[status] || {
    label: status,
    emoji: "❓",
    color: "text-gray-500",
    bg: "bg-gray-50 dark:bg-gray-800",
  };
}

// Actions possibles selon le statut actuel
function getNextActions(status: string): { label: string; emoji: string; newStatus: string; color: string }[] {
  switch (status) {
    case "payment_confirmed":
      return [
        { label: "Commencer la préparation", emoji: "📦", newStatus: "preparing", color: "bg-blue-600" },
        { label: "Annuler la commande", emoji: "❌", newStatus: "cancelled", color: "bg-red-600" },
      ];
    case "preparing":
      return [
        { label: "Commande prête", emoji: "🎁", newStatus: "ready", color: "bg-purple-600" },
      ];
    case "ready":
      return [];
    case "driver_assigned":
      return [];
    case "driver_arrived_at_pharmacy":
      return [];
    default:
      return [];
  }
}

export default function PharmacyOrdersPage() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [orderAddress, setOrderAddress] = useState<any | null>(null);
  const [driverProfile, setDriverProfile] = useState<any | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [tab, setTab] = useState<"new" | "preparing" | "ready" | "delivering" | "completed">("new");
  const [updating, setUpdating] = useState(false);

  // Stats
  const newCount = orders.filter((o) => o.status === "payment_confirmed").length;
  const preparingCount = orders.filter((o) => o.status === "preparing").length;
  const readyCount = orders.filter((o) => ["ready", "driver_assigned", "driver_arrived_at_pharmacy"].includes(o.status)).length;
  const deliveringCount = orders.filter((o) => ["picked_up", "on_the_way", "driver_arrived"].includes(o.status)).length;
  const completedCount = orders.filter((o) => ["delivered", "cancelled"].includes(o.status)).length;

  useEffect(() => {
    loadPharmacy();
  }, []);

  useEffect(() => {
    if (!pharmacyId) return;

    const channel = supabase
      .channel("pharmacy-orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `pharmacy_id=eq.${pharmacyId}`,
        },
        () => {
          loadOrders(pharmacyId);
          if (selectedOrder) {
            loadOrderDetail(selectedOrder.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pharmacyId]);

  async function loadPharmacy() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: pharmacy } = await supabase
      .from("pharmacies")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!pharmacy) {
      setLoading(false);
      return;
    }

    setPharmacyId(pharmacy.id);
    await loadOrders(pharmacy.id);
  }

  async function loadOrders(phId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select("*, addresses(*)")
      .eq("pharmacy_id", phId)
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
    setOtpInput("");

    // Items
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    setOrderItems(items || []);

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
  }

  function closeDetail() {
    setSelectedOrder(null);
    setOrderItems([]);
    setOrderAddress(null);
    setDriverProfile(null);
    setOtpInput("");
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    setUpdating(true);

    const updateData: any = { status: newStatus };

    if (newStatus === "ready") {
      updateData.ready_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      showToast(error.message, "error");
      setUpdating(false);
      return;
    }

    // Événement
    const cfg = getStatusConfig(newStatus);
    await supabase.from("delivery_events").insert({
      order_id: orderId,
      actor_type: "pharmacy",
      actor_id: pharmacyId,
      status: newStatus,
      label: cfg.label,
    });

    // Notification client
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      let title = "";
      let body = "";

      switch (newStatus) {
        case "preparing":
          title = "Préparation en cours 📦";
          body = "La pharmacie prépare votre commande.";
          break;
        case "ready":
          title = "Commande prête 🎁";
          body = "Votre commande est prête. Un livreur sera bientôt affecté.";
          break;
        case "cancelled":
          title = "Commande annulée ❌";
          body = "Votre commande a été annulée par la pharmacie.";
          break;
      }

      if (title) {
        await supabase.from("notifications").insert({
          user_id: order.user_id,
          type: "order_update",
          title,
          body,
          order_id: orderId,
        });
      }
    }

    showToast(`Statut mis à jour : ${cfg.label}`);
    await loadOrders(pharmacyId!);
    setUpdating(false);

    if (newStatus === "cancelled") {
      closeDetail();
    } else {
      await loadOrderDetail(orderId);
    }
  }

  async function verifyOtp(orderId: string) {
    if (!otpInput.trim()) {
      showToast("Entrez le code OTP", "error");
      return;
    }

    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    if (otpInput.trim() !== order.pickup_otp) {
      showToast("Code OTP incorrect", "error");
      return;
    }

    setUpdating(true);

    const { error } = await supabase
      .from("orders")
      .update({
        pickup_otp_verified: true,
        status: "picked_up",
        picked_up_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      showToast(error.message, "error");
      setUpdating(false);
      return;
    }

    await supabase.from("delivery_events").insert({
      order_id: orderId,
      actor_type: "pharmacy",
      actor_id: pharmacyId,
      status: "picked_up",
      label: "Commande remise au livreur (OTP vérifié)",
    });

    await supabase.from("notifications").insert({
      user_id: order.user_id,
      type: "delivery",
      title: "Commande récupérée 📬",
      body: "Le livreur a récupéré votre commande. Il est en route !",
      order_id: orderId,
    });

    showToast("OTP vérifié ! Commande remise au livreur ✅");
    await loadOrders(pharmacyId!);
    await loadOrderDetail(orderId);
    setUpdating(false);
  }

  const filteredOrders = orders.filter((o) => {
    switch (tab) {
      case "new":
        return o.status === "payment_confirmed";
      case "preparing":
        return o.status === "preparing";
      case "ready":
        return ["ready", "driver_assigned", "driver_arrived_at_pharmacy"].includes(o.status);
      case "delivering":
        return ["picked_up", "on_the_way", "driver_arrived"].includes(o.status);
      case "completed":
        return ["delivered", "cancelled"].includes(o.status);
      default:
        return true;
    }
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
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
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
            📋 Commandes
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {orders.length} commande{orders.length !== 1 ? "s" : ""} au total
          </p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {[
            { key: "new", label: "Nouvelles", count: newCount, emoji: "🆕" },
            { key: "preparing", label: "Préparation", count: preparingCount, emoji: "📦" },
            { key: "ready", label: "Prêtes", count: readyCount, emoji: "🎁" },
            { key: "delivering", label: "Livraison", count: deliveringCount, emoji: "🚀" },
            { key: "completed", label: "Terminées", count: completedCount, emoji: "✅" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`p-2 rounded-xl text-center transition border-2 ${
                tab === t.key
                  ? "bg-[#00572D] text-white border-[#00572D]"
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="text-lg">{t.emoji}</div>
              <p className="text-[10px] font-bold mt-0.5">{t.label}</p>
              {t.count > 0 && (
                <span className={`inline-block mt-1 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  tab === t.key
                    ? "bg-white text-[#00572D]"
                    : "bg-[#00572D] text-white"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* LISTE */}
        {filteredOrders.length === 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 text-center shadow-sm">
            <div className="text-5xl mb-3">📦</div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Aucune commande dans cette catégorie
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const cfg = getStatusConfig(order.status);

            return (
              <button
                key={order.id}
                onClick={() => loadOrderDetail(order.id)}
                className="w-full text-left bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all overflow-hidden"
              >
                <div className={`px-4 py-2 flex items-center justify-between ${cfg.bg}`}>
                  <span className={`text-xs font-bold ${cfg.color}`}>
                    {cfg.emoji} {cfg.label}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(order.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm dark:text-white">
                        💊 {order.subtotal?.toLocaleString()} FCFA
                      </p>
                      {order.delivery_fee > 0 && (
                        <p className="text-xs text-gray-400">
                          🚚 Livraison : {order.delivery_fee?.toLocaleString()} FCFA
                        </p>
                      )}
                    </div>
                    <p className="font-bold text-[#00572D] dark:text-green-400">
                      {order.total?.toLocaleString()} FCFA
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========== MODAL DÉTAIL ========== */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-gray-900 dark:text-white w-full sm:w-[92%] sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
              <div>
                <h2 className="text-lg font-bold">📋 Détail commande</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(selectedOrder.created_at).toLocaleDateString("fr-FR", {
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
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Content */}
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

              {/* Produits */}
              <div>
                <p className="font-bold text-sm mb-2">💊 Produits commandés</p>
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-xl"
                    >
                      <div>
                        <p className="text-sm font-medium">{item.medicine_name}</p>
                        <p className="text-xs text-gray-400">
                          {item.quantity} × {item.price?.toLocaleString()} FCFA
                        </p>
                      </div>
                      <p className="font-bold text-sm text-[#00572D] dark:text-green-400">
                        {item.subtotal?.toLocaleString()} FCFA
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Montants */}
              <div className="bg-[#00572D] rounded-xl p-4 text-white space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-200">Médicaments</span>
                  <span className="font-bold">{selectedOrder.subtotal?.toLocaleString()} FCFA</span>
                </div>
                {selectedOrder.delivery_fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-200">Livraison</span>
                    <span className="font-bold">{selectedOrder.delivery_fee?.toLocaleString()} FCFA</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-green-600">
                  <span>Total</span>
                  <span>{selectedOrder.total?.toLocaleString()} FCFA</span>
                </div>
              </div>

              {/* Paiement */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="font-bold text-sm mb-1">💳 Paiement</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {selectedOrder.payment_provider === "airtel" ? "Airtel Money" : "MTN MoMo"}
                </p>
                <p className={`text-xs font-bold mt-1 ${
                  selectedOrder.payment_status === "paid"
                    ? "text-green-600 dark:text-green-400"
                    : "text-yellow-600 dark:text-yellow-400"
                }`}>
                  {selectedOrder.payment_status === "paid" ? "✅ Payé" : "⏳ En attente"}
                </p>
              </div>

              {/* Adresse */}
              {orderAddress && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="font-bold text-sm mb-1">📍 Adresse de livraison</p>
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
                  <p className="font-bold text-sm mb-2">🏍️ Livreur affecté</p>
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
                      <p className="font-bold text-sm">{driverProfile.full_name}</p>
                      <p className="text-xs text-gray-400">📞 {driverProfile.phone}</p>
                      {driverProfile.vehicle_type && (
                        <p className="text-xs text-gray-400">
                          🏍️ {driverProfile.vehicle_type} {driverProfile.vehicle_brand || ""} {driverProfile.vehicle_plate || ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* OTP Vérification — pharmacie remet au livreur */}
              {driverProfile &&
                ["driver_assigned", "driver_arrived_at_pharmacy"].includes(selectedOrder.status) &&
                !selectedOrder.pickup_otp_verified && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                    <p className="font-bold text-sm text-yellow-700 dark:text-yellow-400 mb-2 text-center">
                      🔐 Vérification OTP — Remise au livreur
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center mb-3">
                      Demandez le code OTP au livreur avant de lui remettre la commande.
                    </p>

                    <div className="flex gap-2">
                      <input
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        placeholder="Code OTP"
                        maxLength={4}
                        className="flex-1 p-3 rounded-xl bg-white dark:bg-gray-900 text-center text-2xl font-black tracking-[0.5em] border border-yellow-300 dark:border-yellow-700"
                      />
                      <button
                        onClick={() => verifyOtp(selectedOrder.id)}
                        disabled={updating}
                        className="bg-[#00572D] text-white px-5 rounded-xl font-bold text-sm disabled:opacity-50"
                      >
                        {updating ? "..." : "Vérifier"}
                      </button>
                    </div>
                  </div>
                )}

              {/* Actions */}
              {(() => {
                const actions = getNextActions(selectedOrder.status);
                if (actions.length === 0) return null;

                return (
                  <div className="space-y-2">
                    <p className="font-bold text-sm">⚡ Actions</p>
                    {actions.map((action) => (
                      <button
                        key={action.newStatus}
                        onClick={() => updateOrderStatus(selectedOrder.id, action.newStatus)}
                        disabled={updating}
                        className={`w-full ${action.color} text-white p-3 rounded-xl font-bold text-sm disabled:opacity-50 transition hover:opacity-90`}
                      >
                        {updating ? "Mise à jour..." : `${action.emoji} ${action.label}`}
                      </button>
                    ))}
                  </div>
                );
              })()}
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