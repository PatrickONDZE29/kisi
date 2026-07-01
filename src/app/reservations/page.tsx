"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ReservationsPage() {
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);

  useEffect(() => {
    loadReservations();
  }, []);

  async function loadReservations() {
    const { data: auth } =
      await supabase.auth.getUser();

    if (!auth.user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("reservations")
      .select(`
        *,
        pharmacies(name,city),
        medicines(name)
      `)
      .eq("user_id", auth.user.id)
      .order("created_at", {
        ascending: false,
      });

    setReservations(data || []);
    setLoading(false);
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "pending":
        return "🟡 En attente";

      case "accepted":
        return "🟢 Acceptée";

      case "ready":
        return "🔵 Prête à récupérer";

      case "rejected":
        return "🔴 Refusée";

      case "delivered":
        return "⚫ Livrée";

      default:
        return status;
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-black dark:text-white transition-colors">
        Chargement...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 p-6 transition-colors">

      <div className="max-w-5xl mx-auto">

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl transition-colors">

          <h1 className="text-3xl font-bold text-[#00572D] dark:text-green-400">
            📋 Mes réservations
          </h1>

          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Suivez l'état de vos demandes
          </p>

        </div>

        <div className="space-y-4 mt-6">

          {reservations.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 text-center text-black dark:text-white transition-colors">
              Aucune réservation trouvée
            </div>
          )}

          {reservations.map((reservation) => (

            <div
              key={reservation.id}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg transition-colors"
            >

              <h2 className="text-2xl font-bold text-black dark:text-white">
                💊 {reservation.medicines?.name}
              </h2>

              <div className="mt-3 space-y-2 text-black dark:text-gray-200">

                <p className="text-black dark:text-gray-200">
                  🏥{" "}
                  <strong>
                    {reservation.pharmacies?.name}
                  </strong>
                </p>

                <p className="text-black dark:text-gray-200">
                  🌍{" "}
                  {reservation.pharmacies?.city ||
                    "Ville non renseignée"}
                </p>

                <p className="text-black dark:text-gray-200">
                  📅{" "}
                  {new Date(
                    reservation.created_at
                  ).toLocaleString("fr-FR")}
                </p>

                <p className="font-bold text-lg text-black dark:text-white">
                  {getStatusLabel(
                    reservation.status
                  )}
                </p>

              </div>

            </div>

          ))}

        </div>

      </div>

    </main>
  );
}