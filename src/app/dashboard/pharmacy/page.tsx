"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PharmacyDashboard() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (data?.role === "pharmacy") {
      setAuthorized(true);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 transition-colors">
        <p className="text-[#00572D] dark:text-green-400 font-bold">Chargement...</p>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 p-6 transition-colors">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-8 text-center max-w-sm transition-colors">
          <h1 className="text-xl font-bold text-red-600 dark:text-red-400">Accès refusé</h1>
          <p className="mt-3 text-gray-600 dark:text-gray-300 text-sm">
            Veuillez créer un compte pharmacie pour accéder à cet espace.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 p-6 transition-colors">

      <div className="max-w-md mx-auto pt-8">

        {/* EN-TÊTE */}
        <div className="bg-[#00572D] dark:bg-green-900 text-white rounded-3xl p-5 shadow-lg transition-colors">
          <div className="flex items-center gap-3">
            <img src="/pharmacie.png" alt="Pharmacie" className="w-14 h-14 object-contain" />
            <div>
              <h1 className="text-xl font-bold">Espace Pharmacie</h1>
              <p className="text-green-100 text-sm">Gérez votre pharmacie depuis KISI</p>
            </div>
          </div>
        </div>

        {/* GRILLE DES MODULES */}
        <div className="grid grid-cols-2 gap-3 mt-5">

          <Link
            href="/dashboard/pharmacy/profile"
            className="bg-[#00572D] dark:bg-green-900 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 text-white p-5 rounded-2xl text-center font-bold shadow-md"
          >
            <div className="text-3xl mb-2">👤</div>
            <p className="text-sm font-bold">Profil</p>
            <p className="text-xs font-normal mt-1 text-green-100">Informations</p>
          </Link>

          <Link
            href="/dashboard/pharmacy/stocks"
            className="bg-[#00572D] dark:bg-green-900 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 text-white p-5 rounded-2xl text-center font-bold shadow-md"
          >
            <div className="text-3xl mb-2">💊</div>
            <p className="text-sm font-bold">Médicaments</p>
            <p className="text-xs font-normal mt-1 text-green-100">Gérer le stock</p>
          </Link>

          <Link
            href="/dashboard/pharmacy/reservations"
            className="bg-[#00572D] dark:bg-green-900 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 text-white p-5 rounded-2xl text-center font-bold shadow-md"
          >
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm font-bold">Réservations</p>
            <p className="text-xs font-normal mt-1 text-green-100">Accepter / refuser</p>
          </Link>

          <Link
            href="/dashboard/pharmacy/settings"
            className="bg-[#00572D] dark:bg-green-900 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 text-white p-5 rounded-2xl text-center font-bold shadow-md"
          >
            <div className="text-3xl mb-2">⚙️</div>
            <p className="text-sm font-bold">Paramètres</p>
            <p className="text-xs font-normal mt-1 text-green-100">Logo & sécurité</p>
          </Link>

        </div>

        {/* FONCTIONNALITÉS */}
        <div className="bg-gray-100 dark:bg-gray-900 rounded-3xl p-5 mt-5 transition-colors">
          <h2 className="text-base font-bold text-[#00572D] dark:text-green-400 mb-3">
            Fonctionnalités disponibles
          </h2>
          <ul className="space-y-1.5 text-sm text-black dark:text-gray-200">
            <li>✅ Gestion du profil pharmacie</li>
            <li>✅ Gestion des médicaments</li>
            <li>✅ Réception des réservations</li>
            <li>✅ Changement des statuts des réservations</li>
            <li>✅ Upload du logo pharmacie</li>
            <li>✅ Photo de couverture</li>
            <li>✅ Déconnexion sécurisée</li>
          </ul>
        </div>

      </div>

    </main>
  );
}