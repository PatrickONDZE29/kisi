"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function UserDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
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

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        full_name: fullName,
        phone,
        city,
      });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditing(false);
    alert("✅ Profil mis à jour avec succès");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function deleteAccount() {
    const confirmDelete = confirm("Voulez-vous vraiment supprimer votre compte ?");
    if (!confirmDelete) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.from("users").delete().eq("id", user.id);

    alert("Le compte a été supprimé de la base de données.");
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 transition-colors">
        <p className="text-black dark:text-white">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 p-6 transition-colors">
      <div className="max-w-4xl mx-auto">

        {/* EN-TÊTE */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl transition-colors">
          <h1 className="text-3xl font-bold text-[#00572D] dark:text-green-400">
            👤 Mon espace utilisateur
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Bienvenue sur KISI
          </p>
        </div>

        {/* INFORMATIONS PERSONNELLES */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 mt-6 shadow-lg transition-colors">

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-black dark:text-white">
              Informations personnelles
            </h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-[#00572D] dark:text-green-400 border border-[#00572D] dark:border-green-500 px-4 py-2 rounded-xl font-medium hover:bg-[#00572D] hover:text-white dark:hover:bg-green-700 transition-all duration-200"
              >
                ✏️ Modifier
              </button>
            )}
          </div>

          {editing ? (
            /* MODE ÉDITION */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-black dark:text-white mb-1">
                  Nom complet
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Votre nom complet"
                  className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-[#00572D] dark:focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-black dark:text-white mb-1">
                  Téléphone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Votre numéro de téléphone"
                  className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-[#00572D] dark:focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-black dark:text-white mb-1">
                  Ville
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Votre ville"
                  className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-[#00572D] dark:focus:border-green-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="flex-1 bg-[#00572D] dark:bg-green-700 text-white py-3 rounded-xl font-bold disabled:opacity-60 hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
                >
                  {saving ? "Enregistrement..." : "💾 Enregistrer"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-black dark:text-white py-3 rounded-xl font-bold hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            /* MODE LECTURE */
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <span className="text-xl">👤</span>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Nom complet</p>
                  <p className="text-black dark:text-white font-medium">{fullName || "-"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <span className="text-xl">📞</span>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Téléphone</p>
                  <p className="text-black dark:text-white font-medium">{phone || "-"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <span className="text-xl">📍</span>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ville</p>
                  <p className="text-black dark:text-white font-medium">{city || "-"}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PARAMÈTRES */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 mt-6 shadow-lg transition-colors">
          <h2 className="text-2xl font-bold text-black dark:text-white mb-5">
            Paramètres
          </h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={logout}
              className="bg-[#00572D] dark:bg-green-700 text-white px-5 py-3 rounded-xl font-bold hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
            >
              Déconnexion
            </button>
            <button
              onClick={deleteAccount}
              className="bg-red-600 dark:bg-red-700 text-white px-5 py-3 rounded-xl font-bold hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
            >
              Supprimer mon compte
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}