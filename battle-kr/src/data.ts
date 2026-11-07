/** 빌드 시 만든 dex.json 을 감싸는 도우미 */
import DEX from './gen/dex.json';

/** 배틀 규칙 세대 — 9세대 내셔널 도감 고정 */
export type Gen = 9;
export const GEN: Gen = 9;
export type StatID = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export const STATS: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export interface SpeciesGen { t: string[]; bs: number[]; ab: string[]; fe: number; bo?: number; gr?: string; req?: string; wt: number; ls?: number[]; /** ls 와 같은 순서로, 배울 수 있는 세대 표시 글자(48+비트: 1=6세대까지 2=7세대까지 4=8세대 8=9세대) */ lg?: string; cls?: number[] }
/** 세대 사양(종족값·타입·특성) 차이 */
export interface SpeciesEra { bs?: number[]; t?: string[]; ab?: string[] }
type MoveTuple = [string, string, number, number, number, number, string, number];
export interface SpeciesEntry { n: string; en: string; num: number; base?: string; tags?: string[]; tier?: string; fut?: 1; /** 게임별 등장: s=스칼렛·바이올렛 w=소드·실드 c=챔피언스 M-C b=챔피언스 M-B */ av?: string; /** 거다이맥스 가능 */ gx?: 1; g: { [gen: string]: SpeciesGen }; /** 세대별 사양 차이 ('8'·'7'·'6') */ e?: { [era: string]: SpeciesEra } }
export interface MoveEntry { n: string; d: string; z?: number; x?: number; g: { [gen: string]: MoveTuple }; /** 세대 사양: '9'=챔피언스 변경 전 9세대, '8'·'7'·'6' */ e?: { [era: string]: MoveTuple } }

const D = DEX as any as {
	species: { [id: string]: SpeciesEntry };
	moves: { [id: string]: MoveEntry };
	abilities: { [id: string]: { n: string; d: string; gen: number } };
	items: { [id: string]: { n: string; d: string; gens: number[]; mega?: string; megaFrom?: string[]; zt?: string; zf?: string[]; zu?: string[]; sp?: number; fut?: 1; ball?: 1; /** 게임별 등장 (포켓몬과 같은 글자) */ av?: string } };
	natures: { [id: string]: { n: string; en: string; p: string; m: string } };
	types: { [en: string]: string };
	stats: { [id: string]: string };
	text: { [id: string]: any };
	defaultText: { [k: string]: string | null };
	moveIds: string[];
};
export const RAW = D;

