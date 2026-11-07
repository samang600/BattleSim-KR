/** 포켓몬 세트(기술·도구·노력치) 만들기 */
import { loadSettings } from './store';
import { ruleById, speciesAllowed, megaStoneAllowed } from './rules';
import { Teams } from '../../sim/teams';
import { RAW, speciesData, learnset, moveData, toID, bst, speciesKo, nickKo, megaStonesFor, zCrystalForType, type Gen, type StatID } from './data';
import FACTORY_SETS from '../../data/random-battles/gen9/factory-sets.json';
import { smogonSet, synergyPick } from './smogon';

export interface PSet {
	name: string; species: string; item: string; ability: string; moves: string[]; nature: string;
	evs: { [k in StatID]: number }; ivs: { [k in StatID]: number }; level: number; gender?: string; shiny?: boolean; teraType?: string; /** 거다이맥스 (다이맥스 규칙에서만 의미) */ gigantamax?: boolean; /** 몬스터볼 종류 (등장 연출) */ pokeball?: string;
}

const generators: { [gen: number]: any } = {};
function generator(gen: Gen) {
	return generators[gen] ||= Teams.getGenerator(`gen${gen}randombattle`);
}

export const rng = {
	int(n: number) { return Math.floor(Math.random() * n); },
	pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; },
	shuffle<T>(arr: T[]): T[] {
		const a = arr.slice();
		for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
		return a;
	},
};

const BAN_MOVES = new Set(['explosion', 'selfdestruct', 'focuspunch', 'dreameater', 'lastresort', 'synchronoise', 'snore',
	'belch', 'futuresight', 'doomdesire', 'fling', 'naturalgift', 'struggle', 'counter', 'mirrorcoat', 'metalburst', 'bide',
	'feint', 'skyattack', 'razorwind', 'skullbash', 'solarbeam', 'hyperbeam', 'gigaimpact', 'blastburn', 'hydrocannon',
	'frenzyplant', 'rockwrecker', 'roaroftime', 'dig', 'fly', 'bounce', 'dive', 'shadowforce', 'skydrop', 'freezeshock',
	'iceburn', 'chatter', 'thrash', 'petaldance', 'rollout', 'iceball', 'uproar', 'present', 'magnitude', 'beatup', 'spitup',
	'trumpcard', 'punishment', 'payday', 'fakeout', 'selfdestruct', 'memento', 'healingwish', 'lunardance', 'finalgambit',
	'echoedvoice', 'round', 'fusionflare', 'fusionbolt', 'covet', 'thief', 'pursuit', 'smellingsalts', 'wakeupslap',
	'shockwave', 'magicalleaf', 'aerialace', 'swift', 'feintattack', 'shadowpunch', 'vitalthrow', 'magnetbomb', 'hiddenpower']);
const GOOD_STATUS_OFF = ['swordsdance', 'dragondance', 'nastyplot', 'calmmind', 'quiverdance', 'bulkup', 'shellsmash', 'rockpolish', 'agility', 'coil', 'shiftgear'];
const GOOD_STATUS_DEF = ['spore', 'stealthrock', 'toxic', 'willowisp', 'thunderwave', 'recover', 'roost', 'slackoff', 'softboiled',
	'synthesis', 'moonlight', 'morningsun', 'milkdrink', 'wish', 'leechseed', 'sleeppowder', 'spikes', 'healbell', 'aromatherapy',
	'reflect', 'lightscreen', 'protect', 'substitute', 'trickroom', 'tailwind', 'yawn', 'hypnosis', 'taunt', 'encore', 'painsplit', 'rest'];
const ABILITY_PREF = ['hugepower', 'purepower', 'speedboost', 'adaptability', 'levitate', 'intimidate', 'technician', 'drought',
	'drizzle', 'sandstream', 'snowwarning', 'magicguard', 'naturalcure', 'regenerator', 'thickfat', 'swiftswim', 'chlorophyll',
	'moxie', 'sheerforce', 'guts', 'multiscale', 'sturdy', 'flashfire', 'voltabsorb', 'waterabsorb', 'poisonheal', 'skilllink',
	'serenegrace', 'download', 'trace', 'simple', 'wonderguard', 'shadowtag', 'arenatrap', 'magnetpull', 'unaware', 'marvelscale',
	'roughskin', 'ironfist', 'reckless', 'toughclaws', 'analytic', 'sniper', 'hustle', 'noguard', 'tintedlens', 'solarpower',
	'clearbody', 'insomnia', 'synchronize', 'pressure', 'innerfocus', 'justified', 'sapsipper', 'motordrive', 'lightningrod',
	'stormdrain', 'filter', 'solidrock', 'prankster'];

