"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProviderTemp";
import { useCart } from "@/components/CartContext";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useRouter } from "next/navigation";
import "leaflet/dist/leaflet.css";

function getMedicine(item: any): { name?: string; description?: string; image_url?: string } | null {
  if (!item.medicines) return null;
  if (Array.isArray(item.medicines)) return item.medicines[0] || null;
  return item.medicines;
}

function ImageModal({
  med, quantity, price, outOfStock, onClose,
}: {
  med: { name?: string; description?: string; image_url?: string } | null;
  quantity: number;
  price: number;
  outOfStock: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[99999] bg-black/90" onClick={onClose}>
      <button
        onClick={onClose}
        className="fixed top-3 right-3 text-white text-2xl font-bold bg-black/50 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/80 transition z-[100000]"
      >
        ✕
      </button>
      <div className="h-full overflow-y-auto px-4 py-6">
        <div className="max-w-xs mx-auto flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-full rounded-2xl overflow-hidden shadow-xl bg-black">
            {med?.image_url ? (
              <img src={med.image_url} alt={med?.name || "Médicament"} className="w-full object-contain max-h-[40vh]" />
            ) : (
              <div className="w-full h-44 bg-gray-800 flex items-center justify-center text-5xl">💊</div>
            )}
          </div>
          <div className="mt-3 w-full bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-xl">
            <h2 className="text-base font-bold text-[#00572D] dark:text-green-400 text-center leading-tight">
              💊 {med?.name || "Médicament"}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-xs mt-2 leading-relaxed whitespace-pre-line">
              {med?.description || "Aucune description disponible"}
            </p>
            <div className="flex items-center justify-between mt-3">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${outOfStock ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                📦 {outOfStock ? "Rupture" : `${quantity} stock`}
              </span>
              <span className="font-bold text-[#00572D] dark:text-green-400 text-sm">
                {(price ?? 0).toLocaleString()} FCFA
              </span>
            </div>
            <button onClick={onClose} className="mt-3 w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-bold text-xs">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PopupMedicineCard({
  item, pharmacy, onReserve,
}: {
  item: any;
  pharmacy: any;
  onReserve: (medicineId: string, pharmacyId: string) => void;
}) {
  const { addItem, isInCart, openCart } = useCart();
  const inCart = isInCart(item.id);
  const outOfStock = (item.quantity ?? 0) <= 0;
  const med = getMedicine(item);
  const [showImageModal, setShowImageModal] = useState(false);

  function handleCartClick() {
    if (inCart) { openCart(); return; }
    addItem({
      id: item.id,
      medicine_id: item.medicine_id,
      medicine_name: med?.name || "",
      medicine_image_url: med?.image_url || "",
      pharmacy_id: pharmacy.id,
      pharmacy_name: pharmacy.name || "",
      price: item.price,
      quantity: 1,
      quantity_available: item.quantity,
    });
  }

  return (
    <>
      {showImageModal && (
        <ImageModal med={med} quantity={item.quantity} price={item.price} outOfStock={outOfStock} onClose={() => setShowImageModal(false)} />
      )}

      <div className="relative rounded-2xl border border-gray-200 bg-white p-3 pt-9 shadow-sm">
        <div className="absolute -top-7 left-1/2 -translate-x-1/2">
          <div
            onClick={() => setShowImageModal(true)}
            className="w-14 h-14 rounded-full border-4 border-white shadow-md overflow-hidden bg-gray-100 cursor-pointer hover:scale-110 transition-transform duration-200"
            title="Voir en plein écran"
          >
            {med?.image_url ? (
              <img src={med.image_url} alt={med?.name || "Médicament"} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl">💊</div>
            )}
          </div>
        </div>

        <h4 className="text-center font-bold text-[#00572D] text-[13px] leading-tight break-words">
          {med?.name || "Médicament"}
        </h4>
        <p className="text-center text-gray-500 text-[11px] mt-1 leading-snug break-words line-clamp-2">
          {med?.description || "Aucune description disponible"}
        </p>

        <div className="flex items-center justify-between gap-2 mt-3">
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${outOfStock ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
            📦 {outOfStock ? "Rupture" : `${item.quantity} stock`}
          </span>
          <span className="font-bold text-[#00572D] text-[12px] whitespace-nowrap">
            {(item.price ?? 0).toLocaleString()} FCFA
          </span>
        </div>

        {!outOfStock ? (
          <div className="grid grid-cols-1 gap-2 mt-3">
            <button
              onClick={handleCartClick}
              className={`w-full py-2 rounded-xl font-bold text-[11px] border transition ${inCart ? "bg-[#00572D] text-white border-[#00572D]" : "bg-white text-[#00572D] border-[#00572D]"}`}
            >
              {inCart ? "✅ Voir le panier" : "🛒 Ajouter au panier"}
            </button>
            <button onClick={() => onReserve(item.medicine_id, pharmacy.id)} className="w-full bg-[#00572D] text-white py-2 rounded-xl font-bold text-[11px]">
              Réserver
            </button>
          </div>
        ) : (
          <div className="mt-3 w-full bg-gray-100 text-gray-400 py-2 rounded-xl font-bold text-[11px] text-center">
            Indisponible
          </div>
        )}
      </div>
    </>
  );
}

export default function Map() {
  const router = useRouter();
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);
  const { showToast } = useToast();

  // ✅ État livreur
  const [isDriver, setIsDriver] = useState(false);
  const [isDriverVerified, setIsDriverVerified] = useState(false);

  // ✅ Missions disponibles par pharmacie { pharmacy_id: count }
  const [missionsCount, setMissionsCount] = useState<Record<string, number>>({});

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
    checkDriver();
  }, []);

  async function checkDriver() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userData?.role !== "driver") return;
    setIsDriver(true);

    const { data: driverData } = await supabase
      .from("driver_profiles")
      .select("is_verified")
      .eq("user_id", user.id)
      .single();

    if (!driverData?.is_verified) return;
    setIsDriverVerified(true);

    // Charger les missions disponibles
    await loadMissionsCount();

    // Écouter en temps réel
    supabase
      .channel("map-driver-missions")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        loadMissionsCount();
      })
      .subscribe();
  }

  async function loadMissionsCount() {
    const { data } = await supabase
      .from("orders")
      .select("pharmacy_id")
      .eq("status", "ready")
      .is("driver_id", null);

    if (!data) return;

    const counts: Record<string, number> = {};
    for (const order of data) {
      counts[order.pharmacy_id] = (counts[order.pharmacy_id] || 0) + 1;
    }
    setMissionsCount(counts);
  }

  async function loadPharmacies() {
    const { data, error } = await supabase.from("pharmacies").select("*");
    if (error) { console.error("Erreur Supabase:", error.message); return; }
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
      .select(`id, quantity, price, medicine_id, pharmacy_id, medicines(name, description, image_url)`)
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
    if (!auth.user) { showToast("Veuillez vous connecter", "error"); return; }

    const { data: userData } = await supabase.from("users").select("role").eq("id", auth.user.id).single();
    if (!userData || userData.role !== "user") { showToast("Seuls les utilisateurs peuvent réserver", "error"); return; }

    const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", auth.user.id).single();

    const { error } = await supabase.from("reservations").insert({
      user_id: auth.user.id,
      pharmacy_id: pharmacyId,
      medicine_id: medicineId,
      customer_name: profile?.full_name || "",
      customer_phone: profile?.phone || "",
      status: "pending",
    });

    if (error) { showToast(error.message, "error"); return; }

    showToast("Réservation envoyée !");
    setSelectedPharmacyId(null);
    setStock([]);
  }

  if (!leafletReady) {
    return (
      <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-[#00572D] flex items-center justify-center bg-gray-100 dark:bg-gray-900" style={{ height: "80vh", width: "100%" }}>
        <p className="text-[#00572D] dark:text-green-400 font-bold">Chargement de la carte...</p>
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
          overflow: visible !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
          min-width: min(78vw, 280px) !important;
          max-width: min(88vw, 320px) !important;
          overflow: visible !important;
        }
        .leaflet-popup-close-button {
          top: 8px !important;
          right: 8px !important;
          z-index: 10 !important;
        }
      `}</style>

      <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-[#00572D]" style={{ height: "80vh", width: "100%" }}>
        <MapContainer center={[-1.2, 15.5]} zoom={6} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {pharmacies
            .filter((p) => p.latitude != null && p.longitude != null)
            .map((p) => {
              const missionCount = missionsCount[p.id] || 0;
              const showBadge = isDriverVerified && missionCount > 0;

              // ✅ Icône personnalisée avec badge rouge pour les livreurs
              const createIcon = () => {
                const L = require("leaflet");

                if (showBadge) {
                  return L.divIcon({
                    html: `
                      <div style="position:relative; display:inline-block;">
                        <div style="
                          width: 36px;
                          height: 36px;
                          background: #00572D;
                          border-radius: 50% 50% 50% 0;
                          transform: rotate(-45deg);
                          border: 3px solid white;
                          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        "></div>
                        <div style="
                          position: absolute;
                          top: 50%;
                          left: 50%;
                          transform: translate(-50%, -60%);
                          color: white;
                          font-size: 14px;
                          font-weight: bold;
                        ">🏥</div>
                        <div style="
                          position: absolute;
                          top: -8px;
                          right: -8px;
                          background: #ef4444;
                          color: white;
                          font-size: 10px;
                          font-weight: 900;
                          width: 20px;
                          height: 20px;
                          border-radius: 50%;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          border: 2px solid white;
                          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                          z-index: 10;
                        ">${missionCount > 9 ? "9+" : missionCount}</div>
                      </div>
                    `,
                    iconSize: [36, 36],
                    iconAnchor: [18, 36],
                    popupAnchor: [0, -40],
                    className: "",
                  });
                }

                // Icône normale
                return new L.Icon.Default();
              };

              return (
                <Marker
                  key={p.id}
                  position={[Number(p.latitude), Number(p.longitude)]}
                  icon={createIcon()}
                >
                  <Popup>
                    <div className="w-[min(82vw,300px)] p-3">
                      {/* En-tête pharmacie */}
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

                      {/* ✅ Badge missions pour livreurs */}
                      {showBadge && (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-2 text-center">
                          <p className="text-xs font-bold text-red-600 mb-1">
                            🏍️ {missionCount} mission{missionCount > 1 ? "s" : ""} disponible{missionCount > 1 ? "s" : ""}
                          </p>
                          <button
                            onClick={() => router.push(`/dashboard/driver?tab=missions&pharmacy=${p.id}`)}
                            className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-xl font-bold text-[11px] transition"
                          >
                            🚀 Voir les missions de cette pharmacie
                          </button>
                        </div>
                      )}

                      {/* Boutons pharmacie */}
                      <div className="mt-3 grid grid-cols-1 gap-2">
                        {/* ✅ Pour les non-livreurs : voir médicaments */}
                        {!isDriver && (
                          <button
                            onClick={() => openPharmacy(p.id)}
                            className="w-full bg-[#00572D] text-white py-2.5 rounded-xl font-bold text-[11px]"
                          >
                            {selectedPharmacyId === p.id ? "📦 Masquer les médicaments" : "💊 Voir les médicaments"}
                          </button>
                        )}

                        <a
                          href={`/pharmacy/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-center bg-white text-[#00572D] border border-[#00572D] py-2.5 rounded-xl font-bold text-[11px]"
                        >
                          Voir la pharmacie →
                        </a>
                      </div>

                      {/* Liste médicaments (uniquement non-livreurs) */}
                      {!isDriver && selectedPharmacyId === p.id && (
                        <div className="mt-4 border-t border-gray-200 pt-4">
                          <strong className="text-[#00572D] text-[12px] block mb-3">
                            💊 Médicaments disponibles
                          </strong>
                          {loadingStock && <p className="text-[11px] text-gray-500">Chargement...</p>}
                          {!loadingStock && stock.length === 0 && <p className="text-[11px] text-gray-500">Aucun médicament disponible</p>}
                          {!loadingStock && stock.length > 0 && (
                            <div className="max-h-[52vh] overflow-y-auto overflow-x-hidden pr-1 space-y-10 pt-8">
                              {stock.map((s) => (
                                <PopupMedicineCard key={s.id} item={s} pharmacy={p} onReserve={reserve} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
        </MapContainer>
      </div>
    </>
  );
}