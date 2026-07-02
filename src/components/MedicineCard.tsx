"use client";

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
    // addItem déclenche déjà l'ouverture du panier dans CartContext
    // mais on appelle openCart explicitement au cas où l'item était déjà dans le panier
  }

  function handleCartClick() {
    if (inCart) {
      // Si déjà dans le panier, ouvre le panier directement
      openCart();
    } else {
      // Sinon ajoute et le CartContext ouvre le panier automatiquement
      handleCart();
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-md overflow-hidden transition-all duration-200 border border-gray-100 dark:border-gray-800 hover:-translate-y-1 hover:shadow-xl">

      {/* IMAGE */}
      {item.medicines?.image_url && (
        <img src={item.medicines.image_url} alt={item.medicines?.name} className="w-full h-36 object-cover" />
      )}

      <div className="p-4">

        {/* PHARMACIE */}
        {showPharmacy && item.pharmacies?.name && (
          <div className="flex items-center gap-2 mb-3">
            {item.pharmacies?.logo_url && (
              <img src={item.pharmacies.logo_url} alt={item.pharmacies.name}
                className="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-gray-700" />
            )}
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              🏥 {item.pharmacies.name}
              {item.pharmacies.city ? ` · ${item.pharmacies.city}` : ""}
            </p>
          </div>
        )}

        {/* NOM */}
        <h3 className="font-bold text-[#00572D] dark:text-green-400 text-lg leading-snug">
          💊 {item.medicines?.name || "Médicament"}
        </h3>

        {/* DESCRIPTION */}
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 leading-relaxed line-clamp-2">
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
  );
}