function effectivePower(id: string, gen: Gen) {
	const m = moveData(id, gen)!;
	let bp = m.basePower;
	if (['lowkick', 'grassknot'].includes(id)) bp = 70;
	if (id === 'return' || id === 'frustration') bp = 102;
	if (id === 'gyroball' || id === 'heavyslam') bp = 70;
	if (id === 'seismictoss' || id === 'nightshade') bp = 80;
	const multi: { [id: string]: number } = {
		bulletseed: 3, iciclespear: 3, rockblast: 3, pinmissile: 3, tailslap: 3, doublehit: 2, dualchop: 2, bonemerang: 2,
		doublekick: 2, geargrind: 2, triplekick: 3, armthrust: 3, furyattack: 3, furyswipes: 3, cometpunch: 3, doubleslap: 3,
		spikecannon: 3, barrage: 3, bonerush: 3, twineedle: 2,
	};
	if (multi[id]) bp *= multi[id];
	const acc = m.accuracy === 0 ? 100 : m.accuracy;
	let v = bp * acc / 100;
	if (['closecombat', 'overheat', 'dracometeor', 'leafstorm', 'superpower', 'psychoboost', 'vcreate'].includes(id)) v *= 0.9;
	if (['doubleedge', 'bravebird', 'flareblitz', 'woodhammer', 'headsmash', 'volttackle', 'wildcharge', 'takedown', 'submission'].includes(id)) v *= 0.9;
	if (['jumpkick', 'highjumpkick'].includes(id)) v *= 0.85;
	if (m.priority > 0) v *= 1.1;
	return v;
}

/** 랜덤배틀 세트 데이터가 없는 포켓몬용 자동 세트 */
export function buildSet(speciesId: string, gen: Gen, style?: 'P' | 'S'): PSet {
	const s = speciesData(speciesId, gen)!;
	const moves = learnset(speciesId, gen).filter(id => moveData(id, gen));
	const [hp, atk, , spa, , spe] = s.bs;
	void hp;
	// style: 특성까지 따진 공격 성향(메가 등)으로 물리/특수를 정할 때
	const physical = style ? style === 'P' : atk >= spa;
	const scored = moves.map(id => {
		const m = moveData(id, gen)!;
		if (m.category === 'Status' || !m.basePower && !['seismictoss', 'nightshade', 'lowkick', 'grassknot', 'gyroball', 'heavyslam', 'return'].includes(id)) return null;
		if (BAN_MOVES.has(id) || id.startsWith('hiddenpower')) return null;
		let v = effectivePower(id, gen);
		if (s.t.includes(m.type)) v *= 1.5;
		const catOk = (m.category === 'Physical') === physical;
		if (!catOk) v *= style ? 0.35 : Math.min(atk, spa) / Math.max(atk, spa) * 0.9;
		return { id, type: m.type, v };
	}).filter(Boolean) as { id: string; type: string; v: number }[];
	scored.sort((a, b) => b.v - a.v);

	const chosen: string[] = [];
	const types = new Set<string>();
	for (const t of s.t) {
		const best = scored.find(x => x.type === t && !chosen.includes(x.id));
		if (best && best.v > 40) { chosen.push(best.id); types.add(t); }
	}
	for (const x of scored) {
		if (chosen.length >= 3) break;
		if (types.has(x.type)) continue;
		chosen.push(x.id); types.add(x.type);
	}
	// 랭크업 기술은 공격 성향에 맞는 것만 (물리형에 명상·나쁜음모, 특수형에 칼춤·벌크업이 들어가지 않게)
	const SPEC_ONLY = ['nastyplot', 'calmmind', 'quiverdance'], PHYS_ONLY = ['swordsdance', 'dragondance', 'bulkup', 'coil', 'shiftgear'];
	const status = moves.filter(id => (physical || spe >= 90 ? GOOD_STATUS_OFF : []).includes(id) && !(physical ? SPEC_ONLY : PHYS_ONLY).includes(id));
	const status2 = moves.filter(id => GOOD_STATUS_DEF.includes(id));
	const util = status.length ? rng.pick(status) : status2.length ? rng.pick(status2) : null;
	if (util && chosen.length >= 3) chosen.splice(3, 0, util);
	for (const x of scored) {
		if (chosen.length >= 4) break;
		if (!chosen.includes(x.id)) chosen.push(x.id);
	}
	for (const id of status2) {
		if (chosen.length >= 4) break;
		if (!chosen.includes(id)) chosen.push(id);
	}
	let ability = s.ab[0];
	for (const pref of ABILITY_PREF) if (s.ab.includes(pref)) { ability = pref; break; }
	let item = 'leftovers';
	if (!s.fe && gen >= 5) item = 'eviolite';
	else if (chosen.some(id => GOOD_STATUS_OFF.includes(id))) item = rng.pick(['lifeorb', 'leftovers', 'lumberry']);
	else if (spe >= 90 && chosen.every(id => moveData(id, gen)!.category !== 'Status')) item = rng.pick(['choicescarf', 'lifeorb', 'expertbelt']);
	else if (spe < 70 && chosen.every(id => moveData(id, gen)!.category !== 'Status')) item = physical ? 'choiceband' : 'choicespecs';
	if (s.req) item = s.req;
	const set: PSet = {
		name: nickKo(speciesId), species: s.en, item, ability, moves: chosen.slice(0, 4), nature: 'serious',
		evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
	};
	applySpread(set, gen);
	return set;
}

