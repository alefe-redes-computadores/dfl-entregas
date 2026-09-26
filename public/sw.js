// DFL Entregas — App Shell Offline V6
//
// Contrato:
// - uma nova versão deste arquivo invalida os caches antigos;
// - navegação é network-first;
// - chunks imutáveis do Next podem usar cache-first;
// - SW/manifest nunca ficam presos em cache antigo;
// - Firebase/Maps/iFood e terceiros não são interceptados.

const VERSION = 'dfl-entregas-v6';
const CORE_CACHE = `${VERSION}-core`;
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;

const APP_CACHE_PREFIX = 'dfl-entregas-';

const CORE_URLS = [
  '/',
  '/manifest.json?v=2',
  '/favicon.ico?v=2',
  '/icon-192.png?v=2',
  '/icon-512.png?v=2',
  '/icon-maskable-192.png?v=2',
  '/icon-maskable-512.png?v=2',
  '/apple-touch-icon.png?v=2',
  '/brand/dfl-entregas.png?v=2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CORE_CACHE);

      await Promise.allSettled(
        CORE_URLS.map(async (url) => {
          try {
            const response = await fetch(url, {
              cache: 'reload',
            });

            if (response.ok) {
              await cache.put(url, response.clone());
            }
          } catch {
            // Cache offline nunca impede a instalação.
          }
        }),
      );

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith(APP_CACHE_PREFIX) &&
              ![
                CORE_CACHE,
                PAGE_CACHE,
                ASSET_CACHE,
              ].includes(name),
          )
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

const isCacheableResponse = (response) =>
  Boolean(
    response &&
      response.ok &&
      response.type !== 'opaque',
  );

const putSafely = async (
  cacheName,
  request,
  response,
) => {
  if (!isCacheableResponse(response)) return;

  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch {
    // Cache é resiliência, nunca autoridade sobre a UI.
  }
};

const navigationFallback = async (request) => {
  const exact = await caches.match(request);
  if (exact) return exact;

  const ignoringSearch = await caches.match(request, {
    ignoreSearch: true,
  });
  if (ignoringSearch) return ignoringSearch;

  const url = new URL(request.url);
  const pathnameMatch = await caches.match(url.pathname);

  if (pathnameMatch) return pathnameMatch;

  return caches.match('/');
};

const handleNavigation = async (request) => {
  try {
    const response = await fetch(request, {
      cache: 'no-store',
    });

    if (isCacheableResponse(response)) {
      void putSafely(
        PAGE_CACHE,
        request,
        response,
      );
    }

    return response;
  } catch {
    const fallback = await navigationFallback(request);

    if (fallback) return fallback;

    return new Response(
      'DFL Entregas está offline e esta tela ainda não foi armazenada neste aparelho.',
      {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      },
    );
  }
};

const handleNextStaticAsset = async (request) => {
  const cached = await caches.match(request);

  if (cached) return cached;

  const response = await fetch(request);

  if (isCacheableResponse(response)) {
    void putSafely(
      ASSET_CACHE,
      request,
      response,
    );
  }

  return response;
};

const handleMutableStaticAsset = async (request) => {
  try {
    const response = await fetch(request, {
      cache: 'no-cache',
    });

    if (isCacheableResponse(response)) {
      void putSafely(
        ASSET_CACHE,
        request,
        response,
      );
    }

    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('offline-static-cache-miss');
  }
};

const handleSameOriginGet = async (request) => {
  try {
    const response = await fetch(request, {
      cache: 'no-store',
    });

    if (isCacheableResponse(response)) {
      void putSafely(
        PAGE_CACHE,
        request,
        response,
      );
    }

    return response;
  } catch {
    const cached = await caches.match(request, {
      ignoreSearch: true,
    });

    if (cached) return cached;

    throw new Error('offline-cache-miss');
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // O próprio mecanismo de atualização jamais passa pelo cache da PWA.
  if (
    url.pathname === '/sw.js' ||
    url.pathname === '/manifest.json'
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Chunks Next possuem hash no nome e são imutáveis.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleNextStaticAsset(request));
    return;
  }

  const isMutableStatic =
    /\.(?:js|css|woff2?|png|jpe?g|webp|svg|ico)$/i.test(
      url.pathname,
    );

  if (isMutableStatic) {
    event.respondWith(handleMutableStaticAsset(request));
    return;
  }

  event.respondWith(handleSameOriginGet(request));
});
