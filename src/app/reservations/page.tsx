"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProviderTemp";
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
  pending: { label: "En attente", emoji: "⏳", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
  accepted: { label: "Acceptée", emoji: "✅", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
  rejected: { label: "Refusée", emoji: "❌", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
  payment_confirmed: { label: "Paiement confirmé", emoji: "💳", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
  preparing: { label: "Préparation en cours", emoji: "📦", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
  ready: { label: "Prête", emoji: "🎁", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" },
  driver_assigned: { label: "Livreur affecté", emoji: "🏍️", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  driver_arrived_at_pharmacy: { label: "Livreur à la pharmacie", emoji: "🏥", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  picked_up: { label: "Commande récupérée", emoji: "📬", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20" },
  on_the_way: { label: "Livreur en route", emoji: "🚀", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20" },
  driver_arrived: { label: "Livreur arrivé", emoji: "📍", color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-900/20" },
  delivered: { label: "Livrée", emoji: "🎉", color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
  cancelled: { label: "Annulée", emoji: "❌", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || {
    label: status,
    emoji: "❓",
    color: "text-gray-500",
    bg: "bg-gray-50 dark:bg-gray-800",
  };
}

const DELIVERY_STATUSES = ["picked_up", "on_the_way", "driver_arrived"];

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
// UTILITAIRES ESCROW
// =====================================================
async function getOrCreateWallet(ownerId: string, ownerType: "pharmacy" | "driver" | "kisi"): Promise<string> {
  const { data: existing } = await supabase
    .from("wallets")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("owner_type", ownerType)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("wallets")
    .insert({ owner_id: ownerId, owner_type: ownerType, balance: 0 })
    .select("id")
    .single();

  return created!.id;
}

async function creditWallet(walletId: string, amount: number) {
  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance, total_received")
    .eq("id", walletId)
    .single();

  if (!wallet) return;

  await supabase.from("wallets").update({
    balance: Number(wallet.balance) + amount,
    total_received: Number(wallet.total_received) + amount,
    updated_at: new Date().toISOString(),
  }).eq("id", walletId);
}

// =====================================================
// PAGE PRINCIPALE
// =====================================================
export default function ReservationsPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedType, setSelectedType] = useState<"reservation" | "order" | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [driverProfile, setDriverProfile] = useState<any | null>(null);
  const [orderAddress, setOrderAddress] = useState<any | null>(null);
  const [tab, setTab] = useState<"active" | "history">("active");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // États escrow
  const [confirming, setConfirming] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const DISPUTE_REASONS = [
    "Je n'ai pas reçu ma commande",
    "Le médicament est incorrect",
    "Le colis est endommagé",
    "Le livreur est introuvable",
    "La quantité est incorrecte",
    "Autre problème",
  ];

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel("reservations-orders-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        loadAll();
        if (selectedItem && selectedType === "order") {
          openOrderDetail({ ...selectedItem });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reservations" }, () => {
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

    setCurrentUser(user);

    const { data: resData } = await supabase
      .from("reservations")
      .select(`*, pharmacies(name, city, logo_url), medicines(name, description, image_url)`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setReservations(resData || []);

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
    // Recharger la commande fraîche depuis Supabase
    const { data: freshOrder } = await supabase
      .from("orders")
      .select(`
        *,
        pharmacies(name, city, logo_url),
        driver_profiles(id, full_name, phone, photo_url, vehicle_type, vehicle_brand, vehicle_plate, rating)
      `)
      .eq("id", order.id)
      .single();

    setSelectedItem(freshOrder || order);
    setSelectedType("order");

    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    setOrderItems(items || []);

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

    const dp = freshOrder?.driver_profiles || order.driver_profiles;
    setDriverProfile(dp || null);
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
    setShowDisputeModal(false);
    setDisputeReason("");
  }

  // =====================================================
  // CONFIRMER LA LIVRAISON — LIBÉRER L'ESCROW
  // =====================================================
  async function confirmDelivery(orderId: string) {
    if (!currentUser) return;
    setConfirming(true);

    try {
      // 1. Récupérer l'escrow
      const { data: escrow, error: escrowError } = await supabase
        .from("escrow_accounts")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();

      // 2. Récupérer la commande avec le livreur
      const { data: order } = await supabase
        .from("orders")
        .select("*, driver_profiles(id, user_id, full_name, total_earnings, total_deliveries)")
        .eq("id", orderId)
        .single();

      if (!order) throw new Error("Commande introuvable");

      // 3. Si escrow existe, libérer au livreur
      if (escrow && escrow.status === "held" && order.driver_id) {
        const driverProfileId = order.driver_id;
        const driverUserId = order.driver_profiles?.user_id;

        // Créer/récupérer wallet livreur
        const driverWalletId = await getOrCreateWallet(driverProfileId, "driver");

        // Créditer le livreur
        await creditWallet(driverWalletId, escrow.driver_amount);

        // Créditer KISI (wallet global)
        const { data: kisiWallet } = await supabase
          .from("wallets")
          .select("id")
          .eq("owner_type", "kisi")
          .maybeSingle();

        if (kisiWallet) {
          await creditWallet(kisiWallet.id, escrow.commission_amount);
        }

        // Transactions financières
        await supabase.from("financial_transactions").insert([
          {
            order_id: orderId,
            type: "escrow_release",
            to_wallet_id: driverWalletId,
            amount: escrow.driver_amount,
            status: "completed",
            description: `Gain livraison libéré au livreur`,
            metadata: { commission_deducted: escrow.commission_amount },
          },
          {
            order_id: orderId,
            type: "kisi_commission",
            amount: escrow.commission_amount,
            status: "completed",
            description: `Commission KISI sur livraison`,
          },
        ]);

        // Mettre à jour l'escrow
        await supabase.from("escrow_accounts").update({
          status: "released",
          released_at: new Date().toISOString(),
        }).eq("order_id", orderId);

        // Mettre à jour les gains du livreur
        const currentEarnings = Number(order.driver_profiles?.total_earnings || 0);
        const currentDeliveries = Number(order.driver_profiles?.total_deliveries || 0);

        await supabase.from("driver_profiles").update({
          total_earnings: currentEarnings + escrow.driver_amount,
          total_deliveries: currentDeliveries + 1,
        }).eq("id", driverProfileId);

        // Notification livreur
        if (driverUserId) {
          await supabase.from("notifications").insert({
            user_id: driverUserId,
            type: "payment",
            title: "Paiement reçu 💰",
            body: `${escrow.driver_amount.toLocaleString()} FCFA ont été ajoutés à votre portefeuille.`,
            order_id: orderId,
          });
        }
      }

      // 4. Mettre à jour le stock
      const { data: orderItemsList } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      if (orderItemsList) {
        for (const item of orderItemsList) {
          const { data: stock } = await supabase
            .from("stock")
            .select("id, quantity")
            .eq("medicine_id", item.medicine_id)
            .eq("pharmacy_id", item.pharmacy_id)
            .single();

          if (stock && stock.quantity >= item.quantity) {
            await supabase
              .from("stock")
              .update({ quantity: stock.quantity - item.quantity })
              .eq("id", stock.id);
          }
        }
      }

      // 5. Mettre à jour la commande
      await supabase.from("orders").update({
        status: "delivered",
        escrow_status: "released",
        client_confirmed: true,
        client_confirmed_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
      }).eq("id", orderId);

      // 6. Événement
      await supabase.from("delivery_events").insert({
        order_id: orderId,
        actor_type: "user",
        actor_id: currentUser.id,
        status: "delivered",
        label: "Client a confirmé la réception",
      });

      // 7. Notification client
      await supabase.from("notifications").insert({
        user_id: currentUser.id,
        type: "delivery",
        title: "Livraison confirmée ✅",
        body: "Merci d'avoir confirmé votre livraison. Bonne santé !",
        order_id: orderId,
      });

      showToast("Livraison confirmée ! Le livreur a été payé. ✅");
      closeDetail();
      await loadAll();
    } catch (err: any) {
      showToast(err.message || "Erreur lors de la confirmation", "error");
    } finally {
      setConfirming(false);
    }
  }

  // =====================================================
  // OUVRIR UN LITIGE
  // =====================================================
  async function handleOpenDispute(orderId: string) {
    if (!currentUser || !disputeReason.trim()) {
      showToast("Sélectionnez un motif", "error");
      return;
    }

    setDisputeSubmitting(true);

    try {
      // Bloquer l'escrow
      await supabase.from("escrow_accounts").update({
        status: "disputed",
        disputed_at: new Date().toISOString(),
      }).eq("order_id", orderId);

      // Créer le litige
      await supabase.from("disputes").insert({
        order_id: orderId,
        user_id: currentUser.id,
        reason: disputeReason,
        status: "open",
      });

      // Mettre à jour la commande
      await supabase.from("orders").update({
        escrow_status: "disputed",
      }).eq("id", orderId);

      // Alerter les admins
      const { data: admins } = await supabase
        .from("users")
        .select("id")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        await supabase.from("notifications").insert(
          admins.map((admin: any) => ({
            user_id: admin.id,
            type: "system",
            title: "🚨 Litige ouvert",
            body: `Un client a signalé un problème. Motif : ${disputeReason}`,
            order_id: orderId,
          }))
        );
      }

      showToast("Litige signalé. L'équipe KISI va examiner votre demande.");
      setShowDisputeModal(false);
      setDisputeReason("");
      closeDetail();
      await loadAll();
    } catch (err: any) {
      showToast(err.message || "Erreur lors du signalement", "error");
    } finally {
      setDisputeSubmitting(false);
    }
  }

  // =====================================================
  // FILTRES
  // =====================================================
  const activeReservations = reservations.filter((r) => !["rejected", "delivered"].includes(r.status));
  const historyReservations = reservations.filter((r) => ["rejected", "delivered"].includes(r.status));
  const activeOrders = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  const historyOrders = orders.filter((o) => ["delivered", "cancelled"].includes(o.status));

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
            <div className="text-5xl mb-3">{tab === "active" ? "📋" : "📚"}</div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {tab === "active" ? "Aucune commande en cours" : "Aucun historique"}
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
                onClick={() => isOrder ? openOrderDetail(item) : openReservationDetail(item)}
                className="w-full text-left bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all overflow-hidden"
              >
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
                  <div className="flex items-center gap-2 mb-2">
                    {item.pharmacies?.logo_url && (
                      <img src={item.pharmacies.logo_url} alt={item.pharmacies.name} className="w-8 h-8 rounded-full object-cover border border-gray-100" />
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

                  {!isOrder && item.medicines && (
                    <div className="flex items-center gap-3 mt-2">
                      {item.medicines.image_url && (
                        <img src={item.medicines.image_url} alt={item.medicines.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                      )}
                      <div>
                        <p className="text-sm font-medium dark:text-white">💊 {item.medicines.name}</p>
                        {item.medicines.description && (
                          <p className="text-xs text-gray-400 line-clamp-1">{item.medicines.description}</p>
                        )}
                      </div>
                    </div>
                  )}

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
                        {/* Indicateur confirmation requise */}
                        {item.status === "driver_arrived" && !item.client_confirmed && (
                          <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold animate-pulse">
                            ✅ Confirmation requise
                          </span>
                        )}
                      </div>

                      {progressIdx >= 0 && item.status !== "cancelled" && (
                        <div className="flex gap-1 mt-2">
                          {ORDER_STEPS.map((_, idx) => (
                            <div
                              key={idx}
                              className={`flex-1 h-1 rounded-full transition-all ${
                                idx <= progressIdx ? "bg-[#00572D]" : "bg-gray-200 dark:bg-gray-700"
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

              {/* Barre progression */}
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
                  <img src={selectedItem.pharmacies.logo_url} alt={selectedItem.pharmacies.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
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

              {/* Médicament (réservation) */}
              {selectedType === "reservation" && selectedItem.medicines && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="font-bold text-sm mb-2 dark:text-white">💊 Médicament</p>
                  <div className="flex items-start gap-3">
                    {selectedItem.medicines.image_url && (
                      <img src={selectedItem.medicines.image_url} alt={selectedItem.medicines.name} className="w-14 h-14 rounded-full object-cover border-2 border-[#00572D]/20" />
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

              {/* Produits (commande) */}
              {selectedType === "order" && orderItems.length > 0 && (
                <div>
                  <p className="font-bold text-sm mb-2 dark:text-white">💊 Produits</p>
                  <div className="space-y-2">
                    {orderItems.map((oi) => (
                      <div key={oi.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                        <div className="flex items-center gap-2">
                          {oi.medicine_image_url && (
                            <img src={oi.medicine_image_url} alt={oi.medicine_name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
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

              {/* Montants */}
              {selectedType === "order" && (
                <div className="bg-[#00572D] rounded-xl p-4 text-white space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-200">Médicaments</span>
                    <span className="font-bold">{(selectedItem.subtotal || 0).toLocaleString()} FCFA</span>
                  </div>
                  {selectedItem.delivery_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-200">
                        Livraison {selectedItem.escrow_status === "held" ? "🔒" : selectedItem.escrow_status === "released" ? "✅" : ""}
                      </span>
                      <span className="font-bold">{(selectedItem.delivery_fee || 0).toLocaleString()} FCFA</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-green-600">
                    <span>Total payé</span>
                    <span>{(selectedItem.total || 0).toLocaleString()} FCFA</span>
                  </div>

                  {/* Statut escrow */}
                  {selectedItem.delivery_fee > 0 && (
                    <div className="bg-white/10 rounded-xl p-2 text-xs text-center mt-1">
                      {selectedItem.escrow_status === "held" && "🔒 Frais de livraison en attente de votre confirmation"}
                      {selectedItem.escrow_status === "released" && "✅ Frais de livraison versés au livreur"}
                      {selectedItem.escrow_status === "disputed" && "⚠️ Litige en cours — Fonds bloqués"}
                    </div>
                  )}
                </div>
              )}

              {/* Adresse */}
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
                      <img src={driverProfile.photo_url} alt={driverProfile.full_name} className="w-12 h-12 rounded-full object-cover border-2 border-[#00572D]" />
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

              {/* OTP */}
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

              {/* Paiement */}
              {selectedType === "order" && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="font-bold text-sm mb-1 dark:text-white">💳 Paiement</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedItem.payment_provider === "airtel" ? "Airtel Money" :
                     selectedItem.payment_provider === "mtn" ? "MTN MoMo" : "Mobile Money"}
                  </p>
                  <p className={`text-xs font-bold mt-1 ${
                    selectedItem.payment_status === "paid"
                      ? "text-green-600 dark:text-green-400"
                      : "text-yellow-600 dark:text-yellow-400"
                  }`}>
                    {selectedItem.payment_status === "paid" ? "✅ Payé" : "⏳ En attente"}
                  </p>
                  {selectedItem.pharmacy_paid && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      ✅ Pharmacie payée : {(selectedItem.pharmacy_payment_amount || 0).toLocaleString()} FCFA
                    </p>
                  )}
                </div>
              )}

              {/* ✅ BOUTON CONFIRMATION LIVRAISON */}
              {selectedType === "order" &&
                selectedItem.status === "driver_arrived" &&
                !selectedItem.client_confirmed && (
                  <div className="space-y-2 pt-2">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-center">
                      <p className="text-xs text-green-700 dark:text-green-400 font-semibold">
                        🎁 Le livreur est arrivé. Vérifiez votre colis avant de confirmer.
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Votre confirmation déclenchera le paiement du livreur.
                      </p>
                    </div>

                    <button
                      onClick={() => confirmDelivery(selectedItem.id)}
                      disabled={confirming}
                      className="w-full bg-green-600 hover:bg-green-700 text-white p-4 rounded-xl font-bold text-sm disabled:opacity-50 transition"
                    >
                      {confirming ? "Confirmation en cours..." : "✅ J'ai bien reçu ma commande"}
                    </button>

                    <button
                      onClick={() => setShowDisputeModal(true)}
                      className="w-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl font-bold text-sm"
                    >
                      ⚠️ Signaler un problème
                    </button>
                  </div>
                )}

              {/* Commande déjà confirmée */}
              {selectedType === "order" && selectedItem.client_confirmed && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                  <p className="text-green-700 dark:text-green-400 font-bold text-sm">
                    ✅ Livraison confirmée le{" "}
                    {selectedItem.client_confirmed_at
                      ? new Date(selectedItem.client_confirmed_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </p>
                </div>
              )}

              {/* Litige en cours */}
              {selectedType === "order" && selectedItem.escrow_status === "disputed" && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 text-center">
                  <p className="text-orange-700 dark:text-orange-400 font-bold text-sm">
                    ⚠️ Litige en cours
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    L'équipe KISI examine votre dossier. Les fonds sont bloqués jusqu'à résolution.
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

      {/* ========== MODAL LITIGE ========== */}
      {showDisputeModal && selectedItem && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-red-600 dark:text-red-400 mb-1">
              ⚠️ Signaler un problème
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Sélectionnez le motif de votre problème. Les fonds seront bloqués jusqu'à résolution par KISI.
            </p>

            <div className="space-y-2 mb-4">
              {DISPUTE_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setDisputeReason(reason)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-medium border-2 transition ${
                    disputeReason === reason
                      ? "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-600 dark:text-red-400"
                      : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDisputeModal(false); setDisputeReason(""); }}
                className="flex-1 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm"
              >
                Annuler
              </button>
              <button
                onClick={() => handleOpenDispute(selectedItem.id)}
                disabled={!disputeReason.trim() || disputeSubmitting}
                className="flex-1 bg-red-600 text-white p-3 rounded-xl font-bold text-sm disabled:opacity-50"
              >
                {disputeSubmitting ? "Envoi..." : "Signaler"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}