/** 기술 구성에 맞춰 노력치·성격 정하기 */
export function applySpread(set: PSet, gen: Gen, role = '') {
	const s = speciesData(set.species, gen)!;
	const [, atk, def, spa, sdef, spe] = s.bs;
	let phys = 0, spec = 0, stat = 0;
	for (const id of set.moves) {
		const m = moveData(id, gen);
		if (!m) continue;
		if (m.category === 'Physical') phys++;
		else if (m.category === 'Special') spec++;
		else stat++;
	}
	const usesPhys = phys > 0 && (phys >= spec || atk > spa + 20);
	const usesSpec = spec > 0 && (spec > phys || spa > atk + 20);
	const mixed = phys > 0 && spec > 0 && Math.abs(atk - spa) < 25;
	const bulky = stat >= 2 || /Staller|Bulky Support|Support/.test(role) || (spe < 60 && def + sdef > 200);
	const fast = spe >= 75 || /Fast|Sweeper|Setup/.test(role);
	const ev = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
	let nature = 'serious';
	const trickRoom = set.moves.includes('trickroom');
	if (bulky && !fast) {
		ev.hp = 252;
		if (usesPhys) { ev.atk = 252; ev.def = 4; nature = trickRoom ? 'brave' : 'adamant'; }
		else if (usesSpec) { ev.spa = 252; ev.spd = 4; nature = trickRoom ? 'quiet' : 'modest'; }
		else if (def <= sdef) { ev.def = 252; ev.spd = 4; nature = atk > spa ? 'impish' : 'bold'; }
		else { ev.spd = 252; ev.def = 4; nature = atk > spa ? 'careful' : 'calm'; }
	} else if (mixed) {
		ev.atk = 128; ev.spa = 128; ev.spe = 252;
		nature = def < sdef ? 'naive' : 'hasty';
		if (spe < 60) { ev.spe = 0; ev.hp = 252; nature = 'serious'; }
	} else if (usesSpec) {
		ev.spa = 252; ev.spe = 252; ev.hp = 4;
		nature = spe >= 95 ? 'timid' : 'modest';
		if (spe < 55) { ev.spe = 0; ev.hp = 252; ev.spd = 4; nature = trickRoom ? 'quiet' : 'modest'; }
	} else {
		ev.atk = 252; ev.spe = 252; ev.hp = 4;
		nature = spe >= 95 ? 'jolly' : 'adamant';
		if (spe < 55) { ev.spe = 0; ev.hp = 252; ev.def = 4; nature = trickRoom ? 'brave' : 'adamant'; }
	}
	if (bulky && fast && !usesPhys && !usesSpec) {
		for (const k in ev) (ev as any)[k] = 0;
		ev.hp = 252; ev.spe = 252; ev.spd = 4;
		nature = 'timid';
	}
	set.evs = ev;
	set.nature = nature;
	if (set.moves.includes('gyroball') || trickRoom) { set.ivs.spe = 0; }
	return set;
}

function sanitizeMoves(moves: string[], gen: Gen) {
	const out: string[] = [];
	for (let m of moves) {
		m = toID(m);
		if (/^return\d+$/.test(m)) m = 'return';
		if (/^frustration\d+$/.test(m)) m = 'frustration';
		if (!out.includes(m) && moveData(m, gen)) out.push(m);
		if (out.length >= 4) break;
	}
	return out;
}

