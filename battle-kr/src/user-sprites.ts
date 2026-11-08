/** 사용자가 직접 넣은 포켓몬 그림 (설정 → 포켓몬 그림 바꾸기)
 *  저장: localStorage `pkbkr:userSprites` = { '<그림 id>[-back][-shiny]': { src: PNG data URL, pad: 바닥 여백(px) } }
 *  정지 도트 그림 설정에서는 서버·앱 그림보다 먼저 쓰고, 3D 그림 설정에서는 3D 그림을 못 받을 때(오프라인 등) 이름 카드 대신 씀.
 *  데이터 백업(pkbkr:*)에 함께 들어감. */
import { load, save } from './store';

export interface UserSprite { src: string; pad: number; /** 칠해진 영역 [x, y, 너비, 높이] (목록 썸네일 자르기) */ bb?: number[] }
const KEY = 'userSprites';
let cache: { [k: string]: UserSprite } | null = null;
const all = () => (cache ||= load<{ [k: string]: UserSprite }>(KEY, {}));

export const userSpriteKey = (id: string, back: boolean, shiny: boolean) => `${id}${back ? '-back' : ''}${shiny ? '-shiny' : ''}`;
export function getUserSprite(key: string): UserSprite | null { return all()[key] || null; }
export function listUserSprites(): string[] { return Object.keys(all()); }
export function removeUserSprite(key: string) { const m = { ...all() }; delete m[key]; cache = m; save(KEY, m); }

/** 그림 파일 → 96×96 도트 그림 (정수배로 키운 그림은 원래 크기로, 큰 그림은 칸에 맞게 줄이고 아래 가운데 정렬) */
export async function setUserSprite(key: string, file: Blob): Promise<UserSprite> {
	const url = URL.createObjectURL(file);
	try {
		const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('그림을 읽지 못했습니다')); i.src = url; });
		const S = 96;
		// 정수배(2배·3배…)로 키운 도트 그림이면 그 배수로 나눔, 아니면 96 칸에 들어가게
		const k = Math.max(1, Math.round(Math.max(img.width, img.height) / S));
		let w = img.width / k, h = img.height / k;
		if (w > S || h > S) { const f = S / Math.max(w, h); w *= f; h *= f; }
		w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
		const c = document.createElement('canvas'); c.width = S; c.height = S;
		const g = c.getContext('2d')!; g.imageSmoothingEnabled = false;
		g.drawImage(img, Math.floor((S - w) / 2), S - h, w, h);
		// 바닥 여백: 아래에서 처음 칠해진 줄까지
		const px = g.getImageData(0, 0, S, S).data;
		let pad = 0;
		outer: for (let y = S - 1; y >= 0; y--) { for (let x = 0; x < S; x++) if (px[(y * S + x) * 4 + 3] > 20) break outer; pad++; }
		let x0 = S, y0 = S, x1 = -1, y1 = -1;
		for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (px[(y * S + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
		const sp = { src: c.toDataURL('image/png'), pad: pad >= S ? 0 : pad, bb: x1 < 0 ? [0, 0, S, S] : [x0, y0, x1 - x0 + 1, y1 - y0 + 1] };
		const m = { ...all(), [key]: sp };
		cache = m; save(KEY, m);
		return sp;
	} finally { URL.revokeObjectURL(url); }
}
