"use client";

import Link from "next/link";

export default function VerificationPharmaciesPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-6 py-10">

      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-3xl shadow-lg p-6">

        {/* HEADER */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-yellow-400 flex items-center justify-center text-white text-2xl font-bold">
            !
          </div>

          <h1 className="text-2xl font-bold text-[#00572D] mt-3">
            🔐 Vérification des pharmacies
          </h1>
        </div>

        {/* CONTENT */}
        <div className="text-gray-700 dark:text-gray-300 space-y-4 text-sm leading-relaxed">

          <p>
            Cette plateforme référence uniquement les pharmacies enregistrées
            auprès de l’Ordre National des Pharmaciens du Congo(ONPC).
          </p>

          <p>
            L’absence d’une pharmacie signifie qu’elle n’est pas encore
            certifiée par l’instance officielle.
          </p>

          <p>
            Pour figurer sur cette plateforme, une pharmacie doit être
            préalablement enregistrée et validée par l’Ordre National des
            Pharmaciens du Congo(ONPC).
          </p>

          {/* 🔥 AJOUT DU LIEN OFFICIEL À LA FIN */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">

            <p className="text-sm">
              🔗 Site officiel de l’Ordre National des Pharmaciens du Congo(ONPC) :
            </p>

            <a
              href="https://ordredespharmaciens.cg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00572D] font-semibold underline hover:opacity-80 transition"
            >
              https://ordredespharmaciens.cg
            </a>

          </div>

        </div>

        {/* ACTION */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-block bg-[#00572D] text-white px-6 py-3 rounded-xl font-bold"
          >
            Retour à l’accueil
          </Link>
        </div>

      </div>
    </main>
  );
}