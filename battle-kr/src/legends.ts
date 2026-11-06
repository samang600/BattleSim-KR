/** 네임드 트레이너 엔트리를 배틀 규칙에 맞게 조정: 전설·환상이 허용되면 설정상 어울리는 전설을 넣어 강하게,
 *  금지되면 원래 팀의 전설을 다른 포켓몬으로 바꾼다. */
import { RAW, speciesData, bst, toID } from './data';
import { speciesAllowed, type BattleRule } from './rules';
import { speciesPool, rng } from './sets';
import type { NamedTrainer } from './trainers';

/** 트레이너별 설정상 어울리는 전설·환상(restricted/mythical)과 준전설(sub) */
const LORE: { [id: string]: { legend?: string[]; sub?: string[] } } = {
	// 관동·성도
	red: { legend: ['mewtwo'], sub: ['zapdos', 'articuno', 'moltres'] }, leaf: { legend: ['mew'], sub: ['articuno'] }, blue: { legend: ['mewtwo'], sub: ['moltres'] },
	trace: { sub: ['zapdos'] }, giovanni: { legend: ['mewtwo'] }, lance: { legend: ['rayquaza'], sub: ['latios'] },
	ethan: { legend: ['hooh'], sub: ['raikou'] }, lyra: { legend: ['lugia'], sub: ['entei'] }, kris: { legend: ['celebi'], sub: ['suicune'] }, silver: { sub: ['raikou'] },
	// 호연
	maxie: { legend: ['groudon'], sub: ['heatran'] }, archie: { legend: ['kyogre'], sub: ['suicune'] }, tabitha: { sub: ['regirock'] }, courtney: { sub: ['heatran'] },
	matt: { sub: ['regice'] }, shelly: { sub: ['tapufini'] }, brendan: { legend: ['rayquaza'], sub: ['latios'] }, may: { legend: ['jirachi'], sub: ['latias'] },
	wally: { legend: ['deoxys'], sub: ['latias'] }, steven: { legend: ['rayquaza'], sub: ['registeel', 'regirock', 'regice'] }, wallace: { legend: ['kyogre'], sub: ['tapufini'] },
	// 신오
	cynthia: { legend: ['giratina'], sub: ['cresselia'] }, lucasp: { legend: ['dialga'], sub: ['azelf'] }, dawnp: { legend: ['palkia'], sub: ['mesprit'] },
	barry: { legend: ['heatran'], sub: ['uxie'] }, cyrus: { legend: ['dialga', 'giratina'], sub: ['darkrai'] }, mars: { sub: ['cresselia'] }, jupiter: { sub: ['azelf'] },
	saturn: { sub: ['uxie'] }, charon: { legend: ['heatran'], sub: ['regigigas'] },
	// 하나
	alder: { legend: ['keldeo'], sub: ['landorus'] }, iris: { legend: ['kyurem'], sub: ['regidrago'] }, hilbertp: { legend: ['zekrom'], sub: ['thundurus'] },
	hildap: { legend: ['reshiram'], sub: ['tornadus'] }, nate: { legend: ['kyuremblack'], sub: ['terrakion'] }, rosa: { legend: ['kyuremwhite'], sub: ['virizion'] },
	cherenbw: { sub: ['cobalion'] }, bianca: { sub: ['virizion'] }, hugh: { sub: ['terrakion'] }, n: { legend: ['zekrom', 'reshiram'], sub: ['landorus'] },
	ghetsis: { legend: ['kyurem'], sub: ['tornadus'] }, colress: { legend: ['genesect'], sub: ['regieleki'] },
	// 칼로스
	diantha: { legend: ['diancie'], sub: ['latias'] }, calem: { legend: ['xerneas'], sub: ['moltres'] }, serena: { legend: ['yveltal'], sub: ['articuno'] },
	shauna: { legend: ['diancie'] }, tierno: { sub: ['zapdos'] }, trevor: { legend: ['hoopa'] }, lysandre: { legend: ['yveltal', 'xerneas'], sub: ['moltres'] },
	xerosic: { sub: ['regieleki'] }, mable: { sub: ['tornadus'] },
	// 알로라
	kukui: { legend: ['necrozma'], sub: ['tapukoko'] }, hau: { sub: ['tapukoko'] }, elio: { legend: ['solgaleo'], sub: ['tapulele'] }, selene: { legend: ['lunala'], sub: ['tapufini'] },
	gladion: { legend: ['necrozmaduskmane'], sub: ['typenull'] }, lillie: { legend: ['magearna'], sub: ['tapubulu'] }, guzma: { sub: ['buzzwole'] }, plumeria: { sub: ['nihilego'] },
	lusamine: { legend: ['necrozma'], sub: ['nihilego', 'pheromosa'] }, faba: { sub: ['xurkitree'] },
	// 가라르
	leon: { legend: ['eternatus'], sub: ['zapdosgalar'] }, victor: { legend: ['zacian'], sub: ['regieleki'] }, gloria: { legend: ['zamazenta'], sub: ['regidrago'] },
	hop: { legend: ['zamazenta', 'zacian'], sub: ['articunogalar'] }, bede: { sub: ['moltresgalar'] }, marnie: { sub: ['spectrier'] }, rose: { legend: ['eternatus'], sub: ['registeel'] },
	oleana: { sub: ['glastrier'] },
	// 팔데아
	geeta: { legend: ['terapagos'], sub: ['tinglu'] }, kieran: { legend: ['terapagos'], sub: ['ogerpon'] }, florian: { legend: ['koraidon'], sub: ['chienpao'] },
	juliana: { legend: ['miraidon'], sub: ['chiyu'] }, nemona: { sub: ['okidogi'] }, arven: { sub: ['wochien'] }, penny: { sub: ['fezandipiti'] }, carmine: { sub: ['ogerpon'] },
	mela: { sub: ['chiyu'] }, giacomo: { sub: ['munkidori'] }, atticus: { sub: ['munkidori'] }, ortega: { sub: ['fezandipiti'] }, eri: { sub: ['okidogi'] },
};

