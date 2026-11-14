/** 기록과 통계: 포켓몬별 통계 · 내 도감(써 본·만난·쓰러뜨린) · 배틀 사건 카운터 · 프런티어 심볼 · 업적
 *  배틀이 끝나면 Showdown 배틀 기록(battle.log)을 읽어 셈. 저장: localStorage pkbkr:stats
 *  업적은 포켓몬 챔피언스(Serebii 업적 목록: 단계형 사다리 · 무기절 승리 · 타입별 승리 · 포켓몬별 승리)와 BW2 메달을 참고해 이 앱에 맞게 만듦 */
import { load, save, loadRecords, loadSettings } from './store';
import { onBattleEnd } from './battle-hooks';
import { toID, speciesData } from './data';
import { NAMED, CUPS } from './trainers';
import { toast } from './ui/core';

export interface MonStat { u: number; w: number; ko: number; f: number; mvp: number }
export type SymbolKind = 'tower' | 'factory' | 'rank';
export interface Stats {
	mons: { [sid: string]: MonStat };
	used: { [sid: string]: 1 }; faced: { [sid: string]: 1 }; beaten: { [sid: string]: 1 };
	c: { [k: string]: number };
	flags: { [k: string]: 1 };
	sym: { [k in SymbolKind]?: 1 | 2 };
	/** 난이도별 심볼 (쉬움·보통·어려움). sym 은 보통 이상에서 얻은 가장 높은 것 */ symD?: { [k in SymbolKind]?: { [d: string]: 1 | 2 } };
	/** 시나리오 러시 완주: 1 보통 · 2 어려움 */ bossClear?: { [id: string]: 1 | 2 };
	ach: { [id: string]: number };
	/** 랭크 시즌 기록 */
	seasons: { id: string; fmt: string; rp: number; tier: string }[];
	/** 오늘의 도전: 날짜 → 최고 승수, 연속 참가 */
	daily: { [date: string]: number }; dailyStreak: number; dailyLast: string;
	/** 지방 클리어: 지방 → 1 보통 · 2 어려움 클리어 / 보스 러시: 코스 → 최고 단계 */
	conquest: { [region: string]: 1 | 2 }; boss: { [course: string]: number };
}
const KEY = 'stats';
const empty = (): Stats => ({ mons: {}, used: {}, faced: {}, beaten: {}, c: {}, flags: {}, sym: {}, ach: {}, seasons: [], daily: {}, dailyStreak: 0, dailyLast: '', conquest: {}, boss: {} });
export function loadStats(): Stats { return { ...empty(), ...load<Partial<Stats>>(KEY, {}) }; }
export function updateStats(fn: (s: Stats) => void, check = true) { const s = loadStats(); fn(s); save(KEY, s); if (check) checkAchievements(); }
export const bump = (s: Stats, k: string, n = 1) => { s.c[k] = (s.c[k] || 0) + n; };
export const setMax = (s: Stats, k: string, v: number) => { s.c[k] = Math.max(s.c[k] || 0, v); };

/** 프런티어 심볼: 은(1) → 금(2) */
export function awardSymbol(kind: SymbolKind, gold: boolean, diff = 'normal') {
	let got = false;
	updateStats(s => { const v = gold ? 2 : 1, d = (s.symD ||= {})[kind] ||= {};
		if ((d[diff] || 0) < v) { d[diff] = v; got = true; }
		if (diff !== 'easy' && (s.sym[kind] || 0) < v) s.sym[kind] = v; });
	return got;
}
/** 난이도별 심볼 단계 (예전 기록의 심볼은 보통으로 침) */
export const symOf = (s: Stats, kind: SymbolKind, diff: string): number => s.symD?.[kind]?.[diff] || (diff === 'normal' && !s.symD?.[kind]?.hard ? s.sym[kind] || 0 : 0);
/** 보여 줄 대표 심볼: 가장 높은 난이도의 것 */
export const symBest = (s: Stats, kind: SymbolKind): { lv: number; diff: string } => { for (const d of ['hard', 'normal', 'easy']) { const lv = symOf(s, kind, d); if (lv) return { lv, diff: d }; } return { lv: 0, diff: 'normal' }; };
export const SYMBOL_INFO: { [k in SymbolKind]: { name: string; facility: string; color: string } } = {
	tower: { name: '택틱스 심볼', facility: '배틀타워', color: '#3a6df0' },
	factory: { name: '날리지 심볼', facility: '배틀팩토리', color: '#e0812b' },
	rank: { name: '챔피언 심볼', facility: '랭크 매치', color: '#b8283a' },
};

