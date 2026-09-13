// public/sw.js
//
// DFL Entregas — App Shell Offline V2
//
// Estratégia:
// - app shell básico é pré-cacheado;
// - assets estáticos versionados usam cache-first;
// - navegação usa network-first + fallback local;
// - respostas válidas visitadas são gravadas para uso offline;
// - chamadas de terceiros/Firebase não são interceptadas.

const VERSION = 'dfl-entregas-v2';
const CORE_CACHE = `${VERSION}-core`;
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;

const CORE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

const APP_CACHE_PREFIX = 'dfl-entregas-';

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
            // Uma falha isolada não invalida a instalação inteira.
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
    // Cache é melhoria de resiliência, nunca motivo para quebrar a UI.
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
    const response = await fetch(request);

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

const handleStaticAsset = async (request) => {
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

const handleSameOriginGet = async (request) => {
  try {
    const response = await fetch(request);

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

  // Firestore, Google Maps, iFood e demais terceiros
  // mantêm suas próprias políticas de rede/cache.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      handleNavigation(request),
    );
    return;
  }

  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:js|css|woff2?|png|jpe?g|webp|svg|ico)$/i.test(
      url.pathname,
    );

  if (isStatic) {
    event.respondWith(
      handleStaticAsset(request),
    );
    return;
  }

  event.respondWith(
    handleSameOriginGet(request),
  );
});
