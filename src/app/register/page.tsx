"use client";

import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam === "pharmacy") setRole("pharmacy");
    if (roleParam === "driver") setRole("driver");
  }, [searchParams]);

  async function handleRegister() {
    setError("");

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);

    const { data, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Impossible de créer le compte.");
      setLoading(false);
      return;
    }

    const userId = data.user.id;

    await supabase.from("users").upsert({ id: userId, email, role });
    await supabase.from("profiles").upsert({ id: userId, full_name: fullName, phone });

    setLoading(false);

    if (role === "pharmacy") {
      router.push("/register/pharmacy");
    } else if (role === "driver") {
      // Créer un profil livreur minimal — le reste sera complété après
      await supabase.from("driver_profiles").upsert({
        user_id: userId,
        full_name: fullName,
        phone,
        is_verified: false,
        is_available: false,
      });
      router.push("/register/driver/dossier");
    } else {
      router.push("/");
    }
  }

  return (
    <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 flex items-center justify-center p-6 transition-colors">
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 w-full max-w-md shadow-2xl">

        <div className="text-center mb-6">
          <img src="/logo.png" alt="KISI" className="w-32 h-32 mx-auto object-contain" />
          <h1 className="text-2xl font-bold text-[#00572D] dark:text-green-400 mt-4">
            Créer un compte
          </h1>
        </div>

        {/* CHOIX DU RÔLE */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { value: "user", label: "👤 Client" },
            { value: "pharmacy", label: "🏥 Pharmacie" },
            { value: "driver", label: "🏍️ Livreur" },
          ].map((r) => (
            <button
              key={r.value}
              onClick={() => setRole(r.value)}
              className={`p-3 rounded-xl border-2 font-bold text-xs transition-all ${
                role === r.value
                  ? "border-[#00572D] bg-[#00572D] text-white"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 dark:bg-gray-800"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Info selon rôle */}
        {role === "driver" && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              🏍️ Après la création du compte, vous compléterez votre dossier livreur
              (pièce d'identité, véhicule...). Votre compte sera activé après vérification.
            </p>
          </div>
        )}

        {role === "pharmacy" && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 mb-4">
            <p className="text-xs text-green-700 dark:text-green-400">
              🏥 Après inscription, vous renseignerez les informations de votre pharmacie.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nom complet *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Jean Makaya"
              className="w-full mt-1 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Téléphone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: 066000000"
              className="w-full mt-1 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Adresse e-mail *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              className="w-full mt-1 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mot de passe * (min. 6 caractères)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full mt-1 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400"
            />
          </div>

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-[#00572D] dark:bg-green-700 text-white p-4 rounded-xl font-bold disabled:opacity-60 mt-2"
          >
            {loading
              ? "Création en cours..."
              : role === "pharmacy"
              ? "Créer mon compte pharmacie"
              : role === "driver"
              ? "Créer mon compte livreur"
              : "Créer mon compte"}
          </button>

          <div className="text-center pt-2">
            <p className="text-gray-600 dark:text-gray-300 text-sm">Déjà un compte ?</p>
            <Link href="/login" className="text-[#00572D] dark:text-green-400 font-bold text-sm">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Register() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#00572D] flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 text-center">
          <p className="text-[#00572D] font-bold">Chargement...</p>
        </div>
      </main>
    }>
      <RegisterForm />
    </Suspense>
  );
}