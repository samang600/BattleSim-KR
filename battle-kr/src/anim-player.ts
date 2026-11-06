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

export function hasAnimCache(id: string) { return loaded[id] !== undefined; }

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

	const pos = (x: number, y: number, focus: number): Pt => {
		switch (focus) {
		case 2: return { x: U.x + x * k, y: U.y + y * k };
		case 1: return { x: T.x + (x - 128) * k, y: T.y + (y + 64) * k };
		case 4: return { x: (x + 106) * k * (ctx.front.clientWidth / 320 / k), y: (y + 116) * k * (ctx.front.clientHeight / 180 / k) };
		default: return transform({ x, y }, U, T);
		}
	};

	const total = variant.f.length;
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
			for (const c of frame) {
				const [t, x, y, zx, zy, gf, op, pr, fo, bt, mi, an, vis] = c;
				if (t === 0 || t === 1) {
					const el = t === 0 ? uEl : (tEl || uEl);
					const anchor = t === 0 || !tEl ? U : T;
					if (!el) continue;
					const p = pos(x, y, fo);
					const dx = p.x - anchor.x, dy = p.y - anchor.y;
					el.style.translate = `${dx}px ${dy}px`;
					el.style.visibility = vis ? '' : 'hidden';
					el.style.opacity = String(op / 255);
					if (zx !== 100 || zy !== 100 || an) el.style.scale = `${zx / 100} ${zy / 100}`;
					if (t === 0 || !tEl) userMoved = true; else targetMoved = true;
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
				c2.scale(sx * k, (zy / 100) * k);
				const col = gf % cols, row = Math.floor(gf / cols);
				c2.drawImage(sheet, col * 96, row * 96, 96, 96, -48, -48, 96, 96);
				c2.restore();
			}
			if (!userMoved && uEl) { uEl.style.translate = ''; uEl.style.visibility = ''; uEl.style.opacity = ''; uEl.style.scale = ''; }
			if (!targetMoved && tEl) { tEl.style.translate = ''; tEl.style.visibility = ''; tEl.style.opacity = ''; tEl.style.scale = ''; }
			ctx.onFrame?.(i);
		};
		const t0 = performance.now();
		const spd = () => Math.max(0.5, Math.min(4, ctx.speed || 1));
		let drawn = -1;
		const tick = () => {
			if (generation !== gen0) { resolve(); return; }
			// 시간 기준 프레임: 그리기가 느려도 배속에 맞춰 프레임을 건너뜀
			const target = Math.floor((performance.now() - t0) * spd() / FRAME_MS);
			if (target >= total) {
				fc.clearRect(0, 0, W, H); bc.clearRect(0, 0, W, H);
				for (const el of [uEl, tEl]) if (el) { el.style.translate = ''; el.style.visibility = ''; el.style.opacity = ''; el.style.scale = ''; }
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
