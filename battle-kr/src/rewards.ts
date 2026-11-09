/** 보상 시스템: BP(배틀 포인트) 지갑 · 얻는 규칙 · 교환소 상품 · 업적 전용 보상 · 주간 과제.
 *  보상은 모두 꾸미기·기록 표시용 (배틀 능력에는 영향 없음 — 온라인 대전 공정성).
 *  저장: localStorage pkbkr:wallet */
import { load, save, loadRecords, loadSettings, saveSettings } from './store';
import { onBattleEnd } from './battle-hooks';
import { loadStats, analyze, setAchHook, type Stats } from './stats';
import { speciesData, toID, RAW, typeKo } from './data';
import TRAINER_CLASSES from './gen/trainer-classes.json';
import { REGIONS, NAMED, namedSprite } from './trainers';
import { PLAYER_SPRITES } from './trainer-lines';

// ───────── 지갑 ─────────
export interface Wallet {
	bp: number; total: number;
	/** 산 상품 */ own: { [id: string]: 1 };
	/** 장착: 칸(slot) → 상품 id */ eq: { [slot: string]: string };
	/** 쉬움 난이도 반 BP 누적 */ frac: number;
	/** 온라인 대전 하루 상한 */ onDay: string; onN: number;
	/** 일일 미션: 날 id · 진행 · 받은 보상 (예전 이름 그대로 week) */ week: { id: string; prog: { [k: string]: number }; got: { [k: string]: 1 } };
	/** 최근 얻은 내역 */ log: { t: number; n: number; why: string }[];
	/** 대표 포켓몬 (메인 화면) */ buddy?: { sp: string; shiny?: boolean };
}
const WKEY = 'wallet';
const emptyWallet = (): Wallet => ({ bp: 0, total: 0, own: {}, eq: {}, frac: 0, onDay: '', onN: 0, week: { id: '', prog: {}, got: {} }, log: [] });
export function loadWallet(): Wallet { return { ...emptyWallet(), ...load<Partial<Wallet>>(WKEY, {}) }; }
function saveWallet(w: Wallet) { save(WKEY, w); listeners.forEach(f => f(w)); }
const listeners = new Set<(w: Wallet) => void>();
/** v2.61: 볼·승리 연출 상품을 없애면서 산 BP 를 돌려줌 (한 번) */
const GONE: { [id: string]: number } = { 'ball:greatball': 20, 'ball:ultraball': 30, 'ball:premierball': 30, 'ball:luxuryball': 40, 'ball:duskball': 40, 'ball:dreamball': 50, 'ball:beastball': 60, 'ball:cherishball': 70, 'ball:masterball': 100, 'win:confetti': 50, 'win:stars': 50, 'win:flag': 60 };
(function refundGone() {
	const w = loadWallet(); let n = 0;
	for (const id in w.own) if (id in GONE) { n += GONE[id]; delete w.own[id]; }
	const eq = w.eq.ball || w.eq.win; delete w.eq.ball; delete w.eq.win;
	if (n || eq) { w.bp += n; save(WKEY, w); }
})();
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
	dailyFromBattle(setup, battle, win);
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
export type Slot = 'title' | 'cardBg' | 'frame' | 'star' | 'trainer' | 'hp' | 'bg' | 'bgm' | 'home' | 'buddy';
export interface Item {
	id: string; slot: Slot; name: string; price?: number; desc?: string;
	/** 업적 전용: 조건을 채우면 공짜로 열림 (BP 로 못 삼) */ cond?: (s: Stats) => boolean; condText?: string;
	/** 미리보기용 값 (색·그림 id 등) */ v?: string;
	/** 교환소 안 묶음 이름 */ grp?: string;
}
export const SLOT_INFO: { [k in Slot]: { name: string; desc: string } } = {
	title: { name: '칭호', desc: '수첩 카드·메인·온라인 대전 이름 밑에' },
	cardBg: { name: '카드 배경', desc: '트레이너 카드 바탕' },
	frame: { name: '카드 테두리', desc: '트레이너 카드 도트 테두리' },
	star: { name: '별 모양', desc: '트레이너 카드 등급 표시' },
	trainer: { name: '트레이너 모습', desc: '주인공 모습에 추가' },
	hp: { name: 'HP 창 테마', desc: '배틀 HP 창 색' },
	bg: { name: '배틀 배경', desc: '배경 고르기에 추가' },
	bgm: { name: '배틀 음악', desc: '음악 고르기에 추가' },
	home: { name: '메인 배경', desc: '메인 화면·메뉴 뒤 배경 (설정의 메인 배경에도 추가)' },
	buddy: { name: '대표 포켓몬', desc: '메인 트레이너 카드 옆에 서 있는 포켓몬' },
};
const symGold = (s: Stats) => s.sym.tower === 2 || s.sym.factory === 2 || s.sym.rank === 2;
const ippitsu49 = () => Object.entries(loadRecords().best).some(([k, v]) => k.startsWith('ippitsu') && (v as number) >= 49);
const regionsAll = (s: Stats) => REGIONS.filter(r => r !== '애니메이션').every(r => s.conquest[r]);
const dexTotal = () => new Set(Object.values(RAW.species as any).map((x: any) => x.num).filter((n: number) => n > 0)).size || 1025;
export const dexPct = (s: Stats) => Object.keys(s.used).length / dexTotal() * 100;

