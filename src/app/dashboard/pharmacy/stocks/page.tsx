"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProviderTemp";

export default function StocksPage() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [pharmacyId, setPharmacyId] = useState("");
  const [stocks, setStocks] = useState<any[]>([]);

  const [medicineName, setMedicineName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");

  const { showToast } = useToast();

  const [editingStock, setEditingStock] = useState<any | null>(null);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setLoading(false);
      return;
    }

    const { data: pharmacy } = await supabase
      .from("pharmacies")
      .select("*")
      .eq("user_id", auth.user.id)
      .single();

    if (!pharmacy) {
      setLoading(false);
      return;
    }

    setPharmacyId(pharmacy.id);
    await loadStocks(pharmacy.id);
    setLoading(false);
  }

  async function loadStocks(id: string) {
    const { data } = await supabase
      .from("stock")
      .select(`
        *,
        medicines (
          id,
          name,
          description,
          image_url
        )
      `)
      .eq("pharmacy_id", id);

    setStocks(data || []);
  }

  async function addMedicine() {
    if (!medicineName || !quantity || !price) {
      showToast("Tous les champs obligatoires", "error");
      return;
    }

    setUploading(true);

    let medicineId = "";
    let imageUrl = "";

    // IMAGE UPLOAD
    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("medicine-images")
        .upload(fileName, imageFile);

      if (uploadError) {
        showToast(uploadError.message, "error");
        setUploading(false);
        return;
      }

      const { data } = supabase.storage
        .from("medicine-images")
        .getPublicUrl(fileName);

      imageUrl = data.publicUrl;
    }

    // CHECK EXISTING MEDICINE
    const { data: existing } = await supabase
      .from("medicines")
      .select("*")
      .ilike("name", medicineName.trim())
      .maybeSingle();

    if (existing) {
      medicineId = existing.id;

      if (imageUrl) {
        await supabase
          .from("medicines")
          .update({ image_url: imageUrl })
          .eq("id", medicineId);
      }
    } else {
      const { data: newMed, error } = await supabase
        .from("medicines")
        .insert({
          name: medicineName.trim(),
          description,
          image_url: imageUrl,
        })
        .select()
        .single();

      if (error) {
        showToast(error.message, "error");
        setUploading(false);
        return;
      }

      medicineId = newMed.id;
    }

    await supabase.from("stock").insert({
      pharmacy_id: pharmacyId,
      medicine_id: medicineId,
      quantity: Number(quantity),
      price: Number(price),
    });

    setMedicineName("");
    setQuantity("");
    setPrice("");
    setDescription("");
    setImageFile(null);

    await loadStocks(pharmacyId);
    setUploading(false);

    showToast("Médicament ajouté");
  }

  async function updateMedicine() {
    if (!editingStock) return;

    let imageUrl = editingStock.medicines.image_url;

    if (editImageFile) {
      const fileExt = editImageFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from("medicine-images")
        .upload(fileName, editImageFile);

      if (!error) {
        const { data } = supabase.storage
          .from("medicine-images")
          .getPublicUrl(fileName);

        imageUrl = data.publicUrl;
      }
    }

    await supabase
      .from("medicines")
      .update({
        name: editName,
        description: editDescription,
        image_url: imageUrl,
      })
      .eq("id", editingStock.medicines.id);

    await supabase
      .from("stock")
      .update({
        quantity: Number(editQuantity),
        price: Number(editPrice),
      })
      .eq("id", editingStock.id);

    setEditingStock(null);
    setEditImageFile(null);

    await loadStocks(pharmacyId);
    showToast("Médicament modifié");
  }

  async function deleteStock(id: string) {
    if (!confirm("Supprimer ce médicament ?")) return;

    await supabase.from("stock").delete().eq("id", id);
    await loadStocks(pharmacyId);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#00572D] dark:bg-gray-950 text-white">
        Chargement...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#00572D] dark:bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl text-center">
          <h1 className="text-2xl font-bold text-[#00572D] dark:text-green-400">
            Gestion des médicaments
          </h1>
        </div>

        {/* FORM */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl mt-6 space-y-4">

          <input
            placeholder="Nom"
            value={medicineName}
            onChange={(e) => setMedicineName(e.target.value)}
            className="w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-black dark:text-white"
          />

          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-black dark:text-white"
          />

          <input
            placeholder="Stock"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-black dark:text-white"
          />

          <input
            placeholder="Prix"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-black dark:text-white"
          />

          <input type="file" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />

          <button
            onClick={addMedicine}
            className="w-full bg-[#00572D] text-white p-3 rounded-xl"
          >
            Ajouter
          </button>
        </div>

        {/* LIST */}
        <div className="mt-6 space-y-4">

          {stocks.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl">

              <h3 className="font-bold text-lg text-black dark:text-white">
                💊 {item.medicines?.name}
              </h3>

              {/* DESCRIPTION TOUJOURS VISIBLE */}
              <p className="text-gray-700 dark:text-gray-300">
                📝 {item.medicines?.description}
              </p>

              <p className="text-gray-700 dark:text-gray-300">
                📦 Stock: {item.quantity}
              </p>

              <p className="text-green-600 dark:text-green-400 font-bold">
                💰 {item.price} FCFA
              </p>

              <button
                onClick={() => {
                  setEditingStock(item);
                  setEditName(item.medicines.name);
                  setEditDescription(item.medicines.description);
                  setEditQuantity(item.quantity);
                  setEditPrice(item.price);
                }}
                className="mt-3 mr-2 bg-blue-600 text-white px-3 py-1 rounded-xl"
              >
                Modifier
              </button>

              <button
                onClick={() => deleteStock(item.id)}
                className="mt-3 bg-red-600 text-white px-3 py-1 rounded-xl"
              >
                Supprimer
              </button>
            </div>
          ))}

        </div>

        {/* MODAL EDIT */}
        {editingStock && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">

            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl w-full max-w-lg space-y-3">

              <input value={editName} onChange={(e) => setEditName(e.target.value)} />
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              <input value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
              <input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />

              <button onClick={updateMedicine} className="bg-green-600 text-white w-full p-2 rounded-xl">
                Sauvegarder
              </button>

              <button onClick={() => setEditingStock(null)} className="bg-gray-400 w-full p-2 rounded-xl">
                Fermer
              </button>

            </div>

          </div>
        )}

      </div>
    </main>
  );
}