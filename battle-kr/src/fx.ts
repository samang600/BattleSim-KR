/**
 * 배틀 이펙트 — 타입·분류·기술 이름에 따라 다른 도트 연출 (이 앱용으로 직접 만든 연출, 외부 그래픽 없음)
 *
 * 연출 원형(primitive): beam · bolt · projectile · stream · slash · punch · quake · wave · rain · vortex · ring ·
 *   powder · notes · shield · drain · bite · crescent · throw · sparkle
 * pickAnim() 이 기술 id·타입·분류·플래그를 보고 원형을 조합한다.
 * 러브러브볼 등장의 하트만 pixelfx(MIT, src/vendor/pixelfx) 효과를 쓴다.
 */
import { TYPE_COLOR } from './ui/core';
import * as PX from './vendor/pixelfx/balls.js';

export interface Pt { x: number; y: number }
export interface MoveFxInfo { id: string; type: string; category: string; flags: { [k: string]: any }; target?: string; basePower?: number }

const LIGHT: { [t: string]: string } = {
	Fire: '#ffd040', Water: '#b0e0ff', Electric: '#fff8a0', Grass: '#b0f080', Ice: '#e8ffff', Psychic: '#ffc0e0',
	Ghost: '#c8a0ff', Dark: '#a08080', Dragon: '#b0b8ff', Fairy: '#ffe0ff', Poison: '#e0a0ff', Steel: '#f0f0ff',
	Fighting: '#ffc080', Ground: '#e8c890', Rock: '#e0d8b0', Bug: '#e0f080', Flying: '#e0f0ff', Normal: '#ffffff', Stellar: '#ffffff',
};
const DARK: { [t: string]: string } = {
	Fire: '#a02010', Water: '#1040a0', Electric: '#a07000', Grass: '#206020', Ice: '#2080a0', Psychic: '#a02060',
	Ghost: '#402060', Dark: '#301818', Dragon: '#203090', Fairy: '#a040a0', Poison: '#501870', Steel: '#405060',
	Fighting: '#a04000', Ground: '#603010', Rock: '#605030', Bug: '#506010', Flying: '#4070a0', Normal: '#808080', Stellar: '#404060',
};
const col = (t: string) => ({ c: TYPE_COLOR[t] || '#fff', l: LIGHT[t] || '#fff', d: DARK[t] || '#444' });

function px(layer: HTMLElement, x: number, y: number, w: number, h: number, color: string, extra = '') {
	const el = document.createElement('div');
	el.className = 'fxp';
	el.style.cssText = `left:${x - w / 2}px;top:${y - h / 2}px;width:${w}px;height:${h}px;background:${color};${extra}`;
	layer.appendChild(el);
	return el;
}
/** 배속 (배틀 화면의 배속 버튼) — 모든 연출 시간을 이 값으로 나눔 */
let SPEED = 1;
export function setFxSpeed(v: number) { SPEED = Math.max(0.5, Math.min(4, v)); }
export function fxSpeed() { return SPEED; }
const later = (fn: () => void, ms: number) => setTimeout(fn, ms / SPEED);
function anim(el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions) {
	const a = el.animate(frames, { easing: 'steps(6)', fill: 'forwards', ...opts });
	a.playbackRate = SPEED;
	a.onfinish = () => el.remove();
	return a;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ───────── 원형 ─────────
export function burst(layer: HTMLElement, at: Pt, type: string, s: number, strong = false) {
	const { c, l } = col(type);
	const n = strong ? 18 : 10;
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2 + rnd(0, 0.4);
		const dist = rnd(18, 40) * s * (strong ? 1.4 : 1);
		const size = Math.round(rnd(3, 6) * s);
		const el = px(layer, at.x, at.y, size, size, i % 2 ? c : l, ['Water', 'Poison', 'Fairy'].includes(type) ? 'border-radius:50%' : '');
		anim(el, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * dist}px,${Math.sin(a) * dist}px)`, opacity: 0 }], { duration: rnd(360, 520) });
	}
	const ring = px(layer, at.x, at.y, 10 * s, 10 * s, 'transparent', `border:${Math.max(2, Math.round(s * 1.5))}px solid ${l};border-radius:50%`);
	anim(ring, [{ transform: 'scale(.4)', opacity: 1 }, { transform: `scale(${strong ? 5 : 3.4})`, opacity: 0 }], { duration: 360, easing: 'steps(5)' });
}

export function slash(layer: HTMLElement, at: Pt, type: string, s: number, count = 3, angle = -35) {
	const { l } = col(type);
	for (let i = 0; i < count; i++) {
		const w = 48 * s, h = Math.max(2, Math.round(2.5 * s));
		const el = px(layer, at.x, at.y + (i - (count - 1) / 2) * 10 * s, w, h, l, `transform:rotate(${angle}deg) scaleX(0)`);
		anim(el, [{ transform: `rotate(${angle}deg) scaleX(0)`, opacity: 1 }, { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 1, offset: 0.5 }, { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0 }],
			{ duration: 260, delay: i * 60, easing: 'steps(4)' });
	}
}

export function punch(layer: HTMLElement, at: Pt, type: string, s: number) {
	const { c, l } = col(type);
	// 충격 별
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2;
		const el = px(layer, at.x, at.y, 14 * s, 3 * s, i % 2 ? c : l, `transform:rotate(${a}rad) translateX(0)`);
		anim(el, [{ transform: `rotate(${a}rad) translateX(0) scaleX(.2)`, opacity: 1 }, { transform: `rotate(${a}rad) translateX(${22 * s}px) scaleX(1)`, opacity: 0 }], { duration: 300, easing: 'steps(4)' });
	}
	const core = px(layer, at.x, at.y, 12 * s, 12 * s, '#fff', 'border-radius:50%');
	anim(core, [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 220, easing: 'steps(3)' });
}

export function beam(layer: HTMLElement, from: Pt, to: Pt, type: string, s: number, dur = 650) {
	const { c, l } = col(type);
	const dx = to.x - from.x, dy = to.y - from.y;
	const len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
	const mk = (h: number, color: string, delay: number) => {
		const el = px(layer, from.x, from.y, len, h, color, `transform-origin:0 50%;transform:rotate(${ang}rad) scaleX(0);left:${from.x}px;top:${from.y - h / 2}px`);
		anim(el, [{ transform: `rotate(${ang}rad) scaleX(0)`, opacity: 1 }, { transform: `rotate(${ang}rad) scaleX(1)`, opacity: 1, offset: 0.25 },
			{ transform: `rotate(${ang}rad) scaleX(1)`, opacity: 1, offset: 0.8 }, { transform: `rotate(${ang}rad) scaleX(1)`, opacity: 0 }], { duration: dur, delay, easing: 'steps(8)' });
	};
	mk(14 * s, c, 0); mk(7 * s, l, 40); mk(3 * s, '#fff', 80);
	later(() => burst(layer, to, type, s, true), dur * 0.3);
	return dur;
}

export function bolt(layer: HTMLElement, to: Pt, type: string, s: number, count = 2) {
	const { c, l } = col(type);
	for (let k = 0; k < count; k++) {
		const segs = 7;
		let x = to.x + rnd(-30, 30) * s, y = -10;
		for (let i = 0; i < segs; i++) {
			const nx = i === segs - 1 ? to.x : x + rnd(-18, 18) * s;
			const ny = i === segs - 1 ? to.y : y + (to.y + 10) / segs;
			const len = Math.hypot(nx - x, ny - y), ang = Math.atan2(ny - y, nx - x);
			const el = px(layer, x, y, len, 3 * s, i % 2 ? l : c, `transform-origin:0 50%;left:${x}px;top:${y}px;transform:rotate(${ang}rad)`);
			anim(el, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 260, delay: k * 130 + i * 12, easing: 'steps(3)' });
			x = nx; y = ny;
		}
		later(() => { flash(layer, l, 90); burst(layer, to, type, s); }, k * 130 + 90);
	}
}

export function projectile(layer: HTMLElement, from: Pt, to: Pt, type: string, s: number, big = false): number {
	const { c, l } = col(type);
	const count = big ? 1 : 7;
	const dur = 380;
	for (let i = 0; i < count; i++) {
		const size = Math.round((big ? 22 : 6) * s);
		const el = px(layer, from.x, from.y, size, size, big ? c : (i % 2 ? c : l), 'border-radius:50%' + (big ? `;box-shadow:0 0 0 ${3 * s}px ${l}` : ''));
		const j = () => rnd(-6, 6) * s;
		anim(el, [{ transform: 'translate(0,0)', opacity: 0.9 }, { transform: `translate(${(to.x - from.x) * 0.5 + j()}px,${(to.y - from.y) * 0.5 - 20 * s}px)`, opacity: 1 },
			{ transform: `translate(${to.x - from.x}px,${to.y - from.y}px)`, opacity: 0.8 }], { duration: dur, delay: i * 35, easing: 'steps(8)' });
	}
	later(() => burst(layer, to, type, s, big), dur + count * 35 - 60);
	return dur + count * 35;
}

/** 입에서 뿜는 줄기 (화염방사·하이드로펌프·냉동빔 등) */
export function stream(layer: HTMLElement, from: Pt, to: Pt, type: string, s: number, dur = 700) {
	const { c, l } = col(type);
	const n = 26;
	for (let i = 0; i < n; i++) {
		const size = Math.round(rnd(4, 9) * s);
		const el = px(layer, from.x, from.y, size, size, i % 3 === 0 ? '#fff' : i % 2 ? c : l, type === 'Water' || type === 'Poison' ? 'border-radius:50%' : '');
		const sp = rnd(-14, 14) * s;
		anim(el, [{ transform: 'translate(0,0) scale(.5)', opacity: 1 }, { transform: `translate(${to.x - from.x + sp}px,${to.y - from.y + sp}px) scale(1.4)`, opacity: 0.2 }],
			{ duration: 320, delay: i * (dur / n), easing: 'steps(6)' });
	}
	later(() => burst(layer, to, type, s, true), dur * 0.45);
	return dur;
}

export function quake(layer: HTMLElement, arena: HTMLElement, type: string, s: number) {
	const { d, l } = col(type);
	const h = layer.clientHeight, w = layer.clientWidth;
	for (let i = 0; i < 12; i++) {
		const x = rnd(0, w), y = rnd(h * 0.55, h);
		const el = px(layer, x, y, rnd(10, 30) * s, 3 * s, i % 2 ? d : l);
		anim(el, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-rnd(10, 30) * s}px)`, opacity: 0 }], { duration: 500, delay: i * 40 });
	}
	shake(arena, true, 700);
}

