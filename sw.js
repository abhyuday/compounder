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
