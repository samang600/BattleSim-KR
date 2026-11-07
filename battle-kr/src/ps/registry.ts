/**
 * Pokémon Showdown 시뮬레이터는 Node 에서 `require(동적경로)` 로 데이터를 읽는다.
 * 브라우저에서는 그럴 수 없으므로, 필요한 데이터 모듈을 정적으로 묶어 두고
 * 전역 `require` 를 흉내 내 경로 → 모듈을 돌려준다.
 */
import * as base_abilities from '../../../data/abilities';
import * as base_aliases from '../../../data/aliases';
import * as base_conditions from '../../../data/conditions';
import * as base_formatsdata from '../../../data/formats-data';
import * as base_items from '../../../data/items';
import * as base_moves from '../../../data/moves';
import * as base_natures from '../../../data/natures';
import * as base_pokedex from '../../../data/pokedex';
import * as base_rulesets from '../../../data/rulesets';
import * as base_scripts from '../../../data/scripts';
import * as base_typechart from '../../../data/typechart';

import * as rb_gen9 from '../../../data/random-battles/gen9/teams';

import * as formats from './formats';
import { RAW, maxSpecies, maxMove } from '../data';
import CHAMP from './champions-moves.json';
import { Conditions as CHAMP_CONDITIONS } from '../../../data/mods/champions/conditions';
import { Moves as CHAMP_MOD_MOVES } from '../../../data/mods/champions/moves';
import { Abilities as CHAMP_MOD_ABILITIES } from '../../../data/mods/champions/abilities';
import { Abilities as GEN8_ABILITIES } from '../../../data/mods/gen8/abilities';
import { Abilities as GEN7_ABILITIES } from '../../../data/mods/gen7/abilities';
import { Abilities as GEN6_ABILITIES } from '../../../data/mods/gen6/abilities';

/** 포켓몬 챔피언스 PP: 5→8, 10→12, 15→16, 20 이상→20 (1 같은 특수값은 그대로) */
export function championsPP(pp: number) { return pp >= 20 ? 20 : pp >= 15 ? 16 : pp >= 10 ? 12 : pp >= 5 ? 8 : pp; }

/** Showdown 의 champions 모드 데이터(inherit 방식)를 기본 데이터에 덮어씀. isNonstandard(챔피언스에 없는 것 표시)는 내셔널 도감 규칙이라 무시,
 *  값이 undefined 인 키는 그 동작을 없앰(예: 트림의 '나무열매를 먹어야 함' 제한), condition 은 inherit 이면 합침 */
export function applyChampionsMod(table: { [id: string]: any }, mod: { [id: string]: any }) {
	for (const [id, patch] of Object.entries(mod)) {
		const t = table[id];
		if (!t) continue;
		for (const [k, v] of Object.entries(patch)) {
			if (k === 'inherit' || k === 'isNonstandard') continue;
			if (k === 'condition' && (v as any)?.inherit && t.condition) { const { inherit, ...rest } = v as any; t.condition = { ...t.condition, ...rest }; }
			else t[k] = v;
		}
	}
}

/** 포켓몬 챔피언스 기술 사양 적용 (basePower·accuracy·type·secondary·self·boosts·flags·target·critRatio·ignoreAbility) */
export function applyChampionsMoves(Moves: { [id: string]: any }) {
	// 1) Showdown champions 모드의 기술 변경 (위력·명중·PP·앙코르·사슬묶기·저주·배수의진·속이다 첫 턴 제한 등)
	applyChampionsMod(Moves, CHAMP_MOD_MOVES as any);
	// 2) 앱 자체 목록 (Serebii 'Updated Attacks' — 겹치는 기술은 값이 같음)
	for (const [id, patch] of Object.entries(CHAMP as { [id: string]: any })) {
		if (id.startsWith('_')) continue;
		const m = Moves[id];
		if (!m) continue;
		for (const [k, v] of Object.entries(patch)) {
			if (k === 'secondary') { const sec = { ...(m.secondary || {}) }; for (const [sk, sv] of Object.entries(v as any)) if (sv !== '__keep__') sec[sk] = sv; m.secondary = sec; }
			else if (k === 'flags') m.flags = { ...(m.flags || {}), ...(v as any) };
			else if (k === 'self') m.self = { ...(m.self || {}), ...(v as any) };
			else m[k] = v;
		}
	}
	// PP: 챔피언스는 PP업 없이 5→8, 10→12, 15→16, 20 이상→20 (Pokébase 자료)
	for (const m of Object.values(Moves)) {
		if (!m || typeof m.pp !== 'number') continue;
		m.pp = championsPP(m.pp);
		m.noPPBoosts = true;
	}
	// 은혜갚기·화풀이: 친밀도와 관계없이 항상 102 (시뮬레이터가 요청 문자열에 콜백 값을 붙이므로 콜백은 남겨 둠)
	for (const id of ['return', 'frustration']) if (Moves[id]) { Moves[id].basePower = 102; Moves[id].basePowerCallback = () => 102; }
	// 소금절이: 매 턴 1/16 (물·강철 타입은 1/8) — 본가는 1/8·1/4
	if (Moves.saltcure?.condition) {
		Moves.saltcure.condition.onResidual = function (this: any, pokemon: any) {
			this.damage(pokemon.baseMaxhp / (pokemon.hasType(['Water', 'Steel']) ? 8 : 16));
		};
	}
}

