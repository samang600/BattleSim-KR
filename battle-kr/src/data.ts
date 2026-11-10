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
// 싸라기눈(Hail)과 설경(Snowscape)은 다른 기술·날씨 — '설경 (싸라기눈)'처럼 섞어 쓰지 않음
if (D.moves.hail) { D.moves.hail.n = '싸라기눈'; D.moves.hail.d = '5턴 동안 싸라기눈을 내리게 해서 얼음타입이 아닌 포켓몬 모두에게 데미지를 준다.'; }
if (D.text.hail) Object.assign(D.text.hail, { weatherName: '싸라기눈', start: '  싸라기눈이 내리기 시작했다!', end: '  싸라기눈이 그쳤다!', upkeep: '  (싸라기눈이 계속 내리고 있다)', damage: '  싸라기눈이 {POKEMON:object} 덮쳤다!' });
if (D.text.snowscape) D.text.snowscape.weatherName = '설경';

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
export function moveKo(nameOrId: string): string {
	// 변화기의 Z기술 (Z-Recover 등): 본가 표기처럼 'Z' + 기술 이름 (Z자기재생)
	if (/^Z-/.test(nameOrId)) return 'Z' + moveKo(nameOrId.slice(2));
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
/** 8세대 이하 룰: 눈 날씨는 싸라기눈(데미지·눈퍼뜨리기·오로라베일 조건) → 설명의 '설경'을 '싸라기눈'으로 */
export function hailEra() { return ERA === '6' || ERA === '7' || ERA === '8'; }
export function eraText(t: string) { return t && hailEra() ? t.replace(/설경/g, '싸라기눈') : t; }
/** 챔피언스 사양(전국도감·챔피언스 룰)에서 효과가 바뀐 기술의 설명 (위력·명중 같은 숫자는 화면에 따로 나옴) */
const MOVE_CHAMP_DESC: { [id: string]: string } = {
	growth: '몸을 일시에 크게 성장시켜 공격과 특수공격을 올린다. 풀타입 기술이다.',
	ironhead: '강철과 같은 단단한 머리로 공격한다. 20% 확률로 상대를 풀죽게 만든다.',
	moonblast: '달의 파워를 빌려서 상대를 공격한다. 10% 확률로 상대의 특수공격을 떨어뜨린다.',
	makeitrain: '대량의 코인을 날려서 공격한다. 자신의 특수공격이 2랭크 떨어진다.',
	doubleshock: '전신의 전기를 모두 방출해서 큰 데미지를 준다. 반드시 맞는 펀치 기술이다. 사용자의 전기 타입이 없어진다.',
	dragoncheer: '용의 북돋움으로 사기를 높여서 같은 편의 기술이 급소에 맞기 쉬워진다. 소리 기술이다.',
	toxicthread: '독이 섞인 실을 뿜어낸다. 상대를 독 상태로 만들고 스피드를 2랭크 떨어뜨린다.',
	saltcure: '상대를 소금절이 상태로 만들어 매 턴 최대 체력의 1/16의 데미지를 준다. 강철타입이나 물타입에게는 매 턴 최대 체력의 1/8의 데미지를 준다.',
	snaptrap: '강철 집게덫으로 붙잡은 뒤 4-5턴 동안 상대를 끼워서 공격한다. 강철타입 기술이다.',
	snipeshot: '상대의 기술을 끌어모으는 특성이나 기술의 영향을 무시하고 선택한 상대를 공격할 수 있다. 급소에 맞기 쉽고 상대의 특성을 무시한다.',
	milkdrink: '자신이나 같은 편의 최대 HP 절반을 회복한다.',
	direclaw: '치명적인 손톱으로 공격한다. 30% 확률로 상대를 독·마비·잠듦 중 하나로 만든다.',
	crushclaw: '단단하고 날카로운 손톱으로 찢어서 공격한다. 방어를 떨어뜨릴 때가 있다. 베기 기술이다.',
	shadowclaw: '그림자로 만든 날카로운 손톱으로 찢어서 공격한다. 급소에 맞기 쉽다. 베기 기술이다.',
	dragonclaw: '날카롭고 거대한 손톱으로 찢어서 공격한다. 베기 기술이다.',
};
export function moveData(id: string, gen: Gen) {
	id = toID(id);
	if (/^return\d+$/.test(id)) id = 'return';
	const m = D.moves[id];
	if (!m) return null;
	const g = ERA === 'max' ? maxMove(m) : (ERA ? m.e?.[ERA] ?? m.e?.['9'] : undefined) || m.g[gen] || m.g[9];
	return {
		id, name: m.n, desc: eraText(ERA === '' && MOVE_CHAMP_DESC[id] || m.d), type: g[0], category: g[1] as 'Physical' | 'Special' | 'Status', basePower: g[2],
		accuracy: g[3], pp: g[4], priority: g[5], target: g[6], contact: !!g[7],
	};
}
export function abilityKo(nameOrId: string) { const id = toID(nameOrId); return id === 'asone' ? '혼연일체' : D.abilities[id]?.n || nameOrId; }
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
	transistor: { 8: '전기 타입 기술의 위력이 1.5배가 된다.' },
	battlebond: { 8: '상대를 쓰러뜨리면 유대가 깊어져 지우개굴닌자로 모습이 바뀐다. 물수리검이 위력 20으로 항상 3번 맞는다.' },
	illuminate: { 8: '배틀에서는 효과가 없다.' },
	snowwarning: { 8: '등장했을 때 날씨를 싸라기눈으로 만든다.' },
	weakarmor: { 6: '물리 기술에 맞으면 방어가 1랭크 떨어지고 스피드가 1랭크 올라간다.' },
	parentalbond: { 6: '부모와 자식 2마리가 2번 공격할 수 있다. 2번째 공격은 위력이 절반이 된다.' },
	prankster: { 6: '변화 기술의 우선도가 1 올라간다. 악타입 포켓몬에게도 통한다.' },
	healer: { c: '턴이 끝날 때 50% 확률로 같은 편 포켓몬의 상태이상을 회복한다.' },
	runaway: { c: '도망칠 수 없게 하는 기술·특성의 영향을 받지 않고 언제든 교체할 수 있다.' },
	unseenfist: { c: '접촉 기술이 방어 등으로 막히지 않고 맞지만, 그때 데미지는 1/4이 된다.' },
};
/** 무제한(너프 없음)에서 쓰는 쪽 (registry.ts MAX_ABIL 과 같음) */
const MAX_ABIL_DESC = ['intrepidsword', 'dauntlessshield', 'protean', 'libero', 'transistor', 'disguise', 'galewings', 'aerilate', 'pixilate', 'refrigerate', 'parentalbond', 'prankster'];
export function abilityDesc(id: string) {
	const k = toID(id), e = ABIL_ERA_DESC[k];
	if (e) {
		if (ERA === 'max') { if (MAX_ABIL_DESC.includes(k)) return Object.values(e)[0]; }
		else if (ERA === '') { if (e.c) return e.c; }
		else if (+ERA <= 8) { const g = Object.keys(e).filter(x => x !== 'c' && +ERA <= +x).sort()[0]; if (g) return e[g]; }
	}
	return eraText(D.abilities[k]?.d || '');
}
export function itemKo(nameOrId: string) { return D.items[toID(nameOrId)]?.n || nameOrId; }
export function itemDesc(id: string) { return eraText(D.items[toID(id)]?.d || ITEM_DESC[toID(id)] || ''); }
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
	// 바람을 타거나 날갯짓하며 떠 있는 비행 타입 (땅에 서 있는 새는 넣지 않음)
	'hoppip', 'skiploom', 'jumpluff', 'aerodactyl', 'mantine', 'mantyke', 'pidgeot', 'fearow', 'articuno', 'zapdos', 'moltres', 'lugia', 'hooh', 'rayquaza',
	'ledyba', 'ledian', 'togetic', 'gligar', 'gliscor', 'wingull', 'pelipper', 'swellow', 'volbeat', 'illumise', 'swablu', 'altaria', 'salamence', 'staraptor',
	'drifloon', 'emolga', 'sigilyph', 'braviary', 'tornadus', 'thundurus', 'landorus', 'enamorus', 'fletchinder', 'talonflame', 'noivern', 'yveltal',
	'lunala', 'celesteela', 'kartana', 'naganadel', 'poipole', 'corvisquire', 'corviknight', 'flapple', 'wattrel', 'kilowattrel', 'bombirdier', 'ironjugulis',
	// 몸이 떠 있는 포켓몬 (부유 특성이 없어도)
	'solosis', 'duosion', 'reuniclus', 'elgyem', 'beheeyem', 'sinistea', 'polteageist', 'dhelmise', 'necrozma', 'deoxys', 'manaphy', 'phione', 'diancie',
	'tapukoko', 'tapulele', 'tapubulu', 'tapufini', 'eternatus', 'glimmet', 'glimmora', 'rabsca', 'fluttermane', 'ironmoth', 'chiyu', 'poltchageist', 'sinistcha',
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
	if (s.id === 'smeargle' || toID(s.en || '') === 'smeargle') return sketchable(gen);
	const own = s.ls || s.cls ? s : s.base ? speciesData(s.base, gen) : null;
	if (!own) return [];
	// 챔피언스 목록: 폼(펌킨인 크기·가라르 파오리 등)에 따로 없으면 기본 모습의 목록
	const base: any = s.base ? speciesData(s.base, gen) : null;
	const cls = own.cls || base?.cls;
	if (LS_MODE === 'champ' && cls) return cls.map((i: number) => D.moveIds[i]);
	if (LS_MODE !== 'all') {
		// 그 세대에 배울 수 있는 기술만 (챔피언스 목록에 없는 포켓몬은 스칼렛·바이올렛 기준)
		const bit = ({ '9': 8, '8': 4, '7': 2, '6': 1 } as { [k: string]: number })[ERA] || 8;
		const out = (own.ls || []).filter((_: number, k: number) => ((own.lg?.charCodeAt(k) ?? 63) - 48) & bit).map((i: number) => D.moveIds[i]);
		// 그 세대 정보가 없어 비면 기본 모습의 목록
		if (out.length) return out;
		if (base && base !== own) { const b = learnset(s.base, gen); if (b.length) return b; }
		// 그 게임에 없던 포켓몬(예: 소드·실드 룰의 러브로스 — 레전드 아르세우스 출신)은 기술이 하나도 없어지지 않게 전체 목록
		return [...new Set<number>([...(own.ls || []), ...(own.cls || [])])].map((i: number) => D.moveIds[i]);
	}
	const out = new Set<number>([...(own.ls || []), ...(own.cls || [])]);
	return [...out].map(i => D.moveIds[i]);
}
/** 루브도(스케치): 지금 규칙(게임·풀)에서 다른 포켓몬이 배울 수 있는 기술 전부. 스케치로 못 베끼는 기술(수다·발버둥)과 Z·다이맥스 기술은 뺌 */
const NO_SKETCH = new Set(['chatter', 'struggle']);
const sketchCache = new Map<string, string[]>();
function sketchable(gen: Gen): string[] {
	const key = `${LS_MODE}|${ERA}|${gen}`;
	let out = sketchCache.get(key);
	if (out) return out;
	const set = new Set<string>(['sketch']);
	for (const id of Object.keys(D.species)) if (id !== 'smeargle') for (const m of learnset(id, gen)) set.add(m);
	out = [...set].filter(m => { const mv: any = (D.moves as any)[m]; return mv && !mv.z && !mv.x && !NO_SKETCH.has(m); });
	sketchCache.set(key, out);
	return out;
}
export function allItems(gen: Gen) {
	return Object.entries(D.items).filter(([id, it]) => it.gens.includes(gen) && !it.ball && (itemInPool(id) || !!it.mega || !!it.zt))   // 메가스톤·Z크리스탈은 기믹 규칙이 정함
		.map(([id, it]) => ({ id, ...it }));
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
/** 이 메가스톤으로 메가진화할 수 있는 포켓몬인가: 그 포켓몬 자신, 또는 성별·모양만 다른 폼(원래 모습 기준).
 *  리전폼(가라르 야도란·알로라 라이츄)과 지우개굴닌자는 원래 모습의 메가스톤으로 메가진화 못 함 */
export function megaStoneFits(itemId: string, speciesId: string): boolean {
	const it = D.items[toID(itemId)], sp = D.species[toID(speciesId)];
	if (!it?.mega || !sp) return false;
	const from = (it.megaFrom || []).map(toID);
	if (from.includes(toID(sp.en))) return true;
	return !!sp.base && !/-(Alola|Galar|Hisui|Paldea|Ash|Bond)/.test(sp.en) && from.includes(toID(sp.base));
}
/** 타입 Z크리스탈 (전용 Z크리스탈 제외) */
export function zCrystalForType(type: string): string | null {
	for (const [id, it] of Object.entries(D.items)) if (it.zt === type && !it.zf) return id;
	return null;
}
/** 테라 타입이 정해진 포켓몬: 테라파고스 = 스텔라, 오거폰 = 가면 타입 (없으면 null) */
export function fixedTera(species: string): string | null {
	const s = speciesData(toID(species), 9);
	if (!s) return null;
	const base = toID(s.en).replace(/(terastal|stellar|wellspring|hearthflame|cornerstone|teal|tera)+$/g, '');
	if (base === 'terapagos') return 'Stellar';
	if (base === 'ogerpon') return s.t[1] || 'Grass';
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
