/** 공용 UI 조각과 화면 전환 도우미 */
import { h, render, type ComponentChildren, type VNode } from 'preact';
import { useState, useRef, useLayoutEffect, useEffect } from 'preact/hooks';
import { spriteId, typeKo, speciesData, toID, RAW, type Gen } from '../data';
import { loadSettings } from '../store';
import { partBase } from '../offline';
import SPRITE_PAD from '../gen/sprite-pad.json';
import SPRITE_SCALE from '../gen/sprite-scale.json';
import ZA_MEGA from '../gen/za-mega-ids.json';
import { getUserSprite, userSpriteKey } from '../user-sprites';
/** 정지 도트 그림의 아래 투명 여백(px) [앞, 뒤] — 발판에 딱 서도록 그만큼 내림 (scripts/sprite-pad.py) */
const PAD = SPRITE_PAD as { [id: string]: number[] };
/** 메가진화 등 바뀐 모습이 기본 모습보다 작아 보이지 않게 하는 배율 [정지 도트, 3D] (scripts/sprite-scale.py) */
const SCALE = SPRITE_SCALE as { [id: string]: number[] };

// ── 화면 전환: 모드 진행 코드를 async 함수로 쓰기 위한 도우미 ──
let setViewFn: ((v: VNode | null) => void) | null = null;
export function bindView(fn: (v: VNode | null) => void) { setViewFn = fn; }
export function show(node: VNode | null) { setViewFn?.(node); }
/** render(resolve) 가 그린 화면에서 resolve 가 불릴 때까지 기다림 */
/** 배틀 중 '메인 메뉴로' — 진행 중인 모드를 끝낸다 */
export class QuitToMenu extends Error { constructor() { super('quit'); } }
let aborting = false;
export function abortMode() { aborting = true; }
export function resetAbort() { aborting = false; }
export function ask<T>(render: (resolve: (v: T) => void) => VNode): Promise<T> {
	if (aborting) return Promise.reject(new QuitToMenu());
	return new Promise<T>(resolve => {
		let done = false;
		const once = (v: T) => { if (!done) { done = true; resolve(v); } };
		show(render(once));
	});
}

// ── 타입 색 ──
export const TYPE_COLOR: { [t: string]: string } = {
	Normal: '#9fa19f', Fire: '#e62829', Water: '#2980ef', Electric: '#d9b400', Grass: '#3fa129', Ice: '#3dcef3',
	Fighting: '#ff8000', Poison: '#9141cb', Ground: '#915121', Flying: '#81b9ef', Psychic: '#ef4179', Bug: '#91a119',
	Rock: '#afa981', Ghost: '#704170', Dragon: '#5060e1', Dark: '#624d4e', Steel: '#60a1b8', Fairy: '#ef70ef', Stellar: '#2b3a96', '???': '#68a090',
};

export function TypeBadge({ type, small }: { type: string; small?: boolean }) {
	return <span class={'type' + (small ? ' small' : '')} style={{ background: TYPE_COLOR[type] || '#888' }}>{typeKo(type)}</span>;
}

const SPRITE_HOST = 'https://play.pokemonshowdown.com/sprites';
/** 앱 안에 들어 있는 그림 (scripts/fetch-sprites.sh 로 받음) — 오프라인에서도 표시 */
export const LOCAL_SPRITES = 'sprites';
/** 그림이 있는 곳: 내장(--full 빌드) 또는 내려받은 오프라인 묶음. 없으면 '' (인터넷) */
export const spriteBase = () => partBase('sprites');
/** 목록 아이콘용 정지 그림 주소 */
export const gen5Icon = (id: string) => (spriteBase() ? `${spriteBase()}gen5/${id}.png` : `${SPRITE_HOST}/gen5/${id}.png`);
/** 앱 안에 그림이 없고 묶음도 안 받은 상태 */
export const LITE = false;
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/** 도구 아이콘 (쇼다운 아이템 아이콘 시트, 24×24) */
export function ItemIcon({ item, size = 24 }: { item: string; size?: number }) {
	const n = RAW.items[toID(item)]?.sp;
	if (!item || n === undefined) return <span class="item-icon none" style={{ width: size, height: size }} />;
	const k = size / 24;
	return <span class="item-icon" style={{ width: size, height: size, backgroundImage: spriteBase() ? `url(${spriteBase()}itemicons-sheet.png), url(${SPRITE_HOST}/itemicons-sheet.png)` : `url(${SPRITE_HOST}/itemicons-sheet.png)`,
		backgroundPosition: `${-(n % 16) * 24 * k}px ${-Math.floor(n / 16) * 24 * k}px`, backgroundSize: `${384 * k}px ${1152 * k}px` }} />;
}

