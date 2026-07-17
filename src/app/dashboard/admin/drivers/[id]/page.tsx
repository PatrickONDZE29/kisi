"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProviderTemp";

export default function DriverDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<any>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showRefuseModal, setShowRefuseModal] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const REFUSE_REASONS = [
    "Pièce d'identité illisible",
    "Documents incomplets",
    "Véhicule non conforme",
    "Informations incohérentes",
    "Photo de mauvaise qualité",
    "Permis manquant",
    "Demande refusée",
  ];

  useEffect(() => {
    loadDriver();
  }, [id]);

  async function loadDriver() {
    // ✅ Requête complète avec toutes les colonnes
    const { data, error } = await supabase
      .from("driver_profiles")
      .select(`
        id,
        user_id,
        full_name,
        phone,
        city,
        address,
        is_verified,
        is_available,
        vehicle_type,
        vehicle_brand,
        vehicle_model,
        vehicle_color,
        vehicle_plate,
        vehicle_photo_url,
        vehicle_plate_photo_url,
        vehicle_doc_url,
        id_type,
        id_number,
        identity_doc_url,
        identity_doc_back_url,
        selfie_url,
        license_url,
        rejection_reason,
        dossier_submitted_at,
        created_at,
        rating,
        total_deliveries,
        total_earnings,
        users(email)
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Erreur chargement dossier:", error);
      showToast("Erreur : " + error.message, "error");
      setLoading(false);
      return;
    }

    console.log("Dossier chargé:", data);
    setDriver(data);
    setLoading(false);
  }

  async function approveDriver() {
    if (!driver) return;
    setProcessing(true);

    const { error } = await supabase
      .from("driver_profiles")
      .update({ is_verified: true, rejection_reason: null })
      .eq("id", driver.id);

    if (error) {
      showToast(error.message, "error");
      setProcessing(false);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: driver.user_id,
      type: "system",
      title: "Dossier validé ✅",
      body: "Félicitations ! Votre dossier a été validé. Votre compte livreur KISI est maintenant actif. Vous pouvez commencer à recevoir des livraisons.",
    });

    showToast("Livreur validé ✅");
    setProcessing(false);
    router.push("/dashboard/admin");
  }

  async function refuseDriver() {
    if (!driver || !refuseReason.trim()) {
      showToast("Sélectionnez un motif de refus", "error");
      return;
    }

    setProcessing(true);

    const { error } = await supabase
      .from("driver_profiles")
      .update({
        is_verified: false,
        rejection_reason: refuseReason,
      })
      .eq("id", driver.id);

    if (error) {
      showToast(error.message, "error");
      setProcessing(false);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: driver.user_id,
      type: "system",
      title: "Dossier refusé ❌",
      body: `Votre dossier n'a pas pu être validé. Motif : ${refuseReason}. Merci de corriger votre dossier et de le soumettre à nouveau.`,
    });

    showToast("Demande refusée");
    setShowRefuseModal(false);
    setProcessing(false);
    router.push("/dashboard/admin");
  }

  function DocImage({ url, label }: { url: string | null | undefined; label: string }) {
    if (!url) {
      return (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</p>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl h-28 flex items-center justify-center text-gray-400 dark:text-gray-600 text-xs">
            Non fourni
          </div>
        </div>
      );
    }

    return (
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <img
          src={url}
          alt={label}
          onClick={() => setZoomedImage(url)}
          className="w-full h-36 object-cover rounded-xl border border-gray-200 dark:border-gray-700 cursor-zoom-in hover:opacity-90 transition"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl">
          <p className="text-[#00572D] dark:text-green-400 font-bold">Chargement du dossier...</p>
        </div>
      </main>
    );
  }

  if (!driver) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-3">❌</div>
          <p className="text-gray-500 dark:text-gray-400">Dossier introuvable</p>
          <p className="text-xs text-gray-400 mt-1">ID: {id}</p>
          <button
            onClick={() => router.push("/dashboard/admin")}
            className="mt-3 bg-[#00572D] text-white px-5 py-2.5 rounded-xl font-bold text-sm"
          >
            Retour admin
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      <div className="max-w-lg mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.push("/dashboard/admin")}
            className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm font-bold text-gray-600 dark:text-gray-300"
          >
            ←
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#00572D] dark:text-green-400">
              Dossier Livreur
            </h1>
            <p className="text-xs text-gray-400">
              Soumis le{" "}
              {driver.dossier_submitted_at
                ? new Date(driver.dossier_submitted_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : new Date(driver.created_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>

        {/* Statut */}
        <div className={`rounded-xl p-3 text-center mb-4 ${
          driver.is_verified
            ? "bg-green-50 dark:bg-green-900/20"
            : driver.rejection_reason
            ? "bg-red-50 dark:bg-red-900/20"
            : "bg-yellow-50 dark:bg-yellow-900/20"
        }`}>
          <p className={`text-sm font-bold ${
            driver.is_verified
              ? "text-green-700 dark:text-green-400"
              : driver.rejection_reason
              ? "text-red-600 dark:text-red-400"
              : "text-yellow-700 dark:text-yellow-400"
          }`}>
            {driver.is_verified
              ? "✅ Compte validé"
              : driver.rejection_reason
              ? "❌ Dossier refusé"
              : "⏳ En attente de validation"}
          </p>
          {driver.rejection_reason && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">
              Motif : {driver.rejection_reason}
            </p>
          )}
        </div>

        {/* ========== INFOS PERSONNELLES ========== */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-4">
          <p className="font-bold text-sm mb-3 dark:text-white">👤 Informations personnelles</p>

          <div className="flex items-center gap-3 mb-4">
            {driver.photo_url ? (
              <img src={driver.photo_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-[#00572D]" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#00572D] flex items-center justify-center text-white text-xl font-bold">
                {driver.full_name?.charAt(0) || "?"}
              </div>
            )}
            <div>
              <p className="font-bold dark:text-white">{driver.full_name || "—"}</p>
              <p className="text-xs text-gray-400">📞 {driver.phone || "—"}</p>
              {driver.users?.email && (
                <p className="text-xs text-gray-400">✉️ {driver.users.email}</p>
              )}
            </div>
          </div>

          {[
            { label: "Ville", value: driver.city },
            { label: "Adresse", value: driver.address },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">{row.label}</span>
              <span className="text-xs font-medium dark:text-white">{row.value || "—"}</span>
            </div>
          ))}
        </div>

        {/* ========== PIÈCE D'IDENTITÉ ========== */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-4">
          <p className="font-bold text-sm mb-3 dark:text-white">🪪 Pièce d'identité</p>

          {[
            { label: "Type", value: driver.id_type?.replace("_", " ") },
            { label: "Numéro", value: driver.id_number },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0 mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">{row.label}</span>
              <span className="text-xs font-medium dark:text-white capitalize">{row.value || "—"}</span>
            </div>
          ))}

          <div className="grid grid-cols-1 gap-3 mt-3">
            <DocImage url={driver.identity_doc_url} label="Pièce d'identité — Recto" />
            <DocImage url={driver.identity_doc_back_url} label="Pièce d'identité — Verso" />
            <DocImage url={driver.selfie_url} label="Selfie avec la pièce d'identité" />
          </div>
        </div>

        {/* ========== VÉHICULE ========== */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-4">
          <p className="font-bold text-sm mb-3 dark:text-white">
            {driver.vehicle_type === "moto" ? "🏍️" : "🚗"} Véhicule
          </p>

          {[
            { label: "Type", value: driver.vehicle_type },
            { label: "Marque", value: driver.vehicle_brand },
            { label: "Modèle", value: driver.vehicle_model },
            { label: "Couleur", value: driver.vehicle_color },
            { label: "Immatriculation", value: driver.vehicle_plate },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">{row.label}</span>
              <span className="text-xs font-medium dark:text-white capitalize">{row.value || "—"}</span>
            </div>
          ))}

          <div className="grid grid-cols-1 gap-3 mt-4">
            <DocImage url={driver.vehicle_photo_url} label="Photo du véhicule" />
            <DocImage url={driver.vehicle_plate_photo_url} label="Plaque d'immatriculation" />
            <DocImage url={driver.license_url} label="Permis de conduire" />
            <DocImage url={driver.vehicle_doc_url} label="Carte grise / Assurance" />
          </div>
        </div>

        {/* ========== ACTIONS ========== */}
        {!driver.is_verified && (
          <div className="space-y-3 mt-2">
            <button
              onClick={approveDriver}
              disabled={processing}
              className="w-full bg-green-600 hover:bg-green-700 text-white p-4 rounded-xl font-bold text-sm disabled:opacity-50 transition"
            >
              {processing ? "Traitement..." : "✅ Accepter le dossier"}
            </button>

            <button
              onClick={() => setShowRefuseModal(true)}
              disabled={processing}
              className="w-full bg-red-600 hover:bg-red-700 text-white p-4 rounded-xl font-bold text-sm disabled:opacity-50 transition"
            >
              ❌ Refuser le dossier
            </button>
          </div>
        )}

        {driver.is_verified && (
          <div className="space-y-3 mt-2">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
              <p className="text-green-700 dark:text-green-400 font-bold text-sm">
                ✅ Ce livreur est déjà validé
              </p>
            </div>
            <button
              onClick={() => setShowRefuseModal(true)}
              disabled={processing}
              className="w-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl font-bold text-sm disabled:opacity-50 transition"
            >
              Révoquer la validation
            </button>
          </div>
        )}
      </div>

      {/* ========== ZOOM IMAGE ========== */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-[99999] flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <img
            src={zoomedImage}
            alt="Zoom"
            className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 text-white text-2xl bg-black/50 w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/80 transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========== MODAL REFUS ========== */}
      {showRefuseModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-[#00572D] dark:text-green-400 mb-1">
              Motif du refus
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Sélectionnez un motif ou saisissez le vôtre.
            </p>

            <div className="space-y-2 mb-4">
              {REFUSE_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setRefuseReason(reason)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-medium border-2 transition ${
                    refuseReason === reason
                      ? "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-600 dark:text-red-400"
                      : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Motif personnalisé
              </label>
              <textarea
                value={refuseReason}
                onChange={(e) => setRefuseReason(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs dark:text-white"
                placeholder="Ex: Documents non conformes..."
                rows={2}
              />
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowRefuseModal(false); setRefuseReason(""); }}
                className="flex-1 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm"
              >
                Annuler
              </button>
              <button
                onClick={refuseDriver}
                disabled={processing || !refuseReason.trim()}
                className="flex-1 bg-red-600 text-white p-3 rounded-xl font-bold text-sm disabled:opacity-50"
              >
                {processing ? "..." : "Confirmer le refus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}