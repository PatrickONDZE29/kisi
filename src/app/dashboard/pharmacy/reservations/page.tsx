"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PharmacyReservationsPage() {
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);
  const [pharmacy, setPharmacy] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setLoading(false);
      return;
    }

    const { data: pharmacyData } = await supabase
      .from("pharmacies")
      .select("*")
      .eq("user_id", auth.user.id)
      .single();

    if (!pharmacyData) {
      setLoading(false);
      return;
    }

    setPharmacy(pharmacyData);

    const { data } = await supabase
      .from("reservations")
      .select(`
        *,
        medicines (
          id,
          name,
          description,
          image_url
        )
      `)
      .eq("pharmacy_id", pharmacyData.id)
      .order("created_at", { ascending: false });

    setReservations(data || []);
    setLoading(false);
  }

  async function updateStatus(reservationId: string, status: string) {
    const reservation = reservations.find((r) => r.id === reservationId);

    const { error } = await supabase
      .from("reservations")
      .update({ status })
      .eq("id", reservationId);

    if (error) {
      alert(error.message);
      return;
    }

    if (status === "delivered" && reservation) {
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

    await loadData();
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "pending":   return "🟡 En attente";
      case "accepted":  return "🟢 Acceptée";
      case "ready":     return "🔵 Prête";
      case "rejected":  return "🔴 Refusée";
      case "delivered": return "⚫ Livrée";
      default:          return status;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "pending":   return "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400";
      case "accepted":  return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400";
      case "ready":     return "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400";
      case "rejected":  return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400";
      case "delivered": return "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200";
      default:          return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
    }
  }

  const pending   = reservations.filter((r) => r.status === "pending").length;
  const accepted  = reservations.filter((r) => r.status === "accepted").length;
  const ready     = reservations.filter((r) => r.status === "ready").length;
  const delivered = reservations.filter((r) => r.status === "delivered").length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 flex items-center justify-center transition-colors">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 transition-colors">
          <p className="text-[#00572D] dark:text-green-400 font-bold">
            Chargement...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 p-6 transition-colors">
      <div className="max-w-6xl mx-auto">

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl transition-colors">
          <div className="text-center">
            <img src="/pharmacie.png" alt="Pharmacie" className="w-24 h-24 mx-auto" />

            <h1 className="text-3xl font-bold text-[#00572D] dark:text-green-400 mt-4">
              Réservations reçues
            </h1>

            <p className="text-gray-600 dark:text-gray-300 mt-2">
              {pharmacy?.name}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-4 mt-6">

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 transition-colors">
            <p className="text-gray-500 dark:text-gray-400">Total</p>
            <h2 className="text-3xl font-bold text-[#00572D] dark:text-green-400">{reservations.length}</h2>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 transition-colors">
            <p className="text-gray-500 dark:text-gray-400">En attente</p>
            <h2 className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{pending}</h2>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 transition-colors">
            <p className="text-gray-500 dark:text-gray-400">Acceptées</p>
            <h2 className="text-3xl font-bold text-green-600 dark:text-green-400">{accepted}</h2>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 transition-colors">
            <p className="text-gray-500 dark:text-gray-400">Prêtes</p>
            <h2 className="text-3xl font-bold text-blue-600 dark:text-blue-400">{ready}</h2>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 transition-colors">
            <p className="text-gray-500 dark:text-gray-400">Livrées</p>
            <h2 className="text-3xl font-bold text-black dark:text-white">{delivered}</h2>
          </div>

        </div>

        <div className="space-y-4 mt-6">

          {reservations.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 text-center transition-colors">
              <p className="text-[#00572D] dark:text-green-400 font-bold">
                Aucune réservation reçue
              </p>
            </div>
          )}

          {reservations.map((reservation) => (
            <div key={reservation.id} className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg transition-colors">

              <div className="flex flex-col md:flex-row md:justify-between gap-4">

                <div className="flex gap-4">

                  <img
                    src={reservation.medicines?.image_url || "/placeholder-medicine.png"}
                    alt={reservation.medicines?.name}
                    className="w-24 h-24 rounded-xl object-cover border dark:border-gray-700"
                  />

                  <div>

                    <h2 className="text-xl font-bold text-black dark:text-white">
                      💊 {reservation.medicines?.name || "Médicament inconnu"}
                    </h2>

                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                      {reservation.medicines?.description || "Aucune description"}
                    </p>

                    <p className="text-gray-600 dark:text-gray-300 mt-3">
                      👤 {reservation.customer_name || "Nom non renseigné"}
                    </p>

                    <p className="text-gray-600 dark:text-gray-300">
                      📞 {reservation.customer_phone || "Téléphone non renseigné"}
                    </p>

                    {pharmacy?.whatsapp && (
                      <a
                        href={`https://wa.me/${pharmacy.whatsapp.replace(/\D/g, "")}?text=Bonjour%20${reservation.customer_name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 bg-green-600 dark:bg-green-700 text-white px-3 py-1 rounded-lg text-sm"
                      >
                        WhatsApp
                      </a>
                    )}

                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                      📅 {new Date(reservation.created_at).toLocaleString("fr-FR")}
                    </p>

                  </div>

                </div>

                <div>
                  <span className={`px-4 py-2 rounded-full font-bold ${getStatusColor(reservation.status)}`}>
                    {getStatusLabel(reservation.status)}
                  </span>
                </div>

              </div>

              <div className="flex flex-wrap gap-3 mt-5">

                {reservation.status === "pending" && (
                  <>
                    <button
                      onClick={() => updateStatus(reservation.id, "accepted")}
                      className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded-xl"
                    >
                      Accepter
                    </button>

                    <button
                      onClick={() => updateStatus(reservation.id, "rejected")}
                      className="bg-red-600 dark:bg-red-700 text-white px-4 py-2 rounded-xl"
                    >
                      Refuser
                    </button>
                  </>
                )}

                {reservation.status === "accepted" && (
                  <button
                    onClick={() => updateStatus(reservation.id, "ready")}
                    className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-xl"
                  >
                    Marquer prête
                  </button>
                )}

                {reservation.status === "ready" && (
                  <button
                    onClick={() => updateStatus(reservation.id, "delivered")}
                    className="bg-black dark:bg-gray-700 text-white px-4 py-2 rounded-xl"
                  >
                    Marquer livrée
                  </button>
                )}

              </div>

            </div>
          ))}

        </div>

      </div>
    </main>
  );
}