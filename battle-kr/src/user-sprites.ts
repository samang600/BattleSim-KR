/** 사용자가 직접 넣은 포켓몬 그림 (설정 → 포켓몬 그림 바꾸기)
 *  저장: IndexedDB `pkbkr` · 'userSprites' (그림이 많아도 되게 — localStorage 는 약 5MB 한도). 예전 localStorage `pkbkr:userSprites` 는 처음에 옮김.
 *  키: '<그림 id>[-back][-shiny]', 값: { src: PNG data URL, pad: 바닥 여백, bb: 칠해진 영역 }
 *  정지 도트 그림 설정에서는 서버·앱 그림보다 먼저 쓰고, 3D 그림 설정에서는 3D 그림을 못 받을 때(오프라인 등) 이름 카드 대신 씀.
 *  화면은 동기로 그려야 해서 시작할 때 전부 메모리로 읽어 둠(cache). */
import { load, remove } from './store';

export interface UserSprite { src: string; pad: number; /** 칠해진 영역 [x, y, 너비, 높이] (목록 썸네일 자르기) */ bb?: number[] }
let cache: { [k: string]: UserSprite } = {};
const listeners = new Set<() => void>();
export function onUserSpritesChange(f: () => void) { listeners.add(f); return () => listeners.delete(f); }
const changed = () => listeners.forEach(f => f());

// ── IndexedDB ──
const DB = 'pkbkr', STORE = 'userSprites';
function db(): Promise<IDBDatabase> {
	return new Promise((ok, no) => {
		const r = indexedDB.open(DB, 1);
		r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
		r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
	});
}
async function tx(mode: IDBTransactionMode, f: (s: IDBObjectStore) => void) {
	const d = await db();
	await new Promise<void>((ok, no) => { const t = d.transaction(STORE, mode); f(t.objectStore(STORE)); t.oncomplete = () => ok(); t.onerror = () => no(t.error); t.onabort = () => no(t.error); });
}
/** 시작할 때 한 번: 저장된 그림을 메모리로 (+ 예전 localStorage 저장분 옮기기) */
export const userSpritesReady: Promise<void> = (async () => {
	try {
		const d = await db();
		const all = await new Promise<{ [k: string]: UserSprite }>((ok, no) => {
			const out: { [k: string]: UserSprite } = {};
			const r = d.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
			r.onsuccess = () => { const c = r.result; if (c) { out[c.key as string] = c.value; c.continue(); } else ok(out); };
			r.onerror = () => no(r.error);
		});
		const old = load<{ [k: string]: UserSprite }>('userSprites', {});
		if (Object.keys(old).length) { await tx('readwrite', s => { for (const k in old) s.put(old[k], k); }); Object.assign(all, old); remove('userSprites'); }
		cache = all;
	} catch { cache = load<{ [k: string]: UserSprite }>('userSprites', {}); }
	changed();
})();

export const userSpriteKey = (id: string, back: boolean, shiny: boolean) => `${id}${back ? '-back' : ''}${shiny ? '-shiny' : ''}`;
export function getUserSprite(key: string): UserSprite | null { return cache[key] || null; }
export function listUserSprites(): string[] { return Object.keys(cache); }
export async function removeUserSprite(key: string) { delete cache[key]; changed(); try { await tx('readwrite', s => s.delete(key)); } catch {} }
export async function clearUserSprites() { cache = {}; changed(); try { await tx('readwrite', s => s.clear()); } catch {} }

/** 그림 → 96×96 도트 그림 (정수배로 키운 그림은 원래 크기로, 큰 그림은 칸에 맞게 줄이고 아래 가운데 정렬) */
export async function makeUserSprite(file: Blob): Promise<UserSprite> {
	const url = URL.createObjectURL(file);
	try {
		const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('그림을 읽지 못했습니다')); i.src = url; });
		const S = 96;
		const k = Math.max(1, Math.round(Math.max(img.width, img.height) / S));
		let w = img.width / k, h = img.height / k;
		if (w > S || h > S) { const f = S / Math.max(w, h); w *= f; h *= f; }
		w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
		const c = document.createElement('canvas'); c.width = S; c.height = S;
		const g = c.getContext('2d')!; g.imageSmoothingEnabled = false;
		g.drawImage(img, Math.floor((S - w) / 2), S - h, w, h);
		const px = g.getImageData(0, 0, S, S).data;
		let pad = 0;
		outer: for (let y = S - 1; y >= 0; y--) { for (let x = 0; x < S; x++) if (px[(y * S + x) * 4 + 3] > 20) break outer; pad++; }
		let x0 = S, y0 = S, x1 = -1, y1 = -1;
		for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (px[(y * S + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
		return { src: c.toDataURL('image/png'), pad: pad >= S ? 0 : pad, bb: x1 < 0 ? [0, 0, S, S] : [x0, y0, x1 - x0 + 1, y1 - y0 + 1] };
	} finally { URL.revokeObjectURL(url); }
}
/** 여러 장을 한 번에 저장 (일괄 적용) */
export async function putUserSprites(items: { [key: string]: UserSprite }) {
	Object.assign(cache, items); changed();
	await tx('readwrite', s => { for (const k in items) s.put(items[k], k); });
}
export async function setUserSprite(key: string, file: Blob): Promise<UserSprite> {
	const sp = await makeUserSprite(file);
	await putUserSprites({ [key]: sp });
	return sp;
}
