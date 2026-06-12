/* PokéVerse service worker — offline-first for game data & CDN sprites. */
const VERSION = "pv-v0.6.0";
const CORE = [
  "/",
  "/play",
  "/data/dex.json",
  "/data/moves.json",
  "/data/learnsets.json",
  "/data/tmsets.json",
  "/data/flavor.json",
  "/manifest.json",
  "/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION && k !== "pv-cdn").map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // CDN sprites & cries: cache-first, immutable
  if (url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(
      caches.open("pv-cdn").then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // baked data: cache-first (immutable per deploy)
  if (url.pathname.startsWith("/data/")) {
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }

  // pages & assets: network-first with cache fallback (offline play)
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && (url.pathname === "/" || url.pathname === "/play" || url.pathname.startsWith("/_next/static/"))) {
          const clone = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit ?? caches.match("/play")))
  );
});
