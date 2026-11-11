/**
 * Pokémon Reborn 제작 배틀 애니메이션(PokéRogue 형식) 재생기
 *
 * 애니메이션 좌표계: 사용자가 (0,0), 대상이 (128,-64). 각 프레임(50ms)은 셀 목록이고
 *  셀[0]=t(0 사용자 스프라이트 / 1 대상 스프라이트 / 2 그림), x, y, zoomX, zoomY, graphicFrame, opacity, priority,
 *  focus(1 대상 / 2 사용자 / 3 사용자↔대상 선형변환 / 4 화면), blend(0 보통/1 가산/2 감산), mirror, angle, visible
 * 그림은 96×96 셀을 가로로 나열한 시트. 이벤트: se(효과음), bg(배경 그림 추가), bgu(배경 갱신)
 */
import { partBase } from './offline';
export interface AnimData { g: string; f: number[][][]; e: { [frame: string]: any[] } }
export interface Pt { x: number; y: number }
export interface PlayCtx {
	front: HTMLCanvasElement; back: HTMLCanvasElement; bgLayer: HTMLElement;
	userPt: Pt; targetPt: Pt; userEl: HTMLElement | null; targetEl: HTMLElement | null;
	/** 애니메이션 1단위 → 화면 px */
	k: number;
	/** 사용자가 상대(오른쪽 위)면 true */
	userIsFoe: boolean;
	sfxVolume: number;
	/** 재생 배속 (1 = 50ms/프레임) */
	speed?: number;
	/** 효과 그림에 씌울 CSS 필터 (테라버스트·비밀의힘처럼 다른 기술 그림을 타입 색으로 바꿀 때) */
	filter?: string;
	onFrame?: (i: number) => void;
}

declare const __ANIM_BASE__: string;
/** 내장/오프라인 묶음이 있으면 거기서, 없으면 인터넷(jsDelivr 의 저장소 파일) */
const animBase = () => partBase('anims') || (typeof __ANIM_BASE__ === 'string' ? __ANIM_BASE__ : 'anims/');
const loaded: { [id: string]: AnimData[] | null } = {};
const images: { [name: string]: HTMLImageElement | null } = {};
const FRAME_MS = 50;
let generation = 0;
/** 배틀 화면을 나갈 때 재생 중인 애니메이션·효과음 중단 */
export function cancelAnims() { generation++; }

/** <script> 로 불러옴 (file:// 에서도 동작) */
export function loadAnim(id: string): Promise<AnimData[] | null> {
	if (loaded[id] !== undefined) return Promise.resolve(loaded[id]);
	return new Promise(resolve => {
		const w = window as any;
		w.__anims ||= {};
		const s = document.createElement('script');
		s.src = `${animBase()}${id}.js`;
		const done = () => { loaded[id] = w.__anims[id] || null; s.remove(); resolve(loaded[id]); };
		s.onload = done;
		s.onerror = () => { loaded[id] = null; s.remove(); resolve(null); };
		document.head.appendChild(s);
	});
}

function loadImage(name: string): Promise<HTMLImageElement | null> {
	if (images[name] !== undefined) return Promise.resolve(images[name]);
	return new Promise(resolve => {
		const im = new Image();
		im.onload = () => { images[name] = im; resolve(im); };
		im.onerror = () => { images[name] = null; resolve(null); };
		im.src = `${animBase()}img/${encodeURIComponent(name)}.png`;
	});
}

export async function preloadAnim(id: string) {
	const a = await loadAnim(id);
	if (!a) return null;
	const names = new Set<string>();
	for (const v of a) {
		if (v.g) names.add(v.g);
		for (const evs of Object.values(v.e)) for (const e of evs) if (e.t === 'bg' && e.n) names.add(e.n);
	}
	await Promise.all([...names].map(loadImage));
	return a;
}