/** 물리/특수/변화 아이콘 */
export function CatIcon({ cat }: { cat: string }) {
	const label = cat === 'Physical' ? '물리' : cat === 'Special' ? '특수' : '변화';
	return <span class={'cat-icon ' + cat.toLowerCase()} title={label}>{label}</span>;
}

const preloaded: { [url: string]: HTMLImageElement } = {};
/** 배틀 시작 전에 그림을 미리 받아 둔다 (교체 때 그림이 늦게 뜨는 것 방지) */
export function preloadSprite(species: string, back: boolean, shiny?: boolean) {
	const settings = loadSettings();
	const id = spriteId(species);
	const sh = shiny ? '-shiny' : '';
	if (!settings.animatedSprites || !online()) return; // 앱 안의 그림은 받을 필요 없음
	const url = `${SPRITE_HOST}/ani${back ? '-back' : ''}${sh}/${id}.gif`;
	if (preloaded[url]) return;
	const im = new Image(); im.decoding = 'async'; im.src = url; preloaded[url] = im;
}

/** 포켓몬 그림 (인터넷 연결 시 쇼다운 스프라이트, 실패하면 이름 카드) */
export function Sprite({ species, back, shiny, gen = 5, size = 96, anim, cls, tera }: {
	species: string; back?: boolean; shiny?: boolean; gen?: Gen; size?: number; anim?: boolean; cls?: string; /** 테라스탈 타입: 그림 모양대로 반투명 보석 결을 겹침 */ tera?: string;
}) {
	const settings = loadSettings();
	const id = species === 'substitute' ? 'substitute' : spriteId(species);
	const useAnim = (anim ?? settings.animatedSprites);
	const candidates = spriteCandidates(species, id, !!back, !!shiny, useAnim, gen);
	const [idx, setIdx] = useState(0);
	const [key, setKey] = useState(id + back + shiny + gen + useAnim);
	const curKey = id + back + shiny + gen + useAnim;
	if (key !== curKey) { setKey(curKey); setIdx(0); }
	if (idx >= candidates.length && id === 'substitute') {
		return <div class={'sub-doll ' + (cls || '')}>대타</div>;
	}
	if (idx >= candidates.length) {
		const s = speciesData(toID(species), gen);
		const color = TYPE_COLOR[s?.t[0] || 'Normal'];
		return <div class={'sprite-fallback ' + (cls || '')} style={{ width: size, height: size, borderColor: color }}>
			<span style={{ color }}>{(s?.n || species).slice(0, 4)}</span>
		</div>;
	}
	const cur = candidates[idx] || '';
	// 배틀 그림: 정지 도트 그림이면 측정해 둔 바닥 여백을, 움직이는 그림이면 대략값을 CSS 변수로
	const us = cur.startsWith('data:') ? getUserSprite(userSpriteKey(id, !!back, !!shiny)) : null;
	const pad = (cls === 'front' || cls === 'back') ? us?.src === cur ? us.pad : (/\/gen5(-back)?(-shiny)?\/[^/]+\.png$/.test(cur) || cur.startsWith('data:image/png') || cur.includes(`/${(ZA_MEGA as any)[id]}.png`) ? (PAD[id]?.[back ? 1 : 0] ?? 8) : 4) : undefined;
	// 배틀 그림 크기 보정: 바뀐 모습 배율 × (3D 설정인데 3D 그림이 없어 도트 그림으로 나오면 3D 그림 크기에 맞춰 1.3배)
	const isAni = /\.gif$/.test(cur);
	const ks = pad !== undefined ? (cur.includes(`/${id}.`) || cur.includes(`/${(ZA_MEGA as any)[id]}.png`) ? SCALE[id]?.[isAni ? 1 : 0] ?? 1 : 1) * (useAnim && !isAni ? 1.3 : 1) : 1;
	const st = { maxWidth: size, maxHeight: size, objectFit: 'contain', ...(pad !== undefined ? { '--pad': pad + 'px' } : {}), ...(ks !== 1 ? { '--ks': ks } : {}) } as any;
	// 테라스탈: 그림 모양대로 반투명 보석 결을 겹치는 SVG 필터 (TeraFilters) — 다른 사이트 그림에도 쓸 수 있음
	return <img class={'sprite ' + (cls || '')} src={cur} alt={species} loading="lazy" style={tera ? { ...st, filter: `url(#tera-${tera})` } : st} onError={() => setIdx(idx + 1)} draggable={false} />;
}