/** 랜덤배틀 세트(있으면) 또는 자동 세트 */
/** 공격 성향: 'P' 물리 · 'S' 특수 · 'M' 둘 다 — 특성(천하장사·순수한힘 ×2, 단단한발톱·옹골찬턱·철주먹 ×1.3, 메가런처 ×1.3)까지 반영 */
function offenseStyle(bs: number[], ab: string[] = []): 'P' | 'S' | 'M' {
	let a = bs[1], c = bs[3];
	if (ab.some(x => x === 'hugepower' || x === 'purepower')) a *= 2;
	if (ab.some(x => x === 'toughclaws' || x === 'strongjaw' || x === 'ironfist')) a *= 1.3;
	if (ab.includes('megalauncher')) c *= 1.3;
	return a > c * 1.15 ? 'P' : c > a * 1.15 ? 'S' : 'M';
}
/** 메가스톤을 쥐여 줄 때: 메가진화 뒤 공격 성향이 세트와 다르면(예: 메가아쿠스타 = 천하장사 물리형) 메가 모습 기준으로 기술·성격·노력치를 다시 짬 */
export function fitSetToMega(set: PSet, stone: string, gen: Gen): PSet {
	set.item = stone;
	const megaName = (RAW.items as any)[toID(stone)]?.mega;
	const mega = megaName ? speciesData(toID(megaName), gen) : null;
	if (!mega) return set;
	const want = offenseStyle(mega.bs, mega.ab);
	let phys = 0, spec = 0;
	for (const id of set.moves) { const m = moveData(id, gen); if (m?.category === 'Physical') phys++; else if (m?.category === 'Special') spec++; }
	const have = phys > spec ? 'P' : spec > phys ? 'S' : 'M';
	if (want === 'M' || want === have) return set;
	const b = buildSet(toID(megaName), gen, want); // 기술은 기본 모습의 배울 수 있는 기술에서, 능력치·타입·특성은 메가 모습 기준
	set.moves = b.moves.filter(id => moveData(id, gen));
	const tmp: PSet = { ...set, species: mega.en, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } };
	applySpread(tmp, gen);
	set.evs = tmp.evs; set.nature = tmp.nature;
	return set;
}
export function randomSetFor(speciesId: string, gen: Gen, level = 50, doubles = false, quality = 0.5): PSet {
	const id = toID(speciesId);
	// Smogon 사용률 통계가 있으면 실전형 세트 (quality 가 높을수록 자주 쓰는 구성)
	const sm = smogonSet(id, gen, level, doubles, quality);
	if (sm) { sm.name = nickKo(id); if ((RAW.items as any)[sm.item]?.mega) fitSetToMega(sm, sm.item, gen); return sm; }
	const g = generator(gen);
	let set: PSet;
	const table = doubles ? g.randomDoublesSets : g.randomSets;
	if (table?.[id]) {
		try {
			const r = g.randomSet(id, {}, false, doubles);
			set = {
				name: nickKo(id), species: speciesData(id, gen)?.en || r.species, item: toID(r.item), ability: toID(r.ability),
				moves: sanitizeMoves(r.moves, gen), nature: 'serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
				ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level, teraType: r.teraType,
			};
			if (set.moves.length < 1) throw new Error('no moves');
			// 랜덤배틀 세트의 잠재파워 타입 유지
			const hp = r.moves.find((m: string) => toID(m).startsWith('hiddenpower'));
			if (hp && toID(hp) !== 'hiddenpower') {
				const idx = set.moves.findIndex(m => m.startsWith('hiddenpower'));
				if (idx < 0 && set.moves.length < 4) set.moves.push(toID(hp));
			}
			applySpread(set, gen, r.role || '');
		} catch {
			set = buildSet(id, gen);
		}
	} else {
		set = buildSet(id, gen);
	}
	set.level = level;
	return set;
}

export interface PoolOptions {
	gen: Gen; minBst?: number; maxBst?: number; allowSubLegend?: boolean; types?: string[]; exclude?: Set<string>; /** nfe: 진화 전·중간 진화만 */ stage?: 'nfe';
	/** 전설·환상(restricted/mythical)도 포함 (규칙이 허용할 때만) / legendOnly: 전설·환상만 */
	allowLegend?: boolean; legendOnly?: boolean;
}

const BANNED_POOL = new Set(['unown', 'ditto', 'smeargle', 'wobbuffet', 'wynaut', 'shedinja', 'pichuspikyeared', 'castform',
	'cherrim', 'kecleon', 'luvdisc', 'delibird', 'spinda', 'farfetchd', 'plusle', 'minun', 'pachirisu', 'chatot', 'beautifly',
	'dustox', 'kricketune', 'wormadam', 'wormadamsandy', 'wormadamtrash', 'mothim', 'combee', 'burmy', 'phione', 'caterpie',
	'arceus', 'giratinaorigin', 'shayminsky', 'deoxys', 'deoxysattack', 'deoxysdefense', 'deoxysspeed', 'basculinbluestriped',
	'genesectdouse', 'genesectshock', 'genesectburn', 'genesectchill', 'keldeoresolute', 'meloettapirouette',
]);

