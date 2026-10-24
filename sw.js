/* 한 번 열면 인터넷 없이도 열리게 파일을 저장해 둔다. 새 버전을 올리면 VERSION 을 바꾼다 */
const VERSION = 'donggle-v5';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'assets/jua.ttf', 'assets/bgm.m4a', 'assets/babam.wav', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png', 'assets/apple-touch-icon.png',
  'js/app.js', 'js/core.js', 'js/sound.js',
  'js/data/raw.js', 'js/data/items.js', 'js/data/teams.js', 'js/data/legends.js', 'js/data/tournament.js', 'js/data/store.js',
  'js/game/engine.js', 'js/game/draw.js', 'js/game/render.js', 'js/game/tutorial.js',
  'js/ui/kit.js', 'js/ui/menu.js', 'js/ui/play.js', 'js/ui/tutorialScreens.js', 'js/ui/match.js', 'js/ui/worldcup.js',
  'js/ui/league.js', 'js/ui/shop.js', 'js/ui/transfer.js', 'js/ui/myteam.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// 인터넷이 되면 새 파일, 안 되면 저장해 둔 파일
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
