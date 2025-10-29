// Basic service worker for offline caching
const CACHE = "maigan-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE && caches.delete(k))))
  );
});

self.addEventListener("fetch", (e)=>{
  e.respondWith(
    caches.match(e.request).then(res=> res || fetch(e.request).then(r=>{
      // optional: runtime cache
      return r;
    }).catch(()=> caches.match("./index.html")))
  );
});
