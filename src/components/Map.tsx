"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProviderTemp";
import { useCart } from "@/components/CartContext";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Pharmacy {
  [key: string]: any;
  id: string;
}

// ✅ medicines est un TABLEAU (retour Supabase)
interface StockItem {
  [key: string]: any;
  id: string;
  quantity: number;
  price: number;
  medicine_id: string;
  pharmacy_id?: string;
  medicines?: {
    name?: string;
    description?: string;
    image_url?: string;
  }[];
}

function PopupMedicineCard({
  item,
  pharmacy,
  onReserve,
}: {
  item: StockItem;
  pharmacy: Pharmacy;
  onReserve: (medicineId: string, pharmacyId: string) => void;
}) {
  const { addItem, isInCart, openCart } = useCart();
  const inCart = isInCart(item.id);
  const outOfStock = (item.quantity ?? 0) <= 0;

  // ✅ Prend le premier élément du tableau medicines
  const med = item.medicines?.[0];

  function handleCartClick() {
    if (inCart) {
      openCart();
      return;
    }

    addItem({
      id: item.id,
      medicine_id: item.medicine_id,
      medicine_name: med?.name || "",
      pharmacy_id: pharmacy.id,
      pharmacy_name: pharmacy.name || "",
      price: item.price,
      quantity_available: item.quantity,
    });
  }

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white p-3 pt-9 shadow-sm">
      {/* Image ronde */}
      <div className="absolute -top-7 left-1/2 -translate-x-1/2">
        <div className="w-14 h-14 rounded-full border-4 border-white shadow-md overflow-hidden bg-gray-100">
          {med?.image_url ? (
            <img
              src={med.image_url}
              alt={med?.name || "Médicament"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl">
              💊
            </div>
          )}
        </div>
      </div>

      {/* Nom */}
      <h4 className="text-center font-bold text-[#00572D] text-[13px] leading-tight break-words">
        {med?.name || "Médicament"}
      </h4>

      {/* Description */}
      <p className="text-center text-gray-500 text-[11px] mt-1 leading-snug break-words line-clamp-2">
        {med?.description || "Aucune description disponible"}
      </p>

      {/* Stock + prix */}
      <div className="flex items-center justify-between gap-2 mt-3">
        <span
          className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
            outOfStock
              ? "bg-red-100 text-red-600"
              : "bg-green-100 text-green-700"
          }`}
        >
          📦 {outOfStock ? "Rupture" : `${item.quantity} stock`}
        </span>

        <span className="font-bold text-[#00572D] text-[12px] whitespace-nowrap">
          {(item.price ?? 0).toLocaleString()} FCFA
        </span>
      </div>

      {/* Actions */}
      {!outOfStock ? (
        <div className="grid grid-cols-1 gap-2 mt-3">
          <button
            onClick={handleCartClick}
            className={`w-full py-2 rounded-xl font-bold text-[11px] border transition ${
              inCart
                ? "bg-[#00572D] text-white border-[#00572D]"
                : "bg-white text-[#00572D] border-[#00572D]"
            }`}
          >
            {inCart ? "✅ Voir le panier" : "🛒 Ajouter au panier"}
          </button>

          <button
            onClick={() => onReserve(item.medicine_id, pharmacy.id)}
            className="w-full bg-[#00572D] text-white py-2 rounded-xl font-bold text-[11px]"
          >
            Réserver
          </button>
        </div>
      ) : (
        <div className="mt-3 w-full bg-gray-100 text-gray-400 py-2 rounded-xl font-bold text-[11px] text-center">
          Indisponible
        </div>
      )}
    </div>
  );
}

export default function Map() {
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const L = require("leaflet");

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    setLeafletReady(true);
    loadPharmacies();
  }, []);

  async function loadPharmacies() {
    const { data, error } = await supabase.from("pharmacies").select("*");
    if (error) {
      console.error("Erreur Supabase:", error.message);
      return;
    }
    setPharmacies(data || []);
  }

  async function openPharmacy(pharmacyId: string) {
    if (selectedPharmacyId === pharmacyId) {
      setSelectedPharmacyId(null);
      setStock([]);
      return;
    }

    setSelectedPharmacyId(pharmacyId);
    setLoadingStock(true);

    const { data, error } = await supabase
      .from("stock")
      .select(`
        id,
        quantity,
        price,
        medicine_id,
        pharmacy_id,
        medicines(name, description, image_url)
      `)
      .eq("pharmacy_id", pharmacyId);

    if (error) {
      setLoadingStock(false);
      showToast("Erreur lors du chargement des médicaments", "error");
      return;
    }

    setStock(data || []);
    setLoadingStock(false);
  }

  async function reserve(medicineId: string, pharmacyId: string) {
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      showToast("Veuillez vous connecter", "error");
      return;
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (!userData || userData.role !== "user") {
      showToast("Seuls les utilisateurs peuvent réserver", "error");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", auth.user.id)
      .single();

    const { error } = await supabase.from("reservations").insert({
      user_id: auth.user.id,
      pharmacy_id: pharmacyId,
      medicine_id: medicineId,
      customer_name: profile?.full_name || "",
      customer_phone: profile?.phone || "",
      status: "pending",
    });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Réservation envoyée !");
    openPharmacy(pharmacyId);
    openPharmacy(pharmacyId);
  }

  if (!leafletReady) {
    return (
      <div
        className="rounded-3xl overflow-hidden shadow-xl border-4 border-[#00572D] flex items-center justify-center bg-gray-100 dark:bg-gray-900"
        style={{ height: "80vh", width: "100%" }}
      >
        <p className="text-[#00572D] dark:text-green-400 font-bold">
          Chargement de la carte...
        </p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .leaflet-popup-content-wrapper {
          border-radius: 18px !important;
          box-shadow: 0 8px 30px rgba(0,0,0,0.18) !important;
          padding: 0 !important;
          overflow: hidden !important;
        }

        .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
          min-width: min(78vw, 280px) !important;
          max-width: min(88vw, 320px) !important;
        }

        .leaflet-popup-close-button {
          top: 8px !important;
          right: 8px !important;
          z-index: 10 !important;
        }
      `}</style>

      <div
        className="rounded-3xl overflow-hidden shadow-xl border-4 border-[#00572D]"
        style={{ height: "80vh", width: "100%" }}
      >
        <MapContainer
          center={[-1.2, 15.5]}
          zoom={6}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="© OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {pharmacies
            .filter((p) => p.latitude != null && p.longitude != null)
            .map((p) => (
              <Marker
                key={p.id}
                position={[Number(p.latitude), Number(p.longitude)]}
              >
                <Popup>
                  <div className="w-[min(82vw,300px)] p-3">
                    {/* Entête pharmacie */}
                    <div className="text-center">
                      <img
                        src={p.logo_url || "/pharmacie.png"}
                        alt={p.name || "Pharmacie"}
                        className="w-14 h-14 object-cover rounded-full border-2 border-[#00572D] mx-auto"
                      />

                      <strong className="text-[#00572D] text-sm block mt-2 break-words leading-tight">
                        🏥 {p.name}
                      </strong>

                      <div className="text-[11px] text-gray-600 mt-2 space-y-1 leading-snug">
                        {p.city && <p>📍 {p.city}</p>}
                        {p.phone && <p>📞 {p.phone}</p>}
                        {p.opening_hours && <p>🕒 {p.opening_hours}</p>}
                        <p className={`font-bold ${p.is_open ? "text-green-700" : "text-red-600"}`}>
                          {p.is_open ? "🟢 Ouverte" : "🔴 Fermée"}
                        </p>
                      </div>
                    </div>

                    {/* Boutons pharmacie */}
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <button
                        onClick={() => openPharmacy(p.id)}
                        className="w-full bg-[#00572D] text-white py-2.5 rounded-xl font-bold text-[11px]"
                      >
                        {selectedPharmacyId === p.id
                          ? "📦 Masquer les médicaments"
                          : "💊 Voir les médicaments"}
                      </button>

                      <a
                        href={`/pharmacy/${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center bg-white text-[#00572D] border border-[#00572D] py-2.5 rounded-xl font-bold text-[11px]"
                      >
                        Voir la pharmacie →
                      </a>
                    </div>

                    {/* Liste médicaments */}
                    {selectedPharmacyId === p.id && (
                      <div className="mt-4 border-t border-gray-200 pt-4">
                        <strong className="text-[#00572D] text-[12px] block mb-3">
                          💊 Médicaments disponibles
                        </strong>

                        {loadingStock && (
                          <p className="text-[11px] text-gray-500">
                            Chargement...
                          </p>
                        )}

                        {!loadingStock && stock.length === 0 && (
                          <p className="text-[11px] text-gray-500">
                            Aucun médicament disponible
                          </p>
                        )}

                        {!loadingStock && stock.length > 0 && (
                          <div className="max-h-[52vh] overflow-y-auto pr-1 space-y-10">
                            {stock.map((s) => (
                              <PopupMedicineCard
                                key={s.id}
                                item={s}
                                pharmacy={p}
                                onReserve={reserve}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>
    </>
  );
}