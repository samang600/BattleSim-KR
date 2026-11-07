/**
 * 배틀 규칙 — 네 가지를 따로 골라 조합함 (설정 → 배틀 규칙)
 *  1) 기믹: 메가진화·Z기술·다이맥스·테라스탈을 어떻게 쓰는지
 *  2) 포켓몬 풀: 게임·레귤레이션에 나오는 포켓몬 (스칼렛·바이올렛, 소드·실드, 7·6세대까지, 챔피언스 M-A/B/C, 전국도감)
 *  3) 초전설 / 4) 환상: 불가 · 내 팀만 · 상대도 데려옴 — 포켓몬 풀과 상관없이 따로 정함 (세대 상한만 따름)
 * 규칙 id 는 '기믹.풀.초전설.환상' (예: 'tera.sv.no.no'). 예전 id(natdexflat·gen9·champmc …)도 읽음.
 */
import { RAW, toID } from './data';

export type GimmickKind = 'mega' | 'zmove' | 'dynamax' | 'tera' | 'ultra';
export type LegendMode = 'no' | 'yes' | 'foe';
export interface BattleRule {
	id: string; name: string; desc: string;
	gimmick: string; pool: string; restricted: LegendMode; mythical: LegendMode;
	kinds: GimmickKind[]; oneKind: boolean;
	/** 세대 상한(도감 번호) / 레전즈 Z-A 추가 메가 제외 / 게임 등장 표시(dex.json av) / 허용 메가 모습 / 준전설 제외 */
	maxNum?: number; noFuture?: boolean; avail?: string; megaOnly?: Set<string>; noSub?: boolean;
	/** 한 포켓몬이 기믹을 겹쳐 쓸 수 있음 / 상대 무작위 팀에도 초전설·환상이 섞임 */
	stack?: boolean; legendTeams?: boolean;
}

const MEGA_MA = ['kangaskhan', 'charizardy', 'charizardx', 'gengar', 'gardevoir', 'lucario', 'venusaur', 'blastoise', 'tyranitar', 'garchomp', 'scizor', 'lopunny',
	'gyarados', 'alakazam', 'aerodactyl', 'heracross', 'houndoom', 'aggron', 'altaria', 'absol', 'sableye', 'abomasnow', 'gallade', 'audino', 'pinsir', 'slowbro',
	'steelix', 'ampharos', 'beedrill', 'manectric', 'pidgeot', 'clefable', 'victreebel', 'starmie', 'dragonite', 'meganium', 'feraligatr', 'skarmory', 'medicham',
	'sharpedo', 'camerupt', 'banette', 'chimecho', 'glalie', 'froslass', 'emboar', 'excadrill', 'chandelure', 'golurk', 'chesnaught', 'delphox', 'greninja',
	'floette', 'meowsticm', 'meowsticf', 'hawlucha', 'crabominable', 'drampa', 'scovillain', 'glimmora'];
/** 'charizardx' → 'charizardmegax', 'meowsticm' → 'meowsticmmega' */
const megaIds = (list: string[]) => new Set(list.map(n => {
	const m = /^(.*?)([xyz])$/.exec(n);
	const cand = m ? [`${m[1]}mega${m[2]}`, `${n}mega`] : [`${n}mega`];
	return cand.find(c => RAW.species[c]) || cand[0];
}));

