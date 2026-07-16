"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProviderTemp";

export default function DriverRegisterPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Compte
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Profil
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");

  // Véhicule
  const [vehicleType, setVehicleType] = useState("moto");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");

  async function handleRegister() {
    if (!email || !password || !fullName || !phone) {
      showToast("Remplissez tous les champs obligatoires", "error");
      return;
    }

    setLoading(true);

    // Créer le compte auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      showToast(authError.message, "error");
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      showToast("Erreur lors de la création du compte", "error");
      setLoading(false);
      return;
    }

    // Créer dans users avec rôle driver
    const { error: userError } = await supabase.from("users").upsert({
      id: userId,
      email,
      role: "driver",
    });

    if (userError) {
      showToast(userError.message, "error");
      setLoading(false);
      return;
    }

    // Créer le profil
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      phone,
    });

    if (profileError) {
      showToast(profileError.message, "error");
      setLoading(false);
      return;
    }

    // Créer le profil livreur
    const { error: driverError } = await supabase.from("driver_profiles").insert({
      user_id: userId,
      full_name: fullName,
      phone,
      city,
      vehicle_type: vehicleType,
      vehicle_brand: vehicleBrand,
      vehicle_plate: vehiclePlate,
      vehicle_color: vehicleColor,
      is_verified: false,
      is_available: false,
    });

    if (driverError) {
      showToast(driverError.message, "error");
      setLoading(false);
      return;
    }

    setLoading(false);
    showToast("Compte livreur créé ! En attente de vérification.");
    router.push("/dashboard/driver");
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      <div className="max-w-md mx-auto px-4 pt-6">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🏍️</div>
          <h1 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
            Devenir livreur KISI
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Étape {step} sur 3
          </p>

          <div className="flex gap-2 mt-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  s <= step ? "bg-[#00572D]" : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* ÉTAPE 1 — Compte */}
        {step === 1 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-sm dark:text-white">🔐 Créer votre compte</h2>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Email *</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mot de passe *</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                placeholder="Min. 6 caractères"
              />
            </div>

            <button
              onClick={() => {
                if (!email || !password) {
                  showToast("Remplissez tous les champs", "error");
                  return;
                }
                if (password.length < 6) {
                  showToast("Mot de passe trop court (min. 6)", "error");
                  return;
                }
                setStep(2);
              }}
              className="w-full bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm"
            >
              Continuer →
            </button>
          </div>
        )}

        {/* ÉTAPE 2 — Profil */}
        {step === 2 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-sm dark:text-white">👤 Vos informations</h2>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nom complet *</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                placeholder="Ex: Jean Makaya"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Téléphone *</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                placeholder="Ex: 066000000"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Ville</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                placeholder="Ex: Brazzaville"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm"
              >
                ← Retour
              </button>
              <button
                onClick={() => {
                  if (!fullName || !phone) {
                    showToast("Nom et téléphone requis", "error");
                    return;
                  }
                  setStep(3);
                }}
                className="flex-1 bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm"
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 — Véhicule */}
        {step === 3 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-sm dark:text-white">🏍️ Votre véhicule</h2>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Type de véhicule</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  { value: "moto", label: "🏍️ Moto" },
                  { value: "voiture", label: "🚗 Voiture" },
                  { value: "velo", label: "🚲 Vélo" },
                ].map((v) => (
                  <button
                    key={v.value}
                    onClick={() => setVehicleType(v.value)}
                    className={`p-3 rounded-xl text-center text-sm font-bold border-2 transition ${
                      vehicleType === v.value
                        ? "bg-[#00572D] text-white border-[#00572D]"
                        : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Marque</label>
              <input
                value={vehicleBrand}
                onChange={(e) => setVehicleBrand(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                placeholder="Ex: Honda, Toyota..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Plaque</label>
              <input
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                placeholder="Ex: AB-1234-CG"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Couleur</label>
              <input
                value={vehicleColor}
                onChange={(e) => setVehicleColor(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                placeholder="Ex: Noir"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm"
              >
                ← Retour
              </button>
              <button
                onClick={handleRegister}
                disabled={loading}
                className="flex-1 bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm disabled:opacity-50"
              >
                {loading ? "Création..." : "🏍️ Créer mon compte"}
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center mt-2">
              Votre compte sera vérifié par KISI avant activation.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}