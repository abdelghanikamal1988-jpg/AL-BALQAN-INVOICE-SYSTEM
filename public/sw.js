/**
 * AL BALQAN service worker — offline app shell.
 *
 * Strategy:
 *   navigation  -> network first, fall back to the cached index.html
 *   same-origin -> cache first, refresh in the background
 *   cross-origin (fonts, supabase) -> network only, never cached
 *
 * The scope is the repo sub-path GitHub Pages serves from, so every
 * URL here is resolved relative to the worker's own location.
 */

/* The version comes from the registration query (sw.js?v=<build id>), so
   every deploy installs a new worker and the activate step below drops the
   caches of the previous build. Falls back to the static name for direct
   visits that carry no query. */
const params = new URLSearchParams(self.location.search);
const VERSION = params.get('v') ? 'albalqan-' + params.get('v') : 'albalqan-v1';
const SHELL = `${VERSION}-shell`;

/* The app shell: enough for the UI to boot offline. */
const SHELL_URLS = ['./', './index.html', './manifest.json', './logo.png', './logo.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* Never touch Supabase, fonts or any other cross-origin request. */
  if (url.origin !== self.location.origin) return;

  /* Navigations: try the network, fall back to the cached shell. */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((r) => r || Response.error()))
    );
    return;
  }

  /* Static assets: cache first, refresh in the background. */
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