/** 포켓몬 챔피언스 상태이상 (Showdown 의 champions 모드와 같음):
 *  마비 — 행동 불능 1/8 (본가 1/4) / 잠듦 — 2~3턴 (2턴째에 깰 확률 1/3, 본가 1~3턴) / 얼음 — 최대 3턴, 매 턴 1/4 로 녹음 (본가 1/5, 상한 없음)
 *  화상·독·맹독 등 지속 데미지는 본가와 같아 그대로 */
export function applyChampionsConditions(Conditions: { [id: string]: any }) {
	for (const [id, patch] of Object.entries(CHAMP_CONDITIONS as { [id: string]: any })) {
		if (!Conditions[id]) continue;
		const { inherit, ...rest } = patch;
		Object.assign(Conditions[id], rest);
	}
}

// ── 규칙의 포켓몬 풀에 따른 데이터 모드 ──
// 기본(gen9) = 스칼렛·바이올렛 사양 그대로. krchamp = 포켓몬 챔피언스 사양(전국도감 '최신'·챔피언스 풀),
// kr8·kr7·kr6 = 그 세대의 종족값·타입·특성·기술 수치, krmax = 무제한(세대 중 가장 강한 사양) (배틀 처리 방식은 9세대 그대로)
const cloneTable = (t: { [id: string]: any }) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v && typeof v === 'object' ? { ...v, ...(v.condition ? { condition: { ...v.condition } } : {}) } : v]));
const champMoves = cloneTable((base_moves as any).Moves); applyChampionsMoves(champMoves);
const champConditions = cloneTable((base_conditions as any).Conditions); applyChampionsConditions(champConditions);
const champAbilities = cloneTable((base_abilities as any).Abilities); applyChampionsMod(champAbilities, CHAMP_MOD_ABILITIES as any);

const ABIL = (base_abilities as any).Abilities as { [id: string]: { name: string } };
/** 세대마다 배틀 성능이 다른 특성: 쇼다운의 그 세대 모드 동작을 가져옴 (설명은 data.ts ABIL_ERA_DESC)
 *  값 = 그 동작이 쓰인 마지막 세대 → 그 세대 이하 룰에 적용. 무제한(max)은 MAX_ABIL 의 더 강한 쪽 */
