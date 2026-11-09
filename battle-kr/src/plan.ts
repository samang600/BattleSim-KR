/** 팀 성향(운영 방식) 판별: 날씨(비·쾌청·모래·설경) · 트릭룸 · 순풍 · 랭크업.
 *  AI 가 기술 점수(ai.ts statusScore)와 참가 포켓몬 고르기(smogon.ts aiPickEntry)에서 쓴다.
 *  입력은 세트(PSet)든 배틀 중 포켓몬이든 { 종, 특성, 기술, 도구 } 만 맞추면 됨. */
import { RAW, megaStoneFits, speciesData, toID } from './data';

export type Weather = 'raindance' | 'sunnyday' | 'sandstorm' | 'snowscape';
export interface MonInfo { species: string; ability: string; moves: string[]; item: string }
export interface TeamPlan {
	weather: Weather | null;
	trickRoom: boolean;
	tailwind: boolean;
	setup: boolean;
	/** 포켓몬마다 역할: 'setter' 판을 까는 쪽(날씨·트릭룸·순풍), 'abuser' 그 판에서 강해지는 쪽 */
	roles: ('setter' | 'abuser' | '')[];
	/** 싱글 운영: 대면(공격적으로 맞붙음) · 사이클(유턴·재생력으로 돌며 설치기) · 막이(회복·상태이상으로 버팀) · 밸런스 */
	style: SinglesStyle;
}
export type SinglesStyle = 'offense' | 'cycle' | 'stall' | 'balance';
const PIVOT = new Set(['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'chillyreception', 'shedtail']);
const RECOVERY = new Set(['recover', 'roost', 'softboiled', 'slackoff', 'moonlight', 'morningsun', 'synthesis', 'milkdrink', 'shoreup', 'wish', 'rest',
	'strengthsap', 'lifedew', 'junglehealing', 'lunarblessing', 'healorder', 'leechseed', 'painsplit']);
const HAZARD = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'ceaselessedge', 'stoneaxe']);
const STATUS = new Set(['toxic', 'willowisp', 'thunderwave', 'glare', 'yawn', 'spore', 'sleeppowder', 'nuzzle', 'saltcure', 'infestation', 'whirlpool']);
const OFF_ITEMS = new Set(['choiceband', 'choicespecs', 'choicescarf', 'lifeorb', 'focussash', 'boosterenergy', 'expertbelt', 'loadeddice', 'weaknesspolicy', 'whiteherb']);

const WEATHER_ABIL: { [ab: string]: Weather } = { drizzle: 'raindance', primordialsea: 'raindance', drought: 'sunnyday', desolateland: 'sunnyday', orichalcumpulse: 'sunnyday',
	sandstream: 'sandstorm', snowwarning: 'snowscape' };
const WEATHER_MOVE: { [mv: string]: Weather } = { raindance: 'raindance', sunnyday: 'sunnyday', sandstorm: 'sandstorm', snowscape: 'snowscape', hail: 'snowscape', chillyreception: 'snowscape' };
/** 날씨 덕을 보는 특성 */
const ABUSE_ABIL: { [ab: string]: Weather } = { swiftswim: 'raindance', raindish: 'raindance', hydration: 'raindance', dryskin: 'raindance',
	chlorophyll: 'sunnyday', solarpower: 'sunnyday', protosynthesis: 'sunnyday', flowergift: 'sunnyday', harvest: 'sunnyday', leafguard: 'sunnyday',
	sandrush: 'sandstorm', sandforce: 'sandstorm', sandveil: 'sandstorm', slushrush: 'snowscape', icebody: 'snowscape', snowcloak: 'snowscape' };
/** 날씨 덕을 보는 기술 */
const ABUSE_MOVE: { [mv: string]: Weather[] } = { thunder: ['raindance'], hurricane: ['raindance'], electroshot: ['raindance'], solarbeam: ['sunnyday'], solarblade: ['sunnyday'],
	blizzard: ['snowscape'], auroraveil: ['snowscape'], hydrosteam: ['sunnyday'], weatherball: ['raindance', 'sunnyday', 'sandstorm', 'snowscape'] };
const SETUP_MOVES = new Set(['swordsdance', 'dragondance', 'nastyplot', 'calmmind', 'quiverdance', 'shellsmash', 'bulkup', 'irondefense', 'coil', 'shiftgear',
	'agility', 'tailglow', 'victorydance', 'tidyup', 'bellydrum', 'curse', 'cottonguard', 'clangoroussoul', 'filletaway', 'geomancy', 'growth', 'workup', 'honeclaws']);

/** 메가스톤을 들었으면 메가진화 뒤 특성 (리자몽나이트Y → 가뭄 등) */
function effAbility(m: MonInfo): string {
	const it = RAW.items[toID(m.item)];
	if (it?.mega) {
		const ms = speciesData(toID(it.mega), 9);
		if (ms?.ab?.length && megaStoneFits(toID(m.item), m.species)) return ms.ab[0];
	}
	return toID(m.ability);
}
function baseSpe(m: MonInfo) { return speciesData(toID(m.species), 9)?.bs?.[5] ?? 80; }

