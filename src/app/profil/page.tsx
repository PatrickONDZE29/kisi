"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProviderTemp";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setLoading(false);
      return;
    }

    setUserId(auth.user.id);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", auth.user.id)
      .single();

    if (data) {
      setFullName(data.full_name || "");
      setPhone(data.phone || "");
      setCity(data.city || "");
    }

    setLoading(false);
  }

  async function saveProfile() {
    if (!userId) return;

    setSaving(true);

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      phone: phone,
      city: city,
    });

    if (error) {
      showToast(error.message);
      setSaving(false);
      return;
    }

    showToast("✅ Profil enregistré avec succès");
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-black dark:text-white transition-colors">
        Chargement...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 p-6 transition-colors">

      <div className="max-w-xl mx-auto">

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl transition-colors">

          <h1 className="text-3xl font-bold text-[#00572D] dark:text-green-400">
            👤 Mon profil
          </h1>

          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Complétez vos informations
          </p>

          <div className="mt-6 space-y-4">

            <input
              className="w-full p-3 border dark:border-gray-700 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              placeholder="Nom complet"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <input
              className="w-full p-3 border dark:border-gray-700 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              placeholder="Téléphone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <input
              className="w-full p-3 border dark:border-gray-700 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              placeholder="Ville"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />

            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full bg-[#00572D] dark:bg-green-700 text-white p-3 rounded-xl font-bold disabled:opacity-60"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>

          </div>

        </div>

      </div>

    </main>
  );
}