/** 타입 전문가(관장·사천왕 등)용: 타입별 전설·환상 / 준전설 */
const LEGEND_BY_TYPE: { [t: string]: string[] } = {
	Normal: ['regigigas', 'meloetta'], Fire: ['hooh', 'reshiram', 'groudon'], Water: ['kyogre', 'palkia', 'lugia', 'manaphy'], Electric: ['zekrom', 'miraidon', 'zeraora'],
	Grass: ['shaymin', 'celebi', 'virizion'], Ice: ['kyurem', 'kyuremwhite', 'glastrier'], Fighting: ['koraidon', 'keldeo', 'marshadow'], Poison: ['eternatus', 'pecharunt'],
	Ground: ['groudon', 'zygarde', 'landorus'], Flying: ['lugia', 'hooh', 'rayquaza', 'yveltal'], Psychic: ['mewtwo', 'lugia', 'lunala', 'necrozma', 'calyrex'], Bug: ['genesect', 'buzzwole'],
	Rock: ['diancie'], Ghost: ['giratina', 'lunala', 'marshadow', 'spectrier'], Dragon: ['rayquaza', 'dialga', 'palkia', 'reshiram', 'zekrom', 'eternatus'],
	Dark: ['yveltal', 'darkrai', 'hoopaunbound'], Steel: ['dialga', 'solgaleo', 'jirachi', 'magearna', 'melmetal'], Fairy: ['xerneas', 'zacian', 'diancie', 'magearna'],
};
const SUB_BY_TYPE: { [t: string]: string[] } = {
	Normal: ['regigigas', 'typenull'], Fire: ['entei', 'moltres', 'heatran', 'chiyu'], Water: ['suicune', 'tapufini', 'keldeo'], Electric: ['raikou', 'zapdos', 'thundurus', 'regieleki', 'tapukoko'],
	Grass: ['virizion', 'tapubulu', 'wochien', 'celebi'], Ice: ['articuno', 'regice', 'glastrier', 'chienpao'], Fighting: ['terrakion', 'cobalion', 'virizion', 'okidogi'],
	Poison: ['munkidori', 'fezandipiti', 'okidogi', 'nihilego'], Ground: ['landorus', 'tinglu'], Flying: ['articuno', 'zapdos', 'moltres', 'tornadus', 'landorus', 'enamorus'],
	Psychic: ['latios', 'latias', 'cresselia', 'tapulele', 'uxie', 'azelf', 'mesprit'], Bug: ['buzzwole', 'pheromosa', 'genesect'], Rock: ['regirock', 'terrakion', 'tinglu', 'stakataka'],
	Ghost: ['spectrier', 'marshadow'], Dragon: ['latios', 'latias', 'regidrago'], Dark: ['chienpao', 'chiyu', 'wochien', 'tinglu', 'guzzlord'], Steel: ['registeel', 'cobalion', 'heatran', 'jirachi', 'kartana'],
	Fairy: ['tapukoko', 'tapulele', 'tapubulu', 'tapufini', 'enamorus', 'diancie'],
};

