/** 보상 시스템: BP(배틀 포인트) 지갑 · 얻는 규칙 · 교환소 상품 · 업적 전용 보상 · 주간 과제.
 *  보상은 모두 꾸미기·기록 표시용 (배틀 능력에는 영향 없음 — 온라인 대전 공정성).
 *  저장: localStorage pkbkr:wallet */
import { load, save, loadRecords, loadSettings, saveSettings } from './store';
import { onBattleEnd } from './battle-hooks';
import { loadStats, analyze, setAchHook, type Stats } from './stats';
import { speciesData, toID, RAW, typeKo } from './data';
import TRAINER_CLASSES from './gen/trainer-classes.json';
import { REGIONS } from './trainers';

// ───────── 지갑 ─────────
export interface Wallet {
	bp: number; total: number;
	/** 산 상품 */ own: { [id: string]: 1 };
	/** 장착: 칸(slot) → 상품 id */ eq: { [slot: string]: string };
	/** 쉬움 난이도 반 BP 누적 */ frac: number;
	/** 온라인 대전 하루 상한 */ onDay: string; onN: number;
	/** 주간 과제: 주 id · 진행 · 받은 보상 */ week: { id: string; prog: { [k: string]: number }; got: { [k: string]: 1 } };
	/** 최근 얻은 내역 */ log: { t: number; n: number; why: string }[];
}
const WKEY = 'wallet';
const emptyWallet = (): Wallet => ({ bp: 0, total: 0, own: {}, eq: {}, frac: 0, onDay: '', onN: 0, week: { id: '', prog: {}, got: {} }, log: [] });
export function loadWallet(): Wallet { return { ...emptyWallet(), ...load<Partial<Wallet>>(WKEY, {}) }; }
function saveWallet(w: Wallet) { save(WKEY, w); listeners.forEach(f => f(w)); }
const listeners = new Set<(w: Wallet) => void>();
export function onWallet(f: (w: Wallet) => void) { listeners.add(f); return () => { listeners.delete(f); }; }

/** BP 얻기 (화면 아래에 도트 동전과 함께 잠깐 표시) */
export function earnBP(n: number, why: string, quiet = false) {
	n = Math.floor(n);
	if (n <= 0) return;
	const w = loadWallet();
	w.bp += n; w.total += n;
	w.log = [{ t: Date.now(), n, why }, ...w.log].slice(0, 30);
	saveWallet(w);
	if (!quiet) bpToast(n, why);
}
export function spendBP(n: number): boolean {
	const w = loadWallet();
	if (w.bp < n) return false;
	w.bp -= n; saveWallet(w); return true;
}

// 얻은 BP 알림: 짧은 시간에 여러 번 얻으면 하나로 합쳐 보여 줌
let pend = { n: 0, why: [] as string[] }, pendT: any = 0;
function bpToast(n: number, why: string) {
	pend.n += n; if (!pend.why.includes(why)) pend.why.push(why);
	clearTimeout(pendT);
	pendT = setTimeout(() => {
		let el = document.getElementById('bp-toast');
		if (!el) { el = document.createElement('div'); el.id = 'bp-toast'; document.body.appendChild(el); }
		el.innerHTML = `<i class="bp-coin"></i><b>+${pend.n} BP</b><small></small>`;
		el.querySelector('small')!.textContent = pend.why.slice(0, 2).join(' · ') + (pend.why.length > 2 ? ` 외 ${pend.why.length - 2}` : '');
		el.className = ''; void el.offsetWidth; el.className = 'show';
		clearTimeout((el as any)._t); (el as any)._t = setTimeout(() => { el!.className = ''; }, 2600);
		pend = { n: 0, why: [] };
	}, 400);
}

