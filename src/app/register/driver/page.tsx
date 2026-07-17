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

  // Étape 1 — Compte
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Étape 2 — Profil
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  // Étape 3 — Documents identité
  const [idType, setIdType] = useState("carte_nationale");
  const [idNumber, setIdNumber] = useState("");
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  // Étape 4 — Moto
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehiclePhotoFile, setVehiclePhotoFile] = useState<File | null>(null);
  const [vehiclePlatePhotoFile, setVehiclePlatePhotoFile] = useState<File | null>(null);
  const [vehicleDocFile, setVehicleDocFile] = useState<File | null>(null);

  // Previews
  const [previews, setPreviews] = useState<Record<string, string>>({});

  function handleFile(
    key: string,
    file: File | null,
    setter: (f: File | null) => void
  ) {
    setter(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviews((prev) => ({ ...prev, [key]: url }));
    }
  }

  async function uploadFile(file: File, path: string): Promise<string | null> {
    const { error } = await supabase.storage
      .from("driver-documents")
      .upload(path, file, { upsert: true });

    if (error) {
      showToast("Erreur upload : " + error.message, "error");
      return null;
    }

    const { data } = supabase.storage
      .from("driver-documents")
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async function handleRegister() {
    if (!vehicleBrand || !vehiclePlate) {
      showToast("Remplissez les informations de votre moto", "error");
      return;
    }

    setLoading(true);

    try {
      // 1. Créer le compte Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw new Error(authError.message);
      const userId = authData.user?.id;
      if (!userId) throw new Error("Impossible de créer le compte");

      // 2. Créer dans users
      await supabase.from("users").upsert({ id: userId, email, role: "driver" });

      // 3. Créer profil
      await supabase.from("profiles").upsert({
        id: userId,
        full_name: fullName,
        phone,
        city,
      });

      // 4. Upload documents
      const timestamp = Date.now();
      const basePath = `${userId}/${timestamp}`;

      let idFrontUrl = null;
      let idBackUrl = null;
      let selfieUrl = null;
      let vehiclePhotoUrl = null;
      let vehiclePlatePhotoUrl = null;
      let vehicleDocUrl = null;

      if (idFrontFile) idFrontUrl = await uploadFile(idFrontFile, `${basePath}/id_front.jpg`);
      if (idBackFile) idBackUrl = await uploadFile(idBackFile, `${basePath}/id_back.jpg`);
      if (selfieFile) selfieUrl = await uploadFile(selfieFile, `${basePath}/selfie.jpg`);
      if (vehiclePhotoFile) vehiclePhotoUrl = await uploadFile(vehiclePhotoFile, `${basePath}/vehicle.jpg`);
      if (vehiclePlatePhotoFile) vehiclePlatePhotoUrl = await uploadFile(vehiclePlatePhotoFile, `${basePath}/plate.jpg`);
      if (vehicleDocFile) vehicleDocUrl = await uploadFile(vehicleDocFile, `${basePath}/vehicle_doc.jpg`);

      // 5. Créer driver_profile
      const { error: driverError } = await supabase.from("driver_profiles").insert({
        user_id: userId,
        full_name: fullName,
        phone,
        city,
        address,
        is_verified: false,
        is_available: false,
        vehicle_type: "moto",
        vehicle_brand: vehicleBrand,
        vehicle_model: vehicleModel,
        vehicle_plate: vehiclePlate,
        vehicle_color: vehicleColor,
        id_type: idType,
        id_number: idNumber,
        identity_doc_url: idFrontUrl,
        identity_doc_back_url: idBackUrl,
        selfie_url: selfieUrl,
        vehicle_doc_url: vehicleDocUrl,
        vehicle_photo_url: vehiclePhotoUrl,
        vehicle_plate_photo_url: vehiclePlatePhotoUrl,
      });

      if (driverError) throw new Error(driverError.message);

      // 6. Notifier admin
      const { data: admins } = await supabase
        .from("users")
        .select("id")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        await supabase.from("notifications").insert(
          admins.map((admin: any) => ({
            user_id: admin.id,
            type: "system",
            title: "Nouvelle demande livreur 🏍️",
            body: `${fullName} a soumis une demande de compte livreur.`,
          }))
        );
      }

      showToast("Dossier envoyé ! En attente de validation.");
      router.push("/dashboard/driver");
    } catch (err: any) {
      showToast(err.message || "Erreur lors de l'inscription", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      <div className="max-w-md mx-auto px-4 pt-6">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🏍️</div>
          <h1 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
            Devenir livreur KISI
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Étape {step} sur 4
          </p>

          {/* Barre de progression */}
          <div className="flex gap-2 mt-3">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  s <= step ? "bg-[#00572D]" : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* ========== ÉTAPE 1 — COMPTE ========== */}
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
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mot de passe * (min. 6 caractères)</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                placeholder="••••••"
              />
            </div>

            <button
              onClick={() => {
                if (!email || !password) { showToast("Remplissez tous les champs", "error"); return; }
                if (password.length < 6) { showToast("Mot de passe trop court (min. 6)", "error"); return; }
                setStep(2);
              }}
              className="w-full bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm"
            >
              Continuer →
            </button>
          </div>
        )}

        {/* ========== ÉTAPE 2 — PROFIL ========== */}
        {step === 2 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-sm dark:text-white">👤 Informations personnelles</h2>

            {[
              { label: "Nom complet *", value: fullName, setter: setFullName, placeholder: "Ex: Jean Makaya" },
              { label: "Téléphone *", value: phone, setter: setPhone, placeholder: "Ex: 066000000" },
              { label: "Ville *", value: city, setter: setCity, placeholder: "Ex: Brazzaville" },
              { label: "Adresse complète", value: address, setter: setAddress, placeholder: "Ex: 12 Avenue de la Paix" },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">{field.label}</label>
                <input
                  value={field.value}
                  onChange={(e) => field.setter(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                  placeholder={field.placeholder}
                />
              </div>
            ))}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm">← Retour</button>
              <button
                onClick={() => {
                  if (!fullName || !phone || !city) { showToast("Nom, téléphone et ville requis", "error"); return; }
                  setStep(3);
                }}
                className="flex-1 bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm"
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ========== ÉTAPE 3 — DOCUMENTS IDENTITÉ ========== */}
        {step === 3 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-sm dark:text-white">🪪 Pièce d'identité</h2>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Type de pièce *</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  { value: "carte_nationale", label: "🪪 CNI" },
                  { value: "passeport", label: "📘 Passeport" },
                  { value: "permis", label: "🚗 Permis" },
                ].map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setIdType(t.value)}
                    className={`p-2.5 rounded-xl text-xs font-bold border-2 transition ${
                      idType === t.value
                        ? "bg-[#00572D] text-white border-[#00572D]"
                        : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Numéro de la pièce *</label>
              <input
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                placeholder="Ex: 1234567890"
              />
            </div>

            {/* Upload recto */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Photo recto *</label>
              <input
                type="file"
                accept="image/*"
                className="w-full mt-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                onChange={(e) => handleFile("idFront", e.target.files?.[0] || null, setIdFrontFile)}
              />
              {previews.idFront && (
                <img src={previews.idFront} alt="Recto" className="w-full h-32 object-cover rounded-xl mt-2 border border-gray-200" />
              )}
            </div>

            {/* Upload verso */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Photo verso *</label>
              <input
                type="file"
                accept="image/*"
                className="w-full mt-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                onChange={(e) => handleFile("idBack", e.target.files?.[0] || null, setIdBackFile)}
              />
              {previews.idBack && (
                <img src={previews.idBack} alt="Verso" className="w-full h-32 object-cover rounded-xl mt-2 border border-gray-200" />
              )}
            </div>

            {/* Selfie */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Selfie avec la pièce *</label>
              <p className="text-[10px] text-gray-400 mt-0.5">Tenez votre pièce d'identité à côté de votre visage</p>
              <input
                type="file"
                accept="image/*"
                className="w-full mt-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                onChange={(e) => handleFile("selfie", e.target.files?.[0] || null, setSelfieFile)}
              />
              {previews.selfie && (
                <img src={previews.selfie} alt="Selfie" className="w-full h-32 object-cover rounded-xl mt-2 border border-gray-200" />
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm">← Retour</button>
              <button
                onClick={() => {
                  if (!idNumber) { showToast("Numéro de pièce requis", "error"); return; }
                  if (!idFrontFile) { showToast("Photo recto requise", "error"); return; }
                  if (!idBackFile) { showToast("Photo verso requise", "error"); return; }
                  if (!selfieFile) { showToast("Selfie requis", "error"); return; }
                  setStep(4);
                }}
                className="flex-1 bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm"
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ========== ÉTAPE 4 — MOTO ========== */}
        {step === 4 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-sm dark:text-white">🏍️ Informations moto</h2>

            {[
              { label: "Marque *", value: vehicleBrand, setter: setVehicleBrand, placeholder: "Ex: Honda, Yamaha..." },
              { label: "Modèle", value: vehicleModel, setter: setVehicleModel, placeholder: "Ex: CB125" },
              { label: "Couleur", value: vehicleColor, setter: setVehicleColor, placeholder: "Ex: Rouge" },
              { label: "Immatriculation *", value: vehiclePlate, setter: setVehiclePlate, placeholder: "Ex: AB-1234-CG" },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">{field.label}</label>
                <input
                  value={field.value}
                  onChange={(e) => field.setter(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                  placeholder={field.placeholder}
                />
              </div>
            ))}

            {/* Photo moto */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Photo de la moto *</label>
              <input
                type="file"
                accept="image/*"
                className="w-full mt-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                onChange={(e) => handleFile("vehiclePhoto", e.target.files?.[0] || null, setVehiclePhotoFile)}
              />
              {previews.vehiclePhoto && (
                <img src={previews.vehiclePhoto} alt="Moto" className="w-full h-32 object-cover rounded-xl mt-2 border border-gray-200" />
              )}
            </div>

            {/* Photo plaque */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Photo de la plaque *</label>
              <input
                type="file"
                accept="image/*"
                className="w-full mt-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                onChange={(e) => handleFile("vehiclePlate", e.target.files?.[0] || null, setVehiclePlatePhotoFile)}
              />
              {previews.vehiclePlate && (
                <img src={previews.vehiclePlate} alt="Plaque" className="w-full h-32 object-cover rounded-xl mt-2 border border-gray-200" />
              )}
            </div>

            {/* Document véhicule */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Carte grise / Permis / Assurance</label>
              <input
                type="file"
                accept="image/*"
                className="w-full mt-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                onChange={(e) => handleFile("vehicleDoc", e.target.files?.[0] || null, setVehicleDocFile)}
              />
              {previews.vehicleDoc && (
                <img src={previews.vehicleDoc} alt="Document" className="w-full h-32 object-cover rounded-xl mt-2 border border-gray-200" />
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                ℹ️ Votre dossier sera examiné par l'équipe KISI sous 24-48h.
                Vous recevrez une notification une fois validé.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm">← Retour</button>
              <button
                onClick={handleRegister}
                disabled={loading}
                className="flex-1 bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm disabled:opacity-50"
              >
                {loading ? "Envoi..." : "🏍️ Envoyer le dossier"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}