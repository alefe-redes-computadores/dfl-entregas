// public/sw.js
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Apenas gerencia o fluxo para atender aos critérios de PWA do navegador
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
