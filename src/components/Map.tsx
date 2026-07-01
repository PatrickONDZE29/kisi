"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProviderTemp";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function Map() {
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
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
    if (error) { console.error("Erreur Supabase:", error.message); return; }
    setPharmacies(data || []);
  }

  async function openPharmacy(pharmacyId: string) {
    setSelectedPharmacyId(pharmacyId);
    setLoadingStock(true);
    const { data, error } = await supabase
      .from("stock")
      .select(`id, quantity, price, medicine_id, medicines(name)`)
      .eq("pharmacy_id", pharmacyId);
    if (error) { console.error("Stock error:", error.message); setLoadingStock(false); return; }
    setStock(data || []);
    setLoadingStock(false);
  }

  async function reserve(medicineId: string, pharmacyId: string) {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;

    if (!user) { showToast("Veuillez vous connecter", "error"); return; }

    const { data: userData } = await supabase
      .from("users").select("role").eq("id", user.id).single();
    if (!userData || userData.role !== "user") {
      showToast("Seuls les utilisateurs peuvent réserver", "error");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles").select("full_name, phone").eq("id", user.id).single();

    const { error } = await supabase.from("reservations").insert({
      user_id: user.id,
      pharmacy_id: pharmacyId,
      medicine_id: medicineId,
      customer_name: profile?.full_name || "",
      customer_phone: profile?.phone || "",
      status: "pending",
    });

    if (error) { showToast(error.message, "error"); return; }
    showToast("Réservation envoyée avec succès !");
    openPharmacy(pharmacyId);
  }

  if (!leafletReady) {
    return (
      <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-[#00572D] flex items-center justify-center bg-gray-100 dark:bg-gray-900"
        style={{ height: "80vh", width: "100%" }}>
        <p className="text-[#00572D] dark:text-green-400 font-bold">Chargement de la carte...</p>
      </div>
    );
  }

  return (
    <>
      {/* Réduction du popup Leaflet pour mobile */}
      <style>{`
        .leaflet-popup-content-wrapper {
          border-radius: 14px !important;
          box-shadow: 0 4px 24px rgba(0,0,0,0.15) !important;
          padding: 0 !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
          max-width: min(80vw, 240px) !important;
        }
      `}</style>

      <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-[#00572D]"
        style={{ height: "80vh", width: "100%" }}>
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
              <Marker key={p.id} position={[Number(p.latitude), Number(p.longitude)]}>
                <Popup>
                  <div style={{ padding: "10px", fontFamily: "Arial, sans-serif" }}>

                    {/* LOGO + NOM */}
                    <div style={{ textAlign: "center", marginBottom: "8px" }}>
                      <img
                        src={p.logo_url || "/pharmacie.png"}
                        alt={p.name}
                        style={{
                          width: "48px", height: "48px",
                          objectFit: "cover", borderRadius: "50%",
                          border: "2px solid #00572D",
                          margin: "0 auto", display: "block",
                        }}
                      />
                      <strong style={{ color: "#00572D", fontSize: "12px", display: "block", marginTop: "5px" }}>
                        🏥 {p.name}
                      </strong>
                    </div>

                    {/* INFOS */}
                    <div style={{ fontSize: "10px", color: "#555", lineHeight: "1.6" }}>
                      {p.city && <p style={{ margin: "1px 0" }}>📍 {p.city}</p>}
                      {p.phone && <p style={{ margin: "1px 0" }}>📞 {p.phone}</p>}
                      {p.opening_hours && <p style={{ margin: "1px 0" }}>🕒 {p.opening_hours}</p>}
                      <p style={{ margin: "3px 0", fontWeight: "bold", color: p.is_open ? "#00572D" : "#dc2626" }}>
                        {p.is_open ? "🟢 Ouverte" : "🔴 Fermée"}
                      </p>
                    </div>

                    {/* BOUTONS */}
                    <button
                      onClick={() => openPharmacy(p.id)}
                      style={{
                        width: "100%", background: "#00572D", color: "white",
                        padding: "6px", borderRadius: "8px", border: "none",
                        marginTop: "6px", cursor: "pointer",
                        fontWeight: "bold", fontSize: "10px",
                      }}
                    >
                      💊 Voir les médicaments
                    </button>

                    <a
                      href={`/pharmacy/${p.id}`}
                      target="_blank"
                      style={{
                        display: "block", textAlign: "center", marginTop: "5px",
                        background: "#fff", color: "#00572D",
                        border: "1.5px solid #00572D", padding: "6px",
                        borderRadius: "8px", textDecoration: "none",
                        fontWeight: "bold", fontSize: "10px",
                      }}
                    >
                      Voir la pharmacie →
                    </a>

                    {/* MÉDICAMENTS */}
                    {selectedPharmacyId === p.id && (
                      <div style={{ marginTop: "8px" }}>
                        <hr style={{ margin: "6px 0", borderColor: "#e5e7eb" }} />
                        <strong style={{ color: "#00572D", fontSize: "10px" }}>
                          💊 Médicaments disponibles
                        </strong>

                        {loadingStock && (
                          <p style={{ fontSize: "10px", color: "#888", marginTop: "4px" }}>Chargement...</p>
                        )}

                        {!loadingStock && stock.length === 0 && (
                          <p style={{ fontSize: "10px", color: "#888", marginTop: "4px" }}>Aucun médicament</p>
                        )}

                        {stock.map((s) => (
                          <div key={s.id} style={{
                            marginTop: "6px", padding: "6px",
                            background: "#f9fafb", borderRadius: "8px",
                            border: "1px solid #e5e7eb",
                          }}>
                            <strong style={{ fontSize: "10px" }}>{s.medicines?.name}</strong>
                            <p style={{ fontSize: "9px", color: "#555", margin: "2px 0" }}>
                              📦 {s.quantity} · 💰 {s.price} FCFA
                            </p>
                            <button
                              disabled={s.quantity <= 0}
                              onClick={() => reserve(s.medicine_id, p.id)}
                              style={{
                                width: "100%", marginTop: "4px",
                                background: s.quantity <= 0 ? "#9ca3af" : "#00572D",
                                color: "white", padding: "5px", border: "none",
                                borderRadius: "6px", fontSize: "9px",
                                cursor: s.quantity <= 0 ? "not-allowed" : "pointer",
                                fontWeight: "bold",
                              }}
                            >
                              {s.quantity <= 0 ? "Indisponible" : "Réserver"}
                            </button>
                          </div>
                        ))}
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