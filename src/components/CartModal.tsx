"use client";

import { useState } from "react";
import { useCart } from "@/components/CartContext";
import { useToast } from "@/components/ToastProviderTemp";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface CartModalProps {
  onClose: () => void;
}

export default function CartModal({ onClose }: CartModalProps) {
  const { items, removeItem, clearCart } = useCart();
  const { showToast } = useToast();
  const router = useRouter();

  const [confirming, setConfirming] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const safeItems = items || [];

  const byPharmacy = safeItems.reduce((acc: any, item: any) => {
    if (!item?.pharmacy_id) return acc;

    if (!acc[item.pharmacy_id]) {
      acc[item.pharmacy_id] = {
        pharmacy_name: item.pharmacy_name,
        items: [],
      };
    }

    acc[item.pharmacy_id].items.push(item);
    return acc;
  }, {});

  const total = safeItems.reduce((sum: number, item: any) => {
    return sum + (item.price || 0);
  }, 0);

  async function getUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  }

  async function confirmReservations() {
    const user = await getUser();

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "user") {
      showToast("Accès refusé", "error");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single();

    setConfirming(true);

    let success = 0;
    let failed = 0;

    for (const item of safeItems) {
      const { error } = await supabase.from("reservations").insert({
        user_id: user.id,
        pharmacy_id: item.pharmacy_id,
        medicine_id: item.medicine_id,
        status: "pending",
        customer_name: profile?.full_name || "",
        customer_phone: profile?.phone || "",
      });

      if (error) failed++;
      else success++;
    }

    setConfirming(false);

    if (failed === 0) {
      showToast(`${success} réservation(s) envoyée(s)`);
      clearCart();
      onClose();
      router.push("/reservations");
    } else {
      showToast(`${success} OK / ${failed} erreurs`, "error");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-3 sm:px-6">

      {/* CART MODAL */}
      <div className="bg-white dark:bg-gray-900 dark:text-white w-[92%] sm:w-full sm:max-w-lg rounded-3xl shadow-2xl max-h-[85vh] flex flex-col">

        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold">
              🛒 Mon panier
            </h2>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              {safeItems.length} article(s)
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800"
          >
            ✕
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {safeItems.length === 0 && (
            <div className="text-center py-10">
              🛒
              <p>Panier vide</p>
            </div>
          )}

          {Object.entries(byPharmacy).map(([pharmacyId, group]: any) => (
            <div key={pharmacyId}>

              <p className="font-bold text-[#00572D] dark:text-green-400 mb-2">
                🏥 {group.pharmacy_name}
              </p>

              <div className="space-y-2 ml-4">
                {group.items.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl"
                  >
                    <div>
                      <p>
                        💊 {item.medicine_name}
                      </p>

                      <p className="font-bold text-[#00572D] dark:text-green-400">
                        {item.price.toLocaleString()} FCFA
                      </p>
                    </div>

                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition"
                    >
                      🗑
                    </button>

                  </div>
                ))}
              </div>

            </div>
          ))}

        </div>

        {/* FOOTER */}
        {safeItems.length > 0 && (
          <div className="p-4 border-t dark:border-gray-700">

            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{total.toLocaleString()} FCFA</span>
            </div>

            <button
              onClick={confirmReservations}
              disabled={confirming}
              className="w-full mt-3 bg-[#00572D] text-white p-3 rounded-xl"
            >
              {confirming ? "En cours..." : "Confirmer la réservation"}
            </button>

            <button
              onClick={clearCart}
              className="w-full mt-2 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl"
            >
              Vider le panier
            </button>

          </div>
        )}

      </div>

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50">

          <div className="bg-white dark:bg-gray-900 dark:text-white p-6 rounded-2xl w-full max-w-md text-center">

            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-yellow-400 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                !
              </div>
            </div>

            <h2 className="text-xl font-bold text-[#00572D] dark:text-green-400">
              Connexion requise
            </h2>

            <p className="text-gray-600 dark:text-gray-300 mt-3">
              Pour réserver des médicaments, vous devez avoir un compte utilisateur afin de gérer vos réservations.
            </p>

            <div className="mt-5 space-y-3">

              <button
                onClick={() => router.push("/login")}
                className="w-full bg-[#00572D] text-white p-3 rounded-xl"
              >
                Connexion
              </button>

              <button
                onClick={() => router.push("/register")}
                className="w-full border border-[#00572D] text-[#00572D] dark:text-green-400 dark:border-green-400 p-3 rounded-xl"
              >
                Inscription
              </button>

              <button
                onClick={() => setShowAuthModal(false)}
                className="w-full bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl"
              >
                Fermer
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}