"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProviderTemp";
import MedicineCard from "@/components/MedicineCard";

export default function SearchPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBgLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  async function handleSearch(value: string) {
    setQuery(value);
    if (!value.trim()) { setResults([]); return; }

    const { data, error } = await supabase
      .from("stock")
      .select(`
        id, pharmacy_id, medicine_id, quantity, price,
        medicines(name, description, image_url),
        pharmacies(id, name, address, city, logo_url, is_open)
      `);

    if (error) { console.error(error.message); return; }

    const filtered = (data || []).filter((item: any) =>
      item?.medicines?.name?.toLowerCase().includes(value.toLowerCase())
    );
    setResults(filtered);
  }

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setShowAuthModal(true); return null; }
    const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (!userData || userData.role !== "user") { setShowAuthModal(true); return null; }
    return user;
  }

  async function reserveNow(item: any) {
    const user = await checkUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single();

    const { error } = await supabase.from("reservations").insert({
      user_id: user.id,
      pharmacy_id: item.pharmacy_id,
      medicine_id: item.medicine_id,
      status: "pending",
      customer_name: profile?.full_name || "",
      customer_phone: profile?.phone || "",
    });

    if (error) { showToast(error.message, "error"); return; }
    showToast("Réservation envoyée !");
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
          src="/recherche.png"
          alt="Arrière-plan"
          className="w-full h-full object-cover object-center sm:object-top"
        />
      </div>

      {/* OVERLAY — doux en clair, sombre en dark */}
      <div className="absolute inset-0 bg-[#00572D]/85 dark:bg-gray-950/85" />

      {/* CONTENU */}
      <div className="relative z-10 p-4 sm:p-6">

        {/* AUTH MODAL */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 w-full max-w-md">
              <h2 className="text-xl sm:text-2xl font-bold text-[#00572D] text-center dark:text-white">
                Connexion requise
              </h2>
              <p className="text-center text-gray-600 dark:text-gray-300 mt-2 text-sm">
                Vous devez avoir un compte pour réserver.
              </p>
              <div className="mt-5 space-y-3">
                <button
                  onClick={() => { setShowAuthModal(false); router.push("/login"); }}
                  className="w-full bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm"
                >
                  Se connecter
                </button>
                <button
                  onClick={() => { setShowAuthModal(false); router.push("/register"); }}
                  className="w-full border border-[#00572D] text-[#00572D] dark:text-white p-3 rounded-xl font-bold text-sm"
                >
                  Créer un compte
                </button>
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="w-full bg-gray-200 dark:bg-gray-800 dark:text-white p-3 rounded-xl font-bold text-sm"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto">

          {/* HEADER */}
          <div
            className={`text-center mb-6 sm:mb-8 transition-all duration-1000 delay-500 ${
              bgLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <img src="/logo.png" alt="Logo" className="w-20 sm:w-28 mx-auto drop-shadow-xl" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 sm:mt-4 drop-shadow-lg">
              Rechercher un médicament
            </h1>
          </div>

          {/* SEARCH */}
          <div
            className={`bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl p-3 sm:p-4 shadow-xl transition-all duration-1000 delay-700 ${
              bgLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                className="flex-1 p-3 sm:p-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-black dark:text-white text-sm sm:text-base"
                placeholder="Ex: Paracétamol"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>

          {/* RÉSULTATS */}
          <div className="mt-8 sm:mt-10 flex flex-col gap-y-14 sm:gap-y-16">

            {results.length === 0 && query && (
              <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-5 sm:p-6 rounded-2xl text-center text-gray-700 dark:text-gray-300 text-sm">
                Aucun résultat
              </div>
            )}

            {results.map((item, index) => (
              <div key={index} className="pt-8 sm:pt-10">

                <div
                  onClick={() => item.pharmacies?.id && router.push(`/pharmacy/${item.pharmacies.id}`)}
                  className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 cursor-pointer hover:opacity-80 transition px-1"
                >
                  {item.pharmacies?.logo_url && (
                    <img
                      src={item.pharmacies.logo_url}
                      alt={item.pharmacies.name}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-white/30"
                    />
                  )}
                  <div>
                    <p className="font-bold text-white text-xs sm:text-sm drop-shadow">
                      🏥 {item.pharmacies?.name}
                    </p>
                    <p className="text-green-200 text-[11px] sm:text-xs drop-shadow">
                      📍 {item.pharmacies?.city} · {item.pharmacies?.is_open ? "🟢 Ouverte" : "🔴 Fermée"}
                    </p>
                  </div>
                </div>

                <MedicineCard item={item} onReserve={reserveNow} />

              </div>
            ))}

          </div>

        </div>
      </div>
    </main>
  );
}