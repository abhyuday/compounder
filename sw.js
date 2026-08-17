// Compounder service worker: network-first for the app shell so deploys always
// win when online, cache fallback so the app loads offline. Only the same-origin
// shell and the Supabase JS CDN are cached — API/auth requests pass straight through.
var CACHE = "compounder-v1";

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var isCDN = url.hostname === "cdn.jsdelivr.net";
  if (!sameOrigin && !isCDN) return; // leave Supabase (and everything else) alone

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () { return caches.match(req); })
  );
});

// ---- Push reminders ----
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  var title = d.title || "Compounder";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "Time to log your points.",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: d.tag || "compounder-reminder",
    data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ("focus" in list[i]) return list[i].focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
