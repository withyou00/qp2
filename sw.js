/* With You QP Generator — Service Worker
   • ಪುಟ (HTML): ಯಾವಾಗಲೂ ಹೊಸದನ್ನು ಮೊದಲು ತರುತ್ತದೆ; ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದಾಗ ಕೊನೆಯ ಪ್ರತಿ.
   • ಪ್ರಶ್ನೆ ಫೈಲ್‌ಗಳು / ಚಿತ್ರಗಳು (GitHub): ಹೊಸದನ್ನು ಮೊದಲು; ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದಾಗ ಹಿಂದೆ ಲೋಡ್ ಆದ ಪ್ರತಿ.
   • Tailwind / ಫಾಂಟ್ / ಐಕಾನ್‌ಗಳು: ಉಳಿಸಿದ ಪ್ರತಿ ತಕ್ಷಣ, ಹಿನ್ನೆಲೆಯಲ್ಲಿ ಹೊಸದು.
   • Firebase / ಲಾಗಿನ್: ಮುಟ್ಟುವುದಿಲ್ಲ (ಯಾವಾಗಲೂ ನೇರವಾಗಿ ಇಂಟರ್ನೆಟ್).                      */
const VERSION = 'wyqp-v1';
const PAGE_CACHE = VERSION + '-pages';
const DATA_CACHE = VERSION + '-data';
const LIB_CACHE = VERSION + '-libs';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGE_CACHE).then((c) => c.addAll(['./', './manifest.json', './icon-192.png', './icon-512.png']).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function stripQuery(url) { const u = new URL(url); u.search = ''; return u.toString(); }

async function networkFirst(req, cacheName, keyUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(keyUrl || req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(keyUrl || req, { ignoreSearch: !keyUrl });
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(LIB_CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const host = url.hostname;

  // Firebase ಡೇಟಾಬೇಸ್ ಮತ್ತು ಲಾಗಿನ್ — ಎಂದಿಗೂ cache ಮಾಡಬಾರದು
  if (/firebasedatabase\.app|firebaseio\.com|identitytoolkit|securetoken|googleapis\.com\/identitytoolkit/.test(host + url.pathname)) return;

  // ಈ ವೆಬ್‌ಸೈಟ್‌ನ ಪುಟಗಳು
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate' || req.destination === 'document') {
      e.respondWith(networkFirst(req, PAGE_CACHE).catch(() => caches.match('./')));
    } else {
      e.respondWith(networkFirst(req, PAGE_CACHE));
    }
    return;
  }

  // GitHub ಪ್ರಶ್ನೆ ಫೈಲ್‌ಗಳು ಮತ್ತು ಚಿತ್ರಗಳು (?t=... ಇಲ್ಲದೆ ಉಳಿಸುವುದು)
  if (host === 'raw.githubusercontent.com' || host.endsWith('googleusercontent.com') || host.endsWith('blogspot.com')) {
    e.respondWith(networkFirst(req, DATA_CACHE, stripQuery(req.url)));
    return;
  }

  // CSS / JS / ಫಾಂಟ್ ಲೈಬ್ರರಿಗಳು
  if (/cdn\.tailwindcss\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com/.test(host)) {
    e.respondWith(staleWhileRevalidate(req));
  }
});
