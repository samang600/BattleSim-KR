// 오프라인용 간단 캐시 (앱 파일 + 본 적 있는 포켓몬 그림)
const CACHE = 'battle-kr-v1';
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png']))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
	const url = e.request.url;
	if (e.request.method !== 'GET') return;
	// 방문자 집계(GoatCounter)는 캐시하지 않고 그대로 보냄
	if (url.includes('goatcounter.com') || url.includes('gc.zgo.at')) return;
	if (url.includes('/sprites/')) {
		e.respondWith(caches.open(CACHE).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; })));
		return;
	}
	e.respondWith(fetch(e.request).then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request)));
});