/** 조건에 맞는 최종진화(일반) 포켓몬 목록 */
export function speciesPool(o: PoolOptions): string[] {
	const out: string[] = [];
	const rule = ruleById(loadSettings().battleRule);
	for (const id in RAW.species) {
		const s = speciesData(id, o.gen);
		if (!s || !RAW.species[id].g[o.gen]) continue;
		// stage 'nfe': 진화 전·중간 진화만 (쉬움 난이도 초반), 아니면 최종 진화만
		if ((o.stage === 'nfe' ? s.fe : !s.fe) || s.bo || BANNED_POOL.has(id) || o.exclude?.has(id)) continue;
		const isR = !!s.tags?.includes('Restricted Legendary'), isM = !!s.tags?.includes('Mythical'), legend = isR || isM;
		// 상대 무작위 팀의 초전설·환상: 그 종류가 가능한 규칙에서만
		const foeOk = (isR && rule.restricted === 'yes') || (isM && rule.mythical === 'yes');
		if (o.legendOnly ? !(legend && (foeOk || o.allowLegend)) : (legend && !o.allowLegend && !foeOk)) continue;
		if (!speciesAllowed(rule, id)) continue;
		if (!o.allowSubLegend && s.tags?.includes('Sub-Legendary')) continue;
		if (s.base && s.req && !/^(rotom|ogerpon)/.test(id)) continue; // 아르세우스·실버디 타입폼 등은 제외
		const b = bst(id, o.gen);
		if (o.minBst && b < o.minBst) continue;
		if (o.maxBst && b > o.maxBst) continue;
		if (o.types && !s.t.some(t => o.types!.includes(t))) continue;
		out.push(id);
	}
	return out;
}

const ITEM_ALTS = ['leftovers', 'sitrusberry', 'lumberry', 'lifeorb', 'expertbelt', 'focussash', 'choicescarf', 'choiceband',
	'choicespecs', 'shellbell', 'quickclaw', 'brightpowder', 'scopelens', 'whiteherb', 'chestoberry', 'salacberry', 'liechiberry',
	'petayaberry', 'kingsrock', 'widelens', 'muscleband', 'wiseglasses', 'blacksludge', 'lightclay', 'mentalherb'];
/** 도구 중복 금지(배틀타워 규칙) */
export function dedupeItems(team: PSet[]) {
	const used = new Set<string>();
	for (const set of team) {
		if (used.has(set.item)) {
			const alt = ITEM_ALTS.find(i => !used.has(i) && RAW.items[i]);
			set.item = alt || '';
		}
		if (set.item) used.add(set.item);
	}
	return team;
}

export function randomTeam(o: PoolOptions & { size: number; level?: number; ivs?: number; itemClause?: boolean; must?: string[]; doubles?: boolean; gimmicks?: boolean;
	/** 0~1: 높을수록 Smogon 통계상 흔한(검증된) 세트와 자주 같이 쓰는 동료로 팀을 짬 (기본 0.5) */ quality?: number }): PSet[] {
	const quality = o.quality ?? 0.5;
	const pool = rng.shuffle(speciesPool(o));
	const picked: string[] = [...(o.must || [])];
	const usedBase = new Set(picked.map(id => speciesData(id, o.gen)?.num));
	const free = () => new Set(pool.filter(id => !usedBase.has(speciesData(id, o.gen)!.num)));
	for (const id of pool) {
		if (picked.length >= o.size) break;
		// 이미 고른 포켓몬과 자주 같이 쓰이는 포켓몬을 우선 (날씨·트릭룸 같은 조합이 자연스럽게)
		let next = id;
		if (picked.length && Math.random() < 0.3 + 0.5 * quality) next = synergyPick(picked, free(), !!o.doubles, quality) || id;
		const num = speciesData(next, o.gen)!.num;
		if (usedBase.has(num)) continue;
		usedBase.add(num);
		picked.push(next);
	}
	const team = picked.map(id => {
		const set = randomSetFor(id, o.gen, o.level ?? 50, !!o.doubles, quality);
		if (speciesData(id, o.gen)?.gx && Math.random() < 0.6) set.gigantamax = true;
		set.pokeball = conceptBall(id, String(Math.random()));
		// 개체값이 없는 챔피언스 규칙: 초반 상대의 약함은 능력 포인트를 줄여서 표현
		if (o.ivs !== undefined && o.ivs < 31) for (const k in set.evs) (set.evs as any)[k] = Math.floor((set.evs as any)[k] * Math.max(0, o.ivs) / 31);
		return set;
	});
	limitGimmickItems(team);
	if (o.gimmicks !== false) assignGimmicks(team);
	return o.itemClause === false ? team : dedupeItems(team);
}
/** 통계 세트로 메가스톤·Z크리스탈이 여러 개 생기면 하나씩만 남김 */
export function limitGimmickItems(team: PSet[]) {
	let mega = false, z = false;
	for (const s of team) {
		const it = RAW.items[s.item];
		if (it?.mega) { if (mega) s.item = ''; mega = true; }
		else if (it?.zt || it?.zu) { if (z) s.item = ''; z = true; }
	}
	return team;
}