// ───────── 배틀 기록 읽기 ─────────
const WEATHERS = ['SunnyDay', 'RainDance', 'Sandstorm', 'Snow'];
const TERRAINS = ['Electric Terrain', 'Grassy Terrain', 'Misty Terrain', 'Psychic Terrain'];
function speciesOf(details: string) { return toID(details.split(',')[0]); }

export interface BattleFacts { win: boolean; turns: number; kos: number; myFaint: number; crits: number; se: number; perfect: boolean; oneHp: boolean; comeback: boolean; dko: boolean; sweep6: boolean; mvp?: string }
export function analyze(setup: any, battle: any, win: boolean): BattleFacts & { mine: { [sid: string]: { ko: number; f: number } }; oppSeen: string[]; oppFainted: string[]; gim: string[]; weathers: string[]; terrains: string[]; ohko: number; endure: number } {
	const log: string[] = battle.log || [];
	const who: { [ident: string]: string } = {};   // 'p1: 닉네임' → 처음 나온 종 (메가진화해도 원래 종으로)
	const mine: { [sid: string]: { ko: number; f: number } } = {};
	const oppSeen = new Set<string>(), oppFainted: string[] = [], gim: string[] = [], weathers: string[] = [], terrains: string[] = [];
	const nameOf = (id: string) => id.replace(/^(p\d)[a-d]?:\s*/, '$1: ');
	// 멀티배틀: 파트너(AI)의 포켓몬은 내 기록·업적에 넣지 않음 (엔진에서 kPartner 표시)
	const partner = new Set<string>(((battle.p1?.pokemon || []) as any[]).filter(p => p.kPartner).map(p => 'p1: ' + p.name));
	const mineId = (id: string) => id.startsWith('p1') && !partner.has(nameOf(id));
	const hp: { [ident: string]: number } = {};
	let lastMover = '', turn = 0, faintTurn = -1, faintsThisTurn = 0, dko = false, comeback = false;
	let myAlive = battle.p1?.pokemon?.length || 0, oppAlive = battle.p2?.pokemon?.length || 0;
	let crits = 0, se = 0, ohko = 0, endure = 0;
	for (let i = 0; i < log.length; i++) {
		let line = log[i];
		if (line.startsWith('|split|')) { i++; line = log[i + 1] ?? ''; i++; }   // 비공개 줄은 건너뛰고 공개 줄만
		const p = line.split('|');
		const cmd = p[1];
		if (cmd === 'turn') { turn = +p[2]; continue; }
		if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
			const id = nameOf(p[2]); const sp = speciesOf(p[3]);
			if (!who[id]) who[id] = sp;
			if (id.startsWith('p2')) oppSeen.add(who[id]);
			const m = /(\d+)\/(\d+)/.exec(p[4] || ''); if (m) hp[id] = +m[1] / +m[2];
			continue;
		}
		if (cmd === 'move') { lastMover = nameOf(p[2]); continue; }
		if (cmd === '-damage') { const id = nameOf(p[2]); const m = /^(\d+)\/(\d+)/.exec(p[3] || ''); const before = hp[id] ?? 1; const after = p[3]?.startsWith('0') ? 0 : m ? +m[1] / +m[2] : before;
			void before; hp[id] = after; continue; }
		if (cmd === '-heal') { const id = nameOf(p[2]); const m = /^(\d+)\/(\d+)/.exec(p[3] || ''); if (m) hp[id] = +m[1] / +m[2]; continue; }
		if (cmd === '-crit' && p[2]?.startsWith('p2') && mineId(lastMover)) { crits++; continue; }
		if (cmd === '-supereffective' && p[2]?.startsWith('p2') && mineId(lastMover)) { se++; continue; }
		if (cmd === '-ohko' && p[2]?.startsWith('p2') && mineId(lastMover)) { ohko++; continue; }
		if ((cmd === '-activate' && mineId(p[2] || '') && /Sturdy/.test(p[3] || '')) || (cmd === '-enditem' && mineId(p[2] || '') && /Focus Sash|Focus Band/.test(p[3] || ''))) { endure++; continue; }
		if (mineId(p[2] || '')) {
			if (cmd === '-mega' || cmd === '-primal') { gim.push('mega'); continue; }
			if (cmd === '-zpower') { gim.push('z'); continue; }
			if (cmd === '-terastallize') { gim.push('tera'); continue; }
			if (cmd === '-start' && /Dynamax/.test(p[3] || '')) { gim.push('dmax'); continue; }
		}
		if (cmd === '-weather' && WEATHERS.includes(p[2]) && !line.includes('[upkeep]')) { const of = /\[of\] ([^|]+)/.exec(line)?.[1] || lastMover; if (mineId(of)) weathers.push(p[2]); continue; }
		if (cmd === '-fieldstart') { const t = TERRAINS.find(x => (p[2] || '').includes(x)); const of = /\[of\] ([^|]+)/.exec(line)?.[1] || lastMover; if (t && mineId(of)) terrains.push(t); continue; }
		if (cmd === 'faint') {
			const id = nameOf(p[2]); const sp = who[id] || '';
			if (turn !== faintTurn) { faintTurn = turn; faintsThisTurn = 0; }
			if (id.startsWith('p2')) {
				oppAlive--; oppFainted.push(sp); faintsThisTurn++; if (faintsThisTurn >= 2) dko = true;
				if (mineId(lastMover)) { const ms = who[lastMover] || ''; if (ms) (mine[ms] ||= { ko: 0, f: 0 }).ko++; }
			} else { myAlive--; if (sp && mineId(id)) (mine[sp] ||= { ko: 0, f: 0 }).f++; }
			if (myAlive === 1 && oppAlive >= 3) comeback = true;
		}
	}
	// 내보낸 내 포켓몬
	for (const id in who) if (mineId(id)) mine[who[id]] ||= { ko: 0, f: 0 };
	const myMons = ((battle.p1?.pokemon || []) as any[]).filter(x => !x.kPartner);
	const myFaint = myMons.filter(x => x.fainted).length;
	const alive = myMons.filter(x => !x.fainted);
	const oneHp = win && alive.length === 1 && alive[0].hp === 1;
	const kos = Object.values(mine).reduce((a, b) => a + b.ko, 0);
	const sweep6 = win && Object.values(mine).some(m => m.ko >= 6);
	let mvp: string | undefined; let best = 0; for (const [k, v] of Object.entries(mine)) if (v.ko > best) { best = v.ko; mvp = k; }
	return { win, turns: battle.turn || 0, kos, myFaint, crits, se, perfect: win && myFaint === 0, oneHp, comeback: win && comeback, dko, sweep6, mvp, mine, oppSeen: [...oppSeen], oppFainted, gim, weathers, terrains, ohko, endure };
}

