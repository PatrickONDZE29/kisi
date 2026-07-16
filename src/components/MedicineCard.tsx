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
  const { addItem, removeItem, isInCart, openCart, updateQuantity, items } =
    useCart();
  const inCart = isInCart(item.id);
  const outOfStock = (item.quantity ?? 0) <= 0;
  const [showImageModal, setShowImageModal] = useState(false);

  const cartItem = items.find((i) => i.id === item.id);
  const cartQuantity = cartItem?.quantity || 1;

  function handleCart() {
    if (inCart) {
      removeItem(item.id);
      return;
    }
    addItem({
      id: item.id,
      medicine_id: item.medicine_id,
      medicine_name: item.medicines?.name || "",
      medicine_image_url: item.medicines?.image_url || "",
      pharmacy_id: item.pharmacy_id,
      pharmacy_name: item.pharmacies?.name || "",
      price: item.price,
      quantity: 1,
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
      {/* MODAL IMAGE PLEIN ÉCRAN */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-[99999] bg-black/90"
          onClick={() => setShowImageModal(false)}
        >
          <button
            onClick={() => setShowImageModal(false)}
            className="fixed top-3 right-3 text-white text-2xl font-bold bg-black/50 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/80 transition z-[100000]"
          >
            ✕
          </button>

          <div className="h-full overflow-y-auto px-4 py-6">
            <div
              className="max-w-xs mx-auto flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full rounded-2xl overflow-hidden shadow-xl bg-black">
                {item.medicines?.image_url ? (
                  <img
                    src={item.medicines.image_url}
                    alt={item.medicines?.name || "Médicament"}
                    className="w-full object-contain max-h-[40vh]"
                  />
                ) : (
                  <div className="w-full h-44 bg-gray-800 flex items-center justify-center text-5xl">
                    💊
                  </div>
                )}
              </div>

              <div className="mt-3 w-full bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-xl">
                <h2 className="text-base font-bold text-[#00572D] dark:text-green-400 text-center leading-tight">
                  💊 {item.medicines?.name || "Médicament"}
                </h2>

                <p className="text-gray-600 dark:text-gray-300 text-xs mt-2 leading-relaxed whitespace-pre-line">
                  {item.medicines?.description ||
                    "Aucune description disponible"}
                </p>

                <div className="flex items-center justify-between mt-3">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      outOfStock
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    📦 {outOfStock ? "Rupture" : `${item.quantity} stock`}
                  </span>
                  <span className="font-bold text-[#00572D] dark:text-green-400 text-sm">
                    {(item.price ?? 0).toLocaleString()} FCFA
                  </span>
                </div>

                <button
                  onClick={() => setShowImageModal(false)}
                  className="mt-3 w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-bold text-xs"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CARTE */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-md border border-gray-100 dark:border-gray-800 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 pt-14 mt-10 relative">

        {/* IMAGE EN CERCLE */}
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
            <span
              className={`text-sm font-medium px-2 py-1 rounded-full ${
                outOfStock
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              }`}
            >
              📦 {outOfStock ? "Rupture" : `${item.quantity} en stock`}
            </span>
            <span className="font-bold text-[#00572D] dark:text-green-400 text-lg">
              {(item.price ?? 0).toLocaleString()} FCFA
            </span>
          </div>

          {/* QUANTITÉ si dans le panier */}
          {inCart && cartItem && (
            <div className="flex items-center justify-center gap-4 mt-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-2">
              <button
                onClick={() =>
                  updateQuantity(item.id, cartItem.quantity - 1)
                }
                disabled={cartItem.quantity <= 1}
                className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 shadow flex items-center justify-center font-bold text-lg disabled:opacity-40"
              >
                −
              </button>
              <span className="font-bold text-[#00572D] dark:text-green-400 text-lg w-6 text-center">
                {cartItem.quantity}
              </span>
              <button
                onClick={() =>
                  updateQuantity(item.id, cartItem.quantity + 1)
                }
                disabled={cartItem.quantity >= item.quantity}
                className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 shadow flex items-center justify-center font-bold text-lg disabled:opacity-40"
              >
                +
              </button>
            </div>
          )}

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