// 효과음 (한 번 받으면 보관)
const seCache: { [n: string]: HTMLAudioElement } = {};
function playSe(name: string, vol: number, pitch: number, master: number) {
	if (!name || master <= 0) return;
	const base = name.replace(/\.(wav|ogg|mp3|m4a)$/i, '');
	let el = seCache[base];
	if (!el) { el = new Audio(`${animBase()}se/${encodeURIComponent(base)}.m4a`); el.preload = 'auto'; seCache[base] = el; }
	const inst = el.cloneNode() as HTMLAudioElement;
	inst.volume = Math.min(1, (vol / 100) * master);
	(inst as any).preservesPitch = false;
	inst.playbackRate = Math.max(0.5, Math.min(2, pitch / 100));
	inst.play().catch(() => {});
}

/** 사용자(0,0)→대상(128,-64) 선분을 실제 선분으로 옮기는 변환 */
function transform(p: Pt, u: Pt, t: Pt): Pt {
	const tx = p.x / 128, ty = p.y / -64;
	return { x: u.x + tx * (t.x - u.x), y: u.y + ty * (t.y - u.y) };
}

export function playAnim(anim: AnimData[], ctx: PlayCtx): Promise<void> {
	const variant = ctx.userIsFoe && anim.length > 1 ? anim[1] : anim[0];
	// 상대 전용 변형은 사용자/대상 앵커를 바꿔 그린다 (PokéRogue isOppAnim 과 동일)
	const swap = ctx.userIsFoe && anim.length > 1;
	const U = swap ? ctx.targetPt : ctx.userPt, T = swap ? ctx.userPt : ctx.targetPt;
	const uEl = swap ? ctx.targetEl : ctx.userEl;
	// 자신에게 쓰는 기술: 사용자 = 대상 (같은 그림을 한 번만 움직임)
	const tEl0 = swap ? ctx.userEl : ctx.targetEl;
	const tEl = tEl0 === uEl ? null : tEl0;
	const reversed = !swap && ctx.userIsFoe; // 오른쪽→왼쪽으로 재생되는 경우 그림 좌우 반전
	const k = ctx.k;
	const sheet = variant.g ? images[variant.g] : null;
	const cols = sheet ? Math.max(1, Math.floor(sheet.width / 96)) : 1;
	const fc = ctx.front.getContext('2d')!, bc = ctx.back.getContext('2d')!;
	ctx.front.style.filter = ctx.back.style.filter = ctx.filter || '';
	const dpr = window.devicePixelRatio || 1;
	const W = ctx.front.width / dpr, H = ctx.front.height / dpr;
	let bgEl: HTMLElement | null = null;

	// 사용자·대상 기준 좌표가 '반대편 포켓몬 자리'를 가리킬 때만 실제 반대편 포켓몬 쪽으로 끌어당김.
	// 원본은 대상이 늘 사용자 + (128,-64) 에 있다고 보고 '사용자 기준 (128,-64)' 같은 좌표를 쓰는데, 이 화면은 두 포켓몬 간격이 달라서
	// 그대로 쓰면 상대에게 달려든 포켓몬·이펙트가 엉뚱한 곳에 감 (지구던지기 등). 반대편 자리에서 48 넘게 떨어진 좌표는 그대로 둠
	const mix = (near: Pt, x: number, y: number, otherX: number, otherY: number): Pt => {
		const t = 1 - Math.hypot(x - otherX, y - otherY) / 48;
		if (t <= 0) return near;
		const far = transform({ x, y }, U, T);
		return { x: near.x + (far.x - near.x) * t, y: near.y + (far.y - near.y) * t };
	};
	// 화면 기준(focus 4): 원본 화면은 256×192, 사용자가 (64,112). 배틀 화면을 빈틈없이 덮도록 같은 비율로 키워 가운데에 맞춤
	// (지구던지기의 우주처럼 화면을 96칸 타일로 덮는 그림이 어긋나거나 비지 않게)
	const kS = Math.max(k, W / 256, H / 192);
	const pos = (x: number, y: number, focus: number): Pt => {
		switch (focus) {
		case 2: return mix({ x: U.x + x * k, y: U.y + y * k }, x, y, 128, -64);
		case 1: return mix({ x: T.x + (x - 128) * k, y: T.y + (y + 64) * k }, x, y, 0, 0);
		case 4: return { x: W / 2 + (x - 64) * kS, y: H / 2 + (y + 16) * kS };
		default: return transform({ x, y }, U, T);
		}
	};

	const total = variant.f.length;
	// 잔상(같은 포켓몬 칸이 한 프레임에 여럿)을 그릴 때 쓰는 원래 그림 위치
	const cr = ctx.front.getBoundingClientRect();
	const baseOf = (el: HTMLElement | null) => { const im = el?.querySelector('img') as HTMLImageElement | null; if (!im) return null; const r = im.getBoundingClientRect(); return { im, x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height }; };
	const uBase = baseOf(uEl), tBase = baseOf(tEl);
	// 한 번이라도 칸으로 다뤄진 포켓몬은, 칸이 없는 프레임에서는 보이지 않음 (원본 엔진과 같음 — 지구던지기의 우주 장면 등)
	let uSeen = false, tSeen = false;
	let i = 0;
	let extraMs = 0;
	const gen0 = generation;
	return new Promise(resolve => {
		/** 이 프레임의 이벤트(효과음·배경) */
		const fireEvents = () => {
			const evs = variant.e[String(i)];
			if (evs) for (const e of evs) {
				if (e.t === 'se') playSe(e.n, e.v, e.p, ctx.sfxVolume);
				else if (e.t === 'bg') {
					bgEl?.remove();
					bgEl = document.createElement('div');
					bgEl.className = 'anim-bg';
					const im = e.n ? images[e.n] : null;
					bgEl.style.background = im ? `url(${im.src}) center / cover` : '#000';
					bgEl.style.opacity = '0';
					ctx.bgLayer.appendChild(bgEl);
					requestAnimationFrame(() => { if (bgEl) { bgEl.style.transition = `opacity ${Math.max(1, e.d) * 3 * 16}ms`; bgEl.style.opacity = String((e.o || 0) / 255); } });
				} else if (e.t === 'bgu' && bgEl) {
					bgEl.style.transition = `opacity ${Math.max(1, e.d) * 3 * 16}ms`;
					if (e.o !== undefined && e.o !== null) bgEl.style.opacity = String(e.o / 255);
					extraMs = Math.max(extraMs, e.d * 2 * 16);
				}
			}
		};
		const draw = () => {
			fc.clearRect(0, 0, W, H); bc.clearRect(0, 0, W, H);
			const frame = variant.f[i];
			if (!frame) return;
			fireEvents();
			let userMoved = false, targetMoved = false;
			// 포켓몬 칸: 프레임마다 가장 진한 칸이 본체, 나머지는 잔상으로 그림
			const main: { [k: number]: number[] } = {};
			for (const c of frame) if ((c[0] === 0 || c[0] === 1) && c[12] && (!main[c[0]] || c[6] > main[c[0]][6])) main[c[0]] = c;
			for (const c of frame) {
				const [t, x, y, zx, zy, gf, op, pr, fo, bt, mi, an, vis] = c;
				if (t === 0 || t === 1) {
					const isUser = t === 0 || !tEl;
					const el = t === 0 ? uEl : (tEl || uEl);
					const anchor = isUser ? U : T;
					if (!el) continue;
					const p = pos(x, y, fo);
					const dx = p.x - anchor.x, dy = p.y - anchor.y;
					if (main[t] && c !== main[t]) {   // 잔상
						const bs = isUser ? uBase : tBase;
						if (bs && vis) { try { fc.save(); fc.globalAlpha = op / 255; fc.drawImage(bs.im, bs.x + dx, bs.y + dy, bs.w, bs.h); fc.restore(); } catch { fc.restore(); } }
						continue;
					}
					el.style.translate = `${dx}px ${dy}px`;
					el.style.visibility = vis ? '' : 'hidden';
					el.style.opacity = String(op / 255);
					el.style.scale = zx !== 100 || zy !== 100 ? `${zx / 100} ${zy / 100}` : '';
					el.style.rotate = an ? `${-an}deg` : '';
					if (isUser) { userMoved = true; uSeen = true; } else { targetMoved = true; tSeen = true; }
					continue;
				}
				if (!sheet || !vis) continue;
				const p = pos(x, y, fo);
				const c2 = pr === 2 ? bc : fc;
				c2.save();
				c2.globalAlpha = op / 255;
				c2.globalCompositeOperation = bt === 1 ? 'lighter' : bt === 2 ? 'difference' : 'source-over';
				c2.translate(p.x, p.y);
				c2.rotate(-an * Math.PI / 180);
				let sx = (zx / 100) * (mi ? -1 : 1);
				if (reversed && fo === 3) sx *= -1;
				// 화면 기준(focus 4) 그림은 위치와 같은 비율로 키움 — 배경처럼 화면을 타일로 덮는 그림(지구던지기의 우주 등)이 빈틈·어긋남 없이 이어지게
				const kk = fo === 4 ? kS : k;
				c2.scale(sx * kk, (zy / 100) * kk);
				const col = gf % cols, row = Math.floor(gf / cols);
				c2.drawImage(sheet, col * 96, row * 96, 96, 96, -48, -48, 96, 96);
				c2.restore();
			}
			if (!userMoved && uEl) { uEl.style.translate = ''; uEl.style.visibility = uSeen ? 'hidden' : ''; uEl.style.opacity = ''; uEl.style.scale = ''; uEl.style.rotate = ''; }
			if (!targetMoved && tEl) { tEl.style.translate = ''; tEl.style.visibility = tSeen ? 'hidden' : ''; tEl.style.opacity = ''; tEl.style.scale = ''; tEl.style.rotate = ''; }
			ctx.onFrame?.(i);
		};
		const t0 = performance.now();
		const spd = () => Math.max(0.5, Math.min(4, ctx.speed || 1));
		let drawn = -1;
		const tick = () => {
			if (generation !== gen0) { for (const el of [uEl, tEl]) if (el) { el.style.translate = ''; el.style.visibility = ''; el.style.opacity = ''; el.style.scale = ''; el.style.rotate = ''; } resolve(); return; }
			// 시간 기준 프레임: 그리기가 느려도 배속에 맞춰 프레임을 건너뜀
			const target = Math.floor((performance.now() - t0) * spd() / FRAME_MS);
			if (target >= total) {
				fc.clearRect(0, 0, W, H); bc.clearRect(0, 0, W, H);
				for (const el of [uEl, tEl]) if (el) { el.style.translate = ''; el.style.visibility = ''; el.style.opacity = ''; el.style.scale = ''; el.style.rotate = ''; }
				const bg = bgEl;
				if (bg) { bg.style.transition = 'opacity 200ms'; bg.style.opacity = '0'; setTimeout(() => bg.remove(), 220); }
				setTimeout(resolve, Math.min(600, extraMs) / spd());
				return;
			}
			if (target > drawn) {
				// 건너뛴 프레임의 효과음·배경 이벤트는 놓치지 않게
				for (let f = drawn + 1; f < target; f++) { i = f; fireEvents(); }
				i = target; draw(); drawn = target;
			}
			setTimeout(tick, Math.min(FRAME_MS / spd(), 16));
		};
		tick();
	});
}

/** 쇼다운 기술 id → 애니메이션 id (파일명은 하이픈 제거) */
/** 전용 애니메이션이 없는 기술: 비슷한 기술의 그림을 씀 (테라버스트·비밀의힘·자연의힘은 타입 색으로 칠함 — battle.tsx) */
export const ANIM_BORROW: { [id: string]: string } = { snowscape: 'hail', terablast: 'technoblast', secretpower: 'hiddenpower', naturepower: 'growth', rest: 'sleeptalk' };
export function animIdFor(moveId: string) {
	if (ANIM_BORROW[moveId]) return ANIM_BORROW[moveId];
	if (/^hiddenpower/.test(moveId)) return 'hiddenpower';
	if (/^return\d+/.test(moveId)) return 'return';
	if (/^frustration\d+/.test(moveId)) return 'frustration';
	return moveId;
}