export function teamPlan(team: MonInfo[]): TeamPlan {
	const mons = team.map(m => ({ ab: effAbility(m), moves: m.moves.map(toID), spe: baseSpe(m) }));
	// 날씨: 까는 포켓몬이 있고, 덕을 보는 포켓몬(또는 까는 포켓몬 둘)이 있으면
	let weather: Weather | null = null;
	for (const w of ['raindance', 'sunnyday', 'sandstorm', 'snowscape'] as Weather[]) {
		const setters = mons.filter(m => WEATHER_ABIL[m.ab] === w || m.moves.some(x => WEATHER_MOVE[x] === w)).length;
		const abusers = mons.filter(m => ABUSE_ABIL[m.ab] === w || m.moves.some(x => ABUSE_MOVE[x]?.includes(w))).length;
		if (setters && (abusers >= 1 || setters >= 2)) { weather = w; break; }
	}
	const trUsers = mons.filter(m => m.moves.includes('trickroom')).length;
	const slow = mons.filter(m => m.spe <= 60).length;
	const trickRoom = trUsers >= 1 && slow >= 2;
	const tailwind = !trickRoom && mons.some(m => m.moves.includes('tailwind'));
	const setup = mons.filter(m => m.moves.some(x => SETUP_MOVES.has(x))).length >= 2;
	const roles = mons.map(m => {
		if (weather && (WEATHER_ABIL[m.ab] === weather || m.moves.some(x => WEATHER_MOVE[x] === weather))) return 'setter' as const;
		if (trickRoom && m.moves.includes('trickroom')) return 'setter' as const;
		if (tailwind && m.moves.includes('tailwind')) return 'setter' as const;
		if (weather && (ABUSE_ABIL[m.ab] === weather || m.moves.some(x => ABUSE_MOVE[x]?.includes(weather!)))) return 'abuser' as const;
		if (trickRoom && m.spe <= 60) return 'abuser' as const;
		return '' as const;
	});
	return { weather, trickRoom, tailwind, setup, roles, style: singlesStyle(team) };
}

/** 싱글 운영 판별: 포켓몬마다 공격형·피벗·막이를 세고 팀 비율로 */
function singlesStyle(team: MonInfo[]): SinglesStyle {
	let off = 0, pivot = 0, wall = 0;
	for (const m of team) {
		const mv = m.moves.map(toID), ab = effAbility(m), it = toID(m.item);
		const attacks = mv.filter(x => { const d = (RAW.moves as any)[x]; const g = d?.g?.['9']; return g && g[1] !== 'Status'; }).length;
		const rec = mv.some(x => RECOVERY.has(x)) || ab === 'regenerator' && it === 'leftovers';
		const sup = mv.filter(x => STATUS.has(x) || HAZARD.has(x) || x === 'protect' || x === 'haze' || x === 'whirlwind' || x === 'roar' || x === 'defog' || x === 'rapidspin').length;
		if (OFF_ITEMS.has(it) || (attacks >= 3 && !rec) || mv.some(x => SETUP_MOVES.has(x)) && attacks >= 2 && !rec) off++;
		if (mv.some(x => PIVOT.has(x)) || ab === 'regenerator') pivot++;
		if (rec && attacks <= 2 && sup >= 1 || ab === 'unaware' && rec) wall++;
	}
	const n = Math.max(1, team.length);
	if (wall / n >= 0.5 && off / n <= 0.34) return 'stall';
	if (off / n >= 0.67) return 'offense';
	if (pivot / n >= 0.34 && wall >= 1) return 'cycle';
	return 'balance';
}

/** 배틀 중 진영 → 성향 (진영마다 한 번 계산) */
const cache = new WeakMap<object, TeamPlan>();
export function sidePlan(side: any): TeamPlan {
	let p = cache.get(side);
	if (!p) {
		p = teamPlan(side.pokemon.map((x: any) => ({ species: x.species?.id || x.set?.species || '', ability: x.baseAbility || x.set?.ability || '',
			moves: (x.baseMoveSlots || x.moveSlots || []).map((s: any) => s.id), item: x.set?.item || x.item || '' })));
		cache.set(side, p);
	}
	return p;
}

/** 성향을 한국어 한 줄로 (디버그·표시용) */
export function planText(p: TeamPlan): string {
	const w = { raindance: '비', sunnyday: '쾌청', sandstorm: '모래바람', snowscape: '설경' } as const;
	const st = { offense: '대면', cycle: '사이클', stall: '막이', balance: '' } as const;
	return [st[p.style], p.weather && w[p.weather] + ' 파티', p.trickRoom && '트릭룸', p.tailwind && '순풍', p.setup && '랭크업'].filter(Boolean).join(' · ') || '일반';
}
