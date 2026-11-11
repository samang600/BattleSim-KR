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
	// 성공한 응답만 보관: 오류 응답(404 등)을 넣어 두면 오프라인일 때 그 오류가 나오고, 부분 응답(206, 소리 파일)은 넣을 수 없음.
	// 버전 확인처럼 매번 주소가 달라지는 요청(?t=)은 쌓이기만 하므로 보관하지 않음
	e.respondWith(fetch(e.request).then(r => { if (r.status === 200 && !url.includes('?t=')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); } return r; }).catch(() => caches.match(e.request)));
});