/** 그림 후보 순서: 온라인이면 움직이는 그림 → 앱 안의 정지 그림 → 서버 정지 그림, 오프라인이면 앱 안의 그림부터 */
declare const __CUSTOM_SPRITES__: Record<string, string>;
/** 직접 만든 그림 (build.mjs 가 src/sprites-custom 에서 넣음): 앞모습만 있으면 뒷모습은 평소 그림 */
export const CUSTOM_SPRITES: Record<string, string> = typeof __CUSTOM_SPRITES__ === 'object' ? __CUSTOM_SPRITES__ : {};
function spriteCandidates(species: string, id: string, back: boolean, shiny: boolean, useAnim: boolean, gen: Gen): string[] {
	const b = back ? '-back' : '', sh = shiny ? '-shiny' : '';
	// 사용자가 넣은 그림: 정지 도트 그림이면 가장 먼저, 3D 그림 설정이면 다른 그림을 못 받을 때(이름 카드 대신)
	const user = getUserSprite(userSpriteKey(id, back, shiny))?.src;
	const custom = CUSTOM_SPRITES[`${id}${b}${sh}`];
	if (user && !useAnim) return [user];
	// 앱에 넣은 도트 그림(9세대 진짜 뒷모습 등): 정지 그림 설정이면 그것, 3D 그림 설정이면 3D 그림이 먼저(못 받으면 도트)
	if (custom) { const l = useAnim && online() ? [`${SPRITE_HOST}/ani${b}${sh}/${id}.gif`, custom] : [custom]; return user ? [...l, user] : l; }
	const withUser = (l: string[]) => user ? [...l, user] : l;
	const sb = spriteBase();
	if (id === 'substitute') return sb ? [`${sb}substitutes/gen5${b}/substitute.png`, `${SPRITE_HOST}/substitutes/gen5${b}/substitute.png`] : [`${SPRITE_HOST}/substitutes/gen5${b}/substitute.png`];
	const local = [`${sb}gen5${b}${sh}/${id}.png`];
	// 앱에 없는 모습(일부 Z-A 메가 등)은 기본 모습으로
	const base = speciesData(toID(species), 9 as Gen)?.base;
	if (base) local.push(`${sb}gen5${b}${sh}/${spriteId(base)}.png`);
	const remote: string[] = [];
	if (useAnim) remote.push(`${SPRITE_HOST}/ani${b}${sh}/${id}.gif`, `${SPRITE_HOST}/gen5ani${b}${sh}/${id}.gif`);
	if (gen === 4) remote.push(`${SPRITE_HOST}/gen4${b}${sh}/${id}.png`);
	// 레전즈 Z-A 메가: 쇼다운 서버에 뒷모습이 없거나 흐릿해서 PokeAPI 도트 그림 (앱 오프라인 묶음과 같은 그림, scripts/fetch-za-megas.py)
	const za = (ZA_MEGA as { [id: string]: number })[id];
	const remoteStatic = za ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${back ? 'back/' : ''}${shiny ? 'shiny/' : ''}${za}.png` : `${SPRITE_HOST}/gen5${b}${sh}/${id}.png`;
	if (!sb) { const rb = base ? [`${SPRITE_HOST}/gen5${b}${sh}/${spriteId(base)}.png`] : []; return withUser(useAnim ? [...remote, remoteStatic, ...rb] : [remoteStatic, ...rb]); }
	if (!online()) return withUser([...local, remoteStatic]);
	return withUser(useAnim ? [...remote, local[0], remoteStatic, ...local.slice(1)] : [local[0], remoteStatic, ...local.slice(1)]);
}

/** 목록·카드용 썸네일: 96px 도트 그림에서 그림이 있는 영역만 잘라 가능하면 1:1(축소 없이)로 보여 뭉개지지 않게 */
/** snap: 배율을 1 또는 1/2 로만 (어중간한 배율로 줄이면 도트 굵기가 들쭉날쭉해짐) */
export function CropSprite({ species, gen = 5, size = 64, shiny, cls, snap }: { species: string; gen?: Gen; size?: number; shiny?: boolean; cls?: string; snap?: boolean }) {
	const id = spriteId(species);
	const e = PAD[id] || PAD[spriteId(speciesData(toID(species), 9 as Gen)?.base || '')];
	const ub = getUserSprite(userSpriteKey(id, false, !!shiny))?.bb;   // 목록 썸네일은 늘 정지 그림 → 사용자 그림이면 그 영역
	const [x, y, w, h] = ub || (e && e.length >= 6 ? e.slice(2) : [0, 0, 96, 96]);
	let k = Math.min(1, (size - 2) / Math.max(w, h));
	if (snap) k = k >= 1 ? 1 : 0.5;
	const tx = Math.round((size - w * k) / 2 - x * k), ty = Math.round((size - h * k) / 2 - y * k);
	return <span class={'crop ' + (cls || '')} style={{ width: size, height: size, '--t': `translate(${tx}px, ${ty}px) scale(${k})` } as any}>
		<Sprite species={species} gen={gen} size={96} anim={false} shiny={shiny} />
	</span>;
}
/** 목록용 작은 아이콘 */
export function MiniSprite({ species, gen = 5, size = 40, shiny }: { species: string; gen?: Gen; size?: number; shiny?: boolean }) {
	return <CropSprite species={species} gen={gen} size={size} shiny={shiny} cls="mini" />;
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ComponentChildren }) {
	return <header class="bar">
		{onBack ? <button class="icon-btn" onClick={onBack} aria-label="뒤로">‹</button> : <span class="icon-gap" />}
		<h1>{title}</h1>
		<div class="bar-right">{right}</div>
	</header>;
}

export function Screen({ title, onBack, right, children, cls, top }: {
	title: string; onBack?: () => void; right?: ComponentChildren; children: ComponentChildren; cls?: string;
	/** 열릴 때 맨 위부터 보이기 (기술·도구 고르기 등 목록 화면) */
	top?: boolean;
}) {
	useLayoutEffect(() => { if (top) window.scrollTo(0, 0); }, []);
	return <div class={'screen ' + (cls || '')}>
		<Header title={title} onBack={onBack} right={right} />
		<main class="content">{children}</main>
	</div>;
}

export function HPBar({ hp, maxhp, showText }: { hp: number; maxhp: number; showText?: boolean }) {
	const pct = maxhp ? Math.max(0, Math.min(100, hp / maxhp * 100)) : 0;
	const color = pct > 50 ? 'var(--hp-good)' : pct > 20 ? 'var(--hp-mid)' : 'var(--hp-low)';
	return <div class="hpbar">
		<div class="hpbar-fill" style={{ width: pct + '%', background: color }} />
		{showText && <span class="hpbar-text">{hp}/{maxhp}</span>}
	</div>;
}

export const STATUS_LABEL: { [s: string]: [string, string] } = {
	brn: ['화상', '#e0632e'], par: ['마비', '#c9a800'], slp: ['잠듦', '#8a8a9a'], frz: ['얼음', '#3cb8d8'],
	psn: ['독', '#9a4ac0'], tox: ['맹독', '#7a2aa0'], fnt: ['기절', '#555'],
};
export function StatusBadge({ status }: { status?: string }) {
	if (!status || !STATUS_LABEL[status]) return null;
	const [label, color] = STATUS_LABEL[status];
	return <span class="status" style={{ background: color }}>{label}</span>;
}

export function Modal({ onClose, children, title }: { onClose: () => void; children: ComponentChildren; title?: string }) {
	// 닫힐 때도 열릴 때처럼 짧게 줄어들며 사라지게: 어디서 닫든(닫기 버튼·바깥 누름·상태 변경) 사라지기 직전 모습을 복사해 남겨 둠
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current, parent = el?.parentNode;
		return () => {
			if (!el || !parent || !(parent as Node).isConnected) return;
			const ghost = el.cloneNode(true) as HTMLElement;
			ghost.classList.add('closing');
			parent.appendChild(ghost);
			setTimeout(() => ghost.remove(), 120);
		};
	}, []);
	return <div class="modal-bg" ref={ref} onClick={onClose}>
		<div class="modal" onClick={e => e.stopPropagation()}>
			{title && <div class="modal-title"><b>{title}</b><button class="icon-btn" onClick={onClose} aria-label="닫기">×</button></div>}
			<div class="modal-body">{children}</div>
		</div>
	</div>;
}

let toastTimer: any;
export function toast(msg: string) {
	let el = document.getElementById('toast');
	if (!el) {
		el = document.createElement('div');
		el.id = 'toast';
		document.body.appendChild(el);
	}
	el.textContent = msg;
	el.className = 'show';
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => { el!.className = ''; }, 2200);
}

/** 확인 대화상자 */
export function confirmBox(title: string, body: string, ok = '확인', cancel = '취소'): Promise<boolean> {
	return new Promise(resolve => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const close = (v: boolean) => { render(null, host); host.remove(); resolve(v); };
		render(
			<Modal onClose={() => close(false)} title={title}>
				<p class="pre">{body}</p>
				<div class="row end">
					{cancel && <button class="btn ghost" onClick={() => close(false)}>{cancel}</button>}
					<button class="btn primary" onClick={() => close(true)}>{ok}</button>
				</div>
			</Modal>, host);
	});
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
void h;

// ── 전체화면 (웹 전용: 안드로이드 앱은 이미 전체화면이고, 아이폰 사파리는 Fullscreen API 가 없어 버튼을 숨김) ──
const fsDoc = document as any;
const fsElement = () => fsDoc.fullscreenElement || fsDoc.webkitFullscreenElement || null;
/** 이 환경에서 전체화면 버튼을 보여 줄지 */
export const canFullscreen = () => !(window as any).BattleSimNative && !!(fsDoc.fullscreenEnabled || fsDoc.webkitFullscreenEnabled);
export async function toggleFullscreen() {
	try {
		if (fsElement()) await (fsDoc.exitFullscreen || fsDoc.webkitExitFullscreen).call(fsDoc);
		else {
			const el = document.documentElement as any;
			await (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
		}
	} catch { toast('이 브라우저에서는 전체화면을 쓸 수 없습니다'); }
}
/** 전체화면 여부 (Esc 등으로 빠져나와도 따라감) */
export function useFullscreen(): boolean {
	const [on, setOn] = useState(!!fsElement());
	useEffect(() => {
		const f = () => setOn(!!fsElement());
		document.addEventListener('fullscreenchange', f); document.addEventListener('webkitfullscreenchange', f);
		return () => { document.removeEventListener('fullscreenchange', f); document.removeEventListener('webkitfullscreenchange', f); };
	}, []);
	return on;
}
/** 화면 위쪽 막대에 넣는 전체화면 버튼 (지원하지 않으면 그리지 않음) */
export function FullscreenButton({ cls = 'icon-btn' }: { cls?: string }) {
	const on = useFullscreen();
	if (!canFullscreen()) return null;
	return <button class={cls + ' pix-btn fs-btn' + (on ? ' on' : '')} onClick={e => { e.stopPropagation(); toggleFullscreen(); }} aria-label={on ? '전체화면 끄기' : '전체화면'} title={on ? '전체화면 끄기' : '전체화면'}>
		<span class="pix-ico fs" aria-hidden="true" />
	</button>;
}

/** ◀ 이름 ▶ 으로 넘기며 고르는 작은 상자 (배틀 전 음악·배경). bg 가 있으면 상자 뒤에 그 그림을 깔아 미리 보여 줌 */
export function ArrowPicker({ label, items, value, onChange, bg, icon }: {
	label: string; items: [string, string][]; value: string; onChange: (k: string) => void; bg?: (k: string) => VNode; icon?: string;
}) {
	const i = Math.max(0, items.findIndex(x => x[0] === value));
	const go = (d: number) => onChange(items[(i + d + items.length) % items.length][0]);
	return <div class={'win pick-panel' + (bg ? ' has-bg' : '')}>
		{bg && <div class="pick-bg">{bg(items[i][0])}</div>}
		<button class="pick-arrow" aria-label={label + ' 이전'} onClick={() => go(-1)}><i class="tri l" /></button>
		<div class="pick-mid">
			<span class="ap-label">{label}</span>
			<b class="ap-name">{icon && <span class="ap-icon">{icon}</span>}{items[i][1]}</b>
		</div>
		<button class="pick-arrow" aria-label={label + ' 다음'} onClick={() => go(1)}><i class="tri r" /></button>
	</div>;
}

/** 테라스탈 보석 결 필터 (타입별 하나씩, 배틀 화면에 한 번 넣음): 삼각 면 무늬 + 타입 색을 그림 모양(알파)대로 잘라 반투명하게 겹침 */
/** 반짝임 띠: 계단식 대각선 흰 띠 (가운데 진하게) — 그림 위를 왼쪽 위에서 오른쪽 아래로 지나감 */
const TERA_SHINE = 'data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='40' height='120' shape-rendering='crispEdges'><polygon points='16,0 20,0 4,120 0,120' fill='white' fill-opacity='.4'/><polygon points='20,0 26,0 10,120 4,120' fill='white' fill-opacity='.9'/><polygon points='26,0 29,0 13,120 10,120' fill='white' fill-opacity='.4'/><polygon points='33,0 35,0 19,120 17,120' fill='white' fill-opacity='.55'/></svg>");
/** 반짝이는 점(✦): 결정 면 위에 작은 별이 번갈아 깜박임 */
const TERA_SPARK = 'data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' shape-rendering='crispEdges'><g fill='white'><rect x='5' y='3' width='1' height='5'/><rect x='3' y='5' width='5' height='1'/><rect x='20' y='18' width='1' height='3'/><rect x='19' y='19' width='3' height='1'/></g></svg>");
const TERA_FACET = 'data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' shape-rendering='crispEdges'><polygon points='0,0 8,0 0,8' fill='white' fill-opacity='.7'/><polygon points='8,0 16,0 16,8 8,8' fill='white' fill-opacity='.25'/><polygon points='0,8 8,8 0,16' fill='white' fill-opacity='.45'/><polygon points='16,8 16,16 8,16' fill='white' fill-opacity='.6'/></svg>");
export function TeraFilters() {
	return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
		<defs>{glowFilter('dmax-glow', '#ff2a40', 4, 4, '.18;.5;.18', '1.6s', true)}
		{Object.entries({ ...TYPE_COLOR, Stellar: '#2b3a96' }).map(([t, c]) => <filter id={'tera-' + t} x="-0.2" y="-0.2" width="1.4" height="1.4" color-interpolation-filters="sRGB">
			{glowRings(c, 1, 2, '.2;.45;.2', '2.4s')}
			<feImage href={TERA_FACET} x="0" y="0" width="16" height="16" result="t" />
			<feTile in="t" result="pat" />
			<feFlood flood-color={c} result="col" />
			<feBlend in="pat" in2="col" mode="screen" result="tex" />
			<feComposite in="tex" in2="SourceAlpha" operator="in" result="cut" />
			<feComponentTransfer in="cut" result="half"><feFuncA type="linear" slope="0.38" /></feComponentTransfer>
			{/* 빛나는 띠가 2.4초마다 그림 위를 대각선으로 훑고 지나감 (그림 모양대로 잘림) */}
			<feImage href={TERA_SHINE} y="-12" width="40" height="120" result="sh"><animate attributeName="x" values="-50;-50;-40;-30;-20;-10;0;10;20;30;40;50;60;70;80" keyTimes="0;0.450;0.489;0.529;0.568;0.607;0.646;0.686;0.725;0.764;0.804;0.843;0.882;0.921;0.961" dur="2.4s" repeatCount="indefinite" calcMode="discrete" /></feImage>
			<feComposite in="sh" in2="SourceAlpha" operator="in" result="shine" />
			{/* 반짝이는 별: 그림 모양 안에서 깜박임 */}
			<feImage href={TERA_SPARK} x="0" y="0" width="28" height="28" result="sp0" />
			<feTile in="sp0" result="spt" />
			<feComposite in="spt" in2="SourceAlpha" operator="in" result="sp1" />
			<feComponentTransfer in="sp1" result="spark"><feFuncA type="linear" slope="0"><animate attributeName="slope" values="0;0;.9;0;0;.6;0" dur="1.8s" repeatCount="indefinite" calcMode="discrete" /></feFuncA></feComponentTransfer>
			<feMerge><feMergeNode in="ring2" /><feMergeNode in="ring1" /><feMergeNode in="SourceGraphic" /><feMergeNode in="half" /><feMergeNode in="shine" /><feMergeNode in="spark" /></feMerge>
		</filter>)}</defs>
	</svg>;
}

/** 바깥 빛: 그림 테두리를 r1·r2 칸 넓힌 두 겹 띠(흐림 없이 계단식), 진하기가 values 대로 천천히 점멸 */
function glowRings(color: string, r1: number, r2: number, values: string, dur: string) {
	return <>
		<feMorphology in="SourceAlpha" operator="dilate" radius={r1} result="d1" />
		<feMorphology in="SourceAlpha" operator="dilate" radius={r2} result="d2" />
		<feFlood flood-color={color} result="gc" />
		<feComposite in="gc" in2="d1" operator="in" result="g1" />
		<feComposite in="g1" in2="SourceAlpha" operator="out" result="g1o" />
		<feComposite in="gc" in2="d2" operator="in" result="g2" />
		<feComposite in="g2" in2="d1" operator="out" result="g2o" />
		<feComponentTransfer in="g1o" result="ring1"><feFuncA type="linear" slope=".4"><animate attributeName="slope" values={values.split(';').map(v => String(+v * 1.4)).join(';')} dur={dur} repeatCount="indefinite" /></feFuncA></feComponentTransfer>
		<feComponentTransfer in="g2o" result="ring2"><feFuncA type="linear" slope=".2"><animate attributeName="slope" values={values} dur={dur} repeatCount="indefinite" /></feFuncA></feComponentTransfer>
	</>;
}
/** single: 바깥 빛 한 줄만 (다이맥스) */
function glowFilter(id: string, color: string, r1: number, r2: number, values: string, dur: string, single: boolean) {
	return <filter id={id} x="-0.25" y="-0.25" width="1.5" height="1.5" color-interpolation-filters="sRGB">
		{glowRings(color, r1, r2, values, dur)}
		<feMerge>{!single && <feMergeNode in="ring2" />}<feMergeNode in="ring1" /><feMergeNode in="SourceGraphic" /></feMerge>
	</filter>;
}