onBattleEnd((setup, battle, win) => {
	if (setup.replay || setup.cheat) return;   // 리플레이·치트는 통계에 넣지 않음
	const f = analyze(setup, battle, win);
	const n1 = setup.p1?.team?.length || 0, n2 = setup.p2?.team?.length || 0;
	updateStats(s => {
		for (const [sid, m] of Object.entries(f.mine)) {
			const st = s.mons[sid] ||= { u: 0, w: 0, ko: 0, f: 0, mvp: 0 };
			st.u++; if (win) st.w++; st.ko += m.ko; st.f += m.f; if (win && sid === f.mvp) st.mvp++;
			s.used[sid] = 1;
			if (win) for (const t of speciesData(sid, 9)?.t || []) bump(s, 'typeWin:' + t);
		}
		for (const sid of f.oppSeen) s.faced[sid] = 1;
		for (const sid of f.oppFainted) if (sid) s.beaten[sid] = 1;
		bump(s, 'ko', f.kos); bump(s, 'crit', f.crits); bump(s, 'se', f.se); bump(s, 'ohko', f.ohko); bump(s, 'endure', f.endure);
		if (f.perfect) bump(s, 'perfect');
		if (f.oneHp) bump(s, 'oneHp');
		if (f.comeback) bump(s, 'comeback');
		if (f.dko) bump(s, 'dko');
		if (f.sweep6) bump(s, 'sweep6');
		if (win && n1 >= 6 && n2 >= 6 && f.turns <= 8) bump(s, 'quick');
		if (win && f.turns >= 50) bump(s, 'marathon');
		for (const g of f.gim) bump(s, 'gim:' + g);
		if (win) for (const g of new Set(f.gim)) s.flags['gimWin:' + g] = 1;
		for (const w of f.weathers) s.flags['weather:' + w] = 1;
		for (const t of f.terrains) s.flags['terrain:' + t] = 1;
	});
});

