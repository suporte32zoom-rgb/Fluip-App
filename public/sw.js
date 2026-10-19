/**
 * Service Worker - Estradapay PWA
 * Versão: 3.0.0-auto-update
 * Recursos: Limpeza automática de caches antigos, auto-update instantâneo (skipWaiting/clientsClaim),
 * estratégia Network-First para navegação e dados dinâmicos, e Stale-While-Revalidate com revalidação de assets.
 */

const CACHE_NAME = 'estradapay-v3.0.0-auto-update';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/termos.html',
  '/privacidade.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon.svg',
  '/logo.jpg',
  '/favicon.ico',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  // Ativação imediata do novo worker sem esperar fechar abas
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pré-cacheando versão atualizada:', CACHE_NAME);
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Aviso ao pré-cachear arquivos estáticos:', err);
      });
    })
  );
});

// Ativação e limpeza instantânea de caches obsoletos de deploys anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Limpando cache antigo/obsoleto de deploy anterior:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Reivindicar controle de todos os clientes abertos imediatamente
      return self.clients.claim();
    }).then(() => {
      // Notificar todos os clientes conectados sobre a ativação da nova versão
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: CACHE_NAME,
            timestamp: Date.now(),
          });
        });
      });
    })
  );
});

// Comunicação com a aplicação client (skipWaiting sob demanda ou força de reload)
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.type === 'SKIP_WAITING' || event.data.action === 'skipWaiting') {
      console.log('[SW] Mensagem recebida: SKIP_WAITING');
      self.skipWaiting();
    }
    if (event.data.type === 'CLEAR_ALL_CACHES') {
      event.waitUntil(
        caches.keys().then((keys) => {
          return Promise.all(keys.map((k) => caches.delete(k)));
        }).then(() => {
          self.skipWaiting();
        })
      );
    }
  }
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Não interceptar requisições não-GET
  if (request.method !== 'GET') {
    return;
  }

  // 1. O próprio Service Worker NUNCA deve ser servido do cache
  if (url.pathname === '/sw.js') {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Requisições de API (/api/v1/ e /api/auth/) -> Network First com fallback JSON offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => {
          return new Response(
            JSON.stringify({
              success: false,
              offline: true,
              error: 'Você está offline. Conecte-se à internet para consultar ou pagar pedágios em tempo real.',
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 503,
            }
          );
        })
    );
    return;
  }

  // 3. Navegação (HTML principal e páginas) -> Network-First
  // Garante que qualquer deploy novo via GitHub/Hostinger seja entregue imediatamente ao usuário online!
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // Se offline, serve a versão em cache
          return caches.match(request).then((cached) => {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 4. Recursos externos (Google Fonts, ícones de terceiros) -> Cache-First
  if (
    url.origin.includes('fonts.googleapis.com') ||
    url.origin.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 5. Assets estáticos (CSS, JS, Imagens locais) -> Stale-While-Revalidate com atualização em background
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});
