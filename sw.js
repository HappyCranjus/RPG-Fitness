const CACHE_NAME = 'rpgfit-v13';

// Paths are relative to the service worker's location, so the app
// works whether it's served from the domain root or a subpath
// (e.g. GitHub Pages /<repo>/).
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/rpg.css',
  './js/store.js',
  './js/router.js',
  './js/ranks.js',
  './js/routines.js',
  './js/engine.js',
  './js/monsters.js',
  './js/quests.js',
  './js/achievements.js',
  './js/app.js',
  './js/ui/dashboard.js',
  './js/ui/log.js',
  './js/ui/questsScreen.js',
  './js/ui/character.js',
  './js/ui/combat.js',
  './js/ui/history.js',
  './js/ui/schedule.js',
  './js/ui/settings.js',
  './js/ui/mealLibrary.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (Google Fonts CDN)
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    event.respondWith(fetch(event.request).catch(() => new Response('')));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