// ───────── 업적 ─────────
export type AchCat = '배틀' | '기믹' | '타입' | '시설' | '네임드' | '랭크' | '도전' | '수집';
export interface Ach { id: string; name: string; desc: string; cat: AchCat; steps: number[]; value: (s: Stats) => number }
const rec = () => loadRecords();
const bestOf = (prefix: string) => Math.max(0, ...Object.entries(rec().best).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v));
const cnt = (k: string) => (s: Stats) => s.c[k] || 0;
const flagCount = (prefix: string) => (s: Stats) => Object.keys(s.flags).filter(k => k.startsWith(prefix)).length;
const rpBest = () => Math.max(0, ...Object.values(rec().rpBest || {}));
const namedRole = (role: string) => NAMED.filter(t => t.role === role && rec().named[t.id]).length;
const TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
const TYPE_KO: { [t: string]: string } = { Normal: '노말', Fire: '불꽃', Water: '물', Electric: '전기', Grass: '풀', Ice: '얼음', Fighting: '격투', Poison: '독', Ground: '땅', Flying: '비행', Psychic: '에스퍼', Bug: '벌레', Rock: '바위', Ghost: '고스트', Dragon: '드래곤', Dark: '악', Steel: '강철', Fairy: '페어리' };
const leagueRegions = () => { const r = rec(); const regs = new Set(NAMED.map(t => t.region)); let n = 0; for (const reg of regs) { const top = NAMED.filter(t => t.region === reg && (t.role === 'elite' || t.role === 'champion')); if (top.length && top.every(t => r.named[t.id])) n++; } return n; };

