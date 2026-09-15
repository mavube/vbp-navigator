// Minimal PWA shell service worker: cache the app shell for installability
// and offline resilience. Deliberately not a full offline-data strategy —
// v2.0's data is per-org and permissioned via Supabase, so caching API
// responses here would need real thought about staleness and RLS, not a
// blanket cache-everything approach. That's a later, deliberate pass.

const CACHE_NAME = "vbp-navigator-shell-v2";
const SHELL_URLS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