// ───────── 얻는 규칙 ─────────
/** 7연승 세트 클리어: 3 + 세트가 오를수록 +1 (최대 7) */
export const setClearBP = (streak: number) => Math.min(7, 3 + Math.floor(streak / 7) - 1);
export const BRAIN_BP = { silver: 10, gold: 25 };
export const ACH_BP = [0, 2, 5, 10, 20];   // 업적 단계(브론즈·실버·골드·플래티넘)
export const SEASON_BP: { [cls: string]: number } = { '비기너': 2, '몬스터볼급': 4, '슈퍼볼급': 6, '하이퍼볼급': 10, '마스터볼급': 18, '챔피언급': 30 };
const FACILITY = /^(배틀타워|배틀팩토리|배틀팰리스|일필도)/;

setAchHook(tiers => { const n = tiers.reduce((a, t) => a + (ACH_BP[t] || 0), 0); if (n) earnBP(n, '업적 달성'); });
const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
onBattleEnd((setup, battle, win) => {
	if (setup.replay) return;
	if (setup.online) {   // 온라인: 이기든 지든 한 판에 1 (하루 10판까지)
		const w = loadWallet(); const today = dayKey();
		if (w.onDay !== today) { w.onDay = today; w.onN = 0; }
		if (w.onN < 10) { w.onN++; saveWallet(w); earnBP(1, '온라인 대전'); }
		return;
	}
	if (setup.cheat || setup.inverse || setup.noRecord) return;
	weeklyFromBattle(setup, battle, win);
	if (!win) return;
	const label: string = setup.label || '';
	if (/^프리/.test(label) || !label) return;   // 프리 배틀은 없음
	if (setup.diff === 'easy') {   // 쉬움: 두 번 이길 때마다 1
		const w = loadWallet(); w.frac += 0.5; const n = Math.floor(w.frac); w.frac -= n; saveWallet(w);
		if (n) earnBP(n, '승리');
		return;
	}
	earnBP(1, FACILITY.test(label) ? '승리' : '승리');
});

// ───────── 교환소 상품 ─────────
export type Slot = 'title' | 'cardBg' | 'frame' | 'star' | 'trainer' | 'ball' | 'win' | 'hp' | 'bg' | 'bgm';
export interface Item {
	id: string; slot: Slot; name: string; price?: number; desc?: string;
	/** 업적 전용: 조건을 채우면 공짜로 열림 (BP 로 못 삼) */ cond?: (s: Stats) => boolean; condText?: string;
	/** 미리보기용 값 (색·그림 id 등) */ v?: string;
}
export const SLOT_INFO: { [k in Slot]: { name: string; desc: string } } = {
	title: { name: '칭호', desc: '수첩 카드·메인·온라인 대전 이름 밑에' },
	cardBg: { name: '카드 배경', desc: '트레이너 카드 바탕' },
	frame: { name: '카드 테두리', desc: '트레이너 카드 도트 테두리' },
	star: { name: '별 모양', desc: '트레이너 카드 등급 표시' },
	trainer: { name: '트레이너 모습', desc: '주인공 모습에 추가' },
	ball: { name: '볼 연출', desc: '내 포켓몬이 나올 때 볼' },
	win: { name: '승리 연출', desc: '배틀에서 이겼을 때' },
	hp: { name: 'HP 창 테마', desc: '배틀 HP 창 색' },
	bg: { name: '배틀 배경', desc: '배경 고르기에 추가' },
	bgm: { name: '배틀 음악', desc: '음악 고르기에 추가' },
};
const symGold = (s: Stats) => s.sym.tower === 2 || s.sym.factory === 2 || s.sym.rank === 2;
const ippitsu49 = () => Object.entries(loadRecords().best).some(([k, v]) => k.startsWith('ippitsu') && (v as number) >= 49);
const regionsAll = (s: Stats) => REGIONS.filter(r => r !== '애니메이션').every(r => s.conquest[r]);
const dexTotal = () => new Set(Object.values(RAW.species as any).map((x: any) => x.num).filter((n: number) => n > 0)).size || 1025;
export const dexPct = (s: Stats) => Object.keys(s.used).length / dexTotal() * 100;

