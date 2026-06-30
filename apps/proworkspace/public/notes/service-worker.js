const CACHE_NAME = "proworkspace-notes-v20260531";
const ASSETS = [
    "/notes",
    "/notes/notes.css?v=20260531-1",
    "/notes/notes.js?v=20260531-1",
    "/notes/manifest.webmanifest",
    "/notes/icon.svg"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS).catch(() => undefined))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== "GET" || url.origin !== self.location.origin) {
        return;
    }

    if (url.pathname.includes("/api/")) {
        event.respondWith(
            fetch(request).catch(() => new Response(JSON.stringify({
                ok: false,
                offline: true,
                message: "Offline"
            }), {
                status: 503,
                headers: { "content-type": "application/json; charset=utf-8" }
            }))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            const network = fetch(request).then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            }).catch(() => cached);

            return cached || network;
        })
    );
});
