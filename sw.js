/* 한 번 열면 인터넷 없이도 열리게 파일을 저장해 둔다. 새 버전을 올리면 VERSION 을 바꾼다 */
const VERSION = 'donggle-1.0.20'; // js/version.js 와 같게
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'assets/jua.ttf', 'assets/bgm.m4a', 'assets/babam.wav', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png', 'assets/apple-touch-icon.png',
  'js/app.js', 'js/core.js', 'js/sound.js', 'js/version.js',
  'js/data/raw.js', 'js/data/items.js', 'js/data/teams.js', 'js/data/legends.js', 'js/data/tournament.js', 'js/data/store.js', 'js/data/events.js',
  'js/game/engine.js', 'js/game/draw.js', 'js/game/render.js', 'js/game/tutorial.js',
  'js/ui/kit.js', 'js/ui/menu.js', 'js/ui/play.js', 'js/ui/tutorialScreens.js', 'js/ui/match.js', 'js/ui/worldcup.js',
  'js/ui/league.js', 'js/ui/shop.js', 'js/ui/transfer.js', 'js/ui/myteam.js', 'js/ui/events.js', 'js/ui/programArt.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// 인터넷이 되면 새 파일, 안 되면 저장해 둔 파일.
// 서버가 없다고(404 등) 하면 저장해 둔 파일로 열어서, 게임이 "서비스 종료"를 알아채고 스스로 지울 수 있게 한다.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // 살아 있는지 확인하는 파일은 저장하지 않고 늘 서버에 직접 물어본다
  if (new URL(e.request.url).pathname.endsWith('/alive.json')) return;
  // 매번 서버에 "바뀌었나?" 물어본다 (안 바뀌었으면 거의 데이터 안 씀). 새 파일·예전 파일이 섞여 깨지는 걸 막는다
  const fresh = e.request.mode === 'navigate'
    ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(
    fetch(fresh).then(async (res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      }
      return (await caches.match(e.request, { ignoreSearch: true })) ?? res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
