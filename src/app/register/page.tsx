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
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("role") === "pharmacy") {
      setRole("pharmacy");
    }
  }, [searchParams]);

  async function handleRegister() {
    if (!email || !password || !fullName) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      alert("Impossible de créer le compte");
      setLoading(false);
      return;
    }

    const userId = data.user.id;

    const { error: dbError } = await supabase
      .from("users")
      .upsert({ id: userId, email: data.user.email, role });

    if (dbError) {
      alert(dbError.message);
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: userId, full_name: fullName, phone, city });

    if (profileError) {
      alert(profileError.message);
      setLoading(false);
      return;
    }

    setLoading(false);

    if (role === "pharmacy") {
      router.push("/register/pharmacy");
    } else {
      router.push("/");
    }
  }

  return (
    <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 flex items-center justify-center p-6 transition-colors">
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 w-full max-w-md shadow-2xl transition-colors">

        <div className="text-center">
          <img src="/logo.png" alt="KISI" className="w-40 h-40 mx-auto object-contain" />
          
          <h1 className="text-3xl font-bold text-[#00572D] dark:text-green-400 mt-6">
            Créer un compte
          </h1>
        </div>

        <div className="space-y-4 mt-8">

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setRole("user")}
              className={`p-4 rounded-xl border-2 font-bold text-sm transition-all ${
                role === "user"
                  ? "border-[#00572D] bg-[#00572D] text-white"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 dark:bg-gray-800"
              }`}
            >
              👤 Utilisateur
            </button>

            <button
              onClick={() => setRole("pharmacy")}
              className={`p-4 rounded-xl border-2 font-bold text-sm transition-all ${
                role === "pharmacy"
                  ? "border-[#00572D] bg-[#00572D] text-white"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 dark:bg-gray-800"
              }`}
            >
              🏥 Pharmacie
            </button>
          </div>

          {role === "pharmacy" && (
            <p className="text-sm text-[#00572D] dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-xl">
              ✅ Après inscription, vous renseignerez les informations de votre pharmacie.
            </p>
          )}

          <input
            type="text"
            placeholder="Nom complet *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          <input
            type="text"
            placeholder="Téléphone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          <input
            type="text"
            placeholder="Ville"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          <input
            type="email"
            placeholder="Adresse email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          <input
            type="password"
            placeholder="Mot de passe *"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-[#00572D] dark:bg-green-700 text-white p-4 rounded-xl font-bold disabled:opacity-60"
          >
            {loading ? "Création en cours..." : "Créer mon compte"}
          </button>

          <div className="text-center pt-2">
            <p className="text-gray-600 dark:text-gray-300">Déjà un compte ?</p>
            <Link href="/login" className="text-[#00572D] dark:text-green-400 font-bold">
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
      <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 text-center">
          <p className="text-[#00572D] dark:text-green-400 font-bold">Chargement...</p>
        </div>
      </main>
    }>
      <RegisterForm />
    </Suspense>
  );
}