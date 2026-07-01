"use client";

import { useCart } from "@/components/CartContext";

interface MedicineCardProps {
  item: any;
  onReserve?: (item: any) => void;
}

export default function MedicineCard({ item, onReserve }: MedicineCardProps) {
  const { addItem, removeItem, isInCart } = useCart();

  function handleCart() {
    if (isInCart(item.id)) {
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

  return (
    <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-md">

      {/* NOM */}
      <h3 className="font-bold text-[#00572D] dark:text-green-400 text-lg">
        💊 {item.medicines?.name}
      </h3>

      {/* DESCRIPTION */}
      <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
        📝 {item.medicines?.description || "Aucune description disponible"}
      </p>

      {/* STOCK */}
      <p className="mt-2 text-gray-700 dark:text-gray-300">
        📦 Stock : <b>{item.quantity ?? 0}</b>
      </p>

      {/* PRIX */}
      <p className="font-bold text-[#00572D] dark:text-green-400 mt-1">
        💰 {item.price ?? 0} FCFA
      </p>

      {/* ACTIONS */}
      <div className="flex gap-3 mt-4">

        <button
          onClick={handleCart}
          className="flex-1 bg-[#00572D] text-white p-2 rounded-xl"
        >
          {isInCart(item.id) ? "Retirer" : "Ajouter"}
        </button>

        {onReserve && (
          <button
            onClick={() => onReserve(item)}
            className="flex-1 bg-green-600 text-white p-2 rounded-xl"
          >
            Réserver
          </button>
        )}

      </div>

    </div>
  );
}