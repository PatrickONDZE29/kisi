const CACHE_NAME = "kisi-v3";

const STATIC_ASSETS = [
  "/",
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
];

// 🔥 INSTALL
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("SW cache fail:", url, err);
          })
        )
      );
    })
  );

  // force activation immédiate
  self.skipWaiting();
});

// 🔥 ACTIVATE
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// 🔥 FETCH STRATEGY
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore API + Supabase
  if (
    request.method !== "GET" ||
    url.hostname.includes("supabase") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  const isHTML =
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html");

  // =========================
  // 🌐 HTML: Network First
  // =========================
  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) {
            throw new Error("Invalid response");
          }

          const clone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });

          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;

          const offline = await caches.match("/offline.html");
          if (offline) return offline;

          return new Response("KISI offline", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
        })
    );

    return;
  }

  // =========================
  // 📦 ASSETS: Cache First
  // =========================
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) return response;

          const clone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });

          return response;
        })
        .catch(() => cached);
    })
  );
});