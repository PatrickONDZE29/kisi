"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProviderTemp";

// =====================================================
// CONFIG STATUTS
// =====================================================
const STATUS_CONFIG: Record<string, {
  label: string;
  emoji: string;
  color: string;
  bg: string;
}> = {
  pending: {
    label: "Nouvelle réservation",
    emoji: "🆕",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  accepted: {
    label: "Préparation en cours",
    emoji: "📦",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
  ready: {
    label: "Prête à récupérer",
    emoji: "🎁",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  delivered: {
    label: "Livrée",
    emoji: "🎉",
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/30",
  },
  rejected: {
    label: "Refusée",
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

function getNextActions(status: string): {
  label: string;
  emoji: string;
  newStatus: string;
  color: string;
}[] {
  switch (status) {
    case "pending":
      return [
        { label: "Commencer la préparation", emoji: "📦", newStatus: "accepted", color: "bg-orange-600" },
        { label: "Refuser", emoji: "❌", newStatus: "rejected", color: "bg-red-600" },
      ];
    case "accepted":
      return [
        { label: "Commande prête", emoji: "🎁", newStatus: "ready", color: "bg-purple-600" },
      ];
    case "ready":
      return [
        { label: "Marquer comme livrée", emoji: "🎉", newStatus: "delivered", color: "bg-green-600" },
      ];
    default:
      return [];
  }
}

// =====================================================
// PAGE PRINCIPALE
// =====================================================
export default function PharmacyReservationsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);
  const [pharmacy, setPharmacy] = useState<any>(null);
  const [selectedReservation, setSelectedReservation] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);
  const [tab, setTab] = useState<"active" | "history">("active");

  // Compteurs
  const newCount = reservations.filter((r) => r.status === "pending").length;
  const preparingCount = reservations.filter((r) => r.status === "accepted").length;
  const readyCount = reservations.filter((r) => r.status === "ready").length;
  const deliveredCount = reservations.filter((r) => r.status === "delivered").length;
  const rejectedCount = reservations.filter((r) => r.status === "rejected").length;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setLoading(false); return; }

    const { data: pharmacyData } = await supabase
      .from("pharmacies")
      .select("*")
      .eq("user_id", auth.user.id)
      .single();

    if (!pharmacyData) { setLoading(false); return; }

    setPharmacy(pharmacyData);

    const { data } = await supabase
      .from("reservations")
      .select(`
        *,
        medicines(id, name, description, image_url)
      `)
      .eq("pharmacy_id", pharmacyData.id)
      .order("created_at", { ascending: false });

    setReservations(data || []);
    setLoading(false);

    // Temps réel
    supabase
      .channel("pharmacy-reservations-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "reservations",
        filter: `pharmacy_id=eq.${pharmacyData.id}`,
      }, () => loadData())
      .subscribe();
  }

  async function updateStatus(reservationId: string, newStatus: string) {
    setUpdating(true);

    const reservation = reservations.find((r) => r.id === reservationId);

    const { error } = await supabase
      .from("reservations")
      .update({ status: newStatus })
      .eq("id", reservationId);

    if (error) {
      showToast(error.message, "error");
      setUpdating(false);
      return;
    }

    // Diminuer le stock si livrée
    if (newStatus === "delivered" && reservation) {
      const { data: stockItem } = await supabase
        .from("stock")
        .select("id, quantity")
        .eq("medicine_id", reservation.medicine_id)
        .eq("pharmacy_id", reservation.pharmacy_id)
        .single();

      if (stockItem && stockItem.quantity > 0) {
        await supabase
          .from("stock")
          .update({ quantity: stockItem.quantity - 1 })
          .eq("id", stockItem.id);
      }
    }

    // Notification client
    if (reservation) {
      let title = "";
      let body = "";
      const cfg = getStatusConfig(newStatus);

      switch (newStatus) {
        case "accepted":
          title = "Préparation en cours 📦";
          body = "La pharmacie prépare votre réservation.";
          break;
        case "ready":
          title = "Réservation prête 🎁";
          body = "Votre médicament est prêt. Vous pouvez le récupérer à la pharmacie.";
          break;
        case "delivered":
          title = "Réservation livrée 🎉";
          body = "Votre médicament a été remis. Merci d'avoir utilisé KISI !";
          break;
        case "rejected":
          title = "Réservation refusée ❌";
          body = "Votre réservation a été refusée par la pharmacie.";
          break;
      }

      if (title && reservation.user_id) {
        await supabase.from("notifications").insert({
          user_id: reservation.user_id,
          type: "order_update",
          title,
          body,
        });
      }
    }

    const cfg = getStatusConfig(newStatus);
    showToast(`Statut mis à jour : ${cfg.label}`);
    await loadData();

    // Mettre à jour la réservation sélectionnée si ouverte
    if (selectedReservation?.id === reservationId) {
      const updated = reservations.find((r) => r.id === reservationId);
      if (updated) setSelectedReservation({ ...updated, status: newStatus });
    }

    setUpdating(false);
  }

  const activeReservations = reservations.filter(
    (r) => !["delivered", "rejected"].includes(r.status)
  );
  const historyReservations = reservations.filter(
    (r) => ["delivered", "rejected"].includes(r.status)
  );

  const displayedReservations = tab === "active" ? activeReservations : historyReservations;

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
          <h1 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
            📋 Réservations
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {pharmacy?.name}
          </p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {[
            { label: "Nouvelles", count: newCount, emoji: "🆕", color: "text-blue-600 dark:text-blue-400" },
            { label: "Prépa", count: preparingCount, emoji: "📦", color: "text-orange-600 dark:text-orange-400" },
            { label: "Prêtes", count: readyCount, emoji: "🎁", color: "text-purple-600 dark:text-purple-400" },
            { label: "Livrées", count: deliveredCount, emoji: "🎉", color: "text-green-600 dark:text-green-400" },
            { label: "Refusées", count: rejectedCount, emoji: "❌", color: "text-red-600 dark:text-red-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl p-2 text-center shadow-sm">
              <div className="text-lg">{s.emoji}</div>
              <p className={`text-xl font-black ${s.color}`}>{s.count}</p>
              <p className="text-[10px] text-gray-400">{s.label}</p>
            </div>
          ))}
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
            {activeReservations.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {activeReservations.length}
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
        {displayedReservations.length === 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 text-center shadow-sm">
            <div className="text-5xl mb-3">{tab === "active" ? "📋" : "📚"}</div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {tab === "active" ? "Aucune réservation en cours" : "Aucun historique"}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {displayedReservations.map((reservation) => {
            const cfg = getStatusConfig(reservation.status);
            const actions = getNextActions(reservation.status);

            return (
              <div
                key={reservation.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
              >
                {/* Badge statut */}
                <div className={`px-4 py-2 flex items-center justify-between ${cfg.bg}`}>
                  <span className={`text-xs font-bold ${cfg.color}`}>
                    {cfg.emoji} {cfg.label}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(reservation.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="p-4">
                  {/* Médicament */}
                  <div className="flex items-start gap-3 mb-3">
                    {reservation.medicines?.image_url ? (
                      <img
                        src={reservation.medicines.image_url}
                        alt={reservation.medicines.name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-[#00572D]/20 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl shrink-0">
                        💊
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-sm dark:text-white">
                        💊 {reservation.medicines?.name || "Médicament"}
                      </p>
                      {reservation.medicines?.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                          {reservation.medicines.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Client */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-3 space-y-1">
                    <p className="text-sm font-semibold dark:text-white">
                      👤 {reservation.customer_name || "Nom non renseigné"}
                    </p>
                    <p className="text-xs text-gray-400">
                      📞 {reservation.customer_phone || "Téléphone non renseigné"}
                    </p>
                    {pharmacy?.whatsapp && (
                      <a
                        href={`https://wa.me/${pharmacy.whatsapp.replace(/\D/g, "")}?text=Bonjour%20${reservation.customer_name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-1 bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold"
                      >
                        💬 WhatsApp
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  {actions.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {actions.map((action) => (
                        <button
                          key={action.newStatus}
                          onClick={() => updateStatus(reservation.id, action.newStatus)}
                          disabled={updating}
                          className={`w-full ${action.color} text-white p-3 rounded-xl font-bold text-sm disabled:opacity-50 transition hover:opacity-90`}
                        >
                          {updating ? "Mise à jour..." : `${action.emoji} ${action.label}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}