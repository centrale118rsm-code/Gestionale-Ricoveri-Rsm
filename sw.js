// Service worker · Posti letto · Ospedale di Stato RSM
// Serve solo a rendere l'app installabile e ad aprirla più in fretta.
// I dati (Firebase) passano sempre dalla rete: nessun dato dei reparti viene salvato qui.
const CACHE = 'posti-letto-3.9.0';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('posti-letto-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firebase, Google e ogni altra origine: sempre rete, mai cache.
  if (url.origin !== self.location.origin) return;
  // Il controllo della versione pubblicata va sempre in rete e non si salva.
  if (url.pathname.endsWith('/version.json')) return;

  // Rete per prima, chiedendo sempre al sito se c'è una versione nuova (no-cache):
  // con la connessione si vede sempre l'ultima versione pubblicata; senza rete, o se la rete
  // non risponde entro 8 secondi, si apre la copia salvata.
  const fromCache = () => caches.match(req, { ignoreSearch: true })
    .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
  const net = (req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' }))
    .then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    });
  net.catch(() => {});
  const slow = new Promise(resolve => setTimeout(resolve, 8000)).then(fromCache).then(hit => hit || net);
  e.respondWith(
    Promise.race([net, slow])
      .catch(() => fromCache().then(hit => hit || Response.error()))
  );
});
