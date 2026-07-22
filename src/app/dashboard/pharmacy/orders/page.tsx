"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProviderTemp";

const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  payment_confirmed: { label: "Commande reçue", emoji: "🆕", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
  preparing: { label: "Préparation en cours", emoji: "📦", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20" },
  ready: { label: "Commande prête", emoji: "🎁", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" },
  driver_assigned: { label: "Livreur affecté", emoji: "🏍️", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  driver_arrived_at_pharmacy: { label: "Livreur à la pharmacie", emoji: "🏥", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  picked_up: { label: "Récupérée par le livreur", emoji: "📬", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20" },
  on_the_way: { label: "En cours de livraison", emoji: "🚀", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20" },
  driver_arrived: { label: "Livreur arrivé", emoji: "📍", color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-900/20" },
  delivered: { label: "Livrée ✅", emoji: "🎉", color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
  cancelled: { label: "Annulée", emoji: "❌", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || { label: status, emoji: "❓", color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-800" };
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
  const [tab, setTab] = useState<"new" | "preparing" | "active" | "history">("new");
  const [updating, setUpdating] = useState(false);
  const channelRef = useRef<any>(null);

  const newCount = orders.filter(o => o.status === "payment_confirmed").length;
  const preparingCount = orders.filter(o => o.status === "preparing").length;
  const activeCount = orders.filter(o => ["ready", "driver_assigned", "driver_arrived_at_pharmacy", "picked_up", "on_the_way", "driver_arrived"].includes(o.status)).length;
  const historyCount = orders.filter(o => ["delivered", "cancelled"].includes(o.status)).length;

  useEffect(() => {
    loadPharmacy();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  async function loadPharmacy() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: pharmacy } = await supabase
      .from("pharmacies")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!pharmacy) { setLoading(false); return; }

    setPharmacyId(pharmacy.id);
    await loadOrders(pharmacy.id);

    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`pharmacy-orders-${pharmacy.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `pharmacy_id=eq.${pharmacy.id}`,
      }, () => loadOrders(pharmacy.id))
      .subscribe();

    channelRef.current = channel;
  }

  async function loadOrders(phId: string) {
    const { data } = await supabase
      .from("orders")
      .select("*, addresses(*), driver_profiles(full_name, phone, vehicle_type, vehicle_brand, vehicle_plate)")
      .eq("pharmacy_id", phId)
      .order("created_at", { ascending: false });

    setOrders(data || []);
    setLoading(false);
  }

  async function openOrderDetail(order: any) {
    // Recharger la commande fraîche
    const { data: fresh } = await supabase
      .from("orders")
      .select("*, addresses(*), driver_profiles(full_name, phone, vehicle_type, vehicle_brand, vehicle_plate, photo_url)")
      .eq("id", order.id)
      .single();

    setSelectedOrder(fresh || order);

    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    setOrderItems(items || []);
    setOrderAddress(fresh?.addresses || null);
    setDriverProfile(fresh?.driver_profiles || null);
  }

  function closeDetail() {
    setSelectedOrder(null);
    setOrderItems([]);
    setOrderAddress(null);
    setDriverProfile(null);
  }

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdating(true);

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      showToast(error.message, "error");
      setUpdating(false);
      return;
    }

    const cfg = getStatusConfig(newStatus);

    // Notification client
    const order = orders.find(o => o.id === orderId);
    if (order) {
      let title = "";
      let body = "";

      if (newStatus === "preparing") {
        title = "Préparation en cours 📦";
        body = "La pharmacie prépare votre commande.";
      } else if (newStatus === "ready") {
        title = "Commande prête 🎁";
        body = "Votre commande est prête. Un livreur va bientôt la récupérer.";
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

    await supabase.from("delivery_events").insert({
      order_id: orderId,
      actor_type: "pharmacy",
      actor_id: pharmacyId,
      status: newStatus,
      label: cfg.label,
    });

    showToast(`Statut mis à jour : ${cfg.label}`);

    if (pharmacyId) await loadOrders(pharmacyId);
    if (selectedOrder?.id === orderId) await openOrderDetail({ id: orderId });

    setUpdating(false);
  }

  function getActions(status: string): { label: string; emoji: string; newStatus: string; color: string }[] {
    switch (status) {
      case "payment_confirmed":
        return [
          { label: "Commencer la préparation", emoji: "📦", newStatus: "preparing", color: "bg-orange-600" },
          { label: "Annuler la commande", emoji: "❌", newStatus: "cancelled", color: "bg-red-600" },
        ];
      case "preparing":
        return [
          { label: "Commande prête", emoji: "🎁", newStatus: "ready", color: "bg-purple-600" },
        ];
      default:
        return [];
    }
  }

  const filteredOrders = orders.filter(o => {
    if (tab === "new") return o.status === "payment_confirmed";
    if (tab === "preparing") return o.status === "preparing";
    if (tab === "active") return ["ready", "driver_assigned", "driver_arrived_at_pharmacy", "picked_up", "on_the_way", "driver_arrived"].includes(o.status);
    if (tab === "history") return ["delivered", "cancelled"].includes(o.status);
    return false;
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
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-xl mb-5">
          <h1 className="text-2xl font-bold text-[#00572D] dark:text-green-400">💳 Commandes</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {orders.length} commande(s) au total
          </p>
        </div>

        {/* TABS */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { key: "new", label: "🆕 Nouvelles", count: newCount },
            { key: "preparing", label: "📦 Prépa", count: preparingCount },
            { key: "active", label: "🚀 Actives", count: activeCount },
            { key: "history", label: "📚 Historique", count: historyCount },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`relative py-2 rounded-xl font-bold text-[10px] transition border-2 ${
                tab === t.key
                  ? "bg-[#00572D] text-white border-[#00572D]"
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
              }`}
            >
              {t.label}
              {t.count > 0 && tab !== t.key && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* LISTE */}
        {filteredOrders.length === 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 text-center shadow-sm">
            <div className="text-5xl mb-3">📦</div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Aucune commande</p>
          </div>
        )}

        <div className="space-y-3">
          {filteredOrders.map(order => {
            const cfg = getStatusConfig(order.status);
            return (
              <button
                key={order.id}
                onClick={() => openOrderDetail(order)}
                className="w-full text-left bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all overflow-hidden"
              >
                <div className={`px-4 py-2 flex items-center justify-between ${cfg.bg}`}>
                  <span className={`text-xs font-bold ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(order.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm dark:text-white">
                        💊 {(order.subtotal || 0).toLocaleString()} FCFA
                      </p>
                      {order.delivery_fee > 0 && (
                        <p className="text-xs text-gray-400">🚚 {(order.delivery_fee || 0).toLocaleString()} FCFA livraison</p>
                      )}
                    </div>
                    <p className="font-bold text-[#00572D] dark:text-green-400">
                      {(order.total || 0).toLocaleString()} FCFA
                    </p>
                  </div>

                  {/* Code sécurisé si disponible */}
                  {order.pickup_otp && ["ready", "driver_assigned", "driver_arrived_at_pharmacy"].includes(order.status) && (
                    <div className="mt-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl px-3 py-1.5 text-center">
                      <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-bold">
                        🔐 Code : {order.pickup_otp}
                      </span>
                    </div>
                  )}
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

            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
              <div>
                <h2 className="text-lg font-bold">📦 Détail commande</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(selectedOrder.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              <button onClick={closeDetail} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Statut */}
              {(() => {
                const cfg = getStatusConfig(selectedOrder.status);
                return (
                  <div className={`${cfg.bg} rounded-xl p-3 text-center`}>
                    <p className={`text-lg font-bold ${cfg.color}`}>{cfg.emoji} {cfg.label}</p>
                  </div>
                );
              })()}

              {/* CODE SÉCURISÉ */}
              {selectedOrder.pickup_otp && (
                <div className={`rounded-xl p-4 text-center border-2 ${
                  selectedOrder.pickup_otp_verified
                    ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                    : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700"
                }`}>
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                    {selectedOrder.pickup_otp_verified ? "✅ Code utilisé" : "🔐 Code de remise au livreur"}
                  </p>
                  <p className="text-3xl font-black tracking-widest text-yellow-700 dark:text-yellow-400">
                    {selectedOrder.pickup_otp}
                  </p>
                  {!selectedOrder.pickup_otp_verified && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                      Le livreur présentera ce code. Vérifiez-le avant de remettre le colis.
                    </p>
                  )}
                </div>
              )}

              {/* Produits */}
              <div>
                <p className="font-bold text-sm mb-2 dark:text-white">💊 Produits</p>
                <div className="space-y-2">
                  {orderItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                      <div>
                        <p className="text-sm font-medium dark:text-white">{item.medicine_name}</p>
                        <p className="text-xs text-gray-400">{item.quantity} × {(item.price || 0).toLocaleString()} FCFA</p>
                      </div>
                      <p className="font-bold text-sm text-[#00572D] dark:text-green-400">
                        {(item.subtotal || 0).toLocaleString()} FCFA
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Montants */}
              <div className="bg-[#00572D] rounded-xl p-4 text-white space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-200">Médicaments payés ✅</span>
                  <span className="font-bold">{(selectedOrder.subtotal || 0).toLocaleString()} FCFA</span>
                </div>
                {selectedOrder.delivery_fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-200">Livraison 🔒</span>
                    <span className="font-bold">{(selectedOrder.delivery_fee || 0).toLocaleString()} FCFA</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-green-600">
                  <span>Total</span>
                  <span>{(selectedOrder.total || 0).toLocaleString()} FCFA</span>
                </div>
              </div>

              {/* Adresse */}
              {orderAddress && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="font-bold text-sm mb-1 dark:text-white">📍 Adresse de livraison</p>
                  <p className="text-sm dark:text-gray-300">{orderAddress.full_name}</p>
                  <p className="text-xs text-gray-400">📞 {orderAddress.phone}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {orderAddress.address_line}{orderAddress.district && `, ${orderAddress.district}`}
                  </p>
                  <p className="text-xs text-gray-400">{orderAddress.city}</p>
                  {orderAddress.notes && <p className="text-xs text-gray-400 mt-1 italic">📝 {orderAddress.notes}</p>}
                </div>
              )}

              {/* Livreur */}
              {driverProfile && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="font-bold text-sm mb-2 dark:text-white">🏍️ Livreur affecté</p>
                  <div className="flex items-center gap-3">
                    {driverProfile.photo_url ? (
                      <img src={driverProfile.photo_url} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-[#00572D]" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#00572D] flex items-center justify-center text-white text-lg font-bold">
                        {driverProfile.full_name?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-sm dark:text-white">{driverProfile.full_name}</p>
                      <a href={`tel:${driverProfile.phone}`} className="text-xs text-[#00572D] dark:text-green-400 font-semibold">
                        📞 {driverProfile.phone}
                      </a>
                      {driverProfile.vehicle_type && (
                        <p className="text-xs text-gray-400">
                          🏍️ {driverProfile.vehicle_type} {driverProfile.vehicle_brand} {driverProfile.vehicle_plate}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Message selon statut */}
              {["picked_up", "on_the_way", "driver_arrived"].includes(selectedOrder.status) && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-center">
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                    {selectedOrder.status === "picked_up" && "📬 Le livreur a récupéré la commande"}
                    {selectedOrder.status === "on_the_way" && "🚀 Le livreur est en route"}
                    {selectedOrder.status === "driver_arrived" && "📍 Le livreur est arrivé chez le client"}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    En attente de la confirmation du client...
                  </p>
                </div>
              )}

              {selectedOrder.status === "delivered" && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                  <p className="text-green-700 dark:text-green-400 font-bold text-sm">
                    🎉 Commande livrée avec succès
                  </p>
                  {selectedOrder.client_confirmed_at && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Confirmée le {new Date(selectedOrder.client_confirmed_at).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              )}

              {/* ACTIONS — uniquement pour les nouvelles et en préparation */}
              {getActions(selectedOrder.status).length > 0 && (
                <div className="space-y-2">
                  <p className="font-bold text-sm dark:text-white">⚡ Actions</p>
                  {getActions(selectedOrder.status).map(action => (
                    <button
                      key={action.newStatus}
                      onClick={() => updateStatus(selectedOrder.id, action.newStatus)}
                      disabled={updating}
                      className={`w-full ${action.color} text-white p-3 rounded-xl font-bold text-sm disabled:opacity-50 transition hover:opacity-90`}
                    >
                      {updating ? "Mise à jour..." : `${action.emoji} ${action.label}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t dark:border-gray-700">
              <button onClick={closeDetail} className="w-full bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}