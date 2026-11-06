/**
 * 배틀 규칙 — 쇼다운 세대별 규칙과 포켓몬 챔피언스 레귤레이션
 *  kinds: 쓸 수 있는 기믹 / oneKind: 한 배틀에 한 종류만 / maxNum: 도감 번호 상한 / noFuture: 레전즈 Z-A 추가 메가 제외
 *  megaOnly: 허용 메가 모습(종족 id) / legend: 'all' 전부 허용, 'sub' 준전설까지, 'none' 전설·환상 제외
 */
import { RAW, toID } from './data';

export type GimmickKind = 'mega' | 'zmove' | 'dynamax' | 'tera' | 'ultra';
export interface BattleRule {
	id: string; name: string; group: string; desc: string;
	kinds: GimmickKind[]; oneKind: boolean;
	maxNum?: number; noFuture?: boolean; megaOnly?: Set<string>; legend: 'all' | 'sub' | 'none';
	/** 한 포켓몬이 기믹을 겹쳐 쓸 수 있음 / 상대 무작위 팀에도 전설·환상이 섞임 */
	stack?: boolean; legendTeams?: boolean;
}

const MEGA_MA = ['kangaskhan', 'charizardy', 'charizardx', 'gengar', 'gardevoir', 'lucario', 'venusaur', 'blastoise', 'tyranitar', 'garchomp', 'scizor', 'lopunny',
	'gyarados', 'alakazam', 'aerodactyl', 'heracross', 'houndoom', 'aggron', 'altaria', 'absol', 'sableye', 'abomasnow', 'gallade', 'audino', 'pinsir', 'slowbro',
	'steelix', 'ampharos', 'beedrill', 'manectric', 'pidgeot', 'clefable', 'victreebel', 'starmie', 'dragonite', 'meganium', 'feraligatr', 'skarmory', 'medicham',
	'sharpedo', 'camerupt', 'banette', 'chimecho', 'glalie', 'froslass', 'emboar', 'excadrill', 'chandelure', 'golurk', 'chesnaught', 'delphox', 'greninja',
	'floette', 'meowsticm', 'meowsticf', 'hawlucha', 'crabominable', 'drampa', 'scovillain', 'glimmora'];
const MEGA_MB = [...MEGA_MA, 'sceptile', 'blaziken', 'swampert', 'mawile', 'metagross', 'raichux', 'raichuy', 'staraptor', 'scolipede', 'scrafty', 'eelektross',
	'pyroar', 'malamar', 'barbaracle', 'dragalge', 'falinks'];
const MEGA_MC = [...MEGA_MB, 'garchompz', 'lucarioz', 'absolz', 'salamence', 'baxcalibur', 'golisopod'];
/** 'charizardx' → 'charizardmegax', 'meowsticm' → 'meowsticmmega' */
const megaIds = (list: string[]) => new Set(list.map(n => {
	const m = /^(.*?)([xyz])$/.exec(n);
	const cand = m ? [`${m[1]}mega${m[2]}`, `${n}mega`] : [`${n}mega`];
	return cand.find(c => RAW.species[c]) || cand[0];
}));

