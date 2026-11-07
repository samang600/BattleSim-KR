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
/** 세대마다 배틀 성능이 다른 특성: 쇼다운의 gen8·gen7·gen6 모드에서 동작(이벤트 함수)을 바꾼 특성을 모두 가져와
 *  그 세대 이하 룰에 세대 순서대로 겹쳐 적용 (쇼다운의 gen6 ← gen7 ← gen8 상속과 같음). 설명은 data.ts ABIL_ERA_DESC */
const GEN_ABIL: { [g: number]: { [id: string]: any } } = { 8: GEN8_ABILITIES as any, 7: GEN7_ABILITIES as any, 6: GEN6_ABILITIES as any };
const NOT_BEHAVIOR = new Set(['inherit', 'rating', 'flags', 'isNonstandard', 'num', 'name', 'desc', 'shortDesc', 'isBreakable', 'isPermanent', 'suppressWeather']);
/** 노말스킨 6세대: Z기술·다이맥스 기술까지 노말로 바꿔서 제외 */
const ABIL_SKIP = new Set(['normalize']);
/** 무제한(너프 없음): 이 특성은 더 강했던 세대의 동작 */
const MAX_ABIL: { [id: string]: number } = { intrepidsword: 8, dauntlessshield: 8, protean: 8, libero: 8, transistor: 8, disguise: 7,
	galewings: 6, aerilate: 6, pixilate: 6, refrigerate: 6, parentalbond: 6, prankster: 6 };
/** 엔진 본체에서 세대를 보고 처리하는 6세대 동작을 특성으로 흉내 */
const GEN6_EXTRA: { [id: string]: any } = {
	// 부모유대: 두 번째 공격 1/4 → 1/2 (본체가 1/4 로 줄이므로 위력 2배)
	parentalbond: { inherit: true, onBasePowerPriority: 8, onBasePower(this: any, bp: number, pokemon: any, target: any, move: any) { if (move.multihitType === 'parentalbond' && move.hit > 1) return this.chainModify(2); } },
	// 짓궂은마음: 악타입에게도 통함 (본체의 악타입 무효는 pranksterBoosted 표시로 판단)
	prankster: { inherit: true, onModifyPriority(priority: number, pokemon: any, target: any, move: any) { if (move?.category === 'Status') return priority + 1; } },
};
function abilityAt(id: string, era: number) {
	if (ABIL_SKIP.has(id)) return null;
	const parts = [8, 7, 6].filter(g => g >= era).map(g => GEN_ABIL[g][id]).filter(a => a && Object.keys(a).some(k => !NOT_BEHAVIOR.has(k)));
	const extra = era <= 6 ? GEN6_EXTRA[id] : null;
	if (!parts.length && !extra) return null;
	const o: any = Object.assign({}, ...parts, extra || {}, { inherit: true });
	for (const k of NOT_BEHAVIOR) if (k !== 'inherit') delete o[k];
	return o;
}
function eraAbilities(era: '8' | '7' | '6' | 'max') {
	const out: { [id: string]: any } = {};
	const ids = new Set([...[8, 7, 6].flatMap(g => Object.keys(GEN_ABIL[g])), ...Object.keys(GEN6_EXTRA)]);
	for (const id of ids) {
		const a = era === 'max' ? (MAX_ABIL[id] ? abilityAt(id, MAX_ABIL[id]) : null) : abilityAt(id, +era);
		if (a) out[id] = a;
	}
	// 7세대 탈: 잠꼬대로 나온 구르기·아이스볼은 기술 상태가 없을 수 있음 → 만들어 줌 (9세대 엔진에서 오류 방지)
	if (out.disguise?.onDamage) {
		const orig = out.disguise.onDamage;
		out.disguise.onDamage = function (this: any, damage: number, target: any, source: any, effect: any) {
			if (effect && ['rollout', 'iceball'].includes(effect.id) && source && !source.volatiles?.[effect.id]) source.volatiles[effect.id] = { contactHitCount: 1 };
			return orig.call(this, damage, target, source, effect);
		};
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
	// 무제한: 상태이상(마비 1/8·잠듦 2~3턴·얼음 최대 3턴)·날씨·필드는 챔피언스 방식 (날씨·필드는 9세대와 같음)
	const extra = era === 'max' ? { conditions: { Conditions: champConditions } } : {};
	return { scripts: { Scripts: { inherit: 'gen9', gen: 9 } }, pokedex: { Pokedex }, moves: { Moves }, abilities: { Abilities: eraAbilities(era) }, ...extra };
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