const ALL4: GimmickKind[] = ['mega', 'zmove', 'dynamax', 'tera'];
export interface Choice { id: string; name: string; desc: string }
/** 1) 기믹 */
export const GIMMICKS: (Choice & { kinds: GimmickKind[]; oneKind: boolean; stack?: boolean })[] = [
	{ id: 'one', name: '넷 중 하나', kinds: ALL4, oneKind: true, desc: '메가진화·Z기술·다이맥스·테라스탈 중 한 배틀에 한 종류만' },
	{ id: 'each', name: '넷 다 (각 1회)', kinds: ALL4, oneKind: false, desc: '네 가지 기믹을 종류마다 한 번씩' },
	{ id: 'stack', name: '넷 다 (겹쳐 쓰기)', kinds: ALL4, oneKind: false, stack: true, desc: '종류마다 한 번씩, 한 포켓몬이 겹쳐 쓸 수도 있음 (메가진화·원시회귀한 포켓몬의 테라스탈만 불가)' },
	{ id: 'tera', name: '테라스탈', kinds: ['tera'], oneKind: true, desc: '테라스탈만' },
	{ id: 'dynamax', name: '다이맥스', kinds: ['dynamax'], oneKind: true, desc: '다이맥스만' },
	{ id: 'megaz', name: '메가+Z', kinds: ['mega', 'zmove'], oneKind: false, desc: '메가진화와 Z기술 (각 1회, 7세대식)' },
	{ id: 'zmove', name: 'Z기술', kinds: ['zmove'], oneKind: true, desc: 'Z기술만' },
	{ id: 'mega', name: '메가진화', kinds: ['mega'], oneKind: true, desc: '메가진화만' },
	{ id: 'none', name: '없음', kinds: [], oneKind: true, desc: '기믹 없음' },
];
/** 2) 포켓몬 풀 (게임·레귤레이션) — gimmick: 고를 때 맞춰 주는 그 게임의 기믹 */
export const POOLS: (Choice & { gimmick: string; maxNum?: number; noFuture?: boolean; avail?: string; megaOnly?: Set<string>; noSub?: boolean; legends?: [LegendMode, LegendMode] })[] = [
	{ id: 'natdex', name: '전국도감', gimmick: 'one', desc: '모든 포켓몬과 모든 메가진화(레전즈 Z-A 메가 포함)' },
	{ id: 'sv', name: '스칼렛·바이올렛', gimmick: 'tera', avail: 's', desc: '스칼렛·바이올렛(DLC 포함)에 나오는 포켓몬' },
	{ id: 'swsh', name: '소드·실드', gimmick: 'dynamax', avail: 'w', maxNum: 905, desc: '소드·실드(DLC 포함)에 나오는 포켓몬' },
	{ id: 'usum', name: '7세대까지', gimmick: 'megaz', maxNum: 809, noFuture: true, desc: '울트라썬·문까지의 포켓몬(1~7세대), 원래 메가진화만' },
	{ id: 'xy', name: '6세대까지', gimmick: 'mega', maxNum: 721, noFuture: true, desc: 'X·Y/오메가루비·알파사파이어까지의 포켓몬(1~6세대), 원래 메가진화만' },
	{ id: 'champmc', name: '챔피언스 M-C', gimmick: 'mega', avail: 'c', legends: ['no', 'no'], desc: '포켓몬 챔피언스 레귤레이션 M-C(2026.9~12)에 나오는 포켓몬과 메가진화' },
	{ id: 'champmb', name: '챔피언스 M-B', gimmick: 'mega', avail: 'b', legends: ['no', 'no'], desc: '레귤레이션 M-B(2026.6~9)에 나오는 포켓몬과 메가진화' },
	{ id: 'champma', name: '챔피언스 M-A', gimmick: 'mega', avail: 'b', megaOnly: megaIds(MEGA_MA), legends: ['no', 'no'], desc: '레귤레이션 M-A(2026.4~6, 출시 규칙) — 포켓몬은 M-B 기준, 메가진화 59종' },
];
/** 3·4) 초전설·환상 */
export const LEGEND_MODES: Choice[] = [
	{ id: 'no', name: '불가', desc: '쓸 수 없음' },
	{ id: 'yes', name: '내 팀만', desc: '내 팀에 넣을 수 있음 (상대 무작위 팀에는 안 나옴)' },
	{ id: 'foe', name: '상대도', desc: '나도 쓰고 상대도 데려옴' },
];
/** 챔피언스 풀의 메가: 그 레귤레이션에 나오는 메가 모습 */
const champMegas = (flag: string) => new Set(Object.keys(RAW.species).filter(id => RAW.species[id].av?.includes(flag) && /mega/.test(id) && RAW.species[id].base));
for (const p of POOLS) if (p.id === 'champmc') p.megaOnly = champMegas('c'); else if (p.id === 'champmb') p.megaOnly = champMegas('b');

