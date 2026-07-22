"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/components/CartContext";
import { useToast } from "@/components/ToastProviderTemp";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface Address {
  full_name: string;
  phone: string;
  city: string;
  district: string;
  address_line: string;
  notes: string;
  latitude: number | null;
  longitude: number | null;
}

interface DeliverySettings {
  price_per_km: number;
  minimum_fee: number;
  maximum_distance_km: number;
  commission_percent: number;
}

// ============================================================
// UTILITAIRES ESCROW
// ============================================================
async function getOrCreateWallet(
  ownerId: string,
  ownerType: "pharmacy" | "driver" | "kisi"
): Promise<string> {
  const { data: existing } = await supabase
    .from("wallets")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("owner_type", ownerType)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("wallets")
    .insert({ owner_id: ownerId, owner_type: ownerType, balance: 0 })
    .select("id")
    .single();

  return created!.id;
}

async function creditWallet(walletId: string, amount: number) {
  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance, total_received")
    .eq("id", walletId)
    .single();

  if (!wallet) return;

  await supabase.from("wallets").update({
    balance: Number(wallet.balance) + amount,
    total_received: Number(wallet.total_received) + amount,
    updated_at: new Date().toISOString(),
  }).eq("id", walletId);
}

// ============================================================
// PROCESSUS ESCROW AU PAIEMENT
// ============================================================
async function processEscrowOnPayment(
  orderId: string,
  pharmacyId: string,
  subtotal: number,
  deliveryFee: number,
  commissionPercent: number
) {
  // 1. Créer/récupérer le wallet de la pharmacie
  const pharmacyWalletId = await getOrCreateWallet(pharmacyId, "pharmacy");

  // 2. Créditer la pharmacie immédiatement
  await creditWallet(pharmacyWalletId, subtotal);

  // 3. Transaction pharmacie
  await supabase.from("financial_transactions").insert({
    order_id: orderId,
    type: "pharmacy_payment",
    to_wallet_id: pharmacyWalletId,
    amount: subtotal,
    status: "completed",
    description: `Paiement médicaments — commande ${orderId.substring(0, 8)}`,
  });

  // 4. Escrow pour les frais de livraison
  if (deliveryFee > 0) {
    const commissionAmount = Math.round(deliveryFee * (commissionPercent / 100));
    const driverAmount = deliveryFee - commissionAmount;

    await supabase.from("escrow_accounts").upsert({
      order_id: orderId,
      amount: deliveryFee,
      commission_amount: commissionAmount,
      driver_amount: driverAmount,
      status: "held",
      held_at: new Date().toISOString(),
    });

    await supabase.from("financial_transactions").insert({
      order_id: orderId,
      type: "delivery_escrow",
      amount: deliveryFee,
      status: "pending",
      description: `Frais livraison en escrow — commande ${orderId.substring(0, 8)}`,
      metadata: { commission: commissionAmount, driver_earning: driverAmount },
    });
  }

  // 5. Mettre à jour la commande
  await supabase.from("orders").update({
    pharmacy_paid: true,
    pharmacy_paid_at: new Date().toISOString(),
    pharmacy_payment_amount: subtotal,
    escrow_status: deliveryFee > 0 ? "held" : "released",
  }).eq("id", orderId);
}

