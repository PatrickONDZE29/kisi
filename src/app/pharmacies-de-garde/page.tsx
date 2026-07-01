"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function PharmaciesDeGardePage() {
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [myPharmacy, setMyPharmacy] = useState<any>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: gardeData } = await supabase
      .from("pharmacies")
      .select("id, name, city, address, phone, logo_url, opening_hours, website, is_open")
      .eq("is_open", true)
      .order("name");

    setPharmacies(gardeData || []);

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (userData?.role === "pharmacy") {
      setRole("pharmacy");

      const { data: pharmacyData } = await supabase
        .from("pharmacies")
        .select("id, name, is_open")
        .eq("user_id", auth.user.id)
        .single();

      setMyPharmacy(pharmacyData);
    }

    setLoading(false);
  }

  async function toggleGarde() {
    if (!myPharmacy) return;
    setToggling(true);

    const newStatus = !myPharmacy.is_open;

    const { error } = await supabase
      .from("pharmacies")
      .update({ is_open: newStatus })
      .eq("id", myPharmacy.id);

    if (error) {
      alert(error.message);
      setToggling(false);
      return;
    }

    setMyPharmacy({ ...myPharmacy, is_open: newStatus });
    await loadData();
    setToggling(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 flex items-center justify-center transition-colors">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl transition-colors">
          <p className="text-[#00572D] dark:text-green-400 font-bold">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 transition-colors">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-28">

        {/* EN-TÊTE */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl text-center transition-colors">
          <div className="text-5xl mb-3">🏥</div>
          <h1 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
            Pharmacies de garde
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {pharmacies.length} pharmacie{pharmacies.length !== 1 ? "s" : ""} disponible{pharmacies.length !== 1 ? "s" : ""} en ce moment
          </p>
        </div>

        {/* BOUTON PHARMACIE CONNECTÉE */}
        {role === "pharmacy" && myPharmacy && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-xl mt-5 transition-colors">
            <p className="text-sm font-semibold text-black dark:text-white mb-1">
              {myPharmacy.name}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mb-4">
              {myPharmacy.is_open
                ? "Vous êtes actuellement listée comme pharmacie de garde."
                : "Vous n'êtes pas listée comme pharmacie de garde."}
            </p>
            <button
              onClick={toggleGarde}
              disabled={toggling}
              className={`w-full p-4 rounded-xl font-bold text-white transition-all disabled:opacity-60 hover:-translate-y-1 hover:shadow-xl duration-200 ${
                myPharmacy.is_open
                  ? "bg-red-600 dark:bg-red-700"
                  : "bg-[#00572D] dark:bg-green-700"
              }`}
            >
              {toggling
                ? "Mise à jour..."
                : myPharmacy.is_open
                ? "🔴 Me retirer de la garde"
                : "🟢 Me déclarer de garde"}
            </button>
          </div>
        )}

        {/* LISTE */}
        <div className="mt-5 space-y-4">

          {pharmacies.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 text-center transition-colors">
              <div className="text-5xl mb-4">😴</div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">
                Aucune pharmacie de garde disponible pour le moment.
              </p>
            </div>
          )}

          {pharmacies.map((pharmacy) => (
            <Link
              key={pharmacy.id}
              href={`/pharmacy/${pharmacy.id}`}
              className="block bg-white dark:bg-gray-900 rounded-3xl shadow-lg hover:-translate-y-1 hover:shadow-2xl transition-all duration-200 overflow-hidden"
            >
              {/* Badge de garde */}
              <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-bold text-green-700 dark:text-green-400">
                  🟢 De garde
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Disponible maintenant
                </span>
              </div>

              <div className="p-5">

                {/* Logo + Nom centrés */}
                <div className="flex flex-col items-center text-center mb-5">
                  <img
                    src={pharmacy.logo_url || "/pharmacie.png"}
                    alt={pharmacy.name}
                    className="w-20 h-20 rounded-full object-cover border-4 border-[#00572D]/20 dark:border-green-800 shadow-md"
                  />
                  <h2 className="text-lg font-bold text-black dark:text-white mt-3">
                    {pharmacy.name}
                  </h2>
                </div>

                {/* Informations en liste verticale */}
                <div className="space-y-2.5">

                  {pharmacy.city || pharmacy.address ? (
                    <div className="flex items-start gap-3">
                      <span className="text-base mt-0.5 flex-shrink-0">📍</span>
                      <p className="text-gray-700 dark:text-gray-200 text-sm leading-snug">
                        {[pharmacy.address, pharmacy.city].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  ) : null}

                  {pharmacy.phone && (
                    <div className="flex items-center gap-3">
                      <span className="text-base flex-shrink-0">📞</span>
                      <p className="text-gray-700 dark:text-gray-200 text-sm">
                        {pharmacy.phone}
                      </p>
                    </div>
                  )}

                  {pharmacy.opening_hours && (
                    <div className="flex items-center gap-3">
                      <span className="text-base flex-shrink-0">🕒</span>
                      <p className="text-gray-700 dark:text-gray-200 text-sm">
                        {pharmacy.opening_hours}
                      </p>
                    </div>
                  )}

                  {pharmacy.website && (
                    <div className="flex items-center gap-3">
                      <span className="text-base flex-shrink-0">🌐</span>
                      <p className="text-[#00572D] dark:text-green-400 text-sm truncate">
                        {pharmacy.website}
                      </p>
                    </div>
                  )}

                </div>

                {/* CTA */}
                <div className="mt-5 pt-4 border-t dark:border-gray-700 flex items-center justify-between">
                  <p className="text-[#00572D] dark:text-green-400 text-sm font-semibold">
                    Voir les médicaments
                  </p>
                  <span className="text-[#00572D] dark:text-green-400 text-lg">→</span>
                </div>

              </div>

            </Link>
          ))}

        </div>

      </div>
    </main>
  );
}