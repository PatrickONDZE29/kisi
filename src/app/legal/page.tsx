"use client";

import Link from "next/link";

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 pb-28 transition-colors">

      {/* HEADER */}
      <div className="bg-[#00572D] dark:bg-green-900 px-6 pt-12 pb-10 text-center transition-colors">
        <div className="text-5xl mb-3">⚖️</div>
        <h1 className="text-3xl font-bold text-white">Mentions légales</h1>
        <p className="text-green-100 text-sm mt-2">& Confidentialité</p>
      </div>

      <div className="max-w-lg mx-auto px-5 mt-6 space-y-5">

        {/* QU'EST-CE QUE KISI */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-md transition-colors">
          <h2 className="text-lg font-bold text-[#00572D] dark:text-green-400 mb-3">Qu'est-ce que KISI ?</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            KISI est une plateforme numérique indépendante et gratuite permettant aux utilisateurs de rechercher des médicaments, localiser les pharmacies partenaires, consulter les pharmacies de garde et effectuer des réservations avant de se déplacer.
          </p>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mt-3">
            KISI n'est pas une pharmacie et ne remplace en aucun cas un professionnel de santé. Ce service n'est affilié à aucun ministère ni organisme gouvernemental.
          </p>
        </div>

        {/* SOURCE DES DONNÉES */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-md transition-colors">
          <h2 className="text-lg font-bold text-[#00572D] dark:text-green-400 mb-3">Source des données</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-3">
            Les informations disponibles sur KISI proviennent directement des pharmacies partenaires inscrites sur la plateforme. Chaque pharmacie est responsable de :
          </p>
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2"><span className="text-[#00572D] dark:text-green-400">•</span> Des médicaments qu'elle met à disposition</li>
            <li className="flex items-start gap-2"><span className="text-[#00572D] dark:text-green-400">•</span> Des quantités indiquées dans son stock</li>
            <li className="flex items-start gap-2"><span className="text-[#00572D] dark:text-green-400">•</span> Des prix affichés</li>
            <li className="flex items-start gap-2"><span className="text-[#00572D] dark:text-green-400">•</span> De ses horaires d'ouverture</li>
            <li className="flex items-start gap-2"><span className="text-[#00572D] dark:text-green-400">•</span> De son statut de pharmacie de garde</li>
          </ul>
        </div>

        {/* DONNÉES PERSONNELLES */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-md transition-colors">
          <h2 className="text-lg font-bold text-[#00572D] dark:text-green-400 mb-3">Données personnelles</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-3">KISI respecte votre vie privée :</p>
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2"><span className="text-[#00572D] dark:text-green-400">•</span> Aucun compte n'est nécessaire pour rechercher un médicament</li>
            <li className="flex items-start gap-2"><span className="text-[#00572D] dark:text-green-400">•</span> Les données des comptes sont utilisées uniquement pour le fonctionnement du service</li>
            <li className="flex items-start gap-2"><span className="text-[#00572D] dark:text-green-400">•</span> Les mots de passe sont sécurisés par Supabase Authentication</li>
            <li className="flex items-start gap-2"><span className="text-[#00572D] dark:text-green-400">•</span> Aucune donnée personnelle n'est vendue ou partagée avec des tiers</li>
          </ul>
        </div>

        {/* RÉSERVATIONS */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-md transition-colors">
          <h2 className="text-lg font-bold text-[#00572D] dark:text-green-400 mb-3">Réservations</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            Lorsqu'un utilisateur effectue une réservation, les informations nécessaires sont transmises uniquement à la pharmacie concernée afin de permettre la préparation et le retrait du médicament.
          </p>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mt-3">
            KISI n'intervient pas dans la vente des médicaments ni dans les transactions entre l'utilisateur et la pharmacie.
          </p>
        </div>

        {/* PHARMACIES DE GARDE */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-md transition-colors">
          <h2 className="text-lg font-bold text-[#00572D] dark:text-green-400 mb-3">Pharmacies de garde</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            Les pharmacies de garde affichées sur KISI sont celles qui activent volontairement leur statut depuis leur espace professionnel. KISI ne garantit pas la disponibilité permanente des pharmacies de garde et recommande de contacter la pharmacie avant tout déplacement.
          </p>
        </div>

        {/* STOCKAGE LOCAL */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-md transition-colors">
          <h2 className="text-lg font-bold text-[#00572D] dark:text-green-400 mb-3">Stockage local (localStorage)</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-3">
            KISI peut utiliser le stockage local de votre navigateur pour :
          </p>
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2"><span className="text-[#00572D] dark:text-green-400">•</span> Sauvegarder vos préférences</li>
            <li className="flex items-start gap-2"><span className="text-[#00572D] dark:text-green-400">•</span> Conserver votre thème clair ou sombre</li>
            <li className="flex items-start gap-2"><span className="text-[#00572D] dark:text-green-400">•</span> Améliorer votre expérience utilisateur</li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mt-3">
            Ces informations restent sur votre appareil et ne sont jamais transmises à des tiers.
          </p>
        </div>

        {/* LIMITATION */}
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-3xl p-6 shadow-md border border-orange-100 dark:border-orange-800 transition-colors">
          <h2 className="text-lg font-bold text-orange-600 dark:text-orange-400 mb-3">Limitation de responsabilité</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-3">
            KISI facilite uniquement la mise en relation entre les utilisateurs et les pharmacies. La plateforme ne peut être tenue responsable :
          </p>
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2"><span className="text-orange-500">•</span> D'une rupture de stock</li>
            <li className="flex items-start gap-2"><span className="text-orange-500">•</span> D'une erreur de prix</li>
            <li className="flex items-start gap-2"><span className="text-orange-500">•</span> D'informations inexactes fournies par une pharmacie</li>
            <li className="flex items-start gap-2"><span className="text-orange-500">•</span> De l'indisponibilité d'un médicament</li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mt-3">
            Pour tout conseil médical, veuillez consulter un professionnel de santé.
          </p>
        </div>

        {/* CONTACT */}
        <div className="bg-[#00572D] dark:bg-green-900 rounded-3xl p-6 shadow-md text-white transition-colors">
          <h2 className="text-lg font-bold mb-4">Contact</h2>
          <p className="text-green-100 text-sm mb-4">
            Pour toute question, suggestion ou signalement :
          </p>
          <div className="space-y-3">
            <p className="font-bold text-white text-base">M.PO</p>
            <div className="flex items-center gap-3 text-sm text-green-100">
              <span>📍</span>
              <span>République du Congo</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-green-100">
              <span>📱</span>
              <a href="https://wa.me/242064709296" target="_blank" rel="noopener noreferrer" className="underline">
                +242 06 470 92 96 (WhatsApp)
              </a>
            </div>
            <div className="flex items-center gap-3 text-sm text-green-100">
              <span>📧</span>
              <a href="mailto:patrickondze29@gmail.com" className="underline">
                patrickondze29@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* MISE À JOUR */}
        <div className="text-center text-gray-400 dark:text-gray-500 text-xs pb-2">
          Dernière mise à jour : Juin 2026
        </div>

        {/* LIEN À PROPOS */}
        <div className="text-center pb-4">
          <Link
            href="/about"
            className="text-sm text-[#00572D] dark:text-green-400 underline font-medium"
          >
            ← Retour à À propos de KISI
          </Link>
        </div>

        <p className="text-center text-[#00572D] dark:text-green-400 font-bold pb-4">
          💚 KISI — Votre pharmacie à portée de main.
        </p>

      </div>
    </main>
  );
}