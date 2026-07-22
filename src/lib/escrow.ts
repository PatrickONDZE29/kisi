import { supabase } from "@/lib/supabase";

const KISI_WALLET_ID = "00000000-0000-0000-0000-000000000001";

// ============================================================
// ÉTAPE 1 — Payer la pharmacie immédiatement + mettre la
//           livraison en escrow
// ============================================================
export async function processPaymentOnConfirmation(orderId: string) {
  // Charger la commande
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*, pharmacies(id, user_id)")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error("Commande introuvable : " + orderError?.message);
  }

  const pharmacyId = order.pharmacy_id;
  const deliveryFee = Number(order.delivery_fee || 0);
  const subtotal = Number(order.subtotal || 0);

  // 1. Créer ou récupérer le wallet de la pharmacie
  const pharmacyWalletId = await getOrCreateWallet(pharmacyId, "pharmacy");

  // 2. Créditer la pharmacie immédiatement
  await creditWallet(pharmacyWalletId, subtotal);

  // 3. Enregistrer la transaction pharmacie
  await supabase.from("financial_transactions").insert({
    order_id: orderId,
    type: "pharmacy_payment",
    to_wallet_id: pharmacyWalletId,
    amount: subtotal,
    status: "completed",
    description: `Paiement médicaments — commande ${orderId.substring(0, 8)}`,
  });

  // 4. Mettre les frais de livraison en escrow
  if (deliveryFee > 0) {
    const settings = await getDeliverySettings();
    const commissionAmount = Math.round(deliveryFee * (settings.commission_percent / 100));
    const driverAmount = deliveryFee - commissionAmount;

    await supabase.from("escrow_accounts").upsert({
      order_id: orderId,
      amount: deliveryFee,
      commission_amount: commissionAmount,
      driver_amount: driverAmount,
      status: "held",
      held_at: new Date().toISOString(),
    });

    // Transaction escrow
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

  // 6. Notification pharmacie
  if (order.pharmacies?.user_id) {
    await supabase.from("notifications").insert({
      user_id: order.pharmacies.user_id,
      type: "payment",
      title: "Paiement reçu 💰",
      body: `Vous avez reçu ${subtotal.toLocaleString()} FCFA pour la commande.`,
      order_id: orderId,
    });
  }

  return { pharmacyPaid: subtotal, escrowHeld: deliveryFee };
}

