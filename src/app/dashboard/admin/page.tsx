"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProviderTemp";

export default function AdminDashboard() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    "overview" | "pharmacies" | "drivers" | "orders" | "revenues" | "disputes" | "settings"
  >("overview");

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPharmacies: 0,
    totalDrivers: 0,
    totalOrders: 0,
    totalRevenues: 0,
    pendingDrivers: 0,
    pendingPharmacies: 0,
    todayOrders: 0,
    todayRevenues: 0,
    openDisputes: 0,
    totalEscrowHeld: 0,
  });

  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [revenues, setRevenues] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [financialTransactions, setFinancialTransactions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "pharmacy" | "driver";
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [resolvingDispute, setResolvingDispute] = useState<string | null>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "admin") { router.push("/"); return; }

    await Promise.all([
      loadStats(),
      loadPharmacies(),
      loadDrivers(),
      loadOrders(),
      loadRevenues(),
      loadDisputes(),
      loadWallets(),
      loadFinancialTransactions(),
      loadSettings(),
    ]);

    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function loadStats() {
    const today = new Date().toISOString().split("T")[0];

    const [
      usersRes, pharmaciesRes, driversRes, ordersRes,
      revenuesRes, pendingDriversRes, todayOrdersRes, todayRevenuesRes,
      disputesRes, escrowRes,
    ] = await Promise.all([
      supabase.from("users").select("id", { count: "exact" }),
      supabase.from("pharmacies").select("id", { count: "exact" }),
      supabase.from("driver_profiles").select("id", { count: "exact" }),
      supabase.from("orders").select("id", { count: "exact" }),
      supabase.from("financial_transactions").select("amount").eq("type", "kisi_commission").eq("status", "completed"),
      supabase.from("driver_profiles").select("id", { count: "exact" }).eq("is_verified", false),
      supabase.from("orders").select("id", { count: "exact" }).gte("created_at", today),
      supabase.from("financial_transactions").select("amount").eq("type", "kisi_commission").eq("status", "completed").gte("created_at", today),
      supabase.from("disputes").select("id", { count: "exact" }).eq("status", "open"),
      supabase.from("escrow_accounts").select("amount").eq("status", "held"),
    ]);

    const totalRevenues = (revenuesRes.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
    const todayRevenues = (todayRevenuesRes.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
    const totalEscrowHeld = (escrowRes.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);

    setStats({
      totalUsers: usersRes.count || 0,
      totalPharmacies: pharmaciesRes.count || 0,
      totalDrivers: driversRes.count || 0,
      totalOrders: ordersRes.count || 0,
      totalRevenues,
      pendingDrivers: pendingDriversRes.count || 0,
      pendingPharmacies: 0,
      todayOrders: todayOrdersRes.count || 0,
      todayRevenues,
      openDisputes: disputesRes.count || 0,
      totalEscrowHeld,
    });
  }

  async function loadPharmacies() {
    const { data } = await supabase.from("pharmacies").select("*, users(email)").order("created_at", { ascending: false });
    setPharmacies(data || []);
  }

  async function loadDrivers() {
    const { data } = await supabase.from("driver_profiles").select("*, users(email)").order("created_at", { ascending: false });
    setDrivers(data || []);
  }

  async function loadOrders() {
    const { data } = await supabase
      .from("orders")
      .select("*, pharmacies(name), driver_profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(50);
    setOrders(data || []);
  }

  async function loadRevenues() {
    const { data } = await supabase
      .from("financial_transactions")
      .select("*, orders(total, pharmacy_id, pharmacies(name))")
      .eq("type", "kisi_commission")
      .order("created_at", { ascending: false })
      .limit(30);
    setRevenues(data || []);
  }

  async function loadDisputes() {
    const { data } = await supabase
      .from("disputes")
      .select(`*, orders(total, subtotal, delivery_fee, escrow_status, pharmacies(name))`)
      .order("created_at", { ascending: false });
    setDisputes(data || []);
  }

  async function loadWallets() {
    const { data } = await supabase
      .from("wallets")
      .select("*")
      .order("total_received", { ascending: false });
    setWallets(data || []);
  }

  async function loadFinancialTransactions() {
    const { data } = await supabase
      .from("financial_transactions")
      .select("*, orders(pharmacy_id, pharmacies(name))")
      .order("created_at", { ascending: false })
      .limit(30);
    setFinancialTransactions(data || []);
  }

  async function loadSettings() {
    const { data } = await supabase.from("delivery_settings").select("*").eq("is_active", true).single();
    setSettings(data);
  }

  async function togglePharmacy(pharmacyId: string, isOpen: boolean) {
    const { error } = await supabase.from("pharmacies").update({ is_open: isOpen }).eq("id", pharmacyId);
    if (error) { showToast(error.message, "error"); return; }
    showToast(isOpen ? "Pharmacie activée" : "Pharmacie désactivée");
    await loadPharmacies();
  }

  async function saveSettings() {
    if (!settings?.id) return;
    setSavingSettings(true);
    const { error } = await supabase
      .from("delivery_settings")
      .update({
        price_per_km: Number(settings.price_per_km),
        minimum_fee: Number(settings.minimum_fee),
        maximum_distance_km: Number(settings.maximum_distance_km),
        commission_percent: Number(settings.commission_percent),
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);
    if (error) { showToast(error.message, "error"); setSavingSettings(false); return; }
    showToast("Paramètres sauvegardés ✅");
    setSavingSettings(false);
  }

  async function cancelOrder(orderId: string) {
    const { error } = await supabase.from("orders").update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    }).eq("id", orderId);
    if (error) { showToast(error.message, "error"); return; }
    showToast("Commande annulée");
    await loadOrders();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { type, id } = deleteTarget;

    if (type === "pharmacy") {
      const { error } = await supabase.from("pharmacies").delete().eq("id", id);
      if (error) { showToast("Erreur : " + error.message, "error"); setDeleting(false); setDeleteTarget(null); return; }
      showToast("Pharmacie supprimée");
      await loadPharmacies();
    }

    if (type === "driver") {
      const { error } = await supabase.from("driver_profiles").delete().eq("id", id);
      if (error) { showToast("Erreur : " + error.message, "error"); setDeleting(false); setDeleteTarget(null); return; }
      showToast("Livreur supprimé");
      await loadDrivers();
    }

    setDeleting(false);
    setDeleteTarget(null);
    await loadStats();
  }

  async function resolveDisputeForClient(disputeId: string, orderId: string) {
    setResolvingDispute(disputeId);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from("escrow_accounts").update({
        status: "refunded",
        released_at: new Date().toISOString(),
        released_by: user?.id,
      }).eq("order_id", orderId);

      await supabase.from("orders").update({ escrow_status: "refunded" }).eq("id", orderId);

      await supabase.from("disputes").update({
        status: "resolved_client",
        resolved_by: user?.id,
        resolved_at: new Date().toISOString(),
        resolution_note: "Résolu en faveur du client — Remboursé",
      }).eq("id", disputeId);

      const { data: dispute } = await supabase
        .from("disputes")
        .select("user_id, order_id")
        .eq("id", disputeId)
        .single();

      if (dispute?.user_id) {
        await supabase.from("notifications").insert({
          user_id: dispute.user_id,
          type: "system",
          title: "Litige résolu ✅",
          body: "Votre litige a été résolu en votre faveur par l'équipe KISI.",
          order_id: orderId,
        });
      }

      showToast("Litige résolu en faveur du client ✅");
      await Promise.all([loadDisputes(), loadStats(), loadWallets()]);
    } catch (err: any) {
      showToast(err.message || "Erreur", "error");
    } finally {
      setResolvingDispute(null);
    }
  }

  async function resolveDisputeForDriver(disputeId: string, orderId: string) {
    setResolvingDispute(disputeId);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: escrow } = await supabase
        .from("escrow_accounts")
        .select("*")
        .eq("order_id", orderId)
        .single();

      if (escrow && escrow.status === "disputed") {
        const { data: order } = await supabase
          .from("orders")
          .select("driver_id, driver_profiles(user_id, total_earnings, total_deliveries)")
          .eq("id", orderId)
          .single();

        if (order?.driver_id) {
          const { data: driverWallet } = await supabase
            .from("wallets")
            .select("id, balance, total_received")
            .eq("owner_id", order.driver_id)
            .eq("owner_type", "driver")
            .maybeSingle();

          if (driverWallet) {
            await supabase.from("wallets").update({
              balance: Number(driverWallet.balance) + escrow.driver_amount,
              total_received: Number(driverWallet.total_received) + escrow.driver_amount,
              updated_at: new Date().toISOString(),
            }).eq("id", driverWallet.id);
          } else {
            await supabase.from("wallets").insert({
              owner_id: order.driver_id,
              owner_type: "driver",
              balance: escrow.driver_amount,
              total_received: escrow.driver_amount,
            });
          }

          await supabase.from("financial_transactions").insert({
            order_id: orderId,
            type: "escrow_release",
            amount: escrow.driver_amount,
            status: "completed",
            description: "Litige résolu en faveur du livreur par admin",
          });

          const driverUserId = (order.driver_profiles as any)?.user_id;
          if (driverUserId) {
            await supabase.from("notifications").insert({
              user_id: driverUserId,
              type: "payment",
              title: "Litige résolu 💰",
              body: `${escrow.driver_amount.toLocaleString()} FCFA ont été ajoutés à votre portefeuille.`,
              order_id: orderId,
            });
          }
        }

        await supabase.from("escrow_accounts").update({
          status: "released",
          released_at: new Date().toISOString(),
          released_by: user?.id,
        }).eq("order_id", orderId);

        await supabase.from("orders").update({ escrow_status: "released" }).eq("id", orderId);
      }

      await supabase.from("disputes").update({
        status: "resolved_driver",
        resolved_by: user?.id,
        resolved_at: new Date().toISOString(),
        resolution_note: "Résolu en faveur du livreur",
      }).eq("id", disputeId);

      showToast("Litige résolu en faveur du livreur ✅");
      await Promise.all([loadDisputes(), loadStats(), loadWallets()]);
    } catch (err: any) {
      showToast(err.message || "Erreur", "error");
    } finally {
      setResolvingDispute(null);
    }
  }

  const pendingDrivers = drivers.filter((d) => !d.is_verified);
  const verifiedDrivers = drivers.filter((d) => d.is_verified);
  const openDisputes = disputes.filter((d) => d.status === "open");

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
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      <div className="max-w-4xl mx-auto px-4 pt-6">

        {/* ✅ HEADER avec bouton déconnexion complet */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#00572D] dark:text-green-400">
                ⚙️ Admin KISI
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                Tableau de bord administrateur
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-md whitespace-nowrap"
            >
              <span>🚪</span>
              <span>Déconnexion</span>
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {[
            { key: "overview", label: "📊 Vue globale" },
            { key: "pharmacies", label: "🏥 Pharmacies" },
            { key: "drivers", label: "🏍️ Livreurs", count: stats.pendingDrivers },
            { key: "orders", label: "📦 Commandes" },
            { key: "revenues", label: "💰 Revenus" },
            { key: "disputes", label: "🚨 Litiges", count: stats.openDisputes },
            { key: "settings", label: "⚙️ Paramètres" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`shrink-0 px-3 py-2 rounded-xl font-bold text-xs transition border-2 ${
                tab === t.key
                  ? "bg-[#00572D] text-white border-[#00572D]"
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
              }`}
            >
              {t.label}
              {t.count && t.count > 0 ? (
                <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  {t.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ========== VUE GLOBALE ========== */}
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="bg-[#00572D] rounded-2xl p-4 text-white">
              <p className="font-bold text-sm mb-3">📅 Aujourd'hui</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black">{stats.todayOrders}</p>
                  <p className="text-xs text-green-200">Commandes</p>
                </div>
                <div className="bg-white/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black">{stats.todayRevenues.toLocaleString()}</p>
                  <p className="text-xs text-green-200">FCFA commissions</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Utilisateurs", value: stats.totalUsers, emoji: "👤" },
                { label: "Pharmacies", value: stats.totalPharmacies, emoji: "🏥" },
                { label: "Livreurs", value: stats.totalDrivers, emoji: "🏍️" },
                { label: "Commandes", value: stats.totalOrders, emoji: "📦" },
              ].map((s) => (
                <div key={s.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm text-center">
                  <div className="text-2xl mb-1">{s.emoji}</div>
                  <p className="text-2xl font-black text-[#00572D] dark:text-green-400">{s.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm text-center">
                <p className="text-xs text-gray-400 mb-1">💰 Commissions KISI</p>
                <p className="text-xl font-black text-[#00572D] dark:text-green-400">
                  {stats.totalRevenues.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">FCFA</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm text-center">
                <p className="text-xs text-gray-400 mb-1">🔒 Escrow bloqué</p>
                <p className="text-xl font-black text-orange-500">
                  {stats.totalEscrowHeld.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">FCFA</p>
              </div>
            </div>

            {stats.pendingDrivers > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
                <p className="text-sm font-bold text-yellow-700 dark:text-yellow-400">
                  ⚠️ {stats.pendingDrivers} livreur(s) en attente de vérification
                </p>
                <button
                  onClick={() => setTab("drivers")}
                  className="mt-2 text-xs font-bold text-yellow-700 dark:text-yellow-400 underline"
                >
                  Voir les dossiers →
                </button>
              </div>
            )}

            {stats.openDisputes > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                <p className="text-sm font-bold text-red-600 dark:text-red-400">
                  🚨 {stats.openDisputes} litige(s) ouvert(s) à traiter
                </p>
                <button
                  onClick={() => setTab("disputes")}
                  className="mt-2 text-xs font-bold text-red-600 dark:text-red-400 underline"
                >
                  Voir les litiges →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========== PHARMACIES ========== */}
        {tab === "pharmacies" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{pharmacies.length} pharmacie(s)</p>
            {pharmacies.map((pharmacy) => (
              <div key={pharmacy.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  {pharmacy.logo_url && (
                    <img src={pharmacy.logo_url} alt={pharmacy.name} className="w-12 h-12 rounded-full object-cover border-2 border-gray-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm dark:text-white truncate">{pharmacy.name}</p>
                    <p className="text-xs text-gray-400">📍 {pharmacy.city || "—"} · 📞 {pharmacy.phone || "—"}</p>
                    {pharmacy.users?.email && (
                      <p className="text-xs text-gray-400 truncate">✉️ {pharmacy.users.email}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => togglePharmacy(pharmacy.id, !pharmacy.is_open)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                        pharmacy.is_open
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {pharmacy.is_open ? "🟢 Actif" : "🔴 Inactif"}
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ type: "pharmacy", id: pharmacy.id, name: pharmacy.name })}
                      className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                    >
                      🗑 Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========== LIVREURS ========== */}
        {tab === "drivers" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{drivers.length} livreur(s) · {pendingDrivers.length} en attente</p>

            {pendingDrivers.length > 0 && (
              <div>
                <p className="font-bold text-sm text-yellow-600 dark:text-yellow-400 mb-2">
                  ⏳ En attente de vérification ({pendingDrivers.length})
                </p>
                <div className="space-y-3">
                  {pendingDrivers.map((driver) => (
                    <div key={driver.id} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4">
                      <div className="flex items-center gap-3">
                        {driver.photo_url ? (
                          <img src={driver.photo_url} alt={driver.full_name} className="w-12 h-12 rounded-full object-cover border-2 border-yellow-200" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-yellow-200 dark:bg-yellow-800 flex items-center justify-center text-yellow-700 text-lg font-bold">
                            {driver.full_name?.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm dark:text-white">{driver.full_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">📞 {driver.phone}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">📍 {driver.city || "—"}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            🗓️ {new Date(driver.created_at).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 shrink-0">
                          ⏳ En attente
                        </span>
                      </div>

                      {driver.vehicle_plate && (
                        <div className="mt-2 bg-white/60 dark:bg-gray-800/60 rounded-xl p-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            🏍️ {driver.vehicle_brand || "—"} {driver.vehicle_model || ""} · {driver.vehicle_plate}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => router.push(`/dashboard/admin/drivers/${driver.id}`)}
                          className="flex-1 bg-[#00572D] text-white p-2.5 rounded-xl font-bold text-xs"
                        >
                          📋 Voir le dossier
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ type: "driver", id: driver.id, name: driver.full_name })}
                          className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-2.5 rounded-xl font-bold text-xs"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {verifiedDrivers.length > 0 && (
              <div>
                <p className="font-bold text-sm text-green-600 dark:text-green-400 mb-2">
                  ✅ Livreurs actifs ({verifiedDrivers.length})
                </p>
                <div className="space-y-3">
                  {verifiedDrivers.map((driver) => (
                    <div key={driver.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        {driver.photo_url ? (
                          <img src={driver.photo_url} alt={driver.full_name} className="w-12 h-12 rounded-full object-cover border-2 border-[#00572D]" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-[#00572D] flex items-center justify-center text-white text-lg font-bold">
                            {driver.full_name?.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm dark:text-white">{driver.full_name}</p>
                          <p className="text-xs text-gray-400">📞 {driver.phone}</p>
                          <p className="text-xs text-gray-400">🏍️ {driver.vehicle_brand} {driver.vehicle_plate}</p>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                              ✅ Vérifié
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              driver.is_available
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                            }`}>
                              {driver.is_available ? "🟢 En ligne" : "🔴 Hors ligne"}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => router.push(`/dashboard/admin/drivers/${driver.id}`)}
                            className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#00572D]/10 text-[#00572D] dark:text-green-400"
                          >
                            📋 Dossier
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ type: "driver", id: driver.id, name: driver.full_name })}
                            className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                          >
                            🗑 Supprimer
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
                          <p className="text-sm font-black text-[#00572D] dark:text-green-400">{driver.total_deliveries || 0}</p>
                          <p className="text-[10px] text-gray-400">Livraisons</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
                          <p className="text-sm font-black text-[#00572D] dark:text-green-400">{(driver.total_earnings || 0).toLocaleString()}</p>
                          <p className="text-[10px] text-gray-400">FCFA</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
                          <p className="text-sm font-black text-[#00572D] dark:text-green-400">⭐ {driver.rating || 5}</p>
                          <p className="text-[10px] text-gray-400">Note</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drivers.length === 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 text-center shadow-sm">
                <div className="text-5xl mb-3">🏍️</div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Aucun livreur inscrit</p>
              </div>
            )}
          </div>
        )}

        {/* ========== COMMANDES ========== */}
        {tab === "orders" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{orders.length} commande(s)</p>
            {orders.map((order) => (
              <div key={order.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm dark:text-white">🏥 {order.pharmacies?.name || "Pharmacie"}</p>
                    {order.driver_profiles && (
                      <p className="text-xs text-gray-400">🏍️ {order.driver_profiles.full_name}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                      order.escrow_status === "held" ? "bg-orange-100 text-orange-600"
                        : order.escrow_status === "released" ? "bg-green-100 text-green-700"
                        : order.escrow_status === "disputed" ? "bg-red-100 text-red-600"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {order.escrow_status === "held" ? "🔒 Escrow bloqué"
                        : order.escrow_status === "released" ? "✅ Escrow libéré"
                        : order.escrow_status === "disputed" ? "⚠️ Litige"
                        : order.escrow_status || "—"}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-[#00572D] dark:text-green-400">
                      {(order.total || 0).toLocaleString()} FCFA
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      order.status === "delivered" ? "bg-green-100 text-green-700"
                        : order.status === "cancelled" ? "bg-red-100 text-red-600"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
                {!["delivered", "cancelled"].includes(order.status) && (
                  <button
                    onClick={() => cancelOrder(order.id)}
                    className="mt-3 w-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2 rounded-xl font-bold text-xs"
                  >
                    ❌ Annuler cette commande
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ========== REVENUS ========== */}
        {tab === "revenues" && (
          <div className="space-y-4">
            <div className="bg-[#00572D] rounded-2xl p-5 text-white text-center">
              <p className="text-sm text-green-200 mb-1">Commissions KISI totales</p>
              <p className="text-4xl font-black">{stats.totalRevenues.toLocaleString()} FCFA</p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4 text-center">
              <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">🔒 Fonds en escrow (en attente)</p>
              <p className="text-2xl font-black text-orange-600 dark:text-orange-400">
                {stats.totalEscrowHeld.toLocaleString()} FCFA
              </p>
            </div>

            {wallets.length > 0 && (
              <div>
                <p className="font-bold text-sm dark:text-white mb-2">💼 Portefeuilles</p>
                <div className="space-y-2">
                  {wallets.map((wallet) => (
                    <div key={wallet.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            wallet.owner_type === "pharmacy" ? "bg-blue-100 text-blue-700"
                              : wallet.owner_type === "driver" ? "bg-green-100 text-green-700"
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {wallet.owner_type === "pharmacy" ? "🏥 Pharmacie"
                              : wallet.owner_type === "driver" ? "🏍️ Livreur"
                              : "⚙️ KISI"}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">
                            Total reçu : {(wallet.total_received || 0).toLocaleString()} FCFA
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-[#00572D] dark:text-green-400">
                            {(wallet.balance || 0).toLocaleString()} FCFA
                          </p>
                          <p className="text-[10px] text-gray-400">Solde</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="font-bold text-sm dark:text-white">📋 Dernières transactions</p>
            {financialTransactions.map((tx) => (
              <div key={tx.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 inline-block ${
                      tx.type === "pharmacy_payment" ? "bg-blue-100 text-blue-700"
                        : tx.type === "delivery_escrow" ? "bg-orange-100 text-orange-600"
                        : tx.type === "escrow_release" ? "bg-green-100 text-green-700"
                        : tx.type === "kisi_commission" ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {tx.type === "pharmacy_payment" ? "💊 Pharmacie"
                        : tx.type === "delivery_escrow" ? "🔒 Escrow"
                        : tx.type === "escrow_release" ? "✅ Libéré livreur"
                        : tx.type === "kisi_commission" ? "💰 Commission KISI"
                        : tx.type}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      🏥 {tx.orders?.pharmacies?.name || "—"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(tx.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <p className={`font-black text-sm ${
                    tx.status === "completed" ? "text-[#00572D] dark:text-green-400"
                      : tx.status === "pending" ? "text-orange-500"
                      : "text-gray-400"
                  }`}>
                    {(tx.amount || 0).toLocaleString()} FCFA
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========== LITIGES ========== */}
        {tab === "disputes" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {disputes.length} litige(s) · {openDisputes.length} ouvert(s)
            </p>

            {disputes.length === 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 text-center shadow-sm">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Aucun litige</p>
              </div>
            )}

            {openDisputes.length > 0 && (
              <div>
                <p className="font-bold text-sm text-red-600 dark:text-red-400 mb-2">
                  🚨 Litiges ouverts ({openDisputes.length})
                </p>
                <div className="space-y-3">
                  {openDisputes.map((dispute) => (
                    <div key={dispute.id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-sm dark:text-white">
                            🏥 {dispute.orders?.pharmacies?.name || "Pharmacie"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            💬 {dispute.reason}
                          </p>
                          {dispute.description && (
                            <p className="text-xs text-gray-400 mt-0.5 italic">{dispute.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            🗓️ {new Date(dispute.created_at).toLocaleDateString("fr-FR", {
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="font-black text-sm text-[#00572D] dark:text-green-400">
                            {(dispute.orders?.delivery_fee || 0).toLocaleString()} FCFA
                          </p>
                          <p className="text-[10px] text-gray-400">Livraison bloquée</p>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => resolveDisputeForClient(dispute.id, dispute.order_id)}
                          disabled={resolvingDispute === dispute.id}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl font-bold text-xs disabled:opacity-50 transition"
                        >
                          {resolvingDispute === dispute.id ? "..." : "👤 Rembourser client"}
                        </button>
                        <button
                          onClick={() => resolveDisputeForDriver(dispute.id, dispute.order_id)}
                          disabled={resolvingDispute === dispute.id}
                          className="flex-1 bg-[#00572D] hover:bg-green-800 text-white p-2.5 rounded-xl font-bold text-xs disabled:opacity-50 transition"
                        >
                          {resolvingDispute === dispute.id ? "..." : "🏍️ Payer livreur"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {disputes.filter(d => d.status !== "open").length > 0 && (
              <div>
                <p className="font-bold text-sm text-gray-500 dark:text-gray-400 mb-2">✅ Litiges résolus</p>
                <div className="space-y-2">
                  {disputes.filter(d => d.status !== "open").map((dispute) => (
                    <div key={dispute.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-xs dark:text-white">
                            🏥 {dispute.orders?.pharmacies?.name || "—"}
                          </p>
                          <p className="text-xs text-gray-400">{dispute.reason}</p>
                          {dispute.resolution_note && (
                            <p className="text-xs text-gray-400 italic">{dispute.resolution_note}</p>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          dispute.status === "resolved_client"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {dispute.status === "resolved_client" ? "👤 Client" : "🏍️ Livreur"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== PARAMÈTRES ========== */}
        {tab === "settings" && settings && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-sm dark:text-white">🚚 Paramètres de livraison</h2>

              {[
                { label: "Prix par km (FCFA)", key: "price_per_km" },
                { label: "Frais minimum (FCFA)", key: "minimum_fee" },
                { label: "Distance maximum (km)", key: "maximum_distance_km" },
                { label: "Commission KISI (%)", key: "commission_percent" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {field.label}
                  </label>
                  <input
                    type="number"
                    value={settings[field.key]}
                    onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                    className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                  />
                </div>
              ))}

              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                <p className="font-bold text-gray-700 dark:text-gray-300">📊 Simulation (5 km)</p>
                <p>Frais : {Math.max(5 * Number(settings.price_per_km), Number(settings.minimum_fee)).toLocaleString()} FCFA</p>
                <p>Commission KISI : {(Math.max(5 * Number(settings.price_per_km), Number(settings.minimum_fee)) * (Number(settings.commission_percent) / 100)).toLocaleString()} FCFA</p>
                <p>Gain livreur : {(Math.max(5 * Number(settings.price_per_km), Number(settings.minimum_fee)) * (1 - Number(settings.commission_percent) / 100)).toLocaleString()} FCFA</p>
              </div>

              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="w-full bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm disabled:opacity-50"
              >
                {savingSettings ? "Sauvegarde..." : "💾 Sauvegarder"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL SUPPRESSION */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-[#00572D] dark:text-green-400 mb-2">
              Supprimer {deleteTarget.type === "pharmacy" ? "cette pharmacie" : "ce livreur"} ?
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{deleteTarget.name}</p>
            <p className="text-xs text-red-500 mb-5">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white p-3 rounded-xl font-bold text-sm disabled:opacity-50"
              >
                {deleting ? "Suppression..." : "🗑 Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}