export const ACHIEVEMENTS: Ach[] = [
	// 배틀
	{ id: 'wins', name: '승리의 길', desc: '모든 모드 합쳐 {n}승', cat: '배틀', steps: [10, 100, 500, 1000], value: () => rec().wins },
	{ id: 'battles', name: '배틀 참가', desc: '배틀 {n}회 참가', cat: '배틀', steps: [10, 100, 400, 2000], value: () => rec().battles },
	{ id: 'perfect', name: '무결점 승리', desc: '내 포켓몬이 하나도 쓰러지지 않고 {n}승', cat: '배틀', steps: [10, 50, 100], value: cnt('perfect') },
	{ id: 'se', name: '상성의 달인', desc: '효과가 굉장한 공격 {n}회', cat: '배틀', steps: [30, 150, 300], value: cnt('se') },
	{ id: 'crit', name: '급소 사냥꾼', desc: '급소에 {n}회 맞힘', cat: '배틀', steps: [10, 50, 100], value: cnt('crit') },
	{ id: 'ko', name: '쓰러뜨린 수', desc: '상대 포켓몬 {n}마리 쓰러뜨림', cat: '배틀', steps: [50, 500, 2000], value: cnt('ko') },
	{ id: 'oneHp', name: '아슬아슬 HP 1', desc: '마지막 남은 포켓몬이 HP 1인 채로 승리', cat: '배틀', steps: [1], value: cnt('oneHp') },
	{ id: 'comeback', name: '홀로 셋을 넘어', desc: '내 포켓몬 1마리 대 상대 3마리 이상에서 역전승', cat: '배틀', steps: [1, 5], value: cnt('comeback') },
	{ id: 'dko', name: '일타쌍피', desc: '한 턴에 상대 포켓몬 2마리를 쓰러뜨림 ({n}회)', cat: '배틀', steps: [1, 20], value: cnt('dko') },
	{ id: 'sweep6', name: '혼자서 여섯', desc: '한 마리로 상대 6마리를 모두 쓰러뜨리고 승리', cat: '배틀', steps: [1], value: cnt('sweep6') },
	{ id: 'endure', name: '버텨 낸 한 줄', desc: '옹골참·기합의띠로 {n}회 버팀', cat: '배틀', steps: [1, 10, 50], value: cnt('endure') },
	{ id: 'ohko', name: '한 방의 미학', desc: '일격필살 기술로 {n}회 쓰러뜨림', cat: '배틀', steps: [1, 10], value: cnt('ohko') },
	{ id: 'quick', name: '번개 같은 승부', desc: '6마리끼리 싸워 8턴 안에 승리', cat: '배틀', steps: [1], value: cnt('quick') },
	{ id: 'marathon', name: '끝장 승부', desc: '50턴 넘게 이어진 배틀에서 승리', cat: '배틀', steps: [1], value: cnt('marathon') },
	{ id: 'weather', name: '하늘을 다스리는 자', desc: '쾌청·비·모래바람·눈을 모두 일으킴 ({n}/4)', cat: '배틀', steps: [4], value: flagCount('weather:') },
	{ id: 'terrain', name: '대지의 연출가', desc: '일렉트릭·그래스·미스트·사이코필드를 모두 깖 ({n}/4)', cat: '배틀', steps: [4], value: flagCount('terrain:') },
	// 기믹
	{ id: 'mega', name: '메가의 계승자', desc: '메가진화 {n}회', cat: '기믹', steps: [30, 150, 300], value: cnt('gim:mega') },
	{ id: 'zmove', name: 'Z의 결의', desc: 'Z기술 {n}회', cat: '기믹', steps: [10, 30, 100], value: cnt('gim:z') },
	{ id: 'dmax', name: '거대한 그림자', desc: '다이맥스 {n}회', cat: '기믹', steps: [10, 30, 100], value: cnt('gim:dmax') },
	{ id: 'tera', name: '빛나는 결정', desc: '테라스탈 {n}회', cat: '기믹', steps: [30, 150, 300], value: cnt('gim:tera') },
	{ id: 'allgim', name: '기믹 그랜드슬램', desc: '메가·Z·다이맥스·테라스탈을 써서 각각 1승 ({n}/4)', cat: '기믹', steps: [4], value: flagCount('gimWin:') },
	// 타입별 승리 (챔피언스: 50승 관장 · 150승 사천왕 칭호)
	...TYPES.map(t => ({ id: 'type:' + t, name: `${TYPE_KO[t]} 타입 마스터`, desc: `${TYPE_KO[t]} 타입 포켓몬이 참가해 {n}승 (50승 관장 · 150승 사천왕 칭호)`, cat: '타입' as AchCat, steps: [10, 50, 150], value: cnt('typeWin:' + t) })),
	// 시설
	{ id: 'tower', name: '탑을 오르는 자', desc: '배틀타워 {n}연승', cat: '시설', steps: [7, 21, 49, 100], value: () => bestOf('tower-') },
	{ id: 'factory', name: '렌탈의 귀재', desc: '배틀팩토리 {n}연승', cat: '시설', steps: [7, 21, 49], value: () => bestOf('factory-') },
	{ id: 'palace', name: '마음을 믿는 자', desc: '배틀팰리스 {n}연승', cat: '시설', steps: [7, 21, 49], value: () => bestOf('palace-') },
	{ id: 'symbols', name: '심볼 수집가', desc: '타워·팩토리·챔피언 심볼 {n}개 (은·금 각각 셈)', cat: '시설', steps: [1, 3, 6], value: s => Object.values(s.sym).reduce((a: number, b) => a + (b || 0), 0) },
	{ id: 'pwt', name: '월드 토너먼트', desc: 'PWT 우승 {n}회', cat: '시설', steps: [1, 10, 50], value: () => Object.values(rec().cups).reduce((a, b) => a + b, 0) },
	{ id: 'pwtAll', name: '세계 최강 트레이너', desc: `모든 PWT 대회 우승 ({n}/${CUPS.length})`, cat: '시설', steps: [CUPS.length], value: () => Object.keys(rec().cups).filter(k => rec().cups[k] > 0).length },
	// 네임드
	{ id: 'gyms', name: '배지 모으기', desc: '체육관 관장 {n}명 격파', cat: '네임드', steps: [1, 8, 40], value: () => namedRole('leader') },
	{ id: 'league', name: '지방의 정상', desc: '한 지방의 사천왕·챔피언을 모두 이김 ({n}지방)', cat: '네임드', steps: [1, 3, 8], value: leagueRegions },
	{ id: 'champs', name: '챔피언 사냥', desc: '챔피언 {n}명 격파', cat: '네임드', steps: [1, 5, NAMED.filter(t => t.role === 'champion').length], value: () => namedRole('champion') },
	{ id: 'villains', name: '악의 조직 격파', desc: '악의 조직 간부·보스 {n}명 격파', cat: '네임드', steps: [1, 10, NAMED.filter(t => t.role === 'admin' || t.role === 'boss').length], value: () => namedRole('admin') + namedRole('boss') },
	// 랭크
	{ id: 'rankTier', name: '랭크 승급', desc: '랭크 매치 최고 등급: 슈퍼볼급 · 하이퍼볼급 · 마스터볼급', cat: '랭크', steps: [360, 720, 1200], value: rpBest },
	{ id: 'champTier', name: '챔피언급', desc: '은: 랭크 매치 챔피언급 도달 · 금: 시즌을 챔피언급으로 마감', cat: '랭크', steps: [1, 2], value: s => s.sym.rank || 0 },
	{ id: 'seasons', name: '시즌 개근상', desc: '랭크 시즌 {n}회 참가 (1주 단위)', cat: '랭크', steps: [1, 4, 10], value: s => new Set(s.seasons.map(x => x.id)).size },
	{ id: 'seasonMaster', name: '군림하는 자', desc: '시즌을 마스터볼급 이상으로 {n}회 마감', cat: '랭크', steps: [1, 5, 10], value: s => s.seasons.filter(x => x.rp >= 1200).length },
	// 도전
	{ id: 'daily', name: '오늘의 도전 개근', desc: '오늘의 도전 {n}일 연속 참가', cat: '도전', steps: [3, 7, 30], value: s => s.c.dailyStreakMax || 0 },
	{ id: 'dailyPerfect', name: '오늘의 완주', desc: '오늘의 도전 7연승 {n}회', cat: '도전', steps: [1, 10], value: s => Object.values(s.daily).filter(v => v >= 7).length },
	{ id: 'conquest', name: '지방 클리어', desc: '보스 러시 › 지방 클리어 {n}곳 완주', cat: '도전', steps: [1, 4, 9], value: s => Object.keys(s.conquest).length },
	{ id: 'conquestHard', name: '진심 클리어', desc: '어려움으로 지방 클리어 {n}곳 완주', cat: '도전', steps: [1, 4], value: s => Object.values(s.conquest).filter(v => v === 2).length },
	{ id: 'boss', name: '보스 러시 돌파', desc: '보스 러시 시나리오 코스 {n}개 완주', cat: '도전', steps: [1, 2], value: s => Object.entries(s.boss).filter(([k, v]) => v >= (BOSS_LEN[k] || 99)).length },
	// 수집
	{ id: 'used', name: '백 가지 동료', desc: '서로 다른 포켓몬 {n}종으로 배틀', cat: '수집', steps: [30, 100, 300], value: s => Object.keys(s.used).length },
	{ id: 'beaten', name: '도감 사냥꾼', desc: '서로 다른 상대 포켓몬 {n}종을 쓰러뜨림', cat: '수집', steps: [50, 300, 700], value: s => Object.keys(s.beaten).length },
	{ id: 'partner', name: '단짝', desc: '한 포켓몬으로 {n}승 (포켓몬별 업적)', cat: '수집', steps: [10, 50, 100], value: s => Math.max(0, ...Object.values(s.mons).map(m => m.w)) },
];
/** 보스 러시 코스 길이 (frontier.tsx 가 채움) */
export const BOSS_LEN: { [course: string]: number } = {};
export const TIER_NAME = ['', '브론즈', '실버', '골드', '플래티넘'];
export function achLevel(a: Ach, v: number) { let l = 0; for (const st of a.steps) if (v >= st) l++; return l; }
/** 단계 색: 단계가 하나뿐이면 골드, 마지막 단계는 높게 */
export function achTier(a: Ach, l: number) { if (!l) return 0; if (a.steps.length === 1) return 3; return Math.min(4, l + (a.steps.length <= 2 ? 1 : 0)); }
export function achDesc(a: Ach, l: number) { const n = a.steps[Math.min(l, a.steps.length - 1)]; return a.desc.replace('{n}', String(n)); }

let checking = false;
/** 업적 단계를 새로 얻었을 때 (보상 BP — rewards.ts 가 등록, 순환 import 를 피하려고 콜백) */
let onAchBP: ((tiers: number[]) => void) | null = null;
export function checkAchievements(quiet = false) {
	if (checking) return; checking = true;
	try {
		const s = loadStats(); const news: string[] = []; const newTiers: number[] = [];
		for (const a of ACHIEVEMENTS) {
			const l = achLevel(a, a.value(s));
			if (l > (s.ach[a.id] || 0)) { for (let k = (s.ach[a.id] || 0) + 1; k <= l; k++) newTiers.push(achTier(a, k)); s.ach[a.id] = l; news.push(`${a.name}${a.steps.length > 1 ? ' ' + TIER_NAME[achTier(a, l)] : ''}`); }
		}
		if (news.length) { save(KEY, s); onAchBP?.(newTiers); if (!quiet && loadSettings()) toast(`🏆 업적 달성: ${news.slice(0, 2).join(', ')}${news.length > 2 ? ` 외 ${news.length - 2}개` : ''} — 수첩 › 업적에서 BP 받기`); }
	} finally { checking = false; }
}
