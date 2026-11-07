/**
 * 배틀 규칙 — 네 가지를 따로 골라 조합함 (설정 → 배틀 규칙)
 *  1) 기믹: 메가진화·Z기술·다이맥스·테라스탈 중 쓸 것(복수 선택) + 둘 이상이면 쓰는 방식(한 배틀에 하나 / 종류마다 1회 / 겹쳐 쓰기)
 *  2) 포켓몬 풀: 게임·레귤레이션에 나오는 포켓몬 (스칼렛·바이올렛, 소드·실드, 7·6세대까지, 챔피언스 M-A/B/C, 전국도감)
 *  3) 초전설 / 4) 환상: 불가 · 가능(나도 쓰고 상대도 데려옴) — 포켓몬 풀과 상관없이 따로 정함 (세대 상한만 따름)
 * 규칙 id 는 '기믹.풀.초전설.환상' (예: 't_one.sv.no.no' — 기믹 m·z·d·t 글자 + _one/_each/_stack). 예전 id(natdexflat·gen9·champmc·tera.sv… )도 읽음.
 */
import { RAW, toID, setDataSpec, itemInPool, learnset, speciesData, GEN } from './data';

export type GimmickKind = 'mega' | 'zmove' | 'dynamax' | 'tera' | 'ultra';
export type LegendMode = 'no' | 'yes';
export interface BattleRule {
	id: string; name: string; desc: string;
	gimmick: string; pool: string; restricted: LegendMode; mythical: LegendMode;
	/** 준전설(패러독스·울트라비스트 포함): 초전설·환상처럼 포켓몬 풀과 상관없이 따로 정함 (기본: 챔피언스 풀은 불가, 그 밖은 가능) */
	sub: LegendMode;
	kinds: GimmickKind[]; oneKind: boolean;
	/** 세대 상한(도감 번호) / 레전즈 Z-A 추가 메가 제외 / 게임 등장 표시(dex.json av) / 허용 메가 모습 / 준전설 제외 */
	maxNum?: number; noFuture?: boolean; avail?: string; megaOnly?: Set<string>; noSub?: boolean;
	/** 데이터 사양: 세대('' 최신) · 배틀 엔진 모드 · 기술 목록 방식 · 도구 등장 글자 */
	era: string; mod: string; lsMode: 'all' | 'champ' | 'era'; itemAv: string;
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

export interface Choice { id: string; name: string; desc: string }
/** 1) 기믹: 종류(복수 선택)와 둘 이상일 때 쓰는 방식 */
export const GIMMICK_KINDS: { k: GimmickKind; c: string; name: string }[] = [
	{ k: 'mega', c: 'm', name: '메가진화' }, { k: 'zmove', c: 'z', name: 'Z기술' }, { k: 'dynamax', c: 'd', name: '다이맥스' }, { k: 'tera', c: 't', name: '테라스탈' }];
export type GimmickMode = 'one' | 'each' | 'stack';
export const GIMMICK_MODES: (Choice & { id: GimmickMode })[] = [
	{ id: 'one', name: '한 배틀에 하나', desc: '고른 기믹 중 한 배틀에 한 종류만' },
	{ id: 'each', name: '종류마다 1회', desc: '고른 기믹을 종류마다 한 번씩' },
	{ id: 'stack', name: '겹쳐 쓰기', desc: '종류마다 한 번씩, 한 포켓몬이 겹쳐 쓸 수도 있음 (메가진화·원시회귀한 포켓몬의 테라스탈만 불가)' },
];
/** 기믹 칸 글자: 'mzdt_one' → 종류·방식 */
export function parseGimmick(g: string): { kinds: GimmickKind[]; mode: GimmickMode } | null {
	const OLD: { [k: string]: string } = { one: 'mzdt_one', each: 'mzdt_each', stack: 'mzdt_stack', tera: 't_one', dynamax: 'd_one', megaz: 'mz_each', zmove: 'z_one', mega: 'm_one', none: '_one' };
	const [letters, mode] = (OLD[g] || g).split('_');
	if (!['one', 'each', 'stack'].includes(mode) || /[^mzdt]/.test(letters)) return null;
	return { kinds: GIMMICK_KINDS.filter(x => letters.includes(x.c)).map(x => x.k), mode: mode as GimmickMode };
}
export function gimmickId(kinds: GimmickKind[], mode: GimmickMode) { return GIMMICK_KINDS.filter(x => kinds.includes(x.k)).map(x => x.c).join('') + '_' + mode; }
/** 2) 포켓몬 풀 (게임·레귤레이션) — gimmick: 고를 때 맞춰 주는 그 게임의 기믹 */
export const POOLS: (Choice & { gimmick: string; maxNum?: number; noFuture?: boolean; avail?: string; megaOnly?: Set<string>; noSub?: boolean; legends?: [LegendMode, LegendMode]; subPar?: [LegendMode, LegendMode]; era: string; mod: string; lsMode: 'all' | 'champ' | 'era'; itemAv: string })[] = [
	{ id: 'natdex', name: '전국도감', gimmick: 'mzdt_one', era: '', mod: 'krchamp', lsMode: 'all', itemAv: '', desc: '모든 포켓몬·도구, 최신 사양(포켓몬 챔피언스 기술·상태이상), 모든 세대의 기술과 메가진화(레전즈 Z-A 메가 포함)' },
	{ id: 'max', name: '무제한 (너프 없음)', gimmick: 'mzdt_stack', legends: ['yes', 'yes'], era: 'max', mod: 'krmax', lsMode: 'all', itemAv: '', desc: '모든 포켓몬·도구·기술, 너프 전 사양: 종족값은 가장 높았던 세대, 특성은 모든 세대의 특성 중에서, 기술 위력·명중·PP는 가장 높았던 값 (예: 킬가르도 블레이드폼 공격 150, 팬텀 부유)' },
	{ id: 'sv', name: '스칼렛·바이올렛', gimmick: 't_one', avail: 's', era: '9', mod: 'gen9', lsMode: 'era', itemAv: 's', desc: '스칼렛·바이올렛(DLC 포함)의 포켓몬·도구·기술 사양' },
	{ id: 'swsh', name: '소드·실드', gimmick: 'd_one', avail: 'w', maxNum: 905, era: '8', mod: 'kr8', lsMode: 'era', itemAv: 'w', desc: '소드·실드(DLC 포함)의 포켓몬·도구, 그때의 종족값·특성·기술' },
	{ id: 'usum', name: '7세대까지', gimmick: 'mz_each', avail: '7', maxNum: 809, noFuture: true, era: '7', mod: 'kr7', lsMode: 'era', itemAv: '7', desc: '울트라썬·문까지의 포켓몬(1~7세대)·도구, 그때의 종족값·특성·기술' },
	{ id: 'xy', name: '6세대까지', gimmick: 'm_one', avail: '6', maxNum: 721, noFuture: true, era: '6', mod: 'kr6', lsMode: 'era', itemAv: '6', desc: 'X·Y/오메가루비·알파사파이어까지의 포켓몬(1~6세대)·도구, 그때의 종족값·특성·기술' },
	{ id: 'champmc', subPar: ['no', 'no'], name: '챔피언스 M-C', gimmick: 'm_one', avail: 'c', legends: ['no', 'no'], era: '', mod: 'krchamp', lsMode: 'champ', itemAv: 'c', desc: '포켓몬 챔피언스 레귤레이션 M-C(2026.9~12)에 나오는 포켓몬과 메가진화' },
	{ id: 'champmb', subPar: ['no', 'no'], name: '챔피언스 M-B', gimmick: 'm_one', avail: 'b', legends: ['no', 'no'], era: '', mod: 'krchamp', lsMode: 'champ', itemAv: 'b', desc: '레귤레이션 M-B(2026.6~9)에 나오는 포켓몬과 메가진화' },
	{ id: 'champma', subPar: ['no', 'no'], name: '챔피언스 M-A', gimmick: 'm_one', avail: 'b', megaOnly: megaIds(MEGA_MA), legends: ['no', 'no'], era: '', mod: 'krchamp', lsMode: 'champ', itemAv: 'b', desc: '레귤레이션 M-A(2026.4~6, 출시 규칙) — 포켓몬은 M-B 기준, 메가진화 59종' },
];
/** 3·4) 초전설·환상 */
export const LEGEND_MODES: Choice[] = [
	{ id: 'no', name: '불가', desc: '쓸 수 없음' },
	{ id: 'yes', name: '가능', desc: '나도 쓰고 상대도 데려옴' },
];
/** 챔피언스 풀의 메가: 그 레귤레이션에 나오는 메가 모습 */
const champMegas = (flag: string) => new Set(Object.keys(RAW.species).filter(id => RAW.species[id].av?.includes(flag) && /mega/.test(id) && RAW.species[id].base));
for (const p of POOLS) if (p.id === 'champmc') p.megaOnly = champMegas('c'); else if (p.id === 'champmb') p.megaOnly = champMegas('b');

/** 예전 규칙 id → 새 조합 */
const LEGACY: { [id: string]: string } = {
	natdexflat: 'mzdt_one.natdex.no.no', natdex: 'mzdt_one.natdex.yes.yes', natdexfree: 'mzdt_each.natdex.yes.yes', unlimited: 'mzdt_stack.natdex.yes.yes',
	gen9: 't_one.sv.yes.yes', gen8: 'd_one.swsh.yes.yes', gen7: 'mz_each.usum.yes.yes', gen6: 'm_one.xy.yes.yes',
	champmc: 'm_one.champmc.no.no', champmb: 'm_one.champmb.no.no', champma: 'm_one.champma.no.no', none: '_one.natdex.yes.yes',
};
export const DEFAULT_RULE = 'mzdt_one.natdex.no.no';
/** 기록·연승 도전 저장 키에 붙이는 규칙 표시: 기본 규칙은 '' (예전 기록 그대로), 그 밖은 '@규칙id' */
export function recTag(ruleIdIn: string) { const id = ruleById(ruleIdIn).id; return id === DEFAULT_RULE ? '' : '@' + id; }
/** 풀의 준전설(패러독스·울트라비스트 포함) 기본값 (챔피언스는 게임에 없어 불가) */
export function poolSub(pool: string): LegendMode { return POOLS.find(x => x.id === pool)?.subPar?.[0] ?? 'yes'; }
/** 준전설 스위치에 묶이는 포켓몬: 준전설 · 패러독스 · 울트라비스트 */
export function isSubLike(tags: readonly string[]) { return tags.includes('Sub-Legendary') || tags.includes('Paradox') || tags.includes('Ultra Beast'); }
/** 규칙 id: 기믹.풀.초전설.환상[.준전설] — 준전설이 풀 기본값과 같으면 붙이지 않음 (예전 기록·연승 저장 키를 그대로 쓰려고) */
export function ruleId(gimmick: string, pool: string, restricted: LegendMode, mythical: LegendMode, sub?: LegendMode) {
	const ds = poolSub(pool);
	const tail = (sub ?? ds) === ds ? '' : `.${sub}`;
	return `${gimmick}.${pool}.${restricted}.${mythical}${tail}`;
}
const cache = new Map<string, BattleRule>();
export function ruleById(idIn: string): BattleRule {
	const id0 = LEGACY[idIn] || idIn || DEFAULT_RULE;
	const hit = cache.get(id0); if (hit) return hit;
	// v2.49.4 의 6단계 id(…준전설.패러독스)는 준전설 값만 씀
	const [g0, p, r0, m0, s0] = id0.split('.');
	const gim = parseGimmick(g0), pool = POOLS.find(x => x.id === p);
	// 예전 3단계(no/yes/foe) 값은 foe → 가능
	const leg = (v: string): LegendMode | null => v === 'no' ? 'no' : v === 'yes' || v === 'foe' ? 'yes' : null;
	const restricted = leg(r0), mythical = leg(m0);
	if (!gim || !pool || !restricted || !mythical) return ruleById(DEFAULT_RULE);
	const sub = (s0 ? leg(s0) : null) ?? poolSub(p);
	const g = gimmickId(gim.kinds, gim.mode), id = ruleId(g, p, restricted, mythical, sub);
	const names = GIMMICK_KINDS.filter(x => gim.kinds.includes(x.k)).map(x => x.name);
	const modeOn = gim.kinds.length > 1;
	const gName = !names.length ? '기믹 없음' : names.join('·') + (modeOn ? ` (${GIMMICK_MODES.find(x => x.id === gim.mode)!.name})` : '');
	const ok = (v: LegendMode) => v === 'yes' ? '가능' : '불가';
	const legTxt = (restricted === mythical ? `초전설·환상 ${ok(restricted)}` : `초전설 ${ok(restricted)} · 환상 ${ok(mythical)}`)
		+ ` · 준전설(패러독스·울트라비스트 포함) ${ok(sub)}`;
	const rule: BattleRule = {
		id, gimmick: g, pool: p, restricted, mythical, sub,
		name: `${pool.name} · ${gName}`,
		desc: `${pool.desc}. 기믹: ${!names.length ? '없음' : modeOn ? `${names.join('·')} — ${GIMMICK_MODES.find(x => x.id === gim.mode)!.desc}` : `${names[0]}만`}. ${legTxt}.`,
		kinds: gim.kinds, oneKind: !modeOn || gim.mode === 'one', stack: modeOn && gim.mode === 'stack',
		maxNum: pool.maxNum, noFuture: pool.noFuture, avail: pool.avail, megaOnly: pool.megaOnly, noSub: pool.noSub || sub === 'no',
		era: pool.era, mod: pool.mod, lsMode: pool.lsMode, itemAv: pool.itemAv,
		legendTeams: restricted === 'yes' || mythical === 'yes',
	};
	cache.set(id0, rule); cache.set(id, rule);
	return rule;
}

/** 앱 데이터(종족값·특성·기술 목록·도구 목록)를 이 규칙의 포켓몬 풀 사양으로 */
export function applyRuleData(rule: BattleRule) { setDataSpec(rule.era, rule.lsMode, rule.itemAv); }
/** 이 규칙에서 쓸 수 있는 도구인가 (풀에 있는 도구 + 메가스톤·Z크리스탈은 기믹 규칙) */
export function itemAllowed(rule: BattleRule, itemId: string): boolean {
	const id = toID(itemId), it = RAW.items[id];
	if (!id) return true;
	if (!it) return false;
	if (it.mega) return megaStoneAllowed(rule, id);
	if (it.zt || it.zf) return rule.kinds.includes('zmove');
	if (!rule.itemAv) return true;
	return !!it.av?.includes(rule.itemAv);
}

/** 이 규칙에서 쓸 수 있는 포켓몬인가 (메가 모습 등 아이템으로 바뀌는 모습은 기본 모습으로 판단) */
export function speciesAllowed(rule: BattleRule, speciesId: string): boolean {
	const s = RAW.species[toID(speciesId)];
	if (!s) return false;
	if (rule.maxNum && s.num > rule.maxNum) return false;
	if (rule.noFuture && s.fut) return false;
	const tags = s.tags || [];
	const restricted = tags.includes('Restricted Legendary'), mythical = tags.includes('Mythical');
	const sub = isSubLike(tags);
	if (restricted && rule.restricted === 'no') return false;
	if (mythical && rule.mythical === 'no') return false;
	if (sub && rule.sub === 'no') return false;
	// 게임 등장 여부는 초전설·환상·준전설(패러독스·울트라비스트 포함)이 아닌 포켓몬에만 (이들은 설정으로 따로 정함)
	if (rule.avail && !restricted && !mythical && !sub) {
		const av = s.av ?? (s.base ? RAW.species[s.base]?.av : undefined);
		if (!av?.includes(rule.avail)) return false;
	}
	if (rule.noSub && sub) return false;
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
export function teamRuleWarnings(rule: BattleRule, sets: { species: string; item: string; ability?: string; moves?: string[] }[]): string[] {
	const w: string[] = [];
	const bad = sets.filter(s => !speciesAllowed(rule, s.species)).map(s => RAW.species[toID(s.species)]?.n || s.species);
	if (bad.length) w.push(`이 규칙(${rule.name})에서 쓸 수 없는 포켓몬: ${bad.join(', ')}`);
	const badStone = sets.filter(s => RAW.items[toID(s.item)]?.mega && !megaStoneAllowed(rule, s.item)).map(s => RAW.items[toID(s.item)]!.n);
	if (badStone.length) w.push(`이 규칙에서 쓸 수 없는 메가스톤: ${badStone.join(', ')}${rule.kinds.includes('mega') ? '' : ' (메가진화 불가 규칙)'}`);
	const badZ = rule.kinds.includes('zmove') ? [] : sets.filter(s => RAW.items[toID(s.item)]?.zt).map(s => RAW.items[toID(s.item)]!.n);
	if (badZ.length) w.push(`이 규칙에서는 Z크리스탈을 쓸 수 없어요: ${badZ.join(', ')}`);
	const badItem = sets.filter(s => s.item && !RAW.items[toID(s.item)]?.mega && !RAW.items[toID(s.item)]?.zt && !itemAllowed(rule, s.item)).map(s => RAW.items[toID(s.item)]?.n || s.item);
	if (badItem.length) w.push(`이 포켓몬 풀(${POOLS.find(p => p.id === rule.pool)?.name})에 없는 도구: ${[...new Set(badItem)].join(', ')}`);
	// 그 세대에 없는 특성·기술 (치트 팀은 따로 검사하지 않음)
	for (const st of sets) {
		const sp = speciesData(st.species, GEN);
		if (!sp) continue;
		const name = sp.n;
		if (st.ability && sp.ab && !sp.ab.includes(toID(st.ability))) w.push(`${name}: 이 풀에서는 특성 ${RAW.abilities[toID(st.ability)]?.n || st.ability}을(를) 가질 수 없어요`);
		if (st.moves?.length) {
			const ls = new Set(learnset(st.species, GEN));
			const badM = st.moves.filter(m => m && !/^hiddenpower/.test(toID(m)) && !ls.has(toID(m))).map(m => RAW.moves[toID(m)]?.n || m);
			if (badM.length) w.push(`${name}: 이 풀에서 배울 수 없는 기술 — ${badM.join(', ')}`);
		}
	}
	return w;
}
