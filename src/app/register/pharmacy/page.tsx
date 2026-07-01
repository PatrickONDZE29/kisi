"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProviderTemp";

export default function PharmacySetup() {
  const router = useRouter();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState("");

  async function getCoordinates(address: string, city: string) {
    const query = encodeURIComponent(`${address}, ${city}`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

    try {
      const res = await fetch(url, {
        headers: { "Accept-Language": "fr" },
      });
      const data = await res.json();

      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        };
      }

      // Si adresse complète ne donne rien, essayer avec juste la ville
      const cityQuery = encodeURIComponent(city);
      const cityUrl = `https://nominatim.openstreetmap.org/search?q=${cityQuery}&format=json&limit=1`;
      const cityRes = await fetch(cityUrl, {
        headers: { "Accept-Language": "fr" },
      });
      const cityData = await cityRes.json();

      if (cityData && cityData.length > 0) {
        return {
          latitude: parseFloat(cityData[0].lat),
          longitude: parseFloat(cityData[0].lon),
        };
      }

      return null;
    } catch (err) {
      console.error("Erreur géocodage:", err);
      return null;
    }
  }

  async function handleSave() {
    if (!name.trim() || !city.trim() || !address.trim() || !phone.trim()) {
      showToast("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);
    setGeoStatus("📍 Localisation de votre pharmacie en cours...");

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      showToast("Utilisateur non connecté");
      setLoading(false);
      setGeoStatus("");
      return;
    }

    // Géocodage automatique via adresse + ville
    const coords = await getCoordinates(address, city);

    if (coords) {
      setGeoStatus(`✅ Pharmacie localisée : ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
    } else {
      setGeoStatus("⚠️ Localisation approximative (ville uniquement)");
    }

    const { error } = await supabase
      .from("pharmacies")
      .insert({
        name,
        city,
        address,
        phone,
        user_id: user.id,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        is_open: true,
      });

    if (error) {
      showToast(error.message, "error");
      setLoading(false);
      setGeoStatus("");
      return;
    }

    showToast("✅ Pharmacie enregistrée avec succès !");
    router.push("/dashboard/pharmacy");
  }

  return (
    <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-sm shadow-lg transition-colors">

        <div className="text-center">
          <img src="/logo.png" alt="KISI" className="w-32 h-32 mx-auto object-contain" />
          <h1 className="text-2xl font-bold text-[#00572D] dark:text-green-400 mt-4">
            Informations pharmacie
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Votre pharmacie sera automatiquement placée sur la carte.
          </p>
        </div>

        <div className="space-y-4 mt-6">

          <input
            type="text"
            placeholder="Nom de la pharmacie"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border-2 border-gray-200 dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          <input
            type="text"
            placeholder="Ville (ex: Pointe-Noire)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full border-2 border-gray-200 dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          <input
            type="text"
            placeholder="Adresse (ex: Avenue Marien Ngouabi)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full border-2 border-gray-200 dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          <input
            type="text"
            placeholder="Téléphone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border-2 border-gray-200 dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          {/* Statut de géolocalisation */}
          {geoStatus && (
            <div className="text-sm text-center font-medium text-[#00572D] dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-xl">
              {geoStatus}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-[#00572D] dark:bg-green-700 text-white p-4 rounded-xl font-bold disabled:opacity-60"
          >
            {loading ? "Enregistrement..." : "Enregistrer la pharmacie"}
          </button>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            🗺️ La position sur la carte est calculée automatiquement à partir de votre adresse et ville.
          </p>

        </div>
      </div>
    </main>
  );
}