import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";

// injectManifest strategy (instead of the default generateSW) so we can add the push/click
// handlers below — vite-plugin-pwa fills this array in at build time.
//
// index.html is deliberately excluded from precaching: Workbox's default directory-index
// matching would otherwise serve it cache-first for every navigation ("/"), and a stale cached
// shell references JS/CSS filenames from whatever build was live when it was cached — filenames
// that no longer exist once a new deploy replaces them, which fails the whole app silently
// (blank white screen) until the cache is manually cleared. Navigations always go to the
// network first instead; only the content-hashed, inherently-versioned JS/CSS/icon assets are
// safe to precache and serve cache-first.
const manifest = self.__WB_MANIFEST.filter((entry) => !entry.url.endsWith(".html"));
precacheAndRoute(manifest);
cleanupOutdatedCaches();

registerRoute(new NavigationRoute(new NetworkFirst({ cacheName: "html-shell", networkTimeoutSeconds: 5 })));

self.skipWaiting();
self.addEventListener("activate", () => self.clients.claim());

// Fires only while a push subscription exists (see src/lib/push.js) — this is what lets a
// task/reminder alert reach the user even when the app tab/window is closed.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* non-JSON payload, ignore */ }
  const title = data.title || "MEXUZ CRM";
  const options = {
    body: data.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    dir: "rtl",
    lang: "he",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
