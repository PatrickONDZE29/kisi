"use client";

import { useState } from "react";
import { useCart } from "@/components/CartContext";
import { useToast } from "@/components/ToastProviderTemp";
import { useRouter } from "next/navigation";

interface CartModalProps {
  onClose: () => void;
}

export default function CartModal({ onClose }: CartModalProps) {
  const { items, removeItem, updateQuantity, clearCart, totalAmount } =
    useCart();
  const { showToast } = useToast();
  const router = useRouter();

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

  function handleCheckout() {
    if (safeItems.length === 0) return;
    onClose();
    router.push("/checkout");
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-3 sm:px-6">
      <div className="bg-white dark:bg-gray-900 dark:text-white w-[92%] sm:w-full sm:max-w-lg rounded-3xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold">🛒 Mon panier</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {safeItems.length} article(s)
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            ✕
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {safeItems.length === 0 && (
            <div className="text-center py-10">
              <div className="text-4xl mb-2">🛒</div>
              <p className="text-gray-500">Votre panier est vide</p>
            </div>
          )}

          {safeItems.length > 0 && (
            <div className="space-y-4">
              {Object.entries(byPharmacy).map(
                ([pharmacyId, group]: any) => {
                  const pharmacySubtotal = group.items.reduce(
                    (sum: number, item: any) =>
                      sum + item.price * item.quantity,
                    0
                  );

                  return (
                    <div
                      key={pharmacyId}
                      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 shadow-sm"
                    >
                      {/* Header pharmacie */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <p className="font-bold text-[#00572D] dark:text-green-400">
                            🏥 {group.pharmacy_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {group.items.length} article(s)
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Sous-total
                          </p>
                          <p className="font-bold text-[#00572D] dark:text-green-400 text-sm">
                            {pharmacySubtotal.toLocaleString()} FCFA
                          </p>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-3">
                        {group.items.map((item: any) => (
                          <div
                            key={item.id}
                            className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm">
                                  💊 {item.medicine_name}
                                </p>
                                <p className="font-bold text-[#00572D] dark:text-green-400 text-sm mt-1">
                                  {(
                                    item.price * item.quantity
                                  ).toLocaleString()}{" "}
                                  FCFA
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {item.price.toLocaleString()} FCFA / unité
                                </p>
                              </div>

                              <button
                                onClick={() => removeItem(item.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition shrink-0"
                              >
                                🗑
                              </button>
                            </div>

                            {/* Quantité */}
                            <div className="flex items-center gap-3 mt-3">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Quantité :
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      item.quantity - 1
                                    )
                                  }
                                  disabled={item.quantity <= 1}
                                  className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-sm disabled:opacity-40 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                                >
                                  −
                                </button>
                                <span className="w-6 text-center font-bold text-sm">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      item.quantity + 1
                                    )
                                  }
                                  disabled={
                                    item.quantity >= item.quantity_available
                                  }
                                  className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-sm disabled:opacity-40 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                                >
                                  +
                                </button>
                              </div>
                              <p className="text-xs text-gray-400 ml-auto">
                                Stock : {item.quantity_available}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        {safeItems.length > 0 && (
          <div className="p-4 border-t dark:border-gray-700 space-y-3">
            <div className="flex justify-between font-bold text-lg">
              <span>Total médicaments</span>
              <span className="text-[#00572D] dark:text-green-400">
                {totalAmount.toLocaleString()} FCFA
              </span>
            </div>

            <p className="text-xs text-gray-400 text-center">
              + frais de livraison calculés au checkout
            </p>

            <button
              onClick={handleCheckout}
              className="w-full bg-[#00572D] text-white p-3.5 rounded-xl font-bold text-sm hover:bg-green-800 transition"
            >
              💳 Passer au paiement
            </button>

            <button
              onClick={() => {
                clearCart();
                onClose();
              }}
              className="w-full bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl text-sm font-medium"
            >
              Vider le panier
            </button>
          </div>
        )}
      </div>
    </div>
  );
}