/** 팀에 메가스톤·Z크리스탈을 하나씩 (가능하면) 나눠 주고 테라스탈 타입을 정함 */
export function assignGimmicks(team: PSet[], opts: { mega?: number; z?: number } = {}) {
	const rule = ruleById(loadSettings().battleRule);
	const megaOnlyRule = rule.kinds.length === 1 && rule.kinds[0] === 'mega';
	const megaProb = rule.kinds.includes('mega') ? (opts.mega ?? 0.6) * (megaOnlyRule ? 1.6 : 1) : 0;
	const zProb = rule.kinds.includes('zmove') ? (opts.z ?? 0.4) * (rule.kinds.length === 2 ? 1.5 : 1) : 0;
	const hasMega = team.some(s => RAW.items[s.item]?.mega);
	const hasZ = team.some(s => RAW.items[s.item]?.zt);
	if (!hasMega && Math.random() < megaProb) {
		const cands = team.filter(s => megaStonesFor(s.species).some(st => megaStoneAllowed(rule, st)) && !speciesData(s.species, 9)?.req);
		if (cands.length) {
			const set = rng.pick(cands);
			fitSetToMega(set, rng.pick(megaStonesFor(set.species).filter(st => megaStoneAllowed(rule, st))), 9);
		}
	}
	if (!hasZ && Math.random() < zProb) {
		const cands = team.filter(s => !RAW.items[s.item]?.mega && !speciesData(s.species, 9)?.req && !/^choice/.test(s.item));
		if (cands.length) {
			const set = rng.pick(cands);
			const types = speciesData(set.species, 9)!.t;
			const stab = set.moves.map(m => moveData(m, 9)).filter(m => m && m.category !== 'Status' && types.includes(m.type))
				.sort((a, b) => b!.basePower - a!.basePower)[0];
			const z = stab ? zCrystalForType(stab.type) : null;
			if (z) set.item = z;
		}
	}
	for (const s of team) if (!s.teraType) s.teraType = speciesData(s.species, 9)?.t[0];
	return team;
}

/** 9세대 배틀팩토리 세트 (티어: PU → NU → RU → UU → OU → Uber) */
export const FACTORY_TIERS = ['PU', 'NU', 'RU', 'UU', 'OU', 'Uber'] as const;
export function factoryTeam(tier: string, size: number, level: number, exclude = new Set<string>(), type?: string, noSubLegend = false): PSet[] {
	const table = (FACTORY_SETS as any)[tier] || (FACTORY_SETS as any).OU;
	const rule = ruleById(loadSettings().battleRule);
	const ids = rng.shuffle(Object.keys(table).filter(id => !exclude.has(id) && speciesData(id, 9) && speciesAllowed(rule, id) && (!type || speciesData(id, 9)!.t.includes(type))
		&& !(noSubLegend && speciesData(id, 9)!.tags?.some(t => t === 'Sub-Legendary' || t === 'Restricted Legendary' || t === 'Mythical'))));
	const out: PSet[] = [];
	const nums = new Set<number>();
	for (const id of ids) {
		if (out.length >= size) break;
		const num = speciesData(id, 9)!.num;
		if (nums.has(num)) continue;
		const entry = table[id];
		const total = entry.sets.reduce((a: number, x: any) => a + (x.weight || 1), 0);
		let r = Math.random() * total;
		let fs = entry.sets[0];
		for (const x of entry.sets) { r -= x.weight || 1; if (r <= 0) { fs = x; break; } }
		const pick = (v: any) => Array.isArray(v) ? rng.pick(v) : v;
		const moves = fs.moves.map((slot: any) => toID(pick(slot))).filter((m: string) => moveData(m, 9));
		const sid = toID(fs.species);
		const sd = speciesData(sid, 9);
		if (!sd || moves.length < 2) continue;
		nums.add(num);
		const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(fs.evs || {}) };
		const ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...(fs.ivs || {}) };
		out.push({
			name: nickKo(sid), species: sd.en, item: toID(pick(fs.item) || ''), ability: toID(pick(fs.ability) || sd.ab[0]),
			moves: [...new Set(moves)] as string[], nature: toID(pick(fs.nature) || 'serious'), evs, ivs, level, teraType: pick(fs.teraType) || sd.t[0],
		});
	}
	return out;
}

