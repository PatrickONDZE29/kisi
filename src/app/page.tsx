"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { motion, cubicBezier } from "framer-motion";

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [showPharmacyModal, setShowPharmacyModal] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);

  useEffect(() => {
    loadUser();
    const timer = setTimeout(() => setBgLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (data) setRole(data.role);
  }

  function pharmacyAccess() {
    if (role !== "pharmacy") setShowPharmacyModal(true);
  }

  const fromLeft = {
    hidden: { opacity: 0, x: -80 },
    visible: { opacity: 1, x: 0 }
  };

  const fromRight = {
    hidden: { opacity: 0, x: 80 },
    visible: { opacity: 1, x: 0 }
  };

  const fromBottom = {
    hidden: { opacity: 0, y: 80 },
    visible: { opacity: 1, y: 0 }
  };

  const float = {
    animate: {
      y: [0, -10, 0],
    },
    transition: {
      duration: 3.5,
      repeat: Infinity,
      ease: cubicBezier(0.42, 0, 0.58, 1)
    }
  };

  return (
    <main className="min-h-screen relative overflow-hidden text-black dark:text-white transition-colors">

      {/* ========== IMAGE 1 — DROITE VERS CENTRE ========== */}
      <div
        className={`absolute top-0 left-0 w-full h-[55%] transition-all duration-[1500ms] ease-out ${
          bgLoaded
            ? "translate-x-0 opacity-100 scale-100"
            : "translate-x-full opacity-0 scale-110"
        }`}
      >
        <img
          src="/accueil1.png"
          alt="Fond haut"
          className="w-full h-full object-cover object-center sm:object-top"
        />
      </div>

      {/* ========== IMAGE 2 — GAUCHE VERS CENTRE ========== */}
      <div
        className={`absolute bottom-0 left-0 w-full h-[55%] transition-all duration-[1500ms] ease-out delay-300 ${
          bgLoaded
            ? "translate-x-0 opacity-100 scale-100"
            : "-translate-x-full opacity-0 scale-110"
        }`}
      >
        <img
          src="/accueil2.png"
          alt="Fond bas"
          className="w-full h-full object-cover object-center sm:object-bottom"
        />
      </div>

      {/* ========== OVERLAY — plus opaque en clair ========== */}
      <div className="absolute inset-0 bg-white/85 dark:bg-gray-950/85" />

      {/* ========== CONTENU ========== */}
      <div className="relative z-10">

        {/* MODAL */}
        {showPharmacyModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 sm:p-6">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl">
              <div className="text-center">
                <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">⚠️</div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#00572D]">Espace Pharmacie</h2>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Cet espace est réservé aux pharmacies.
                </p>
              </div>

              <div className="mt-5 sm:mt-6 space-y-3">
                <button
                  onClick={() => {
                    setShowPharmacyModal(false);
                    router.push("/register?role=pharmacy");
                  }}
                  className="w-full bg-[#00572D] text-white p-3 sm:p-4 rounded-xl text-sm"
                >
                  Créer un compte pharmacie
                </button>

                <button
                  onClick={() => {
                    setShowPharmacyModal(false);
                    router.push("/login");
                  }}
                  className="w-full border-2 border-[#00572D] text-[#00572D] p-3 sm:p-4 rounded-xl text-sm"
                >
                  Se connecter
                </button>

                <button
                  onClick={() => setShowPharmacyModal(false)}
                  className="w-full bg-gray-200 dark:bg-gray-800 p-3 sm:p-4 rounded-xl text-sm"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HERO */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fromBottom}
          transition={{ duration: 0.6 }}
          className="px-4 sm:px-6 pt-4"
        >
          <div className="max-w-md mx-auto text-center">
            <motion.img
              src="/logo.png"
              alt="KISI"
              className="w-48 h-48 sm:w-64 sm:h-64 mx-auto object-contain drop-shadow-xl"
              animate={float.animate}
              transition={float.transition}
            />
          </div>
        </motion.section>

        {/* SEARCH */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fromLeft}
          className="px-4 sm:px-6 mt-4 sm:mt-6"
        >
          <div className="max-w-md mx-auto">
            <Link href="/search"
              className="block bg-[#00572D] text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-lg sm:text-xl">Rechercher un médicament</h2>
                  <p className="text-green-100 text-xs sm:text-sm mt-1">
                    Vérifiez instantanément sa disponibilité
                  </p>
                </div>
                <div className="text-2xl sm:text-3xl">🔍</div>
              </div>
            </Link>
          </div>
        </motion.section>

        {/* AUTH */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fromRight}
          className="px-4 sm:px-6 mt-4 sm:mt-6"
        >
          <div className="max-w-md mx-auto space-y-3">

            {!role && (
              <>
                <Link href="/login"
                  className="block bg-[#00572D] text-white text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl font-bold text-sm"
                >
                  Connexion Pharmacie
                </Link>

                <Link href="/register?role=pharmacy"
                  className="block border-2 border-[#00572D] text-[#00572D] text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl font-bold text-sm"
                >
                  Inscrire ma pharmacie
                </Link>
              </>
            )}

            {role === "user" && (
              <>
                <Link href="/reservations"
                  className="block bg-[#00572D] text-white text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl font-bold text-sm"
                >
                  Mes réservations
                </Link>

                <Link href="/dashboard/user"
                  className="block border-2 border-[#00572D] text-[#00572D] text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl font-bold text-sm"
                >
                  Mon compte
                </Link>
              </>
            )}

          </div>
        </motion.section>

        {/* ACTIONS */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fromBottom}
          className="px-4 sm:px-6 mt-6 sm:mt-8"
        >
          <div className="max-w-md mx-auto space-y-3 sm:space-y-4">

            <Link href="/map"
              className="block bg-[#00572D] text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-lg sm:text-xl">Trouver une pharmacie</h2>
                  <p className="text-green-100 text-xs sm:text-sm mt-1">
                    Pharmacies proches de vous
                  </p>
                </div>
                <div className="text-2xl sm:text-3xl">📍</div>
              </div>
            </Link>

            {role === "pharmacy" ? (
              <Link href="/dashboard/pharmacy"
                className="block bg-[#00572D] text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="font-bold text-lg sm:text-xl">Espace Pharmacie</h2>
                    <p className="text-green-100 text-xs sm:text-sm mt-1">
                      Gestion des stocks et réservations
                    </p>
                  </div>
                  <div className="text-2xl sm:text-3xl">🏥</div>
                </div>
              </Link>
            ) : (
              <button
                onClick={pharmacyAccess}
                className="w-full bg-[#00572D] text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg"
              >
                <div className="flex justify-between items-center">
                  <div className="text-left">
                    <h2 className="font-bold text-lg sm:text-xl">Espace Pharmacie</h2>
                    <p className="text-green-100 text-xs sm:text-sm mt-1">
                      Gestion des stocks et réservations
                    </p>
                  </div>
                  <div className="text-2xl sm:text-3xl">🏥</div>
                </div>
              </button>
            )}

          </div>
        </motion.section>

        {/* PHARMACIES DE GARDE */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fromLeft}
          className="px-4 sm:px-6 mt-8 sm:mt-10"
        >
          <div className="max-w-md mx-auto">
            <Link
              href="/pharmacies-de-garde"
              className="block bg-[#00572D] rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-center text-white shadow-lg"
            >
              <div className="text-4xl sm:text-5xl">🏥</div>
              <h3 className="font-bold text-lg sm:text-xl mt-2 sm:mt-3">Pharmacies de garde</h3>
              <p className="text-xs sm:text-sm text-green-100 mt-1">
                Voir les pharmacies disponibles maintenant
              </p>
            </Link>
          </div>
        </motion.section>

        {/* POURQUOI KISI */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fromRight}
          className="px-4 sm:px-6 mt-8 sm:mt-10"
        >
          <div className="max-w-md mx-auto bg-[#00572D] rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-white">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Pourquoi utiliser KISI ?</h2>
            <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
              <li>✅ Trouver un médicament rapidement</li>
              <li>✅ Localiser la pharmacie la plus proche</li>
              <li>✅ Voir les pharmacies de garde disponibles</li>
              <li>✅ Vérifier les stocks en temps réel</li>
              <li>✅ Réserver avant de se déplacer</li>
            </ul>
          </div>
        </motion.section>

        {/* FOOTER */}
        <motion.footer
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fromBottom}
          className="text-center mt-16 sm:mt-24 pb-12 sm:pb-16"
        >
          <p className="text-[#00572D] font-medium text-sm sm:text-base drop-shadow">
            Votre pharmacie à portée de main
          </p>

          <p className="text-xs sm:text-sm text-[#00572D] mt-2 drop-shadow">
            © 2026 KISI
          </p>

          <div className="flex flex-wrap justify-center items-center gap-x-2 sm:gap-x-3 gap-y-2 mt-3 sm:mt-4 px-4">
            <Link
              href="/about"
              className="text-[10px] sm:text-xs text-[#00572D] underline whitespace-nowrap"
            >
              À propos
            </Link>

            <span className="text-gray-400 text-xs">|</span>

            <Link
              href="/legal"
              className="text-[10px] sm:text-xs text-[#00572D] underline whitespace-nowrap"
            >
              Mentions légales
            </Link>

            <span className="text-gray-400 text-xs">|</span>

            <Link
              href="/verification-pharmacies"
              className="text-[10px] sm:text-xs text-[#00572D] underline whitespace-nowrap flex items-center gap-1"
            >
              <span>🔐</span>
              Vérification des pharmacies
            </Link>
          </div>
        </motion.footer>

      </div>
    </main>
  );
}