/** 예전 규칙 id → 새 조합 */
const LEGACY: { [id: string]: string } = {
	natdexflat: 'one.natdex.no.no', natdex: 'one.natdex.yes.yes', natdexfree: 'each.natdex.yes.yes', unlimited: 'stack.natdex.foe.foe',
	gen9: 'tera.sv.yes.yes', gen8: 'dynamax.swsh.yes.yes', gen7: 'megaz.usum.yes.yes', gen6: 'mega.xy.yes.yes',
	champmc: 'mega.champmc.no.no', champmb: 'mega.champmb.no.no', champma: 'mega.champma.no.no', none: 'none.natdex.yes.yes',
};
export const DEFAULT_RULE = 'one.natdex.no.no';
export function ruleId(gimmick: string, pool: string, restricted: LegendMode, mythical: LegendMode) { return `${gimmick}.${pool}.${restricted}.${mythical}`; }
const LEG_KO = { no: '불가', yes: '내 팀만', foe: '상대도' };
const cache = new Map<string, BattleRule>();
export function ruleById(idIn: string): BattleRule {
	const id = LEGACY[idIn] || idIn || DEFAULT_RULE;
	const hit = cache.get(id); if (hit) return hit;
	const [g, p, r, m] = id.split('.');
	const gim = GIMMICKS.find(x => x.id === g), pool = POOLS.find(x => x.id === p);
	if (!gim || !pool || !['no', 'yes', 'foe'].includes(r) || !['no', 'yes', 'foe'].includes(m)) return ruleById(DEFAULT_RULE);
	const restricted = r as LegendMode, mythical = m as LegendMode;
	const legTxt = restricted === mythical ? `초전설·환상 ${LEG_KO[restricted]}` : `초전설 ${LEG_KO[restricted]} · 환상 ${LEG_KO[mythical]}`;
	const rule: BattleRule = {
		id, gimmick: g, pool: p, restricted, mythical,
		name: `${pool.name} · ${gim.name}`,
		desc: `${pool.desc}. 기믹: ${gim.desc}. ${legTxt}.`,
		kinds: gim.kinds, oneKind: gim.oneKind, stack: gim.stack,
		maxNum: pool.maxNum, noFuture: pool.noFuture, avail: pool.avail, megaOnly: pool.megaOnly, noSub: pool.noSub,
		legendTeams: restricted === 'foe' || mythical === 'foe',
	};
	cache.set(id, rule);
	return rule;
}

/** 이 규칙에서 쓸 수 있는 포켓몬인가 (메가 모습 등 아이템으로 바뀌는 모습은 기본 모습으로 판단) */
export function speciesAllowed(rule: BattleRule, speciesId: string): boolean {
	const s = RAW.species[toID(speciesId)];
	if (!s) return false;
	if (rule.maxNum && s.num > rule.maxNum) return false;
	if (rule.noFuture && s.fut) return false;
	const tags = s.tags || [];
	const restricted = tags.includes('Restricted Legendary'), mythical = tags.includes('Mythical');
	if (restricted && rule.restricted === 'no') return false;
	if (mythical && rule.mythical === 'no') return false;
	// 게임 등장 여부는 초전설·환상이 아닌 포켓몬에만 (초전설·환상은 3·4번 설정으로 따로 정함)
	if (rule.avail && !restricted && !mythical) {
		const av = s.av ?? (s.base ? RAW.species[s.base]?.av : undefined);
		if (!av?.includes(rule.avail)) return false;
	}
	if (rule.noSub && tags.includes('Sub-Legendary')) return false;
	return true;
}
/** 메가스톤 없이 메가진화하는 경우(레쿠쟈·화룡점정): 그 메가 모습이 규칙에서 허용되는가 */
export function megaFormAllowed(rule: BattleRule, formeId: string): boolean {
	if (!rule.kinds.includes('mega')) return false;
	const s = RAW.species[toID(formeId)];
	if (rule.noFuture && s?.fut) return false;
	if (rule.megaOnly && !rule.megaOnly.has(toID(formeId))) return false;
	return true;
}
/** 이 규칙에서 쓸 수 있는 메가스톤인가 */
export function megaStoneAllowed(rule: BattleRule, itemId: string): boolean {
	const it = RAW.items[toID(itemId)];
	if (!it?.mega) return false;
	if (!rule.kinds.includes('mega')) return false;
	if (rule.noFuture && it.fut) return false;
	if (rule.megaOnly && !rule.megaOnly.has(toID(it.mega))) return false;
	return true;
}
/** 팀 하나의 규칙 위반 사항 */
export function teamRuleWarnings(rule: BattleRule, sets: { species: string; item: string }[]): string[] {
	const w: string[] = [];
	const bad = sets.filter(s => !speciesAllowed(rule, s.species)).map(s => RAW.species[toID(s.species)]?.n || s.species);
	if (bad.length) w.push(`이 규칙(${rule.name})에서 쓸 수 없는 포켓몬: ${bad.join(', ')}`);
	const badStone = sets.filter(s => RAW.items[toID(s.item)]?.mega && !megaStoneAllowed(rule, s.item)).map(s => RAW.items[toID(s.item)]!.n);
	if (badStone.length) w.push(`이 규칙에서 쓸 수 없는 메가스톤: ${badStone.join(', ')}${rule.kinds.includes('mega') ? '' : ' (메가진화 불가 규칙)'}`);
	const badZ = rule.kinds.includes('zmove') ? [] : sets.filter(s => RAW.items[toID(s.item)]?.zt).map(s => RAW.items[toID(s.item)]!.n);
	if (badZ.length) w.push(`이 규칙에서는 Z크리스탈을 쓸 수 없어요: ${badZ.join(', ')}`);
	return w;
}