const T = (id: string, name: string, price: number, desc = ''): Item => ({ id: 't:' + id, slot: 'title', name, price, desc });
const TX = (id: string, name: string, condText: string, cond: (s: Stats) => boolean): Item => ({ id: 't:' + id, slot: 'title', name, cond, condText });
export const ITEMS: Item[] = [
	// 칭호
	T('rookie', '신참 트레이너', 20), T('ace', '에이스 트레이너', 40), T('veteran', '베테랑', 60), T('strategist', '전략가', 50),
	T('collector', '포켓몬 수집가', 40), T('weather', '날씨의 지배자', 50), T('critical', '급소 사냥꾼', 50), T('sweeper', '스위퍼', 60),
	T('wall', '철벽 수비', 50), T('gimmick', '기믹 마스터', 60), T('lucky', '행운아', 30), T('legend', '살아 있는 전설', 80),
	TX('tactics', '택틱스 마스터', '배틀타워 금 심볼', s => s.sym.tower === 2),
	TX('knowledge', '날리지 마스터', '배틀팩토리 금 심볼', s => s.sym.factory === 2),
	TX('champion', '시즌 챔피언', '랭크 시즌을 챔피언급으로 마감', s => s.sym.rank === 2),
	TX('ippitsu', '한 마리의 전설', '일필도 49연승', () => ippitsu49()),
	TX('conqueror', '지방 정복자', '모든 지방 정복', regionsAll),
	TX('dexmaster', '도감 박사', '도감(써 본 포켓몬) 50%', s => dexPct(s) >= 50),
	// 카드 배경 (3~4단 색 띠)
	{ id: 'cb:sunset', slot: 'cardBg', name: '노을', price: 20, v: '#e86a3a,#c84a4a,#7a3a6a,#3a2a5a' },
	{ id: 'cb:forest', slot: 'cardBg', name: '숲', price: 20, v: '#5aa84a,#3a8a3a,#2a6a3a,#1a4a2a' },
	{ id: 'cb:deep', slot: 'cardBg', name: '심해', price: 30, v: '#2a8ac8,#1a5a9a,#1a3a6a,#0e2244' },
	{ id: 'cb:night', slot: 'cardBg', name: '밤하늘', price: 30, v: '#3a3a8a,#2a2a6a,#1a1a4a,#0e0e2a' },
	{ id: 'cb:sakura', slot: 'cardBg', name: '벚꽃', price: 40, v: '#f8b8d0,#e888b0,#c86a98,#9a4a7a' },
	{ id: 'cb:mono', slot: 'cardBg', name: '흑백', price: 40, v: '#8a8a8a,#6a6a6a,#4a4a4a,#2a2a2a' },
	{ id: 'cb:eternamax', slot: 'cardBg', name: '무한다이맥스', cond: () => ippitsu49(), condText: '일필도 49연승', v: '#c82a4a,#8a1a3a,#4a0e2a,#1a0614' },
	{ id: 'cb:gold', slot: 'cardBg', name: '황금', cond: s => s.sym.tower === 2 && s.sym.factory === 2 && s.sym.rank === 2, condText: '금 심볼 3개', v: '#f8d84a,#e0b030,#b8862a,#7a5418' },
	// 카드 테두리 (진한 외곽선 · 밝은 안쪽 선)
	{ id: 'fr:ruby', slot: 'frame', name: '루비', price: 30, v: '#5a0a1a,#ff6a7a' },
	{ id: 'fr:sapphire', slot: 'frame', name: '사파이어', price: 30, v: '#0a1a5a,#6aa8ff' },
	{ id: 'fr:emerald', slot: 'frame', name: '에메랄드', price: 30, v: '#0a3a1a,#6ae88a' },
	{ id: 'fr:silver', slot: 'frame', name: '은 심볼', cond: s => !!(s.sym.tower || s.sym.factory || s.sym.rank), condText: '아무 심볼(은) 하나', v: '#2a3040,#e8eef8' },
	{ id: 'fr:gold', slot: 'frame', name: '금 심볼', cond: symGold, condText: '아무 심볼(금) 하나', v: '#4a3008,#ffd84a' },
	// 별 모양
	{ id: 'st:diamond', slot: 'star', name: '다이아', price: 20, v: '◆' },
	{ id: 'st:heart', slot: 'star', name: '하트', price: 20, v: '♥' },
	{ id: 'st:club', slot: 'star', name: '클로버', price: 20, v: '♣' },
	{ id: 'st:spade', slot: 'star', name: '스페이드', price: 20, v: '♠' },
	// 볼 연출 (내 포켓몬이 나올 때 항상 이 볼)
	...([['greatball', '슈퍼볼', 20], ['ultraball', '하이퍼볼', 30], ['premierball', '프레미어볼', 30], ['luxuryball', '럭셔리볼', 40], ['duskball', '다크볼', 40],
		['dreamball', '드림볼', 50], ['beastball', '울트라볼', 60], ['cherishball', '프레셔스볼', 70], ['masterball', '마스터볼', 100]] as [string, string, number][])
		.map(([b, n, p]) => ({ id: 'ball:' + b, slot: 'ball' as Slot, name: n, price: p, v: b })),
	// 승리 연출
	{ id: 'win:confetti', slot: 'win', name: '도트 꽃가루', price: 50, desc: '네모난 꽃가루가 쏟아짐' },
	{ id: 'win:stars', slot: 'win', name: '반짝이는 별', price: 50, desc: '화면 가득 별이 반짝임' },
	{ id: 'win:flag', slot: 'win', name: '승리 깃발', price: 60, desc: '승리 깃발이 내려옴' },
	// HP 창 테마
	{ id: 'hp:ruby', slot: 'hp', name: '루비', price: 40, v: '#6a1a2a,#4a0e1a' },
	{ id: 'hp:sapphire', slot: 'hp', name: '사파이어', price: 40, v: '#1a2a6a,#0e1a4a' },
	{ id: 'hp:emerald', slot: 'hp', name: '에메랄드', price: 40, v: '#1a5a3a,#0e3a24' },
	{ id: 'hp:gold', slot: 'hp', name: '골드', price: 60, v: '#6a5014,#4a380a' },
	{ id: 'hp:crystal', slot: 'hp', name: '크리스탈', price: 60, v: '#2a6a7a,#1a4454' },
	// 배틀 배경 · 음악 (새로 그리고 작곡한 것 — 기존 배경·음악은 계속 무료)
	{ id: 'bg:sunset', slot: 'bg', name: '노을 언덕', price: 80, v: 'sunset' },
	{ id: 'bg:starry', slot: 'bg', name: '별빛 호수', price: 100, v: 'starry' },
	{ id: 'bgm:g3sunset', slot: 'bgm', name: '노을 언덕', price: 80, v: 'g3sunset', desc: '라장조 · 시원하게 달리는 곡' },
	{ id: 'bgm:g3star', slot: 'bgm', name: '별빛 결전', price: 100, v: 'g3star', desc: '마단조 · 몰아치는 곡' },
	{ id: 'bg:sakura', slot: 'bg', name: '벚꽃 정원', price: 80, v: 'sakura' },
	{ id: 'bg:desert', slot: 'bg', name: '사막 유적', price: 90, v: 'desert' },
	{ id: 'bg:aurora', slot: 'bg', name: '오로라 설원', price: 120, v: 'aurora' },
	{ id: 'bgm:g3sakura', slot: 'bgm', name: '벚꽃 정원', price: 80, v: 'g3sakura', desc: '바장조 · 산책하듯 밝은 곡' },
	{ id: 'bgm:g3desert', slot: 'bgm', name: '사막 유적', price: 90, v: 'g3desert', desc: '라단조 · 이국적인 곡' },
	{ id: 'bgm:g3aurora', slot: 'bgm', name: '오로라', price: 120, v: 'g3aurora', desc: '나단조 · 웅장한 결전 곡' },
	// 트레이너 모습 (일반 트레이너군 — 네임드 인물 제외)
	...trainerItems(),
];
function trainerItems(): Item[] {
	const out: Item[] = [];
	const seen = new Set<string>();
	for (const c of (TRAINER_CLASSES as any).classes as any[]) {
		for (const [list, sex] of [[c.sprites_m, '♂'], [c.sprites_f, '♀']] as [string[], string][]) {
			const sp = list?.[0]; if (!sp || seen.has(sp)) continue;
			seen.add(sp);
			const both = c.sprites_m?.length && c.sprites_f?.length;
			out.push({ id: 'tr:' + sp, slot: 'trainer', name: c.name + (both ? ' ' + sex : ''), price: 30 + (out.length % 4) * 10, v: sp });
			if (out.length >= 48) return out;
		}
	}
	return out;
}
export const itemById = (id: string) => ITEMS.find(i => i.id === id);
/** 가졌는지: 산 것 + 조건을 채운 업적 전용 */
export function owns(it: Item, w = loadWallet(), s = loadStats()) { return !!w.own[it.id] || (!!it.cond && it.cond(s)); }
export function buy(it: Item): 'ok' | 'owned' | 'poor' | 'locked' {
	const w = loadWallet();
	if (owns(it, w)) return 'owned';
	if (it.price == null) return 'locked';
	if (w.bp < it.price) return 'poor';
	w.bp -= it.price; w.own[it.id] = 1; saveWallet(w);
	return 'ok';
}
/** 장착 (같은 칸의 다른 것은 풀림). 트레이너 모습은 설정의 주인공 모습으로 */
export function equip(it: Item | null, slot: Slot) {
	const w = loadWallet();
	if (slot === 'trainer') { if (it?.v) saveSettings({ ...loadSettings(), playerSprite: it.v }); return; }
	if (slot === 'bg') { if (it?.v) saveSettings({ ...loadSettings(), battleBg: it.v }); return; }
	if (slot === 'bgm') { if (it?.v) saveSettings({ ...loadSettings(), battleBgm: it.v }); return; }
	if (it) w.eq[slot] = it.id; else delete w.eq[slot];
	saveWallet(w);
}
export function equipped(slot: Slot): Item | undefined { const id = loadWallet().eq[slot]; return id ? itemById(id) : undefined; }
export const titleText = () => equipped('title')?.name || '';
/** 산 트레이너 모습·배경·음악 (설정 고르기 목록에 더함) */
export const ownedVals = (slot: Slot) => { const w = loadWallet(); return ITEMS.filter(i => i.slot === slot && w.own[i.id]).map(i => ({ v: i.v!, name: i.name })); };