/** 칭호: v = 띠 색(#hex) 또는 'type:Water'(타입 색), grp = 교환소 묶음 */
const T = (id: string, name: string, price: number, v = '#f0c040', desc = ''): Item => ({ id: 't:' + id, slot: 'title', name, price, desc, v, grp: '교환 칭호' });
const TX = (id: string, name: string, condText: string, cond: (s: Stats) => boolean, v = '#f0c040', grp = '업적 칭호'): Item => ({ id: 't:' + id, slot: 'title', name, cond, condText, v, grp });
const TYPES_ALL = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
const recWins = () => loadRecords().wins || 0;
const achCount = (s: Stats) => Object.values(s.ach).filter(v => v > 0).length;
const gimCnt = (s: Stats, g: string) => s.c['gim:' + g] || 0;
const TYPE_TITLES: Item[] = [
	...TYPES_ALL.map(t => TX('gym:' + t, `${typeKo(t)} 타입 체육관 관장`, `${typeKo(t)} 타입 포켓몬으로 50승`, s => (s.c['typeWin:' + t] || 0) >= 50, 'type:' + t, '체육관 관장')),
	...TYPES_ALL.map(t => TX('e4:' + t, `${typeKo(t)} 타입 사천왕`, `${typeKo(t)} 타입 포켓몬으로 150승`, s => (s.c['typeWin:' + t] || 0) >= 150, 'type:' + t, '사천왕')),
];
/** 트레이너 모습: 일반 트레이너군 · 네임드 트레이너(지방별) · 그 밖의 인물 (기본 주인공은 무료라 제외) */
const OTHER_PEOPLE: [string, string][] = [
	['lillie', '릴리에'], ['lillie-z', '릴리에 (Z)'], ['hau', '하우'], ['gladion', '글라디오'], ['lusamine', '루자미네'], ['hop', '호프'], ['sonia', '소니아'],
	['penny', '보탄'], ['cheren', '체렌'], ['bianca', '벨'], ['wally', '민진'], ['barry', '용식'], ['shauna', '사나'], ['tierno', '티에르노'], ['trevor', '트로바'],
	['oak', '오박사'], ['elm', '공박사'], ['birch', '털보박사'], ['rowan', '마박사'], ['juniper', '주박사'], ['sycamore', '플라타느 박사'], ['kukui', '쿠쿠이 박사'],
	['burnet', '버넷 박사'], ['magnolia', '매그놀리아 박사'], ['sada', '팔데아 박사 (스칼렛)'], ['turo', '팔데아 박사 (바이올렛)'],
	['ash', '지우'], ['ash-alola', '지우 (알로라)'], ['anabel', '리라'], ['az', 'AZ'], ['ingo', '노보리'], ['emmet', '클라우드'], ['rei', '영빈'], ['akari', '윤슬'], ['nurse', '간호순'],
];
const ROLE_PRICE: { [r: string]: number } = { leader: 60, elite: 80, champion: 100, hero: 60, rival: 60, admin: 60, boss: 80 };
/** 기본 칭호 (아무것도 안 골랐을 때 자동으로 붙음) */
export const DEFAULT_TITLE = 't:rookie';
export const ITEMS: Item[] = [
	// 칭호
	{ id: DEFAULT_TITLE, slot: 'title', name: '신참 트레이너', cond: () => true, condText: '기본 칭호', v: '#f4f4f4', grp: '기본' },
	T('ace', '엘리트 트레이너', 40), T('veteran', '베테랑', 60, '#b8a070'), T('strategist', '전략가', 50, '#7a9ae8'),
	T('collector', '포켓몬 수집가', 40, '#e89a5a'), T('weather', '날씨의 지배자', 50, '#5ac8e8'), T('sweeper', '스위퍼', 60, '#e85a5a'),
	T('wall', '철벽 수비', 50, '#9aa4b0'), T('gimmick', '기믹 마스터', 60, '#c87ae8'), T('lucky', '행운아', 30, '#7ad87a'), T('legend', '살아 있는 전설', 80, '#ffd84a'),
	T('breeder', '포켓몬 브리더', 40, '#f8a8c8'), T('ranger', '포켓몬 레인저', 40, '#5ab85a'), T('tamer', '드래곤 조련사', 60, '#7a6ae8'),
	T('battlegirl', '배틀 마니아', 40, '#e8784a'), T('scholar', '포켓몬 박사 조수', 40, '#d8d0b0'), T('wanderer', '방랑 트레이너', 50, '#a88a6a'),
	T('rival', '영원한 라이벌', 70, '#4a8ae8'), T('ninja', '닌자 보이', 50, '#6a5a8a'), T('idol', '포켓몬 아이돌', 60, '#ff8ae0'),
	// 업적 칭호
	TX('win100', '백승 트레이너', '모든 모드 합쳐 100승', () => recWins() >= 100, '#c0c8d8'),
	TX('win500', '오백승 트레이너', '모든 모드 합쳐 500승', () => recWins() >= 500, '#e8c050'),
	TX('win1000', '천승의 왕', '모든 모드 합쳐 1000승', () => recWins() >= 1000, '#ff6a3a'),
	TX('ko500', '격파왕', '상대 포켓몬 500마리 쓰러뜨림', s => (s.c.ko || 0) >= 500, '#e85a5a'),
	TX('se150', '상성 박사', '효과가 굉장한 공격 150회', s => (s.c.se || 0) >= 150, '#5ad85a'),
	TX('critical', '급소 사냥꾼', '급소에 50회 맞힘', s => (s.c.crit || 0) >= 50, '#ffa83a'),
	TX('perfect', '무결점', '하나도 안 쓰러지고 50승', s => (s.c.perfect || 0) >= 50, '#f8f8ff'),
	TX('sweep6', '일당백', '한 마리로 상대 6마리를 모두 쓰러뜨리고 승리', s => (s.c.sweep6 || 0) >= 1, '#d84a4a'),
	TX('comeback', '역전의 명수', '1 대 3 이상에서 역전승 5회', s => (s.c.comeback || 0) >= 5, '#4ac8a8'),
	TX('marathon', '끈기의 화신', '50턴 넘는 배틀에서 승리', s => (s.c.marathon || 0) >= 1, '#8a9a6a'),
	TX('mega', '메가진화 마스터', '메가진화 150회', s => gimCnt(s, 'mega') >= 150, '#e8a0f0'),
	TX('tera', '테라스탈 마스터', '테라스탈 150회', s => gimCnt(s, 'tera') >= 150, '#6ae0f0'),
	TX('zmove', 'Z 마스터', 'Z기술 150회', s => gimCnt(s, 'z') >= 150, '#ffd84a'),
	TX('dmax', '다이맥스 마스터', '다이맥스 150회', s => gimCnt(s, 'dmax') >= 150, '#ff5a7a'),
	TX('daily', '개근 트레이너', '오늘의 도전 30일 연속', s => (s.c.dailyStreakMax || 0) >= 30, '#8ad8ff'),
	TX('achiever', '업적 수집가', '업적 30개 달성', s => achCount(s) >= 30, '#d0b0ff'),
	TX('dexmaster', '도감 박사', '도감(써 본 포켓몬) 50%', s => dexPct(s) >= 50, '#e85050'),
	TX('dexall', '포켓몬 마스터', '도감(써 본 포켓몬) 90%', s => dexPct(s) >= 90, '#ffd84a'),
	// 프런티어·리그
	TX('towerS', '배틀타워 도전자', '배틀타워 은 심볼', s => !!s.sym.tower, '#c8d0e0', '프런티어'),
	TX('tactics', '택틱스 마스터', '배틀타워 금 심볼', s => s.sym.tower === 2, '#3a6df0', '프런티어'),
	TX('factoryS', '배틀팩토리 도전자', '배틀팩토리 은 심볼', s => !!s.sym.factory, '#c8d0e0', '프런티어'),
	TX('knowledge', '날리지 마스터', '배틀팩토리 금 심볼', s => s.sym.factory === 2, '#e0812b', '프런티어'),
	TX('rankS', '랭크 강자', '랭크 은 심볼', s => !!s.sym.rank, '#c8d0e0', '프런티어'),
	TX('champion', '시즌 챔피언', '랭크 시즌을 챔피언급으로 마감', s => s.sym.rank === 2, '#b8283a', '프런티어'),
	TX('brain', '프런티어 브레인', '금 심볼 3개', s => s.sym.tower === 2 && s.sym.factory === 2 && s.sym.rank === 2, '#ffd84a', '프런티어'),
	TX('ippitsu', '한 마리의 전설', '일필도 49연승', () => ippitsu49(), '#c82a4a', '프런티어'),
	...REGIONS.filter(r => r !== '애니메이션').map(r => TX('reg:' + r, `${r} 챔피언`, `${r} 지방 클리어`, s => !!s.conquest[r], 'reg:' + r, '지방 챔피언')),
	TX('conqueror', '올클리어 트레이너', '모든 지방 클리어', regionsAll, '#ffd84a', '지방 챔피언'),
	...TYPE_TITLES,
	// 카드 배경 (3~4단 색 띠)
	{ id: 'cb:sunset', slot: 'cardBg', name: '노을', price: 20, v: '#e86a3a,#c84a4a,#7a3a6a,#3a2a5a' },
	{ id: 'cb:forest', slot: 'cardBg', name: '숲', price: 20, v: '#5aa84a,#3a8a3a,#2a6a3a,#1a4a2a' },
	{ id: 'cb:deep', slot: 'cardBg', name: '심해', price: 30, v: '#2a8ac8,#1a5a9a,#1a3a6a,#0e2244' },
	{ id: 'cb:night', slot: 'cardBg', name: '밤하늘', price: 30, v: '#3a3a8a,#2a2a6a,#1a1a4a,#0e0e2a' },
	{ id: 'cb:sakura', slot: 'cardBg', name: '벚꽃', price: 40, v: '#f8b8d0,#e888b0,#c86a98,#9a4a7a' },
	{ id: 'cb:mono', slot: 'cardBg', name: '흑백', price: 40, v: '#8a8a8a,#6a6a6a,#4a4a4a,#2a2a2a' },
	{ id: 'cb:yume', slot: 'cardBg', name: '솜사탕 꿈나라', price: 50, v: '#d4bcf6,#f0c8ee,#fcd2e4,#d8f0e8' },
	{ id: 'cb:yami', slot: 'cardBg', name: '한밤의 하트', price: 50, v: '#3e1450,#2a103e,#1a0c2a,#681a68' },
	{ id: 'cb:menhera', slot: 'cardBg', name: '분홍 처방전', price: 50, v: '#ffe4ee,#ffcce2,#f8b4d6,#fff8fc' },
	{ id: 'cb:eternamax', slot: 'cardBg', name: '무한다이맥스', cond: () => ippitsu49(), condText: '일필도 49연승', v: '#c82a4a,#8a1a3a,#4a0e2a,#1a0614' },
	{ id: 'cb:gold', slot: 'cardBg', name: '황금', cond: s => s.sym.tower === 2 && s.sym.factory === 2 && s.sym.rank === 2, condText: '금 심볼 3개', v: '#f8d84a,#e0b030,#b8862a,#7a5418' },
	// 카드 테두리 (진한 외곽선 · 밝은 안쪽 선)
	{ id: 'fr:ruby', slot: 'frame', name: '루비', price: 30, v: '#5a0a1a,#ff6a7a' },
	{ id: 'fr:sapphire', slot: 'frame', name: '사파이어', price: 30, v: '#0a1a5a,#6aa8ff' },
	{ id: 'fr:emerald', slot: 'frame', name: '에메랄드', price: 30, v: '#0a3a1a,#6ae88a' },
	{ id: 'fr:yume', slot: 'frame', name: '솜사탕 꿈나라', price: 40, v: '#8a6ac8,#ffd8f0' },
	{ id: 'fr:yami', slot: 'frame', name: '한밤의 하트', price: 40, v: '#0e0816,#ff4aa0' },
	{ id: 'fr:menhera', slot: 'frame', name: '분홍 처방전', price: 40, v: '#e070a8,#ffffff' },
	{ id: 'fr:silver', slot: 'frame', name: '은 심볼', cond: s => !!(s.sym.tower || s.sym.factory || s.sym.rank), condText: '아무 심볼(은) 하나', v: '#2a3040,#e8eef8' },
	{ id: 'fr:gold', slot: 'frame', name: '금 심볼', cond: symGold, condText: '아무 심볼(금) 하나', v: '#4a3008,#ffd84a' },
	// 별 모양
	{ id: 'st:diamond', slot: 'star', name: '다이아', price: 20, v: '◆' },
	{ id: 'st:heart', slot: 'star', name: '하트', price: 20, v: '♥' },
	{ id: 'st:club', slot: 'star', name: '클로버', price: 20, v: '♣' },
	{ id: 'st:spade', slot: 'star', name: '스페이드', price: 20, v: '♠' },
	// HP 창 테마
	{ id: 'hp:ruby', slot: 'hp', name: '루비', price: 40, v: 'ruby', desc: '보석 결 무늬' },
	{ id: 'hp:sapphire', slot: 'hp', name: '사파이어', price: 40, v: 'sapphire', desc: '물결 무늬' },
	{ id: 'hp:emerald', slot: 'hp', name: '에메랄드', price: 40, v: 'emerald', desc: '마름모 무늬' },
	{ id: 'hp:crystal', slot: 'hp', name: '크리스탈', price: 50, v: 'crystal', desc: '사선 결 · 반짝임' },
	{ id: 'hp:gold', slot: 'hp', name: '골드', price: 60, v: 'gold', desc: '새김 줄 · 빛 지나감' },
	{ id: 'hp:metal', slot: 'hp', name: '메탈', price: 60, v: 'metal', desc: '강철 결 · 빛 지나감' },
	{ id: 'hp:sakura', slot: 'hp', name: '벚꽃', price: 70, v: 'sakura', desc: '꽃 무늬 · 꽃잎 날림' },
	{ id: 'hp:night', slot: 'hp', name: '밤하늘', price: 70, v: 'night', desc: '별 무늬 · 별 반짝임' },
	{ id: 'hp:electric', slot: 'hp', name: '번개', price: 80, v: 'electric', desc: '번개 무늬 · 번쩍임' },
	{ id: 'hp:lava', slot: 'hp', name: '용암', price: 90, v: 'lava', desc: '갈라진 바위 · 불똥 솟음' },
	{ id: 'hp:yume', slot: 'hp', name: '솜사탕 꿈나라', price: 70, v: 'yume', desc: '하트 무늬 · 하트가 떠오름' },
	{ id: 'hp:yami', slot: 'hp', name: '한밤의 하트', price: 70, v: 'yami', desc: '하트 무늬 · 분홍 별 반짝임' },
	{ id: 'hp:menhera', slot: 'hp', name: '분홍 처방전', price: 70, v: 'menhera', desc: '알약 무늬 · 알약이 내려옴' },
	{ id: 'hp:rainbow', slot: 'hp', name: '무지개', price: 120, v: 'rainbow', desc: '여섯 빛깔 띠 · 빛 지나감' },
	// 배틀 배경 · 음악 (새로 그리고 작곡한 것 — 기존 배경·음악은 계속 무료)
	{ id: 'bg:sunset', slot: 'bg', name: '노을 언덕', price: 80, v: 'sunset' },
	{ id: 'bg:starry', slot: 'bg', name: '별빛 호수', price: 100, v: 'starry' },
	{ id: 'bgm:g3sunset', slot: 'bgm', name: '노을 언덕', price: 80, v: 'g3sunset', desc: '라장조 · 느긋한 셔플 휘파람' },
	{ id: 'bgm:g3star', slot: 'bgm', name: '별빛 결전', price: 100, v: 'g3star', desc: '마단조 · 몰아치는 록' },
	{ id: 'bg:sakura', slot: 'bg', name: '벚꽃 정원', price: 80, v: 'sakura' },
	{ id: 'bg:desert', slot: 'bg', name: '사막 유적', price: 90, v: 'desert' },
	{ id: 'bg:aurora', slot: 'bg', name: '오로라 설원', price: 120, v: 'aurora' },
	{ id: 'bgm:g3sakura', slot: 'bgm', name: '벚꽃 정원', price: 80, v: 'g3sakura', desc: '다섯 음 요 음계 · 코토처럼 튕기는 곡' },
	{ id: 'bgm:g3desert', slot: 'bgm', name: '사막 유적', price: 90, v: 'g3desert', desc: '이국적인 음계 · 타블라 리듬' },
	{ id: 'bgm:g3aurora', slot: 'bgm', name: '오로라', price: 120, v: 'g3aurora', desc: '나단조 · 반짝이는 하프타임' },
	{ id: 'bg:deepsea', slot: 'bg', name: '해저 신전', price: 120, v: 'deepsea', desc: '빛줄기 · 거품이 올라옴' },
	{ id: 'bg:skypillar', slot: 'bg', name: '구름 위 탑', price: 120, v: 'skypillar', desc: '구름 바다가 흘러감' },
	{ id: 'bg:neon', slot: 'bg', name: '네온 시티', price: 120, v: 'neon', desc: '창 불빛 · 밤비' },
	{ id: 'bg:yume', slot: 'bg', name: '솜사탕 꿈나라', price: 120, v: 'yume', desc: '하트·별이 떠오르고 구름이 흐름' },
	{ id: 'bg:yami', slot: 'bg', name: '한밤의 하트', price: 120, v: 'yami', desc: '분홍 별 반짝임 · 하트가 떠오름' },
	{ id: 'bg:menhera', slot: 'bg', name: '분홍 처방전', price: 120, v: 'menhera', desc: '알약·십자가 흩날림' },
	{ id: 'bgm:g3deepsea', slot: 'bgm', name: '해저 신전', price: 120, v: 'g3deepsea', desc: '레 도리안 · 느리게 일렁이는 곡' },
	{ id: 'bgm:g3skypillar', slot: 'bgm', name: '구름 위 탑', price: 120, v: 'g3skypillar', desc: '내림나장조 · 금관 행진곡' },
	{ id: 'bgm:g3neon', slot: 'bgm', name: '네온 시티', price: 120, v: 'g3neon', desc: '가단조 · 신스 펑크' },
	{ id: 'bgm:g3yume', slot: 'bgm', name: '솜사탕 꿈나라', price: 120, v: 'g3yume', desc: '3/4 왈츠 · 오르골' },
	{ id: 'bgm:g3yami', slot: 'bgm', name: '한밤의 하트', price: 120, v: 'g3yami', desc: '다단조 · 스윙 장난감 피아노' },
	{ id: 'bgm:g3menhera', slot: 'bgm', name: '분홍 처방전', price: 120, v: 'g3menhera', desc: '가장조 · 빠른 전파 팝' },
	// 트레이너 모습 (일반 트레이너군 — 네임드 인물 제외)
	...trainerItems(),
];
function trainerItems(): Item[] {
	const out: Item[] = [];
	const seen = new Set<string>(PLAYER_SPRITES.map(p => p.id));
	let n = 0;
	for (const c of (TRAINER_CLASSES as any).classes as any[]) {
		if (n >= 48) break;
		for (const [list, sex] of [[c.sprites_m, '♂'], [c.sprites_f, '♀']] as [string[], string][]) {
			const sp = list?.[0]; if (!sp || seen.has(sp) || n >= 48) continue;
			seen.add(sp);
			const both = c.sprites_m?.length && c.sprites_f?.length;
			out.push({ id: 'tr:' + sp, slot: 'trainer', name: c.name + (both ? ' ' + sex : ''), price: 30 + (n % 4) * 10, v: sp, grp: '일반 트레이너' });
			n++;
		}
	}
	for (const r of REGIONS) for (const t of NAMED.filter(t => t.region === r)) {
		const sp = namedSprite(t); if (seen.has(sp)) continue;
		seen.add(sp);
		out.push({ id: 'tr:' + sp, slot: 'trainer', name: t.name, desc: t.title, price: ROLE_PRICE[t.role] || 60, v: sp, grp: r === '애니메이션' ? '네임드 · 애니메이션' : '네임드 · ' + r });
	}
	for (const [sp, name] of OTHER_PEOPLE) { if (seen.has(sp)) continue; seen.add(sp); out.push({ id: 'tr:' + sp, slot: 'trainer', name, price: 50, v: sp, grp: '그 밖의 인물' }); }
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
	if (slot === 'home') { const v = it?.v || 'title'; saveSettings({ ...loadSettings(), homeBg: v }); document.documentElement.setAttribute('data-bg', v); return; }
	if (slot === 'title' && !it) { if (!w.eq.title || w.eq.title === DEFAULT_TITLE) w.eq.title = '-'; else delete w.eq.title; saveWallet(w); return; }
	if (it) w.eq[slot] = it.id; else delete w.eq[slot];
	saveWallet(w);
}
/** 대표 포켓몬 고르기 (자리를 산 뒤) */
export function setBuddy(sp: string | null, shiny = false) { const w = loadWallet(); if (sp) w.buddy = { sp, shiny }; else delete w.buddy; saveWallet(w); }
/** 대표 포켓몬 후보: 써 본 포켓몬(많이 이긴 순) + 저장한 팀의 포켓몬 */
export function buddyCandidates(teams: { sets: { species: string }[] }[]): string[] {
	const st = loadStats();
	const used = Object.entries(st.mons).sort((a, b) => b[1].w - a[1].w || b[1].u - a[1].u).map(([k]) => k);
	const fromTeams = teams.flatMap(t => t.sets.map(s => toID(s.species)));
	return [...new Set([...used, ...fromTeams])].filter(id => speciesData(id, 9)).slice(0, 72);
}
export function equipped(slot: Slot): Item | undefined { const id = loadWallet().eq[slot]; return id ? itemById(id) : undefined; }
/** 지금 칭호: 고른 것 → 없으면 기본 칭호 ('-' 는 칭호 숨김) */
export function titleItem(w = loadWallet()): Item | undefined { const id = w.eq.title || DEFAULT_TITLE; return id === '-' ? undefined : itemById(id); }
export const titleText = () => titleItem()?.name || '';
/** 산 트레이너 모습·배경·음악 (설정 고르기 목록에 더함) */
export const ownedVals = (slot: Slot) => { const w = loadWallet(); return ITEMS.filter(i => i.slot === slot && w.own[i.id]).map(i => ({ v: i.v!, name: i.name })); };

