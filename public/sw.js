// public/sw.js — Service Worker KISI

const CACHE_NAME = "kisi-v2";

// Fichiers à mettre en cache au premier chargement
const STATIC_ASSETS = [
  "/",
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
];

// INSTALLATION
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Mise en cache individuelle pour éviter qu'un seul fichier manquant bloque tout
      await Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("SW: échec mise en cache de", url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// ACTIVATION
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// FETCH — Network First robuste pour HTML, Cache First pour assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.hostname.includes("supabase") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // PAGES HTML — Network First avec vérification du statut
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // ⚠️ Vérifie que la réponse est valide AVANT de la mettre en cache
          if (!response || response.status !== 200) {
            throw new Error("Réponse réseau invalide");
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match("/offline.html");
          if (offline) return offline;
          // Dernier recours absolu pour ne jamais rester bloqué
          return new Response("KISI est hors ligne.", {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        })
    );
    return;
  }

  // ASSETS STATIQUES — Cache First avec fallback réseau sûr
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((response) => {
            if (!response || response.status !== 200) return response;
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
          .catch(() => cached)
    )
  );
});