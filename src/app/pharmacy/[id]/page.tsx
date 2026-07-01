"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProviderTemp";

export default function PharmacyPublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [pharmacy, setPharmacy] = useState<any>(null);
  const [stocks, setStocks] = useState<any[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    const { data: pharmacyData } = await supabase
      .from("pharmacies")
      .select("*")
      .eq("id", id)
      .single();

    if (!pharmacyData) {
      setLoading(false);
      return;
    }

    setPharmacy(pharmacyData);

    const { data: stockData } = await supabase
      .from("stock")
      .select(`*, medicines(name)`)
      .eq("pharmacy_id", pharmacyData.id);

    setStocks(stockData || []);
    setLoading(false);
  }

  async function reserveMedicine(medicineId: string) {
    const { data: auth } = await supabase.auth.getUser();

    // Pas connecté
    if (!auth.user) {
      setShowAuthModal(true);
      return;
    }

    // Vérifier que c'est un compte utilisateur
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (!userData || userData.role !== "user") {
      setShowAuthModal(true);
      return;
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", auth.user.id)
      .single();

    const { error } = await supabase
      .from("reservations")
      .insert({
        user_id: auth.user.id,
        pharmacy_id: pharmacy.id,
        medicine_id: medicineId,
        status: "pending",
        customer_name: profile?.full_name || "",
        customer_phone: profile?.phone || "",
      });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Réservation envoyée avec succès !");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-black dark:text-white transition-colors">
        Chargement...
      </main>
    );
  }

  if (!pharmacy) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-black dark:text-white transition-colors">
        Pharmacie introuvable
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 transition-colors">

      {/* MODALE AUTH */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md shadow-2xl transition-colors">
            <div className="text-center">
              <div className="text-5xl mb-3">🔐</div>
              <h2 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
                Connexion requise
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Vous devez avoir un compte utilisateur pour réserver un médicament.
              </p>
            </div>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => { setShowAuthModal(false); router.push("/login"); }}
                className="w-full bg-[#00572D] dark:bg-green-700 text-white p-4 rounded-xl font-bold hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
              >
                Se connecter
              </button>
              <button
                onClick={() => { setShowAuthModal(false); router.push("/register"); }}
                className="w-full border-2 border-[#00572D] dark:border-green-500 text-[#00572D] dark:text-green-400 p-4 rounded-xl font-bold hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
              >
                Créer un compte
              </button>
              <button
                onClick={() => setShowAuthModal(false)}
                className="w-full bg-gray-200 dark:bg-gray-800 text-black dark:text-white p-4 rounded-xl font-bold hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <img
          src={pharmacy.cover_url || "/cover-placeholder.jpg"}
          alt="Couverture"
          className="w-full h-64 object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="max-w-5xl mx-auto px-6">

        <div className="-mt-16 relative z-10">
          <img
            src={pharmacy.logo_url || "/pharmacie.png"}
            alt="Logo"
            className="w-32 h-32 rounded-full bg-white dark:bg-gray-900 p-2 shadow-xl border-4 border-white dark:border-gray-900"
          />
        </div>

        <div className="mt-4">
          <h1 className="text-4xl font-bold text-black dark:text-white">{pharmacy.name}</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">📍 {pharmacy.city || "Ville non renseignée"}</p>
          {pharmacy.address && <p className="text-gray-600 dark:text-gray-300">🏠 {pharmacy.address}</p>}
          <p className="text-gray-600 dark:text-gray-300">📞 {pharmacy.phone || "Non renseigné"}</p>
          <p className="text-gray-600 dark:text-gray-300">🕒 {pharmacy.opening_hours || "Horaires non renseignés"}</p>

          <div className="mt-3">
            {pharmacy.is_open ? (
              <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-4 py-2 rounded-full font-bold">🟢 Ouverte</span>
            ) : (
              <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-4 py-2 rounded-full font-bold">🔴 Fermée</span>
            )}
          </div>

          <div className="mt-6 bg-gray-100 dark:bg-gray-900 rounded-2xl p-5 transition-colors">
            <h2 className="font-bold text-xl text-black dark:text-white">Description</h2>
            <p className="text-gray-700 dark:text-gray-300 mt-2">
              {pharmacy.description || "Aucune description disponible."}
            </p>
          </div>
        </div>

        <div className="mt-10 pb-28">
          <h2 className="text-3xl font-bold text-[#00572D] dark:text-green-400 mb-6">
            💊 Médicaments disponibles
          </h2>

          {stocks.length === 0 && (
            <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-6 text-black dark:text-white transition-colors">
              Aucun médicament disponible
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-5">
            {stocks.map((item) => (
              <div key={item.id} className="border dark:border-gray-700 rounded-2xl p-5 shadow dark:bg-gray-900 transition-colors">
                <h3 className="text-xl font-bold text-black dark:text-white">
                  {item.medicines?.name || "Médicament"}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mt-2">Prix : {item.price} FCFA</p>
                <p className="text-gray-600 dark:text-gray-300">Stock : {item.quantity}</p>
                <button
                  onClick={() => reserveMedicine(item.medicine_id)}
                  disabled={item.quantity <= 0}
                  className="mt-4 w-full bg-[#00572D] dark:bg-green-700 text-white p-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
                >
                  {item.quantity <= 0 ? "Indisponible" : "Réserver"}
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}