/** 시나리오 모드 (개발자 빌드) — 관동 편 · 이슬 루트
 *  틀: 「유희왕 태그 포스」식 — 시리즈(지방)를 고르고, 지도를 자유롭게 돌아다니며(이동하면 시간이 흐름: 아침·낮·저녁·밤) 길거리 트레이너와 배틀,
 *      인물을 찾아가 이야기·선물로 호감도(하트 4개)를 올리고, 태그를 맺어 멀티배틀. 하트가 찰 때마다 그 인물의 이야기(하트 이벤트)가 열림.
 *  본가에서 가져온 것: 처음 포켓몬·라이벌전, 풀숲의 야생 포켓몬과 볼로 잡기, 경험치·레벨업·진화·레벨업 기술, 배지와 레벨 상한,
 *      프렌들리숍·지닌 도구, 체육관(관문 트레이너 → 관장), 눈앞이 캄캄해짐(지면 가까운 포켓몬센터로), 밤에 달라지는 포켓몬.
 *  데이터: scenario-data.ts · 배경: scripts/gen-fields.py · 초상화: portraits-ai 브랜치(Pages /portraits/)
 *  저장: localStorage <접두사>scenario-kanto2 */
import { h, Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ask, Screen, Sprite, PokeIcon, TypeBadge, ItemIcon, toast, confirmBox } from './ui/core';
import { battle, playerName, playerSprite, BACK } from './modes';
import { load, save, remove } from './store';
import { speciesData, speciesKo, moveKo } from './data';
import { SPRITE_URL, trainerImgError } from './trainer-lines';
import { playMusic, sfx, cry } from './sound';
import type { PSet } from './sets';
import LEVELUP from './gen/levelup.json';
import { learnset } from './data';
import { TIMES, TIME_CLS, WHO, LOCS, locOf, TRAINERS, WILDS, ITEMS, SHOPS, STARTERS, RIVAL_OF, LV_CAP, expNeed,
	FOLKS, CHARS, charOf, likeOf, wildBonus, MAX_EV, TAG_NEED, catchRate, type Who, type Trainer, type Char, type Item } from './scenario-data';
import { SCRIPTS } from './scenario-script';
import * as EM from './scenario-emotes.js';
import { PXI } from './vendor/pixelarticons';
import FACES from './gen/scn-faces.json';

const LU = LEVELUP as unknown as { [id: string]: { e?: [string, number]; m: [number, string][] } };
const PORTRAIT_BASE = 'https://samang600.github.io/BattleSim-KR/portraits/';
/** 외부 저장소에서 가져온 배경·아이콘 (scenario-assets 브랜치 → Pages /scn/). 없으면 직접 그린 그림으로 대신함 */
const SCN_BASE = 'https://samang600.github.io/BattleSim-KR/scn/';
const KEY = 'scenario-kanto2';
const NO_GIMMICK = '_one.natdex.yes.yes';
const won = (n: number) => n.toLocaleString('ko-KR') + '원';
let seq = 0;
/** 연달아 같은 종류의 화면을 띄워도 상태(글자 수·타이머)가 새로 시작하게 하는 key */
const K = () => 'k' + (++seq);
const josa = (w: string, a: string, b: string) => { const c = w.charCodeAt(w.length - 1); return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b); };

// ───────── 저장 ─────────
interface Mon { sp: string; lv: number; exp: number; item?: string; moves?: string[]; /** 남은 체력 비율 (없으면 가득, 0 = 기절) · 기술별 남은 PP (없으면 가득) · 기술머신으로 배운 기술 */ hpf?: number; pp?: { [move: string]: number }; tm?: string[]; /** 기술은 이 레벨까지만 (첫 라이벌전) */ mlv?: number }
interface Rel { /** 호감도 0~400 (하트 하나 = 100) */ heart: number; /** 끝낸 하트 이벤트 수 */ ev: number; /** 마지막으로 이야기한 날 · 그날 이야기한 횟수 · 먼저 말을 걸어 온 날 */ talked: number; n?: number; greet?: number }
interface Run {
	v: 3; starter: string; party: Mon[]; box: Mon[]; money: number; bag: { [id: string]: number };
	loc: string; town: string; day: number; time: number; /** 이번 시간대에 쓴 행동 수 (AP 가 차면 다음 시간대로) */ ap?: number; flags: { [k: string]: number }; beaten: { [id: string]: number };
	/** 인물별 사이 (이슬·웅·리프) · 지금 태그 중인 인물 id ('' = 없음) */
	rel: { [id: string]: Rel }; tag: string; badges: string[];
}
/** 한 시간대에 할 수 있는 행동 수: 배틀·이야기·선물 = 1, 이동 = 지나는 길 한 칸마다 1 */
const AP = 4;
const newRun = (): Run => ({ v: 3, starter: '', party: [], box: [], money: 0, bag: {}, loc: 'pallet', town: 'pallet', day: 1, time: 0, flags: {}, beaten: {}, rel: {}, tag: '', badges: [] });
/** 예전 저장(v2: 이슬만) → 인물별 */
function migrate(o: any): Run | null {
	if (!o) return null;
	if (o.v === 3) return o;
	if (o.v !== 2) return null;
	const { heart, ev, talked, tag, ...rest } = o;
	return { ...rest, v: 3, rel: { misty: { heart: heart || 0, ev: ev || 0, talked: talked || 0 } }, tag: tag ? 'misty' : '' };
}
const relOf = (r: Run, id: string): Rel => r.rel[id] || (r.rel[id] = { heart: 0, ev: 0, talked: 0 });
/** 인물의 표식 이름: 이슬은 예전 그대로 inv1·ev1, 다른 인물은 brock_inv1 … (대본 id 도 같음) */
const fk = (c: Char, kind: 'inv' | 'ev', k: number) => c.id === 'misty' ? kind + k : `${c.id}_${kind}${k}`;
const metChars = (r: Run) => CHARS.filter(c => !!r.flags[c.met]);
/** 처음 포켓몬 셋 중 나도 그린도 고르지 않은 것 (리프의 포켓몬) */
const thirdOf = (r: Run) => ['bulbasaur', 'charmander', 'squirtle'].find(x => x !== r.starter && x !== RIVAL_OF[r.starter]) || 'eevee';
const persist = (r: Run) => save(KEY, r);
const has = (r: Run, f?: string) => !f || !!r.flags[f];
const lvCap = (r: Run) => LV_CAP[Math.min(r.badges.length, LV_CAP.length - 1)];
/** 그 인물의 하트 이벤트 수 */
const maxEv = (c: Char) => c.max ?? MAX_EV;
const heartCap = (r: Run, c: Char) => !r.flags[c.gate] ? 40 : Math.min(100 * maxEv(c), 100 * (relOf(r, c.id).ev + 1));
const give = (r: Run, id: string, n = 1) => { r.bag[id] = (r.bag[id] || 0) + n; if (r.bag[id] <= 0) delete r.bag[id]; };
const unlocked = (r: Run, id: string) => id === 'mtmoon' ? has(r, 'badge1') : id === 'cerulean' ? has(r, 'rocket1') : id === 'bridge' ? has(r, 'inv1') : id === 'cape' ? has(r, 'ev2') : id === 'route5' || id === 'vermilion' ? has(r, 'badge2') : id === 'ssanne' || id === 'diglett' ? has(r, 'verm') : id === 'rocktunnel' || id === 'lavender' ? has(r, 'badge3') : id === 'tower' ? has(r, 'lav') : id === 'route7' || id === 'celadon' ? has(r, 'tower') : true;
const LOCK_WHY: { [id: string]: string } = { mtmoon: '회색배지가 있어야 지나갈 수 있어요', cerulean: '달맞이산의 로켓단이 길을 막고 있어요', bridge: '아직 갈 일이 없는 곳이에요', cape: '아직 갈 일이 없는 곳이에요', route5: '블루배지가 있어야 지나갈 수 있어요', vermilion: '블루배지가 있어야 갈 수 있어요', ssanne: '갈색시티에 먼저 가 보세요', diglett: '갈색시티에 먼저 가 보세요', rocktunnel: '오렌지배지가 있어야 지나갈 수 있어요', lavender: '오렌지배지가 있어야 갈 수 있어요', tower: '보라타운에 먼저 가 보세요', route7: '포켓몬타워의 소동이 끝나야 지하통로가 열려요', celadon: '포켓몬타워의 소동이 끝나야 갈 수 있어요' };
/** 이동에 드는 행동 칸: 길 한 칸마다 1, 자전거가 있으면 절반(올림) */
const moveCost = (r: Run, hops: number) => has(r, 'bike') ? Math.ceil(hops / 2) : hops;
/** 인물이 지금 있는 곳 (못 가는 곳이면 그 인물의 본거지) */
const charLoc = (r: Run, c: Char) => { const l = c.at[r.time]; return unlocked(r, l) ? l : c.home; };
/** 다음 하트 이벤트를 시작할 수 있는가 (하트가 다 차고 필요한 표식이 있음) */
const evReady = (r: Run, c: Char) => { const x = relOf(r, c.id); return !!r.flags[c.gate] && x.ev < maxEv(c) && x.heart >= 100 * (x.ev + 1) && has(r, c.evNeed?.[x.ev]); };

// ───────── 포켓몬 ─────────
const learned = (sp: string, lv: number) => [...new Set((LU[sp]?.m || []).filter(m => m[0] <= lv).map(m => m[1]))];
/** 그 포켓몬이 쓸 수 있는 기술 전부 (레벨업 + 기술머신) */
const known = (m: Mon) => [...new Set([...learned(m.sp, m.mlv ?? m.lv), ...(m.tm || [])])];
/** 최대 HP (노력치 0·개체값 31 기준) · 살아 있는가 · 전부 회복 */
const maxHp = (m: Mon) => Math.floor((2 * ((speciesData(m.sp, 9) as any)?.bs?.[0] || 50) + 31) * m.lv / 100) + m.lv + 10;
const alive = (m: Mon) => m.hpf === undefined || m.hpf > 0;
const healAll = (r: Run) => { for (const m of [...r.party, ...r.box]) { delete m.hpf; delete m.pp; } };
/** 회복 도구를 쓸 수 있는가 / 씀 (배틀 밖) */
const canMed = (m: Mon, fx: NonNullable<Item['fx']>) => fx.revive ? !alive(m) : alive(m) && (fx.heal ? m.hpf !== undefined && m.hpf < 1 : !!m.pp);
const useMed = (m: Mon, fx: NonNullable<Item['fx']>) => { if (fx.revive) m.hpf = 0.5; else if (fx.heal) { m.hpf = Math.min(1, (m.hpf ?? 1) + fx.heal / maxHp(m)); if (m.hpf >= 0.999) delete m.hpf; } else if (fx.pp && m.pp) { for (const k of Object.keys(m.pp)) m.pp[k] += fx.pp; } };
const movesOf = (m: Mon) => { const all = known(m); const mine = (m.moves || []).filter(x => all.includes(x)); return mine.length ? mine : all.slice(-4); };
function toSet(m: Mon): PSet {
	const s = speciesData(m.sp, 9) as any, moves = movesOf(m);
	return { name: '', species: s?.en || m.sp, item: m.item ? ITEMS[m.item]?.held || '' : '', ability: s?.ab?.[0] || '', moves: moves.length ? moves : ['tackle'], nature: 'serious',
		evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: m.lv };
}
const mk = (t: [string, number][]): Mon[] => t.map(([sp, lv]) => ({ sp, lv, exp: 0 }));
/** 그 레벨이면 어디까지 진화했을지 (라이벌의 처음 포켓몬) */
const evoAt = (sp: string, lv: number) => { for (let e = LU[sp]?.e; e && lv >= e[1]; e = LU[sp]?.e) sp = e[0]; return sp; };
/** 경험치를 주고 레벨업·진화·새 기술을 처리 → 안내 줄 */
function addExp(m: Mon, xp: number, cap: number): string[] {
	const out: string[] = [], before = m.lv, old = learned(m.sp, m.lv);
	if (m.lv >= cap) { m.exp = 0; return out; }
	m.exp += xp;
	while (m.lv < cap && m.exp >= expNeed(m.lv)) { m.exp -= expNeed(m.lv); m.lv++; }
	if (m.lv >= cap) m.exp = 0;
	if (m.lv === before) return out;
	out.push(`${speciesKo(m.sp)} Lv${before} → Lv${m.lv}`);
	for (let e = LU[m.sp]?.e; e && m.lv >= e[1]; e = LU[m.sp]?.e) { out.push(`✨ ${josa(speciesKo(m.sp), '은', '는')} ${josa(speciesKo(e[0]), '으로', '로')} 진화했다!`); m.sp = e[0]; }
	const fresh = learned(m.sp, m.lv).filter(x => !old.includes(x));
	if (fresh.length) {
		if (m.moves) for (const f of fresh) { if (m.moves.length < 4) m.moves.push(f); }
		out.push(`${speciesKo(m.sp)}: 새 기술 ${fresh.map(moveKo).join(' · ')}${m.moves && m.moves.length >= 4 && !fresh.every(f => m.moves!.includes(f)) ? ' (파티 화면에서 바꿔 넣을 수 있어요)' : ''}`);
	}
	return out;
}