function isLegend(id: string) { return !!RAW.species[id]?.tags?.some(t => t === 'Restricted Legendary' || t === 'Mythical'); }
function isSub(id: string) { return !!RAW.species[id]?.tags?.includes('Sub-Legendary'); }
/** 팀에서 가장 많은 타입 (타입 전문가 판정) */
function dominantType(team: string[]): string {
	const c: { [t: string]: number } = {};
	for (const id of team) for (const t of speciesData(id, 9)?.t || []) c[t] = (c[t] || 0) + 1;
	return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Normal';
}
function valid(ids: string[] | undefined, rule: BattleRule, used: Set<string>): string[] {
	return (ids || []).filter(id => RAW.species[id] && speciesAllowed(rule, id) && !used.has(id) && !used.has(RAW.species[id].base || ''));
}

/** 규칙에 맞춘 6마리 종족 id (에이스는 유지). 룰 · 무제한이면 초전설·환상 + 준전설, 그 밖에 준전설을 허용하면 준전설 하나를 넣고,
 *  금지된 전설이 원래 팀에 있으면 같은 타입의 강한 포켓몬으로 바꾼다. */
export function rosterForRule(t: NamedTrainer, ruleIn: BattleRule): string[] {
	// 초전설·환상은 '룰 · 무제한'(legendTeams)에서만 데려옴. 그 밖에 전설을 허용하는 규칙(룰·전부, 세대별 등)은 준전설까지만
	const rule: BattleRule = ruleIn.legendTeams || ruleIn.legend !== 'all' ? ruleIn : { ...ruleIn, legend: 'sub' };
	const strong = ['champion', 'hero', 'boss'].includes(t.role);
	const type = dominantType(t.team);
	const lore = LORE[t.id] || {};
	// 1) 규칙상 못 쓰는 포켓몬 제거
	let roster = t.team.filter(id => speciesAllowed(rule, id));
	const used = new Set(roster);
	// 2) 넣을 전설·준전설 고르기
	const adds: string[] = [];
	const pick = (ids: string[], n: number) => { for (const id of rng.shuffle(valid(ids, rule, used)).slice(0, n)) { adds.push(id); used.add(id); } };
	if (rule.legend === 'all') {
		if (!roster.some(isLegend)) pick(lore.legend?.length ? lore.legend : LEGEND_BY_TYPE[type] || [], strong && (lore.legend?.length || 0) > 1 ? 2 : 1);
		if (strong && !roster.some(isSub)) pick(lore.sub?.length ? lore.sub : SUB_BY_TYPE[type] || [], 1);
	} else if (rule.legend === 'sub') {
		if (!roster.some(isSub)) pick(lore.sub?.length ? lore.sub : SUB_BY_TYPE[type] || [], 1);
	}
	// 3) 자리 만들기: 에이스를 뺀 나머지 중 종족값이 낮은 순으로 뺌
	const ace = roster.includes(t.ace) ? t.ace : roster[roster.length - 1];
	const others = roster.filter(id => id !== ace).sort((a, b) => bst(b, 9) - bst(a, 9));
	const keep = Math.max(0, 5 - adds.length);
	roster = [...others.slice(0, keep), ...adds];
	// 4) 모자라면(금지된 전설을 뺀 경우) 같은 타입의 강한 포켓몬으로 채움
	if (roster.length < 5) {
		const pool = rng.shuffle(speciesPool({ gen: 9, minBst: 500, types: [type], exclude: new Set([...roster, ace, t.ace]) }));
		for (const id of pool) { if (roster.length >= 5) break; roster.push(id); }
	}
	return [...roster.slice(0, 5), ace];
}

export const _legendUtil = { isLegend, isSub, toID };