// ============================================================
// PAGE CHECKOUT
// ============================================================
export default function CheckoutPage() {
  const { items, totalAmount, clearCart } = useCart();
  const { showToast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<DeliverySettings | null>(null);

  // Adresse
  const [address, setAddress] = useState<Address>({
    full_name: "",
    phone: "",
    city: "",
    district: "",
    address_line: "",
    notes: "",
    latitude: null,
    longitude: null,
  });

  // Paiement
  const [paymentMethod, setPaymentMethod] = useState<"airtel" | "mtn">("airtel");
  const [paymentPhone, setPaymentPhone] = useState("");

  // Livraison
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [estimatedDistance, setEstimatedDistance] = useState(0);

  // Grouper par pharmacie
  const byPharmacy = items.reduce((acc: any, item: any) => {
    if (!acc[item.pharmacy_id]) {
      acc[item.pharmacy_id] = {
        pharmacy_id: item.pharmacy_id,
        pharmacy_name: item.pharmacy_name,
        items: [],
        subtotal: 0,
      };
    }
    acc[item.pharmacy_id].items.push(item);
    acc[item.pharmacy_id].subtotal += item.price * item.quantity;
    return acc;
  }, {});

  const pharmacyGroups = Object.values(byPharmacy) as any[];
  const totalDeliveryFees = deliveryType === "delivery" ? deliveryFee * pharmacyGroups.length : 0;
  const grandTotal = totalAmount + totalDeliveryFees;

  useEffect(() => {
    loadUser();
    loadSettings();
  }, []);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUser(user);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single();

    if (profile) {
      setAddress((prev) => ({
        ...prev,
        full_name: profile.full_name || "",
        phone: profile.phone || "",
      }));
      setPaymentPhone(profile.phone || "");
    }
  }

  async function loadSettings() {
    const { data } = await supabase
      .from("delivery_settings")
      .select("*")
      .eq("is_active", true)
      .single();

    if (data) {
      setSettings(data);
      calculateDeliveryFee(5, data);
    }
  }

  function calculateDeliveryFee(distanceKm: number, s?: DeliverySettings) {
    const cfg = s || settings;
    if (!cfg) return;
    const distance = Math.min(distanceKm, cfg.maximum_distance_km);
    setEstimatedDistance(distance);
    const fee = Math.max(distance * cfg.price_per_km, cfg.minimum_fee);
    setDeliveryFee(Math.round(fee));
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      showToast("Géolocalisation non supportée", "error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAddress((prev) => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        const simulatedDistance = 3 + Math.random() * 12;
        calculateDeliveryFee(Math.round(simulatedDistance * 10) / 10);
        showToast("Position détectée !");
      },
      () => {
        showToast("Impossible de détecter votre position", "error");
        calculateDeliveryFee(5);
      }
    );
  }

  function validateAddress() {
    if (!address.full_name.trim()) { showToast("Nom complet requis", "error"); return false; }
    if (!address.phone.trim()) { showToast("Téléphone requis", "error"); return false; }
    if (deliveryType === "delivery") {
      if (!address.city.trim()) { showToast("Ville requise", "error"); return false; }
      if (!address.address_line.trim()) { showToast("Adresse requise", "error"); return false; }
    }
    return true;
  }

  function validatePayment() {
    if (!paymentPhone.trim() || paymentPhone.length < 8) {
      showToast("Numéro Mobile Money invalide", "error");
      return false;
    }
    return true;
  }

  async function processPayment() {
    if (!validatePayment()) return;
    if (!user) return;

    setPaymentProcessing(true);

    // Simulation paiement Mobile Money
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const transactionRef = `KISI-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      for (const group of pharmacyGroups) {
        // 1. Créer l'adresse
        let addressId = null;

        if (deliveryType === "delivery") {
          const { data: savedAddress, error: addrError } = await supabase
            .from("addresses")
            .insert({
              user_id: user.id,
              full_name: address.full_name,
              phone: address.phone,
              city: address.city,
              district: address.district,
              address_line: address.address_line,
              notes: address.notes,
              latitude: address.latitude,
              longitude: address.longitude,
            })
            .select()
            .single();

          if (addrError) throw addrError;
          addressId = savedAddress.id;
        }

        const groupDeliveryFee = deliveryType === "delivery" ? deliveryFee : 0;
        const groupSubtotal = group.subtotal;
        const groupTotal = groupSubtotal + groupDeliveryFee;
        const commissionPercent = settings?.commission_percent || 10;
        const commissionAmount = Math.round(groupDeliveryFee * commissionPercent / 100);
        const driverEarning = groupDeliveryFee - commissionAmount;

        // 2. Créer la commande
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            user_id: user.id,
            pharmacy_id: group.pharmacy_id,
            address_id: addressId,
            subtotal: groupSubtotal,
            delivery_fee: groupDeliveryFee,
            commission_amount: commissionAmount,
            driver_earning: driverEarning,
            total: groupTotal,
            status: "payment_confirmed",
            payment_method: "mobile_money",
            payment_provider: paymentMethod,
            payment_status: "paid",
            payment_confirmed_at: new Date().toISOString(),
            pickup_otp: Math.floor(1000 + Math.random() * 9000).toString(),
            pharmacy_paid: false,
            escrow_status: groupDeliveryFee > 0 ? "held" : "released",
            client_confirmed: false,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // 3. Créer les items
        const orderItems = group.items.map((item: any) => ({
          order_id: order.id,
          medicine_id: item.medicine_id,
          pharmacy_id: item.pharmacy_id,
          medicine_name: item.medicine_name,
          medicine_image_url: item.medicine_image_url || "",
          price: item.price,
          quantity: item.quantity,
          subtotal: item.price * item.quantity,
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;

        // 4. Créer le paiement
        const { error: payError } = await supabase.from("payments").insert({
          order_id: order.id,
          user_id: user.id,
          provider: paymentMethod,
          phone: paymentPhone,
          amount: groupTotal,
          status: "success",
          transaction_ref: `${transactionRef}-${group.pharmacy_id.substring(0, 4)}`,
          provider_ref: `SIM-${Date.now()}`,
          confirmed_at: new Date().toISOString(),
        });

        if (payError) throw payError;

        // 5. ✅ ESCROW — Payer la pharmacie immédiatement + bloquer la livraison
        await processEscrowOnPayment(
          order.id,
          group.pharmacy_id,
          groupSubtotal,
          groupDeliveryFee,
          commissionPercent
        );

        // 6. Notifications
        await supabase.from("notifications").insert([
          {
            user_id: user.id,
            type: "payment",
            title: "Paiement confirmé ✅",
            body: `Votre commande de ${groupTotal.toLocaleString()} FCFA chez ${group.pharmacy_name} a été payée. La pharmacie prépare votre commande.`,
            order_id: order.id,
          },
        ]);

        // Notification pharmacie
        const { data: pharmacy } = await supabase
          .from("pharmacies")
          .select("user_id")
          .eq("id", group.pharmacy_id)
          .single();

        if (pharmacy?.user_id) {
          await supabase.from("notifications").insert({
            user_id: pharmacy.user_id,
            type: "payment",
            title: "Nouvelle commande payée 💰",
            body: `Vous avez reçu ${groupSubtotal.toLocaleString()} FCFA. Une commande est prête à préparer.`,
            order_id: order.id,
          });
        }

        // 7. Événement
        await supabase.from("delivery_events").insert({
          order_id: order.id,
          actor_type: "system",
          status: "payment_confirmed",
          label: `Paiement confirmé — Pharmacie payée : ${groupSubtotal.toLocaleString()} FCFA — Livraison en escrow : ${groupDeliveryFee.toLocaleString()} FCFA`,
        });
      }

      setPaymentProcessing(false);
      setPaymentSuccess(true);
      clearCart();

      setTimeout(() => {
        router.push("/orders");
      }, 3000);
    } catch (error: any) {
      setPaymentProcessing(false);
      showToast(error.message || "Erreur lors du paiement", "error");
    }
  }

  // ============================================================
  // ÉCRANS SPÉCIAUX
  // ============================================================
  if (items.length === 0 && !paymentSuccess) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 text-center max-w-sm shadow-xl">
          <div className="text-5xl mb-4">🛒</div>
          <h2 className="text-xl font-bold text-[#00572D] dark:text-green-400">Panier vide</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            Ajoutez des médicaments pour passer commande.
          </p>
          <button
            onClick={() => router.push("/search")}
            className="mt-5 w-full bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm"
          >
            Rechercher un médicament
          </button>
        </div>
      </main>
    );
  }

  if (paymentSuccess) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 text-center max-w-sm shadow-xl">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
            Paiement réussi !
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            La pharmacie a été payée immédiatement.
            Les frais de livraison seront versés au livreur après votre confirmation.
          </p>

          {/* Explication escrow */}
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-left">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-2">
              🔐 Paiement sécurisé KISI
            </p>
            <div className="space-y-1">
              <p className="text-xs text-blue-600 dark:text-blue-400">
                ✅ Médicaments : versés à la pharmacie
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                🔒 Livraison : conservée par KISI jusqu'à votre confirmation
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="w-8 h-8 border-4 border-[#00572D] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        </div>
      </main>
    );
  }

  if (paymentProcessing) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 text-center max-w-sm shadow-xl">
          <div className="text-5xl mb-4">📱</div>
          <h2 className="text-xl font-bold text-[#00572D] dark:text-green-400">
            Traitement en cours...
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            Validation de votre paiement{" "}
            {paymentMethod === "airtel" ? "Airtel Money" : "MTN Mobile Money"}.
          </p>
          <p className="text-gray-400 text-xs mt-1">Ne fermez pas cette page.</p>
          <div className="mt-6">
            <div className="w-10 h-10 border-4 border-[#00572D] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
          <p className="text-xs text-gray-400 mt-4">📞 {paymentPhone}</p>
        </div>
      </main>
    );
  }

  // ============================================================
  // PAGE PRINCIPALE
  // ============================================================
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-32">
      <div className="max-w-lg mx-auto px-4 pt-6">

        {/* HEADER */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
            💳 Checkout
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

        {/* ========== ÉTAPE 1 — RÉCAPITULATIF ========== */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg text-black dark:text-white">
              📋 Récapitulatif
            </h2>

            {pharmacyGroups.map((group: any) => (
              <div
                key={group.pharmacy_id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
              >
                <p className="font-bold text-[#00572D] dark:text-green-400 mb-3">
                  🏥 {group.pharmacy_name}
                </p>

                {group.items.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-medium dark:text-white">
                        💊 {item.medicine_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.quantity} × {item.price.toLocaleString()} FCFA
                      </p>
                    </div>
                    <p className="font-bold text-sm text-[#00572D] dark:text-green-400">
                      {(item.price * item.quantity).toLocaleString()} FCFA
                    </p>
                  </div>
                ))}

                <div className="flex justify-between mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Sous-total
                  </p>
                  <p className="font-bold text-[#00572D] dark:text-green-400">
                    {group.subtotal.toLocaleString()} FCFA
                  </p>
                </div>
              </div>
            ))}

            {/* Mode de réception */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <p className="font-bold text-sm mb-3 dark:text-white">🚚 Mode de réception</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDeliveryType("delivery")}
                  className={`p-3 rounded-xl text-center text-sm font-bold border-2 transition ${
                    deliveryType === "delivery"
                      ? "bg-[#00572D] text-white border-[#00572D]"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600"
                  }`}
                >
                  🏠 Livraison
                </button>
                <button
                  onClick={() => setDeliveryType("pickup")}
                  className={`p-3 rounded-xl text-center text-sm font-bold border-2 transition ${
                    deliveryType === "pickup"
                      ? "bg-[#00572D] text-white border-[#00572D]"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600"
                  }`}
                >
                  🏥 Retrait
                </button>
              </div>
            </div>

            {/* Totaux */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Médicaments</span>
                <span className="font-bold dark:text-white">
                  {totalAmount.toLocaleString()} FCFA
                </span>
              </div>

              {deliveryType === "delivery" && (
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-500 dark:text-gray-400">
                    Livraison ({estimatedDistance} km × {pharmacyGroups.length}{" "}
                    pharmacie{pharmacyGroups.length > 1 ? "s" : ""})
                  </span>
                  <span className="font-bold dark:text-white">
                    {totalDeliveryFees.toLocaleString()} FCFA
                  </span>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="dark:text-white">Total</span>
                <span className="text-[#00572D] dark:text-green-400">
                  {grandTotal.toLocaleString()} FCFA
                </span>
              </div>
            </div>

            {/* Info escrow */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">
                🔐 Paiement sécurisé KISI
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                La pharmacie sera payée immédiatement. Les frais de livraison seront
                versés au livreur uniquement après votre confirmation de réception.
              </p>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-[#00572D] text-white p-3.5 rounded-xl font-bold text-sm"
            >
              Continuer →
            </button>
          </div>
        )}

        {/* ========== ÉTAPE 2 — ADRESSE ========== */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg text-black dark:text-white">
              {deliveryType === "delivery" ? "📍 Adresse de livraison" : "👤 Vos informations"}
            </h2>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Nom complet *
                </label>
                <input
                  value={address.full_name}
                  onChange={(e) => setAddress({ ...address, full_name: e.target.value })}
                  className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                  placeholder="Ex: Jean Dupont"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Téléphone *
                </label>
                <input
                  value={address.phone}
                  onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                  className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                  placeholder="Ex: 066000000"
                />
              </div>

              {deliveryType === "delivery" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Ville *
                    </label>
                    <input
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                      placeholder="Ex: Brazzaville"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Quartier
                    </label>
                    <input
                      value={address.district}
                      onChange={(e) => setAddress({ ...address, district: e.target.value })}
                      className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                      placeholder="Ex: Bacongo"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Adresse complète *
                    </label>
                    <input
                      value={address.address_line}
                      onChange={(e) => setAddress({ ...address, address_line: e.target.value })}
                      className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                      placeholder="Ex: 123 Avenue de la Paix"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Indications (facultatif)
                    </label>
                    <textarea
                      value={address.notes}
                      onChange={(e) => setAddress({ ...address, notes: e.target.value })}
                      className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                      placeholder="Ex: Maison bleue à côté de l'église"
                      rows={2}
                    />
                  </div>

                  <button
                    onClick={requestLocation}
                    className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-3 rounded-xl text-sm font-semibold"
                  >
                    📍 Détecter ma position automatiquement
                  </button>

                  {address.latitude && (
                    <p className="text-xs text-green-600 dark:text-green-400 text-center">
                      ✅ Position détectée · Distance estimée : {estimatedDistance} km
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm"
              >
                ← Retour
              </button>
              <button
                onClick={() => { if (validateAddress()) setStep(3); }}
                className="flex-1 bg-[#00572D] text-white p-3 rounded-xl font-bold text-sm"
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ========== ÉTAPE 3 — PAIEMENT ========== */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg text-black dark:text-white">
              💳 Paiement Mobile Money
            </h2>

            {/* Opérateur */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <p className="font-bold text-sm mb-3 dark:text-white">
                Choisissez votre opérateur
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod("airtel")}
                  className={`p-4 rounded-xl text-center border-2 transition ${
                    paymentMethod === "airtel"
                      ? "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-600 dark:text-red-400"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  <div className="text-2xl mb-1">📱</div>
                  <p className="font-bold text-sm">Airtel Money</p>
                </button>

                <button
                  onClick={() => setPaymentMethod("mtn")}
                  className={`p-4 rounded-xl text-center border-2 transition ${
                    paymentMethod === "mtn"
                      ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 text-yellow-600 dark:text-yellow-400"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  <div className="text-2xl mb-1">📱</div>
                  <p className="font-bold text-sm">MTN MoMo</p>
                </button>
              </div>
            </div>

            {/* Numéro */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Numéro {paymentMethod === "airtel" ? "Airtel Money" : "MTN MoMo"} *
              </label>
              <input
                value={paymentPhone}
                onChange={(e) => setPaymentPhone(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm dark:text-white"
                placeholder="Ex: 066000000"
              />
            </div>

            {/* Récapitulatif */}
            <div className="bg-[#00572D] rounded-2xl p-4 text-white">
              <h3 className="font-bold text-sm mb-3">📋 Récapitulatif final</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-200">Médicaments</span>
                  <span className="font-bold">{totalAmount.toLocaleString()} FCFA</span>
                </div>
                {deliveryType === "delivery" && (
                  <div className="flex justify-between">
                    <span className="text-green-200">Livraison (escrow 🔒)</span>
                    <span className="font-bold">{totalDeliveryFees.toLocaleString()} FCFA</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-green-600">
                  <span>Total à payer</span>
                  <span>{grandTotal.toLocaleString()} FCFA</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-green-600 space-y-1">
                <p className="text-xs text-green-200">
                  👤 {address.full_name} · 📞 {address.phone}
                </p>
                {deliveryType === "delivery" && (
                  <p className="text-xs text-green-200">
                    📍 {address.address_line}, {address.district} · {address.city}
                  </p>
                )}
                <p className="text-xs text-green-200">
                  💳 {paymentMethod === "airtel" ? "Airtel Money" : "MTN MoMo"} · {paymentPhone}
                </p>
              </div>
            </div>

            {/* Explication escrow */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 space-y-1">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-400">
                🔐 Comment fonctionne le paiement sécurisé ?
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                💊 La pharmacie reçoit le paiement des médicaments immédiatement.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                🔒 Les frais de livraison sont conservés par KISI.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                ✅ Le livreur est payé après votre confirmation de réception.
              </p>
            </div>

            {/* Prototype */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
              <p className="text-xs text-yellow-700 dark:text-yellow-400 text-center">
                ⚠️ Mode prototype — Le paiement est simulé. Aucun montant réel ne sera débité.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 dark:text-white p-3 rounded-xl font-bold text-sm"
              >
                ← Retour
              </button>
              <button
                onClick={processPayment}
                className="flex-1 bg-[#00572D] text-white p-3.5 rounded-xl font-bold text-sm"
              >
                💳 Payer {grandTotal.toLocaleString()} FCFA
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}