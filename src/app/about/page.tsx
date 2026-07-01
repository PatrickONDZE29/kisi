"use client";

import Link from "next/link";
import { useToast } from "@/components/ToastProviderTemp";
const appUrl = "https://kisi-hqctocwz5-kisi.vercel.app/";



export default function AboutPage() {
  const { showToast } = useToast();

async function copyLink() {
  try {
    await navigator.clipboard.writeText(appUrl);
    showToast("✅ Le lien de KISI a été copié.");
  } catch {
    showToast("❌ Impossible de copier le lien.");
  }
}

async function shareLink() {
  try {
    if (navigator.share) {
      await navigator.share({
        title: "KISI",
        text: "Votre pharmacie à portée de main",
        url: appUrl,
      });
    } else {
      await copyLink();
    }
  } catch {
    console.log("Partage annulé");
  }
}
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 pb-28 transition-colors">

      {/* HEADER */}
      <div className="bg-[#00572D] dark:bg-green-900 px-6 pt-12 pb-10 text-center transition-colors">
        <img src="/logo.png" alt="KISI" className="w-24 h-24 mx-auto object-contain" />
        <h1 className="text-3xl font-bold text-white mt-4">À propos de KISI</h1>
        <p className="text-green-100 text-sm mt-2">Votre pharmacie à portée de main</p>
      </div>

      <div className="max-w-lg mx-auto px-5 mt-6 space-y-5">

        {/* OBJECTIF */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-md transition-colors">
          <h2 className="text-lg font-bold text-[#00572D] dark:text-green-400 mb-3">🎯 Objectif</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            KISI est une plateforme numérique conçue pour permettre aux utilisateurs de localiser rapidement les pharmacies, vérifier la disponibilité des médicaments en temps réel et effectuer des réservations avant de se déplacer.
          </p>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mt-3">
            L'objectif est de rapprocher les patients des pharmacies et de faciliter l'accès aux médicaments partout en République du Congo.
          </p>
        </div>

        {/* FONCTIONNEMENT */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-md transition-colors">
          <h2 className="text-lg font-bold text-[#00572D] dark:text-green-400 mb-3">💊 Fonctionnement</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">Grâce à KISI, les utilisateurs peuvent :</p>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2"><span>✅</span> Rechercher un médicament instantanément</li>
            <li className="flex items-start gap-2"><span>✅</span> Vérifier sa disponibilité dans les pharmacies partenaires</li>
            <li className="flex items-start gap-2"><span>✅</span> Localiser les pharmacies les plus proches</li>
            <li className="flex items-start gap-2"><span>✅</span> Réserver un médicament avant de se déplacer</li>
            <li className="flex items-start gap-2"><span>✅</span> Consulter les informations et horaires d'ouverture des pharmacies</li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mt-3">
            Les pharmacies partenaires disposent d'un espace professionnel leur permettant de gérer leur stock, leurs réservations et les informations de leur établissement.
          </p>
        </div>

        {/* PHARMACIES DE GARDE */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-md transition-colors">
          <h2 className="text-lg font-bold text-[#00572D] dark:text-green-400 mb-3">🌙 Pharmacies de garde</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            KISI permet d'identifier les pharmacies de garde en temps réel. Une pharmacie partenaire peut activer son statut « Pharmacie de garde » depuis son espace professionnel. Dès son activation, elle apparaît instantanément dans la liste accessible à tous les utilisateurs.
          </p>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mt-3">
            Cette fonctionnalité permet aux utilisateurs de trouver rapidement une pharmacie ouverte pendant la nuit, les week-ends ou les jours fériés.
          </p>
        </div>

        {/* POUR LES PHARMACIES */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-md transition-colors">
          <h2 className="text-lg font-bold text-[#00572D] dark:text-green-400 mb-3">📍 Pour les pharmacies</h2>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2"><span>✅</span> Gérer leur stock de médicaments</li>
            <li className="flex items-start gap-2"><span>✅</span> Ajouter des photos et descriptions</li>
            <li className="flex items-start gap-2"><span>✅</span> Recevoir les réservations des utilisateurs</li>
            <li className="flex items-start gap-2"><span>✅</span> Activer ou désactiver le statut « Pharmacie de garde »</li>
            <li className="flex items-start gap-2"><span>✅</span> Mettre à jour leurs horaires d'ouverture</li>
            <li className="flex items-start gap-2"><span>✅</span> Personnaliser leur profil et leurs informations de contact</li>
          </ul>
        </div>

        {/* AVERTISSEMENT */}
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-3xl p-6 shadow-md border border-orange-100 dark:border-orange-800 transition-colors">
          <h2 className="text-lg font-bold text-orange-600 dark:text-orange-400 mb-3">⚖️ Avertissement</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            KISI n'est ni une pharmacie ni un établissement médical. La plateforme facilite uniquement la mise en relation entre les utilisateurs et les pharmacies partenaires.
          </p>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mt-3">
            Pour tout conseil médical, veuillez consulter un professionnel de santé.
          </p>
        </div>

        {/* CREDITS */}
        <div className="bg-[#00572D] dark:bg-green-900 rounded-3xl p-6 shadow-md text-white transition-colors">
          <h2 className="text-lg font-bold mb-3">👨‍💻 Crédits</h2>
          <p className="text-sm leading-relaxed text-green-100">
            KISI a été imaginé et développé par <span className="font-bold text-white">M.PO</span>, entrepreneur digital passionné de technologie et d'innovation, avec pour ambition de moderniser l'accès aux médicaments et aux services pharmaceutiques au Congo.
          </p>
          <p className="text-sm text-green-100 mt-2">📍 République du Congo</p>
        </div>

        {/* VISION */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-md transition-colors">
          <h2 className="text-lg font-bold text-[#00572D] dark:text-green-400 mb-3">🚀 Vision</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            KISI ambitionne de devenir la plateforme de référence pour la recherche de médicaments, la gestion des pharmacies de garde et la digitalisation des services pharmaceutiques en République du Congo et en Afrique centrale.
          </p>
        </div>

         {/* PARTAGER */}
<div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-md text-center transition-colors">

  <h2 className="text-lg font-bold text-[#00572D] dark:text-green-400 mb-4">
    🔗 Partager KISI
  </h2>

  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
    Vous connaissez quelqu'un qui cherche un médicament ou une pharmacie de garde ?
    Partagez KISI autour de vous — c'est gratuit et accessible à tous.
  </p>

  <a
    href={appUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="block break-all text-blue-600 dark:text-blue-400 underline font-medium hover:text-blue-800"
  >
    {appUrl}
  </a>

  <div className="flex gap-3 mt-5">

    <button
      onClick={copyLink}
      className="flex-1 bg-[#00572D] text-white py-3 rounded-xl font-bold hover:opacity-90 transition"
    >
      📋 Copier le lien
    </button>

    <button
      onClick={shareLink}
      className="flex-1 border-2 border-[#00572D] text-[#00572D] dark:text-green-400 py-3 rounded-xl font-bold hover:bg-[#00572D] hover:text-white transition"
    >
      📤 Partager
    </button>

  </div>

</div>

        {/* LIEN MENTIONS LÉGALES */}
        <div className="text-center pb-4">
          <Link
            href="/legal"
            className="text-sm text-[#00572D] dark:text-green-400 underline font-medium"
          >
            Consulter les mentions légales & confidentialité →
          </Link>
        </div>

        <p className="text-center text-[#00572D] dark:text-green-400 font-bold pb-4">
          💚 Votre pharmacie à portée de main.
        </p>

      </div>
    </main>
  );
}