export function toID(text: any): string {
	if (text?.id) text = text.id;
	else if (text?.userid) text = text.userid;
	if (typeof text !== 'string' && typeof text !== 'number') return '';
	return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export const STAT_KO: { [k: string]: string } = {
	hp: 'HP', atk: '공격', def: '방어', spa: '특수공격', spd: '특수방어', spe: '스피드', accuracy: '명중률', evasion: '회피율',
};
export const STAT_SHORT: { [k: string]: string } = { hp: 'HP', atk: '공격', def: '방어', spa: '특공', spd: '특방', spe: '스피드' };

export function typeKo(t: string) { return D.types[t] || t; }

/** 규칙의 포켓몬 풀에 따른 데이터 사양 (rules.ts applyRuleData 가 정함)
 *  era: '' 최신(챔피언스 사양) / '9' 스칼렛·바이올렛 / '8'·'7'·'6' 그 세대 / 'max' 무제한(세대 중 가장 강한 사양) — 종족값·타입·특성·기술 수치
 *  lsMode: 'all' 전 세대+챔피언스 기술 / 'champ' 챔피언스 목록 / 'era' 그 세대에 배울 수 있는 기술
 *  itemAv: 도구 등장 글자 ('' = 전부) */
let ERA = '', LS_MODE: 'all' | 'champ' | 'era' = 'all', ITEM_AV = '';
export function setDataSpec(era: string, lsMode: 'all' | 'champ' | 'era', itemAv: string) { ERA = era; LS_MODE = lsMode; ITEM_AV = itemAv; }
export function dataEra() { return ERA; }
/** 지금 풀에 있는 도구인가 */
export function itemInPool(id: string) { if (!ITEM_AV) return true; const it = D.items[toID(id)]; return !!it?.av?.includes(ITEM_AV); }

/** 무제한(너프 없음): 세대 중 가장 강한 사양 — 종족값은 합계가 가장 높은 세대, 특성은 모든 세대의 특성, 타입은 최신 */
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export function maxSpecies(s: SpeciesEntry, g: SpeciesGen): SpeciesEra {
	const eras = Object.values(s.e || {});
	const bs = [g.bs, ...eras.map(e => e.bs).filter(Boolean) as number[][]].reduce((a, b) => sum(b) > sum(a) ? b : a);
	return { bs, t: g.t, ab: [...new Set([...g.ab, ...eras.flatMap(e => e.ab || [])])] };
}
/** 무제한(너프 없음): 기술 위력·명중은 챔피언스 포함 세대 중 가장 높은 값, PP는 본가 중 최대 (타입·분류 등은 챔피언스 변경 전 9세대) */
export function maxMove(m: MoveEntry): MoveTuple {
	const all = [m.g[9], ...Object.values(m.e || {})];
	const t = [...(m.e?.['9'] || m.g[9])] as MoveTuple;
	t[2] = Math.max(...all.map(x => x[2]));
	t[3] = all.some(x => x[3] === 0) ? 0 : Math.max(...all.map(x => x[3]));
	// PP: 챔피언스 PP(포인트업 없음)는 빼고 본가 값 중 최대 (본가는 포인트업으로 1.6배)
	t[4] = Math.max(...[m.e?.['9'] || m.g[9], ...['8', '7', '6'].map(k => m.e?.[k]).filter(Boolean) as MoveTuple[]].map(x => x[4]));
	return t;
}
export function speciesData(id: string, gen: Gen) {
	const s = D.species[toID(id)];
	if (!s) return null;
	const g = s.g[gen] || s.g[9];
	const e = ERA === 'max' ? maxSpecies(s, g) : ERA && ERA !== '9' ? s.e?.[ERA] : undefined;
	return { id: toID(id), ...s, ...g, ...(e ? { bs: e.bs ?? g.bs, t: e.t ?? g.t, ab: e.ab ?? g.ab } : {}) };
}
export function speciesKo(nameOrId: string) {
	const id = toID(nameOrId);
	const s = D.species[id];
	if (s) return s.n;
	// "Rotom-Wash" 같은 표기, 또는 기본 종으로
	if (id.endsWith('gmax') && D.species[id.slice(0, -4)]) return '거다이맥스' + D.species[id.slice(0, -4)].n;
	const base = D.species[id.replace(/(mega|megax|megay|megaz)$/, '')];
	if (base) return base.n;
	// "Meowstic-M" 처럼 기본형 표기가 다른 경우 — 앞부분(기본 종)으로
	const head = D.species[toID(nameOrId.split('-')[0])];
	return head?.n || nameOrId;
}
export function moveKo(nameOrId: string) {
	let id = toID(nameOrId);
	if (id.startsWith('hiddenpower')) {
		const t = nameOrId.replace(/^Hidden Power\s*/i, '').replace(/\s*\d+$/, '').trim();
		const type = t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : id.slice(11);
		const tko = type ? typeKo(type.charAt(0).toUpperCase() + type.slice(1)) : '';
		return '잠재파워' + (tko ? `(${tko})` : '');
	}
	if (/^return\d+$/.test(id)) id = 'return';
	if (/^frustration\d+$/.test(id)) id = 'frustration';
	return D.moves[id]?.n || nameOrId;
}
export function moveData(id: string, gen: Gen) {
	id = toID(id);
	if (/^return\d+$/.test(id)) id = 'return';
	const m = D.moves[id];
	if (!m) return null;
	const g = ERA === 'max' ? maxMove(m) : (ERA ? m.e?.[ERA] ?? m.e?.['9'] : undefined) || m.g[gen] || m.g[9];
	return {
		id, name: m.n, desc: m.d, type: g[0], category: g[1] as 'Physical' | 'Special' | 'Status', basePower: g[2],
		accuracy: g[3], pp: g[4], priority: g[5], target: g[6], contact: !!g[7],
	};
}
export function abilityKo(nameOrId: string) { return D.abilities[toID(nameOrId)]?.n || nameOrId; }
/** 룰(세대·무제한·챔피언스)에 따라 성능이 다른 특성의 설명 — 배틀 동작은 ps/registry.ts ABIL_ERA·챔피언스 모드와 같음.
 *  키: '8'·'7'·'6' = 그 세대 이하 룰, 'max' = 무제한, 'c' = 챔피언스 사양(전국도감·챔피언스 룰) */
const ABIL_ERA_DESC: { [id: string]: { [k: string]: string } } = {
	intrepidsword: { 8: '등장했을 때 공격이 1랭크 올라간다. 나올 때마다 발동한다.' },
	dauntlessshield: { 8: '등장했을 때 방어가 1랭크 올라간다. 나올 때마다 발동한다.' },
	protean: { 8: '기술을 쓰기 직전에 자신이 그 기술과 같은 타입으로 바뀐다. 기술을 쓸 때마다 발동한다.' },
	libero: { 8: '기술을 쓰기 직전에 자신이 그 기술과 같은 타입으로 바뀐다. 기술을 쓸 때마다 발동한다.' },
	innerfocus: { 7: '정신력이 강해서 풀죽지 않는다.' },
	oblivious: { 7: '둔감해서 헤롱헤롱이나 도발 상태가 되지 않는다.' },
	owntempo: { 7: '마이페이스라서 혼란 상태가 되지 않는다.' },
	scrappy: { 7: '고스트 타입 포켓몬에게 노말·격투 타입 기술을 맞힐 수 있다.' },
	rattled: { 7: '악·고스트·벌레 타입 기술에 맞으면 무서워서 스피드가 1랭크 올라간다.' },
	disguise: { 7: '탈로 몸을 덮어 상대의 공격을 1번 막는다(데미지 없음). 막으면 탈이 벗겨진다.' },
	moody: { 7: '매 턴이 끝날 때 능력 하나(명중률·회피율 포함)가 2랭크 오르고 다른 하나가 1랭크 떨어진다.' },
	galewings: { 6: '비행 타입 기술의 우선도가 1 올라간다. HP와 관계없이 발동한다.' },
	aerilate: { 6: '노말 타입 기술이 비행 타입이 되고 위력이 1.3배가 된다.' },
	pixilate: { 6: '노말 타입 기술이 페어리 타입이 되고 위력이 1.3배가 된다.' },
	refrigerate: { 6: '노말 타입 기술이 얼음 타입이 되고 위력이 1.3배가 된다.' },
	normalize: { 6: '자신이 쓰는 모든 기술이 노말 타입이 된다. 위력은 그대로다.' },
	healer: { c: '턴이 끝날 때 50% 확률로 같은 편 포켓몬의 상태이상을 회복한다.' },
	runaway: { c: '도망칠 수 없게 하는 기술·특성의 영향을 받지 않고 언제든 교체할 수 있다.' },
};
/** 무제한(너프 없음)에서 쓰는 쪽 (registry.ts MAX_ABIL 과 같음) */
const MAX_ABIL_DESC = ['intrepidsword', 'dauntlessshield', 'protean', 'libero', 'disguise', 'galewings', 'aerilate', 'pixilate', 'refrigerate'];
export function abilityDesc(id: string) {
	const k = toID(id), e = ABIL_ERA_DESC[k];
	if (e) {
		if (ERA === 'max') { if (MAX_ABIL_DESC.includes(k)) return Object.values(e)[0]; }
		else if (ERA === '') { if (e.c) return e.c; }
		else if (+ERA <= 8) { const g = Object.keys(e).filter(x => x !== 'c' && +ERA <= +x).sort()[0]; if (g) return e[g]; }
	}
	return D.abilities[k]?.d || '';
}
export function itemKo(nameOrId: string) { return D.items[toID(nameOrId)]?.n || nameOrId; }
export function itemDesc(id: string) { return D.items[toID(id)]?.d || ITEM_DESC[toID(id)] || ''; }
export function natureKo(nameOrId: string) { return D.natures[toID(nameOrId)]?.n || nameOrId; }
export function natureData(id: string) { return D.natures[toID(id)]; }

export function allSpecies(gen: Gen) {
	const out: ReturnType<typeof speciesData>[] = [];
	for (const id in D.species) {
		const s = D.species[id];
		if (!s.g[gen]) continue;
		out.push(speciesData(id, gen));
	}
	return out.sort((a, b) => a!.num - b!.num || a!.id.length - b!.id.length);
}
/** 공중에 떠 있는 포켓몬 (배틀 그림을 땅에서 띄움): 부유 특성을 가질 수 있는 포켓몬 + 날개·몸으로 떠 있는 포켓몬 */
const FLOATERS = new Set([
	// 박쥐·나방·나비·벌·잠자리
	'zubat', 'golbat', 'crobat', 'woobat', 'swoobat', 'noibat', 'butterfree', 'beautifly', 'dustox', 'venomoth', 'masquerain', 'ninjask', 'yanma', 'yanmega',
	'mothim', 'vivillon', 'volcarona', 'frosmoth', 'cutiefly', 'ribombee', 'combee', 'vespiquen', 'beedrill', 'togekiss',
	// 떠 있는 고스트·에스퍼·환상
	'haunter', 'dusknoir', 'shuppet', 'banette', 'drifloon', 'drifblim', 'froslass', 'lampent', 'chandelure', 'frillish', 'jellicent', 'dreepy', 'drakloak', 'dragapult',
	'shedinja', 'mew', 'celebi', 'jirachi', 'hoopa', 'cosmog', 'cosmoem', 'nihilego', 'pecharunt', 'castform', 'klefki', 'comfey', 'minior', 'magearna',
	// 기계·광물
	'magnemite', 'magneton', 'magnezone', 'beldum', 'metang', 'porygonz', 'carbink',
]);
export function floats(speciesId: string): boolean {
	const s: any = speciesData(speciesId, 9);
	if (!s) return false;
	const base = s.base || s.id;
	if (FLOATERS.has(s.id) || FLOATERS.has(base)) return true;
	const b: any = s.base ? speciesData(s.base, 9) : s;
	return !!(s.ab?.includes('levitate') || b?.ab?.includes('levitate'));
}
/** 기술 배우기 목록: 전국도감은 본가 전 세대 목록(ls) + 포켓몬 챔피언스 목록(cls)을 합침, 챔피언스 풀은 cls, 게임 풀은 그 세대에 배울 수 있는 기술.
 * 배틀 중 모습(메가 등)은 기본 모습의 목록 */
export function learnset(id: string, gen: Gen): string[] {
	const s: any = speciesData(id, gen);
	if (!s) return [];
	const own = s.ls || s.cls ? s : s.base ? speciesData(s.base, gen) : null;
	if (!own) return [];
	if (LS_MODE === 'champ' && own.cls) return own.cls.map((i: number) => D.moveIds[i]);
	if (LS_MODE !== 'all') {
		// 그 세대에 배울 수 있는 기술만 (챔피언스 목록에 없는 포켓몬은 스칼렛·바이올렛 기준)
		const bit = ({ '9': 8, '8': 4, '7': 2, '6': 1 } as { [k: string]: number })[ERA] || 8;
		return (own.ls || []).filter((_: number, k: number) => ((own.lg?.charCodeAt(k) ?? 63) - 48) & bit).map((i: number) => D.moveIds[i]);
	}
	const out = new Set<number>([...(own.ls || []), ...(own.cls || [])]);
	return [...out].map(i => D.moveIds[i]);
}
export function allItems(gen: Gen) {
	return Object.entries(D.items).filter(([id, it]) => it.gens.includes(gen) && !it.ball && (itemInPool(id) || !!it.mega || !!it.zt))   // 메가스톤·Z크리스탈은 기믹 규칙이 정함.map(([id, it]) => ({ id, ...it }));
}
/** 몬스터볼 종류 (겉모습용) */
export function allBalls() {
	const first = ['pokeball', 'greatball', 'ultraball', 'masterball', 'premierball', 'luxuryball', 'duskball', 'quickball', 'timerball', 'healball', 'netball', 'diveball', 'nestball', 'repeatball', 'beastball', 'dreamball'];
	return Object.entries(D.items).filter(([, it]) => it.ball).map(([id, it]) => ({ id, n: it.n, sp: it.sp || 0 }))
		.sort((a, b) => (first.indexOf(a.id) < 0 ? 99 : first.indexOf(a.id)) - (first.indexOf(b.id) < 0 ? 99 : first.indexOf(b.id)) || a.n.localeCompare(b.n, 'ko'));
}
export function allNatures() {
	return Object.entries(D.natures).map(([id, n]) => ({ id, ...n }));
}
export function bst(id: string, gen: Gen) {
	const s = speciesData(id, gen);
	return s ? s.bs.reduce((a, b) => a + b, 0) : 0;
}

/** 쇼다운 스프라이트 ID (예: rotom-wash) */
export function spriteId(id: string) {
	const s = D.species[toID(id)];
	if (!s) {
		// 거다이맥스 모습: 'charizardgmax' → 'charizard-gmax'
		const g = /^(.*)gmax$/.exec(toID(id));
		if (g && D.species[g[1]]) return spriteId(g[1]) + '-gmax';
		return toID(id);
	}
	const en = s.en;
	const dash = en.indexOf('-');
	if (/^Nidoran-[MF]$/.test(en)) return toID(en);
	if (dash < 0 || ['Ho-Oh', 'Porygon-Z', 'Jangmo-o', 'Hakamo-o', 'Kommo-o', 'Chien-Pao', 'Chi-Yu', 'Ting-Lu', 'Wo-Chien'].includes(en)) return toID(en);
	return toID(en.slice(0, dash)) + '-' + toID(en.slice(dash + 1));
}

/** 공식 설명이 없는 주요 도구 설명 */
const ITEM_DESC: { [id: string]: string } = {
	leftovers: '매 턴 끝에 최대 HP의 1/16을 회복한다.',
	lifeorb: '기술 위력이 1.3배가 되지만 공격할 때마다 HP가 1/10 줄어든다.',
	choiceband: '공격이 1.5배가 되지만 같은 기술만 쓸 수 있다.',
	choicespecs: '특수공격이 1.5배가 되지만 같은 기술만 쓸 수 있다.',
	choicescarf: '스피드가 1.5배가 되지만 같은 기술만 쓸 수 있다.',
	focussash: 'HP가 가득 찼을 때 한 방에 쓰러지는 공격을 HP 1로 버틴다.',
	sitrusberry: 'HP가 절반 이하가 되면 최대 HP의 1/4을 회복한다.',
	lumberry: '상태 이상이나 혼란을 1번 회복한다.',
	expertbelt: '효과가 굉장한 기술의 위력이 1.2배가 된다.',
	blacksludge: '독타입이면 매 턴 HP 1/16 회복, 아니면 1/8 데미지.',
	brightpowder: '상대 기술의 명중률을 떨어뜨린다.',
	eviolite: '진화 전 포켓몬의 방어·특수방어가 1.5배가 된다.',
	rockyhelmet: '접촉 공격을 받으면 상대에게 최대 HP의 1/6 데미지.',
	airballoon: '땅타입 기술을 받지 않는다. 공격을 받으면 터진다.',
	whiteherb: '떨어진 능력을 1번 원래대로 되돌린다.',
	mentalherb: '헤롱헤롱·도발 등을 1번 풀어준다.',
	powerherb: '모으는 기술을 1턴 만에 쓸 수 있다.',
	quickclaw: '가끔 먼저 행동할 수 있다.',
	kingsrock: '공격할 때 가끔 상대를 풀죽게 한다.',
	scopelens: '급소에 맞히기 쉬워진다.',
	widelens: '기술의 명중률이 조금 올라간다.',
	zoomlens: '상대보다 늦게 행동하면 명중률이 올라간다.',
	lightclay: '리플렉터·빛의장막의 효과가 8턴 지속된다.',
	toxicorb: '턴 끝에 맹독 상태가 된다.',
	flameorb: '턴 끝에 화상 상태가 된다.',
	shellbell: '준 데미지의 1/8만큼 HP를 회복한다.',
	metronome: '같은 기술을 연속으로 쓰면 위력이 올라간다.',
	salacberry: 'HP가 1/4 이하가 되면 스피드가 올라간다.',
	liechiberry: 'HP가 1/4 이하가 되면 공격이 올라간다.',
	petayaberry: 'HP가 1/4 이하가 되면 특수공격이 올라간다.',
	chestoberry: '잠듦 상태를 회복한다.',
	focusband: '가끔 쓰러질 공격을 HP 1로 버틴다.',
	assaultvest: '특수방어가 1.5배가 되지만 변화 기술을 쓸 수 없다.',
	damprock: '비바라기의 효과가 8턴 지속된다.',
	heatrock: '쾌청의 효과가 8턴 지속된다.',
	smoothrock: '모래바람의 효과가 8턴 지속된다.',
	icyrock: '설경의 효과가 8턴 지속된다.',
	lightball: '피카츄의 공격·특수공격이 2배가 된다.',
	thickclub: '탕구리·텅구리의 공격이 2배가 된다.',
	souldew: '라티아스·라티오스의 특수공격·특수방어가 올라간다.',
	redcard: '공격을 받으면 상대를 교체시킨다.',
	ejectbutton: '공격을 받으면 교체한다.',
	ironball: '스피드가 반으로 줄고 땅에 닿는다.',
	laggingtail: '항상 늦게 행동한다.',
	stickybarb: '매 턴 HP가 1/8 줄어든다. 접촉하면 옮겨 붙는다.',
	bigroot: 'HP를 흡수하는 기술의 회복량이 늘어난다.',
	muscleband: '물리 기술의 위력이 조금 올라간다.',
	wiseglasses: '특수 기술의 위력이 조금 올라간다.',
};

/** 이 종족이 쓸 수 있는 메가스톤 */
export function megaStonesFor(speciesId: string): string[] {
	const en = D.species[toID(speciesId)]?.en;
	if (!en) return [];
	return Object.entries(D.items).filter(([, it]) => it.mega && it.megaFrom?.includes(en)).map(([id]) => id);
}
/** 타입 Z크리스탈 (전용 Z크리스탈 제외) */
export function zCrystalForType(type: string): string | null {
	for (const [id, it] of Object.entries(D.items)) if (it.zt === type && !it.zf) return id;
	return null;
}
export const ALL_TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic',
	'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy', 'Stellar'];

/** 배틀 중 부르는 이름 (폼 표기 없이) */
export function nickKo(id: string) { return speciesKo(id).replace(/\s*\(.*\)$/, ''); }

/** 실제 능력치 계산 */
export function calcStat(base: number, ev: number, iv: number, level: number, natMul: number, hp: boolean) {
	if (hp) return base === 1 ? 1 : Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + level + 10;
	return Math.floor((Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5) * natMul);
}