// ───────── 업적·기록 전용 표시 (자동) ─────────
/** 클리어한 지방 배지 (★★ 는 금색) */
export function regionBadges(s = loadStats()) { return REGIONS.filter(r => r !== '애니메이션' && s.conquest[r]).map(r => ({ region: r, gold: s.conquest[r] === 2 })); }
/** 단짝: 100승 이상 포켓몬 중 가장 많이 이긴 포켓몬 */
export function partnerMon(s = loadStats()) { let best: string | null = null, w = 99; for (const [k, m] of Object.entries(s.mons)) if (m.w > w) { w = m.w; best = k; } return best; }
/** 수첩 표지 색: 도감(써 본 포켓몬) 25·50·75% */
export function bookCover(s = loadStats()) { const p = dexPct(s); return p >= 75 ? 'gold' : p >= 50 ? 'silver' : p >= 25 ? 'bronze' : ''; }

// ───────── 일일 미션 (매일 자정, 모두 같은 미션) ─────────
interface Mission { id: string; text: string; goal: number; bp: number }
const TYPES = ['Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Dragon', 'Dark', 'Fighting', 'Steel', 'Fairy', 'Ghost', 'Ground', 'Ice', 'Flying', 'Bug', 'Rock', 'Poison', 'Normal'];
function dayNo(now = new Date()) { return Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(2026, 0, 5).getTime()) / 864e5); }
export function dailyMissions(no = dayNo()): Mission[] {
	let h = (no + 7919) * 2654435761 >>> 0; const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
	const t = TYPES[Math.floor(r() * TYPES.length)];
	const pool: Mission[] = [
		{ id: 'type:' + t, text: `${typeKo(t)} 타입 포켓몬이 참가해 1승`, goal: 1, bp: 3 },
		{ id: 'se', text: '효과가 굉장한 기술 5번 맞히기', goal: 5, bp: 3 },
		{ id: 'ko', text: '상대 포켓몬 6마리 쓰러뜨리기', goal: 6, bp: 3 },
		{ id: 'wins', text: '아무 배틀 3승', goal: 3, bp: 3 },
		{ id: 'battles', text: '배틀 3판 하기 (승패 상관없음)', goal: 3, bp: 2 },
		{ id: 'doubles', text: '더블 배틀 1판', goal: 1, bp: 2 },
		{ id: 'gimmick', text: '메가진화·테라스탈·Z기술·다이맥스 1번 쓰기', goal: 1, bp: 2 },
		{ id: 'named', text: '네임드·PWT·보스 러시 상대에게 1승', goal: 1, bp: 3 },
	];
	const out: Mission[] = [pool[0]];
	const rest = pool.slice(1);
	while (out.length < 3) out.push(rest.splice(Math.floor(r() * rest.length), 1)[0]);
	return out;
}
export const DAY_ALL_BP = 5;
function dayState(w: Wallet) { const id = 'D' + dayNo(); if (w.week.id !== id) w.week = { id, prog: {}, got: {} }; return w.week; }
export function dailyStatus() { const w = loadWallet(); const d = dayState(w); return dailyMissions().map(m => ({ ...m, prog: Math.min(m.goal, d.prog[m.id] || 0), done: !!d.got[m.id] })); }
function dailyFromBattle(setup: any, battle: any, win: boolean) {
	const w = loadWallet(); const d = dayState(w);
	const ms = dailyMissions();
	const f = analyze(setup, battle, win);
	const label: string = setup.label || '';
	const add = (id: string, n: number) => { if (ms.some(m => m.id === id) && n > 0) d.prog[id] = (d.prog[id] || 0) + n; };
	const myTypes = new Set(Object.keys(f.mine).flatMap(sid => speciesData(sid, 9)?.t || []));
	for (const m of ms) if (m.id.startsWith('type:') && win && myTypes.has(m.id.slice(5))) add(m.id, 1);
	if (setup.doubles) add('doubles', 1);
	if (win) add('wins', 1);
	add('ko', f.kos); add('se', f.se); add('battles', 1); add('gimmick', f.gim.length);
	if (win && !FACILITY.test(label) && !/^(프리|랭크|오늘의)/.test(label)) add('named', 1);
	const earned: [number, string][] = [];
	for (const m of ms) if (!d.got[m.id] && (d.prog[m.id] || 0) >= m.goal) { d.got[m.id] = 1; earned.push([m.bp, '일일 미션']); }
	if (earned.length && ms.every(m => d.got[m.id]) && !d.got.all) { d.got.all = 1; earned.push([DAY_ALL_BP, '일일 미션 모두']); }
	saveWallet(w);
	for (const [n, why] of earned) earnBP(n, why);
}
void toID;
