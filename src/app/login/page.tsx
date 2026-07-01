"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProviderTemp";

export default function Login() {
  const router = useRouter();
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleLogin() {
    const { data, error } =
      await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    const userId = data.user.id;

    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (roleError) {
      showToast("Impossible de récupérer le rôle utilisateur");
      return;
    }

    if (userData?.role === "pharmacy") {
      router.push("/dashboard/pharmacy");
      return;
    }

    if (userData?.role === "user") {
      router.push("/dashboard/user");
      return;
    }

    showToast("Rôle utilisateur introuvable");
  }

  async function handleForgotPassword() {
    if (!forgotEmail.trim()) {
      showToast("Veuillez entrer votre adresse email.");
      return;
    }

    setForgotLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(
      forgotEmail.trim(),
      {
        redirectTo: window.location.origin + "/update-password",
      }
    );

    setForgotLoading(false);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    setForgotSent(true);
  }

  return (
    <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 flex items-center justify-center p-6 transition-colors">

      <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 w-full max-w-md shadow-2xl transition-colors">

        <div className="text-center">

          <img
            src="/logo.png"
            alt="KISI"
            className="w-36 h-36 mx-auto object-contain"
          />

          <h1 className="text-3xl font-bold text-[#00572D] dark:text-green-400 mt-6">
            Connexion
          </h1>

          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Accédez à votre compte
          </p>

        </div>

        <div className="space-y-4 mt-8">

          <input
            type="email"
            placeholder="Adresse email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-black dark:text-white dark:bg-gray-800 placeholder-gray-500 dark:placeholder:text-gray-500 focus:outline-none focus:border-[#00572D] dark:focus:border-green-500"
          />

          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-black dark:text-white dark:bg-gray-800 placeholder-gray-500 dark:placeholder:text-gray-500 focus:outline-none focus:border-[#00572D] dark:focus:border-green-500"
          />

          {/* Mot de passe oublié */}
          <div className="text-right">
            <button
              onClick={() => {
                setShowForgot(true);
                setForgotSent(false);
                setForgotEmail(email);
              }}
              className="text-sm text-[#00572D] dark:text-green-400 font-medium hover:underline"
            >
              Mot de passe oublié ?
            </button>
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-[#00572D] dark:bg-green-700 text-white p-4 rounded-xl font-bold"
          >
            Se connecter
          </button>

          <div className="text-center pt-2">

            <p className="text-gray-600 dark:text-gray-300">
              Pas encore de compte ?
            </p>

            <Link
              href="/register"
              className="text-[#00572D] dark:text-green-400 font-bold"
            >
              Créer un compte
            </Link>

          </div>

        </div>

      </div>

      {/* MODAL MOT DE PASSE OUBLIÉ */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">

          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md shadow-2xl transition-colors">

            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🔐</div>

              <h2 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
                Mot de passe oublié
              </h2>

              <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm">
                Entrez votre adresse email. Vous recevrez un lien pour créer un nouveau mot de passe.
              </p>
            </div>

            {forgotSent ? (
              <div className="text-center space-y-4">
                <div className="text-5xl">✅</div>

                <p className="text-green-600 dark:text-green-400 font-bold">
                  Lien envoyé !
                </p>

                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Vérifiez votre boîte email et cliquez sur le lien pour réinitialiser votre mot de passe.
                </p>

                <button
                  onClick={() => setShowForgot(false)}
                  className="w-full bg-[#00572D] dark:bg-green-700 text-white p-4 rounded-xl font-bold"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <div className="space-y-4">

                <input
                  type="email"
                  placeholder="Votre adresse email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-black dark:text-white dark:bg-gray-800 placeholder-gray-500 dark:placeholder:text-gray-500 focus:outline-none focus:border-[#00572D] dark:focus:border-green-500"
                />

                <button
                  onClick={handleForgotPassword}
                  disabled={forgotLoading}
                  className="w-full bg-[#00572D] dark:bg-green-700 text-white p-4 rounded-xl font-bold disabled:opacity-60"
                >
                  {forgotLoading ? "Envoi en cours..." : "Envoyer le lien"}
                </button>

                <button
                  onClick={() => setShowForgot(false)}
                  className="w-full bg-gray-200 dark:bg-gray-800 text-black dark:text-white p-4 rounded-xl font-bold"
                >
                  Annuler
                </button>

              </div>
            )}

          </div>

        </div>
      )}

    </main>
  );
}