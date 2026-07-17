"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProviderTemp";

export default function DriverDossierPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [driverProfileId, setDriverProfileId] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // Infos personnelles
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  // Véhicule
  const [vehicleType, setVehicleType] = useState<"moto" | "voiture">("moto");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehiclePhotoFile, setVehiclePhotoFile] = useState<File | null>(null);
  const [vehiclePlatePhotoFile, setVehiclePlatePhotoFile] = useState<File | null>(null);

  // Identité
  const [idType, setIdType] = useState("carte_nationale");
  const [idNumber, setIdNumber] = useState("");
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  // Documents véhicule
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [vehicleDocFile, setVehicleDocFile] = useState<File | null>(null);

  // Previews
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);

    // Vérifier le rôle
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "driver") {
      router.push("/");
      return;
    }

    // Récupérer profil livreur existant
    const { data: driver } = await supabase
      .from("driver_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (driver) {
      setDriverProfileId(driver.id);
      setFullName(driver.full_name || "");
      setPhone(driver.phone || "");
      setCity(driver.city || "");
      setAddress(driver.address || "");

      if (driver.vehicle_type) setVehicleType(driver.vehicle_type);
      setVehicleBrand(driver.vehicle_brand || "");
      setVehicleModel(driver.vehicle_model || "");
      setVehicleColor(driver.vehicle_color || "");
      setVehiclePlate(driver.vehicle_plate || "");
      if (driver.id_type) setIdType(driver.id_type);
      setIdNumber(driver.id_number || "");
    }

    setLoading(false);
  }

  function handleFile(key: string, file: File | null, setter: (f: File | null) => void) {
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

    const { data } = supabase.storage.from("driver-documents").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit() {
    if (!userId || !driverProfileId) return;

    // Validations
    if (!city.trim()) { showToast("Ville requise", "error"); return; }
    if (!vehicleBrand.trim()) { showToast("Marque du véhicule requise", "error"); return; }
    if (!vehiclePlate.trim()) { showToast("Immatriculation requise", "error"); return; }
    if (!vehiclePhotoFile) { showToast("Photo du véhicule requise", "error"); return; }
    if (!vehiclePlatePhotoFile) { showToast("Photo de la plaque requise", "error"); return; }
    if (!idNumber.trim()) { showToast("Numéro de pièce requis", "error"); return; }
    if (!idFrontFile) { showToast("Photo recto requise", "error"); return; }
    if (!idBackFile) { showToast("Photo verso requise", "error"); return; }
    if (!selfieFile) { showToast("Selfie avec pièce requis", "error"); return; }

    setSubmitting(true);

    try {
      const ts = Date.now();
      const base = `${userId}/${ts}`;

      const [
        vehiclePhotoUrl,
        vehiclePlatePhotoUrl,
        idFrontUrl,
        idBackUrl,
        selfieUrl,
        licenseUrl,
        vehicleDocUrl,
      ] = await Promise.all([
        vehiclePhotoFile ? uploadFile(vehiclePhotoFile, `${base}/vehicle.jpg`) : Promise.resolve(null),
        vehiclePlatePhotoFile ? uploadFile(vehiclePlatePhotoFile, `${base}/plate.jpg`) : Promise.resolve(null),
        idFrontFile ? uploadFile(idFrontFile, `${base}/id_front.jpg`) : Promise.resolve(null),
        idBackFile ? uploadFile(idBackFile, `${base}/id_back.jpg`) : Promise.resolve(null),
        selfieFile ? uploadFile(selfieFile, `${base}/selfie.jpg`) : Promise.resolve(null),
        licenseFile ? uploadFile(licenseFile, `${base}/license.jpg`) : Promise.resolve(null),
        vehicleDocFile ? uploadFile(vehicleDocFile, `${base}/vehicle_doc.jpg`) : Promise.resolve(null),
      ]);

      const { error } = await supabase
        .from("driver_profiles")
        .update({
          full_name: fullName,
          phone,
          city,
          address,
          vehicle_type: vehicleType,
          vehicle_brand: vehicleBrand,
          vehicle_model: vehicleModel,
          vehicle_color: vehicleColor,
          vehicle_plate: vehiclePlate,
          vehicle_photo_url: vehiclePhotoUrl,
          vehicle_plate_photo_url: vehiclePlatePhotoUrl,
          id_type: idType,
          id_number: idNumber,
          identity_doc_url: idFrontUrl,
          identity_doc_back_url: idBackUrl,
          selfie_url: selfieUrl,
          license_url: licenseUrl,
          vehicle_doc_url: vehicleDocUrl,
          dossier_submitted_at: new Date().toISOString(),
        })
        .eq("id", driverProfileId);

      if (error) throw new Error(error.message);

      // Notifier les admins
      const { data: admins } = await supabase
        .from("users")
        .select("id")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        await supabase.from("notifications").insert(
          admins.map((admin: any) => ({
            user_id: admin.id,
            type: "system",
            title: "Nouveau dossier livreur 🏍️",
            body: `${fullName} a soumis son dossier livreur. Vérification requise.`,
          }))
        );
      }

      showToast("Dossier envoyé ! En attente de validation.");
      router.push("/dashboard/driver");
    } catch (err: any) {
      showToast(err.message || "Erreur lors de l'envoi", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl">
          <p className="text-[#00572D] dark:text-green-400 font-bold">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      <div className="max-w-md mx-auto px-4 pt-6">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏍️</div>
          <h1 className="text-xl font-bold text-[#00572D] dark:text-green-400">
            Compléter votre dossier
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

        {/* ========== ÉTAPE 1 — INFOS PERSONNELLES + VÉHICULE ========== */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-sm dark:text-white">👤 Informations personnelles</h2>

              {[
                { label: "Nom complet *", value: fullName, setter: setFullName, placeholder: "Ex: Jean Makaya" },
                { label: "Téléphone *", value: phone, setter: setPhone, placeholder: "Ex: 066000000" },
                { label: "Ville *", value: city, setter: setCity, placeholder: "Ex: Brazzaville" },
                { label: "Adresse", value: address, setter: setAddress, placeholder: "Ex: 12 Avenue de la Paix" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">{f.label}</label>
                  <input
                    value={f.value}
                    onChange={(e) => f.setter(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                  />
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-sm dark:text-white">🏍️ Moyen de transport</h2>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "moto", label: "🏍️ Moto" },
                  { value: "voiture", label: "🚗 Voiture" },
                ].map((v) => (
                  <button
                    key={v.value}
                    onClick={() => setVehicleType(v.value as any)}
                    className={`p-3 rounded-xl text-sm font-bold border-2 transition ${
                      vehicleType === v.value
                        ? "bg-[#00572D] text-white border-[#00572D]"
                        : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              {[
                { label: "Marque *", value: vehicleBrand, setter: setVehicleBrand, placeholder: "Ex: Honda, Toyota..." },
                { label: "Modèle", value: vehicleModel, setter: setVehicleModel, placeholder: "Ex: CB125, Corolla..." },
                { label: "Couleur", value: vehicleColor, setter: setVehicleColor, placeholder: "Ex: Rouge" },
                { label: "Immatriculation *", value: vehiclePlate, setter: setVehiclePlate, placeholder: "Ex: AB-1234-CG" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">{f.label}</label>
                  <input
                    value={f.value}
                    onChange={(e) => f.setter(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                  />
                </div>
              ))}

              {/* Photo véhicule */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Photo du {vehicleType === "moto" ? "moto" : "véhicule"} *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFile("vehiclePhoto", e.target.files?.[0] || null, setVehiclePhotoFile)}
                  className="w-full mt-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                />
                {previews.vehiclePhoto && (
                  <img src={previews.vehiclePhoto} alt="Véhicule" className="w-full h-32 object-cover rounded-xl mt-2 border border-gray-200" />
                )}
              </div>

              {/* Photo plaque */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Photo de la plaque *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFile("vehiclePlate", e.target.files?.[0] || null, setVehiclePlatePhotoFile)}
                  className="w-full mt-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                />
                {previews.vehiclePlate && (
                  <img src={previews.vehiclePlate} alt="Plaque" className="w-full h-32 object-cover rounded-xl mt-2 border border-gray-200" />
                )}
              </div>
            </div>

            <button
              onClick={() => {
                if (!fullName || !phone || !city) { showToast("Remplissez les infos personnelles", "error"); return; }
                if (!vehicleBrand || !vehiclePlate) { showToast("Remplissez les infos du véhicule", "error"); return; }
                if (!vehiclePhotoFile) { showToast("Photo du véhicule requise", "error"); return; }
                if (!vehiclePlatePhotoFile) { showToast("Photo de la plaque requise", "error"); return; }
                setStep(2);
              }}
              className="w-full bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm"
            >
              Continuer →
            </button>
          </div>
        )}

        {/* ========== ÉTAPE 2 — PIÈCE D'IDENTITÉ ========== */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-sm dark:text-white">🪪 Pièce d'identité</h2>

              {/* Type */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Type *</label>
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

              {/* Numéro */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Numéro *</label>
                <input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                  placeholder="Ex: 1234567890"
                />
              </div>

              {/* Recto */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Photo recto *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFile("idFront", e.target.files?.[0] || null, setIdFrontFile)}
                  className="w-full mt-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                />
                {previews.idFront && (
                  <img src={previews.idFront} alt="Recto" className="w-full h-32 object-cover rounded-xl mt-2 border border-gray-200" />
                )}
              </div>

              {/* Verso */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Photo verso *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFile("idBack", e.target.files?.[0] || null, setIdBackFile)}
                  className="w-full mt-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                />
                {previews.idBack && (
                  <img src={previews.idBack} alt="Verso" className="w-full h-32 object-cover rounded-xl mt-2 border border-gray-200" />
                )}
              </div>

              {/* Selfie */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Selfie avec la pièce *
                </label>
                <p className="text-[10px] text-gray-400 mt-0.5 mb-1">
                  📷 Tenez votre pièce d'identité bien visible à côté de votre visage
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFile("selfie", e.target.files?.[0] || null, setSelfieFile)}
                  className="w-full mt-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                />
                {previews.selfie && (
                  <img src={previews.selfie} alt="Selfie" className="w-full h-32 object-cover rounded-xl mt-2 border border-gray-200" />
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm">← Retour</button>
              <button
                onClick={() => {
                  if (!idNumber) { showToast("Numéro de pièce requis", "error"); return; }
                  if (!idFrontFile) { showToast("Photo recto requise", "error"); return; }
                  if (!idBackFile) { showToast("Photo verso requise", "error"); return; }
                  if (!selfieFile) { showToast("Selfie requis", "error"); return; }
                  setStep(3);
                }}
                className="flex-1 bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm"
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ========== ÉTAPE 3 — DOCUMENTS VÉHICULE ========== */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-sm dark:text-white">📄 Documents du véhicule</h2>

              {/* Permis */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Permis de conduire *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFile("license", e.target.files?.[0] || null, setLicenseFile)}
                  className="w-full mt-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                />
                {previews.license && (
                  <img src={previews.license} alt="Permis" className="w-full h-32 object-cover rounded-xl mt-2 border border-gray-200" />
                )}
              </div>

              {/* Carte grise / assurance */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Carte grise / Assurance (facultatif)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFile("vehicleDoc", e.target.files?.[0] || null, setVehicleDocFile)}
                  className="w-full mt-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                />
                {previews.vehicleDoc && (
                  <img src={previews.vehicleDoc} alt="Document véhicule" className="w-full h-32 object-cover rounded-xl mt-2 border border-gray-200" />
                )}
              </div>

              {/* Récapitulatif */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">📋 Récapitulatif</p>
                {[
                  { label: "Nom", value: fullName },
                  { label: "Téléphone", value: phone },
                  { label: "Ville", value: city },
                  { label: "Véhicule", value: `${vehicleType} ${vehicleBrand} ${vehicleModel}` },
                  { label: "Plaque", value: vehiclePlate },
                  { label: "Pièce", value: `${idType.replace("_", " ")} – ${idNumber}` },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{row.label}</span>
                    <span className="text-xs font-medium dark:text-white truncate ml-2 max-w-[60%] text-right">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  ℹ️ Votre dossier sera examiné par l'équipe KISI sous 24-48h.
                  Vous recevrez une notification dès que votre compte sera validé.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm">← Retour</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm disabled:opacity-50"
              >
                {submitting ? "Envoi..." : "📤 Envoyer le dossier"}
              </button>
            </div>
          </div>
        )}

        {/* Déconnexion */}
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/");
          }}
          className="w-full mt-4 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm"
        >
          🚪 Se déconnecter
        </button>
      </div>
    </main>
  );
}