// ───────── 업적·기록 전용 표시 (자동) ─────────
/** 정복한 지방 배지 (★★ 는 금색) */
export function regionBadges(s = loadStats()) { return REGIONS.filter(r => r !== '애니메이션' && s.conquest[r]).map(r => ({ region: r, gold: s.conquest[r] === 2 })); }
/** 단짝: 100승 이상 포켓몬 중 가장 많이 이긴 포켓몬 */
export function partnerMon(s = loadStats()) { let best: string | null = null, w = 99; for (const [k, m] of Object.entries(s.mons)) if (m.w > w) { w = m.w; best = k; } return best; }
/** 수첩 표지 색: 도감(써 본 포켓몬) 25·50·75% */
export function bookCover(s = loadStats()) { const p = dexPct(s); return p >= 75 ? 'gold' : p >= 50 ? 'silver' : p >= 25 ? 'bronze' : ''; }

// ───────── 주간 과제 (매주 월요일, 모두 같은 과제) ─────────
interface Mission { id: string; text: string; goal: number; bp: number }
const TYPES = ['Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Dragon', 'Dark', 'Fighting', 'Steel', 'Fairy', 'Ghost', 'Ground', 'Ice', 'Flying', 'Bug', 'Rock', 'Poison', 'Normal'];
function weekNo(now = new Date()) {
	const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7);
	return Math.floor((mon.getTime() - new Date(2026, 0, 5).getTime()) / (7 * 864e5)) + 1;
}
export function weeklyMissions(no = weekNo()): Mission[] {
	let h = no * 2654435761 >>> 0; const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
	const t = TYPES[Math.floor(r() * TYPES.length)];
	const pool: Mission[] = [
		{ id: 'type:' + t, text: `${typeKo(t)} 타입 포켓몬이 참가해 ${5}승`, goal: 5, bp: 15 },
		{ id: 'doubles', text: '더블 배틀 10판', goal: 10, bp: 15 },
		{ id: 'facility', text: '시설(타워·팩토리·팰리스·일필도)에서 14연승', goal: 14, bp: 20 },
		{ id: 'wins', text: '아무 배틀 20승', goal: 20, bp: 15 },
		{ id: 'ko', text: '상대 포켓몬 40마리 쓰러뜨리기', goal: 40, bp: 15 },
		{ id: 'crit', text: '급소 10번 맞히기', goal: 10, bp: 10 },
		{ id: 'perfect', text: '한 마리도 쓰러지지 않고 3승', goal: 3, bp: 20 },
		{ id: 'named', text: '네임드·PWT·보스 러시 상대에게 5승', goal: 5, bp: 15 },
	];
	const out: Mission[] = [pool[0]];
	const rest = pool.slice(1);
	while (out.length < 3) out.push(rest.splice(Math.floor(r() * rest.length), 1)[0]);
	return out;
}
export const WEEK_ALL_BP = 20;
function weekState(w: Wallet) { const id = 'W' + weekNo(); if (w.week.id !== id) w.week = { id, prog: {}, got: {} }; return w.week; }
export function weeklyStatus() { const w = loadWallet(); const wk = weekState(w); return weeklyMissions().map(m => ({ ...m, prog: Math.min(m.goal, wk.prog[m.id] || 0), done: !!wk.got[m.id] })); }
function weeklyFromBattle(setup: any, battle: any, win: boolean) {
	const w = loadWallet(); const wk = weekState(w);
	const ms = weeklyMissions();
	const f = analyze(setup, battle, win);
	const label: string = setup.label || '';
	const add = (id: string, n: number) => { if (ms.some(m => m.id === id) && n > 0) wk.prog[id] = (wk.prog[id] || 0) + n; };
	const myTypes = new Set(Object.keys(f.mine).flatMap(sid => speciesData(sid, 9)?.t || []));
	for (const m of ms) if (m.id.startsWith('type:') && win && myTypes.has(m.id.slice(5))) add(m.id, 1);
	if (setup.doubles) add('doubles', 1);
	if (FACILITY.test(label)) { if (win) add('facility', 1); else if (ms.some(m => m.id === 'facility') && !wk.got.facility) wk.prog.facility = 0; }
	if (win) add('wins', 1);
	add('ko', f.kos); add('crit', f.crits);
	if (f.perfect) add('perfect', 1);
	if (win && !FACILITY.test(label) && !/^(프리|랭크|오늘의)/.test(label)) add('named', 1);
	const earned: [number, string][] = [];
	for (const m of ms) if (!wk.got[m.id] && (wk.prog[m.id] || 0) >= m.goal) { wk.got[m.id] = 1; earned.push([m.bp, '주간 과제']); }
	if (earned.length && ms.every(m => wk.got[m.id]) && !wk.got.all) { wk.got.all = 1; earned.push([WEEK_ALL_BP, '주간 과제 모두']); }
	saveWallet(w);
	for (const [n, why] of earned) earnBP(n, why);
}
void toID;
