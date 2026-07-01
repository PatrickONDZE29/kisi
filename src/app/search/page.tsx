"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProviderTemp";
import { useCart } from "@/components/CartContext";
import CartModal from "@/components/CartModal";

export default function SearchPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { addItem, removeItem, isInCart, count } = useCart();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCart, setShowCart] = useState(false);

  async function handleSearch(value: string) {
    setQuery(value);

    if (!value.trim()) {
      setResults([]);
      return;
    }

    const { data, error } = await supabase
      .from("stock")
      .select(`
        id,
        pharmacy_id,
        medicine_id,
        quantity,
        price,
        medicines (
          name,
          description
        ),
        pharmacies (
          id,
          name,
          address,
          city,
          logo_url,
          is_open
        )
      `);

    if (error) {
      console.error(error.message);
      return;
    }

    const filtered = (data || []).filter((item: any) =>
      item?.medicines?.name?.toLowerCase().includes(value.toLowerCase())
    );

    setResults(filtered);
  }

  async function addToCart(item: any) {
    if (isInCart(item.id)) {
      removeItem(item.id);
      showToast("Retiré du panier", "info");
      return;
    }

    addItem({
      id: item.id,
      medicine_id: item.medicine_id,
      medicine_name: item.medicines?.name || "",
      pharmacy_id: item.pharmacy_id,
      pharmacy_name: item.pharmacies?.name || "",
      price: item.price,
      quantity_available: item.quantity,
    });

    showToast("Ajouté au panier 🛒");
  }

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setShowAuthModal(true);
      return null;
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "user") {
      setShowAuthModal(true);
      return null;
    }

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

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Réservation envoyée !");
  }

  return (
    <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 p-6">

      {showCart && <CartModal onClose={() => setShowCart(false)} />}

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md">

            <h2 className="text-2xl font-bold text-[#00572D] text-center dark:text-white">
              Connexion requise
            </h2>

            <p className="text-center text-gray-600 dark:text-gray-300 mt-2">
              Vous devez avoir un compte pour réserver.
            </p>

            <div className="mt-6 space-y-3">

              <button
                onClick={() => router.push("/login")}
                className="w-full bg-[#00572D] text-white p-3 rounded-xl"
              >
                Se connecter
              </button>

              <button
                onClick={() => router.push("/register")}
                className="w-full border border-[#00572D] text-[#00572D] dark:text-white p-3 rounded-xl"
              >
                Créer un compte
              </button>

              <button
                onClick={() => setShowAuthModal(false)}
                className="w-full bg-gray-200 dark:bg-gray-800 dark:text-white p-3 rounded-xl"
              >
                Fermer
              </button>

            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">

        {/* HEADER */}
        <div className="text-center mb-8">
          <img src="/logo.png" className="w-28 mx-auto" />
          <h1 className="text-3xl font-bold text-white mt-4">
            Rechercher un médicament
          </h1>
        </div>

        {/* SEARCH */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-3">

            <input
              className="flex-1 p-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-black dark:text-white"
              placeholder="Ex: Paracétamol"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
            />

            <button
              onClick={() => setShowCart(true)}
              className="relative bg-[#00572D] text-white px-4 py-3 rounded-xl"
            >
              🛒
              {count > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>

          </div>
        </div>

        {/* RESULTS */}
        <div className="mt-6 space-y-4">

          {results.length === 0 && query && (
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl text-center text-gray-700 dark:text-gray-300">
              Aucun résultat
            </div>
          )}

          {results.map((item, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-900 p-6 rounded-2xl"
            >

              {/* MEDICAMENT */}
              <h2 className="font-bold text-xl text-[#00572D] dark:text-green-400">
                💊 {item.medicines?.name || "Nom indisponible"}
              </h2>

              {/* DESCRIPTION (CORRIGÉE DARK MODE) */}
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                {item.medicines?.description || "Aucune description"}
              </p>

              {/* PHARMACIE */}
              <div
                onClick={() =>
                  item.pharmacies?.id &&
                  router.push(`/pharmacy/${item.pharmacies.id}`)
                }
                className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer hover:scale-[1.02] transition"
              >
                <p className="font-bold text-[#00572D] dark:text-green-400">
                  🏥 {item.pharmacies?.name || "Pharmacie inconnue"}
                </p>

                <p className="text-sm text-gray-600 dark:text-gray-300">
                  📍 {item.pharmacies?.city || ""} -{" "}
                  {item.pharmacies?.address || ""}
                </p>

                <p className="text-sm mt-1 text-gray-700 dark:text-gray-300">
                  {item.pharmacies?.is_open ? "🟢 Ouverte" : "🔴 Fermée"}
                </p>
              </div>

              {/* STOCK */}
              <div className="mt-3 text-gray-700 dark:text-gray-300">
                <p>
                  📦 Stock: <b>{item.quantity ?? 0}</b>
                </p>
                <p className="font-bold text-[#00572D] dark:text-green-400">
                  💰 {item.price ?? 0} FCFA
                </p>
              </div>

              {/* ACTIONS */}
              <div className="flex gap-3 mt-4">

                <button
                  onClick={() => addToCart(item)}
                  className="flex-1 bg-[#00572D] text-white p-3 rounded-xl"
                >
                  {isInCart(item.id)
                    ? "Dans le panier"
                    : "Ajouter au panier"}
                </button>

                <button
                  onClick={() => reserveNow(item)}
                  className="flex-1 bg-green-600 text-white p-3 rounded-xl"
                >
                  Réserver
                </button>

              </div>

            </div>
          ))}

        </div>
      </div>
    </main>
  );
}