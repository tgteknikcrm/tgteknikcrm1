// Minimal service worker — required by Chrome to count this site as an
// installable PWA (bookmark vs. real app). No caching strategy: every
// request falls through to the network.
//
// If we add offline support later, expand the fetch handler here.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No-op handler — its presence is what makes Chrome treat this as a
  // real PWA. We intentionally don't call event.respondWith so the
  // browser uses its normal network path.
});