/** 가로로 휩쓰는 파도 (파도타기·열풍·눈보라) */
export function wave(layer: HTMLElement, to: Pt, type: string, s: number, fromLeft: boolean) {
	const { c, l } = col(type);
	const w = layer.clientWidth;
	for (let i = 0; i < 14; i++) {
		const el = px(layer, fromLeft ? -20 : w + 20, to.y + rnd(-30, 20) * s, rnd(16, 40) * s, rnd(5, 9) * s, i % 2 ? c : l, type === 'Water' ? 'border-radius:50%' : '');
		anim(el, [{ transform: 'translateX(0)', opacity: 0.9 }, { transform: `translateX(${(fromLeft ? 1 : -1) * (w + 60)}px)`, opacity: 0.6 }], { duration: 700, delay: i * 30, easing: 'steps(10)' });
	}
	later(() => burst(layer, to, type, s, true), 350);
}

/** 하늘에서 떨어짐 (운석·낙석·유성) */
export function rain(layer: HTMLElement, to: Pt, type: string, s: number, count = 8, size = 8) {
	const { c, d } = col(type);
	for (let i = 0; i < count; i++) {
		const sz = Math.round(rnd(size * 0.6, size * 1.3) * s);
		const tx = to.x + rnd(-40, 40) * s;
		const el = px(layer, tx + 60 * s, -20, sz, sz, i % 2 ? c : d, type === 'Rock' || type === 'Ground' ? '' : 'border-radius:50%');
		anim(el, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${-60 * s}px,${to.y + 20 + rnd(-10, 10) * s}px)`, opacity: 1 }], { duration: 300, delay: i * 70, easing: 'steps(5)' });
		later(() => burst(layer, { x: tx, y: to.y }, type, s), i * 70 + 280);
	}
}

export function vortex(layer: HTMLElement, at: Pt, type: string, s: number, dur = 800) {
	const { c, l } = col(type);
	for (let i = 0; i < 16; i++) {
		const el = px(layer, at.x, at.y, 6 * s, 6 * s, i % 2 ? c : l, 'border-radius:50%');
		const r = (12 + i * 3) * s;
		const a0 = i * 0.8;
		const frames: Keyframe[] = [];
		for (let k = 0; k <= 8; k++) {
			const a = a0 + k * 0.9;
			frames.push({ transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r * 0.5 - k * 4 * s}px)`, opacity: k < 7 ? 1 : 0 });
		}
		anim(el, frames, { duration: dur, delay: i * 25, easing: 'steps(16)' });
	}
}

export function ring(layer: HTMLElement, at: Pt, type: string, s: number, big = true) {
	const { c, l } = col(type);
	for (let i = 0; i < 3; i++) {
		const el = px(layer, at.x, at.y, 20 * s, 20 * s, 'transparent', `border:${4 * s}px solid ${i % 2 ? c : l};border-radius:50%`);
		anim(el, [{ transform: 'scale(.3)', opacity: 1 }, { transform: `scale(${big ? 7 : 4})`, opacity: 0 }], { duration: 500, delay: i * 110, easing: 'steps(6)' });
	}
	if (big) flash(layer, l, 250);
}

export function powder(layer: HTMLElement, at: Pt, type: string, s: number) {
	const { c, l } = col(type);
	for (let i = 0; i < 18; i++) {
		const el = px(layer, at.x + rnd(-30, 30) * s, at.y - 50 * s, 3 * s, 3 * s, i % 2 ? c : l, 'border-radius:50%');
		anim(el, [{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translateY(${60 * s}px) translateX(${rnd(-10, 10) * s}px)`, opacity: 0 }], { duration: 900, delay: i * 40, easing: 'steps(10)' });
	}
}

export function notes(layer: HTMLElement, at: Pt, type: string, s: number) {
	const { c, l } = col(type);
	for (let i = 0; i < 6; i++) {
		const el = document.createElement('div');
		el.className = 'fxp fx-note';
		el.textContent = i % 2 ? '♪' : '♫';
		el.style.cssText = `left:${at.x + rnd(-24, 24) * s}px;top:${at.y - 10 * s}px;color:${i % 2 ? c : l};font-size:${14 * s}px;`;
		layer.appendChild(el);
		anim(el, [{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translateY(${-50 * s}px)`, opacity: 0 }], { duration: 900, delay: i * 110 });
	}
}

export function shield(layer: HTMLElement, at: Pt, type: string, s: number) {
	const { c, l } = col(type);
	const el = px(layer, at.x, at.y - 10 * s, 60 * s, 60 * s, 'transparent', `border:${3 * s}px solid ${l};box-shadow:inset 0 0 0 ${3 * s}px ${c};clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)`);
	anim(el, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.3 }, { transform: 'scale(1)', opacity: 1, offset: 0.7 }, { transform: 'scale(1.1)', opacity: 0 }], { duration: 800 });
}