/** 시뮬레이터에 넘길 형태로 */
// ── 포켓몬 챔피언스 능력 포인트(SP) ──
// 능력마다 0~32, 합계 66. 개체값은 없음(모두 최대). 레벨 50에서 1포인트 = 능력치 +1.
// 시뮬레이터에는 같은 효과의 노력치로 바꿔 넣는다: 첫 1포인트 = 4, 이후 1포인트 = 8 (32포인트 = 252)
export const SP_MAX = 32, SP_TOTAL = 66;
export const STAT_KEYS: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export function evToSp(ev: number) { return ev >= 4 ? Math.min(SP_MAX, 1 + Math.floor((ev - 4) / 8)) : 0; }
export function spToEv(sp: number) { return sp > 0 ? Math.min(252, 4 + 8 * (Math.min(SP_MAX, sp) - 1)) : 0; }
/** 노력치(252) 방식으로 보여 줄지 (설정: 능력 포인트 표시). 저장·규칙은 항상 포인트(합계 66) */
export function evDisplay(): boolean { try { return loadSettings().evDisplay === 'ev'; } catch { return false; } }
/** 한 능력의 포인트를 설정에 맞춰 글자로: 32 또는 252 */
export function fmtSP(sp: number): string { return String(evDisplay() ? spToEv(sp) : sp); }
/** 본가(합계 510) 노력치로: 챔피언스는 66포인트라 본가보다 1포인트(노력치 8) 많을 수 있음 → 가장 적게 투자한 능력에서 그만큼 뺌 (쇼다운에 그대로 붙여 넣을 수 있게) */
export function evsFor510(sp: { [k in StatID]: number }): { [k in StatID]: number } {
	const p = { ...sp };
	const sum = () => STAT_KEYS.reduce((a, k) => a + spToEv(p[k]), 0);
	while (sum() > 510) { const k = STAT_KEYS.filter(x => p[x] > 0).sort((a, b) => p[a] - p[b])[0]; if (!k) break; p[k]--; }
	return Object.fromEntries(STAT_KEYS.map(k => [k, spToEv(p[k])])) as { [k in StatID]: number };
}
export function spOf(set: PSet) {
	const o = {} as { [k in StatID]: number };
	for (const k of STAT_KEYS) o[k] = evToSp(set.evs?.[k] || 0);
	// 합계 66 초과분은 적게 투자된 능력부터 깎는다
	let over = STAT_KEYS.reduce((a, k) => a + o[k], 0) - SP_TOTAL;
	while (over > 0) {
		const k = STAT_KEYS.filter(x => o[x] > 0).sort((a, b) => o[a] - o[b])[0];
		const d = Math.min(over, o[k]); o[k] -= d; over -= d;
	}
	return o;
}
/** 자동 배분용: 합계가 66에 못 미치면 남은 포인트를 채운다 (252/252/4 → 32/32/2) */
export function fillSP<T extends PSet>(set: T): T {
	normalizeSP(set);
	const sp = spOf(set);
	let left = SP_TOTAL - STAT_KEYS.reduce((a, k) => a + sp[k], 0);
	// 이미 투자한(최대가 아닌) 능력 → HP → 방어·특방 순으로
	const order = [...STAT_KEYS.filter(k => sp[k] > 0 && sp[k] < SP_MAX), 'hp', 'def', 'spd', 'atk', 'spa', 'spe'] as StatID[];
	for (const k of order) { while (left > 0 && sp[k] < SP_MAX) { sp[k]++; left--; } if (!left) break; }
	for (const k of STAT_KEYS) set.evs[k] = spToEv(sp[k]);
	return set;
}
/** 노력치·개체값을 챔피언스 규칙(SP, 개체값 최대)에 맞춘다 */
export function normalizeSP<T extends PSet>(set: T): T {
	const sp = spOf(set);
	for (const k of STAT_KEYS) { set.evs[k] = spToEv(sp[k]); set.ivs[k] = 31; }
	return set;
}

export function cheatSP<T extends PSet>(set: T): T {
	for (const k of STAT_KEYS) { set.evs[k] = spToEv(evToSp(set.evs[k] || 0)); set.ivs[k] = 31; }
	return set;
}

