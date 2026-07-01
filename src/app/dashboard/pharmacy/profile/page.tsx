"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useToast } from "@/components/ToastProviderTemp";

export default function PharmacyProfilePage() {
  const [loading, setLoading] = useState(true);

  const [pharmacyId, setPharmacyId] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [openingHours, setOpeningHours] = useState("");

  const { showToast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth?.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("pharmacies")
        .select("*")
        .eq("user_id", auth.user.id)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      setPharmacyId(data.id ?? "");
      setLogoUrl(data.logo_url ?? "");
      setCoverUrl(data.cover_url ?? "");
      setName(data.name ?? "");
      setAddress(data.address ?? "");
      setPhone(data.phone ?? "");
      setDescription(data.description ?? "");
      setOpeningHours(data.opening_hours ?? "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!pharmacyId) {
      showToast("Aucune pharmacie trouvée", "error");
      return;
    }

    const { error } = await supabase
      .from("pharmacies")
      .update({
        name,
        address,
        phone,
        description,
        opening_hours: openingHours,
      })
      .eq("id", pharmacyId);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("✅ Profil mis à jour avec succès");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-xl">
          <p className="text-[#00572D] dark:text-green-400 font-bold">
            Chargement...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 p-6">
      <div className="max-w-3xl mx-auto">

        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">

          {/* COVER + LOGO */}
          <div className="relative">
            {coverUrl ? (
              <img
                src={coverUrl}
                className="w-full h-48 object-cover"
              />
            ) : (
              <div className="w-full h-48 bg-[#00572D] dark:bg-green-900" />
            )}

            <div className="absolute -bottom-12 left-6">
              <img
                src={logoUrl || "/pharmacie.png"}
                className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-900 bg-white dark:bg-gray-800 shadow-lg object-cover"
              />
            </div>
          </div>

          {/* TITLE */}
          <div className="pt-16 px-6 pb-2">
            <h1 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
              {name || "Profil Pharmacie"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Gérez les informations de votre pharmacie
            </p>
          </div>

          <div className="p-6 space-y-5">

            {/* NOM */}
            <div>
              <label className="text-black dark:text-white font-semibold">
                Nom de la pharmacie
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-2 p-4 rounded-2xl border dark:border-gray-700 dark:bg-gray-800 text-black dark:text-white"
                placeholder="Pharmacie Centrale"
              />
            </div>

            {/* ADRESSE */}
            <div>
              <label className="text-black dark:text-white font-semibold">
                Adresse
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full mt-2 p-4 rounded-2xl border dark:border-gray-700 dark:bg-gray-800 text-black dark:text-white"
                placeholder="Pointe-Noire"
              />
            </div>

            {/* PHONE */}
            <div>
              <label className="text-black dark:text-white font-semibold">
                Téléphone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full mt-2 p-4 rounded-2xl border dark:border-gray-700 dark:bg-gray-800 text-black dark:text-white"
                placeholder="+242..."
              />
            </div>

            {/* HORAIRES */}
            <div>
              <label className="text-black dark:text-white font-semibold">
                Horaires
              </label>
              <input
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                className="w-full mt-2 p-4 rounded-2xl border dark:border-gray-700 dark:bg-gray-800 text-black dark:text-white"
                placeholder="08h00 - 20h00"
              />
            </div>

            {/* DESCRIPTION */}
            <div>
              <label className="text-black dark:text-white font-semibold">
                Description
              </label>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full mt-2 p-4 rounded-2xl border dark:border-gray-700 dark:bg-gray-800 text-black dark:text-white"
                placeholder="Présentation de votre pharmacie..."
              />
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              💡 Logo et couverture se modifient dans{" "}
              <Link
                href="/dashboard/pharmacy/settings"
                className="text-[#00572D] dark:text-green-400 font-semibold underline"
              >
                paramètres
              </Link>
            </p>

            <button
              onClick={saveProfile}
              className="w-full bg-[#00572D] dark:bg-green-700 text-white p-4 rounded-2xl font-bold"
            >
              Enregistrer
            </button>

          </div>
        </div>

      </div>
    </main>
  );
}