#!/usr/bin/env node
/**
 * 배틀 시뮬레이터용 데이터 추출 (빌드 시 1회 실행)
 *
 * `node build` 로 만든 dist/ 를 읽어 4·5세대에서 쓰는 포켓몬·기술·특성·도구의
 * 한글 이름, 설명, 배울 수 있는 기술 목록, 배틀 메시지(한글)를 작은 JSON으로 만든다.
 *
 * 사용법: node battle-kr/scripts/gen-data.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(__dirname, '../src/gen/dex.json');
const PKHEX_SPECIES = path.resolve(__dirname, 'species_ko.txt');

if (!fs.existsSync(path.join(DIST, 'sim'))) {
	console.error('dist/ 가 없습니다. 먼저 저장소 루트에서 `node build` 를 실행하세요.');
	process.exit(1);
}

const { Dex, toID } = require(path.join(DIST, 'sim'));
const T = name => require(path.join(DIST, 'data/text', name));
const ko = {
	pokedex: T('ko/pokedex').PokedexText,
	moves: T('ko/moves').MovesText,
	abilities: T('ko/abilities').AbilitiesText,
	items: T('ko/items').ItemsText,
	default: T('ko/default').DefaultText,
	names: T('ko/names'),
};
const en = {
	moves: T('moves').MovesText,
	abilities: T('abilities').AbilitiesText,
	items: T('items').ItemsText,
	default: T('default').DefaultText,
};

/** 원본 TS 의 `// Official flavor text: "..."` 주석에서 한글 공식 설명을 뽑는다 */
function flavorTexts(file) {
	const src = fs.readFileSync(path.join(ROOT, 'data/text/ko', file), 'utf8');
	const out = {};
	let cur = null;
	for (const line of src.split('\n')) {
		const m = /^\t"?([a-z0-9]+)"?: \{/.exec(line);
		if (m) cur = m[1];
		const f = /\/\/ Official flavor text: "(.*)"\s*$/.exec(line);
		if (f && cur && !out[cur]) out[cur] = f[1].replace(/\\"/g, '"');
	}
	return out;
}
const flavor = {
	moves: flavorTexts('moves.ts'),
	abilities: flavorTexts('abilities.ts'),
	items: flavorTexts('items.ts'),
};

// PKHeX 의 한글 종족 이름(번호순) — ko 텍스트에 이름이 없을 때 사용
const pkhexSpecies = fs.existsSync(PKHEX_SPECIES) ?
	fs.readFileSync(PKHEX_SPECIES, 'utf8').split(/\r?\n/) : [];

const FORME_KO = {
	'Blue-Striped': '푸른줄무늬', 'Sunny': '태양의 모습', 'Rainy': '빗방울의 모습', 'Snowy': '설운의 모습',
	'Sandy': '모래땅도롱', 'Trash': '슈레도롱', 'Plant': '초목도롱', 'East': '동쪽바다', 'West': '서쪽바다',
	'Zen': '달마모드', 'Spring': '봄', 'Summer': '여름', 'Autumn': '가을', 'Winter': '겨울',
	'Origin': '오리진폼', 'Altered': '어나더폼', 'Attack': '어택폼', 'Defense': '디펜스폼', 'Speed': '스피드폼',
	'Sunshine': '포지폼', 'Sky': '스카이폼', 'Land': '랜드폼', 'Therian': '영물폼', 'Incarnate': '화신폼',
	'Resolute': '각오의 모습', 'Pirouette': '스텝폼', 'Aria': '보이스폼',
	'Douse': '아쿠아카세트', 'Shock': '번개카세트', 'Burn': '블레이즈카세트', 'Chill': '프리즈카세트',
	'Heat': '히트', 'Wash': '워시', 'Frost': '프로스트', 'Fan': '스핀', 'Mow': '커트',
	'Black': '블랙', 'White': '화이트', 'Red-Striped': '붉은줄무늬',
	'Alola': '알로라', 'Galar': '가라르', 'Hisui': '히스이', 'Paldea': '팔데아', 'Paldea-Combat': '팔데아 컴뱃종',
	'Paldea-Blaze': '팔데아 블레이즈종', 'Paldea-Aqua': '팔데아 워터종', 'Rapid-Strike': '연격의 태세', 'Single-Strike': '일격의 태세',
	'Wellspring': '우물의 가면', 'Hearthflame': '화덕의 가면', 'Cornerstone': '주춧돌의 가면', 'Teal': '벽록의 가면',
	'Bloodmoon': '붉은 달', 'Dusk-Mane': '황혼의 갈기', 'Dawn-Wings': '새벽의 날개', 'Ultra': '울트라', 'Ice': '백마 탄 모습',
	'Shadow': '흑마 탄 모습', 'Eternal': '영원의 꽃', 'Midnight': '한밤중의 모습', 'Dusk': '황혼의 모습', 'Low-Key': '로우한 모습',
	'Complete': '퍼펙트폼', '10%': '10%폼', 'Unbound': '굴레를 벗어난 모습', 'F': '암컷', 'M': '수컷', 'Pom-Pom': '파칙파칙스타일',
	"Pa'u": '훌라훌라스타일', 'Sensu': '하늘하늘스타일', 'Galar-Zen': '가라르 달마모드', 'Busted': '들킨 모습', 'School': '군집의 모습',
	'Hangry': '배고픈 모양', 'Noice': '나이스페이스', 'Gorging': '통째로 삼킨 모습', 'Gulping': '꿀꺽 삼킨 모습', 'Zero': '제로폼',
	'Hero': '마이티폼', 'Stellar': '스텔라폼', 'Terastal': '테라스탈폼', 'Four': '네 식구', 'Three-Segment': '세 마디',
	'Roaming': '도보폼', 'Blade': '블레이드폼', 'Ash': '지우개굴닌자', 'Primal': '원시회귀', 'Mega': '메가', 'Mega-X': '메가X', 'Mega-Y': '메가Y', 'Mega-Z': '메가Z',
	'Dada': '아빠', 'Bug': '벌레', 'Dark': '악', 'Dragon': '드래곤', 'Electric': '전기', 'Fairy': '페어리', 'Fighting': '격투', 'Fire': '불꽃',
	'Flying': '비행', 'Ghost': '고스트', 'Grass': '풀', 'Ground': '땅', 'Poison': '독', 'Psychic': '에스퍼', 'Rock': '바위', 'Steel': '강철',
	'Water': '물', 'Small': '작은 사이즈', 'Large': '큰 사이즈', 'Super': '특대 사이즈', 'Crowned': '왕', 'Resolute': '각오의 모습',
	'Meteor': '유성의 모습', 'Original': '500년 전의 색', 'Eternamax': '무한다이맥스', 'Curly': '젖힌 모습', 'Droopy': '늘어진 모습',
	'Stretchy': '뻗은 모습', 'Blue': '푸른 깃털', 'Yellow': '노란 깃털', 'White-Striped': '하얀줄무늬', 'Antique': '진작폼', 'Bond': '유대변화', 'Teal-Tera': '벽록의 가면 테라스탈', 'Wellspring-Tera': '우물의 가면 테라스탈', 'Hearthflame-Tera': '화덕의 가면 테라스탈', 'Cornerstone-Tera': '주춧돌의 가면 테라스탈',
};

const TYPE_KO = ko.names.TypeNames;

function speciesName(s, dex) {
	const k = ko.pokedex[s.id]?.name;
	if (k) return k;
	const base = dex.species.get(s.baseSpecies);
	const baseKo = ko.pokedex[base.id]?.name || pkhexSpecies[s.num] || s.baseSpecies;
	if (!s.forme) return baseKo;
	if (/Mega/.test(s.forme)) {
		const rest = s.forme.replace(/-?Mega-?/, ''); // 'Mega-X' → 'X', 'M-Mega' → 'M', 'Curly-Mega' → 'Curly'
		const suffix = /^[XYZ]$/.test(rest) ? rest : '';
		const sub = suffix ? '' : (FORME_KO[rest] || rest);
		return '메가' + baseKo + suffix + (sub ? `(${sub})` : '');
	}
	let forme = FORME_KO[s.forme];
	if (!forme && ['Arceus', 'Silvally'].includes(s.baseSpecies)) forme = TYPE_KO[s.forme] || s.forme;
	if (s.id === 'zaciancrowned') forme = '검왕';
	if (s.id === 'zamazentacrowned') forme = '방패왕';
	return `${baseKo}(${forme || s.forme})`;
}

/** genN 하위 객체까지 포함해 한글 메시지를 합친다. 한글이 없으면 영어 원문을 `en:` 접두로 표시 */
const SKIP_FIELDS = new Set(['name', 'desc', 'shortDesc']);
function mergeMessages(enEntry, koEntry) {
	const out = {};
	if (!enEntry) return out;
	for (const f in enEntry) {
		const v = enEntry[f];
		if (SKIP_FIELDS.has(f)) continue;
		if (typeof v === 'string') {
			const kv = koEntry?.[f];
			out[f] = kv != null ? kv : null;
		} else if (v && typeof v === 'object' && /^gen\d$/.test(f)) {
			const sub = mergeMessages(v, koEntry?.[f]);
			if (Object.keys(sub).length) out[f] = sub;
		}
	}
	return out;
}

const result = {
	species: {}, moves: {}, abilities: {}, items: {}, natures: {}, types: {}, stats: ko.names.StatNames,
	text: {}, defaultText: {},
};

// ── 기술 (9세대 내셔널 도감 기준: 과거 기술 포함, Z기술·다이맥스기술은 이름만) ──
const GEN = 9;
const dex9 = Dex.forGen(GEN);
const BAD_NONSTD = new Set(['CAP', 'LGPE', 'Custom', 'Gigantamax']);
// 포켓몬 챔피언스 기술 사양 (src/ps/champions-moves.json) — 시뮬레이터와 같은 값으로 표시
const CHAMP = require(path.resolve(__dirname, '../src/ps/champions-moves.json'));
// Showdown champions 모드(위력·명중·PP·타입·대상)도 같은 순서로: 모드 → 앱 목록
const CHAMP_MOD = require(path.join(DIST, 'data/mods/champions/moves')).Moves;
// Showdown champions 모드의 기술 배우기 목록 (포켓몬 챔피언스 기준, 폼마다 전부 적혀 있음) — 챔피언스 규칙에서 이 목록을 씀
const CHAMP_LS = require(path.join(DIST, 'data/mods/champions/learnsets')).Learnsets;
const champ = id => {
	const m = {};
	for (const k of ['type', 'basePower', 'accuracy', 'pp', 'target']) if (CHAMP_MOD[id] && CHAMP_MOD[id][k] !== undefined) m[k] = CHAMP_MOD[id][k];
	return { ...m, ...(CHAMP[id] || {}) };
};
// 9세대 게임 설명이 '사용할 수 없는 기술'인 것을 앱 사양으로 바꿈
const DESC_OVERRIDE = { return: '친밀도와 관계없이 항상 최대 위력 102로 공격한다.', frustration: '친밀도와 관계없이 항상 최대 위력 102로 공격한다.' };
const championsPP = pp => pp >= 20 ? 20 : pp >= 15 ? 16 : pp >= 10 ? 12 : pp >= 5 ? 8 : pp;
// 한국어 보충: 쇼다운 문구가 비었거나 '사용할 수 없는 기술' 안내문뿐이면 나무위키(namu.moe) → PokeAPI 순으로
// (scripts/fetch-namu-ko.py → src/ps/ko-text-namu.json, scripts/fetch-pokeapi-ko.py → src/ps/ko-text-fallback.json)
const readJson = f => { try { return require(path.resolve(__dirname, f)); } catch { return { moves: {}, items: {}, abilities: {} }; } };
const KO_NAMU = readJson('../src/ps/ko-text-namu.json');
const KO_API = readJson('../src/ps/ko-text-fallback.json');
const HANGUL = /[가-힣]/;
const usableDesc = t => !!t && HANGUL.test(t) && !t.includes('사용할 수 없는 기술');
function koDesc(cat, id, own) {
	for (const t of [own, KO_NAMU[cat]?.[id]?.d, KO_API[cat]?.[id]?.d]) if (usableDesc(t)) return t;
	return own || '';
}
function koName(cat, id, own) {
	if (KO_NAMU[cat]?.[id]?.fix) return KO_NAMU[cat][id].n;
	for (const t of [own, KO_NAMU[cat]?.[id]?.n, KO_API[cat]?.[id]?.n]) if (t && HANGUL.test(t)) return t;
	return own;
}
// 게임·레귤레이션별 등장 여부 (규칙의 '포켓몬 풀'): s=스칼렛·바이올렛, w=소드·실드, 7=7세대, 6=6세대, c=챔피언스 M-C, b=챔피언스 M-B
const AVAIL = [['s', Dex.forGen(9)], ['w', Dex.forGen(8)], ['7', Dex.forGen(7)], ['6', Dex.forGen(6)], ['c', Dex.mod('champions')], ['b', Dex.mod('championsregmb')]];
const availOf = id => AVAIL.map(([k, d]) => { const x = d.species.get(id); return x.exists && !x.isNonstandard ? k : ''; }).join('') || undefined;
const itemAvailOf = id => AVAIL.map(([k, d]) => { const x = d.items.get(id); return x.exists && !x.isNonstandard ? k : ''; }).join('') || undefined;
/** 그 세대 사양 (종족값·타입·특성): 9세대와 다른 것만 */
const ERA_DEX = [['8', Dex.forGen(8)], ['7', Dex.forGen(7)], ['6', Dex.forGen(6)]];
function speciesEra(s, d9) {
	const out = {};
	for (const [k, d] of ERA_DEX) {
		const x = d.species.get(s.id);
		if (!x.exists || x.isNonstandard === 'Future') continue;
		const bs = [x.baseStats.hp, x.baseStats.atk, x.baseStats.def, x.baseStats.spa, x.baseStats.spd, x.baseStats.spe];
		const ab = Object.values(x.abilities).map(a => d.abilities.get(a).id);
		const e = {};
		if (bs.join() !== d9.bs.join()) e.bs = bs;
		if (x.types.join() !== d9.t.join()) e.t = x.types;
		if (ab.join() !== d9.ab.join()) e.ab = ab;
		if (Object.keys(e).length) out[k] = e;
	}
	return Object.keys(out).length ? out : undefined;
}
const moveIds = [];
const moveIndex = {};
for (const m of dex9.moves.all()) {
	if (m.num <= 0 && !m.isMax) continue;
	if (m.isNonstandard && BAD_NONSTD.has(m.isNonstandard) && !m.isMax) continue; // Future(Z-A 신기술) 포함
	moveIndex[m.id] = moveIds.length;
	moveIds.push(m.id);
	result.moves[m.id] = {
		n: koName('moves', m.id, ko.moves[m.id]?.name) || m.name,
		d: DESC_OVERRIDE[m.id] || koDesc('moves', m.id, flavor.moves[m.id]),
		g: { [GEN]: [champ(m.id).type || m.type, m.category, champ(m.id).basePower ?? m.basePower, (champ(m.id).accuracy ?? m.accuracy) === true ? 0 : (champ(m.id).accuracy ?? m.accuracy), championsPP(champ(m.id).pp ?? m.pp), m.priority, champ(m.id).target || m.target, m.flags.contact ? 1 : 0] },
		z: m.isZ ? 1 : undefined, x: m.isMax ? 1 : undefined,
	};
	// 세대 사양: '9' = 챔피언스 변경 전 9세대(스칼렛·바이올렛), '8'·'7'·'6' = 그 세대 — 기본(챔피언스 사양)과 다른 것만
	const tup = x => [x.type, x.category, x.basePower, x.accuracy === true ? 0 : x.accuracy, x.pp, x.priority, x.target, x.flags.contact ? 1 : 0];
	const e = {}, def = result.moves[m.id].g[GEN], t9 = tup(m);
	if (t9.join() !== def.join()) e['9'] = t9;
	for (const [k, d] of ERA_DEX) {
		const x = d.moves.get(m.id);
		if (!x.exists || x.isNonstandard === 'Future' || x.num <= 0) continue;
		const t = tup(x);
		if (t.join() !== t9.join()) e[k] = t;
	}
	if (Object.keys(e).length) result.moves[m.id].e = e;
}

// ── 특성 ──
for (const a of dex9.abilities.all()) {
	if (a.num <= 0 || (a.isNonstandard && !['Past', 'Unobtainable', 'Future'].includes(a.isNonstandard))) continue;
	result.abilities[a.id] = { n: koName('abilities', a.id, ko.abilities[a.id]?.name) || a.name, d: koDesc('abilities', a.id, flavor.abilities[a.id]), gen: a.gen };
}

// ── 도구 (메가스톤·Z크리스탈 포함) ──
for (const it of dex9.items.all()) {
	if (it.num <= 0) continue;
	if (it.isNonstandard && !['Past', 'Unobtainable', 'Future'].includes(it.isNonstandard)) continue;
	if (/^tr\d|^tm\d|^hm\d/.test(it.id) || it.id.endsWith('mail')) continue;
	let itemName = ko.items[it.id]?.name;
	if (!itemName && it.megaStone) {
		const from = (Array.isArray(it.megaEvolves) ? it.megaEvolves[0] : it.megaEvolves) ||
			(typeof it.megaStone === 'object' ? Object.keys(it.megaStone)[0] : null) || it.itemUser?.[0] || '';
		const suffix = / X$/.test(it.name) ? 'X' : / Y$/.test(it.name) ? 'Y' : / Z$/.test(it.name) ? 'Z' : '';
		const fs0 = dex9.species.get(from);
		const fromKo = ko.pokedex[toID(from)]?.name || (fs0.exists ? speciesName(dex9.species.get(fs0.baseSpecies), dex9) : from);
		itemName = fromKo + '나이트' + suffix;
	}
	result.items[it.id] = {
		n: koName('items', it.id, itemName) || it.name, d: koDesc('items', it.id, flavor.items[it.id]), gens: [GEN],
		mega: it.megaStone ? (typeof it.megaStone === 'string' ? it.megaStone : Object.values(it.megaStone)[0]) : undefined,
		megaFrom: it.megaStone ? (typeof it.megaStone === 'object' ? Object.keys(it.megaStone) : (it.itemUser || [])) : undefined,
		zt: it.zMoveType || undefined, zf: it.zMoveFrom ? (Array.isArray(it.zMoveFrom) ? it.zMoveFrom : [it.zMoveFrom]) : undefined,
		zu: it.itemUser || undefined,
		sp: it.spritenum || 0,
		fut: it.isNonstandard === 'Future' ? 1 : undefined,
		ball: it.isPokeball ? 1 : undefined,
		av: itemAvailOf(it.id),
	};
}

// ── 포켓몬 ──
/** 기술 출처('9M','7L1','6E'…) → 배울 수 있는 세대 표시: 1=6세대까지, 2=7세대까지, 4=8세대, 8=9세대 */
const srcMask = srcs => { let m = 0; for (const x of srcs || []) { const g = +x[0]; if (g <= 6) m |= 1; if (g <= 7) m |= 2; if (g === 8) m |= 4; if (g === 9) m |= 8; } return m; };
let LAST_MASK = {};
function learnable(dex, species, gen) {
	const out = new Set();
	const mask = LAST_MASK = {};
	let s = species;
	const seen = new Set();
	while (s && s.exists && !seen.has(s.id)) {
		seen.add(s.id);
		let ls = dex.species.getLearnsetData(s.id).learnset;
		// 폼 체인지 폼(로토무 세탁·히트 등)은 자기 기술(전용기)만 따로 적혀 있으므로 원래 모습의 기술을 항상 합침
		if (s.changesFrom) ls = { ...(dex.species.getLearnsetData(dex.species.get(s.changesFrom).id).learnset || {}), ...(ls || {}) };
		if (!ls && s.baseSpecies !== s.name) ls = dex.species.getLearnsetData(dex.species.get(s.baseSpecies).id).learnset;
		if (ls) {
			for (const moveid in ls) {
				out.add(moveid); // 내셔널 도감: 모든 세대에서 배운 기술 허용
				mask[moveid] = (mask[moveid] || 0) | srcMask(ls[moveid]);
			}
		}
		s = s.prevo ? dex.species.get(s.prevo) : null;
	}
	// 테라버스트: 스칼렛·바이올렛에 나오지 않는 포켓몬도 배울 수 있게 (그 세대 표시 9).
	// 단, 어느 세대에서도 기술머신(출처 'M')을 하나도 못 배우는 포켓몬(뿔충이·딱충이·개무소·실쿤·카스쿤·두루지벌레 등 — 설정상 기술머신 불가)은 뺌
	// 소드·실드 기술레코드로만 한두 개 배우던 캐터피·단데기, 잠재파워뿐인 안농도 설정상 기술머신을 못 배우는 쪽으로 봄
	const NO_TM_CONCEPT = new Set(['caterpie', 'metapod', 'unown']);
	if (species.isNonstandard && !out.has('terablast') && !NO_TM_CONCEPT.has(species.id)) {
		let hasTM = false;
		const chk = ls => { for (const m in ls || {}) if (ls[m].some(x => x.includes('M'))) { hasTM = true; return; } };
		const seen2 = new Set();
		for (let x = species; x && x.exists && !seen2.has(x.id); x = x.prevo ? dex.species.get(x.prevo) : null) {
			seen2.add(x.id);
			chk(dex.species.getLearnsetData(x.id).learnset);
			if (x.baseSpecies !== x.name) chk(dex.species.getLearnsetData(dex.species.get(x.baseSpecies).id).learnset);
		}
		if (hasTM) { out.add('terablast'); mask.terablast = (mask.terablast || 0) | 8; }
	}
	if (species.id.startsWith('rotom') && species.forme) {
		const extra = { rotomheat: 'overheat', rotomwash: 'hydropump', rotomfrost: 'blizzard', rotomfan: 'airslash', rotommow: 'leafstorm' }[species.id];
		if (extra) { out.add(extra); mask[extra] = 15; }
	}
	if (out.has('hiddenpower')) {
		for (const t of Object.keys(TYPE_KO)) {
			const id = 'hiddenpower' + t.toLowerCase();
			if (moveIndex[id] !== undefined) { out.add(id); mask[id] = mask.hiddenpower; }
		}
	}
	return [...out].filter(id => moveIndex[id] !== undefined && !result.moves[id].z && !result.moves[id].x)
		.map(id => moveIndex[id]).sort((a, b) => a - b);
}

const BATTLE_ONLY = new Set(['Castform', 'Cherrim', 'Darmanitan', 'Meloetta', 'Aegislash', 'Wishiwashi', 'Minior', 'Mimikyu',
	'Cramorant', 'Eiscue', 'Morpeko', 'Palafin', 'Terapagos']);
for (const s of dex9.species.all()) {
	if (s.num <= 0) continue;
	if (s.isNonstandard && ['CAP', 'LGPE', 'Custom', 'Pokestar'].includes(s.isNonstandard)) continue; // 'Future'(레전즈 Z-A 메가) 포함
	if (s.forme && /Gmax|Totem|Starter|Artisan|Masterpiece/.test(s.forme)) continue;
	if (s.baseSpecies === 'Pikachu' && s.forme) continue; // 모자·옷 피카츄 제외
	if (s.forme && ['Vivillon', 'Alcremie', 'Pichu'].includes(s.baseSpecies)) continue; // 겉모습만 다른 폼
	if (s.baseSpecies === 'Minior' && s.forme !== 'Meteor') continue;
	const isBattleOnly = !!s.battleOnly || (s.forme && BATTLE_ONLY.has(s.baseSpecies) && !s.forme.startsWith('Galar') && s.forme !== 'Galar') ||
		/^Mega|^Primal/.test(s.forme) || s.name === 'Necrozma-Ultra' || s.forme === 'Crowned' && false;
	result.species[s.id] = {
		n: speciesName(s, dex9), en: s.name, num: s.num, base: s.baseSpecies !== s.name ? Dex.species.get(s.baseSpecies).id : undefined,
		tags: s.tags.length ? s.tags : undefined, tier: s.natDexTier || s.tier, fut: s.isNonstandard === 'Future' ? 1 : undefined, av: availOf(s.id), gx: s.canGigantamax ? 1 : undefined,
		g: { [GEN]: {
			t: s.types, bs: [s.baseStats.hp, s.baseStats.atk, s.baseStats.def, s.baseStats.spa, s.baseStats.spd, s.baseStats.spe],
			ab: Object.values(s.abilities).map(a => dex9.abilities.get(a).id),
			fe: s.nfe ? 0 : 1,
			bo: isBattleOnly ? 1 : undefined,
			gr: s.gender || undefined,
			req: s.requiredItem ? dex9.items.get(s.requiredItem).id : (s.requiredItems ? dex9.items.get(s.requiredItems[0]).id : undefined),
			wt: s.weightkg,
			ls: isBattleOnly ? undefined : learnable(dex9, s, GEN),
			lg: isBattleOnly ? undefined : String.fromCharCode(...learnable(dex9, s, GEN).map(i => 48 + (LAST_MASK[moveIds[i]] || 0))),
			cls: isBattleOnly || !CHAMP_LS[s.id]?.learnset || !/[cb]/.test(availOf(s.id) || '') ? undefined : Object.keys(CHAMP_LS[s.id].learnset).filter(id => moveIndex[id] !== undefined).map(id => moveIndex[id]),
		} },
	};
	const sp = result.species[s.id], era = speciesEra(s, sp.g[GEN]);
	if (era) sp.e = era;
}

// ── 성격·타입 ──
for (const n of Dex.natures.all()) {
	result.natures[n.id] = { n: ko.names.NatureNames[n.name] || n.name, en: n.name, p: n.plus || '', m: n.minus || '' };
}
for (const t of Dex.forGen(9).types.all()) {
	result.types[t.name] = TYPE_KO[t.name] || t.name;
}

// ── 배틀 메시지 ──
for (const [kind, enTable, koTable] of [
	['moves', en.moves, ko.moves], ['abilities', en.abilities, ko.abilities], ['items', en.items, ko.items],
]) {
	for (const id in enTable) {
		const m = mergeMessages(enTable[id], koTable[id]);
		if (Object.keys(m).length) result.text[id] = m;
	}
	void kind;
}
for (const id in en.default) {
	if (id === 'ui') continue;
	const m = mergeMessages(en.default[id], ko.default[id]);
	// default 테이블 항목은 이름(weatherName 등)도 필요
	if (ko.default[id]?.weatherName) m.weatherName = ko.default[id].weatherName;
	if (id === 'default') result.defaultText = m;
	else result.text[id] = Object.assign(result.text[id] || {}, m);
}

result.moveIds = moveIds;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
// ── 싸라기눈 → 설경 (9세대 명칭으로 통일: 설명·메시지·날씨 이름 모두) ──
if (result.text.hail && result.text.snowscape) {
	for (const k of ['start', 'end', 'upkeep']) if (result.text.snowscape[k]) result.text.hail[k] = result.text.snowscape[k];
	result.text.hail.weatherName = '설경';
	if (result.text.hail.damage) result.text.hail.damage = result.text.hail.damage.replace('싸라기눈이', '눈보라가');
}
(function walk(o) {
	for (const k of Object.keys(o)) {
		const v = o[k];
		if (typeof v === 'string') { if (v.includes('싸라기눈')) o[k] = v.replace(/싸라기눈/g, '설경'); }
		else if (v && typeof v === 'object') walk(v);
	}
})(result);
if (result.moves.hail) result.moves.hail.n = '설경 (싸라기눈)'; // 옛 기술 '싸라기눈'은 9세대 '설경'과 구분
fs.writeFileSync(OUT, JSON.stringify(result));
console.log(`dex.json: 포켓몬 ${Object.keys(result.species).length}, 기술 ${moveIds.length}, 특성 ${Object.keys(result.abilities).length}, ` +
	`도구 ${Object.keys(result.items).length}, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