export function toSimTeam(team: PSet[], cheat = false) {
	// 치트 배틀: 합계 66 제한 없이 능력마다 최대 32포인트
	team = team.map(s => cheat ? cheatSP(cloneSet(s)) : normalizeSP(cloneSet(s)));
	// 닉네임: 시뮬레이터가 못 쓰는 글자(, | [ ])를 빼고, 같은 팀에 같은 이름이 있으면 번호를 붙임 (교체 화면 등에서 이름으로 찾음)
	const used = new Set<string>();
	const nameOf = (s: PSet) => {
		let n = (s.name || speciesKo(s.species)).replace(/[,|[\]]/g, '').trim().slice(0, 18) || speciesKo(s.species);
		for (let k = 2; used.has(n); k++) n = `${(s.name || speciesKo(s.species)).slice(0, 15)}${k}`;
		used.add(n); return n;
	};
	return team.map(s => ({
		name: nameOf(s), species: s.species, item: s.item, ability: s.ability, moves: s.moves.slice(),
		nature: s.nature, evs: { ...s.evs }, ivs: { ...s.ivs }, level: s.level, gender: s.gender || '', shiny: !!s.shiny, gigantamax: !!s.gigantamax && !!speciesData(s.species, 9)?.gx, pokeball: s.pokeball || 'pokeball',
		teraType: s.teraType || speciesData(s.species, 9)?.t[0],
	}));
}

export function cloneSet(s: PSet): PSet {
	return JSON.parse(JSON.stringify(s));
}

/* ───── 포켓몬에 어울리는 볼 ─────
 * 컨셉(타입·전설·울트라비스트·무게·스피드·진화 전 등)에 맞는 볼 60%, 아무 볼 25%, 몬스터볼 15%.
 * seed 가 같으면 항상 같은 볼 (같은 트레이너의 같은 포켓몬은 매번 같은 볼로 나옴) */
const MOON_MONS = new Set(['clefairy', 'clefable', 'cleffa', 'jigglypuff', 'wigglytuff', 'lunatone', 'munna', 'musharna', 'lunala', 'cresselia', 'umbreon', 'nidoking', 'nidoqueen', 'skitty', 'delcatty', 'ursaluna', 'ursalunabloodmoon']);
const TYPE_BALLS: { [t: string]: string[] } = {
	Water: ['diveball', 'netball', 'lureball'], Bug: ['netball', 'netball'], Dark: ['duskball'], Ghost: ['duskball', 'duskball'],
	Fairy: ['loveball', 'dreamball', 'healball'], Psychic: ['dreamball', 'moonball'], Grass: ['nestball', 'friendball'],
	Fire: ['repeatball', 'fastball'], Electric: ['quickball', 'fastball'], Flying: ['quickball'], Ice: ['premierball'],
	Dragon: ['ultraball', 'luxuryball'], Steel: ['heavyball', 'timerball'], Rock: ['heavyball'], Ground: ['heavyball'],
	Fighting: ['sportball', 'ultraball'], Normal: ['greatball', 'friendball'], Poison: ['duskball', 'greatball'],
};
const ANY_BALLS = ['greatball', 'ultraball', 'premierball', 'luxuryball', 'timerball', 'repeatball', 'healball', 'quickball', 'duskball'];
export function conceptBall(speciesId: string, seed = ''): string {
	const id = toID(speciesId);
	let h = 2166136261;
	for (const c of seed + ':' + id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
	const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
	const sd: any = speciesData(id, 9);
	if (!sd) return 'pokeball';
	const tags: string[] = sd.tags || [];
	const pool: string[] = [];
	if (tags.includes('Ultra Beast')) pool.push('beastball', 'beastball', 'beastball');
	if (tags.includes('Restricted Legendary') || tags.includes('Mythical')) pool.push('masterball', 'cherishball', 'masterball');
	if (tags.includes('Sub-Legendary')) pool.push('ultraball', 'luxuryball', 'masterball');
	if (MOON_MONS.has(id)) pool.push('moonball', 'moonball');
	for (const t of sd.t || []) pool.push(...(TYPE_BALLS[t] || []));
	if ((sd.bs?.[5] || 0) >= 110) pool.push('quickball', 'fastball');
	if ((sd.wt || 0) >= 200) pool.push('heavyball', 'heavyball');
	if (!sd.fe) pool.push('nestball', 'levelball', 'friendball');
	const r = rnd();
	const from = (a: string[]) => a[Math.floor(rnd() * a.length)];
	if (pool.length && r < 0.6) return from(pool);
	return r < 0.85 ? from(ANY_BALLS) : 'pokeball';
}
