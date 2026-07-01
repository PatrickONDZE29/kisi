"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProviderTemp";

type PhotoMenu = "logo" | "cover" | null;

export default function PharmacySettingsPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [photoMenu, setPhotoMenu] = useState<PhotoMenu>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const [pharmacyId, setPharmacyId] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [website, setWebsite] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.push("/login"); return; }

    const { data } = await supabase
      .from("pharmacies")
      .select("*")
      .eq("user_id", auth.user.id)
      .single();

    if (data) {
      setPharmacyId(data.id);
      setLogoUrl(data.logo_url || "");
      setCoverUrl(data.cover_url || "");
      setName(data.name || "");
      setDescription(data.description || "");
      setAddress(data.address || "");
      setCity(data.city || "");
      setPhone(data.phone || "");
      setEmail(data.email || "");
      setWhatsapp(data.whatsapp || "");
      setWebsite(data.website || "");
      setFacebook(data.facebook || "");
      setInstagram(data.instagram || "");
      setOpeningHours(data.opening_hours || "");
      setIsOpen(data.is_open ?? true);
    }

    setLoading(false);
  }

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, type: "logo" | "cover") {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 240;
    const menuHeight = 200;

    // Calcule la position idéale à côté du bouton
    let left = rect.right + 8;
    let top = rect.top;

    // Si ça dépasse à droite, on met à gauche du bouton
    if (left + menuWidth > window.innerWidth) {
      left = rect.left - menuWidth - 8;
    }

    // Si ça dépasse en bas, on remonte
    if (top + menuHeight > window.innerHeight) {
      top = window.innerHeight - menuHeight - 16;
    }

    setMenuPos({ top, left });
    setPhotoMenu(photoMenu === type ? null : type);
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "cover"
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (type === "logo") setUploadingLogo(true);
    else setUploadingCover(true);

    const bucket = type === "logo" ? "pharmacy-logos" : "pharmacy-images";
    const field = type === "logo" ? "logo_url" : "cover_url";
    const fileName = Date.now() + "-" + file.name;

    const { error } = await supabase.storage.from(bucket).upload(fileName, file);
    if (error) {
      alert(error.message);
      if (type === "logo") setUploadingLogo(false);
      else setUploadingCover(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
    await supabase.from("pharmacies").update({ [field]: publicUrl }).eq("id", pharmacyId);

    if (type === "logo") { setLogoUrl(publicUrl); setUploadingLogo(false); }
    else { setCoverUrl(publicUrl); setUploadingCover(false); }

    showToast(type === "logo" ? "✅ Logo mis à jour !" : "✅ Photo de couverture mise à jour !");
    setPhotoMenu(null);
  }

  function downloadPhoto(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = url.split("/").pop() || "photo";
    a.target = "_blank";
    a.click();
  }

  async function saveSettings() {
    const { error } = await supabase.from("pharmacies").update({
      name, description, address, city, phone, email,
      whatsapp, website, facebook, instagram,
      opening_hours: openingHours, is_open: isOpen,
      logo_url: logoUrl, cover_url: coverUrl,
    }).eq("id", pharmacyId);
    if (error) { showToast(error.message, "error"); return; }
    showToast("✅ Paramètres enregistrés avec succès");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-black dark:text-white transition-colors">
        Chargement...
      </main>
    );
  }

  const currentPhotoUrl = photoMenu === "logo" ? logoUrl : coverUrl;

  return (
    <main className="min-h-screen p-6 bg-[#00572D] dark:bg-gray-950 transition-colors">
      <div className="max-w-4xl mx-auto">
        <div className="rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-gray-900 transition-colors">

          {/* COUVERTURE */}
          <div className="relative">
            {coverUrl ? (
              <img src={coverUrl} className="w-full h-56 object-cover" alt="Couverture" />
            ) : (
              <div className="w-full h-56 bg-gray-200 dark:bg-gray-800" />
            )}

            {/* Stylo couverture */}
            <button
              onClick={(e) => openMenu(e, "cover")}
              className="absolute top-3 right-3 w-9 h-9 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center text-[#00572D] dark:text-green-400 hover:scale-110 transition-transform z-10"
            >
              ✏️
            </button>

            {/* LOGO */}
            <div className="absolute -bottom-12 left-6">
              <div className="relative w-24 h-24">
                <img
                  src={logoUrl || "/pharmacie.png"}
                  className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-900 bg-white dark:bg-gray-800 object-cover"
                  alt="Logo"
                />
                {/* Stylo logo */}
                <button
                  onClick={(e) => openMenu(e, "logo")}
                  className="absolute top-0 right-0 w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center text-[#00572D] dark:text-green-400 hover:scale-110 transition-transform z-10"
                >
                  ✏️
                </button>
              </div>
            </div>
          </div>

          {/* MENU CONTEXTUEL — positionné exactement à côté du crayon */}
          {photoMenu && (
            <>
              {/* Fond transparent pour fermer au clic extérieur */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setPhotoMenu(null)}
              />

              {/* Menu positionné dynamiquement */}
              <div
                className="fixed z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700"
                style={{
                  top: menuPos.top,
                  left: menuPos.left,
                  width: 240,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-4 py-3 border-b dark:border-gray-700">
                  <p className="font-bold text-sm text-black dark:text-white">
                    {photoMenu === "logo" ? "Logo" : "Photo de couverture"}
                  </p>
                </div>

                {/* MODIFIER — input superposé */}
                <label className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer relative">
                  <span className="text-lg">🖼️</span>
                  <span className="text-black dark:text-white text-sm font-medium">Modifier la photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, photoMenu)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>

                {/* VOIR */}
                <button
                  onClick={() => {
                    setPhotoMenu(null);
                    if (currentPhotoUrl) setViewerUrl(currentPhotoUrl);
                  }}
                  disabled={!currentPhotoUrl}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
                >
                  <span className="text-lg">👁️</span>
                  <span className="text-black dark:text-white text-sm font-medium">Voir la photo</span>
                </button>

                {/* ENREGISTRER */}
                <button
                  onClick={() => {
                    setPhotoMenu(null);
                    if (currentPhotoUrl) downloadPhoto(currentPhotoUrl);
                  }}
                  disabled={!currentPhotoUrl}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
                >
                  <span className="text-lg">💾</span>
                  <span className="text-black dark:text-white text-sm font-medium">Enregistrer la photo</span>
                </button>

                {/* ANNULER */}
                <button
                  onClick={() => setPhotoMenu(null)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="text-lg">✖️</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Annuler</span>
                </button>
              </div>
            </>
          )}

          {/* VISIONNEUSE PLEIN ÉCRAN */}
          {viewerUrl && (
            <div
              className="fixed inset-0 bg-black z-50 flex items-center justify-center"
              onClick={() => setViewerUrl(null)}
            >
              <button
                onClick={() => setViewerUrl(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full text-white text-xl flex items-center justify-center hover:bg-white/40 transition"
              >
                ✕
              </button>
              <img
                src={viewerUrl}
                alt="Photo"
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Indicateurs upload */}
          {(uploadingLogo || uploadingCover) && (
            <div className="pt-16 px-6">
              <p className="text-sm text-[#00572D] dark:text-green-400 font-medium">
                {uploadingLogo ? "⏳ Téléchargement du logo..." : "⏳ Téléchargement de la couverture..."}
              </p>
            </div>
          )}

          <div className={`${uploadingLogo || uploadingCover ? "pt-4" : "pt-16"} p-6 space-y-5`}>
            <div>
              <h1 className="text-3xl font-bold text-[#00572D] dark:text-green-400">Paramètres pharmacie</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Cliquez sur le ✏️ pour modifier le logo ou la couverture.
              </p>
            </div>

            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la pharmacie" className="w-full border dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={4} className="w-full border dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse" className="w-full border dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville" className="w-full border dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" className="w-full border dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full border dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp" className="w-full border dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Site web" className="w-full border dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            <input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="Facebook" className="w-full border dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram" className="w-full border dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            <input value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} placeholder="Horaires d'ouverture" className="w-full border dark:border-gray-700 p-4 rounded-xl text-black dark:text-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500" />

            <div className="flex items-center gap-3">
              <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} />
              <span className="text-black dark:text-white">Pharmacie ouverte</span>
            </div>

            <button onClick={saveSettings} className="w-full bg-[#00572D] dark:bg-green-700 text-white p-4 rounded-xl font-bold">Enregistrer</button>
            <button onClick={logout} className="w-full bg-red-600 dark:bg-red-700 text-white p-4 rounded-xl font-bold">Déconnexion</button>
            <button
              onClick={async () => {
                const emailUser = prompt("Entrez votre email");
                if (!emailUser) return;
                const { error } = await supabase.auth.resetPasswordForEmail(emailUser, { redirectTo: window.location.origin + "/update-password" });
                if (error) alert(error.message); else alert("Lien envoyé sur votre email.");
              }}
              className="w-full bg-blue-600 dark:bg-blue-700 text-white p-4 rounded-xl font-bold"
            >
              Modifier le mot de passe
            </button>
            <button
              onClick={async () => {
                if (!confirm("Supprimer définitivement le compte ?")) return;
                const { error } = await supabase.from("pharmacies").delete().eq("id", pharmacyId);
                if (error) { alert(error.message); return; }
                await supabase.auth.signOut();
                router.push("/");
              }}
              className="w-full bg-red-800 dark:bg-red-900 text-white p-4 rounded-xl font-bold"
            >
              Supprimer le compte
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}