export function drain(layer: HTMLElement, from: Pt, to: Pt, type: string, s: number) {
	const { c, l } = col(type);
	burst(layer, to, type, s);
	for (let i = 0; i < 10; i++) {
		const el = px(layer, to.x + rnd(-10, 10) * s, to.y, 5 * s, 5 * s, i % 2 ? c : l, 'border-radius:50%');
		anim(el, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${from.x - to.x}px,${from.y - to.y}px)`, opacity: 0.4 }], { duration: 600, delay: 200 + i * 50, easing: 'steps(8)' });
	}
}

export function bite(layer: HTMLElement, at: Pt, type: string, s: number) {
	const { l } = col(type);
	for (const dir of [-1, 1]) {
		for (let i = 0; i < 4; i++) {
			const el = px(layer, at.x + (i - 1.5) * 10 * s, at.y + dir * 26 * s, 6 * s, 10 * s, l, `clip-path:polygon(50% ${dir > 0 ? 0 : 100}%,100% ${dir > 0 ? 100 : 0}%,0 ${dir > 0 ? 100 : 0}%)`);
			anim(el, [{ transform: 'translateY(0)', opacity: 0 }, { transform: `translateY(${-dir * 18 * s}px)`, opacity: 1, offset: 0.5 }, { transform: `translateY(${-dir * 18 * s}px)`, opacity: 0 }], { duration: 400, easing: 'steps(4)' });
		}
	}
	later(() => burst(layer, at, type, s), 180);
}

export function crescent(layer: HTMLElement, from: Pt, to: Pt, type: string, s: number, count = 2) {
	const { l, c } = col(type);
	for (let i = 0; i < count; i++) {
		const el = px(layer, from.x, from.y, 30 * s, 30 * s, 'transparent', `border:${4 * s}px solid ${i % 2 ? l : c};border-color:${l} transparent transparent transparent;border-radius:50%`);
		anim(el, [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: `translate(${to.x - from.x}px,${to.y - from.y}px) rotate(540deg)`, opacity: 0.9 }], { duration: 380, delay: i * 120, easing: 'steps(8)' });
		later(() => slash(layer, to, type, s, 2, 20 + i * 40), i * 120 + 340);
	}
}

export function throwRocks(layer: HTMLElement, from: Pt, to: Pt, type: string, s: number, count = 5, round = false) {
	const { c, d } = col(type);
	for (let i = 0; i < count; i++) {
		const sz = rnd(6, 11) * s;
		const el = px(layer, from.x, from.y - 20 * s, sz, sz, i % 2 ? c : d, round ? 'border-radius:50%' : `clip-path:polygon(50% 0,100% 40%,80% 100%,20% 100%,0 40%)`);
		anim(el, [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${(to.x - from.x) / 2}px,${(to.y - from.y) / 2 - 40 * s}px) rotate(180deg)`, opacity: 1 },
			{ transform: `translate(${to.x - from.x + rnd(-10, 10) * s}px,${to.y - from.y}px) rotate(360deg)`, opacity: 1 }], { duration: 420, delay: i * 90, easing: 'steps(8)' });
		later(() => burst(layer, to, type, s), i * 90 + 400);
	}
}

export function sparkle(layer: HTMLElement, at: Pt, type: string, s: number, down = false) {
	const c = LIGHT[type] || '#fff';
	for (let i = 0; i < 9; i++) {
		const el = px(layer, at.x + rnd(-25, 25) * s, at.y + rnd(-6, 24) * s, 3 * s, 3 * s, i % 3 ? c : '#ffffff');
		anim(el, [{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: `translateY(${(down ? 1 : -1) * 34 * s}px)`, opacity: 0 }], { duration: 600, delay: i * 40 });
	}
}