// ───────── 공용 화면 조각 ─────────
/** 지금 있는 곳의 풍경 (가방·파티·가게·결과 같은 안쪽 화면의 바탕으로 깔아 여행 중이라는 느낌이 끊기지 않게) */
const SCENE = { bg: 'pallet', tint: 0 };
const Back = () => <div class="sc-backdrop"><div class={'sc-bg fld-' + SCENE.bg} /><div class={'sc-tint ' + TIME_CLS[SCENE.tint]} /></div>;
/** 표정 그림(<초상 id>_<감정>.png)이 있는지 — 한 번만 알아봄. 있으면 그 그림, 없으면 기본 그림 */
const VARIANT: { [k: string]: boolean | undefined } = {};
function useVariant(id: string, emo?: string): string {
	const key = emo && id && !id.startsWith('d_') ? `${id}_${emo}` : '';
	const [, tick] = useState(0);
	useEffect(() => {
		if (!key || VARIANT[key] !== undefined) return;
		const im = new Image();
		im.onload = () => { VARIANT[key] = true; tick(x => x + 1); }; im.onerror = () => { VARIANT[key] = false; };
		im.src = `${PORTRAIT_BASE}${key}.png`;
	}, [key]);
	return key && VARIANT[key] ? key : id;
}
/** 픽셀 아이콘 (pixelarticons, 24칸 격자) — 크기는 2px 격자에 맞게 24·36·48 */
const Pxi = ({ name, size = 24 }: { name: string; size?: number }) => <svg class="sc-pxi" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shape-rendering="crispEdges"><path d={PXI[name] || ''} /></svg>;
/** 도트 그림 (격자 한 글자 = 한 칸): CSS 로 흉내 낸 동그라미·그라데이션 대신 픽셀로 그린 것. Px 로 그리거나 pxUrl 로 배경 무늬에 씀 */
const ART: { [k: string]: [string[], { [c: string]: string }] } = {
	ball: [['....kkkk....', '..kkRRRRkk..', '.kRhRRRRRRk.', '.kRhRRRRRRk.', 'kRRRRRRRRRRk', 'kRRRRkkRRRRk', 'kkkkkWWkkkkk', 'kWWWWkkWWWWk', '.kWWWWWWWWk.', '.kWWWWWWggk.', '..kkWWggkk..', '....kkkk....'],
		{ k: '#14182a', R: '#e8402c', h: '#ff9a8a', W: '#f4f4f4', g: '#c0c4d0' }],
	greatball: [['....kkkk....', '..kkBBBBkk..', '.kBrBBBBrBk.', '.kBrBBBBrBk.', 'kBBBBBBBBBBk', 'kBBBBkkBBBBk', 'kkkkkWWkkkkk', 'kWWWWkkWWWWk', '.kWWWWWWWWk.', '.kWWWWWWggk.', '..kkWWggkk..', '....kkkk....'],
		{ k: '#14182a', B: '#3a7ad8', r: '#e8402c', W: '#f4f4f4', g: '#c0c4d0' }],
	ultraball: [['....kkkk....', '..kkyKKykk..', '.kKyyKKyyKk.', '.kKyKKKKyKk.', 'kKKKKKKKKKKk', 'kKKKKkkKKKKk', 'kkkkkWWkkkkk', 'kWWWWkkWWWWk', '.kWWWWWWWWk.', '.kWWWWWWggk.', '..kkWWggkk..', '....kkkk....'],
		{ k: '#14182a', K: '#3a3a48', y: '#ffd84a', W: '#f4f4f4', g: '#c0c4d0' }],
	potion: [['....kkkk..', '....kWWk..', '...kkWWkk.', '..kPPPPPPk', '..kPhPPPPk', '..kPhPPPPk', '..kPPPPPPk', '..kPPPPPPk', '..kkkkkkkk'], { k: '#14182a', W: '#f4f4f4', P: '#b070e8', h: '#e0c0ff' }],
	tm: [['...kkkk...', '.kkYYYYkk.', '.kYYhhYYk.', 'kYYhYYYYYk', 'kYYYkkYYYk', 'kYYYkkYYYk', 'kYYYYYYYYk', '.kYYYYYYk.', '.kkYYYYkk.', '...kkkk...'], { k: '#14182a', Y: '#f0a030', h: '#ffe0a0' }],
	shadow: [['...ssssssssss...', '.ssssssssssssss.', '.ssssssssssssss.', '...ssssssssss...'], { s: 'rgba(0,0,0,.42)' }],
	star: [['...y...', '...y...', '.yyyyy.', 'yyyWyyy', '.yyyyy.', '...y...', '...y...'], { y: '#ffe070', W: '#ffffff' }],
	heart: [['.kk...kk.', 'kPPk.kPPk', 'kPhPkPPPk', 'kPPPPPPPk', '.kPPPPPk.', '..kPPPk..', '...kPk...', '....k....'], { k: '#5a0a2a', P: '#ff5a8a', h: '#ffc0d4' }],
	heart0: [['.kk...kk.', 'kPPk.kPPk', 'kPPPkPPPk', 'kPPPPPPPk', '.kPPPPPk.', '..kPPPk..', '...kPk...', '....k....'], { k: '#0a0f18', P: '#2a3350' }],
	coin: [['...kkkk...', '.kkYYYYkk.', '.kYhYYYYk.', 'kYhYYkYYYk', 'kYYYkkYYYk', 'kYYYYkYYYk', 'kYYYYkYYdk', '.kYYkkkdk.', '.kkYYYdkk.', '...kkkk...'], { k: '#5a3a08', Y: '#ffd84a', h: '#fff4b0', d: '#c89420' }],
	gift: [['..kk..kk..', '.kRRkkRRk.', '..kRRRRk..', 'kkkkRRkkkk', 'kWWWRRWWWk', 'kkkkRRkkkk', '.kBBRRBBk.', '.kBBRRBBk.', '.kBBRRBBk.', '.kkkkkkkk.'], { k: '#14182a', R: '#e8402c', W: '#f4f4f4', B: '#3a8ad8' }],
	// 탁자 (가로로 이어 붙이는 무늬): 윗면 밝은 줄 · 옆면 · 아래 그림자
	table: [['LLLLLLLL', 'LLLLLLLL', 'MMMMMMMd', 'MMMMMMMd', 'MMMMMMMd', 'kkkkkkkk', 'DDDDDDDD', 'DDDDDDDk', 'DDDDDDDD'], { L: '#d8aa6a', M: '#b8843e', d: '#9a6a2a', D: '#7a5424', k: '#2a1a08' }],
	// 밤하늘 (타일): 한 칸짜리 별 몇 개
	sky: [['........................', '....w...................', '..............b.........', '........................', '.....................w..', '........................', '.........b..............', '........................', '..w.....................', '................w.......', '........................', '......................b.',
		'........................', '.......w................', '........................', '...b..............w.....', '........................', '............b...........', '........................', '.w......................', '....................b...', '........................', '..........w.............', '........................'], { w: '#ffffff', b: '#a8c0ff' }],
};
const artRects = (g: string[], pal: { [c: string]: string }) => g.flatMap((row, y) => [...row].map((c, x) => pal[c] ? `<rect x='${x}' y='${y}' width='1' height='1' fill='${pal[c]}'/>` : '')).join('');
/** 도트 그림 하나. scale = 한 칸의 px (2의 배수) */
function Px({ art, scale = 2, cls = '' }: { art: string; scale?: number; cls?: string }) {
	const [g, pal] = ART[art], w = Math.max(...g.map(r => r.length));
	return <svg class={'sc-px px-' + art + ' ' + cls} width={w * scale} height={g.length * scale} viewBox={`0 0 ${w} ${g.length}`} shape-rendering="crispEdges">
		{g.flatMap((row, y) => [...row].map((c, x) => pal[c] ? <rect x={x} y={y} width="1" height="1" fill={pal[c]} /> : null))}</svg>;
}
/** 도트 그림을 배경 무늬(url)로 */
const pxUrl = (art: string) => { const [g, pal] = ART[art], w = Math.max(...g.map(r => r.length)); return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${g.length}' shape-rendering='crispEdges'>${artRects(g, pal)}</svg>`)}")`; };
/** 지도 위 말: 데포르메 도트 얼굴 (한 칸 = 2px). me = 빨간 모자의 나 · misty = 주황 머리의 이슬 */
const CHIBI: { [k: string]: [string[], { [c: string]: string }] } = {
	me: [['...kkkkk...', '..kRRRRRk..', '.kRRWWRRRk.', '.kRRRRRRRkk', 'kkkkkkkkkkk', '.kSSSSSSSk.', '.kSkSSSkSk.', '.kSSSSSSSk.', '..kSSpSSk..', '..kkkkkkk..', '.kBBBWBBBk.', '.kBBBBBBBk.', '..kkk.kkk..'],
		{ k: '#14182a', R: '#e8402c', W: '#f4f4f4', S: '#ffd8b0', p: '#e8907a', B: '#3a6ad8' }],
	misty: [['.....kkk..kk', '...kkOOOkkOk', '..kOOOOOOOOk', '.kOOOOOOOOk.', '.kOSSOOSSOk.', '.kSkSSSkSSk.', '.kSSSSSSSSk.', '..kSSppSSk..', '...kkkkkk...', '..kYYYYYYk..', '.kSYrYYrYSk.', '..kkYYYYkk..', '...kk..kk...'],
		{ k: '#14182a', O: '#ff9a3a', S: '#ffd8b0', p: '#e8907a', Y: '#ffe070', r: '#d84a3a' }],
	brock: [['..k.k.k.k...', '.kHkHkHkHk..', '.kHHHHHHHk..', '.kHHHHHHHk..', '.kTTTTTTTk..', '.kTkkTkkTk..', '.kTTTTTTTk..', '..kTTppTk...', '...kkkkk....', '..kGGGGGk...', '.kTGOOOGTk..', '..kkGGGkk...', '...kk.kk....'],
		{ k: '#14182a', H: '#6a4a2a', T: '#d8a878', p: '#b87a5a', G: '#5a7a3a', O: '#e88a3a' }],
	erika: [['...kkkkkk...', '..kHHHHHHk..', '.kHRRRRRRHk.', '.kHHHHHHHHk.', '.kHSSSSSSHk.', '.kHSkSSkSHk.', '.kHSSSSSSHk.', '..kSSppSSk..', '...kkkkkk...', '..kGGYYGGk..', '.kGGGYYGGGk.', '..kkRRRRkk..', '...kk..kk...'],
		{ k: '#14182a', H: '#2a2a3a', R: '#e8402c', S: '#ffd8b0', p: '#e8907a', G: '#6aa84a', Y: '#ffe070' }],
	leaf: [['...kkkkkk...', '..kWWWWWWk..', '.kWWRRWWWWk.', '.kkkkkkkkkk.', '.kBSSSSSSBk.', 'kBBSkSSkSBBk', 'kBBSSSSSSBBk', 'kBkSSppSSkBk', '.k.kkkkkk.k.', '..kCCCCCCk..', '.kSCCCCCCSk.', '..kkRRRRkk..', '...kk..kk...'],
		{ k: '#14182a', W: '#f4f4f4', R: '#e8402c', B: '#8a5a2a', S: '#ffd8b0', p: '#e8907a', C: '#5ab8e8' }],
};
function Chibi({ who, cls = '' }: { who: string; cls?: string }) {
	const [g, pal] = CHIBI[who] || CHIBI.me, w = Math.max(...g.map(r => r.length));
	return <svg class={'sc-chibi ' + cls} width={w * 2} height={g.length * 2} viewBox={`0 0 ${w} ${g.length}`} shape-rendering="crispEdges">
		{g.flatMap((row, y) => [...row].map((c, x) => pal[c] ? <rect x={x} y={y} width="1" height="1" fill={pal[c]} /> : null))}</svg>;
}
/** 초상화: 픽셀 상반신(없으면 쇼다운 도트). face = 동그란 아이콘용. emo = 표정(그림이 있으면 바뀜) */
function Portrait({ id, sprite, cls = '', emo, fb }: { id: string; sprite: string; cls?: string; emo?: string; /** 도트 그림이 없을 때 대신 보일 것 (없으면 아무것도 안 나옴) */ fb?: any }) {
	const [bad, setBad] = useState(false), [noDot, setNoDot] = useState(false);
	if (id.startsWith('d_')) {
		if (!sprite || noDot) return fb || null;
		// 도트 그림마다 머리·발 위치가 달라서 재 둔 값(gen/scn-faces.json: [머리 가로 중심, 위, 아래])으로 맞춤:
		// 얼굴 칸은 머리가 틀 가운데 위쪽에, 큰 그림은 발이 대화창에 닿게
		const f = (FACES as unknown as { [k: string]: number[] })[sprite] || [40, 4, 78];
		const st = cls.includes('face') ? { transform: `translate(${Math.round((40 - f[0]) * 1.5)}px, ${Math.round(18 - f[1] * 1.5)}px)` } : { marginBottom: -(80 - f[2]) * 6 - 16 + 'px' };
		return <img class={'sc-portrait dot ' + cls} style={st} src={SPRITE_URL(sprite)} onError={() => setNoDot(true)} alt="" />;
	}
	const src = useVariant(id, emo);
	if (!id || bad) return sprite ? <img class={'sc-portrait dot ' + cls} src={SPRITE_URL(sprite)} onError={trainerImgError} alt="" /> : null;
	return <img class={'sc-portrait px ' + (id.startsWith('d_') ? 'dotp ' : '') + cls} src={`${PORTRAIT_BASE}${src}.png`} onError={() => setBad(true)} alt="" />;
}
/** 도구·배지 아이콘 (PokeAPI sprites). 못 불러오면 fb(직접 그린 것)로 */
function Ico({ name, size = 32, fb }: { name: string; size?: number; fb?: any }) {
	const [bad, setBad] = useState(false);
	if (bad) return fb || null;
	return <img class="sc-pico" style={{ width: size, height: size }} src={`${SCN_BASE}ico/${name}.png`} onError={() => setBad(true)} alt="" />;
}
const itemIco = (id: string, size: number) => { const it = ITEMS[id]; if (it.pxi) return <span class="sc-item-pxi"><Pxi name={it.pxi} size={size >= 48 ? 48 : 24} /></span>; return <Ico name={it.icon} size={size} fb={it.held ? <ItemIcon item={it.held} size={Math.min(size, 32)} /> : <Px art={it.kind === 'ball' ? (ART[id] ? id : 'ball') : it.kind === 'sell' ? 'coin' : it.kind === 'med' ? 'potion' : it.kind === 'tm' ? 'tm' : 'gift'} scale={2} />} />; };
const BADGE_ICO: { [k: string]: string } = { 회색배지: 'badge1', 블루배지: 'badge2', 오렌지배지: 'badge3', 무지개배지: 'badge4' };
const tWho = (t: Trainer): Who => ({ name: t.name, title: t.title, portrait: 'd_' + t.sprite, sprite: t.sprite });
const Hearts = ({ v, big, n = MAX_EV }: { v: number; big?: boolean; n?: number }) => <span class={'sc-hearts' + (big ? ' big' : '')}>{Array.from({ length: n }, (_, i) => i).map(i => <i class="sc-heart"><Px art="heart0" scale={big ? 4 : 2} /><b style={{ width: Math.max(0, Math.min(100, v - i * 100)) + '%' }}><Px art="heart" scale={big ? 4 : 2} /></b></i>)}</span>;

type Line = [who: string | Who | null, text: string, emo?: string];
/** 지난 대사 (기록 보기) · 자동 넘김 설정 */
const LOG: { name: string; text: string }[] = [];
let autoOn = (() => { try { return localStorage.getItem('pkbkr-sc-auto') === '1'; } catch { return false; } })();
/** 감정 이모티콘: pixelfx 로 그린 움직이는 얼굴 (scenario-emotes.js) — 캔버스에 50ms 한 칸씩 */
function Emote({ kind }: { kind: string }) {
	const ref = useRef<HTMLCanvasElement>(null);
	const mod = EM.EMOTES[kind];
	useEffect(() => {
		const cv = ref.current, ctx = cv?.getContext('2d');
		if (!mod || !cv || !ctx) return;
		const [w, h] = mod.meta.size, [ox, oy] = mod.meta.origin;
		const fx = EM.createFx(mod, { x: ox, y: oy }), frame = EM.createFrame(w, h), img = ctx.createImageData(w, h);
		const tick = () => { fx.update(0.05); EM.clearFrame(frame); fx.draw(frame); EM.composite(frame, img.data, null); ctx.putImageData(img, 0, 0); };
		tick();
		const id = setInterval(tick, 50);
		return () => clearInterval(id);
	}, [kind]);
	if (!mod) return null;
	return <canvas ref={ref} class="sc-emo" width={mod.meta.size[0]} height={mod.meta.size[1]} />;
}
/** 대화 장면: 배경(시간대 색) + 큰 초상(감정 기호·움직임) + 이름 띠 + 대화창(한 글자씩). who 가 null 이면 해설
 *  위 단추: 기록(지난 대사) · 자동(다 나오면 알아서 넘김) · 건너뛰기 */
function Dialog({ lines, bg, tint, done, choice, mon }: { lines: Line[]; bg: string; tint: number; done: (i: number) => void; choice?: string[]; /** 장면에 서 있는 야생 포켓몬 */ mon?: string }) {
	const [i, setI] = useState(0), [n, setN] = useState(0), [log, setLog] = useState(false), [auto, setAuto] = useState(autoOn);
	const [who, text, emo] = lines[i], w = typeof who === 'string' ? WHO[who] : who, full = n >= text.length, last = i + 1 >= lines.length;
	useEffect(() => { setN(0); LOG.push({ name: w?.name || '', text }); if (LOG.length > 200) LOG.shift(); }, [i]);
	useEffect(() => { if (full) return; const t = setTimeout(() => setN(x => Math.min(text.length, x + 2)), 28); return () => clearTimeout(t); }, [n, i]);
	const next = () => { if (!full) { setN(text.length); return; } if (!last) { sfx('select'); setI(i + 1); } else if (!choice) done(0); };
	useEffect(() => { if (!auto || !full || log || (last && choice)) return; const t = setTimeout(next, 900 + text.length * 55); return () => clearTimeout(t); }, [auto, full, i, log]);
	const stop = (f: () => void) => (e: Event) => { e.stopPropagation(); f(); };
	useEffect(() => { if (mon) cry(mon); }, []);
	const dark = bg === 'black' || bg === 'space';
	return <div class={'story-talk sc-talk' + (w ? '' : ' narr') + (dark ? ' black' : '') + (mon ? ' wild' : '')} onClick={next}>
		<div class={'st-bg sc-bg fld-' + (dark ? 'black' : bg)} /><div class={'sc-tint ' + TIME_CLS[tint]} />
		{bg === 'space' && <><div class="sc-stars full" style={{ backgroundImage: pxUrl('sky') }} /><div class="sc-stars full far" style={{ backgroundImage: pxUrl('sky') }} /></>}
		{mon && <div class="sc-wildmon"><Px art="shadow" scale={10} cls="sc-wildgrass" /><Sprite species={mon} gen={9} size={192} anim={false} /></div>}
		{w && <div class="st-portrait sc-stp" key={w.name}>
			<div class={'sc-act' + (emo ? ' mv-' + emo : '')} key={i}><Portrait id={w.portrait} sprite={w.sprite} cls="big" emo={emo} /></div>
			{emo && <Emote kind={emo} key={'e' + i} />}
		</div>}
		<div class="st-box">
			{w && <div class="st-name"><span>{w.name}{w.title && <small> {w.title}</small>}</span><i class="st-deco" /></div>}
			<div class="st-text">{text.slice(0, n)}{full && !(last && choice) && <span class="st-arrow">▼</span>}</div>
		</div>
		{last && full && choice && <div class="sc-choice" onClick={e => e.stopPropagation()}>{choice.map((c, k) => <button onClick={() => { sfx('select'); done(k); }}>{c}</button>)}</div>}
		<div class="sc-talkbtns">
			<button onClick={stop(() => setLog(true))}><Pxi name="notes" size={12} />기록</button>
			<button class={auto ? 'on' : ''} onClick={stop(() => { autoOn = !auto; try { localStorage.setItem('pkbkr-sc-auto', autoOn ? '1' : '0'); } catch {} setAuto(autoOn); })}>자동{auto ? ' ●' : ''}</button>
		</div>
		{!choice && <button class="st-skip" onClick={stop(() => done(0))}>건너뛰기<Pxi name="forward" size={12} /></button>}
		{log && <div class="sc-log" onClick={stop(() => setLog(false))}>
			<h3>지난 대사 <small>화면을 누르면 닫힘</small></h3>
			<div class="sc-log-list" ref={(el: any) => { if (el) el.scrollTop = el.scrollHeight; }}>{LOG.map(l => <p class={l.name ? '' : 'narr'}>{l.name && <b>{l.name}</b>}{l.text}</p>)}</div>
		</div>}
	</div>;
}
/** 화면 전환·카드: fade(검게) · iris(동그랗게 닫힘) · blinds(가로 띠) · battle(번쩍 + 빗금) · card(제목 카드) */
function Fx({ kind, bg, tint, title, sub, small, ms, done }: { kind: string; bg: string; tint: number; title?: string; sub?: string; small?: string; ms: number; done: () => void }) {
	useEffect(() => { const t = setTimeout(done, ms); return () => clearTimeout(t); }, []);
	return <div class={'sc-fx sc-fx-' + kind} onClick={() => kind === 'card' && done()}>
		<div class={'sc-bg fld-' + bg} /><div class={'sc-tint ' + TIME_CLS[tint]} />
		<div class="sc-fx-ov">{kind === 'blinds' && [0, 1, 2, 3, 4, 5, 6, 7].map(i => <i style={{ animationDelay: i * 40 + 'ms' }} />)}{kind === 'battle' && [0, 1, 2, 3, 4, 5].map(i => <i style={{ animationDelay: 260 + i * 50 + 'ms' }} />)}</div>
		{title && <div class="sc-card"><small>{small}</small><b>{title}</b><em>{sub}</em></div>}
	</div>;
}

// ───────── 진행 도우미 (run 을 잡고 있는 묶음) ─────────
function engine(run: Run) {
	const L = () => locOf(run.loc);
	const say = (lines: Line[], bg = L().bg, mon?: string) => lines.length ? ask<number>(r => <Dialog key={K()} lines={lines} bg={bg} tint={bg === 'black' || bg === 'space' || bg === 'lab' || bg === 'pool' ? 1 : run.time} done={r} mon={mon} />) : Promise.resolve(0);
	const choose = (who: string | Who | null, text: string, opts: string[], bg = L().bg, mon?: string) => ask<number>(r => <Dialog key={K()} lines={[[who, text]]} bg={bg} tint={run.time} done={r} choice={opts} mon={mon} />);
	const fx = (kind: string, ms = 700, bg = L().bg) => ask<void>(r => <Fx key={K()} kind={kind} bg={bg} tint={run.time} ms={ms} done={r} />);
	const card = (title: string, sub: string, small = '', bg = 'black', ms = 2400) => ask<void>(r => <Fx key={K()} kind="card" bg={bg} tint={1} title={title} sub={sub} small={small} ms={ms} done={r} />);
	const got = async (id: string, n = 1) => { give(run, id, n); persist(run); sfx('select'); await ask<void>(r => <GetCard key={K()} icon={ITEMS[id].icon} pxi={ITEMS[id].pxi} title={`${ITEMS[id].name}${n > 1 ? ` ×${n}` : ''}`} sub={ITEMS[id].desc} done={r} />); };
	const pay = async (n: number) => { run.money += n; persist(run); await ask<void>(r => <GetCard key={K()} title={won(n)} sub="상금을 받았다!" coin done={r} />); };
	/** 호감도 올리기(상한까지) → 하트 연출 */
	const heart = async (id: string, n: number) => {
		const c = charOf(id), x = relOf(run, id), before = x.heart;
		x.heart = Math.max(0, Math.min(heartCap(run, c), x.heart + n)); persist(run);
		if (x.heart === before) return;
		await ask<void>(r => <HeartCard key={K()} c={c} from={before} to={x.heart} done={r} />);
	};
	/** 시간을 한 칸 보냄. 밤이 지나면 다음 날 아침 (날짜 카드) */
	const tick = async (toMorning = false) => {
		run.ap = 0;
		if (toMorning || run.time === 3) { run.day++; run.time = 0; persist(run); await card(`${run.day}일째`, '아침이 밝았다', '관동 편', 'black', 1500); }
		else { run.time++; persist(run); }
	};
	/** 행동 n 번만큼 시간을 씀. AP 번을 채우면 다음 시간대로 넘어감 */
	const spend = async (n = 1) => {
		let ap = (run.ap || 0) + n, moved = false;
		while (ap >= AP) { ap -= AP; await tick(); moved = true; }
		run.ap = ap; persist(run);
		if (moved && run.time !== 0) toast(`어느덧 ${josa(TIMES[run.time], '이', '가')} 되었다`);
	};
	/** 배틀 (전환 연출 포함). tag = 그 인물과 멀티배틀: 내 앞 3마리 + 파트너 3마리. wild = 야생(기권 대신 도망) → 도망쳤으면 'fled' */
	const fight = async (o: { name: string; title?: string; sprite: string; sprite2?: string; team: Mon[]; skill: number; arena?: string; music?: string; tag?: string; line?: string; wild?: boolean }): Promise<boolean | 'fled'> => {
		if (!run.party.some(alive)) { await say([[null, '싸울 수 있는 포켓몬이 없다…!\n포켓몬센터나 집에서 회복시키자.']]); return false; }
		// 기절한 포켓몬은 뒤로 (맨 앞은 싸울 수 있는 포켓몬). owner = 배틀 팀 순서대로 내 포켓몬(파트너 것은 null)
		const order = [...run.party.filter(alive), ...run.party.filter(m => !alive(m))], mineMons = o.tag ? order.slice(0, 3) : order;
		const mine = mineMons.map(toSet);
		let team = mine, flags: boolean[] | null = null, owner: (Mon | null)[] = mineMons;
		if (o.tag) {
			const pc = charOf(o.tag);
			const hers = mk(pc.team(relOf(run, pc.id).ev, thirdOf(run)).map(([sp, lv]) => [evoAt(sp, lv), lv] as [string, number])).map(toSet); team = []; flags = []; owner = [];
			for (let i = 0; i < Math.max(mine.length, hers.length); i++) { if (mine[i]) { team.push(mine[i]); flags.push(false); owner.push(mineMons[i]); } if (hers[i]) { team.push(hers[i]); flags.push(true); owner.push(null); } }
		}
		await fx('battle', 900);
		const res = await battle({
			gen: 9, doubles: !!o.tag, aiSkill: o.skill, bg: (o.arena || L().arena) as any, music: (o.music || 'battle') as any, label: `시나리오 · ${L().name}`, noRecord: true, ruleId: NO_GIMMICK,
			p1: { name: playerName(), team, sprite: playerSprite() },
			p2: { name: o.name, title: o.title || '', team: o.team.map(toSet), sprite: o.sprite, sprite2: o.sprite2, line: o.line },
			partner: flags ? { name: charOf(o.tag!).name, theirs: flags, skill: 0.75, sprite: charOf(o.tag!).sprite } : undefined, runAway: !!o.wild,
			// 지난 배틀에서 남은 HP·PP 로 시작하고, 끝난 상태를 다시 받아 둠. 배틀 중에는 가방의 회복 도구를 쓸 수 있음
			story: {
				state: owner.map(m => m ? { hp: m.hpf, pp: m.pp } : undefined),
				onFinal: (st: { hp: number; pp: { [k: string]: number } }[]) => { owner.forEach((m, i) => { if (!m || !st[i]) return; if (st[i].hp >= 0.999) delete m.hpf; else m.hpf = st[i].hp; m.pp = st[i].pp; }); persist(run); },
				bag: () => Object.keys(run.bag).filter(id => ITEMS[id]?.kind === 'med').map(id => ({ id, name: ITEMS[id].name, desc: ITEMS[id].desc, n: run.bag[id], fx: ITEMS[id].fx! })),
				used: (id: string) => { give(run, id, -1); persist(run); },
			},
		} as any);
		playMusic(L().music);
		return !res.win && o.wild && res.forfeit ? 'fled' : res.win;
	};
	/** 이긴 뒤: 경험치(파티 전원)·상금 → 결과 화면 */
	const reward = async (foes: Mon[], heading: string, money: number, wild = false) => {
		const xp = Math.round(foes.reduce((a, f) => a + f.lv, 0) * (wild ? 2.5 : 4)), cap = lvCap(run), notes: string[] = [];
		for (const m of run.party) notes.push(...addExp(m, xp, cap));
		run.money += money; persist(run);
		await ask<void>(r => <Result key={K()} heading={heading} xp={xp} money={money} notes={notes} party={run.party} cap={cap} done={r} />);
	};
	/** 눈앞이 캄캄해짐: 가까운 포켓몬센터(집)로, 돈 10% 잃음 */
	const blackout = async () => {
		const lost = Math.floor(run.money / 10); run.money -= lost; run.loc = run.town; run.tag = ''; healAll(run);
		const t = locOf(run.town);
		await say([[null, `${playerName()}의 포켓몬은 모두 쓰러졌다…\n눈앞이 캄캄해졌다!`], [null, `${t.name}의 ${josa(t.rest || '포켓몬센터', '으로', '로')} 서둘러 돌아갔다.${lost ? `\n(허둥대다 ${josa(won(lost), '을', '를')} 떨어뜨렸다)` : ''}`]], 'black');
		await tick();
	};
	return { L, say, choose, fx, card, got, pay, heart, tick, spend, fight, reward, blackout };
}
type Eng = ReturnType<typeof engine>;

/** 대본(scenario-script.ts)을 읽어 나감. 배틀에서 지면 거기서 멈추고 false */
const fill = (run: Run, t: string) => t.replace(/\{me\}/g, playerName()).replace(/\{starter\}/g, run.starter ? speciesKo(run.starter) : '').replace(/\{leaf\}/g, speciesKo(thirdOf(run)));
const toLine = (run: Run, t: string): Line => { const m = /^([a-z0-9]*)(?:\[(\w+)\])?: ([\s\S]*)$/.exec(t); return m ? [m[1] || null, fill(run, m[3]), m[2]] : [null, fill(run, t)]; };
async function play(run: Run, E: Eng, id: string): Promise<boolean> {
	let bg: string | null = null, buf: Line[] = [];
	const cid = id.startsWith('leaf') ? 'leaf' : CHARS.find(c => id === c.id || id.startsWith(c.id + '_'))?.id || 'misty';   // 이 대본의 인물 (태그 파트너·호감도)
	const at = () => bg || E.L().bg;
	const flush = async () => { if (buf.length) { const b = buf; buf = []; await E.say(b, at()); } };
	for (const c of SCRIPTS[id] || []) {
		if (typeof c === 'string') { buf.push(toLine(run, c)); continue; }
		await flush();
		if ('bg' in c) bg = c.bg;
		else if ('card' in c) await E.card(c.card[1], c.card[2], c.card[0], c.card[3] || 'black');
		else if ('fight' in c) {
			const team = mk(c.fight.team.map(([sp, lv]) => [sp === '{rival}' ? evoAt(RIVAL_OF[run.starter] || 'eevee', lv) : sp === '{leaf}' ? evoAt(thirdOf(run), lv) : sp, lv] as [string, number]));
			if (!(await E.fight({ ...c.fight, team, tag: c.fight.tag ? cid : undefined }))) { await E.say([toLine(run, c.lose)], at()); healAll(run); persist(run); return false; }   // 이야기 속 승부에서 지면 회복시켜 주고 다시 도전
			await E.reward(team, c.win, c.money);
		}
		else if ('got' in c) await E.got(c.got, c.n || 1);
		else if ('pay' in c) { run.money += c.pay; persist(run); await ask<void>(r => <GetCard key={K()} title={won(c.pay)} sub={c.sub} coin done={r} />); }
		else if ('heart' in c) await E.heart(cid, c.heart);
		else if ('badge' in c) { run.flags[c.flag] = 1; run.badges.push(c.badge); persist(run); await ask<void>(r => <GetCard key={K()} icon={c.icon} title={c.badge} sub={c.sub} done={r} />); }
		else if ('flag' in c) { run.flags[c.flag] = 1; persist(run); }
		else if ('toast' in c) toast(c.toast);
		else if ('music' in c) playMusic(c.music);
	}
	await flush();
	return true;
}
/** 시계: 날짜·시간대 + 이번 시간대에 남은 행동 칸. onClick 이 있으면 누를 수 있음(시간 보내기) */
function Clock({ run, onClick }: { run: Run; onClick?: () => void }) {
	const body = <><Pxi name={run.time === 3 ? 'moon' : 'sun'} /><span><small>{run.day}일째</small><b>{TIMES[run.time]}</b><span class="sc-ap">{Array.from({ length: AP }, (_, i) => <i class={i < (run.ap || 0) ? 'used' : ''} />)}</span></span></>;
	return onClick ? <button class={'sc-clock ' + TIME_CLS[run.time]} onClick={onClick} aria-label="시간 보내기">{body}</button> : <div class={'sc-clock ' + TIME_CLS[run.time]}>{body}</div>;
}
/** 지도 위 이동 연출 (웨스노스의 여정 지도처럼): 길을 따라 점선이 그어지고 내 트레이너가 한 곳씩 옮겨 감 */
function routeBetween(run: Run, a: string, b: string): string[] {
	const prev: { [id: string]: string } = { [a]: '' }, q = [a];
	while (q.length) { const x = q.shift()!; if (x === b) break; for (const y of locOf(x).to) if (!(y in prev) && unlocked(run, y)) { prev[y] = x; q.push(y); } }
	const out: string[] = []; for (let x = b; x; x = prev[x]) out.unshift(x);
	return out[0] === a ? out : [a, b];
}
function Travel({ run, to, done }: { run: Run; to: string; done: () => void }) {
	const path = routeBetween(run, run.loc, to).map(locOf);
	const [k, setK] = useState(0);
	useEffect(() => { const t = setTimeout(() => k + 1 < path.length ? setK(k + 1) : done(), k + 1 < path.length ? 430 : 420); return () => clearTimeout(t); }, [k]);
	return <div class="sc-mapscr sc-travel" onClick={done}>
		<div class="sh-top sc-top"><div class="sh-title">{locOf(run.loc).name} → {locOf(to).name}<em class="sc-mission">이동 중…</em></div>
			<Clock run={run} /></div>
		<div class="sc-mapwrap"><div class="sc-map">
			<svg class="sc-roads" viewBox="0 0 100 100" preserveAspectRatio="none">
				{LOCS.flatMap(a => a.to.filter(b => a.id < b).map(b => { const B = locOf(b); return <line x1={a.x} y1={a.y} x2={B.x} y2={B.y} class="off" />; }))}
				{path.slice(0, k).map((a, i) => <line x1={a.x} y1={a.y} x2={path[i + 1].x} y2={path[i + 1].y} class="go" />)}
			</svg>
			{LOCS.map(l => <span class={'sc-node' + (l.town ? ' town' : '') + (l.id === to ? ' sel' : '') + (unlocked(run, l.id) ? '' : ' lock')} style={{ left: l.x + '%', top: l.y + '%' }}><i />{l.id === to && <span>{l.name}</span>}</span>)}
			<span class="sc-travel-me" style={{ left: path[k].x + '%', top: path[k].y + '%' }}><Chibi who="me" /></span>
		</div></div>
		{/* 지도 고르기 화면과 같은 높이의 아래 창 (없으면 이동할 때 지도 크기가 달라져 보임) */}
		<div class="sc-mapinfo">
			<div class={'sc-mapthumb sc-bg fld-' + locOf(to).bg}><div class={'sc-tint ' + TIME_CLS[run.time]} /></div>
			<div class="sc-mapdesc"><b>{locOf(to).name}</b><small>{locOf(to).sub}</small><small class="sc-maptags"><span>이동 중…</span></small></div>
		</div>
	</div>;
}

function GetCard({ title, sub, icon, coin, pxi, done }: { title: string; sub: string; icon?: string; coin?: boolean; pxi?: string; done: () => void }) {
	return <div class="sc-get" onClick={done}><div class="sc-get-box">
		<span class="sc-get-ico">{coin ? <Ico name="coin-case" size={56} fb={<Px art="coin" scale={4} />} /> : pxi ? <span class="sc-item-pxi"><Pxi name={pxi} size={48} /></span> : icon ? <Ico name={icon} size={56} fb={<Px art="gift" scale={4} />} /> : <Px art="gift" scale={4} />}</span>
		<b>{josa(title, '을', '를')} 손에 넣었다!</b><small>{sub}</small><em>화면을 누르면 계속</em>
	</div></div>;
}
function HeartCard({ c, from, to, done }: { c: Char; from: number; to: number; done: () => void }) {
	const [v, setV] = useState(from);
	useEffect(() => { const t = setTimeout(() => setV(to), 250); return () => clearTimeout(t); }, []);
	const up = Math.floor(to / 100) > Math.floor(from / 100), down = to < from, w = WHO[c.who];
	return <div class="sc-get sc-heartcard" onClick={done}><div class="sc-get-box">
		<span class="sc-hc-face"><Portrait id={w.portrait} sprite={w.sprite} cls="face" /></span>
		<Hearts v={v} big n={maxEv(c)} />
		<b>{down ? `${c.name}의 표정이 굳었다…` : up ? `${josa(c.name, '과', '와')}의 사이가 깊어졌다!` : `${josa(c.name, '과', '와')} 조금 더 가까워졌다`}</b>
		<small>{down ? `호감도 ${to - from}` : `호감도 +${to - from}`}{up && to < 100 * maxEv(c) ? ` · ${c.name}에게 말을 걸어 보자` : ''}</small>
		{!down && <i class="sc-hc-float">♥</i>}<em>화면을 누르면 계속</em>
	</div></div>;
}
function Result({ heading, xp, money, notes, party, cap, done }: { heading: string; xp: number; money: number; notes: string[]; party: Mon[]; cap: number; done: () => void }) {
	useEffect(() => { if (notes.some(l => / → Lv/.test(l))) { const t = setTimeout(() => sfx(notes.some(l => l.startsWith('✨')) ? 'heal' : 'statUp'), 250); return () => clearTimeout(t); } }, []);
	return <Screen title="배틀 결과" cls="sc-scr"><Back />
		<div class="sc-result"><h2>{heading}</h2>
			<p class="sc-res-row"><span>경험치</span><b>+{xp}</b>{money > 0 && <><span>상금</span><b>{won(money)}</b></>}</p>
			<div class="sc-res-party">{party.map(m => <div class="sc-res-mon"><PokeIcon species={m.sp} /><span>Lv{m.lv}</span><i class="sc-xp"><b style={{ width: (m.lv >= cap ? 100 : Math.round(100 * m.exp / expNeed(m.lv))) + '%' }} /></i></div>)}</div>
			{notes.map((l, i) => <p class={'sc-res-note ' + (l.startsWith('✨') ? 'evo' : / → Lv/.test(l) ? 'lv' : 'mv')} style={{ animationDelay: 200 + i * 140 + 'ms' }}>{/ → Lv/.test(l) && <i>LEVEL UP</i>}{l}</p>)}
			{party.some(m => m.lv >= cap) && <p class="muted small">레벨 상한 Lv{cap} — 다음 배지를 얻으면 더 올릴 수 있어요.</p>}
		</div>
		<button class="btn big primary" onClick={done}>확인</button>
	</Screen>;
}

// ───────── 거점 화면 ─────────
type Node = { k: string; label: string; mark: string; face?: Who; kind?: string; done?: boolean; data?: any };
type Act = Node | { k: 'map' | 'party' | 'bag' | 'route' | 'box' | 'wait' } | typeof BACK;
/** 그린이 기다리는 곳: [대본 id, 장소, 필요한 표식] */
const RIVAL_AT: [string, string, string][] = [['rival2', 'viridian', 'intro'], ['rival3', 'cerulean', 'met'], ['rival4', 'cape', 'ev4']];
/** 큰 줄거리 (체육관·사건): [대본 id, 장소, 필요한 표식, 끝난 표식, 단추 이름, 얼굴] */
const STORY_AT: [string, string, string, string, string, string][] = [['anne', 'ssanne', 'sa2', 'anne', '선장실', 'captain'], ['surge', 'vermilion', 'vg1', 'badge3', '마티스', 'surge'], ['tower', 'tower', 'tw2', 'tower', '꼭대기 층', 'fuji'], ['erika', 'celadon', 'cg2', 'badge4', '민화', 'erika']];
/** 단추 귀퉁이 표시: 느낌표(승부·이야기) · 물음표(풀숲) · 하트 · 완료 · 가게 · 쉼터 · 이야기 */
const MARK_ICO: { [m: string]: string } = { '✓': 'check', '♥': 'heart', '★': 'star', '✦': 'sparkle', '₩': 'coins', z: 'bed', '…': 'message-text' };
const MARK_CLS: { [m: string]: string } = { '!': 'go', '?': 'q', '✓': 'ok', '♥': 'love', '★': 'star', '✦': 'spark', '₩': 'shop', z: 'rest', '…': 'talk' };
const SLOTS: [number, number][] = [[24, 30], [72, 28], [48, 38], [20, 46], [76, 46], [48, 54], [22, 62], [70, 62], [48, 22], [80, 76]];
/** 휴대폰 가로: 높이가 낮아 두 줄로 (오른쪽은 내 트레이너 자리) */
const SLOTS_LAND: [number, number][] = [[8, 36], [22, 36], [36, 36], [50, 36], [64, 36], [8, 66], [22, 66], [36, 66], [50, 66], [64, 66]];
const isLand = () => innerWidth > innerHeight && innerHeight < 541;
function nodesAt(run: Run): Node[] {
	const loc = locOf(run.loc), out: Node[] = [];
	// 이야기 (하트 이벤트 · 체육관)
	if (run.loc === 'pewter' && has(run, 'p1') && !has(run, 'badge1')) out.push({ k: 'brock', label: '웅', mark: '!', face: WHO.brock, kind: 'story' });
	if (run.loc === 'cerulean' && has(run, 'c2') && !has(run, 'badge2')) out.push({ k: 'gym', label: '이슬', mark: '!', face: WHO.misty, kind: 'story' });
	for (const [id, at, need, end, label, who] of STORY_AT) if (at === run.loc && has(run, need) && !has(run, end)) out.push({ k: 'script', label, mark: '!', face: WHO[who], kind: 'story', data: id });
	for (const c of metChars(run)) {
		const x = relOf(run, c.id), inv = run.flags[fk(c, 'inv', x.ev + 1)], at = c.evAt[x.ev], w = WHO[c.who];
		if (inv && at && at[0] === run.loc && (at[1] === null || at[1] === run.time)) out.push({ k: 'event', label: c.name, mark: '✦', face: w, kind: 'story g-' + c.g, data: c });
		else if ((run.tag === c.id || charLoc(run, c) === run.loc) && !(c.id === 'misty' && run.loc === 'cerulean' && !has(run, 'badge2') && has(run, 'c2')))
			out.push({ k: 'friend', label: c.name, mark: evReady(run, c) && !inv ? '!' : '★', face: w, kind: 'friend g-' + c.g, data: c });
	}
	// 라이벌 그린: 상록시티(여행 초반) · 블루시티(이슬을 만난 뒤) · 블루곶(이슬 루트를 끝낸 뒤)
	const rv = RIVAL_AT.find(([id, at, need]) => at === run.loc && has(run, need) && !has(run, id));
	if (rv) out.push({ k: 'script', label: '그린', mark: '!', face: WHO.rival, kind: 'story', data: rv[0] });
	for (const t of TRAINERS) {
		if (t.loc !== run.loc || t.id === 'brock' || !has(run, t.need) || (t.at && !t.at.includes(run.time))) continue;
		const done = t.once ? !!run.flags[t.id] : run.beaten[t.id] === run.day;
		if (t.once && done && !t.again) continue;
		out.push({ k: 'trainer', label: t.name, mark: done ? '✓' : '!', face: tWho(t), done, data: t });
	}
	if (WILDS.some(w => w.loc === run.loc)) { const w = WILDS.find(x => x.loc === run.loc)!; const pool = run.time === 3 && w.night ? w.night : w.pool, b = wildBonus(w, run.badges.length);
		out.push({ k: 'wild', label: `${w.name} Lv${Math.min(...pool.map(x => x[1])) + b}~${Math.max(...pool.map(x => x[2])) + b}`, mark: '?', kind: 'grass', data: pool[0][0] }); }
	if (run.loc === 'pallet') out.push({ k: 'oak', label: '오박사 연구소', mark: '…', face: WHO.oak });
	if (run.loc === 'mtmoon' && !has(run, 'karp')) out.push({ k: 'karp', label: '수상한 아저씨', mark: '₩', face: WHO.salesman });
	if (run.loc === 'vermilion') out.push({ k: 'club', label: '애호가 클럽', mark: has(run, 'voucher') ? '…' : '!', face: WHO.chairman });
	if (run.loc === 'cerulean') out.push({ k: 'bike', label: '자전거 가게', mark: '…', kind: 'bike' });
	if (SHOPS[run.loc]) out.push({ k: 'shop', label: SHOPS[run.loc].name.split(' · ')[0], mark: '₩', face: WHO.clerk });
	const folk = FOLKS.find(f => f.loc === run.loc && has(run, f.need));
	if (folk) out.push({ k: 'folk', label: folk.who.name, mark: folk.gift && !has(run, 'folk-' + folk.loc) ? '!' : '…', face: folk.who, data: folk });
	if (loc.rest) out.push({ k: 'rest', label: loc.rest, mark: 'z', face: run.loc === 'pallet' ? undefined : WHO.joy, kind: run.loc === 'pallet' ? 'house' : '' });   // ('home' 은 메인 화면이 쓰는 클래스라 단추가 화면 밖으로 밀려났음)
	return out;
}
function Hub({ run, banner, done }: { run: Run; banner: boolean; done: (a: Act) => void }) {
	const loc = locOf(run.loc), nodes = nodesAt(run);
	SCENE.bg = loc.bg; SCENE.tint = run.time;
	// 위 띠의 하트: 태그 중인 인물, 아니면 여기 있는 인물, 아니면 가장 가까운 인물
	const mc = metChars(run), focus = mc.find(c => c.id === run.tag) || mc.find(c => charLoc(run, c) === run.loc) || [...mc].sort((a, b) => relOf(run, b.id).heart - relOf(run, a.id).heart)[0];
	const [land, setLand] = useState(isLand());
	useEffect(() => { playMusic(loc.music); const f = () => setLand(isLand()); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
	const SL = land ? SLOTS_LAND : SLOTS;
	return <div class={'story-hub sc-hub' + (banner ? ' sc-open' : '')}>
		<div class={'sh-bg sc-bg fld-' + loc.bg} /><div class={'sc-tint ' + TIME_CLS[run.time]} />
		{run.time === 3 && <div class="sc-stars" style={{ backgroundImage: pxUrl('sky') }} />}
		<div class="sh-top sc-top">
			<button class="st-exit" onClick={async () => { if (await confirmBox('시나리오 나가기', '메인 화면으로 돌아갈까요?\n지금까지의 진행은 저장돼 있어요.', '나가기', '계속하기')) done(BACK); }} aria-label="나가기"><Pxi name="chevron-left" /></button>
			<Clock run={run} onClick={() => done({ k: 'wait' })} />
			<div class="sh-title">관동 · {loc.name}<em class="sc-mission">{goalText(run)}</em></div>
			<div class="sc-wallet"><span>{won(run.money)}</span>{focus && <span class="sc-wallet-h"><small>{focus.name}</small><span class="sc-hearts sc-hmini"><Px art="heart" scale={2} /><b>{Math.floor(relOf(run, focus.id).heart / 100)}/{maxEv(focus)}</b></span></span>}</div>
		</div>
		{banner && <div class="sc-banner"><b>{loc.name}</b><span>{loc.sub}</span></div>}
		{nodes.slice(0, SLOTS.length).map((n, i) => <button class={'sh-npc' + (n.done ? ' done' : '') + (n.kind ? ' ' + n.kind : '')} style={{ left: SL[i][0] + '%', top: SL[i][1] + '%' }} onClick={() => { sfx('select'); done(n); }}>
			<span class="sh-face">{n.face ? <Portrait id={n.face.portrait} sprite={n.face.sprite} cls="face" fb={<Pxi name={n.k === 'shop' ? 'store' : n.k === 'rest' ? 'bed' : 'user'} size={48} />} /> : n.kind === 'grass' ? <span class="sc-wildico"><Pxi name="tree" size={48} /><PokeIcon species={n.data} /></span> : <Pxi name={n.kind === 'bike' ? 'store' : 'home'} size={48} />}</span>
			<span class={'sh-mark m-' + MARK_CLS[n.mark]}>{MARK_ICO[n.mark] ? <Pxi name={MARK_ICO[n.mark]} size={12} /> : n.mark}</span><span class="sh-label">{n.label}</span>
		</button>)}
		<div class="sh-me sc-me2" role="button" onClick={() => done({ k: 'party' })}>
			{run.tag && <img class="sc-partner" src={SPRITE_URL(charOf(run.tag).sprite)} alt="" onError={trainerImgError} />}
			<img src={SPRITE_URL(playerSprite())} alt="" onError={trainerImgError} />
			<div class="sh-me-bar"><b>{playerName()}{run.tag && <small class="sc-tagchip"> ＆ {charOf(run.tag).name}</small>}</b><small class="sc-badgerow">배지 {run.badges.length} · 상한 Lv{lvCap(run)}</small>
				<span class="sc-party2">{run.party.map(m => <span class={'sc-pmon' + (!alive(m) ? ' fnt' : (m.hpf ?? 1) < 0.5 ? ' hurt' : '')}><PokeIcon species={m.sp} /><small>Lv{m.lv}</small></span>)}</span></div>
		</div>
		<div class="sc-tabs2 sc-menu">
			<button class="map" onClick={() => done({ k: 'map' })}><Pxi name="map" />지도</button>
			<button class="mon" onClick={() => done({ k: 'box' })}><Px art="ball" scale={2} />박스</button>
			<button class="bag" onClick={() => done({ k: 'bag' })}><Pxi name="backpack" />가방</button>
			<button class="love" onClick={() => done({ k: 'route' })}><Pxi name="heart" />루트</button>
		</div>
	</div>;
}
/** 지금 할 일 한 줄 */
function goalText(run: Run): string {
	if (!has(run, 'badge1')) return has(run, 'p1') ? '회색 체육관 관장 웅에게 도전하자' : '북쪽 회색시티의 체육관을 목표로';
	if (!has(run, 'rocket1')) return '달맞이산을 넘어 블루시티로';
	if (!has(run, 'met')) return '블루시티로 가 보자';
	if (!has(run, 'badge2')) return '블루 체육관 관장 이슬에게 도전하자';
	const mc = metChars(run);
	for (const c of mc) { const x = relOf(run, c.id), at = c.evAt[x.ev]; if (x.ev < maxEv(c) && run.flags[fk(c, 'inv', x.ev + 1)]) return `${at[1] === null ? '' : TIMES[at[1]] + '에 '}${locOf(at[0]).name}에서 ${josa(c.name, '이', '가')} 기다리고 있다`; }
	const rdy = mc.find(c => evReady(run, c));
	if (rdy) return `하트가 가득 찼다 — ${rdy.name}에게 말을 걸자`;
	if (!has(run, 'verm')) return '남쪽 5번도로를 지나 갈색시티로';
	if (!has(run, 'anne')) return '갈색 항구의 상트앙느호에 올라 보자';
	if (!has(run, 'badge3')) return '갈색 체육관 관장 마티스에게 도전하자';
	if (!has(run, 'lav')) return '블루시티 동쪽 돌산터널을 지나 보라타운으로';
	if (!has(run, 'tower')) return '포켓몬타워 꼭대기의 등나무 노인을 구하자';
	if (!has(run, 'cel')) return '보라타운 서쪽 7번도로를 지나 무지개시티로';
	if (!has(run, 'badge4')) return '무지개 체육관 관장 민화에게 도전하자';
	const open = mc.filter(c => relOf(run, c.id).ev < maxEv(c));
	if (!open.length) return '지금까지의 이야기를 모두 봤어요 — 다음 막은 준비 중';
	const c = open.find(x => x.id === run.tag) || open[0];
	return `${josa(c.name, '과', '와')} 가까워지자 (${TIMES[run.time]}: ${locOf(charLoc(run, c)).name})`;
}

/** 월드맵: 갈 곳 고르기 (지나는 길 한 칸마다 행동 1) */
function WorldMap({ run, done }: { run: Run; done: (id: string | null) => void }) {
	/** 만난 인물이 지금 있는 곳 (태그 중이면 나와 함께) */
	const where = metChars(run).map(c => [c, run.tag === c.id ? run.loc : charLoc(run, c)] as [Char, string]);
	const [sel, setSel] = useState(run.loc);
	const s = locOf(sel), open = unlocked(run, sel);
	/** 가는 길의 칸 수 = 드는 행동 수, 도착했을 때의 시간대 */
	const hops = open && sel !== run.loc ? moveCost(run, routeBetween(run, run.loc, sel).length - 1) : 0, pass = Math.floor(((run.ap || 0) + hops) / AP), arrive = (run.time + pass) % 4;
	return <div class="sc-mapscr sc-open">
		<div class="sh-top sc-top"><button class="st-exit" onClick={() => done(null)} aria-label="닫기"><Pxi name="chevron-left" /></button><div class="sh-title">관동 지방<em class="sc-mission">갈 곳을 고르세요</em></div>
			<Clock run={run} /></div>
		<div class="sc-mapwrap"><div class="sc-map">
			<svg class="sc-roads" viewBox="0 0 100 100" preserveAspectRatio="none">{LOCS.flatMap(a => a.to.filter(b => a.id < b).map(b => { const B = locOf(b); return <line x1={a.x} y1={a.y} x2={B.x} y2={B.y} class={unlocked(run, a.id) && unlocked(run, b) ? '' : 'off'} />; }))}</svg>
			{LOCS.map(l => <button class={'sc-node' + (l.town ? ' town' : '') + (l.id === run.loc ? ' here' : '') + (l.id === sel ? ' sel' : '') + (unlocked(run, l.id) ? '' : ' lock')} style={{ left: l.x + '%', top: l.y + '%' }} onClick={() => { sfx('select'); setSel(l.id); }}>
				<i />{l.id === run.loc && <Chibi who="me" cls="sc-node-me" />}
				{where.filter(([, at]) => at === l.id).map(([c], i) => <Chibi who={c.id} cls={'sc-node-friend f' + i} />)}
				<span>{unlocked(run, l.id) ? l.name : '？？？'}</span>
			</button>)}
		</div></div>
		<div class="sc-mapinfo">
			<div class={'sc-mapthumb sc-bg fld-' + (open ? s.bg : 'black')}><div class={'sc-tint ' + TIME_CLS[run.time]} /></div>
			<div class="sc-mapdesc"><b>{open ? s.name : '？？？'}</b><small>{open ? s.sub : LOCK_WHY[sel]}</small>
				{open && <small class="sc-maptags">{hops > 0 && <span class="t">{has(run, 'bike') ? '자전거 · ' : ''}행동 {hops}칸{pass > 0 ? ` · 도착하면 ${run.time + pass > 3 ? '다음 날 ' : ''}${TIMES[arrive]}` : ''}</span>}{WILDS.some(w => w.loc === sel) && <span>풀숲</span>}{SHOPS[sel] && <span>가게</span>}{s.rest && <span>쉼터</span>}{where.filter(([, at]) => at === sel).map(([c]) => <span class="h">♥ {c.name}</span>)}</small>}</div>
			<button class="btn primary" disabled={!open || sel === run.loc} onClick={() => done(sel)}>{sel === run.loc ? '지금 있는 곳' : '이동'}</button>
		</div>
	</div>;
}

// ───────── 파티·가방·가게·루트 ─────────
function MonEdit({ run, m, done }: { run: Run; m: Mon; done: () => void }) {
	const [, tick] = useState(0), re = () => { persist(run); tick(x => x + 1); };
	const all = known(m), cur = movesOf(m), s = speciesData(m.sp, 9) as any;
	const held = Object.keys(run.bag).filter(id => ITEMS[id]?.kind === 'held');
	const toggle = (mv: string) => { const c = [...cur]; const i = c.indexOf(mv); if (i >= 0) { if (c.length > 1) c.splice(i, 1); } else if (c.length < 4) c.push(mv); else { toast('기술은 4개까지예요. 먼저 하나를 빼 주세요'); return; } m.moves = c; re(); };
	return <Screen title={speciesKo(m.sp)} onBack={done} cls="sc-scr"><Back />
		<div class="sc-mon big"><Sprite species={m.sp} gen={9} size={96} anim={false} />
			<div class="sc-mon-body"><b>{speciesKo(m.sp)} <small>Lv{m.lv}</small></b><span class="sc-types">{(s?.t || []).map((t: string) => <TypeBadge type={t} />)}</span>
				<i class="sc-xp wide"><b style={{ width: (m.lv >= lvCap(run) ? 100 : Math.round(100 * m.exp / expNeed(m.lv))) + '%' }} /></i>
				<small>{m.lv >= lvCap(run) ? `레벨 상한 (Lv${lvCap(run)})` : `다음 레벨까지 ${expNeed(m.lv) - m.exp}`}{LU[m.sp]?.e ? ` · Lv${LU[m.sp].e![1]}에 ${josa(speciesKo(LU[m.sp].e![0]), '으로', '로')} 진화` : ''}</small></div></div>
		<h3 class="sec">기술 <small class="muted">{cur.length}/4 · 눌러서 넣고 빼기</small></h3>
		<div class="sc-moves">{all.map(mv => <button class={cur.includes(mv) ? 'on' : ''} onClick={() => toggle(mv)}>{moveKo(mv)}</button>)}</div>
		<h3 class="sec">지닌 도구</h3>
		<div class="sc-moves">
			<button class={!m.item ? 'on' : ''} onClick={() => { if (m.item) { give(run, m.item); m.item = undefined; re(); } }}>없음</button>
			{m.item && <button class="on"><ItemIcon item={ITEMS[m.item].held!} size={20} /> {ITEMS[m.item].name}</button>}
			{held.map(id => <button onClick={() => { if (m.item) give(run, m.item); m.item = id; give(run, id, -1); re(); }}><ItemIcon item={ITEMS[id].held!} size={20} /> {ITEMS[id].name} ×{run.bag[id]}</button>)}
		</div>
		{!held.length && !m.item && <p class="muted small">지닐 수 있는 도구는 프렌들리숍에서 살 수 있어요.</p>}
		<button class="btn big" onClick={done}>돌아가기</button>
	</Screen>;
}
function MonCard({ m, children, onClick }: { m: Mon; children?: any; onClick?: () => void }) {
	const s = speciesData(m.sp, 9) as any;
	return <div class="sc-mon">
		<span onClick={onClick}><Sprite species={m.sp} gen={9} size={64} anim={false} /></span>
		<div class="sc-mon-body" onClick={onClick}><b>{speciesKo(m.sp)} <small>Lv{m.lv}</small>{m.item && <ItemIcon item={ITEMS[m.item].held!} size={18} />}</b>
			<span class="sc-types">{(s?.t || []).map((t: string) => <TypeBadge type={t} />)}</span>
			<HpLine m={m} />
			<small>{movesOf(m).map(moveKo).join(' · ')}</small></div>
		<div class="sc-mon-btns">{children}</div>
	</div>;
}
function PartyScreen({ run, done }: { run: Run; done: () => void }) {
	const [, tick] = useState(0), [edit, setEdit] = useState<Mon | null>(null);
	const re = () => { persist(run); tick(x => x + 1); };
	if (edit) return <MonEdit run={run} m={edit} done={() => setEdit(null)} />;
	return <Screen title="포켓몬" onBack={done} cls="sc-scr"><Back />
		<h3 class="sec">파티 <small class="muted">{run.party.length}/6 · 맨 위가 선두{run.tag ? ' · 태그 배틀은 위 3마리가 나가요' : ''} · 넣고 빼기는 아래 메뉴의 「박스」</small></h3>
		{run.party.map((m, i) => <MonCard m={m} onClick={() => setEdit(m)}>
			<button class="btn small" onClick={() => setEdit(m)}>기술·도구</button>
			{i > 0 && <button class="btn small" onClick={() => { run.party.splice(i, 1); run.party.splice(i - 1, 0, m); re(); }}>▲</button>}
			{run.party.length > 1 && <button class="btn small ghost" onClick={() => { run.party.splice(i, 1); run.box.push(m); re(); }}>박스로</button>}
		</MonCard>)}
		{run.box.length > 0 && <h3 class="sec">박스 <small class="muted">{run.box.length} · 박스의 포켓몬은 경험치를 받지 않아요</small></h3>}
		{run.box.map((m, i) => <MonCard m={m} onClick={() => setEdit(m)}>
			<button class="btn small" disabled={run.party.length >= 6} onClick={() => { run.box.splice(i, 1); run.party.push(m); re(); }}>파티로</button>
		</MonCard>)}
		<button class="btn big" onClick={done}>돌아가기</button>
	</Screen>;
}
const KIND_KO: { [k: string]: string } = { ball: '볼', held: '지닌 도구', gift: '선물', sell: '귀중품', med: '회복', tm: '기술머신' };
function ItemRow({ id, right, sub }: { id: string; right: any; sub?: string }) {
	const it = ITEMS[id];
	return <div class="sc-item"><span class="sc-item-ico">{itemIco(id, 36)}</span>
		<div class="sc-item-body"><b>{it.name} <small class="sc-kind">{KIND_KO[it.kind]}</small></b><small>{sub || it.desc}</small></div>{right}</div>;
}
function BagScreen({ run, done }: { run: Run; done: () => void }) {
	const [, tick] = useState(0), [use, setUse] = useState<string | null>(null);
	const ids = Object.keys(run.bag).sort((a, b) => Object.keys(ITEMS).indexOf(a) - Object.keys(ITEMS).indexOf(b));
	const it = use ? ITEMS[use] : null;
	/** 그 포켓몬에게 지금 쓸 수 있는가 (기술머신: 배울 수 있고 아직 모르는 기술) */
	const ok = (m: Mon) => !it ? false : it.kind === 'tm' ? learnset(m.sp, 9).includes(it.move!) && !known(m).includes(it.move!) : canMed(m, it.fx!);
	const apply = (m: Mon) => {
		if (!it || !use) return;
		if (it.kind === 'tm') { (m.tm = m.tm || []).push(it.move!); toast(`${josa(speciesKo(m.sp), '은', '는')} ${josa(moveKo(it.move!), '을', '를')} 배웠다! (「포켓몬」 화면에서 기술을 골라 넣으세요)`); sfx('statUp'); }
		else { useMed(m, it.fx!); give(run, use, -1); sfx('heal'); if (!run.bag[use]) setUse(null); }
		persist(run); tick(x => x + 1);
	};
	return <Screen title="가방" onBack={() => use ? setUse(null) : done()} cls="sc-scr"><Back />
		<p class="sc-purse">가진 돈 <b>{won(run.money)}</b></p>
		{it ? <>
			<ItemRow id={use!} right={<b class="sc-count">×{run.bag[use!]}</b>} />
			<h3 class="sec">누구에게 쓸까요?</h3>
			{run.party.map(m => <button class="sc-mon sc-usemon" disabled={!ok(m)} onClick={() => apply(m)}><PokeIcon species={m.sp} />
				<div class="sc-mon-body"><b>{speciesKo(m.sp)} <small>Lv{m.lv}</small></b><HpLine m={m} />
					{it.kind === 'tm' && <small>{known(m).includes(it.move!) ? '이미 배웠다' : learnset(m.sp, 9).includes(it.move!) ? '배울 수 있다' : '배울 수 없다'}</small>}</div></button>)}
			<button class="btn big" onClick={() => setUse(null)}>다른 도구</button>
		</> : <>
			{!ids.length && <p class="hint">가방이 비어 있어요.</p>}
			{ids.map(id => <ItemRow id={id} right={<>{ITEMS[id].kind !== 'tm' && <b class="sc-count">×{run.bag[id]}</b>}{(ITEMS[id].kind === 'med' || ITEMS[id].kind === 'tm') && <button class="btn small yellow" onClick={() => setUse(id)}>{ITEMS[id].kind === 'tm' ? '가르친다' : '쓴다'}</button>}</>} />)}
			<p class="muted small">회복 도구는 여기서나 배틀 중 「가방」에서 씁니다. 볼은 야생 포켓몬을 이긴 뒤에, 지닌 도구는 「포켓몬」 화면에서, 선물은 상대에게 말을 걸어 건넵니다.</p>
			<button class="btn big" onClick={done}>돌아가기</button>
		</>}
	</Screen>;
}
/** 포켓몬의 남은 체력 한 줄 */
function HpLine({ m }: { m: Mon }) {
	const f = m.hpf ?? 1, mh = maxHp(m);
	return <small class={'sc-hpline' + (f <= 0 ? ' fnt' : f < 0.25 ? ' low' : f < 0.5 ? ' mid' : '')}><i><b style={{ width: Math.round(f * 100) + '%' }} /></i>{f <= 0 ? '기절' : `HP ${Math.max(1, Math.round(mh * f))}/${mh}`}</small>;
}
function ShopScreen({ run, done }: { run: Run; done: () => void }) {
	const [, tick] = useState(0), shop = SHOPS[run.loc];
	const buy = (id: string) => { const it = ITEMS[id]; if (it.kind === 'tm' && run.bag[id]) { toast('이미 가지고 있어요 (기술머신은 몇 번이든 쓸 수 있어요)'); return; } if (run.money < it.price) { toast('돈이 모자라요'); return; } run.money -= it.price; give(run, id); persist(run); sfx('select'); tick(x => x + 1); };
	const sells = Object.keys(run.bag).filter(id => ITEMS[id]?.sell);
	return <Screen title={shop.name} onBack={done} cls="sc-scr"><Back />
		<p class="sc-purse">가진 돈 <b>{won(run.money)}</b></p>
		{shop.items.filter(([, need]) => has(run, need)).map(([id]) => <ItemRow id={id} sub={`${ITEMS[id].desc}${run.bag[id] ? ` (가진 수 ${run.bag[id]})` : ''}`}
			right={<button class="btn small" disabled={run.money < ITEMS[id].price} onClick={() => buy(id)}>{won(ITEMS[id].price)}</button>} />)}
		{sells.length > 0 && <h3 class="sec">팔기</h3>}
		{sells.map(id => <ItemRow id={id} sub={`가진 수 ${run.bag[id]}`} right={<button class="btn small yellow" onClick={() => { run.money += ITEMS[id].sell!; give(run, id, -1); persist(run); sfx('select'); tick(x => x + 1); }}>{won(ITEMS[id].sell!)}에 팔기</button>} />)}
		<button class="btn big" onClick={done}>나가기</button>
	</Screen>;
}
const UNMET: { [id: string]: string } = { misty: '블루시티에서 만날 수 있다', brock: '회색 체육관에서 이기면 가까워질 수 있다', leaf: '상록시티에서 만날 수 있다', erika: '무지개 체육관에서 이기면 가까워질 수 있다' };
function RouteScreen({ run, done }: { run: Run; done: () => void }) {
	return <Screen title="인물 루트 · 관동 편" onBack={done} cls="sc-scr"><Back />
		{CHARS.map(c => {
			const met = has(run, c.met), x = relOf(run, c.id), stage = !has(run, c.gate) ? 0 : x.ev + 1, w = WHO[c.who], cap = heartCap(run, c);
			return <><div class={'sc-route g-' + c.g + (met ? '' : ' unk')}>
				<span class="sc-route-face">{met && <Portrait id={w.portrait} sprite={w.sprite} cls="face" />}</span>
				<div class="sc-route-body"><b>{met ? c.name : '？？？'} <small>{met ? c.tagline : UNMET[c.id]}</small></b>
					{met && <><Hearts v={x.heart} big n={maxEv(c)} /><small>호감도 {x.heart} / {cap}{x.heart >= cap && x.ev < maxEv(c) ? (has(run, c.evNeed?.[x.ev]) ? ' (말을 걸면 다음 이야기)' : ' (여행을 더 나아가면 다음 이야기)') : ''}</small>
						<small>{run.tag === c.id ? '지금 태그 중 — 함께 다니고 있어요' : `지금(${TIMES[run.time]}): ${locOf(charLoc(run, c)).name} — ${c.doing[run.time]}`}</small></>}</div>
			</div>
			{met && <div class="sc-chapters">{c.chapters.map((t, i) => <div class={i < stage ? 'done' : i === stage ? 'now' : 'lock'}><i>{i < stage ? '✓' : i === stage ? '▶' : '🔒'}</i>{i <= stage ? t : '？？？'}</div>)}
				{x.ev >= 4 && <div class="done clear"><i>★</i>{c.name} 루트 {x.ev >= MAX_EV ? '2막' : '1막'} 클리어!</div>}</div>}</>;
		})}
		<p class="muted small">호감도: 함께 이긴 태그 배틀 +10 · 하루 한 번 이야기 · 선물(취향에 따라). 하트가 가득 차면 말을 걸어 다음 이야기를 열 수 있어요. 태그는 한 번에 한 사람과만 맺을 수 있어요.</p>
		<button class="btn big" onClick={done}>돌아가기</button>
	</Screen>;
}
/** 박스: 파티(6칸)와 박스(30칸씩)의 포켓몬을 옮기고 바꿈. 한 마리를 누른 뒤 다른 칸을 누르면 자리를 바꾸고, 빈 칸을 누르면 옮김 */
const BOX_SIZE = 30;
function BoxScreen({ run, done }: { run: Run; done: () => void }) {
	const [, tick] = useState(0), [sel, setSel] = useState<{ w: 'p' | 'b'; i: number } | null>(null), [page, setPage] = useState(0), [edit, setEdit] = useState<Mon | null>(null);
	const re = () => { persist(run); tick(x => x + 1); };
	if (edit) return <MonEdit run={run} m={edit} done={() => setEdit(null)} />;
	const pages = Math.max(1, Math.ceil((run.box.length + 1) / BOX_SIZE)), pg = Math.min(page, pages - 1);
	const at = (w: 'p' | 'b', i: number): Mon | undefined => (w === 'p' ? run.party : run.box)[i];
	const cur = sel ? at(sel.w, sel.i) : undefined;
	const tap = (w: 'p' | 'b', i: number) => {
		const m = at(w, i);
		if (!sel || !cur) { if (m) { sfx('select'); setSel({ w, i }); } return; }
		if (sel.w === w && sel.i === i) { setSel(null); return; }
		const A = sel.w === 'p' ? run.party : run.box, B = w === 'p' ? run.party : run.box;
		if (m) { A[sel.i] = m; B[i] = cur; }                                   // 자리 바꾸기
		else {                                                                 // 빈 칸으로 옮기기
			if (sel.w === 'p' && w === 'b' && run.party.length <= 1) { toast('파티에는 한 마리가 남아 있어야 해요'); return; }
			if (w === 'p' && sel.w === 'b' && run.party.length >= 6) { toast('파티가 가득 찼어요'); return; }
			if (sel.w !== w) { A.splice(sel.i, 1); B.push(cur); } else { A.splice(sel.i, 1); A.push(cur); }
		}
		sfx('select'); setSel(null); re();
	};
	const release = async () => {
		if (!sel || !cur) return;
		if (sel.w === 'p' && run.party.length <= 1) { toast('마지막 한 마리는 놓아줄 수 없어요'); return; }
		if (!(await confirmBox('놓아주기', `${josa(speciesKo(cur.sp), '을', '를')} (Lv${cur.lv}) 야생으로 돌려보낼까요?\n되돌릴 수 없어요.`, '놓아준다', '그만두기'))) return;
		if (cur.item) give(run, cur.item);
		(sel.w === 'p' ? run.party : run.box).splice(sel.i, 1); setSel(null); re(); toast(`${josa(speciesKo(cur.sp), '은', '는')} 풀숲으로 돌아갔다. 안녕!`);
	};
	const sortBox = (by: 'lv' | 'no') => { run.box.sort((a, b) => by === 'lv' ? b.lv - a.lv : ((speciesData(a.sp, 9) as any)?.num || 0) - ((speciesData(b.sp, 9) as any)?.num || 0) || b.lv - a.lv); setSel(null); re(); };
	const cell = (w: 'p' | 'b', i: number) => { const m = at(w, i), on = sel?.w === w && sel.i === i;
		return <button class={'sc-box-cell' + (m ? '' : ' empty') + (on ? ' on' : '')} onClick={() => tap(w, i)}>{m && <><PokeIcon species={m.sp} /><small>Lv{m.lv}</small>{m.item && <i class="sc-box-item" />}</>}</button>; };
	const s = cur ? speciesData(cur.sp, 9) as any : null;
	return <Screen title="포켓몬 박스" onBack={done} cls="sc-scr sc-boxscr"><Back />
		<h3 class="sec">파티 <small class="muted">{run.party.length}/6 · 맨 앞이 선두</small></h3>
		<div class="sc-box-grid party">{[0, 1, 2, 3, 4, 5].map(i => cell('p', i))}</div>
		<div class="sc-box-head">
			<button class="btn small" disabled={pg <= 0} onClick={() => { setPage(pg - 1); setSel(null); }}>◀</button>
			<b>박스 {pg + 1} <small>/ {pages} · 맡긴 포켓몬 {run.box.length}마리</small></b>
			<button class="btn small" disabled={pg >= pages - 1} onClick={() => { setPage(pg + 1); setSel(null); }}>▶</button>
		</div>
		<div class="sc-box-grid">{Array.from({ length: BOX_SIZE }, (_, k) => cell('b', pg * BOX_SIZE + k))}</div>
		<div class="sc-box-info">{cur && s ? <>
			<div class="sc-box-who"><Sprite species={cur.sp} gen={9} size={64} anim={false} />
				<div><b>{speciesKo(cur.sp)} <small>Lv{cur.lv}</small></b><span class="sc-types">{(s.t || []).map((t: string) => <TypeBadge type={t} />)}</span>
					<small>{movesOf(cur).map(moveKo).join(' · ')}{cur.item ? ` · ${ITEMS[cur.item].name}` : ''}</small></div></div>
			<div class="sc-box-btns">
				{sel!.w === 'b' ? <button class="btn small" disabled={run.party.length >= 6} onClick={() => { run.box.splice(sel!.i, 1); run.party.push(cur); setSel(null); re(); }}>파티로</button>
					: <button class="btn small" disabled={run.party.length <= 1} onClick={() => { run.party.splice(sel!.i, 1); run.box.push(cur); setSel(null); re(); }}>박스로</button>}
				<button class="btn small" onClick={() => setEdit(cur)}>기술·도구</button>
				<button class="btn small ghost" onClick={release}>놓아주기</button>
			</div></> : <p class="muted small">포켓몬을 누르면 고르고, 이어서 다른 칸을 누르면 자리를 바꾸거나 옮겨요. 박스의 포켓몬은 경험치를 받지 않아요.</p>}</div>
		<div class="sc-box-btns foot"><button class="btn small" onClick={() => sortBox('no')}>도감 번호순</button><button class="btn small" onClick={() => sortBox('lv')}>레벨순</button><button class="btn" onClick={done}>닫기</button></div>
	</Screen>;
}
function StarterPick({ done }: { done: (i: number) => void }) {
	const [sel, setSel] = useState(-1);
	const sp = sel >= 0 ? STARTERS[sel][0] : '';
	return <div class="sc-starter">
		<div class="sc-bg fld-lab" /><div class="sc-starter-shade" />
		<div class="sc-starter-head"><small>오박사 연구소</small><b>함께 여행할 포켓몬을 한 마리 고르자</b></div>
		<div class="sc-starter-table"><i class="sc-starter-desk" style={{ backgroundImage: pxUrl('table') }} />{STARTERS.map(([id], i) => <button class={'sc-starter-ball' + (sel === i ? ' on' : sel >= 0 ? ' off' : '')} onClick={() => { sfx('ballOpen'); cry(id); setSel(i); }}>
			<span class="sc-starter-mon" key={sel === i ? 'on' : 'off'}><Sprite species={id} gen={9} size={192} anim={false} /></span>
			<Px art="ball" scale={4} cls="sc-sball" /><b>{speciesKo(id)}</b>
		</button>)}</div>
		<div class="sc-starter-info">{sel < 0 ? <p class="sc-starter-hint">몬스터볼을 눌러 안을 들여다보자 ▼</p> : <>
			<p><b>{speciesKo(sp)}</b> <small>Lv5</small> <span class="sc-types">{((speciesData(sp, 9) as any)?.t || []).map((t: string) => <TypeBadge type={t} />)}</span></p>
			<p class="sc-starter-note">{STARTERS[sel][1]}</p>
			<button class="btn big primary" onClick={() => { sfx('select'); done(sel); }}>{josa(speciesKo(sp), '과', '와')} 함께 간다!</button>
		</>}</div>
	</div>;
}
/** 볼 던지기 연출 (그 자리 풍경 위에서): 볼이 날아감 → 포켓몬이 빛이 되어 빨려 들어감 → 떨어져 세 번 흔들림 → 딸깍·별(성공) / 튀어나옴(실패) */
function Catch({ sp, ok, bg, tint, ball = 'ball', done }: { sp: string; ok: boolean; bg: string; tint: number; ball?: string; done: () => void }) {
	const [st, setSt] = useState(0);   // 0 던짐 · 1 빨려 듦 · 2 흔들림 · 3 결과
	useEffect(() => {
		sfx('ballThrow');
		const ts = [setTimeout(() => { setSt(1); sfx('ballOpen'); }, 620), setTimeout(() => setSt(2), 1150),
			...[1750, 2450, 3150].map(t => setTimeout(() => sfx('select'), t)),
			setTimeout(() => { setSt(3); if (ok) sfx('heal'); else { sfx('ballOpen'); cry(sp); } }, 3850)];
		return () => ts.forEach(clearTimeout);
	}, []);
	return <div class={'story-talk sc-talk narr wild sc-catch2 st' + st + (ok ? ' ok' : ' no')} onClick={() => st === 3 && done()}>
		<div class={'st-bg sc-bg fld-' + bg} /><div class={'sc-tint ' + TIME_CLS[tint]} />
		<div class="sc-wildmon"><Px art="shadow" scale={10} cls="sc-wildgrass" /><Sprite species={sp} gen={9} size={192} anim={false} /></div>
		<span class="sc-cball"><Px art={ball} scale={4} /></span>{st === 3 && ok && <span class="sc-cstars"><Px art="star" scale={2} /><Px art="star" scale={2} /><Px art="star" scale={2} /></span>}
		<div class="st-box"><div class="st-text">{st < 3 ? '…' : ok ? `신난다! ${josa(speciesKo(sp), '을', '를')} 잡았다!` : `앗! ${josa(speciesKo(sp), '이', '가')} 볼에서 나와 달아났다…`}{st === 3 && <span class="st-arrow">▼</span>}</div></div>
	</div>;
}
function Credits({ run, c, done }: { run: Run; c: Char; done: () => void }) {
	useEffect(() => { playMusic('scheart'); const t = setTimeout(done, 21000); return () => clearTimeout(t); }, []);
	return <div class="sc-credits" onClick={done}><div class={'sc-bg fld-' + locOf(c.evAt[3][0]).bg} /><div class="sc-tint evening" />
		<div class="sc-credits-who"><Portrait id={WHO[c.who].portrait} sprite={WHO[c.who].sprite} cls="big" emo="joy" /></div>
		<div class="sc-roll">
			<h1>관동 편</h1><h2>{c.name} 루트</h2><p>— {c.subtitle} —</p>
			<h3>함께한 날</h3><p>{run.day}일</p>
			<h3>함께한 포켓몬</h3><p class="sc-roll-mons">{run.party.map(m => <PokeIcon species={m.sp} />)}</p>
			<h3>배지</h3><p>{run.badges.join(' · ')}</p>
			<h3>나온 사람들</h3><p>이슬 · 웅 · 리프 · 민화 · 그린 · 오박사</p><p>블루시티와 관동의 트레이너들</p>
			<h3>바탕</h3><p>포켓몬스터 레드·그린 / 하트골드·소울실버의 관동</p><p>유희왕 태그 포스의 파트너 시스템</p>
			<h2 class="sc-fin">{c.name} 루트 · 1막 클리어</h2><p>여행은 계속된다 — 2막은 갈색시티에서</p>
		</div>
	</div>;
}
function SeriesSelect({ saved, done }: { saved: Run | null; done: (a: 'go' | 'new' | null) => void }) {
	return <Screen title="시나리오" onBack={() => done(null)} cls="sc-scr sc-series">
		<p class="hint">지방을 고르면 그 지방을 자유롭게 돌아다니며, 만나는 인물과 태그를 맺고 그 인물의 이야기를 따라갑니다.</p>
		<div class="sc-series-card on">
			<div class="sc-bg fld-cerulean" />
			<div class="sc-series-body"><small>SERIES 1</small><b>관동 편</b><span>레드·그린의 무대 — 태초마을에서 블루곶까지</span>
				<span class="sc-series-ch"><span class="sc-route-face"><Portrait id="misty" sprite="misty" cls="face" /></span>이슬·웅·리프·민화 루트{saved ? ` ★${CHARS.filter(c => (saved.rel?.[c.id]?.ev || 0) >= 4).length}/${CHARS.length}` : ''}</span>
				{saved?.flags.intro ? <small class="sc-series-save">{saved.day}일째 · {locOf(saved.loc).name} · 배지 {saved.badges.length}개</small> : null}
				<div class="sc-series-btns">{saved?.flags.intro ? <><button class="btn primary" onClick={() => done('go')}>이어서 하기</button><button class="btn ghost" onClick={() => done('new')}>처음부터</button></> : <button class="btn primary" onClick={() => done('new')}>시작하기</button>}</div>
			</div>
		</div>
		{[['성도 편', '금·은'], ['호연 편', '루비·사파이어'], ['신오 편', '다이아몬드·펄']].map(([n, g], i) => <div class="sc-series-card lock"><div class="sc-series-body"><small>SERIES {i + 2}</small><b>{n}</b><span>{g}의 무대 · 준비 중</span></div></div>)}
	</Screen>;
}

// ───────── 이야기 (대사는 scenario-script.ts) ─────────
async function prologue(run: Run, E: Eng) {
	await play(run, E, 'pro1');
	const i = await ask<number>(r => <StarterPick key={K()} done={r} />);
	run.starter = STARTERS[i][0]; run.bag.potion = (run.bag.potion || 0) + 3; run.party = [{ sp: run.starter, lv: 5, exp: 0 }]; run.loc = 'pallet'; persist(run);
	await play(run, E, 'pro2');
	const rv = RIVAL_OF[run.starter];
	const win = await E.fight({ name: '그린', title: '라이벌', sprite: 'blue', team: [{ sp: rv, lv: 5, exp: 0, mlv: 1 }], skill: 0.2, arena: 'field', music: 'battle' });
	if (win) await E.reward([{ sp: rv, lv: 5, exp: 0 }], '그린에게 이겼다!', 0);
	await play(run, E, win ? 'proWin' : 'proLose');
	await play(run, E, 'pro3');
	await E.fx('iris', 700, 'lab');
}
const mistyMeet = (run: Run, E: Eng) => play(run, E, 'meet');
const mistyGym = (run: Run, E: Eng) => play(run, E, 'gym');
/** 인물에게 말 걸기: 이야기 · 선물 · 태그 · (하트가 차면) 초대 */
async function friendMenu(run: Run, E: Eng, c: Char) {
	const x = relOf(run, c.id), w = c.who;
	if (!has(run, c.gate)) { await E.say([[w, c.id === 'misty' && has(run, 'c2') ? '풀장 끝에서 기다릴게. 어서 와!' : fill(run, c.notYet || c.hello[0])]]); return; }
	if (evReady(run, c) && !run.flags[fk(c, 'inv', x.ev + 1)]) { await play(run, E, fk(c, 'inv', x.ev + 1)); if (run.tag === c.id) { run.tag = ''; persist(run); } return; }
	const gifts = Object.keys(run.bag).filter(id => ITEMS[id]?.kind === 'gift');
	const other = run.tag && run.tag !== c.id ? charOf(run.tag) : null;
	// 가까울수록 하루에 더 여러 번 이야기할 수 있고(200~ 두 번, 400~ 세 번), 더 깊은 이야기가 섞여 나옴
	const talksMax = 1 + (x.heart >= 200 ? 1 : 0) + (x.heart >= 400 ? 1 : 0), talksDone = x.talked === run.day ? x.n || 1 : 0;
	const opts = [talksDone >= talksMax ? '이야기하기 (오늘은 충분히 했다)' : talksMax > 1 ? `이야기하기 (오늘 ${talksDone}/${talksMax})` : '이야기하기', `선물하기${gifts.length ? '' : ' (선물 없음)'}`, run.tag === c.id ? '태그를 푼다' : other ? `태그를 신청한다 (${other.name}와는 풀림)` : '태그를 신청한다', '그만두기'];
	// 함께 다니는 중이면 '여기서 만나네' 같은 인사 대신 곁에 있는 사람의 말투로
	const hello = fill(run, run.tag === c.id ? c.tagHello[(run.day + run.time + (run.ap || 0)) % c.tagHello.length] : c.hello[x.ev >= 4 ? 4 : Math.min(3, Math.floor(x.heart / 100))]);
	const pick = await E.choose(w, hello, opts);
	if (pick === 0) {
		if (talksDone >= talksMax) { await E.say([[w, c.talkedLine]]); return; }
		const pool = x.heart >= 200 ? (talksDone % 2 === 0 ? c.talksHi : c.talks) : c.talks;
		const [q, ans] = pool[(run.day + x.ev + talksDone) % pool.length];
		const a = await E.choose(w, fill(run, q), ans.map(t => t[0]));
		x.talked = run.day; x.n = talksDone + 1; persist(run);
		await E.say([[w, fill(run, ans[a][2]), ans[a][1] >= 8 ? 'shy' : ans[a][1] >= 5 ? 'joy' : ans[a][1] <= 1 ? 'angry' : undefined]]);
		await E.heart(c.id, ans[a][1]); await E.spend();
	} else if (pick === 1) {
		if (!gifts.length) { await E.say([[w, c.noGift]]); return; }
		const g = await E.choose(w, '(무엇을 건넬까?)', [...gifts.map(id => `${ITEMS[id].name} ×${run.bag[id]}`), '그만두기']);
		if (g >= gifts.length) return;
		const id = gifts[g], like = likeOf(ITEMS[id], c.id); give(run, id, -1); persist(run);
		await E.say([[w, c.gift[2 - like].replace('{item}', ITEMS[id].name), like === 2 ? 'love' : like === 1 ? 'joy' : 'angry']]);
		await E.heart(c.id, like === 2 ? 25 : like === 1 ? 10 : -15); await E.spend();
		if (run.tag === c.id && x.ev < 4 && x.heart < TAG_NEED) { run.tag = ''; persist(run); toast(`${c.name}의 기분이 상해 태그가 풀렸다`); }
	} else if (pick === 2) {
		// 아직 서먹하면 태그를 받아 주지 않음 (1막을 끝낸 인물은 언제나 받아 줌)
		if (run.tag !== c.id && x.ev < 4 && x.heart < TAG_NEED) { await E.say([[w, c.tagNo, 'think']]); toast(`호감도 ${TAG_NEED}부터 태그를 맺을 수 있어요 (지금 ${x.heart}) — 이야기와 선물로 가까워지세요`); return; }
		const on = run.tag !== c.id; run.tag = on ? c.id : ''; persist(run);
		await E.say([[w, on ? c.tagOn : c.tagOff, on ? 'joy' : 'sad']]);
		if (on) toast(`${josa(c.name, '과', '와')} 태그를 맺었다 — 길거리 트레이너와의 배틀이 멀티배틀이 돼요`);
	}
}
/** 하트 이벤트 (지면 다음에 처음부터 다시) */
async function friendEvent(run: Run, E: Eng, c: Char) {
	const x = relOf(run, c.id), k = x.ev + 1;
	if (!(await play(run, E, fk(c, 'ev', k)))) { await E.tick(); return; }
	x.ev = k; run.flags[fk(c, 'ev', k)] = 1; if (k === 4) run.tag = c.id; persist(run);
	if (k !== 4) { await E.card(c.evTitle[k - 1], k === maxEv(c) ? `${c.name} 루트 · 2막 클리어` : '하트 이벤트 클리어', `♥ ${k} / ${maxEv(c)}`, E.L().bg, 2200); await E.spend(); return; }
	await E.fx('fade', 900);
	await ask<void>(r => <Credits key={K()} run={run} c={c} done={r} />);
	await E.card(`${c.name} 루트 · 1막 클리어`, `${josa(c.name, '과', '와')} 언제든 태그를 맺을 수 있어요`, 'CONGRATULATIONS', locOf(c.evAt[3][0]).bg, 3200);
}

// ───────── 진행 ─────────
export async function runScenario() {
	const saved = migrate(load<any>(KEY, null));
	const pick = await ask<'go' | 'new' | null>(r => <SeriesSelect saved={saved} done={r} />);
	if (!pick) return;
	if (pick === 'new' && saved?.flags.intro && !(await confirmBox('처음부터', '지금까지의 진행(포켓몬·배지·호감도)을 모두 지우고 처음부터 할까요?', '지우기'))) return runScenario();
	const run: Run = pick === 'go' && saved ? { ...newRun(), ...saved } : newRun();
	if (pick === 'new') remove(KEY);
	const E = engine(run);
	if (!run.flags.intro) await prologue(run, E);
	let banner = true;
	while (true) {
		const a = await ask<Act>(r => <Hub run={run} banner={banner} done={r} />);
		banner = false;
		if (a === BACK) { persist(run); return; }
		const loc = locOf(run.loc);
		if (a.k === 'wait') {   // 시계를 누름: 이동하지 않고 시간만 한 칸 (밤에만 열리는 이야기에 시간을 맞추기 쉽게)
			const next = run.time === 3 ? '다음 날 아침' : TIMES[run.time + 1];
			if (await confirmBox('시간 보내기', `여기서 ${next}까지 기다릴까요?`, '기다린다', '그만두기')) { await E.fx('fade', 500); await E.tick(); }
			continue;
		}
		if (a.k === 'box') { await ask<void>(r => <BoxScreen run={run} done={r} />); continue; }
		if (a.k === 'party') { await ask<void>(r => <PartyScreen run={run} done={r} />); continue; }
		if (a.k === 'bag') { await ask<void>(r => <BagScreen run={run} done={r} />); continue; }
		if (a.k === 'route') { await ask<void>(r => <RouteScreen run={run} done={r} />); continue; }
		if (a.k === 'map') {
			const to = await ask<string | null>(r => <WorldMap run={run} done={r} />);
			if (!to) continue;
			const hops = moveCost(run, routeBetween(run, run.loc, to).length - 1);
			await ask<void>(r => <Travel key={K()} run={run} to={to} done={r} />);
			run.loc = to; if (locOf(to).rest) run.town = to;
			await E.spend(hops);
			banner = true;
			if (to === 'cerulean' && !has(run, 'met')) await mistyMeet(run, E);
			if (to === 'viridian' && !has(run, 'leafmet')) await play(run, E, 'leafmeet');
			if (to === 'vermilion' && !has(run, 'verm')) await play(run, E, 'vermilion');
			if (to === 'lavender' && !has(run, 'lav')) await play(run, E, 'lavender');
			if (to === 'celadon' && !has(run, 'cel')) await play(run, E, 'celadon');
			// 가까워진 인물(호감도 200~)이 그곳에 있으면, 하루에 한 번쯤 먼저 말을 걸어 옴
			const hi = metChars(run).find(c => run.tag !== c.id && has(run, c.gate) && charLoc(run, c) === to && relOf(run, c.id).heart >= 200 && relOf(run, c.id).greet !== run.day);
			if (hi && Math.random() < 0.7) { const x = relOf(run, hi.id); x.greet = run.day; persist(run); await E.say([[hi.who, fill(run, hi.greet[(run.day + x.ev) % hi.greet.length]), 'joy']]); await E.heart(hi.id, 3); await friendMenu(run, E, hi); }
			continue;
		}
		const n = a as Node;
		if (n.k === 'shop') { await E.say([['clerk', '어서 오세요! 무엇을 찾으세요?']]); await ask<void>(r => <ShopScreen run={run} done={r} />); continue; }
		if (n.k === 'rest') {
			const home = run.loc === 'pallet';
			const c = await E.choose(home ? { name: '엄마', portrait: '', sprite: '' } : 'joy', home ? '어머, 왔니? 얼굴이 피곤해 보이는구나. 한숨 자고 가렴.' : '포켓몬센터입니다. 포켓몬을 쉬게 해 드릴까요?', ['포켓몬을 회복시킨다', '쉰다 (다음 날 아침으로)', '그만두기']);
			if (c === 0) { healAll(run); persist(run); sfx('heal'); await E.say([[null, '포켓몬들이 모두 건강해졌다!']]); }
			if (c === 1) { healAll(run); await E.fx('fade', 800); await E.tick(true); banner = true; }
			continue;
		}
		if (n.k === 'oak') {
			const kinds = new Set([...run.party, ...run.box].map(m => m.sp)).size;
			await E.say([['oak', `오오, ${playerName()}! 도감은 잘 채우고 있니?`], ['oak', `지금까지 함께한 포켓몬은 ${kinds}종류구나. ${kinds >= 10 ? '훌륭하구나! 그 기세란다.' : kinds >= 5 ? '순조롭구나. 풀숲을 더 뒤져 보렴.' : '풀숲에 들어가면 새 친구를 만날 수 있단다.'}`],
				['oak', has(run, 'met') ? '블루시티의 이슬과 친해졌다지? 그 아이는 시간마다 있는 곳이 다르단다. 「루트」 화면을 보렴.' : '달맞이산 너머 블루시티에는 이슬이라는 관장이 있단다. 물 포켓몬의 달인이지.']], 'lab');
			continue;
		}
		if (n.k === 'karp') {
			const c = await E.choose('salesman', '어이, 거기 학생! 비밀인데 말이지… 이 귀한 잉어킹을 단돈 500원에 주지. 어때?', ['산다 (500원)', '안 산다']);
			if (c !== 0) { await E.say([['salesman', '쳇, 나중에 후회하지나 말라고.']]); continue; }
			if (run.money < 500) { await E.say([['salesman', '돈이 없잖아! 장난치지 말라고.']]); continue; }
			run.money -= 500; run.flags.karp = 1; (run.party.length < 6 ? run.party : run.box).push({ sp: 'magikarp', lv: 5, exp: 0 }); persist(run);
			await E.say([['salesman', '좋은 거래였어! 아, 환불은 안 돼!'], [null, '잉어킹을 손에 넣었다! (튀어오르기밖에 못 하지만, Lv20까지 키우면…)']]);
			continue;
		}
		if (n.k === 'bike') {
			const owner = { name: '자전거 가게 주인', portrait: '', sprite: 'cyclist' };
			if (has(run, 'bike')) await E.say([[owner, '자전거는 잘 달리나요? 같은 시간에 두 배는 멀리 갈 수 있을 거예요!']]);
			else if (has(run, 'voucher')) {
				await E.say([[owner, '어서 와요! …오오, 그건 애호가 클럽 회장님의 교환권! 물론 바꿔 드리죠!']]);
				run.flags.bike = 1; persist(run);
				await ask<void>(r => <GetCard key={K()} icon="bicycle" title="자전거" sub="이동에 드는 행동 칸이 절반으로 줄어든다" done={r} />);
			} else await E.say([[owner, '어서 와요! 최신형 자전거가 단돈 1,000,000원!'], [null, `…가진 돈은 ${won(run.money)}. 도저히 살 수 없다.\n(갈색시티에 교환권을 가진 사람이 있다는 소문이다)`]]);
			continue;
		}
		if (n.k === 'club') {
			if (has(run, 'voucher')) { await E.say([['chairman', has(run, 'bike') ? '자전거는 잘 타고 있나? 내 날쌩마 이야기 2부를 들려주지!' : '교환권은 블루시티 자전거 가게로 가져가게나!'], [null, '…이야기가 길어질 것 같아 정중히 사양했다.']]); continue; }
			const c = await E.choose('chairman', '오오, 어서 오게! 나는 포켓몬 애호가 클럽 회장일세. 내가 아끼는 포켓몬 이야기를 들어 보겠나?', ['듣는다', '사양한다']);
			if (c !== 0) { await E.say([['chairman', '그런가… 아쉽구먼. 마음이 바뀌면 다시 오게.']]); continue; }
			await E.say([['chairman', '내 날쌩마는 말이지, 갈기가 불꽃처럼… 아니 진짜 불꽃이지만! 그 우아함이란…', 'joy'], [null, '…', undefined], [null, '…이야기는 한참 동안 이어졌다.'], ['chairman', '이런, 벌써 시간이 이렇게! 끝까지 들어 준 사람은 자네가 처음일세. 답례로 이걸 주지!', 'joy']]);
			run.flags.voucher = 1; persist(run);
			await ask<void>(r => <GetCard key={K()} icon="letter" title="자전거 교환권" sub="블루시티 자전거 가게에서 자전거로 바꿀 수 있다" done={r} />);
			await E.spend(2);
			continue;
		}
		if (n.k === 'script') { if (await play(run, E, n.data)) { run.flags[n.data] = 1; persist(run); await E.spend(); } else await E.tick(); continue; }
		if (n.k === 'folk') {
			const f = n.data as typeof FOLKS[number], first = f.gift && !has(run, 'folk-' + f.loc);
			await E.say((first ? f.first! : [f.lines[(run.day + run.time) % f.lines.length]]).map(t => [f.who, fill(run, t)] as Line));
			if (first) { run.flags['folk-' + f.loc] = 1; await E.got(f.gift!, f.n || 1); }
			continue;
		}
		if (n.k === 'gym') { if (await mistyGym(run, E)) await E.spend(); continue; }
		if (n.k === 'friend') { await friendMenu(run, E, n.data as Char); continue; }
		if (n.k === 'event') { await friendEvent(run, E, n.data as Char); banner = true; continue; }
		if (n.k === 'brock') { if (await play(run, E, 'brock')) await E.spend(); else await E.tick(); continue; }
		if (n.k === 'wild') {
			const w = WILDS.find(x => x.loc === run.loc)!, pool = run.time === 3 && w.night ? w.night : w.pool;
			const [sp, lo, hi] = pool[Math.floor(Math.random() * pool.length)], foe: Mon = { sp, lv: lo + Math.floor(Math.random() * (hi - lo + 1)) + wildBonus(w, run.badges.length), exp: 0 };
			await E.say([[null, '바스락…!']]);
			await E.say([[null, `야생 ${josa(speciesKo(sp), '이', '가')} 튀어나왔다! (Lv${foe.lv})`]], undefined, sp);
			const res = await E.fight({ name: `야생 ${speciesKo(sp)}`, sprite: '', team: [foe], skill: 0.1, music: 'battle', wild: true });
			if (res === 'fled') { await E.say([[null, '무사히 도망쳤다!']]); continue; }
			if (!res) { await E.blackout(); banner = true; continue; }
			await E.reward([foe], `야생 ${josa(speciesKo(sp), '을', '를')} 쓰러뜨렸다!`, 0, true); await E.spend();
			const balls = Object.keys(run.bag).filter(id => ITEMS[id]?.kind === 'ball');
			if (!balls.length) { toast('볼이 없어서 잡을 수 없었다 — 프렌들리숍에서 살 수 있어요'); continue; }
			const c = await E.choose(null, `${josa(speciesKo(sp), '은', '는')} 지쳐서 움직이지 못한다.\n볼을 던질까?`, [...balls.map(id => `${ITEMS[id].name} ×${run.bag[id]} (${Math.round(catchRate(sp, ITEMS[id].rate!) * 100)}%)`), '그냥 보내 준다'], undefined, sp);
			if (c >= balls.length) continue;
			give(run, balls[c], -1);
			const ok = Math.random() < catchRate(sp, ITEMS[balls[c]].rate!);
			if (ok) (run.party.length < 6 ? run.party : run.box).push(foe);
			persist(run);
			await ask<void>(r => <Catch key={K()} sp={sp} ok={ok} bg={E.L().bg} tint={run.time} ball={ART[balls[c]] ? balls[c] : 'ball'} done={r} />);
			if (ok && !run.party.includes(foe)) toast(`파티가 가득 차서 ${josa(speciesKo(sp), '을', '를')} 박스로 보냈다`);
			continue;
		}
		if (n.k === 'trainer') {
			const t = n.data as Trainer, who = tWho(t);
			if (n.done) { await E.say([[who, t.again]]); continue; }
			await E.say([[who, t.before]]);
			// 태그 중이면 그 자리의 다른 트레이너와 한 팀이 되어 멀티배틀
			const mate = run.tag ? TRAINERS.find(x => x !== t && x.loc === t.loc && !x.once && has(run, x.need) && (!x.at || x.at.includes(run.time)) && run.beaten[x.id] !== run.day) : undefined;
			const tag = !!run.tag && !t.once, pc = run.tag ? charOf(run.tag) : null;
			if (tag && mate) await E.say([[tWho(mate), '태그라고? 그럼 나도 끼워 줘! 2대2다!'], [pc!.who, pc!.mateLine]]);
			else if (tag) await E.say([[pc!.who, pc!.soloLine]]);
			const team = mk(mate && tag ? (() => { const o: [string, number][] = []; for (let i = 0; i < 3; i++) { if (t.team[i]) o.push(t.team[i]); if (mate.team[i]) o.push(mate.team[i]); } return o; })() : t.team);
			const win = await E.fight({ name: mate && tag ? `${t.name} & ${mate.name}` : t.name, title: t.title, sprite: t.sprite, sprite2: mate && tag ? mate.sprite : undefined, team, skill: t.skill, arena: t.arena, music: t.music || 'battle', tag: tag ? run.tag : undefined, line: t.before });
			if (!win) { await E.blackout(); banner = true; continue; }
			if (t.once) run.flags[t.id] = 1; run.beaten[t.id] = run.day; if (mate && tag) run.beaten[mate.id] = run.day;
			await E.reward(team, `${mate && tag ? `${t.name} 팀` : t.name}에게 이겼다!`, Math.max(...team.map(m => m.lv)) * (mate && tag ? 60 : 30) * (t.title ? 2 : 1));
			await E.say([[who, t.after]]); await E.spend();
			if (tag) { await E.say([[pc!.who, pc!.cheers[Math.floor(Math.random() * pc!.cheers.length)], 'joy']]); await E.heart(pc!.id, 10); }
			continue;
		}
		void loc;
	}
}
void Fragment;
