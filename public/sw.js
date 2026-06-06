// public/sw.js — SetForge service worker (Web Push notifications).
// Minimal + push-only: no offline caching (the SPA is online-first). Served at
// root scope (/sw.js) so it controls the whole origin. Registered from the
// browser-notifications opt-in in the profile.

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = data.title || "SetForge";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.indexOf(self.location.origin) === 0 && "focus" in w) return w.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
