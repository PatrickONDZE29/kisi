"use client";

import { use, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATUS_CONFIG: Record<string, { label: string; emoji: string }> = {
  picked_up: { label: "Commande récupérée", emoji: "📬" },
  on_the_way: { label: "En route vers vous", emoji: "🚀" },
  driver_arrived: { label: "Le livreur est arrivé", emoji: "📍" },
  delivered: { label: "Livraison effectuée", emoji: "🎉" },
};

function getStatusInfo(status: string) {
  return STATUS_CONFIG[status] || { label: status, emoji: "❓" };
}

export default function TrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [address, setAddress] = useState<any>(null);
  const [pharmacy, setPharmacy] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState<string>("");
  const [estimatedDistance, setEstimatedDistance] = useState<string>("");

  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const driverMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const pharmacyMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);

  useEffect(() => {
    loadOrder();
  }, [id]);

  useEffect(() => {
    if (!order || !driver) return;

    // Écouter la position du livreur en temps réel
    const channel = supabase
      .channel(`driver-location-${driver.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_locations",
          filter: `driver_id=eq.${driver.id}`,
        },
        (payload: any) => {
          const newLoc = payload.new;
          if (newLoc && newLoc.latitude && newLoc.longitude) {
            setDriverLocation(newLoc);
            updateDriverMarker(newLoc);
          }
        }
      )
      .subscribe();

    // Écouter les changements de statut de la commande
    const orderChannel = supabase
      .channel(`order-status-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${id}`,
        },
        (payload: any) => {
          setOrder(payload.new);
          if (payload.new.status === "delivered") {
            setTimeout(() => router.push("/orders"), 3000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(orderChannel);
    };
  }, [order, driver]);

  useEffect(() => {
    if (!loading && order && driverLocation) {
      initMap();
    }
  }, [loading, order, driverLocation]);

  async function loadOrder() {
    const { data: orderData, error } = await supabase
      .from("orders")
      .select("*, pharmacies(name, city, logo_url, latitude, longitude, phone)")
      .eq("id", id)
      .single();

    if (error || !orderData) {
      router.push("/orders");
      return;
    }

    setOrder(orderData);
    setPharmacy(orderData.pharmacies);

    // Charger l'adresse
    if (orderData.address_id) {
      const { data: addr } = await supabase
        .from("addresses")
        .select("*")
        .eq("id", orderData.address_id)
        .single();

      setAddress(addr);
    }

    // Charger le livreur
    if (orderData.driver_id) {
      const { data: driverData } = await supabase
        .from("driver_profiles")
        .select("*")
        .eq("id", orderData.driver_id)
        .single();

      setDriver(driverData);

      // Charger la position actuelle
      const { data: locData } = await supabase
        .from("driver_locations")
        .select("*")
        .eq("driver_id", orderData.driver_id)
        .single();

      if (locData) {
        setDriverLocation(locData);
      }
    }

    setLoading(false);
  }

  function initMap() {
    if (mapReady || !mapContainerRef.current) return;
    if (!driverLocation?.latitude || !driverLocation?.longitude) return;

    const L = require("leaflet");

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const driverLat = Number(driverLocation.latitude);
    const driverLng = Number(driverLocation.longitude);

    const map = L.map(mapContainerRef.current).setView([driverLat, driverLng], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    mapRef.current = map;

    // Icône livreur personnalisée
    const driverIcon = L.divIcon({
      html: `<div style="background:#00572D;color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">🏍️</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      className: "",
    });

    // Marqueur livreur
    driverMarkerRef.current = L.marker([driverLat, driverLng], { icon: driverIcon })
      .addTo(map)
      .bindPopup("🏍️ Votre livreur");

    // Marqueur destination (client)
    if (address?.latitude && address?.longitude) {
      const destIcon = L.divIcon({
        html: `<div style="background:#dc2626;color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">🏠</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        className: "",
      });

      destinationMarkerRef.current = L.marker(
        [Number(address.latitude), Number(address.longitude)],
        { icon: destIcon }
      )
        .addTo(map)
        .bindPopup("🏠 Votre adresse");

      // Tracer la ligne
      drawRoute(
        L,
        map,
        [driverLat, driverLng],
        [Number(address.latitude), Number(address.longitude)]
      );

      // Ajuster la vue
      const bounds = L.latLngBounds([
        [driverLat, driverLng],
        [Number(address.latitude), Number(address.longitude)],
      ]);

      map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Marqueur pharmacie
    if (pharmacy?.latitude && pharmacy?.longitude) {
      const pharmaIcon = L.divIcon({
        html: `<div style="background:#2563eb;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.2);">🏥</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        className: "",
      });

      pharmacyMarkerRef.current = L.marker(
        [Number(pharmacy.latitude), Number(pharmacy.longitude)],
        { icon: pharmaIcon }
      )
        .addTo(map)
        .bindPopup(`🏥 ${pharmacy.name}`);
    }

    setMapReady(true);
  }

  function drawRoute(L: any, map: any, from: [number, number], to: [number, number]) {
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
    }

    routeLineRef.current = L.polyline([from, to], {
      color: "#00572D",
      weight: 4,
      opacity: 0.7,
      dashArray: "10, 10",
    }).addTo(map);

    // Calculer distance et temps estimé
    const dist = calculateDistance(from[0], from[1], to[0], to[1]);
    setEstimatedDistance(`${dist.toFixed(1)} km`);

    const timeMin = Math.max(1, Math.round((dist / 25) * 60));
    setEstimatedTime(`${timeMin} min`);
  }

  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function updateDriverMarker(loc: any) {
    if (!driverMarkerRef.current || !mapRef.current) return;

    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);

    if (lat === 0 && lng === 0) return;

    driverMarkerRef.current.setLatLng([lat, lng]);

    // Mettre à jour la route
    if (address?.latitude && address?.longitude) {
      const L = require("leaflet");
      drawRoute(
        L,
        mapRef.current,
        [lat, lng],
        [Number(address.latitude), Number(address.longitude)]
      );
    }
  }

  // Livraison terminée
  if (order?.status === "delivered") {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 text-center max-w-sm shadow-xl">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
            Livraison effectuée !
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            Votre médicament a été livré avec succès.
          </p>
          <Link
            href="/orders"
            className="inline-block mt-5 bg-[#00572D] text-white px-6 py-3 rounded-xl font-bold text-sm"
          >
            Voir mes commandes
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl">
          <p className="text-[#00572D] dark:text-green-400 font-bold">
            Chargement du suivi...
          </p>
        </div>
      </main>
    );
  }

  if (!order || !driver) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 text-center max-w-sm shadow-xl">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-gray-500 dark:text-gray-400">
            Commande ou livreur introuvable.
          </p>
          <Link
            href="/orders"
            className="inline-block mt-4 bg-[#00572D] text-white px-5 py-2.5 rounded-xl font-bold text-sm"
          >
            Retour aux commandes
          </Link>
        </div>
      </main>
    );
  }

  const statusInfo = getStatusInfo(order.status);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">

      {/* HEADER */}
      <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-700 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/orders" className="text-sm text-gray-500 dark:text-gray-400">
            ← Retour
          </Link>
          <h1 className="font-bold text-[#00572D] dark:text-green-400 text-sm">
            📍 Suivi en direct
          </h1>
          <div className="w-12" />
        </div>
      </div>

      {/* STATUT */}
      <div className="bg-[#00572D] text-white px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">
              {statusInfo.emoji} {statusInfo.label}
            </p>
            {estimatedTime && order.status === "on_the_way" && (
              <p className="text-xs text-green-200 mt-0.5">
                ⏱️ {estimatedTime} · 📏 {estimatedDistance}
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-xs text-green-200">
              {driverLocation?.speed
                ? `${Math.round(Number(driverLocation.speed))} km/h`
                : ""}
            </p>
          </div>
        </div>
      </div>

      {/* CARTE */}
      <div className="flex-1 relative">
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <div
          ref={mapContainerRef}
          className="w-full h-full min-h-[50vh]"
          style={{ zIndex: 1 }}
        />

        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-[#00572D] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                Chargement de la carte...
              </p>
            </div>
          </div>
        )}

        {/* Légende */}
        <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur rounded-xl p-2.5 shadow-lg z-[1000]">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-5 h-5 bg-[#00572D] rounded-full flex items-center justify-center text-white text-[10px]">🏍️</span>
            <span className="text-gray-600 dark:text-gray-300">Livreur</span>
          </div>
          {address && (
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-white text-[10px]">🏠</span>
              <span className="text-gray-600 dark:text-gray-300">Vous</span>
            </div>
          )}
          {pharmacy && (
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px]">🏥</span>
              <span className="text-gray-600 dark:text-gray-300">Pharmacie</span>
            </div>
          )}
        </div>
      </div>

      {/* INFOS LIVREUR */}
      <div className="bg-white dark:bg-gray-900 border-t dark:border-gray-700 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            {driver.photo_url ? (
              <img
                src={driver.photo_url}
                alt={driver.full_name}
                className="w-14 h-14 rounded-full object-cover border-3 border-[#00572D] shadow-md"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#00572D] flex items-center justify-center text-white text-xl font-bold shadow-md">
                {driver.full_name?.charAt(0) || "?"}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm dark:text-white">
                {driver.full_name}
              </p>
              <p className="text-xs text-gray-400">
                🏍️ {driver.vehicle_type} {driver.vehicle_brand || ""}{" "}
                {driver.vehicle_color || ""}
              </p>
              {driver.vehicle_plate && (
                <p className="text-xs text-gray-400">
                  🔢 {driver.vehicle_plate}
                </p>
              )}
              {driver.rating && (
                <p className="text-xs text-yellow-500">
                  ⭐ {driver.rating}/5
                </p>
              )}
            </div>

            {/* Bouton appeler */}
            <a
              href={`tel:${driver.phone}`}
              className="w-12 h-12 rounded-full bg-[#00572D] flex items-center justify-center text-white text-xl shadow-lg hover:bg-green-800 transition shrink-0"
            >
              📞
            </a>
          </div>

          {/* Barre de progression mini */}
          <div className="flex gap-1 mt-3">
            {["picked_up", "on_the_way", "driver_arrived", "delivered"].map((s, idx) => {
              const steps = ["picked_up", "on_the_way", "driver_arrived", "delivered"];
              const currentIdx = steps.indexOf(order.status);
              return (
                <div
                  key={s}
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    idx <= currentIdx ? "bg-[#00572D]" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 mt-1">
            <span>Récupéré</span>
            <span>En route</span>
            <span>Arrivé</span>
            <span>Livré</span>
          </div>
        </div>
      </div>
    </main>
  );
}