const ABIL_ERA: { [id: string]: 8 | 7 | 6 } = {
	intrepidsword: 8, dauntlessshield: 8, protean: 8, libero: 8,          // 8세대: 나올 때마다 / 기술마다
	innerfocus: 7, oblivious: 7, owntempo: 7, scrappy: 7, rattled: 7,     // 7세대: 위협 무효·발동 없음
	disguise: 7, moody: 7,                                                // 7세대: 탈 데미지 없음, 명중·회피도 오름
	galewings: 6, aerilate: 6, pixilate: 6, refrigerate: 6, normalize: 6, // 6세대: HP 조건 없음, 1.3배, 노말화 위력 보정 없음
};
const MAX_ABIL = ['intrepidsword', 'dauntlessshield', 'protean', 'libero', 'disguise', 'galewings', 'aerilate', 'pixilate', 'refrigerate'];
const GEN_ABIL: { [g: number]: { [id: string]: any } } = { 8: GEN8_ABILITIES as any, 7: GEN7_ABILITIES as any, 6: GEN6_ABILITIES as any };
function eraAbilities(era: '8' | '7' | '6' | 'max') {
	const out: { [id: string]: any } = {};
	for (const [id, g] of Object.entries(ABIL_ERA)) {
		if (era === 'max' ? !MAX_ABIL.includes(id) : g < +era) continue;
		const src = GEN_ABIL[g][id];
		if (src) out[id] = { ...src, inherit: true };
	}
	return out;
}
/** 세대 모드: dex.json 의 세대 차이(e)로 종족·기술을 덮어씀 */
function eraMod(era: '8' | '7' | '6' | 'max') {
	const Pokedex: { [id: string]: any } = {}, Moves: { [id: string]: any } = {};
	for (const [id, sp] of Object.entries(RAW.species)) {
		const e = era === 'max' ? (sp.e ? maxSpecies(sp, sp.g[9]) : undefined) : sp.e?.[era];
		if (!e || !(base_pokedex as any).Pokedex[id]) continue;
		const patch: any = { inherit: true };
		if (e.bs) patch.baseStats = { hp: e.bs[0], atk: e.bs[1], def: e.bs[2], spa: e.bs[3], spd: e.bs[4], spe: e.bs[5] };
		if (e.t) patch.types = e.t;
		if (e.ab) { const keys = ['0', '1', 'H', 'S', '2', '3', '4', '5']; patch.abilities = Object.fromEntries(e.ab.map((a, i) => [keys[i], ABIL[a]?.name || a])); }
		Pokedex[id] = patch;
	}
	for (const [id, mv] of Object.entries(RAW.moves)) {
		const t = era === 'max' ? (mv.e ? maxMove(mv) : undefined) : mv.e?.[era];
		if (!t || !(base_moves as any).Moves[id]) continue;
		Moves[id] = { inherit: true, type: t[0], category: t[1], basePower: t[2], accuracy: t[3] === 0 ? true : t[3], pp: t[4], priority: t[5], target: t[6] };
	}
	return { scripts: { Scripts: { inherit: 'gen9', gen: 9 } }, pokedex: { Pokedex }, moves: { Moves }, abilities: { Abilities: eraAbilities(era) } };
}
const ERA_MODS = { kr8: eraMod('8'), kr7: eraMod('7'), kr6: eraMod('6'), krmax: eraMod('max') };
export const MODS: string[] = ['krchamp', ...Object.keys(ERA_MODS)];
const MOD_FILES: { [path: string]: any } = {
	'/ps/data/mods/krchamp/scripts': { Scripts: { inherit: 'gen9', gen: 9 } },
	'/ps/data/mods/krchamp/moves': { Moves: champMoves },
	'/ps/data/mods/krchamp/conditions': { Conditions: champConditions },
	'/ps/data/mods/krchamp/abilities': { Abilities: champAbilities },
	...Object.fromEntries(Object.entries(ERA_MODS).flatMap(([m, files]) => Object.entries(files).map(([f, v]) => [`/ps/data/mods/${m}/${f}`, v]))),
};

const REGISTRY: { [path: string]: any } = {
	'/ps/data/abilities': base_abilities,
	'/ps/data/aliases': base_aliases,
	'/ps/data/conditions': base_conditions,
	'/ps/data/formats-data': base_formatsdata,
	'/ps/data/items': base_items,
	'/ps/data/moves': base_moves,
	'/ps/data/natures': base_natures,
	'/ps/data/pokedex': base_pokedex,
	'/ps/data/rulesets': base_rulesets,
	'/ps/data/scripts': base_scripts,
	'/ps/data/typechart': base_typechart,

	'/ps/data/random-battles/gen9/teams': rb_gen9,

	'/ps/config/formats': formats,
	...MOD_FILES,
};

function normalize(p: string, from = '/ps/sim') {
	const parts = (p.startsWith('/') ? p : from + '/' + p).split('/');
	const out: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') out.pop();
		else out.push(part);
	}
	return '/' + out.join('/').replace(/\.(ts|js)$/, '');
}

function notFound(p: string) {
	const e: any = new Error(`Cannot find module '${p}'`);
	e.code = 'MODULE_NOT_FOUND';
	return e;
}

const fakeRequire: any = (p: string) => {
	if (p === 'node:crypto' || p === 'crypto') return globalThis.crypto;
	const key = normalize(p);
	const mod = REGISTRY[key];
	if (!mod) throw notFound(p);
	return mod;
};
fakeRequire.resolve = (p: string) => {
	const key = normalize(p);
	if (!REGISTRY[key]) throw notFound(p);
	return key;
};

(globalThis as any).__psRequire = fakeRequire;
