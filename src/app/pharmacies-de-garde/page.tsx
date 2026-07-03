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
  const [bgLoaded, setBgLoaded] = useState(false);

  useEffect(() => {
    loadData();
    const timer = setTimeout(() => setBgLoaded(true), 100);
    return () => clearTimeout(timer);
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
      <main className="min-h-screen relative overflow-hidden">
        <div
          className={`absolute inset-0 transition-all duration-[1500ms] ease-out ${
            bgLoaded
              ? "translate-x-0 opacity-100 scale-100"
              : "translate-x-full opacity-0 scale-110"
          }`}
        >
          <img
            src="/accueil1.png"
            alt="Arrière-plan"
            className="w-full h-full object-cover object-center sm:object-top"
          />
        </div>
        <div className="absolute inset-0 bg-[#00572D]/85 dark:bg-gray-950/85" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 shadow-xl">
            <p className="text-[#00572D] dark:text-green-400 font-bold text-sm sm:text-base">
              Chargement...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen relative overflow-hidden">

      {/* IMAGE ARRIÈRE-PLAN — responsive mobile */}
      <div
        className={`absolute inset-0 transition-all duration-[1500ms] ease-out ${
          bgLoaded
            ? "translate-x-0 opacity-100 scale-100"
            : "translate-x-full opacity-0 scale-110"
        }`}
      >
        <img
          src="/accueil1.png"
          alt="Arrière-plan"
          className="w-full h-full object-cover object-center sm:object-top"
        />
      </div>

      {/* OVERLAY — plus opaque en clair pour pas faire mal aux yeux */}
      <div className="absolute inset-0 bg-[#00572D]/85 dark:bg-gray-950/85" />

      {/* CONTENU */}
      <div className="relative z-10">
        <div className="max-w-lg mx-auto px-3 sm:px-4 pt-4 sm:pt-6 pb-28">

          {/* EN-TÊTE */}
          <div
            className={`bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-3xl p-4 sm:p-6 shadow-xl text-center transition-all duration-1000 delay-500 ${
              bgLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">🏥</div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#00572D] dark:text-green-400">
              Pharmacies de garde
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-1">
              {pharmacies.length} pharmacie{pharmacies.length !== 1 ? "s" : ""} disponible{pharmacies.length !== 1 ? "s" : ""} en ce moment
            </p>
          </div>

          {/* BOUTON PHARMACIE CONNECTÉE */}
          {role === "pharmacy" && myPharmacy && (
            <div
              className={`bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-xl mt-4 sm:mt-5 transition-all duration-1000 delay-700 ${
                bgLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
            >
              <p className="text-sm font-semibold text-black dark:text-white mb-1">
                {myPharmacy.name}
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-3 sm:mb-4">
                {myPharmacy.is_open
                  ? "Vous êtes actuellement listée comme pharmacie de garde."
                  : "Vous n'êtes pas listée comme pharmacie de garde."}
              </p>
              <button
                onClick={toggleGarde}
                disabled={toggling}
                className={`w-full p-3 sm:p-4 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-60 hover:-translate-y-1 hover:shadow-xl duration-200 ${
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
          <div className="mt-4 sm:mt-5 space-y-3 sm:space-y-4">

            {pharmacies.length === 0 && (
              <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-3xl p-8 sm:p-10 text-center">
                <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">😴</div>
                <p className="text-gray-600 dark:text-gray-300 font-medium text-sm">
                  Aucune pharmacie de garde disponible pour le moment.
                </p>
              </div>
            )}

            {pharmacies.map((pharmacy, index) => (
              <Link
                key={pharmacy.id}
                href={`/pharmacy/${pharmacy.id}`}
                className={`block bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-lg hover:-translate-y-1 hover:shadow-2xl transition-all overflow-hidden ${
                  bgLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{
                  transitionDelay: bgLoaded ? `${800 + index * 100}ms` : "0ms",
                  transitionDuration: "800ms",
                }}
              >
                {/* Badge de garde */}
                <div className="bg-green-50/90 dark:bg-green-900/20 px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-green-700 dark:text-green-400">
                    🟢 De garde
                  </span>
                  <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
                    Disponible maintenant
                  </span>
                </div>

                <div className="p-4 sm:p-5">

                  {/* Logo + Nom */}
                  <div className="flex flex-col items-center text-center mb-4 sm:mb-5">
                    <img
                      src={pharmacy.logo_url || "/pharmacie.png"}
                      alt={pharmacy.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-[#00572D]/20 dark:border-green-800 shadow-md"
                    />
                    <h2 className="text-base sm:text-lg font-bold text-black dark:text-white mt-2 sm:mt-3">
                      {pharmacy.name}
                    </h2>
                  </div>

                  {/* Informations */}
                  <div className="space-y-2">

                    {pharmacy.city || pharmacy.address ? (
                      <div className="flex items-start gap-2 sm:gap-3">
                        <span className="text-sm sm:text-base mt-0.5 flex-shrink-0">📍</span>
                        <p className="text-gray-700 dark:text-gray-200 text-xs sm:text-sm leading-snug">
                          {[pharmacy.address, pharmacy.city].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    ) : null}

                    {pharmacy.phone && (
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-sm sm:text-base flex-shrink-0">📞</span>
                        <p className="text-gray-700 dark:text-gray-200 text-xs sm:text-sm">
                          {pharmacy.phone}
                        </p>
                      </div>
                    )}

                    {pharmacy.opening_hours && (
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-sm sm:text-base flex-shrink-0">🕒</span>
                        <p className="text-gray-700 dark:text-gray-200 text-xs sm:text-sm">
                          {pharmacy.opening_hours}
                        </p>
                      </div>
                    )}

                    {pharmacy.website && (
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-sm sm:text-base flex-shrink-0">🌐</span>
                        <p className="text-[#00572D] dark:text-green-400 text-xs sm:text-sm truncate">
                          {pharmacy.website}
                        </p>
                      </div>
                    )}

                  </div>

                  {/* CTA */}
                  <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t dark:border-gray-700 flex items-center justify-between">
                    <p className="text-[#00572D] dark:text-green-400 text-xs sm:text-sm font-semibold">
                      Voir les médicaments
                    </p>
                    <span className="text-[#00572D] dark:text-green-400 text-base sm:text-lg">→</span>
                  </div>

                </div>

              </Link>
            ))}

          </div>

        </div>
      </div>
    </main>
  );
}