export function shake(el: HTMLElement, strong = false, dur = 0) {
	const d = strong ? 6 : 3;
	el.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${d}px,${-d}px)` }, { transform: `translate(${-d}px,${d}px)` }, { transform: `translate(${d}px,0)` }, { transform: 'translate(0,0)' }],
		{ duration: (dur || (strong ? 320 : 220)) / SPEED, easing: 'steps(4)', iterations: dur ? 2 : 1 });
}
export function flash(layer: HTMLElement, color = '#fff', dur = 180) {
	const el = document.createElement('div');
	el.className = 'fx-flash';
	el.style.background = color;
	layer.appendChild(el);
	anim(el, [{ opacity: 0.85 }, { opacity: 0 }], { duration: dur, easing: 'steps(3)' });
}
export function pillar(layer: HTMLElement, at: Pt, color: string, s: number) {
	const el = document.createElement('div');
	el.className = 'fxp';
	const w = 40 * s;
	el.style.cssText = `left:${at.x - w / 2}px;top:0;width:${w}px;height:${at.y + 20 * s}px;background:linear-gradient(180deg, transparent, ${color});`;
	layer.appendChild(el);
	anim(el, [{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 0.9, transform: 'scaleX(1)', offset: 0.3 }, { opacity: 0, transform: 'scaleX(1.6)' }], { duration: 800, easing: 'steps(8)' });
	sparkle(layer, at, 'Normal', s);
}

/** 메가진화 심볼 도트 그림 (10×15, 사용자가 준 그림 · 흰 틈은 투명 · 원본 src/assets/mega-symbol.png) */
const MEGA_SYMBOL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAPCAYAAADd/14OAAABMUlEQVR4nIWSwUoCYRSFzy+WaVq//SZD1KKQsVq4aJe7iKC2bnuAFr5AT9IL9ABSuIsIKlwMFLRoFmaIjY3KTIs2ToF5WljWMEPd1b2Xj3vu4V4gJD6magzrByCCATD6u7hcaPAkppB5fwRsPxj5Tow06cYUSs20OJ7ohMttqHsWl+7GcnvrbW4tP/jkBQDkNy/YWl1EohDHtDMHAHA6z0jmc3APhQAAJKsGk1Uj1GXmjETFIgCIGfOc22vzqPX1ketubET1ASQA2IDrthF9s5pwshEUVR0VURCBqWwzN2iNdtStU2bjKZTUSkD+aGDh1Wz8NGZvUlSepPLkeN9d7lB5klr9wO9Bq2ssf4FlT7LsSaav9sPP+XQrOezpNAledyf/vvmLKenY8v/HGPb0APQJ6RJ9YvtQAQcAAAAASUVORK5CYII=';
/** 메가진화 표식: 포켓몬 위에 메가진화 심볼이 톡 튀어나와(확대 → 제자리) 두 번 번쩍이고 사라짐. 50ms 한 칸씩, 도트는 정수배로 확대 */
export function megaIcon(layer: HTMLElement, at: Pt, s: number) {
	const W = 10, H = 15, k = Math.max(2, Math.round(s * 2));
	const el = document.createElement('img');
	el.src = MEGA_SYMBOL; el.alt = ''; el.className = 'fxp pxfx';
	el.style.cssText = `left:${Math.round(at.x - W * k / 2)}px;top:${Math.round(at.y - 44 * s - H * k / 2)}px;width:${W * k}px;height:${H * k}px;transform-origin:50% 60%;`;
	layer.appendChild(el);
	const FR = 18; let f = 0;
	const SC = [0.3, 0.7, 1.15, 1.25, 1.1, 1];
	const tick = () => {
		if (f >= FR) { clearInterval(timer); el.remove(); return; }
		el.style.transform = `scale(${SC[Math.min(f, SC.length - 1)]})`;
		el.style.filter = f === 6 || f === 10 ? 'brightness(1.8)' : '';   // 두 번 번쩍
		el.style.opacity = f >= FR - 3 ? String((FR - f) / 4) : '1';
		f++;
	};
	tick();
	const timer = window.setInterval(tick, 50 / SPEED);
}

/** 다이맥스 기술: 사용자에게 기운이 모이고, 거대한 타입 색 구체가 날아가 큰 폭발 + 하늘에서 내리꽂는 빛기둥 + 화면 흔들림 */
export function maxMove(layer: HTMLElement, arena: HTMLElement, type: string, from: Pt, hits: Pt[], s: number): number {
	const col = TYPE_COLOR[type] || '#fff';
	const light = `color-mix(in srgb, ${col} 45%, #fff)`;
	// 1) 모으기: 사용자 주위로 조여드는 고리와 입자 (0~420ms)
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2;
		const el = px(layer, from.x + Math.cos(a) * 46 * s, from.y + Math.sin(a) * 30 * s, 5 * s, 5 * s, i % 2 ? col : light, 'border-radius:50%');
		anim(el, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translate(${-Math.cos(a) * 46 * s}px,${-Math.sin(a) * 30 * s}px)`, opacity: 0 }], { duration: 420, delay: i * 10, easing: 'steps(6)' });
	}
	const ring = px(layer, from.x, from.y, 90 * s, 60 * s, 'transparent', `border-radius:50%;box-shadow:0 0 0 3px ${col}, 0 0 14px 4px ${col}`);
	anim(ring, [{ transform: 'scale(1.3)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'scale(.25)', opacity: 0 }], { duration: 420, easing: 'steps(7)' });
	// 2) 거대 구체 발사 (420~820ms)
	const to = hits[0];
	later(() => {
		const orb = px(layer, from.x, from.y - 10 * s, 34 * s, 34 * s, `radial-gradient(circle at 35% 35%, #fff, ${light} 30%, ${col} 70%, transparent 72%)`, `border-radius:50%;box-shadow:0 0 18px 6px ${col}`);
		anim(orb, [{ transform: 'translate(0,0) scale(.5)' }, { transform: `translate(${(to.x - from.x) / 2}px,${(to.y - from.y) / 2 - 60 * s}px) scale(1.2)`, offset: 0.5 },
			{ transform: `translate(${to.x - from.x}px,${to.y - from.y + 10 * s}px) scale(1.4)` }], { duration: 400, easing: 'steps(10)' });
		for (let i = 0; i < 6; i++) {
			const tr = px(layer, from.x, from.y - 10 * s, 10 * s, 10 * s, col, 'border-radius:50%;opacity:.6');
			anim(tr, [{ transform: 'translate(0,0)', opacity: 0.6 }, { transform: `translate(${(to.x - from.x) * (0.3 + i * 0.1)}px,${(to.y - from.y) * (0.3 + i * 0.1) - 40 * s}px)`, opacity: 0 }], { duration: 380, delay: i * 25, easing: 'steps(8)' });
		}
	}, 420);
	// 3) 충격: 폭발 + 빛기둥 + 고리 3겹 + 파편 + 흔들림 (820ms~)
	later(() => {
		flash(layer, light, 220);
		shake(arena, true, 420);
		for (const h of hits) {
			const pil = document.createElement('div');
			pil.className = 'fxp';
			const w = 70 * s;
			pil.style.cssText = `left:${h.x - w / 2}px;top:0;width:${w}px;height:${h.y + 24 * s}px;background:linear-gradient(180deg, transparent, ${light} 60%, ${col});`;
			layer.appendChild(pil);
			anim(pil, [{ opacity: 0, transform: 'scaleX(.1)' }, { opacity: 1, transform: 'scaleX(1)', offset: 0.25 }, { opacity: 0, transform: 'scaleX(1.8)' }], { duration: 700, easing: 'steps(8)' });
			const core = px(layer, h.x, h.y, 30 * s, 30 * s, `radial-gradient(circle, #fff, ${light} 40%, ${col} 75%, transparent 78%)`, 'border-radius:50%');
			anim(core, [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(5)', opacity: 0 }], { duration: 620, easing: 'steps(8)' });
			for (let r = 0; r < 3; r++) {
				const rg = px(layer, h.x, h.y, 40 * s, 26 * s, 'transparent', `border-radius:50%;box-shadow:0 0 0 ${3 - r}px ${r % 2 ? light : col}`);
				anim(rg, [{ transform: 'scale(.3)', opacity: 1 }, { transform: `scale(${5 + r * 1.5})`, opacity: 0 }], { duration: 560, delay: r * 90, easing: 'steps(7)' });
			}
			for (let i = 0; i < 26; i++) {
				const a = (i / 26) * Math.PI * 2 + rnd(-0.1, 0.1);
				const d = rnd(50, 110) * s;
				const el = px(layer, h.x, h.y, rnd(3, 7) * s, rnd(3, 7) * s, i % 3 ? col : '#fff');
				anim(el, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d * 0.7 - 20 * s}px)`, opacity: 0 }], { duration: rnd(500, 760), easing: 'steps(8)' });
			}
			burst(layer, h, type, s, true);
		}
	}, 820);
	return 840;
}

/** Z기술 전용 대형 연출 (1.2초): ① Z파워 모으기(화면 어두워짐·황금빛 줄기·Z 문양) ② 타입별 대기술 ③ 대폭발
 *  돌진형(노말·격투·비행·벌레·악·강철) / 낙하형(바위·땅·드래곤·얼음) / 광선형(불꽃·물·전기·풀·에스퍼·고스트·페어리·독) */
export function zMove(layer: HTMLElement, arena: HTMLElement, type: string, cat: string, from: Pt, hits: Pt[], s: number): number {
	const { c, l, d } = col(type);
	const to = hits[0];
	const W = layer.clientWidth || 400, H = layer.clientHeight || 300;
	// ① Z파워: 화면을 어둡게, 사용자에게 황금빛 줄기가 모이고 Z 문양
	const dim = px(layer, W / 2, H / 2, W, H, 'rgba(10,6,30,.55)');
	anim(dim, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 1250, easing: 'linear' });
	for (let i = 0; i < 14; i++) {
		const a = (i / 14) * Math.PI * 2;
		const len = 70 * s;
		const st = px(layer, from.x + Math.cos(a) * len, from.y + Math.sin(a) * len * 0.7, 3 * s, 18 * s, i % 2 ? '#ffe040' : '#fff8c0', `transform-origin:center;border-radius:2px;box-shadow:0 0 6px #ffd000`);
		st.style.rotate = `${a + Math.PI / 2}rad`;
		anim(st, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: `translate(${-Math.cos(a) * len}px,${-Math.sin(a) * len * 0.7}px)`, opacity: 0 }], { duration: 480, delay: i * 14, easing: 'steps(6)' });
	}
	const glyph = document.createElement('div');
	glyph.className = 'fxp fx-zglyph';
	glyph.textContent = 'Z';
	glyph.style.cssText = `left:${from.x - 30 * s}px;top:${from.y - 70 * s}px;width:${60 * s}px;height:${60 * s}px;font-size:${54 * s}px;line-height:${60 * s}px;`;
	layer.appendChild(glyph);
	anim(glyph, [{ transform: 'scale(.2) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1.15) rotate(0)', opacity: 1, offset: 0.35 }, { transform: 'scale(1)', opacity: 1, offset: 0.75 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 640, easing: 'steps(8)' });
	const aura = px(layer, from.x, from.y, 80 * s, 80 * s, `radial-gradient(circle, ${l}, ${c} 45%, transparent 70%)`, 'border-radius:50%');
	anim(aura, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.3)', opacity: .9, offset: 0.6 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 640, easing: 'steps(8)' });
	// ② 타입별 대기술 (600ms~)
	const rushT = ['Normal', 'Fighting', 'Flying', 'Bug', 'Dark', 'Steel'], fallT = ['Rock', 'Ground', 'Dragon', 'Ice'];
	const kind = fallT.includes(type) ? 'fall' : rushT.includes(type) || cat === 'Physical' && !['Fire', 'Water', 'Electric', 'Grass', 'Psychic', 'Ghost', 'Fairy', 'Poison'].includes(type) ? 'rush' : 'beam';
	later(() => {
		if (kind === 'rush') {
			// 혜성처럼 빛을 두르고 돌진: 굵은 꼬리 + 잔상
			for (let i = 0; i < 7; i++) {
				const g = px(layer, from.x, from.y, 46 * s, 46 * s, `radial-gradient(circle, #fff, ${l} 35%, ${c} 65%, transparent 70%)`, `border-radius:50%;opacity:${1 - i * 0.12}`);
				anim(g, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${to.x - from.x}px,${to.y - from.y}px) scale(${1.4 - i * 0.1})`, opacity: 0.2 }], { duration: 420, delay: i * 30, easing: 'steps(9)' });
			}
			for (let i = 0; i < 5; i++) later(() => punch(layer, { x: to.x + rnd(-24, 24) * s, y: to.y + rnd(-18, 18) * s }, type, s * 1.4), 380 + i * 60);
		} else if (kind === 'fall') {
			// 하늘에서 거대한 덩어리가 떨어짐 (바위·대지·용의 기운·빙산)
			const big = 120 * s;
			const shape = type === 'Ice' ? 'clip-path:polygon(50% 0,100% 40%,80% 100%,20% 100%,0 40%)' : type === 'Dragon' ? 'border-radius:50%' : 'clip-path:polygon(20% 0,85% 8%,100% 55%,75% 100%,10% 90%,0 35%)';
			const rock = px(layer, to.x, to.y - H, big, big, `radial-gradient(circle at 35% 30%, ${l}, ${c} 55%, ${d})`, `${shape};box-shadow:0 0 24px 6px ${c}`);
			anim(rock, [{ transform: 'translate(0,0) scale(.6)' }, { transform: `translate(0,${H - 10 * s}px) scale(1)` }], { duration: 480, easing: 'steps(10)' });
			throwRocks(layer, { x: to.x, y: to.y - H * 0.8 }, to, type, s * 1.3, 6);
			if (type === 'Ground' || type === 'Rock') later(() => quake(layer, arena, type, s), 420);
		} else {
			// 거대 광선 + 타입별 덧붙임
			beam(layer, from, to, type, s * 2.6, 560);
			later(() => beam(layer, from, to, type, s * 1.4, 420), 120);
			if (type === 'Water' || type === 'Psychic' || type === 'Ghost' || type === 'Poison') later(() => vortex(layer, to, type, s * 1.6, 700), 200);
			if (type === 'Electric') later(() => bolt(layer, to, type, s * 1.5, 6), 160);
			if (type === 'Fire') later(() => burst(layer, to, type, s * 2, true), 260);
			if (type === 'Grass' || type === 'Fairy') later(() => powder(layer, to, type, s * 1.6), 200);
		}
	}, 620);
	// ③ 대폭발 (1100ms~): 흰 섬광, 강한 흔들림, 충격파 고리, 파편
	later(() => {
		flash(layer, '#fff', 260);
		shake(arena, true, 560);
		for (const h of hits) {
			const core = px(layer, h.x, h.y, 40 * s, 40 * s, `radial-gradient(circle, #fff, ${l} 35%, ${c} 70%, transparent 74%)`, 'border-radius:50%');
			anim(core, [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(6)', opacity: 0 }], { duration: 700, easing: 'steps(9)' });
			for (let r = 0; r < 4; r++) {
				const rg = px(layer, h.x, h.y, 44 * s, 28 * s, 'transparent', `border-radius:50%;box-shadow:0 0 0 ${4 - r}px ${r % 2 ? '#ffe040' : l}`);
				anim(rg, [{ transform: 'scale(.3)', opacity: 1 }, { transform: `scale(${6 + r * 1.6})`, opacity: 0 }], { duration: 640, delay: r * 80, easing: 'steps(8)' });
			}
			for (let i = 0; i < 30; i++) {
				const a = (i / 30) * Math.PI * 2 + rnd(-0.1, 0.1);
				const dd = rnd(60, 130) * s;
				const el = px(layer, h.x, h.y, rnd(3, 8) * s, rnd(3, 8) * s, i % 3 === 0 ? '#ffe040' : i % 3 === 1 ? c : '#fff');
				anim(el, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * dd}px,${Math.sin(a) * dd * 0.7 - 20 * s}px)`, opacity: 0 }], { duration: rnd(560, 820), easing: 'steps(8)' });
			}
			burst(layer, h, type, s * 1.5, true);
		}
	}, 1100);
	return 1120;
}

/** 몬스터볼에서 나오기: 볼이 날아가 열리고 빛이 퍼짐 */
/** 볼 종류별 색 [윗부분, 아랫부분, 빛 색, 입자 색] */
export const BALL_STYLE: { [id: string]: [string, string, string, string] } = {
	pokeball: ['#e83030', '#f8f8f8', '#fff', '#ffe080'], greatball: ['#2a6ae8', '#f8f8f8', '#cfe4ff', '#ff6060'], ultraball: ['#1a1a1a', '#f8d030', '#fff2a0', '#f8d030'],
	masterball: ['#7a3aa8', '#f8f8f8', '#e8c0ff', '#ff70d0'], premierball: ['#f8f8f8', '#f8f8f8', '#fff', '#ff8080'], luxuryball: ['#1a1a1a', '#1a1a1a', '#ffd870', '#ff5050'],
	duskball: ['#2a4a2a', '#1a1a1a', '#80ff80', '#ff9030'], healball: ['#ff9ac8', '#f8f8f8', '#ffe0f0', '#ffb0d8'], netball: ['#30a0c0', '#f8f8f8', '#c0f0ff', '#204060'],
	diveball: ['#2050c0', '#f8f8f8', '#a0d8ff', '#60b0ff'], nestball: ['#b0b830', '#f8f8f8', '#e0f090', '#a0d040'], repeatball: ['#e03030', '#f8f8f8', '#fff', '#f8d030'],
	timerball: ['#f8f8f8', '#f8f8f8', '#ffc0c0', '#e03030'], quickball: ['#30b0e0', '#f8f8f8', '#d0f8ff', '#f8e040'], friendball: ['#40c060', '#f8f8f8', '#c0ffd0', '#ff8040'],
	loveball: ['#ff70b0', '#f8f8f8', '#ffd0e8', '#ff3080'], moonball: ['#2a2a60', '#f8f8f8', '#ffe8a0', '#f8d030'], dreamball: ['#ff80c0', '#f8f8f8', '#ffd0ff', '#c080ff'],
	beastball: ['#2040c0', '#f8f8f8', '#ffe060', '#ff9030'], cherishball: ['#c02030', '#f8f8f8', '#fff', '#ff6060'], safariball: ['#708030', '#f8f8f8', '#e0f0a0', '#a0c040'],
	sportball: ['#f8f8f8', '#f8f8f8', '#ffd0a0', '#ff9030'], fastball: ['#f06020', '#f8f8f8', '#ffe0a0', '#f8e040'], heavyball: ['#4a5a80', '#f8f8f8', '#c0d0ff', '#8090c0'],
	levelball: ['#e0a030', '#f8f8f8', '#ffe8a0', '#e03030'], lureball: ['#30a0e0', '#f8f8f8', '#c0f0ff', '#f8e040'], parkball: ['#f8e040', '#f8f8f8', '#ffffc0', '#60c0ff'],
	strangeball: ['#c04040', '#4040a0', '#ffe0ff', '#ff80ff'],
};
export function ballOut(layer: HTMLElement, from: Pt, to: Pt, s: number, ballId = 'pokeball'): number {
	const size = 10 * s;
	const st = BALL_STYLE[ballId] || BALL_STYLE.pokeball;
	const ball = px(layer, from.x, from.y, size, size, `linear-gradient(180deg,${st[0]} 0 45%,#111 45% 55%,${st[1]} 55%)`, 'border-radius:50%;box-shadow:0 0 0 1px #000');
	const dur = 420;
	anim(ball, [{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${(to.x - from.x) / 2}px,${(to.y - from.y) / 2 - 50 * s}px) rotate(360deg)` },
		{ transform: `translate(${to.x - from.x}px,${to.y - from.y}px) rotate(720deg)` }], { duration: dur, easing: 'steps(10)' });
	later(() => {
		flash(layer, st[2], 140);
		ballBurst(layer, to, s, ballId);
	}, dur - 20);
	return dur;
}

/* ───── 볼이 열릴 때의 도트 이펙트 ─────
 * 가운데서 번쩍(십자·대각 빛줄기가 돌며 줄어듦) → 고리 두 겹(빛 색·볼 색)이 차례로 퍼지고, 빠른·느린 입자가 꼬리를 남기며 날아감 → 주변에 작은 별이 반짝. 50ms(20fps) 한 칸씩, 도트 크기 = 배율 × 0.85.
 * 상징이 뚜렷한 볼만 모양을 바꿈: 러브러브볼=하트(pixelfx 하트 + 하트 입자), 문볼=별 입자. */
const SHAPES: { [k: string]: string[] } = {
	sq: ['11', '11'],
	heart: ['0101', '1111', '1111', '0110'],
	star: ['010', '111', '010'],
};
const BALL_SHAPE: { [id: string]: string } = { loveball: 'heart', moonball: 'star' };
export function ballBurst(layer: HTMLElement, at: Pt, s: number, ballId = 'pokeball') {
	const st = BALL_STYLE[ballId] || BALL_STYLE.pokeball;
	const base = st[0] === '#f8f8f8' || st[0] === '#1a1a1a' ? st[3] : st[0];
	ballPop(layer, at, s, base, st[2], st[3], SHAPES[BALL_SHAPE[ballId] || 'sq']);
	if (ballId === 'loveball') pixelFx(layer, at, s, { fx: 'heartPickup', len: .5, dy: 20 });
}
function ballPop(layer: HTMLElement, at: Pt, s: number, base: string, light: string, part: string, shape: string[]) {
	const W = 112, C = W / 2, k = s * 0.85, FR = 16;
	const cv = document.createElement('canvas');
	cv.width = W; cv.height = W; cv.className = 'fxp pxfx';
	cv.style.cssText = `left:${Math.round(at.x - C * k)}px;top:${Math.round(at.y - C * k)}px;width:${Math.round(W * k)}px;height:${Math.round(W * k)}px;`;
	const g = cv.getContext('2d'); if (!g) return;
	const dot = (x: number, y: number, w: number, col: string) => { g.fillStyle = col; g.fillRect(Math.round(x - w / 2), Math.round(y - w / 2), w, w); };
	const stamp = (x: number, y: number, col: string) => {
		g.fillStyle = col; const h = shape.length, w = shape[0].length, x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2);
		shape.forEach((row, j) => { for (let i = 0; i < w; i++) if (row[i] === '1') g.fillRect(x0 + i, y0 + j, 1, 1); });
	};
	/** 반짝임: 가운데 점 + 십자 빛줄기 (len 칸) */
	const glint = (x: number, y: number, len: number, col: string, diag = false) => {
		dot(x, y, 2, '#fff');
		for (let d = 2; d <= len; d++) {
			const c = d > len * 0.6 ? col : '#fff';
			if (diag) { dot(x + d, y + d, 1, c); dot(x - d, y - d, 1, c); dot(x + d, y - d, 1, c); dot(x - d, y + d, 1, c); }
			else { dot(x + d, y, 1, c); dot(x - d, y, 1, c); dot(x, y + d, 1, c); dot(x, y - d, 1, c); }
		}
	};
	const out = (u: number) => 1 - (1 - u) * (1 - u);
	// 입자: 빠른 것 10개(볼 모양) + 느린 것 8개(작은 점) — 지난 위치에 흐린 꼬리
	const fast = Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * Math.PI * 2 + 0.3, v: 46 }));
	const slow = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * Math.PI * 2 + 0.7, v: 28 }));
	// 마지막에 주변에서 반짝이는 별 (자리 고정)
	const tw = Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2 + 0.2, r = 22 + (i % 3) * 9; return { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r * 0.85, f0: 6 + (i % 3) * 2 }; });
	let f = 0, timer = 0;
	const tick = () => {
		if (f > FR) { clearInterval(timer); cv.remove(); return; }
		g.clearRect(0, 0, W, W);
		// 가운데 번쩍: 큰 빛 → 십자·대각 빛줄기가 돌며 줄어듦
		if (f === 0) { dot(C, C, 12, '#fff'); dot(C, C, 6, light); g.fillStyle = '#fff'; g.fillRect(C - 18, C - 1, 36, 2); g.fillRect(C - 1, C - 18, 2, 36); }
		else if (f <= 5) { glint(C, C, 14 - f * 2, light, f % 2 === 1); dot(C, C, f < 3 ? 6 : 4, light); }
		// 고리 1: 볼 빛 색 점선 원 / 고리 2: 조금 늦게, 볼 색으로 더 크게
		const ringAt = (f0: number, len: number, r0: number, r1: number, col: string, n: number) => {
			const u = (f - f0) / len; if (u < 0 || u > 1) return;
			const r = r0 + (r1 - r0) * out(u);
			for (let i = 0; i < n; i++) { if (u > 0.55 && (i + f) % 2) continue; const a = (i / n) * Math.PI * 2; dot(C + Math.cos(a) * r, C + Math.sin(a) * r * 0.9, u < 0.4 ? 2 : 1, col); }
		};
		ringAt(1, 8, 6, 34, light, 32);
		ringAt(3, 9, 8, 48, base, 40);
		// 입자
		for (const [list, life, sh] of [[fast, 12, true], [slow, 14, false]] as const) {
			const u = (f - 1) / life; if (u < 0 || u > 1) continue;
			list.forEach((pp, i) => {
				const d = 4 + pp.v * out(u), dp = 4 + pp.v * out(Math.max(0, u - 1 / life));
				const x = C + Math.cos(pp.a) * d, y = C + Math.sin(pp.a) * d * 0.9, col = i % 2 ? part : base;
				if (u > 0.75 && (i + f) % 2) return;
				g.globalAlpha = 0.45; dot(C + Math.cos(pp.a) * dp, C + Math.sin(pp.a) * dp * 0.9, 1, light); g.globalAlpha = 1;   // 꼬리
				if (sh && u < 0.55) stamp(x, y, col); else dot(x, y, sh ? 2 : 1, col);
			});
		}
		// 주변 반짝임: 하나씩 켜졌다 꺼짐
		for (const t of tw) { const d = f - t.f0; if (d >= 0 && d < 5) glint(t.x, t.y, d < 2 ? 3 + d : 5 - d, light, d % 2 === 1); }
		f++;
	};
	later(() => { layer.appendChild(cv); tick(); timer = window.setInterval(tick, 50 / SPEED); }, 0);
}
type BallFx = { fx: string; pal?: string | string[]; t0?: number; len: number; dy: number; delay?: number; opts?: { [k: string]: any } };
const shade = (hex: string, k: number, to: number) => {
	const n = parseInt(hex.slice(1).replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (to - v) * k));
	return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
};
/** 한 색에서 어둠→색→흰색 8단 색 띠 */
const rampOf = (hex: string) => [shade(hex, .85, 0), shade(hex, .7, 0), shade(hex, .5, 0), shade(hex, .3, 0), shade(hex, .12, 0), hex, shade(hex, .5, 255), '#ffffff'];
const STEP = 0.05;
/** pixelfx 효과 하나를 캔버스에 50ms 한 칸씩 그림 */
function pixelFx(layer: HTMLElement, at: Pt, s: number, f: BallFx) {
	const mod = PX.EFFECTS[f.fx]; if (!mod) return;
	const [w, h] = mod.meta.size, [ox, oy] = mod.meta.origin, k = s * 0.85;
	const opts: { [k: string]: any } = { x: ox, y: oy, ...(f.opts || {}) };
	if (Array.isArray(f.pal)) opts.palette = f.pal; else if (f.pal) opts.palette = rampOf(f.pal);
	const fx = PX.createFx(mod, opts), frame = PX.createFrame(w, h);
	for (let t = 0; t < (f.t0 || 0) - 1e-6; t += STEP) fx.update(STEP);
	const cv = document.createElement('canvas');
	cv.width = w; cv.height = h; cv.className = 'fxp pxfx';
	cv.style.cssText = `left:${Math.round(at.x - ox * k)}px;top:${Math.round(at.y + (f.dy - oy) * k)}px;width:${Math.round(w * k)}px;height:${Math.round(h * k)}px;`;
	const ctx = cv.getContext('2d'); if (!ctx) return;
	const img = ctx.createImageData(w, h);
	let played = 0, timer = 0;
	const tick = () => {
		fx.update(STEP); played += STEP;
		if (played >= f.len) fx.stop();
		if (fx.done() || played > f.len + 0.6) { clearInterval(timer); cv.remove(); return; }
		PX.clearFrame(frame); fx.draw(frame); PX.composite(frame, img.data, null); ctx.putImageData(img, 0, 0);
	};
	later(() => { layer.appendChild(cv); tick(); timer = window.setInterval(tick, (STEP * 1000) / SPEED); }, (f.delay || 0) * 1000);
}

export function ballIn(layer: HTMLElement, at: Pt, s: number) {
	for (let i = 0; i < 10; i++) {
		const a = (i / 10) * Math.PI * 2;
		const el = px(layer, at.x + Math.cos(a) * 30 * s, at.y + Math.sin(a) * 20 * s, 4 * s, 4 * s, '#f8c0c0');
		anim(el, [{ opacity: 1 }, { transform: `translate(${-Math.cos(a) * 30 * s}px,${-Math.sin(a) * 20 * s}px)`, opacity: 0 }], { duration: 300, easing: 'steps(5)' });
	}
}

// ───────── 기술 → 연출 선택 ─────────
const RX = (re: RegExp, id: string) => re.test(id);

/**
 * 기술 하나의 연출을 재생. 돌아오는 값은 타격이 들어가는 시점(ms) — 그때 피격 소리를 낸다.
 */
export function playMove(layer: HTMLElement, arena: HTMLElement, m: MoveFxInfo, from: Pt, to: Pt, s: number, hits: Pt[] = [to]): number {
	const { id, type, category } = m;
	const own = from.x < layer.clientWidth / 2;
	const t = type;
	const each = (fn: (p: Pt) => void) => hits.forEach(fn);

	if (category === 'Status') {
		if (RX(/powder|spore|poisongas|stunspore|toxic$|willowisp|yawn|hypnosis|lovelykiss|darkvoid/, id)) { each(p => powder(layer, p, t, s)); return 500; }
		if (RX(/sing|song|roar$|chatter|round|perishsong|screech|supersonic|metalsound|growl|howl|noble/, id)) { notes(layer, from, t, s); return 500; }
		if (RX(/protect|detect|kingsshield|spikyshield|banefulbunker|obstruct|silktrap|burningbulwark|wideguard|quickguard|matblock|endure|reflect|lightscreen|auroraveil|safeguard|substitute|barrier|irondefense|acidarmor|withdraw|harden|defensecurl|cosmicpower|stockpile|amnesia|cottonguard|bulkup|coil|shelter/, id)) { shield(layer, from, t, s); return 500; }
		if (RX(/recover|roost|softboiled|milkdrink|slackoff|synthesis|moonlight|morningsun|rest|wish|healorder|shoreup|lifedew|junglehealing|healbell|aromatherapy|refresh|purify|floralhealing|healpulse/, id)) { sparkle(layer, hits[0] === to && m.target !== 'self' ? to : from, 'Grass', s); return 500; }
		if (RX(/dance|nastyplot|calmmind|agility|rockpolish|shiftgear|autotomize|workup|growth|honeclaws|tailglow|geomancy|clangoroussoul|noretreat|bellydrum|curse|meditate|sharpen|focusenergy|charge|victorydance|tidyup|quiverdance|dragondance|swordsdance|shellsmash/, id)) {
			sparkle(layer, from, t, s); ring(layer, from, t, s, false); return 500;
		}
		if (RX(/stealthrock|spikes|toxicspikes|stickyweb|stoneaxe|ceaselessedge/, id)) { throwRocks(layer, from, { x: to.x, y: to.y + 20 * s }, t === 'Normal' ? 'Rock' : t, s, 4); return 500; }
		if (RX(/thunderwave|glare|leer|taunt|torment|encore|disable|spite|meanlook|block|confuseray|swagger|flatter|attract|sweetkiss|teeterdance|trick|switcheroo|knockoff|embargo|healblock|imprison|psychup|haze|clearsmog|whirlwind|roar|dragontail|circlethrow|lockon|mindreader|foresight|odorsleuth|miracleeye|memento|partingshot|defog|rapidspin|mortalspin|toxicthread|strengthsap|leechseed|poisonpowder/, id)) {
			each(p => sparkle(layer, p, t, s, true)); if (RX(/leechseed|strengthsap/, id)) drain(layer, from, to, 'Grass', s); return 450;
		}
		if (RX(/raindance|sunnyday|sandstorm|hail|snowscape|chillyreception|trickroom|gravity|magicroom|wonderroom|electricterrain|grassyterrain|mistyterrain|psychicterrain|tailwind|mudsport|watersport/, id)) { flash(layer, LIGHT[t] || '#fff', 400); powder(layer, { x: layer.clientWidth / 2, y: layer.clientHeight / 2 }, t, s); return 500; }
		sparkle(layer, m.target === 'self' || m.target === 'allySide' ? from : to, t, s);
		return 450;
	}

	// ── 공격 기술 ──
	const strong = (m.basePower || 0) >= 100;
	if (RX(/explosion|selfdestruct|mistyexplosion|boomburst|hyperbeam|gigaimpact|bloomdoom|infernooverdrive|supernova|eruption|waterspout|mindblown|steelbeam|chloroblast|finalgambit|lastresort/, id)) {
		if (RX(/hyperbeam|gigaimpact|steelbeam|chloroblast/, id)) { return beam(layer, from, to, t, s, 800) * 0.35; }
		ring(layer, RX(/explosion|selfdestruct|mindblown|mistyexplosion/, id) ? from : to, t, s, true); shake(arena, true); return 300;
	}
	if (RX(/beam|solar|flashcannon|technoblast|prismaticlaser|lightthatburnsthesky|dynamaxcannon|eternabeam|psystrike|aurasphere|moonblast|dracometeor$|hydrocannon|frenzyplant|blastburn|mistball|lusterpurge|freezedry|triattack|signalbeam|chargebeam|bubblebeam|psybeam|icebeam|hyperbeam|powergem|judgment|fleurcannon|photongeyser/, id)) {
		const d = beam(layer, from, to, t, s, strong ? 750 : 600); return d * 0.3;
	}
	if (RX(/thunder|bolt|volt|zap|discharge|electro|shock|spark|wildcharge|plasma|risingvoltage|boltbeak|fusionbolt|thunderous|thunderbolt|thunderclap|supercellslam/, id) && t === 'Electric') {
		if (RX(/wildcharge|volttackle|boltbeak|spark|thunderpunch|thunderfang|supercellslam|zingzap|plasmafists|thunderouskick/, id)) { punch(layer, to, t, s); later(() => bolt(layer, to, t, s, 1), 60); return 120; }
		each(p => bolt(layer, p, t, s, strong ? 3 : 2)); return 110;
	}
	if (RX(/flamethrower|fireblast|heatwave|overheat|flamecharge|inferno|lavaplume|fierydance|magmastorm|burnup|searingshot|ember|blazekick|incinerate|mysticalfire|scald|steameruption|hydropump|surf|muddywater|waterpulse|watergun|bubble|sludge|acid|gunkshot|venoshock|dragonbreath|dragonpulse|icywind|blizzard|frostbreath|powdersnow|glaciate|dragonenergy|breakingswipe|snarl|darkpulse|hex|shadowball|nightshade|psyshock|psychic$|extrasensory|futuresight|storedpower|expandingforce|energyball|gigadrain|leafstorm|petalblizzard|bugbuzz|airslash|hurricane|gust|aircutter|razorwind|ominouswind|silverwind|fairywind|dazzlinggleam|drainingkiss|sparklingaria|oceanicoperetta|hyperspacefury|spacialrend|roaroftime|originpulse|precipiceblades|clangingscales|coreenforcer|overdrive|torchsong|bittermalice|infernalparade|makeitrain|ragingbull|armorcannon|bleakwindstorm|wildboltstorm|sandsearstorm|springtidestorm|psyblade|lumina|ivycudgel|electroshot|matchagotcha|syrupbomb|tachyoncutter/, id) && category === 'Special' || (category === 'Special' && RX(/flame|fire|heat|burn|water|hydro|aqua|ice|frost|freeze|snow|sludge|acid|poison|dragon|psy|shadow|dark|leaf|energy|air|wind|storm|fairy|gleam/, id))) {
		if (RX(/surf|muddywater|heatwave|blizzard|icywind|hurricane|petalblizzard|glaciate|bleakwindstorm|wildboltstorm|sandsearstorm|springtidestorm|wave$/, id)) { wave(layer, to, t, s, own); shake(arena); return 350; }
		if (RX(/pulse|ball$|shadowball|energyball|sludgebomb|moonblast|mistball|psyshock|hex|nightshade|storedpower|expandingforce|focusblast|aurasphere|seedbomb|eggbomb|weatherball|electroball|gyroball|iceball|octazooka|syrupbomb|acidspray|mudbomb|mudshot/, id)) { return projectile(layer, from, to, t, s, strong || RX(/ball|bomb|blast/, id)) - 60; }
		if (RX(/twister|whirlpool|firespin|sandtomb|magmastorm|infestation|snaptrap|thunderstorm|hurricane|vortex|razorwind|ominouswind|silverwind|fairywind|gust|aircutter|tailwind|fierydance/, id)) { each(p => vortex(layer, p, t, s)); return 300; }
		if (RX(/psychic$|extrasensory|futuresight|confusion|zenheadbutt|psystrike|psyblade|lumina|dreameater|mysticalfire|bittermalice|infernalparade|hyperspace|spacialrend|roaroftime/, id)) { each(p => { ring(layer, p, t, s, false); vortex(layer, p, t, s, 600); }); flash(layer, LIGHT[t], 200); return 300; }
		return stream(layer, from, to, t, s, strong ? 800 : 650) * 0.45;
	}
	if (category === 'Special') {
		if (RX(/storm|meteor|dracometeor|rockslide|meteorbeam|cometpunch|ancientpower|powergem|stoneedge|rockblast|diamondstorm|seedflare|magnitude|earthpower|scorchingsands|makeitrain|malignantchain/, id)) { rain(layer, to, t, s, strong ? 10 : 6); shake(arena); return 420; }
		return projectile(layer, from, to, t, s, strong) - 60;
	}

	// 물리
	if (RX(/earthquake|bulldoze|magnitude|stomp|stompingtantrum|highhorsepower|headlongrush|precipiceblades|fissure|earthpower|thousandwaves|thousandarrows|landswrath|stampede|tremor/, id)) { quake(layer, arena, t, s); each(p => burst(layer, p, t, s, true)); return 250; }
	if (RX(/rockslide|stoneedge|rockblast|rocktomb|rockthrow|ancientpower|rockwrecker|headsmash|accelerock|smackdown|meteormash|cometpunch|diamondstorm|stoneaxe|mightycleave|rockclimb/, id)) {
		if (RX(/rockslide|rocktomb|ancientpower|diamondstorm|stoneedge/, id)) { rain(layer, to, t, s, 8, 10); shake(arena); return 420; }
		throwRocks(layer, from, to, t, s, 5); return 420;
	}
	if (RX(/punch|fist|chop|hammer|smash|slam|bodypress|clap|tackle|bodyslam|doubleedge|takedown|gigaimpact|headbutt|skullbash|ironhead|zenheadbutt|headsmash|headcharge|rush|charge|ram|collision|knock|bash|pound|facade|return|frustration|retaliate|revenge|payback|suckerpunch|quickattack|extremespeed|fakeout|feint|machpunch|bulletpunch|shadowsneak|aquajet|iceshard|accelerock|jetpunch|grassyglide|flipturn|uturn|voltswitch|crushgrip|hardpress|thrash|outrage|strength|superpower|closecombat|highjumpkick|jumpkick|kick|lowsweep|lowkick|drainpunch|crosschop|skyuppercut|meteormash|darkestlariat|throatchop|dualchop|armthrust|tripleaxel|triplekick|axekick|tripledive|bounce|fly$|dive|dig|phantomforce|shadowforce|geargrind|heavyslam|heatcrash|flare|blitz|volttackle|woodhammer|bravebird|wildcharge|zingzap|plasmafists|bodypress|dragonrush|dragonhammer|bolt/, id)) {
		punch(layer, to, t, s); if (strong) { burst(layer, to, t, s, true); shake(arena, strong); } if (RX(/drainpunch|hornleech|leechlife|absorb|gigadrain|megadrain|drainingkiss|dreameater|oblivionwing|paraboliccharge|bitterblade|matchagotcha/, id)) drain(layer, from, to, t, s); return 160;
	}
	if (RX(/bite|crunch|fang|jaw|chomp|munch|hyperfang|superfang|psychicfangs|fishiousrend|jawlock|snaptrap/, id)) { bite(layer, to, t, s); return 180; }
	if (RX(/slash|cut|claw|scratch|razor|blade|sword|edge|cleave|fury|crosspoison|nightslash|psychocut|sacredsword|leafblade|solarblade|secretsword|xscissor|airslash|aerialace|wing|steelwing|drillpeck|peck|hornattack|horndrill|megahorn|smartstrike|drillrun|poisonjab|needlearm|lunge|firstimpression|uturn|slicing|kowtowcleave|populationbomb|ceaselessedge|bitterblade|aquacutter|ivycudgel|tachyoncutter|psyblade|stoneaxe|mightycleave|shadowclaw|dragonclaw|metalclaw|crushclaw|hone|cross/, id)) {
		if (RX(/wing|aerialace|airslash|aircutter|acrobatics|drillpeck|peck|bravebird|fly$|skyattack|dualwingbeat|beakblast|flyingpress|oblivionwing/, id)) { crescent(layer, from, to, t, s, 2); return 450; }
		slash(layer, to, t, s, RX(/fury|cross|xscissor|dualchop|populationbomb|multi/, id) ? 4 : 3); return 120;
	}
	if (RX(/seed|leaf|razorleaf|magicalleaf|petal|bulletseed|pinmissile|spikecannon|iciclespear|icicle|rockblast|bonerush|bonemerang|boneclub|poisonsting|twineedle|needle|missile|shuriken|waterShuriken|sting|barrage|eggbomb|fling|present|boomerang|beatup|scaleshot|tripledive|spreadsplatter|iciclecrash|iceball|snowball/, id)) { throwRocks(layer, from, to, t, s, 6, RX(/seed|ball|egg|snow|present|barrage/, id)); return 450; }
	if (RX(/dragon|outrage|flare|fire|burn|blaze|heat|ice|frost|aqua|water|liquid|wave|surf|crabhammer|razorshell|waterfall|leafstorm|wood|grass|bug|poison|sludge|shadow|phantom|night|dark|spirit|hex|psych|zen|steel|iron|metal|anchor|gyro|heavy|gear|rock|stone|ground|mud|sand|fairy|play|spark|volt|thunder|electro|bolt/, id)) {
		punch(layer, to, t, s); burst(layer, to, t, s, strong); return 160;
	}
	// 기본: 돌진 + 타격
	burst(layer, to, t, s, strong);
	return 180;
}
