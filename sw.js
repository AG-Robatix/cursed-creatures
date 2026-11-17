/* Service worker: keeps a copy of the game on the device so it opens instantly and works offline
   once it has been installed to the home screen.
   WHEN YOU CHANGE THE GAME: raise the number below (and the ?v= number in index.html) so players get the new version. */
const CACHE = 'cursed-creatures-v17';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'js/core.js', 'js/audio.js', 'js/art.js', 'js/entities.js', 'js/bosses.js', 'js/game.js', 'js/controls.js', 'js/levels.js', 'js/transfer.js', 'js/main.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {      // the page itself: newest when online, saved copy when offline
    e.respondWith(fetch(e.request).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