export const RULES: BattleRule[] = [
	{ id: 'natdexflat', name: '룰 · 플랫', group: '룰', kinds: ['mega', 'zmove', 'dynamax', 'tera'], oneKind: true, legend: 'sub',
		desc: '초전설·환상 제외(준전설은 가능). 메가진화·Z기술·다이맥스·테라스탈 중 한 배틀에 한 종류만 (기본).' },
	{ id: 'natdex', name: '룰 · 전부', group: '룰', kinds: ['mega', 'zmove', 'dynamax', 'tera'], oneKind: true, legend: 'all',
		desc: '초전설·환상 포함 모든 포켓몬. 기믹은 한 배틀에 한 종류만.' },
	{ id: 'natdexfree', name: '룰 · 기믹 모두', group: '룰', kinds: ['mega', 'zmove', 'dynamax', 'tera'], oneKind: false, legend: 'all',
		desc: '모든 포켓몬. 네 가지 기믹을 종류마다 한 번씩 쓸 수 있습니다.' },
	{ id: 'unlimited', name: '룰 · 무제한', group: '룰', kinds: ['mega', 'zmove', 'dynamax', 'tera'], oneKind: false, legend: 'all', stack: true, legendTeams: true,
		desc: '전설·환상 포함 모든 포켓몬(상대도 전설·환상을 데려옴). 네 가지 기믹을 종류마다 한 번씩, 한 포켓몬이 겹쳐 쓸 수도 있습니다. (메가진화·원시회귀한 포켓몬의 테라스탈만 불가)' },
	{ id: 'gen9', name: '9세대 (테라스탈)', group: '세대별', kinds: ['tera'], oneKind: true, legend: 'all', desc: '스칼렛·바이올렛 규칙. 테라스탈만.' },
	{ id: 'gen8', name: '8세대 (다이맥스)', group: '세대별', kinds: ['dynamax'], oneKind: true, legend: 'all', maxNum: 905, desc: '소드·실드 규칙. 다이맥스만, 8세대까지의 포켓몬.' },
	{ id: 'gen7', name: '7세대 (메가진화·Z기술)', group: '세대별', kinds: ['mega', 'zmove'], oneKind: false, legend: 'all', maxNum: 809, noFuture: true,
		desc: '울트라썬·문 규칙. 메가진화와 Z기술(각 1회), 7세대까지의 포켓몬.' },
	{ id: 'gen6', name: '6세대 (메가진화)', group: '세대별', kinds: ['mega'], oneKind: true, legend: 'all', maxNum: 721, noFuture: true, desc: 'X·Y / 오메가루비·알파사파이어 규칙. 메가진화만, 6세대까지의 포켓몬.' },
	{ id: 'champmc', name: '챔피언스 레귤레이션 M-C', group: '포켓몬 챔피언스', kinds: ['mega'], oneKind: true, legend: 'sub', megaOnly: megaIds(MEGA_MC),
		desc: '2026.9~12. 메가진화 1회(허용 메가 81종), 전설·환상 제외, 같은 도구 금지. 레벨 50.' },
	{ id: 'champmb', name: '챔피언스 레귤레이션 M-B', group: '포켓몬 챔피언스', kinds: ['mega'], oneKind: true, legend: 'none', megaOnly: megaIds(MEGA_MB),
		desc: '2026.6~9. 메가진화 1회(허용 메가 75종), 전설·준전설·환상 제외.' },
	{ id: 'champma', name: '챔피언스 레귤레이션 M-A', group: '포켓몬 챔피언스', kinds: ['mega'], oneKind: true, legend: 'none', megaOnly: megaIds(MEGA_MA),
		desc: '2026.4~6 (출시 규칙). 메가진화 1회(허용 메가 59종), 전설·준전설·환상 제외.' },
	{ id: 'none', name: '기믹 없음', group: '기타', kinds: [], oneKind: true, legend: 'all', desc: '기믹 없이 배틀합니다.' },
];
export const DEFAULT_RULE = 'natdexflat';
export function ruleById(id: string): BattleRule { return RULES.find(r => r.id === id) || RULES[0]; }

/** 이 규칙에서 쓸 수 있는 포켓몬인가 (메가 모습 등 아이템으로 바뀌는 모습은 기본 모습으로 판단) */
export function speciesAllowed(rule: BattleRule, speciesId: string): boolean {
	const s = RAW.species[toID(speciesId)];
	if (!s) return false;
	if (rule.maxNum && s.num > rule.maxNum) return false;
	if (rule.noFuture && s.fut) return false;
	const tags = s.tags || [];
	if (rule.legend !== 'all' && tags.some(t => t === 'Restricted Legendary' || t === 'Mythical')) return false;
	if (rule.legend === 'none' && tags.includes('Sub-Legendary')) return false;
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
