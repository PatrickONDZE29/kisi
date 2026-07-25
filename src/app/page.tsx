"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { motion, cubicBezier } from "framer-motion";

// =====================================================
// BANDEAU LIVREUR
// =====================================================
function DriverMissionsBanner({ role }: { role: string | null }) {
  const router = useRouter();
  const [missions, setMissions] = useState<{ pharmacy_id: string; pharmacy_name: string; count: number }[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (role !== "driver") return;
    checkVerified();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [role]);

  async function checkVerified() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: driverData } = await supabase
      .from("driver_profiles")
      .select("is_verified")
      .eq("user_id", user.id)
      .single();

    if (!driverData?.is_verified) return;

    setIsVerified(true);
    await loadMissions();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel("home-driver-missions")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        loadMissions();
      })
      .subscribe();

    channelRef.current = channel;
  }

  async function loadMissions() {
    const { data } = await supabase
      .from("orders")
      .select("pharmacy_id, pharmacies(name)")
      .eq("status", "ready")
      .is("driver_id", null);

    if (!data) return;

    const grouped: Record<string, { pharmacy_id: string; pharmacy_name: string; count: number }> = {};
    for (const order of data) {
      const id = order.pharmacy_id;
      if (!grouped[id]) {
        grouped[id] = {
          pharmacy_id: id,
          pharmacy_name: (order.pharmacies as any)?.name || "Pharmacie",
          count: 0,
        };
      }
      grouped[id].count++;
    }

    setMissions(Object.values(grouped).filter(m => m.count > 0));
  }

  if (role !== "driver" || !isVerified || missions.length === 0) return null;

  const totalMissions = missions.reduce((s, m) => s + m.count, 0);
  const items = [...missions, ...missions, ...missions];

  return (
    <div className="max-w-md mx-auto mb-4">
      <div className="w-full overflow-hidden bg-[#00572D] rounded-2xl shadow-lg border border-green-700">
        <div className="px-4 py-2 flex items-center gap-2 border-b border-green-700">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
          <p className="text-xs font-bold text-white">
            🏍️ {totalMissions} mission{totalMissions > 1 ? "s" : ""} disponible{totalMissions > 1 ? "s" : ""} maintenant
          </p>
        </div>
        <div className="relative overflow-hidden py-2.5 px-1">
          <div
            className="flex gap-3"
            style={{
              animation: `driverScroll ${Math.max(15, items.length * 4)}s linear infinite`,
              width: "max-content",
            }}
          >
            {items.map((m, idx) => (
              <button
                key={`${m.pharmacy_id}-${idx}`}
                onClick={() => router.push(`/dashboard/driver?tab=missions&pharmacy=${m.pharmacy_id}`)}
                className="inline-flex items-center gap-2 bg-green-700/60 hover:bg-green-600/80 px-3 py-1.5 rounded-xl transition shrink-0 active:scale-95"
              >
                <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shrink-0 shadow-sm">
                  {m.count > 9 ? "9+" : m.count}
                </span>
                <span className="text-xs font-bold text-white whitespace-nowrap">{m.pharmacy_name}</span>
                <span className="text-[10px] text-green-200">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes driverScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
      `}</style>
    </div>
  );
}

// =====================================================
// BANDEAU PHARMACIE
// =====================================================
function PharmacyHomeBanner({ role }: { role: string | null }) {
  const router = useRouter();
  const [items, setItems] = useState<{ id: string; label: string; sub: string; href: string }[]>([]);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (role !== "pharmacy") return;
    loadPharmacyData();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [role]);

  async function loadPharmacyData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: pharmacyData } = await supabase
      .from("pharmacies")
      .select("id, name")
      .eq("user_id", user.id)
      .single();

    if (!pharmacyData) return;

    setPharmacyId(pharmacyData.id);
    await loadAll(pharmacyData.id);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`home-pharmacy-${pharmacyData.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `pharmacy_id=eq.${pharmacyData.id}`,
      }, () => loadAll(pharmacyData.id))
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "reservations",
        filter: `pharmacy_id=eq.${pharmacyData.id}`,
      }, () => loadAll(pharmacyData.id))
      .subscribe();

    channelRef.current = channel;
  }

  async function loadAll(phId: string) {
    const { data: ordersData } = await supabase
      .from("orders")
      .select("id, total, created_at")
      .eq("pharmacy_id", phId)
      .eq("status", "payment_confirmed")
      .order("created_at", { ascending: false })
      .limit(8);

    const { data: resData } = await supabase
      .from("reservations")
      .select("id, customer_name, created_at, medicines(name)")
      .eq("pharmacy_id", phId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(8);

    const all = [
      ...(ordersData || []).map(o => ({
        id: o.id,
        label: `💳 ${(o.total || 0).toLocaleString()} FCFA — Commande payée`,
        sub: getTimeAgo(o.created_at),
        href: "/dashboard/pharmacy/orders",
      })),
      ...(resData || []).map(r => ({
        id: r.id,
        label: `📋 ${r.customer_name || "Client"} — ${(r.medicines as any)?.name || "Médicament"}`,
        sub: getTimeAgo(r.created_at),
        href: "/dashboard/pharmacy/reservations",
      })),
    ];

    setItems(all);
  }

  if (role !== "pharmacy" || items.length === 0) return null;

  const duplicated = [...items, ...items, ...items];

  return (
    <div className="max-w-md mx-auto mb-4">
      <div className="w-full overflow-hidden bg-[#00572D] rounded-2xl shadow-lg border border-green-700">
        <div className="px-4 py-2 flex items-center gap-2 border-b border-green-700">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
          <p className="text-xs font-bold text-white">
            🏥 {items.length} nouvelle{items.length > 1 ? "s" : ""} action{items.length > 1 ? "s" : ""} en attente
          </p>
        </div>
        <div className="relative overflow-hidden py-2.5 px-1">
          <div
            className="flex gap-3"
            style={{
              animation: `pharmacyHomeScroll ${Math.max(15, duplicated.length * 5)}s linear infinite`,
              width: "max-content",
            }}
          >
            {duplicated.map((item, idx) => (
              <button
                key={`${item.id}-${idx}`}
                onClick={() => router.push(item.href)}
                className="inline-flex items-center gap-2 bg-green-700/60 hover:bg-green-600/80 px-3 py-1.5 rounded-xl transition shrink-0 active:scale-95"
              >
                <span className="w-2 h-2 bg-red-400 rounded-full shrink-0 animate-pulse" />
                <div className="text-left">
                  <p className="text-xs font-bold text-white whitespace-nowrap">{item.label}</p>
                  <p className="text-[10px] text-green-200 whitespace-nowrap">Il y a {item.sub}</p>
                </div>
                <span className="text-[10px] text-green-200">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes pharmacyHomeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
      `}</style>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "quelques secondes";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}j`;
}

// =====================================================
// PAGE ACCUEIL
// =====================================================
export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = useState<"user" | "pharmacy" | "admin" | "driver" | null>(null);
  const [showPharmacyModal, setShowPharmacyModal] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);

  useEffect(() => {
    loadUser();
    const timer = setTimeout(() => setBgLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setRole(null); return; }

    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (data?.role) setRole(data.role as any);
    else setRole(null);
  }

  function pharmacyAccess() {
    if (role !== "pharmacy") setShowPharmacyModal(true);
  }

  const fromLeft = { hidden: { opacity: 0, x: -80 }, visible: { opacity: 1, x: 0 } };
  const fromRight = { hidden: { opacity: 0, x: 80 }, visible: { opacity: 1, x: 0 } };
  const fromBottom = { hidden: { opacity: 0, y: 80 }, visible: { opacity: 1, y: 0 } };
  const float = {
    animate: { y: [0, -10, 0] },
    transition: { duration: 3.5, repeat: Infinity, ease: cubicBezier(0.42, 0, 0.58, 1) },
  };

  return (
    <main className="min-h-screen relative overflow-hidden text-black dark:text-white transition-colors">

      {/* IMAGES FOND */}
      <div className={`absolute top-0 left-0 w-full h-[55%] transition-all duration-[1500ms] ease-out ${bgLoaded ? "translate-x-0 opacity-100 scale-100" : "translate-x-full opacity-0 scale-110"}`}>
        <img src="/accueil1.png" alt="Fond haut" className="w-full h-full object-cover object-center sm:object-top" />
      </div>
      <div className={`absolute bottom-0 left-0 w-full h-[55%] transition-all duration-[1500ms] ease-out delay-300 ${bgLoaded ? "translate-x-0 opacity-100 scale-100" : "-translate-x-full opacity-0 scale-110"}`}>
        <img src="/accueil2.png" alt="Fond bas" className="w-full h-full object-cover object-center sm:object-bottom" />
      </div>
      <div className="absolute inset-0 bg-white/93 dark:bg-gray-950/85" />

      <div className="relative z-10">

        {/* MODAL PHARMACIE */}
        {showPharmacyModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 sm:p-6">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl">
              <div className="text-center">
                <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">⚠️</div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#00572D]">Espace Pharmacie</h2>
                <p className="text-gray-600 dark:text-gray-300 text-sm">Cet espace est réservé aux pharmacies.</p>
              </div>
              <div className="mt-5 sm:mt-6 space-y-3">
                <button onClick={() => { setShowPharmacyModal(false); router.push("/register?role=pharmacy"); }} className="w-full bg-[#00572D] text-white p-3 sm:p-4 rounded-xl text-sm">
                  Créer un compte pharmacie
                </button>
                <button onClick={() => { setShowPharmacyModal(false); router.push("/login"); }} className="w-full border-2 border-[#00572D] text-[#00572D] p-3 sm:p-4 rounded-xl text-sm">
                  Se connecter
                </button>
                <button onClick={() => setShowPharmacyModal(false)} className="w-full bg-gray-200 dark:bg-gray-800 p-3 sm:p-4 rounded-xl text-sm">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HERO */}
        <motion.section initial="hidden" animate="visible" variants={fromBottom} transition={{ duration: 0.6 }} className="px-4 sm:px-6 pt-4">
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

        {/* ✅ BANDEAU LIVREUR */}
        {role === "driver" && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fromBottom}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="px-4 sm:px-6 mt-4"
          >
            <DriverMissionsBanner role={role} />
          </motion.div>
        )}

        {/* ✅ BANDEAU PHARMACIE */}
        {role === "pharmacy" && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fromBottom}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="px-4 sm:px-6 mt-4"
          >
            <PharmacyHomeBanner role={role} />
          </motion.div>
        )}

        {/* ✅ BOUTON LIVREUR */}
        {role === "driver" && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fromLeft} className="px-4 sm:px-6 mt-2">
            <div className="max-w-md mx-auto">
              <Link href="/dashboard/driver" className="block bg-[#00572D] text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="font-bold text-lg sm:text-xl">🏍️ Mon espace livreur</h2>
                    <p className="text-green-100 text-xs sm:text-sm mt-1">Missions disponibles · Gains · Historique</p>
                  </div>
                  <div className="text-2xl sm:text-3xl">→</div>
                </div>
              </Link>
            </div>
          </motion.section>
        )}

        {/* SEARCH — masqué pour livreurs */}
        {role !== "driver" && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fromLeft} className="px-4 sm:px-6 mt-4 sm:mt-6">
            <div className="max-w-md mx-auto">
              <Link href="/search" className="block bg-[#00572D] text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="font-bold text-lg sm:text-xl">Rechercher un médicament</h2>
                    <p className="text-green-100 text-xs sm:text-sm mt-1">Vérifiez instantanément sa disponibilité</p>
                  </div>
                  <div className="text-2xl sm:text-3xl">🔍</div>
                </div>
              </Link>
            </div>
          </motion.section>
        )}

        {/* BLOC RÔLE */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fromRight} className="px-4 sm:px-6 mt-4 sm:mt-6">
          <div className="max-w-md mx-auto space-y-3">

            {!role && (
              <>
                <Link href="/login" className="block bg-[#00572D] text-white text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl font-bold text-sm">
                  Connexion Pharmacie
                </Link>
                <Link href="/register?role=pharmacy" className="block border-2 border-[#00572D] text-[#00572D] text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl font-bold text-sm">
                  Inscrire ma pharmacie
                </Link>
              </>
            )}

            {role === "user" && (
              <>
                <Link href="/reservations" className="block bg-[#00572D] text-white text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl font-bold text-sm">
                  Mes réservations
                </Link>
                <Link href="/dashboard/user" className="block border-2 border-[#00572D] text-[#00572D] text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl font-bold text-sm">
                  Mon compte
                </Link>
              </>
            )}

            {/* ✅ BOUTON PHARMACIE */}
            {role === "pharmacy" && (
              <Link href="/dashboard/pharmacy" className="block bg-[#00572D] text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="font-bold text-lg sm:text-xl">🏥 Mon espace pharmacie</h2>
                    <p className="text-green-100 text-xs sm:text-sm mt-1">Commandes · Réservations · Stock · Garde</p>
                  </div>
                  <div className="text-2xl sm:text-3xl">→</div>
                </div>
              </Link>
            )}

            {role === "admin" && (
              <Link href="/dashboard/admin" className="block bg-[#00572D] text-white text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl font-bold text-sm shadow-lg">
                🛠️ Espace Administrateur
              </Link>
            )}
          </div>
        </motion.section>

        {/* ACTIONS — masquées pour livreurs et pharmacies */}
        {role !== "driver" && role !== "pharmacy" && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fromBottom} className="px-4 sm:px-6 mt-6 sm:mt-8">
            <div className="max-w-md mx-auto space-y-3 sm:space-y-4">
              <Link href="/map" className="block bg-[#00572D] text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="font-bold text-lg sm:text-xl">Trouver une pharmacie</h2>
                    <p className="text-green-100 text-xs sm:text-sm mt-1">Pharmacies proches de vous</p>
                  </div>
                  <div className="text-2xl sm:text-3xl">📍</div>
                </div>
              </Link>

              {role !== "admin" && (
                <button onClick={pharmacyAccess} className="w-full bg-[#00572D] text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg">
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <h2 className="font-bold text-lg sm:text-xl">Espace Pharmacie</h2>
                      <p className="text-green-100 text-xs sm:text-sm mt-1">Gestion des stocks et réservations</p>
                    </div>
                    <div className="text-2xl sm:text-3xl">🏥</div>
                  </div>
                </button>
              )}
            </div>
          </motion.section>
        )}

        {/* CARTE POUR LIVREUR */}
        {role === "driver" && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fromBottom} className="px-4 sm:px-6 mt-6 sm:mt-8">
            <div className="max-w-md mx-auto">
              <Link href="/map" className="block bg-[#00572D] text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="font-bold text-lg sm:text-xl">Carte des pharmacies</h2>
                    <p className="text-green-100 text-xs sm:text-sm mt-1">Badges de missions en temps réel</p>
                  </div>
                  <div className="text-2xl sm:text-3xl">🗺️</div>
                </div>
              </Link>
            </div>
          </motion.section>
        )}

        {/* PHARMACIES DE GARDE — masqué pour livreurs */}
        {role !== "driver" && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fromLeft} className="px-4 sm:px-6 mt-8 sm:mt-10">
            <div className="max-w-md mx-auto">
              <Link href="/pharmacies-de-garde" className="block bg-[#00572D] rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-center text-white shadow-lg">
                <div className="text-4xl sm:text-5xl">🏥</div>
                <h3 className="font-bold text-lg sm:text-xl mt-2 sm:mt-3">Pharmacies de garde</h3>
                <p className="text-xs sm:text-sm text-green-100 mt-1">Voir les pharmacies disponibles maintenant</p>
              </Link>
            </div>
          </motion.section>
        )}

        {/* POURQUOI KISI — masqué pour livreurs et pharmacies */}
        {role !== "driver" && role !== "pharmacy" && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fromRight} className="px-4 sm:px-6 mt-8 sm:mt-10">
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
        )}

        {/* FOOTER */}
        <motion.footer initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fromBottom} className="text-center mt-16 sm:mt-24 pb-12 sm:pb-16">
          <p className="text-[#00572D] font-medium text-sm sm:text-base drop-shadow">Votre pharmacie à portée de main</p>
          <p className="text-xs sm:text-sm text-[#00572D] mt-2 drop-shadow">© 2026 KISI</p>
          <div className="flex flex-wrap justify-center items-center gap-x-2 sm:gap-x-3 gap-y-2 mt-3 sm:mt-4 px-4">
            <Link href="/about" className="text-[10px] sm:text-xs text-[#00572D] underline whitespace-nowrap">À propos</Link>
            <span className="text-gray-400 text-xs">|</span>
            <Link href="/legal" className="text-[10px] sm:text-xs text-[#00572D] underline whitespace-nowrap">Mentions légales</Link>
            <span className="text-gray-400 text-xs">|</span>
            <Link href="/verification-pharmacies" className="text-[10px] sm:text-xs text-[#00572D] underline whitespace-nowrap flex items-center gap-1">
              <span>🔐</span>Vérification des pharmacies
            </Link>
          </div>
        </motion.footer>

      </div>
    </main>
  );
}