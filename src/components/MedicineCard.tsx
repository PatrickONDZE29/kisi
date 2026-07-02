"use client";

import { useState } from "react";
import { useCart } from "@/components/CartContext";

interface MedicineCardProps {
  item: {
    id: string;
    medicine_id: string;
    pharmacy_id: string;
    quantity: number;
    price: number;
    medicines?: {
      name?: string;
      description?: string;
      image_url?: string;
    };
    pharmacies?: {
      name?: string;
      city?: string;
      logo_url?: string;
    };
  };
  onReserve?: (item: any) => void;
  showPharmacy?: boolean;
}

export default function MedicineCard({
  item,
  onReserve,
  showPharmacy = false,
}: MedicineCardProps) {
  const { addItem, removeItem, isInCart, openCart } = useCart();
  const inCart = isInCart(item.id);
  const outOfStock = (item.quantity ?? 0) <= 0;
  const [showImageModal, setShowImageModal] = useState(false);

  function handleCart() {
    if (inCart) {
      removeItem(item.id);
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
  }

  function handleCartClick() {
    if (inCart) {
      openCart();
    } else {
      handleCart();
    }
  }

  return (
    <>
      {/* MODAL PLEIN ÉCRAN IMAGE */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-[99999] bg-black/90 flex flex-col items-center justify-center p-6"
          onClick={() => setShowImageModal(false)}
        >
          {/* Bouton fermer */}
          <button
            onClick={() => setShowImageModal(false)}
            className="absolute top-5 right-5 text-white text-3xl font-bold bg-black/50 w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/80 transition"
          >
            ✕
          </button>

          {/* Image grande */}
          <div
            className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {item.medicines?.image_url ? (
              <img
                src={item.medicines.image_url}
                alt={item.medicines?.name || "Médicament"}
                className="w-full object-contain max-h-[60vh]"
              />
            ) : (
              <div className="w-full h-64 bg-gray-800 flex items-center justify-center text-7xl rounded-3xl">
                💊
              </div>
            )}
          </div>

          {/* Nom + description sous l'image */}
          <div
            className="mt-5 w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-5 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-[#00572D] dark:text-green-400">
              💊 {item.medicines?.name || "Médicament"}
            </h2>

            <p className="text-gray-600 dark:text-gray-300 text-sm mt-3 leading-relaxed">
              {item.medicines?.description || "Aucune description disponible"}
            </p>

            <div className="flex items-center justify-between mt-4">
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                outOfStock
                  ? "bg-red-100 text-red-600"
                  : "bg-green-100 text-green-700"
              }`}>
                📦 {outOfStock ? "Rupture" : `${item.quantity} en stock`}
              </span>
              <span className="font-bold text-[#00572D] dark:text-green-400 text-lg">
                {(item.price ?? 0).toLocaleString()} FCFA
              </span>
            </div>

            <button
              onClick={() => setShowImageModal(false)}
              className="mt-4 w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-2.5 rounded-xl font-bold text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* CARTE */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-md border border-gray-100 dark:border-gray-800 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 pt-14 mt-10 relative">

        {/* IMAGE EN CERCLE — cliquable pour voir en plein écran */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2">
          <div
            onClick={() => setShowImageModal(true)}
            className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-900 shadow-lg overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer hover:scale-110 transition-transform duration-200"
            title="Voir en plein écran"
          >
            {item.medicines?.image_url ? (
              <img
                src={item.medicines.image_url}
                alt={item.medicines?.name || "Médicament"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">
                💊
              </div>
            )}
          </div>
        </div>

        <div className="p-4">

          {/* PHARMACIE */}
          {showPharmacy && item.pharmacies?.name && (
            <div className="flex items-center gap-2 mb-3">
              {item.pharmacies?.logo_url && (
                <img
                  src={item.pharmacies.logo_url}
                  alt={item.pharmacies.name}
                  className="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                />
              )}
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                🏥 {item.pharmacies.name}
                {item.pharmacies.city ? ` · ${item.pharmacies.city}` : ""}
              </p>
            </div>
          )}

          {/* NOM */}
          <h3 className="font-bold text-[#00572D] dark:text-green-400 text-lg leading-snug text-center">
            {item.medicines?.name || "Médicament"}
          </h3>

          {/* DESCRIPTION */}
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 leading-relaxed line-clamp-2 text-center">
            {item.medicines?.description || "Aucune description disponible"}
          </p>

          {/* STOCK + PRIX */}
          <div className="flex items-center justify-between mt-3">
            <span className={`text-sm font-medium px-2 py-1 rounded-full ${
              outOfStock
                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            }`}>
              📦 {outOfStock ? "Rupture" : `${item.quantity} en stock`}
            </span>
            <span className="font-bold text-[#00572D] dark:text-green-400 text-lg">
              {(item.price ?? 0).toLocaleString()} FCFA
            </span>
          </div>

          {/* ACTIONS */}
          {!outOfStock ? (
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCartClick}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 border-2 ${
                  inCart
                    ? "bg-[#00572D] text-white border-[#00572D]"
                    : "bg-white dark:bg-gray-800 text-[#00572D] dark:text-green-400 border-[#00572D] dark:border-green-500"
                }`}
              >
                {inCart ? "✅ Voir le panier" : "🛒 Ajouter au panier"}
              </button>

              {onReserve && (
                <button
                  onClick={() => onReserve(item)}
                  className="flex-1 bg-[#00572D] dark:bg-green-700 text-white py-2.5 rounded-xl font-bold text-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
                >
                  Réserver
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 w-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 py-2.5 rounded-xl font-bold text-sm text-center">
              Indisponible
            </div>
          )}

        </div>
      </div>
    </>
  );
}