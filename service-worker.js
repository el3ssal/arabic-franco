/*
 * Arabic <-> Franco - offline service worker
 * ------------------------------------------
 * Strategy:
 *  - Precache the full app shell on install.
 *  - Navigation requests: network-first, fall back to the cached page offline.
 *  - Other same-origin GETs: cache-first, then network (and cache the result).
 *
 * IMPORTANT: bump CACHE_NAME whenever you deploy changes, so clients pick
 * up the new assets instead of serving the old cached copy forever.
 */

const CACHE_NAME = "arabic-franco-v1";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.ico",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigation: always try the network first, then the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match("./index.html")
          .then((cached) => cached || caches.match("./"))
      )
    );
    return;
  }

  // Static assets: cache-first with runtime caching as a fallback.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