// ============================================================
// ÉTAPE 2 — Client confirme la livraison → libérer l'escrow
// ============================================================
export async function releaseEscrowOnClientConfirmation(
  orderId: string,
  clientUserId: string
) {
  // Vérifier l'escrow
  const { data: escrow, error: escrowError } = await supabase
    .from("escrow_accounts")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (escrowError || !escrow) {
    throw new Error("Escrow introuvable");
  }

  if (escrow.status !== "held") {
    throw new Error("L'escrow n'est pas en attente de libération");
  }

  // Récupérer la commande
  const { data: order } = await supabase
    .from("orders")
    .select("*, driver_profiles(id, user_id, full_name)")
    .eq("id", orderId)
    .single();

  if (!order?.driver_id) {
    throw new Error("Aucun livreur assigné à cette commande");
  }

  const driverProfileId = order.driver_id;
  const driverUserId = order.driver_profiles?.user_id;

  // 1. Créditer le wallet du livreur
  const driverWalletId = await getOrCreateWallet(driverProfileId, "driver");
  await creditWallet(driverWalletId, escrow.driver_amount);

  // 2. Créditer le wallet KISI (commission)
  await creditWallet(KISI_WALLET_ID, escrow.commission_amount);

  // 3. Transactions
  await supabase.from("financial_transactions").insert([
    {
      order_id: orderId,
      type: "escrow_release",
      to_wallet_id: driverWalletId,
      amount: escrow.driver_amount,
      status: "completed",
      description: `Gain livraison libéré au livreur`,
      metadata: { commission_deducted: escrow.commission_amount },
    },
    {
      order_id: orderId,
      type: "kisi_commission",
      to_wallet_id: KISI_WALLET_ID,
      amount: escrow.commission_amount,
      status: "completed",
      description: `Commission KISI sur livraison`,
    },
  ]);

  // 4. Mettre à jour l'escrow
  await supabase.from("escrow_accounts").update({
    status: "released",
    released_at: new Date().toISOString(),
  }).eq("order_id", orderId);

  // 5. Mettre à jour les gains du livreur
  await supabase.from("driver_profiles").update({
    total_earnings: supabase.rpc("increment_earnings", {
      driver_id: driverProfileId,
      amount: escrow.driver_amount,
    }),
    total_deliveries: supabase.rpc("increment_deliveries", {
      driver_id: driverProfileId,
    }),
  }).eq("id", driverProfileId);

  // Fallback si rpc non disponible
  const { data: dp } = await supabase
    .from("driver_profiles")
    .select("total_earnings, total_deliveries")
    .eq("id", driverProfileId)
    .single();

  if (dp) {
    await supabase.from("driver_profiles").update({
      total_earnings: (Number(dp.total_earnings) || 0) + escrow.driver_amount,
      total_deliveries: (Number(dp.total_deliveries) || 0) + 1,
    }).eq("id", driverProfileId);
  }

  // 6. Mettre à jour la commande
  await supabase.from("orders").update({
    status: "delivered",
    escrow_status: "released",
    client_confirmed: true,
    client_confirmed_at: new Date().toISOString(),
    delivered_at: new Date().toISOString(),
  }).eq("id", orderId);

  // 7. Mettre à jour le stock
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (orderItems) {
    for (const item of orderItems) {
      const { data: stock } = await supabase
        .from("stock")
        .select("id, quantity")
        .eq("medicine_id", item.medicine_id)
        .eq("pharmacy_id", item.pharmacy_id)
        .single();

      if (stock && stock.quantity >= item.quantity) {
        await supabase
          .from("stock")
          .update({ quantity: stock.quantity - item.quantity })
          .eq("id", stock.id);
      }
    }
  }

  // 8. Notifications
  const notifications = [];

  // Livreur
  if (driverUserId) {
    notifications.push({
      user_id: driverUserId,
      type: "payment",
      title: "Paiement reçu 💰",
      body: `${escrow.driver_amount.toLocaleString()} FCFA ont été ajoutés à votre portefeuille.`,
      order_id: orderId,
    });
  }

  // Client
  notifications.push({
    user_id: clientUserId,
    type: "delivery",
    title: "Livraison confirmée ✅",
    body: "Merci d'avoir confirmé votre livraison. Bonne santé !",
    order_id: orderId,
  });

  if (notifications.length > 0) {
    await supabase.from("notifications").insert(notifications);
  }

  return {
    driverPaid: escrow.driver_amount,
    kisiCommission: escrow.commission_amount,
  };
}

// ============================================================
// LITIGE — Client signale un problème
// ============================================================
export async function openDispute(
  orderId: string,
  userId: string,
  reason: string,
  description?: string
) {
  // Bloquer l'escrow
  await supabase
    .from("escrow_accounts")
    .update({
      status: "disputed",
      disputed_at: new Date().toISOString(),
    })
    .eq("order_id", orderId);

  // Créer le litige
  const { data: dispute } = await supabase
    .from("disputes")
    .insert({
      order_id: orderId,
      user_id: userId,
      reason,
      description,
      status: "open",
    })
    .select()
    .single();

  // Mettre à jour la commande
  await supabase
    .from("orders")
    .update({ escrow_status: "disputed" })
    .eq("id", orderId);

  // Alerter les admins
  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .eq("role", "admin");

  if (admins && admins.length > 0) {
    await supabase.from("notifications").insert(
      admins.map((admin: any) => ({
        user_id: admin.id,
        type: "system",
        title: "🚨 Litige ouvert",
        body: `Un client a signalé un problème sur une commande. Motif : ${reason}`,
        order_id: orderId,
      }))
    );
  }

  return dispute;
}

// ============================================================
// UTILITAIRES
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

async function getDeliverySettings() {
  const { data } = await supabase
    .from("delivery_settings")
    .select("commission_percent")
    .eq("is_active", true)
    .single();

  return { commission_percent: data?.commission_percent || 10 };
}